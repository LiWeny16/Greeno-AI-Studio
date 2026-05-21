import { readConfig } from "./config";
import { createServer } from "./server";

const config = readConfig();
const app = await createServer(config);

await app.listen({
  host: config.host,
  port: config.port
});
