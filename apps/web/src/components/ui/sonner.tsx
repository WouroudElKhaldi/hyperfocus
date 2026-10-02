import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from "lucide-react";
import type * as React from "react";
import { useEffect, useState } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { effectiveTheme } from "@/theme.ts";

// shadcn/ui's toaster, adapted (P3-02): it follows the app's own light/dark/auto setting (not next-themes) and uses
// the app's tokens directly. Calm by default: bottom of the screen, one at a time visible, a few seconds, never stacked
// into a wall (decision fatigue).
const Toaster = ({ ...props }: ToasterProps) => {
  const [theme, setTheme] = useState(effectiveTheme());
  useEffect(() => {
    const update = () => setTheme(effectiveTheme());
    window.addEventListener("theme-change", update);
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener("change", update);
    return () => {
      window.removeEventListener("theme-change", update);
      media?.removeEventListener("change", update);
    };
  }, []);

  return (
    <Sonner
      theme={theme}
      position="bottom-center"
      visibleToasts={1}
      duration={4000}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" />,
      }}
      style={
        {
          "--normal-bg": "var(--surface)",
          "--normal-text": "var(--ink)",
          "--normal-border": "var(--line)",
          "--border-radius": "var(--r)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
