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
  const [updateAvailable, setUpdateAvailable] = useState(false);
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
    const checkForUpdates = async () => {
      const hasUpdate = await window.electron.ipcRenderer.checkUpdateStatus();
      setUpdateAvailable(hasUpdate);
    };

    const interval = setInterval(checkForUpdates, 60000); // Check every minute
    checkForUpdates(); // Check immediately on mount

    return () => clearInterval(interval);
  }, []);

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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="w-full max-w-md p-4 bg-gray-800 shadow-md rounded-lg">
        <h2 className="text-lg font-semibold text-center mb-4">
          Avtonet Bot - Obnavljanje oglasov
        </h2>

        {updateAvailable && (
          <div className="mb-4 p-4 bg-yellow-600 rounded-lg">
            <h3 className="font-bold mb-2">
              Na voljo je nova verzija programa!
            </h3>
            <p className="mb-2">Za posodobitev:</p>
            <ol className="list-decimal list-inside">
              <li>Zaprite program</li>
              <li>Zaženite program ponovno</li>
              <li>Potrdite namestitev posodobitve</li>
            </ol>
            <p className="mt-2 text-yellow-200">
              Obnavljanje oglasov je onemogočeno dokler ne namestite
              posodobitve.
            </p>
          </div>
        )}

        <div className="bg-gray-700 p-4 mb-4 rounded-lg">
          <p className="mb-2">
            <span className="font-semibold">Email:</span> {user.email}
          </p>
          <p className="mb-2">
            <span className="font-semibold">Naročnina aktivna do:</span>{' '}
            {subdateDateString}
          </p>
          <p>
            <span className="font-semibold">Status naročnine:</span>{' '}
            <span
              className={
                isSubscriptionActive ? 'text-green-400' : 'text-red-400'
              }
            >
              {isSubscriptionActive ? 'Aktivna' : 'Neaktivna'}
            </span>
          </p>
        </div>

        <div className="bg-gray-700 p-4">
          <Link
            to="/update"
            className="block py-2 px-4 text-gray-200 bg-gray-800 hover:bg-gray-600 mb-2 border border-gray-600 rounded-lg transition ease-in-out duration-150"
          >
            Konfiguracija
          </Link>
          {isSubscriptionActive && !updateAvailable ? (
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
              <Link
                to="/adlist"
                state={{
                  type: 'platisca',
                }}
                className="block py-2 px-4 text-gray-200 bg-gray-800 hover:bg-gray-600 mb-2 border border-gray-600 rounded-lg transition ease-in-out duration-150"
              >
                Obnovi platišča
              </Link>
            </>
          ) : (
            <p>
              <span className="text-red-400">
                {updateAvailable
                  ? 'Obnova oglasov ni mogoča. Prosimo, posodobite program.'
                  : 'Obnova oglasov ni mogoča saj nimate aktivne naročnine'}
              </span>
            </p>
          )}

          {/* Developer testing button - only visible in development */}
          {process.env.NODE_ENV === 'development' && (
            <button
              onClick={async () => {
                await window.electron.ipcRenderer.devTriggerUpdate();
                const hasUpdate =
                  await window.electron.ipcRenderer.checkUpdateStatus();
                setUpdateAvailable(hasUpdate);
              }}
              className="mt-4 py-2 px-4 text-gray-200 bg-red-800 hover:bg-red-700 mb-2 border border-red-600 rounded-lg transition ease-in-out duration-150"
            >
              [DEV] Trigger Update Available
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Menu;
