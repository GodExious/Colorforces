<h1 align="center">Colorforces</h1>

<p align="center">
  <a href="../README.md">English</a> | <strong>简体中文</strong>
</p>

<p align="center">
  <a href="CHANGELOG_zh.md">
    <img src="https://img.shields.io/badge/更新日志-v1.6.0-orange?style=flat-square" alt="Changelog">
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
> 本项目由原 **[CF-Submissions-Ratings](https://github.com/GodExious/CF-Submissions-Ratings)** 迁移而来。
> 
> 由于当前的开发方向与最初仅为了显示 Ratings 的目的已相差甚远，我们将项目正式更名为 **Colorforces**，并在此开启全新的篇章。

重塑 Codeforces 视觉体验的新一代增强插件。通过动态的评分色彩、现代化的标签引擎和极高自由度的定制面板，为你的算法竞赛之旅注入全新的生命力。

## 📸 效果预览
<p align="center">
  <img src="../imgs/problem-tags.png" alt="Problem Tags" width="800">
  <br>
  <em>题目页面的 Rating 颜色标签显示</em>
</p>
<p align="center">
  <img src="../imgs/status.png" alt="Status Page" width="800">
  <br>
  <em>Status 页面的分数直显与时间格式化效果</em>
</p>
<p align="center">
  <img src="../imgs/settings.png" alt="Settings Menu" width="800">
  <br>
  <em>悬浮设置面板</em>
</p>
<p align="center">
  <img src="../imgs/submissions.png" alt="Submissions Page" width="800">
  <br>
  <em>完美兼容个人 Submissions 记录自带的背景高亮</em>
</p>
<p align="center">
  <img src="../imgs/contest-problem.png" alt="Contest Problems" width="800">
  <br>
  <em>Contest 题单页面的难度分与 AC 状态展示</em>
</p>
<p align="center">
  <img src="../imgs/contest-standings.png" alt="Contest Standings" width="800">
  <br>
  <em>Contest 排名页面的难度分展示</em>
</p>
<p align="center">
  <img src="../imgs/blogs.png" alt="Blogs" width="800">
  <br>
  <em>博客内容页面的用户头像展示</em>
</p>

## 🚀 安装说明
1. 首先，在你的浏览器上安装 [Tampermonkey (油猴)](https://www.tampermonkey.net/) 脚本管理器。
2. 点击下方链接一键安装脚本：
   
   👉 **[点击安装 Colorforces](https://github.com/GodExious/Colorforces/releases/latest/download/colorforces.user.js)**

   首个 Release 发布前，可以使用[旧版兼容安装入口](https://raw.githubusercontent.com/GodExious/Colorforces/main/colorforces.user.js)。

   > *注：也可以按下方指南本地构建，将生成的 `dist/colorforces.user.js` 安装到油猴。*

3. 打开或刷新 Codeforces 的任意 Status 页面，享受难度直显带来的刷题快感！

## 🛠 开发者构建指南

项目使用 Vite 和 vite-plugin-monkey 构建为单个油猴脚本。环境要求：Node.js 20.x（≥20.19.0）或 ≥22.12.0，以及 npm。

在项目根目录执行以下命令，安装锁定版本的依赖并构建：

```sh
npm ci
npm run build:release
```

此命令只生成 `dist/colorforces.user.js`，可直接安装到油猴。`dist` 是本地和 CI 的构建目录，已被 Git 忽略，不上传到源码分支。`npm run build` 的输出相同。

**当前 v1.6.0 过渡版本**请使用：

```sh
npm run build:compat
```

此命令还会将产物复制到根目录。将根目录副本与本次 v1.6.0 源码改动一起提交，让旧版用户能通过原地址发现过渡版本。该脚本中的 `@updateURL` 和 `@downloadURL` 都已指向最新 Release 附件；不要提交 `dist`。

后续版本的成品仅放在 Release 附件中，根目录的 v1.6.0 副本原样保留，供尚未升级的用户过渡，不再随版本更新。插件内置更新检测优先读取最新 Release，无法获得有效版本时才回退到根目录，不再请求旧 `dist` 地址，也不会提示降级。油猴自身的更新检测只使用声明的单个 `@updateURL`。

修改源码后请重新构建，不要手动修改生成的脚本。上述命令不会提交或发布。

### 发布 Release

1. 更新 `package.json` 的版本号，以及菜单和文档中的中英文更新日志；提交并推送源码和发布工作流。首个 v1.6.0 Release 还需提交前述根目录兼容副本。
2. 在准备发布的提交上创建并推送同名版本标签：

   ```sh
   git tag v1.6.0
   git push origin v1.6.0
   ```

3. 工作流使用 Node.js 24 安装锁定依赖、检查格式、构建脚本，校验标签、包版本、脚本元数据及双语日志，并将 `colorforces.user.js` 上传到草稿 Release，上传成功后才正式发布为最新版。使用具有 `contents: write` 权限的 `GITHUB_TOKEN`，无需另配个人令牌。
4. 确认 **发布 Colorforces** 工作流成功，且 Release 中包含 `colorforces.user.js`。上传失败时可重跑工作流继续处理草稿；已正式发布的标签不会被覆盖，应递增版本后重新发布。

目前仅支持正式版 `vX.Y.Z` 标签，无需先在 GitHub 手动创建 Release。后续发布替换为相应的新版本标签，并保持根目录兼容副本不变。

## 💡 意见与反馈
如果你对本插件有任何好点子、改进建议，或者发现了 Bug，非常欢迎到 [GitHub Issues](https://github.com/GodExious/Colorforces/issues) 中提出反馈与讨论！也随时欢迎提交 Pull Requests。

## 👏 致谢
本插件主要受到 [Codeforces-Helper](https://chromewebstore.google.com/detail/codeforces-helper/ahoeafmlmoohkkalcickdnkifpfnolpj) 的启发。由于该插件不支持在 `status` 页面展示题目分数，因此我让 AI (Antigravity 2.5.5) 帮我仿写并实现了本项目。

## 📄 License
本项目基于 [MIT License](../LICENSE) 协议开源。
