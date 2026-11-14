import { describe, expect, it } from "vitest";
import { isCheckInsertWinner, statusForVerdict } from "../src/pipelines/check";

describe("R7-064 concurrent loser must not keep own verdict", () => {
  it("winner verdict drives GitHub status, not loser own verdict", () => {
    const winnerVerdict = "conflict" as const;
    const loserOwnVerdict = "clear" as const;
    // Conditional upsert discarded the loser's write: returning() is empty.
    const won = isCheckInsertWinner(undefined);
    expect(won).toBe(false);
    const verdictToReturn = won ? loserOwnVerdict : winnerVerdict;
    expect(verdictToReturn).toBe("conflict");
    expect(statusForVerdict(verdictToReturn, "broke rule").state).toBe("failure");
    expect(statusForVerdict(loserOwnVerdict).state).toBe("success");
  });

  it("winner keeps its own verdict", () => {
    const won = isCheckInsertWinner({ id: "check-1" });
    expect(won).toBe(true);
    const verdictToReturn = won ? "clear" as const : "conflict" as const;
    expect(verdictToReturn).toBe("clear");
    expect(statusForVerdict(verdictToReturn).state).toBe("success");
  });
});
