import routes from "virtual:file-routes";
import { createMiddleware } from "@skyjt/typed-routes-solid";

export const apiMiddleware = createMiddleware(routes, {
  base: "/",
  onValidationError({ error, rawParams, rawSearch, isPage }) {
    if (isPage) {
      return;
    }
    return Response.json(
      {
        success: false,
        error: "Route Validation Error",
        target: error.target,
        issues: error.issues,
        received: { params: rawParams, search: rawSearch },
      },
      { status: 400 },
    );
  },
});

export default apiMiddleware;