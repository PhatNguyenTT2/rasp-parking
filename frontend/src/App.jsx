import { useState, useEffect } from 'react';
import './App.css';
import parkingLogService from '../services/parkingLogService';
import Header from './components/Header';
import EntryLane from './components/EntryLane';
import ExitLane from './components/ExitLane';

function App() {
  const [allLogs, setAllLogs] = useState([]);
  const [latestEntry, setLatestEntry] = useState(null);

  // Fetch data
  const fetchData = async () => {
    try {
      // Get all parking logs (vehicles in parking lot)
      const allData = await parkingLogService.getCurrentParking();

      console.log('App - allData:', allData);

      const allLogsData = allData.data?.parkingLogs || [];

      setAllLogs(allLogsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  // Auto-update latestEntry when allLogs changes
  useEffect(() => {
    if (allLogs.length > 0) {
      // Luôn set xe đầu tiên (mới nhất) làm latestEntry
      setLatestEntry(allLogs[0]);
    } else {
      setLatestEntry(null);
    }
  }, [allLogs]);

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-2 gap-6 p-6 min-h-full">
          <EntryLane
            latestEntry={latestEntry}
            allEntries={allLogs}
            onEntryAdded={fetchData}
          />

          <ExitLane
            onExitProcessed={fetchData}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
