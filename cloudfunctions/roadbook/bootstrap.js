const COLLECTIONS = ['users', 'roadbooks', 'rate_limits'];

function isMissingCollection(error) {
  const code = String(error?.code ?? error?.errCode ?? '');
  const message = String(error?.message ?? error?.errMsg ?? '');
  return code === '-502005' || /collection not exist/i.test(message);
}

function isExistingCollection(error) {
  return /already exists|collection exists|集合已存在/i.test(
    String(error?.message ?? error?.errMsg ?? ''),
  );
}

function createBootstrap(db) {
  let ready;
  async function ensureCollection(name) {
    try {
      await db.collection(name).limit(1).get();
      return;
    } catch (error) {
      if (!isMissingCollection(error)) throw error;
    }
    try {
      await db.createCollection(name);
    } catch (error) {
      // Concurrent cold starts can both observe a missing collection.
      if (!isExistingCollection(error)) throw error;
    }
  }
  return () => {
    if (!ready) ready = Promise.all(COLLECTIONS.map(ensureCollection));
    return ready;
  };
}

module.exports = { COLLECTIONS, createBootstrap };
