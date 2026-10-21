import { createSignal, createEffect } from "solid-js";
import { Link } from "../../router";
import { fetchHealth } from "../../services/api-client";

export default function DashboardPage() {
  const [healthStatus, setHealthStatus] = createSignal<{ status: string; uptime: number } | null>(null);

  createEffect(
    () => null,
    () => {
      fetchHealth()
        .then((data) => setHealthStatus({ status: data.status, uptime: Math.floor(data.uptime) }))
        .catch(() => setHealthStatus({ status: "unavailable", uptime: 0 }));
    },
  );

  return (
    <section>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">System Health</div>
          <div class="stat-value" style={{ color: healthStatus()?.status === "healthy" ? "var(--color-success)" : "inherit" }}>
            {healthStatus()?.status || "Checking..."}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Server Uptime</div>
          <div class="stat-value">{healthStatus() ? `${healthStatus()?.uptime}s` : "..."}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Route Validation</div>
          <div class="stat-value" style={{ color: "var(--color-primary)" }}>Standard Schema V1</div>
        </div>
      </div>

      <div class="card">
        <h2 class="card-title">Production Full-Stack Architecture</h2>
        <p style={{ "margin-bottom": "1rem", color: "var(--color-text-muted)" }}>
          Demonstrating <code>@skyjt/typed-routes-solid</code> running atop Solid 2.0 RC and Hono.
          Every route path, search query, and parameter schema is validated at compile-time and runtime.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", "flex-wrap": "wrap" }}>
          <Link to="/users/" class="btn btn-primary">
            Explore Personnel Directory
          </Link>
          <Link to="/users/new" class="btn btn-outline">
            Register New Operator
          </Link>
          <Link to="/users/:id" params={{ id: 1 }} class="btn btn-outline">
            View Administrator Profile (#1)
          </Link>
        </div>
      </div>
    </section>
  );
}
