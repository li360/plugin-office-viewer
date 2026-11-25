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
