// M2 spike：验证 @file-viewer/core + 三个渲染器可否打成单文件 ESM
// react 系列按 external（模拟真实插件条件，由宿主提供）
import { mountViewer } from "@file-viewer/core/browser"
import { wordRenderer } from "@file-viewer/renderer-word"
import { spreadsheetRenderer } from "@file-viewer/renderer-spreadsheet"
import { presentationRenderer } from "@file-viewer/renderer-presentation"

export function mountOfficeViewer(container, buffer, filename) {
  return mountViewer(container, {
    buffer,
    filename,
    onEvent: (e) => console.log("[EV]", (e && e.type) || typeof e, JSON.stringify(e).slice(0, 200)),
    options: {
      rendererMode: "replace",
      builtinRenderers: "none",
      renderers: [wordRenderer, spreadsheetRenderer, presentationRenderer],
      locale: "zh-CN",
      toolbar: true,
      onDiagnostic: (d) => console.log("[DIAG]", d?.level, d?.code, d?.message),
    },
  }, {
    onError: (err, src) => console.log("[ERRCB]", String(err).slice(0, 200), JSON.stringify(src)),
  })
}
