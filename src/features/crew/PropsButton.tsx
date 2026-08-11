import { ThumbsUp } from "lucide-react";

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
  if (!available) return null;

  if (isOwnRun) {
    if (detail || count === 0) return null;
    return (
      <div
        className="crew-props crew-props--own"
        data-detail={detail || undefined}
        aria-label={`${propsCountLabel(count)}. Props are for encouraging teammates.`}
      >
        <span className="crew-props__action" aria-hidden="true">
          <ThumbsUp size={15} strokeWidth={1.8} />
          <span>{count}</span>
        </span>
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
        <ThumbsUp size={15} strokeWidth={1.8} aria-hidden="true" />
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
