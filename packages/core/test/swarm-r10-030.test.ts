import { describe, expect, it } from "vitest";
import { classifyContentData } from "../src/pipelines/agent";

const b64 = (bytes: number[]) => Buffer.from(bytes).toString("base64");
const textB64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

describe("R10-030: distinguish missing file from directory/submodule/binary", () => {
  it("classifies a regular text blob as text", () => {
    expect(classifyContentData({ type: "file", encoding: "base64", content: textB64("hello world\n") })).toBe("text");
  });
  it("classifies directory listings as directory, not missing", () => {
    expect(classifyContentData([])).toBe("directory");
    expect(classifyContentData({ type: "dir" })).toBe("directory");
  });
  it("classifies submodules as submodule, not missing", () => {
    expect(classifyContentData({ type: "submodule", sha: "abc123" })).toBe("submodule");
  });
  it("classifies binary/unsupported blobs as binary, not missing", () => {
    // PNG magic + NUL byte (image/font/wasm/parquet style payload)
    expect(classifyContentData({ type: "file", encoding: "base64", content: b64([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]) })).toBe("binary");
    // Large-file / unsupported encoding must not look like a 404 either
    expect(classifyContentData({ type: "file", encoding: "none", sha: "abc" })).toBe("binary");
  });
});
