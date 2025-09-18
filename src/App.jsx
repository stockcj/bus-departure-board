import React, { useEffect, useState } from 'react';
import './styles.css';

const STOPS = [
  { id: '0500SCOMB004', name: 'Comberton - South Street' },
  { id: '0500CCITY119', name: 'Cambridge - Drummer Street Bay 3' },
  { id: '0500CCITY208', name: 'Cambridge - Catholic Church' }
];

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

      <div className="stop-selector" style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
        {STOPS.map(stop => (
          <button
            key={stop.id}
            onClick={() => {
              setSelectedStopId(stop.id);
              setLoading(true);
            }}
            style={{
              padding: '0.5rem 1.2rem',
              borderRadius: '20px',
              border: stop.id === selectedStopId ? '2px solid #ff9d00' : '1px solid #444',
              background: stop.id === selectedStopId ? '#222' : '#111',
              color: stop.id === selectedStopId ? '#ff9d00' : 'lightgray',
              fontWeight: stop.id === selectedStopId ? 'bold' : 'normal',
              cursor: 'pointer',
              outline: 'none',
              transition: 'all 0.2s'
            }}
          >
            {stop.name}
          </button>
        ))}
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
        <div className="no-data">No departures available.</div>
      )}
    </div>
  );
}

export default App;
