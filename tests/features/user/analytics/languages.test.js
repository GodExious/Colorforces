import test from 'node:test';
import assert from 'node:assert/strict';
import { languageFamily } from '../../../../src/features/user/analytics/languages.js';

test('同一种语言的不同版本和编译器并成一种', () => {
  const cases = {
    'GNU C++17': 'C++',
    'C++20 (GCC 13-64)': 'C++',
    'C++23 (GCC 14-64, msys2)': 'C++',
    'Clang++17 Diagnostics': 'C++',
    'MS C++ 2017': 'C++',
    'GNU C11': 'C',
    'Python 3': 'Python',
    'PyPy 3-64': 'Python',
    'Java 21': 'Java',
    JavaScript: 'JavaScript',
    'Node.js': 'JavaScript',
    'Kotlin 1.9': 'Kotlin',
    'Rust 2021': 'Rust',
    Go: 'Go',
    'C# 10': 'C#',
    'Mono C#': 'C#',
    '.NET Core C#': 'C#',
    'F# 9': 'F#',
    'PascalABC.NET': 'Pascal',
    'Delphi 7': 'Delphi',
    FPC: 'Pascal',
    D: 'D',
    'Haskell GHC 8.10.1': 'Haskell',
  };
  for (const [name, family] of Object.entries(cases)) assert.equal(languageFamily(name), family);
});

test('认不出的语言去掉版本号和括号说明后原样保留，空名称记为 Unknown', () => {
  assert.equal(languageFamily('Picat 3'), 'Picat');
  assert.equal(languageFamily('Secret 2021'), 'Secret');
  assert.equal(languageFamily('Mysterious Language'), 'Mysterious Language');
  assert.equal(languageFamily('Tcl (8.6)'), 'Tcl');
  assert.equal(languageFamily(''), 'Unknown');
  assert.equal(languageFamily(undefined), 'Unknown');
});
