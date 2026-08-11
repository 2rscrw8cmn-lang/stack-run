import { Sparkles } from "lucide-react";

interface PropsButtonProps {
  runOwnerName: string;
  count: number;
  pressed: boolean;
  pending: boolean;
  isOwnRun: boolean;
  available?: boolean;
  detail?: boolean;
  onToggle: () => void;
}

function propsCountLabel(count: number): string {
  return `${count} ${count === 1 ? "Prop" : "Props"}`;
}

export function PropsButton({
  runOwnerName,
  count,
  pressed,
  pending,
  isOwnRun,
  available = true,
  detail = false,
  onToggle,
}: PropsButtonProps) {
  if (!available) {
    return (
      <div className="crew-props crew-props--own" aria-label="Props unavailable">
        <span className="crew-props__action" aria-hidden="true">
          <Sparkles size={15} strokeWidth={1.8} />
          <span>Props unavailable</span>
        </span>
      </div>
    );
  }

  if (isOwnRun) {
    return (
      <div
        className="crew-props crew-props--own"
        data-detail={detail || undefined}
        aria-label={`${propsCountLabel(count)}. Props are for encouraging teammates.`}
      >
        <span className="crew-props__action" aria-hidden="true">
          <Sparkles size={15} strokeWidth={1.8} />
          <span>Props</span>
        </span>
        {!detail && <span className="crew-props__count data-value" aria-hidden="true">{count}</span>}
      </div>
    );
  }

  return (
    <div className="crew-props" data-detail={detail || undefined} data-propped={pressed || undefined}>
      <button
        type="button"
        className="crew-props__action"
        aria-label={`${pressed ? "Remove Props from" : "Give Props to"} ${runOwnerName}`}
        aria-pressed={pressed}
        aria-busy={pending}
        disabled={pending}
        onClick={onToggle}
      >
        <Sparkles size={15} strokeWidth={1.8} aria-hidden="true" />
        <span>{pressed ? "Propped" : detail ? "Give Props" : "Props"}</span>
      </button>
      {!detail && (
        <span className="crew-props__count data-value" aria-label={propsCountLabel(count)}>
          {count}
        </span>
      )}
    </div>
  );
}
