// 插件界面里（分组页、管理弹窗、右键菜单、设置）的头像除了段位，还要知道两样：
// 自己从头像框库里戴的（只算自己的头像），和这个人所在的分组设的头像框。
// 分组读一次所有头像共用，分组变了（这一页改的、别的标签页改的）时重新读；第一次有头像用到时才开始读。
import { shallowRef } from 'vue';
import { appSettings } from '../../../settings.js';
import { getCurrentUserHandle } from '../../page/account.js';
import { readAccount, subscribeGroups } from '../groups/data.js';
import { frameOf, userId } from '../groups/store.js';
import { KNOWN_FRAMES, wearableFrame } from './catalog.js';
import { chooseFrame } from './choose.js';

const account = shallowRef(null);
let watching = false;
// 用头像框的组件在 setup 里调一次：开始读自己的分组。
export function watchChosenFrames() {
  if (watching) return;
  watching = true;
  const load = () => (account.value = readAccount(getCurrentUserHandle() || ''));
  subscribeGroups(load);
  load();
}
// 这个人戴的：{ worn 自己戴的（不是自己时是空串；段位、特别款不能手动戴，记着的也不算）, group 分组的（关了分组、不在设了头像框的分组里时是空串） }。
export function chosenFrames(handle) {
  const me = getCurrentUserHandle();
  const self = Boolean(me && handle) && userId(handle) === userId(me);
  return {
    worn:
      self && wearableFrame(appSettings.user.avatar.wornFrame)
        ? appSettings.user.avatar.wornFrame
        : '',
    group:
      appSettings.groups.enabled && account.value && handle ? frameOf(account.value, handle) : '',
  };
}
// 插件界面里一个人戴哪个头像框（profile 是 profiles.js 读到的资料）：自己戴的、分组的、段位的，按 choose.js 的先后。
// 资料还没读到、查无此人、关掉了「显示头像框」时不戴。admin 为真时戴管理员的那个。
export function profileFrame(profile, admin = false) {
  if (!appSettings.user.avatar.frames || !profile || profile.missing) return '';
  return chooseFrame({
    ...chosenFrames(profile.handle),
    rank: profile.rank,
    maxRank: profile.maxRank,
    admin,
    mode: appSettings.user.avatar.rankFrame,
    known: KNOWN_FRAMES,
  });
}
