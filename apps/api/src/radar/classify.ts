import type { EDUCATION_LEVELS, EMPLOYMENT_TYPES, SENIORITIES, WORK_MODES } from "@hyperfocus/shared";
import type { JobPostingDTO } from "./dto.ts";

type WorkMode = (typeof WORK_MODES)[number];
type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
type Seniority = (typeof SENIORITIES)[number];
type EducationLevel = (typeof EDUCATION_LEVELS)[number];

// The classifier (P6-15): from a posting's own fields and its text, what kind of job it is: work mode, employment type,
// seniority, education, years of experience, salary, visa sponsorship. Plain rules (English, with the German words
// Arbeitnow postings use); unknown stays unknown (null) rather than guessed. The title counts more than the text:
// "Senior …" in a title is the job; "work with senior engineers" in the text isn't.

export type Classified = {
  workMode: WorkMode | null;
  employmentType: EmploymentType | null;
  seniority: Seniority | null;
  educationLevel: EducationLevel | null;
  yearsMin: number | null;
  salary: { min: number | null; max: number | null; currency: string; period: "year" | "month" | "hour" | "" } | null;
  visaSponsorship: boolean | null;
};

const has = (re: RegExp, ...texts: string[]) => texts.some((t) => re.test(t));

function workMode(d: JobPostingDTO, text: string): WorkMode | null {
  const hint = `${d.workModeHint} ${d.locationText}`.toLowerCase();
  if (/hybrid/.test(hint) || /\bhybrid\b/i.test(d.title)) return "hybrid";
  if (/on-?site|in[- ]office/.test(hint)) return "onsite";
  if (d.remote === true || /remote|anywhere|home ?office|work from home/.test(hint) || /\bremote\b/i.test(d.title)) return "remote";
  if (/\bhybrid (role|position|work|model)|\b\d+ days? (a|per) week in (the )?office/i.test(text)) return "hybrid";
  if (/\bfully remote\b|\b100% remote\b|\bremote[- ]first\b/i.test(text)) return "remote";
  if (d.remote === false && d.locationText) return "onsite";
  return null;
}

function employmentType(d: JobPostingDTO): EmploymentType | null {
  const own = `${d.employmentHint} ${d.tags.join(" ")}`.toLowerCase();
  const title = d.title.toLowerCase();
  if (/\bintern(ship)?\b|\bpraktik(um|ant)/.test(title) || /\bintern(ship)?\b|praktikum/.test(own)) return "internship";
  if (/working student|werkstudent|student (job|assistant)|\bstudent\b/.test(title) || /werkstudent|working student/.test(own)) return "student_job";
  if (/apprentice|ausbildung|trainee/.test(title) || /apprentice|ausbildung/.test(own)) return "apprenticeship";
  if (/volunteer|ehrenamt/.test(title + own)) return "volunteer";
  if (/freelance|freiberuf/.test(title + own)) return "freelance";
  if (/contract(or)?\b|short term|temporary|fixed[- ]term|befristet/.test(title + own)) return "contract";
  if (/part[- ]?time|teilzeit/.test(title + own)) return "part_time";
  if (/full[- ]?time|vollzeit|permanent|festanstellung/.test(own)) return "full_time";
  return null;
}

function seniority(d: JobPostingDTO, years: number | null, type: EmploymentType | null): Seniority | null {
  const t = d.title.toLowerCase();
  if (type === "internship") return "intern";
  if (type === "student_job") return "student";
  if (/\b(head of|director|vp|vice president|chief|principal|staff|lead|manager|partner)\b/.test(t) && !/\bassistant\b/.test(t)) return /\bmanager\b/.test(t) && !/\b(senior|lead|head)\b/.test(t) ? "mid" : "lead";
  if (/\b(senior|sr\.?)\b/.test(t)) return "senior";
  if (/\b(junior|jr\.?)\b/.test(t)) return "junior";
  if (/\b(graduate|entry[- ]level|associate|trainee|einsteiger)\b/.test(t)) return "entry";
  if (/\bmid[- ]?level\b|\bmid\b/.test(`${t} ${d.tags.join(" ").toLowerCase()} ${d.employmentHint.toLowerCase()}`)) return "mid";
  if (years !== null) return years >= 6 ? "senior" : years >= 3 ? "mid" : years >= 1 ? "junior" : "entry";
  return null;
}

function educationLevel(text: string): EducationLevel | null {
  if (has(/\b(ph\.?d|doctorate|doctoral)\b/i, text)) return "doctorate";
  if (has(/\b(master'?s|msc|m\.sc|mba|ma degree)\b/i, text)) return "master";
  if (has(/\b(bachelor'?s|bsc|b\.sc|ba degree|undergraduate degree|university degree|degree in)\b/i, text)) return "bachelor";
  if (has(/\b(associate'?s degree)\b/i, text)) return "associate";
  if (has(/\b(vocational|apprenticeship completed|abgeschlossene ausbildung)\b/i, text)) return "vocational";
  if (has(/\b(high school|secondary school)\b/i, text)) return "secondary";
  return null;
}

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
function yearsMin(text: string): number | null {
  const n = "(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)";
  const re = new RegExp(`(?:at least|minimum(?: of)?|min\\.?|over)?\\s*${n}\\s*(?:\\+|-\\s*\\d{1,2}|to \\d{1,2})?\\s*\\+?\\s*(?:years?|yrs?|jahre?)['’]?\\s*(?:of\\s+)?(?:\\w+\\s+){0,4}?(?:experience|erfahrung|work)`, "i");
  const m = re.exec(text);
  if (!m?.[1]) return null;
  const v = WORD_NUMBERS[m[1].toLowerCase()] ?? Number(m[1]);
  return v >= 0 && v <= 30 ? v : null;
}

const CURRENCY: Record<string, string> = { "€": "EUR", "$": "USD", "£": "GBP", eur: "EUR", usd: "USD", gbp: "GBP", chf: "CHF", cad: "CAD", aud: "AUD" };
function salary(text: string, given: JobPostingDTO["salary"]): Classified["salary"] {
  if (given && (given.min || given.max)) return given;
  const amount = "(\\d{1,3}(?:[,.\\s]\\d{3})+|\\d+(?:[.,]\\d+)?)\\s*(k)?";
  const re = new RegExp(`(€|\\$|£|\\b(?:eur|usd|gbp|chf|cad|aud)\\b)\\s?${amount}(?:\\s*(?:-|–|—|to)\\s*(?:€|\\$|£|\\b(?:eur|usd|gbp|chf)\\b)?\\s?${amount})?(?:\\s*(?:per|/|a)\\s*(year|annum|yr|month|mo|hour|hr))?`, "i");
  const m = re.exec(text);
  if (!m) return null;
  const num = (v: string | undefined, k: string | undefined) => {
    if (!v) return null;
    const n = Number(v.replace(/[,.\s](?=\d{3}\b)/g, "").replace(",", "."));
    return Number.isFinite(n) ? Math.round(k ? n * 1000 : n) : null;
  };
  const min = num(m[2], m[3]);
  const max = num(m[4], m[5] ?? m[3]);
  const per = (m[6] ?? "").toLowerCase();
  const period = /hour|hr/.test(per) ? "hour" : /month|mo/.test(per) ? "month" : /year|annum|yr/.test(per) ? "year" : min && min >= 10000 ? "year" : "";
  if (!min || (period === "" && min < 1000)) return null; // "$5 off" is not a salary
  return { min, max: max && max >= min ? max : null, currency: CURRENCY[(m[1] ?? "").toLowerCase()] ?? "", period };
}

function visa(text: string): boolean | null {
  if (/\b(no|not able to|unable to|cannot|can ?not|does not|do not|won'?t|will not) (offer |provide |sponsor )?(visa )?sponsor/i.test(text)) return false;
  if (/\bvisa sponsorship (is )?(available|provided|offered)|\b(we|will) (offer|provide|sponsor) (a )?visa|\bsponsor(ship)? (your|a) (work )?visa|relocation and visa support|visa support/i.test(text)) return true;
  return null;
}

export function classify(d: JobPostingDTO): Classified {
  const text = `${d.title}\n${d.description}`;
  const type = employmentType(d);
  const years = yearsMin(d.description);
  return {
    workMode: workMode(d, text),
    employmentType: type,
    seniority: seniority(d, years, type),
    educationLevel: educationLevel(d.description),
    yearsMin: years,
    salary: salary(text, d.salary),
    visaSponsorship: visa(text),
  };
}
