import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";

interface TourCoachmarkProps {
  title: string;
  copy: string;
  step?: number;
  total?: number;
  nextLabel?: string;
  onNext: () => void;
  onDismiss: () => void;
}

export function TourCoachmark({
  title,
  copy,
  step,
  total,
  nextLabel = "Next",
  onNext,
  onDismiss,
}: TourCoachmarkProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", dismissOnEscape);
    return () => window.removeEventListener("keydown", dismissOnEscape);
  }, [onDismiss]);

  return (
    <aside
      className="tour-coachmark"
      role="dialog"
      aria-modal="false"
      aria-labelledby="tour-coachmark-title"
      aria-describedby="tour-coachmark-copy"
    >
      <div className="tour-coachmark__head">
        <div>
          {step !== undefined && total !== undefined && (
            <p className="tour-coachmark__step machine-label">
              {step} of {total}
            </p>
          )}
          <h2 ref={titleRef} id="tour-coachmark-title" tabIndex={-1}>{title}</h2>
        </div>
        <IconButton
          label="Dismiss tour"
          icon={<X size={18} strokeWidth={1.8} />}
          onClick={onDismiss}
        />
      </div>
      <p id="tour-coachmark-copy">{copy}</p>
      <div className="tour-coachmark__actions">
        {step !== undefined && <Button variant="ghost" onClick={onDismiss}>Skip Tour</Button>}
        <Button onClick={onNext}>{nextLabel}</Button>
      </div>
    </aside>
  );
}
