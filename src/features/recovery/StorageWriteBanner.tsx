import { CloudAlert, X } from "lucide-react";
import { IconButton } from "../../components/ui/IconButton";

interface StorageWriteBannerProps {
  message: string;
  onDismiss: () => void;
}

/**
 * Says that the last change did not reach storage.
 *
 * A failed write is invisible by design — the screen already shows the run,
 * and the loss only appears on the next cold start, by which time there is
 * nothing to be done. Saying it now is the difference between a user who
 * writes the run down somewhere else and one who loses it.
 */
export function StorageWriteBanner({
  message,
  onDismiss,
}: StorageWriteBannerProps) {
  return (
    <div className="write-banner" role="alert">
      <span className="write-banner__icon" aria-hidden="true">
        <CloudAlert size={18} strokeWidth={1.8} />
      </span>
      <p className="write-banner__text">{message}</p>
      <IconButton
        label="Dismiss"
        icon={<X size={18} strokeWidth={1.8} />}
        onClick={onDismiss}
      />
    </div>
  );
}
