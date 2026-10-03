import { promises as dns } from "node:dns";
import { isIP } from "node:net";

// Addresses the server sends things to on someone's behalf (an n8n webhook, P5-07) must be public: never this machine
// or a private network, or anyone could make the server reach inside them. Two checks: how the address is written,
// and (P6, found by the owner's question about hosting n8n) where its name really points, looked up again right before
// each send, so a name that points to 127.0.0.1 can't slip through.

/** This machine, a private network, link-local, or "this network": not somewhere to send people's posts. */
export function privateIp(ip: string): boolean {
  const a = ip.toLowerCase().replace(/^\[|\]$/g, "");
  // IPv4 written inside IPv6: ::ffff:127.0.0.1, or the same in hex as URLs write it (::ffff:7f00:1)
  if (a.startsWith("::ffff:")) {
    const rest = a.slice(7);
    const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(rest);
    if (!hex) return privateIp(rest);
    const [hi, lo] = [Number.parseInt(hex[1] ?? "0", 16), Number.parseInt(hex[2] ?? "0", 16)];
    return privateIp(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  if (isIP(a) === 4) {
    const [x = 0, y = 0] = a.split(".").map(Number);
    return x === 127 || x === 10 || x === 0 || (x === 169 && y === 254) || (x === 192 && y === 168) || (x === 172 && y >= 16 && y <= 31) || (x === 100 && y >= 64 && y <= 127);
  }
  if (isIP(a) === 6) return a === "::1" || a === "::" || /^f[cd]/.test(a) || /^fe[89ab]/.test(a);
  return false;
}

/** Written as a public https address: https, and not a name or number that is obviously this machine or private. */
export function publicHttps(u: string): boolean {
  try {
    const { protocol, hostname } = new URL(u);
    // (the URL parser has already turned tricks like http://2130706433 into 127.0.0.1)
    const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (protocol !== "https:") return false;
    if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return false;
    return !privateIp(h);
  } catch {
    return false;
  }
}

export type Lookup = (host: string) => Promise<{ address: string }[]>;
const systemLookup: Lookup = (host) => dns.lookup(host, { all: true });

/** Written as public, and every address its name points to is public too. */
export async function reachesPublic(u: string, lookup: Lookup = systemLookup): Promise<boolean> {
  if (!publicHttps(u)) return false;
  const host = new URL(u).hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return true;
  try {
    const found = await lookup(host);
    return found.length > 0 && found.every((f) => !privateIp(f.address));
  } catch {
    return false; // (a name that doesn't exist isn't somewhere to send to)
  }
}
