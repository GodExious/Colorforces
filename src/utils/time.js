// 把相对 UTC 的偏移（分钟，东区为正）写成 UTC+8、UTC-3 这样的时区标注。只按整小时标注，不处理半小时时区。
export function utcOffsetLabel(minutes) {
  if (!Number.isFinite(minutes)) return '';
  return `UTC${minutes < 0 ? '-' : '+'}${Math.floor(Math.abs(minutes) / 60)}`;
}

// 按原有占位符规则生成时间文本。
export function customFormatTime(d, formatStr) {
  if (!formatStr || typeof formatStr !== 'string') return '';
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed
  const date = d.getDate();
  const day = d.getDay();
  const hours24 = d.getHours();
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minutes = d.getMinutes();
  const seconds = d.getSeconds();
  const ms = d.getMilliseconds();
  const isPM = hours24 >= 12;

  const MONTH_NAMES_SHORT = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const MONTH_NAMES_FULL = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAY_NAMES_FULL = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];

  const pad = (n, len = 2) => String(n).padStart(len, '0');

  const tokens = {
    YYYY: String(year),
    YY: String(year).slice(-2),
    MMMM: MONTH_NAMES_FULL[month],
    MMM: MONTH_NAMES_SHORT[month],
    MM: pad(month + 1),
    M: String(month + 1),
    DD: pad(date),
    D: String(date),
    dddd: DAY_NAMES_FULL[day],
    ddd: DAY_NAMES_SHORT[day],
    d: String(day),
    HH: pad(hours24),
    H: String(hours24),
    hh: pad(hours12),
    h: String(hours12),
    mm: pad(minutes),
    m: String(minutes),
    ss: pad(seconds),
    s: String(seconds),
    SSS: pad(ms, 3),
    A: isPM ? 'PM' : 'AM',
    a: isPM ? 'pm' : 'am',
  };

  const regex = /\[([^\]]*)\]|YYYY|YY|MMMM|MMM|MM|M|DD|D|dddd|ddd|d|HH|H|hh|h|mm|m|ss|s|SSS|A|a/g;

  return formatStr.replace(regex, (match, escaped) => {
    if (escaped !== undefined) return escaped;
    return tokens[match] !== undefined ? tokens[match] : match;
  });
}
