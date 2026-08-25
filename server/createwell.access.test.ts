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

    // Every route under createWell.team is a protectedProcedure. An anonymous
    // caller must be turned away here, before any Notion request is made.
    await expect(caller.createWell.team.profile()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.createWell.team.programCalendar()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller.createWell.team.editorialPipeline()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller.createWell.team.moves.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  /**
   * Skipped, not deleted.
   *
   * This test asserted that a signed-in non-admin got FORBIDDEN from
   * admin.needs and admin.decisions. Those were the only role-gated routes in
   * the application, and v3 ships no `admin` router at all — Needs and
   * Decisions are paused as private, page-based work until the permission model
   * is proven. Every surviving route is either public or merely authenticated,
   * so there is currently no FORBIDDEN boundary to assert.
   *
   * Restore this the moment a role-gated route returns. The createContext
   * helper still accepts "admin" and "user", so re-enabling is a one-line
   * change plus the new route names. Leaving it skipped keeps the missing
   * boundary visible in every test run instead of quietly dropping the
   * guarantee.
   */
  it.skip("rejects non-admin access to role-gated routes before requesting Notion data", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    void caller;
  });
});
