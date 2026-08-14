import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./env.js";
import { meRoutes } from "./routes/me.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: env.corsOrigin, credentials: true });

app.get("/api/health", async () => ({ ok: true }));

await app.register(meRoutes);

app.listen({ port: env.port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
