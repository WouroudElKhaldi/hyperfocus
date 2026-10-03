# Job sources: what we may use, and how (P6-01)

Status: **drafted 2026-10-03, waiting for the owner's sign-off.** This is a reading of each source's published terms, not
legal advice. Before the hosted (cloud) launch, check each source's current terms again and, where it says so, ask
them. ADR-012 stands: **no scraping, of LinkedIn or anyone.** Every source below is an API the provider publishes for
this kind of use.

Rules for every source, built into the app:
- **Link to the original posting** (the apply link always goes to the source or the employer), and **name the source**
  on every card ("via Arbeitnow").
- **Keep postings only while they are fresh**: expire after 45 days or when the source drops them (P6-17), whichever
  is first; never re-publish them elsewhere (no feeding other job boards).
- **Ask politely**: at most the rate each source asks for (below), with a User-Agent naming Hyperfocus.
- Store the raw item only to re-process it, and delete it with the posting.

## Approved for launch (no key needed)

| Source | What it gives | Terms we found | Rules for us |
|---|---|---|---|
| **Arbeitnow** `arbeitnow.com/api/job-board-api` | Jobs in Europe (and a UK twin), mostly straight from employers' ATS; remote and visa-sponsorship flags | Described by its maker as "a public free Job Board API", no key required. No attribution clause found. | Link back and name "Arbeitnow" anyway. Fetch every 1–2 h. |
| **Greenhouse job boards** `boards-api.greenhouse.io/v1/boards/{company}/jobs` | Each company's own published openings (per company we add) | Public, no authentication for reading published jobs; meant for career sites. Aggregation isn't explicitly granted or forbidden. | Only companies we add on purpose (a list in admin). Link to the posting; name the company and "via Greenhouse". Fetch every 2–4 h per company. |
| **Lever job boards** `api.lever.co/v0/postings/{company}` | The same for companies on Lever | Lever's docs: "all job postings in the published state are publicly viewable". | Same as Greenhouse. |

## Ready, switched on when you add a key (free registration)

| Source | Key (free registration) | Rules to follow once approved |
|---|---|---|
| **Adzuna** (many countries) | developer.adzuna.com: app id + key | Their developer terms require visible attribution to Adzuna with a link; respect their call limits. |
| **Jooble** | jooble.org/api/about: request a key | Partner terms come with the key: read them then. |
| **USAJOBS** (US government) | developer.usajobs.gov: key + your email as User-Agent | Public data; follow their API terms and rate limits. |

## Not used

- **Remotive**: its terms forbid showing its jobs where people must sign up (the hosted Hyperfocus requires an account), and its other option is a paid API. Dropped (the owner: free sources only).

- **LinkedIn jobs**: no public job-search API for general developers; scraping breaks their terms (ADR-012). Only an
  interface and a feature flag exist (P6-19), switched on if LinkedIn ever grants official partner access.
- **Indeed**: its public API is closed to new publishers.
- **JSearch (RapidAPI)** and similar resellers of Google for Jobs data: the data's origin and licence aren't clear enough.
- **The Muse**: its public API refused our requests (403) on 2026-10-03; revisit later.

## Sign-off

- [ ] Owner has read this list and approves the launch sources and rules above (date, name).
