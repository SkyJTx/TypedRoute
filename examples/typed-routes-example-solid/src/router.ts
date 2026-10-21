import { pageRoutes } from "virtual:file-routes";
import { createRouter, interceptFileRoutes } from "@skyjt/typed-routes-solid";

export const {
  Router,
  Link,
  useNavigate,
  paths,
  routes,
} = createRouter<typeof pageRoutes>({
  routes: interceptFileRoutes(pageRoutes),
});
