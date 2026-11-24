/**
 * 宿主契约本地补丁（host-contract）
 *
 * `documentTypes` 是 0.37 目标契约（MyProj/docs/design/plugin-types-spec.md §4.2，已评审），
 * 但宿主 0.39.x 尚未实现（packages/ 全量搜索 0 命中），且未包含在 plugin-sdk tarball 的
 * plugin-protocol 类型里。本文件照抄 spec §4.2 的类型定义，仅作类型使用；
 * 宿主实际路由仍走旧字段（isEditor + preferredExtensions）。
 * 来源版本：spec 评审稿（2026-10-19）；抄录日期：2026-11-24。
 * 宿主落地后：删除本文件，改从 plugin-protocol 导入。
 */

/** 文档处理器声明；一个插件可声明多组扩展名，但每组只有一个角色（spec §4.2） */
export interface DocumentTypeContribution {
  /** 小写、带点，如 [".srt", ".vtt"] */
  extensions: string[]
  /** viewer = 只读；editor = 可写 */
  role: "viewer" | "editor"
  /** 可选 MIME 白名单 */
  mimeTypes?: string[]
  /** 可选简单通配，如 ["*.srt"]；只支持 * 与 ?，不区分大小写 */
  fileNamePatterns?: string[]
  /** 是否按二进制读取（默认按文本） */
  binary?: boolean
  /** 建议上限（字节）；宿主可拒绝超过上限的文件，插件也可自行处理 */
  maxFileSize?: number
  /** 展示名，如 "SRT 字幕" */
  label?: string
  /** 文件列表/搜索/关联设置使用的图标名（icon-library 的 IconName） */
  icon?: string
}
