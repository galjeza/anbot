import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import Menu from './pages/Menu';
import UpdateUser from './pages/UpdateUser';
import AdList from './pages/Adlist';
import Obnavljanje from './pages/Obnavljanje';
import {
  MAINTENANCE_MODE,
  MAINTENANCE_TITLE,
  MAINTENANCE_MESSAGE,
} from './config';

export default function App() {
  if (MAINTENANCE_MODE) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white px-6">
        <div className="w-full max-w-xl p-6 bg-gray-800 shadow-md rounded-lg text-center">
          <h1 className="text-2xl font-semibold mb-4">{MAINTENANCE_TITLE}</h1>
          <p className="text-gray-200">{MAINTENANCE_MESSAGE}</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Menu />} />
        <Route path="/adlist" element={<AdList />} />
        <Route path="/update" element={<UpdateUser />} />
        <Route path="/obnavljanje" element={<Obnavljanje />} />
      </Routes>
    </Router>
  );
}
