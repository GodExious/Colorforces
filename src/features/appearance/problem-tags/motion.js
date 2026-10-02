// 与界面页的标签显示设置共用动画状态。
const active = new WeakMap();
const initialized = new WeakSet();
const duration = 300;

// 只选标签的最外层，不把原站 roundbox 与内部文字分别移动。
function items(container) {
  return [
    ...new Set(
      [...container.querySelectorAll('span.tag-box')].map((span) =>
        span.parentElement !== container && span.parentElement.classList.contains('roundbox')
          ? span.parentElement
          : span,
      ),
    ),
  ];
}

// 收集标签外的原站内容（权限提示、编辑入口），不改文字或事件绑定。
function companions(container) {
  const tags = new Set(items(container));
  const result = [];
  const visit = (parent) => {
    for (const child of parent.children) {
      if (tags.has(child) || child.matches('script, style')) continue;
      if (child.querySelector('span.tag-box')) visit(child);
      else if (
        child.getClientRects().length &&
        (child.textContent.trim() || child.querySelector('a, button'))
      ) {
        result.push(child);
      }
    }
  };
  visit(container);
  return result;
}

// 记录实际可见矩形；中途反向时从当前帧接续。
export function beginTagMotion(container) {
  const visible = new Map();
  for (const item of items(container)) {
    if (item.getClientRects().length) {
      const rect = item.getBoundingClientRect();
      const style = getComputedStyle(item);
      visible.set(item, {
        rect,
        opacity: Number(style.opacity),
        // 动画中的绝对定位尺寸未缩放；与可见矩形分开保存，反向时不放大一帧。
        width: container.classList.contains('cf-tags-moving')
          ? parseFloat(style.width) || rect.width
          : rect.width,
        height: container.classList.contains('cf-tags-moving')
          ? parseFloat(style.height) || rect.height
          : rect.height,
      });
    }
  }
  const rect = container.getBoundingClientRect();
  const anchor = container.querySelector('.cf-tags-hidden-notice')?.getBoundingClientRect();
  const extras = new Map(
    companions(container).map((element) => [element, element.getBoundingClientRect()]),
  );
  active.get(container)?.();
  const ready = initialized.has(container);
  initialized.add(container);
  return { visible, rect, anchor, ready, extras };
}

// 临时改变定位所需属性，结束时仅还原这些属性，不覆盖其他功能样式。
function temporaryStyle(element, values, restores) {
  const saved = Object.keys(values).map((key) => [
    key,
    element.style.getPropertyValue(key),
    element.style.getPropertyPriority(key),
  ]);
  for (const [key, value] of Object.entries(values))
    element.style.setProperty(key, value, 'important');
  restores.push(() => {
    for (const [key, value, priority] of saved) {
      if (value) element.style.setProperty(key, value, priority);
      else element.style.removeProperty(key);
    }
  });
}

// 隐藏算法标签时吸入提示；评分有无变化时就地收放，同时过渡容器高度。
export function finishTagMotion(container, before, { collapseToNotice = true } = {}) {
  if (!before.ready || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches)
    return;
  const after = new Map(
    items(container)
      .filter((item) => item.getClientRects().length)
      .map((item) => [item, item.getBoundingClientRect()]),
  );
  const box = container.getBoundingClientRect();
  const extras = new Map(
    companions(container).map((element) => [element, element.getBoundingClientRect()]),
  );
  const anchor =
    container.querySelector('.cf-tags-hidden-notice')?.getBoundingClientRect() || before.anchor;
  if (collapseToNotice && !anchor) return;
  const changed = [...new Set([...before.visible.keys(), ...after.keys()])].filter(
    (item) =>
      item.isConnected &&
      (before.visible.has(item) !== after.has(item) ||
        Math.abs(before.visible.get(item)?.rect.x - after.get(item)?.x) > 0.5 ||
        Math.abs(before.visible.get(item)?.rect.y - after.get(item)?.y) > 0.5),
  );
  if (!changed.length) return;
  const restores = [],
    animations = [];
  const options = { duration, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' };
  const center = (rect) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
  temporaryStyle(
    container,
    { position: 'relative', 'box-sizing': 'border-box', overflow: 'hidden' },
    restores,
  );
  container.classList.add('cf-tags-moving');
  // 标签暂时脱离文档流时，也锁定原站尾部内容的真实矩形，结束后恢复原样。
  for (const [element, next] of extras) {
    const old = before.extras.get(element) || next;
    temporaryStyle(
      element,
      {
        position: 'absolute',
        left: next.x - box.x - container.clientLeft + 'px',
        top: next.y - box.y - container.clientTop + 'px',
        width: next.width + 'px',
        height: next.height + 'px',
        margin: '0',
        'box-sizing': 'border-box',
      },
      restores,
    );
    animations.push(
      element.animate(
        [{ translate: `${old.x - next.x}px ${old.y - next.y}px` }, { translate: '0px 0px' }],
        options,
      ),
    );
  }
  for (const item of new Set([...before.visible.keys(), ...after.keys()])) {
    if (!item.isConnected) continue;
    const previous = before.visible.get(item);
    const old = previous?.rect,
      next = after.get(item);
    const rect = next || {
      x: old.x + (old.width - previous.width) / 2,
      y: old.y + (old.height - previous.height) / 2,
      width: previous.width,
      height: previous.height,
    };
    const origin = center(old || (collapseToNotice ? anchor : next)),
      target = center(next || (collapseToNotice ? anchor : old)),
      base = center(rect);
    // 原站标签可能是 inline；固定到各自真实矩形后才能可靠地执行位移。
    temporaryStyle(
      item,
      {
        position: 'absolute',
        left: rect.x - box.x - container.clientLeft + 'px',
        top: rect.y - box.y - container.clientTop + 'px',
        width: rect.width + 'px',
        height: rect.height + 'px',
        margin: '0',
        'box-sizing': 'border-box',
        display: 'block',
      },
      restores,
    );
    if (!next) {
      item
        .querySelectorAll('[data-cf-tag-hidden]')
        .forEach((child) => temporaryStyle(child, { display: 'inline' }, restores));
    }
    const startScaleX = old ? old.width / (rect.width || 1) : 0.12,
      startScaleY = old ? old.height / (rect.height || 1) : 0.12,
      endScale = next ? 1 : 0.12;
    animations.push(
      item.animate(
        [
          {
            transform: `translate(${origin.x - base.x}px, ${origin.y - base.y}px) scale(${startScaleX}, ${startScaleY})`,
            opacity: previous?.opacity ?? 0,
          },
          {
            transform: `translate(${target.x - base.x}px, ${target.y - base.y}px) scale(${endScale})`,
            opacity: next ? 1 : 0,
          },
        ],
        options,
      ),
    );
  }
  animations.push(
    container.animate(
      [{ height: before.rect.height + 'px' }, { height: box.height + 'px' }],
      options,
    ),
  );
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    animations.forEach((animation) => animation.cancel());
    restores.reverse().forEach((restore) => restore());
    container.classList.remove('cf-tags-moving');
    active.delete(container);
  };
  active.set(container, cleanup);
  Promise.all(animations.map((animation) => animation.finished)).then(cleanup, cleanup);
}
