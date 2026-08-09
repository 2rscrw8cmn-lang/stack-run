# Production smoke test

Run this against the deployed production URL, on the iPhone the app is for and
once in a desktop browser. It takes about ten minutes. Nothing here is
automated because the point of it is the things automation cannot see: whether
the app installs, whether it survives being closed, and whether it is usable in
one hand.

`npm run check` is the gate for everything that *can* be automated, and it must
pass before a deploy.

## 1. The build reached the internet

- [ ] The production URL loads, and the header shows the STACK mark and word.
- [ ] View source: `<link rel="manifest" href="/manifest.webmanifest">` is
      there, and opening that path returns JSON rather than the app's HTML.
- [ ] `/favicon.svg`, `/apple-touch-icon.png`, `/icon-192.png`,
      `/icon-512.png` and `/icon-maskable-512.png` all load.
- [ ] `/api/calendar` answers in plain English that the reader is deployed. If
      it returns the app's HTML, the function did not deploy.
- [ ] Nothing in the page mentions a dev or data panel, and there is no control
      that seeds runs.

## 2. Fresh install

Use a private window, or clear site data first, so this is genuinely first-run.

- [ ] Today opens on the current date, with the race line under it.
- [ ] Build says **Nothing built yet** rather than showing an empty grid.
- [ ] Plan opens on the week containing today, and all eighteen weeks are
      reachable with the arrows.
- [ ] `+ Log Run` opens the run sheet.

## 3. The loop, end to end

- [ ] Log today's scheduled run: distance, duration, effort, save.
- [ ] Today shows the completed summary and the block it earned.
- [ ] Build lists the block under **Blocks Ready**.
- [ ] Place it: tap `Place`, choose a column by tapping or dragging, `Drop`.
- [ ] The block is in the tower and the miles at the top of Build went up.
- [ ] Tap the block: the run behind it opens, with the right date and distance.
- [ ] Edit the run's distance and save; the block's width follows.
- [ ] Delete the run; the block leaves the tower and the tower re-settles.

## 4. It is still there tomorrow

- [ ] Log a run, then fully close the browser (or the installed app) and
      reopen it. The run, the plan edits and the tower are all still there.
- [ ] Deploy again, reload, and check the same. A deploy must not cost data.

## 5. Installed to the home screen

- [ ] iOS Safari: **Share → Add to Home Screen**. The icon is the three-bar
      mark, not a screenshot, and the name reads `STACK`.
- [ ] Opening from the home screen shows no browser chrome.
- [ ] The bottom navigation sits clear of the home indicator, and the header
      clears the status bar and the notch.
- [ ] Data logged in Safari is visible in the installed app, and the reverse.

## 6. One-handed and at the edges

- [ ] Nothing scrolls sideways on any screen, on the phone or with a desktop
      window narrowed to 320px.
- [ ] Every button can be hit with a thumb; nothing important sits under the
      bottom navigation.
- [ ] Open the run sheet and tap into Duration: the keyboard does not cover
      `Save Run`.
- [ ] Rotate to landscape and back; nothing is lost or clipped.

## 7. Recovery

Do this deliberately once per release. In the browser console on the production
origin:

```js
localStorage.setItem("stack.app-state.v1", "{ not json");
location.reload();
```

- [ ] The app shows **Your saved training could not be read**, names the backup
      key, and does not show the training screens.
- [ ] `Save the Damaged Copy` downloads a file containing the damaged text.
- [ ] `Start Fresh` asks a second time before doing anything.
- [ ] After confirming, the app opens on the seed plan, and the backup key is
      still in local storage.

Then restore what you had, if this was a browser holding real training:

```js
localStorage.setItem("stack.app-state.v1", localStorage.getItem("<backup key>"));
```

## 8. Accessibility spot check

- [ ] iOS: turn text size up two steps. Nothing overlaps and nothing is cut off.
- [ ] VoiceOver: swipe through Today. The date is the heading, the race line
      reads as one sentence, and every button says what it does.
- [ ] Reduce Motion on: placing a block still works and does not animate.
- [ ] Tab through Plan with a keyboard: focus is always visible, and the week
      arrows, rows and sheets are all reachable.

## Sign-off

Record in `docs/PHASE_STATUS.md`: the commit deployed, the date, the device and
browser used, and anything found. A release with a known P0 or P1 defect is not
signed off.
