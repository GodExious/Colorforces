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
- `analysis.js`：完整结算、按名次与按评级分析、错误码、精算表现分。
- `ranks.js`：档位边界、晋级判断。

`utils/` 下：

- `utils/time.js`：时间格式占位符。
- `utils/problem.js`：题号排序、标题清理、链接解析。
- `utils/row-toggle.js`：设置行整行点击。

## 不在范围内

- 依赖页面 DOM、油猴接口或网络的模块。
- Vue 组件与视觉效果，由人工在浏览器中验收。
