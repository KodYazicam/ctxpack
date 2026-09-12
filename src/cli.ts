#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pack, type OutputFormat } from "./pack.js";
import { invokedDirectly } from "./main.js";

function help(): string {
  return `
ctxpack — pack a codebase into LLM-ready context

Usage:
  ctxpack [dir] [options]

Options:
  -o, --out <file>         Write to file instead of stdout
  -m, --max-tokens <n>     Token budget (default: 80000)
  -f, --format <fmt>       markdown | xml | json  (default: markdown)
      --no-redact          Do not redact secrets
      --no-tree            Skip the repository tree section
      --ignore <glob>      Extra ignore glob (repeatable)
      --include <glob>     Only include matching paths (repeatable)
  -h, --help               Show this help
  -v, --version            Show version

Examples:
  ctxpack . -o prompt.md
  ctxpack ./src --max-tokens 12000 --format xml
  ctxpack . --include src/** --include README.md

License: KYAL-1.0 — free to use, attribution required.
https://github.com/KodYazicam/ctxpack
`.trim();
}

interface Args {
  root: string;
  out?: string;
  maxTokens: number;
  format: OutputFormat;
  redact: boolean;
  tree: boolean;
  ignore: string[];
  include: string[];
  help: boolean;
  version: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    root: ".",
    maxTokens: 80_000,
    format: "markdown",
    redact: true,
    tree: true,
    ignore: [],
    include: [],
    help: false,
    version: false,
  };
  const rest = [...argv];
  if (rest[0] && !rest[0].startsWith("-")) {
    args.root = rest.shift() as string;
  }
  while (rest.length) {
    const token = rest.shift() as string;
    switch (token) {
      case "-h":
      case "--help":
        args.help = true;
        break;
      case "-v":
      case "--version":
        args.version = true;
        break;
      case "-o":
      case "--out":
        args.out = rest.shift();
        break;
      case "-m":
      case "--max-tokens":
        args.maxTokens = Number(rest.shift());
        break;
      case "-f":
      case "--format":
        args.format = (rest.shift() ?? "markdown") as OutputFormat;
        break;
      case "--no-redact":
        args.redact = false;
        break;
      case "--no-tree":
        args.tree = false;
        break;
      case "--ignore":
        args.ignore.push(rest.shift() ?? "");
        break;
      case "--include":
        args.include.push(rest.shift() ?? "");
        break;
      default:
        if (token.startsWith("-")) {
          throw new Error(`Unknown option: ${token}`);
        }
        args.root = token;
    }
  }
  return args;
}

export function run(argv: string[]): number {
  let args: Args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }
  if (args.help) {
    console.log(help());
    return 0;
  }
  if (args.version) {
    console.log("1.0.0");
    return 0;
  }
  if (!Number.isFinite(args.maxTokens) || args.maxTokens <= 0) {
    console.error("--max-tokens must be a positive number");
    return 1;
  }
  if (!["markdown", "xml", "json"].includes(args.format)) {
    console.error("--format must be markdown, xml, or json");
    return 1;
  }

  const result = pack({
    root: resolve(args.root),
    maxTokens: args.maxTokens,
    format: args.format,
    extraIgnore: args.ignore.filter(Boolean),
    include: args.include.filter(Boolean),
    redact: args.redact,
    tree: args.tree,
  });

  if (args.out) {
    const out = resolve(args.out);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, result.output, "utf8");
    console.error(
      `wrote ${out}  files=${result.files.length}  dropped=${result.dropped.length}  tokens≈${result.tokens}  redacted=${result.redactedCount}`,
    );
  } else {
    process.stdout.write(result.output);
    if (process.stdout.isTTY) {
      console.error(
        `\n# files=${result.files.length} dropped=${result.dropped.length} tokens≈${result.tokens} redacted=${result.redactedCount}`,
      );
    }
  }

  if (result.secrets.length && args.redact) {
    console.error(`# redacted ${result.redactedCount} secret-like string(s)`);
  } else if (result.secrets.length) {
    console.error(`# warning: ${result.secrets.length} secret-like string(s) left in output`);
  }
  return 0;
}

if (invokedDirectly(import.meta.url)) {
  process.exitCode = run(process.argv.slice(2));
}
