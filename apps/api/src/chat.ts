import { prompts } from "@hyperfocus/ai";
import { type AiMessage, ai } from "./ai.ts";

// The support chat. It is a warm companion, not a therapist, and it says so when it matters. Its prompt lives in
// packages/ai (prompts/companion.ts); the crisis check stays here, next to the route that answers with it.
const CRISIS = /(kill myself|killing myself|suicid|end my life|ending my life|want to die|wanna die|don'?t want to (live|be here|be alive)|hurt myself|harm myself|self[- ]?harm|cut myself|no reason to live|better off dead|better off without me)/i;
export const isCrisis = (text: string): boolean => CRISIS.test(text);

export async function companionReply(input: { history: AiMessage[]; message: string; context: string }): Promise<string> {
  return (await ai.run(prompts.companionReply, input)).trim();
}
