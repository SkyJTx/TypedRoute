import * as v from "valibot";
import { defineRoute, json } from "@skyjt/typed-routes-solid";
import { usersStore, type UserRecord } from "~/services/db";

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
  let list = usersStore.filter(
    (u) => u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query),
  );

  if (role !== "all") {
    list = list.filter((u) => u.role === role);
  }

  return json({
    success: true,
    total: list.length,
    users: list.slice(0, limit),
  });
});

const createUserBodySchema = v.object({
  name: v.pipe(v.string(), v.nonEmpty("Name is required")),
  email: v.pipe(v.string(), v.nonEmpty("Email is required")),
  role: v.picklist(["admin", "engineer", "operator"]),
});

export const POST = route.handler(
  {
    body: createUserBodySchema,
  },
  async (event) => {
    const { name, email, role } = event.body;

    const newUser: UserRecord = {
      id: usersStore.length > 0 ? Math.max(...usersStore.map((u) => u.id)) + 1 : 1,
      name,
      email,
      role,
      status: "active",
      createdAt: new Date().toISOString(),
    };

    usersStore.push(newUser);
    return json({ success: true, user: newUser }, 201);
  },
);
