import { build } from "esbuild"
import { copyFile, mkdir, readFile, stat } from "node:fs/promises"

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

// 合规：官方发布脚本（MyProj/scripts/publish-plugin.ps1）打 ZIP 时只含
// index.js + manifest.json，THIRD-PARTY-NOTICES.md 不会进 ZIP。为保证
// Apache-2.0/MIT 的许可声明随分发产物走，把完整声明以 banner 注入 index.js。
const notices = await readFile("THIRD-PARTY-NOTICES.md", "utf8")

await build({
  entryPoints: ["src/index.tsx"],
  bundle: true,
  format: "esm",
  outfile: "dist/index.js",
  jsx: "automatic",
  external: EXTERNAL,
  // 单文件自包含：任何动态 import 目标要么是 external 的宿主模块，要么报错
  splitting: false,
  banner: { js: `/*\n${notices.replace(/\*\//g, "*∕")}\n*/` },
  logLevel: "info",
})

await copyFile("manifest.json", "dist/manifest.json")
// Apache-2.0/MIT 合规：许可证文本与 NOTICE 随分发
await copyFile("THIRD-PARTY-NOTICES.md", "dist/THIRD-PARTY-NOTICES.md")

const info = await stat("dist/index.js")
console.log(`✅ 打包完成：dist/index.js（${(info.size / 1024).toFixed(0)} KB）+ dist/manifest.json + THIRD-PARTY-NOTICES.md`)
