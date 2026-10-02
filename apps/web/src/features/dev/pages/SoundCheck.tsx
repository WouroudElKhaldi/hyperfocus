import { useState } from "react";
import { checkEveryTrack } from "../../music/index.ts";

// Development and test builds only (/dev/sound): plays every generated track and lists any that made no sound.
// The browser test presses the button (browsers only allow sound after a click) and reads the result.
export default function SoundCheck() {
  const [state, setState] = useState<"idle" | "checking" | string[]>("idle");
  return (
    <div>
      <h1>Sound check</h1>
      <button className="primary" disabled={state === "checking"} onClick={async () => { setState("checking"); setState(await checkEveryTrack()); }}>
        Check every track
      </button>
      {Array.isArray(state) && <output data-testid="silent">{JSON.stringify(state)}</output>}
    </div>
  );
}
