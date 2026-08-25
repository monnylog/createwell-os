import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { readPublicCache } from "./notion/cache";
import {
  getApprovedContent,
  getTeamProfile,
  getUpcomingPublicFlows,
  listDataSourceRecords,
  listFlows,
  listMoves,
} from "./notion/service";
import { notionConfig } from "./notion/config";

/**
 * Create Well OS v3.
 *
 * The public surface is two reads: approved CONTENT and upcoming public FLOWS.
 * There is no public write, no MONEY route, and no PEOPLE route.
 *
 * Removed in v3: `public.offers` (Offers retired — the seven Well layers are
 * the FLOWS.Type select), `team.checkIns`, `admin.needs`, `admin.decisions`,
 * and every mutation. See docs/v3-domain-map.md.
 */
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  createWell: router({
    public: router({
      content: publicProcedure.query(() =>
        readPublicCache("content", getApprovedContent)
      ),
      flows: publicProcedure.query(() =>
        readPublicCache("flows", getUpcomingPublicFlows)
      ),
    }),
    team: router({
      profile: protectedProcedure.query(({ ctx }) => getTeamProfile(ctx.user)),
      programCalendar: protectedProcedure.query(() => listFlows()),
      editorialPipeline: protectedProcedure.query(() =>
        listDataSourceRecords(notionConfig.dataSourceIds.content)
      ),
      moves: router({
        list: protectedProcedure.query(() => listMoves()),
      }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
