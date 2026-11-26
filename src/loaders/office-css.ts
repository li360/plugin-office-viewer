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

const OFFICE_UI_CSS = `
${S} .file-viewer-web-toolbar button,
${S} .file-viewer-web-toolbar .file-viewer-web-zoom-meter,
${S} .file-viewer-web-print-menu > button,
${S} .file-viewer-web-search input,
${S} .file-viewer-web-search-count {
  font-size: var(--font-size-xs);
  font-weight: 400;
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
