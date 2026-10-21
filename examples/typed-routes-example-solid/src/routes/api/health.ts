import { defineRoute } from "@skyjt/typed-routes-solid";

export const route = defineRoute({});

export const GET = route.handler(async () => {
  return Response.json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});