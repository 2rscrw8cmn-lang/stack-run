import { describe, expect, it } from "vitest";
import handler, { serveOpenApiSpec } from "./openapi.js";
import { openApiSpec } from "./_openapiSpec.js";

const request = (method = "GET") => new Request("https://stack.test/api/openapi", { method });

describe("OpenAPI spec endpoint", () => {
  it("answers only GET", async () => {
    const response = await serveOpenApiSpec(request("POST"));
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET");
  });

  it("serves the exact spec object as JSON, with no user-specific caching", async () => {
    const response = await serveOpenApiSpec(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(response.headers.get("Cache-Control")).not.toBe("no-store");
    expect(await response.json()).toEqual(openApiSpec);
  });

  it("the default handler answers a plain Request the same way", async () => {
    const response = (await handler(request())) as Response;
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(openApiSpec);
  });
});
