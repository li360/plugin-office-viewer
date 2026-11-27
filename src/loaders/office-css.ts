/**
 * office shell GeWu 对齐 —— CSS 过渡层（与 plugin-dwg-viewer 的 cad-css.ts 同范式）
 *
 * 范围仅限 core web shell 的**字号/字重硬编码**（12px/800 → 11px/400，验收基线表）
 * ——颜色与尺寸已由 host-theme.ts 的 --file-viewer-* 令牌桥接覆盖（core 全令牌化）。
 *
 * 上游诉求（office/dwg 共用 token/handoff issue）：core 把字号/字重令牌化后，
 * 本层整体删除（到期条件）。
 *
 * 特异性：`.file-viewer-web-shell` 双类名前缀，不依赖样式注入顺序
 * （真机教训：同特异性时后注入者胜，上游生命周期内可能重插样式）。
 */
const S = ".file-viewer-web-shell.file-viewer-web-shell"

/* 打印图标（标准 printer 线框，随 color 变化走 mask 方案） */
const PRINTER_ICON =
  "url(\"data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`,
  ) +
  "\")"

const OFFICE_UI_CSS = `
${S} .file-viewer-web-toolbar button,
${S} .file-viewer-web-toolbar .file-viewer-web-zoom-meter,
${S} .file-viewer-web-print-menu > button,
${S} .file-viewer-web-search input,
${S} .file-viewer-web-search-count {
  font-size: var(--font-size-xs);
  font-weight: 400;
}

/* ===== 工具栏布局（真机反馈 2026-11-27：打印按钮错行） ===== */
/* 单行不换行；搜索框从定长 clamp(128px,18vw,220px) 改为弹性收放，
   空间不足时先收搜索框，杜绝换行 */
${S} .file-viewer-web-toolbar { flex-wrap: nowrap; }
${S} .file-viewer-web-search { flex: 1 1 auto; min-width: 0; }
${S} .file-viewer-web-search input {
  width: auto;
  flex: 1 1 72px;
  min-width: 64px;
  max-width: 200px;
}

/* ===== 打印按钮图标化（真机反馈：像 GeWu 一样用图标按钮省宽） ===== */
/* mask 方案：图标颜色随按钮 color/主题自动切换；文字置 0 隐藏 */
${S} .file-viewer-web-print-menu > button {
  font-size: 0;
  min-width: 0;
  width: var(--file-viewer-icon-button-size);
  padding: 0;
  background-color: currentColor;
  -webkit-mask-image: ${PRINTER_ICON};
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: 15px 15px;
  mask-image: ${PRINTER_ICON};
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: 15px 15px;
}

/* ===== 打印遮罩/盖章浮层（core printMaskDesigner）GeWu 对齐 =====
   上游硬编码（system-ui/#40546a/#16774c 上游绿/999px 胶囊/12px-800），而 core 打印菜单
   本身已令牌化——上游内部不一致（upstream Issue 5 佐证）。
   浮层样式与 shell 同一棵 shadow 树（designer 走 root.getRootNode() 注入），前缀可达；
   上游 overlay 令牌化后本节整体删除（同 L3 到期条件） */
${S} .fv-print-mask-toolbar {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  font-family: var(--font-family-ui);
  padding: 6px 10px;
  gap: 6px;
}
${S} .fv-print-mask-toolbar span {
  font: 400 var(--font-size-xs)/1.4 var(--font-family-ui);
  color: var(--color-text-secondary);
}
${S} .fv-print-mask-toolbar button {
  min-width: 0;
  height: var(--file-viewer-button-height);
  padding: 0 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-input);
  color: var(--color-text-secondary);
  font: 400 var(--font-size-xs)/1 var(--font-family-ui);
}
${S} .fv-print-mask-toolbar button:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}
${S} .fv-print-mask-toolbar button.primary {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}
${S} .fv-print-mask-toolbar button.primary:hover {
  background: var(--color-primary-hover);
  color: #fff;
}
/* 遮罩块手柄与印章缩放手柄：上游绿 → 主色（画布内可见元素，随主题） */
${S} .fv-print-stamp-resize,
${S} .fv-print-mask-block-remove {
  background: var(--color-primary);
}
`

/** 安装覆盖（幂等；随 applyViewerThemeBridge 一起在 render 完成与 setTheme 后调用） */
export function installOfficeShellUi(root: ShadowRoot | null | undefined): void {
  if (!root || root.querySelector("style[data-gv-office-ui]")) return
  const style = document.createElement("style")
  style.dataset.gvOfficeUi = ""
  style.textContent = OFFICE_UI_CSS
  root.appendChild(style)
}
