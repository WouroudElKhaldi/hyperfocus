-- P4-04 evidence: the hot queries' plans with and without the new indexes, on a large made-up data set.
-- Run in a throwaway schema of the test database (see README in this folder). Nothing here touches real data.
\timing off
SET client_min_messages = warning;

-- 200 000 tasks over ~5 years of due days, 200 000 events, 200 000 pet points, 200 000 chat messages in 2 000 threads
INSERT INTO "Task" (title, done, today, "dueDay", priority, "doneAt")
SELECT 'task ' || g, g % 3 = 0, g % 97 = 0, to_char(DATE '2024-01-01' + (g % 1800), 'YYYY-MM-DD'), 'normal',
       CASE WHEN g % 3 = 0 THEN now() - (g % 900) * interval '1 day' END
FROM generate_series(1, 200000) g;
INSERT INTO "Event" (title, day, "startTime", "endTime", category)
SELECT 'event ' || g, to_char(DATE '2024-01-01' + (g % 1800), 'YYYY-MM-DD'), '09:00', '10:00', 'event' FROM generate_series(1, 200000) g;
INSERT INTO "PetXp" (source, key, amount, note, "createdAt")
SELECT (ARRAY['task','study','add','win'])[1 + g % 4], 'k' || g, 2, '', now() - (g % 900) * interval '1 day' FROM generate_series(1, 200000) g;
INSERT INTO "ChatThread" (title) SELECT 'thread ' || g FROM generate_series(1, 2000) g;
INSERT INTO "ChatMessage" ("threadId", role, content)
SELECT 1 + g % 2000, CASE WHEN g % 2 = 0 THEN 'user' ELSE 'assistant' END, 'hi' FROM generate_series(1, 200000) g;
ANALYZE "Task"; ANALYZE "Event"; ANALYZE "PetXp"; ANALYZE "ChatMessage";

\echo '=== Calendar: tasks due in one week (WITH the index) ==='
EXPLAIN (ANALYZE, COSTS OFF, SUMMARY ON) SELECT * FROM "Task" WHERE "dueDay" BETWEEN '2026-10-01' AND '2026-10-07';
\echo '=== Calendar: events in one week (WITH the index) ==='
EXPLAIN (ANALYZE, COSTS OFF, SUMMARY ON) SELECT * FROM "Event" WHERE day BETWEEN '2026-10-01' AND '2026-10-07' ORDER BY day;
\echo '=== Pet: today''s task points (WITH the index) ==='
EXPLAIN (ANALYZE, COSTS OFF, SUMMARY ON) SELECT count(*) FROM "PetXp" WHERE source = 'task' AND "createdAt" >= date_trunc('day', now());
\echo '=== Chat: the last 24 messages of a thread (WITH the index) ==='
EXPLAIN (ANALYZE, COSTS OFF, SUMMARY ON) SELECT * FROM "ChatMessage" WHERE "threadId" = 42 ORDER BY id DESC LIMIT 24;

\echo '=== The same four WITHOUT indexes (index scans switched off, as before P4-04) ==='
SET enable_indexscan = off;
SET enable_bitmapscan = off;
SET enable_indexonlyscan = off;
EXPLAIN (ANALYZE, COSTS OFF, SUMMARY ON) SELECT * FROM "Task" WHERE "dueDay" BETWEEN '2026-10-01' AND '2026-10-07';
EXPLAIN (ANALYZE, COSTS OFF, SUMMARY ON) SELECT * FROM "Event" WHERE day BETWEEN '2026-10-01' AND '2026-10-07' ORDER BY day;
EXPLAIN (ANALYZE, COSTS OFF, SUMMARY ON) SELECT count(*) FROM "PetXp" WHERE source = 'task' AND "createdAt" >= date_trunc('day', now());
EXPLAIN (ANALYZE, COSTS OFF, SUMMARY ON) SELECT * FROM "ChatMessage" WHERE "threadId" = 42 ORDER BY id DESC LIMIT 24;
