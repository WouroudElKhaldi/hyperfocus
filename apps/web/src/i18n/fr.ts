import type { Strings } from "./en.ts";

// Le cadre de l'appli en français (P3-28), en tutoyant (entretien 1).
export const fr: Strings = {
  nav: {
    groups: { Plan: "Planifier", Grow: "Grandir", Share: "Partager", You: "Toi" },
    today: "Aujourd'hui", calendar: "Calendrier", tasks: "Tâches", goals: "Objectifs", skills: "Carte des compétences", study: "Journal d'étude", books: "Livres",
    review: "Bilan de la semaine", notes: "Pensées et idées", posts: "Posts LinkedIn", emails: "E-mail", jobs: "Candidatures", radar: "Radar à emplois",
    chat: "En parler", chatShort: "Parler", pet: "Compagnon", wins: "Victoires", profile: "Profil", settings: "Réglages et sauvegarde",
  },
  shell: {
    skip: "Aller au contenu", sidebar: "Barre latérale", main: "Principal", foldAll: "Tout replier", unfoldAll: "Tout déplier",
    resize: "Redimensionner la barre latérale (flèches, double-clic pour revenir)", loading: "Chargement…",
    quickMenu: "Menu rapide", more: "Plus", allPages: "Toutes les pages", lightOrDark: "Clair ou sombre", language: "Langue",
    demo: "Tu regardes une démo avec des données d'exemple. L'IA, la publication LinkedIn et les sauvegardes sont désactivées.",
    status: {
      serverOn: "Serveur en marche", serverOff: "Serveur hors ligne", aiOn: "IA connectée", aiOff: "Pas de clé DeepSeek",
      n8nOn: "Publication LinkedIn activée", n8nOff: "Publier à la main (n8n désactivé)",
    },
  },
  topbar: {
    hello: { night: "Salut", morning: "Bonjour", afternoon: "Bon après-midi", evening: "Bonsoir" },
    helloName: "{{greeting}}, {{name}}", addName: "Ajoute ton prénom", home: "Accueil",
    expandSidebar: "Déplier la barre latérale", collapseSidebar: "Replier la barre latérale", toggleSidebar: "Afficher ou masquer la barre latérale (Ctrl+B)",
    focusExit: "Mode concentration · Quitter", focusExitHint: "Réafficher la barre latérale",
    toLight: "Passer en mode clair", toDark: "Passer en mode sombre", dark: "Mode sombre", light: "Mode clair",
    points: "{{xp}} points", petLine: "{{name}} · Âge {{age}}", petTitle: "{{name}} · Âge {{age}} {{stage}} · {{xp}} points",
    getPet: "Adopter un compagnon", yourProfile: "Ton profil", namedProfile: "Profil de {{name}}",
  },
  bell: { label: "Notifications", labelUnread: "Notifications, {{count}} non lues", readAll: "Tout marquer comme lu", empty: "Rien pour l'instant. Tes rappels et les nouvelles de tes posts apparaîtront ici." },
  pet: { getTitle: "Adopte ton compagnon", getHint: "Un petit animal qui grandit avec toi", ageLine: "Âge {{age}} · {{xp}} points" },
  today: {
    hello: { morning: "Bonjour", day: "Salut", evening: "Bonsoir" }, helloName: "{{hello}}, {{name}}",
    sub: "Une chose à la fois. Vide ta tête d'abord, trie ensuite.", study: "📚 Étudier",
    card: "Aujourd'hui", none: "Rien de choisi pour aujourd'hui.", choose: "Choisis-en jusqu'à 3", calendar: "Dans ton calendrier aujourd'hui",
    nothing: "Rien de prévu.", openCalendar: "Ouvrir le calendrier", allDay: "Toute la journée", doneLabel: "Fait : {{title}}", doneToast: "Fait ! 🎉",
    dump: "Vide-tête", dumpPlaceholder: "Tout ce qui est dans ta tête maintenant. Le désordre, ça va.", save: "Enregistrer", savedToast: "Enregistré. C'est sorti de ta tête 💜",
    moreWays: "Plus de façons d'enregistrer", kindLabel: "C'est quel genre de chose ?", sort: "Trie-le pour moi (IA)", sorting: "Je trie…",
    split: "L'IA l'a séparé en {{count}} éléments. Enregistre-les tous, ou laisse tomber.", task: "✅ Tâche", saveAll: "Tout enregistrer", dismiss: "Laisser tomber",
    savedMany: "{{count}} éléments enregistrés", recent: "Enregistré récemment", nothingYet: "Rien pour l'instant.",
  },
  kinds: { thought: "💭 Pensée", note: "📝 Note", post_idea: "✨ Idée de post", project_idea: "🚀 Idée de projet" },
  focus: { title: "Session de concentration", start: "Démarrer", pause: "Pause", five: "5 min (petit départ)", twentyFive: "25 min", hint: "Tu n'arrives pas à commencer ? Prends 5 minutes. Commencer, c'est tout le travail.", doneToast: "Session terminée. Lève-toi, bois de l'eau 💧" },
  reminders: {
    title: "Rappels", mine: "Mes rappels", intro: "Écris ce dont tu veux qu'on te rappelle, puis choisis quand. Tu recevras une notification.",
    placeholder: "Rappelle-moi de…", about: "De quoi dois-je te rappeler ?", when: "Quand",
    in10: "Dans 10 min", in30: "Dans 30 min", in60: "Dans 1 heure", evening: "Ce soir", tomorrowMorning: "Demain matin",
    exact: "Choisir une heure précise ou une répétition", dateTime: "Date et heure", repeat: "Répéter",
    once: "Une seule fois", daily: "Tous les jours", weekdays: "En semaine", weekly: "Chaque semaine", add: "Ajouter le rappel",
    none: "Aucun rappel en attente.", delete: "Supprimer", deleteNamed: "Supprimer le rappel {{title}}", more: "Et {{count}} de plus dans les Réglages.",
    recent: "Envoyés récemment ({{count}})", sent: "Envoyé {{when}}", again: "Me le rappeler encore", willRemind: "Je te le rappellerai : {{when}}.", snoozed: "OK, dans 10 minutes.",
    todayAt: "Aujourd'hui, {{time}}", tomorrowAt: "Demain, {{time}}", yesterdayAt: "Hier, {{time}}",
  },
  stuck: {
    button: "Je bloque", title: "Ce n'est pas grave. On commence, c'est tout. 💜", energy: "Comment est ton énergie, là ?",
    low: "🪫 Basse", ok: "🙂 Ça va", high: "⚡ Bonne", blocker: "Qu'est-ce qui te bloque ? (facultatif, quelques mots suffisent)",
    help: "Aide-moi à commencer", thinking: "Je réfléchis…", start: "OK, je commence", again: "Réessayer", added: "Ajouté à Aujourd'hui ✅",
    placeholder: "ex. trop de choses, je ne sais pas par où commencer, j'ai peur que ce ne soit pas assez bien…",
    pick: "Une tâche qui va avec ton énergie :", smaller: "Toujours bloqué·e ? Encore plus petit : {{step}}", putInToday: "➕ Mettre cette étape dans Aujourd'hui", close: "Fermer",
  },
};
