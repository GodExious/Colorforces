<h1 align="center">Colorforces</h1>

<p align="center">
  <strong>English</strong> | <a href="docs/README_zh.md">简体中文</a>
</p>

<p align="center">
  <a href="docs/CHANGELOG.md">
    <img src="https://img.shields.io/badge/Changelog-v1.6.0-orange?style=flat-square" alt="Changelog">
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

## 🚀 Installation
1. Install a user script manager like [Tampermonkey](https://www.tampermonkey.net/) for your browser.
2. Click the link below to install the script directly:
   
   👉 **[Install Colorforces](https://github.com/GodExious/Colorforces/releases/latest/download/colorforces.user.js)**

   Before the first Release is available, use the [compatibility installer](https://raw.githubusercontent.com/GodExious/Colorforces/main/colorforces.user.js).

3. Refresh any Codeforces status page, and enjoy!

## 🛠 Building from Source

The project uses Vite and vite-plugin-monkey to build a single userscript. You need Node.js 20.x (20.19.0 or later) or Node.js 22.12.0 or later, and npm.

Run these commands from the repository root to install the locked dependencies and build:

```sh
npm ci
npm run build:release
```

This generates only `dist/colorforces.user.js`, ready to install in Tampermonkey. `dist` is ignored by Git and is not uploaded to the source branch. `npm run build` produces the same output.

For the **v1.6.0 transition release**, use:

```sh
npm run build:compat
```

This also copies the bundle to the repository root. Commit that root copy with the v1.6.0 source changes so older installations can discover the transition version at their existing address. Its `@updateURL` and `@downloadURL` already point to the latest Release asset. Do not commit `dist`.

Keep this root v1.6.0 copy unchanged for users who have not upgraded yet. Later builds belong only in Release assets; do not refresh the root copy. The plugin checks the latest Release first and falls back to the root script if no valid version is available. It does not request the former `dist` address or offer a downgrade. Tampermonkey's own updater uses the single declared `@updateURL`.

Rebuild after changing the source; do not edit generated scripts manually. These commands do not commit or publish anything.

### Publishing a Release

1. Update `package.json` and the existing Chinese and English changelogs. Commit and push the source changes, including `.github/workflows/release.yml`; for the first v1.6.0 release, include the compatibility copy described above.
2. Ensure GitHub Actions is enabled, then tag the committed version and push the tag. For this release:

   ```sh
   git tag v1.6.0
   git push origin v1.6.0
   ```

3. The workflow installs locked dependencies on Node.js 24, checks formatting, builds the userscript, and verifies that the tag, package version, script metadata, and bilingual changelog agree. It uploads `colorforces.user.js` to a draft Release, then publishes it as the latest release. No separate personal access token is needed; the workflow uses `GITHUB_TOKEN` with `contents: write`.
4. Confirm that the **发布 Colorforces** workflow succeeds and the Release contains `colorforces.user.js`. The draft can be retried after an upload failure. An already published tag is not overwritten; publish a new version instead.

The workflow currently accepts stable `vX.Y.Z` tags only. Publishing from GitHub's Release editor first is unnecessary; push the tag and let the workflow create the Release. For subsequent versions, use the corresponding new tag and leave the root compatibility copy untouched.

## 💡 Feedback & Contributions
If you have any suggestions, feature requests, or find any bugs, please feel free to open an [Issue](https://github.com/GodExious/Colorforces/issues) in this repository! Contributions and Pull Requests are always welcome.

## 👏 Acknowledgments
This plugin was mainly inspired by [Codeforces-Helper](https://chromewebstore.google.com/detail/codeforces-helper/ahoeafmlmoohkkalcickdnkifpfnolpj). However, since that extension does not support displaying problem ratings on the `status` page, I had an AI (Antigravity 2.5.5) help me write and implement this project.

## 📄 License
Released under the [MIT License](LICENSE).
