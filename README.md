<h1 align="center"><img src="src/assets/icons/brands/colorforces.svg" width="44" height="44" alt=""> Colorforces</h1>

<p align="center">
  <strong>English</strong> | <a href="docs/README_zh.md">简体中文</a>
</p>

<p align="center">
  <a href="docs/CHANGELOG.md">
    <img src="https://img.shields.io/badge/Version-1.6.0-d77c9d?style=flat&amp;logo=github&amp;logoColor=white&amp;labelColor=343b49" height="22" alt="Version 1.6.0">
  </a>
  <a href="https://github.com/GodExious/Colorforces/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-c5ab77?style=flat&amp;logo=opensourceinitiative&amp;logoColor=white&amp;labelColor=343b49" height="22" alt="MIT License">
  </a>
  <a href="https://www.tampermonkey.net/">
    <img src="https://img.shields.io/badge/Tampermonkey-Userscript-78ac98?style=flat&amp;logo=tampermonkey&amp;logoColor=white&amp;labelColor=343b49" height="22" alt="Tampermonkey userscript">
  </a>
  <a href="https://codeforces.com/">
    <img src="https://img.shields.io/badge/Codeforces-Enhancement-709dc6?style=flat&amp;logo=codeforces&amp;logoColor=white&amp;labelColor=343b49" height="22" alt="Codeforces">
  </a>
</p>

Colorforces is a userscript that makes Codeforces problem ratings, submissions, and user information easier to read and customize. The primary target environment is **Chrome + Tampermonkey**.

> Previously [CF-Submissions-Ratings](https://github.com/GodExious/CF-Submissions-Ratings), renamed as its scope expanded beyond problem ratings.

## 📸 Screenshots

<p align="center">
  <img src="imgs/settings.png" alt="Colorforces v1.6.0 settings on Codeforces">
  <br>
  <em>Settings menu in English and Chinese</em>
</p>
<p align="center">
  <img src="imgs/problem-tags.png" alt="Problem Tags">
  <br>
  <em>Added problem rating color display to problem tags</em>
</p>
<p align="center">
  <img src="imgs/status.png" alt="Status Page">
  <br>
  <em>CF and CList ratings in block and tag styles (selected real submissions)</em>
</p>
<p align="center">
  <img src="imgs/submissions.png" alt="Submissions Page">
  <br>
  <em>Seamless integration with your highlighted rows on the Submissions page</em>
</p>
<p align="center">
  <img src="imgs/contest-problem.png" alt="Contest Problems">
  <br>
  <em>Optimized difficulty rating and AC status display on the Contest problem list</em>
</p>
<p align="center">
  <img src="imgs/contest-standings.png" alt="Contest Standings">
  <br>
  <em>Difficulty rating display on the Contest standings page</em>
</p>
<p align="center">
  <img src="imgs/blogs.png" alt="Blogs">
  <br>
  <em>User avatar display on the Blogs content page</em>
</p>

## 🚀 Installation

1. Install a user script manager like [Tampermonkey](https://www.tampermonkey.net/) for your browser.
2. Click the link below to install the script directly:

   👉 **[Install Colorforces](https://github.com/GodExious/Colorforces/releases/latest/download/colorforces.user.js)**

   Before the first Release is available, use the [compatibility installer](https://raw.githubusercontent.com/GodExious/Colorforces/main/colorforces.user.js).

3. Open or refresh a Codeforces page. Click the flower button near the upper-right corner to open settings.

## Build from Source

Requires Node.js 20.x (20.19.0 or later) or 22.12.0 or later, and npm.

```sh
npm ci
npm run build
```

Install the generated `dist/colorforces.user.js` in Tampermonkey. For the v1.6.0 root compatibility copy, use `npm run build:compat`.

## 💡 Feedback

If you have any suggestions, feature requests, or find any bugs, please feel free to open an [Issue](https://github.com/GodExious/Colorforces/issues) in this repository! Contributions and Pull Requests are always welcome.

## 👏 Acknowledgments

- [Codeforces-Helper](https://chromewebstore.google.com/detail/codeforces-helper/ahoeafmlmoohkkalcickdnkifpfnolpj): the original inspiration for this project.
- [CList](https://clist.by/): the additional problem-rating data source.
- [OJ Better](https://github.com/beijixiaohu/OJBetter): inspiration for page-enhancement features.
- [Carrot-Plus](https://github.com/wuyuqian114514/carrot-plus): a reference for planned rating-change prediction.
- **CF Analytics Pro Max** ([browser extension](https://chromewebstore.google.com/detail/codeforces-analytics-pro/gfoledimnmjchddncmedpcieiccnagcj) · [userscript](https://greasyfork.org/zh-CN/scripts/465176-cf%E8%A7%A3%E9%A2%98%E6%95%B0%E6%8D%AE%E5%8F%AF%E8%A7%86%E5%8C%96-pro-max)): Colorforces plans to offer similar built-in data analytics in future versions.

## 📄 License

Released under the [MIT License](LICENSE).
