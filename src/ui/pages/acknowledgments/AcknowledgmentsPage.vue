<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { translate as t } from '../../../i18n/index.js';
import * as assets from '../../../assets/index.js';
import { petalColor, petalPosition, petalTone } from '../../../utils/petal-palette.js';
import InlineSvg from '../../components/icons/InlineSvg/InlineSvg.vue';
import ProjectType from './components/ProjectType/ProjectType.vue';
import ProjectLinks from './components/ProjectLinks/ProjectLinks.vue';
import PetalFlower from './components/PetalFlower/PetalFlower.vue';
const props = defineProps({ active: Boolean });
// 每个项目只登记内容，卡片结构由模板统一渲染；只有一个链接时直接跳转，多个时展开选择。
const projects = [
  {
    id: 'codeforces',
    icon: assets.codeforcesIcon,
    titleKey: 'ackCodeforcesTitle',
    badgeKey: 'ackCodeforcesBadge',
    descKey: 'ackCodeforcesDesc',
    types: ['website'],
    links: [{ id: 'website', href: 'https://codeforces.com/', labelKey: 'ackCodeforcesLinkText' }],
  },
  {
    id: 'helper',
    image: assets.cfHelperImage,
    titleKey: 'ackHelperTitle',
    badgeKey: 'ackHelperBadge',
    descKey: 'ackHelperDesc',
    types: ['extension'],
    links: [
      {
        id: 'extension',
        href: 'https://chromewebstore.google.com/detail/codeforces-helper/ahoeafmlmoohkkalcickdnkifpfnolpj',
        labelKey: 'ackHelperLinkText',
      },
    ],
  },
  {
    id: 'clist',
    image: assets.clistImage,
    titleKey: 'ackClistTitle',
    badgeKey: 'ackClistBadge',
    descKey: 'ackClistDesc',
    types: ['website'],
    links: [{ id: 'website', href: 'https://clist.by/', labelKey: 'ackClistLinkText' }],
  },
  {
    id: 'ojbetter',
    icon: assets.ojBetterIcon,
    titleKey: 'ackOjBetterTitle',
    badgeKey: 'ackOjBetterBadge',
    descKey: 'ackOjBetterDesc',
    types: ['userscript'],
    links: [
      {
        id: 'repository',
        href: 'https://github.com/beijixiaohu/OJBetter',
        labelKey: 'ackOjBetterLinkText',
      },
    ],
  },
  {
    id: 'carrot',
    image: assets.carrotImage,
    titleKey: 'ackCarrotTitle',
    badgeKey: 'ackCarrotBadge',
    descKey: 'ackCarrotDesc',
    types: ['extension'],
    links: [
      {
        id: 'repository',
        href: 'https://github.com/wuyuqian114514/carrot-plus',
        labelKey: 'ackCarrotLinkText',
      },
    ],
  },
  {
    // 这个项目没有自己的图标，用它所在的 GitHub 的标志。
    id: 'standings',
    icon: assets.githubBrandIcon,
    titleKey: 'ackStandingsTitle',
    badgeKey: 'ackStandingsBadge',
    descKey: 'ackStandingsDesc',
    types: ['userscript'],
    links: [
      {
        id: 'repository',
        href: 'https://github.com/iilj/atcoder-standings-difficulty-analyzer',
        labelKey: 'ackStandingsLinkText',
      },
    ],
  },
  {
    id: 'analytics',
    image: assets.cfAnalyticsImage,
    titleKey: 'ackAnalyticsTitle',
    badgeKey: 'ackAnalyticsBadge',
    descKey: 'ackAnalyticsDesc',
    types: ['extension', 'userscript'],
    links: [
      {
        id: 'extension',
        href: 'https://chromewebstore.google.com/detail/codeforces-analytics-pro/gfoledimnmjchddncmedpcieiccnagcj',
        labelKey: 'ackAnalyticsExtensionLink',
        icon: assets.projectExtensionIcon,
      },
      {
        id: 'userscript',
        href: 'https://greasyfork.org/zh-CN/scripts/465176-cf%E8%A7%A3%E9%A2%98%E6%95%B0%E6%8D%AE%E5%8F%AF%E8%A7%86%E5%8C%96-pro-max',
        labelKey: 'ackAnalyticsUserscriptLink',
        icon: assets.projectUserscriptIcon,
      },
    ],
  },
  {
    id: 'heatmap',
    image: assets.cfHeatmapImage,
    titleKey: 'ackHeatmapTitle',
    badgeKey: 'ackHeatmapBadge',
    descKey: 'ackHeatmapDesc',
    types: ['extension'],
    links: [
      {
        id: 'extension',
        href: 'https://chromewebstore.google.com/detail/codeforces-rating-based-h/heajdhmohlobjebkgkpdomkaihaghkgb',
        labelKey: 'ackHeatmapLinkText',
      },
    ],
  },
];
// 每个项目是一片花瓣：颜色沿标志的花瓣色环均分，增删项目后自动重新分配。
// 花用花瓣原色；卡片的点缀色取同一色相，再统一明度与彩度，保持柔和。
const petals = projects.map((project, index) => petalColor(petalPosition(index, projects.length)));
const accents = petals.map((color) => petalTone(color, 0.62, 0.1));

const panel = ref(null);
const header = ref(null);
const cards = ref([]);
const finale = ref(null);
// 正在读的那张卡片；内容不需要滚动时为 null，此时整朵花保持原色。
const current = ref(null);
const turn = ref(0);
// 标题条是否已经吸顶；没滚动时不垫底色，与其他页面的标题一样。
const stuck = ref(false);
const gathered = ref(false);
// 页尾相邻两片花瓣落位的间隔（毫秒），标题旁的花绽放时用同样的节奏。
const FINALE_STAGGER = 120;
let scroller;
let resizeObserver;
let finaleObserver;

// 标题旁的花：当前卡片的花瓣最亮，相邻两片次之，其余压暗。
// 页尾的花拼好时它也全部点亮，与页尾一起绽放；往回滚、页尾散开后再回到只亮当前一片。
const lights = computed(() => {
  if (current.value === null || gathered.value) return null;
  const count = projects.length;
  return projects.map((project, index) => {
    const away = Math.abs(index - current.value);
    const distance = Math.min(away, count - away);
    return distance === 0 ? 1 : distance === 1 ? 0.5 : 0.16;
  });
});
// 把当前花瓣转到正上方，绽放时转回与页尾那朵相同的朝向；
// 走最近的方向，避免从最后一片回到第一片时倒转一整圈。
watch([current, gathered], ([index, bloom]) => {
  const target = bloom ? 0 : -(index ?? 0) * (360 / projects.length);
  turn.value = target + Math.round((turn.value - target) / 360) * 360;
});

// 向上找到本页所在的滚动容器。
function findScroller(element) {
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (['auto', 'scroll'].includes(getComputedStyle(node).overflowY)) return node;
  }
  return null;
}
// 按滚动进度选出当前卡片：一条基准线随进度从可视区顶部移到底部，离它最近的卡片即当前卡片。
// 这样第一张和最后一张都能轮到，不会因为滚不到某个固定位置而被跳过。
function follow() {
  if (!props.active || !scroller || !header.value) return;
  stuck.value = scroller.scrollTop > 0;
  const range = scroller.scrollHeight - scroller.clientHeight;
  if (range <= 0) {
    current.value = null;
    return;
  }
  const box = scroller.getBoundingClientRect();
  const head = header.value.offsetHeight;
  const line = box.top + head + (box.height - head) * (scroller.scrollTop / range);
  let nearest = Infinity;
  let found = 0;
  cards.value.forEach((card, index) => {
    const rect = card.getBoundingClientRect();
    const gap = line < rect.top ? rect.top - line : line > rect.bottom ? line - rect.bottom : 0;
    if (gap < nearest) {
      nearest = gap;
      found = index;
    }
  });
  current.value = found;
}
onMounted(() => {
  scroller = findScroller(panel.value);
  if (!scroller) return;
  scroller.addEventListener('scroll', follow, { passive: true });
  // 菜单尺寸或语言变化会改变卡片高度，需要重新判断当前卡片。
  resizeObserver = new ResizeObserver(follow);
  resizeObserver.observe(panel.value);
  resizeObserver.observe(scroller);
  // 页尾的花滚入视野时逐片落位，离开后散开，下次再看时重新拼一遍。
  finaleObserver = new IntersectionObserver(
    ([entry]) => {
      gathered.value = entry.isIntersecting;
    },
    { root: scroller, threshold: 0.55 },
  );
  finaleObserver.observe(finale.value);
});
watch(
  () => props.active,
  (active) => {
    if (active) nextTick(follow);
  },
);
onBeforeUnmount(() => {
  scroller?.removeEventListener('scroll', follow);
  resizeObserver?.disconnect();
  finaleObserver?.disconnect();
});
</script>
<template>
  <div class="cf-tab-panel" ref="panel">
    <div class="cf-ack-header" :class="{ 'is-stuck': stuck }" ref="header">
      <div class="cf-ack-header-text">
        <h3 class="cf-ack-title">
          <span class="cf-section-title-icon"
            ><inline-svg v-bind:source="assets.menuAcknowledgmentsIcon"></inline-svg></span
          ><span class="cf-ack-title-text">{{ t('ackSectionTitle') }}</span>
        </h3>
        <p class="cf-ack-subtitle" v-text="t().ackSectionSubtitle"></p>
      </div>
      <!-- 绽放时与页尾同样的间隔逐片点亮；收起时一起变回去。 -->
      <PetalFlower
        :colors="petals"
        :size="46"
        :lights="lights"
        :turn="turn"
        :stagger="gathered ? FINALE_STAGGER : 0"
      />
    </div>
    <div
      v-for="(project, index) in projects"
      :key="project.id"
      ref="cards"
      class="cf-ack-card"
      :class="[`${project.id}-card`, { 'is-current': index === current && !gathered }]"
      :style="{ '--cf-ack-accent': accents[index] }"
    >
      <div class="cf-ack-card-top">
        <div class="cf-ack-project-info">
          <div class="cf-ack-icon-box">
            <InlineSvg v-if="project.icon" :source="project.icon" />
            <img v-else class="cf-ack-icon-img" :src="project.image" :alt="t(project.titleKey)" />
          </div>
          <span class="cf-ack-project-name">{{ t(project.titleKey) }}</span>
        </div>
        <span class="cf-ack-badge">{{ t(project.badgeKey) }}</span>
      </div>
      <div class="cf-ack-desc" v-html="t(project.descKey)"></div>
      <div class="cf-ack-footer">
        <div class="cf-ack-project-types">
          <ProjectType v-for="type in project.types" :key="type" :type="type" />
        </div>
        <ProjectLinks
          v-if="project.links.length > 1"
          :links="project.links"
          :active="props.active"
        />
        <a
          v-else
          class="cf-ack-link-btn"
          :href="project.links[0].href"
          target="_blank"
          rel="noopener noreferrer"
          ><span>{{ t(project.links[0].labelKey) }}</span
          ><InlineSvg :source="assets.brandExternalLinkIcon"
        /></a>
      </div>
    </div>
    <div class="cf-ack-finale" :class="{ 'is-gathered': gathered }" ref="finale">
      <PetalFlower :colors="petals" :size="88" :gathered="gathered" :stagger="FINALE_STAGGER" />
      <strong class="cf-ack-finale-title">{{ t('ackFinaleTitle', projects.length) }}</strong>
      <span class="cf-ack-finale-text">{{ t('ackFinaleText') }}</span>
    </div>
  </div>
</template>

<style>
/* 标题条吸顶，卡片从它下面滚过。上内边距与负外边距相抵，正好盖住内容区顶部留白；
   底部一小段用遮罩淡出，不画分隔线。条本身不向左右伸出：外层会裁掉超出内容栏的部分。 */
.cf-ack-header {
  /* 内容区的上内边距。吸顶位置从内边距里侧算起，所以 top 要退回这一段，标题条才贴到顶边；
     否则它会比原位低这么多，既压住下面的卡片，滚动时上方还会露出一截内容。 */
  --cf-ack-inset: 14px;
  position: sticky;
  top: calc(-1 * var(--cf-ack-inset));
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 12px;
  margin: calc(-1 * var(--cf-ack-inset)) 0 -8px;
  padding: var(--cf-ack-inset) 0 10px;
  background-color: transparent;
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  -webkit-mask-image: linear-gradient(#000 calc(100% - 10px), transparent);
  mask-image: linear-gradient(#000 calc(100% - 10px), transparent);
  transition: background-color 0.2s ease;
}

.cf-ack-header.is-stuck {
  background-color: color-mix(in srgb, var(--cf-menu-accent) 6%, rgb(255 255 255 / 86%));
}

@media (prefers-reduced-motion: reduce) {
  .cf-ack-header {
    transition: none;
  }
}

.cf-ack-header-text {
  flex: 1;
  min-width: 0;
}

.cf-ack-title {
  font-size: var(--cf-font-size-xl);
  font-weight: var(--cf-font-weight-bold);
  color: var(--cf-gray-900);
  margin: 0 0 4px 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.cf-ack-subtitle {
  font-size: var(--cf-font-size-base);
  color: var(--cf-gray-500);
  margin: 0;
  line-height: 1.5;
}

/* 点缀色由脚本逐卡写入，卡片、徽标与链接共用同一组配色规则。 */
.cf-ack-card {
  --cf-ack-accent: var(--cf-menu-accent);
  --cf-ack-ink: color-mix(in srgb, var(--cf-ack-accent) 65%, #243447);
  background: linear-gradient(
    120deg,
    color-mix(in srgb, var(--cf-ack-accent) 14%, var(--cf-content-surface)),
    color-mix(in srgb, var(--cf-ack-accent) 5%, var(--cf-content-surface))
  );
  border: 1px solid color-mix(in srgb, var(--cf-ack-accent) 28%, var(--cf-surface-border));
  border-radius: var(--cf-radius-xl);
  padding: 13px 15px;
  display: flex;
  flex-direction: column;
  gap: 9px;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  position: relative;
  box-shadow: inset 0 1px 0 #ffffff60;
  box-sizing: border-box;
}

/* 正在读的卡片与悬停同样突出，和标题旁点亮的花瓣相呼应。 */
.cf-ack-card:is(:hover, .is-current) {
  border-color: color-mix(in srgb, var(--cf-ack-accent) 62%, var(--cf-surface-border));
  box-shadow:
    inset 0 1px 0 #ffffff60,
    0 4px 12px color-mix(in srgb, var(--cf-ack-accent) 14%, transparent);
}

/* 原图保持不变，仅让白底融入本卡片的图标底板，避免出现白色方块。 */
.cf-ack-card:is(.analytics-card, .heatmap-card) .cf-ack-icon-box {
  isolation: isolate;
}

.cf-ack-card:is(.analytics-card, .heatmap-card) .cf-ack-icon-img {
  mix-blend-mode: multiply;
}

.cf-ack-project-types {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cf-ack-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.cf-ack-project-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.cf-ack-icon-box {
  width: 32px;
  height: 32px;
  border-radius: var(--cf-radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  background: color-mix(in srgb, var(--cf-ack-accent) 16%, var(--cf-content-surface));
  border: 1px solid color-mix(in srgb, var(--cf-ack-accent) 22%, transparent);
  color: var(--cf-ack-ink);
}

/* 直接用矢量标志的两项（Codeforces、GitHub）：标志画成和别的图标一样大。 */
.cf-ack-card:is(.codeforces-card, .standings-card) .cf-ack-icon-box svg {
  width: 20px;
  height: 20px;
}

.cf-ack-icon-img {
  width: 22px;
  height: 22px;
  object-fit: contain;
  border-radius: 3px;
  display: block;
}

.cf-ack-card.carrot-card .cf-ack-icon-img {
  image-rendering: pixelated;
}

.cf-ack-project-name {
  font-size: 13.5px;
  font-weight: var(--cf-font-weight-bold);
  color: var(--cf-gray-800);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cf-ack-badge {
  font-size: var(--cf-font-size-xs);
  font-weight: var(--cf-font-weight-semibold);
  padding: 3px 8px;
  border-radius: 9999px;
  white-space: nowrap;
  flex-shrink: 0;
  background: color-mix(in srgb, var(--cf-ack-accent) 14%, var(--cf-content-surface));
  color: var(--cf-ack-ink);
  border: 1px solid color-mix(in srgb, var(--cf-ack-accent) 27%, transparent);
}

.cf-ack-desc {
  font-size: var(--cf-font-size-md);
  color: var(--cf-gray-600);
  line-height: 1.6;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.cf-ack-desc p {
  margin: 0;
  line-height: 1.6;
}

.cf-ack-footer {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 2px;
}

/* 页尾：各片花瓣落位拼成整朵花，文字等花拼好后再浮现。 */
.cf-ack-finale {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 18px 0 8px;
  text-align: center;
}

.cf-ack-finale-title {
  font-size: 13.5px;
  font-weight: var(--cf-font-weight-bold);
  color: var(--cf-gray-800);
}

.cf-ack-finale-text {
  font-size: var(--cf-font-size-base);
  color: var(--cf-gray-500);
}

.cf-ack-finale-title,
.cf-ack-finale-text {
  opacity: 0;
  transition: opacity 0.6s ease;
}

.cf-ack-finale.is-gathered :is(.cf-ack-finale-title, .cf-ack-finale-text) {
  opacity: 1;
  transition-delay: 0.75s;
}

@media (prefers-reduced-motion: reduce) {
  .cf-ack-finale-title,
  .cf-ack-finale-text {
    transition: none;
  }
}

/* 显式覆盖原站链接颜色，避免访问状态改变卡片配色。 */
.cf-settings-modal .cf-ack-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: var(--cf-radius-sm);
  font-size: var(--cf-font-size-base);
  font-weight: var(--cf-font-weight-semibold);
  text-decoration: none !important;
  transition:
    color 0.2s ease,
    background-color 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  cursor: pointer;
  background: color-mix(in srgb, var(--cf-ack-accent) 28%, var(--cf-content-surface));
  color: color-mix(in srgb, var(--cf-ack-accent) 40%, #243447);
  border: 1px solid color-mix(in srgb, var(--cf-ack-accent) 48%, var(--cf-content-surface));
  box-shadow:
    inset 0 1px 0 #ffffff65,
    0 1px 2px color-mix(in srgb, var(--cf-ack-accent) 12%, transparent);
}

.cf-settings-modal .cf-ack-link-btn:is(:hover, :focus-visible) {
  background: color-mix(in srgb, var(--cf-ack-accent) 36%, var(--cf-content-surface));
  color: color-mix(in srgb, var(--cf-ack-accent) 40%, #243447);
  border-color: color-mix(in srgb, var(--cf-ack-accent) 65%, var(--cf-content-surface));
  box-shadow:
    inset 0 1px 0 #ffffff65,
    0 2px 5px color-mix(in srgb, var(--cf-ack-accent) 17%, transparent);
}
</style>
