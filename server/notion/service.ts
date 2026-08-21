import { createPage, notionPageToRecord, notionProperty, queryDataSource } from "./client";
import { notionConfig } from "./config";
import type { CheckInInput, TopicWellInput } from "./schemas";

type NotionQueryResponse = {
  results?: any[];
};

export type CreateWellRecord = ReturnType<typeof notionPageToRecord>;

export type PublicContentRecord = {
  id: string;
  name: string;
  type: string;
  summary: string;
  publishDate: string;
};

export type PublicOfferRecord = {
  id: string;
  name: string;
  type: string;
  layer: string;
  summary: string;
};

export type PublicEventRecord = {
  id: string;
  name: string;
  type: string;
  start: string;
  end: string;
  location: string;
  summary: string;
};

export async function listDataSourceRecords(dataSourceId: string) {
  const response = await queryDataSource<NotionQueryResponse>(dataSourceId, { page_size: 100 });
  return (response.results ?? []).map(notionPageToRecord);
}

function propertyValue(properties: Record<string, any>, name: string): string {
  const property = properties[name];
  if (!property) return "";
  if (property.type === "select" || property.type === "status") return property[property.type]?.name ?? "";
  if (property.type === "rich_text") return property.rich_text?.map((item: any) => item.plain_text ?? "").join("") ?? "";
  if (property.type === "title") return property.title?.map((item: any) => item.plain_text ?? "").join("") ?? "";
  if (property.type === "date") return property.date?.start ?? "";
  return "";
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}

export async function getApprovedContent() {
  const records = await listDataSourceRecords(notionConfig.dataSourceIds.content);
  return records.filter(record => {
    const status = normalize(propertyValue(record.properties, "Status"));
    const audience = normalize(propertyValue(record.properties, "Audience"));
    return status === "published" && (audience === "public" || audience === "community");
  }).map<PublicContentRecord>(record => ({
    id: record.id,
    name: record.name,
    type: record.type,
    summary: record.summary,
    publishDate: record.publishDate,
  }));
}

export async function getActiveOffers() {
  const records = await listDataSourceRecords(notionConfig.dataSourceIds.offers);
  const excludedStatuses = new Set(["archived", "inactive", "cancelled"]);
  return records
    .filter(record => !excludedStatuses.has(normalize(propertyValue(record.properties, "Status"))))
    .map<PublicOfferRecord>(record => ({
      id: record.id,
      name: record.name,
      type: record.type,
      layer: propertyValue(record.properties, "Layer"),
      summary: record.summary,
    }));
}

export async function getUpcomingEvents() {
  const records = await listDataSourceRecords(notionConfig.dataSourceIds.events);
  const now = Date.now();
  const excludedStatuses = new Set(["draft", "archived", "cancelled"]);
  return records
    .filter(record => {
      const start = propertyValue(record.properties, "Start");
      const status = normalize(propertyValue(record.properties, "Status"));
      return Boolean(start) && Date.parse(start) >= now && !excludedStatuses.has(status);
    })
    .sort((left, right) => Date.parse(left.start) - Date.parse(right.start))
    .map<PublicEventRecord>(record => ({
      id: record.id,
      name: record.name,
      type: record.type,
      start: record.start,
      end: record.end,
      location: propertyValue(record.properties, "Location"),
      summary: record.summary,
    }));
}

export async function createTopicWellDrop(input: TopicWellInput) {
  return createPage(notionConfig.dataSourceIds.topicWell, {
    Name: notionProperty.title(input.name),
    Status: notionProperty.richText("Intake"),
    Drop: notionProperty.richText(input.drop),
    Anonymous: notionProperty.checkbox(input.anonymous),
    Notes: notionProperty.richText(`Consent to share: ${input.consentToShare ? "yes" : "no"}\nSource: ${input.source}`),
  });
}

export async function resolvePersonPageId(user: { name: string | null; email: string | null }) {
  const records = await listDataSourceRecords(notionConfig.dataSourceIds.people);
  const email = normalize(user.email ?? "");
  const name = normalize(user.name ?? "");
  const match = records.find(record => {
    const recordEmail = normalize(propertyValue(record.properties, "Email"));
    const recordName = normalize(record.name);
    return (email && recordEmail === email) || (name && recordName === name);
  });

  if (!match) {
    throw new Error("Your account is not linked to a Create Well People record. Add a matching email or name before submitting.");
  }

  return match.id;
}

export async function listTasks() {
  return listDataSourceRecords(notionConfig.dataSourceIds.tasks);
}

export async function createTask(input: {
  name: string;
  status: string;
  phase: string;
  priority: string;
  nextAction: string;
  due?: string;
}, personPageId: string) {
  return createPage(notionConfig.dataSourceIds.tasks, {
    Name: notionProperty.title(input.name),
    Status: notionProperty.richText(input.status),
    Phase: notionProperty.richText(input.phase),
    Priority: notionProperty.richText(input.priority),
    "Next Action": notionProperty.richText(input.nextAction),
    ...(input.due ? { Due: notionProperty.date(input.due) } : {}),
    Owner: notionProperty.relation(personPageId),
  });
}

export async function listCheckIns(personPageId: string) {
  const records = await listDataSourceRecords(notionConfig.dataSourceIds.checkIns);
  return records.filter(record => {
    const relation = record.properties.Person?.relation ?? [];
    return relation.some((item: { id: string }) => item.id === personPageId);
  });
}

function getWeekStart() {
  const date = new Date();
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  return date.toISOString().slice(0, 10);
}

export async function createCheckIn(input: CheckInInput, personPageId: string, userName: string | null) {
  const week = getWeekStart();
  return createPage(notionConfig.dataSourceIds.checkIns, {
    Name: notionProperty.title(`${userName ?? "Team member"} · ${week}`),
    Mood: notionProperty.richText(input.mood),
    Absorption: notionProperty.richText(input.absorption),
    "Body Status": notionProperty.richText(input.bodyStatus),
    Week: notionProperty.date(week),
    "Share Level": notionProperty.richText(input.shareLevel),
    Reflection: notionProperty.richText(input.reflection),
    Notes: notionProperty.richText(`Follow-up needed: ${input.followUpNeeded ? "yes" : "no"}`),
    Person: notionProperty.relation(personPageId),
  });
}

export async function listNeeds() {
  return listDataSourceRecords(notionConfig.dataSourceIds.needs);
}

export async function listDecisions() {
  return listDataSourceRecords(notionConfig.dataSourceIds.decisions);
}
