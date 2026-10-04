// The account emails (confirm your email, reset your password): one calm card, one big button, nothing else to read
// first. Inline styles and a table layout, because email apps (Gmail, Outlook) ignore most CSS. The plain-text copy
// keeps the link for mail apps that don't show HTML.

export type AccountEmail = { title: string; intro: string; button: string; url: string; outro: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function accountEmailText(e: AccountEmail): string {
  return `${e.title}\n\n${e.intro}\n\n${e.button}: ${e.url}\n\n${e.outro}`;
}

export function accountEmailHtml(e: AccountEmail): string {
  const url = esc(e.url);
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f1ff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ff;padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px;box-shadow:0 6px 24px rgba(60,30,140,.10);">
      <tr><td style="padding:28px 28px 0;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
        <div style="font-size:15px;font-weight:700;color:#7447e6;letter-spacing:.2px;">&#9673; Hyperfocus</div>
      </td></tr>
      <tr><td style="padding:16px 28px 0;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
        <h1 style="margin:0;font-size:22px;line-height:1.3;color:#1f1640;">${esc(e.title)}</h1>
        <p style="margin:12px 0 0;font-size:16px;line-height:1.55;color:#4a4560;">${esc(e.intro)}</p>
      </td></tr>
      <tr><td align="center" style="padding:28px;">
        <a href="${url}" target="_blank" rel="noopener" style="display:inline-block;background:#7447e6;color:#ffffff;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:17px;font-weight:700;text-decoration:none;padding:16px 36px;border-radius:14px;">${esc(e.button)}</a>
      </td></tr>
      <tr><td style="padding:0 28px 28px;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
        <p style="margin:0;font-size:13px;line-height:1.5;color:#8a85a0;">${esc(e.outro)}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}
