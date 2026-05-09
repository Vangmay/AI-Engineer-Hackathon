import type { MysteryCase } from '@/types/case';
import { ConsolePanel } from './ui/ConsolePanel';

interface Props {
  victim: MysteryCase['victim'];
}

export function VictimProfile({ victim }: Props) {
  const rows: [string, string][] = [
    ['NAME', victim.name],
    ['AGE', `${victim.age}`],
    ['OCCUPATION', victim.occupation],
    ['LOCATION', victim.location],
    ['T.O.D', victim.time_of_death],
    ['DATE', victim.date],
  ];
  return (
    <ConsolePanel label="VICTIM // 001" rightSlot="DECEASED">
      <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)] pt-0.5">
              {k}
            </dt>
            <dd className="text-[13px] text-[var(--text-primary)]">{v}</dd>
          </div>
        ))}
      </dl>
    </ConsolePanel>
  );
}
