import * as v from "valibot";
import { defineRoute } from "@skyjt/typed-routes-solid";
import { usersStore, type UserRecord } from "../../../services/db";

export const route = defineRoute({
  search: v.object({
    q: v.optional(v.string(), ""),
    role: v.optional(v.picklist(["all", "admin", "engineer", "operator"]), "all"),
    limit: v.optional(v.number(), 20),
  }),
});

export const GET = route.handler(async (event) => {
  const { q, role, limit } = event.search;

  const query = q.toLowerCase();
  let list = usersStore.filter((u) => u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query));

  if (role !== "all") {
    list = list.filter((u) => u.role === role);
  }

  return Response.json({
    success: true,
    total: list.length,
    users: list.slice(0, limit),
  });
});

export const POST = route.handler(async (event) => {
  try {
    const body = (await event.request.json()) as Partial<UserRecord>;
    if (!body.name || !body.email || !body.role) {
      return Response.json(
        { success: false, error: "Missing required fields: name, email, role" },
        { status: 400 },
      );
    }

    const newUser: UserRecord = {
      id: usersStore.length > 0 ? Math.max(...usersStore.map((u) => u.id)) + 1 : 1,
      name: body.name,
      email: body.email,
      role: body.role as UserRecord["role"],
      status: "active",
      createdAt: new Date().toISOString(),
    };

    usersStore.push(newUser);
    return Response.json({ success: true, user: newUser }, { status: 201 });
  } catch {
    return Response.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }
});