// Turning a posting's HTML into plain text (P6-12): tags out, the common entities decoded, paragraphs and list items
// kept as lines. Postings are only ever shown as text, so nothing from a source can run in the website.

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", euro: "€", pound: "£", bull: "•", middot: "·" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1));
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Plain text from HTML (also from HTML that arrived escaped, as Greenhouse sends it). */
export function htmlToText(html: string): string {
  let s = html;
  if (/&lt;\/?[a-z]/i.test(s) && !/<\/?[a-z]/i.test(s)) s = decodeEntities(s); // escaped HTML: unescape once first
  const strip = (t: string) =>
    decodeEntities(
      t
        .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|h[1-6]|li|ul|ol|tr|section|article)>/gi, "\n")
        .replace(/<li[^>]*>/gi, "• ")
        .replace(/<[^>]+>/g, " "),
    );
  s = strip(s);
  // HTML escaped inside real tags (some sources mix both): its tags only appear now, so once more
  if (/<\/?(p|div|br|li|ul|ol|strong|b|i|em|span|h[1-6]|a)\b[^>]*>/i.test(s)) s = strip(s);
  return s
    .replace(/[ \t ]+/g, " ")
    .replace(/ +([.,;:!?])(?=\s|$)/g, "$1") // "Hello <b>World</b>." leaves no space before the dot
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
