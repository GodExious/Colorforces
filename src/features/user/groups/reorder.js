// 拖动调整分组先后时用到的两步计算。只算数，不碰页面：量位置、跟着鼠标走、存下来都在分组页里。

// 被拖的那一项要不要挪一格。
//   order      眼下的先后（一串分组 id），只有自建的分组；
//   id         被拖的那一项；
//   top, bottom  它上下两条边的纵坐标（它正贴在鼠标上，不在自己那一格里）；
//   middleOf(id)  某一项中线的纵坐标，按它在列表里排好的位置算；量不到时给 NaN。
// 往下：它的下边过了下一项的中线，和下一项换位；往上：它的上边过了上一项的中线，和上一项换位。
// 用边而不是用它自己的中线来比：拖到列表的两头时它被挡在边上，中线到不了第一项、最后一项的中线，边能到。
// 换过去和换回来是同一条线（两项对调后，对方的中线正好挪了它的高度），停在线附近不会来回换。
// 一次最多挪一格。返回新的先后；不用挪时返回传进来的那个数组本身，调用的地方据此知道没变。
export function stepOrder(order, id, top, bottom, middleOf) {
  const at = order.indexOf(id);
  if (at < 0) return order;
  let to = at;
  if (at < order.length - 1 && bottom > middleOf(order[at + 1])) to = at + 1;
  else if (at > 0 && top < middleOf(order[at - 1])) to = at - 1;
  if (to === at) return order;
  const next = [...order];
  next.splice(to, 0, ...next.splice(at, 1));
  return next;
}

// 拖的过程中列表按 order 排：groups 是全部分组（「好友」在最前），order 是拖动时自建分组眼下的先后。
// 「好友」总在最前；不在 order 里的分组（拖的过程中别处新加进来的）排到最后，彼此保持原来的先后。
export function arrangeGroups(groups, order) {
  const place = (group) => (order.includes(group.id) ? order.indexOf(group.id) : order.length);
  const builtin = groups.filter((group) => group.builtin);
  const custom = groups.filter((group) => !group.builtin);
  return [...builtin, ...custom.sort((a, b) => place(a) - place(b))];
}
