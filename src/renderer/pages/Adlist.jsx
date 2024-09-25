import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const first10letters = (str) => str.slice(0, 35).concat('...');

const AdList = () => {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAds, setSelectedAds] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [pause, setPause] = useState(60);
  const navigate = useNavigate();

  useEffect(() => {
    const getAds = async () => {
      setLoading(true);
      try {
        const fetchedAds = await window.electron.ipcRenderer.getAds();
        setAds(fetchedAds.reverse() || []); // Reverse the array after fetching
      } catch (error) {
        console.error('Failed to fetch ads:', error);
      } finally {
        setLoading(false);
      }
    };
    getAds();
  }, []);

  useEffect(() => {
    if (selectAll) {
      setSelectedAds(new Set(ads.map((ad) => ad.adId)));
    } else {
      setSelectedAds(new Set());
    }
  }, [selectAll, ads]);

  const handleAdSelection = (adId) => {
    const newSelection = new Set(selectedAds);
    if (newSelection.has(adId)) {
      newSelection.delete(adId);
    } else {
      newSelection.add(adId);
    }
    setSelectedAds(newSelection);
    setSelectAll(newSelection.size === ads.length);
  };

  const handleSubmit = () => {
    const selected = ads.filter((ad) => selectedAds.has(ad.adId));
    navigate('/obnavljanje', { state: { selected, pause } });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-600 text-white">
        Nalagam oglase...
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-gray-900 text-white p-4 overflow-y-auto">
      <div className="flex justify-between items-center w-full max-w-6xl mb-4">
        <button
          onClick={handleSubmit}
          className="py-2 px-4 bg-blue-500 hover:bg-blue-700 text-white font-semibold rounded-lg shadow"
        >
          Obnovi izbrane oglase
        </button>
        <label className="flex items-center cursor-pointer">
          <span className="ml-2 text-sm ">Pavza med oglasi (minute)</span>
          <input
            type="number"
            value={pause}
            className="form-checkbox h-5 w-10  rounded border-gray-300 focus:ring-blue-500 bg-gray-800 border-2 checked:bg-blue-500 checked:border-transparent"
            onChange={(e) => setPause(e.target.value)}
          />
        </label>
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="form-checkbox h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 bg-gray-800 border-2 checked:bg-blue-500 checked:border-transparent"
            checked={selectAll}
            onChange={() => setSelectAll(!selectAll)}
          />
          <span className="ml-2 text-sm">Izberi vse</span>
        </label>
      </div>
      <div className="w-full max-w-6xl grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-4">
        {ads.map((ad) => (
          <div
            key={ad.adId}
            className="bg-gray-800 p-4 rounded-lg shadow-lg flex flex-col items-center text-center"
          >
            <img
              src={ad.photoUrl}
              alt={ad.name}
              className="object-cover h-30 w-full rounded-md mb-4"
            />
            <div className="flex justify-center items-center w-full">
              <label className="flex items-center cursor-pointer">
                <div className="ml-2 text-left">
                  <p className="font-bold text-sm text-ellipsis overflow-hidden">
                    {first10letters(ad.name)}
                  </p>
                  {/* Display price here */}
                  <p className="text-sm">{ad.price}</p>
                  <input
                    type="checkbox"
                    checked={selectedAds.has(ad.adId)}
                    onChange={() => handleAdSelection(ad.adId)}
                    className="form-checkbox h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 bg-gray-700 border-2 checked:bg-blue-500 checked:border-transparent"
                  />
                </div>
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdList;
