// Starts the safe test API (throwaway database, fake AI and n8n, no Gmail) for the browser tests.
// Playwright runs this as a web server and stops it when the tests end.
import { startTestStack } from "../server/test/support/stack.js";

const port = Number(process.env.E2E_API_PORT || 4310);
const stack = await startTestStack({ port });
console.log(`Test API on ${stack.apiUrl} (data in ${stack.tmpDir})`);

let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await stack.stop().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.stdin.on("end", stop);
process.stdin.resume();
