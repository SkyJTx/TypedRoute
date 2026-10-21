import type { RouteSectionProps } from "@skyjt/typed-routes-solid";
import { Link } from "../router";

export default function MainLayout(props: RouteSectionProps) {
  return (
    <div class="layout-container">
      <header class="header">
        <div class="header-brand">
          <span class="brand-badge">TypedRoute</span>
          <h1 class="brand-title">Fortress Operations Control</h1>
        </div>
        <nav class="nav-links">
          <Link to="/" class="nav-link">
            Dashboard
          </Link>
          <Link to="/users/" class="nav-link">
            Personnel Directory
          </Link>
          <Link to="/users/new" class="nav-link">
            Register Operator
          </Link>
        </nav>
      </header>
      <main>{props.children}</main>
    </div>
  );
}