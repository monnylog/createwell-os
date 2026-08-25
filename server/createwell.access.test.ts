import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * v3 access boundaries.
 *
 * The v3 router exposes exactly two public reads and four protected team
 * reads. There is no admin router, no tasks router, no check-ins router,
 * and no mutations. See the comment block at the top of server/routers.ts.
 *
 * These tests assert the boundary, not the Notion payload. A route that
 * fails because a Notion credential is missing is still a route that passed
 * its auth gate, so the protected-access assertions check only that the
 * error is NOT an auth rejection.
 */

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

function procedurePaths(): string[] {
  return Object.keys(
    (appRouter as unknown as { _def: { procedures: Record<string, unknown> } })
      ._def.procedures
  );
}

async function errorCodeOf(
  run: () => Promise<unknown>
): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    return (error as { code?: string }).code ?? "UNKNOWN";
  }
}

describe("v3 public surface", () => {
  it("never rejects an anonymous caller for auth reasons", async () => {
    const caller = appRouter.createCaller(createContext(null));

    expect(
      await errorCodeOf(() => caller.createWell.public.content())
    ).not.toBe("UNAUTHORIZED");
    expect(await errorCodeOf(() => caller.createWell.public.flows())).not.toBe(
      "UNAUTHORIZED"
    );
  });

  it("exposes exactly two public procedures", () => {
    const publicPaths = procedurePaths().filter(path =>
      path.startsWith("createWell.public.")
    );

    expect(publicPaths.sort()).toEqual([
      "createWell.public.content",
      "createWell.public.flows",
    ]);
  });
});

describe("v3 team surface", () => {
  const routes = [
    [
      "profile",
      (caller: ReturnType<typeof appRouter.createCaller>) =>
        caller.createWell.team.profile(),
    ],
    [
      "programCalendar",
      (caller: ReturnType<typeof appRouter.createCaller>) =>
        caller.createWell.team.programCalendar(),
    ],
    [
      "editorialPipeline",
      (caller: ReturnType<typeof appRouter.createCaller>) =>
        caller.createWell.team.editorialPipeline(),
    ],
    [
      "moves.list",
      (caller: ReturnType<typeof appRouter.createCaller>) =>
        caller.createWell.team.moves.list(),
    ],
  ] as const;

  for (const [name, call] of routes) {
    it(`rejects an anonymous caller on team.${name}`, async () => {
      const caller = appRouter.createCaller(createContext(null));

      expect(await errorCodeOf(() => call(caller))).toBe("UNAUTHORIZED");
    });
  }

  for (const [name, call] of routes) {
    it(`admits a signed-in non-admin on team.${name}`, async () => {
      const caller = appRouter.createCaller(createContext("user"));

      // May still fail on Notion configuration. It must not fail on auth.
      const code = await errorCodeOf(() => call(caller));
      expect(code).not.toBe("UNAUTHORIZED");
      expect(code).not.toBe("FORBIDDEN");
    });
  }
});

describe("v3 removals stay removed", () => {
  it("has no admin router", () => {
    expect(
      procedurePaths().filter(path => path.startsWith("createWell.admin"))
    ).toEqual([]);
  });

  it("has no tasks or check-ins routes", () => {
    const retired = procedurePaths().filter(
      path =>
        path.includes(".tasks") ||
        path.includes(".checkIns") ||
        path.includes(".offers")
    );

    expect(retired).toEqual([]);
  });

  it("exposes no mutation under createWell", () => {
    const procedures = (
      appRouter as unknown as {
        _def: { procedures: Record<string, { _def?: { type?: string } }> };
      }
    )._def.procedures;

    const mutations = Object.entries(procedures)
      .filter(([path]) => path.startsWith("createWell."))
      .filter(([, procedure]) => procedure?._def?.type === "mutation")
      .map(([path]) => path);

    expect(mutations).toEqual([]);
  });
});
