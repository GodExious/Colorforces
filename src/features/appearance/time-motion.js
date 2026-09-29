const running = new WeakMap();

// 只保留一份时间文字，旧格式收拢后按新尺寸展开。
export function displayTime(host, html) {
  const pending = running.get(host);
  if (pending) {
    pending.next = html;
    return;
  }
  let slot = host.querySelector(':scope > .cf-time-slot');
  if (!slot) {
    slot = document.createElement('span');
    slot.className = 'cf-time-slot';
    const value = document.createElement('span');
    value.className = 'cf-time-value';
    value.innerHTML = html;
    slot.appendChild(value);
    host.replaceChildren(slot);
    return;
  }
  const value = slot.firstElementChild;
  if (value.innerHTML === html) return;
  if (
    document.hidden ||
    !host.isConnected ||
    matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    value.innerHTML = html;
    return;
  }
  const state = { next: html };
  running.set(host, state);
  const before = slot.getBoundingClientRect();
  const out = value.animate(
    [{ clipPath: 'inset(-1em 0% -1em 0)' }, { clipPath: 'inset(-1em 100% -1em 0)' }],
    {
      duration: 100,
      fill: 'both',
      easing: 'ease-in',
    },
  );
  out.finished
    .then(async () => {
      const target = state.next;
      value.innerHTML = target;
      const after = slot.getBoundingClientRect();
      value.style.width = after.width + 'px';
      const options = { duration: 200, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' };
      const size = slot.animate(
        [
          { width: before.width + 'px', height: before.height + 'px' },
          { width: after.width + 'px', height: after.height + 'px' },
        ],
        options,
      );
      const enter = value.animate(
        [{ clipPath: 'inset(-1em 100% -1em 0)' }, { clipPath: 'inset(-1em 0% -1em 0)' }],
        options,
      );
      out.cancel();
      await Promise.all([size.finished, enter.finished]).catch(() => {});
      value.style.removeProperty('width');
      size.cancel();
      enter.cancel();
      running.delete(host);
      if (host.isConnected && state.next !== target) displayTime(host, state.next);
    })
    .catch(() => running.delete(host));
}
