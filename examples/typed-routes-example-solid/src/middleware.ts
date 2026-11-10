import routes from "virtual:file-routes";
import { createMiddleware } from "@skyjt/typed-routes-solid";

export const apiMiddleware = createMiddleware(routes, {
  base: "/",
  openapi: {
    info: {
      title: "TypedRoute Solid Example API",
      version: "1.0.0",
      description: "End-to-end type-safe API powered by @skyjt/typed-routes-solid",
    },
    ui: "scalar",
  },
});

export default apiMiddleware;
