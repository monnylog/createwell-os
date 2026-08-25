import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  Sparkles,
  Waves,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link } from "wouter";

type Content = { id: string; name: string; type: string; summary: string };
type Offer = { id: string; name: string; layer: string; summary: string };
type Event = {
  id: string;
  name: string;
  type: string;
  start: string;
  location: string;
  summary: string;
};

const oceanTexture = "/manus-storage/createwell-ocean-texture_21ac12bb.jpg";

function formatDate(value: string) {
  return value
    ? new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(value))
    : "Soon";
}

export default function Home() {
  const [content, setContent] = useState<Content[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [topic, setTopic] = useState({
    name: "",
    drop: "",
    consentToShare: false,
  });
  const [topicState, setTopicState] = useState<
    "idle" | "sending" | "success" | "error"
  >("idle");
  const [topicMessage, setTopicMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetch("/api/public/content").then(response =>
        response.ok ? response.json() : Promise.reject()
      ),
      fetch("/api/public/offers").then(response =>
        response.ok ? response.json() : Promise.reject()
      ),
      fetch("/api/public/events").then(response =>
        response.ok ? response.json() : Promise.reject()
      ),
    ])
      .then(([contentData, offersData, eventsData]) => {
        if (!mounted) return;
        setContent(contentData.items ?? []);
        setOffers(offersData.items ?? []);
        setEvents(eventsData.items ?? []);
      })
      .catch(
        () =>
          mounted &&
          setError("The well is being refreshed. Please return shortly.")
      )
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  async function submitTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTopicState("sending");
    try {
      const response = await fetch("/api/topic-well", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          name: topic.name,
          drop: topic.drop,
          anonymous: true,
          consentToShare: topic.consentToShare,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Unable to save your topic right now.");
      setTopic({ name: "", drop: "", consentToShare: false });
      setTopicMessage(
        "Your topic is now in the Well. Thank you for contributing."
      );
      setTopicState("success");
    } catch (submissionError) {
      setTopicMessage(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to save your topic right now."
      );
      setTopicState("error");
    }
  }

  return (
    <div className="min-h-screen overflow-hidden bg-[#f4f5ee] text-[#092d32]">
      <section className="relative isolate overflow-hidden bg-[#062c33] px-5 pb-16 pt-5 text-[#f7f6ee] sm:px-8 lg:px-12">
        <img
          src={oceanTexture}
          alt="Abstract teal ocean texture"
          className="absolute inset-0 -z-20 h-full w-full object-cover opacity-35 mix-blend-screen"
        />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_12%,rgba(52,160,160,.55),transparent_25%),linear-gradient(125deg,rgba(4,35,43,.98),rgba(8,60,67,.86)_48%,rgba(5,31,40,.97))]" />
        <nav className="mx-auto flex max-w-7xl items-center justify-between border-b border-white/15 pb-5">
          <a
            href="#top"
            className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[.18em]"
          >
            <Waves className="h-5 w-5 text-[#83d2cb]" /> Create Well
          </a>
          <div className="hidden gap-7 text-sm text-white/75 md:flex">
            <a href="#model">The model</a>
            <a href="#events">In the current</a>
            <a href="#topic-well">Topic Well</a>
          </div>
          <Link
            href="/team"
            className="inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2 text-xs font-semibold hover:bg-white/10"
          >
            <LockKeyhole className="h-3.5 w-3.5" /> Team portal
          </Link>
        </nav>
        <div
          id="top"
          className="mx-auto grid max-w-7xl gap-12 py-24 lg:grid-cols-[1.2fr_.8fr] lg:items-end"
        >
          <div>
            <p className="mb-7 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-[#92ddd6]">
              <Sparkles className="h-4 w-4" /> Creative practice, held together
            </p>
            <h1 className="max-w-4xl font-serif text-5xl leading-[.96] tracking-[-.04em] sm:text-6xl lg:text-8xl">
              A shared well for the work that wants to move through us.
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-white/78 sm:text-lg">
              Create Well makes room for creativity that is relational,
              body-aware, and alive to the rhythm of real life.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <a href="#topic-well">
                <Button className="rounded-full bg-[#8cd5ca] px-6 text-[#073137] hover:bg-[#b3e8dc]">
                  Add to the Topic Well <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
              <a href="#events">
                <Button
                  variant="outline"
                  className="rounded-full border-white/35 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white"
                >
                  See what is gathering
                </Button>
              </a>
            </div>
          </div>
          <aside className="border-l border-white/20 pl-6">
            <p className="text-xs font-semibold uppercase tracking-[.17em] text-[#92ddd6]">
              From the Well to the Geyser
            </p>
            <p className="mt-4 max-w-sm font-serif text-2xl leading-tight">
              Small practices deepen into gatherings, and gatherings can carry
              us further.
            </p>
            <p className="mt-6 text-sm leading-6 text-white/65">
              The Well-to-Geyser model keeps participation accessible while
              making space for rare landmark moments.
            </p>
          </aside>
        </div>
      </section>
      <main>
        <section
          id="model"
          className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[.78fr_1.22fr] lg:px-12"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#277b7d]">
              Well-to-Geyser
            </p>
            <h2 className="mt-4 font-serif text-4xl leading-none tracking-[-.03em] sm:text-5xl">
              A model for steady practice and rare eruption.
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {loading ? (
              <div className="col-span-full grid h-40 place-items-center">
                <Loader2 className="h-5 w-5 animate-spin text-[#277b7d]" />
              </div>
            ) : (
              offers.map(offer => (
                <article
                  key={offer.id}
                  className="border border-[#c9d7d2] bg-[#fbfbf6] p-5 transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[.16em] text-[#297a78]">
                    {offer.layer || "Create Well offering"}
                  </span>
                  <h3 className="mt-5 font-serif text-2xl">{offer.name}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#31575a]">
                    {offer.summary}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
        <section
          id="events"
          className="bg-[#e6eeeb] px-5 py-20 sm:px-8 lg:px-12"
        >
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#277b7d]">
                  In the current
                </p>
                <h2 className="mt-4 font-serif text-4xl tracking-[-.03em] sm:text-5xl">
                  What is gathering next.
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-[#456063]">
                Dates and invitations move with the Create Well programming
                current.
              </p>
            </div>
            {error ? (
              <p className="mt-10 border-l-2 border-[#277b7d] pl-4 text-sm text-[#456063]">
                {error}
              </p>
            ) : (
              <div className="mt-10 grid gap-4 lg:grid-cols-3">
                {events.length ? (
                  events.slice(0, 3).map(item => (
                    <article
                      key={item.id}
                      className="bg-[#fbfbf6] p-6 shadow-sm"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#297a78]">
                        {formatDate(item.start)}
                      </p>
                      <h3 className="mt-6 font-serif text-2xl">{item.name}</h3>
                      <p className="mt-3 text-sm leading-6 text-[#456063]">
                        {item.summary || item.type}
                      </p>
                      <p className="mt-6 text-xs font-semibold text-[#1b6e72]">
                        {item.location || "Location to be shared"}
                      </p>
                    </article>
                  ))
                ) : (
                  <p className="border-l-2 border-[#277b7d] pl-4 text-sm text-[#456063]">
                    The next gathering is still taking shape. Check back soon.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
        <section id="topic-well" className="px-5 py-20 sm:px-8 lg:px-12">
          <div className="mx-auto grid max-w-7xl gap-10 border-y border-[#c9d7d2] py-14 lg:grid-cols-[.85fr_1.15fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#277b7d]">
                Topic Well
              </p>
              <h2 className="mt-4 font-serif text-4xl leading-none tracking-[-.03em] sm:text-5xl">
                What is asking for language?
              </h2>
              <p className="mt-6 max-w-md text-sm leading-7 text-[#456063]">
                Leave a question, friction, fascination, or field note. Your
                drop begins as a private intake and may only be shared with
                explicit consent.
              </p>
            </div>
            <form
              onSubmit={submitTopic}
              className="grid gap-5 rounded-2xl bg-[#092f35] p-6 text-white sm:p-8"
            >
              <label className="grid gap-2 text-sm font-medium">
                Give it a short name
                <Input
                  required
                  minLength={3}
                  value={topic.name}
                  onChange={event =>
                    setTopic(current => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="border-white/20 bg-white/10 text-white placeholder:text-white/45"
                  placeholder="A thread I want to follow"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Your drop
                <Textarea
                  required
                  minLength={20}
                  value={topic.drop}
                  onChange={event =>
                    setTopic(current => ({
                      ...current,
                      drop: event.target.value,
                    }))
                  }
                  className="min-h-32 border-white/20 bg-white/10 text-white placeholder:text-white/45"
                  placeholder="What are you noticing, needing, or wondering about?"
                />
              </label>
              <label className="flex items-start gap-3 text-sm leading-5 text-white/75">
                <input
                  type="checkbox"
                  checked={topic.consentToShare}
                  onChange={event =>
                    setTopic(current => ({
                      ...current,
                      consentToShare: event.target.checked,
                    }))
                  }
                  className="mt-1 h-4 w-4 accent-[#8cd5ca]"
                />
                I give Create Well permission to adapt this idea into shared
                programming without my name.
              </label>
              <div className="flex flex-wrap items-center gap-4">
                <Button
                  disabled={topicState === "sending"}
                  type="submit"
                  className="rounded-full bg-[#8cd5ca] px-6 text-[#073137] hover:bg-[#b3e8dc]"
                >
                  {topicState === "sending" && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Place it in the Well
                </Button>
                {topicState === "success" && (
                  <span className="flex items-center gap-2 text-sm text-[#b3e8dc]">
                    <CheckCircle2 className="h-4 w-4" />
                    {topicMessage}
                  </span>
                )}
                {topicState === "error" && (
                  <span className="text-sm text-[#ffd2ca]">{topicMessage}</span>
                )}
              </div>
            </form>
          </div>
        </section>
        {content.length > 0 && (
          <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#277b7d]">
              From the practice
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {content.slice(0, 3).map(item => (
                <article
                  key={item.id}
                  className="border-t-2 border-[#5d9e9b] pt-5"
                >
                  <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#277b7d]">
                    {item.type || "Note"}
                  </p>
                  <h3 className="mt-3 font-serif text-2xl">{item.name}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#456063]">
                    {item.summary}
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
      <footer className="bg-[#062c33] px-5 py-10 text-sm text-white/65 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <span className="font-semibold uppercase tracking-[.15em] text-white">
            Create Well
          </span>
          <span>Practice, presence, and a place to return to.</span>
        </div>
      </footer>
    </div>
  );
}
