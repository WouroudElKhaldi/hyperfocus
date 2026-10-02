// The support chat's safeguard. The chat is a warm companion, not a therapist, and it says so when it matters.
// A message that sounds like she may hurt herself is flagged (`crisis: true`), so the app shows urgent help next to the
// reply. The companion's prompt (packages/ai, prompts/companion.ts) also tells the AI what to do then.

const CRISIS = /(kill myself|killing myself|suicid|end my life|ending my life|want to die|wanna die|don'?t want to (live|be here|be alive)|hurt myself|harm myself|self[- ]?harm|cut myself|no reason to live|better off dead|better off without me)/i;
export const isCrisis = (text: string): boolean => CRISIS.test(text);

/**
 * The reply when the AI can't answer a crisis message (no key, the demo, DeepSeek down). Such a message must never get
 * an error instead of help (P2-18): it gets this fixed, safe reply, and the crisis flag still shows urgent help.
 */
export const CRISIS_FALLBACK =
  "I'm really glad you told me, and I'm taking it seriously. Are you safe right now? Please reach someone now: in Lebanon you can call the National Lifeline on 1564 (free and confidential, Embrace), or your local emergency number. And if you can, tell a person you trust and stay with them, so you're not alone with this.";
