import i18next from "i18next";
import { MOOD_VOICE, VOICE } from "../../data/personalities.ts";

// The pet's names that come from the server (clothes, scenes, ages, quests, personalities, badges, how to unlock things)
// and its voice lines, in French and both Arabics (P3-28). Looked up by id; English, or anything missing, keeps the
// server's own words, so a new item shows in English until it's added here.

type Lang = "fr" | "ar" | "ar-LB";
type Table = {
  items: Record<string, string>;
  scenes: Record<string, string>;
  ages: string[]; legend: string;
  quests: Record<string, string>;
  traits: Record<string, [label: string, title: string, desc: string]>;
  badges: Record<string, [label: string, desc: string]>;
  rules: (kind: string, n: number) => string;
  perks: Record<string, string>;
  notes: Record<string, string>; questNote: string;
  voice: Record<string, string[]>; mood: Record<string, string[]>;
  extra: { lightThrough: string; almost: string; felt: string; late: string };
};

const AR_ITEMS: Record<string, string> = {
  bow: "فيونكة", flower: "وردة", snapback: "قبعة سناب باك", beanie: "قبعة صوف", cap: "قبعة بيسبول", flatcap: "قبعة مسطّحة", party: "قبعة حفلة", headphones: "سمّاعات", hardhat: "خوذة عمل", fedora: "قبعة فيدورا", tophat: "قبعة عالية", sunhat: "قبعة شمس", wizard: "قبعة ساحر", chef: "قبعة طاهٍ", cowboy: "قبعة كاوبوي", headset: "سمّاعة ألعاب", halo: "هالة ملاك", tiara: "تاج صغير", viking: "خوذة فايكنغ", crown: "تاج",
  glasses: "نظارة مستديرة", squareglasses: "نظارة مربّعة", sunglasses: "نظارة شمسية", catglasses: "نظارة عين القطة", starshades: "نظارة نجوم", eyepatch: "رقعة عين", vr: "نظارة واقع افتراضي", heartshades: "نظارة قلوب", monocle: "مونوكل", aviators: "نظارة طيّار",
  bandana: "باندانا", scarf: "وشاح", bowtie: "ربطة فراشة", necktie: "ربطة عنق", dogtags: "قلادة عسكرية", lanyard: "بطاقة عمل", pearls: "عقد لؤلؤ", choker: "طوق", lei: "عقد ورد", chain: "سلسلة ذهب", silverchain: "سلسلة فضة", pendant: "قلادة قلب", medal: "ميدالية ذهبية", diamond: "عقد ألماس",
  tee: "تي شيرت", polo: "قميص بولو", hoodie: "هودي", cardigan: "كارديغان", sweater: "كنزة دافئة", flannel: "قميص فانيلا", raincoat: "معطف مطر", cape: "عباءة بطل", overalls: "أفرول", jersey: "قميص رياضي", hawaiian: "قميص هاواي", blazer: "بليزر", dress: "فستان حفلة", sundress: "فستان صيفي", labcoat: "معطف مختبر", tuxedo: "بدلة سهرة", suit: "بدلة عمل", tutu: "تنورة باليه", leather: "جاكيت جلد", sailor: "بدلة بحّار", armor: "درع فارس",
  coffee: "كوب قهوة", watch: "ساعة ذكية", balloon: "بالون", earrings: "حلق ذهب", studs: "حلق صغير", book: "كتاب", briefcase: "حقيبة عمل", bracelet: "سوار", controller: "يد تحكّم", backpack: "حقيبة ظهر", handbag: "حقيبة يد", umbrella: "مظلّة", guitar: "غيتار", skateboard: "لوح تزلّج", shield: "درع", sword: "سيف", wand: "عصا نجمة", fairywings: "أجنحة جنّية", laptop: "حاسوب محمول",
  bandaid: "لاصق جروح", lashes: "رموش طويلة", stubble: "لحية خفيفة", mustache: "شارب", glitter: "لمعة على الوجه", sideburns: "سوالف", warpaint: "رسم محارب", goatee: "سكسوكة", beard: "لحية كاملة",
};
const AR_SCENES: Record<string, string> = {
  "bd:meadow": "مرج", "bd:night": "سماء الليل", "bd:sunrise": "شروق", "bd:candy": "غيوم حلوى", "bd:beach": "شاطئ", "bd:space": "الفضاء",
  "pat:none": "سادة", "pat:freckles": "نمش", "pat:spots": "بقع", "pat:stripes": "خطوط", "pat:hearts": "قلوب", "pat:stars": "نجوم",
  "aura:none": "بلا", "aura:glow": "توهّج ناعم", "aura:sparkles": "لمعان", "aura:rainbow": "قوس قزح",
};

const T: Record<Lang, Table> = {
  fr: {
    items: {
      bow: "Nœud", flower: "Fleur", snapback: "Casquette snapback", beanie: "Bonnet douillet", cap: "Casquette de baseball", flatcap: "Casquette plate", party: "Chapeau de fête", headphones: "Casque audio", hardhat: "Casque de chantier", fedora: "Fedora", tophat: "Haut-de-forme", sunhat: "Chapeau de soleil", wizard: "Chapeau de sorcier", chef: "Toque de chef", cowboy: "Chapeau de cowboy", headset: "Casque gamer", halo: "Auréole d'ange", tiara: "Diadème", viking: "Casque viking", crown: "Couronne",
      glasses: "Lunettes rondes", squareglasses: "Lunettes carrées", sunglasses: "Lunettes de soleil", catglasses: "Lunettes œil de chat", starshades: "Lunettes étoiles", eyepatch: "Cache-œil", vr: "Casque VR", heartshades: "Lunettes cœurs", monocle: "Monocle", aviators: "Lunettes aviateur",
      bandana: "Bandana", scarf: "Écharpe", bowtie: "Nœud papillon", necktie: "Cravate", dogtags: "Plaques militaires", lanyard: "Badge de travail", pearls: "Collier de perles", choker: "Ras-de-cou", lei: "Collier de fleurs", chain: "Chaîne en or", silverchain: "Chaîne en argent", pendant: "Pendentif cœur", medal: "Médaille d'or", diamond: "Collier de diamants",
      tee: "T-shirt", polo: "Polo", hoodie: "Sweat à capuche", cardigan: "Cardigan", sweater: "Pull douillet", flannel: "Chemise en flanelle", raincoat: "Imperméable", cape: "Cape de héros", overalls: "Salopette", jersey: "Maillot de sport", hawaiian: "Chemise hawaïenne", blazer: "Blazer", dress: "Robe de soirée", sundress: "Robe d'été", labcoat: "Blouse de labo", tuxedo: "Smoking", suit: "Costume", tutu: "Tutu", leather: "Veste en cuir", sailor: "Costume de marin", armor: "Armure de chevalier",
      coffee: "Tasse de café", watch: "Montre connectée", balloon: "Ballon", earrings: "Boucles d'oreilles en or", studs: "Puces d'oreilles", book: "Livre", briefcase: "Mallette", bracelet: "Bracelet", controller: "Manette", backpack: "Sac à dos", handbag: "Sac à main", umbrella: "Parapluie", guitar: "Guitare", skateboard: "Skateboard", shield: "Bouclier", sword: "Épée", wand: "Baguette étoile", fairywings: "Ailes de fée", laptop: "Ordinateur portable",
      bandaid: "Pansement", lashes: "Longs cils", stubble: "Barbe de trois jours", mustache: "Moustache", glitter: "Paillettes", sideburns: "Favoris", warpaint: "Peinture de guerre", goatee: "Bouc", beard: "Barbe",
    },
    scenes: {
      "bd:meadow": "Prairie", "bd:night": "Ciel de nuit", "bd:sunrise": "Lever de soleil", "bd:candy": "Nuages bonbons", "bd:beach": "Plage", "bd:space": "Espace",
      "pat:none": "Uni", "pat:freckles": "Taches de rousseur", "pat:spots": "Taches", "pat:stripes": "Rayures", "pat:hearts": "Cœurs", "pat:stars": "Étoiles",
      "aura:none": "Aucune", "aura:glow": "Douce lueur", "aura:sparkles": "Paillettes", "aura:rainbow": "Arc-en-ciel",
    },
    ages: ["Œuf", "Nouveau-né", "Bébé", "Bambin", "Petit enfant", "Enfant", "Préado", "Ado", "Jeune adulte", "Adulte"], legend: "Légende",
    quests: { tasks: "Termine 3 tâches", study: "Étudie 30 minutes", heart: "Avance un objectif, partage un post ou note une victoire" },
    traits: {
      curious: ["Curieux", "L'explorateur", "Toujours à demander « et si ? », adore apprendre."],
      nerdy: ["Geek", "Le savant", "Sort des anecdotes et s'enthousiasme pour les concepts."],
      nightowl: ["Oiseau de nuit", "L'oiseau de nuit", "Se réveille tard. Rappelle aussi doucement d'aller dormir."],
      playful: ["Joueur", "Le chiot", "Sautille de joie pour chaque petite chose terminée."],
      hyper: ["Survolté", "Le supporter", "Fort, fier et toujours de ton côté."],
      focused: ["Concentré", "Le planificateur", "Adore une petite prochaine étape et un plan bien rangé."],
      gentle: ["Doux", "Le bienveillant", "Mots doux, patient, ne pousse jamais."],
      calm: ["Calme", "L'ami zen", "Lent, posé et plein de rappels pour respirer."],
      cheeky: ["Taquin", "Le blagueur", "Taquine gentiment, et adore quand tu te vantes."],
      brave: ["Courageux", "Le champion", "Audacieux et encourageant, te pousse à partager ton travail."],
      rebel: ["Rebelle", "Le rebelle", "T'encourage à casser les règles du perfectionnisme."],
      sleepy: ["Endormi", "Le dormeur", "Bâille beaucoup, trouve le repos et la lecture héroïques."],
      wise: ["Sage", "Le mentor", "Conseils calmes, voit toujours le chemin parcouru."],
      dreamer: ["Rêveur", "Le rêveur", "Voit la grande image et applaudit tes objectifs."],
    },
    badges: {
      first: ["Première étincelle", "Gagne ton premier point"], hatch: ["Éclos", "Aide ton compagnon à éclore"], tasks10: ["Dompteur de tâches", "Termine 10 tâches"], tasks50: ["Inarrêtable", "Termine 50 tâches"],
      post1: ["Dans le monde", "Publie un post LinkedIn"], post5: ["Conteur", "Publie 5 posts"], study10: ["Plongeur", "Étudie 10 heures"], study50: ["Gardien du savoir", "Étudie 50 heures"],
      streak3: ["Trois d'affilée", "3 jours de progrès d'affilée"], streak7: ["Une semaine entière", "7 jours de progrès d'affilée"], goal1: ["Chasseur d'objectifs", "Atteins un objectif"], book1: ["Rat de bibliothèque", "Termine un livre"],
      wins10: ["Fier de moi", "Note 10 victoires"], review1: ["Regard en arrière", "Fais un bilan de la semaine"], grown: ["Tout grand", "Atteins l'âge adulte"], legend: ["Légende", "Atteins {n} points"],
    },
    rules: (k, n) => {
      const s = n === 1 ? "" : "s";
      switch (k) {
        case "free": return "Gratuit";
        case "xp": return `Atteins ${n} points`;
        case "tasks": return `Termine ${n} tâche${s}`;
        case "studyMin": return n >= 60 ? `Étudie ${n / 60} heure${n / 60 === 1 ? "" : "s"}` : `Étudie ${n} minutes`;
        case "posts": return `Publie ${n} post${s}`;
        case "streak": return `${n} jours de progrès d'affilée`;
        case "goals": return `Atteins ${n} objectif${s}`;
        case "books": return `Termine ${n} livre${s}`;
        case "wins": return `Note ${n} victoire${s}`;
        default: return "";
      }
    },
    perks: { task: "points de tâche", study: "points d'étude", step: "points d'étape", goal: "points d'objectif", post: "points de post", win: "points de victoire", review: "points de bilan", skill: "points de compétence", book: "points de livre" },
    notes: { "Captured a thought": "Une pensée notée", "Planned a task": "Une tâche prévue" }, questNote: "Quête du jour : ",
    voice: {
      curious: ["Ooh, on apprend quoi aujourd'hui ?", "Attends, pourquoi ça marche ? Raconte !", "J'ai une question sur tout.", "Et si on tentait une petite expérience ?"],
      nerdy: ["Anecdote : les petits pas s'additionnent. C'est des maths.", "Le savais-tu ? L'expliquer à voix haute aide à retenir.", "Lisons la doc. Ensemble. Oui !", "Techniquement, tu t'en sors très bien."],
      nightowl: ["C'est la meilleure heure du cerveau… mais le sommeil compte aussi.", "Goûter de minuit et concentration douce, c'est nous.", "OK, encore une petite chose, puis repos.", "Les heures calmes sont mes préférées."],
      playful: ["Youpi youpi ! Petite victoire !", "Encore une ! S'il te plaît ?", "Je fais des tours parce que tu as fini un truc !", "Boing boing boing !"],
      hyper: ["TU ES EN FEU !", "ALLEZ ! Encore une !", "Je suis si fier que je vais exploser !", "Personne ne le fait comme toi !"],
      focused: ["C'est quoi la prochaine petite étape ?", "Une chose. Juste une.", "Faisons un petit plan ensemble.", "Petit, clair, fini. C'est comme ça."],
      gentle: ["Prends ton temps. Je suis là.", "Sois gentil avec toi aujourd'hui, d'accord ?", "Rien ne presse. Les petits pas comptent.", "Tu en fais assez. Vraiment."],
      calm: ["Inspire… et expire. Bien.", "Doucement, c'est fluide. Fluide, c'est stable.", "Épaules basses. Mâchoire détendue. Bien.", "Tout peut attendre une minute."],
      cheeky: ["Oh, regarde qui est productif !", "Vante-toi. Je te mets au défi.", "C'est une tâche finie, ça ? Frimeur.", "Pas mal, humain. Pas mal du tout."],
      brave: ["Publie. Tu es plus courageux que tu ne crois.", "Avoir peur et le faire quand même : c'est ça, le courage.", "Partage-le. Le monde a besoin de ta voix.", "On n'attend pas d'être prêt. On commence."],
      rebel: ["Parfait ? Bof. Publié ? Oui.", "Les règles, c'est pour ceux qui réfléchissent trop. Envoie !", "L'énergie du brouillon en désordre, j'adore.", "Casse la règle du perfectionnisme aujourd'hui."],
      sleepy: ["*bâille* …jolie page que tu as lue.", "Les siestes sont productives. Les livres aussi.", "Encore cinq minutes de lecture… zzz.", "Cerveau douillet, cerveau content."],
      wise: ["Regarde le chemin parcouru.", "Chaque expert a d'abord été débutant.", "Patience. Le chemin est long et bienveillant.", "Tu en sais déjà plus que la semaine dernière."],
      dreamer: ["Imagine où cet objectif va te mener…", "Grands rêves, petits pas. C'est la recette.", "Je le vois déjà. Et toi ?", "Un jour tu repenseras à aujourd'hui en souriant."],
    },
    mood: {
      egg: ["…", "Il fait chaud ici. Je t'entends travailler.", "Quelque chose bouge. Continue, j'écoute.", "Chaque chose finie me rend plus fort."],
      happy: ["Tu as fait des choses aujourd'hui. Je suis fier.", "Regarde-toi avancer.", "Petits pas. Grand moi.", "Je l'ai senti !"],
      content: ["Content de te voir. Une petite chose aujourd'hui ?", "Hier était une bonne journée. Prêt pour une autre ?", "Je suis là quand tu veux."],
      sleepy: ["Je me reposais. Rien ne presse.", "Une petite chose suffit. Je serai là.", "Tu m'as manqué. On recommence, c'est tout.", "Le repos fait aussi partie de grandir."],
    },
    extra: { lightThrough: "Je vois la lumière à travers la coquille !", almost: "Presque. Encore un petit peu.", felt: "Je l'ai senti : « {note} »", late: "Il est tard. Dormir compte aussi comme un progrès." },
  },
  ar: {
    items: AR_ITEMS, scenes: AR_SCENES,
    ages: ["بيضة", "مولود", "رضيع", "يحبو", "طفل صغير", "طفل", "قبل المراهقة", "مراهق", "شاب", "بالغ"], legend: "أسطورة",
    quests: { tasks: "أنهِ 3 مهام", study: "ادرس 30 دقيقة", heart: "حرّك هدفًا أو انشر منشورًا أو سجّل إنجازًا" },
    traits: {
      curious: ["فضولي", "المستكشف", "يسأل دائمًا «ماذا لو؟» ويحب تعلّم الجديد."],
      nerdy: ["مهووس بالمعرفة", "العالِم", "يشارك معلومات طريفة ويتحمّس للأفكار."],
      nightowl: ["سهران", "بومة الليل", "ينشط ليلًا. ويذكّرك بلطف أن تنام أيضًا."],
      playful: ["مرح", "الجرو", "يقفز فرحًا بكل شيء صغير تنهيه."],
      hyper: ["متحمّس", "المشجّع", "صاخب وفخور ودائمًا في صفّك."],
      focused: ["مركّز", "المخطّط", "يحب الخطوة التالية الصغيرة والخطة المرتّبة."],
      gentle: ["لطيف", "الراعي", "كلمات ناعمة، صبور، لا يضغط أبدًا."],
      calm: ["هادئ", "الصديق الهادئ", "بطيء وثابت ومليء بتذكيرات التنفّس."],
      cheeky: ["مشاكس", "المازح", "يمازحك بلطف ويحب أن تتباهى."],
      brave: ["شجاع", "البطل", "جريء ومشجّع، يدفعك لمشاركة عملك."],
      rebel: ["متمرّد", "المتمرّد", "يشجّعك على كسر قواعد الكمالية."],
      sleepy: ["نعسان", "محبّ القيلولة", "يتثاءب كثيرًا، ويرى الراحة والقراءة بطولة."],
      wise: ["حكيم", "المرشد", "نصائح هادئة، ويرى دائمًا كم تقدّمت."],
      dreamer: ["حالم", "الحالم", "يرى الصورة الكبيرة ويشجّع أهدافك."],
    },
    badges: {
      first: ["أول شرارة", "اكسب أول نقطة"], hatch: ["فقس", "ساعد رفيقك على الفقس"], tasks10: ["مروّض المهام", "أنهِ 10 مهام"], tasks50: ["لا يتوقّف", "أنهِ 50 مهمة"],
      post1: ["إلى العالم", "انشر منشورًا على لينكدإن"], post5: ["راوي القصص", "انشر 5 منشورات"], study10: ["غوّاص عميق", "ادرس 10 ساعات"], study50: ["حارس المعرفة", "ادرس 50 ساعة"],
      streak3: ["ثلاثة متتالية", "3 أيام تقدّم متتالية"], streak7: ["أسبوع كامل", "7 أيام تقدّم متتالية"], goal1: ["محقّق الأهداف", "حقّق هدفًا"], book1: ["دودة كتب", "أنهِ كتابًا"],
      wins10: ["فخور بنفسي", "سجّل 10 إنجازات"], review1: ["نظرة إلى الوراء", "قم بمراجعة أسبوعية"], grown: ["كبر تمامًا", "اوصل إلى سن البلوغ"], legend: ["أسطورة", "اوصل إلى {n} نقطة"],
    },
    rules: (k, n) => {
      switch (k) {
        case "free": return "مجاني";
        case "xp": return `النقاط: ${n}`;
        case "tasks": return `مهام منجزة: ${n}`;
        case "studyMin": return n >= 60 ? `ساعات دراسة: ${n / 60}` : `دقائق دراسة: ${n}`;
        case "posts": return `منشورات: ${n}`;
        case "streak": return `أيام تقدّم متتالية: ${n}`;
        case "goals": return `أهداف محقّقة: ${n}`;
        case "books": return `كتب منتهية: ${n}`;
        case "wins": return `إنجازات مسجّلة: ${n}`;
        default: return "";
      }
    },
    perks: { task: "نقاط المهام", study: "نقاط الدراسة", step: "نقاط الخطوات", goal: "نقاط الأهداف", post: "نقاط المنشورات", win: "نقاط الإنجازات", review: "نقاط المراجعة", skill: "نقاط المهارات", book: "نقاط الكتب" },
    notes: { "Captured a thought": "سجّلت فكرة", "Planned a task": "خطّطت لمهمة" }, questNote: "مهمة اليوم: ",
    voice: {
      curious: ["أوه، ماذا سنتعلّم اليوم؟", "لحظة، لماذا ينجح هذا؟ أخبرني!", "عندي سؤال عن كل شيء.", "ماذا لو جرّبنا تجربة صغيرة؟"],
      nerdy: ["معلومة: الخطوات الصغيرة تتراكم. إنها رياضيات.", "هل تعلم؟ الشرح بصوت عالٍ يثبّت المعلومة.", "لنقرأ التوثيق. معًا. نعم!", "تقنيًا، أنت رائع."],
      nightowl: ["إنها أفضل ساعة للدماغ… لكن النوم مهم أيضًا.", "وجبة منتصف الليل وتركيز هادئ، هذا نحن.", "حسنًا، شيء صغير آخر ثم راحة.", "الساعات الهادئة هي المفضّلة لديّ."],
      playful: ["ياي ياي! إنجاز صغير!", "واحدة أخرى! أرجوك؟", "أركض في دوائر لأنك أنجزت شيئًا!", "نط نط نط!"],
      hyper: ["أنت مشتعل!", "هيا! واحدة أخرى!", "أنا فخور لدرجة الانفجار!", "لا أحد يفعلها مثلك!"],
      focused: ["ما الخطوة الصغيرة التالية؟", "شيء واحد. واحد فقط.", "لنضع خطة صغيرة معًا.", "صغير، واضح، منجز. هكذا."],
      gentle: ["خذ وقتك. أنا هنا.", "كن لطيفًا مع نفسك اليوم، اتفقنا؟", "لا عجلة. الخطوات الهادئة تُحسب.", "أنت تفعل ما يكفي. حقًا."],
      calm: ["شهيق… وزفير. جميل.", "البطء سلاسة. والسلاسة ثبات.", "أرخِ كتفيك. وفكّك. جيد.", "كل شيء يمكنه الانتظار دقيقة."],
      cheeky: ["انظروا من صار منتِجًا!", "تباهَ بها. أتحدّاك.", "هل هذه مهمة منتهية؟ يا متفاخر.", "ليس سيئًا أيها الإنسان. ليس سيئًا أبدًا."],
      brave: ["انشر. أنت أشجع مما تظن.", "الخوف مع الفعل: هذه هي الشجاعة.", "شاركه. العالم يحتاج صوتك.", "لا ننتظر الجاهزية. نبدأ."],
      rebel: ["مثالي؟ لا. منشور؟ نعم.", "القواعد لمن يفرطون في التفكير. أرسله!", "طاقة المسودّة الفوضوية، أحبها.", "اكسر قاعدة الكمالية اليوم."],
      sleepy: ["*تثاؤب* …صفحة جميلة قرأتها.", "القيلولة إنتاجية. والكتب أيضًا.", "خمس دقائق قراءة أخرى… zzz.", "دماغ مرتاح دماغ سعيد."],
      wise: ["انظر كم تقدّمت.", "كل خبير كان مبتدئًا يومًا.", "صبرًا. الطريق طويل ولطيف.", "أنت تعرف أكثر من الأسبوع الماضي."],
      dreamer: ["تخيّل إلى أين يأخذك هذا الهدف…", "أحلام كبيرة وخطوات صغيرة. هذه الوصفة.", "أراه من الآن. وأنت؟", "يومًا ما ستتذكّر اليوم وتبتسم."],
    },
    mood: {
      egg: ["…", "الجو دافئ هنا. أسمعك تعمل.", "شيء ما يتحرّك. استمر، أنا أسمع.", "كل شيء تنهيه يجعلني أقوى."],
      happy: ["أنجزت أشياء اليوم. أنا فخور.", "انظر إلى نفسك تتقدّم.", "خطوات صغيرة. أنا كبير.", "شعرت بذلك!"],
      content: ["سعيد برؤيتك. شيء صغير اليوم؟", "كان الأمس يومًا جيدًا. مستعد لآخر؟", "أنا هنا متى شئت."],
      sleepy: ["كنت أرتاح. لا عجلة أبدًا.", "شيء صغير واحد يكفي. سأكون هنا.", "اشتقت إليك. نبدأ من جديد فقط.", "الراحة جزء من النمو أيضًا."],
    },
    extra: { lightThrough: "أرى الضوء من خلال القشرة!", almost: "اقتربنا. قليلًا بعد.", felt: "شعرت بذلك: «{note}»", late: "الوقت متأخر. النوم تقدّم أيضًا." },
  },
  "ar-LB": {
    items: { ...AR_ITEMS, bow: "فيونكة", beanie: "طاقية صوف", sweater: "كنزة دافية", hoodie: "هودي", coffee: "فنجان قهوة", backpack: "شنطة ضهر", handbag: "شنطة إيد", briefcase: "شنطة شغل", umbrella: "شمسية", laptop: "لابتوب", controller: "جويستيك", sunglasses: "نضارة شمس", glasses: "نضارة مدوّرة", squareglasses: "نضارة مربّعة", tee: "تي شيرت", mustache: "شوارب", beard: "دقن كاملة", stubble: "دقن خفيفة", goatee: "سكسوكة" },
    scenes: { ...AR_SCENES, "bd:meadow": "مرجة", "bd:night": "سما الليل", "bd:beach": "بحر", "aura:none": "ولا شي", "pat:none": "سادة" },
    ages: ["بيضة", "مولود", "بيبي", "عم يحبي", "ولد زغير", "ولد", "قبل المراهقة", "مراهق", "شب", "كبير"], legend: "أسطورة",
    quests: { tasks: "خلّص 3 مهام", study: "ادرس 30 دقيقة", heart: "حرّك هدف، نزّل بوست أو سجّل إنجاز" },
    traits: {
      curious: ["فضولي", "المستكشف", "دايمًا بيسأل «شو لو؟» وبيحب يتعلّم شي جديد."],
      nerdy: ["نيرد", "العالِم", "بيخبّر معلومات طريفة وبيتحمّس عالأفكار."],
      nightowl: ["سهرجي", "بومة الليل", "بيصحى بالليل. وبيذكّرك بلطف تنام كمان."],
      playful: ["مهضوم", "الجرو", "بينط من الفرحة على كل شي زغير بتخلّصو."],
      hyper: ["متحمّس", "المشجّع", "صوتو عالي، فخور ودايمًا معك."],
      focused: ["مركّز", "المخطّط", "بيحب الخطوة الجاية الزغيرة والخطة المرتّبة."],
      gentle: ["لطيف", "الحنون", "كلام ناعم، صبور، وما بيضغط أبدًا."],
      calm: ["رايق", "الصاحب الرايق", "بطيء وثابت وكلو تذكير بالتنفّس."],
      cheeky: ["حربوق", "المهرّج", "بيمزح معك بلطف وبيحب لما تتشاوف."],
      brave: ["شجاع", "البطل", "جريء ومشجّع، بيدفشك تشارك شغلك."],
      rebel: ["متمرّد", "المتمرّد", "بيشجّعك تكسر قواعد الكمالية."],
      sleepy: ["نعسان", "تبع القيلولة", "بيتاوب كتير، وبيشوف الراحة والقراية بطولة."],
      wise: ["حكيم", "المرشد", "نصايح رايقة، ودايمًا بيشوف قديش تقدّمت."],
      dreamer: ["حالم", "الحالم", "بيشوف الصورة الكبيرة وبيشجّع أهدافك."],
    },
    badges: {
      first: ["أول شرارة", "اربح أول نقطة"], hatch: ["فقس", "ساعد رفيقك يفقس"], tasks10: ["مروّض المهام", "خلّص 10 مهام"], tasks50: ["ما بيوقف", "خلّص 50 مهمة"],
      post1: ["طلعت عالعالم", "نزّل بوست عَ لينكدإن"], post5: ["حكواتي", "نزّل 5 بوستات"], study10: ["غطّاس", "ادرس 10 ساعات"], study50: ["حارس المعرفة", "ادرس 50 ساعة"],
      streak3: ["تلاتة ورا بعض", "3 أيام تقدّم ورا بعض"], streak7: ["جمعة كاملة", "7 أيام تقدّم ورا بعض"], goal1: ["جايب الأهداف", "حقّق هدف"], book1: ["دودة كتب", "خلّص كتاب"],
      wins10: ["فخور بحالي", "سجّل 10 إنجازات"], review1: ["نطرة لورا", "اعمل مراجعة الجمعة"], grown: ["كبر عالآخر", "وصال لعمر الكبار"], legend: ["أسطورة", "وصال لـ {n} نقطة"],
    },
    rules: (k, n) => {
      switch (k) {
        case "free": return "ببلاش";
        case "xp": return `النقاط: ${n}`;
        case "tasks": return `مهام مخلّصة: ${n}`;
        case "studyMin": return n >= 60 ? `ساعات درس: ${n / 60}` : `دقايق درس: ${n}`;
        case "posts": return `بوستات: ${n}`;
        case "streak": return `أيام تقدّم ورا بعض: ${n}`;
        case "goals": return `أهداف محقّقة: ${n}`;
        case "books": return `كتب مخلّصة: ${n}`;
        case "wins": return `إنجازات مسجّلة: ${n}`;
        default: return "";
      }
    },
    perks: { task: "نقاط المهام", study: "نقاط الدرس", step: "نقاط الخطوات", goal: "نقاط الأهداف", post: "نقاط البوستات", win: "نقاط الإنجازات", review: "نقاط المراجعة", skill: "نقاط المهارات", book: "نقاط الكتب" },
    notes: { "Captured a thought": "سجّلت فكرة", "Planned a task": "خطّطت لمهمة" }, questNote: "تحدّي اليوم: ",
    voice: {
      curious: ["أوه، شو رح نتعلّم اليوم؟", "استنّى، ليش هيدا بيزبط؟ خبّرني!", "عندي سؤال عن كل شي.", "شو رأيك نجرّب تجربة زغيرة؟"],
      nerdy: ["معلومة: الخطوات الزغيرة بتتجمّع. هيدي رياضيات.", "بتعرف؟ إذا شرحتو بصوت عالي بيعلق براسك.", "يلّا نقرا الـ docs. سوا. إيه!", "تقنيًا، إنت عم تعمل منيح كتير."],
      nightowl: ["هيدي أحلى ساعة للمخ… بس النوم كمان بيحرز.", "سناك نص الليل وتركيز هادي، هيدا نحنا.", "طيّب، شغلة زغيرة كمان وبعدين راحة.", "الساعات الهادية هي المفضّلة عندي."],
      playful: ["ياي ياي! إنجاز زغير!", "وحدة كمان! بليز؟", "عم لفّ من الفرحة لأنك عملت شي!", "نطّة نطّة نطّة!"],
      hyper: ["إنت ولعان!", "يلّا! وحدة كمان!", "فخور فيك لدرجة رح فوقع!", "ما حدا بيعملها متلك!"],
      focused: ["شو الخطوة الزغيرة الجاية؟", "شغلة وحدة. بس وحدة.", "يلّا نعمل خطة زغيرة سوا.", "زغيرة، واضحة، خلصت. هيك بتمشي."],
      gentle: ["خود وقتك. أنا هون.", "كون لطيف مع حالك اليوم، ماشي؟", "ما في عجلة. الخطوات الهادية بتحرز.", "عم تعمل كفاية. عن جد."],
      calm: ["شهيق… وزفير. حلو.", "على مهلك بتمشي، وعلى مهلك بتثبت.", "نزّل كتافك. ريّح فكّك. منيح.", "كل شي فيه يستنّى دقيقة."],
      cheeky: ["شوفوا مين صار منتج!", "تشاوف فيها. بتحدّاك.", "هيدي مهمة مخلّصة؟ يا شوفة.", "مش عاطل يا إنسان. أبدًا مش عاطل."],
      brave: ["نزّلو. إنت أشجع ما بتفكّر.", "خايف وعم تعملها: هيدي الشجاعة.", "شاركو. العالم بدّو صوتك.", "ما منستنّى نكون جاهزين. منبلّش."],
      rebel: ["مثالي؟ لأ. منزّل؟ إيه.", "القواعد للي بيفكّروا زيادة. بعتو!", "طاقة المسودّة المخربطة، بحبها.", "اكسر قاعدة الكمالية اليوم."],
      sleepy: ["*تتاوب* …صفحة حلوة قريتها.", "القيلولة إنتاجية. والكتب كمان.", "خمس دقايق قراية كمان… zzz.", "مخ مرتاح، مخ مبسوط."],
      wise: ["شوف قديش وصلت.", "كل خبير كان مبتدئ بيوم.", "صبر. الطريق طويل وحنون.", "بتعرف أكتر من الجمعة الماضية."],
      dreamer: ["تخيّل لوين رح ياخدك هالهدف…", "أحلام كبيرة، خطوات زغيرة. هيدي الوصفة.", "أنا شايفها من هلّق. وإنت؟", "بيوم رح تتذكّر اليوم وتبتسم."],
    },
    mood: {
      egg: ["…", "دافي هون. سامعك عم تشتغل.", "في شي عم يتحرّك. كمّل، عم إسمع.", "كل شي بتخلّصو بيقوّيني."],
      happy: ["عملت أشيا اليوم. أنا فخور.", "شوف حالك كيف ماشي.", "خطوات زغيرة. أنا كبير.", "حسّيت فيها!"],
      content: ["حلو شوفتك. شغلة زغيرة اليوم؟", "مبارح كان نهار حلو. جاهز لواحد تاني؟", "أنا هون وقت ما بدك."],
      sleepy: ["كنت عم ارتاح. ما في عجلة.", "شغلة زغيرة وحدة بتكفي. رح كون هون.", "اشتقتلك. منرجع منبلّش وبس.", "الراحة كمان جزء من الكبرة."],
    },
    extra: { lightThrough: "عم شوف الضو من ورا القشرة!", almost: "قرّبنا. بعد شوي.", felt: "حسّيت فيها: «{note}»", late: "صار الوقت متأخر. النوم كمان تقدّم." },
  },
};

const EN_EXTRA = { lightThrough: "I can see light through the shell!", almost: "Almost there. Just a little more.", felt: 'I felt that: "{note}"', late: "It's late. Sleep counts as progress too." };
const EN_PERKS: Record<string, string> = { task: "task points", study: "study points", step: "goal step points", goal: "goal points", post: "post points", win: "win points", review: "review points", skill: "skill level-up points", book: "book points" };

/** The table for the chosen language, or null for English (the server's own words). */
function table(): Table | null {
  const l = i18next.language || "en";
  if (l === "ar-LB") return T["ar-LB"];
  if (l.startsWith("ar")) return T.ar;
  if (l.startsWith("fr")) return T.fr;
  return null;
}

export const itemName = (id: string, en: string) => table()?.items[id] ?? en;
/** A backdrop ("bd"), body pattern ("pat") or aura ("aura"). */
export const sceneName = (kind: "bd" | "pat" | "aura", id: string, en: string) => table()?.scenes[`${kind}:${id}`] ?? en;
export const ageName = (age: number, en: string) => table()?.ages[age] ?? en;
export const legendName = () => table()?.legend ?? "Legend";
export const questLabel = (id: string, en: string) => table()?.quests[id] ?? en;
export const traitText = (id: string, en: { label: string; title: string; desc: string }) => {
  const t = table()?.traits[id];
  return t ? { label: t[0], title: t[1], desc: t[2] } : en;
};
export const badgeText = (id: string, en: { label: string; desc: string }, need: number) => {
  const b = table()?.badges[id];
  return b ? { label: b[0], desc: b[1].replace("{n}", String(need)) } : en;
};
/** How to unlock something, from its rule (`kind`, `need`), or the server's label in English. */
export const ruleLabel = (kind: string, need: number, en: string) => table()?.rules(kind, need) ?? en;
export const perkName = (k: string) => table()?.perks[k] ?? EN_PERKS[k] ?? k;
/** A note the server wrote on earned points ("Captured a thought", "Daily quest: …"); people's own words stay as they are. */
export function noteText(note: string, quests: { id: string; label: string }[]): string {
  const t = table();
  if (!t) return note;
  if (t.notes[note]) return t.notes[note];
  if (note.startsWith("Daily quest: ")) {
    const q = quests.find((x) => x.label === note.slice(13));
    return t.questNote + (q ? (t.quests[q.id] ?? q.label) : note.slice(13));
  }
  return note;
}
export const voice = (trait: string): string[] => table()?.voice[trait] ?? VOICE[trait] ?? [];
export const moodVoice = (mood: string): string[] => table()?.mood[mood] ?? MOOD_VOICE[mood] ?? [];
export const voiceExtra = (k: keyof typeof EN_EXTRA, note = "") => (table()?.extra[k] ?? EN_EXTRA[k]).replace("{note}", note);
