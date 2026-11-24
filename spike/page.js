// M2 runtime smoke：浏览器挂载真实 .xls（BIFF8），验证渲染管线
import * as XLSX from "xlsx"
import { mountOfficeViewer } from "./lib.js"

const statusEl = document.getElementById("status")

function report(msg, ok) {
  const line = document.createElement("div")
  line.textContent = (ok ? "OK " : "ERR ") + msg
  line.style.color = ok ? "#0a0" : "#c00"
  statusEl.appendChild(line)
  console.log((ok ? "[OK] " : "[ERR] ") + msg)
}

window.__errors = []
window.addEventListener("error", (e) => window.__errors.push(String(e.error ?? e.message)))

// 生成真实 BIFF8 .xls 字节
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
  ["名称", "数量", "备注"],
  ["项目 A", 3, "示例"],
  ["项目 B", 7, ""],
]), "样例")
const xlsRaw = XLSX.write(wb, { bookType: "xls", type: "array" })
const xlsBytes = xlsRaw instanceof ArrayBuffer ? new Uint8Array(xlsRaw.slice(0)) : new Uint8Array(xlsRaw.buffer.slice(0))
report(`生成 .xls 字节：${xlsBytes.byteLength} B`, xlsBytes.byteLength > 0)

const container = document.getElementById("viewer")
const started = performance.now()
const controller = mountOfficeViewer(container, xlsBytes.buffer, "样例.xls")
const elapsed = Math.round(performance.now() - started)
report(`mountViewer 返回（${elapsed}ms），controller=${controller ? "有" : "无"}`, !!controller)

controller.subscribe?.((state) => {
  report(
    `state: loading=${state.loading} ready=${state.ready} error=${state.error ? JSON.stringify(String(state.error)).slice(0, 120) : "null"}`,
    !state.error,
  )
})

// 记录挂载后 8 秒内的网络请求（离线约束验证）
window.__networkRequests = []
const origFetch = window.fetch
window.fetch = (...args) => {
  window.__networkRequests.push(String(args[0]))
  return origFetch(...args)
}
const origOpen = XMLHttpRequest.prototype.open
XMLHttpRequest.prototype.open = function (method, url, ...rest) {
  window.__networkRequests.push(String(url))
  return origOpen.call(this, method, url, ...rest)
}

setTimeout(() => {
  const shadowHosts = container.querySelectorAll("*")
  report(`容器内 DOM 节点数：${shadowHosts.length}`, shadowHosts.length > 0)
  report(
    `网络请求数（8s 窗口）：${window.__networkRequests.length}`,
    window.__networkRequests.length === 0,
  )
  report(`页面错误数：${window.__errors.length}`, window.__errors.length === 0)
  window.__smokeDone = true
}, 8000)
