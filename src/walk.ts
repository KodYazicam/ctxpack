import { readdirSync, statSync, readFileSync, realpathSync } from "node:fs";
import { join, extname } from "node:path";
import {
  loadIgnoreRules,
  loadNestedIgnore,
  isIgnored,
  toRelative,
  type IgnoreRule,
} from "./gitignore.js";

const BINARY_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".gz",
  ".tar",
  ".7z",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp3",
  ".mp4",
  ".mov",
  ".avi",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
  ".wasm",
]);

export interface WalkOptions {
  root: string;
  extraIgnore?: string[];
  maxFileBytes?: number;
  include?: string[];
}

export interface FileEntry {
  path: string;
  absPath: string;
  size: number;
  content: string;
  truncated: boolean;
}

export function walkFiles(options: WalkOptions): FileEntry[] {
  const root = options.root;
  const rules = loadIgnoreRules(root, options.extraIgnore ?? []);
  const maxBytes = options.maxFileBytes ?? 200_000;
  const include = options.include?.map((p) => p.replace(/^\.\//, ""));
  const files: FileEntry[] = [];
  const seen = new Set<string>();
  visit(root, root, rules, maxBytes, include, files, seen);
  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}

function visit(
  root: string,
  dir: string,
  rules: IgnoreRule[],
  maxBytes: number,
  include: string[] | undefined,
  out: FileEntry[],
  seen: Set<string>,
): void {
  let real: string;
  try {
    real = realpathSync(dir);
  } catch {
    return;
  }
  if (seen.has(real)) return;
  seen.add(real);

  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  const relDir = toRelative(root, dir);
  const nested = loadNestedIgnore(dir, relDir);
  const localRules = nested.length ? [...rules, ...nested] : rules;

  for (const entry of entries) {
    const abs = join(dir, entry.name);
    const rel = toRelative(root, abs);
    const isDir = entry.isDirectory() || entry.isSymbolicLink();
    let dirFlag = entry.isDirectory();
    if (entry.isSymbolicLink()) {
      try {
        dirFlag = statSync(abs).isDirectory();
      } catch {
        continue;
      }
    }
    if (isIgnored(rel, localRules, dirFlag)) continue;
    if (dirFlag) {
      visit(root, abs, localRules, maxBytes, include, out, seen);
      continue;
    }
    if (include && include.length > 0 && !include.some((g) => matchSimple(rel, g))) {
      continue;
    }
    if (BINARY_EXT.has(extname(entry.name).toLowerCase())) continue;
    let stat;
    try {
      stat = statSync(abs);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    let raw: Buffer;
    try {
      raw = readFileSync(abs);
    } catch {
      continue;
    }
    if (looksBinary(raw)) continue;
    const truncated = raw.length > maxBytes;
    const slice = truncated ? raw.subarray(0, maxBytes) : raw;
    out.push({
      path: rel,
      absPath: abs,
      size: stat.size,
      content: slice.toString("utf8"),
      truncated,
    });
  }
}

function looksBinary(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 8000));
  if (sample.includes(0)) return true;
  let weird = 0;
  for (const byte of sample) {
    if (byte < 7 || (byte > 14 && byte < 32 && byte !== 9 && byte !== 10 && byte !== 13)) {
      weird += 1;
    }
  }
  return weird / sample.length > 0.3;
}

function matchSimple(rel: string, glob: string): boolean {
  if (glob.endsWith("/**")) {
    const prefix = glob.slice(0, -3).replace(/^\.\//, "");
    return rel === prefix || rel.startsWith(`${prefix}/`);
  }
  if (glob.includes("*")) {
    const escaped = glob
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, ".*")
      .replace(/\*/g, "[^/]*");
    return new RegExp(`^${escaped}$`).test(rel);
  }
  return rel === glob || rel.startsWith(`${glob}/`);
}

export function buildTree(paths: string[]): string {
  const root: Record<string, unknown> = {};
  for (const path of paths) {
    const parts = path.split("/");
    let node = root;
    for (const part of parts) {
      node[part] ??= {};
      node = node[part] as Record<string, unknown>;
    }
  }
  return renderTree(root, "").join("\n");
}

function renderTree(node: Record<string, unknown>, prefix: string): string[] {
  const names = Object.keys(node).sort();
  const lines: string[] = [];
  names.forEach((name, index) => {
    const last = index === names.length - 1;
    const branch = last ? "└── " : "├── ";
    lines.push(`${prefix}${branch}${name}`);
    const child = node[name] as Record<string, unknown>;
    if (Object.keys(child).length > 0) {
      const next = prefix + (last ? "    " : "│   ");
      lines.push(...renderTree(child, next));
    }
  });
  return lines;
}
