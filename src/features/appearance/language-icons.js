import { languageC, languageD, languageIo } from '../../assets/index.js';
import { getDeviconUrl } from '../../assets/remote.js';

// 将 Codeforces 编程语言名称映射到图标标识。
export function getLanguageIconName(langStr) {
  langStr = langStr.toLowerCase();
  if (langStr.includes('c++') || langStr.includes('g++')) return 'cplusplus';
  if (langStr.includes('c#')) return 'csharp';
  if (langStr.includes('python') || langStr.includes('pypy')) return 'python';
  if (langStr.includes('java') && !langStr.includes('javascript')) return 'java';
  if (langStr.includes('rust')) return 'rust';
  if (/\bgo\b/.test(langStr)) return 'go';
  if (langStr.includes('kotlin')) return 'kotlin';
  if (langStr.includes('ruby')) return 'ruby';
  if (langStr.includes('node.js') || langStr.includes('nodejs')) return 'nodejs';
  if (langStr.includes('javascript') || langStr.includes('v8')) return 'javascript';
  if (langStr.includes('php')) return 'php';
  if (langStr.includes('haskell')) return 'haskell';
  if (langStr.includes('scala')) return 'scala';
  if (langStr.includes('ocaml')) return 'ocaml';
  if (langStr.includes('perl')) return 'perl';
  if (langStr.includes('f#')) return 'fsharp';
  if (langStr.includes('delphi')) return 'delphi';
  if (/\bd\b/.test(langStr) || langStr.includes('dmd')) return 'd';
  if (
    langStr.includes('gcc') ||
    langStr.includes('clang') ||
    /\bc(?:89|99|11|17|18|23|2x)?\b/.test(langStr)
  )
    return 'c';
  if (/\bio\b/.test(langStr)) return 'io';
  return null;
}

// 为提交语言单元格插入图标，保留原始语言文本和提示。
export function enhanceLanguageCell(langCell) {
  const langText = (langCell.title || langCell.textContent).trim();
  const iconName = getLanguageIconName(langText);
  const needsProcessing =
    !langCell.hasAttribute('data-cf-lang-icon-processed') ||
    (iconName && !langCell.querySelector('.cf-lang-icon'));

  if (needsProcessing) {
    langCell.setAttribute('data-cf-lang-icon-processed', 'true');
    langCell.title = langText;

    const textSpan = langCell.querySelector('.cf-lang-text') || document.createElement('span');
    textSpan.className = 'cf-lang-text';
    textSpan.textContent = langText;

    if (iconName) {
      let img = langCell.querySelector('.cf-lang-icon');
      if (!img) {
        img = document.createElement('img');
        let svgName = `${iconName}-original.svg`;
        let customSrc = null;
        if (iconName === 'go') svgName = 'go-original-wordmark.svg';
        if (iconName === 'c') {
          customSrc = languageC;
        }
        if (iconName === 'd') {
          customSrc = languageD;
        }
        if (iconName === 'io') {
          customSrc = languageIo;
        }
        img.src = customSrc || getDeviconUrl(iconName, svgName);
        img.className = 'cf-lang-icon';
      }
      const content = document.createElement('span');
      content.className = 'cf-lang-content';
      const slot = document.createElement('span');
      slot.className = 'cf-lang-icon-slot';
      slot.appendChild(img);
      content.append(slot, textSpan);
      langCell.replaceChildren(content);
    } else {
      langCell.innerHTML = '';
      langCell.appendChild(textSpan);
    }
  }
}
