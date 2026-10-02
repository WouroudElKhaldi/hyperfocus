-- CreateIndex
CREATE INDEX "Note_kind_idx" ON "Note"("kind");

-- CreateIndex
CREATE INDEX "Task_dueDay_idx" ON "Task"("dueDay");

-- CreateIndex
CREATE INDEX "Task_done_today_idx" ON "Task"("done", "today");

-- CreateIndex
CREATE INDEX "Task_doneAt_idx" ON "Task"("doneAt");

-- CreateIndex
CREATE INDEX "Step_taskId_idx" ON "Step"("taskId");

-- CreateIndex
CREATE INDEX "Post_status_scheduledAt_idx" ON "Post"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Post_postedAt_idx" ON "Post"("postedAt");

-- CreateIndex
CREATE INDEX "Post_noteId_idx" ON "Post"("noteId");

-- CreateIndex
CREATE INDEX "StudySession_startedAt_idx" ON "StudySession"("startedAt");

-- CreateIndex
CREATE INDEX "StudySession_endedAt_idx" ON "StudySession"("endedAt");

-- CreateIndex
CREATE INDEX "Goal_status_idx" ON "Goal"("status");

-- CreateIndex
CREATE INDEX "GoalAction_goalId_idx" ON "GoalAction"("goalId");

-- CreateIndex
CREATE INDEX "GoalLog_goalId_idx" ON "GoalLog"("goalId");

-- CreateIndex
CREATE INDEX "Event_day_idx" ON "Event"("day");

-- CreateIndex
CREATE INDEX "BookMessage_bookId_id_idx" ON "BookMessage"("bookId", "id");

-- CreateIndex
CREATE INDEX "Win_createdAt_idx" ON "Win"("createdAt");

-- CreateIndex
CREATE INDEX "PetXp_source_createdAt_idx" ON "PetXp"("source", "createdAt");

-- CreateIndex
CREATE INDEX "PetXp_createdAt_idx" ON "PetXp"("createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_threadId_id_idx" ON "ChatMessage"("threadId", "id");

-- CreateIndex
CREATE INDEX "Reminder_done_at_idx" ON "Reminder"("done", "at");

-- CreateIndex
CREATE INDEX "Email_jobId_idx" ON "Email"("jobId");

-- CreateIndex
CREATE INDEX "EmailAttachment_emailId_idx" ON "EmailAttachment"("emailId");

-- CreateIndex
CREATE INDEX "EmailAttachment_templateId_idx" ON "EmailAttachment"("templateId");

