// 构造一条接口格式的提交记录，只需写出和默认值不同的字段。
let serial = 0;
export function submission({
  id = ++serial,
  time = id,
  contestId = 1000,
  index = 'A',
  name = `Problem ${index}`,
  rating,
  tags = [],
  verdict = 'OK',
  lang = 'C++20 (GCC 13-64)',
  type = 'PRACTICE',
  relative = 2147483647,
  members = ['alice'],
} = {}) {
  return {
    id,
    contestId,
    creationTimeSeconds: time,
    relativeTimeSeconds: relative,
    problem: { contestId, index, name, type: 'PROGRAMMING', rating, tags },
    author: { contestId, members: members.map((handle) => ({ handle })), participantType: type },
    programmingLanguage: lang,
    verdict,
  };
}
