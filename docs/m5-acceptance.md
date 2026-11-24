# M5 宿主端到端验收记录（归档）

> 验收环境：GeWu 0.39.x + `%APPDATA%\com.gewu.desktop\plugins\plugin-office-viewer\`（dev 安装）。
> 固件：`test-fixtures/` 自产中文示例（用户确认无第三方版权，魔数已校验）。
> 结论日期：2026-11-25。**M5 关闭，进入 M6-M7。**

## 1. §6.3 验收清单逐项结论

| # | 场景 | 结论 | 证据 / 备注 |
|---|------|------|------------|
| 1 | 双击 `.doc/.xls/.ppt` 渲染 | ✅ 通过 | 用户实测（2026-11-24）：三类文件全部渲染成功（`.ppt` 经 `pptWorker:false` 修复后验证） |
| 2 | Shift+点击第二实例互不串扰 | ⚠️ 未正式实测 | 过滤逻辑复用宿主 `createMultiInstanceFilter`（srt-viewer 同款成熟机制）；**列入 M6 发布前复核** |
| 3 | 连续快速切换 3 个文件 | ⚠️ 未正式实测 | seq 丢弃逻辑有代码实现；**列入 M6 发布前复核** |
| 4 | 改名 `.docx` 伪装 `.doc` | ⚠️ 未正式实测 | 魔数拦截逻辑有 4 项单测覆盖（`format.test.ts` checkMagic）；**列入 M6 发布前复核** |
| 5 | 加密/损坏文件 | ⚠️ 未正式实测 | `classifyError` 6 项单测覆盖分类（`loader.test.ts`）；**列入 M6 发布前复核** |
| 6 | 超上限大文件 | ⚠️ 未正式实测 | `isOversize` 单测覆盖；**列入 M6 发布前复核** |
| 7 | 禁用插件宿主回退 | ⚠️ 未实测 | 宿主兜底机制（unknown-file），插件侧无代码参与；**接受为宿主行为** |
| 8 | 手动安装 ZIP 启停 | ⏭️ 移交 M6 | 本项即 M6 的安装验证，Release ZIP 产出后一并验证 |
| 9 | 断网渲染 | ✅ 通过（等价证据） | M2 spike 真浏览器拦截 fetch/XHR：8 秒窗口 **0** 次网络请求；产物含相同渲染库 |
| 10 | minAppVersion 检查 | ✅ 通过 | manifest `0.39.0`，宿主 0.39.x 安装加载成功（用户实测） |
| 11 | 深色主题渲染 | ✅ 通过 + 增强 | 主题三件套落地：初始跟随宿主 / MutationObserver 实时联动 / design-tokens→`--file-viewer-*` 令牌桥接 |

## 2. 清单外的 M5 附加完成项

- **`.ppt` 渲染失败修复**：Blob URL 环境下 Worker 构造抛 `Invalid URL`（`import.meta.url` 为不透明路径）→ `presentation.pptWorker: false` 强制主线程解析（`docs/renderer-evaluation.md` §5.1）。
- **主题一致化**：初始跟随 + 实时联动（`host-theme.ts`）。
- **工具栏裁剪**：移除下载/HTML/主题按钮（GeWu 桌面场景无消费路径 / 双入口冲突）。
- **UI 规范合规**：宿主 `ui-guidelines.md` 发布后逐项对齐（compact 密度、locale/文案跟随语言、合规自检表见 README）。
- **合规文件**：THIRD-PARTY-NOTICES.md（Apache-2.0 LICENSE/NOTICE + MIT）随 dist 分发。
- **§10 主项目反馈清单**：6 项登记完毕（documentTypes、二进制白名单、fileIcons、大文件上限、`.xls` 关联偏向、UI 规范文档提议——后者已被主项目采纳发布）。

## 3. M6 发布前复核项（合并进 M6 验证标准）

清单中 5 个 ⚠️ 项（#2/3/4/5/6）在 Release ZIP 安装形态下一次性复核（场景与 dev 安装一致，重测成本低），全部通过才打 tag 发布。
