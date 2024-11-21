import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const Obnavljanje = () => {
  const location = useLocation();
  const { selected, pause, type } = location.state || { selected: [] };
  const navigate = useNavigate();

  console.log('Type in obnavljanje: ', type);

  useEffect(() => {
    let timeoutId;
    const renewAds = async () => {
      await window.electron.ipcRenderer.renewAds(selected, pause, type);
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
            <p className="text-center mt-4">
              Obnavljam izbrane oglase. Ne zapirajte programa.
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
