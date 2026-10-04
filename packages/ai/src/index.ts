// @hyperfocus/ai: the AI gateway (P2-05). The API creates one gateway and runs the prompt templates through it.
export { deepSeek, type DeepSeekSettings } from "./deepseek.ts";
export { type AiGateway, type CallOptions, createAiGateway, type GatewayOptions } from "./gateway.ts";
export * as prompts from "./prompts/index.ts";
export { describePerson, PERSON, type Person } from "./person.ts";
export { type JsonTemplate, jsonTemplate, type TextTemplate, textTemplate } from "./template.ts";
export { AiError, type AiMessage, type AiProvider, type AiRequest } from "./types.ts";
