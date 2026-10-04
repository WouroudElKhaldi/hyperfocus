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
  today: {
    hello: { morning: "Good morning", day: "Hey", evening: "Good evening" }, helloName: "{{hello}}, {{name}}",
    sub: "One thing at a time. Dump first, sort later.", study: "📚 Study",
    card: "Today", none: "Nothing picked for today.", choose: "Choose up to 3", calendar: "On your calendar today",
    nothing: "Nothing scheduled.", openCalendar: "Open the calendar", allDay: "All day", doneLabel: "Done: {{title}}", doneToast: "Done! 🎉",
    dump: "Brain dump", dumpPlaceholder: "Whatever is in your head right now. Messy is fine.", save: "Save", savedToast: "Saved. It's out of your head now 💜",
    moreWays: "More ways to save", kindLabel: "What kind of thing is this?", sort: "Sort it for me (AI)", sorting: "Sorting…",
    split: "AI split it into {{count}} items. Save them all, or dismiss.", task: "✅ Task", saveAll: "Save all", dismiss: "Dismiss",
    savedMany: "Saved {{count}} items", recent: "Recently saved", nothingYet: "Nothing yet.",
  },
  kinds: { thought: "💭 Thought", note: "📝 Note", post_idea: "✨ Post idea", project_idea: "🚀 Project idea" },
  focus: { title: "Focus round", start: "Start", pause: "Pause", five: "5 min (tiny start)", twentyFive: "25 min", hint: "Can't start? Pick 5 minutes. Starting is the whole job.", doneToast: "Focus round done. Stand up, drink water 💧" },
  reminders: {
    title: "Reminders", mine: "My reminders", intro: "Write what you want to be reminded about, then pick when. You'll get a notification.",
    placeholder: "Remind me to…", about: "What should I remind you about?", when: "When",
    in10: "In 10 min", in30: "In 30 min", in60: "In 1 hour", evening: "This evening", tomorrowMorning: "Tomorrow morning",
    exact: "Pick an exact time or repeat", dateTime: "Date and time", repeat: "Repeat",
    once: "Just once", daily: "Every day", weekdays: "Weekdays", weekly: "Every week", add: "Add reminder",
    none: "No reminders waiting.", delete: "Delete", deleteNamed: "Delete reminder {{title}}", more: "And {{count}} more in Settings.",
    recent: "Recently sent ({{count}})", sent: "Sent {{when}}", again: "Remind me again", willRemind: "I'll remind you: {{when}}.", snoozed: "Okay, in 10 minutes.",
    todayAt: "Today, {{time}}", tomorrowAt: "Tomorrow, {{time}}", yesterdayAt: "Yesterday, {{time}}",
  },
  stuck: {
    button: "I'm stuck", title: "It's okay. Let's just start. 💜", energy: "How's your energy right now?",
    low: "🪫 Low", ok: "🙂 Okay", high: "⚡ Good", blocker: "What's in the way? (optional, a few words is enough)",
    help: "Help me start", thinking: "Thinking…", start: "Okay, starting", again: "Try again", added: "Added to Today ✅",
    placeholder: "e.g. too many things, I don't know where to begin, I'm scared it won't be good enough…",
    pick: "A task that fits your energy:", smaller: "Still stuck? Even smaller: {{step}}", putInToday: "➕ Put this step in Today", close: "Close",
  },
};
export type Strings = typeof en;
