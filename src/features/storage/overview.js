import { appStorage } from '../../storage/gm.js';
import { readLocalValue } from '../../storage/local-storage.js';
import { appSettings } from '../../settings.js';
import { readRuntimeData } from '../../storage/runtime.js';
import {
  SETTINGS_KEY,
  CACHE_KEY,
  PARALLEL_CONTESTS_KEY,
  CLIST_STORAGE_KEY,
  AVATAR_CACHE_KEY,
  PREDICTION_STORAGE_KEYS,
  PREDICTION_CACHE_KEY,
  RUNTIME_DATA_KEY,
  ANALYTICS_KEY,
  USER_GROUPS_KEY,
  CUSTOM_FRAMES_KEY,
  CUSTOM_FRAME_ART_KEY,
  LEGACY_LOCAL_KEYS,
} from '../../storage/keys.js';
import { migrateDatasets } from '../user/analytics/data.js';
import { readStore as readGroups } from '../user/groups/store.js';
import { getCurrentUserHandle } from '../general/solved.js';
import { sortProblemIds } from '../../utils/problem.js';
import { textFingerprint } from '../../utils/fingerprint.js';
// 一份存储值占多少字节。
const bytesOf = (val) => {
  try {
    if (!val) return 0;
    const str = typeof val === 'string' ? val : JSON.stringify(val);
    return new Blob([str]).size;
  } catch (e) {
    return 0;
  }
};
// 量过、数过的结果按键记着：存着的内容没变就直接用。
// 最大的几项有十几兆，量一次大小、解析一次各要几十毫秒；存储页每次打开都重来的话，点了之后要卡一下才切得过去。
// 内容变没变看指纹（见 utils/fingerprint.js），不把原文留着：原文有十几兆，缓存场数设得多时上百兆。
// 指纹认不出来的改动，长度必定没变，字节数顶多差在个别非英文字符上，场数不会变，界面上看不出差别。
const remembered = new Map();
function recall(key, name, compute) {
  const raw = appStorage.getItem(key);
  // 不是文字的（没存过，或早期版本直接存下的对象）不记，每次现算。
  if (typeof raw !== 'string') {
    remembered.delete(key);
    return compute(raw);
  }
  const print = textFingerprint(raw);
  let entry = remembered.get(key);
  if (!entry || entry.print !== print) remembered.set(key, (entry = { print }));
  if (!(name in entry)) entry[name] = compute(raw);
  return entry[name];
}
// 读取原版单键存储字节数。
export const getStorageItemBytes = (key) => recall(key, 'bytes', bytesOf);
// 预测缓存里存了几场比赛。要把整份缓存解析一遍才数得出来。
const predictionContestCount = () =>
  recall(
    PREDICTION_CACHE_KEY,
    'contests',
    () => Object.keys(appStorage.getJSON(PREDICTION_CACHE_KEY, {})?.contests || {}).length,
  );
// 读取原版当前有效键列表。
export const ACTIVE_STORAGE_KEYS = [
  ...PREDICTION_STORAGE_KEYS,
  SETTINGS_KEY,
  CACHE_KEY,
  PARALLEL_CONTESTS_KEY,
  CLIST_STORAGE_KEY,
  AVATAR_CACHE_KEY,
  RUNTIME_DATA_KEY,
  ANALYTICS_KEY,
  USER_GROUPS_KEY,
  CUSTOM_FRAMES_KEY,
  CUSTOM_FRAME_ART_KEY,
];
// 把统计里费时间的部分拆成一小步一小步：每一步只量一个键，或者只数一次预测缓存。
// 菜单打开后趁页面空闲时逐步做完（见 StoragePage），之后打开存储页就都是现成的。
export const storageWarmupSteps = () => [
  ...ACTIVE_STORAGE_KEYS.map((key) => () => getStorageItemBytes(key)),
  predictionContestCount,
];
// 读取原版已解决题目缓存详情。
export const getUserSolvedStorageDetails = () => {
  const solvedKeys = [];
  let totalBytes = 0;
  let totalSolvedCount = 0;
  let currentUserSolvedCount = 0;
  let currentKey = null;
  const dataMap = {};
  try {
    const allKeys = appStorage.keys();
    const keySet = new Set(allKeys);
    const currentHandle = getCurrentUserHandle();
    currentKey = currentHandle ? 'cf_user_solved_' + currentHandle.toLowerCase() : null;
    if (currentKey) {
      keySet.add(currentKey);
    }

    for (const k of keySet) {
      if (k && k.startsWith('cf_user_solved_')) {
        const bytes = getStorageItemBytes(k);
        if (bytes > 0) {
          solvedKeys.push(k);
          totalBytes += bytes;
          const parsed = appStorage.getJSON(k, null);
          if (parsed) {
            if (Array.isArray(parsed.solved)) {
              const sorted = sortProblemIds(parsed.solved);
              let isDifferent = false;
              if (sorted.length !== parsed.solved.length) {
                isDifferent = true;
              } else {
                for (let i = 0; i < sorted.length; i++) {
                  if (sorted[i] !== parsed.solved[i]) {
                    isDifferent = true;
                    break;
                  }
                }
              }
              if (isDifferent) {
                parsed.solved = sorted;
                try {
                  appStorage.setJSON(k, parsed);
                } catch (e) {}
              } else {
                parsed.solved = sorted;
              }
              totalSolvedCount += parsed.solved.length;
            }
            dataMap[k] = parsed;
          }
        }
      }
    }

    if (currentKey && solvedKeys.includes(currentKey)) {
      solvedKeys.sort((a, b) => {
        if (a === currentKey) return -1;
        if (b === currentKey) return 1;
        return a.localeCompare(b);
      });
    } else {
      solvedKeys.sort((a, b) => a.localeCompare(b));
    }

    if (currentKey && dataMap[currentKey] && Array.isArray(dataMap[currentKey].solved)) {
      currentUserSolvedCount = dataMap[currentKey].solved.length;
    } else if (!currentHandle && solvedKeys.length > 0) {
      const fallbackKey = solvedKeys[0];
      if (dataMap[fallbackKey] && Array.isArray(dataMap[fallbackKey].solved)) {
        currentUserSolvedCount = dataMap[fallbackKey].solved.length;
      }
    }
  } catch (e) {}
  return {
    keys: solvedKeys,
    bytes: totalBytes,
    count: currentUserSolvedCount,
    totalCount: totalSolvedCount,
    currentUserSolvedCount,
    dataMap,
    currentKey,
  };
};
// 读取原版旧本地数据路径详情（deprecated）。旧数据有两处：
// stale 是油猴存储里已经不用的键；site 是早期版本留在网站本地存储里的键，只看约定的那几个。
// 同一个键名两处都有时合成一项，查看时显示油猴存储里的那份。清理要按这两份名单各删各的：
// site 里有的键名（如题库缓存）在油猴存储里是正在用的，不能照着键名把那一份也删了。
export const getLocalStorageDetails = () => {
  const dataMap = {};
  let totalBytes = 0;
  let stale = [];
  try {
    stale = (appStorage.keys() || []).filter(
      (k) => k && !ACTIVE_STORAGE_KEYS.includes(k) && !k.startsWith('cf_user_solved_'),
    );
  } catch (e) {}
  const site = LEGACY_LOCAL_KEYS.filter((k) => readLocalValue(k) !== null);
  const localKeys = [...new Set([...stale, ...site])];
  for (const k of localKeys) {
    const own = stale.includes(k) ? appStorage.getItem(k) : null;
    const old = site.includes(k) ? readLocalValue(k) : null;
    totalBytes += bytesOf(own) + bytesOf(old);
    const raw = own ?? old;
    try {
      dataMap[k] = JSON.parse(raw);
    } catch (e) {
      dataMap[k] = raw;
    }
  }
  return { keys: localKeys, bytes: totalBytes, dataMap, stale, site };
};
// 读取原版存储大小显示单位。
export const formatStorageBytes = (bytes) => {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  const kb = bytes / 1024;
  if (kb < 1024) return kb.toFixed(1) + ' KB';
  const mb = kb / 1024;
  return mb.toFixed(2) + ' MB';
};
// 设置按菜单页签分了组，数的是最里层的设置项。
const countSettings = (value) =>
  value && typeof value === 'object'
    ? Object.values(value).reduce((sum, item) => sum + countSettings(item), 0)
    : 1;
// 汇总各功能的数据和字节占用，不直接操作页面节点。
export function readStorageOverview() {
  // 先读插件数据：读取时会把合并前的旧键迁进来，之后再枚举，旧键就不会被算进已弃用的缓存。
  const runtime = readRuntimeData();
  // 数据分析同理：合并前按账号各存的旧键先并进新键。
  migrateDatasets();
  const solved = getUserSolvedStorageDetails(),
    local = getLocalStorageDetails();
  const countProblems = (value) =>
    Object.keys(value || {}).filter((key) => !key.startsWith('NAME:')).length;
  const clist = appStorage.getJSON(CLIST_STORAGE_KEY, {});
  const items = {
    settings: {
      bytes: getStorageItemBytes(SETTINGS_KEY),
      // 结构版本号不算设置项。
      count: countSettings(appSettings) - 1,
      keys: [SETTINGS_KEY],
      countKey: 'storageItemCount',
    },
    runtime: {
      bytes: getStorageItemBytes(RUNTIME_DATA_KEY),
      count: Object.keys(runtime).length,
      keys: [RUNTIME_DATA_KEY],
      countKey: 'storageItemCount',
    },
    cf: {
      bytes: getStorageItemBytes(CACHE_KEY) + getStorageItemBytes(PARALLEL_CONTESTS_KEY),
      count: countProblems(appStorage.getJSON(CACHE_KEY, {})),
      keys: [CACHE_KEY, PARALLEL_CONTESTS_KEY],
      countKey: 'storageProblemCount',
    },
    clist: {
      bytes: getStorageItemBytes(CLIST_STORAGE_KEY),
      count: countProblems(clist?.problems || (Array.isArray(clist) ? {} : clist)),
      keys: [CLIST_STORAGE_KEY],
      countKey: 'storageProblemCount',
    },
    avatar: {
      bytes: getStorageItemBytes(AVATAR_CACHE_KEY),
      count: Object.keys(appStorage.getJSON(AVATAR_CACHE_KEY, {}) || {}).length,
      keys: [AVATAR_CACHE_KEY],
      countKey: 'storageAvatarCount',
    },
    solved: {
      bytes: solved.bytes,
      count: solved.count,
      keys: solved.keys,
      dataMap: solved.dataMap,
      countKey: 'storageSolvedCount',
    },
    local: {
      bytes: local.bytes,
      count: local.keys.length,
      keys: local.keys,
      dataMap: local.dataMap,
      countKey: 'storageItemCount',
    },
  };
  // 数据分析的各个账号合存在一个键里，查看时现读，不提前解析；没用过时不列出。
  const analyticsKeys = appStorage.getItem(ANALYTICS_KEY) != null ? [ANALYTICS_KEY] : [];
  // 合并管理入口，不改旧存储结构；数量分项保留，不能把头像人数与题数相加。
  items.user = {
    bytes:
      items.avatar.bytes +
      items.solved.bytes +
      analyticsKeys.reduce((sum, key) => sum + getStorageItemBytes(key), 0),
    count: 3,
    countKey: 'storageCategoryCount',
    keys: [...items.avatar.keys, ...items.solved.keys, ...analyticsKeys],
    dataMap: {
      ...items.solved.dataMap,
      [AVATAR_CACHE_KEY]: appStorage.getJSON(AVATAR_CACHE_KEY, {}),
    },
  };
  delete items.avatar;
  delete items.solved;
  // 用户分组：项数是存了分组的登录账号数。没用过时不列出键。
  const groupsKeys = appStorage.getItem(USER_GROUPS_KEY) != null ? [USER_GROUPS_KEY] : [];
  items.groups = {
    bytes: groupsKeys.reduce((sum, key) => sum + getStorageItemBytes(key), 0),
    count: Object.keys(readGroups(appStorage.getJSON(USER_GROUPS_KEY, null)).accounts).length,
    keys: groupsKeys,
    countKey: 'storageAccountCount',
  };
  // 自定义头像框：目录和全部代码两个键，项数是头像框的个数（目录里记着先后，数它就行，不用解析代码）。没做过时不列出键。
  const frameKeys = [CUSTOM_FRAMES_KEY, CUSTOM_FRAME_ART_KEY].filter(
    (key) => appStorage.getItem(key) != null,
  );
  const catalog = appStorage.getJSON(CUSTOM_FRAMES_KEY, null);
  items.frames = {
    bytes: frameKeys.reduce((sum, key) => sum + getStorageItemBytes(key), 0),
    count: Array.isArray(catalog?.order) ? catalog.order.length : 0,
    keys: frameKeys,
    countKey: 'storageFrameCount',
  };
  const predictionKeys = PREDICTION_STORAGE_KEYS.filter((key) => appStorage.getItem(key) != null);
  items.prediction = {
    bytes: predictionKeys.reduce((sum, key) => sum + getStorageItemBytes(key), 0),
    count: predictionContestCount(),
    keys: predictionKeys,
    countKey: 'storageContestCount',
  };
  return {
    items,
    total: Object.values(items).reduce((total, item) => total + item.bytes, 0),
  };
}
