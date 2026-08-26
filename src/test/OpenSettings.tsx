import { useState } from "react";
import { SettingsSheet } from "../features/settings/SettingsSheet.js";

type SettingsProps = Parameters<typeof SettingsSheet>[0];

/**
 * The Settings sheet already open, holding its own open state.
 *
 * Settings is controlled by the shell so that dismissing one of the sheets it
 * opens can come back to it. A test that pinned `isOpen` would therefore leave
 * two dialogs on screen at once and make every query ambiguous; this is the
 * same wiring the shell does, in six lines.
 */
export function OpenSettings(
  props: Omit<SettingsProps, "isOpen" | "onOpenChange">,
) {
  const [isOpen, setOpen] = useState(true);
  return <SettingsSheet isOpen={isOpen} onOpenChange={setOpen} {...props} />;
}
