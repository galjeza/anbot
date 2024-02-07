import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Menu from './pages/Menu';
import UpdateUser from './pages/UpdateUser';
import AdList from './pages/Adlist';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Menu />} />
        <Route path="/adlist" element={<AdList />} />
        <Route path="/update" element={<UpdateUser />} />
      </Routes>
    </Router>
  );
}
