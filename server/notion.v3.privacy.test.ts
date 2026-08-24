import { describe, expect, it } from "vitest";
import {
  ACTIVE_MOVE_STATUSES,
  isMarketingOverdue,
  isRenderableAsset,
  moveBelongsToPerson,
  myMovesSql,
  needsMarketingSql,
  publicContentSql,
  publicFlowsSql,
  PUBLIC_FLOW_STATUSES,
  toPublicContent,
  toPublicFlow,
  toTeamFlow,
  toTeamMove,
  V3_DATA_SOURCES,
  withStaleness,
  type RawRow,
} from "./notion/v3-read-models";
import {
  assertMoneyNeverPublic,
  assertMoveOwnership,
  assertNoDeniedFields,
  MONEY_HAS_NO_PUBLIC_ROUTE,
  PublicPayloadLeakError,
  PUBLIC_CONTENT_DENIED_FIELDS,
  PUBLIC_FLOW_DENIED_FIELDS,
  scrubPublicContent,
  scrubPublicFlow,
} from "./notion/v3-guards";

const MONNY = "https://app.notion.com/p/monny-person";
const SUNSHINE = "https://app.notion.com/p/sunshine-person";

/** A FLOWS row carrying every field a public caller must never receive. */
const podyapRow: RawRow = {
  url: "https://app.notion.com/p/flow-podyap-12",
  Name: "Podyap Ep 12",
  Type: "Podyap",
  Status: "Ready",
  Phase: "Depanty",
  "date:Date:start": "2026-08-26",
  Venue: "Studio",
  "Public?": "__YES__",
  Notes: "Guest is nervous, go slow in the first block",
  Retro: "Rodecaster gain was hot again",
  "Drive Folder": "https://drive.google.com/drive/folders/CW_20260826",
  "date:Media Cutoff:start": "2026-08-27",
  "Hard Stop": "11:30 sharp",
  Money: JSON.stringify(["https://app.notion.com/p/money-1"]),
  Guests: JSON.stringify([SUNSHINE]),
  Attended: JSON.stringify([MONNY, SUNSHINE]),
  Support: JSON.stringify([MONNY]),
  "Flow Keeper": JSON.stringify([MONNY]),
  Capacity: 12,
};

describe("public FLOWS surface", () => {
  it("requires an actionable status, not just the Public flag", () => {
    const sql = publicFlowsSql("2026-08-24");
    expect(sql).toContain("\"Public?\" = '__YES__'");
    for (const status of PUBLIC_FLOW_STATUSES) {
      expect(sql).toContain(`'${status}'`);
    }
  });

  it("excludes Idea, Happened, Wrapped, and Cancelled even when upcoming", () => {
    const sql = publicFlowsSql("2026-08-24");
    for (const excluded of ["'Idea'", "'Happened'", "'Wrapped'", "'Cancelled'"]) {
      expect(sql).not.toContain(excluded);
    }
  });

  it("never lists Internal Flows publicly", () => {
    expect(publicFlowsSql("2026-08-24")).not.toContain("'Internal'");
  });

  it("only returns Flows dated today or later", () => {
    expect(publicFlowsSql("2026-08-24")).toContain(
      "\"date:Date:start\" >= '2026-08-24'",
    );
  });

  it("does not select Phase", () => {
    expect(publicFlowsSql("2026-08-24")).not.toContain("Phase");
  });

  it("maps a Flow down to public-safe fields only", () => {
    const mapped = toPublicFlow(podyapRow) as Record<string, unknown>;
    expect(Object.keys(mapped).sort()).toEqual(
      ["date", "id", "name", "type", "venue"].sort(),
    );
  });

  it("never emits a phase key on the public mapper", () => {
    expect(toPublicFlow(podyapRow)).not.toHaveProperty("phase");
    expect(JSON.stringify(toPublicFlow(podyapRow))).not.toContain("Depanty");
  });

  it("leaks no internal production field through the public mapper", () => {
    expect(() =>
      assertNoDeniedFields(
        toPublicFlow(podyapRow),
        PUBLIC_FLOW_DENIED_FIELDS,
        "public flows",
      ),
    ).not.toThrow();
  });

  it("leaks no PEOPLE or MONEY relation through the public mapper", () => {
    const mapped = JSON.stringify(toPublicFlow(podyapRow));
    expect(mapped).not.toContain(MONNY);
    expect(mapped).not.toContain(SUNSHINE);
    expect(mapped).not.toContain("money-1");
  });

  it("throws rather than silently publishing a denied field", () => {
    expect(() =>
      assertNoDeniedFields(podyapRow, PUBLIC_FLOW_DENIED_FIELDS, "public flows"),
    ).toThrow(PublicPayloadLeakError);
  });

  it("scrubs a hand-assembled payload that wrongly includes internals", () => {
    const scrubbed = scrubPublicFlow({
      id: "flow-1",
      name: "Open Studio",
      notes: "internal",
      driveFolder: "https://drive.google.com/x",
      capacity: 8,
      phase: "Marketing",
    });
    expect(scrubbed).toEqual({ id: "flow-1", name: "Open Studio" });
  });
});

describe("FLOWS.Phase is internal", () => {
  it("is on the public deny-list in both casings", () => {
    expect(PUBLIC_FLOW_DENIED_FIELDS).toContain("Phase");
    expect(PUBLIC_FLOW_DENIED_FIELDS).toContain("phase");
  });

  it("is available to the team read model", () => {
    expect(toTeamFlow(podyapRow).phase).toBe("Depanty");
  });

  it("coexists with Status as a separate axis", () => {
    const flow = toTeamFlow(podyapRow);
    expect(flow.status).toBe("Ready");
    expect(flow.phase).toBe("Depanty");
  });

  it("rejects a phase value outside the vocabulary", () => {
    expect(toTeamFlow({ ...podyapRow, Phase: "Vibing" }).phase).toBeNull();
  });
});

describe("marketing-overdue alarm", () => {
  const TODAY = "2026-08-24";
  const FOUR_WEEKS = "2026-09-21";

  it("flags a Concepting Flow two weeks out", () => {
    expect(
      isMarketingOverdue(
        { "date:Date:start": "2026-09-07", Phase: "Concepting", Status: "Scheduled" },
        TODAY,
        FOUR_WEEKS,
      ),
    ).toBe(true);
  });

  it("does not flag a Marketing Flow two weeks out", () => {
    expect(
      isMarketingOverdue(
        { "date:Date:start": "2026-09-07", Phase: "Marketing", Status: "Approved" },
        TODAY,
        FOUR_WEEKS,
      ),
    ).toBe(false);
  });

  it("does not flag a Concepting Flow eight weeks out", () => {
    expect(
      isMarketingOverdue(
        { "date:Date:start": "2026-10-19", Phase: "Concepting", Status: "Idea" },
        TODAY,
        FOUR_WEEKS,
      ),
    ).toBe(false);
  });

  it("treats a blank Phase as not started", () => {
    expect(
      isMarketingOverdue({ "date:Date:start": "2026-09-07", Status: "Scheduled" }, TODAY, FOUR_WEEKS),
    ).toBe(true);
  });

  it("ignores Cancelled Flows", () => {
    expect(
      isMarketingOverdue(
        { "date:Date:start": "2026-09-07", Phase: "Concepting", Status: "Cancelled" },
        TODAY,
        FOUR_WEEKS,
      ),
    ).toBe(false);
  });

  it("builds SQL scoped to the four-week window and pre-marketing phases", () => {
    const sql = needsMarketingSql(TODAY, FOUR_WEEKS);
    expect(sql).toContain("'Cohoe'");
    expect(sql).toContain("'Concepting'");
    expect(sql).not.toContain("'Marketing'");
    expect(sql).toContain(FOUR_WEEKS);
  });
});

describe("public CONTENT surface", () => {
  it("requires both Published status and Public audience", () => {
    const sql = publicContentSql();
    expect(sql).toContain("\"Status\" = 'Published'");
    expect(sql).toContain("\"Audience\" = 'Public'");
  });

  it("excludes Draft, Ready, and Archived rows", () => {
    const sql = publicContentSql();
    for (const excluded of ["'Draft'", "'Ready'", "'Archived'"]) {
      expect(sql).not.toContain(excluded);
    }
  });

  it("never exposes internal editorial Notes", () => {
    const mapped = toPublicContent({
      url: "https://app.notion.com/p/content-1",
      Name: "Field Note 004",
      "Content Type": "Field Note",
      Copy: "What is in your creative well?",
      Notes: "Flerine still reviewing the cultural framing",
      Where: "Notion",
    });
    expect(mapped).not.toHaveProperty("notes");
    expect(JSON.stringify(mapped)).not.toContain("Flerine");
  });

  it("scrubs Notes, Flow, and Where from a public content payload", () => {
    const scrubbed = scrubPublicContent({
      id: "content-1",
      name: "Promo",
      notes: "internal",
      where: "Canva",
    });
    expect(scrubbed).toEqual({ id: "content-1", name: "Promo" });
  });

  it("applies Final? to Asset Link rows only", () => {
    const unfinishedAsset: RawRow = { "Content Type": "Asset Link", "Final?": "__NO__" };
    const finishedAsset: RawRow = { "Content Type": "Asset Link", "Final?": "__YES__" };
    const editorial: RawRow = { "Content Type": "Editorial Note" };

    expect(isRenderableAsset(unfinishedAsset)).toBe(false);
    expect(isRenderableAsset(finishedAsset)).toBe(true);
    // Editorial copy never needed an asset checkbox; it must not be hidden.
    expect(isRenderableAsset(editorial)).toBe(true);
  });

  it("does not put Final? in the query gate", () => {
    expect(publicContentSql()).not.toContain("\"Final?\" = '__YES__'");
  });
});

describe("MONEY is never public", () => {
  it("declares no public route", () => {
    expect(MONEY_HAS_NO_PUBLIC_ROUTE).toBe(true);
  });

  it("refuses a public query against the MONEY data source", () => {
    expect(() =>
      assertMoneyNeverPublic(V3_DATA_SOURCES.money, V3_DATA_SOURCES.money),
    ).toThrow(/no public route/i);
  });

  it("allows public queries against CONTENT and FLOWS", () => {
    expect(() =>
      assertMoneyNeverPublic(V3_DATA_SOURCES.content, V3_DATA_SOURCES.money),
    ).not.toThrow();
    expect(() =>
      assertMoneyNeverPublic(V3_DATA_SOURCES.flows, V3_DATA_SOURCES.money),
    ).not.toThrow();
  });

  it("builds no public SQL against MONEY or PEOPLE", () => {
    const publicSql = publicContentSql() + publicFlowsSql("2026-08-24");
    expect(publicSql).not.toContain(V3_DATA_SOURCES.money);
    expect(publicSql).not.toContain(V3_DATA_SOURCES.people);
    expect(publicSql).not.toContain(V3_DATA_SOURCES.moves);
  });
});

describe("MOVES ownership", () => {
  const sunshineMove: RawRow = {
    url: "https://app.notion.com/p/move-9",
    Name: "Send the one useful reply",
    Type: "Follow-Up",
    Status: "Now",
    "date:Due:start": "2026-08-25",
    Owner: JSON.stringify([SUNSHINE]),
    Flow: JSON.stringify(["https://app.notion.com/p/flow-podyap-12"]),
  };

  it("scopes the query to the session person", () => {
    expect(myMovesSql(MONNY)).toContain(MONNY);
  });

  it("returns only Now and Next", () => {
    const sql = myMovesSql(MONNY);
    for (const status of ACTIVE_MOVE_STATUSES) {
      expect(sql).toContain(`'${status}'`);
    }
    expect(sql).not.toContain("'Done'");
    expect(sql).not.toContain("'Dropped'");
  });

  it("rejects reading another person's Move", () => {
    expect(moveBelongsToPerson(sunshineMove, MONNY)).toBe(false);
    expect(() => assertMoveOwnership([SUNSHINE], MONNY)).toThrow(/only be read by its owner/i);
  });

  it("allows the owner to read their own Move", () => {
    expect(moveBelongsToPerson(sunshineMove, SUNSHINE)).toBe(true);
    expect(() => assertMoveOwnership([SUNSHINE], SUNSHINE)).not.toThrow();
    expect(toTeamMove(sunshineMove).status).toBe("Now");
  });
});

describe("stale beats wrong", () => {
  it("marks a served-from-cache payload as stale with its last good time", () => {
    const payload = withStaleness({ flows: [], myMoves: [] }, "2026-08-24T21:30:00.000Z", true);
    expect(payload.stale).toBe(true);
    expect(payload.lastGoodSyncAt).toBe("2026-08-24T21:30:00.000Z");
  });

  it("never reports a fresh sync time it does not have", () => {
    const payload = withStaleness({ flows: [], myMoves: [] }, null, true);
    expect(payload.lastGoodSyncAt).toBeNull();
    expect(payload.stale).toBe(true);
  });
});

describe("deny-lists are non-empty", () => {
  it("guards both public surfaces", () => {
    expect(PUBLIC_FLOW_DENIED_FIELDS.length).toBeGreaterThan(0);
    expect(PUBLIC_CONTENT_DENIED_FIELDS.length).toBeGreaterThan(0);
  });
});
