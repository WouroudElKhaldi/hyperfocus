import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/figtree";
import App from "./App.tsx";
import { applyTheme, getTheme } from "./theme.ts";
import "./tailwind.css"; // Tailwind + shadcn tokens (P3-01), before the existing styles so they keep the last word
import "./styles.css";
import "./shell.css";

applyTheme(getTheme());

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root element");
createRoot(root).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
