// Shared text helpers: HTML to plain text, name normalising, date parsing.

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—", hellip: "…", sect: "§", reg: "®", trade: "™", copy: "©" };

export function decode(s) {
  return String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => (ENT[n.toLowerCase()] ?? m));
}

export function htmlToText(html) {
  return decode(String(html)
    .replace(/<(script|style|noscript|svg|template)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr|\/td|\/th)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[ \t\r\f\v ]+/g, " ")
    .replace(/ *\n[ \n]*/g, "\n")
    .trim();
}

// Whitespace- and quote-insensitive form used to check that a model's quote is really on the page.
export function squash(s) {
  return String(s).toLowerCase()
    .replace(/[“”"]/g, '"').replace(/[‘’`']/g, "'").replace(/[–—]/g, "-")
    .replace(/\s+/g, " ").trim();
}

export function quoteOnPage(quote, pageSquashed) {
  const q = squash(quote);
  return q.length >= 8 && pageSquashed.includes(q);
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

// "January 21, 2027", "Jan. 21, 2027", "1/21/2027", "01/21/27", "2027-01-21" -> "2027-01-21"
export function parseDate(s) {
  s = String(s || "").trim();
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
  if (m) {
    const i = MONTHS.findIndex((x) => x.startsWith(m[1].toLowerCase().slice(0, 3)));
    if (i >= 0) return `${m[3]}-${String(i + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  m = s.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (m) {
    const y = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return null;
}

const STOP = new Set(["inc", "llc", "ltd", "co", "corp", "corporation", "company", "the", "of", "and", "a", "an", "group", "holdings", "lp", "llp", "pc", "pa", "na", "plc", "data", "breach", "settlement", "security", "incident", "privacy", "litigation", "in", "re", "d/b/a", "dba"]);

export function nameTokens(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));
}

export function slugify(s) {
  return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
}

export function daysBetween(fromIso, toIso) {
  return Math.round((Date.parse(toIso + "T00:00:00Z") - Date.parse(fromIso + "T00:00:00Z")) / 86400000);
}

export const todayIso = () => new Date().toISOString().slice(0, 10);
