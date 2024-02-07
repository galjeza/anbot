// UpdateUser.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const UpdateUser = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    window.electron.store.set('userData', { email, password });
    navigate('/');
  };

  return (
    <div className="flex items-center justify-center w-screen h-screen bg-gray-900">
      <form className="bg-gray-800 p-5 rounded-lg" onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-gray-200 mb-2" htmlFor="email">
            New Email
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
            New Password
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
        <button
          type="submit"
          className="py-2 px-4 bg-blue-500 hover:bg-blue-700 text-white rounded-lg"
        >
          Update
        </button>
      </form>
    </div>
  );
};

export default UpdateUser;
