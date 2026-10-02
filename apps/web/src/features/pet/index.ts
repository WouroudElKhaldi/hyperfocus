// The pet feature's public parts (P3-05): what the rest of the app may use. Everything else in features/pet is internal.
export { default as PetArt } from "./components/PetArt.tsx";
export { PetCelebration, default as PetWidget } from "./components/PetWidget.tsx";
export { usePet } from "./hooks/usePet.ts";
