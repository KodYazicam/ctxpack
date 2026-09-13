import { readFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

export interface IgnoreRule {
  negated: boolean;
  directoryOnly: boolean;
  pattern: string;
  regex: RegExp;
}

const DEFAULT_IGNORES = [
  "node_modules/",
  ".git/",
  "dist/",
  "build/",
  "coverage/",
  ".next/",
  ".nuxt/",
  ".venv/",
  "venv/",
  "__pycache__/",
  "*.pyc",
  ".DS_Store",
  "*.min.js",
  "*.map",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "bun.lock",
  "Cargo.lock",
  "poetry.lock",
  "composer.lock",
  "go.sum",
  ".env",
  ".env.*",
  "!.env.example",
  "!.env.sample",
  "!.env.template",
];

export function loadIgnoreRules(root: string, extra: string[] = []): IgnoreRule[] {
  const lines: string[] = [...DEFAULT_IGNORES];
  const gitignore = join(root, ".gitignore");
  if (existsSync(gitignore)) {
    lines.push(...readFileSync(gitignore, "utf8").split(/\r?\n/));
  }
  lines.push(...extra);
  return compileLines(lines, "");
}

export function loadNestedIgnore(absDir: string, relDir: string): IgnoreRule[] {
  const file = join(absDir, ".gitignore");
  if (!existsSync(file)) return [];
  const prefix = relDir === "." || relDir === "" ? "" : relDir.replace(/\\/g, "/");
  return compileLines(readFileSync(file, "utf8").split(/\r?\n/), prefix);
}

function compileLines(lines: string[], base: string): IgnoreRule[] {
  return lines
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => compileRule(line, base));
}

function compileRule(raw: string, base: string): IgnoreRule {
  let pattern = raw;
  const negated = pattern.startsWith("!");
  if (negated) pattern = pattern.slice(1);
  const directoryOnly = pattern.endsWith("/");
  if (directoryOnly) pattern = pattern.slice(0, -1);
  const anchored = pattern.startsWith("/");
  if (anchored) pattern = pattern.slice(1);
  if (base) {
    const prefix = base.endsWith("/") ? base : `${base}/`;
    pattern = anchored || pattern.includes("/") ? `${prefix}${pattern}` : `**/${pattern}`;
  }
  const regex = globToRegExp(pattern, Boolean(base) || anchored);
  return { negated, directoryOnly, pattern: raw, regex };
}

function globToRegExp(pattern: string, anchored: boolean): RegExp {
  let source = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === "*" && pattern[i + 1] === "*") {
      const next = pattern[i + 2];
      if (next === "/") {
        source += "(?:.*/)?";
        i += 2;
      } else {
        source += ".*";
        i += 1;
      }
      continue;
    }
    if (char === "*") {
      source += "[^/]*";
      continue;
    }
    if (char === "?") {
      source += "[^/]";
      continue;
    }
    if ("\\^$+()[]{}|.".includes(char)) {
      source += `\\${char}`;
      continue;
    }
    source += char;
  }
  const prefix = anchored ? "^" : "(?:^|.*/)";
  return new RegExp(`${prefix}${source}(?:/.*)?$`);
}

export function isIgnored(relPath: string, rules: IgnoreRule[], isDir: boolean): boolean {
  const normalized = relPath.split(sep).join("/");
  let ignored = false;
  for (const rule of rules) {
    if (rule.regex.test(normalized) || (isDir && rule.regex.test(`${normalized}/`))) {
      ignored = !rule.negated;
    }
  }
  return ignored;
}

export function toRelative(root: string, abs: string): string {
  const rel = relative(root, abs);
  return rel === "" ? "." : rel.split(sep).join("/");
}
