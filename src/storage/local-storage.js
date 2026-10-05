// 本项目旧 localStorage 数据路径已 deprecated；仅保留显式查看和清理能力。
// 只按键名存取早期版本用过的那几个键（见 storage/keys.js 的 LEGACY_LOCAL_KEYS），不枚举站点本地存储：
// 里面别的键属于原站或别的脚本，不是本插件的数据。
// 按键读取旧数据，不把旧后端当作 GM 写入失败时的回退。没有或读不了时返回 null。
export function readLocalValue(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}
// 仅删除调用方明确指定的旧键，禁止清空站点全部数据。
export function removeLocalValue(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {}
}
