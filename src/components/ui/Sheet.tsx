import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconButton } from "./IconButton";

interface SheetProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  /** Return false to keep the sheet open (e.g. unsaved changes). */
  guardClose?: () => boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Mobile bottom sheet and wider-screen dialog in one component, built on the
 * native <dialog> element so focus trapping and Escape handling come for free.
 */
export function Sheet({ title, isOpen, onClose, guardClose, children, className }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  /**
   * iOS Safari keeps fixed elements sized to the layout viewport when the
   * on-screen keyboard opens, which hides the bottom of the sheet — including
   * its primary action — behind the keyboard. Follow the visual viewport
   * instead so the sheet always occupies the part of the screen the user
   * can actually see.
   */
  useEffect(() => {
    const dialog = dialogRef.current;
    const viewport = window.visualViewport;
    if (!isOpen || !dialog || !viewport) return;

    const syncToVisualViewport = () => {
      dialog.style.setProperty("--sheet-height", `${viewport.height}px`);
      dialog.style.setProperty("--sheet-top", `${viewport.offsetTop}px`);
    };

    syncToVisualViewport();
    viewport.addEventListener("resize", syncToVisualViewport);
    viewport.addEventListener("scroll", syncToVisualViewport);

    return () => {
      viewport.removeEventListener("resize", syncToVisualViewport);
      viewport.removeEventListener("scroll", syncToVisualViewport);
      dialog.style.removeProperty("--sheet-height");
      dialog.style.removeProperty("--sheet-top");
    };
  }, [isOpen]);

  function requestClose() {
    if (guardClose && !guardClose()) {
      return;
    }
    dialogRef.current?.close();
  }

  return (
    <dialog
      ref={dialogRef}
      className={["sheet", className].filter(Boolean).join(" ")}
      aria-labelledby={titleId}
      onCancel={(event) => {
        if (guardClose && !guardClose()) {
          event.preventDefault();
        }
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          requestClose();
        }
      }}
    >
      <div className="sheet__panel">
        <div className="sheet__header">
          <h2 id={titleId} className="sheet__title">
            {title}
          </h2>
          <IconButton
            label="Close"
            icon={<X size={20} strokeWidth={1.8} />}
            onClick={requestClose}
          />
        </div>
        <div className="sheet__body">{children}</div>
      </div>
    </dialog>
  );
}
