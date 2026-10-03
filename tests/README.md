# 单元测试

只测不依赖浏览器的纯逻辑模块，使用 Node 自带的测试运行器，不引入额外依赖。

```sh
npm test
```

## 目录约定

- 目录结构与 `src/` 对应：`src/utils/time.js` 的测试是 `tests/utils/time.test.js`。
- 测试文件以 `.test.js` 结尾，运行器据此自动发现。
- `helpers/` 放多个测试共用的数据与工具，不以 `.test.js` 结尾。

## 当前覆盖

`features/contest/rating-prediction/algorithm/` 下：

- `fft.js`：卷积结果、容量与空输入。
- `calculator.js`：输入校验、并列名次、预期名次、涨跌分性质、表现分。
- `analysis.js`：完整结算、按名次与按评级分析、错误码。
- `curve.js`：取样名次、取样点整理、按曲线估算评级与名次，以及取样曲线与精确结果的一致性。
- `ranks.js`：档位边界、晋级判断。

`features/page/` 下：

- `theme.js`：深浅色判断在同一段同步代码里只做一次，之后重新判断。测试里用假对象顶替页面。

`utils/` 下：

- `utils/time.js`：时间格式占位符、时区标注。
- `utils/problem.js`：题号排序、标题清理、链接解析。
- `utils/row-toggle.js`：设置行整行点击。
- `utils/backdrop.js`：点遮罩关闭弹窗，按下与松开不在同一处时不关闭。
- `utils/petal-palette.js`：页签在花瓣色环上的位置与取色；并核对十个页签图标里写的颜色与取色结果一致，增删页签或调整顺序后会指出该改成什么颜色。

`storage/` 下：

- `storage/runtime.js`：插件数据的合并、迁移、按字段读写与清空。测试里用一张表顶替油猴存储。

`ui/pages/changelog/` 下：

- `data.js`：各版本的时间戳齐全、从新到旧排列，并与行尾注释里的北京时间一致。

`styles/` 下：

- `tokens.css`：检查 `src/ui/` 的组件是否绕过设计变量直接写灰阶色值，或直接写等于变量数值的字号、圆角、字重；并检查引用的变量都已定义。

## 不在范围内

- 依赖页面 DOM、油猴接口或网络的模块。
- Vue 组件与视觉效果，由人工在浏览器中验收。
