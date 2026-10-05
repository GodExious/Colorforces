import { onBeforeUnmount, ref } from 'vue';
import { use } from 'echarts/core';
import { CustomChart, LineChart } from 'echarts/charts';
import { DataZoomSliderComponent } from 'echarts/components';
import { translate as t } from '../../../../../../i18n/index.js';
import { HISTORY, nearestIndex } from '../../../../../../features/user/analytics/rating-history.js';
import { rankForRating } from '../../../../../../features/contest/rating-prediction/algorithm/ranks.js';
import { mixHex } from '../../../../../../utils/color.js';
import { useChart } from './chart.js';
import { grays } from '../utils/grays.js';

// 折线、自己画的圆点和底部的范围选择在这里登记。
use([CustomChart, LineChart, DataZoomSliderComponent]);

// 几个账号的曲线画在同一条时间线上的图：「评级曲线对比」和「参赛排名曲线对比」共用。
// 两张图的时间轴、底部的范围选择、线的画法、悬停判断和提示都一样，只有纵轴画的东西不同，由各自给出。

const FONT = 'verdana, arial, sans-serif';
// 绘图区下面依次是时间轴的文字和范围选择的滑块。
const SLIDER = 18;
export const COMPARE_GRID = { left: 38, right: 10, top: 8, bottom: 22 + SLIDER + 10 };
const DAY = 86400;
const pad = (value) => String(value).padStart(2, '0');
const dateText = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
// 悬停范围：离鼠标最近的那一场比赛的点，距离在十来个像素以内才算。几条线交叠时取最近的一条。
const REACH = 12;
// 评级涨了、跌了、没变时变化量的颜色。
const CHANGE_COLORS = { up: '#1f9d6b', down: '#d0453a', same: '#8b97a8' };
// 一个评级数字，按它所在的档位着色。
const rated = (rating) => ({ text: String(rating), color: rankForRating(rating).color });
const lineId = (entry) => `line-${entry.id}`;
// 每场比赛的圆点：直径，以及相邻两个点至少隔这么远才画，再密就挤成一片了。
const DOT = 5;
const DOT_ROOM = 8;
// 一条线落在时间范围里的那几场，外加范围两边紧挨着的各一场：线是从范围外连进来的，纵轴要把它们也算上。
function inSpan(rows, span) {
  if (!span) return rows;
  let first = rows.findIndex((row) => row[HISTORY.time] * 1000 >= span[0]);
  if (first < 0) first = rows.length;
  let last = first;
  while (last < rows.length && rows[last][HISTORY.time] * 1000 <= span[1]) last++;
  return rows.slice(Math.max(0, first - 1), last + 1);
}

/*
 * accounts 是对比中的账号名单（见 compareAccounts），时间轴按其中画得出线的账号的全部场次来定范围；
 *   这样换一类比赛看的时候，时间轴不跟着变，变的只有线。
 * lines() 返回要画的线：[{ entry, rows, names }]，rows 是这条线上的各场（评级历史里的行），
 *   names 是和 rows 一一对应的比赛名称。
 * valueOf(row) 是一场比赛在纵轴上的数值。
 * axis(rows) 按选中的时间范围里的那些场（可能一场都没有）定纵轴：返回 { min, max, ticks, format, inverse, guides }，
 *   ticks 是刻度所在的数值（不给就用自动的刻度），format 把刻度上的数值写成文字，
 *   inverse 为真时数值小的在上面，guides 为真时每个刻度画一条浅色的横线。
 * backdrop({ min, max, at }) 可选，返回画在线后面的一个系列（比如评级的色带）；at 是时间轴上的一个时刻，给它定位用。
 */
export function useCompareChart({ accounts, lines, valueOf, axis, backdrop = null }) {
  // 底部的范围选择：拖动滑块两头的手柄或整个滑块，只看一段时间。
  // zoom 是选中的时间范围 [起, 止]（毫秒），null 表示整条时间线；extent 是整条时间线的范围。
  // 拖动的过程中图表库自己移动窗口，这里只把范围记下来（不触发重画，免得和拖动抢着更新）；
  // 等拖动停一下，再把它交给 settled，纵轴按窗口里的数值重新定范围，线和背景带着过渡调整过去。
  let zoom = null;
  let extent = [0, 0];
  const settled = ref(null);
  let settleTimer = 0;
  function onZoom(params) {
    const { start, end } = params.batch?.[0] ?? params;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;
    const [min, max] = extent;
    const whole = start <= 0.05 && end >= 99.95;
    zoom = whole ? null : [min + ((max - min) * start) / 100, min + ((max - min) * end) / 100];
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => (settled.value = zoom), 160);
  }
  onBeforeUnmount(() => clearTimeout(settleTimer));

  // 上一次各条线画没画圆点，见 dots。
  let lastDots = new Map();
  function buildOption(width) {
    const ink = grays();
    const dotsBefore = lastDots;
    lastDots = new Map();
    const shown = lines();
    const axisLabel = { fontSize: 10, fontFamily: FONT, color: ink.label };
    const all = accounts.drawn.flatMap((entry) => entry.history.rows);
    if (!all.length)
      return { grid: COMPARE_GRID, xAxis: { type: 'time' }, yAxis: { type: 'value' }, series: [] };
    const times = all.map((row) => row[HISTORY.time]);
    const from = Math.min(...times);
    const to = Math.max(...times);
    // 时间轴两头各留一点空，第一场和最后一场的点不贴着边；只有一场比赛时也有个范围。
    const side = Math.max(15 * DAY, (to - from) * 0.02);
    extent = [(from - side) * 1000, (to + side) * 1000];
    // 账号增减后时间线变了，原来选的范围可能已经不在里面，那就回到整条时间线。
    if (zoom && (zoom[1] <= extent[0] || zoom[0] >= extent[1])) zoom = null;
    // 纵轴按选中范围里的那些场来定；settled 是拖动停下后的范围，读它是为了范围变了能重画。
    const span = settled.value && zoom;
    const seen = shown.flatMap((line) => inSpan(line.rows, span));
    const scale = axis(seen.length ? seen : shown.flatMap((line) => line.rows));
    const marks = scale.ticks ? { customValues: scale.ticks } : {};
    const plot = width - COMPARE_GRID.left - COMPARE_GRID.right;
    return {
      grid: COMPARE_GRID,
      xAxis: {
        type: 'time',
        min: extent[0],
        max: extent[1],
        axisTick: { show: false },
        axisLine: { lineStyle: { color: ink.line } },
        splitLine: { show: false },
        axisLabel: {
          ...axisLabel,
          hideOverlap: true,
          formatter: { year: '{yyyy}', month: '{yyyy}-{MM}', day: '{MM}-{dd}', hour: '{HH}:{mm}' },
        },
      },
      yAxis: {
        type: 'value',
        min: scale.min,
        max: scale.max,
        inverse: Boolean(scale.inverse),
        axisTick: { show: false, ...marks },
        axisLabel: { ...axisLabel, ...marks, formatter: scale.format },
        // 横线跟着刻度走（图表库按刻度的位置画）。
        splitLine: { show: Boolean(scale.guides), lineStyle: { color: ink.faint } },
      },
      dataZoom: [
        {
          id: 'span',
          type: 'slider',
          xAxisIndex: 0,
          // 只移动窗口，不筛掉窗口外的点：线要从窗口外连进来，不能在边上断开。
          filterMode: 'none',
          ...(zoom ? { startValue: zoom[0], endValue: zoom[1] } : { start: 0, end: 100 }),
          left: COMPARE_GRID.left,
          right: COMPARE_GRID.right,
          bottom: 4,
          height: SLIDER,
          // 在滑块的空白处拖动不新选一段范围，只能拖手柄和滑块本身，免得误操作。
          brushSelect: false,
          moveHandleSize: 0,
          borderColor: ink.line,
          backgroundColor: '#fff',
          fillerColor: 'rgba(91, 143, 214, 0.14)',
          // 滑块里衬一条缩小的曲线（第一条线的），看得出选的是哪一段。
          dataBackground: {
            lineStyle: { color: ink.edge, width: 1 },
            areaStyle: { color: ink.faint, opacity: 1 },
          },
          selectedDataBackground: {
            lineStyle: { color: '#5b8fd6', width: 1 },
            areaStyle: { color: 'rgba(91, 143, 214, 0.22)', opacity: 1 },
          },
          handleSize: '100%',
          handleStyle: { color: '#fff', borderColor: '#5b8fd6', borderWidth: 1 },
          emphasis: { handleStyle: { borderColor: '#3f76c4', borderWidth: 2 } },
          // 拖动时手柄旁标出范围两头的日期。
          textStyle: { fontSize: 10, fontFamily: FONT, color: ink.label },
          labelFormatter: (value) => dateText(new Date(value)),
        },
      ],
      series: [
        ...shown.map(curve),
        ...shown.map(dots),
        ...(backdrop ? [backdrop({ min: scale.min, max: scale.max, at: from * 1000 })] : []),
      ],
    };
    // 各个账号的线。悬停判断按 id 找到某个账号的线：增减过账号之后，系列的序号不一定还和这里的顺序一致。
    function curve({ entry, rows }) {
      return {
        id: lineId(entry),
        type: 'line',
        // 线自己不响应鼠标：悬停范围由 hit 统一判断，强调也由它触发。
        silent: true,
        z: 3,
        data: rows.map((row) => [row[HISTORY.time] * 1000, valueOf(row)]),
        // 线自己的圆点平时不画（各场的圆点由下面的 dots 画），只在悬停时显示被悬停的那一个，放大一些。
        symbol: 'circle',
        symbolSize: DOT,
        showSymbol: false,
        lineStyle: { width: 1.8, color: entry.color },
        itemStyle: { color: '#fff', borderColor: entry.color, borderWidth: 1.5 },
        emphasis: { scale: 1.7, lineStyle: { width: 2.4 } },
      };
    }
    /*
     * 各场比赛的空心圆点。点会挤成一片时不画；挤不挤按选中的时间范围里有多少场来算，
     * 所以整条时间线上太密、没画点的线，把范围选窄之后点就出来了，再选宽又收起。
     * 不用折线自带的圆点：它的显隐是直接切换的，没有过渡。自己画的出现时淡入，收起时淡出，
     * 纵轴重新定范围时跟着线一起挪过去。
     * 只画落在绘图区里的点；拖动范围的过程中配置不重算（见 onZoom），新移进来的点照当时的状态画，停下后再按新的范围定。
     * 画在所有线的上面、线自己那个悬停时的圆点下面：悬停时大的那个把它盖住，不会叠出两圈。
     */
    function dots({ entry, rows }) {
      const visible = inSpan(rows, span).length * DOT_ROOM <= plot;
      // 刚从画变成不画的这一轮，点还留着，只是变透明：这样才有淡出。下一轮它们就不在了。
      const fading = !visible && dotsBefore.get(entry.id) === true;
      lastDots.set(entry.id, visible);
      return {
        id: `dots-${entry.id}`,
        type: 'custom',
        silent: true,
        z: 3,
        clip: false,
        data: visible || fading ? rows.map((row) => [row[HISTORY.time] * 1000, valueOf(row)]) : [],
        renderItem(params, api) {
          const [x, y] = api.coord([api.value(0), api.value(1)]);
          const box = params.coordSys;
          if (x < box.x || x > box.x + box.width) return null;
          return {
            type: 'circle',
            x,
            y,
            z2: 50,
            shape: { r: DOT / 2 },
            style: { fill: '#fff', stroke: entry.color, lineWidth: 1.5, opacity: visible ? 1 : 0 },
            transition: ['x', 'y', 'style'],
            enterFrom: { style: { opacity: 0 } },
          };
        },
      };
    }
  }

  const pixelOf = (chart, seriesId, row) =>
    chart.convertToPixel({ seriesId }, [row[HISTORY.time] * 1000, valueOf(row)]);
  function hit(x, y, chart) {
    let best = null;
    for (const line of lines()) {
      const { rows } = line;
      const seriesId = lineId(line.entry);
      const at = chart.convertFromPixel({ seriesId }, [x, y]);
      if (!at) continue;
      // 只认绘图区里的点：选了时间范围之后，范围外的点被裁掉了，不该还能悬停到。
      const right = chart.getWidth() - COMPARE_GRID.right;
      // 先按时间找到最近的一场，再把它前后两场也比一比：线很陡的地方，时间最近的不一定是离得最近的。
      const middle = nearestIndex(rows, at[0] / 1000);
      const last = Math.min(rows.length - 1, middle + 2);
      for (let index = Math.max(0, middle - 2); index <= last; index++) {
        const point = pixelOf(chart, seriesId, rows[index]);
        if (!point || point[0] < COMPARE_GRID.left || point[0] > right) continue;
        const distance = Math.hypot(point[0] - x, point[1] - y);
        if (distance <= REACH && (!best || distance < best.distance))
          best = { seriesId, dataIndex: index, line, distance };
      }
    }
    return best;
  }
  // 提示：标题行是账号和日期，面板的底色和边线带一点这条线的颜色。
  // 下面是一张小表，左边一栏是灰色的项目名：比赛（点了去比赛页）、名次、
  // 评级（从多少到多少，两个数各按自己的档位着色，后面紧跟着变化量）、提交（点了去这个账号在这一场的提交记录）。
  // 链接要先点一下这个点把提示固定住才点得到，见 useChart 的 tip.pinnable。
  function tipOf({ line, dataIndex }) {
    const { entry } = line;
    const row = line.rows[dataIndex];
    const date = new Date(row[HISTORY.time] * 1000);
    const change = row[HISTORY.rating] - row[HISTORY.old];
    const contest = row[HISTORY.contest];
    const labels = t('analyticsCompareLabels');
    const color = grays().label;
    return {
      lead: entry.handle,
      leadColor: entry.color,
      text: dateText(date),
      background: mixHex(entry.color, '#ffffff', 0.94),
      border: mixHex(entry.color, '#ffffff', 0.62),
      items: [
        {
          label: labels.contest,
          text: line.names[dataIndex],
          href: contest ? `/contest/${contest}` : null,
          action: true,
          color,
        },
        { label: labels.rank, text: t('analyticsCompareRank', row[HISTORY.rank]), color },
        {
          label: labels.rating,
          text: [
            rated(row[HISTORY.old]),
            ' → ',
            rated(row[HISTORY.rating]),
            // 变化量和评级之间空半个字宽，不推到这一行的最右边去。
            ' ',
            {
              text: `${change >= 0 ? '+' : '−'}${Math.abs(change)}`,
              color: CHANGE_COLORS[change > 0 ? 'up' : change < 0 ? 'down' : 'same'],
            },
          ],
          color,
        },
        contest && {
          label: labels.submissions,
          text: t('analyticsCompareSubmissions'),
          href: `/submissions/${encodeURIComponent(entry.handle)}/contest/${contest}`,
          action: true,
          color,
        },
      ].filter(Boolean),
    };
  }
  // 线的条数会变，系列按 id 增减。
  return useChart(buildOption, {
    replaced: ['series'],
    events: { datazoom: onZoom },
    tip: {
      hit,
      content: tipOf,
      point: ({ seriesId, line, dataIndex }, chart) =>
        pixelOf(chart, seriesId, line.rows[dataIndex]),
      gap: 10,
      pinnable: true,
    },
  });
}
