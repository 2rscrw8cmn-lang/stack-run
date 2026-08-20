import {
  CREW_EMBLEM_VIEW_BOX,
  crewEmblemSvgMarkup,
} from "../crew/emblem";
import {
  MEMBER_ACCENTS,
  crewMemberAccent,
  type CrewMemberAccent,
} from "../crew/memberAccent";
import {
  RUNNER_ICON_DRAW_ORDER,
  RUNNER_ICON_VIEW_BOX,
  runnerIconShape,
  type RunnerIconPart,
} from "../crew/runnerIcon";
import type { CrewMember, RaceCrew } from "../crew/types";

export interface ArtworkFile {
  filename: string;
  mimeType: "image/svg+xml";
  content: string;
}

export interface ArtworkPalette {
  member: Record<CrewMemberAccent, string>;
  ink: string;
  mark: string;
  field: string;
}

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function artworkSlug(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "artwork"
  );
}

export function readArtworkPalette(root: Element = document.documentElement): ArtworkPalette {
  const styles = window.getComputedStyle(root);
  const token = (name: string): string => {
    const value = styles.getPropertyValue(name).trim();
    if (!value) throw new Error(`STACK artwork token ${name} is missing.`);
    return value;
  };

  const member = Object.fromEntries(
    MEMBER_ACCENTS.map((accent) => [accent, token(`--member-${accent}`)]),
  ) as Record<CrewMemberAccent, string>;

  return {
    member,
    ink: token("--runner-icon-ink"),
    mark: token("--runner-icon-mark"),
    field: token("--runner-icon-field"),
  };
}

export function crewEmblemArtwork(
  crew: Pick<RaceCrew, "name" | "emblem">,
): ArtworkFile {
  const content = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${CREW_EMBLEM_VIEW_BOX}">\n<title>${xml(crew.name)} crew emblem</title>\n${crewEmblemSvgMarkup(crew.emblem)}\n</svg>\n`;
  return {
    filename: `${artworkSlug(crew.name)}-emblem.svg`,
    mimeType: "image/svg+xml",
    content,
  };
}

function runnerPlateAttributes(
  part: RunnerIconPart,
  accent: string,
  palette: ArtworkPalette,
): string {
  if (part === "background") {
    return `fill="${palette.field}" stroke="${accent}" stroke-width="3" stroke-linejoin="round"`;
  }
  if (part === "flair") {
    return `fill="${palette.mark}" stroke="${palette.ink}" stroke-width="1.2" stroke-linejoin="round"`;
  }
  return `fill="${accent}" stroke="${palette.ink}" stroke-width="2.4" stroke-linejoin="round"`;
}

export function runnerIconArtwork(
  member: Pick<CrewMember, "userId" | "displayName" | "accentColor" | "runnerIcon">,
  palette: ArtworkPalette,
  filename?: string,
): ArtworkFile {
  const accentName = crewMemberAccent(member.userId, member.accentColor);
  const accent = palette.member[accentName];
  const lines: string[] = [];

  for (const part of RUNNER_ICON_DRAW_ORDER) {
    const shape = runnerIconShape(part, member.runnerIcon[part]);
    if (!shape.plates.length && !shape.cuts?.length && !shape.pips?.length) continue;
    lines.push(`<g id="${part}">`);
    for (const d of shape.plates) {
      lines.push(`<path d="${d}" ${runnerPlateAttributes(part, accent, palette)}/>`);
    }
    for (const d of shape.cuts ?? []) {
      lines.push(`<path d="${d}" fill="${palette.ink}"/>`);
    }
    for (const d of shape.pips ?? []) {
      lines.push(`<path d="${d}" fill="${accent}"/>`);
    }
    lines.push("</g>");
  }

  const content = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${RUNNER_ICON_VIEW_BOX}">\n<title>${xml(member.displayName)} runner icon</title>\n${lines.join("\n")}\n</svg>\n`;

  return {
    filename: filename ?? `${artworkSlug(member.displayName)}.svg`,
    mimeType: "image/svg+xml",
    content,
  };
}

export function crewArtworkFiles(
  crew: Pick<RaceCrew, "name" | "emblem">,
  members: readonly CrewMember[],
  palette: ArtworkPalette,
): ArtworkFile[] {
  const files = [crewEmblemArtwork(crew)];
  const used = new Map<string, number>();

  for (const member of members) {
    const base = artworkSlug(member.displayName);
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    const filename = `${count === 1 ? base : `${base}-${count}`}.svg`;
    files.push(runnerIconArtwork(member, palette, filename));
  }

  return files;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function concat(chunks: readonly Uint8Array[]): Uint8Array {
  const size = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function zipHeader(size: number): { bytes: Uint8Array; view: DataView } {
  const bytes = new Uint8Array(size);
  return { bytes, view: new DataView(bytes.buffer) };
}

/**
 * Small dependency-free ZIP writer. Entries are stored without compression:
 * SVGs are tiny, and a standards-valid archive matters more here than shaving
 * a few kilobytes off a one-off merch handoff.
 */
export function artworkZip(files: readonly ArtworkFile[]): Blob {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let localOffset = 0;

  for (const file of files) {
    const name = encoder.encode(file.filename);
    const data = encoder.encode(file.content);
    const crc = crc32(data);

    const local = zipHeader(30);
    local.view.setUint32(0, 0x04034b50, true);
    local.view.setUint16(4, 20, true);
    local.view.setUint16(6, 0x0800, true);
    local.view.setUint16(8, 0, true);
    local.view.setUint16(10, 0, true);
    local.view.setUint16(12, 33, true);
    local.view.setUint32(14, crc, true);
    local.view.setUint32(18, data.byteLength, true);
    local.view.setUint32(22, data.byteLength, true);
    local.view.setUint16(26, name.byteLength, true);
    local.view.setUint16(28, 0, true);
    const localRecord = concat([local.bytes, name, data]);
    locals.push(localRecord);

    const central = zipHeader(46);
    central.view.setUint32(0, 0x02014b50, true);
    central.view.setUint16(4, 20, true);
    central.view.setUint16(6, 20, true);
    central.view.setUint16(8, 0x0800, true);
    central.view.setUint16(10, 0, true);
    central.view.setUint16(12, 0, true);
    central.view.setUint16(14, 33, true);
    central.view.setUint32(16, crc, true);
    central.view.setUint32(20, data.byteLength, true);
    central.view.setUint32(24, data.byteLength, true);
    central.view.setUint16(28, name.byteLength, true);
    central.view.setUint16(30, 0, true);
    central.view.setUint16(32, 0, true);
    central.view.setUint16(34, 0, true);
    central.view.setUint16(36, 0, true);
    central.view.setUint32(38, 0, true);
    central.view.setUint32(42, localOffset, true);
    centrals.push(concat([central.bytes, name]));
    localOffset += localRecord.byteLength;
  }

  const centralDirectory = concat(centrals);
  const end = zipHeader(22);
  end.view.setUint32(0, 0x06054b50, true);
  end.view.setUint16(4, 0, true);
  end.view.setUint16(6, 0, true);
  end.view.setUint16(8, files.length, true);
  end.view.setUint16(10, files.length, true);
  end.view.setUint32(12, centralDirectory.byteLength, true);
  end.view.setUint32(16, localOffset, true);
  end.view.setUint16(20, 0, true);

  const archive = concat([...locals, centralDirectory, end.bytes]);
  const buffer = archive.buffer.slice(
    archive.byteOffset,
    archive.byteOffset + archive.byteLength,
  ) as ArrayBuffer;
  return new Blob([buffer], { type: "application/zip" });
}

export async function saveArtworkBlob(blob: Blob, filename: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // Fall through to a normal browser download when the share sheet fails.
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}

export async function saveArtworkFile(file: ArtworkFile): Promise<"shared" | "downloaded" | "cancelled"> {
  return saveArtworkBlob(new Blob([file.content], { type: file.mimeType }), file.filename);
}
