/**
 * 渲染器适配层 —— 方案 A：flyfish-dev/file-viewer（M2 定稿，见 docs/renderer-evaluation.md）
 *
 * mountViewer 按 filename 扩展名自动路由到对应渲染器；
 * 上层管线（index.tsx）不直接 import 渲染库，切换渲染方案只改本文件。
 */

import { mountViewer } from "@file-viewer/core/browser"
import { wordRenderer } from "@file-viewer/renderer-word"
import { spreadsheetRenderer } from "@file-viewer/renderer-spreadsheet"
import { presentationRenderer } from "@file-viewer/renderer-presentation"

import type { FileViewerOptions } from "@file-viewer/core"
import { getHostTheme } from "../host-theme"
import type { OfficeFormatFamily } from "../format"

/**
 * 渲染器插件集合。
 * 库自身的 Handler 泛型变体定义不一致（HTMLDivElement vs HTMLElement），
 * 此处做一次显式收敛；运行时行为不受影响（M2 spike 已验证）。
 */
const RENDERERS = [
  wordRenderer,
  spreadsheetRenderer,
  presentationRenderer,
] as unknown as NonNullable<FileViewerOptions["renderers"]>

/** 渲染请求 */
export interface RenderRequest {
  /** 格式族 */
  family: OfficeFormatFamily
  /** 文件字节（已通过魔数校验，CFB 容器） */
  bytes: Uint8Array
  /** 文件名（viewer 按扩展名路由渲染器，也用于界面显示） */
  fileName: string
  /** 渲染目标 DOM 容器（插件组件内的独立 div） */
  container: HTMLElement
}

/** 渲染结果摘要 */
export interface RenderSummary {
  /** 状态栏摘要文案；无摘要时缺省 */
  statusText?: string
}

/** 渲染失败原因 —— 与降级链（REQUIREMENTS §5.4）对齐 */
export type RenderFailure =
  | { level: "fidelity-hint" } // 渲染成功但特性缺失 → 提示条
  | { level: "error"; kind: "corrupt" | "not-supported" | "internal" }

/** 渲染适配器 —— 每次调用 render 创建一个 viewer 实例；调用方保证串行使用 */
export interface RenderAdapter {
  /** 渲染到容器。resolve 表示渲染完成；reject RenderFailure */
  render(req: RenderRequest): Promise<RenderSummary>
  /** 实时切换 viewer 主题（宿主主题联动；渲染完成后调用） */
  setTheme(theme: "light" | "dark"): void
  /** 销毁 viewer 实例、清空容器 DOM（切换文件/卸载时调用） */
  dispose(): void
}

/** 渲染超时（毫秒）—— viewer 挂起时避免上层永久 loading */
const RENDER_TIMEOUT_MS = 30_000

/** Uint8Array → 独立 ArrayBuffer（mountViewer 的 FileRef 接受 ArrayBuffer） */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = bytes.buffer as ArrayBuffer
  return bytes.byteOffset === 0 && bytes.byteLength === buffer.byteLength
    ? buffer
    : buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

/** 从 viewer 错误信息推断降级类别 */
function classifyError(err: unknown): RenderFailure {
  const msg = String(err ?? "")
  if (/unsupported/i.test(msg)) return { level: "error", kind: "not-supported" }
  if (/password|encrypt|corrupt|invalid|parse/i.test(msg)) return { level: "error", kind: "corrupt" }
  return { level: "error", kind: "internal" }
}

/** 获取格式族对应的适配器（mountViewer 按扩展名路由，family 仅用于语义标注） */
export function getAdapter(_family: OfficeFormatFamily): RenderAdapter {
  type Destroyable = { destroy(): void }
  let controller: Destroyable | null = null
  let container: HTMLElement | null = null

  return {
    render(req: RenderRequest): Promise<RenderSummary> {
      return new Promise<RenderSummary>((resolve, reject) => {
        let settled = false
        const finish = (fn: () => void) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          fn()
        }
        const timer = setTimeout(() => {
          finish(() => reject({ level: "error", kind: "internal" } satisfies RenderFailure))
        }, RENDER_TIMEOUT_MS)

        container = req.container
        try {
          controller = mountViewer(
            req.container,
            {
              file: toArrayBuffer(req.bytes),
              filename: req.fileName,
              onStateChange: (state: unknown) => {
                const s = state as { error?: unknown }
                if (s?.error) {
                  finish(() => reject(classifyError(s.error)))
                }
              },
              options: {
                rendererMode: "replace",
                builtinRenderers: "none",
                renderers: RENDERERS,
                locale: "zh-CN",
                toolbar: true,
                // 初始主题跟随宿主（<html data-theme>）；运行时联动走 setTheme
                theme: getHostTheme(),
                // Blob URL 插件环境下 Worker 必然失败：
                // 引擎默认 'auto' 会执行 new URL('./pptjs.worker.js', import.meta.url)，
                // 而 import.meta.url 是 blob:（不透明路径，不能作相对解析 base）→ Invalid URL。
                // false = 强制主线程解析（引擎自带 pptjs.browser.js，官方支持的形态）。
                presentation: { pptWorker: false },
                hooks: {
                  onLoadComplete: (ctx: { duration?: number }) => {
                    const ms = typeof ctx?.duration === "number" ? Math.round(ctx.duration) : undefined
                    finish(() => resolve({ statusText: ms !== undefined ? `已打开 · ${ms}ms` : "已打开" }))
                  },
                },
              },
            },
            {
              onError: (err: unknown) => {
                finish(() => reject(classifyError(err)))
              },
            },
          ) as unknown as Destroyable
        } catch (err) {
          finish(() => reject(classifyError(err)))
        }
      })
    },
    setTheme(theme: "light" | "dark"): void {
      if (!controller) return
      try {
        // mountViewer 返回 ViewerController，getApi() 即 FileViewerInstance
        const api = (controller as unknown as {
          getApi(): { updateOptions?: (o: Partial<FileViewerOptions>) => void } | null
        }).getApi()
        api?.updateOptions?.({ theme })
      } catch {
        /* 主题联动失败不致命，保留当前主题 */
      }
    },
    dispose(): void {
      try {
        controller?.destroy()
      } catch {
        /* 销毁失败不抛出（切换文件场景） */
      }
      controller = null
      if (container) {
        try {
          container.replaceChildren()
        } catch {
          /* ignore */
        }
      }
      container = null
    },
  }
}
