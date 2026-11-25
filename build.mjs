import { build } from "esbuild"
import { copyFile, mkdir, stat } from "node:fs/promises"

// GeWu 插件打包硬约束（见 REQUIREMENTS.md §2.5）：
// 1. 产物必须是单文件 ESM（宿主经 Blob URL import 加载，无法解析代码分割 chunk）
// 2. react / react-dom / react/jsx-runtime / plugin-protocol / kmgr-api / workspace 由宿主提供，必须 external
const EXTERNAL = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "plugin-protocol",
  "kmgr-api",
  "workspace",
]

await mkdir("dist", { recursive: true })

await build({
  entryPoints: ["src/index.tsx"],
  bundle: true,
  format: "esm",
  outfile: "dist/index.js",
  jsx: "automatic",
  external: EXTERNAL,
  // 单文件自包含：任何动态 import 目标要么是 external 的宿主模块，要么报错
  splitting: false,
  logLevel: "info",
})

await copyFile("manifest.json", "dist/manifest.json")
// Apache-2.0/MIT 合规：许可证文本与 NOTICE 随分发
await copyFile("THIRD-PARTY-NOTICES.md", "dist/THIRD-PARTY-NOTICES.md")

const info = await stat("dist/index.js")
console.log(`✅ 打包完成：dist/index.js（${(info.size / 1024).toFixed(0)} KB）+ dist/manifest.json + THIRD-PARTY-NOTICES.md`)
