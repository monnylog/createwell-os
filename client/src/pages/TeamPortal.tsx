import { useMemo } from "react";
import {
  AlertCircle,
  CalendarDays,
  Clock,
  ListChecks,
  Loader2,
  RefreshCw,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

/**
 * Create Well OS v3 — Team Portal.
 *
 * A read-only surface. Notion writes. The repo remembers. The site reads.
 * Nothing writes backward.
 *
 * Removed in v3:
 *   - Task creation. Moves are created in Notion, not here.
 *   - Check-ins. The mood / absorption / body-status form was real work, and it
 *     is removed only because Check-ins have no home among the five databases.
 *     The budget is fixed: five databases, three automations, six views. Bringing
 *     the form back means deliberately deleting a database, not quietly adding
 *     a sixth. Until then a form that writes nowhere is worse than no form.
 *   - Needs and Decisions. These stay private and page-based until the
 *     permission model is proven.
 *
 * See docs/v3-domain-map.md.
 */

const PRE_MARKETING_PHASES = ["Cohoe", "Concepting"];
const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1_000;

type FlowLike = {
  id: string;
  name?: string;
  type?: string;
  status?: string;
  phase?: string;
  date?: string;
  venue?: string;
};

type MoveLike = {
  id: string;
  name?: string;
  type?: string;
  status?: string;
  due?: string;
  blockedBy?: string;
  phase?: string;
  nextAction?: string;
};

function titleForRecord(record: { name?: string; id: string }) {
  return record.name?.trim() || "Untitled";
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function isoFourWeeksOut() {
  return new Date(Date.now() + FOUR_WEEKS_MS).toISOString().slice(0, 10);
}

/**
 * A Flow close enough that promotion should be underway, but whose Phase says it
 * is not. Blank Phase counts as not started. Mirrors isMarketingOverdue on the
 * server; the operations guide sets a hard marketing start around four weeks out.
 */
function marketingOverdue(flow: FlowLike, today: string, fourWeeksOut: string) {
  if (!flow.date) return false;
  if (flow.date < today || flow.date > fourWeeksOut) return false;
  if (flow.status === "Cancelled") return false;
  return !flow.phase || PRE_MARKETING_PHASES.includes(flow.phase);
}

export default function TeamPortal() {
  const profileQuery = trpc.createWell.team.profile.useQuery();
  const calendarQuery = trpc.createWell.team.programCalendar.useQuery();
  const movesQuery = trpc.createWell.team.moves.list.useQuery();

  const today = isoToday();
  const fourWeeksOut = isoFourWeeksOut();

  const flows = (calendarQuery.data ?? []) as FlowLike[];
  const moves = (movesQuery.data ?? []) as MoveLike[];

  const needsMarketing = useMemo(
    () => flows.filter(flow => marketingOverdue(flow, today, fourWeeksOut)),
    [flows, today, fourWeeksOut],
  );

  const moveGroups = useMemo(() => {
    const order = ["Now", "Next", "Done", "Dropped"];
    const groups = new Map<string, MoveLike[]>();
    for (const move of moves) {
      const key = move.status?.trim() || "Unsorted";
      groups.set(key, [...(groups.get(key) ?? []), move]);
    }
    return [...groups.entries()].sort(
      ([left], [right]) =>
        (order.indexOf(left) + 1 || 99) - (order.indexOf(right) + 1 || 99),
    );
  }, [moves]);

  return (
    <div className="mx-auto max-w-7xl space-y-10 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#c8dbd6] pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#277b7d]">
            Create Well / Team Portal
          </p>
          <h1 className="mt-2 font-serif text-4xl tracking-[-0.03em] text-[#092f35]">
            The operating current.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#527174]">
            A quiet shared surface for what is gathering and what needs a human.
            Everything here is read from Notion. To change something, change it there.
          </p>
        </div>
        <Badge className="rounded-full bg-[#d6ebe5] px-3 py-1 text-[#155b5e] hover:bg-[#d6ebe5]">
          <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Notion-backed
        </Badge>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <article className="rounded-2xl border border-[#c8dbd6] bg-white p-6">
          <div className="flex items-start gap-3">
            <UserRound className="mt-1 h-5 w-5 text-[#277b7d]" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.17em] text-[#277b7d]">
                You
              </p>
              {profileQuery.isLoading ? (
                <div className="mt-3 h-6 w-40 animate-pulse rounded bg-[#dcebe7]" />
              ) : profileQuery.error ? (
                <p className="mt-2 text-sm text-[#ad443c]">
                  {profileQuery.error.message}
                </p>
              ) : (
                <>
                  <h2 className="mt-2 font-serif text-2xl text-[#153f43]">
                    {profileQuery.data?.name}
                  </h2>
                  <p className="mt-2 text-sm text-[#426568]">
                    {profileQuery.data?.role} · linked by {profileQuery.data?.linkedBy}
                  </p>
                </>
              )}
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-[#e0cdb4] bg-[#fdf6ec] p-6">
          <div className="flex items-start gap-3">
            <Clock className="mt-1 h-5 w-5 text-[#a26b2b]" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.17em] text-[#a26b2b]">
                Marketing watch
              </p>
              {calendarQuery.isLoading ? (
                <div className="mt-3 h-6 w-32 animate-pulse rounded bg-[#efdcc4]" />
              ) : needsMarketing.length === 0 ? (
                <>
                  <h2 className="mt-2 font-serif text-2xl text-[#5c3d16]">Clear</h2>
                  <p className="mt-2 text-sm text-[#7a5a30]">
                    Nothing inside four weeks is still waiting to be promoted.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="mt-2 font-serif text-2xl text-[#5c3d16]">
                    {needsMarketing.length} need promotion
                  </h2>
                  <ul className="mt-3 space-y-2">
                    {needsMarketing.slice(0, 4).map(flow => (
                      <li key={flow.id} className="text-sm text-[#7a5a30]">
                        <span className="font-medium text-[#5c3d16]">
                          {titleForRecord(flow)}
                        </span>{" "}
                        · {flow.date} · {flow.phase || "no phase set"}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-[#8a6a3f]">
                    Marketing starts hard around four weeks out.
                  </p>
                </>
              )}
            </div>
          </div>
        </article>
      </section>

      <section className="rounded-2xl bg-[#0f3f42] p-6 text-white">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ListChecks className="h-5 w-5 text-[#8ed7cd]" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.17em] text-[#a9e3da]">
                Moves
              </p>
              <h2 className="font-serif text-2xl">What needs a human.</h2>
            </div>
          </div>
          <Button
            onClick={() => movesQuery.refetch()}
            variant="outline"
            size="sm"
            className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        {movesQuery.isLoading ? (
          <div className="mt-7 grid gap-3 lg:grid-cols-3">
            {[1, 2, 3].map(item => (
              <div key={item} className="h-32 animate-pulse rounded-xl bg-white/10" />
            ))}
          </div>
        ) : movesQuery.error ? (
          <div className="mt-7 rounded-xl border border-[#e6b6aa]/50 bg-[#4e3534] p-4 text-sm text-[#ffe2dc]">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              The Moves current could not load.
            </div>
          </div>
        ) : moveGroups.length === 0 ? (
          <p className="mt-7 border-l border-[#8ed7cd] pl-4 text-sm text-white/70">
            No Moves are open. That is a good state.
          </p>
        ) : (
          <div className="mt-7 grid gap-3 lg:grid-cols-3">
            {moveGroups.map(([status, group]) => (
              <div key={status} className="rounded-xl bg-white/10 p-3">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#a9e3da]">
                  {status}
                </p>
                <div className="space-y-2">
                  {group.map(move => (
                    <article key={move.id} className="rounded-lg bg-white/10 p-3">
                      <p className="text-sm font-semibold">{titleForRecord(move)}</p>
                      <p className="mt-1 text-xs text-white/65">
                        {move.type || "Move"}
                        {move.due ? ` · due ${move.due}` : ""}
                      </p>
                      {move.blockedBy ? (
                        <p className="mt-1 text-xs text-[#ffd9cf]">
                          Blocked: {move.blockedBy}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <article className="rounded-2xl border border-[#c8dbd6] bg-white p-6">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-[#277b7d]" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.17em] text-[#277b7d]">
                Program Calendar
              </p>
              <h2 className="font-serif text-2xl">What is gathering.</h2>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {calendarQuery.isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin text-[#277b7d]" />
            ) : calendarQuery.error ? (
              <p className="text-sm text-[#ad443c]">The calendar could not load.</p>
            ) : flows.length === 0 ? (
              <p className="text-sm text-[#527174]">
                No Flows scheduled. The well is quiet.
              </p>
            ) : (
              flows.slice(0, 8).map(flow => (
                <div
                  key={flow.id}
                  className="flex justify-between gap-4 border-t border-[#e2ece8] pt-3"
                >
                  <div>
                    <p className="font-medium text-[#153f43]">{titleForRecord(flow)}</p>
                    <p className="mt-1 text-xs text-[#527174]">
                      {flow.type || "Flow"} · {flow.date || "no date set"}
                      {flow.venue ? ` · ${flow.venue}` : ""}
                    </p>
                  </div>
                  <div className="flex h-fit shrink-0 gap-2">
                    {flow.phase ? (
                      <Badge
                        variant="outline"
                        className="h-fit border-[#d4c2a6] text-[#8a6a3f]"
                      >
                        {flow.phase}
                      </Badge>
                    ) : null}
                    <Badge
                      variant="outline"
                      className="h-fit border-[#9dc9c1] text-[#277b7d]"
                    >
                      {flow.status || "Idea"}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>

          <p className="mt-5 border-t border-[#e2ece8] pt-4 text-xs text-[#527174]">
            Status is whether it is real. Phase is what work is live right now.
          </p>
        </article>
      </section>
    </div>
  );
}
