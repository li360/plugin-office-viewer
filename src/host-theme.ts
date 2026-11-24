/**
 * 宿主主题联动 —— GeWu 把当前主题写在 <html data-theme="...">：
 * - 内置主题 id：light / dark / colorful / ocean / aurora（ThemeContext.tsx BUILTIN_THEMES）
 * - 外部主题插件可注册更多 id；主题切换时 ThemeContext 同步写该属性
 *
 * file-viewer 的 theme 只认 'light' | 'dark'（'system' 跟操作系统，与宿主无关），
 * 因此插件侧做映射：dark → dark，其余主题 → light。
 */

/** 宿主主题 id → viewer 主题 */
export function mapHostTheme(dataTheme: string | null): "light" | "dark" {
  return dataTheme === "dark" ? "dark" : "light"
}

/** 读取宿主当前主题（映射后的 viewer 主题） */
export function getHostTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light"
  return mapHostTheme(document.documentElement.getAttribute("data-theme"))
}

/**
 * 监听宿主主题变化（<html data-theme> 属性变化）。
 * 返回解除监听的清理函数。
 */
export function observeHostTheme(onChange: (theme: "light" | "dark") => void): () => void {
  if (typeof MutationObserver === "undefined") return () => {}
  const observer = new MutationObserver(() => {
    onChange(getHostTheme())
  })
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  })
  return () => observer.disconnect()
}

/**
 * 主题令牌桥接 —— 把 GeWu design-tokens 映射到 file-viewer 的 CSS 变量体系。
 *
 * 原理：CSS 自定义属性可穿透 Shadow DOM 继承。把这些变量设在插件容器元素上，
 * file-viewer 的 UI（工具栏/按钮/输入框/焦点环）即使用宿主主题配色与字体；
 * 值均为 var(...) 引用，宿主切换主题时**自动跟随，无需 JS**。
 *
 * 只桥接颜色/字体/圆角/阴影语义；尺寸类变量（按钮高度/内边距/min-width 等）
 * 保持 file-viewer 默认值，避免第三方布局被宿主间距体系破坏。
 *
 * file-viewer 变量清单来源：@file-viewer/core dist 内 var( 消费点全量扫描。
 */
export const VIEWER_TOKEN_BRIDGE: Record<string, string> = {
  // 顶层与内容区
  "--file-viewer-bg": "var(--color-bg-panel)",
  "--file-viewer-content-bg": "var(--color-bg-page)",
  "--file-viewer-render-surface-background": "var(--color-bg-page)",
  // 文字
  "--file-viewer-text": "var(--color-text-primary)",
  "--file-viewer-muted": "var(--color-text-secondary)",
  // 边框与阴影
  "--file-viewer-border": "var(--color-border)",
  "--file-viewer-toolbar-border": "var(--color-border)",
  "--file-viewer-toolbar-shadow": "var(--shadow-sm)",
  // 工具栏
  "--file-viewer-toolbar-bg": "var(--color-bg-panel)",
  "--file-viewer-group-bg": "var(--color-bg-elevated)",
  "--file-viewer-group-border": "var(--color-border)",
  // 按钮
  "--file-viewer-button-color": "var(--color-text-secondary)",
  "--file-viewer-button-hover-color": "var(--color-text-primary)",
  "--file-viewer-button-hover-bg": "var(--color-bg-hover)",
  "--file-viewer-button-disabled-color": "var(--color-text-disabled)",
  "--file-viewer-button-radius": "var(--radius-sm)",
  // 输入框（搜索）
  "--file-viewer-input-bg": "var(--color-bg-input)",
  "--file-viewer-input-color": "var(--color-text-primary)",
  // 焦点环与字体
  "--file-viewer-focus-ring": "var(--color-focus-ring)",
  "--file-viewer-font": "var(--font-family-ui)",
}

/**
 * 把令牌桥接应用到 viewer 的 shell 元素（Shadow DOM 内部）。
 *
 * 必须写内联样式而非容器继承：file-viewer 的默认变量在内部样式表里
 * 直接声明在 `.file-viewer-web-shell` 上（明/暗两套），继承值会被内部
 * 声明击败；内联样式优先级最高，且值都是 var(--color-*) 引用，
 * 宿主切主题时由 CSS 级联自动跟随，无需重新调用。
 *
 * 渲染完成后与 setTheme 后各调用一次（幂等）。
 */
export function applyViewerThemeBridge(container: HTMLElement): void {
  try {
    const shell = container.shadowRoot?.querySelector<HTMLElement>(".file-viewer-web-shell")
    if (!shell) return
    for (const [name, value] of Object.entries(VIEWER_TOKEN_BRIDGE)) {
      shell.style.setProperty(name, value)
    }
  } catch {
    /* 桥接失败不致命——viewer 保持自有主题 */
  }
}
