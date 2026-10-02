import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Joins class names, letting a later Tailwind class win over an earlier one (`cn("p-2", big && "p-4")`). shadcn/ui uses it. */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
