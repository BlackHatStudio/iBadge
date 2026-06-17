import { describe, expect, test } from "vitest";
import { AttendeeListRepository, type SqlExecutor } from "@/lib/attendees/repository";

function fakeExecutor(rows: unknown[] = []): SqlExecutor & { calls: Array<{ sql: string; params: Record<string, unknown> }> } {
  const calls: Array<{ sql: string; params: Record<string, unknown> }> = [];
  return {
    calls,
    async query<T>(sqlText: string, params: Record<string, unknown> = {}) {
      calls.push({ sql: sqlText, params });
      return rows as T[];
    },
    async transaction(work) {
      return work(this);
    },
  };
}

describe("AttendeeListRepository", () => {
  test("creates attendee lists with parameterized SQL and audit fields", async () => {
    const executor = fakeExecutor([{ AttendeeListID: 42 }]);
    const repo = new AttendeeListRepository(executor);

    await repo.create({ listName: "Safety Class", description: "Quarterly", isActive: true }, { user: "admin" });

    expect(executor.calls[0].sql).toContain("@listName");
    expect(executor.calls[0].sql).toContain("@description");
    expect(executor.calls[0].params).toMatchObject({
      listName: "Safety Class",
      description: "Quarterly",
      isActive: true,
      user: "admin",
    });
    expect(executor.calls[0].sql).not.toContain("Safety Class");
  });
});
