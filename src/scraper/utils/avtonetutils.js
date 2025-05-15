export const fixGasType = (gasType) => {
  switch (gasType) {
    case 'elektro pogon':
      return 'epogon';
    case 'hibridni pogon':
      return 'hibrid';
    case 'CNG plin':
      return 'CNG';
    case 'LPG plin':
      return 'LPG';
    default:
      return gasType;
  }
};
