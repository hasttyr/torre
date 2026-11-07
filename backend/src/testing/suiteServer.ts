// The API as a separate process for the load, recovery and installation
// suites (suiteApi.ts starts it): the real server, on whatever database
// DATABASE_URL names, which the parent sets. A process of its own so the
// suites can crash it for real, and so the load they generate doesn't share
// its event loop. It answers the parent's "memory" message with its memory
// use, after a garbage collection when Node lets it (--expose-gc).
process.env.PORT ??= "4200";
process.env.LOG_LEVEL ??= "silent";

import("../server")
  .then(({ startServer }) => startServer(Number(process.env.PORT)))
  .then(() => {
    process.on("message", (message) => {
      if (message !== "memory") return;
      (globalThis as { gc?: () => void }).gc?.();
      process.send?.({ memory: process.memoryUsage() });
    });
    process.send?.("listening");
  })
  .catch((error: Error) => {
    console.error(`The suite's API didn't start: ${error.message}`);
    process.exit(1);
  });
