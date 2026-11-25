/**
 * 格式识别与约束（纯函数，无渲染库依赖）
 *
 * 路由依据是扩展名（宿主按 preferredExtensions 路由），插件内做二次校验：
 * 1. 扩展名 → 格式族映射
 * 2. 文件大小上限
 * 3. 魔数校验（防止"改名的错误文件"被硬渲染）
 */

/** 格式族 */
export type OfficeFormatFamily = "word" | "spreadsheet" | "presentation"

/** 扩展名 → 格式族。键必须小写、带点 */
const FORMAT_BY_EXT: Readonly<Record<string, OfficeFormatFamily>> = {
  ".doc": "word",
  ".dot": "word",
  ".xls": "spreadsheet",
  ".xlt": "spreadsheet",
  ".ppt": "presentation",
  ".pot": "presentation",
}

/** 宿主路由声明用扩展名清单（旧契约 preferredExtensions） */
export const PREFERRED_EXTENSIONS: string[] = Object.keys(FORMAT_BY_EXT)

/** 文件大小上限（字节）——与 manifest documentTypes.maxFileSize 保持一致（REQUIREMENTS §5.5） */
export const MAX_FILE_SIZE: Readonly<Record<OfficeFormatFamily, number>> = {
  word: 50_000_000,
  spreadsheet: 50_000_000,
  presentation: 100_000_000,
}

/** OLE 复合文档（CFB）魔数：旧版二进制 Office 容器 */
export const CFB_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const

/** ZIP 魔数：OOXML 或其他 ZIP 容器（本插件不支持） */
export const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const

/** 魔数校验结果 */
export type MagicCheckResult =
  | { ok: true; container: "cfb" }
  | { ok: false; reason: "zip-container" | "unknown" | "too-short" }

function startsWith(bytes: Uint8Array, magic: readonly number[]): boolean {
  if (bytes.length < magic.length) return false
  return magic.every((b, i) => bytes[i] === b)
}

/**
 * 校验文件魔数。旧版 Office 必须是 CFB 容器；
 * ZIP 容器说明是伪装成旧格式的 OOXML 或其他文件。
 */
export function checkMagic(bytes: Uint8Array): MagicCheckResult {
  if (bytes.length < 8) return { ok: false, reason: "too-short" }
  if (startsWith(bytes, ZIP_MAGIC)) return { ok: false, reason: "zip-container" }
  if (startsWith(bytes, CFB_MAGIC)) return { ok: true, container: "cfb" }
  return { ok: false, reason: "unknown" }
}

/** 扩展名 → 格式族；不支持返回 null */
export function formatForExt(ext: string): OfficeFormatFamily | null {
  return FORMAT_BY_EXT[ext.toLowerCase()] ?? null
}

/** 扩展名是否受支持 */
export function isSupportedExt(ext: string): boolean {
  return formatForExt(ext) !== null
}

/** 从路径提取小写扩展名（含点），无扩展名返回 "" */
export function extOf(path: string): string {
  const i = path.lastIndexOf(".")
  return i < 0 ? "" : path.slice(i).toLowerCase()
}

/** 文件大小是否超限 */
export function isOversize(family: OfficeFormatFamily, sizeBytes: number): boolean {
  return sizeBytes > MAX_FILE_SIZE[family]
}

/** 字节数的人类可读表示（错误提示用） */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/** file:open 载荷中预载内容的形态（REQUIREMENTS §2.4） */
export type OpenPayloadContent = string | Uint8Array | undefined

/** 判定预载内容是否为可用的二进制（本插件唯一可接受的形态） */
export function isUsableBinary(content: OpenPayloadContent): content is Uint8Array {
  return content instanceof Uint8Array
}
