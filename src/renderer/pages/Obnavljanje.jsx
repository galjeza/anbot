import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const Obnavljanje = () => {
  const location = useLocation();
  const { selected, pause, type } = location.state || { selected: [] };
  const navigate = useNavigate();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const checkForUpdates = async () => {
      const hasUpdate = await window.electron.ipcRenderer.checkUpdateStatus();
      if (hasUpdate) {
        setUpdateAvailable(true);
        navigate('/');
        return;
      }

      if (selected.length > 0) {
        setIsProcessing(true);
        try {
          await window.electron.ipcRenderer.renewAds(selected, pause, type);
          navigate('/');
        } catch (err) {
          setError(err.message || 'An error occurred during ad renewal');
          setIsProcessing(false);
        }
      } else {
        navigate('/');
      }
    };

    checkForUpdates();
  }, []);

  if (updateAvailable) {
    return null; // Will redirect to home page
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="w-full max-w-md p-4 bg-red-800 shadow-md rounded-lg">
          <h2 className="text-lg font-semibold text-center mb-4 text-white">
            Napaka pri obnavljanju oglasov
          </h2>
          <p className="text-center mt-4 text-red-200">{error}</p>
          <div className="flex justify-center mt-6">
            <button
              onClick={() => navigate('/')}
              className="py-2 px-4 bg-blue-500 hover:bg-blue-700 text-white rounded-lg"
            >
              Nazaj na glavno stran
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="w-full max-w-md p-4 bg-gray-800 shadow-md rounded-lg">
        <h2 className="text-lg font-semibold text-center mb-4 text-white">
          {isProcessing ? 'Obnavljam oglase' : 'Pripravljam obnavljanje'}
        </h2>
        {selected.length > 0 ? (
          <>
            <p className="text-center mt-4">
              {isProcessing
                ? 'Obnavljam izbrane oglase. Ne zapirajte programa.'
                : 'Pripravljam obnavljanje oglasov...'}
            </p>
            <p className="text-center mt-4">
              <span className="font-semibold">Število izbranih oglasov:</span>{' '}
              {selected.length}
            </p>
            <p className="text-center mt-4">
              <span className="font-semibold">Pavza:</span> {pause} minut
            </p>
            <p className="text-center mt-4">
              <span className="font-semibold">
                Pričakovan čas za obnovo vseh vozil:
              </span>{' '}
              {Math.ceil(selected.length * pause + selected.length * 2)} minut
            </p>
          </>
        ) : (
          <p>Niste izbrali nobenega oglasa.</p>
        )}
      </div>
    </div>
  );
};

export default Obnavljanje;
