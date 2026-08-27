/**
 * Serves `api/_openapiSpec.ts` as JSON — the one document ChatGPT's Custom
 * GPT "Actions" needs before it can call any external-assistant endpoint
 * (#178/#180, this slice adding the schema #181 deliberately deferred).
 *
 * Unlike every other route in `api/`, this one takes no bearer token and
 * makes no Supabase call: the document is not account-specific, so there is
 * nothing here to authorize or configure. That is also why its response is
 * the one in `api/` safe to let a cache hold onto — every other route sends
 * `no-store` because its body is a specific runner's data.
 */

import { openApiSpec } from "./_openapiSpec.js";

function json(status: number, body: object, extra?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      ...extra,
    },
  });
}

export async function serveOpenApiSpec(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return json(
      405,
      { error: "method_not_allowed", message: "STACK OpenAPI spec: deployed and ready. It answers GET only." },
      { Allow: "GET" },
    );
  }
  return json(200, openApiSpec);
}

/**
 * The shape of a Node request/response, described here rather than imported,
 * so this needs no `@types/node` for a path that may never be taken. Mirrors
 * `api/training-context.ts`'s handler exactly.
 */
interface NodeResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

interface NodeRequest {
  method?: string;
  url?: string;
}

function isNodeResponse(value: unknown): value is NodeResponse {
  return typeof (value as NodeResponse | null | undefined)?.end === "function";
}

export default async function handler(first: unknown, second?: unknown): Promise<Response | void> {
  if (!isNodeResponse(second)) return serveOpenApiSpec(first as Request);

  const request = first as NodeRequest;
  const response = await serveOpenApiSpec(
    new Request(`https://reader.invalid${request.url ?? "/api/openapi"}`, {
      method: request.method ?? "GET",
    }),
  );

  second.statusCode = response.status;
  response.headers.forEach((value, name) => second.setHeader(name, value));
  second.end(await response.text());
}
