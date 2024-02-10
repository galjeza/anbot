import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const UpdateUser = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [chromePath, setChromePath] = useState(''); // State for Chrome path
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    // Save email, password, and Chrome path together
    window.electron.store.set('userData', { email, password, chromePath });
    navigate('/');
  };

  return (
    <div className="flex items-center justify-center w-screen h-screen bg-gray-900">
      <form className="bg-gray-800 p-5 rounded-lg" onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-200 mb-2" htmlFor="email">
            Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 rounded-lg bg-gray-700 text-gray-300"
            required
          />
        </div>
        <div className="mb-4">
          <label className="block text-gray-200 mb-2" htmlFor="password">
            Geslo
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 rounded-lg bg-gray-700 text-gray-300"
            required
          />
        </div>
        {/* Chrome Path Field */}
        <div className="mb-4">
          <label className="block text-gray-200 mb-2" htmlFor="chromePath">
            Chrome Path
          </label>
          <input
            type="text"
            id="chromePath"
            value={chromePath}
            onChange={(e) => setChromePath(e.target.value)}
            className="w-full p-2 rounded-lg bg-gray-700 text-gray-300"
          />
        </div>
        <button
          type="submit"
          className="py-2 px-4 mr-3 bg-blue-500 hover:bg-blue-700 text-white rounded-lg"
        >
          Posodobi
        </button>
        <button
          className="py-2 px-4 bg-blue-500 hover:bg-blue-700 text-white rounded-lg"
          onClick={() => {
            navigate('/');
          }}
        >
          Prekliči
        </button>
      </form>
    </div>
  );
};

export default UpdateUser;
