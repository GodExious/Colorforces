// 把原站的语言名称并成「语言」：同一种语言的不同版本、不同编译器或运行环境算一种。
// 例如 GNU C++17、C++20 (GCC 13-64)、Clang++17 Diagnostics、MS C++ 2017 都是 C++；Python 3 和 PyPy 3-64 都是 Python。
// 规则按顺序匹配，先写的优先：C++ 要排在 C 前面，JavaScript 要排在 Java 前面。
const FAMILIES = [
  [/c\+\+|g\+\+|clang\+\+/i, 'C++'],
  [/f#/i, 'F#'],
  [/q#/i, 'Q#'],
  // Delphi 有自己的图标，单列；其余的 Pascal（FPC、PascalABC.NET）并成一种。
  // Pascal 要排在 C# 前面：PascalABC.NET 的名字里也带 .NET。
  [/delphi/i, 'Delphi'],
  [/pascal|\bfpc\b/i, 'Pascal'],
  [/c#|mono|\.net/i, 'C#'],
  [/python|pypy/i, 'Python'],
  [/typescript/i, 'TypeScript'],
  [/javascript|node\.?js|\bv8\b/i, 'JavaScript'],
  [/java/i, 'Java'],
  [/kotlin/i, 'Kotlin'],
  [/rust/i, 'Rust'],
  [/\bgo\b/i, 'Go'],
  [/ruby/i, 'Ruby'],
  [/php/i, 'PHP'],
  [/haskell/i, 'Haskell'],
  [/scala/i, 'Scala'],
  [/ocaml/i, 'OCaml'],
  [/perl/i, 'Perl'],
  [/\bd\b|\bdmd\b/i, 'D'],
  [/\bgnu c\b|\bc\d\d\b|\bgcc\b|\bclang\b|^c$/i, 'C'],
];

// 没有对上任何一条规则的语言：去掉末尾的版本号和括号里的说明，其余原样保留。
export function languageFamily(name) {
  const text = String(name ?? '').trim();
  if (!text) return 'Unknown';
  for (const [pattern, family] of FAMILIES) if (pattern.test(text)) return family;
  return (
    text
      .replace(/\s*\(.*\)\s*$/, '')
      .replace(/\s+[\d.]+$/, '')
      .trim() || text
  );
}
