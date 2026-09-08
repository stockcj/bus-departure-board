import React, { useEffect, useState } from 'react';
import './styles.css';
import { STOPS } from './stops.js';

function App() {
  const [departures, setDepartures] = useState([]);
  const [stopName, setStopName] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedStopId, setSelectedStopId] = useState(STOPS[0].id);

  const fetchDepartures = async () => {
    try {
      const res = await fetch(`api/departure?stopId=${selectedStopId}`);
      const data = await res.json();
      setDepartures(data.departures || []);
      setStopName(data.stop || '');
    } catch (err) {
      console.error('Failed to fetch departures:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartures();
    const interval = setInterval(fetchDepartures, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, [selectedStopId]);

  return (
    <div className="board-container">

      <div className="stop-selector">
        <label className="visually-hidden" htmlFor="stop-select">Choose a stop</label>
        <select
          id="stop-select"
          value={selectedStopId}
          onChange={(e) => {
            setSelectedStopId(e.target.value);
            setLoading(true);
          }}
        >
          {STOPS.map(stop => (
            <option key={stop.id} value={stop.id}>{stop.name}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="loading-animation">
          Fetching data<span className="dots">
            <span>.</span><span>.</span><span>.</span>
          </span>
        </div>
      )}

      {!loading && stopName && (
        <h2 className='stop-name'>
          Departures for {stopName}
        </h2>
      )}

      {!loading && departures.length > 0 && (
        <div className="board">
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Destination</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {departures.map((dep, i) => (
                <tr key={i}>
                  <td>{dep.service}</td>
                  <td>{dep.destination}</td>
                  <td>{dep.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && departures.length === 0 && (
        <div className="board">
          <table>
            <thead>
              <tr>
                <th>No departures available.</th>
              </tr>
            </thead>
          </table>
        </div>
      )}
    </div>
  );
}

export default App;
