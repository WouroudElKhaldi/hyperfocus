import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/figtree";
import { createQueryClient, refreshOnDataChanged } from "./api/query.ts";
import "./i18n/index.ts"; // the words, before anything draws (P3-19)
import { router } from "./router.tsx";
import { applySavedA11y } from "./features/settings/index.ts";
import { applyTheme, getTheme } from "./theme.ts";
import "./tailwind.css"; // Tailwind + shadcn tokens, and (in a lower layer) the existing styles.css and shell.css

applyTheme(getTheme());
applySavedA11y();

// one data cache for the whole app (P3-03); pages not on it yet still refresh it when they change data
const queryClient = createQueryClient();
refreshOnDataChanged(queryClient);

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root element");
createRoot(root).render(
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
