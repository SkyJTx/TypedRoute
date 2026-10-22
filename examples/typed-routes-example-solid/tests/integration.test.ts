import { describe, it, expect, vi } from "vitest";
import { apiMiddleware } from "~/middleware";
import { app } from "../server/index";

describe("TypedRoute Solid 2 RC Example — Comprehensive Integration Suite", () => {
  describe("1. API Middleware — Success Cases", () => {
    it("dispatches GET /api/health returning status healthy", async () => {
      const req = new Request("http://localhost:3000/api/health");
      const res = await apiMiddleware(req, () => new Response("Not found", { status: 404 }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe("healthy");
      expect(typeof json.uptime).toBe("number");
    });

    it("dispatches GET /api/users with default schema search parameters", async () => {
      const req = new Request("http://localhost:3000/api/users");
      const res = await apiMiddleware(req, () => new Response("Not found", { status: 404 }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.users)).toBe(true);
      expect(json.users.length).toBeGreaterThan(0);
    });

    it("dispatches GET /api/users with validated role filter and coerced numeric limit", async () => {
      const req = new Request("http://localhost:3000/api/users?role=admin&limit=1");
      const res = await apiMiddleware(req, () => new Response("Not found", { status: 404 }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.users).toHaveLength(1);
      expect(json.users[0].role).toBe("admin");
    });

    it("coerces and validates path parameter on GET /api/users/:id via route.handler()", async () => {
      const req = new Request("http://localhost:3000/api/users/1");
      const res = await apiMiddleware(req, () => new Response("Not found", { status: 404 }));
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.user.id).toBe(1);
    });

    it("creates a new user via POST /api/users and removes it via DELETE /api/users/:id", async () => {
      const postReq = new Request("http://localhost:3000/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Sigewinne",
          email: "sigewinne@meropide.fontaine",
          role: "operator",
        }),
      });
      const postRes = await apiMiddleware(postReq, () => new Response("Not found", { status: 404 }));
      expect(postRes.status).toBe(201);
      const created = await postRes.json();
      expect(created.success).toBe(true);
      expect(typeof created.user.id).toBe("number");

      const deleteReq = new Request(`http://localhost:3000/api/users/${created.user.id}`, {
        method: "DELETE",
      });
      const deleteRes = await apiMiddleware(deleteReq, () => new Response("Not found", { status: 404 }));
      expect(deleteRes.status).toBe(200);
      const deleted = await deleteRes.json();
      expect(deleted.success).toBe(true);
      expect(deleted.removed.id).toBe(created.user.id);
    });
  });

  describe("2. API Middleware — Expected Failure Cases (isPage: false)", () => {
    it("rejects invalid picklist search parameter on GET /api/users with 400 Bad Request", async () => {
      const req = new Request("http://localhost:3000/api/users?role=invalid_role");
      const res = await apiMiddleware(req, () => new Response("Not found", { status: 404 }));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("Route Validation Error");
      expect(json.target).toBe("search");
      expect(json.received.search).toEqual({ role: "invalid_role" });
    });

    it("rejects non-numeric limit search parameter on GET /api/users with 400 Bad Request", async () => {
      const req = new Request("http://localhost:3000/api/users?limit=not-a-number");
      const res = await apiMiddleware(req, () => new Response("Not found", { status: 404 }));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.target).toBe("search");
      expect(json.received.search).toEqual({ limit: "not-a-number" });
    });

    it("rejects non-numeric path parameter on GET /api/users/:id with 400 Bad Request", async () => {
      const req = new Request("http://localhost:3000/api/users/not-a-number");
      const res = await apiMiddleware(req, () => new Response("Not found", { status: 404 }));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("Route Validation Error");
      expect(json.target).toBe("params");
      expect(json.received.params).toEqual({ id: "not-a-number" });
    });

    it("rejects non-numeric path parameter on DELETE /api/users/:id with 400 Bad Request", async () => {
      const req = new Request("http://localhost:3000/api/users/invalid-id", { method: "DELETE" });
      const res = await apiMiddleware(req, () => new Response("Not found", { status: 404 }));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.target).toBe("params");
    });

    it("returns 404 Not Found for valid numeric ID that does not exist", async () => {
      const req = new Request("http://localhost:3000/api/users/9999");
      const res = await apiMiddleware(req, () => new Response("Not found", { status: 404 }));
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toBe("User not found");
    });

    it("rejects POST /api/users with missing required fields with 400 Bad Request", async () => {
      const req = new Request("http://localhost:3000/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Incomplete User" }),
      });
      const res = await apiMiddleware(req, () => new Response("Not found", { status: 404 }));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  describe("3. UI Page Middleware & Full SSR Integration — Success & Expected Failure Cases (isPage: true)", () => {
    it("falls through to next() on valid UI page request GET /users/1 with coerced params attached", async () => {
      const event = {
        request: new Request("http://localhost:3000/users/1"),
      } as Record<string, unknown> & { request: Request };
      const nextMock = vi.fn().mockResolvedValue(new Response("SSR Page", { status: 200 }));

      const res = await apiMiddleware(event, nextMock);
      expect(res.status).toBe(200);
      expect(event.params).toEqual({ id: 1 });
      expect(event.validationError).toBeUndefined();
      expect(nextMock).toHaveBeenCalledWith();
    });

    it("attaches validationError and falls through to next() on invalid UI page request GET /users/d (isPage: true)", async () => {
      const event = {
        request: new Request("http://localhost:3000/users/d"),
      } as Record<string, unknown> & { request: Request };
      const nextMock = vi.fn().mockResolvedValue(new Response("SSR Error Component", { status: 200 }));

      const res = await apiMiddleware(event, nextMock);
      expect(res.status).toBe(200);
      expect(event.validationError).toBeDefined();
      expect((event.validationError as { target: string }).target).toBe("params");
      expect(nextMock).toHaveBeenCalledWith();
    });

    it("renders valid UI page GET /users/1 via Hono + Solid Start SSR bundle", async () => {
      const req = new Request("http://localhost:3000/users/1");
      const res = await app.fetch(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("x-response-time")).toBeDefined();
      const html = await res.text();
      expect(html).toContain("Personnel Profile #");
    });

    it("renders UI validation error fallback on invalid UI path parameter GET /users/d during SSR without 500 error", async () => {
      const req = new Request("http://localhost:3000/users/d");
      const res = await app.fetch(req);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("Invalid Personnel Identifier");
      expect(html).toContain("Return to Personnel Directory");
    });

    it("renders UI validation error fallback on invalid UI search query GET /users/?role=invalid_role during SSR without 500 error", async () => {
      const req = new Request("http://localhost:3000/users/?role=invalid_role");
      const res = await app.fetch(req);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("Invalid Directory Filter");
      expect(html).toContain("Reset Directory Filters");
    });
  });
});