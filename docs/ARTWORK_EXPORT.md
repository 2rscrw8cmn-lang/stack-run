# Artwork Export

STACK's Crew emblems and Runner Icons are vector artwork already. The exporter writes those exact live designs as standalone SVG masters for hats, shirts, stickers, Illustrator and vendor handoff.

## Phone-first export

The primary interface is a private utility page that is deliberately absent from normal STACK navigation:

```text
https://<your-stack-host>/#artwork
```

Open that URL on the same iPhone/browser where you normally use STACK.

- If the STACK session is still signed in, the page opens directly to the current Crew artwork.
- If not, it offers the normal email + 8-digit STACK PIN sign-in.
- Accounts in multiple Crews can pick which Crew to export.
- `Save SVG` exports one emblem or Runner Icon.
- `Export Crew Pack` creates one ZIP containing the Crew emblem plus every member Runner Icon.

On iPhone, the exporter prefers the native Share sheet. Choose **Save to Files** to keep the SVG/ZIP on the phone, or send it directly through AirDrop, Messages, Mail, Drive, or another installed app. Browsers without file sharing fall back to a normal download.

The page is intentionally not linked from the bottom navigation or Settings. Knowing `#artwork` is the entry point; this is an owner/production utility, not normal product UI.

## Output

A Crew pack contains files such as:

```text
fastboyz-artwork.zip
  fastboyz-emblem.svg
  zack.svg
  drew.svg
  andy-williams.svg
  g-wig.svg
  nick.svg
```

Duplicate display names receive a numeric suffix so no artwork is overwritten.

## What the SVG contains

- Crew emblems use `crewEmblemSvgMarkup`, the same canonical drawing used by the app.
- Runner Icons use the same selected head, face, body, flair and backdrop paths as the app.
- Runner colors and icon ink/field/mark colors are read from the live STACK design tokens.
- Files have transparent space outside the mark and remain fully scalable vector artwork.

The SVG is the right master file for Illustrator, screen print, vinyl, stickers and vendor handoff. For embroidery, send the SVG to the embroidery vendor; they can digitize it into their machine format such as DST or PES.

## Security boundary

The phone exporter uses the normal persisted Supabase session and existing RLS. It does not use a service-role key and does not read private personal training/health data. If sign-in is required, the PIN goes through the same Supabase password-auth path as normal STACK and is not stored by the exporter.

## Optional local CLI

The repository also keeps the command-line exporter as a secondary developer tool:

```bash
npm run export:artwork
```

It reads public Supabase configuration from `.env.local`, prompts for the normal STACK account, and writes files to:

```text
exports/<crew>/
```

`exports/` is gitignored. To choose a Crew directly:

```bash
npm run export:artwork -- --crew FASTboyz
```

The value may be an exact Crew name or Crew id. Use the id when more than one Crew has the same name.
