import { describe, expect, it } from "vitest";
import { consumeTopicWellRateLimit, resetTopicWellSafeguardsForTests } from "./routes/createwell";

describe("Topic Well rate limiting", () => {
  it("blocks the ninth submission from the same source within the 15-minute window", () => {
    resetTopicWellSafeguardsForTests();

    for (let attempt = 0; attempt < 8; attempt += 1) {
      expect(consumeTopicWellRateLimit("203.0.113.8")).toBe(true);
    }

    expect(consumeTopicWellRateLimit("203.0.113.8")).toBe(false);
  });
});
