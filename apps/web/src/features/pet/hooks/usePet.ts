import type { PetResponse } from "../../../types.ts";
import { usePetQuery } from "../api.ts";

/** The pet's state, shared by every component that shows it. null until the first load. */
export const usePet = (): PetResponse | null => usePetQuery().data ?? null;
