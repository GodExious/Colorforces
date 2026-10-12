import { getRuntimeValue, setRuntimeValues } from '../../storage/runtime.js';
import { appSettings } from '../../settings.js';
import { UPDATE_CHECK_COOLDOWN } from '../../config/cache-policy.js';
import { fetchRemoteRelease, fetchChangelogText } from '../../api/updates.js';
import { CURRENT_VERSION } from '../../config/runtime.js';
import { CHANGELOG_URLS } from '../../config/release.js';
import { parseReleaseNotes } from './release-notes.js';

// 读出更新检查状态：上次检查时间与最近已知版本。
function readCheckState() {
  return { lastCheckTime: 0, latestKnownVersion: '', ...getRuntimeValue('updateCheck') };
}

// 清除版本检查冷却时间，保留最近已知版本。
export function resetUpdateCooldown() {
  setRuntimeValues({ updateCheck: { ...readCheckState(), lastCheckTime: 0 } });
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

// 新版本的更新内容：当前版本之后、到新版本为止的各个版本，每种语言各取一份（弹窗开着时切换语言，内容跟着换）。
// 返回 { 语言: [{ version, sections }] }，见 parseReleaseNotes。文档取不到或读不出时那种语言是空的，
// 弹窗照常显示，只是不列内容。
async function loadReleaseNotes(remoteVersion) {
  const wanted = ({ version }) =>
    compareVersions(version, CURRENT_VERSION) > 0 && compareVersions(version, remoteVersion) <= 0;
  const entries = await Promise.all(
    Object.keys(CHANGELOG_URLS).map(async (lang) => {
      try {
        return [lang, parseReleaseNotes(await fetchChangelogText(lang)).filter(wanted)];
      } catch {
        return [lang, []];
      }
    }),
  );
  return Object.fromEntries(entries);
}

// 按设置和冷却规则检查更新，必要时请求显示提醒。
export async function checkScriptUpdate(force = false) {
  if (!force && appSettings.general.disableUpdateCheck) {
    return { success: true, skipped: true, reason: 'disabled' };
  }

  const state = readCheckState();
  const now = Date.now();
  if (!force && state.lastCheckTime && now - state.lastCheckTime < UPDATE_CHECK_COOLDOWN) {
    return { success: true, skipped: true, reason: 'cooldown' };
  }

  const release = await fetchRemoteRelease();
  if (!release) {
    return { success: false, reason: 'fetch_failed' };
  }
  const { version: remoteVersion, url: downloadUrl } = release;

  setRuntimeValues({ updateCheck: { lastCheckTime: now, latestKnownVersion: remoteVersion } });

  const comp = compareVersions(remoteVersion, CURRENT_VERSION);
  const hasUpdate = comp > 0;
  const isPreview = comp < 0;
  if (hasUpdate) {
    announceUpdate?.(remoteVersion, downloadUrl, await loadReleaseNotes(remoteVersion));
  }

  return { success: true, hasUpdate, isPreview, remoteVersion, currentVersion: CURRENT_VERSION };
}

let announceUpdate;
// 连接版本检查结果与菜单更新弹窗。
export function configureUpdateUI(callback) {
  announceUpdate = callback;
}
