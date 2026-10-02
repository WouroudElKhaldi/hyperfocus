import type * as React from "react";
import { cn } from "@/lib/utils";

// An empty list, ADHD-first (P3-02): say kindly what is (not) here, then offer ONE tiny first step. Never a blank
// space, never guilt ("You haven't…"), never a menu of choices.
function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  /** A small picture (an icon), purely decorative. */
  icon?: React.ReactNode;
  /** What is here, in a kind sentence: "No tasks for today yet." */
  title: string;
  /** One short line of help, optional. */
  children?: React.ReactNode;
  /** The one tiny first step: a single button or link. */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="empty-state" className={cn("flex flex-col items-center gap-2 px-4 py-8 text-center", className)}>
      {icon ? (
        <div aria-hidden="true" className="mb-1 grid size-12 place-items-center rounded-full bg-accent text-accent-foreground [&_svg]:size-6">
          {icon}
        </div>
      ) : null}
      <p className="m-0 font-heading text-base font-semibold text-foreground">{title}</p>
      {children ? <p className="m-0 max-w-prose text-sm text-muted-foreground">{children}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export { EmptyState };
