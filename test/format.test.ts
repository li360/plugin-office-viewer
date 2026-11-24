import { describe, expect, it } from "vitest"

import {
  checkMagic,
  extOf,
  formatBytes,
  formatForExt,
  isOversize,
  isSupportedExt,
  isUsableBinary,
  PREFERRED_EXTENSIONS,
} from "../src/format"

const CFB = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x01])
const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00])
const JUNK = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09])
const SHORT = new Uint8Array([0xd0, 0xcf, 0x11])

describe("formatForExt", () => {
  it("映射六种扩展名到格式族", () => {
    expect(formatForExt(".doc")).toBe("word")
    expect(formatForExt(".dot")).toBe("word")
    expect(formatForExt(".xls")).toBe("spreadsheet")
    expect(formatForExt(".xlt")).toBe("spreadsheet")
    expect(formatForExt(".ppt")).toBe("presentation")
    expect(formatForExt(".pot")).toBe("presentation")
  })

  it("大小写不敏感", () => {
    expect(formatForExt(".DOC")).toBe("word")
    expect(formatForExt(".Xls")).toBe("spreadsheet")
  })

  it("不支持 OOXML 与未知扩展名", () => {
    expect(formatForExt(".docx")).toBeNull()
    expect(formatForExt(".xlsx")).toBeNull()
    expect(formatForExt(".pptx")).toBeNull()
    expect(formatForExt(".txt")).toBeNull()
    expect(formatForExt("")).toBeNull()
  })

  it("PREFERRED_EXTENSIONS 覆盖全部映射键", () => {
    expect(PREFERRED_EXTENSIONS).toHaveLength(6)
    for (const ext of PREFERRED_EXTENSIONS) {
      expect(isSupportedExt(ext)).toBe(true)
    }
    expect(isSupportedExt(".docx")).toBe(false)
  })
})

describe("checkMagic", () => {
  it("识别 CFB 容器（旧版 Office）", () => {
    expect(checkMagic(CFB)).toEqual({ ok: true, container: "cfb" })
  })

  it("拒绝 ZIP 容器（伪装的 OOXML）", () => {
    expect(checkMagic(ZIP)).toEqual({ ok: false, reason: "zip-container" })
  })

  it("拒绝未知魔数", () => {
    expect(checkMagic(JUNK)).toEqual({ ok: false, reason: "unknown" })
  })

  it("拒绝过短文件", () => {
    expect(checkMagic(SHORT)).toEqual({ ok: false, reason: "too-short" })
    expect(checkMagic(new Uint8Array(0))).toEqual({ ok: false, reason: "too-short" })
  })
})

describe("extOf", () => {
  it("提取小写扩展名", () => {
    expect(extOf("D:/kb/docs/报告.DOC")).toBe(".doc")
    expect(extOf("a/b/c.xls")).toBe(".xls")
    expect(extOf("noext")).toBe("")
  })
})

describe("isOversize", () => {
  it("word/spreadsheet 上限 50MB，presentation 100MB", () => {
    expect(isOversize("word", 50_000_000)).toBe(false)
    expect(isOversize("word", 50_000_001)).toBe(true)
    expect(isOversize("spreadsheet", 50_000_001)).toBe(true)
    expect(isOversize("presentation", 100_000_000)).toBe(false)
    expect(isOversize("presentation", 100_000_001)).toBe(true)
  })
})

describe("isUsableBinary", () => {
  it("仅接受 Uint8Array 预载内容", () => {
    expect(isUsableBinary(CFB)).toBe(true)
    expect(isUsableBinary("text")).toBe(false)
    expect(isUsableBinary(undefined)).toBe(false)
  })
})

describe("formatBytes", () => {
  it("人类可读大小", () => {
    expect(formatBytes(512)).toBe("512 B")
    expect(formatBytes(2048)).toBe("2.0 KB")
    expect(formatBytes(51_000_000)).toBe("48.6 MB")
  })
})
