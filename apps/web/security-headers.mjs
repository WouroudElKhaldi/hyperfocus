// Browser security headers for the website. Used by the dev server (vite.config.js) and by the demo server.
// The only outside address the page may load anything from is YouTube's privacy-friendly player (for the Songs tab),
// and only inside a frame. Scripts, styles, images, fonts and network calls are limited to this site itself.
export const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'", // 'unsafe-inline' is needed by the development server's hot reload
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' ws: wss:",
    "frame-src https://www.youtube-nocookie.com",
    "media-src 'self' blob: data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; "),
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": 'autoplay=(self "https://www.youtube-nocookie.com"), encrypted-media=(self "https://www.youtube-nocookie.com"), fullscreen=(self "https://www.youtube-nocookie.com"), camera=(), microphone=(), geolocation=(), payment=()',
};
