import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { requireOrg } from "../plugins/require-org.js";
import { env } from "../env.js";

interface DetailsBody {
  placeId?: string;
  sessionToken?: string;
}

interface GooglePlaceDetails {
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: unknown[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Field mask mínima (SKU Essentials): nada de photos, rating, opening_hours.
const FIELD_MASK = "formattedAddress,location,addressComponents";

export async function placesRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: DetailsBody }>(
    "/api/places/details",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const { placeId, sessionToken } = request.body ?? {};
      if (!placeId) {
        return reply.code(400).send({ error: "El placeId es requerido" });
      }
      if (!env.googleMapsApiKey) {
        return reply.code(500).send({ error: "Falta configurar GOOGLE_MAPS_API_KEY en el servidor" });
      }

      const params = new URLSearchParams({ languageCode: "es" });
      // El session token agrupa la sesión de autocomplete para billing;
      // solo lo reenviamos si es un UUID válido.
      if (sessionToken && UUID_RE.test(sessionToken)) {
        params.set("sessionToken", sessionToken);
      }

      const res = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?${params}`,
        { headers: { "X-Goog-Api-Key": env.googleMapsApiKey, "X-Goog-FieldMask": FIELD_MASK } }
      );
      if (!res.ok) {
        request.log.warn({ status: res.status }, "Falló Place Details de Google");
        return reply.code(502).send({ error: "No pudimos resolver la dirección. Probá de nuevo." });
      }

      const data = (await res.json()) as GooglePlaceDetails;
      return {
        formattedAddress: data.formattedAddress ?? null,
        lat: data.location?.latitude ?? null,
        lng: data.location?.longitude ?? null,
        addressComponents: data.addressComponents ?? [],
      };
    }
  );
}
