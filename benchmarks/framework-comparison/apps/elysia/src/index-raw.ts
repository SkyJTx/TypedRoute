import { rawApp } from "./app";

const port = Number(process.env.PORT || 3333);
const host = "127.0.0.1";

rawApp.listen({ port, hostname: host }, () => {
  console.log(`READY: Elysia (Raw) on http://${host}:${port}`);
});

const shutdown = () => {
  rawApp.stop();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export { rawApp };
export default rawApp;
