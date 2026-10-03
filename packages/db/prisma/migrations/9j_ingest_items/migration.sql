-- P6-11: a batch keeps its raw items until it is processed (a queued batch survives a restart), then they are emptied.
ALTER TABLE "IngestBatch" ADD COLUMN "items" JSONB NOT NULL DEFAULT '[]';
