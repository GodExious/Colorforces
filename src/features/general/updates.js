import { appStorage } from '../../storage/gm.js';
import { UPDATE_CHECK_KEY } from '../../storage/keys.js';
import { appSettings } from '../../settings.js';
import { UPDATE_CHECK_COOLDOWN } from '../../config/cache-policy.js';
import { fetchRemoteRelease } from '../../api/updates.js';
import { CURRENT_VERSION } from '../../config/runtime.js';

// 清除版本检查冷却时间，保留最近已知版本。
export function resetUpdateCooldown() {
  const state = appStorage.getJSON(UPDATE_CHECK_KEY, { lastCheckTime: 0, latestKnownVersion: '' });
  state.lastCheckTime = 0;
  appStorage.setJSON(UPDATE_CHECK_KEY, state);
}

// 逐段比较数字版本号，判断升级或预览版本。
export function compareVersions(v1, v2) {
  if (!v1 || !v2) return 0;
  const normalize = (v) =>
    String(v)
      .replace(/^[^\d]*/, '')
      .split('.')
      .map((n) => parseInt(n, 10) || 0);
  const parts1 = normalize(v1);
  const parts2 = normalize(v2);
  const len = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < len; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

// 按设置和冷却规则检查更新，必要时请求显示提醒。
export async function checkScriptUpdate(force = false) {
  if (!force && appSettings.disableAutoCheckUpdate) {
    return { success: true, skipped: true, reason: 'disabled' };
  }

  const state = appStorage.getJSON(UPDATE_CHECK_KEY, { lastCheckTime: 0, latestKnownVersion: '' });
  const now = Date.now();
  if (!force && state.lastCheckTime && now - state.lastCheckTime < UPDATE_CHECK_COOLDOWN) {
    return { success: true, skipped: true, reason: 'cooldown' };
  }

  const release = await fetchRemoteRelease();
  if (!release) {
    return { success: false, reason: 'fetch_failed' };
  }
  const { version: remoteVersion, url: downloadUrl } = release;

  state.lastCheckTime = now;
  state.latestKnownVersion = remoteVersion;
  appStorage.setJSON(UPDATE_CHECK_KEY, state);

  const comp = compareVersions(remoteVersion, CURRENT_VERSION);
  const hasUpdate = comp > 0;
  const isPreview = comp < 0;
  if (hasUpdate) {
    announceUpdate?.(remoteVersion, downloadUrl);
  }

  return { success: true, hasUpdate, isPreview, remoteVersion, currentVersion: CURRENT_VERSION };
}

let announceUpdate;
// 连接版本检查结果与菜单更新弹窗。
export function configureUpdateUI(callback) {
  announceUpdate = callback;
}
