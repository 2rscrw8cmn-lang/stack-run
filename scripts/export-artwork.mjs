#!/usr/bin/env node

// Secondary local interface for the same production artwork available at
// `#artwork`. The phone-first page is the normal owner workflow; this command
// remains useful when a desktop folder of SVGs is more convenient.

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function args() {
  const out = { crew: null, help: false };
  const input = process.argv.slice(2);
  for (let i = 0; i < input.length; i += 1) {
    if (input[i] === "--help" || input[i] === "-h") out.help = true;
    else if (input[i] === "--crew") {
      out.crew = input[++i] ?? null;
      if (!out.crew) throw new Error("--crew requires a crew name or id.");
    } else throw new Error(`Unknown option: ${input[i]}`);
  }
  return out;
}

async function loadEnv() {
  const inherited = new Set(Object.keys(process.env));
  for (const file of [".env", ".env.local"]) {
    let text;
    try { text = await readFile(join(ROOT, file), "utf8"); }
    catch (error) { if (error?.code === "ENOENT") continue; throw error; }
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m || line.trimStart().startsWith("#")) continue;
      let value = m[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!inherited.has(m[1])) process.env[m[1]] = value;
    }
  }
}

async function ask(label, hidden = false) {
  if (!process.stdin.isTTY) throw new Error("Artwork export requires an interactive terminal.");
  if (!hidden) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try { return (await rl.question(label)).trim(); } finally { rl.close(); }
  }
  process.stdout.write(label);
  const sink = new Writable({ write(_chunk, _encoding, done) { done(); } });
  const rl = createInterface({ input: process.stdin, output: sink, terminal: true });
  try { return (await rl.question("")).trim(); }
  finally { rl.close(); process.stdout.write("\n"); }
}

async function signIn() {
  const url = process.env.VITE_SUPABASE_URL?.trim();
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) throw new Error("Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local first.");
  const email = await ask("STACK email: ");
  const pin = await ask("8-digit STACK PIN: ", true);
  if (!/^\d{8}$/.test(pin)) throw new Error("STACK PIN must be exactly 8 digits.");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const result = await client.auth.signInWithPassword({ email, password: pin });
  if (result.error || !result.data.user) throw new Error(`STACK sign-in failed: ${result.error?.message ?? "No user returned."}`);
  return { client, userId: result.data.user.id };
}

async function chooseCrew(client, userId, requested) {
  const memberships = await client.from("crew_members").select("crew_id,joined_at").eq("user_id", userId).order("joined_at");
  if (memberships.error) throw new Error(memberships.error.message);
  if (!memberships.data?.length) throw new Error("This STACK account does not belong to a crew.");
  const ids = memberships.data.map((row) => row.crew_id);
  const crewsResult = await client.from("crews").select("id,name,emblem").in("id", ids);
  if (crewsResult.error) throw new Error(crewsResult.error.message);
  const map = new Map((crewsResult.data ?? []).map((crew) => [crew.id, crew]));
  const crews = ids.map((id) => map.get(id)).filter(Boolean);
  if (requested) {
    const q = requested.toLowerCase();
    const hits = crews.filter((crew) => crew.id.toLowerCase() === q || crew.name.toLowerCase() === q);
    if (hits.length !== 1) throw new Error(hits.length ? `More than one crew is named "${requested}"; use its id.` : `No crew matched "${requested}".`);
    return hits[0];
  }
  if (crews.length === 1) return crews[0];
  console.log("\nCrews:");
  crews.forEach((crew, i) => console.log(`  ${i + 1}. ${crew.name}`));
  const pick = Number(await ask(`Export which crew? [1-${crews.length}]: `)) - 1;
  if (!Number.isInteger(pick) || pick < 0 || pick >= crews.length) throw new Error("Choose a crew by its number.");
  return crews[pick];
}

async function roster(client, crewId) {
  const membersResult = await client.from("crew_members").select("user_id,joined_at").eq("crew_id", crewId).order("joined_at");
  if (membersResult.error) throw new Error(membersResult.error.message);
  const members = membersResult.data ?? [];
  const ids = [...new Set(members.map((row) => row.user_id))];
  const profilesResult = await client.from("profiles").select("id,display_name,accent_color,runner_icon").in("id", ids);
  if (profilesResult.error) throw new Error(profilesResult.error.message);
  const profiles = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
  return members.map((member) => ({ userId: member.user_id, profile: profiles.get(member.user_id) ?? null }));
}

async function tsModule(path, temp) {
  const source = await readFile(path, "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, verbatimModuleSyntax: false } }).outputText;
  const out = join(temp, basename(path).replace(/\.ts$/, ".mjs"));
  await writeFile(out, js);
  return import(pathToFileURL(out).href);
}

async function modules() {
  const temp = await mkdtemp(join(tmpdir(), "stack-artwork-"));
  try {
    const result = await Promise.all([
      tsModule(join(ROOT, "src/crew/emblem.ts"), temp),
      tsModule(join(ROOT, "src/crew/runnerIcon.ts"), temp),
      tsModule(join(ROOT, "src/crew/memberAccent.ts"), temp),
    ]);
    return { emblem: result[0], runner: result[1], accent: result[2] };
  } finally { await rm(temp, { recursive: true, force: true }); }
}

async function palette() {
  const css = await readFile(join(ROOT, "src/styles/tokens.css"), "utf8");
  const tokens = new Map([...css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const get = (name) => { const value = tokens.get(name); if (!value) throw new Error(`Missing design token ${name}.`); return value; };
  return { get };
}

const xml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const slug = (value) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "artwork";

function crewSvg(name, emblem, mod) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${mod.CREW_EMBLEM_VIEW_BOX}">\n<title>${xml(name)} crew emblem</title>\n${mod.crewEmblemSvgMarkup(emblem)}\n</svg>\n`;
}

function runnerSvg(name, icon, accent, mod, colors) {
  const accentHex = colors.get(`--member-${accent}`);
  const ink = colors.get("--runner-icon-ink");
  const mark = colors.get("--runner-icon-mark");
  const field = colors.get("--runner-icon-field");
  const style = (part) => part === "background"
    ? `fill="${field}" stroke="${accentHex}" stroke-width="3" stroke-linejoin="round"`
    : part === "flair"
      ? `fill="${mark}" stroke="${ink}" stroke-width="1.2" stroke-linejoin="round"`
      : `fill="${accentHex}" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"`;
  const lines = [];
  for (const part of mod.RUNNER_ICON_DRAW_ORDER) {
    const shape = mod.runnerIconShape(part, icon[part]);
    if (!shape.plates.length && !shape.cuts?.length && !shape.pips?.length) continue;
    lines.push(`<g id="${part}">`);
    for (const d of shape.plates) lines.push(`<path d="${d}" ${style(part)}/>`);
    for (const d of shape.cuts ?? []) lines.push(`<path d="${d}" fill="${ink}"/>`);
    for (const d of shape.pips ?? []) lines.push(`<path d="${d}" fill="${accentHex}"/>`);
    lines.push("</g>");
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${mod.RUNNER_ICON_VIEW_BOX}">\n<title>${xml(name)} runner icon</title>\n${lines.join("\n")}\n</svg>\n`;
}

async function exportAll(crew, members, mod, colors) {
  const dir = join(ROOT, "exports", slug(crew.name));
  await mkdir(dir, { recursive: true });
  const files = [];
  const emblemFile = `${slug(crew.name)}-emblem.svg`;
  await writeFile(join(dir, emblemFile), crewSvg(crew.name, mod.emblem.resolveCrewEmblem(crew.emblem), mod.emblem));
  files.push(emblemFile);
  const used = new Map();
  for (const member of members) {
    const name = member.profile?.display_name?.trim() || "Runner";
    const accent = mod.accent.crewMemberAccent(member.userId, mod.accent.accentColorFrom(member.profile?.accent_color));
    const icon = mod.runner.resolveRunnerIcon(member.profile?.runner_icon, member.userId);
    const base = slug(name);
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    const file = `${count === 1 ? base : `${base}-${count}`}.svg`;
    await writeFile(join(dir, file), runnerSvg(name, icon, accent, mod.runner, colors));
    files.push(file);
  }
  return { dir, files };
}

async function main() {
  const options = args();
  if (options.help) {
    console.log("Usage: npm run export:artwork [-- --crew <name-or-id>]\n\nSecondary desktop utility. Exports the selected live Crew emblem and every member Runner Icon to ./exports/<crew>/ as standalone SVG files. For phone use, open STACK at #artwork.");
    return;
  }
  await loadEnv();
  const [{ client, userId }, mod, colors] = await Promise.all([signIn(), modules(), palette()]);
  const crew = await chooseCrew(client, userId, options.crew);
  const members = await roster(client, crew.id);
  const result = await exportAll(crew, members, mod, colors);
  console.log(`\nExported ${result.files.length} SVGs to ${result.dir}`);
  result.files.forEach((file) => console.log(`  ${file}`));
}

main().catch((error) => {
  console.error(`\nArtwork export failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
