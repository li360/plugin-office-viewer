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

## 里程碑状态

- [x] M1 仓库脚手架（可构建 + 单测 + typecheck）
- [x] M2 渲染方案验证 spike（`docs/renderer-evaluation.md`，方案 A 定稿）
- [x] M3 核心实现（file-viewer 渲染适配器接入，产物 5.1 MB）
- [ ] M4 测试（补 `.doc/.ppt` 固件与 loader 单测）
- [ ] M5 宿主端到端验收
- [ ] M6 GitHub Release
- [ ] M7 社区 registry PR
