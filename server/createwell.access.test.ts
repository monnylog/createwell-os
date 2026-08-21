import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(role: "user" | "admin" | null): TrpcContext {
  return {
    user: role
      ? {
          id: 1,
          openId: "createwell-test-user",
          name: "Create Well Test User",
          email: "test@example.com",
          loginMethod: "manus",
          role,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        }
      : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("Create Well server access boundaries", () => {
  it("rejects unauthenticated team access before requesting Notion data", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.createWell.team.tasks.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.createWell.team.programCalendar()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects non-admin access to Needs and Decisions before requesting Notion data", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.createWell.admin.needs()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.createWell.admin.decisions()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
