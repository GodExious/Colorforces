// 记录 Shift 物理按键状态，兼容数字小键盘事件。
export let isShiftPhysicallyDown = false;

// 保存 Shift 最近释放时间，补偿浏览器事件差异。
export let lastShiftKeyUpTime = 0;

// 结合事件和物理状态判断 Shift 是否按下。
export function isShiftActive(e) {
  if (!e) return false;
  if (e.shiftKey) return true;
  if (typeof e.getModifierState === 'function' && e.getModifierState('Shift')) return true;
  if (isShiftPhysicallyDown) return true;

  // Specific detection for Numpad keys on Windows where OS suppresses shiftKey
  if (e.code && e.code.startsWith('Numpad')) {
    const isDigitOrDot = [
      'Numpad0',
      'Numpad1',
      'Numpad2',
      'Numpad3',
      'Numpad4',
      'Numpad5',
      'Numpad6',
      'Numpad7',
      'Numpad8',
      'Numpad9',
      'NumpadDecimal',
    ].includes(e.code);
    if (isDigitOrDot) {
      if (typeof e.getModifierState === 'function') {
        const numlock = e.getModifierState('NumLock');
        const isNumberChar = /^[0-9.]$/.test(e.key);
        // With NumLock ON, Shift turns digits into navigation keys (e.key is non-digit like Clear/End)
        // With NumLock OFF, Shift turns navigation keys into digits (e.key is digit)
        if (numlock && !isNumberChar) return true;
        if (!numlock && isNumberChar) return true;
      }
      if (Date.now() - lastShiftKeyUpTime < 150 && !/^[0-9.]$/.test(e.key)) {
        return true;
      }
    } else {
      if (Date.now() - lastShiftKeyUpTime < 150) return true;
    }
  }
  return false;
}

// 将物理按键代码映射为稳定的组合键名称。
export const CODE_TO_BASE_KEY = {
  // Punctuations (maps physical key code to unshifted base symbol)
  Quote: "'",
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Comma: ',',
  Period: '.',
  Slash: '/',

  // Numpad keys
  Numpad0: 'Num0',
  Numpad1: 'Num1',
  Numpad2: 'Num2',
  Numpad3: 'Num3',
  Numpad4: 'Num4',
  Numpad5: 'Num5',
  Numpad6: 'Num6',
  Numpad7: 'Num7',
  Numpad8: 'Num8',
  Numpad9: 'Num9',
  NumpadAdd: 'Num+',
  NumpadSubtract: 'Num-',
  NumpadMultiply: 'Num*',
  NumpadDivide: 'Num/',
  NumpadDecimal: 'Num.',
  NumpadEnter: 'NumEnter',

  // Navigation and editing keys
  Backspace: 'Backspace',
  Delete: 'Del',
  Insert: 'Ins',
  PageUp: 'PgUp',
  PageDown: 'PgDn',
  Home: 'Home',
  End: 'End',
  Space: 'Space',
  Tab: 'Tab',
  Enter: 'Enter',
  Escape: 'Esc',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
};

// 按修饰键和物理主键匹配用户配置的快捷键。
export function matchesShortcut(e, shortcutStr) {
  if (!shortcutStr || typeof shortcutStr !== 'string') return false;
  const parts = shortcutStr
    .split('+')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return false;

  const reqCtrl = parts.includes('Ctrl');
  const reqAlt = parts.includes('Alt');
  const reqShift = parts.includes('Shift');
  const reqMeta = parts.includes('Meta');

  if (e.ctrlKey !== reqCtrl) return false;
  if (e.altKey !== reqAlt) return false;
  if (isShiftActive(e) !== reqShift) return false;
  if (e.metaKey !== reqMeta) return false;

  const mainKey = parts[parts.length - 1];
  const mainUpper = mainKey.toUpperCase();
  const eventKey = (e.key || '').toUpperCase();
  const eventCode = (e.code || '').toUpperCase();

  // 1. Numpad keys: strictly match Numpad code
  if (mainUpper.startsWith('NUM')) {
    const sub = mainKey.slice(3);
    if (/^[0-9]$/.test(sub)) return e.code === 'Numpad' + sub;
    if (sub === '+') return e.code === 'NumpadAdd';
    if (sub === '-') return e.code === 'NumpadSubtract';
    if (sub === '*') return e.code === 'NumpadMultiply';
    if (sub === '/') return e.code === 'NumpadDivide';
    if (sub === '.') return e.code === 'NumpadDecimal';
    if (sub.toUpperCase() === 'ENTER') return e.code === 'NumpadEnter';
    return false;
  }

  // 2. Top-row digit: must match Digit[0-9] and NOT Numpad
  if (/^[0-9]$/.test(mainKey)) {
    return e.code === 'Digit' + mainKey;
  }

  // 3. Punctuation base key mapping
  const codeBase = CODE_TO_BASE_KEY[e.code];
  if (codeBase && codeBase.toUpperCase() === mainUpper) {
    return true;
  }

  // 4. Letter keys
  if (/^[A-Z]$/.test(mainUpper)) {
    if (e.code === 'Key' + mainUpper) return true;
    if (eventKey === mainUpper) return true;
    return false;
  }

  // 5. Special / navigation keys
  if (mainUpper === 'SPACE' && (e.key === ' ' || eventCode === 'SPACE')) return true;
  if (mainUpper === 'BACKSPACE' && (eventKey === 'BACKSPACE' || eventCode === 'BACKSPACE'))
    return true;
  if (
    (mainUpper === 'DEL' || mainUpper === 'DELETE') &&
    (eventKey === 'DELETE' || eventCode === 'DELETE')
  )
    return true;
  if (
    (mainUpper === 'INS' || mainUpper === 'INSERT') &&
    (eventKey === 'INSERT' || eventCode === 'INSERT')
  )
    return true;
  if (
    (mainUpper === 'ESC' || mainUpper === 'ESCAPE') &&
    (eventKey === 'ESCAPE' || eventCode === 'ESCAPE')
  )
    return true;
  if (
    (mainUpper === 'PGUP' || mainUpper === 'PAGEUP') &&
    (eventKey === 'PAGEUP' || eventCode === 'PAGEUP')
  )
    return true;
  if (
    (mainUpper === 'PGDN' || mainUpper === 'PAGEDOWN') &&
    (eventKey === 'PAGEDOWN' || eventCode === 'PAGEDOWN')
  )
    return true;
  if (
    (mainUpper === 'UP' || mainKey === '↑') &&
    (eventKey === 'ARROWUP' || eventCode === 'ARROWUP')
  )
    return true;
  if (
    (mainUpper === 'DOWN' || mainKey === '↓') &&
    (eventKey === 'ARROWDOWN' || eventCode === 'ARROWDOWN')
  )
    return true;
  if (
    (mainUpper === 'LEFT' || mainKey === '←') &&
    (eventKey === 'ARROWLEFT' || eventCode === 'ARROWLEFT')
  )
    return true;
  if (
    (mainUpper === 'RIGHT' || mainKey === '→') &&
    (eventKey === 'ARROWRIGHT' || eventCode === 'ARROWRIGHT')
  )
    return true;

  if (eventKey === mainUpper || eventCode === mainUpper) return true;

  return false;
}
// 监听物理 Shift 键，兼容 Windows 数字小键盘。
export function startModifierTracking() {
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        isShiftPhysicallyDown = true;
      }
    },
    true,
  );
  window.addEventListener(
    'keyup',
    (e) => {
      if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        isShiftPhysicallyDown = false;
        lastShiftKeyUpTime = Date.now();
      }
    },
    true,
  );
  window.addEventListener('blur', () => {
    isShiftPhysicallyDown = false;
  });
}
