// 题目编号自然排序比较器。
export const naturalCollator =
  typeof Intl !== 'undefined' && Intl.Collator
    ? new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
    : null;

// 按自然顺序比较含数字的题号。
export const naturalCompare = naturalCollator
  ? naturalCollator.compare.bind(naturalCollator)
  : (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

// 自然排序题目映射的键，保持内容不变。
export function sortProblemKeys(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const sorted = {};
  const sortedKeys = Object.keys(obj).sort(naturalCompare);
  for (const k of sortedKeys) {
    sorted[k] = obj[k];
  }
  return sorted;
}

// 自然排序已解决题目编号列表。
export function sortProblemIds(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice().sort(naturalCompare);
}

// 去除题目标题中的序号与标记。
export function cleanProblemTitle(title) {
  if (!title || typeof title !== 'string') return '';
  let s = title.trim();
  // Remove prefixes like "C1. ", "C1 - ", "C1: ", "Problem C1. ", "1831C - ", etc.
  s = s.replace(/^(?:problem\s*)?(?:[0-9]+[a-z0-9]*|[a-z0-9]+)\s*[\.\-\–\—\:]\s*/i, '');
  return s.trim();
}

// 规范化题目名称，供并赛同名题目查找。
export function normalizeProblemName(name) {
  if (!name || typeof name !== 'string') return '';
  let s = name.trim();
  // Remove prefixes like "1831C - ", "1831C. ", "C - ", "C. ", "Problem C. "
  s = s.replace(/^(?:problem\s*)?(?:\d+[a-z0-9]*|[a-z0-9]+)\s*[\.\-\–\—\:]\s*/i, '');
  // Normalize multiple spaces and lowercase
  s = s.replace(/\s+/g, ' ').trim().toLowerCase();
  return s;
}

// 从题目链接提取比赛编号与题号。
export function extractProblemKey(url) {
  if (!url) return null;
  const match =
    url.match(/\/contest\/(\d+)\/problem\/([A-Za-z0-9_]+)/i) ||
    url.match(/\/problemset\/problem\/(\d+)\/([A-Za-z0-9_]+)/i) ||
    url.match(/\/gym\/(\d+)\/problem\/([A-Za-z0-9_]+)/i);
  if (match) {
    return `${match[1]}${match[2]}`.toUpperCase();
  }
  return null;
}
