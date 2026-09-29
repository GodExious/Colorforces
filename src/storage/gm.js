const writeListeners = new Set();
let noticeQueued = false;
// 同一批写入只通知一次，不轮询油猴存储，也不在写入路径解析大对象。
function notifyStorageWrites() {
  if (noticeQueued || !writeListeners.size) return;
  noticeQueued = true;
  queueMicrotask(() => {
    noticeQueued = false;
    for (const listener of writeListeners) {
      try {
        listener();
      } catch (error) {
        console.error('Colorforces: storage listener failed', error);
      }
    }
  });
}
// 订阅本插件成功写入或删除的数据，页面退出时可独立取消订阅。
export function subscribeStorageWrites(listener) {
  writeListeners.add(listener);
  return () => writeListeners.delete(listener);
}

// 通过油猴存取数据，并兼容已保存的对象与 JSON 字符串。
export const appStorage = {
  // 枚举当前脚本的 GM 键；旧环境没有枚举能力时返回空列表。
  keys() {
    return typeof GM_listValues === 'function' ? GM_listValues() : [];
  },
  getItem(key) {
    try {
      return GM_getValue(key, null);
    } catch (e) {
      console.error('Colorforces: GM_getValue failed', e);
      return null;
    }
  },
  setItem(key, value) {
    try {
      GM_setValue(key, value);
      notifyStorageWrites();
    } catch (e) {
      console.error('Colorforces: GM_setValue failed', e);
    }
  },
  removeItem(key) {
    try {
      GM_deleteValue(key);
      notifyStorageWrites();
    } catch (e) {
      console.error('Colorforces: GM_deleteValue failed', e);
    }
  },
  getJSON(key, defaultVal = null) {
    const raw = this.getItem(key);
    if (raw === null || raw === undefined) return defaultVal;
    if (typeof raw === 'object') return raw;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return defaultVal;
    }
  },
  setJSON(key, obj) {
    const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
    this.setItem(key, str);
  },
};
