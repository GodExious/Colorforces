<h1 align="center">Colorforces</h1>

<p align="center">
  <strong>English</strong> | <a href="docs/README_zh.md">简体中文</a>
</p>

<p align="center">
  <a href="docs/CHANGELOG.md">
    <img src="https://img.shields.io/badge/Changelog-v1.5.5-orange?style=flat-square" alt="Changelog">
  </a>
  <a href="https://github.com/GodExious/Colorforces/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/GodExious/Colorforces?style=flat-square&color=blue" alt="License">
  </a>
  <a href="https://www.tampermonkey.net/">
    <img src="https://img.shields.io/badge/Userscript-Tampermonkey-green?style=flat-square" alt="Tampermonkey">
  </a>
</p>

> [!NOTE]  
> 
> This project is migrated from **[CF-Submissions-Ratings](https://github.com/GodExious/CF-Submissions-Ratings)**. 
> 
> Because our development focus has evolved significantly beyond simply showing ratings, we rebranded and moved the project here to start a new chapter as **Colorforces**.

Reimagining the Codeforces UI. A next-generation userscript that breathes life into your competitive programming experience with dynamic rating colors, modern badges, and a premium, highly customizable interface.

## 📸 Screenshots
<p align="center">
  <img src="imgs/problem-tags.png" alt="Problem Tags" width="800">
  <br>
  <em>Added problem rating color display to problem tags</em>
</p>
<p align="center">
  <img src="imgs/status.png" alt="Status Page" width="800">
  <br>
  <em>Direct rating display and optimized time formatting on the Status page</em>
</p>
<p align="center">
  <img src="imgs/settings.png" alt="Settings Menu" width="800">
  <br>
  <em>Floating settings panel</em>
</p>
<p align="center">
  <img src="imgs/submissions.png" alt="Submissions Page" width="800">
  <br>
  <em>Seamless integration with your highlighted rows on the Submissions page</em>
</p>
<p align="center">
  <img src="imgs/contest-problem.png" alt="Contest Problems" width="800">
  <br>
  <em>Optimized difficulty rating and AC status display on the Contest problem list</em>
</p>
<p align="center">
  <img src="imgs/contest-standings.png" alt="Contest Standings" width="800">
  <br>
  <em>Difficulty rating display on the Contest standings page</em>
</p>
<p align="center">
  <img src="imgs/blogs.png" alt="Blogs" width="800">
  <br>
  <em>User avatar display on the Blogs content page</em>
</p>

## ✨ Features
- **🧠 Global Rating Display**: Seamlessly injects problem difficulty ratings into Submissions, Status, Problemsets, and Standings. Supports switching between "Classic Block" and "Premium Tag" UI styles.
- **🎨 UI Revitalization**: Automatically fetches and displays user avatars and dedicated programming language icons (e.g., C++, Python, Go), featuring minimalist verdict abbreviations (e.g., `WA`, `TLE`).
- **⚙️ Omnipotent Control Panel**: Floating bilingual (EN/ZH) settings hub. Fully customize toggle zones, time formatting, icon scaling, and your personalized AC background color.
- **⚡ Zero Performance Overhead**: Powered by official Codeforces APIs with an aggressive local caching strategy. Updates silently once a day to ensure blazing-fast page loads.

## 🚀 Installation
1. Install a user script manager like [Tampermonkey](https://www.tampermonkey.net/) for your browser.
2. Click the link below to install the script directly:
   
   👉 **[Install Colorforces](https://raw.githubusercontent.com/GodExious/Colorforces/main/colorforces.user.js)**

3. Refresh any Codeforces status page, and enjoy!

## 💡 Feedback & Contributions
If you have any suggestions, feature requests, or find any bugs, please feel free to open an [Issue](https://github.com/GodExious/Colorforces/issues) in this repository! Contributions and Pull Requests are always welcome.

## 👏 Acknowledgments
This plugin was mainly inspired by [Codeforces-Helper](https://chromewebstore.google.com/detail/codeforces-helper/ahoeafmlmoohkkalcickdnkifpfnolpj). However, since that extension does not support displaying problem ratings on the `status` page, I had an AI (Antigravity 1.23.2) help me write and implement this project.

## 📄 License
Released under the [MIT License](LICENSE).
