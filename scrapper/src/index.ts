import { buildApp } from "./api/app.js";
import { loadConfig } from "./config/env.js";

const config = loadConfig();
const app = await buildApp({ config, logger: true });

try {
  await app.listen({ port: config.port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => void app.close().then(() => process.exit(0)));
}
