// The words of the app frame (sidebar, top bar, phone tab bar, the "More" sheet, "I'm stuck"), in English (P3-19).
// Pages move their words here as they are restyled. Other languages copy this shape (the keys are type-checked).
export const en = {
  nav: {
    groups: { Plan: "Plan", Grow: "Grow", Share: "Share", You: "You" },
    today: "Today", calendar: "Calendar", tasks: "Tasks", goals: "Goals", skills: "Skills map", study: "Study log", books: "Books",
    review: "Weekly review", notes: "Thoughts & ideas", posts: "LinkedIn posts", emails: "Email", jobs: "Job applications", radar: "Job Radar",
    chat: "Talk it out", chatShort: "Talk", pet: "Companion", wins: "Wins", profile: "Profile", settings: "Settings & backup",
  },
  shell: {
    skip: "Skip to content", sidebar: "Sidebar", main: "Main", foldAll: "Fold all", unfoldAll: "Unfold all",
    resize: "Resize the sidebar (arrow keys, double-click to reset)", loading: "Loading…",
    quickMenu: "Quick menu", more: "More", allPages: "All pages", lightOrDark: "Light or dark", language: "Language",
    demo: "You're looking at a demo with sample data. The AI, LinkedIn posting and backups are switched off.",
    status: {
      serverOn: "Server running", serverOff: "Server offline", aiOn: "AI connected", aiOff: "No DeepSeek key",
      n8nOn: "LinkedIn posting on", n8nOff: "Post by hand (n8n off)",
    },
  },
  topbar: {
    hello: { night: "Hello", morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening" },
    helloName: "{{greeting}}, {{name}}", addName: "Add your name", home: "Home",
    expandSidebar: "Expand the sidebar", collapseSidebar: "Collapse the sidebar", toggleSidebar: "Toggle sidebar (Ctrl+B)",
    focusExit: "Focus mode · Exit", focusExitHint: "Show the sidebar again",
    toLight: "Switch to light mode", toDark: "Switch to dark mode", dark: "Dark mode", light: "Light mode",
    points: "{{xp}} points", petLine: "{{name}} · Age {{age}}", petTitle: "{{name}} · Age {{age}} {{stage}} · {{xp}} points",
    getPet: "Get a companion", yourProfile: "Your profile", namedProfile: "{{name}}'s profile",
  },
  bell: { label: "Notifications", labelUnread: "Notifications, {{count}} unread", readAll: "Mark all as read", empty: "Nothing yet. Reminders and news about your posts show up here." },
  pet: { getTitle: "Get your companion", getHint: "A pet that grows with you", ageLine: "Age {{age}} · {{xp}} points" },
  stuck: {
    button: "I'm stuck", title: "It's okay. Let's just start. 💜", energy: "How's your energy right now?",
    low: "🪫 Low", ok: "🙂 Okay", high: "⚡ Good", blocker: "What's in the way? (optional, a few words is enough)",
    help: "Help me start", thinking: "Thinking…", start: "Okay, starting", again: "Try again", added: "Added to Today ✅",
    placeholder: "e.g. too many things, I don't know where to begin, I'm scared it won't be good enough…",
    pick: "A task that fits your energy:", smaller: "Still stuck? Even smaller: {{step}}", putInToday: "➕ Put this step in Today", close: "Close",
  },
};
export type Strings = typeof en;
