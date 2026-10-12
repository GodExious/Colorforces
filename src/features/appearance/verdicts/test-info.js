// 判题文字里的测试点信息：「on test 3」「on pretest 3」；俄文界面是「на тесте 3」「на претесте 3」。
// 编号有时不在这段文字里，而是单独包在后面的一个节点里，所以编号可有可无。
const TEST_INFO = /(?:^|\s+)(?:on\s+(?:pre)?test|на\s+(?:пре)?тесте)(?![a-zа-яё])(?:\s*\d+)?/i;

/**
 * 在一段文字里找测试点信息。
 * @returns {{ start: number, end: number, numbered: boolean } | null}
 *   start、end 是这一段在文字里的位置（连同前面的空白）；numbered 表示这一段里已经带着编号。
 */
export function findTestInfo(text) {
  const match = String(text ?? '').match(TEST_INFO);
  if (!match) return null;
  return {
    start: match.index,
    end: match.index + match[0].length,
    numbered: /\d/.test(match[0]),
  };
}
