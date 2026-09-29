import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import monkey from 'vite-plugin-monkey';
import userscript from './userscript.config.js';

// 从字体唯一授权文件生成产物声明，确保单独分发 user.js 时仍携带完整版权信息。
const fontLicense = readFileSync(
  new URL('./src/assets/fonts/kaushan-script/OFL.txt', import.meta.url),
  'utf8',
);

// 将按需打包的图表依赖声明随单文件成品分发，不依赖 node_modules 留在用户电脑中。
const chartLicenses = ['echarts/NOTICE', 'echarts/LICENSE', 'zrender/LICENSE', 'tslib/LICENSE.txt']
  .map(
    (file) =>
      `${file}:\n${readFileSync(new URL(`./node_modules/${file}`, import.meta.url), 'utf8').trim()}`,
  )
  .join('\n\n');

// 由单一构建链编译 Vue、内联资源并生成可直接安装的脚本。
export default defineConfig({
  define: { __CF_VERSION__: JSON.stringify(userscript.version) },
  build: {
    minify: false,
    sourcemap: false,
    assetsInlineLimit: Infinity,
    rolldownOptions: {
      output: {
        banner: `/*!
Bundled font: Kaushan Script (unmodified file from @fontsource/kaushan-script@5.0.18).
The following license applies to the font, not the plugin code.

${fontLicense.trim()}

Bundled chart dependencies (licenses apply to the respective libraries):
${chartLicenses}
*/`,
      },
    },
  },
  plugins: [
    vue(),
    monkey({
      entry: 'src/main.js',
      userscript,
      server: { open: false },
      build: { fileName: 'colorforces.user.js', metaFileName: false, autoGrant: false },
    }),
  ],
});
