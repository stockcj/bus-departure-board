import { createClient } from 'redis';
import axios from 'axios';
import { JSDOM } from 'jsdom';

// create Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));
await redisClient.connect();

export default async function handler(req, res) {
  try {

    const cached = await redisClient.get(departures);
    const now = Date.now();

    if (cached) {
        const parsed = JSON.parse(cached);
        if (now - parsed.timestamp < 60_000) {
            console.log("Returning cached departures");
            return res.status(200).json(parsed.data);
        }
    }

    console.log("Fetching fresh departures");

    const busStopUrl = 'https://www.cambridgeshirebus.info/Popup_Content/WebDisplay/WebDisplay.aspx?stopRef=0500SCOMB004';
    const { data } = await axios.get(busStopUrl);

    const dom = new JSDOM(data);
    const doc = dom.window.document;

    // Grab first 5 departures
    const allRows = Array.from(doc.querySelectorAll('#gridViewRTI .gridRow')).slice(0, 5);

    const departures = allRows.map(row => {
      const service = row.querySelector('.gridServiceItem')?.textContent.trim() || '';
      const destination = row.querySelector('.gridDestinationItem span')?.textContent.trim() || '';
      const time = row.querySelector('.gridTimeItem')?.textContent.trim() || '';
    });

    await redisClient.set(
        "departures",
        JSON.stringify({ data: departures, timestamp: now })
    )

    console.log(departures);
    res.status(200).json(departures);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch departures' });
  }
}
