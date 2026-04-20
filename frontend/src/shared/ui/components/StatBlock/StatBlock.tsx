import './StatBlock.css';

export type StatName = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

export interface StatBlockProps {
  stat: StatName;
  /** The raw ability score (1–30) */
  value: number;
  /** Show modifier (+4, -1, etc.) calculated from value. Default true */
  showMod?: boolean;
  /** Override the calculated modifier */
  modOverride?: number;
  className?: string;
}

function calcMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

function fmtMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function StatBlock({
  stat,
  value,
  showMod = true,
  modOverride,
  className = '',
}: StatBlockProps) {
  const mod = modOverride !== undefined ? modOverride : calcMod(value);

  return (
    <div className={`stat-block ${className}`.trim()}>
      <span className="stat-block__name">{stat}</span>
      <span className="stat-block__score">{value}</span>
      {showMod && <span className="stat-block__mod">{fmtMod(mod)}</span>}
    </div>
  );
}
