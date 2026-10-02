// 生成固定的模拟榜单，保证每次运行得到同一组选手。
export function sampleRows(count = 40) {
  let state = 20260822;
  const next = (range) => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state % range;
  };
  return Array.from({ length: count }, (_, index) => ({
    handle: `user${index + 1}`,
    points: 500 * (1 + next(8)),
    penalty: next(300),
    rating: 800 + next(1800),
  }));
}
