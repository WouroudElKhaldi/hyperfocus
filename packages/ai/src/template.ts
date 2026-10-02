import { z } from "zod";
import type { AiMessage } from "./types.ts";

// Prompt templates (Template Method): each AI feature says what to send and what it expects back; the gateway does the
// rest the same way for all of them (provider, timeout, retries, reading and checking the reply).
//
// Replies are read leniently, the way the API always read them: a missing text becomes "", a missing list becomes [],
// an unknown choice becomes the fallback. So a sloppy reply still works, and the result always has the promised type.

/** A feature that wants plain text back (the chats). */
export type TextTemplate<I> = {
  kind: "text";
  name: string;
  temperature: number;
  messages: (input: I) => AiMessage[];
};

/** A feature that wants a JSON object back, read by `reply` and optionally checked or reshaped by `after`. */
export type JsonTemplate<I, R, O> = {
  kind: "json";
  name: string;
  temperature: number;
  messages: (input: I) => AiMessage[];
  reply: z.ZodType<R>;
  after: (reply: R, input: I) => O;
};

export const textTemplate = <I>(t: Omit<TextTemplate<I>, "kind">): TextTemplate<I> => ({ kind: "text", ...t });

/** Without `after`, the template gives the reply as read. */
export function jsonTemplate<I, R, O = R>(t: { name: string; temperature: number; messages: (input: I) => AiMessage[]; reply: z.ZodType<R>; after?: (reply: R, input: I) => O }): JsonTemplate<I, R, O> {
  return { kind: "json", ...t, after: t.after ?? ((r: R) => r as unknown as O) };
}

/** The usual two messages: the instructions, then her input. */
export const systemAndUser = (system: string, user: string): AiMessage[] => [
  { role: "system", content: system },
  { role: "user", content: user },
];

// ---------- lenient readers for replies ----------
const asObject = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Reads a reply field with `read`, even when the field is missing (then it gets undefined). */
export const lenient = <T>(read: (v: unknown) => T) => z.unknown().optional().transform(read);
/** Text; missing becomes "". */
export const text = () => lenient((v) => (v == null ? "" : String(v)));
/** A list of texts; anything but a list becomes []. */
export const texts = () => lenient((v) => (Array.isArray(v) ? v.map(String) : []));
/** One of the allowed values, or the fallback. */
export const oneOf = <const T extends readonly string[]>(values: T, fallback: T[number]) =>
  lenient((v): T[number] => (values.includes(v as string) ? (v as T[number]) : fallback));
/** A list of objects, each read by `item`; anything but a list becomes []. */
export const objects = <S extends z.ZodRawShape>(item: S) => {
  const one = object(item);
  return lenient((v) => (Array.isArray(v) ? v.map((x) => one.parse(x)) : []));
};
/** An object whose fields are read leniently. Anything but an object reads as {}. */
export const object = <S extends z.ZodRawShape>(shape: S) => z.preprocess(asObject, z.object(shape));
