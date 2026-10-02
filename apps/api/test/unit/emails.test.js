import { describe, expect, it } from "vitest";
import { addrList, checkAddrs, emailFields, inlineImages, repoint, safeFilename } from "../../src/modules/emails/html.ts";
import { gmailAppPassword } from "../../src/modules/emails/mail-provider.ts";

// The email module's pure rules and the Gmail adapter's set-up checks (P2-16). No database, no network.

describe("email rules", () => {
  it("cleans what the editor sends and keeps a plain-text copy", () => {
    expect(emailFields({ toAddr: " a@b.co ", html: "<p>Hi&nbsp;<b>there</b></p><script>x()</script>" })).toEqual({
      // (the HTML keeps the no-break space as a character; the plain-text copy gets a normal space)
      toAddr: "a@b.co", ccAddr: "", bccAddr: "", subject: "", html: "<p>Hi <b>there</b></p>", body: "Hi there",
    });
  });
  it("splits and checks addresses (comma, semicolon or new line)", () => {
    expect(addrList("a@b.co; c@d.org,\n e@f.io ,")).toEqual(["a@b.co", "c@d.org", "e@f.io"]);
    expect(() => checkAddrs("To", ["a@b.co", "not-an-address"])).toThrow('"not-an-address" is not a valid email address (To).');
    expect(() => checkAddrs("Cc", [])).not.toThrow();
  });
  it("makes file names safe on every system", () => {
    expect(safeFilename("../notes:1.txt")).toBe(".._notes_1.txt");
    expect(safeFilename("")).toBe("file");
    expect(safeFilename("x".repeat(200))).toHaveLength(150);
  });
  it("sends images placed in the body inside the message (cid), only its own files", () => {
    const html = '<p>a</p><img src="/api/emails/attachments/7"><img src="/api/emails/attachments/99"><img src="https://x.y/z.png">';
    const out = inlineImages(html, new Set([7, 8]));
    expect(out.html).toBe('<p>a</p><img src="cid:img7@mail"><img src="/api/emails/attachments/99"><img src="https://x.y/z.png">');
    expect([...out.used]).toEqual([7]); // file 8 isn't in the body, so it travels as a normal attachment
  });
  it("points copied images at the copies of their files", () => {
    expect(repoint('<img src="/api/emails/attachments/3"><img src="/api/emails/attachments/4">', new Map([[3, 30]]))).toBe('<img src="/api/emails/attachments/30"><img src="/api/emails/attachments/4">');
  });
});

describe("the Gmail adapter (MailProvider)", () => {
  it("is ready only with an address and an App Password, and never in the demo", () => {
    expect(gmailAppPassword({ user: "me@gmail.com", appKey: "k" }).status()).toEqual({ ready: true, user: "me@gmail.com", hasKey: true, hasUser: true });
    expect(gmailAppPassword({ user: "me@gmail.com", appKey: "k" }).unavailable()).toBeNull();
    expect(gmailAppPassword({ user: "", appKey: "k" }).unavailable()).toMatchObject({ status: 400, message: /Gmail is not set up/ });
    const demo = gmailAppPassword({ user: "me@gmail.com", appKey: "k" }, { demo: true });
    expect(demo.status().ready).toBe(false);
    expect(demo.unavailable()).toMatchObject({ status: 403 });
  });
});
