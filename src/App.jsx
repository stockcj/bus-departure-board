import React, { useEffect, useState } from 'react';
import './styles.css';
import { STOPS } from './stops.js';

const REFRESH_MS = 60_000;

function App() {
  const [departures, setDepartures] = useState([]);
  const [stopName, setStopName] = useState('');
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'error'
  const [stale, setStale] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [selectedStopId, setSelectedStopId] = useState(STOPS[0].id);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // A late response from a previous stop selection must not overwrite the
    // current one, so ignore anything that resolves after cleanup runs.
    let cancelled = false;

    const fetchDepartures = async () => {
      try {
        const res = await fetch(`/api/departure?stopId=${selectedStopId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setDepartures(data.departures || []);
        setStopName(data.stop || '');
        setStale(Boolean(data.stale));
        setUpdatedAt(new Date());
        setStatus('ok');
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to fetch departures:', err);
        setStatus('error');
      }
    };

    setStatus('loading');
    setDepartures([]);
    setStopName('');
    setStale(false);
    fetchDepartures();

    const interval = setInterval(fetchDepartures, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedStopId, reloadKey]);

  // Only take over the whole screen with an error when there's nothing to show;
  // a failed background refresh keeps the last good board on screen.
  const showError = status === 'error' && departures.length === 0;

  let statusLine = null;
  if (status !== 'loading') {
    if (stale) {
      statusLine = {
        text: 'Live data unavailable — showing the last known departures',
        warn: true,
      };
    } else if (status === 'error' && departures.length > 0) {
      statusLine = {
        text: updatedAt
          ? `Couldn't refresh — last updated ${updatedAt.toLocaleTimeString()}`
          : "Couldn't refresh",
        warn: true,
      };
    } else if (updatedAt) {
      statusLine = { text: `Updated ${updatedAt.toLocaleTimeString()}`, warn: false };
    }
  }

  return (
    <div className="board-container">

      <div className="stop-selector">
        <label className="visually-hidden" htmlFor="stop-select">Choose a stop</label>
        <select
          id="stop-select"
          value={selectedStopId}
          onChange={(e) => setSelectedStopId(e.target.value)}
        >
          {STOPS.map(stop => (
            <option key={stop.id} value={stop.id}>{stop.name}</option>
          ))}
        </select>
      </div>

      {status === 'loading' && (
        <div className="loading-animation">
          Fetching data<span className="dots">
            <span>.</span><span>.</span><span>.</span>
          </span>
        </div>
      )}

      {showError && (
        <div className="error-message">
          <p>Couldn't load departures.</p>
          <button
            type="button"
            className="retry-button"
            onClick={() => setReloadKey((k) => k + 1)}
          >
            Try again
          </button>
        </div>
      )}

      {!showError && status !== 'loading' && stopName && (
        <h2 className='stop-name'>
          Departures for {stopName}
        </h2>
      )}

      {!showError && status !== 'loading' && departures.length > 0 && (
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

      {!showError && status === 'ok' && departures.length === 0 && (
        <div className="board">
          <p className="no-data">No departures available.</p>
        </div>
      )}

      {!showError && statusLine && (
        <p className={`status-line${statusLine.warn ? ' status-warn' : ''}`}>
          {statusLine.text}
        </p>
      )}
    </div>
  );
}

export default App;
