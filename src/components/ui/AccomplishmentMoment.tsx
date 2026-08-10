import { Sparkles } from "lucide-react";
import type { AccomplishmentMoment as Moment } from "../../domain/accomplishments";

export function AccomplishmentMoment({ moments }: { moments: Moment[] }) {
  if (moments.length === 0) return null;

  return (
    <aside className="accomplishment-moment data-module" role="status" aria-live="polite">
      <span className="accomplishment-moment__icon" aria-hidden="true">
        <Sparkles size={18} strokeWidth={1.8} />
      </span>
      <span className="accomplishment-moment__system machine-label">Accomplishment</span>
      <span className="accomplishment-moment__facts">
        {moments.map((moment) => (
          <span key={moment.id} className="accomplishment-moment__fact">
            <span className="accomplishment-moment__label machine-label">{moment.label}</span>
            <strong className="accomplishment-moment__value data-value">{moment.value}</strong>
          </span>
        ))}
      </span>
    </aside>
  );
}
