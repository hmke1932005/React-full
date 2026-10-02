/**
 * Formatting + text-render helpers for the messaging UI — ported 1:1 from
 * public/assets/js/messaging.js's fmtTime/fmtDayLabel/fmtBytes/fmtDuration/
 * fmtClock/initials/renderBody. Same logic, same edge cases; renderBody
 * returns React nodes instead of an HTML string since this is JSX-rendered
 * (no dangerouslySetInnerHTML needed — safer, and skips escapeHtml entirely
 * since React already escapes text content).
 *
 * The rest of the React port (Login/Register/AdminSettings/Dashboard) is
 * English-only so far — no locale context exists yet — so this drops the
 * t(en, ar) bilingual helper the PHP view used and always renders English,
 * matching that convention. Swap in a locale context here once one exists
 * for the rest of the app.
 */

export function initials(name) {
  const n = (name || "?").trim();
  const parts = n.split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
}

export function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso.replace(" ", "T"));
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay)
    return d.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays < 6) return d.toLocaleDateString("en", { weekday: "short" });
  return d.toLocaleDateString("en", { month: "short", day: "numeric" });
}

export function fmtDayLabel(iso) {
  const d = new Date(iso.replace(" ", "T"));
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function fmtDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function fmtBytes(n) {
  if (!n && n !== 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function fmtClock(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
}

/**
 * Attachment/thumbnail URLs come back from the API as root-relative paths
 * (e.g. "/uploads/messages/conv_5/xyz.webp") — same convention as the old
 * uploadsBase handling in messaging.js's attachmentUrl(). The React app can
 * be hosted on a different origin than the PHP backend (see api/client.js
 * docblock), so this prefixes with VITE_UPLOADS_BASE when set (e.g.
 * "https://api.example.com") and otherwise returns the path as-is for
 * same-origin / dev-proxy deployments.
 */
export function attachmentUrl(path) {
  if (!path) return path;
  const base = import.meta.env.VITE_UPLOADS_BASE || '';
  return path.startsWith('http') ? path : base + path;
}

export function peerLabel(conv) {
  if (!conv) return "";
  return conv.subject || (conv.is_group ? "Group" : "Conversation");
}

/**
 * Ported from renderBody() — same markdown-lite rules, same order of
 * operations (code block, inline code, bold, italic, links, hashtags,
 * mentions, then newlines), but building a React node array instead of an
 * HTML string. Kept intentionally simple/regex-based like the original —
 * not a real markdown parser.
 */
export function renderBody(rawBody, others) {
  if (rawBody == null) return null;
  const nodes = [];
  let key = 0;

  // Mention names get matched against the raw text before any markdown
  // splitting, same as the original (it ran regex replacements on an
  // escaped HTML string, mentions included) — build a lookup of names to
  // match against here instead.
  const mentionNames = (others || []).map((p) => p.full_name).filter(Boolean);

  // Split on the token types we care about, keeping the delimiters, so we
  // can walk the string once and emit alternating text/element nodes.
  const tokenRe =
    /(```[\s\S]+?```|`[^`]+?`|\*\*[^*]+?\*\*|(?:^|[\s(])_[^_]+?_(?:[\s).,!?]|$)|https?:\/\/[^\s]+|#[\p{L}0-9_]+)/gu;

  let lastIndex = 0;
  let match;
  const pushText = (text) => {
    if (!text) return;
    // Mentions inside plain text segments.
    if (mentionNames.length) {
      const re = new RegExp(
        "(" +
          mentionNames
            .map(escRe)
            .map((n) => "@" + n)
            .join("|") +
          ")",
        "g",
      );
      const parts = text.split(re);
      parts.forEach((part) => {
        if (mentionNames.some((n) => part === "@" + n)) {
          nodes.push(
            <span className="msg-mention" key={key++}>
              {part}
            </span>,
          );
        } else if (part) {
          nodes.push(...withLineBreaks(part, key));
          key += 1;
        }
      });
      return;
    }
    nodes.push(...withLineBreaks(text, key));
    key += 1;
  };

  while ((match = tokenRe.exec(rawBody)) !== null) {
    pushText(rawBody.slice(lastIndex, match.index));
    const tok = match[0];
    if (tok.startsWith("```")) {
      nodes.push(<pre key={key++}>{tok.slice(3, -3)}</pre>);
    } else if (tok.startsWith("`")) {
      nodes.push(<code key={key++}>{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith("**")) {
      nodes.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("_") || / _/.test(tok) || tok[0] === "_") {
      // trims the captured leading/trailing space/punctuation the regex
      // needed to avoid matching mid-word underscores, same as original.
      const inner = tok.replace(/^([\s(])?_/, "").replace(/_([\s).,!?])?$/, "");
      const lead = /^[\s(]/.test(tok) ? tok[0] : "";
      const trail = /[\s).,!?]$/.test(tok) ? tok[tok.length - 1] : "";
      if (lead) nodes.push(lead);
      nodes.push(<em key={key++}>{inner}</em>);
      if (trail) nodes.push(trail);
    } else if (tok.startsWith("http")) {
      nodes.push(
        <a key={key++} href={tok} target="_blank" rel="noopener noreferrer">
          {tok}
        </a>,
      );
    } else if (tok.startsWith("#")) {
      nodes.push(
        <span className="msg-hashtag" key={key++}>
          {tok}
        </span>,
      );
    }
    lastIndex = tokenRe.lastIndex;
  }
  pushText(rawBody.slice(lastIndex));

  return nodes;
}

function withLineBreaks(text, keyBase) {
  const lines = text.split("\n");
  const out = [];
  lines.forEach((line, i) => {
    if (i > 0) out.push(<br key={`${keyBase}-br-${i}`} />);
    if (line) out.push(line);
  });
  return out;
}

function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
