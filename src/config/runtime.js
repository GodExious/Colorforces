// 优先使用油猴已安装版本，开发环境回退到构建版本。
export const CURRENT_VERSION =
  typeof GM_info !== 'undefined' && GM_info && GM_info.script && GM_info.script.version
    ? GM_info.script.version
    : __CF_VERSION__;
