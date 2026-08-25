interface StackMarkProps {
  size?: number;
  className?: string;
}

/**
 * The STACK runner mark.
 *
 * Keep this component as the single in-app brand-mark entry point so existing
 * placements — shell, onboarding, invite/recovery states and help — all use the
 * same artwork without each surface owning its own copy.
 */
export function StackMark({ size = 24, className }: StackMarkProps) {
  return (
    <img
      className={className}
      src="/stack-runner-mark.svg"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{ objectFit: "contain" }}
    />
  );
}
