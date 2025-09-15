import axios from 'axios';
import { JSDOM } from 'jsdom';

export default async function handler(req, res) {
  try {
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
      return { service, destination, time };
    });
    console.log(departures);
    res.status(200).json(departures);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch departures' });
  }
}
