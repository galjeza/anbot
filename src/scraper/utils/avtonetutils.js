export const fixGasType = (gasType) => {
  switch (gasType) {
    case 'elektro pogon':
      return 'epogon';
    case 'hibridni pogon':
      return 'hibrid';
    default:
      return gasType;
  }
};
