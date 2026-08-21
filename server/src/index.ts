import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { env } from "./env.js";
import { meRoutes } from "./routes/me.js";
import { orgRoutes } from "./routes/org.js";
import { marcarRoutes } from "./routes/marcar.js";
import { sucursalesRoutes } from "./routes/sucursales.js";
import { empleadosRoutes } from "./routes/empleados.js";
import { asistenciaRoutes } from "./routes/asistencia.js";
import { horasRoutes } from "./routes/horas.js";
import { adminRoutes } from "./routes/admin.js";
import { turnosRoutes } from "./routes/turnos.js";
import { placesRoutes } from "./routes/places.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  // En dev el puerto de Vite puede variar si 5173 está ocupado: aceptamos
  // cualquier localhost, pero solo si se habilita a propósito — no por
  // NODE_ENV, que en el deploy real nunca queda seteado a "production".
  origin: process.env.CORS_ALLOW_LOCALHOST === "true" ? [env.corsOrigin, /^http:\/\/localhost:\d+$/] : env.corsOrigin,
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PATCH", "DELETE"],
});
await app.register(cookie);

app.get("/api/health", async () => ({ ok: true }));

await app.register(meRoutes);
await app.register(orgRoutes);
await app.register(marcarRoutes);
await app.register(sucursalesRoutes);
await app.register(empleadosRoutes);
await app.register(asistenciaRoutes);
await app.register(horasRoutes);
await app.register(turnosRoutes);
await app.register(adminRoutes);
await app.register(placesRoutes);

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  reply.status(500).send({ error: "Algo salió mal. Probá de nuevo." });
});

app.listen({ port: env.port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
