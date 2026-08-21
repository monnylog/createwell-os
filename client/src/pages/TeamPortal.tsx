import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { CalendarDays, ClipboardList, HeartPulse, Loader2, ScrollText, ShieldCheck, Sparkles } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

function titleForRecord(record: { name: string; status: string }) {
  return record.name || record.status || "Untitled record";
}

export default function TeamPortal() {
  const [taskForm, setTaskForm] = useState({ name: "", status: "Cohoe", phase: "Cohoe", priority: "", nextAction: "", due: "" });
  const [checkIn, setCheckIn] = useState({ mood: "Grounded", absorption: "Steady", bodyStatus: "Steady", reflection: "", shareLevel: "Private", followUpNeeded: false });
  const tasksQuery = trpc.createWell.team.tasks.list.useQuery();
  const calendarQuery = trpc.createWell.team.programCalendar.useQuery();
  const editorialQuery = trpc.createWell.team.editorialPipeline.useQuery();
  const checkInsQuery = trpc.createWell.team.checkIns.list.useQuery();
  const needsQuery = trpc.createWell.admin.needs.useQuery(undefined, { retry: false });
  const decisionsQuery = trpc.createWell.admin.decisions.useQuery(undefined, { retry: false });
  const taskCreate = trpc.createWell.team.tasks.create.useMutation({ onSuccess: () => { tasksQuery.refetch(); setTaskForm({ name: "", status: "Cohoe", phase: "Cohoe", priority: "", nextAction: "", due: "" }); } });
  const checkInCreate = trpc.createWell.team.checkIns.create.useMutation({ onSuccess: () => { checkInsQuery.refetch(); setCheckIn(current => ({ ...current, reflection: "", followUpNeeded: false })); } });

  const taskGroups = useMemo(() => (tasksQuery.data ?? []).reduce<Record<string, typeof tasksQuery.data>>((groups, task) => {
    const key = task.status || "Unsorted";
    groups[key] = [...(groups[key] ?? []), task];
    return groups;
  }, {}), [tasksQuery.data]);

  function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    taskCreate.mutate({ ...taskForm, due: taskForm.due || undefined });
  }

  function submitCheckIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    checkInCreate.mutate(checkIn as Parameters<typeof checkInCreate.mutate>[0]);
  }

  return <DashboardLayout>
    <div className="mx-auto max-w-7xl space-y-10 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#c8dbd6] pb-6">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#277b7d]">Create Well / Team Portal</p><h1 className="mt-2 font-serif text-4xl tracking-[-0.03em] text-[#092f35]">The operating current.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#527174]">A quiet shared surface for what needs attention, what is gathering, and what has already been decided.</p></div>
        <Badge className="rounded-full bg-[#d6ebe5] px-3 py-1 text-[#155b5e] hover:bg-[#d6ebe5]"><Sparkles className="mr-1.5 h-3.5 w-3.5" /> Notion-backed</Badge>
      </header>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_.7fr]">
        <div className="rounded-2xl bg-[#07343a] p-6 text-white sm:p-8"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.17em] text-[#8ed7cd]">Tasks</p><h2 className="mt-2 font-serif text-3xl">Move the next true thing.</h2></div><ClipboardList className="h-6 w-6 text-[#8ed7cd]" /></div>
          {tasksQuery.isLoading ? <Loader2 className="mt-8 h-5 w-5 animate-spin" /> : <div className="mt-7 grid gap-3 lg:grid-cols-3">{Object.entries(taskGroups).map(([status, tasks]) => <div key={status} className="rounded-xl bg-white/8 p-3"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#a9e3da]">{status}</p><div className="space-y-2">{tasks?.map(task => <article key={task.id} className="rounded-lg bg-white/8 p-3"><p className="text-sm font-semibold">{titleForRecord(task)}</p><p className="mt-1 text-xs text-white/65">{task.phase || task.type || "Unphased"}{task.nextAction ? ` · ${task.nextAction}` : ""}</p></article>)}</div></div>)}</div>}
        </div>
        <form onSubmit={submitTask} className="rounded-2xl border border-[#c8dbd6] bg-white p-6"><p className="text-xs font-semibold uppercase tracking-[0.17em] text-[#277b7d]">Add a task</p><div className="mt-4 grid gap-3"><Input required value={taskForm.name} onChange={event => setTaskForm(current => ({ ...current, name: event.target.value }))} placeholder="What needs movement?" /><Input required value={taskForm.phase} onChange={event => setTaskForm(current => ({ ...current, phase: event.target.value }))} placeholder="Phase" /><Input value={taskForm.nextAction} onChange={event => setTaskForm(current => ({ ...current, nextAction: event.target.value }))} placeholder="One next action" /><input type="date" value={taskForm.due} onChange={event => setTaskForm(current => ({ ...current, due: event.target.value }))} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" /><Button disabled={taskCreate.isPending} className="mt-2 rounded-full bg-[#166e70] hover:bg-[#0d5759]">{taskCreate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Place task</Button></div></form>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-[#c8dbd6] bg-white p-6"><div className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-[#277b7d]" /><div><p className="text-xs font-semibold uppercase tracking-[0.17em] text-[#277b7d]">Program Calendar</p><h2 className="font-serif text-2xl">What is gathering.</h2></div></div><div className="mt-5 space-y-3">{calendarQuery.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-[#277b7d]" /> : (calendarQuery.data ?? []).slice(0, 4).map(event => <div key={event.id} className="flex justify-between gap-4 border-t border-[#e2ece8] pt-3"><div><p className="font-medium text-[#153f43]">{event.name}</p><p className="mt-1 text-xs text-[#527174]">{event.type || "Program"} · {event.start || "Date pending"}</p></div><Badge variant="outline" className="h-fit border-[#9dc9c1] text-[#277b7d]">{event.status || "Planned"}</Badge></div>)}</div></article>
        <article className="rounded-2xl border border-[#c8dbd6] bg-white p-6"><div className="flex items-center gap-3"><ScrollText className="h-5 w-5 text-[#277b7d]" /><div><p className="text-xs font-semibold uppercase tracking-[0.17em] text-[#277b7d]">Editorial Pipeline</p><h2 className="font-serif text-2xl">Language in motion.</h2></div></div><div className="mt-5 space-y-3">{editorialQuery.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-[#277b7d]" /> : (editorialQuery.data ?? []).slice(0, 4).map(item => <div key={item.id} className="flex justify-between gap-4 border-t border-[#e2ece8] pt-3"><div><p className="font-medium text-[#153f43]">{item.name}</p><p className="mt-1 text-xs text-[#527174]">{item.type || "Content"}</p></div><Badge variant="outline" className="h-fit border-[#9dc9c1] text-[#277b7d]">{item.status || "Draft"}</Badge></div>)}</div></article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[.85fr_1.15fr]"><form onSubmit={submitCheckIn} className="rounded-2xl bg-[#d9ebe5] p-6"><div className="flex items-center gap-3"><HeartPulse className="h-5 w-5 text-[#1f6869]" /><div><p className="text-xs font-semibold uppercase tracking-[0.17em] text-[#277b7d]">Check-in</p><h2 className="font-serif text-2xl">Start with the body.</h2></div></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{(["mood", "absorption", "bodyStatus"] as const).map(field => <label key={field} className="grid gap-1 text-xs font-semibold capitalize text-[#315b5d]"><span>{field === "bodyStatus" ? "body status" : field}</span><select value={checkIn[field]} onChange={event => setCheckIn(current => ({ ...current, [field]: event.target.value }))} className="h-9 rounded-md border border-[#a9cdc5] bg-white px-2 text-sm text-[#153f43]">{(field === "mood" ? ["Grounded", "Clear", "Tender", "Activated", "Low", "Energized", "Mixed"] : field === "absorption" ? ["Open", "Steady", "Full", "Overfull", "Recovering"] : ["Steady", "Activated", "Tender", "Depleted", "Restoring"]).map(option => <option key={option}>{option}</option>)}</select></label>)}</div><Textarea value={checkIn.reflection} onChange={event => setCheckIn(current => ({ ...current, reflection: event.target.value }))} className="mt-3 min-h-24 border-[#a9cdc5] bg-white" placeholder="What is true for you this week?" /><label className="mt-3 flex gap-2 text-xs text-[#315b5d]"><input type="checkbox" checked={checkIn.followUpNeeded} onChange={event => setCheckIn(current => ({ ...current, followUpNeeded: event.target.checked }))} />A follow-up would help.</label><Button disabled={checkInCreate.isPending} className="mt-5 rounded-full bg-[#166e70] hover:bg-[#0d5759]">{checkInCreate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Save check-in</Button></form>
        <article className="rounded-2xl border border-[#c8dbd6] bg-white p-6"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.17em] text-[#277b7d]">Private operations</p><h2 className="font-serif text-2xl">Needs and decisions.</h2></div><ShieldCheck className="h-6 w-6 text-[#277b7d]" /></div><div className="mt-5 grid gap-5 sm:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#527174]">Needs</p>{needsQuery.error ? <p className="mt-3 text-sm text-[#527174]">Admin access only.</p> : <div className="mt-3 space-y-2">{(needsQuery.data ?? []).slice(0, 3).map(item => <p key={item.id} className="rounded-md bg-[#f4f7f4] p-3 text-sm text-[#153f43]">{item.name}</p>)}</div>}</div><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#527174]">Decisions</p>{decisionsQuery.error ? <p className="mt-3 text-sm text-[#527174]">Admin access only.</p> : <div className="mt-3 space-y-2">{(decisionsQuery.data ?? []).slice(0, 3).map(item => <p key={item.id} className="rounded-md bg-[#f4f7f4] p-3 text-sm text-[#153f43]">{item.name}</p>)}</div>}</div></div></article></section>
    </div>
  </DashboardLayout>;
}
