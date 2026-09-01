import { Download, RotateCcw, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { StackMark } from "../../components/shared/StackMark.js";
import { Button } from "../../components/ui/Button.js";
import type { StorageLoadFailure } from "../../storage/appStateRepository.js";

interface StorageRecoveryScreenProps {
  reason: StorageLoadFailure;
  /** What went wrong, in the words of whatever threw. */
  detail: string;
  /** Where the unreadable value was kept, when it could be kept at all. */
  backupKey: string | null;
  /** Reads the backup's raw text so it can be saved off the device. */
  onReadBackup: (backupKey: string) => string | null;
  /** Discards the unreadable state and starts without an active plan. */
  onStartFresh: () => void;
  /** Carries on in memory, saving nothing. Only offered for unreadable storage. */
  onContinueAnyway: () => void;
  onRetry?: () => void;
}

function canDownload(): boolean {
  return (
    typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
  );
}

/**
 * What STACK shows instead of an empty plan when the state in this browser
 * cannot be read.
 *
 * Everything the app knows lives in one browser, so unreadable storage is the
 * one failure that can cost a user a season of training. Silently starting
 * over — which is what this app used to do — turns a recoverable problem into
 * an unrecoverable one, and does it without telling anybody. So: nothing is
 * overwritten until the user says so, the damaged copy is named and can be
 * taken off the device, and starting fresh takes two deliberate presses.
 */
export function StorageRecoveryScreen({
  reason,
  detail,
  backupKey,
  onReadBackup,
  onStartFresh,
  onContinueAnyway,
  onRetry,
}: StorageRecoveryScreenProps) {
  const [isConfirming, setConfirming] = useState(false);
  const [downloadNote, setDownloadNote] = useState("");

  function downloadBackup() {
    if (backupKey === null) return;
    const raw = onReadBackup(backupKey);
    if (raw === null) {
      setDownloadNote("That copy is no longer in this browser.");
      return;
    }

    const url = URL.createObjectURL(
      new Blob([raw], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${backupKey}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setDownloadNote("Saved to your downloads.");
  }

  return (
    <div className="recovery">
      <div className="recovery__panel">
        <div className="recovery__brand">
          <StackMark size={28} />
          <p className="wordmark wordmark--small">STACK</p>
        </div>

        <span className="recovery__icon" aria-hidden="true">
          <TriangleAlert size={26} strokeWidth={1.8} />
        </span>

        <h1 className="recovery__title">
          {reason === "unreadable"
            ? "This browser will not let STACK save"
            : "Your saved training could not be read"}
        </h1>

        {reason === "unreadable" ? (
          <>
            <p className="recovery__body">
              STACK keeps everything in this browser, and this one is not
              handing its storage over. A private window, or a setting that
              blocks site data, will both do it.
            </p>
            <p className="recovery__body">
              You can carry on from here, but nothing you log will still be
              here when you come back.
            </p>
          </>
        ) : (
          <>
            <p className="recovery__body">
              Something stored for STACK in this browser is damaged, so the
              plan, the runs and the tower could not be rebuilt from it.
            </p>
            <p className="recovery__body">
              <strong>Nothing has been overwritten.</strong>{" "}
              {backupKey === null
                ? "The damaged copy is still where it was."
                : "The damaged copy was set aside first, so it can still be looked at or saved off this device."}
            </p>
          </>
        )}

        <p className="recovery__detail">{detail}</p>
        {backupKey !== null && (
          <p className="recovery__detail recovery__detail--key">{backupKey}</p>
        )}

        <div className="recovery__actions">
          {reason === "unreadable" ? (
            <Button onClick={onContinueAnyway}>Continue Without Saving</Button>
          ) : isConfirming ? (
            <>
              <p className="recovery__warning" role="alert">
                Starting fresh restores the plan STACK ships with and leaves no
                runs and no blocks. This cannot be undone from inside the app.
              </p>
              <Button variant="danger" onClick={onStartFresh}>
                Yes, Start Fresh
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              {backupKey !== null && canDownload() && (
                <Button
                  variant="secondary"
                  icon={<Download size={18} strokeWidth={2} />}
                  onClick={downloadBackup}
                >
                  Save the Damaged Copy
                </Button>
              )}
              <Button variant="secondary" onClick={() => setConfirming(true)}>
                Start Fresh
              </Button>
            </>
          )}

          {onRetry && !isConfirming && (
            <Button
              variant="ghost"
              icon={<RotateCcw size={18} strokeWidth={2} />}
              onClick={onRetry}
            >
              Try Again
            </Button>
          )}
        </div>

        <p className="recovery__note" aria-live="polite">
          {downloadNote}
        </p>
      </div>
    </div>
  );
}
