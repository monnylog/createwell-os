import crypto from "node:crypto";

export type IdempotencyReplay<T> = {
  kind: "fresh" | "replay" | "conflict";
  response?: T;
};

type StoredResponse<T> = {
  payloadHash: string;
  response: T;
  expiresAt: number;
};

export class IdempotencyStore<T> {
  private readonly entries = new Map<string, StoredResponse<T>>();

  read(key: string, payloadHash: string): IdempotencyReplay<T> {
    const existing = this.entries.get(key);
    if (!existing || existing.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return { kind: "fresh" };
    }
    if (existing.payloadHash !== payloadHash) return { kind: "conflict" };
    return { kind: "replay", response: existing.response };
  }

  write(key: string, payloadHash: string, response: T, ttlMs: number) {
    this.entries.set(key, { payloadHash, response, expiresAt: Date.now() + ttlMs });
  }

  clear() {
    this.entries.clear();
  }
}

export function createPayloadHash(payload: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function verifyNotionWebhookSignature(rawBody: Buffer, signature: string | undefined, verificationToken: string) {
  if (!signature || !verificationToken) return false;
  const expected = crypto.createHmac("sha256", verificationToken).update(rawBody).digest("hex");
  const received = signature.replace(/^sha256=/, "");
  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}
