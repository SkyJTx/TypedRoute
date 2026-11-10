/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { describe, expect, it, vi } from "vitest";
import * as v from "valibot";
import { z } from "zod";
import {
  HttpError,
  buildCrossAppUrl,
  createClient,
  createMiddleware,
  createOpenAPIHandler,
  createPaths,
  defineRoute,
  generateOpenAPISpec,
  getTypedResponseMeta,
  joinBaseAndPath,
  json,
  navigateCrossApp,
  noContent,
  problem,
  redirect,
  schemaToJsonSchema,
  text,
} from "../src/index";

describe("Cross-App Typed Navigation", () => {
  const storefrontManifest = [
    { path: "/", page: true },
    { path: "/products/:slug", page: true },
  ] as const;

  const adminManifest = [
    { path: "/", page: true },
    { path: "/users/:id", page: true },
  ] as const;

  const docsManifest = [
    { path: "/guides/:topic", page: true },
  ] as const;

  type AppRegistry = {
    admin: typeof adminManifest;
    docs: typeof docsManifest;
  };

  it("joins base URLs and relative paths cleanly without duplicate slashes", () => {
    expect(joinBaseAndPath("https://admin.example.com/", "/users/42")).toBe(
      "https://admin.example.com/users/42",
    );
    expect(joinBaseAndPath("/docs/", "/guides/openapi?tab=schema#top")).toBe(
      "/docs/guides/openapi?tab=schema#top",
    );
    expect(joinBaseAndPath("", "/users/42")).toBe("/users/42");
    expect(
      buildCrossAppUrl("https://admin.example.com", "/users/:id", {
        params: { id: 12 },
      }),
    ).toBe("https://admin.example.com/users/12");
  });

  it("builds local and cross-app URLs via unified createPaths overloads", () => {
    const paths = createPaths<typeof storefrontManifest, AppRegistry>({
      admin: { baseUrl: "https://admin.example.com" },
      docs: { baseUrl: "/docs" },
    });

    // 2-argument local overload
    const localHref = paths.build("/products/:slug", {
      params: { slug: "mechanical-keyboard" },
      search: { color: "graphite" },
      hash: "specs",
    });
    expect(localHref).toBe("/products/mechanical-keyboard?color=graphite#specs");

    // 3-argument cross-app overload (cross-origin)
    const adminHref = paths.build("admin", "/users/:id", {
      params: { id: "u_99" },
      search: { tab: "permissions" },
    });
    expect(adminHref).toBe("https://admin.example.com/users/u_99?tab=permissions");

    // 3-argument cross-app overload (sub-path micro-frontend)
    const docsHref = paths.build("docs", "/guides/:topic", {
      params: { topic: "routing" },
      hash: "cross-app",
    });
    expect(docsHref).toBe("/docs/guides/routing#cross-app");
  });

  it("throws a descriptive error when an unconfigured app key is used", () => {
    const paths = createPaths<typeof storefrontManifest, AppRegistry>({
      admin: { baseUrl: "https://admin.example.com" },
      docs: { baseUrl: "/docs" },
    });
    expect(() =>
      (paths.build as (app: string, to: string) => string)("unknown", "/"),
    ).toThrow(/Unknown external application "unknown"/);
  });

  it("delegates cross-app navigation to custom onNavigate handler when configured", () => {
    const onNavigate = vi.fn();
    const adminConfig = {
      baseUrl: "https://admin.example.com",
      onNavigate,
    };

    const url = navigateCrossApp(adminConfig, "/users/:id", {
      params: { id: 7 },
      replace: true,
    });

    expect(url).toBe("https://admin.example.com/users/7");
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith("https://admin.example.com/users/7", {
      replace: true,
      target: undefined,
    });
  });
});

describe("TypedResponse Introspection & RFC 9457 Problem Details", () => {
  it("attaches non-enumerable TYPED_RESPONSE_META to json, problem, text, noContent, and redirect", async () => {
    const okRes = json({ id: 1 }, { status: 201 });
    const okMeta = getTypedResponseMeta(okRes);
    expect(okMeta).toEqual({
      status: 201,
      contentType: "application/json",
      body: { id: 1 },
      schema: undefined,
    });

    const probRes = problem(422, "Invalid payload", {
      code: "ERR_INVALID",
      target: "body",
      issues: [{ message: "Required", path: "email" }],
    });
    expect(probRes.status).toBe(422);
    expect(probRes.headers.get("content-type")).toBe(
      "application/problem+json; charset=utf-8",
    );
    const probMeta = getTypedResponseMeta(probRes);
    expect(probMeta?.status).toBe(422);
    expect(probMeta?.contentType).toBe("application/problem+json");
    const probBody = await probRes.json();
    expect(probBody).toMatchObject({
      type: "about:blank",
      title: "Unprocessable Content",
      status: 422,
      detail: "Invalid payload",
      code: "ERR_INVALID",
      target: "body",
    });

    expect(getTypedResponseMeta(text("pong"))?.contentType).toBe("text/plain");
    expect(getTypedResponseMeta(noContent())?.status).toBe(204);
    expect(getTypedResponseMeta(redirect("/home", 308))?.status).toBe(308);
  });
});

describe("OpenAPI 3.1 Generation, UI Presets, Custom Vendors & Error Reflection", () => {
  const userRoute = defineRoute({
    params: v.object({
      id: v.string(),
    }),
    search: v.object({
      verbose: v.optional(v.boolean()),
    }),
  });

  const GET = userRoute.handler(
    {
      openapi: {
        summary: "Get user by ID",
        description: "Returns a single user record.",
        tags: ["Users"],
        operationId: "getUserById",
      },
      responses: {
        200: v.object({
          user: v.object({
            id: v.string(),
            name: v.string(),
            role: v.picklist(["admin", "editor", "viewer"]),
          }),
        }),
      },
    },
    ({ params }) =>
      json({ user: { id: params.id, name: "Ada", role: "admin" as const } }),
  );

  const POST = defineRoute({}).handler(
    {
      openapi: {
        summary: "Create item with Zod schema",
        tags: ["Items"],
      },
      body: z.object({
        title: z.string(),
        count: z.number().int(),
        tags: z.array(z.string()).optional(),
      }),
      responses: {
        201: z.object({
          created: z.boolean(),
        }),
      },
    },
    () => json({ created: true }, { status: 201 }),
  );

  const routes = [
    {
      path: "/api/users/:id",
      $$route: { require: () => ({ route: userRoute }) },
      $GET: { require: () => ({ GET }) },
    },
    {
      path: "/api/items/",
      $POST: { require: () => ({ POST }) },
    },
    {
      path: "/dashboard",
      page: true,
    },
  ] as const;

  it("converts both Valibot and Zod Standard Schemas to JSON Schema", () => {
    const valibotSchema = v.object({
      name: v.string(),
      role: v.picklist(["admin", "user"]),
      nickname: v.nullable(v.string()),
    });
    const convertedValibot = schemaToJsonSchema(valibotSchema);
    expect(convertedValibot.type).toBe("object");
    expect(convertedValibot.properties?.name).toEqual({ type: "string" });
    expect(convertedValibot.properties?.role).toEqual({
      type: "string",
      enum: ["admin", "user"],
    });

    const zodSchema = z.object({
      email: z.string(),
      active: z.boolean(),
    });
    const convertedZod = schemaToJsonSchema(zodSchema);
    expect(convertedZod.type).toBe("object");
    expect(convertedZod.properties?.email).toMatchObject({ type: "string" });
    expect(convertedZod.properties?.active).toMatchObject({ type: "boolean" });
  });

  it("generates OpenAPI 3.1.0 spec with default RFC 9457 error responses", async () => {
    const spec = await generateOpenAPISpec(routes, {
      info: {
        title: "Test API",
        version: "2.0.0",
      },
    });

    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info.title).toBe("Test API");
    expect(spec.paths["/dashboard"]).toBeUndefined();

    const userOp = spec.paths["/api/users/{id}"]?.get;
    expect(userOp).toBeDefined();
    expect(userOp?.summary).toBe("Get user by ID");
    expect(userOp?.operationId).toBe("getUserById");
    expect(userOp?.tags).toEqual(["Users"]);
    expect(userOp?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "id", in: "path", required: true }),
        expect.objectContaining({ name: "verbose", in: "query", required: false }),
      ]),
    );
    expect(
      userOp?.responses["200"]?.content?.["application/json"]?.schema,
    ).toMatchObject({
      type: "object",
    });
    expect(
      userOp?.responses["400"]?.content?.["application/problem+json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/ValidationProblemDetails",
    });
    expect(
      userOp?.responses["default"]?.content?.["application/problem+json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/ProblemDetails",
    });

    // Trailing slash "/api/items/" is normalized to "/api/items"
    const itemPostOp = spec.paths["/api/items"]?.post;
    expect(itemPostOp).toBeDefined();
    expect(itemPostOp?.requestBody?.required).toBe(true);
    expect(
      itemPostOp?.responses["201"]?.content?.["application/json"]?.schema,
    ).toMatchObject({
      type: "object",
    });
  });

  it("dynamically reflects custom onValidationError and onApiError in OpenAPI responses", async () => {
    const spec = await generateOpenAPISpec(routes, {
      info: { title: "Custom Error API", version: "1.0.0" },
      onValidationError({ error }) {
        return json(
          {
            ok: false,
            failedTarget: error.target,
            issueCount: error.issues.length,
          },
          { status: 422 },
        );
      },
      onApiError({ error }) {
        return json(
          {
            ok: false,
            code: error.code ?? "CUSTOM_ERROR",
            reason: error.message,
          },
          { status: 503 },
        );
      },
    });

    const userOp = spec.paths["/api/users/{id}"]?.get;
    expect(userOp?.responses["422"]).toBeDefined();
    expect(userOp?.responses["400"]).toBeUndefined();
    expect(
      userOp?.responses["422"]?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/ValidationErrorResponse",
    });
    expect(spec.components?.schemas?.ValidationErrorResponse).toMatchObject({
      type: "object",
      properties: {
        ok: { type: "boolean" },
        failedTarget: { type: "string" },
        issueCount: { type: "integer" },
      },
    });

    expect(
      userOp?.responses["default"]?.content?.["application/json"]?.schema,
    ).toEqual({
      $ref: "#/components/schemas/ApiErrorResponse",
    });
    expect(spec.components?.schemas?.ApiErrorResponse).toMatchObject({
      type: "object",
      properties: {
        ok: { type: "boolean" },
        code: { type: "string" },
        reason: { type: "string" },
      },
    });
  });

  it("serves built-in UI presets and custom UI vendor renderers via createOpenAPIHandler and createMiddleware", async () => {
    const scalarHandler = createOpenAPIHandler(routes, {
      info: { title: "Docs Test", version: "1.0.0" },
      ui: "scalar",
    });
    const scalarRes = await scalarHandler.handle(new Request("http://localhost/docs"));
    expect(scalarRes?.status).toBe(200);
    expect(await scalarRes?.text()).toContain("@scalar/api-reference");

    const swaggerHandler = createOpenAPIHandler(routes, {
      info: { title: "Docs Test", version: "1.0.0" },
      ui: "swagger",
    });
    expect(
      await (await swaggerHandler.handle(new Request("http://localhost/docs")))?.text(),
    ).toContain("SwaggerUIBundle");

    const redocHandler = createOpenAPIHandler(routes, {
      info: { title: "Docs Test", version: "1.0.0" },
      ui: "redoc",
    });
    expect(
      await (await redocHandler.handle(new Request("http://localhost/docs")))?.text(),
    ).toContain("redoc.standalone.js");

    const stoplightHandler = createOpenAPIHandler(routes, {
      info: { title: "Docs Test", version: "1.0.0" },
      ui: "stoplight",
    });
    expect(
      await (await stoplightHandler.handle(new Request("http://localhost/docs")))?.text(),
    ).toContain("@stoplight/elements");

    // Custom UI vendor renderer function
    const customVendorHandler = createOpenAPIHandler(routes, {
      info: { title: "Vendor Docs", version: "1.0.0" },
      ui: ({ specUrl, title }) =>
        `<!doctype html><html><head><title>${title}</title></head><body data-spec="${specUrl}">Custom RapiDoc</body></html>`,
    });
    const vendorRes = await customVendorHandler.handle(
      new Request("http://localhost/docs"),
    );
    expect(vendorRes?.status).toBe(200);
    const vendorHtml = await vendorRes?.text();
    expect(vendorHtml).toContain('data-spec="/openapi.json"');
    expect(vendorHtml).toContain("Custom RapiDoc");

    // Integrated via createMiddleware
    const mw = createMiddleware(routes, {
      openapi: {
        info: { title: "Integrated API", version: "1.0.0" },
      },
    });
    const specRes = await mw(
      new Request("http://localhost/openapi.json"),
      async () => new Response("Not Found", { status: 404 }),
    );
    expect(specRes.status).toBe(200);
    const specJson = await specRes.json();
    expect(specJson.info.title).toBe("Integrated API");
  });
});

describe("End-to-End Type Safety Request Client (createClient)", () => {
  const userListRoute = defineRoute({
    search: v.object({
      role: v.optional(v.picklist(["admin", "member"])),
    }),
  });

  const userItemRoute = defineRoute({
    params: v.object({
      id: v.number(),
    }),
  });

  const listGET = userListRoute.handler(
    {
      responses: {
        200: v.object({
          users: v.array(
            v.object({
              id: v.number(),
              name: v.string(),
              role: v.picklist(["admin", "member"]),
            }),
          ),
        }),
      },
    },
    ({ search }) => {
      const all = [
        { id: 1, name: "Wriothesley", role: "admin" as const },
        { id: 2, name: "Sigewinne", role: "member" as const },
      ];
      const filtered = search.role
        ? all.filter((u) => u.role === search.role)
        : all;
      return json({ users: filtered });
    },
  );

  const listPOST = userListRoute.handler(
    {
      body: v.object({
        name: v.string(),
        role: v.picklist(["admin", "member"]),
      }),
      responses: {
        201: v.object({
          user: v.object({
            id: v.number(),
            name: v.string(),
            role: v.picklist(["admin", "member"]),
          }),
        }),
      },
    },
    ({ body }) =>
      json({ user: { id: 3, name: body.name, role: body.role } }, { status: 201 }),
  );

  const itemGET = userItemRoute.handler(
    {
      responses: {
        200: v.object({
          id: v.number(),
          name: v.string(),
        }),
      },
    },
    ({ params }) => {
      if (params.id === 404) {
        throw HttpError.notFound("Duke not found", {
          code: "USER_NOT_FOUND",
          details: { requestedId: params.id },
        });
      }
      return json({ id: params.id, name: "Wriothesley" });
    },
  );

  const itemDELETE = userItemRoute.handler(
    {
      responses: {
        200: v.object({
          deleted: v.boolean(),
        }),
      },
    },
    () => json({ deleted: true }),
  );

  const routes = [
    {
      path: "/api/users/",
      $$route: { require: () => ({ route: userListRoute }) },
      $GET: { require: () => ({ GET: listGET }) },
      $POST: { require: () => ({ POST: listPOST }) },
    },
    {
      path: "/api/users/:id",
      $$route: { require: () => ({ route: userItemRoute }) },
      $GET: { require: () => ({ GET: itemGET }) },
      $DELETE: { require: () => ({ DELETE: itemDELETE }) },
    },
  ] as const;

  const mw = createMiddleware(routes);
  const localFetch: typeof fetch = (input, init) => {
    const req =
      input instanceof Request
        ? input
        : new Request(String(input), init);
    return mw(req, async () => new Response("Not Found", { status: 404 }));
  };

  it("returns [data, undefined] on successful GET, POST, and DELETE calls with trailing-slash normalization", async () => {
    const onRequest = vi.fn();
    const onResponse = vi.fn();

    const client = createClient<typeof routes>({
      baseUrl: "http://localhost",
      fetch: localFetch,
      onRequest,
      onResponse,
    });

    const [listData, listErr] = await client.get("/api/users", {
      query: { role: "admin" },
    });
    expect(listErr).toBeUndefined();
    expect(listData?.users).toEqual([
      { id: 1, name: "Wriothesley", role: "admin" },
    ]);

    const [createdData, createErr] = await client.post("/api/users", {
      body: { name: "Clorinde", role: "admin" },
    });
    expect(createErr).toBeUndefined();
    expect(createdData?.user).toEqual({
      id: 3,
      name: "Clorinde",
      role: "admin",
    });

    const [delData, delErr] = await client.delete("/api/users/:id", {
      params: { id: 1 },
    });
    expect(delErr).toBeUndefined();
    expect(delData).toEqual({ deleted: true });
    expect(onRequest).toHaveBeenCalledTimes(3);
    expect(onResponse).toHaveBeenCalledTimes(3);
  });

  it("returns [undefined, ProblemDetails] conforming to RFC 9457 on validation and HttpError failures", async () => {
    const client = createClient<typeof routes>({
      baseUrl: "http://localhost",
      fetch: localFetch,
    });

    // 404 HttpError
    const [missingData, missingErr] = await client.get("/api/users/:id", {
      params: { id: 404 },
    });
    expect(missingData).toBeUndefined();
    expect(missingErr).toEqual({
      type: "about:blank",
      title: "Not Found",
      status: 404,
      detail: "Duke not found",
      instance: "/api/users/404",
      code: "USER_NOT_FOUND",
      details: { requestedId: 404 },
    });

    // 400 Validation Error (passing invalid query at runtime)
    const [invalidData, invalidErr] = await client.get("/api/users", {
      query: { role: "invalid-role" as unknown as "admin" },
    });
    expect(invalidData).toBeUndefined();
    expect(invalidErr?.type).toBe("https://datatracker.ietf.org/doc/html/rfc9457");
    expect(invalidErr?.title).toBe("Bad Request");
    expect(invalidErr?.status).toBe(400);
    expect(invalidErr?.target).toBe("search");
    expect(Array.isArray(invalidErr?.issues)).toBe(true);
  });

  it("normalizes network failures into RFC 9457 ProblemDetails with status 0", async () => {
    const failingClient = createClient<typeof routes>({
      baseUrl: "http://localhost",
      fetch: async () => {
        throw new Error("Socket hang up");
      },
    });

    const [data, error] = await failingClient.get("/api/users");
    expect(data).toBeUndefined();
    expect(error).toEqual({
      type: "about:blank",
      title: "Network Error",
      status: 0,
      detail: "Socket hang up",
      instance: "/api/users",
    });
  });
});
