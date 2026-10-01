// Fills the DEMO copy (never your real database) with friendly sample data. Usage: node demo-seed.mjs [port]
const port = process.argv[2] || 4800;
const api = `http://localhost:${port}/api`;
const H = { "Content-Type": "application/json" };
const call = async (m, p, body) => {
  const r = await fetch(api + p, { method: m, headers: body ? H : undefined, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${m} ${p} -> ${r.status} ${j.error || ""}`);
  return j;
};
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return ymd(d); };
const at = (daysAgo, h, m = 0) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(h, m, 0, 0); return d; };

// the demo is clearly not anyone's real account
await call("PUT", "/profile", { name: "Sam", role: "Software engineer", location: "Somewhere sunny", about: "Learning in public and growing one small step at a time.", helps: "Tiny steps help a lot.", avatar: "#d1407f" });
await call("POST", "/pet", { name: "Pip", species: "fox", color: "#ff9f6b", traits: ["curious", "playful", "brave"], bio: "Loves snacks, big goals and tiny wins.", backdrop: "meadow" });

// study sessions over the last days
const sessions = [
  [4, 20, 50, "Course 1", "Welcome", "Notes: the big picture of the program. Consistency beats intensity."],
  [3, 21, 40, "Course 1", "Mindset", "Perfection is the enemy of progress. Ship the small version."],
  [2, 19, 65, "Course 2", "Foundations", "Stack vs heap. Wrote my own small examples to make it stick."],
  [1, 20, 35, "Course 2", "Problem solving", "Break it down until it is boring."],
  [0, 9, 30, "Course 2", "Practice", "Five small exercises. One was hard, asked for help."],
];
for (const [ago, hr, mins, course, part, notes] of sessions) {
  const start = at(ago, hr);
  await call("POST", "/study", { course, part, notes, startedAt: start.toISOString(), endedAt: new Date(start.getTime() + mins * 60000).toISOString() });
}

// tasks: some finished (this is what makes the pet grow)
const finished = [["Reply to the recruiter", "urgent"], ["Finish module 3 notes", "high"], ["Update my portfolio", "high"], ["Book a dentist visit", "normal"], ["Tidy my desk", "low"], ["Plan next week", "normal"], ["Submit the project", "urgent"], ["Read one chapter", "normal"], ["Review a pull request", "high"], ["Write a LinkedIn draft", "high"], ["Stretch for 10 minutes", "low"], ["Fix the login bug", "urgent"], ["Organize my notes", "normal"], ["Email my mentor", "high"]];
for (const [title, priority] of finished) { const t = await call("POST", "/tasks", { title, priority }); await call("PATCH", `/tasks/${t.id}`, { done: true }); }
const open = [["Prepare for the live session", "high", 0], ["Practice explaining closures out loud", "normal", 1], ["Send the invoice", "urgent", 2], ["Buy a birthday gift", "low", 3], ["Record a short demo video", "normal", 4]];
for (const [title, priority, d] of open) await call("POST", "/tasks", { title, priority, dueDay: day(d), today: d === 0 });

// calendar
const weekdayStart = day(-((new Date().getDay() + 6) % 7));
await call("POST", "/events", { title: "Team standup", day: weekdayStart, startTime: "09:30", endTime: "10:00", category: "work", repeat: "weekdays", remindMin: 10 });
await call("POST", "/events", { title: "Deep work: course", day: day(0), startTime: "14:00", endTime: "16:00", category: "study", repeat: "weekly" });
await call("POST", "/events", { title: "Gym", day: day(0), startTime: "17:30", endTime: "18:30", category: "health", repeat: "daily" });
await call("POST", "/events", { title: "Live session", day: day(1), startTime: "19:00", endTime: "20:30", category: "study", location: "Online" });
await call("POST", "/events", { title: "Coffee with a friend", day: day(2), startTime: "11:00", endTime: "12:00", category: "personal", location: "Favourite cafe" });
await call("POST", "/events", { title: "Doctor", day: day(3), allDay: true, category: "health" });
await call("POST", "/events", { title: "Birthday", day: day(5), allDay: true, category: "personal" });

// goals with steps
const g = await call("POST", "/goals", { original: "Become a senior engineer", targetDate: day(120) });
for (const t of ["Finish the program's first course", "Publish 5 posts about what I learn", "Pick one skill gap and work on it weekly", "Ask for feedback from a mentor"]) await call("POST", `/goals/${g.id}/actions`, { text: t });
const goal = await call("GET", "/goals");
await call("PATCH", `/goal-actions/${goal[0].actions[0].id}`, { done: true });
await call("POST", `/goals/${g.id}/logs`, { text: "Booked a weekly study block and told a friend about it." });

// thoughts, skills, books, wins, posts
for (const [kind, body] of [["thought", "Perfectionism keeps me from sharing early. Start messy."], ["post_idea", "What I learned from logging my study time for a week."], ["project_idea", "A tiny habit tracker with a pet that grows."]]) await call("POST", "/notes", { kind, body });
await call("POST", "/skills/bulk", { items: [{ name: "Design patterns", area: "Design & architecture" }, { name: "SQL & database design", area: "Data & databases" }, { name: "Testing", area: "Code quality" }, { name: "CI/CD & deployment", area: "Delivery & DevOps" }, { name: "Technical writing", area: "Communication & leadership" }] });
const skills = await call("GET", "/skills");
for (const [i, lvl] of [[0, 2], [1, 3], [2, 2], [3, 1], [4, 4]]) await call("PATCH", `/skills/${skills[i].id}`, { level: lvl, target: 4 });
await call("POST", "/books", { title: "Atomic Habits", author: "James Clear", notes: "For building small daily routines." });
await call("POST", "/books", { title: "Meditations", author: "Marcus Aurelius", notes: "Calm perspective." });
for (const w of ["Finished my first study week", "Asked a question out loud", "Shared a draft instead of polishing it forever", "Kept my streak for 3 days", "Helped a teammate debug"]) await call("POST", "/wins", { text: w });
const post = await call("POST", "/posts", { thought: "I started a new program and I am a bit nervous.", draft: "I started a new program this week.\n\nI'm excited, and a little scared.\n\nThat feels about right.\n\n#Growth" });
await call("POST", `/posts/${post.id}/mark-posted`);
await call("POST", "/posts", { thought: "Small steps beat big plans.", draft: "Small steps beat big plans.\n\nThis week I studied for 25 minutes a day. That's it.\n\nWhat's one tiny thing you can do today?" });

// with the points earned, dress the pet up
let s = await call("GET", "/pet");
const wear = {};
for (const slot of ["head", "face", "neck", "body"]) { const pick = s.items.find((i) => i.slot === slot && i.unlocked && i.kind !== "free") || s.items.find((i) => i.slot === slot && i.unlocked); if (pick) wear[slot] = pick.id; }
const pattern = s.patterns.filter((p) => p.unlocked && p.id !== "none").pop()?.id || "none";
const backdrop = s.backdrops.filter((b) => b.unlocked).pop()?.id || "meadow";
await call("PATCH", "/pet", { outfit: wear, pattern, backdrop });
s = await call("GET", "/pet");
console.log(`demo ready: Pip is age ${s.age} (${s.stageName}) with ${s.xp} points, wearing ${JSON.stringify(s.outfit)}`);
