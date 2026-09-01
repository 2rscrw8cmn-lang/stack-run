import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { IconButton } from "./IconButton.js";

interface SheetProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  /** Return false to keep the sheet open (e.g. unsaved changes). */
  guardClose?: () => boolean;
  /**
   * Controls that belong to what the sheet is *about*, placed before Close.
   *
   * Added for Run Detail's `…` (issue #214), which owns editing, plan linking
   * and provenance so the sheet body can be about the activity. Kept as a slot
   * rather than a built-in overflow menu: what a sheet's own control does is
   * the sheet's business, not this primitive's.
   */
  headerActions?: ReactNode;
  /**
   * Keeps the sheet's chrome to its controls, with the title present for the
   * dialog's accessible name but not drawn.
   *
   * Run Detail (issue #214) owns its own identity — an icon, the run's name,
   * the date and its chips — and that identity belongs *in* the activity, so it
   * scrolls away as the runner moves into the analysis. A fixed heading
   * repeating it would both duplicate it and hold a bar of chrome over the
   * content for the whole scroll.
   */
  hideTitle?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * Mobile bottom sheet and wider-screen dialog in one component, built on the
 * native <dialog> element so focus trapping and Escape handling come for free.
 *
 * On a phone the shape is deterministic and comes entirely from CSS: the
 * dialog is the visible viewport, the panel is against its bottom edge with
 * rounded top corners, and the backdrop covers everything else. Nothing
 * measures the browser's chrome to get there. The one exception is the
 * on-screen keyboard, below.
 */
export function Sheet({
  title,
  isOpen,
  onClose,
  guardClose,
  headerActions,
  hideTitle = false,
  children,
  className,
}: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLElement>(null);
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
   * Whether the sheet is currently holding a field the on-screen keyboard has
   * come up for. This is a fact about the sheet's own focus, not about the
   * size of the window: browser chrome resizes and scrolls `visualViewport`
   * too, and inferring a keyboard from those dimensions is what left an
   * ordinary read-only Crew sheet floating halfway up the page with the page
   * still visible underneath it.
   */
  const [editingField, setEditingField] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return;

    const takesKeyboard = (node: EventTarget | null) =>
      node instanceof HTMLElement &&
      (node.isContentEditable || node.matches("input, textarea, select"));

    const onFocusIn = (event: FocusEvent) => setEditingField(takesKeyboard(event.target));
    // Focus leaving a field dismisses the keyboard, including when it moves to
    // another control in the same sheet — `focusin` re-arms if that one takes
    // the keyboard too.
    const onFocusOut = () => setEditingField(false);

    // A sheet can open straight onto a field (autofocus), before any event.
    setEditingField(takesKeyboard(document.activeElement));
    dialog.addEventListener("focusin", onFocusIn);
    dialog.addEventListener("focusout", onFocusOut);

    return () => {
      dialog.removeEventListener("focusin", onFocusIn);
      dialog.removeEventListener("focusout", onFocusOut);
      setEditingField(false);
    };
  }, [isOpen]);

  /**
   * The one case CSS cannot answer: iOS Safari keeps a fixed element sized to
   * the layout viewport when the keyboard opens, so the bottom of the sheet —
   * including its primary action — ends up behind the keys. While, and only
   * while, a field in this sheet has focus, size and place the dialog against
   * the visual viewport instead. Everything else — every read-only sheet, and
   * every sheet whose fields are idle — stays on plain CSS: a full-viewport
   * dialog with its panel against the bottom edge, which is what `.sheet`
   * already describes and what the browser can keep correct on its own
   * through a toolbar collapsing or expanding.
   *
   * The overrides are removed by this effect's own cleanup, so they are gone
   * the moment focus leaves the field rather than at the next resize.
   */
  useEffect(() => {
    const dialog = dialogRef.current;
    const viewport = window.visualViewport;
    if (!isOpen || !editingField || !dialog || !viewport) return;

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
  }, [isOpen, editingField]);

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
        <div className={hideTitle ? "sheet__header sheet__header--chrome" : "sheet__header"}>
          {/*
            With the title hidden it stays the dialog's accessible name and the
            place focus lands on open, but stops being a heading: the sheet's
            own content supplies the visible one, and two headings reading the
            same words is a worse answer for a screen reader than for anyone.
          */}
          {hideTitle ? (
            <span
              ref={titleRef as RefObject<HTMLSpanElement>}
              id={titleId}
              className="sheet__title visually-hidden"
              tabIndex={-1}
            >
              {title}
            </span>
          ) : (
            <h2
              ref={titleRef as RefObject<HTMLHeadingElement>}
              id={titleId}
              className="sheet__title"
              tabIndex={-1}
            >
              {title}
            </h2>
          )}
          <div className="sheet__header-actions">
            {headerActions}
            <IconButton
              label="Close"
              icon={<X size={20} strokeWidth={1.8} />}
              onClick={requestClose}
            />
          </div>
        </div>
        <div className="sheet__body">{children}</div>
      </div>
    </dialog>
  );
}
