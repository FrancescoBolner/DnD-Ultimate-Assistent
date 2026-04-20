import { pool } from '../../../../config/db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface CombatRow {
  id: number;
  campaign_id: number;
  name: string | null;
  round: number;
  status: 'pending' | 'active' | 'paused' | 'completed';
  current_participant_id: number | null;
  started_at: Date | null;
  ended_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface CombatEffect {
  id: string;
  name: string;
  turns_left: number;
  source_effect_id?: number | null;
  is_custom?: boolean;
}

export interface ParticipantRow {
  id: number;
  combat_id: number;
  char_id: number | null;
  creature_id: number | null;
  initiative: number;
  hp_current: number;
  is_active: boolean;
  notes: string | null;
  name?: string;
  type?: 'character' | 'creature';
  hp_max?: number;
  hp_temp?: number;
  effects?: CombatEffect[];
}

export interface StartParticipantInput {
  char_id?: number;
  creature_id?: number;
  initiative?: number;
  hp_current?: number;
}

function safeJsonParse(value: string | null): unknown {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function parseEffects(notes: string | null): CombatEffect[] {
  const parsed = safeJsonParse(notes);
  if (!parsed || typeof parsed !== 'object') return [];
  const rawEffects = (parsed as { effects?: unknown[] }).effects;
  if (!Array.isArray(rawEffects)) return [];

  const out: CombatEffect[] = [];
  for (const e of rawEffects) {
    if (!e || typeof e !== 'object') continue;
    const row = e as Partial<CombatEffect>;
    if (!row.id || !row.name || typeof row.turns_left !== 'number') continue;
    out.push({
      id: String(row.id),
      name: String(row.name),
      turns_left: Math.max(0, Math.floor(row.turns_left)),
      source_effect_id: typeof row.source_effect_id === 'number' ? row.source_effect_id : null,
      is_custom: !!row.is_custom,
    });
  }
  return out;
}

function serializeNotes(currentNotes: string | null, effects: CombatEffect[]): string {
  const parsed = safeJsonParse(currentNotes);
  const base = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  return JSON.stringify({ ...base, effects });
}

function hydrateParticipant(row: ParticipantRow): ParticipantRow {
  return { ...row, effects: parseEffects(row.notes) };
}

async function getEntityDefaultHp(data: { char_id?: number; creature_id?: number }): Promise<number> {
  if (data.char_id) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT hp_current FROM characters WHERE id = ?',
      [data.char_id],
    );
    return Number(rows[0]?.hp_current ?? 1);
  }
  if (data.creature_id) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT hp_current FROM creatures WHERE id = ?',
      [data.creature_id],
    );
    return Number(rows[0]?.hp_current ?? 1);
  }
  return 1;
}

export async function getActiveCombat(campaignId: number): Promise<CombatRow | null> {
  const [rows] = await pool.execute<(CombatRow & RowDataPacket)[]>(
    "SELECT * FROM combat WHERE campaign_id = ? AND status IN ('pending','active','paused') ORDER BY created_at DESC LIMIT 1",
    [campaignId],
  );
  return rows[0] ?? null;
}

export async function listByCampaign(campaignId: number): Promise<CombatRow[]> {
  const [rows] = await pool.execute<(CombatRow & RowDataPacket)[]>(
    'SELECT * FROM combat WHERE campaign_id = ? ORDER BY created_at DESC',
    [campaignId],
  );
  return rows;
}

export async function getById(id: number): Promise<CombatRow | null> {
  const [rows] = await pool.execute<(CombatRow & RowDataPacket)[]>(
    'SELECT * FROM combat WHERE id = ?', [id],
  );
  return rows[0] ?? null;
}

export async function createCombat(campaignId: number, name?: string): Promise<CombatRow> {
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO combat (campaign_id, name, status) VALUES (?, ?, 'pending')`,
    [campaignId, name ?? null],
  );
  return (await getById(result.insertId))!;
}

export async function updateCombat(id: number, data: Partial<{
  name: string;
  round: number;
  status: string;
  current_participant_id: number | null;
}>): Promise<CombatRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name || null); }
  if (data.round !== undefined) { fields.push('round = ?'); values.push(data.round); }
  if (data.status !== undefined) {
    fields.push('status = ?');
    values.push(data.status);
    if (data.status === 'active') fields.push('started_at = NOW()');
    if (data.status === 'completed') fields.push('ended_at = NOW()');
  }
  if (data.current_participant_id !== undefined) {
    fields.push('current_participant_id = ?');
    values.push(data.current_participant_id);
  }

  if (fields.length === 0) return getById(id);
  values.push(id);
  await pool.execute(`UPDATE combat SET ${fields.join(', ')} WHERE id = ?`, values as any[]);
  return getById(id);
}

export async function deleteCombat(id: number): Promise<void> {
  await pool.execute('DELETE FROM combat WHERE id = ?', [id]);
}

export async function getParticipants(combatId: number): Promise<ParticipantRow[]> {
  const [rows] = await pool.execute<(ParticipantRow & RowDataPacket)[]>(
    `SELECT cp.*,
       COALESCE(ch.name, cr.name) AS name,
       CASE WHEN cp.char_id IS NOT NULL THEN 'character' ELSE 'creature' END AS type,
       COALESCE(ch.hp_max, cr.hp_max, cp.hp_current) AS hp_max,
       COALESCE(ch.hp_temp, cr.hp_temp, 0) AS hp_temp
     FROM combat_participants cp
     LEFT JOIN characters ch ON ch.id = cp.char_id
     LEFT JOIN creatures cr ON cr.id = cp.creature_id
     WHERE cp.combat_id = ?
     ORDER BY cp.initiative DESC, cp.id`,
    [combatId],
  );
  return rows.map(hydrateParticipant);
}

export async function getParticipantById(participantId: number): Promise<ParticipantRow | null> {
  const [rows] = await pool.execute<(ParticipantRow & RowDataPacket)[]>(
    `SELECT cp.*,
       COALESCE(ch.name, cr.name) AS name,
       CASE WHEN cp.char_id IS NOT NULL THEN 'character' ELSE 'creature' END AS type,
       COALESCE(ch.hp_max, cr.hp_max, cp.hp_current) AS hp_max,
       COALESCE(ch.hp_temp, cr.hp_temp, 0) AS hp_temp
     FROM combat_participants cp
     LEFT JOIN characters ch ON ch.id = cp.char_id
     LEFT JOIN creatures cr ON cr.id = cp.creature_id
     WHERE cp.id = ?`,
    [participantId],
  );
  return rows[0] ? hydrateParticipant(rows[0]) : null;
}

export async function addParticipant(combatId: number, data: {
  char_id?: number;
  creature_id?: number;
  initiative?: number;
  hp_current?: number;
}): Promise<ParticipantRow> {
  const hp = data.hp_current ?? await getEntityDefaultHp(data);
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO combat_participants (combat_id, char_id, creature_id, initiative, hp_current)
     VALUES (?, ?, ?, ?, ?)`,
    [combatId, data.char_id ?? null, data.creature_id ?? null, data.initiative ?? 0, hp],
  );
  return (await getParticipantById(result.insertId))!;
}

export async function updateParticipant(id: number, data: Partial<{
  initiative: number;
  hp_current: number;
  hp_temp: number;
  is_active: boolean;
  notes: string;
}>): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.initiative !== undefined) { fields.push('initiative = ?'); values.push(data.initiative); }
  if (data.hp_current !== undefined) { fields.push('hp_current = ?'); values.push(data.hp_current); }
  if (data.is_active !== undefined) { fields.push('is_active = ?'); values.push(data.is_active); }
  if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes || null); }

  if (fields.length > 0) {
    values.push(id);
    await pool.execute(`UPDATE combat_participants SET ${fields.join(', ')} WHERE id = ?`, values as any[]);
  }

  // hp_temp lives in the source characters/creatures table — update it there
  if (data.hp_temp !== undefined) {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT char_id, creature_id FROM combat_participants WHERE id = ?', [id],
    );
    const row = rows[0];
    if (row?.char_id) {
      await pool.execute('UPDATE characters SET hp_temp = ? WHERE id = ?', [data.hp_temp, row.char_id]);
    } else if (row?.creature_id) {
      await pool.execute('UPDATE creatures SET hp_temp = ? WHERE id = ?', [data.hp_temp, row.creature_id]);
    }
  }
}

export async function removeParticipant(id: number): Promise<void> {
  await pool.execute('DELETE FROM combat_participants WHERE id = ?', [id]);
}

export async function getCombatIdForParticipant(participantId: number): Promise<number | null> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    'SELECT combat_id FROM combat_participants WHERE id = ?',
    [participantId],
  );
  return rows[0]?.combat_id ? Number(rows[0].combat_id) : null;
}

export async function setParticipantEffects(participantId: number, effects: CombatEffect[]): Promise<void> {
  const participant = await getParticipantById(participantId);
  if (!participant) return;
  const notes = serializeNotes(participant.notes, effects);
  await updateParticipant(participantId, { notes });
}

export async function applyEffectToParticipant(participantId: number, effect: {
  name: string;
  turns_left: number;
  source_effect_id?: number | null;
  is_custom?: boolean;
}): Promise<ParticipantRow | null> {
  const participant = await getParticipantById(participantId);
  if (!participant) return null;

  const normalizedName = effect.name.trim().toLowerCase();
  if (!normalizedName) return participant;

  const turnsLeft = Math.max(1, Math.floor(effect.turns_left));
  const effects = [...(participant.effects ?? [])];
  const existing = effects.find((e) => e.name.trim().toLowerCase() === normalizedName);

  if (existing) {
    existing.turns_left = turnsLeft;
    existing.source_effect_id = effect.source_effect_id ?? existing.source_effect_id ?? null;
    existing.is_custom = effect.is_custom ?? existing.is_custom ?? true;
  } else {
    effects.push({
      id: `fx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: effect.name.trim(),
      turns_left: turnsLeft,
      source_effect_id: effect.source_effect_id ?? null,
      is_custom: effect.is_custom ?? true,
    });
  }

  await setParticipantEffects(participantId, effects);
  return getParticipantById(participantId);
}

export async function updateParticipantEffectTurns(
  participantId: number,
  effectId: string,
  turnsLeft: number,
): Promise<ParticipantRow | null> {
  const participant = await getParticipantById(participantId);
  if (!participant) return null;
  const effects = [...(participant.effects ?? [])];
  const target = effects.find((e) => e.id === effectId);
  if (!target) return participant;
  target.turns_left = Math.floor(turnsLeft);
  await setParticipantEffects(participantId, effects.filter((e) => e.turns_left >= -1));
  return getParticipantById(participantId);
}

export async function removeParticipantEffect(
  participantId: number,
  effectId: string,
): Promise<ParticipantRow | null> {
  const participant = await getParticipantById(participantId);
  if (!participant) return null;
  const effects = (participant.effects ?? []).filter((e) => e.id !== effectId);
  await setParticipantEffects(participantId, effects);
  return getParticipantById(participantId);
}

export async function startCombat(
  campaignId: number,
  payload: { name?: string; participants: StartParticipantInput[] },
): Promise<{ combat: CombatRow; participants: ParticipantRow[] }> {
  const existing = await getActiveCombat(campaignId);
  if (existing) {
    await updateCombat(existing.id, { status: 'completed' });
  }

  const combat = await createCombat(campaignId, payload.name);

  for (const p of payload.participants) {
    if (!p.char_id && !p.creature_id) continue;
    await addParticipant(combat.id, p);
  }

  const participants = await getParticipants(combat.id);
  const first = participants[0] ?? null;
  const updatedCombat = (await updateCombat(combat.id, {
    status: participants.length > 0 ? 'active' : 'pending',
    round: 1,
    current_participant_id: first?.id ?? null,
  }))!;

  return { combat: updatedCombat, participants };
}

export async function advanceTurn(combatId: number): Promise<{
  combat: CombatRow | null;
  participants: ParticipantRow[];
}> {
  const combat = await getById(combatId);
  if (!combat) return { combat: null, participants: [] };

  const participants = await getParticipants(combatId);
  if (participants.length === 0) return { combat, participants };

  let currentIdx = participants.findIndex((p) => p.id === combat.current_participant_id);
  if (currentIdx < 0) currentIdx = 0;

  const endingParticipant = participants[currentIdx];
  if (endingParticipant) {
    const decremented = (endingParticipant.effects ?? [])
      .map((e) => ({ ...e, turns_left: e.turns_left - 1 }))
      .filter((e) => e.turns_left >= 0);
    await setParticipantEffects(endingParticipant.id, decremented);
  }

  const nextIdx = (currentIdx + 1) % participants.length;
  const wrapped = nextIdx === 0;
  const updatedCombat = await updateCombat(combatId, {
    status: 'active',
    current_participant_id: participants[nextIdx].id,
    round: wrapped ? combat.round + 1 : combat.round,
  });

  return {
    combat: updatedCombat,
    participants: await getParticipants(combatId),
  };
}
