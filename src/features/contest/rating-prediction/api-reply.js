/*
 * 原站接口的回答怎么算。
 *
 * 接口报业务上的错（这场没有评级变化、账号不存在、请求太频繁）时，HTTP 状态不是 200（多是 400），
 * 具体原因写在正文的 comment 里。所以不能看到状态不是 200 就当成网络错误：先读正文，
 * 正文是接口自己的报错就按业务错误算、把原因带上；正文读不出来才是网络错误。
 * 不这样的话，不计分的比赛（接口对它们一律答「没有评级变化」）会被当成请求失败，一直重试。
 */
export function readReply(body) {
  if (body?.status === 'OK') return { result: body.result };
  if (body?.status === 'FAILED')
    return { error: 'predictionApiError', comment: String(body.comment || '') };
  return { error: 'predictionNetworkError', comment: '' };
}

// 接口说这场没有评级变化：不计分的比赛，或者还没出分。
export function noRatingChanges(comment) {
  return /rating changes are unavailable|rating changes.*not available/i.test(comment || '');
}
