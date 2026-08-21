import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { readPublicCache } from "./notion/cache";
import { checkInInputSchema, taskCreateInputSchema } from "./notion/schemas";
import {
  createCheckIn,
  createTask,
  getActiveOffers,
  getApprovedContent,
  getUpcomingEvents,
  listCheckIns,
  listDataSourceRecords,
  listDecisions,
  listNeeds,
  listTasks,
  resolvePersonPageId,
} from "./notion/service";
import { notionConfig } from "./notion/config";

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
      content: publicProcedure.query(() => readPublicCache("content", getApprovedContent)),
      offers: publicProcedure.query(() => readPublicCache("offers", getActiveOffers)),
      events: publicProcedure.query(() => readPublicCache("events", getUpcomingEvents)),
    }),
    team: router({
      programCalendar: protectedProcedure.query(() => listDataSourceRecords(notionConfig.dataSourceIds.events)),
      editorialPipeline: protectedProcedure.query(() => listDataSourceRecords(notionConfig.dataSourceIds.content)),
      tasks: router({
        list: protectedProcedure.query(() => listTasks()),
        create: protectedProcedure.input(taskCreateInputSchema).mutation(async ({ ctx, input }) => {
          const personPageId = await resolvePersonPageId(ctx.user);
          return createTask(input, personPageId);
        }),
      }),
      checkIns: router({
        list: protectedProcedure.query(async ({ ctx }) => {
          const personPageId = await resolvePersonPageId(ctx.user);
          return listCheckIns(personPageId);
        }),
        create: protectedProcedure.input(checkInInputSchema).mutation(async ({ ctx, input }) => {
          const personPageId = await resolvePersonPageId(ctx.user);
          return createCheckIn(input, personPageId, ctx.user.name);
        }),
      }),
    }),
    admin: router({
      needs: adminProcedure.query(() => listNeeds()),
      decisions: adminProcedure.query(() => listDecisions()),
    }),
  }),
});

export type AppRouter = typeof appRouter;
