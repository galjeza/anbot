import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import Menu from './pages/Menu';
import UpdateUser from './pages/UpdateUser';
import AdList from './pages/Adlist';
import Obnavljanje from './pages/Obnavljanje';
import 'tailwindcss/tailwind.css';
import './App.css';
export default function App() {
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
