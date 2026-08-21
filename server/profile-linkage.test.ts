import { describe, expect, it } from "vitest";
import { findTeamPersonRecord } from "./notion/service";

describe("Create Well People identity linkage", () => {
  const records = [{
    id: "monny-person",
    url: "https://app.notion.com/monny-person",
    name: "Monny",
    email: "mb@tablante.com",
    role: "Steady presence",
    status: "",
    type: "",
    phase: "",
    priority: "",
    nextAction: "",
    mood: "",
    absorption: "",
    bodyStatus: "",
    category: "",
    week: "",
    summary: "",
    start: "",
    end: "",
    publishDate: "",
    properties: { Email: { type: "email", email: "mb@tablante.com" } },
  }];

  it("prefers an exact authenticated email match over a display-name match", () => {
    expect(findTeamPersonRecord(records, { name: "monica blanco", email: "mb@tablante.com" }).id).toBe("monny-person");
  });

  it("does not link an unrelated authenticated account", () => {
    expect(() => findTeamPersonRecord(records, { name: "Different person", email: "different@example.com" })).toThrow("not linked");
  });
});
