// Minimal, safe Markdown -> JSX renderer.
// Purpose: display the legal documents authored by Adi *faithfully*, without
// altering any wording. It intentionally supports only the subset of Markdown
// that appears in those files: headings (#, ##), bold (**), italic (*), inline
// code (`), links [t](u), unordered lists (- ), blockquotes (> ) and rules (---).
// The [[ ]] placeholders are left verbatim so the club can fill them in.

let keySeq = 0;
const nextKey = () => `md-${keySeq++}`;

// ---- inline formatting ----
const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))|(\*[^*]+\*)/g;

function renderInline(text) {
  const out = [];
  let last = 0;
  let m;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("`")) {
      out.push(
        <code key={nextKey()} className="px-1 py-0.5 rounded bg-stone-100 text-stone-700 text-[0.85em] font-mono" dir="ltr">
          {tok.slice(1, -1)}
        </code>
      );
    } else if (tok.startsWith("**")) {
      out.push(<strong key={nextKey()} className="font-semibold text-stone-900">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("[")) {
      const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      // Internal cross-links (e.g. ./privacy-policy.md) render as plain emphasised
      // text — navigation between docs happens via the footer, not raw file paths.
      out.push(<span key={nextKey()} className="text-stone-900 underline underline-offset-2">{mm ? mm[1] : tok}</span>);
    } else {
      out.push(<em key={nextKey()}>{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// ---- block parsing ----
export function Markdown({ source }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") { i++; continue; }

    if (line.trim() === "---") {
      blocks.push(<hr key={nextKey()} className="my-4 border-stone-200" />);
      i++;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push(<h3 key={nextKey()} className="text-base font-bold text-stone-900 mt-5 mb-1.5">{renderInline(line.slice(3))}</h3>);
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push(<h2 key={nextKey()} className="text-lg font-bold text-stone-900 mb-2">{renderInline(line.slice(2))}</h2>);
      i++;
      continue;
    }

    // blockquote: gather consecutive "> " lines into one note callout.
    if (line.startsWith(">")) {
      const quote = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        quote.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote key={nextKey()} className="my-3 border-r-4 border-amber-300 bg-amber-50 rounded-lg px-3 py-2 text-xs text-stone-700 leading-relaxed">
          {renderInline(quote.join(" "))}
        </blockquote>
      );
      continue;
    }

    // unordered list: gather consecutive "- " lines.
    if (line.startsWith("- ")) {
      const items = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push(
        <ul key={nextKey()} className="list-disc pr-5 space-y-1 my-2 text-sm text-stone-700 leading-relaxed">
          {items.map((it) => <li key={nextKey()}>{renderInline(it)}</li>)}
        </ul>
      );
      continue;
    }

    // paragraph: gather consecutive normal lines.
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("#") &&
      !lines[i].startsWith(">") &&
      !lines[i].startsWith("- ") &&
      lines[i].trim() !== "---"
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(<p key={nextKey()} className="my-2 text-sm text-stone-700 leading-relaxed">{renderInline(para.join(" "))}</p>);
  }

  return <div>{blocks}</div>;
}
