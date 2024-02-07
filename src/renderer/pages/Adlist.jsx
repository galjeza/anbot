import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AdList = () => {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAds, setSelectedAds] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const getAds = async () => {
      setLoading(true);
      try {
        const fetchedAds = await window.electron.ipcRenderer.getAds();
        setAds(fetchedAds || []);
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
    // Find the selected ads in the ads array
    const selected = ads.filter((ad) => selectedAds.has(ad.adId));
    // Navigate to the new route with selected ads as state
    navigate('/obnavljanje', { state: { selected } });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-600  text-white">
        Nalagam oglase...
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-gray-900 text-white p-4 overflow-y-auto">
      <div className="flex justify-between items-center w-full max-w-6xl mb-4">
        <button
          onClick={handleSubmit}
          className="py-2 px-4 bg-blue-500 hover:bg-blue-700 text-white rounded-lg"
        >
          Obnovi izbrane oglase
        </button>
        <label className="flex items-center cursor-pointer text-sm">
          <input
            type="checkbox"
            className="mr-2"
            checked={selectAll}
            onChange={() => setSelectAll(!selectAll)}
          />
          Izberi vse
        </label>
      </div>
      <div className="w-full max-w-6xl grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {ads.map((ad) => (
          <div key={ad.adId} className="bg-gray-800 p-2 rounded-lg shadow-lg">
            <img
              src={ad.photoUrl}
              alt={ad.name}
              className="object-cover h-24 w-full rounded-md mb-2"
            />
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={selectedAds.has(ad.adId)}
                onChange={() => handleAdSelection(ad.adId)}
                className="mr-2"
              />
              <div>
                <p className="font-bold text-sm">{ad.name}</p>
                <p className="text-xs">{ad.price}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdList;
