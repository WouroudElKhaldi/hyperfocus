import { CalendarPlus, Inbox, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { useApi, useApiChange } from "@/api/hooks.ts";
import { keyOf, optimistic } from "@/api/query.ts";
import { contrast } from "@/palettes.ts";

// The design system page (P3-02), only in development (/dev/ui). Every shadcn/ui building block in the app's colors,
// with the ADHD rules it follows. Switch palette (Profile) or light/dark (top bar) and come back: everything follows.

const RULES = [
  ["Calm", "Soft surfaces, one accent color, no flashing. Motion is small and stops completely when the system asks for less."],
  ["One clear next step", "A card has at most one primary button. Empty places offer one tiny first step, never a menu."],
  ["Always know where you are", "A strong focus ring on everything you can reach with the keyboard (Tab), in every palette."],
  ["Kind words", "No guilt, no streak shaming: say what is, then what helps. Errors say what to do next."],
  ["Readable", "Text and controls meet WCAG 2.2 AA contrast in light and dark, for every palette (checked by the tests)."],
] as const;

const SWATCHES = [
  ["--accent", "--on-accent", "Primary"],
  ["--accent-soft", "--accent-strong", "Accent (soft)"],
  ["--surface", "--ink", "Card"],
  ["--surface-2", "--muted", "Muted"],
  ["--ok-soft", "--ok", "Success"],
  ["--warn-soft", "--warn", "Warning"],
  ["--bad-soft", "--bad", "Problem"],
  ["--info-soft", "--info", "Info"],
] as const;

/** The live contrast of each color pair, so a palette that breaks readability shows it right here. */
function Swatches() {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const read = () => {
      const css = getComputedStyle(document.documentElement);
      setValues(Object.fromEntries(SWATCHES.flatMap(([bg, fg]) => [bg, fg]).map((v) => [v, css.getPropertyValue(v).trim()])));
    };
    read();
    for (const e of ["theme-change", "palette-change"]) window.addEventListener(e, read);
    return () => { for (const e of ["theme-change", "palette-change"]) window.removeEventListener(e, read); };
  }, []);
  const ratio = (a?: string, b?: string) => (a?.startsWith("#") && b?.startsWith("#") ? contrast(a, b).toFixed(1) : "?");
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {SWATCHES.map(([bg, fg, name]) => (
        <div key={bg} className="rounded-lg border border-border p-3" style={{ background: `var(${bg})`, color: `var(${fg})` }}>
          <div className="text-sm font-semibold">{name}</div>
          <div className="text-xs">
            {bg} / {fg} · {ratio(values[bg], values[fg])}:1
          </div>
        </div>
      ))}
    </div>
  );
}

type NoteRow = { id: number; body: string; pending?: boolean };

/** Reading and changing data with TanStack Query (P3-03): the list is cached, and a new thought shows at once. */
function DataDemo() {
  const client = useQueryClient();
  const notes = useApi("/notes");
  const [text, setText] = useState("");
  const add = useApiChange("post", "/notes", {
    refresh: ["/notes"],
    // optimistic: the thought is in the list before the server answers; if it says no, it is taken out again
    onMutate: ({ body }) => optimistic<NoteRow[]>(client, keyOf("/notes"), (list) => [{ id: -Date.now(), body, pending: true }, ...(list ?? [])]),
    onError: (_error, _body, undo) => undo?.(),
  });
  const list = (notes.data ?? []) as NoteRow[];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your latest thoughts</CardTitle>
        <CardDescription>Read with useApi, added with useApiChange. A new one shows at once; if the server refuses, it disappears again with a message.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            add.mutate({ body: text.trim(), kind: "thought" });
            setText("");
          }}
        >
          <Label htmlFor="ui-thought" className="sr-only">A thought</Label>
          <Input id="ui-thought" value={text} onChange={(e) => setText(e.target.value)} placeholder="A thought, any size" />
          <Button type="submit">Add</Button>
        </form>
        {notes.isPending ? (
          <Skeleton className="h-4 w-1/2" />
        ) : (
          <ul aria-label="Latest thoughts" className="m-0 grid list-none gap-1 p-0 text-sm">
            {list.slice(0, 3).map((n) => (
              <li key={n.id} className={n.pending ? "text-muted-foreground" : "text-foreground"}>
                {n.body}
                {n.pending ? " (saving…)" : ""}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mb-8">
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

export default function DevUi() {
  const [name, setName] = useState("");
  const [tried, setTried] = useState(false);
  const [agree, setAgree] = useState(false);
  const nameError = tried && !name.trim() ? "Give the task a name, even a messy one." : "";

  return (
    <div className="page">
      <h1>Design system</h1>
      <p className="sub">The building blocks for the new pages (P3-02). Only in development. Try it with the keyboard (Tab, Enter, Esc).</p>

      <Section id="rules" title="ADHD-first rules">
        <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
          {RULES.map(([rule, why]) => (
            <li key={rule} className="rounded-lg border border-border bg-card p-3">
              <strong className="text-foreground">{rule}.</strong> <span className="text-muted-foreground">{why}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="colors" title="Colors (with live contrast)">
        <Swatches />
      </Section>

      <Section id="buttons" title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button variant="destructive">
            <Trash2 aria-hidden="true" /> Delete
          </Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">
            <Plus aria-hidden="true" /> Large with icon
          </Button>
          <Button size="icon" aria-label="Add a task">
            <Plus aria-hidden="true" />
          </Button>
        </div>
      </Section>

      <Section id="forms" title="Form fields">
        <form
          className="grid max-w-md gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            setTried(true);
            if (name.trim()) toast.success(`Saved “${name.trim()}”. One thing at a time.`);
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="ui-name">Task</Label>
            <Input
              id="ui-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Something small you can start"
              aria-invalid={!!nameError}
              aria-describedby={nameError ? "ui-name-error" : "ui-name-hint"}
            />
            {nameError ? (
              <p id="ui-name-error" role="alert" className="m-0 text-sm text-destructive">
                {nameError}
              </p>
            ) : (
              <p id="ui-name-hint" className="m-0 text-sm text-muted-foreground">
                Tiny is good: “open the slides” beats “study chapter 4”.
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ui-notes">Notes (optional)</Label>
            <Textarea id="ui-notes" placeholder="Anything that helps future you" />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="ui-today" checked={agree} onCheckedChange={(v) => setAgree(v === true)} />
            <Label htmlFor="ui-today">Do it today</Label>
          </div>
          <div>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Section>

      <Section id="cards" title="Cards and badges">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Finish the lab report</CardTitle>
              <CardDescription>Due in 3 days · Fri 9 Oct</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge>Study</Badge>
              <Badge variant="secondary">20 min</Badge>
              <Badge variant="outline">Today</Badge>
            </CardContent>
            <CardFooter>
              <Button size="sm">Start the first step</Button>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Loading</CardTitle>
              <CardDescription>A quiet placeholder while data arrives (no spinner wall).</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2" role="status" aria-busy="true" aria-label="Loading">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section id="feedback" title="Messages">
        <div className="grid max-w-xl gap-3">
          <Alert>
            <Sparkles aria-hidden="true" />
            <AlertTitle>Saved for later</AlertTitle>
            <AlertDescription>It’s in your list. Nothing else to do right now.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Couldn’t reach the server</AlertTitle>
            <AlertDescription>Your text is kept here. Check that the app is running, then try again.</AlertDescription>
          </Alert>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => toast("Saved. Your info stays on this computer.")}>
              Show a toast
            </Button>
            <Button variant="outline" onClick={() => toast.error("That didn’t work. Nothing was lost; try again in a moment.")}>
              Show an error toast
            </Button>
          </div>
        </div>
      </Section>

      <Section id="dialogs" title="Dialog">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">
              <CalendarPlus aria-hidden="true" /> Plan a study block
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Plan a study block</DialogTitle>
              <DialogDescription>Pick one time. You can move it later; nothing is set in stone.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor="ui-when">When</Label>
              <Input id="ui-when" type="time" defaultValue="15:00" />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Not now</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button onClick={() => toast.success("Added to your calendar.")}>Add it</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Section>

      <Section id="data" title="Data (TanStack Query)">
        <DataDemo />
      </Section>

      <Section id="empty" title="Empty state">
        <Card>
          <EmptyState
            icon={<Inbox />}
            title="Nothing here yet, and that’s fine."
            action={
              <Button size="sm">
                <Plus aria-hidden="true" /> Add one tiny task
              </Button>
            }
          >
            Start with something that takes two minutes.
          </EmptyState>
        </Card>
      </Section>

      <Separator className="my-6" />
      <p className="text-sm text-muted-foreground">
        Components live in <code>src/components/ui</code> (shadcn/ui, owned by us). Their colors come from the app’s tokens (
        <code>src/tailwind.css</code>).
      </p>
    </div>
  );
}
