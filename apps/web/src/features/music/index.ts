// The music feature's public parts: the player (loaded on its own when the app starts, App.tsx, P3-16), and the
// sound check that the /dev/sound page runs.
export { default } from "./components/MusicPlayer.tsx";
export { checkEveryTrack } from "./audio/soundCheck.ts";
