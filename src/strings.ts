/**
 * UI 文案（中英双语键值；v1 以中文为准）
 * 键命名参考宿主 i18n 规范：插件前缀 + 语义段
 */

export const zh = {
  "office-viewer.title": "旧版 Office 查看器",
  "office-viewer.loading": "正在解析文档…",
  "office-viewer.fidelity.word": "此为结构化预览：标题/段落/表格会呈现，复杂排版（页眉页脚/文本框/图片环绕）可能与原文有差异。",
  "office-viewer.fidelity.spreadsheet": "结构化预览：公式显示文件保存时的缓存结果，不重新计算。",
  "office-viewer.fidelity.presentation": "结构化预览：字体与复杂特效可能与 PowerPoint 原始效果有差异。",
  "office-viewer.fidelity.dismiss": "不再显示",
  "office-viewer.error.title": "无法预览此文件",
  "office-viewer.error.mismatch": "文件内容与扩展名不符：这是伪装成旧版 Office 的其他文件（ZIP 容器）。",
  "office-viewer.error.corrupt": "文件结构损坏或受密码保护，无法解析。建议在 Office 中确认可打开后另存。",
  "office-viewer.error.unknown": "文件不是有效的旧版 Office 二进制格式。",
  "office-viewer.error.oversize": "文件超过预览上限（{limit}），已停止解析。实际大小：{size}。",
  "office-viewer.error.not-supported": "该格式暂不支持预览。",
  "office-viewer.error.content-type": "未获取到文件二进制内容（预载缺失且读取失败）。",
  "office-viewer.error.internal": "解析过程中发生内部错误，已记录日志。",
  "office-viewer.hint.ppt": "建议将 .ppt 另存为 .pptx 以获得更高保真度的预览。",
  "office-viewer.status.idle": "-",
  "office-viewer.status.wordPages": "{count} 页",
  "office-viewer.status.sheets": "{count} 个工作表",
  "office-viewer.status.slides": "{count} 张幻灯片",
} as const

export type StringKey = keyof typeof zh
export type Strings = Record<StringKey, string>

export const en: Strings = {
  "office-viewer.title": "Legacy Office Viewer",
  "office-viewer.loading": "Parsing document…",
  "office-viewer.fidelity.word": "Structured preview: headings, paragraphs and tables are shown; complex layout (headers/footers, text boxes, image wrap) may differ from the original.",
  "office-viewer.fidelity.spreadsheet": "Structured preview: formulas show cached values from the time the workbook was saved; no recalculation.",
  "office-viewer.fidelity.presentation": "Structured preview: fonts and complex effects may differ from PowerPoint.",
  "office-viewer.fidelity.dismiss": "Don't show again",
  "office-viewer.error.title": "Cannot preview this file",
  "office-viewer.error.mismatch": "Content does not match the extension: this is another file disguised as legacy Office (ZIP container).",
  "office-viewer.error.corrupt": "The file is corrupt or password-protected and cannot be parsed. Verify it opens in Office and re-save.",
  "office-viewer.error.unknown": "The file is not a valid legacy Office binary document.",
  "office-viewer.error.oversize": "File exceeds the preview limit ({limit}); parsing stopped. Actual size: {size}.",
  "office-viewer.error.not-supported": "This format is not supported for preview.",
  "office-viewer.error.content-type": "No binary content available (preload missing and read failed).",
  "office-viewer.error.internal": "An internal error occurred during parsing; it has been logged.",
  "office-viewer.hint.ppt": "Save as .pptx for a higher-fidelity preview.",
  "office-viewer.status.idle": "-",
  "office-viewer.status.wordPages": "{count} pages",
  "office-viewer.status.sheets": "{count} sheets",
  "office-viewer.status.slides": "{count} slides",
}

const TABLES: Record<string, Strings> = { zh, en }

/** 取文案并做 {var} 插值。当前宿主语言未知，v1 默认中文 */
export function t(key: StringKey, vars?: Record<string, string | number>, lang = "zh"): string {
  const table = TABLES[lang] ?? zh
  let s: string = table[key]
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replaceAll(`{${k}}`, String(v))
    }
  }
  return s
}
