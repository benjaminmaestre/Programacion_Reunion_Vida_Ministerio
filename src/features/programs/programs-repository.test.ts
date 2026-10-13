import { describe, expect, it } from "vitest";
import type { createNeonBrowserClient } from "@/lib/neon/client";
import { MembershipRequiredError } from "../members/members-repository";
import type { MeetingProgramDetail } from "./program-types";
import { deleteAllDraftProgramsInNeon, getMeetingProgramsFromNeon, reopenMeetingProgramInNeon, saveMeetingProgramToNeon } from "./programs-repository";

type Row = Record<string, any>;

class FakeQuery {
  private operation: "select" | "upsert" | "update" | "insert" = "select";
  private payload: Row | null = null;
  private filters: Array<{ field: string; value: any; kind: "eq" | "in" }> = [];
  constructor(private db: FakeDatabase, private table: string) {}
  select(_columns = "*") { if (this.operation === "select") this.operation = "select"; return this; }
  order(_field: string, _options?: unknown) { return this; }
  eq(field: string, value: any) { this.filters.push({ field, value, kind: "eq" }); return this; }
  in(field: string, value: any[]) { this.filters.push({ field, value, kind: "in" }); return this; }
  insert(payload: Row) {
    this.operation = "insert";
    this.payload = { id: payload.id || `00000000-0000-4000-8000-${Math.floor(Math.random() * 1000000000000).toString().padStart(12, "0")}`, ...payload };
    return this;
  }
  upsert(payload: Row) { this.operation = "upsert"; this.payload = payload; return this; }
  update(payload: Row) { this.operation = "update"; this.payload = payload; return this; }
  private matches(row: Row) {
    return this.filters.every((filter) => filter.kind === "eq"
      ? row[filter.field] === filter.value
      : filter.value.includes(row[filter.field]));
  }
  private execute(): { data: any; error: null } {
    const rows = this.db.tables[this.table] ?? (this.db.tables[this.table] = []);
    if (this.operation === "insert" && this.payload) {
      rows.push(this.payload);
      return { data: [this.payload], error: null };
    }
    if (this.operation === "upsert" && this.payload) {
      const index = rows.findIndex((row) => row.id && row.id === this.payload?.id);
      if (index >= 0) rows[index] = { ...rows[index], ...this.payload };
      else rows.push({ ...this.payload });
      return { data: [this.payload], error: null };
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
  rpcCalls = 0;
  rpcFailure: { message: string; code?: string } | null = null;
  from(table: string) { return new FakeQuery(this, table); }
  rpc(fnName: string, args: Record<string, any>) {
    this.rpcCalls += 1;
    if (fnName === "get_current_app_user") {
      const activeUser = (this.tables.app_users ?? []).find((u) => u.is_active === true);
      return Promise.resolve({
        data: activeUser ? [{ user_id: activeUser.user_id, role: activeUser.role, is_active: activeUser.is_active }] : [],
        error: null,
      });
    }
    if (this.rpcFailure) return Promise.resolve({ data: null, error: this.rpcFailure });
    if (fnName === "reopen_meeting_program") {
      const program = (this.tables.meeting_programs ?? []).find((row) => row.id === args.p_program_id);
      if (!program) {
        return Promise.resolve({ data: null, error: { message: "No existe el programa que deseas reabrir." } });
      }
      if (program.is_draft !== false) {
        return Promise.resolve({ data: null, error: { message: "El programa ya está en borrador." } });
      }
      program.is_draft = true;
      program.updated_at = new Date().toISOString();
      return Promise.resolve({ data: program.id, error: null });
    }
    if (fnName === "save_meeting_program_with_guide") {
      const existingProg = (this.tables.meeting_programs ?? []).find((p) => p.id === args.p_program_id);
      if (existingProg && existingProg.is_draft === false) {
        return Promise.resolve({ data: null, error: { message: "El programa ya está publicado y se encuentra protegido contra modificaciones." } });
      }

      const date = new Date(`${args.p_meeting_date}T12:00:00Z`);
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth() + 1;
      const bimonth = Math.ceil(month / 2);
      const semester = month <= 6 ? 1 : 2;
      const cycleRows = this.tables.planning_cycles ?? (this.tables.planning_cycles = []);
      let cycle = cycleRows.find((row) => row.year === year && row.bimonth_number === bimonth);
      if (!cycle) {
        cycle = { id: `20000000-0000-4000-8000-${String(year * 10 + bimonth).padStart(12, "0")}`, year, bimonth_number: bimonth };
        cycleRows.push(cycle);
      }
      const periodRows = this.tables.history_periods ?? (this.tables.history_periods = []);
      let period = periodRows.find((row) => row.year === year && row.semester === semester);
      if (!period) {
        period = {
          id: `30000000-0000-4000-8000-${String(year * 10 + semester).padStart(12, "0")}`,
          year, semester,
          start_date: semester === 1 ? `${year}-01-01` : `${year}-07-01`,
          end_date: semester === 1 ? `${year}-06-30` : `${year}-12-31`,
        };
        periodRows.push(period);
      }

      const progRows = this.tables.meeting_programs ?? (this.tables.meeting_programs = []);
      const existingIdx = progRows.findIndex((p) => p.id === args.p_program_id);
      const newProgRow = {
        id: args.p_program_id,
        meeting_date: args.p_meeting_date,
        week_type: args.p_week_type,
        planning_cycle_id: cycle.id,
        history_period_id: period.id,
        chairman_id: args.p_chairman_id,
        auxiliary_counselor_id: args.p_auxiliary_counselor_id,
        leadership_review_confirmed: args.p_leadership_review_confirmed,
        leadership_review_confirmed_by: args.p_leadership_review_confirmed_by,
        leadership_review_confirmed_at: args.p_leadership_review_confirmed_at,
        circuit_overseer_talk_title: args.p_circuit_overseer_talk_title,
        weekly_bible_reading: args.p_weekly_bible_reading,
        opening_song_number: args.p_opening_song_number,
        living_song_number: args.p_living_song_number,
        closing_song_number: args.p_closing_song_number,
        opening_prayer_participant_id: args.p_opening_prayer_participant_id,
        closing_prayer_participant_id: args.p_closing_prayer_participant_id,
        is_draft: args.p_is_draft,
        notes: args.p_notes,
        updated_at: new Date().toISOString(),
      };

      if (existingIdx >= 0) progRows[existingIdx] = { ...progRows[existingIdx], ...newProgRow };
      else progRows.push(newProgRow);

      const slotRows = this.tables.assignment_slots ?? (this.tables.assignment_slots = []);
      const newSlots = args.p_slots as any[];
      const newSlotIds = newSlots.map((s) => s.id);

      slotRows.forEach((s) => {
        if (s.meeting_program_id === args.p_program_id && !newSlotIds.includes(s.id)) {
          s.is_deleted = true;
        }
      });

      for (const slot of newSlots) {
        const slotIdx = slotRows.findIndex((s) => s.id === slot.id);
        const slotData = {
          id: slot.id,
          meeting_program_id: args.p_program_id,
          section: slot.section,
          title: slot.title,
          duration_minutes: slot.duration_minutes,
          order_index: slot.order_index,
          is_student_part: slot.is_student_part,
          assignment_type: slot.assignment_type,
          primary_participant_id: slot.primary_participant_id,
          assistant_participant_id: slot.assistant_participant_id,
          eligibility_confirmed: slot.eligibility_confirmed,
          eligibility_confirmed_by: slot.eligibility_confirmed_by,
          eligibility_confirmed_at: slot.eligibility_confirmed_at,
          is_deleted: false,
          notes: slot.notes,
        };
        if (slotIdx >= 0) slotRows[slotIdx] = { ...slotRows[slotIdx], ...slotData };
        else slotRows.push(slotData);
      }

      return Promise.resolve({ data: args.p_program_id, error: null });
    }
    if (fnName === "delete_draft_meeting_program") {
      const programIdx = (this.tables.meeting_programs ?? []).findIndex((row) => row.id === args.p_program_id);
      if (programIdx < 0) {
        return Promise.resolve({ data: null, error: { message: "No existe el programa que deseas eliminar." } });
      }
      const program = this.tables.meeting_programs[programIdx];
      if (program.is_draft !== true) {
        return Promise.resolve({ data: null, error: { message: "No se pueden eliminar programas publicados. Primero debes reabrirlo a borrador." } });
      }
      this.tables.assignment_slots = (this.tables.assignment_slots ?? []).filter((s) => s.meeting_program_id !== args.p_program_id);
      this.tables.meeting_programs.splice(programIdx, 1);
      return Promise.resolve({ data: args.p_program_id, error: null });
    }
    return Promise.resolve({ data: null, error: { message: `Función RPC ${fnName} no implementada en la prueba.` } });
  }
}

describe("repositorio de programas: guardado y lectura posterior", () => {
  it("recupera desde el repositorio el título personalizado guardado", async () => {
    const programId = "00000000-0000-4000-8000-000000000001";
    const slotId = "00000000-0000-4000-8000-000000000002";
    const db = new FakeDatabase();
    db.tables.app_users = [{ user_id: "user-user", role: "user", is_active: true }];
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
      opening_prayer_participant_id: null,
      closing_prayer_participant_id: null,
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

    const client = db as unknown as ReturnType<typeof createNeonBrowserClient>;
    const program: MeetingProgramDetail = {
      id: programId,
      meetingDate: "2026-11-02",
      weekType: "normal",
      bimonthCycle: "2026-6",
      historyPeriod: "2026-S2",
      planningCycleId: "00000000-0000-4000-8000-000000000003",
      historyPeriodId: "00000000-0000-4000-8000-000000000004",
      openingPrayerParticipantId: "40000000-0000-4000-8000-000000000001",
      closingPrayerParticipantId: "40000000-0000-4000-8000-000000000002",
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

    await saveMeetingProgramToNeon(client, "user-user", program);
    const reloaded = await getMeetingProgramsFromNeon(client);
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].slots[0].title).toBe("Levítico 17:1-16 — La santidad de la sangre");
    expect(reloaded[0].slots[0].assignmentType).toBe("treasures_talk");
    expect(reloaded[0].status).toBe("draft");
    expect(reloaded[0].bimonthCycle).toBe("2026-6");
    expect(reloaded[0].historyPeriod).toBe("2026-S2");
    expect(reloaded[0].planningCycleId).toBe("00000000-0000-4000-8000-000000000003");
    expect(reloaded[0].openingPrayerParticipantId).toBe("40000000-0000-4000-8000-000000000001");
    expect(reloaded[0].closingPrayerParticipantId).toBe("40000000-0000-4000-8000-000000000002");
  });

  it("no permite guardar cambios si la cuenta no tiene membresía activa", async () => {
    const db = new FakeDatabase();
    db.tables.app_users = [{ user_id: "user-inactive", role: "user", is_active: false }];
    db.tables.meeting_programs = [];
    db.tables.assignment_slots = [];
    const client = db as unknown as ReturnType<typeof createNeonBrowserClient>;
    const program: MeetingProgramDetail = {
      id: "00000000-0000-4000-8000-000000000001",
      meetingDate: "2026-11-02",
      weekType: "normal",
      bimonthCycle: "",
      historyPeriod: "",
      status: "draft",
      updatedAt: new Date().toISOString(),
      slots: [],
    };
    await expect(saveMeetingProgramToNeon(client, "user-inactive", program)).rejects.toThrow(MembershipRequiredError);
    expect(db.tables.meeting_programs).toHaveLength(0);
  });

  it("retira intervenciones de borrador con baja lógica y no las borra físicamente", async () => {
    const programId = "00000000-0000-4000-8000-000000000001";
    const slotId = "00000000-0000-4000-8000-000000000002";
    const db = new FakeDatabase();
    db.tables.app_users = [{ user_id: "user-user", role: "user", is_active: true }];
    db.tables.meeting_programs = [{ id: programId, is_draft: true }];
    db.tables.assignment_slots = [{ id: slotId, meeting_program_id: programId, is_deleted: false }];
    const client = db as unknown as ReturnType<typeof createNeonBrowserClient>;
    const program: MeetingProgramDetail = {
      id: programId,
      meetingDate: "2026-11-02",
      weekType: "normal",
      bimonthCycle: "",
      historyPeriod: "",
      status: "draft",
      updatedAt: new Date().toISOString(),
      slots: [],
    };
    await saveMeetingProgramToNeon(client, "user-user", program);
    expect(db.tables.assignment_slots).toHaveLength(1);
    expect(db.tables.assignment_slots[0].is_deleted).toBe(true);
  });

  it("reabre un programa publicado como borrador y conserva sus asignaciones", async () => {
    const programId = "00000000-0000-4000-8000-000000000077";
    const db = new FakeDatabase();
    db.tables.app_users = [{ user_id: "user-user", role: "user", is_active: true }];
    db.tables.meeting_programs = [{
      id: programId,
      meeting_date: "2026-11-02",
      is_draft: false,
      opening_prayer_participant_id: "40000000-0000-4000-8000-000000000001",
      closing_prayer_participant_id: "40000000-0000-4000-8000-000000000002",
      weekly_bible_reading: "Levítico 1-3",
    }];
    db.tables.assignment_slots = [{
      id: "00000000-0000-4000-8000-000000000078",
      meeting_program_id: programId,
      title: "Discurso de Tesoros",
      primary_participant_id: "50000000-0000-4000-8000-000000000001",
      is_deleted: false,
    }];

    const client = db as unknown as ReturnType<typeof createNeonBrowserClient>;
    await reopenMeetingProgramInNeon(client, "user-user", programId);

    expect(db.tables.meeting_programs[0].is_draft).toBe(true);
    expect(db.tables.meeting_programs[0].opening_prayer_participant_id)
      .toBe("40000000-0000-4000-8000-000000000001");
    expect(db.tables.meeting_programs[0].closing_prayer_participant_id)
      .toBe("40000000-0000-4000-8000-000000000002");
    expect(db.tables.meeting_programs[0].weekly_bible_reading).toBe("Levítico 1-3");
    expect(db.tables.assignment_slots[0].primary_participant_id)
      .toBe("50000000-0000-4000-8000-000000000001");
  });

  it("no permite modificar un programa ya publicado", async () => {
    const db = new FakeDatabase();
    db.tables.app_users = [{ user_id: "user-user", role: "user", is_active: true }];
    db.tables.meeting_programs = [{
      id: "00000000-0000-4000-8000-000000000001",
      is_draft: false,
    }];
    db.tables.assignment_slots = [];
    const client = db as unknown as ReturnType<typeof createNeonBrowserClient>;
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
    await expect(saveMeetingProgramToNeon(client, "user-user", program)).rejects.toThrow(/ya está publicado/);
  });

  it("no hace escrituras directas ni crea ciclos si falla la RPC atómica", async () => {
    const db = new FakeDatabase();
    db.tables.app_users = [{ user_id: "user-user", role: "user", is_active: true }];
    db.tables.planning_cycles = [];
    db.tables.history_periods = [];
    db.tables.meeting_programs = [];
    db.tables.assignment_slots = [];
    db.rpcFailure = { message: "permission denied", code: "42501" };

    const client = db as unknown as ReturnType<typeof createNeonBrowserClient>;
    const program: MeetingProgramDetail = {
      id: "00000000-0000-4000-8000-000000000099",
      meetingDate: "2026-11-16",
      weekType: "normal",
      bimonthCycle: "2026-6",
      historyPeriod: "2026-S2",
      status: "draft",
      updatedAt: new Date().toISOString(),
      slots: [],
    };

    await expect(saveMeetingProgramToNeon(client, "user-user", program)).rejects.toThrow("permission denied");
    expect(db.rpcCalls).toBe(2);
    expect(db.tables.meeting_programs).toHaveLength(0);
    expect(db.tables.assignment_slots).toHaveLength(0);
    expect(db.tables.planning_cycles).toHaveLength(0);
    expect(db.tables.history_periods).toHaveLength(0);
  });

  it("crea automáticamente el ciclo bimestral y período semestral si no existen previamente", async () => {
    const db = new FakeDatabase();
    db.tables.app_users = [{ user_id: "user-user", role: "user", is_active: true }];
    db.tables.planning_cycles = [];
    db.tables.history_periods = [];
    db.tables.meeting_programs = [];
    db.tables.assignment_slots = [];

    const client = db as unknown as ReturnType<typeof createNeonBrowserClient>;
    const program: MeetingProgramDetail = {
      id: "00000000-0000-4000-8000-000000000001",
      meetingDate: "2026-11-02",
      weekType: "normal",
      bimonthCycle: "",
      historyPeriod: "",
      status: "draft",
      updatedAt: new Date().toISOString(),
      slots: [],
    };

    await saveMeetingProgramToNeon(client, "user-user", program);
    expect(db.tables.planning_cycles).toHaveLength(1);
    expect(db.tables.planning_cycles[0].year).toBe(2026);
    expect(db.tables.planning_cycles[0].bimonth_number).toBe(6);

    expect(db.tables.history_periods).toHaveLength(1);
    expect(db.tables.history_periods[0].year).toBe(2026);
    expect(db.tables.history_periods[0].semester).toBe(2);

    expect(db.tables.meeting_programs[0].planning_cycle_id).toBeDefined();
    expect(db.tables.meeting_programs[0].history_period_id).toBeDefined();
  });
});

describe("repositorio de programas: eliminación de borradores", () => {
  function seedDrafts(db: InstanceType<typeof FakeDatabase>, count: number, published: number) {
    db.tables.app_users = [{ user_id: "user-user", role: "user", is_active: true }];
    db.tables.meeting_programs = [];
    db.tables.assignment_slots = [];
    const ids: string[] = [];
    for (let i = 1; i <= count; i++) {
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
      ids.push(id);
      db.tables.meeting_programs.push({ id, meeting_date: `2026-11-0${i}`, is_draft: true });
      db.tables.assignment_slots.push({ id: `slot-${i}`, meeting_program_id: id, is_deleted: false });
    }
    for (let i = 1; i <= published; i++) {
      db.tables.meeting_programs.push({ id: `90000000-0000-4000-8000-${String(i).padStart(12, "0")}`, meeting_date: `2026-12-0${i}`, is_draft: false });
    }
    return ids;
  }

  it("elimina todos los borradores indicados y conserva los publicados", async () => {
    const db = new FakeDatabase();
    const ids = seedDrafts(db, 3, 1);
    const client = db as unknown as ReturnType<typeof createNeonBrowserClient>;

    const deleted = await deleteAllDraftProgramsInNeon(client, "user-user", ids);

    expect(deleted).toBe(3);
    expect(db.tables.meeting_programs).toHaveLength(1);
    expect(db.tables.meeting_programs[0].is_draft).toBe(false);
    expect(db.tables.assignment_slots).toHaveLength(0);
  });

  it("falla si uno de los programas ya está publicado y no lo elimina", async () => {
    const db = new FakeDatabase();
    const ids = seedDrafts(db, 2, 0);
    // El segundo programa se publica antes de eliminarlo
    db.tables.meeting_programs[1].is_draft = false;
    const client = db as unknown as ReturnType<typeof createNeonBrowserClient>;

    await expect(deleteAllDraftProgramsInNeon(client, "user-user", ids)).rejects.toThrow("publicados");
    // El primer borrador sí se eliminó; el publicado se conserva
    expect(db.tables.meeting_programs).toHaveLength(1);
    expect(db.tables.meeting_programs[0].is_draft).toBe(false);
  });

  it("devuelve cero cuando no hay borradores que eliminar", async () => {
    const db = new FakeDatabase();
    seedDrafts(db, 0, 1);
    const client = db as unknown as ReturnType<typeof createNeonBrowserClient>;

    const deleted = await deleteAllDraftProgramsInNeon(client, "user-user", []);

    expect(deleted).toBe(0);
    expect(db.tables.meeting_programs).toHaveLength(1);
  });
});
