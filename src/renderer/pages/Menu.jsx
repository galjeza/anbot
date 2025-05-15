import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

// TODO   make icons work
/*
import {
  MailIcon,
  KeyIcon,
  CreditCardIcon,
  LinkIcon,
} from '@heroicons/react/solid';

*/
const Menu = () => {
  const [loading, setLoading] = useState(false);
  // Initialize user state with null or default values
  const [user, setUser] = useState({
    chromePath: '',
    email: '',
    password: '',
    subscriptionPaidTo: '',
    brokerId: '',
    hdImages: false,
  });
  useEffect(() => {
    const fetchApiData = async (email) => {
      console.log('1');
      try {
        console.log('2');
        const response = await fetch(
          `https://avtonet-server.onrender.com/user?email=${encodeURIComponent(
            email,
          )}`,
        );
        console.log('3');
        const data = await response.json();
        return data;
      } catch (error) {
        console.log('4');
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
          const apiData = await fetchApiData(userData.email);
          const subscriptionPaidTo = apiData.subscriptionPaidTo;
          const brokerId = apiData.brokerId;

          console.log('apiData', apiData);
          setUser({ ...userData, subscriptionPaidTo, brokerId }); // Update state with fetched credits
          window.electron.store.set('userData', {
            chromePath: userData.chromePath,
            email: userData.email,
            password: userData.password,
            subscriptionPaidTo,
            brokerId,
            hdImages: apiData.hdImages || false,
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
      <div className="flex justify-center items-center min-h-screen bg-gray-900 text-white">
        <p>Nalagam...</p>
      </div>
    );
  }

  const isSubscriptionActive = new Date(user.subscriptionPaidTo) > new Date();
  const subdateDateString = new Date(user.subscriptionPaidTo).toLocaleString(
    'sl-SI',
    { month: 'long', day: 'numeric', year: 'numeric' },
  );

  return (
    <div className="flex items-center flex-col justify-center w-screen h-screen bg-gray-900">
      <h1 className="text-red-400 text-2xl font-bold mb-4">
        Opozorilo: Ne obnavljajte oglasov ki nimajo objavljene VIN!
      </h1>
      <div className="max-w-sm w-full bg-gray-800 text-gray-200 shadow-md rounded-lg overflow-hidden">
        <div className="p-5">
          <div className="flex items-center mb-3">
            {/* <MailIcon className="h-6 w-6 text-gray-400 mr-2" />*/}
            <span>Email: {user.email}</span>
          </div>
          <div className="flex items-center mb-3">
            {/*<KeyIcon className="h-6 w-6 text-gray-400 mr-2" /> */}
            <span>Geslo: {user.password}</span>{' '}
          </div>
          <div className="flex items-center mb-3">
            {/* <CreditCardIcon className="h-6 w-6 text-gray-400 mr-2" />*/}
            <span>
              Status naročnine:
              {isSubscriptionActive ? (
                <span className="text-green-400">
                  {' '}
                  Aktivna do {subdateDateString}
                </span>
              ) : (
                <span className="text-red-400">Ni aktivna</span>
              )}
            </span>
          </div>

          <div className="flex items-center mb-3">
            {/* <LinkIcon className="h-6 w-6 text-gray-400 mr-2" />*/}
            <span>Broker ID: {user.brokerId}</span>
          </div>
          <div className="flex items-center mb-3">
            {/* <LinkIcon className="h-6 w-6 text-gray-400 mr-2" />*/}
            <span> Hd slike: {user.hdImages ? 'Da' : 'Ne'}</span>
          </div>
        </div>

        <div className="bg-gray-700 p-4">
          <Link
            to="/update"
            className="block py-2 px-4 text-gray-200 bg-gray-800 hover:bg-gray-600 mb-2 border border-gray-600 rounded-lg transition ease-in-out duration-150"
          >
            Konfiguracija
          </Link>
          {isSubscriptionActive ? (
            <>
              <Link
                to="/adlist"
                state={{
                  type: 'car',
                }}
                className="block py-2 px-4 text-gray-200 bg-gray-800 hover:bg-gray-600 mb-2 border border-gray-600 rounded-lg transition ease-in-out duration-150"
              >
                Obnovi avtomobile
              </Link>
              <Link
                to="/adlist"
                state={{
                  type: 'dostavna',
                }}
                className="block py-2 px-4 text-gray-200 bg-gray-800 hover:bg-gray-600 mb-2 border border-gray-600 rounded-lg transition ease-in-out duration-150"
              >
                Obnovi dostavna vozila
              </Link>
            </>
          ) : (
            <p>
              <span className="text-red-400">
                Obnova oglasov ni mogoča saj nimate aktivne naročnine
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Menu;
