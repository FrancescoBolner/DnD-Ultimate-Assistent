import { StatBlock, type StatName } from '../../components/StatBlock';
import './StatRow.css';

export interface AbilityScores {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface StatRowProps {
  stats: AbilityScores;
  /** Override modifiers (useful for creatures with manual mod overrides) */
  modOverrides?: Partial<Record<Lowercase<StatName>, number>>;
  className?: string;
}

const STATS: { key: keyof AbilityScores; label: StatName }[] = [
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' },
  { key: 'wis', label: 'WIS' },
  { key: 'cha', label: 'CHA' },
];

export function StatRow({ stats, modOverrides, className = '' }: StatRowProps) {
  return (
    <div className={`stat-row ${className}`.trim()}>
      {STATS.map(({ key, label }) => (
        <StatBlock
          key={key}
          stat={label}
          value={stats[key]}
          modOverride={modOverrides?.[key]}
        />
      ))}
    </div>
  );
}
