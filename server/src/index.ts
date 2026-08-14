import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./env.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: env.corsOrigin, credentials: true });

app.get("/api/health", async () => ({ ok: true }));

app.listen({ port: env.port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
