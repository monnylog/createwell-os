import { describe, expect, it } from "vitest";

describe("Notion integration credential", () => {
  it("authenticates with Notion from the server environment", async () => {
    const token = process.env.NOTION_API_TOKEN;
    expect(token, "NOTION_API_TOKEN must be configured for server-side sync").toBeTruthy();

    const response = await fetch("https://api.notion.com/v1/users/me", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2025-09-03",
      },
    });

    expect(response.status, await response.text()).toBe(200);
  }, 20_000);
});
