import { describe, expect, it } from "vitest";
import { readPublicCache, resetPublicCacheForTests } from "./notion/cache";
import { checkInInputSchema, topicWellInputSchema } from "./notion/schemas";

describe("Create Well public intake safeguards", () => {
  it("rejects topic drops that are too short to be actionable", () => {
    expect(
      topicWellInputSchema.safeParse({
        name: "Too brief",
        drop: "Not enough detail",
      }).success
    ).toBe(false);
  });

  it("accepts a complete public topic drop and defaults it to anonymous", () => {
    const result = topicWellInputSchema.parse({
      name: "Creative work after a hard week",
      drop: "How do we make room for creative practice when the body is tired and shared time is limited?",
    });
    expect(result.anonymous).toBe(true);
    expect(result.source).toBe("Public Form");
  });

  it("limits check-ins to the supported operational vocabulary", () => {
    expect(
      checkInInputSchema.safeParse({
        mood: "Unsupported mood",
        absorption: "Steady",
        bodyStatus: "Restoring",
      }).success
    ).toBe(false);
  });
});

describe("Create Well public cache", () => {
  it("reuses a public response inside the cache window", async () => {
    resetPublicCacheForTests();
    let calls = 0;
    const first = await readPublicCache("test", async () => ({
      calls: ++calls,
    }));
    const second = await readPublicCache("test", async () => ({
      calls: ++calls,
    }));

    expect(first).toEqual({ calls: 1 });
    expect(second).toEqual({ calls: 1 });
  });
});
