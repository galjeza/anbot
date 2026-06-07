(() => {
  const ns = (window.AnBot = window.AnBot || {});

  const DB_NAME = 'anbot-image-cache';
  const STORE_NAME = 'images';
  const DB_VERSION = 1;

  // Replaces the filesystem-backed `AdImages/<hash>/` directory tree the
  // Electron app used. Same priority ordering for legacy hashes lives in
  // ad-hash.js so existing users could be migrated later if needed.
  const openDb = () =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

  const tx = async (mode, fn) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      let result;
      Promise.resolve(fn(store))
        .then((r) => {
          result = r;
        })
        .catch(reject);
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  };

  const recordKey = (hash, index) => `${hash}/${index}`;
  const manifestKey = (hash) => `${hash}/__manifest__`;

  const has = async (hash) => {
    return tx('readonly', (store) =>
      new Promise((resolve) => {
        const req = store.get(manifestKey(hash));
        req.onsuccess = () => resolve(Boolean(req.result));
        req.onerror = () => resolve(false);
      }),
    );
  };

  const list = async (hash) => {
    const result = await tx('readonly', (store) =>
      new Promise((resolve, reject) => {
        const req = store.get(manifestKey(hash));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
    );
    return result?.count ?? 0;
  };

  const putImage = async (hash, index, blob) => {
    await tx('readwrite', (store) => {
      store.put(blob, recordKey(hash, index));
    });
  };

  const setManifest = async (hash, count) => {
    await tx('readwrite', (store) => {
      store.put({ count, savedAt: Date.now() }, manifestKey(hash));
    });
  };

  const getImage = async (hash, index) => {
    return tx('readonly', (store) =>
      new Promise((resolve, reject) => {
        const req = store.get(recordKey(hash, index));
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      }),
    );
  };

  ns.imageCache = {
    has,
    list,
    putImage,
    setManifest,
    getImage,
  };
})();
