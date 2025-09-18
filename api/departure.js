import { createClient } from 'redis';
import axios from 'axios';
import { JSDOM } from 'jsdom';

const STOPS = [
    {
    id: '0500SCOMB004',
    name: 'Comberton - South Street',
    url: 'https://www.cambridgeshirebus.info/Popup_Content/WebDisplay/WebDisplay.aspx?stopRef=0500SCOMB004'
  },
  {
    id: '0500CCITY119',
    name: 'Cambridge - Drummer Street Bay 3',
    url: 'https://www.cambridgeshirebus.info/Popup_Content/WebDisplay/WebDisplay.aspx?stopRef=0500CCITY119'
  },
  {
    id: '0500CCITY208',
    name: 'Cambridge - Catholic Church',
    url: 'https://www.cambridgeshirebus.info/Popup_Content/WebDisplay/WebDisplay.aspx?stopRef=0500CCITY208'
  }
]

// create Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));

async function ensureRedisConnected() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}

export default async function handler(req, res) {
  try {

    await ensureRedisConnected();

    const stopId = req.query.stopId || '0500SCOMB004';
    const stop = STOPS.find(s => s.id === stopId);
    
    if (!stop) {
      return res.status(400).json({ error: 'Invalid stopId' });
    }

    const cacheKey = `departures:${stopId}`;
    const cached = await redisClient.get(cacheKey);
    const now = Date.now();

    if (cached) {
        const parsed = JSON.parse(cached);
        if (now - parsed.timestamp < 60_000) {
            console.log("Returning cached departures for", stopId);
            return res.status(200).json(parsed.data);
        }
    }

    console.log("Fetching fresh departures for", stopId);

    const { data } = await axios.get(stop.url);

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

    await redisClient.set(
        cacheKey,
        JSON.stringify({ data: responseData, timestamp: now })
    )

    res.status(200).json(responseData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch departures' });
  }
}
