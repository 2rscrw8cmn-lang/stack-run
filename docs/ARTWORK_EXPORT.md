# Local Artwork Export

STACK's Crew emblems and Runner Icons are vector artwork already. The local exporter writes those exact live designs as standalone SVG files without adding any download controls to the app.

## Run it

From the repository:

```bash
npm run export:artwork
```

The command:

1. reads the same public Supabase configuration the app uses from `.env.local`;
2. prompts for the normal STACK email and 8-digit PIN;
3. hides the PIN while it is entered and does not persist it;
4. lets the signed-in runner choose a Crew when the account belongs to more than one;
5. reads only Crew/profile identity data that account is already allowed to read through RLS;
6. writes the Crew emblem and every member Runner Icon to `exports/<crew>/`.

Example output:

```text
exports/
  fastboyz/
    fastboyz-emblem.svg
    zack.svg
    drew.svg
    andy-williams.svg
    g-wig.svg
    nick.svg
```

`exports/` is gitignored. The generated files are local production artwork, not app assets that should be committed.

## Pick a Crew directly

```bash
npm run export:artwork -- --crew FASTboyz
```

The value may be an exact Crew name or Crew id. Use the id when more than one Crew has the same name.

## What the SVG contains

- Crew emblems use `crewEmblemSvgMarkup`, the same canonical drawing used by the app.
- Runner Icons use the same selected head, face, body, flair and backdrop paths as the app.
- Runner colors and icon ink/field/mark colors are read from the current STACK design tokens.
- Files have transparent space outside the mark and remain fully scalable vector artwork.

The SVG is the right master file for Illustrator, screen print, vinyl, stickers and vendor handoff. For embroidery, send the SVG to the embroidery vendor; they can digitize it into their machine format such as DST or PES.

## Security boundary

The exporter uses the normal STACK account sign-in and existing RLS. It does not use a service-role key, does not read private personal training/health data, and does not store the STACK PIN.
