# Success metrics (P0-09)

What "it's working" means once real students use Hyperfocus. Each metric says **why it matters**, **how it's measured**
and the **first target** for the beta (P7-08, about 30 students). Targets are guesses until the beta gives us a baseline. Revisit them then.

## Principles
- **Measure progress, not screen time.** For students with ADHD, "time in app" can mean stuck, not helped. We never optimise for it.
- **Count events, not people's content.** Metrics come from event counts (task completed, job saved), never from what someone wrote, and never from chat messages.
- **Opt-in and private.** No third-party trackers. Self-hosted analytics (e.g. PostHog self-hosted or plain DB counts). Users can see and export what's counted.
- **Kind by design.** No streak-shaming metrics, no "you used it less this week" messages.

## North star
**Weekly students making progress (WSP):** students who complete ≥1 meaningful action in a week
(task done, study session ≥10 min, goal step done, job application sent).
*Why:* it captures the app's promise ("you got something done") across every major.
*Beta target:* 60% of activated students are WSP each week.

## Funnel
| Stage | Metric | How measured | Beta target |
|---|---|---|---|
| Activation | Finished onboarding **and** did 1 action within 24h | `user.onboardedAt` + first action event | 70% of sign-ups |
| Habit | Active on ≥3 different days in week 2 | distinct active days | 40% of activated |
| Retention | Still active at day 30 (D30) | active in days 28–34 | 30% of activated |

## Feature metrics
| Area | Metric | Why | Beta target |
|---|---|---|---|
| Tasks | Tasks completed per WSP per week | Core "getting things done" | ≥ 5 |
| Getting unstuck | % of "I'm stuck" uses followed by a completed task/step within 2h | Does the help actually help? | ≥ 35% |
| Study | Study minutes per studying student per week | Focus support works | baseline first |
| Job Radar | Matches **saved** ÷ matches **shown** | Match quality | ≥ 15% |
| Job Radar | Saved → **applied** within 14 days | Turns browsing into action | ≥ 25% |
| Job Radar | 👎 "Not for me" rate | Bad matches | ≤ 30% |
| Job Radar | Students with ≥1 filter who aren't CS majors | We serve all majors | ≥ 60% of Radar users |
| Digest | Digest open rate · unsubscribe rate | Right amount, right time | ≥ 40% · ≤ 5%/month |
| Wellbeing (survey) | "Hyperfocus makes my week feel more manageable" (1–5) | The real goal | ≥ 4.0 average |

## Guardrails (must not get worse)
- AI cost per active student per month (P5-10) stays under budget (set at beta).
- p95 API latency < 300 ms (P7-06).
- Crisis safeguard: 100% of flagged chat messages show the urgent-help panel (automated test exists).
- Zero data incidents.

## Where the numbers come from
- **P5:** add an `events` table (user, type, at, small JSON of ids only) written by domain events (P2-04), never content.
- **P7-04:** a simple admin dashboard over `events`. Weekly email to the team with the north star and funnel.
