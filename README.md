# plugin-office-viewer

GeWu 第三方插件：**旧版 Office 查看器**——查看 Word/Excel/PowerPoint 97-2003 旧版二进制文档（`.doc/.xls/.ppt`），只读预览。

> 独立第三方仓库（remote `li360/plugin-office-viewer`），不修改 `../MyProj`。
> 需求与契约权威来源：[REQUIREMENTS.md](./REQUIREMENTS.md)、[CONTRACT.md](./CONTRACT.md)。

## 兼容性

- 宿主：GeWu **0.39.x**（`minAppVersion: "0.39.0"`）；不保证更低版本。
- 只读：不保存、不转换格式；**宏/VBA 永不执行**；运行时零网络请求。

## 开发

```powershell
cd E:\GeWu\plugin-office-viewer
npm install        # npm 11 上若 @esbuild/* 报 notsup，勿用 npm ci
npm run typecheck
npm test
npm run build
```

类型依赖来自 `plugin-sdk/` 的 tarball，不需要 `MyProj` 源码（生成方式见 `plugin-sdk/README.md`）。

产物：`dist/index.js` + `dist/manifest.json`。体积要求 ≤ 8 MB（硬上限 15 MB），构建输出实测值。

## 安装到 GeWu

1. 把 `dist/` 下两个文件打成 ZIP（根目录直接是 `index.js` 与 `manifest.json`）
2. GeWu → 工具 → 插件管理 → 手动安装，选择 ZIP
3. 启用插件；在文件列表打开 `.doc` / `.xls` / `.ppt`

也可以把 `dist/` 复制到：

```text
%APPDATA%\com.gewu.desktop\plugins\plugin-office-viewer\
```

重启 GeWu。

## 支持范围与保真度

| 格式 | 渲染级别 | 说明 |
|------|----------|------|
| `.doc` / `.dot` | 结构化预览 | 标题/段落/表格呈现；复杂排版（页眉页脚/文本框）可能有差异 |
| `.xls` / `.xlt` | 结构化预览 | 公式显示保存时的缓存结果，不重算 |
| `.ppt` / `.pot` | 结构化预览 | 字体与特效可能与 PowerPoint 有差异；建议另存 `.pptx` 获得更好预览 |

OOXML（`.docx/.xlsx/.pptx`）由宿主内置支持，本插件不覆盖。

## UI 规范合规

对照宿主 [插件 UI 最佳实践](https://github.com/GeWu/MyProj/blob/main/docs/plugin-development/ui-guidelines.md) 自检：

| 规范条目 | 状态 |
|---------|------|
| 复杂查看器工具栏允许自研/第三方（§3） | ✅ 按例外条款接入 file-viewer 工具栏 |
| 工具栏尺寸对齐宿主紧凑档（§3） | ✅ `ui: { density: "compact" }`（26px 按钮/34px 工具栏） |
| 使用 design-tokens 颜色/字体/圆角（§3/§4） | ✅ design-tokens → `--file-viewer-*` 令牌桥接（`src/host-theme.ts`），无硬编码色值 |
| Shadow DOM 显式桥接变量（§4） | ✅ 内联覆盖 shell（内部默认声明会击败继承） |
| 跟随宿主语言，不固定 locale（§6） | ✅ `<html lang>`/浏览器语言实时检测（`src/strings.ts`），每次打开重挂载生效 |
| 无硬编码中文（§6） | ✅ 文案集中于 `strings.ts` 双语表 |
| 浮层 z-index 分层（§7） | ✅ viewer 默认 20/30，远低于宿主浮层带（1200-1500），无冲突 |
| 无第二套"..."/固定/排序（§3） | ✅ 工具栏仅 打印/缩放/搜索 三项 |
| emoji 与矢量图标不混用（§5） | ✅ manifest.icon 用 emoji，fileIcons 用 icon-library IconName |
| 键盘可操作（§8） | ✅ 工具栏按钮为原生 button（viewer 内部保证） |

## 已知行为

- **`.xls` 默认关联**：内置「XLSX 查看器」也声明了 `.xls`，且宿主默认关联按插件注册顺序取内置优先——安装本插件后 `.xls` 默认仍由内置查看器打开。请在 **设置 → 文件关联** 中把 `.xls` 的默认项切换为「旧版 Office 查看器」并保存（一次即可，持久生效）。
- **主题跟随宿主**：预览界面初始主题跟随 GeWu 当前主题（暗色主题 → 深色预览，其余 → 浅色预览），切换 GeWu 主题时实时联动。
- **`.ppt` 主线程解析**：受插件 Blob URL 加载环境限制，`.ppt` 解析在主线程执行，超大文件（数十 MB）加载期间可能出现短暂卡顿。
- **工具栏**：预览工具栏仅保留 打印 / 缩放 / 文档内搜索；下载、HTML 导出已移除（文件在 GeWu 库内，经文件列表操作），主题切换由宿主联动接管。

## 第三方组件

本插件打包产物内联了 [flyfish-dev/file-viewer](https://github.com/flyfish-dev/file-viewer)
系列库的编译产物（Apache-2.0 / MIT，未修改上游代码）。完整组件清单、
许可证文本与 NOTICE 见 [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md)
（随 Release ZIP 一并分发）。本插件自身代码以 MIT 发布。

## 里程碑状态

- [x] M1 仓库脚手架（可构建 + 单测 + typecheck）
- [x] M2 渲染方案验证 spike（`docs/renderer-evaluation.md`，方案 A 定稿）
- [x] M3 核心实现（file-viewer 渲染适配器接入，产物 5.1 MB）
- [x] M4 测试（27 项单测：format 层 12 + loader 封装层 15；固件见 `test-fixtures/`，均为自产示例）
- [x] M5 宿主端到端验收（验收记录：`docs/m5-acceptance.md`；5 项人工复核并入 M6 发布门禁）
- [ ] M6 GitHub Release
- [ ] M7 社区 registry PR
