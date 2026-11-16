/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { extractRequestPathname } from "~/middleware/error-handlers";
import { json } from "~/router/api-response";
import type {
  OpenAPIDocument,
  OpenAPIOptions,
  OpenAPIUIOption,
  OpenAPIUIRendererContext,
} from "~/types/openapi";
import type { MiddlewareRouteEntry } from "~/types/route-definition";
import { generateOpenAPISpec } from "./generator";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function serializeInlineJsString(value: string): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function renderScalarHtml(ctx: OpenAPIUIRendererContext): string {
  const safeTitle = escapeHtml(ctx.title);
  const safeSpecUrl = escapeHtml(ctx.specUrl);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
  </head>
  <body>
    <script id="api-reference" data-url="${safeSpecUrl}"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;
}

function renderSwaggerHtml(ctx: OpenAPIUIRendererContext): string {
  const safeTitle = escapeHtml(ctx.title);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({ url: ${serializeInlineJsString(ctx.specUrl)}, dom_id: "#swagger-ui" });
    </script>
  </body>
</html>`;
}

function renderRedocHtml(ctx: OpenAPIUIRendererContext): string {
  const safeTitle = escapeHtml(ctx.title);
  const safeSpecUrl = escapeHtml(ctx.specUrl);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
  </head>
  <body>
    <redoc spec-url="${safeSpecUrl}"></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
  </body>
</html>`;
}

function renderStoplightHtml(ctx: OpenAPIUIRendererContext): string {
  const safeTitle = escapeHtml(ctx.title);
  const safeSpecUrl = escapeHtml(ctx.specUrl);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <link rel="stylesheet" href="https://unpkg.com/@stoplight/elements/styles.min.css" />
    <script src="https://unpkg.com/@stoplight/elements/web-components.min.js"></script>
  </head>
  <body>
    <elements-api apiDescriptionUrl="${safeSpecUrl}" router="hash" layout="sidebar"></elements-api>
  </body>
</html>`;
}

/**
 * Renders the interactive OpenAPI documentation HTML response for a built-in preset
 * (`"scalar"`, `"swagger"`, `"redoc"`, `"stoplight"`) or custom vendor renderer.
 */
export async function renderOpenAPIUI(
  context: OpenAPIUIRendererContext,
  ui: OpenAPIUIOption = "scalar",
): Promise<Response> {
  if (typeof ui === "function") {
    const customResult = await ui(context);
    if (customResult instanceof Response) {
      return customResult;
    }
    return new Response(customResult, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  if (typeof ui === "object" && ui !== null && typeof ui.render === "function") {
    const customResult = await ui.render(context);
    if (customResult instanceof Response) {
      return customResult;
    }
    return new Response(customResult, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  let html: string;
  switch (ui) {
    case "swagger":
      html = renderSwaggerHtml(context);
      break;
    case "redoc":
      html = renderRedocHtml(context);
      break;
    case "stoplight":
      html = renderStoplightHtml(context);
      break;
    case "scalar":
    default:
      html = renderScalarHtml(context);
      break;
  }

  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export interface OpenAPIHandlerController {
  readonly specPath: string;
  readonly docsPath: string;
  spec(): Promise<OpenAPIDocument>;
  handle(request: Request): Promise<Response | undefined>;
}

/**
 * Creates a standalone OpenAPI 3.1 specification and UI request handler.
 * Caches the generated specification document after the first resolution.
 */
export function createOpenAPIHandler(
  routes: readonly MiddlewareRouteEntry[],
  options: OpenAPIOptions = {},
): OpenAPIHandlerController {
  const specPath = options.specPath ?? "/openapi.json";
  const docsPath = options.docsPath ?? "/docs";
  const uiOption: OpenAPIUIOption = options.ui === undefined ? "scalar" : options.ui;
  let cachedSpecPromise: Promise<OpenAPIDocument> | undefined;

  function getSpec(): Promise<OpenAPIDocument> {
    if (!cachedSpecPromise) {
      cachedSpecPromise = generateOpenAPISpec(routes, options);
    }
    return cachedSpecPromise;
  }

  async function handle(request: Request): Promise<Response | undefined> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return undefined;
    }
    const pathname = extractRequestPathname(request.url);
    if (pathname === specPath) {
      const spec = await getSpec();
      return json(spec, 200);
    }
    if (uiOption !== false && pathname === docsPath) {
      const spec = await getSpec();
      return renderOpenAPIUI(
        {
          specUrl: specPath,
          spec,
          title: spec.info.title,
        },
        uiOption,
      );
    }
    return undefined;
  }

  return {
    specPath,
    docsPath,
    spec: getSpec,
    handle,
  };
}
