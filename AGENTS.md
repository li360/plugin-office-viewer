# AGENTS.md — 给 AI 编码助手的仓库约束

> 独立第三方插件仓库，宿主为 GeWu（格物）0.39.x。完整需求见 `REQUIREMENTS.md`（权威）。

## 身份与边界

- 本仓库是**独立 git 仓库**，remote `li360/plugin-office-viewer`；**不得**把本仓库内容提交进 `E:\GeWu\MyProj` 或其他仓库，反之亦然。
- **禁止修改 `E:\GeWu\MyProj` 下任何文件**。宿主契约问题登记到 `REQUIREMENTS.md` §10 反馈清单，不在宿主侧"顺手修"。

## 硬约束（违反必崩）

1. esbuild 打包 external 六项：`react`、`react-dom`、`react/jsx-runtime`、`plugin-protocol`、`kmgr-api`、`workspace`（双 React 实例会让 hooks 全失效）。
2. 产物 `dist/index.js` 必须是**单文件 ESM**，`export default` PluginManifest；禁止依赖代码分割 chunk（宿主以 Blob URL import 加载，相对 chunk 无法解析）。
3. `manifest.json` 的 `id`（`plugin-office-viewer`）必须与源码 `PluginManifest.id` 一致；id 只能小写字母/数字/连字符。
4. 订阅 `file:open` 必须用 `createMultiInstanceFilter(containerId)` 过滤；`containerId` 进 useEffect 依赖。
5. 只读插件：不调用任何写文件 API；不直接 `invoke` 任何 Tauri 命令；一切宿主能力走 `PluginContext`。
6. 运行时**零网络请求**（含字体、CDN）；渲染资源必须自包含打进 `index.js`。
7. 产物体积目标 ≤ 8 MB，硬上限 15 MB（`npm run build` 会打印实测体积；超标需升级到用户决策）。

## 契约现状（重要）

- 宿主 0.39.x **未实现** `documentTypes`/`role: viewer`（0.37 目标契约）。本插件**双写**新旧字段：
  - 运行时路由走旧契约 `isEditor: true` + `preferredExtensions`（只读 viewer 也必须如此，否则不被路由、无内容预载）；
  - 同时声明 `documentTypes: [{ role: "viewer", binary: true, ... }]`（类型在 `src/host-contract.ts`，宿主落地后改从 plugin-protocol 导入并删除该文件）。
- `.doc/.xls/.ppt` 不在宿主文本扩展名白名单内，`file:open` 预载 `content` 为 `Uint8Array`；预载缺失时回退 `ctx.kmgr.readFileBytes(path)`。

## 开发与验证

```powershell
npm install          # 注意：npm 11 上若 @esbuild/* 报 notsup，用 npm install（勿用 npm ci）
npm run typecheck    # tsc --noEmit
npm test             # vitest run
npm run build        # esbuild → dist/index.js + dist/manifest.json
```

- 渲染库封装集中在 `src/loaders/`，上层管线（index.tsx）不得直接 import 具体渲染库——切换渲染方案（REQUIREMENTS §4 A/B1/B2）只改 loaders。
- 纯逻辑（格式识别/魔数/降级决策）放 `src/format.ts`，必须有 vitest 单测。
- UI 文案集中在 `src/strings.ts`，禁止在组件里硬编码用户可见字符串。

## 提交规范

`type(scope): 中文描述`，如 `feat(loader): 接入 .xls 渲染适配器`。
