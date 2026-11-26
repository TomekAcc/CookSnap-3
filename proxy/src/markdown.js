// A small Markdown-to-HTML converter, enough for the legal documents in docs/legal (headings, paragraphs, lists,
// tables, blockquotes, rules, bold, italic, code and links). Everything is escaped first, so a document can never
// inject markup.

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(text) {
  let out = esc(text);
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:]|$)/g, "$1<em>$2</em>");
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => (/^(https?:|mailto:|\/)/.test(url) ? `<a href="${url}">${label}</a>` : m));
  return out;
}

const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l) && l.includes("-");
const cells = (l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

export function markdownToHtml(md) {
  const lines = String(md).replace(/\r/g, "").split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); i++; continue; }
    if (/^---+\s*$/.test(line)) { out.push("<hr>"); i++; continue; }
    if (line.startsWith("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = cells(line); i += 2; const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) { rows.push(cells(lines[i])); i++; }
      out.push(`<div class="table"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    if (line.startsWith(">")) {
      const buf = []; while (i < lines.length && lines[i].startsWith(">")) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
      out.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`); continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line); const items = [];
      while (i < lines.length && lines[i].trim()) {
        const mm = lines[i].match(/^\s*([-*]|\d+\.)\s+(.*)$/);
        if (mm) items.push(mm[2]); else if (items.length && /^\s+\S/.test(lines[i])) items[items.length - 1] += ` ${lines[i].trim()}`; else break;
        i++;
      }
      const tag = ordered ? "ol" : "ul"; out.push(`<${tag}>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</${tag}>`); continue;
    }
    const buf = []; while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|---|\||>|\s*([-*]|\d+\.)\s)/.test(lines[i])) { buf.push(lines[i].trim()); i++; }
    if (buf.length) out.push(`<p>${inline(buf.join(" "))}</p>`); else i++;
  }
  return out.join("\n");
}
