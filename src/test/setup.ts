import "@testing-library/jest-dom/vitest";

/**
 * jsdom does not implement HTMLDialogElement.showModal/close (used by the
 * Sheet primitive). Polyfill the open-attribute toggling and close event
 * real browsers provide so component tests can drive it.
 */
if (typeof HTMLDialogElement !== "undefined") {
  const openModalDialogs = new Set<HTMLDialogElement>();

  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute("open", "");
      openModalDialogs.add(this);
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      if (!this.hasAttribute("open")) return;
      this.removeAttribute("open");
      openModalDialogs.delete(this);
      this.dispatchEvent(new Event("close"));
    };
  }

  // Real browsers dispatch a cancelable "cancel" event on Escape for a modal
  // dialog, then close it unless the event was prevented. jsdom does neither.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    for (const dialog of openModalDialogs) {
      const notPrevented = dialog.dispatchEvent(
        new Event("cancel", { cancelable: true }),
      );
      if (notPrevented) {
        dialog.close();
      }
    }
  });
}
