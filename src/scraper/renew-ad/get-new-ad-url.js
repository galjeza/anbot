export const getNewAdUrl = (adType) => {
  switch (adType) {
    case 'car':
      return 'https://www.avto.net/_2016mojavtonet/ad_select_rubric_icons.asp?SID=10000';
    case 'dostavna':
      return 'https://www.avto.net/_2016mojavtonet/ad_insert_car_step1.asp?SID=20000';
    case 'platisca':
      return 'https://www.avto.net/_2016mojavtonet/ad_select_rubric_continue.asp?KodaRubrike=R10KAT1010';
    default:
      throw new Error(`Unsupported adType: ${adType}`);
  }
};
