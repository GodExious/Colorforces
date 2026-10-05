import { computed, markRaw, reactive, watch } from 'vue';
import { getCurrentUserHandle } from '../../../../../../features/page/account.js';
import {
  readRatingHistory,
  fetchRatingHistory,
  isFresh,
} from '../../../../../../features/user/analytics/data.js';

// 对比曲线里的账号名单。「评级曲线对比」和「参赛排名曲线对比」两张图共用同一份：
// 在哪一张图上增减账号，另一张跟着变，评级历史也只取一次。
// 默认只放这个主页的账号，可以再输入别的账号加进来，也可以移除（主页的账号除外）。
// 查看者自己的账号不默认放上，名单末尾有一个按钮，点一下就加进来（见 self）。
// 增减的账号只在当前页面有效：刷新或换一个主页后，又回到只有主页的账号。

// 最多同时对比几个账号，各用一种颜色。颜色要在浅色的色带上都看得清，彼此也分得开。
const COLORS = ['#2f6fd0', '#e0652e', '#1f9d6b', '#8a4fd3', '#d43f7c', '#1b98b3'];
export const COMPARE_MAX = COLORS.length;
// 账号名的写法：字母、数字、下划线、连字符和点，3 到 24 位。
const HANDLE = /^[A-Za-z0-9_.-]{3,24}$/;

// handle 是这个主页的账号；active 表示两张图里至少有一张开着，开着才去取评级历史；
// refreshedAt 是面板数据的刷新时刻，面板刷新后这里的评级历史也跟着重新取。三个都是取值的函数。
export function useCompareAccounts({ handle, active, refreshedAt }) {
  // 对比中的账号。status：loading 正在取、ready 有评级记录、empty 没参加过评级比赛、
  // missing 账号不存在、failed 没取到。history 是评级历史，较大，不建立深层响应式。
  const entries = reactive([]);
  const own = getCurrentUserHandle();
  const idOf = (name) => name.toLowerCase();
  function append(name, fixed = false) {
    entries.push({
      id: idOf(name),
      handle: name,
      fixed,
      color: COLORS.find((color) => !entries.some((entry) => entry.color === color)),
      status: 'loading',
      history: null,
    });
    return entries.at(-1);
  }
  function adopt(entry, history) {
    entry.history = markRaw(history);
    // 账号名换成原站的写法（大小写）。
    entry.handle = history.handle;
    entry.status = history.rows.length ? 'ready' : 'empty';
  }
  // 取一个账号的评级历史：有缓存先画缓存，缓存过期或要求刷新时再请求，新数据到了替换旧线。
  async function load(entry, force = false) {
    const cached = readRatingHistory(entry.handle);
    if (cached) adopt(entry, cached);
    if (cached && !force && isFresh(cached)) return;
    if (!entry.history) entry.status = 'loading';
    try {
      adopt(entry, await fetchRatingHistory(entry.handle));
    } catch (error) {
      // 已经有旧数据在画就留着，不因为这次没取到把线撤掉。
      if (entry.history) return;
      const missing = error?.code === 'api' && /not found/i.test(error.comment || '');
      entry.status = missing ? 'missing' : 'failed';
    }
  }

  // 第一次有图开着时才开始：放上主页的账号。
  let started = false;
  watch(
    active,
    (on) => {
      if (!on || started) return;
      started = true;
      load(append(handle(), true));
    },
    { immediate: true },
  );
  // 面板刷新后重新取；刚取过的（比如面板和这里是同时加载的）不重复取。
  watch(refreshedAt, (next, previous) => {
    if (!started || !previous || !next || next === previous) return;
    for (const entry of entries)
      if (!entry.history || entry.history.fetchedAt < next - 60000) load(entry, true);
  });

  // 添加账号。加不进去时返回一句提示的文案键（切换语言后跟着变），加进去了返回空字符串。
  function add(text) {
    const name = text.trim();
    if (!HANDLE.test(name)) return 'analyticsCompareInvalid';
    if (entries.some((entry) => entry.id === idOf(name))) return 'analyticsCompareDuplicate';
    if (entries.length >= COMPARE_MAX) return 'analyticsCompareFull';
    load(append(name));
    return '';
  }
  function remove(entry) {
    const index = entries.indexOf(entry);
    if (index < 0 || entry.fixed) return;
    entries.splice(index, 1);
  }
  // 画得出线的账号。
  const drawn = computed(() => entries.filter((entry) => entry.status === 'ready'));
  // 查看者自己的账号，还能加进来时才有值：没登录、已经在名单里（包括看的就是自己的主页）时是空的。
  const self = computed(() =>
    own && entries.length && !entries.some((entry) => entry.id === idOf(own)) ? own : '',
  );
  return reactive({ entries, drawn, self, add, remove, load });
}
