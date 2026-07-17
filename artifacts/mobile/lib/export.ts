import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import JSZip from "jszip";

import { parseInline, parseMarkdown, type InlineSpan } from "@/lib/markdown";
import type { NoteFile } from "@/contexts/NotesContext";

export type ExportFormat = "txt" | "md" | "html" | "pdf" | "epub" | "docx";

function sanitizeFilename(name: string): string {
  return (name || "Untitled").replace(/[\\/:*?"<>|]/g, "-").trim() || "Untitled";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function spanToHtml(span: InlineSpan): string {
  switch (span.type) {
    case "bold":
      return `<strong>${escapeHtml(span.text)}</strong>`;
    case "italic":
      return `<em>${escapeHtml(span.text)}</em>`;
    case "code":
      return `<code>${escapeHtml(span.text)}</code>`;
    case "link":
      return `<a href="${escapeHtml(span.url)}">${escapeHtml(span.text)}</a>`;
    default:
      return escapeHtml(span.text);
  }
}

function spansToHtml(spans: InlineSpan[]): string {
  return spans.map(spanToHtml).join("");
}

function spanToPlain(span: InlineSpan): string {
  return span.text;
}

export function contentToHtmlBody(content: string): string {
  const blocks = parseMarkdown(content);
  const out: string[] = [];
  let listBuffer: string[] | null = null;
  let listOrdered = false;

  const flushList = () => {
    if (listBuffer) {
      const tag = listOrdered ? "ol" : "ul";
      out.push(`<${tag}>${listBuffer.join("")}</${tag}>`);
      listBuffer = null;
    }
  };

  for (const b of blocks) {
    if (b.type === "list") {
      if (!listBuffer) {
        listBuffer = [];
        listOrdered = b.ordered;
      }
      for (const item of b.items) {
        listBuffer.push(`<li>${spansToHtml(item)}</li>`);
      }
      continue;
    }
    flushList();
    switch (b.type) {
      case "h1":
        out.push(`<h1>${spansToHtml(b.spans)}</h1>`);
        break;
      case "h2":
        out.push(`<h2>${spansToHtml(b.spans)}</h2>`);
        break;
      case "h3":
        out.push(`<h3>${spansToHtml(b.spans)}</h3>`);
        break;
      case "h4":
        out.push(`<h4>${spansToHtml(b.spans)}</h4>`);
        break;
      case "paragraph":
        out.push(`<p>${spansToHtml(b.spans)}</p>`);
        break;
      case "quote":
        out.push(`<blockquote>${spansToHtml(b.spans)}</blockquote>`);
        break;
      case "code":
        out.push(`<pre><code>${escapeHtml(b.text)}</code></pre>`);
        break;
      case "hr":
        out.push("<hr/>");
        break;
      case "blank":
        break;
    }
  }
  flushList();
  return out.join("\n");
}

function contentToPlainParagraphs(content: string): string[] {
  const blocks = parseMarkdown(content);
  const out: string[] = [];
  for (const b of blocks) {
    if (b.type === "blank" || b.type === "hr") {
      out.push("");
      continue;
    }
    if (b.type === "list") {
      for (const item of b.items) out.push(item.map(spanToPlain).join(""));
      continue;
    }
    if (b.type === "code") {
      out.push(b.text);
      continue;
    }
    out.push(b.spans.map(spanToPlain).join(""));
  }
  return out;
}

function fullHtmlDocument(note: NoteFile): string {
  const body = contentToHtmlBody(note.content);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(note.name)}</title>
<style>
  body { font-family: Georgia, serif; max-width: 680px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #222; }
  h1,h2,h3,h4 { font-family: -apple-system, Helvetica, Arial, sans-serif; }
  blockquote { border-left: 3px solid #ccc; margin-left: 0; padding-left: 16px; color: #555; }
  code, pre { font-family: 'Courier New', monospace; background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
  pre { padding: 12px; overflow-x: auto; }
  hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
</style>
</head>
<body>
<h1>${escapeHtml(note.name)}</h1>
${body}
</body>
</html>`;
}

async function writeAndShare(
  filename: string,
  content: string,
  mimeType: string,
): Promise<void> {
  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error("No writable cache directory available");
  const uri = dir + filename;
  await FileSystem.writeAsStringAsync(uri, content);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType, dialogTitle: filename });
  } else {
    throw new Error("Sharing is not available on this device");
  }
}

async function writeBase64AndShare(
  filename: string,
  base64: string,
  mimeType: string,
): Promise<void> {
  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error("No writable cache directory available");
  const uri = dir + filename;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType, dialogTitle: filename });
  } else {
    throw new Error("Sharing is not available on this device");
  }
}

async function exportTxt(note: NoteFile): Promise<void> {
  await writeAndShare(
    `${sanitizeFilename(note.name)}.txt`,
    note.content,
    "text/plain",
  );
}

async function exportMd(note: NoteFile): Promise<void> {
  await writeAndShare(
    `${sanitizeFilename(note.name)}.md`,
    note.content,
    "text/markdown",
  );
}

async function exportHtml(note: NoteFile): Promise<void> {
  await writeAndShare(
    `${sanitizeFilename(note.name)}.html`,
    fullHtmlDocument(note),
    "text/html",
  );
}

async function exportPdf(note: NoteFile): Promise<void> {
  const { uri } = await Print.printToFileAsync({
    html: fullHtmlDocument(note),
    base64: false,
  });
  const filename = `${sanitizeFilename(note.name)}.pdf`;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: filename,
      UTI: "com.adobe.pdf",
    });
  } else {
    throw new Error("Sharing is not available on this device");
  }
}

async function exportEpub(note: NoteFile): Promise<void> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.folder("META-INF")!.file(
    "container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  );
  const oebps = zip.folder("OEBPS")!;
  oebps.file("chapter1.xhtml", `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${escapeHtml(note.name)}</title></head>
<body>
<h1>${escapeHtml(note.name)}</h1>
${contentToHtmlBody(note.content)}
</body>
</html>`);
  const uuid = `scribe-${note.id}-${Date.now()}`;
  oebps.file("content.opf", `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeHtml(note.name)}</dc:title>
    <dc:language>en</dc:language>
    <dc:identifier id="BookId">${uuid}</dc:identifier>
    <dc:creator>Scribe</dc:creator>
  </metadata>
  <manifest>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="chapter1"/>
  </spine>
</package>`);
  oebps.file("toc.ncx", `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${uuid}"/>
  </head>
  <docTitle><text>${escapeHtml(note.name)}</text></docTitle>
  <navMap>
    <navPoint id="chapter1" playOrder="1">
      <navLabel><text>${escapeHtml(note.name)}</text></navLabel>
      <content src="chapter1.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`);

  const base64 = await zip.generateAsync({ type: "base64" });
  await writeBase64AndShare(
    `${sanitizeFilename(note.name)}.epub`,
    base64,
    "application/epub+zip",
  );
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function exportDocx(note: NoteFile): Promise<void> {
  const paragraphs = contentToPlainParagraphs(note.content);
  const bodyXml = paragraphs
    .map((p) => {
      if (!p.trim()) {
        return `<w:p/>`;
      }
      return `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(p)}</w:t></w:r></w:p>`;
    })
    .join("");

  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.folder("_rels")!.file(
    ".rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  const word = zip.folder("word")!;
  word.folder("_rels")!.file(
    "document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`,
  );
  word.file(
    "document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t xml:space="preserve">${xmlEscape(note.name)}</w:t></w:r></w:p>
    ${bodyXml}
    <w:sectPr/>
  </w:body>
</w:document>`,
  );

  const base64 = await zip.generateAsync({ type: "base64" });
  await writeBase64AndShare(
    `${sanitizeFilename(note.name)}.docx`,
    base64,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
}

export async function exportNote(
  note: NoteFile,
  format: ExportFormat,
): Promise<void> {
  switch (format) {
    case "txt":
      return exportTxt(note);
    case "md":
      return exportMd(note);
    case "html":
      return exportHtml(note);
    case "pdf":
      return exportPdf(note);
    case "epub":
      return exportEpub(note);
    case "docx":
      return exportDocx(note);
  }
}
