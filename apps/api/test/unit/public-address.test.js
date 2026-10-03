import { describe, expect, it } from "vitest";
import { privateIp, publicHttps, reachesPublic } from "../../src/http/public-address.ts";

// Where the server may send people's posts: public addresses only, checked as written and where the name points.

const lookupTo = (...addresses) => async () => addresses.map((address) => ({ address }));

describe("public addresses", () => {
  it("knows this machine and private networks", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.10", "172.16.0.1", "172.31.255.255", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a00:5"]) expect(privateIp(ip), ip).toBe(true);
    for (const ip of ["8.8.8.8", "172.15.0.1", "172.32.0.1", "1.1.1.1", "2606:4700::1111"]) expect(privateIp(ip), ip).toBe(false);
  });

  it("checks how the address is written", () => {
    expect(publicHttps("https://n8n.example.com/webhook/x")).toBe(true);
    for (const u of ["http://n8n.example.com/x", "https://localhost/x", "https://127.0.0.1/x", "https://2130706433/x", "https://[::1]/x", "https://n8n.local/x", "nonsense"]) expect(publicHttps(u), u).toBe(false);
  });

  it("checks where the name really points (a public-looking name pointing at this machine is refused)", async () => {
    expect(await reachesPublic("https://n8n.example.com/x", lookupTo("93.184.216.34"))).toBe(true);
    expect(await reachesPublic("https://sneaky.example.com/x", lookupTo("127.0.0.1"))).toBe(false);
    expect(await reachesPublic("https://half.example.com/x", lookupTo("93.184.216.34", "10.0.0.5"))).toBe(false);
    expect(await reachesPublic("https://gone.example.com/x", async () => { throw new Error("ENOTFOUND"); })).toBe(false);
    expect(await reachesPublic("http://n8n.example.com/x", lookupTo("93.184.216.34"))).toBe(false);
  });
});
