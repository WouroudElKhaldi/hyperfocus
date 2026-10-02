import http from "node:http";

// Small stand-ins for the outside services the API talks to, so tests never spend AI credits,
// post to LinkedIn or depend on the internet. Each fake records what it received and can be
// told how to answer through its /__control routes (tests run in other processes, so this is HTTP).

const readBody = (req) =>
  new Promise((resolve) => {
    let s = "";
    req.on("data", (d) => (s += d));
    req.on("end", () => resolve(s));
  });

const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

function startFake(handle) {
  const state = { requests: [], status: 200 };
  const server = http.createServer(async (req, res) => {
    const raw = await readBody(req);
    if (req.url === "/__control/requests") return send(res, 200, state.requests);
    if (req.url === "/__control/reset") { state.requests = []; state.status = 200; return send(res, 200, { ok: true }); }
    if (req.url === "/__control/status") { state.status = JSON.parse(raw).status; return send(res, 200, { ok: true }); }
    let body = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
    state.requests.push({ method: req.method, url: req.url, headers: req.headers, body });
    if (state.status !== 200) return send(res, state.status, { error: "fake failure" });
    handle(body, res, req);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` })));
}

// One JSON object that satisfies every AI feature's expected reply shape.
const UNIVERSAL = {
  // rewritePost
  draft: "Fake draft from the AI.", hookType: "Question", hooks: ["Hook one", "Hook two", "Hook three"], suggestions: ["Add an example"],
  // analyzeGoal
  refined: "I will finish the course by December.", verdict: "achievable", verdictNote: "Fake note.", suggestion: "Start small.", actions: ["Open the course", "Watch one video"],
  // postIdeas
  ideas: [{ angle: "A lesson", thought: "I learned something." }, { angle: "A question", thought: "What do you think?" }, { angle: "A mistake", thought: "I got this wrong." }],
  // winsSummary
  bullets: ["Finished tasks"], paragraph: "I did good work.",
  // stuckHelp
  validation: "That sounds hard.", step: "Open the file.", ifStillStuck: "Just look at it.", pick: "",
  // suggestSkills
  skills: [{ name: "Designing REST APIs", area: "Design & architecture", why: "You said so." }],
  // skillPlan / taskSteps
  steps: ["Read one page", "Write one line"], books: [{ title: "Clean Code", author: "Robert C. Martin" }],
  // organize
  items: [{ kind: "task", title: "Buy milk", body: "buy milk" }],
  // parseEventText
  title: "Study", day: "2026-10-09", allDay: false, startTime: "15:00", endTime: "16:00", category: "study", repeat: "none", location: "",
  // planStudyBlocks
  blocks: [],
  // findBook
  matchIds: [], author: "", summary: "Fake summary.", whyForYou: "",
  // writeReview
  headline: "A calm week.", wins: ["You showed up."], watch: [], priorities: [{ title: "Finish one task", why: "Momentum." }], tinyStart: "Open the list.", postIdea: "",
};

function aiReply(body) {
  const messages = body?.messages || [];
  const system = messages[0]?.content || "";
  const user = messages[messages.length - 1]?.content || "";
  if (!body?.response_format) return "Fake companion reply.";
  // the proofreaders refuse answers that change too much, so they get their input back unchanged
  if (system.includes("proofreader for an email")) {
    const m = /^Subject: (.*)\n\nBody HTML:\n([\s\S]*)$/.exec(user);
    return JSON.stringify({ subject: m?.[1] ?? "", html: m?.[2] ?? "", changes: [] });
  }
  if (system.includes("You are a proofreader")) return JSON.stringify({ draft: user, changes: [] });
  // the book matcher: every search result it was shown is "really this book"
  if (system.includes("find books")) return JSON.stringify({ ...UNIVERSAL, matchIds: [...user.matchAll(/^(\d+): /gm)].map((m) => Number(m[1])) });
  return JSON.stringify(UNIVERSAL);
}

export const startFakeAi = () =>
  startFake((body, res) => send(res, 200, { choices: [{ message: { content: aiReply(body) } }] }));

// The three book sites "find free copies" searches, behind one address (BOOK_SOURCES_URL): /openlibrary, /google, /gutendex.
// Each answers one result for "Clean Code"; Google Books also sends a malformed entry, which must be skipped.
function bookReply(url) {
  if (url.startsWith("/openlibrary/search.json")) {
    return { docs: [{ key: "/works/OL1W", title: "Clean Code", author_name: ["Robert C. Martin"], first_publish_year: 2008, ia: ["cleancode00mart"], ebook_access: "borrowable" }] };
  }
  if (url.startsWith("/google/books/v1/volumes")) {
    return { items: [
      { volumeInfo: { title: "Clean Code", authors: ["Robert C. Martin"], publishedDate: "2008-08-01", infoLink: "https://books.example/clean" }, saleInfo: { buyLink: "https://play.example/clean", listPrice: { amount: 30, currencyCode: "USD" } } },
      { volumeInfo: { authors: 42 } },
    ] };
  }
  if (url.startsWith("/gutendex/books/")) return { results: [] };
  return null;
}
export const startFakeBooks = () => startFake((_, res, req) => {
  const reply = bookReply(req.url);
  reply ? send(res, 200, reply) : send(res, 404, { error: "unknown fake book path" });
});

export const startFakeN8n = () => startFake((_, res) => send(res, 200, { ok: true }));
