import type { Strings } from "./en.ts";

// إطار التطبيق باللهجة اللبنانية (P3-28، المقابلة 1).
export const arLb: Strings = {
  nav: {
    groups: { Plan: "خطّط", Grow: "كبّر حالك", Share: "شارك", You: "إنت" },
    today: "اليوم", calendar: "الرزنامة", tasks: "المهام", goals: "الأهداف", skills: "خريطة المهارات", study: "دفتر الدرس", books: "الكتب",
    review: "مراجعة الجمعة", notes: "أفكار وخواطر", posts: "بوستات لينكدإن", emails: "الإيميل", jobs: "طلبات الشغل", radar: "رادار الشغل",
    chat: "فضفض", chatShort: "حكي", pet: "رفيقك", wins: "إنجازاتك", profile: "بروفايلك", settings: "الإعدادات والنسخ الاحتياطي",
  },
  shell: {
    skip: "روح عالمحتوى", sidebar: "القائمة الجانبية", main: "الرئيسية", foldAll: "سكّر الكل", unfoldAll: "افتح الكل",
    resize: "كبّر أو صغّر القائمة الجانبية (الأسهم، كبستين لترجع متل ما كانت)", loading: "عم يحمّل…",
    quickMenu: "قائمة سريعة", more: "أكتر", allPages: "كل الصفحات", lightOrDark: "فاتح أو غامق", language: "اللغة",
    demo: "عم تشوف نسخة تجريبية بمعلومات أمثلة. الذكاء الاصطناعي والنشر على لينكدإن والنسخ الاحتياطي مطفيين.",
    status: {
      serverOn: "السيرفر شغّال", serverOff: "السيرفر مطفي", aiOn: "الذكاء الاصطناعي موصول", aiOff: "ما في مفتاح DeepSeek",
      n8nOn: "النشر على لينكدإن شغّال", n8nOff: "انشر بإيدك (n8n مطفي)",
    },
  },
  topbar: {
    hello: { night: "مرحبا", morning: "صباح الخير", afternoon: "نهارك سعيد", evening: "مسا الخير" },
    helloName: "{{greeting}}، {{name}}", addName: "زيد اسمك", home: "الرئيسية",
    expandSidebar: "افتح القائمة الجانبية", collapseSidebar: "سكّر القائمة الجانبية", toggleSidebar: "فرجي أو خبّي القائمة الجانبية (Ctrl+B)",
    focusExit: "وضع التركيز · اطلع", focusExitHint: "رجّع القائمة الجانبية",
    toLight: "حوّل عالفاتح", toDark: "حوّل عالغامق", dark: "غامق", light: "فاتح",
    points: "{{xp}} نقطة", petLine: "{{name}} · عمرو {{age}}", petTitle: "{{name}} · عمرو {{age}} {{stage}} · {{xp}} نقطة",
    getPet: "جيب رفيق", yourProfile: "بروفايلك", namedProfile: "بروفايل {{name}}",
  },
  bell: { label: "الإشعارات", labelUnread: "الإشعارات، {{count}} ما انقروا", readAll: "علّم الكل إنو انقرا", empty: "ولا شي بعد. هون بيطلعولك التذكيرات وأخبار بوستاتك." },
  pet: { getTitle: "جيب رفيقك", getHint: "حيوان زغير بيكبر معك", ageLine: "عمرو {{age}} · {{xp}} نقطة" },
  stuck: {
    button: "علقت", title: "ولا يهمك. يلا نبلّش وبس. 💜", energy: "كيف طاقتك هلّق؟",
    low: "🪫 واطية", ok: "🙂 ماشي الحال", high: "⚡ منيحة", blocker: "شو اللي معلّقك؟ (إذا بدك، كم كلمة بيكفّوا)",
    help: "ساعدني بلّش", thinking: "عم فكّر…", start: "ماشي، عم بلّش", again: "جرّب مرة تانية", added: "انزادت عاليوم ✅",
    placeholder: "مثلًا: في شغلات كتير، ما بعرف من وين بلّش، خايف ما يطلع منيح…",
    pick: "مهمة بتناسب طاقتك:", smaller: "بعدك عالق؟ خطوة أزغر: {{step}}", putInToday: "➕ حطّ هالخطوة باليوم", close: "سكّر",
  },
};
