import type { Strings } from "./en.ts";

// إطار التطبيق بالعربية الفصحى (P3-28).
export const ar: Strings = {
  nav: {
    groups: { Plan: "التخطيط", Grow: "النمو", Share: "المشاركة", You: "أنت" },
    today: "اليوم", calendar: "التقويم", tasks: "المهام", goals: "الأهداف", skills: "خريطة المهارات", study: "سجلّ الدراسة", books: "الكتب",
    review: "مراجعة الأسبوع", notes: "أفكار وملاحظات", posts: "منشورات لينكدإن", emails: "البريد الإلكتروني", jobs: "طلبات التوظيف", radar: "رادار الوظائف",
    chat: "تحدّث عن الأمر", chatShort: "تحدّث", pet: "الرفيق", wins: "الإنجازات", profile: "الملف الشخصي", settings: "الإعدادات والنسخ الاحتياطي",
  },
  shell: {
    skip: "انتقل إلى المحتوى", sidebar: "الشريط الجانبي", main: "الرئيسية", foldAll: "طيّ الكل", unfoldAll: "فتح الكل",
    resize: "تغيير عرض الشريط الجانبي (مفاتيح الأسهم، نقرتان للعودة)", loading: "جارٍ التحميل…",
    quickMenu: "قائمة سريعة", more: "المزيد", allPages: "كل الصفحات", lightOrDark: "فاتح أو داكن", language: "اللغة",
    demo: "أنت تشاهد نسخة تجريبية ببيانات نموذجية. الذكاء الاصطناعي والنشر على لينكدإن والنسخ الاحتياطي متوقفة.",
    status: {
      serverOn: "الخادم يعمل", serverOff: "الخادم متوقف", aiOn: "الذكاء الاصطناعي متصل", aiOff: "لا يوجد مفتاح DeepSeek",
      n8nOn: "النشر على لينكدإن مفعّل", n8nOff: "النشر يدويًا (n8n متوقف)",
    },
  },
  topbar: {
    hello: { night: "مرحبًا", morning: "صباح الخير", afternoon: "طاب يومك", evening: "مساء الخير" },
    helloName: "{{greeting}}، {{name}}", addName: "أضف اسمك", home: "الرئيسية",
    expandSidebar: "توسيع الشريط الجانبي", collapseSidebar: "طيّ الشريط الجانبي", toggleSidebar: "إظهار الشريط الجانبي أو إخفاؤه (Ctrl+B)",
    focusExit: "وضع التركيز · خروج", focusExitHint: "إظهار الشريط الجانبي من جديد",
    toLight: "التبديل إلى الوضع الفاتح", toDark: "التبديل إلى الوضع الداكن", dark: "الوضع الداكن", light: "الوضع الفاتح",
    points: "{{xp}} نقطة", petLine: "{{name}} · العمر {{age}}", petTitle: "{{name}} · العمر {{age}} {{stage}} · {{xp}} نقطة",
    getPet: "احصل على رفيق", yourProfile: "ملفك الشخصي", namedProfile: "ملف {{name}}",
  },
  bell: { label: "الإشعارات", labelUnread: "الإشعارات، {{count}} غير مقروءة", readAll: "تعليم الكل كمقروء", empty: "لا شيء بعد. ستظهر هنا تذكيراتك وأخبار منشوراتك." },
  pet: { getTitle: "احصل على رفيقك", getHint: "حيوان صغير يكبر معك", ageLine: "العمر {{age}} · {{xp}} نقطة" },
  stuck: {
    button: "أنا عالق", title: "لا بأس. لنبدأ فقط. 💜", energy: "كيف طاقتك الآن؟",
    low: "🪫 منخفضة", ok: "🙂 لا بأس", high: "⚡ جيدة", blocker: "ما الذي يعيقك؟ (اختياري، تكفي بضع كلمات)",
    help: "ساعدني على البدء", thinking: "أفكّر…", start: "حسنًا، سأبدأ", again: "حاول مرة أخرى", added: "أُضيفت إلى اليوم ✅",
    placeholder: "مثلًا: أشياء كثيرة، لا أعرف من أين أبدأ، أخاف ألّا يكون جيدًا بما يكفي…",
    pick: "مهمة تناسب طاقتك:", smaller: "ما زلت عالقًا؟ خطوة أصغر: {{step}}", putInToday: "➕ أضف هذه الخطوة إلى اليوم", close: "إغلاق",
  },
};
