import * as v from "valibot";
import { defineRoute, json } from "@skyjt/typed-routes-solid";

export const route = defineRoute({});

export const GET = route.handler(
  {
    openapi: {
      summary: "System Health Check",
      description: "Returns current uptime and runtime environment status.",
      tags: ["System"],
      operationId: "getHealth",
    },
    responses: {
      200: v.object({
        status: v.string(),
        uptime: v.number(),
        timestamp: v.string(),
        environment: v.string(),
      }),
    },
  },
  async () => {
    return json({
      status: "healthy",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    });
  },
);
