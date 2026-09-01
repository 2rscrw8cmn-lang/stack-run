import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { IconButton } from "./IconButton.js";

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
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
      titleRef.current?.focus();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  /**
   * iOS Safari needs the visual viewport only while its keyboard is genuinely
   * consuming a large part of the screen. Browser chrome also resizes and
   * scrolls `visualViewport`; treating every one of those small changes like a
   * keyboard is what made ordinary Crew sheets float halfway up the page.
   *
   * Keep normal sheets on CSS `100dvh` and only opt into the visual-viewport
   * override when the visible height has shrunk enough to clearly be a
   * keyboard. When it closes, remove the overrides immediately so the panel
   * returns to the real bottom edge.
   */
  useEffect(() => {
    const dialog = dialogRef.current;
    const viewport = window.visualViewport;
    if (!isOpen || !dialog || !viewport) return;

    const clearVisualViewportOverride = () => {
      dialog.style.removeProperty("--sheet-height");
      dialog.style.removeProperty("--sheet-top");
    };

    const syncToVisualViewport = () => {
      const layoutHeight = window.innerHeight;
      const missingHeight = Math.max(
        0,
        layoutHeight - viewport.height - viewport.offsetTop,
      );
      const keyboardLikelyOpen =
        missingHeight > 160 || viewport.height < layoutHeight * 0.75;

      if (!keyboardLikelyOpen) {
        clearVisualViewportOverride();
        return;
      }

      dialog.style.setProperty("--sheet-height", `${viewport.height}px`);
      dialog.style.setProperty("--sheet-top", `${viewport.offsetTop}px`);
    };

    syncToVisualViewport();
    viewport.addEventListener("resize", syncToVisualViewport);
    viewport.addEventListener("scroll", syncToVisualViewport);

    return () => {
      viewport.removeEventListener("resize", syncToVisualViewport);
      viewport.removeEventListener("scroll", syncToVisualViewport);
      clearVisualViewportOverride();
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
          <h2 ref={titleRef} id={titleId} className="sheet__title" tabIndex={-1}>
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
