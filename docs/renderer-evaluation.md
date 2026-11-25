# M2 渲染方案验证记录

> 日期：2026-11-24 · 执行：M2 spike（REQUIREMENTS §7-M2、§4.2 四项前提）
> 结论：**方案 A（flyfish-dev/file-viewer）可行，选型定稿**。四个前提全部通过。

## 1. 选型：按格式分包（非 web-full）

`@file-viewer/web-full`（275 格式全家桶）被否决，改用**最小包组合**（REQUIREMENTS §4.2-2 的"按格式分包"成立）：

| 包 | 版本 | License | 用途 |
|----|------|---------|------|
| `@file-viewer/core` | 3.3.6 | Apache-2.0 | 框架核心 + `mountViewer`（`core/browser` 入口） |
| `@file-viewer/renderer-word` | 3.3.6 | Apache-2.0 | `.doc/.dot`（legacy 引擎 `@file-viewer/doc`，MIT） |
| `@file-viewer/renderer-spreadsheet` | 3.3.6 | Apache-2.0 | `.xls/.xlt`（BIFF，e-virt-table 网格） |
| `@file-viewer/renderer-presentation` | 3.3.6 | Apache-2.0 | `.ppt/.pot`（binary 渲染器） |

- `preset-office` 不用（会拖入 PDF/OFD/iWork/Hangul/WordPerfect 无关渲染器）。
- OOXML 引擎（`@file-viewer/docx` 等）会被动态 import 打进 bundle 但**不在支持格式的执行路径上**（死重，接受；见 §4 残余风险 3）。
- React 适配层（`@file-viewer/react`）不用——直接用 `mountViewer(container, options, coreOptions)`，由插件自管生命周期。

## 2. 四项前提验证结果（REQUIREMENTS §4.2）

### 2.1 单文件打包可行性 ✅

esbuild bundle（`--format=esm`、`splitting: false`、external 六项 react 系）产物为**单文件 ESM**：

- 打包无报错、无未解析的动态 chunk；
- 产物内残余 1 处运行时动态 `import()` 与 5 处 `import.meta.url`，全部位于 **pptx（OOXML）worker 加载逻辑**（`resolvePptxWorkerUrl` 等），且解析失败有 try/catch 降级。这些路径只对 `.pptx` 执行，本插件不覆盖 `.pptx`，不影响 `.doc/.xls/.ppt`。

### 2.2 体积 ✅

- **实测 5247.6 KB（5.1 MB）**，低于 8 MB 目标（REQUIREMENTS §5.5）。
- 解包体积参考：core 2.66 MB、renderer-spreadsheet 1.38 MB、doc 0.40 MB、renderer-word 0.12 MB、docx（死重）3.17 MB、ppt/pptx 各 ~46 KB。

### 2.3 DOM 挂载兼容性 ✅（真浏览器冒烟）

- `styleIsolation` 支持 `'auto' | 'shadow' | 'scoped' | 'none'`；**默认 auto 即挂载到容器自身的 open ShadowRoot**，宿主样式与渲染内容双向隔离（无需额外 Shadow DOM 封装）。
- 冒烟环境：Edge + 本地静态服务，`mountViewer` → 状态 `loading → ready`，ShadowRoot 内出现 `.file-viewer-web-shell`、中文工具栏（locale `zh-CN` 生效）、spreadsheet 网格（`.excel-wrapper[data-file-viewer-spreadsheet-root]`）。
- 用 SheetJS 生成真实 BIFF8 `.xls`（3584 B，3 行 3 列）渲染成功，表格内容、sheet 标签、页脚统计（共 3 行， 3 列）均正确。截图：`docs/m2-smoke-rendered.png`。

### 2.4 离线零网络请求 ✅（真浏览器冒烟）

- 8 秒观察窗口内 `fetch`/`XMLHttpRequest` 拦截记录为 **0**（harness 挂钩全局 fetch/XHR）。
- bundle 内绝对 URL 全部为 OOXML **命名空间常量**（`schemas.microsoft.com`、`purl.oclc.org` 等字符串，非网络请求）。
- 页面错误数 0。

## 3. Worker/WASM 使用情况

| 包 | 扫描结果 | 对支持格式的影响 |
|----|----------|------------------|
| `doc`（.doc 引擎） | 1 处 `new Worker`（`new URL('./worker.js', import.meta.url)`） | **无影响**：`renderer-word` 的 `.doc` 路径走主线程 `parseMsDocToHtml`，`MsDocWorkerClient` 是未被调用的可选导出 |
| `renderer-spreadsheet` | 2 处 `new Worker` | Worker 创建失败时**显式回退主线程解析**（console.warn），Blob URL 环境下预期走回退分支 |
| `renderer-ppt` | 无 Worker；"wasm" 仅为统计字段名（误报） | 无影响 |
| `@file-viewer/docx` / pptx worker | 有 Worker + 动态 import | 不在本插件执行路径（.docx/.pptx 不覆盖） |

## 4. 残余风险（带入 M3/M5 跟踪）

1. **大文件主线程解析**：`.xls` Worker 回退后主线程解析可能卡顿；已有 50 MB 上限与加载态缓解，M5 用真实大文件验证。
2. **`.doc`/`.ppt` 无真机样例**：本次冒烟只有 `.xls`（可程序化生成 BIFF）。`.doc/.ppt` 需在 M4/M5 用真实/构造文件验证；解析失败路径（损坏/伪装文件）的降级卡片已实现。
3. **bundle 死重**：docx 引擎（约 3.1 MB 源码，打包后占部分体积）被打进产物但不执行。若未来体积超标，可尝试把 `renderer-word` 内部 `./wordDocx.js` 等子模块 external（有 Blob URL 运行时风险），或等上游提供 tree-shaking 友好入口。当前 5.1 MB 达标，不动。
4. **禁用下载按钮**：viewer 工具栏含"下载"按钮（导出原文件）。只读边界不受影响（不写库内文件），但若产品上不希望出现，M3 可用 `toolbar` 配置裁剪（待定，默认保留）。

## 5. M5 宿主实测发现与修复（2026-11-24）

### 5.1 `.ppt` 预览失败：`Failed to construct 'URL': Invalid URL` ✅ 已修复

**根因**：`@file-viewer/ppt` 引擎默认 `worker: 'auto'`，创建 Worker 时执行
`new Worker(url ?? new URL('./pptjs.worker.js', import.meta.url))`（`worker-client.js:12`）。
esbuild 打包进插件单文件后，`import.meta.url` = 插件自身的 Blob URL
（`blob:http://...`，URL 规范中 blob: 为不透明路径，不能作为相对解析的 base），
`new URL` 构造即抛错。`.doc/.xls` 渲染路径不触碰该代码，故正常。

**修复**：挂载选项传入 `presentation: { pptWorker: false }`——引擎公开的类型化选项
（`FileViewerPresentationOptions.pptWorker`），强制走主线程解析（引擎自带的
`pptjs.browser.js`，官方支持的形态）。代价：`.ppt` 解析在主线程执行，
大文件可能短暂阻塞 UI（已有 50 MB 上限与加载态缓解）。

### 5.2 主题与宿主联动 ✅ 已实现

**背景**：viewer 主题独立（`'light' | 'dark' | 'system'`），`'system'` 只跟操作系统
`prefers-color-scheme`，与宿主应用主题无关；初始默认深色，与 GeWu 亮色主题不一致。

**机制**：
- 宿主把当前主题写在 `<html data-theme="...">`（内置 `light/dark/colorful/ocean/aurora`，
  `ThemeContext.tsx` 同步该属性）；
- 插件新增 `src/host-theme.ts`：读取属性映射（`dark → viewer dark`，其余 → `light`），
  MutationObserver 监听属性变化；
- 运行时切换：`controller.getApi()` 返回的 `FileViewerInstance.updateOptions({ theme })`
  免重挂载实时生效（viewer 工具栏的主题按钮同款机制）；
- 映射限制：GeWu 的 `colorful/ocean/aurora` 等非 dark 主题统一映射为 viewer 亮色
  （viewer 只有明暗两态，无法逐主题对齐 CSS 变量，Shadow DOM 隔离下也不应继承宿主变量）。
- 用户仍可用 viewer 工具栏按钮独立切换，切换宿主主题时会被重新同步。

## 6. 接入方式（M3 按此实现）

```js
import { mountViewer } from "@file-viewer/core/browser"
import { wordRenderer } from "@file-viewer/renderer-word"
import { spreadsheetRenderer } from "@file-viewer/renderer-spreadsheet"
import { presentationRenderer } from "@file-viewer/renderer-presentation"

const controller = mountViewer(container, {
  file: new Blob([bytes]),   // Uint8Array → Blob，避免拷贝
  filename,                  // 扩展名路由到对应渲染器
  onEvent: (e) => { /* onLoadComplete → 状态栏摘要 */ },
  options: {
    rendererMode: "replace",
    builtinRenderers: "none",
    renderers: [wordRenderer, spreadsheetRenderer, presentationRenderer],
    locale: "zh-CN",
    toolbar: true,
  },
})
// dispose: controller.destroy()
```

spike 代码保留在 `spike/`（`entry.js`/`lib.js`/`page.js`/`index.html`/`serve.mjs`），`spike/` 不进发布产物，`node_modules`/`out` 已 gitignore。
