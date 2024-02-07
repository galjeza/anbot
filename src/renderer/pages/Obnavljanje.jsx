import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const Obnavljanje = () => {
  const location = useLocation();
  const { selected } = location.state || { selected: [] };
  const [currentAd, setCurrentAd] = useState(null);
  const [progress, setProgress] = useState(0);
  const [pauseTimer, setPauseTimer] = useState(0);
  const [isInPause, setIsInPause] = useState(false);
  const navigate = useNavigate();

  // Configurable pause duration
  const pauseDuration = 4; // Change this value to adjust the pause duration

  useEffect(() => {
    let timeoutId;
    const renewAds = async () => {
      for (let i = 0; i < selected.length; i++) {
        setCurrentAd(selected[i]);
        await window.electron.ipcRenderer.renewAd(selected[i].adId);
        setProgress((i + 1 / selected.length) * 100);
        // Start the pause timer only if there are more ads to renew
        if (i < selected.length - 1) {
          setPauseTimer(pauseDuration);
          setIsInPause(true);
          for (let j = pauseDuration; j > 0; j--) {
            setPauseTimer(j);
            await new Promise(
              (resolve) => (timeoutId = setTimeout(resolve, 1000)),
            );
          }
          setIsInPause(false);
        }
      }
      navigate('/');
    };

    if (selected.length > 0) {
      renewAds();
    } else {
      navigate('/'); // Navigate back if no ads are selected
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="w-full max-w-md p-4 bg-gray-800 shadow-md rounded-lg">
        <h2 className="text-lg font-semibold text-center mb-4 text-white">
          Obnavljam oglase
        </h2>
        {selected.length > 0 ? (
          <>
            {currentAd && !isInPause ? (
              <p className="text-center">Obnavljam: {currentAd.name}</p>
            ) : (
              <p className="text-center">
                Naslendnji oglas se bo obnovil čez : {pauseTimer}s
              </p>
            )}
            <div className="w-full bg-gray-700 rounded-full h-2.5 mt-4">
              <div
                className="bg-blue-500 h-2.5 rounded-full"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm text-center mt-2">
              Stanje obnove: {Math.round(progress)}%
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
