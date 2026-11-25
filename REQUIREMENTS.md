# plugin-office-viewer 开发需求说明

> 版本：v1.0（2026-11-24）
> 目标读者：执行本需求的代码助手
> 宿主：GeWu（格物）0.39.x beta（Tauri 2 + React 18）
> 仓库位置：`E:\GeWu\plugin-office-viewer`（**独立 git 仓库**，不得嵌套进 `MyProj`，不得提交到主仓库）
> 参考实现：`E:\GeWu\plugin-srt-viewer`（同为独立第三方 viewer 插件，结构与约束最接近本插件）

---

## 1. 目标与非目标

### 1.1 目标

实现一个**只读文件查看器插件**，让 GeWu 可以打开并渲染旧版 Office 二进制格式：

| 格式 | 说明 | 渲染目标 |
|------|------|----------|
| `.doc` | Word 97-2003 二进制 | 结构化预览（标题/段落/表格/列表；不承诺排版级保真） |
| `.xls` | Excel 97-2003 二进制（BIFF） | 工作表网格预览（单元格值取文件保存时的缓存公式结果） |
| `.ppt` | PowerPoint 97-2003 二进制 | 幻灯片逐页预览（字体/特效允许与 PowerPoint 有差异） |

> OOXML（`.docx/.xlsx/.pptx`）由宿主内置支持，**本插件不覆盖**（用户确认，2026-11-24）。

配套旧扩展名一并声明：`.dot`、`.xlt`、`.pot`（模板类，按同族格式渲染）。

### 1.2 非目标

- **不做 OOXML**：`.docx/.xlsx/.pptx` 由宿主内置查看器支持，本插件不声明这些扩展名（用户确认，2026-11-24）。
- **不写文件**：不保存、不转换格式、不导出（导出是未来独立需求）。
- **不执行宏/VBA**：任何渲染方案都必须禁止宏执行（所选参考库本身已保证）。
- **不做编辑器**：不注册保存、不产生脏状态、不接收 `ai:rewrite-apply`。
- **不做常驻面板**：不进 slot/overlay/statusbar 常驻；仅作为文件类型处理器。
- **不做 MIME 嗅探路由**：路由只依赖扩展名（宿主 v1 只按扩展名路由，spec §2 明确非目标）。
- **不联网**：渲染库若需字体/资源必须自托管打进插件包，运行时不发起任何网络请求。

---

## 2. 宿主契约（已核实，2026-11-24 @ 0.39.x 源码）

### 2.1 兼容性基线

- 仅需兼容最新宿主 0.39.x：`manifest.json` 中 `minAppVersion: "0.39.0"`。
- **不需要**兼容 0.30.0（即不必自带 `createMultiInstanceFilter` 的兼容实现，可直接从 `plugin-protocol` import 运行时函数——0.30.0 之后的加载器已提供运行时代理）。
- 版本兼容说明写在 README 的「兼容性」一节，并依赖安装时宿主已有的 `minAppVersion` 检查（`satisfiesMinAppVersion` 已实现，不满足时安装确认页禁用安装），无需插件自做版本检查。

### 2.2 ⚠️ 契约现状与双写策略（重要）

**`documentTypes` / `role: viewer` 是 0.37 目标契约（`MyProj/docs/design/plugin-types-spec.md`，已评审），但宿主代码尚未实现**（已在 `packages/` 全量搜索 `documentTypes`，0 命中；spec 末尾进度注记亦确认「宿主 documentTypes 宿主实现尚未开始」）。

因此 manifest 采用**双写**策略（依据 spec §4.3 兼容映射）：

```ts
// src/index.tsx 中的运行时 manifest（JS 导出，运行时能力来源）
const manifest: PluginManifest = {
  id: "plugin-office-viewer",
  // ...
  handles: ["file:open"],
  // 旧契约（当前宿主实际消费）：isEditor: true 是宿主路由 + 内容预载的前提，
  // 即使插件只读也必须如此（与 plugin-srt-viewer 同做法）；语义上本插件是 viewer。
  isEditor: true,
  preferredExtensions: [".doc", ".xls", ".ppt", ".dot", ".xlt", ".pot"],
  // 新契约（未来宿主落地后自动生效；spec 规定新旧并存时以 documentTypes 为准）
  documentTypes: [
    { extensions: [".doc", ".dot"], role: "viewer", binary: true, maxFileSize: 50_000_000, label: "Word 97-2003 文档" },
    { extensions: [".xls", ".xlt"], role: "viewer", binary: true, maxFileSize: 50_000_000, label: "Excel 97-2003 工作簿" },
    { extensions: [".ppt", ".pot"], role: "viewer", binary: true, maxFileSize: 100_000_000, label: "PowerPoint 97-2003 演示文稿" },
  ],
  // isEditor: true 的旧语义含编辑器含义（spec §4.3 会映射为 role: editor），
  // 新契约落地后以 documentTypes 的 role: viewer 为准 —— 此差异已列入 §10 主项目反馈。
}
```

**执行要求**：`documentTypes` 类型定义不在当前 `plugin-protocol` tarball 里。在 SDK tarball 更新前，插件内部自带 `documentTypes`/`DocumentTypeContribution` 的**类型声明**（照抄 spec §4.2，放在 `src/host-contract.ts`，标注来源与日期），仅作类型使用；宿主实际路由仍走旧字段。**不要**为了通过类型检查去修改 `MyProj`。

### 2.3 manifest.json（分发元数据）

```json
{
  "id": "plugin-office-viewer",
  "name": "旧版 Office 查看器",
  "version": "0.1.0",
  "description": "查看 Word/Excel/PowerPoint 97-2003 旧版二进制文档（.doc/.xls/.ppt），只读预览",
  "author": "<填写>",
  "repository": "https://github.com/li360/plugin-office-viewer",
  "minAppVersion": "0.39.0",
  "capabilities": ["kmgr:read"],
  "emits": ["office-viewer:status"],
  "handles": ["file:open"]
}
```

- `id` 必须 `plugin-` 前缀 + 小写字母/数字/连字符；manifest.json 与源码 `PluginManifest.id` 必须一致（宿主校验，违反即加载失败）。
- `capabilities: ["kmgr:read"]`：声明即可注入 `ctx.kmgr`（当前宿主按 capabilities 门控 kmgr/pluginData 注入）。capabilities 仅是声明校验、不是安全边界（D-004），本插件自律不调用任何 Tauri `invoke`。

### 2.4 `file:open` 载荷与内容获取（已核实 `ui-framework/src/fileReader.ts`）

```ts
{
  path: string
  name: string
  ext: string                    // 小写，如 ".doc"
  content?: string | Uint8Array  // 宿主预载
  isTauri?: boolean
  __targetContainer?: string     // 多实例路由标记
}
```

**关键事实**：宿主文本扩展名白名单（`TEXT_EXTENSIONS`）不含 `.doc/.xls/.ppt`，因此这些文件会被按**二进制**路径读取，预载 `content` 为 `Uint8Array`。据此：

1. **优先使用预载 `content`**（当 `content instanceof Uint8Array` 时直接用，避免二次 IPC 读盘）。
2. **回退**：`content` 缺失或类型不符时，用 `ctx.kmgr.readFileBytes(path)` 自行读取（`kmgr-api` 已有该方法，对应 IPC `read_file_bytes`）。
3. 若 `content` 是 `string`（理论上不该发生）：按损坏文件处理，走 §5.4 降级链，不要尝试把字符串当二进制解析。

### 2.5 必须遵守的宿主硬约束（违反必崩，逐条已核实）

1. esbuild 打包 **external**：`react`、`react-dom`、`react/jsx-runtime`、`plugin-protocol`、`kmgr-api`、`workspace`。否则双 React 实例，hooks 全失效。
2. 产物 `dist/index.js` 为 **ESM 单文件**，`export default` 导出 PluginManifest。
3. 订阅 `file:open` 必须用 `createMultiInstanceFilter(containerId)` 过滤（多实例契约；`containerId` 进 useEffect 依赖）。参考 `plugin-srt-viewer/src` 的用法。
4. 主题 stylesheet（如未来加）只能是插件目录内相对路径——本插件 v1 不做主题，不涉及。
5. 不直接 `invoke` 任何 Tauri 命令；一切宿主能力走 `PluginContext`。
6. 路由是旧契约（`isEditor` + `preferredExtensions` + `EventLink`），渲染点为主视图容器（编辑器容器 c4 一类）；**不要**假设 `documentTypes` 路由已生效。
7. 外部插件经 Blob URL `import()` 加载并与主程序同 realm：**产物必须是自包含单文件**。禁止依赖打包器代码分割产生的动态 import chunk（Blob URL 上下文无法解析相对 chunk 路径）——渲染库必须配置为整体内联打包。

---

## 3. SDK 获取方式（plugin-sdk tarball）

不依赖 `MyProj` 源码。复用 `MyProj/scripts/export-plugin-sdk.ps1` 的产物方式：

1. 运行 `pwsh E:\GeWu\MyProj\scripts\export-plugin-sdk.ps1`，得到 `plugin-protocol-*.tgz` 与 `kmgr-api-*.tgz`，放入本仓库 `plugin-sdk/` 目录。
2. `package.json` 引用：

```json
{
  "name": "plugin-office-viewer",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "node build.mjs",
    "test": "vitest run"
  },
  "dependencies": {
    "plugin-protocol": "file:./plugin-sdk/plugin-protocol-0.1.0.tgz",
    "kmgr-api": "file:./plugin-sdk/kmgr-api-0.1.0.tgz",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "esbuild": "^0.21.0",
    "typescript": "^5.0.0",
    "@types/react": "^18.2.0",
    "vitest": "^2.0.0"
  }
}
```

3. `plugin-sdk/README.md` 注明生成脚本来源与生成日期。tarball 里的包只含类型，构建后自动剔除。

---

## 4. 参考仓库评估结论：`flyfish-dev/file-viewer`

**结论：可行，作为首选渲染方案；但有 4 个执行前提与 2 个替代方案备案。**

### 4.1 已核实的事实（2026-11-24）

- 仓库存在且活跃（约 3.0k star / 307 fork / 927 commits，持续发版至 3.3.x），官方站 file-viewer.app。
- 纯前端渲染，无服务器转换；支持 275+ 格式，含 React 适配层；内置 zh-CN 语言包。
- **旧版二进制格式为 stable（稳定级）**，非实验性：
  - `.doc` → 渲染器 `office-word-binary`，**structured（结构化）**级别，非高保真；
  - `.xls` → 与 xlsx 共用 `spreadsheet-openxml` 渲染器（容器层支持 BIFF），structured；
  - `.ppt` → 渲染器 `office-presentation-binary`，structured，宿主字体/复杂特效可能与 PowerPoint 有差异；
  - 公式结果读取保存时的缓存，不重算；宏/VBA/外部程序一律不执行。
- OOXML（docx/xlsx/pptx）为 **high-fidelity** stable。
- License：主源码 **Apache-2.0**（仅 CAD 运行时 DWG/DWF/DWFX 为 AGPL-3.0-only——本插件不用 CAD 格式，不引入该组件，无传染问题）。
- 引入方式：`npm install @file-viewer/web-full`，`mountViewer(el, { url, filename })`。

### 4.2 执行前提（代码助手必须逐项验证，失败即走 §4.3 替代方案）

1. **单文件打包可行性**：验证 `@file-viewer/web-full`（或其 Office 子集包，先探查该包是否存在更小的按格式分包，如仅 Office 渲染器的 scoped 包）能否被 esbuild 打成**无动态 import chunk** 的单 ESM 文件且与 React 18 共存。若库内部有 Worker/WASM/字体等运行时资源，确认其以 data-URI/内联方式自包含，或有官方「自托管/内联」配置。
2. **体积上限**：打包后 `index.js` 超过 **8 MB** 即视为不可接受（宿主经 `read_plugin_js` 一次性读入主 webview，体积直接影响加载与内存；`web-full` 含 275 格式大概率超标——优先找按格式的最小包）。读入上限另见 §5.5。
3. **DOM 挂载兼容性**：`mountViewer` 需要一个真实 DOM 容器。插件组件在 GeWu 容器内渲染，需验证：其注入的全局样式不污染宿主 UI（必要时用 Shadow DOM 或接受其 scoped 方案）、不与 `design-tokens` 主题变量冲突。
4. **离线无网络请求**：运行时抓包/断网验证渲染 `.doc/.xls/.ppt` 不发起任何外部请求。

### 4.3 替代方案（仅当 §4.2 失败时启用，按顺序）

| 方案 | 覆盖 | 保真度 | 说明 |
|------|------|--------|------|
| B1：分库组合 | `.xls`（SheetJS/xlsx 社区版）、`.doc`（`word-extractor`，仅文本提取）、`.ppt`（无可靠 JS 解析器，仅报错卡片+建议转换） | 低-中 | 各库均为单文件可打包；`.ppt` 明确不支持，UI 告知用户 |
| B2：最小方案 | 仅 `.xls`（SheetJS），`.doc/.ppt` 显示「暂不支持预览」指引卡片 | 低 | 渲染集成反复受阻时的兜底；保住价值最高、解析最稳的一格 |

无论 A/B 方案，`.ppt` 都是保真度最低的一环——UI 文案必须如实说明（见 §5.4）。

---

## 5. 文件类型查看器插件的通用要点（本插件逐条落实）

### 5.1 格式识别与文件关联

- **路由依据**：扩展名（小写），由宿主完成；插件通过 `preferredExtensions` 声明参与路由。
- **插件内二次校验**：扩展名匹配后，解析前校验**文件魔数**，防止"改名的错误文件"：
  - 旧版二进制 Office = OLE 复合文档（CFB）：前 8 字节 `D0 CF 11 E0 A1 B1 1A E1`；
  - ZIP 容器（`PK\x03\x04`）= 伪装成旧格式的 OOXML 或其他 ZIP 文件，本插件不支持，直接判为「内容与扩展名不符」。
  - 魔数不符时不要硬渲染，走 §5.4 降级链（「文件内容与扩展名不符」错误卡片）。
- **文件图标**：用 `fileIcons` 字段（如 `".doc": "file-text"` 等 icon-library 已有图标名）。宿主的 `documentTypes[].icon` 统一查询尚未实现，`.doc` 系列在文件列表里可能显示通用图标——已知体验缺口，不阻塞（见 §10 反馈）。
- **打开方式**：本插件不与内置查看器冲突（内置无这些扩展名的处理器；未安装任何处理器时由 `unknown-file` 兜底），无需「打开方式选择器」逻辑。

### 5.2 内容获取与生命周期

- 预载 `content`（Uint8Array）优先，回退 `ctx.kmgr.readFileBytes`（§2.4）。
- `useEffect` 订阅 `file:open`：先 `createMultiInstanceFilter(containerId)` 过滤，再按扩展名过滤，再做魔数校验，再解析渲染。解析是 CPU 密集操作，用 `requestIdleCallback`/`setTimeout` 让出主线程，期间显示加载态；支持取消（新 `file:open` 到达时丢弃旧解析结果——比较请求序号）。
- 组件卸载 / 收到新 `file:open` 时：销毁渲染库实例、释放其创建的 DOM 与事件监听（viewer 多次切换文件不得泄漏内存）。
- 只读边界：不调用 `writeTextFile`/`writeFileBytes`，不注册保存，不改动 `editor` 上下文内容。

### 5.3 渲染

- 用所选方案（§4）在容器内渲染；高度 100% 自适应容器，容器滚动。
- 渲染区顶部提供一条**一次性可关闭**的保真度提示条（文案按格式区分，见 §5.4），用 `pluginData.write("ui", {...})` 记住"不再显示"。
- Excel：支持多 sheet 切换、空 sheet/合并单元格/隐藏行列的合理展示；公式单元格显示缓存值。
- PowerPoint：逐页预览 + 页码；字体缺失时回退系统字体（不联网下载字体）。
- Word：标题层级/段落/列表/表格/图片（能提取则显示）；页眉页脚/文本框等复杂排版允许省略并在提示条中说明。

### 5.4 渲染与降级链（错误提示 UX）

按顺序降级，每级都给出**明确、可操作**的中文提示（不静默失败、不白屏）：

1. 正常渲染。
2. 渲染库解析成功但部分特性缺失 → 正常渲染 + 保真度提示条（"此为结构化预览，复杂排版/公式重算/宏不呈现"）。
3. 解析失败（魔数不符/结构损坏/密码保护文件） → 错误卡片：说明原因 + 「可能的处理方式」（如：文件可能已加密或损坏；建议在 Office 中确认可打开后另存）。
4. 文件超过上限（§5.5） → 明确提示大小与上限，不尝试部分渲染。
5. 完全不支持的子格式（如 B1 方案下的 `.ppt`） → 「该格式暂不支持预览」+ 指引（转换为 .pptx 后可预览）。
- 解析抛错必须 catch 包裹，错误写入 `workspace.logger`（经 `emit("log:entry", ...)` 或 ctx 可用途径），UI 永不抛未捕获异常。
- 状态栏（可选）：`statusBarItems` 显示「页数/工作表数/幻灯片数」等摘要（参考 srt-viewer 的做法）。

### 5.5 性能与体积

- 文件大小上限：`.doc/.xls` 50 MB、`.ppt` 100 MB（与 `documentTypes.maxFileSize` 一致）；超限走降级链第 4 级。
- 解析期间不冻结 UI：大文件解析放宏任务分片或（若方案支持）Worker。
- **产物体积**：`dist/index.js` 目标 ≤ 8 MB，硬上限 15 MB（超标即回 §4.3 换方案，并在交付说明中记录实测体积）。

### 5.6 多实例与国际化

- 多实例过滤必须做（§2.5-3）；两个容器同时打开不同 `.doc` 内容互不串扰。
- UI 文案集中在一个 `strings.ts`，中英双语键值（参考宿主 i18n 规范的键命名），v1 中文为准、英文可后补。

---

## 6. 测试与验收

### 6.1 单元测试（vitest，纯函数，参考 plugin-srt-viewer）

- 魔数校验：CFB/ZIP/错误魔数/空文件/短文件。
- 扩展名→格式族映射；`file:open` 载荷分支（Uint8Array/缺失/string）。
- 降级决策函数：各错误类型 → 对应提示文案与动作。
- 渲染库封装层 mock：解析成功/抛错/取消（请求序号丢弃旧结果）。

### 6.2 测试固件

`test-fixtures/` 放置最小合法样例：手工构造的最小 CFB 文件或用脚本生成的 1-2 页 `.doc/.xls/.ppt`；**不得提交受版权保护的第三方文档**；`README.md` 注明生成方式。

> ✅ **固件来源确认（用户确认，2026-11-24）**：当前 `test-fixtures/` 下 3 个文件
> （`中文示例_docx_01.doc`、`中文示例_pptx_01.ppt`、`中文示例_xlsx_01.xls`）
> 均为**用户本人自产示例，不含任何第三方版权内容**，允许随仓库提交与分发。
> 三文件魔数已校验为合法 CFB 容器（2026-11-24）。

### 6.3 宿主端到端验收清单（人工 + 截图）

| # | 场景 | 期望 |
|---|------|------|
| 1 | 文件列表双击 `.doc/.xls/.ppt` | 容器切到本插件并渲染，无白屏 |
| 2 | Shift+点击打开第二实例 | 两实例内容独立，互不串扰（多实例过滤生效） |
| 3 | 连续快速切换 3 个不同文件 | 无内容错乱、无泄漏（旧解析被丢弃） |
| 4 | 打开改名的 `.docx`（伪装 `.doc`） | 魔数校验拦截，显示 §5.4-3 错误卡片 |
| 5 | 打开加密/损坏的 `.doc` | 错误卡片 + 原因说明，UI 不崩溃 |
| 6 | 超上限大文件 | 明确提示，不尝试渲染 |
| 7 | 禁用插件后打开 `.doc` | 宿主回退 `unknown-file` 兜底，无崩溃 |
| 8 | 手动安装 ZIP → 启用 | 插件管理面板正常显示、启停生效（热重载） |
| 9 | 断网环境渲染 | 无网络请求，渲染正常 |
| 10 | `minAppVersion` 检查 | 在 0.39.x 安装成功；更低版本宿主安装确认页禁用安装 |
| 11 | 深色主题下渲染 | UI 不破相（不依赖浅色假设；渲染区允许自带浅色底但需视觉可接受） |

---

## 7. 里程碑与任务清单（代码助手按序执行）

| 阶段 | 内容 | 交付 |
|------|------|------|
| M1 | 仓库脚手架：package.json/tsconfig/build.mjs/AGENTS.md/CONTRACT.md/plugin-sdk tarball/`.gitignore`；`npm run typecheck` 通过 | 可构建空插件（计步器级） |
| M2 | 渲染方案验证 spike：§4.2 四项前提逐项验证，**输出验证记录**（含实测体积）到 `docs/renderer-evaluation.md`；失败则启用替代方案并记录决策 | 选型定稿 |
| M3 | 核心实现：file:open 接入（过滤/魔数/内容获取）、三格式解析渲染、降级链与错误卡片、状态栏、卸载清理 | 功能完整 |
| M4 | 测试：§6.1 单测全绿；准备 §6.2 固件；`npm test`/`npm run typecheck`/`npm run build` 通过 | 测试报告 |
| M5 | 宿主端到端：本地安装（`%APPDATA%\com.gewu.desktop\plugins\plugin-office-viewer\` 复制或手动装 ZIP）→ §6.3 逐项验收 | 验收记录 |
| M6 | 打包发布：`dist/`（index.js + manifest.json）→ ZIP（两文件在根目录）+ SHA256 + `update.json`（参考 `MyProj/packages/sample-theme-plugin/pack.ps1` 或 srt-viewer 的打包脚本）；创建 GitHub 仓库 `li360/plugin-office-viewer`，推送源码；GitHub Release 上传 `gewu-plugin.zip` + `update.json`（Release 约定路径 `releases/latest/download/`） | Release 可 URL 安装 |
| M7 | 上架社区：向 `li360/gewu-plugins-registry` 提 PR，`registry.json` 追加一项（id/name/version/downloadUrl/description/author/repository/icon/checksum；checksum 为 gewu-plugin.zip 的 SHA256）；README 补「兼容性」说明（仅 0.39.x） | PR 链接 |

**M6-M7 执行前必须先向用户确认 §12 的占位信息（用户已同意此流程），替换为真实值后再发布。**

**Git 纪律**：本仓库独立提交（`type(scope): 中文描述`）；任何操作不得 `git add` 到 `MyProj` 或其他仓库。

---

## 8. 产物结构（预期）

```
plugin-office-viewer/
├── src/
│   ├── index.tsx          # 入口：manifest + 根组件
│   ├── host-contract.ts   # documentTypes 类型声明（SDK 未含前的本地补丁）
│   ├── format.ts          # 扩展名映射 + 魔数校验（纯函数）
│   ├── loaders/           # 各格式 → 渲染库封装（含 mock 层供测试）
│   ├── ui/                # 提示条/错误卡片/加载态/状态栏
│   └── strings.ts         # 文案（中英）
├── test/                  # vitest 单测
├── test-fixtures/         # 自制最小样例
├── plugin-sdk/            # 宿主类型 tarball
├── docs/
│   └── renderer-evaluation.md   # 渲染方案验证记录（M2 交付物）
├── CONTRACT.md            # 本插件与宿主的契约摘要（照 §2 提炼）
├── AGENTS.md              # 给 AI 助手的仓库级约束
├── manifest.json
├── build.mjs              # esbuild（external 六项 + 单文件自包含约束）
├── package.json
└── tsconfig.json
```

---

## 9. 安全与合规清单

- [ ] 不调用任何 Tauri `invoke`（只走 PluginContext）。
- [ ] 不读取 `%APPDATA%` 下 `vault/`、凭据；不写日志敏感信息。
- [ ] 运行时零网络请求（含字体）。
- [ ] 渲染方案不执行宏/VBA（file-viewer 天然保证；替代方案同样只做静态解析）。
- [ ] License：file-viewer 主源码 Apache-2.0（不引入 CAD/AGPL 组件）；替代方案各库 License 需在 M2 记录并确认兼容（避免 GPL 传染进插件）。
- [ ] 安装确认页展示的 capabilities 仅 `kmgr:read`。

---

## 10. 需反馈主项目（MyProj）的事项（本插件不动 MyProj 代码，只登记）

执行过程中如确认以下问题，整理成反馈清单（附复现/证据）交主项目处理，本插件侧用兼容字段绕过：

1. **`documentTypes`/`role: viewer` 宿主实现尚未落地**（spec 阶段 1 未开始）：本插件双写新旧字段；宿主落地后旧字段可移除。同时确认 spec §4.3「`isEditor:true + preferredExtensions` 映射为 role: editor」会让只读 viewer 被误判为 editor——建议宿主映射规则对"只读语义插件"留出表达（或按 spec §4.2 直接要求新插件写 `documentTypes`）。
2. **旧版二进制扩展名不在宿主文本/二进制白名单的文档化缺口**：`.doc/.xls/.ppt` 走二进制路径是**实现行为**而非契约承诺；建议宿主把"哪些扩展名按二进制预载"写成可查询契约（或按 `documentTypes.binary` 决定）。
3. **`fileIcons` 是否参与文件列表图标**：spec §8.1 指出第三方插件无法贡献文件图标；验证 `fileIcons` 字段在 0.39.x 的实际效果并登记差距。
4. **大文件上限**：spec §12 开放问题 1（`readFileBytes` 是否支持 range、上限多少）——本插件实测后把数据反馈给主项目。
5. **`.xls` 默认文件关联偏向内置插件（M5 实测，2026-11-24）**：内置 `xlsx-viewer` 与本插件同时声明 `.xls`，宿主默认关联解析按注册顺序取首位（`getEditorForExt` 遍历 plugins Map；`SettingsPanel.buildDefaultAssociations` 同规则），内置插件同步注册先于外部插件异步注册，故 `.xls` 默认落入内置查看器（SheetJS 转裸表格，保真度低于本插件的网格预览）；用户已保存的关联还会持久覆盖默认值。插件侧无法通过 manifest 表达优先级。**建议宿主改进**：①扩展名被多插件声明时在安装/启用环节提示用户选择默认关联；②默认排序引入扩展名声明专用度（如同时声明 `.xls/.xlsx/.xlsm` 的通用查看器让位于专用查看器）或支持 manifest 优先级字段。
6. **建议建立《插件 UI 样式规范》文档（M5 评估，2026-11-24）**：现有 `toolbar.md`（宿主统一工具栏）、`themes.md`（主题变量覆盖）、`i18n.md`（文案）覆盖了部分 UI 面，但缺一份面向插件作者的完整样式规范。建议内容：① design-tokens 变量消费清单（哪些 `--color-*/--font-*/--space-*/--radius-*/--shadow-*` 可用，禁止硬编码色值）；② 宿主 UI 契约组件的使用边界（引 toolbar.md，扩展到容器头部/菜单/对话框）；③ **Shadow DOM / iframe 隔离场景的令牌桥接指引**（CSS 自定义属性穿透继承、内部默认值需内联覆盖的模式——本插件 `src/host-theme.ts` 可作示范实现）；④ 图标库（icon-library）对插件的可用性；⑤ 第三方 SDK 自带 UI 的处理策略（裁剪 vs 桥接 vs 重造的决策标准）。

---

## 11. 开放决策点（代码助手遇到时按默认值执行，并记录）

| 决策点 | 默认 |
|--------|------|
| `.ppt` 渲染保真度过低 | 仍接入，但提示条明示"建议转换 .pptx 获得更好预览" |
| `@file-viewer/web-full` 超体积且无按格式分包 | 走 §4.3-B1（`.ppt` 降级为不支持提示），范围缩至 `.doc/.xls` |
| 渲染库样式污染宿主 UI | 用 Shadow DOM 隔离 |
| 产物体积 8-15 MB 之间 | 可接受，但在 README 记录体积与加载影响 |
| Excel 多 sheet 很大（>100k 单元格） | 虚拟滚动优先；不支持则提示截断展示 |

---

## 12. 发布占位信息（M6-M7 执行前向用户确认，用户已同意此流程）

| # | 占位项 | 当前值 | 需确认内容 |
|---|--------|--------|-----------|
| 1 | 仓库归属 | `li360/plugin-office-viewer` | ✅ 已确认（2026-11-24）；若届时发现 GitHub 上实际组织/用户名不是 `li360`，**必须先向用户报告并以用户给出的为准** |
| 2 | `author` | `<填写>` | 发布署名（个人名/组织名） |
| 3 | GitHub 账号与权限 | — | 用于创建仓库、推送源码、发 Release、提 registry PR 的账号（`gh` CLI 登录态）；无权限时的处理方式 |
| 4 | registry PR 条目 | author/repository/icon | `icon` 的 emoji、PR 描述口径 |
| 5 | Release 渠道 | — | 首发 tag 命名（建议 `v0.1.0`）与是否需要 beta 预发布标记 |

> 上述 2-5 在 M6-M7 前一次性询问用户确认；确认结果回填本表并同步到 `manifest.json` 与 PR 条目。
