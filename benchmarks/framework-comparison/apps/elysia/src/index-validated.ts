import { validatedApp } from "./app";

const port = Number(process.env.PORT || 3333);
const host = "127.0.0.1";

validatedApp.listen({ port, hostname: host }, () => {
  console.log(`READY: Elysia (Validated) on http://${host}:${port}`);
});

const shutdown = () => {
  validatedApp.stop();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export { validatedApp };
export default validatedApp;
