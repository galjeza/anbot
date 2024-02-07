import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  MailIcon,
  KeyIcon,
  CreditCardIcon,
  LinkIcon,
} from '@heroicons/react/solid';

const Menu = () => {
  const [loading, setLoading] = useState(false);
  // Initialize user state with null or default values
  const [user, setUser] = useState({
    email: '',
    password: '',
    credits: 0,
    brokerId: '',
  });
  useEffect(() => {
    const fetchCredits = async (email) => {
      try {
        const response = await fetch(
          `https://avtonet-server.onrender.com/user?email=${encodeURIComponent(
            email,
          )}`,
        );
        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Failed to fetch credits:', error);
        return 0; // Return a default value or handle the error as needed
      }
    };

    const fetchUserData = async () => {
      setLoading(true);
      try {
        const userData = await window.electron.store.get('userData');
        console.log('Fetched user data:', userData);
        if (userData) {
          // Fetch credits using the email from the stored user data
          const apiData = await fetchCredits(userData.email);
          const credits = apiData.credits;
          const brokerId = apiData.brokerId;

          console.log('apiData', apiData);
          console.log('Fetched credits:', apiData.credits);
          setUser({ ...userData, credits, brokerId }); // Update state with fetched credits
          window.electron.store.set('userData', {
            email: userData.email,
            password: userData.password,
            credits,
            brokerId,
          }); // Update store with fetched credits
        } else {
          console.log('No user data found in the store, using default values.');
        }
      } catch (error) {
        console.error('Failed to fetch user data from electron-store:', error);
      }
      setLoading(false);
    };

    fetchUserData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-600  text-white">
        Nalagam...
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center w-screen h-screen bg-gray-900">
      <div className="max-w-sm w-full bg-gray-800 text-gray-200 shadow-md rounded-lg overflow-hidden">
        <div className="p-5">
          <div className="flex items-center mb-3">
            <MailIcon className="h-6 w-6 text-gray-400 mr-2" />
            <span>Email: {user.email}</span>
          </div>
          <div className="flex items-center mb-3">
            <KeyIcon className="h-6 w-6 text-gray-400 mr-2" />
            <span>Geslo: {user.password}</span>{' '}
            {/* Consider hashing or securing the password */}
          </div>
          <div className="flex items-center mb-3">
            <CreditCardIcon className="h-6 w-6 text-gray-400 mr-2" />
            <span>Krediti: {user.credits}</span>
          </div>

          <div className="flex items-center mb-3">
            <LinkIcon className="h-6 w-6 text-gray-400 mr-2" />
            <span>Broker ID: {user.brokerId}</span>
          </div>
        </div>

        <div className="bg-gray-700 p-4">
          <Link
            to="/update"
            className="block py-2 px-4 text-gray-200 bg-gray-800 hover:bg-gray-600 mb-2 border border-gray-600 rounded-lg transition ease-in-out duration-150"
          >
            Spremeni email in geslo
          </Link>
          <Link
            to="/adlist"
            className="block py-2 px-4 text-gray-200 bg-gray-800 hover:bg-gray-600 mb-2 border border-gray-600 rounded-lg transition ease-in-out duration-150"
          >
            Obnovi oglase
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Menu;
