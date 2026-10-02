import { z } from "zod";
import { Id, IsoDateTime } from "./primitives.ts";

// The support chat (P2-18): conversations saved as threads, or a "temporary" chat that is never written down.
// And the small helpers for getting started (the "I'm stuck" button, task steps, sorting a brain dump).
// The rules are the ones the API used before.

export const ChatThread = z.object({ id: Id, title: z.string(), createdAt: IsoDateTime, updatedAt: IsoDateTime });
export type ChatThread = z.infer<typeof ChatThread>;
export const ChatThreadRow = ChatThread.extend({ count: z.number().int() });

/** A saved message has a number id; a temporary one a text id like "t1727860000000u". */
export const ChatMessage = z.object({ id: z.union([Id, z.string()]), role: z.string(), content: z.string(), createdAt: IsoDateTime, threadId: Id.nullable().optional() });
export type ChatMessage = z.infer<typeof ChatMessage>;

const text = (max: number) => z.preprocess((v) => String(v || "").trim().slice(0, max), z.string());

/** PATCH /api/chat/threads/:id */
export const RenameThreadInput = z.object({ title: text(80).pipe(z.string().min(1, "Give the chat a name.")) });

/** POST /api/chat. With `temporary`, the history comes from the browser and nothing is saved. */
export const ChatInput = z.object({
  message: text(2000).pipe(z.string().min(1, "Write something first.")),
  threadId: z.union([Id, z.string().regex(/^\d+$/).transform(Number)]).nullable().optional(),
  temporary: z.boolean().optional(),
  // only her and the AI's turns are kept, the last 24, each cut to 4000 characters (anything else is dropped)
  history: z
    .array(z.unknown())
    .optional()
    .transform((h) =>
      (h ?? [])
        .filter((m): m is { role: "user" | "assistant"; content: string } => {
          const x = m as { role?: unknown; content?: unknown } | null;
          return (x?.role === "user" || x?.role === "assistant") && typeof x.content === "string";
        })
        .slice(-24)
        .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) })),
    ),
});
export type ChatInput = z.input<typeof ChatInput>;

/** POST /api/stuck */
export const StuckInput = z.object({
  energy: z.unknown().optional().transform((v) => (v === "low" || v === "high" ? v : "ok")),
  blocker: z.unknown().optional().transform((v) => String(v || "").slice(0, 600)),
});
export type StuckInput = z.input<typeof StuckInput>;
export const StuckHelp = z.object({ validation: z.string(), step: z.string(), ifStillStuck: z.string(), pick: z.string() });
