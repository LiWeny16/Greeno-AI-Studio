import type { FastifyRequest } from "fastify";

const allowedOrigins = new Set(["http://127.0.0.1:5173"]);

export function assertBrowserOrigin(request: FastifyRequest): void {
  const origin = request.headers.origin;
  if (!origin) {
    return;
  }

  if (origin === "null" || !allowedOrigins.has(origin)) {
    throw new Error("Rejected browser origin");
  }
}
