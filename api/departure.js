import { createClient } from 'redis';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import { STOPS, findStop, stopUrl } from '../src/stops.js';

// A cached response is "fresh" for this long; after that the next request
// refreshes it. Entries stay in the store longer (CACHE_TTL_S) so a stale copy
// is still available to serve if an upstream fetch fails.
const FRESH_MS = 60_000;
const CACHE_TTL_S = 600;

const UPSTREAM_TIMEOUT_MS = 8000;

// Fixed-window per-IP rate limit. A normal client polls once per minute per
// stop, so this only bites abusive traffic. Backed by Redis when configured
// (accurate across serverless instances), otherwise an in-process map.
const RATE_LIMIT = 30;
const RATE_WINDOW_S = 60;

// Redis is used when REDIS_URL is configured. Without it (local dev) we fall
// back to an in-process cache, so no Redis instance is needed to run the app.
const redisClient = process.env.REDIS_URL
  ? createClient({ url: process.env.REDIS_URL })
  : null;

if (redisClient) {
  redisClient.on('error', (err) => console.error('Redis Client Error', err));
} else {
  console.log('No REDIS_URL set - caching departures in memory');
}

const memoryCache = new Map();

// Reuse a single in-flight connect so concurrent invocations in the same
// instance don't race to open the socket.
let redisConnectPromise = null;
async function ensureRedisConnected() {
  if (redisClient.isOpen) return;
  if (!redisConnectPromise) {
    redisConnectPromise = redisClient.connect().catch((err) => {
      redisConnectPromise = null;
      throw err;
    });
  }
  await redisConnectPromise;
}

// Both backends store the same JSON string, so callers parse it the same way.
async function cacheGet(key) {
  if (!redisClient) return memoryCache.get(key) ?? null;
  await ensureRedisConnected();
  return redisClient.get(key);
}

async function cacheSet(key, value) {
  if (!redisClient) {
    memoryCache.set(key, value);
    return;
  }
  await ensureRedisConnected();
  await redisClient.set(key, value, { EX: CACHE_TTL_S });
}

const rateBuckets = new Map(); // ip -> { count, resetAt }, memory fallback

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return xff.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

// Returns { allowed, retryAfter? }. Throws only on an unexpected backend error,
// which the caller treats as "allow" so a limiter outage can't break the board.
async function checkRateLimit(ip) {
  const key = `ratelimit:${ip}`;

  if (redisClient) {
    await ensureRedisConnected();
    const count = await redisClient.incr(key);
    if (count === 1) await redisClient.expire(key, RATE_WINDOW_S);
    if (count > RATE_LIMIT) {
      const ttl = await redisClient.ttl(key);
      return { allowed: false, retryAfter: ttl > 0 ? ttl : RATE_WINDOW_S };
    }
    return { allowed: true };
  }

  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    if (rateBuckets.size > 5000) {
      for (const [k, v] of rateBuckets) if (now >= v.resetAt) rateBuckets.delete(k);
    }
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_S * 1000 });
    return { allowed: true };
  }
  bucket.count += 1;
  if (bucket.count > RATE_LIMIT) {
    return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { allowed: true };
}

// Parse the first few departure rows out of a WebDisplay page's HTML.
// Exported (and kept free of network/cache concerns) so it can be unit tested
// against saved fixtures - this selector logic is the most likely thing to
// break when the upstream site changes.
export function parseDepartures(html, limit = 5) {
  const doc = new JSDOM(html).window.document;
  const rows = Array.from(
    doc.querySelectorAll('#gridViewRTI .gridRow')
  ).slice(0, limit);

  return rows.map((row) => ({
    service: row.querySelector('.gridServiceItem')?.textContent.trim() || '',
    destination:
      row.querySelector('.gridDestinationItem span')?.textContent.trim() || '',
    time: row.querySelector('.gridTimeItem')?.textContent.trim() || '',
  }));
}

async function scrapeDepartures(stop) {
  const { data } = await axios.get(stopUrl(stop.id), {
    timeout: UPSTREAM_TIMEOUT_MS,
    headers: {
      'User-Agent':
        'bus-departure-board (https://github.com/stockcj/bus-departure-board)',
    },
  });

  const departures = parseDepartures(data);

  if (departures.length === 0) {
    console.warn(
      `No departure rows parsed for ${stop.id} - upstream markup may have changed`
    );
  }

  return { stop: stop.name, departures };
}

export default async function handler(req, res) {
  let rate;
  try {
    rate = await checkRateLimit(clientIp(req));
  } catch (err) {
    console.error('Rate limit check failed', err);
    rate = { allowed: true }; // fail open
  }
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfter));
    return res.status(429).json({ error: 'Too many requests' });
  }

  const stopId = req.query.stopId || STOPS[0].id;
  const stop = findStop(stopId);

  if (!stop) {
    return res.status(400).json({ error: 'Invalid stopId' });
  }

  const cacheKey = `departures:${stopId}`;
  const now = Date.now();

  let cached = null;
  try {
    const raw = await cacheGet(cacheKey);
    if (raw) cached = JSON.parse(raw);
  } catch (err) {
    console.error('Cache read failed', err);
  }

  if (cached && now - cached.timestamp < FRESH_MS) {
    console.log('Returning cached departures for', stopId);
    return res.status(200).json(cached.data);
  }

  console.log('Fetching fresh departures for', stopId);

  try {
    const responseData = await scrapeDepartures(stop);
    try {
      await cacheSet(
        cacheKey,
        JSON.stringify({ data: responseData, timestamp: now })
      );
    } catch (err) {
      console.error('Cache write failed', err);
    }
    return res.status(200).json(responseData);
  } catch (err) {
    console.error('Failed to fetch departures', err);
    if (cached) {
      // Upstream failed but we still hold an older copy - better than nothing.
      return res.status(200).json({ ...cached.data, stale: true });
    }
    return res.status(502).json({ error: 'Failed to fetch departures' });
  }
}
