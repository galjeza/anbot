(() => {
  const ns = (window.AnBot = window.AnBot || {});
  const { LOGIN_SUCCESS_URL } = ns.constants;

  // The user signs in via the avto.net tab themselves. The background only
  // calls this to verify the session is alive before starting a batch.
  const isAlreadyLoggedIn = () =>
    window.location.href.startsWith(LOGIN_SUCCESS_URL);

  ns.loginToAvtonet = { isAlreadyLoggedIn };
})();
