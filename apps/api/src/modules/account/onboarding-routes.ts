import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { AboutMeInput } from "@hyperfocus/shared";
import type { AppDeps, AppEnv } from "../../app.ts";
import { body, json, problem } from "../../http/crud.ts";
import { defaultHook } from "../../http/validation.ts";
import { mayUseRadar } from "../../radar/access.ts";
import { presetForField } from "../../taxonomy/presets.ts";
import { compact } from "../../types.ts";

// The welcome guide (P5-05), three short screens for someone new: their name, what they study, what they want help
// with. Finishing it sets things up for them: "find jobs" makes their Job Radar filter from their field of study (the
// ready-made preset), and the first page they land on fits what they picked. Skipping is fine too; it is shown once.

export const HELP_WITH = ["focus", "tasks", "study", "jobs", "habits"] as const;
/** where to go after the guide: the first thing they picked, in this order */
const START: Record<(typeof HELP_WITH)[number], string> = { jobs: "/radar", study: "/study", tasks: "/tasks", focus: "/", habits: "/goals" };
const ORDER = ["jobs", "study", "tasks", "habits", "focus"] as const;

const Done = z.object({ filterId: z.number().nullable().openapi({ description: "The Job Radar filter made from their field of study" }), next: z.string().openapi({ description: "The page to open next" }) }).openapi("OnboardingDone");

export function onboardingRouter({ prisma, events }: AppDeps) {
  const app = new OpenAPIHono<AppEnv>({ defaultHook });

  app.openapi(
    createRoute({
      method: "post", path: "/api/onboarding", tags: ["Account"], summary: "Finish the welcome guide (name, field of study, what to help with)",
      request: { body: body(z.object({
        name: z.string().trim().min(1).max(100),
        fieldCode: z.string().regex(/^cip:\d{2}(\.\d{2,4})?$/).nullable().default(null),
        helpWith: z.array(z.enum(HELP_WITH)).max(HELP_WITH.length).default([]),
        about: AboutMeInput.default({}).openapi({ description: "P5-14: studies, situation, how their brain works, what helps, tone (all optional)" }),
      })) },
      responses: { 200: json(Done, "Set up"), 404: problem("No such field of study") },
    }),
    async (c) => {
      const { name, fieldCode, helpWith, about } = c.req.valid("json");
      const id = c.get("userId");
      let filterId: number | null = null;
      const radar = await mayUseRadar(prisma, c.get("role"));
      if (radar && fieldCode && helpWith.includes("jobs") && !(await prisma.jobFilter.count())) {
        const preset = await presetForField(prisma, fieldCode);
        if (preset) {
          const f = await prisma.jobFilter.create({ data: { name: `${preset.field.label} jobs`, spec: preset.spec } });
          filterId = f.id;
          await events.publish("JobFilterChanged", { filterId });
        }
      }
      await prisma.user.update({ where: { id }, data: { name, helpWith: [...new Set(helpWith)], onboardedAt: new Date() } });
      // their profile: the name, and what they study as their title when they haven't given one (the AI fits its help to it)
      const field = fieldCode ? await prisma.fieldOfStudy.findUnique({ where: { code: fieldCode }, select: { title: true } }) : null;
      const profile = await prisma.profile.findFirst();
      const role = !profile?.role && field ? `${field.title} student` : undefined;
      const answers = compact(about); // only what they answered; the rest stays as it was
      if (field && !answers.major && !profile?.major) answers.major = field.title;
      if (profile) await prisma.profile.update({ where: { id: profile.id }, data: { name, ...(role ? { role } : {}), ...answers } });
      else await prisma.profile.create({ data: { name, ...(role ? { role } : {}), ...answers } });
      const first = ORDER.find((h) => helpWith.includes(h));
      return c.json({ filterId, next: first === "jobs" && !radar ? "/jobs" : first ? START[first] : "/" }, 200);
    },
  );

  app.openapi(
    createRoute({ method: "post", path: "/api/onboarding/skip", tags: ["Account"], summary: "Skip the welcome guide (it isn't shown again)", responses: { 204: { description: "Skipped" } } }),
    async (c) => {
      await prisma.user.updateMany({ where: { id: c.get("userId"), onboardedAt: null }, data: { onboardedAt: new Date() } });
      return c.body(null, 204);
    },
  );
  return app;
}
