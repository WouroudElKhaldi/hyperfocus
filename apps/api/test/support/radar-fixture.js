// A few job postings for the browser tests (P6-27), put in through the real pipeline so they are classified, placed,
// skill-tagged and matched like real ones: an internship that fits a Computer Science student, a nurse job, and a
// senior full-time job.

const now = () => Math.floor(Date.now() / 1000);
const item = (slug, title, company, description, extra = {}) => ({
  slug, company_name: company, title, description, remote: true, url: `https://jobs.example/${slug}`,
  tags: [], job_types: ["internship"], location: "Remote", created_at: now() - 3600, ...extra,
});

export const SAMPLE_POSTINGS = [
  item("e2e-swe-intern", "Software Engineer Intern", "Cedar Labs", "<p>Join our platform team. You will write Python every day and review code in Git.</p><ul><li>Python</li><li>Git</li></ul>"),
  item("e2e-nurse", "Night Nurse", "Beirut Care", "<p>Care for patients on night shifts.</p>", { job_types: ["full time"], remote: false, location: "Beirut" }),
  item("e2e-senior", "Senior Software Engineer", "Cedar Labs", "<p>Lead our Python services.</p>", { job_types: ["full time"] }),
];

/** Puts the sample postings into a database (the browser tests' one). */
export async function seedPostings(databaseUrl) {
  const { PrismaClient } = await import("@hyperfocus/db");
  const { processBatch, receiveBatch } = await import("../../src/radar/ingest.ts");
  const db = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    const source = await db.jobSource.upsert({ where: { key: "arbeitnow" }, create: { key: "arbeitnow", kind: "arbeitnow", name: "Arbeitnow", lastOkAt: new Date() }, update: {} });
    const b = await receiveBatch(db, source, SAMPLE_POSTINGS, `e2e-seed-${Date.now()}`);
    await processBatch(db, b.batchId);
  } finally {
    await db.$disconnect();
  }
}
