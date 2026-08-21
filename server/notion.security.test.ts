import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { createPayloadHash, IdempotencyStore, verifyNotionWebhookSignature } from "./notion/security";

describe("Create Well idempotency store", () => {
  it("replays only a matching payload and rejects a key reused with different content", () => {
    const store = new IdempotencyStore<{ recordId: string }>();
    const firstHash = createPayloadHash({ drop: "First idea" });
    store.write("visitor:key", firstHash, { recordId: "topic-1" }, 60_000);

    expect(store.read("visitor:key", firstHash)).toEqual({ kind: "replay", response: { recordId: "topic-1" } });
    expect(store.read("visitor:key", createPayloadHash({ drop: "Different idea" }))).toEqual({ kind: "conflict" });
  });
});

describe("Notion webhook signature validation", () => {
  it("accepts the correct HMAC signature and rejects a changed payload", () => {
    const token = "verification-token";
    const body = Buffer.from('{"event":"page.content_updated"}');
    const signature = crypto.createHmac("sha256", token).update(body).digest("hex");

    expect(verifyNotionWebhookSignature(body, signature, token)).toBe(true);
    expect(verifyNotionWebhookSignature(Buffer.from('{"event":"changed"}'), signature, token)).toBe(false);
  });
});
