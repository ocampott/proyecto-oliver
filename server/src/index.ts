import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { env } from "./env.js";
import { meRoutes } from "./routes/me.js";
import { orgRoutes } from "./routes/org.js";
import { marcarRoutes } from "./routes/marcar.js";
import { sucursalesRoutes } from "./routes/sucursales.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: env.corsOrigin, credentials: true });
await app.register(cookie);

app.get("/api/health", async () => ({ ok: true }));

await app.register(meRoutes);
await app.register(orgRoutes);
await app.register(marcarRoutes);
await app.register(sucursalesRoutes);

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  reply.status(500).send({ error: "Algo salió mal. Probá de nuevo." });
});

app.listen({ port: env.port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
