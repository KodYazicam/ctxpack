export interface SecretHit {
  line: number;
  kind: string;
  snippet: string;
}

const PATTERNS: Array<{ kind: string; regex: RegExp }> = [
  { kind: "aws-access-key", regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { kind: "github-token", regex: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g },
  { kind: "openai-key", regex: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { kind: "slack-token", regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { kind: "private-key", regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  {
    kind: "generic-secret",
    regex:
      /\b(?:api[_-]?key|secret|password|token|passwd|auth)\b\s*[:=]\s*['"][^'"]{8,}['"]/gi,
  },
];

export function findSecrets(content: string): SecretHit[] {
  const hits: SecretHit[] = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const { kind, regex } of PATTERNS) {
      regex.lastIndex = 0;
      if (regex.test(line)) {
        hits.push({
          line: i + 1,
          kind,
          snippet: redactLine(line),
        });
      }
    }
  }
  return hits;
}

export function redactSecrets(content: string): { text: string; count: number } {
  let count = 0;
  let text = content;
  for (const { regex } of PATTERNS) {
    regex.lastIndex = 0;
    text = text.replace(regex, () => {
      count += 1;
      return "[REDACTED]";
    });
  }
  return { text, count };
}

function redactLine(line: string): string {
  if (line.length <= 80) return line.replace(/['"][^'"]{8,}['"]/g, '"[REDACTED]"');
  return `${line.slice(0, 77)}...`;
}
