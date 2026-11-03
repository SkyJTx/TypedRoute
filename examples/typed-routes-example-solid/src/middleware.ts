import routes from "virtual:file-routes";
import { createMiddleware } from "@skyjt/typed-routes-solid";

export const apiMiddleware = createMiddleware(routes, {
  base: "/",
  onValidationError({ error, rawParams, rawSearch, rawBody, isPage }) {
    if (isPage) {
      return;
    }
    return Response.json(
      {
        success: false,
        error: "Route Validation Error",
        target: error.target,
        issues: error.issues,
        received: { params: rawParams, search: rawSearch, body: rawBody },
      },
      { status: 400 },
    );
  },
  onApiError({ error }) {
    return Response.json(
      {
        success: false,
        error: error.message,
        status: error.status,
        ...(error.code !== undefined ? { code: error.code } : {}),
        ...(error.details !== undefined ? { details: error.details } : {}),
      },
      { status: error.status },
    );
  },
});

export default apiMiddleware;
