# plugin-office-viewer 宿主契约摘要

> 适用宿主：GeWu 0.39.x beta（`minAppVersion: "0.39.0"`）。
> 权威来源：`REQUIREMENTS.md` §2；宿主契约文档 `MyProj/docs/plugin-development/`。

## 1. 插件入口

`src/index.tsx` `export default` 一个 `PluginManifest`。宿主从 `dist/index.js` 的 default 导出读取 manifest 与组件。

构建 external（宿主运行时提供）：

```js
external: ["react", "react-dom", "react/jsx-runtime", "plugin-protocol", "kmgr-api", "workspace"]
```

## 2. 本插件使用的 manifest 字段

```json
{
  "id": "plugin-office-viewer",
  "name": "旧版 Office 查看器",
  "version": "0.1.0",
  "minAppVersion": "0.39.0",
  "isEditor": true,
  "preferredExtensions": [".doc", ".dot", ".xls", ".xlt", ".ppt", ".pot"],
  "fileIcons": { ".doc": "file-text", ".xls": "file-spreadsheet", ".ppt": "file-slides", "...": "..." },
  "handles": ["file:open"],
  "emits": ["office-viewer:status"],
  "capabilities": ["kmgr:read"],
  "statusBarItems": [
    { "id": "office-viewer:status", "label": "Office", "value": "-", "align": "right", "priority": 45 }
  ]
}
```

- `isEditor: true` 是宿主路由 + 内容预载的前提，**即使本插件只读也必须如此**（0.39 兼容限制）；
- `capabilities` 仅声明校验、不是安全边界；本插件自律不直接 invoke，只走 PluginContext；
- 新契约 `documentTypes`（role: viewer / binary: true / maxFileSize）在源码中声明，宿主实现前不生效（见 `src/host-contract.ts`）。

## 3. `file:open` 载荷

```ts
{
  path: string
  name: string
  ext?: string            // 小写带点；缺失时插件自取
  content?: string | Uint8Array  // 宿主预载；.doc 系列为 Uint8Array（二进制路径）
  isTauri?: boolean
  __targetContainer?: string
}
```

- 预载 `Uint8Array` 优先使用；缺失回退 `ctx.kmgr.readFileBytes(path)`；
- `content` 为 `string`（不应发生）→ 按损坏文件处理，不尝试解析。

## 4. PluginContext 可用字段

| 字段 | 用途 |
|------|------|
| `containerId` | 当前容器 ID（如 `c4` / `c4#2`） |
| `emit` / `on` | 事件总线；emit 自动注入 `__sourceContainer` |
| `kmgr` | 知识库 API（capabilities: kmgr:read 注入）；本插件只用 `readFileBytes` |
| `editor` | 编辑器上下文（isEditor 注入）；本插件只读，不使用其写能力 |
| `fileHistory` | 宿主的返回上一文件能力 |

## 5. 只读边界

不调用 `writeTextFile`/`writeFileBytes`；不注册保存；不产生脏状态；不接收 `ai:rewrite-apply`。

## 6. 事件

- 订阅：`file:open`（必须 `createMultiInstanceFilter(containerId)` 过滤）。
- 发出：`statusbar:update`（`{ id, value }`，渲染完成/失败时更新摘要）；`office-viewer:status`（预留）。
