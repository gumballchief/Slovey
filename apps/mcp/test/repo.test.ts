import { describe, expect, it } from "vitest";
import { ConfigError, parseRepoSlug } from "../src/repo";

describe("parseRepoSlug", () => {
  it("parses a plain owner/name", () => {
    expect(parseRepoSlug("acme/widgets")).toEqual({ owner: "acme", name: "widgets", slug: "acme/widgets" });
  });

  it("accepts a full GitHub URL and strips .git / trailing slash", () => {
    expect(parseRepoSlug("https://github.com/acme/widgets.git").slug).toBe("acme/widgets");
    expect(parseRepoSlug("https://github.com/acme/widgets/").slug).toBe("acme/widgets");
  });

  it("trims surrounding whitespace", () => {
    expect(parseRepoSlug("  acme/widgets  ").slug).toBe("acme/widgets");
  });

  it("requires the variable to be set", () => {
    expect(() => parseRepoSlug(undefined)).toThrow(ConfigError);
    expect(() => parseRepoSlug("")).toThrow(/not set/);
  });

  it("rejects an ambiguous slug (missing owner or name)", () => {
    expect(() => parseRepoSlug("widgets")).toThrow(ConfigError);
    expect(() => parseRepoSlug("acme/")).toThrow(/valid/);
    expect(() => parseRepoSlug("a/b/c")).toThrow(ConfigError);
  });

  it("rejects invalid characters", () => {
    expect(() => parseRepoSlug("acme/widg ets")).toThrow(/invalid characters/);
    expect(() => parseRepoSlug("acme/widg;ets")).toThrow(ConfigError);
  });
});
