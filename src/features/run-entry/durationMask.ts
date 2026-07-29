const MAX_DIGITS = 6;

/**
 * Formats raw keystrokes into one of the accepted duration formats (`MM:SS` or
 * `H:MM:SS`) so the field can be filled from a digits-only keypad, which has no
 * colon key. Digits fill from the seconds up: "3142" becomes "31:42" and
 * "10530" becomes "1:05:30". Anything that is not a digit is dropped, so a
 * typed or pasted colon is harmless.
 */
export function maskDurationInput(raw: string): string {
  // Leading zeros are dropped so re-masking the field's own value keeps growing
  // the number the user is typing: "0:03" plus a "1" is "0:31", not "00:31".
  const digits = raw
    .replace(/\D/g, "")
    .replace(/^0+/, "")
    .slice(0, MAX_DIGITS);

  switch (digits.length) {
    case 0:
      return "";
    case 1:
    case 2:
      return `0:${digits.padStart(2, "0")}`;
    case 3:
    case 4:
      return `${digits.slice(0, -2)}:${digits.slice(-2)}`;
    default:
      return `${digits.slice(0, -4)}:${digits.slice(-4, -2)}:${digits.slice(-2)}`;
  }
}
