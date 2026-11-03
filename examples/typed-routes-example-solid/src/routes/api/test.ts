import { defineRoute, HttpError, json } from "@skyjt/typed-routes-solid";
import * as v from "valibot";

export const route = defineRoute({
  headers: v.object({
    authorization: v.optional(
      v.pipe(
        v.string(),
        v.nonEmpty("Authorization header is required"),
        v.regex(/^Bearer\s.+$/, "Authorization header must be a Bearer token"),
        v.transform((value) => value.replace(/^Bearer\s+/, "")),
        v.jwsCompact("Token must be a valid JWS compact serialization"),
      ),
    ),
  }),
});

export const GET = route.handler(async (event) => {
  const token = event.headers.authorization;

  if (!token) {
    throw HttpError.unauthorized("Authorization header is required");
  }

  // `token` is already stripped of "Bearer " and validated as JWS compact!
  return json({ success: true, message: "Authorized", token });
});