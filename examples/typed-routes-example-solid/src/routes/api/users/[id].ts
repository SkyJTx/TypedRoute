import * as v from "valibot";
import { defineRoute, HttpError, json } from "@skyjt/typed-routes-solid";
import { usersStore } from "~/services/db";

export const route = defineRoute({
  params: v.object({
    id: v.number(),
  }),
});

export const GET = route.handler(async (event) => {
  const userId = event.params.id;
  const user = usersStore.find((u) => u.id === userId);

  if (!user) {
    throw HttpError.notFound("User not found");
  }

  return json({ success: true, user });
});

export const DELETE = route.handler(async (event) => {
  const userId = event.params.id;
  const index = usersStore.findIndex((u) => u.id === userId);

  if (index === -1) {
    throw HttpError.notFound("User not found");
  }

  const [removed] = usersStore.splice(index, 1);
  return json({ success: true, removed });
});