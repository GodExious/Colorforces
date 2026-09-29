// 本项目旧 localStorage 数据路径已 deprecated；仅保留显式查看和清理能力。
// 枚举站点本地键，由业务层筛选属于 Colorforces 的旧数据。
export function listLocalKeys() {
  if (typeof localStorage === 'undefined') return [];
  const keys = [];
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (key) keys.push(key);
  }
  return keys;
}
// 按键读取旧数据，不把旧后端当作 GM 写入失败时的回退。
export function readLocalValue(key) {
  return localStorage.getItem(key);
}
// 仅删除调用方明确指定的旧键，禁止清空站点全部数据。
export function removeLocalValue(key) {
  localStorage.removeItem(key);
}
