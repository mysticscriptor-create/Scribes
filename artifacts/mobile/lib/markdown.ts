export type InlineSpan =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; url: string };

export type Block =
  | { type: "h1" | "h2" | "h3" | "h4"; spans: InlineSpan[] }
  | { type: "paragraph"; spans: InlineSpan[] }
  | { type: "quote"; spans: InlineSpan[] }
  | { type: "code"; text: string; lang?: string }
  | { type: "list"; ordered: boolean; items: InlineSpan[][] }
  | { type: "hr" }
  | { type: "blank" };

const INLINE_REGEX =
  /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\n]+)\*|_([^_\n]+)_|`([^`\n]+)`|\[([^\]]+)\]\(([^)]+)\))/g;

export function parseInline(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  INLINE_REGEX.lastIndex = 0;
  while ((match = INLINE_REGEX.exec(text)) !== null) {
    if (match.index > last) {
      spans.push({ type: "text", text: text.slice(last, match.index) });
    }
    if (match[2] !== undefined) {
      spans.push({ type: "bold", text: match[2] });
    } else if (match[3] !== undefined) {
      spans.push({ type: "bold", text: match[3] });
    } else if (match[4] !== undefined) {
      spans.push({ type: "italic", text: match[4] });
    } else if (match[5] !== undefined) {
      spans.push({ type: "italic", text: match[5] });
    } else if (match[6] !== undefined) {
      spans.push({ type: "code", text: match[6] });
    } else if (match[7] !== undefined && match[8] !== undefined) {
      spans.push({ type: "link", text: match[7], url: match[8] });
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    spans.push({ type: "text", text: text.slice(last) });
  }
  if (spans.length === 0) {
    spans.push({ type: "text", text });
  }
  return spans;
}

export function parseMarkdown(source: string): Block[] {
  const lines = source.split(/\r?\n/);
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.trim() === "") {
      blocks.push({ type: "blank" });
      i++;
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }
    const headMatch = /^(#{1,4})\s+(.*)$/.exec(line);
    if (headMatch) {
      const level = headMatch[1]!.length as 1 | 2 | 3 | 4;
      const type = (`h${level}` as "h1" | "h2" | "h3" | "h4");
      blocks.push({ type, spans: parseInline(headMatch[2] ?? "") });
      i++;
      continue;
    }
    if (/^```/.test(line)) {
      const lang = line.replace(/^```/, "").trim() || undefined;
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i] ?? "")) {
        buf.push(lines[i] ?? "");
        i++;
      }
      i++;
      blocks.push({ type: "code", text: buf.join("\n"), lang });
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i] ?? "")) {
        buf.push((lines[i] ?? "").replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "quote", spans: parseInline(buf.join("\n")) });
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: InlineSpan[][] = [];
      while (
        i < lines.length &&
        ((!ordered && /^\s*[-*+]\s+/.test(lines[i] ?? "")) ||
          (ordered && /^\s*\d+\.\s+/.test(lines[i] ?? "")))
      ) {
        const cleaned = (lines[i] ?? "").replace(
          ordered ? /^\s*\d+\.\s+/ : /^\s*[-*+]\s+/,
          "",
        );
        items.push(parseInline(cleaned));
        i++;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    const buf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() !== "" &&
      !/^(#{1,4})\s+/.test(lines[i] ?? "") &&
      !/^>/.test(lines[i] ?? "") &&
      !/^```/.test(lines[i] ?? "") &&
      !/^\s*[-*+]\s+/.test(lines[i] ?? "") &&
      !/^\s*\d+\.\s+/.test(lines[i] ?? "")
    ) {
      buf.push(lines[i] ?? "");
      i++;
    }
    blocks.push({ type: "paragraph", spans: parseInline(buf.join(" ")) });
  }
  return blocks;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function countChars(text: string): number {
  return text.length;
}

export function readingTimeMinutes(text: string): number {
  const wpm = 220;
  const words = countWords(text);
  return Math.max(1, Math.round(words / wpm));
}
