import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const Obnavljanje = () => {
  const location = useLocation();
  const { selected } = location.state || { selected: [] }; // Fallback to an empty array if state is undefined

  useEffect(() => {
    console.log('Selected ads from obnavljanje:', selected);
  }, [selected]);

  return <div>{/* Render your component using the selected ads */}</div>;
};

export default Obnavljanje;
