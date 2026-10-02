import { zodResolver } from "@hookform/resolvers/zod";
import { cloneElement, type ReactElement, useId } from "react";
import { type FieldValues, type Resolver, type UseFormProps, type UseFormReturn, useForm } from "react-hook-form";
import type { z } from "zod";
import { Label } from "@/components/ui/label";
import { errorOf } from "../api.ts";

// Forms (P3-06): react-hook-form, checked by the SAME Zod schemas the API uses (@hyperfocus/shared), so a form shows
// exactly the server's messages ("Task needs a title.") before anything is sent, and the server never disagrees.

/** A form checked by a shared schema: `const form = useSchemaForm(CreateTaskInput, { defaultValues: { title: "" } })`. */
export function useSchemaForm<S extends z.ZodType<FieldValues, FieldValues>>(schema: S, options: Omit<UseFormProps<z.input<S>, unknown, z.output<S>>, "resolver"> = {}) {
  // (the resolver is built for any schema; this pins it to this one's input and output types)
  return useForm<z.input<S>, unknown, z.output<S>>({ ...options, resolver: zodResolver(schema) as unknown as Resolver<z.input<S>, unknown, z.output<S>> });
}

/** Shows an error the server still sent (like "already sent", or "can't reach the server") on the form as a whole. */
export function showServerError<T extends FieldValues>(form: UseFormReturn<T, unknown, FieldValues>, error: unknown) {
  form.setError("root.server", { message: errorOf(error).message });
}

/**
 * A labelled field with its hint and its error, wired for screen readers: the control gets an id, `aria-invalid`
 * and `aria-describedby`; the error is announced (`role="alert"`). Pass the control as the only child.
 */
export function FormField({ label, hint, error, children }: { label: string; hint?: string; error?: string | undefined; children: ReactElement<Record<string, unknown>> }) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {cloneElement(children, { id, "aria-invalid": !!error, ...(describedBy ? { "aria-describedby": describedBy } : {}) })}
      {error ? (
        <p id={`${id}-error`} role="alert" className="m-0 text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="m-0 text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** The form-wide error (from showServerError), announced. */
export function FormError({ message }: { message?: string | undefined }) {
  return message ? (
    <p role="alert" className="m-0 text-sm text-destructive">
      {message}
    </p>
  ) : null;
}
