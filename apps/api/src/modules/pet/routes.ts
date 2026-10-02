import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { PetCatalog, PetResponse, PetState } from "@hyperfocus/shared";
import type { AppDeps, AppEnv } from "../../app.ts";
import { body, json, problem } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";
import { catalogState, cleanPet, petState } from "../../pet.ts";
import { httpError } from "../../types.ts";

// The companion pet (P2-19): its state, the catalog of things to unlock, choosing it and changing it. XP comes from
// events (./xp.ts). Same answers as the Express routes had. The detailed checks (species, colors, unlocked clothes,
// the messages) stay in cleanPet(), so the request bodies are documented loosely here.

const PetFields = z
  .looseObject({
    name: z.string(), species: z.string(), gender: z.string(), color: z.string().openapi({ example: "#9b7bff" }),
    traits: z.array(z.string()), bio: z.string(), outfit: z.record(z.string(), z.string()), backdrop: z.string(), pattern: z.string(), aura: z.string(),
  })
  .partial()
  .openapi("PetFields", { description: "Checked by the pet rules: unknown species, colors or locked items are refused with a message." });
// before choosing a pet: { pet: null }; after: the pet with its age, XP, stats, quests, badges and what it can wear

export function petRouter({ prisma }: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });
  app.openapi(
    createRoute({ method: "get", path: "/api/pet", tags: ["Pet"], summary: "The pet and everything about it", responses: { 200: json(PetResponse, "The pet, or { pet: null }") } }),
    async (c) => c.json(await petState(prisma), 200),
  );
  app.openapi(
    createRoute({ method: "get", path: "/api/pet/catalog", tags: ["Pet"], summary: "What exists and what is free, for choosing a pet", responses: { 200: json(PetCatalog, "The catalog") } }),
    (c) => c.json(catalogState(), 200),
  );
  app.openapi(
    createRoute({
      method: "post", path: "/api/pet", tags: ["Pet"], summary: "Choose your pet (it starts as an egg)",
      request: { body: body(PetFields) }, responses: { 200: json(PetState, "The new pet"), 400: problem("Something to fix"), 409: problem("There is already a pet") },
    }),
    async (c) => {
      if (await prisma.pet.findFirst()) throw httpError(409, "You already have a pet.");
      // a new pet has earned nothing yet, so only the free clothes are available
      const checked = cleanPet(c.req.valid("json"));
      if (checked.error !== undefined) throw httpError(400, checked.error);
      await prisma.pet.create({ data: checked.data });
      return c.json(await petState(prisma), 200);
    },
  );
  app.openapi(
    createRoute({
      method: "patch", path: "/api/pet", tags: ["Pet"], summary: "Change the pet: details, outfit, backdrop, pattern, aura",
      request: { body: body(PetFields) }, responses: { 200: json(PetState, "The pet after the change"), 400: problem("Something to fix"), 404: problem("No pet yet") },
    }),
    async (c) => {
      const state = await petState(prisma);
      if (!state.pet) throw httpError(404, "No pet yet.");
      const checked = cleanPet(c.req.valid("json"), state, true);
      if (checked.error !== undefined) throw httpError(400, checked.error);
      await prisma.pet.update({ where: { id: state.pet.id }, data: checked.data });
      return c.json(await petState(prisma), 200);
    },
  );
  return app;
}
