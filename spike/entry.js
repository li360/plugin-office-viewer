// M2 spike：验证 @file-viewer/core + 三个渲染器可否打成单文件 ESM
// react 系列按 external（模拟真实插件条件，由宿主提供）
import { mountViewer } from "@file-viewer/core/browser"
import { wordRenderer } from "@file-viewer/renderer-word"
import { spreadsheetRenderer } from "@file-viewer/renderer-spreadsheet"
import { presentationRenderer } from "@file-viewer/renderer-presentation"

const bytes = new Uint8Array(8192)
bytes.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])

export function mountOfficeViewer(container, buffer, filename) {
  return mountViewer(container, {
    buffer,
    filename,
    options: {
      rendererMode: "replace",
      builtinRenderers: "none",
      renderers: [wordRenderer, spreadsheetRenderer, presentationRenderer],
      locale: "zh-CN",
      toolbar: true,
      styleIsolation: "shadow",
    },
  })
}

// 自检挂载（仅 spike 用）
if (typeof document !== "undefined") {
  const el = document.createElement("div")
  document.body.appendChild(el)
  mountOfficeViewer(el, bytes.buffer, "sample.doc")
}
