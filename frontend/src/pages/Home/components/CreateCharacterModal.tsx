import { useState } from 'react';
import { Button, Input, Select, Textarea, Modal } from '../../../shared/ui';
import { DND_CLASSES, DND_RACES, STAT_KEYS, abilityModifier } from '../../../shared/constants/dnd';
import type { CharacterCreateData } from '../../../services/api/campaigns';
import type { CharacterForm } from '../constants';
import { defaultCharForm } from '../constants';

interface CreateCharacterModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CharacterCreateData) => Promise<void>;
}

export default function CreateCharacterModal({ open, onClose, onSubmit }: CreateCharacterModalProps) {
  const [form, setForm] = useState<CharacterForm>(defaultCharForm());
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  function reset() {
    setForm(defaultCharForm());
    setErr('');
  }

  function setStat(key: keyof CharacterForm, raw: string) {
    const v = parseInt(raw, 10);
    setForm(f => ({ ...f, [key]: isNaN(v) ? 0 : Math.min(30, Math.max(1, v)) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setErr('Name required'); return; }
    setLoading(true); setErr('');
    try {
      const data: CharacterCreateData = {
        name: form.name.trim(),
        race: form.race || undefined,
        class: form.class || undefined,
        level: form.level,
        hp_max: form.hp_max,
        ac: form.ac,
        speed: form.speed,
        image: form.image || undefined,
        backstory: form.backstory || undefined,
        stats: { str: form.str, dex: form.dex, con: form.con, int: form.int, wis: form.wis, cha: form.cha },
      };
      await onSubmit(data);
      reset();
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : 'Failed');
    } finally { setLoading(false); }
  }

  return (
    <Modal open={open} onClose={() => { onClose(); reset(); }} title="Create Character" size="lg">
      <form onSubmit={handleSubmit} className="char-form">

        <section className="char-form__section">
          <h4 className="char-form__heading">Basic Info</h4>
          <div className="char-form__row char-form__row--3">
            <Input label="Name" required placeholder="Thalindra"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="char-form__row char-form__row--3">
            <Select label="Class" value={form.class}
              onChange={e => setForm(f => ({ ...f, class: e.target.value }))}>
              {DND_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            <div className="char-form__combo-wrap">
              <label className="char-form__combo-label">Race</label>
              <input className="input-group__input" list="create-char-races"
                value={form.race}
                onChange={e => setForm(f => ({ ...f, race: e.target.value }))}
                placeholder="Human" />
              <datalist id="create-char-races">
                {DND_RACES.map(r => <option key={r} value={r} />)}
              </datalist>
            </div>
            <div style={{ maxWidth: 100 }}>
              <Input label="Level" type="number" min={1} max={20}
                value={form.level} onChange={e => setStat('level', e.target.value)} />
            </div>
          </div>
          <Input label="Portrait URL" placeholder="https://…"
            value={form.image} onChange={e => setForm(f => ({ ...f, image: e.target.value }))} />
        </section>

        <section className="char-form__section">
          <h4 className="char-form__heading">Ability Scores</h4>
          <div className="stats-grid">
            {STAT_KEYS.map(stat => (
              <div key={stat} className="stat-block">
                <span className="stat-block__label">{stat.toUpperCase()}</span>
                <input className="stat-block__input" type="number" min={1} max={30}
                  value={form[stat]} onChange={e => setStat(stat, e.target.value)} />
                <span className="stat-block__mod">{abilityModifier(form[stat])}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="char-form__section">
          <h4 className="char-form__heading">Combat</h4>
          <div className="char-form__row char-form__row--3">
            <Input label="Max HP" required type="number" min={1}
              value={form.hp_max} onChange={e => setStat('hp_max', e.target.value)} />
            <Input label="AC" required type="number" min={1}
              value={form.ac} onChange={e => setStat('ac', e.target.value)} />
            <Input label="Speed" required type="number" min={0} step={5}
              value={form.speed} onChange={e => setStat('speed', e.target.value)} />
          </div>
        </section>

        <section className="char-form__section">
          <h4 className="char-form__heading">Backstory</h4>
          <Textarea placeholder="Tell the tale…" value={form.backstory}
            onChange={e => setForm(f => ({ ...f, backstory: e.target.value }))} rows={4} />
        </section>

        {err && <p className="msg--err">{err}</p>}
        <div className="modal-form__footer">
          <Button variant="ghost" type="button" onClick={() => { onClose(); reset(); }}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={loading}>
            {loading ? 'Creating…' : 'Create Character'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
