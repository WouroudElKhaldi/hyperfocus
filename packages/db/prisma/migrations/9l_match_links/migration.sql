-- P6-30: what a match became elsewhere in the app (its deadline on the calendar, its reminder, its "Prepare" task).
ALTER TABLE "JobMatch" ADD COLUMN "eventId" INTEGER, ADD COLUMN "reminderId" INTEGER, ADD COLUMN "taskId" INTEGER;
