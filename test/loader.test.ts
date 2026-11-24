/**
 * 渲染封装层（loader）单测 —— REQUIREMENTS §6.1 第 3/4 项：
 * - 降级决策函数（classifyError 各错误类型 → 降级类别）
 * - 渲染库封装层 mock：解析成功 / 抛错 / 状态错误 / 超时 / dispose 清理
 *
 * 说明：§6.1 的"取消（请求序号丢弃旧结果）"逻辑位于 React 组件层
 * （index.tsx 的 seqRef），组件级断言需引入测试 DOM 环境，该路径由
 * §6.3 宿主端到端场景 #3（连续快速切换）覆盖，此处不重复 mock React。
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

import { mountViewer } from "@file-viewer/core/browser"

vi.mock("@file-viewer/core/browser", () => ({ mountViewer: vi.fn() }))
vi.mock("@file-viewer/renderer-word", () => ({ wordRenderer: { id: "word" } }))
vi.mock("@file-viewer/renderer-spreadsheet", () => ({ spreadsheetRenderer: { id: "spreadsheet" } }))
vi.mock("@file-viewer/renderer-presentation", () => ({ presentationRenderer: { id: "presentation" } }))

import { classifyError, getAdapter, type RenderFailure } from "../src/loaders/loader"

const mockedMount = vi.mocked(mountViewer)

/** mountViewer 被调用后捕获到的回调集合（用于模拟 viewer 行为） */
interface CapturedHooks {
  onLoadComplete: (ctx: { duration?: number }) => void
  onStateChange: (state: unknown) => void
  onError: (err: unknown) => void
}

let hooks: CapturedHooks | null
let destroySpy: ReturnType<typeof vi.fn>
let replaceChildrenSpy: ReturnType<typeof vi.fn>

function fakeContainer(): HTMLElement {
  replaceChildrenSpy = vi.fn()
  // node 环境无 DOM；loader 只用到 shadowRoot（可选）与 replaceChildren
  return { shadowRoot: undefined, replaceChildren: replaceChildrenSpy } as unknown as HTMLElement
}

function makeRequest() {
  return {
    family: "word" as const,
    bytes: new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]),
    fileName: "样例.doc",
    container: fakeContainer(),
  }
}

beforeEach(() => {
  hooks = null
  destroySpy = vi.fn()
  mockedMount.mockReset()
  mockedMount.mockImplementation(((container: HTMLElement, opts: never, core: never) => {
    const o = opts as {
      onStateChange: (s: unknown) => void
      options: { hooks: { onLoadComplete: (ctx: { duration?: number }) => void } }
    }
    const c = core as { onError: (err: unknown) => void }
    hooks = { onLoadComplete: o.options.hooks.onLoadComplete, onStateChange: o.onStateChange, onError: c.onError }
    return { destroy: destroySpy } as unknown as ReturnType<typeof mountViewer>
  }) as typeof mountViewer)
})

describe("classifyError（降级决策）", () => {
  it("unsupported → not-supported", () => {
    expect(classifyError(new Error("unsupported format"))).toEqual({ level: "error", kind: "not-supported" })
  })
  it("password/encrypt/corrupt/invalid/parse → corrupt", () => {
    for (const msg of ["password required", "encrypted file", "corrupt header", "invalid CFB", "parse error"]) {
      expect(classifyError(new Error(msg))).toEqual({ level: "error", kind: "corrupt" })
    }
  })
  it("其他错误 → internal", () => {
    expect(classifyError(new Error("boom"))).toEqual({ level: "error", kind: "internal" })
  })
  it("null/undefined → internal", () => {
    expect(classifyError(null)).toEqual({ level: "error", kind: "internal" })
    expect(classifyError(undefined)).toEqual({ level: "error", kind: "internal" })
  })
})

describe("getAdapter.render（封装层 mock）", () => {
  it("解析成功：onLoadComplete 触发 resolve，携带耗时文案；file 以 ArrayBuffer 传入", async () => {
    const adapter = getAdapter("word")
    const req = makeRequest()
    const promise = adapter.render(req)
    expect(hooks).not.toBeNull()
    hooks!.onLoadComplete({ duration: 123.4 })
    const summary = await promise
    expect(summary.statusText).toContain("123")
    // Uint8Array → 独立 ArrayBuffer
    const callArg = mockedMount.mock.calls[0][1] as { file: unknown }
    expect(callArg.file).toBeInstanceOf(ArrayBuffer)
  })

  it("无 duration 时 resolve 缺省文案", async () => {
    const adapter = getAdapter("word")
    const promise = adapter.render(makeRequest())
    hooks!.onLoadComplete({})
    const summary = await promise
    expect(summary.statusText).not.toContain("ms")
  })

  it("onError 抛错 → reject 并按信息分类（corrupt）", async () => {
    const adapter = getAdapter("word")
    const promise = adapter.render(makeRequest())
    hooks!.onError(new Error("password protected"))
    await expect(promise).rejects.toEqual({ level: "error", kind: "corrupt" } satisfies RenderFailure)
  })

  it("onError not-supported → reject not-supported", async () => {
    const adapter = getAdapter("spreadsheet")
    const promise = adapter.render(makeRequest())
    hooks!.onError(new Error("unsupported"))
    await expect(promise).rejects.toEqual({ level: "error", kind: "not-supported" })
  })

  it("onStateChange 错误 → reject", async () => {
    const adapter = getAdapter("presentation")
    const promise = adapter.render(makeRequest())
    hooks!.onStateChange({ error: new Error("parse failed") })
    await expect(promise).rejects.toEqual({ level: "error", kind: "corrupt" })
  })

  it("resolve 后重复回调被忽略（settled 幂等）", async () => {
    const adapter = getAdapter("word")
    const promise = adapter.render(makeRequest())
    hooks!.onLoadComplete({ duration: 10 })
    await expect(promise).resolves.toBeDefined()
    // 迟到的错误回调不得改变已 resolve 的结果
    hooks!.onError(new Error("late error"))
    await expect(promise).resolves.toBeDefined()
  })

  it("挂载超时（30s）→ reject internal", async () => {
    vi.useFakeTimers()
    try {
      const adapter = getAdapter("word")
      const promise = adapter.render(makeRequest())
      vi.advanceTimersByTime(30_000)
      await expect(promise).rejects.toEqual({ level: "error", kind: "internal" })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe("getAdapter.dispose（卸载清理）", () => {
  it("dispose 调用 viewer destroy 并清空容器", async () => {
    const adapter = getAdapter("word")
    const promise = adapter.render(makeRequest())
    hooks!.onLoadComplete({ duration: 5 })
    await promise
    adapter.dispose()
    expect(destroySpy).toHaveBeenCalledTimes(1)
    expect(replaceChildrenSpy).toHaveBeenCalledTimes(1)
  })

  it("未 render 直接 dispose 不抛错", () => {
    const adapter = getAdapter("word")
    expect(() => adapter.dispose()).not.toThrow()
    expect(destroySpy).not.toHaveBeenCalled()
  })

  it("destroy 抛错被吞掉（切换文件场景不致命）", async () => {
    const adapter = getAdapter("word")
    const promise = adapter.render(makeRequest())
    hooks!.onLoadComplete({ duration: 5 })
    await promise
    destroySpy.mockImplementation(() => {
      throw new Error("destroy failed")
    })
    expect(() => adapter.dispose()).not.toThrow()
  })
})

describe("getAdapter.setTheme（主题联动）", () => {
  it("dispose 后调用 setTheme 静默跳过", () => {
    const adapter = getAdapter("word")
    adapter.dispose()
    expect(() => adapter.setTheme("dark")).not.toThrow()
  })
})
