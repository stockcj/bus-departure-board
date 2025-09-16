import React, { useEffect, useState } from 'react';
import './styles.css';

function App() {
  const [departures, setDepartures] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDepartures = async () => {
    try {
      const res = await fetch('api/departure');
      const data = await res.json();
      setDepartures(data);
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
  }, []);

  return (
    <div className="board-container">
      {loading && (
        <div className="loading-animation">
          Fetching data<span className="dots">
            <span>.</span><span>.</span><span>.</span>
          </span>
        </div>
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
