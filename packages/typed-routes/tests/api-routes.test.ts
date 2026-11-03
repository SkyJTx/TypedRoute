import { describe, expect, expectTypeOf, it } from "vitest";
import * as v from "valibot";
import {
  CUSTOM_INSPECT_SYMBOL,
  HttpError,
  createMiddleware,
  defineMiddleware,
  defineRoute,
  formatHandlerFlags,
  formatRouteFlags,
  getAPIHandlerMeta,
  json,
  noContent,
  parseRequestCookies,
  parseRequestHeaders,
  redirect,
  text,
  type InferHandlerData,
  type InferHandlerInput,
  type InferHandlerOutput,
  type MiddlewareRouteEntry,
  type RouteMethodHandlerFor,
  type StandardSchemaV1,
} from "../src";

const passNext = async () => new Response("Fallthrough", { status: 404 });

describe("Complete Core API Routes Suite", () => {
  describe("1. Per-Method Request Body Validation & Content-Type Parsers", () => {
    it("validates JSON request body via route.handler({ body }, fn) and returns typed json(data, 201)", async () => {
      const route = defineRoute({
        params: v.object({ orgId: v.number() }),
      });

      const POST = route.handler(
        {
          body: v.object({
            username: v.pipe(v.string(), v.minLength(3)),
            level: v.number(),
          }),
        },
        (event) => {
          return json(
            {
              orgId: event.params.orgId,
              createdUser: event.body.username,
              level: event.body.level,
            },
            201,
          );
        },
      );

      const routes: MiddlewareRouteEntry[] = [
        {
          path: "/api/orgs/:orgId/members",
          $$route: { require: () => ({ route }) },
          $POST: { require: () => ({ POST }) },
        },
      ];

      const mw = createMiddleware(routes);

      const validRes = await mw(
        new Request("http://localhost/api/orgs/42/members", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username: "wriothesley", level: 90 }),
        }),
        passNext,
      );
      expect(validRes.status).toBe(201);
      expect(await validRes.json()).toEqual({
        orgId: 42,
        createdUser: "wriothesley",
        level: 90,
      });

      const invalidRes = await mw(
        new Request("http://localhost/api/orgs/42/members", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ username: "ab", level: 90 }),
        }),
        passNext,
      );
      expect(invalidRes.status).toBe(400);
      const errBody = await invalidRes.json();
      expect(errBody.target).toBe("body");
    });

    it("returns 400 validation failure on malformed JSON payload instead of throwing 500", async () => {
      const route = defineRoute({});
      const POST = route.handler(
        { body: v.object({ name: v.string() }) },
        (event) => json(event.body),
      );

      const mw = createMiddleware([
        {
          path: "/api/json",
          $$route: { require: () => ({ route }) },
          $POST: { require: () => ({ POST }) },
        },
      ]);

      const res = await mw(
        new Request("http://localhost/api/json", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{broken-json",
        }),
        passNext,
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.target).toBe("body");
      expect(body.issues[0].message).toContain("Invalid JSON");
    });

    it("parses and coerces application/x-www-form-urlencoded and multipart/form-data bodies", async () => {
      const route = defineRoute({});
      const POST = route.handler(
        {
          body: v.object({
            count: v.number(),
            active: v.boolean(),
          }),
        },
        (event) => json(event.body),
      );

      const mw = createMiddleware([
        {
          path: "/api/form",
          $$route: { require: () => ({ route }) },
          $POST: { require: () => ({ POST }) },
        },
      ]);

      const urlencodedRes = await mw(
        new Request("http://localhost/api/form", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: "count=15&active=true",
        }),
        passNext,
      );
      expect(urlencodedRes.status).toBe(200);
      expect(await urlencodedRes.json()).toEqual({ count: 15, active: true });

      const form = new FormData();
      form.append("count", "7");
      form.append("active", "false");
      const multipartRes = await mw(
        new Request("http://localhost/api/form", {
          method: "POST",
          body: form,
        }),
        passNext,
      );
      expect(multipartRes.status).toBe(200);
      expect(await multipartRes.json()).toEqual({ count: 7, active: false });
    });

    it("parses text/plain and binary ArrayBuffer bodies", async () => {
      const route = defineRoute({});
      const POST = route.handler(
        { body: v.string() },
        (event) => text(`echo:${event.body}`, 200),
      );
      const PUT = route.handler(
        {
          body: (val: unknown) => {
            if (!(val instanceof ArrayBuffer)) {
              throw new Error("Expected ArrayBuffer");
            }
            return val.byteLength;
          },
        },
        (event) => json({ bytes: event.body }),
      );

      const mw = createMiddleware([
        {
          path: "/api/raw",
          $$route: { require: () => ({ route }) },
          $POST: { require: () => ({ POST }) },
          $PUT: { require: () => ({ PUT }) },
        },
      ]);

      const textRes = await mw(
        new Request("http://localhost/api/raw", {
          method: "POST",
          headers: { "content-type": "text/plain" },
          body: "meropide",
        }),
        passNext,
      );
      expect(textRes.status).toBe(200);
      expect(await textRes.text()).toBe("echo:meropide");

      const binRes = await mw(
        new Request("http://localhost/api/raw", {
          method: "PUT",
          headers: { "content-type": "application/octet-stream" },
          body: new Uint8Array([1, 2, 3, 4]),
        }),
        passNext,
      );
      expect(binRes.status).toBe(200);
      expect(await binRes.json()).toEqual({ bytes: 4 });
    });
  });

  describe("2. Headers & Cookies Parsing and Schema Validation", () => {
    it("validates headers and cookies at both route level and handler level", async () => {
      const route = defineRoute({
        headers: v.object({
          "x-api-version": v.number(),
        }),
      });

      const GET = route.handler(
        {
          cookies: v.object({
            session_id: v.pipe(v.string(), v.minLength(4)),
            theme: v.optional(v.string(), "dark"),
          }),
          search: v.object({
            verbose: v.boolean(),
          }),
        },
        (event) =>
          json({
            version: event.headers["x-api-version"],
            session: event.cookies.session_id,
            theme: event.cookies.theme,
            verbose: event.search.verbose,
          }),
      );

      const mw = createMiddleware([
        {
          path: "/api/session",
          $$route: { require: () => ({ route }) },
          $GET: { require: () => ({ GET }) },
        },
      ]);

      const okRes = await mw(
        new Request("http://localhost/api/session?verbose=true", {
          headers: {
            "X-API-Version": "2",
            Cookie: 'session_id="fortress%201"; theme=light',
          },
        }),
        passNext,
      );
      expect(okRes.status).toBe(200);
      expect(await okRes.json()).toEqual({
        version: 2,
        session: "fortress 1",
        theme: "light",
        verbose: true,
      });

      const badCookieRes = await mw(
        new Request("http://localhost/api/session?verbose=true", {
          headers: {
            "X-API-Version": "2",
            Cookie: "session_id=ab",
          },
        }),
        passNext,
      );
      expect(badCookieRes.status).toBe(400);
      expect((await badCookieRes.json()).target).toBe("cookies");

      const badHeaderRes = await mw(
        new Request("http://localhost/api/session?verbose=true", {
          headers: {
            "X-API-Version": "not-a-number",
            Cookie: "session_id=valid123",
          },
        }),
        passNext,
      );
      expect(badHeaderRes.status).toBe(400);
      expect((await badHeaderRes.json()).target).toBe("headers");
    });

    it("guards against prototype pollution keys in headers and cookies", () => {
      const cookies = parseRequestCookies("__proto__=polluted; constructor=bad; valid=ok");
      expect(cookies.valid).toBe("ok");
      expect(Object.prototype.hasOwnProperty.call(cookies, "__proto__")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(cookies, "constructor")).toBe(false);

      const headers = parseRequestHeaders(new Headers({ "X-Valid": "123" }));
      expect(headers["x-valid"]).toBe("123");
    });
  });

  describe("3. Asynchronous Standard Schema v1 & Function Validators", () => {
    it("supports async Standard Schema v1 and async function validators in createMiddleware", async () => {
      const asyncStandardSchema: StandardSchemaV1<{ token: string }, { token: string; verified: boolean }> = {
        "~standard": {
          version: 1,
          vendor: "custom-async",
          async validate(value: unknown) {
            await Promise.resolve();
            if (
              typeof value === "object" &&
              value !== null &&
              "token" in value &&
              (value as { token: unknown }).token === "secret"
            ) {
              return { value: { token: "secret", verified: true } };
            }
            return { issues: [{ message: "Invalid async token", path: ["token"] }] };
          },
        },
      };

      const route = defineRoute({
        params: async (raw: { id: string }) => {
          await Promise.resolve();
          const num = Number(raw.id);
          if (Number.isNaN(num)) {
            throw new Error("Async param id must be numeric");
          }
          return { id: num };
        },
      });

      const POST = route.handler(
        { body: asyncStandardSchema },
        (event) => json({ id: event.params.id, verified: event.body.verified }),
      );

      const mw = createMiddleware([
        {
          path: "/api/async/:id",
          $$route: { require: () => ({ route }) },
          $POST: { require: () => ({ POST }) },
        },
      ]);

      const passRes = await mw(
        new Request("http://localhost/api/async/77", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: "secret" }),
        }),
        passNext,
      );
      expect(passRes.status).toBe(200);
      expect(await passRes.json()).toEqual({ id: 77, verified: true });

      const failRes = await mw(
        new Request("http://localhost/api/async/77", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token: "wrong" }),
        }),
        passNext,
      );
      expect(failRes.status).toBe(400);
      expect((await failRes.json()).target).toBe("body");
    });
  });

  describe("4. Composable Middleware Pipelines (defineMiddleware / use) & Context Merging", () => {
    it("merges typed middleware context across route and handler pipelines and supports short-circuiting", async () => {
      const traceMiddleware = defineMiddleware(() => {
        return { requestId: "req-001" };
      });

      const authMiddleware = defineMiddleware(async (event) => {
        const auth = event.request.headers.get("authorization");
        if (auth !== "Bearer duke-token") {
          return json({ error: "Unauthorized token" }, 401);
        }
        return { user: { name: "Wriothesley", rank: "Duke" } };
      });

      const route = defineRoute({
        use: [traceMiddleware],
      });

      const GET = route.handler(
        {
          use: [authMiddleware],
        },
        (event) => {
          return json({
            user: event.context.user,
            requestId: (event.context as { requestId?: string }).requestId,
          });
        },
      );

      const mw = createMiddleware([
        {
          path: "/api/profile",
          $$route: { require: () => ({ route }) },
          $GET: { require: () => ({ GET }) },
        },
      ]);

      const unauthRes = await mw(new Request("http://localhost/api/profile"), passNext);
      expect(unauthRes.status).toBe(401);
      expect(await unauthRes.json()).toEqual({ error: "Unauthorized token" });

      const authRes = await mw(
        new Request("http://localhost/api/profile", {
          headers: { authorization: "Bearer duke-token" },
        }),
        passNext,
      );
      expect(authRes.status).toBe(200);
      expect(await authRes.json()).toEqual({
        user: { name: "Wriothesley", rank: "Duke" },
        requestId: "req-001",
      });
    });
  });

  describe("5. Typed Response Helpers, Response Schemas & HttpError Handling", () => {
    it("supports noContent(), redirect(), response schema validation, and HttpError serialization", async () => {
      const route = defineRoute({});

      const GET = route.handler(
        {
          search: v.object({ mode: v.string() }),
          responses: {
            200: v.object({ ok: v.boolean(), count: v.number() }),
          },
        },
        (event) => {
          if (event.search.mode === "not-found") {
            throw HttpError.notFound("Record missing", {
              code: "ERR_MISSING",
              details: { lookup: "meropide" },
            });
          }
          if (event.search.mode === "redirect") {
            return redirect("/login", 307);
          }
          if (event.search.mode === "empty") {
            return noContent();
          }
          if (event.search.mode === "invalid-response") {
            return json({ ok: true, count: "wrong-type" as unknown as number }, 200);
          }
          return json({ ok: true, count: 5 }, 200);
        },
      );

      const mw = createMiddleware([
        {
          path: "/api/actions",
          $$route: { require: () => ({ route }) },
          $GET: { require: () => ({ GET }) },
        },
      ]);

      const okRes = await mw(new Request("http://localhost/api/actions?mode=ok"), passNext);
      expect(okRes.status).toBe(200);
      expect(await okRes.json()).toEqual({ ok: true, count: 5 });

      const redirectRes = await mw(new Request("http://localhost/api/actions?mode=redirect"), passNext);
      expect(redirectRes.status).toBe(307);
      expect(redirectRes.headers.get("location")).toBe("/login");

      const emptyRes = await mw(new Request("http://localhost/api/actions?mode=empty"), passNext);
      expect(emptyRes.status).toBe(204);

      const errRes = await mw(new Request("http://localhost/api/actions?mode=not-found"), passNext);
      expect(errRes.status).toBe(404);
      expect(await errRes.json()).toEqual({
        error: "Record missing",
        status: 404,
        code: "ERR_MISSING",
        details: { lookup: "meropide" },
      });

      const badOutputRes = await mw(
        new Request("http://localhost/api/actions?mode=invalid-response"),
        passNext,
      );
      expect(badOutputRes.status).toBe(400);
      expect((await badOutputRes.json()).target).toBe("response");
    });

    it("supports static HttpError factories and custom onApiError callback", async () => {
      expect(HttpError.badRequest().status).toBe(400);
      expect(HttpError.unauthorized().status).toBe(401);
      expect(HttpError.forbidden().status).toBe(403);
      expect(HttpError.conflict().status).toBe(409);
      expect(HttpError.unprocessable().status).toBe(422);
      expect(HttpError.internal().status).toBe(500);

      const route = defineRoute({});
      const GET = route.handler(() => {
        throw HttpError.forbidden("Restricted sector");
      });

      const mw = createMiddleware(
        [
          {
            path: "/api/restricted",
            $$route: { require: () => ({ route }) },
            $GET: { require: () => ({ GET }) },
          },
        ],
        {
          onApiError({ error }) {
            return Response.json(
              { customHandled: true, message: error.message },
              { status: error.status },
            );
          },
        },
      );

      const res = await mw(new Request("http://localhost/api/restricted"), passNext);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({
        customHandled: true,
        message: "Restricted sector",
      });
    });
  });

  describe("6. End-to-End RPC Type Inference & Diagnostic Inspection", () => {
    it("infers handler input, output status/data unions, and inspect metadata", () => {
      const route = defineRoute({
        params: v.object({ id: v.number() }),
        search: v.object({ filter: v.optional(v.string()) }),
      });

      const POST = route.handler(
        {
          body: v.object({ title: v.string() }),
          headers: v.object({ "x-client": v.string() }),
        },
        (event) => {
          return json(
            {
              id: event.params.id,
              title: event.body.title,
              client: event.headers["x-client"],
            },
            201,
          );
        },
      );

      type Input = InferHandlerInput<typeof POST>;
      type Output = InferHandlerOutput<typeof POST>;
      type Data201 = InferHandlerData<typeof POST, 201>;

      expectTypeOf<Input["params"]>().toEqualTypeOf<{ id: number }>();
      expectTypeOf<Input["body"]>().toEqualTypeOf<{ title: string }>();
      expectTypeOf<Input["headers"]>().toEqualTypeOf<{ "x-client": string }>();
      expectTypeOf<Output>().toEqualTypeOf<{
        status: 201;
        data: { id: number; title: string; client: string };
      }>();
      expectTypeOf<Data201>().toEqualTypeOf<{
        id: number;
        title: string;
        client: string;
      }>();

      const manifest = [
        {
          path: "/items/:id",
          $$route: { require: () => ({ route }) },
          $POST: { require: () => ({ POST }) },
        },
      ] as const;

      type ResolvedHandler = RouteMethodHandlerFor<typeof manifest, "/items/:id", "POST">;
      expectTypeOf<ResolvedHandler>().toEqualTypeOf<typeof POST>();

      const meta = getAPIHandlerMeta(POST);
      expect(meta).toBeDefined();
      const inspected = meta![CUSTOM_INSPECT_SYMBOL]();
      expect(inspected.bodyValidator).toBe("StandardSchema(valibot)");
      expect(formatHandlerFlags(meta!.flags)).toEqual([
        "HAS_BODY_SCHEMA",
        "HAS_HEADERS_SCHEMA",
      ]);
      expect(formatRouteFlags(1 << 5)).toEqual(["HAS_HEADERS_SCHEMA"]);
    });
  });
});
