import { useEffect, useMemo, useRef, useState } from "react"
import type { PluginContext, PluginManifest } from "plugin-protocol"
import { createMultiInstanceFilter, type RoutedPayload } from "plugin-protocol"

import {
  checkMagic,
  extOf,
  formatBytes,
  formatForExt,
  isOversize,
  isUsableBinary,
  MAX_FILE_SIZE,
  PREFERRED_EXTENSIONS,
  type OfficeFormatFamily,
} from "./format"
import { getAdapter } from "./loaders/loader"
import type { RenderFailure } from "./loaders/loader"
import { observeHostTheme } from "./host-theme"
import { t, type StringKey } from "./strings"
import type { DocumentTypeContribution } from "./host-contract"

/** file:open 载荷（REQUIREMENTS §2.4） */
interface FileOpenPayload extends RoutedPayload {
  path: string
  name: string
  ext?: string
  content?: string | Uint8Array
}

/** 组件视图状态 */
type ViewState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "rendered"; summary?: string; fidelity: boolean }
  | { kind: "error"; message: string; detail?: string }

const FILE_ICONS: Record<string, string> = {
  ".doc": "file-text",
  ".dot": "file-text",
  ".xls": "file-spreadsheet",
  ".xlt": "file-spreadsheet",
  ".ppt": "file-slides",
  ".pot": "file-slides",
}

/**
 * 新契约声明（0.37 目标，宿主未实现，见 host-contract.ts 头注）。
 * 与旧字段并存：宿主落地后以 documentTypes 为准（spec §4.3）。
 * 差异已登记 REQUIREMENTS §10-1：isEditor:true 旧语义会被映射为 role: editor，
 * 待宿主映射规则修正后移除旧字段。
 */
const DOCUMENT_TYPES: DocumentTypeContribution[] = [
  {
    extensions: [".doc", ".dot"],
    role: "viewer",
    binary: true,
    maxFileSize: MAX_FILE_SIZE.word,
    label: "Word 97-2003 文档",
    icon: "file-text",
  },
  {
    extensions: [".xls", ".xlt"],
    role: "viewer",
    binary: true,
    maxFileSize: MAX_FILE_SIZE.spreadsheet,
    label: "Excel 97-2003 工作簿",
    icon: "file-spreadsheet",
  },
  {
    extensions: [".ppt", ".pot"],
    role: "viewer",
    binary: true,
    maxFileSize: MAX_FILE_SIZE.presentation,
    label: "PowerPoint 97-2003 演示文稿",
    icon: "file-slides",
  },
]

export function OfficeViewer(_ctx: PluginContext) {
  const [view, setView] = useState<ViewState>({ kind: "idle" })
  const [family, setFamily] = useState<OfficeFormatFamily | null>(null)
  const [hintDismissed, setHintDismissed] = useState(false)
  /** 渲染目标容器 —— 适配器直接操作 DOM */
  const containerRef = useRef<HTMLDivElement>(null)
  /** 当前适配器实例（切换文件/卸载时 dispose） */
  const adapterRef = useRef<{ dispose(): void; setTheme(theme: "light" | "dark"): void } | null>(null)
  /** 请求序号：快速连续切换文件时丢弃过期解析结果 */
  const seqRef = useRef(0)

  // 宿主主题联动：<html data-theme> 变化时同步 viewer 主题（免重挂载）
  useEffect(() => {
    return observeHostTheme((theme) => {
      adapterRef.current?.setTheme(theme)
    })
  }, [])

  const activeFamily = family

  useEffect(() => {
    return () => {
      seqRef.current += 1
      adapterRef.current?.dispose()
      adapterRef.current = null
    }
  }, [])

  useEffect(() => {
    const shouldHandle = createMultiInstanceFilter(_ctx.containerId)
    const unsub = _ctx.on("file:open", (payload: unknown) => {
      const p = payload as FileOpenPayload
      if (!shouldHandle(p)) return

      const seq = ++seqRef.current
      const ext = p.ext ?? extOf(p.path)
      const name = p.name ?? p.path
      const fmt = formatForExt(ext)
      setFamily(fmt)
      adapterRef.current?.dispose()
      adapterRef.current = null

      if (!fmt) {
        // 非本插件格式路由进来（理论上不该发生）：交还原容器语义，显示不支持
        setView({ kind: "error", message: t("office-viewer.error.not-supported") })
        return
      }

      // 内容获取：预载 Uint8Array 优先，缺失时回退 kmgr.readFileBytes（REQUIREMENTS §2.4）
      const acquire = async (): Promise<Uint8Array> => {
        if (isUsableBinary(p.content)) return p.content
        if (!_ctx.kmgr) throw new Error("content-type")
        const bytes = await _ctx.kmgr.readFileBytes(p.path)
        if (!bytes) throw new Error("content-type")
        return bytes
      }

      setView({ kind: "loading" })
      void acquire()
        .then(async (bytes) => {
          if (seqRef.current !== seq) return // 过期请求，丢弃

          // 降级链第 4 级：超限
          if (isOversize(fmt, bytes.byteLength)) {
            setView({
              kind: "error",
              message: t("office-viewer.error.oversize", {
                limit: formatBytes(MAX_FILE_SIZE[fmt]),
                size: formatBytes(bytes.byteLength),
              }),
            })
            return
          }

          // 降级链第 3 级：魔数不符
          const magic = checkMagic(bytes)
          if (!magic.ok) {
            setView({
              kind: "error",
              message:
                magic.reason === "zip-container"
                  ? t("office-viewer.error.mismatch")
                  : t("office-viewer.error.corrupt"),
            })
            return
          }

          // 渲染（M2 定稿后接入真实适配器）
          const container = containerRef.current
          if (!container) return
          const adapter = getAdapter(fmt)
          try {
            const summary = await adapter.render({
              family: fmt,
              bytes,
              fileName: name,
              container,
            })
            if (seqRef.current !== seq) {
              adapter.dispose()
              return
            }
            adapterRef.current = adapter
            setView({
              kind: "rendered",
              summary: summary.statusText,
              fidelity: true, // 旧版二进制全部为 structured 级，固定提示
            })
            _ctx.emit("statusbar:update", {
              id: "office-viewer:status",
              value: summary.statusText ?? t("office-viewer.status.idle"),
            })
          } catch (err) {
            if (seqRef.current !== seq) return
            const fail = err as RenderFailure
            const message =
              fail?.level === "error"
                ? fail.kind === "not-supported"
                  ? t("office-viewer.error.not-supported")
                  : t("office-viewer.error.corrupt")
                : t("office-viewer.error.internal")
            setView({ kind: "error", message })
          }
        })
        .catch((err: unknown) => {
          if (seqRef.current !== seq) return
          const msg =
            err instanceof Error && err.message === "content-type"
              ? t("office-viewer.error.content-type")
              : t("office-viewer.error.internal")
          setView({ kind: "error", message: msg })
          _ctx.emit("statusbar:update", {
            id: "office-viewer:status",
            value: t("office-viewer.status.idle"),
          })
        })
    })
    return unsub
  }, [_ctx])

  const fidelityText = useMemo(() => {
    if (!activeFamily) return ""
    const key: StringKey =
      activeFamily === "word"
        ? "office-viewer.fidelity.word"
        : activeFamily === "spreadsheet"
          ? "office-viewer.fidelity.spreadsheet"
          : "office-viewer.fidelity.presentation"
    return t(key)
  }, [activeFamily])

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minWidth: 0 }}>
      {view.kind === "rendered" && view.fidelity && !hintDismissed && (
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            padding: "6px 12px",
            fontSize: 12,
            borderBottom: "1px solid var(--color-border)",
            color: "var(--color-text-secondary)",
          }}
        >
          <span style={{ flex: 1 }}>{fidelityText}</span>
          <button
            onClick={() => setHintDismissed(true)}
            style={{ fontSize: 12, color: "var(--color-accent)", background: "none", border: "none", cursor: "pointer" }}
          >
            {t("office-viewer.fidelity.dismiss")}
          </button>
        </div>
      )}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        <div ref={containerRef} style={{ position: "absolute", inset: 0, overflow: "auto" }} />
        {view.kind !== "rendered" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              padding: 24,
              textAlign: "center",
              color: "var(--color-text-secondary)",
            }}
          >
            {view.kind === "loading" && <div>{t("office-viewer.loading")}</div>}
            {view.kind === "idle" && <div>{t("office-viewer.title")}</div>}
            {view.kind === "error" && (
              <>
                <div style={{ fontSize: 15, color: "var(--color-text-primary)" }}>
                  {t("office-viewer.error.title")}
                </div>
                <div style={{ maxWidth: 480 }}>{view.message}</div>
                {activeFamily === "presentation" && (
                  <div style={{ maxWidth: 480, fontSize: 12 }}>{t("office-viewer.hint.ppt")}</div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export const officeViewerPlugin: PluginManifest = {
  id: "plugin-office-viewer",
  name: "旧版 Office 查看器",
  icon: "📄",
  component: OfficeViewer,
  emits: ["office-viewer:status"],
  handles: ["file:open"],
  // 旧契约（当前宿主路由 + 内容预载的唯一依据；只读 viewer 也必须如此，见 REQUIREMENTS §2.2）
  isEditor: true,
  preferredExtensions: PREFERRED_EXTENSIONS,
  fileIcons: FILE_ICONS,
  capabilities: ["kmgr:read"],
  statusBarItems: [
    { id: "office-viewer:status", label: "Office", value: "-", align: "right", priority: 45 },
  ],
  version: "0.1.0",
  description: "查看 Word/Excel/PowerPoint 97-2003 旧版二进制文档（.doc/.xls/.ppt），只读预览，不执行宏",
  minAppVersion: "0.39.0",
  // 新契约（宿主实现 documentTypes 后生效；类型见 host-contract.ts）
  ...( { documentTypes: DOCUMENT_TYPES } as Record<string, unknown> ),
}

export default officeViewerPlugin
