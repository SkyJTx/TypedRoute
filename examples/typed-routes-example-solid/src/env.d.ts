declare module "*/dist/server/server.js" {
  export const fetch: (request: Request) => Response | Promise<Response>;
  const server: {
    fetch: (request: Request) => Response | Promise<Response>;
  };
  export default server;
}