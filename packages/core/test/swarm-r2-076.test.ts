import { describe, expect, it } from "vitest";
import { pickDownvoters } from "../src/pipelines/reactions";

describe("R2-076: reaction dismissals require membership", () => {
  it("ignores 👎 from outsiders", () => {
    const outsider = {
      content: "-1",
      user: { login: "attacker" },
      author_association: "NONE",
    } as any;
    expect(pickDownvoters([outsider])).toEqual([]);
  });

  it("keeps 👎 from members", () => {
    const member = {
      content: "-1",
      user: { login: "teammate" },
      author_association: "MEMBER",
    } as any;
    expect(pickDownvoters([member])).toEqual(["teammate"]);
  });
});
