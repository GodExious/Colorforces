<script>
import { ref } from 'vue';
const visible = ref(false);
const origin = ref(null);
// 打开「CList API Key 获取指引」，弹窗从触发它的图标位置展开。
export function openClistKeyGuide(anchor) {
  origin.value = anchor?.getBoundingClientRect().toJSON();
  visible.value = true;
}
</script>
<script setup>
import { computed } from 'vue';
import * as cfAssets from '../../../../../assets/index.js';
import { translate as t } from '../../../../../i18n/index.js';
import GuideDialog from '../../../../components/dialogs/GuideDialog/GuideDialog.vue';
// 前两步各是一句话加一个网址。
const links = [
  ['guideStep1Title', 'guideStep1Desc', 'https://clist.by/'],
  ['guideStep2Title', 'guideStep2Desc', 'https://clist.by/api/v4/doc/'],
];
// 示意里照搬原网页的英文，不随语言变；密钥是一串示例。
const SENTENCE = 'Accessing the API requires an API key, available to authenticated users ';
const SAMPLE_KEY = '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b';
const options = computed(() => ({
  className: 'cf-clist-guide-modal',
  width: '880px',
  page: 'ratings',
  iconSvg: cfAssets.clistKeyGuideIcon,
  title: t('guideModalTitle'),
  confirmText: t('guideConfirmBtn'),
}));
</script>
<template>
  <GuideDialog :visible="visible" :origin="origin" :options="options" @close="visible = false">
    <div v-for="[title, desc, url] in links" :key="url" class="cf-clist-guide-step">
      <div class="cf-clist-guide-step-title">{{ t(title) }}</div>
      <div class="cf-clist-guide-step-desc">
        {{ t(desc) }}
        <a :href="url" target="_blank" class="cf-clist-guide-link">{{ url }}</a>
      </div>
    </div>
    <!-- 第三步：点击 here、等它换成密钥、复制浮层里的那一行。原来是两步各配一张静止的示意，
         现在合成一步，同一个示意框循环演示整个过程（见样式里的时间线）。 -->
    <div class="cf-clist-guide-step">
      <div class="cf-clist-guide-step-title">{{ t('guideStep3Title') }}</div>
      <div class="cf-clist-guide-step-desc">{{ t('guideStep3Desc') }}</div>
      <div class="cf-clist-doc">
        <div class="cf-clist-doc-info" aria-hidden="true">
          <div class="cf-clist-doc-title">Authentication</div>
          <div class="cf-clist-doc-text">
            <div class="cf-clist-doc-line">
              <span>{{ SENTENCE }}</span>
              <span class="cf-clist-doc-spot">
                <span class="cf-clist-guide-here">here</span>
                <svg class="cf-clist-doc-spin" viewBox="0 0 16 16">
                  <g
                    fill="none"
                    stroke="#2f8fd8"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M13.3 6.3A5.6 5.6 0 0 0 3.2 5.2" />
                    <path d="M2.7 9.7a5.6 5.6 0 0 0 10.1 1.1" />
                    <path d="M2.9 2.2v3.2h3.2M13.1 13.8v-3.2H9.9" />
                  </g>
                </svg>
                <span class="cf-clist-doc-ring"></span>
                <svg class="cf-clist-doc-cursor" viewBox="0 0 20 22">
                  <path
                    d="M7.2 1.6c1 0 1.7.8 1.7 1.8v5.2l5.8 1.1c1.6.3 2.6 1.8 2.4 3.4l-.6 4.6c-.2 1.6-1.6 2.8-3.2 2.8H9.3c-1 0-2-.5-2.6-1.3l-3.9-5.4c-.6-.8-.4-1.9.4-2.5.7-.5 1.7-.4 2.3.2l.1.1V3.4c0-1 .7-1.8 1.6-1.8Z"
                    fill="#fff"
                    stroke="#1f2937"
                    stroke-width="1.3"
                    stroke-linejoin="round"
                  />
                </svg>
              </span>
              <span class="cf-clist-doc-key">{{ SAMPLE_KEY }}</span>
              <span class="cf-clist-doc-trash"
                ><svg viewBox="0 0 16 16">
                  <path
                    d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5M6.8 7v4M9.2 7v4"
                    fill="none"
                    stroke="#fff"
                    stroke-width="1.3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
              ></span>
              <span>.</span>
            </div>
            <div>Non-key access is also available through website sessions.</div>
            <div>
              <span class="cf-clist-doc-blue">OAuth</span> allows for the use of user-specific
              filters and manages API request limits among multiple users.
            </div>
          </div>
        </div>
        <div class="cf-clist-doc-pop">
          <!-- 演到哪一步的两个小标签，放在浮层左边留出来的空位里。 -->
          <div class="cf-clist-doc-phases">
            <span class="cf-clist-doc-phase is-click"><b>1</b>{{ t('guidePhaseClick') }}</span>
            <span class="cf-clist-doc-phase is-copy"><b>2</b>{{ t('guidePhaseCopy') }}</span>
          </div>
          <div class="cf-clist-doc-float" aria-hidden="true">
            <div class="cf-clist-doc-popover">
              <div class="cf-clist-doc-popover-title">How to use?</div>
              <div class="cf-clist-doc-popover-body">
                <div class="cf-clist-doc-title">Request header</div>
                <div class="cf-clist-doc-text cf-clist-doc-field">
                  Authorization: ApiKey YourUsername:{{ SAMPLE_KEY }}
                </div>
              </div>
            </div>
            <div class="cf-clist-doc-aim">
              <span>{{ SENTENCE }}</span
              ><span>{{ SAMPLE_KEY }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="cf-clist-guide-warn">
        <strong>{{ t('guideNoteLabel') }}</strong> <span v-html="t('guideStep3Note')"></span>
      </div>
      <div class="cf-clist-guide-notice">
        <strong>{{ t('guideNoticeLabel') }}</strong> {{ t('guideStep3Notice') }}
      </div>
    </div>
  </GuideDialog>
</template>

<style>
/* 每一步：标题一行，说明一行，下面是这一步的示意和提示。 */
.cf-clist-guide-modal .cf-clist-guide-step {
  position: relative;
  margin-bottom: 14px;
}
.cf-clist-guide-modal .cf-clist-guide-step:last-child {
  margin-bottom: 4px;
}
.cf-clist-guide-modal .cf-clist-guide-step-title {
  margin-bottom: 4px;
  color: var(--cf-control-ink);
  font-weight: var(--cf-font-weight-semibold);
}
.cf-clist-guide-modal .cf-clist-guide-step-desc {
  color: var(--cf-gray-500);
}
.cf-clist-guide-modal .cf-clist-guide-warn {
  margin-top: 10px;
  padding: 8px 12px;
  border: 1px solid #f0dcbc;
  border-radius: var(--cf-radius-lg);
  background: #fff5e4c7;
  color: #946a2f;
  font-size: var(--cf-font-size-base);
  line-height: 1.5;
}
.cf-clist-guide-modal .cf-clist-guide-notice {
  margin-top: 8px;
  color: var(--cf-gray-600);
  font-size: var(--cf-font-size-base);
  line-height: 1.5;
}
/* 两个网址：蓝紫色的字，下面一直有一道浅色的细线，移上去字变深、线变实。
   线用下边框画，不用文字的下划线：下划线遇到 p、y、/ 这些往下伸的笔画会断开，一点五像素的粗细也发虚，
   看着有毛刺；边框是整一个像素、连着的。选择器写到 :any-link，压过原站的 a:link。 */
.cf-clist-guide-modal .cf-clist-guide-link:any-link {
  padding-bottom: 1px;
  border-bottom: 1px solid #5565b066;
  color: #5565b0;
  font-weight: var(--cf-font-weight-semibold);
  text-decoration: none;
  transition:
    color var(--cf-duration-fast) ease,
    border-color var(--cf-duration-fast) ease;
}
.cf-clist-guide-modal .cf-clist-guide-link:hover {
  border-bottom-color: currentColor;
  color: #3f4f9c;
  text-decoration: none;
}
/*
 * 第三步的示意照着 clist.by/api/v4/doc/ 页面上的样子画，用户到了原网页能一眼认出要找的那一块：
 * 「Authentication」是灰色加粗的小标题，下面浅蓝底、蓝灰边框、3px 圆角的说明框，三行字。
 * 点击第一行末尾蓝色的 here 之后，原网页先在那里转一小会儿加载的圈，再换成密钥、后面跟一个红色的删除按钮，
 * 密钥的正下方弹出白底的浮层，标题「How to use?」，里面同样的灰色小标题「Request header」和浅蓝底的一行内容。
 * 颜色和尺寸取自该站的样式（tastypie_swagger.css 和它用的 Bootstrap 浮层），不跟弹窗的主题走。
 * 示意里的每一行都完整地写在一行里：弹窗的宽度就是按最长的那一行（句子加四十位的密钥）定的。
 * 字体在原网页的 Droid Sans 后面接 Arial：没装前者时用后者，字宽是确定的，宽度按它算。
 */
.cf-clist-guide-modal .cf-clist-doc {
  --cf-clist-loop: 10s;
  margin-top: 10px;
}
.cf-clist-guide-modal .cf-clist-doc-info,
.cf-clist-guide-modal .cf-clist-doc-float {
  font:
    14px/1.43 'Droid Sans',
    Arial,
    Helvetica,
    sans-serif;
}
.cf-clist-guide-modal .cf-clist-doc-title {
  padding: 2px 0 3px;
  color: #999;
  font-weight: var(--cf-font-weight-bold);
}
.cf-clist-guide-modal .cf-clist-doc-text {
  box-sizing: border-box;
  padding: 4px 10px;
  border: 1px solid #c3d9ec;
  border-radius: var(--cf-radius-xs);
  background-color: #e7f0f7;
  color: #000;
  white-space: nowrap;
}
/* 第一行：句子、here（点击后是加载的圈，再是密钥）、删除按钮、句号排成一排。 */
.cf-clist-guide-modal .cf-clist-doc-line {
  display: flex;
  align-items: center;
  height: 20px;
}
.cf-clist-guide-modal .cf-clist-doc-line > * {
  flex: none;
}
.cf-clist-guide-modal .cf-clist-doc-blue {
  color: #0f6ab4;
}
/* here 所在的位置：鼠标、点击的圈、加载的圈都挂在这里，不用脚本量位置。 */
.cf-clist-guide-modal .cf-clist-doc-spot {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.cf-clist-guide-modal .cf-clist-guide-here,
.cf-clist-guide-modal .cf-clist-doc-key {
  display: inline-block;
  overflow: hidden;
  color: #0f6ab4;
}
/* here 和原网页一样不带下划线，鼠标移上去是手形；只是示意，点了没有反应。 */
.cf-clist-guide-modal .cf-clist-guide-here {
  max-width: 40px;
  cursor: pointer;
}
.cf-clist-guide-modal .cf-clist-doc-key {
  max-width: 0;
  opacity: 0;
}
/* 密钥后面的红色删除按钮。 */
.cf-clist-guide-modal .cf-clist-doc-trash {
  display: inline-grid;
  place-items: center;
  width: 0;
  height: 20px;
  margin-left: 0;
  overflow: hidden;
  border-radius: var(--cf-radius-xs);
  background: #d9534f;
  opacity: 0;
}
.cf-clist-guide-modal .cf-clist-doc-trash svg {
  width: 13px;
  height: 13px;
}
.cf-clist-guide-modal .cf-clist-doc-cursor {
  position: absolute;
  top: 8px;
  left: 10px;
  z-index: 3;
  width: 20px;
  height: 22px;
  opacity: 0;
  filter: drop-shadow(0 1px 1.5px #0000004d);
  pointer-events: none;
}
.cf-clist-guide-modal .cf-clist-doc-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 26px;
  height: 26px;
  margin: -13px 0 0 -13px;
  border: 2px solid #0f6ab4;
  border-radius: 50%;
  opacity: 0;
  pointer-events: none;
}
/* 加载的圈：两个箭头围成的蓝圈，一直在转，只在点击之后的那一小段显出来。 */
.cf-clist-guide-modal .cf-clist-doc-spin {
  position: absolute;
  top: 50%;
  left: 0;
  width: 17px;
  height: 17px;
  margin-top: -8.5px;
  opacity: 0;
}
.cf-clist-guide-modal .cf-clist-doc-spin g {
  transform-origin: 8px 8px;
  animation: cf-clist-turn 0.8s linear infinite;
}
/*
 * 浮层这一块排在说明框后面、在文档流里，再往上提到第一行的下面：
 * 它盖住说明框的后两行（原网页上也是盖住的），多出来的高度由它自己占着，
 * 所以下面的注意事项和提醒永远排在浮层下面，不会被挡，弹窗的高度也不随动画变。
 */
.cf-clist-guide-modal .cf-clist-doc-pop {
  position: relative;
  z-index: 2;
  margin-top: -37px;
}
.cf-clist-guide-modal .cf-clist-doc-float {
  opacity: 0;
}
.cf-clist-guide-modal .cf-clist-doc-popover {
  width: fit-content;
  max-width: 100%;
  margin-left: auto;
  border: 1px solid #cfcfcf;
  border-radius: var(--cf-radius-sm);
  background: var(--cf-white-surface);
  box-shadow: 0 5px 10px #00000033;
  color: #333;
}
.cf-clist-guide-modal .cf-clist-doc-popover-title {
  padding: 8px 14px;
  border-bottom: 1px solid #ebebeb;
  font-weight: var(--cf-font-weight-bold);
}
.cf-clist-guide-modal .cf-clist-doc-popover-body {
  padding: 9px 14px 12px;
}
/*
 * 浮层上边的小尖角要对准第一行里密钥的正中。不用脚本量位置：这里放一行看不见的字，
 * 写法、字体和左边的留空都和第一行一样（句子在前，密钥在后），小尖角挂在这串密钥的正中，
 * 自然就落在上面那串密钥的正下方。
 */
.cf-clist-guide-modal .cf-clist-doc-aim {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  height: 0;
  padding-left: 11px;
  white-space: nowrap;
  visibility: hidden;
  pointer-events: none;
}
.cf-clist-guide-modal .cf-clist-doc-aim > :last-child {
  position: relative;
}
.cf-clist-guide-modal .cf-clist-doc-aim > :last-child::after {
  content: '';
  position: absolute;
  top: -5px;
  left: 50%;
  width: 10px;
  height: 10px;
  margin-left: -5px;
  border-top: 1px solid #cfcfcf;
  border-left: 1px solid #cfcfcf;
  background: var(--cf-white-surface);
  transform: rotate(45deg);
  visibility: visible;
}
/* 浮层里要复制的那一行：浮层出来之后外面闪一圈提示。 */
.cf-clist-guide-modal .cf-clist-doc-field {
  position: relative;
}
.cf-clist-guide-modal .cf-clist-doc-field::after {
  content: '';
  position: absolute;
  inset: -3px;
  border: 2px solid #5b8fd6;
  border-radius: var(--cf-radius-sm);
  opacity: 0;
  pointer-events: none;
}
/*
 * 演到哪一步的两个小标签。浮层靠右放，它左边、说明框下面的那块位置本来就空着（点击之前整块都是空的），
 * 小标签就放在这里（从浮层这一块的顶上往下 49 像素，也就是说明框下边缘再往下一点），不另占一行。
 */
.cf-clist-guide-modal .cf-clist-doc-phases {
  position: absolute;
  top: 49px;
  left: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  font-size: var(--cf-font-size-base);
  line-height: 1.6;
}
.cf-clist-guide-modal .cf-clist-doc-phase {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px 2px 4px;
  border: 1px solid #d8deee;
  border-radius: 999px;
  background: #ffffff8c;
  color: #7d899f;
}
.cf-clist-guide-modal .cf-clist-doc-phase b {
  display: inline-grid;
  place-items: center;
  flex: none;
  /* 圆圈跟着里面数字的字号走（默认 10px 的字配 16px 的圈），调了插件字体大小也不会挤。 */
  width: 1.6em;
  height: 1.6em;
  border-radius: 50%;
  background: #d8deee;
  color: var(--cf-white-ink);
  font-size: var(--cf-font-size-2xs);
  line-height: 1;
}

/*
 * 时间线，十秒一轮：
 * 0–1.4 秒 停在点击之前；1.4–3.0 秒 鼠标移到 here；3.0–3.3 秒 点一下；3.4–4.6 秒 转圈加载；
 * 4.6–5.5 秒 换成密钥；5.3–5.7 秒 删除按钮出现；5.7–6.3 秒 浮层弹出；6.8–7.8 秒 要复制的那一行闪一下；
 * 停到 9.3 秒；最后 0.7 秒收回。各部分用同一个时长、各自的关键帧，靠百分比对齐。
 */
.cf-clist-guide-modal .cf-clist-doc-cursor {
  animation: cf-clist-cursor var(--cf-clist-loop) infinite;
}
.cf-clist-guide-modal .cf-clist-doc-ring {
  animation: cf-clist-ring var(--cf-clist-loop) infinite;
}
.cf-clist-guide-modal .cf-clist-guide-here {
  animation: cf-clist-here var(--cf-clist-loop) infinite;
}
.cf-clist-guide-modal .cf-clist-doc-spin {
  animation: cf-clist-spin var(--cf-clist-loop) infinite;
}
.cf-clist-guide-modal .cf-clist-doc-key {
  animation: cf-clist-key var(--cf-clist-loop) infinite;
}
.cf-clist-guide-modal .cf-clist-doc-trash {
  animation: cf-clist-trash var(--cf-clist-loop) infinite;
}
.cf-clist-guide-modal .cf-clist-doc-float {
  animation: cf-clist-float var(--cf-clist-loop) infinite;
}
.cf-clist-guide-modal .cf-clist-doc-field::after {
  animation: cf-clist-field var(--cf-clist-loop) infinite;
}
.cf-clist-guide-modal .cf-clist-doc-phase.is-click {
  animation: cf-clist-phase-click var(--cf-clist-loop) infinite;
}
.cf-clist-guide-modal .cf-clist-doc-phase.is-click b {
  animation: cf-clist-dot-click var(--cf-clist-loop) infinite;
}
.cf-clist-guide-modal .cf-clist-doc-phase.is-copy {
  animation: cf-clist-phase-copy var(--cf-clist-loop) infinite;
}
.cf-clist-guide-modal .cf-clist-doc-phase.is-copy b {
  animation: cf-clist-dot-copy var(--cf-clist-loop) infinite;
}
@keyframes cf-clist-turn {
  to {
    transform: rotate(360deg);
  }
}
@keyframes cf-clist-cursor {
  0%,
  10% {
    opacity: 0;
    transform: translate(86px, 54px);
  }
  14% {
    opacity: 1;
    transform: translate(86px, 54px);
  }
  30% {
    opacity: 1;
    transform: translate(0, 0);
  }
  31.5% {
    opacity: 1;
    transform: translate(0, 0) scale(0.84);
  }
  33% {
    opacity: 1;
    transform: translate(0, 0);
  }
  40%,
  100% {
    opacity: 0;
    transform: translate(0, 0);
  }
}
@keyframes cf-clist-ring {
  0%,
  31% {
    opacity: 0;
    transform: scale(0.4);
  }
  32% {
    opacity: 0.7;
    transform: scale(0.4);
  }
  39%,
  100% {
    opacity: 0;
    transform: scale(1.5);
  }
}
/* here：点完淡掉，位置先留给加载的圈（圈比它窄一点），圈转完再收掉。 */
@keyframes cf-clist-here {
  0%,
  33% {
    max-width: 40px;
    opacity: 1;
  }
  35% {
    max-width: 40px;
    opacity: 0;
  }
  37%,
  45% {
    max-width: 18px;
    opacity: 0;
  }
  48%,
  93% {
    max-width: 0;
    opacity: 0;
  }
  100% {
    max-width: 40px;
    opacity: 1;
  }
}
@keyframes cf-clist-spin {
  0%,
  34% {
    opacity: 0;
  }
  36%,
  45% {
    opacity: 1;
  }
  47%,
  100% {
    opacity: 0;
  }
}
@keyframes cf-clist-key {
  0%,
  46% {
    max-width: 0;
    opacity: 0;
  }
  55%,
  93% {
    max-width: 330px;
    opacity: 1;
  }
  100% {
    max-width: 0;
    opacity: 0;
  }
}
@keyframes cf-clist-trash {
  0%,
  53% {
    width: 0;
    margin-left: 0;
    opacity: 0;
  }
  57%,
  93% {
    width: 20px;
    margin-left: 5px;
    opacity: 1;
  }
  100% {
    width: 0;
    margin-left: 0;
    opacity: 0;
  }
}
@keyframes cf-clist-float {
  0%,
  57% {
    opacity: 0;
    transform: translateY(6px);
  }
  63%,
  93% {
    opacity: 1;
    transform: none;
  }
  100% {
    opacity: 0;
    transform: translateY(6px);
  }
}
@keyframes cf-clist-field {
  0%,
  67% {
    opacity: 0;
  }
  70%,
  77% {
    opacity: 0.85;
  }
  82%,
  100% {
    opacity: 0;
  }
}
@keyframes cf-clist-phase-click {
  0%,
  47% {
    border-color: #9badd8;
    background: var(--cf-white-surface);
    color: #44537a;
  }
  53%,
  95% {
    border-color: #d8deee;
    background: #ffffff8c;
    color: #7d899f;
  }
}
@keyframes cf-clist-dot-click {
  0%,
  47% {
    background: #8f9fd8;
  }
  53%,
  95% {
    background: #d8deee;
  }
}
@keyframes cf-clist-phase-copy {
  0%,
  56% {
    border-color: #d8deee;
    background: #ffffff8c;
    color: #7d899f;
  }
  62%,
  93% {
    border-color: #9badd8;
    background: var(--cf-white-surface);
    color: #44537a;
  }
  100% {
    border-color: #d8deee;
    background: #ffffff8c;
    color: #7d899f;
  }
}
@keyframes cf-clist-dot-copy {
  0%,
  56% {
    background: #d8deee;
  }
  62%,
  93% {
    background: #8f9fd8;
  }
  100% {
    background: #d8deee;
  }
}
/* 减少动效时不演：直接是点击之后的样子，位置不变，两个小标签都亮着。 */
@media (prefers-reduced-motion: reduce) {
  .cf-clist-guide-modal .cf-clist-doc *,
  .cf-clist-guide-modal .cf-clist-doc *::after,
  .cf-clist-guide-modal .cf-clist-doc-phase,
  .cf-clist-guide-modal .cf-clist-doc-phase b {
    animation: none;
  }
  .cf-clist-guide-modal .cf-clist-guide-here {
    max-width: 0;
    opacity: 0;
  }
  .cf-clist-guide-modal .cf-clist-doc-key {
    max-width: 330px;
    opacity: 1;
  }
  .cf-clist-guide-modal .cf-clist-doc-trash {
    width: 20px;
    margin-left: 5px;
    opacity: 1;
  }
  .cf-clist-guide-modal .cf-clist-doc-float {
    opacity: 1;
  }
  .cf-clist-guide-modal .cf-clist-doc-phase {
    border-color: #9badd8;
    background: var(--cf-white-surface);
    color: #44537a;
  }
  .cf-clist-guide-modal .cf-clist-doc-phase b {
    background: #8f9fd8;
  }
}
/* 窗口窄到弹窗放不下最长的那一行时：退回折行，浮层不再往上盖，小尖角和小标签的位置对不准，按普通的排法放。 */
@media (max-width: 960px) {
  .cf-clist-guide-modal .cf-clist-doc-text {
    white-space: normal;
  }
  .cf-clist-guide-modal .cf-clist-doc-line {
    flex-wrap: wrap;
    height: auto;
  }
  .cf-clist-guide-modal .cf-clist-doc-key,
  .cf-clist-guide-modal .cf-clist-doc-field {
    overflow-wrap: anywhere;
  }
  .cf-clist-guide-modal .cf-clist-doc-pop {
    margin-top: 9px;
  }
  .cf-clist-guide-modal .cf-clist-doc-aim {
    display: none;
  }
  .cf-clist-guide-modal .cf-clist-doc-phases {
    position: static;
    flex-direction: row;
    margin-bottom: 8px;
  }
}
</style>
