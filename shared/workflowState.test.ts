import { describe, expect, it } from "vitest";
import { getCollectionState } from "./workflowState";

describe("dashboard collection feedback states", () => {
  it("prioritizes loading and errors before content availability", () => {
    expect(getCollectionState({ isLoading: true, isError: false, count: 0 })).toBe("loading");
    expect(getCollectionState({ isLoading: false, isError: true, count: 2 })).toBe("error");
  });

  it("distinguishes an empty well from a ready collection", () => {
    expect(getCollectionState({ isLoading: false, isError: false, count: 0 })).toBe("empty");
    expect(getCollectionState({ isLoading: false, isError: false, count: 1 })).toBe("ready");
  });
});
