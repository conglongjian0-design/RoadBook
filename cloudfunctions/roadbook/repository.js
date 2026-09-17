function createRepository(db) {
  const cmd = db.command;
  async function get(collection, id) {
    if (typeof id !== 'string' || !id || id.length > 100) return null;
    const r = await db.collection(collection).where({ _id: id }).limit(1).get();
    return r.data[0] || null;
  }
  const repo = {
    getUser: (id) => get('users', id),
    getRoute: (id) => get('roadbooks', id),
    async createUser(id, data) {
      await db.runTransaction(async (tx) => {
        const { data: old } = await tx.collection('users').doc(id).get();
        if (!old) await tx.collection('users').doc(id).set({ data });
      });
    },
    async updateUser(id, data) {
      await db.collection('users').doc(id).update({ data });
    },
    async listRoutes({ ownerId, mode, keyword, offset, limit }) {
      const filter = ownerId ? { ownerId } : { visibility: 'public' };
      if (mode !== 'all') filter.mode = mode;
      let where = filter;
      if (keyword) {
        const regex = db.RegExp({
          regexp: keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          options: 'i',
        });
        where = cmd.and(filter, cmd.or([{ title: regex }, { city: regex }]));
      }
      const res = await db
        .collection('roadbooks')
        .where(where)
        .field({ segments: false, waypoints: false, description: false })
        .orderBy('updatedAt', 'desc')
        .skip(offset)
        .limit(limit)
        .get();
      return res.data;
    },
    async saveRoute(id, data, { ownerId, version, create }) {
      return db.runTransaction(async (tx) => {
        const ref = tx.collection('roadbooks').doc(id);
        const { data: old } = await tx.collection('roadbooks').doc(id).get();
        if (!create && (!old || old.ownerId !== ownerId)) throw new Error('无权编辑此路书');
        if (!create && old.version !== version) throw new Error('路书已更新，请重新打开后编辑');
        if (create && old) throw new Error('请重试保存');
        const saved = {
          ...data,
          version: (old?.version || 0) + 1,
          createdAt: old?.createdAt || Date.now(),
        };
        await ref.set({ data: saved });
        return { ...saved, _id: id };
      });
    },
    async deleteRoute(id, ownerId) {
      if (typeof id !== 'string') throw new Error('路书不存在');
      return db.runTransaction(async (tx) => {
        const { data: old } = await tx.collection('roadbooks').doc(id).get();
        if (!old || old.ownerId !== ownerId) throw new Error('无权删除');
        await tx.collection('roadbooks').doc(id).remove();
      });
    },
    async rateLimit(id) {
      return db.runTransaction(async (tx) => {
        const ref = tx.collection('rate_limits').doc(id),
          { data: old } = await tx.collection('rate_limits').doc(id).get(),
          now = Date.now();
        if (old && now - old.start < 60000 && old.count >= 5)
          throw new Error('规划过于频繁，请一分钟后再试');
        await ref.set({
          data: {
            start: old && now - old.start < 60000 ? old.start : now,
            count: old && now - old.start < 60000 ? old.count + 1 : 1,
          },
        });
      });
    },
  };
  return repo;
}
module.exports = { createRepository };
