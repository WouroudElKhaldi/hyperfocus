// A calmer way to show secondary things: one small line to open, and everything inside stays hidden until then.
import type { ReactNode } from "react";

export default function More({ label = "More options", children, open = false, className = "" }: { label?: string; children: ReactNode; open?: boolean; className?: string }) {
  return (
    <details className={"more " + className} open={open}>
      <summary>{label}</summary>
      <div className="more-body">{children}</div>
    </details>
  );
}
