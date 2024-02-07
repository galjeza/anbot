const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const humanDelay = async () => {
  const MIN = 500;
  const MAX = 2500;
  const delay = Math.floor(Math.random() * (MAX - MIN + 1) + MIN);
  await wait(delay);
};

module.exports = {
  wait,
  humanDelay,
};
