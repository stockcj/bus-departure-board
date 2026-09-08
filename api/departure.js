import { createClient } from 'redis';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import { STOPS, findStop, stopUrl } from '../src/stops.js';

// Redis is used when REDIS_URL is configured. Without it (local dev) we fall
// back to an in-process cache, so no Redis instance is needed to run the app.
const redisClient = process.env.REDIS_URL
  ? createClient({ url: process.env.REDIS_URL })
  : null;

if (redisClient) {
  redisClient.on("error", (err) => console.error("Redis Client Error", err));
} else {
  console.log("No REDIS_URL set - caching departures in memory");
}

const memoryCache = new Map();

async function ensureRedisConnected() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
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
  await redisClient.set(key, value);
}

export default async function handler(req, res) {
  try {
    const stopId = req.query.stopId || STOPS[0].id;
    const stop = findStop(stopId);

    if (!stop) {
      return res.status(400).json({ error: 'Invalid stopId' });
    }

    const cacheKey = `departures:${stopId}`;
    const cached = await cacheGet(cacheKey);
    const now = Date.now();

    if (cached) {
        const parsed = JSON.parse(cached);
        if (now - parsed.timestamp < 60_000) {
            console.log("Returning cached departures for", stopId);
            return res.status(200).json(parsed.data);
        }
    }

    console.log("Fetching fresh departures for", stopId);

    const { data } = await axios.get(stopUrl(stop.id));

    const dom = new JSDOM(data);
    const doc = dom.window.document;

    // Grab first 5 departures
    const allRows = Array.from(doc.querySelectorAll('#gridViewRTI .gridRow')).slice(0, 5);

    const departures = allRows.map(row => {
      const service = row.querySelector('.gridServiceItem')?.textContent.trim() || '';
      const destination = row.querySelector('.gridDestinationItem span')?.textContent.trim() || '';
      const time = row.querySelector('.gridTimeItem')?.textContent.trim() || '';
      return {service, destination, time};
    });

    const responseData = { stop: stop.name, departures };

    console.log(responseData);

    await cacheSet(
        cacheKey,
        JSON.stringify({ data: responseData, timestamp: now })
    )

    res.status(200).json(responseData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch departures' });
  }
}
