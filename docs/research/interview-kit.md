# Student interview kit (P0-07)

**Goal:** understand how students of different majors (about half with ADHD or ADHD traits) study, plan and look for jobs,
before we build Job Radar and reshape the app for many users.
**Who runs it:** you (the product owner). One interview takes about 30 minutes. Aim for **8–12 interviews**, at least **5 different majors**.

## 1. Who to talk to (screener)

Send this as a short form. Pick a mix; don't only pick friends from Computer Science.

1. What do you study, and which year are you in? *(free text)*
2. Are you looking (or about to look) for an internship, a student job or a first job? *(yes / in the next 6 months / no)*
3. Which of these sound like you? *(tick any; optional)*
   - I lose track of time when I'm into something
   - I put off tasks even when they matter to me
   - Big tasks freeze me; I don't know where to start
   - I forget deadlines unless something reminds me
   - Too many choices exhaust me
4. Would you do a 30-minute video or in-person chat? You'll get the app early. *(yes/no + contact)*

> **Never ask for a diagnosis.** Question 3 is about everyday experience, it's optional, and it's never stored with a name.
> Keep screener answers and contact details separate; delete contact details when the research is done.

## 2. Consent (read out at the start)

"Thanks for helping. I'm building a study and planning app for students, and I want to learn how you really work, not test you.
There are no right answers. I'll take notes; may I also record audio, only so I don't miss anything? The recording is deleted
after I've written my notes, and nothing you say is shared with your name. You can skip any question or stop at any time. OK?"

## 3. Interview guide (30 min)

Ask for **stories, not opinions**: "Tell me about the last time…" beats "Would you use…". Stay quiet after answers; the good part often comes second.

**Warm-up (3 min)**
- What are you studying, and what does a normal week look like?

**Studying and planning (10 min)**
- Tell me about the last time you had a big assignment or exam. How did you get started?
- What did you use to keep track (app, paper, nothing)? What happened when it stopped working?
- When did you last lose hours to something (good or bad)? What pulled you out?
- What do you do when you're stuck and can't start? What actually helped?

**Job and internship search (10 min)**
- Walk me through the last time you looked for an internship or job. Where did you look? What did you search for?
- How did you decide which listings were "for you"? What made you skip one?
- What was the most annoying or exhausting part?
- How many applications did you send? How did you keep track of them and follow up?
- If someone sent you job posts, how many a day/week would feel helpful, and when would it feel like too much?

**Tools and feelings (5 min)**
- Which apps have you tried for this and dropped? Why did you drop them?
- What would make you trust an app that suggests jobs to you?

**Close (2 min)**
- If you had a magic button for one part of studying or job hunting, what would it do?
- Anything I should have asked but didn't?

## 4. Notes template (one per interview)

```
Interview #__ · date · major · year · job search: yes/soon/no · ADHD traits ticked: n/5 (no names)
Key stories (verbatim quotes in "quotes"):
-
Pains:
-
Workarounds they already use:
-
Moments of delight / what worked:
-
Job search: where they look · how they filter · what overwhelms · how many matches/week feels right:
-
Surprises (things I didn't expect):
-
```
Save as `docs/research/notes/interview-XX.md` **without names**.

## 5. Making sense of it (affinity map)

1. Write every pain, workaround, quote and surprise on its own sticky note (Miro, FigJam or paper).
2. Group notes that belong together **without** deciding the groups first; name each group afterwards in the student's words.
3. Count how many different students are behind each group. Groups backed by 3+ students are patterns; 1–2 are hunches.
4. Write the top patterns as **"How might we…"** questions (e.g. "How might we make job filters feel like one choice, not twenty?").
5. Put a photo/export in `docs/research/affinity-map.*` and the top 5 HMW questions in `docs/research/findings.md`.

## 6. What this feeds

- **P0-08 personas:** replace the proto-personas' assumptions with what you heard.
- **P0-09 metrics:** check that the success measures match what students care about.
- **P6 Job Radar:** the default filters, the "top N per day" number and the digest timing come straight from section 3's job questions.
