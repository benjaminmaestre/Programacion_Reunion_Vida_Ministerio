import { describe, expect, it } from "vitest";
import type { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { MeetingProgramDetail } from "./program-types";
import { getMeetingProgramsFromSupabase, saveMeetingProgramToSupabase } from "./programs-repository";

type Row = Record<string, any>;

class FakeQuery {
  private operation: "select" | "upsert" | "update" = "select";
  private payload: Row | null = null;
  private filters: Array<{ field: string; value: any; kind: "eq" | "in" }> = [];
  constructor(private db: FakeDatabase, private table: string) {}
  select(_columns = "*") { if (this.operation === "select") this.operation = "select"; return this; }
  order(_field: string, _options?: unknown) { return this; }
  eq(field: string, value: any) { this.filters.push({ field, value, kind: "eq" }); return this; }
  in(field: string, value: any[]) { this.filters.push({ field, value, kind: "in" }); return this; }
  upsert(payload: Row) { this.operation = "upsert"; this.payload = payload; return this; }
  update(payload: Row) { this.operation = "update"; this.payload = payload; return this; }
  private matches(row: Row) {
    return this.filters.every((filter) => filter.kind === "eq"
      ? row[filter.field] === filter.value
      : filter.value.includes(row[filter.field]));
  }
  private execute(): { data: any; error: null } {
    const rows = this.db.tables[this.table] ?? (this.db.tables[this.table] = []);
    if (this.operation === "upsert" && this.payload) {
      const index = rows.findIndex((row) => row.id && row.id === this.payload?.id);
      if (index >= 0) rows[index] = { ...rows[index], ...this.payload };
      else rows.push({ ...this.payload });
      return { data: null, error: null };
    }
    if (this.operation === "update" && this.payload) {
      rows.forEach((row) => { if (this.matches(row)) Object.assign(row, this.payload); });
      return { data: null, error: null };
    }
    return { data: rows.filter((row) => this.matches(row)).map((row) => ({ ...row })), error: null };
  }
  maybeSingle() {
    const result = this.execute();
    return Promise.resolve({ data: Array.isArray(result.data) ? result.data[0] ?? null : result.data, error: result.error });
  }
  then<TResult1 = { data: any; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled ?? undefined, onrejected ?? undefined);
  }
}

class FakeDatabase {
  tables: Record<string, Row[]> = {};
  from(table: string) { return new FakeQuery(this, table); }
}

describe("repositorio de programas: guardado y lectura posterior", () => {
  it("recupera desde el repositorio el título personalizado guardado", async () => {
    const programId = "00000000-0000-4000-8000-000000000001";
    const slotId = "00000000-0000-4000-8000-000000000002";
    const db = new FakeDatabase();
    db.tables.app_users = [{ user_id: "user-elder", role: "elder", is_active: true }];
    db.tables.planning_cycles = [{ id: "00000000-0000-4000-8000-000000000003", year: 2026, bimonth_number: 6 }];
    db.tables.history_periods = [{ id: "00000000-0000-4000-8000-000000000004", year: 2026, semester: 2 }];
    db.tables.meeting_programs = [{
      id: programId,
      meeting_date: "2026-11-02",
      week_type: "normal",
      planning_cycle_id: "00000000-0000-4000-8000-000000000003",
      history_period_id: "00000000-0000-4000-8000-000000000004",
      chairman_id: null,
      auxiliary_counselor_id: null,
      circuit_overseer_talk_title: null,
      is_draft: true,
      notes: null,
      updated_at: "2026-10-09T00:00:00.000Z",
    }];
    db.tables.assignment_slots = [{
      id: slotId,
      meeting_program_id: programId,
      section: "treasures",
      title: "Título anterior",
      duration_minutes: 10,
      order_index: 1,
      is_student_part: false,
      assignment_type: "treasures_talk",
      primary_participant_id: null,
      assistant_participant_id: null,
      eligibility_confirmed: false,
      eligibility_confirmed_by: null,
      eligibility_confirmed_at: null,
      is_deleted: false,
      notes: null,
    }];

    const client = db as unknown as ReturnType<typeof createSupabaseBrowserClient>;
    const program: MeetingProgramDetail = {
      id: programId,
      meetingDate: "2026-11-02",
      weekType: "normal",
      bimonthCycle: "2026-6",
      historyPeriod: "2026-S2",
      planningCycleId: "00000000-0000-4000-8000-000000000003",
      historyPeriodId: "00000000-0000-4000-8000-000000000004",
      status: "draft",
      updatedAt: "2026-10-09T00:00:00.000Z",
      slots: [{
        id: slotId,
        meetingProgramId: programId,
        section: "treasures",
        title: "Levítico 17:1-16 — La santidad de la sangre",
        durationMinutes: 10,
        orderIndex: 1,
        isStudentPart: false,
        assignmentType: "treasures_talk",
      }],
    };

    await saveMeetingProgramToSupabase(client, "user-elder", program);
    const reloaded = await getMeetingProgramsFromSupabase(client);
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].slots[0].title).toBe("Levítico 17:1-16 — La santidad de la sangre");
    expect(reloaded[0].slots[0].assignmentType).toBe("treasures_talk");
    expect(reloaded[0].status).toBe("draft");
    expect(reloaded[0].bimonthCycle).toBe("2026-6");
    expect(reloaded[0].historyPeriod).toBe("2026-S2");
    expect(reloaded[0].planningCycleId).toBe("00000000-0000-4000-8000-000000000003");
  });

  it("no permite modificar un programa ya publicado", async () => {
    const db = new FakeDatabase();
    db.tables.app_users = [{ user_id: "user-elder", role: "elder", is_active: true }];
    db.tables.meeting_programs = [{
      id: "00000000-0000-4000-8000-000000000001",
      is_draft: false,
    }];
    db.tables.assignment_slots = [];
    const client = db as unknown as ReturnType<typeof createSupabaseBrowserClient>;
    const program: MeetingProgramDetail = {
      id: "00000000-0000-4000-8000-000000000001",
      meetingDate: "2026-11-02",
      weekType: "normal",
      bimonthCycle: "2026-6",
      historyPeriod: "2026-S2",
      status: "draft",
      updatedAt: new Date().toISOString(),
      slots: [],
    };
    await expect(saveMeetingProgramToSupabase(client, "user-elder", program)).rejects.toThrow(/ya está publicado/);
  });
});
