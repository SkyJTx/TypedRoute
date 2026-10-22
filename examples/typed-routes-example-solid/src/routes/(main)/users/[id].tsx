import * as v from "valibot";
import { defineRoute } from "@skyjt/typed-routes-solid";
import { useNavigate, Link } from "~/router";
import { createSignal, createEffect, Show } from "solid-js";
import { fetchUserById, deleteUser } from "~/services/api-client";
import type { UserRecord } from "~/services/db";

export const route = defineRoute({
  params: v.object({
    id: v.number(),
  }),
  onError({ error, rawParams }) {
    console.warn("[Route Validation] Invalid parameter for /users/:id:", rawParams, error.issues);
  },
});

export default function UserDetailPage() {
  const [params, paramsError] = route.useParams();
  const navigate = useNavigate();
  const [user, setUser] = createSignal<UserRecord | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  createEffect(
    () => params(),
    (validParams) => {
      if (!validParams) {
        setUser(null);
        return;
      }
      fetchUserById(validParams.id)
        .then((data) => setUser(data.user))
        .catch((err) => setError(err instanceof Error ? err.message : "Failed to load user"));
    },
  );

  const handleDelete = async () => {
    const currentParams = params();
    if (!currentParams) {
      return;
    }
    if (confirm("Are you certain you wish to remove this record?")) {
      try {
        await deleteUser(currentParams.id);
        navigate("/users/");
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to delete user");
      }
    }
  };

  return (
    <Show
      when={params()}
      fallback={
        <div class="card" style={{ "text-align": "center", padding: "3rem 1.5rem" }}>
          <h2 class="card-title" style={{ color: "var(--color-danger)", "margin-bottom": "0.5rem" }}>
            Invalid Personnel Identifier
          </h2>
          <p style={{ color: "var(--color-text-muted)", "margin-bottom": "1rem" }}>
            The sector registry could not resolve identifier "{paramsError()?.rawParams.id}". Expected a numeric ID (e.g. <code>/users/1</code>).
          </p>
          <p style={{ color: "var(--color-text-muted)", "font-size": "0.85rem", "margin-bottom": "1.5rem" }}>
            Validation target: <code>{paramsError()?.target}</code> ({paramsError()?.issues.map((i) => i.message).join("; ")})
          </p>
          <Link to="/users/" class="btn btn-primary">
            Return to Personnel Directory
          </Link>
        </div>
      }
    >
      {(validParams) => (
        <div class="card">
          <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center", "margin-bottom": "1.5rem" }}>
            <div>
              <h2 class="card-title" style={{ margin: 0 }}>
                Personnel Profile #{validParams().id}
              </h2>
              <span style={{ color: "var(--color-text-muted)", "font-size": "0.85rem" }}>
                Validated via <code>v.number()</code> schema coercion
              </span>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <Link to="/users/" class="btn btn-outline">
                Back to Directory
              </Link>
              <button onClick={handleDelete} class="btn btn-danger">
                Delete Profile
              </button>
            </div>
          </div>

          {error() && (
            <div style={{ padding: "1rem", "background-color": "var(--color-danger-light)", color: "var(--color-danger)", "border-radius": "var(--radius)", "margin-bottom": "1rem" }}>
              {error()}
            </div>
          )}

          {user() && (
            <div style={{ display: "grid", gap: "1rem" }}>
              <div>
                <strong>Name:</strong> {user()?.name}
              </div>
              <div>
                <strong>Email:</strong> {user()?.email}
              </div>
              <div>
                <strong>Role:</strong> <span class="badge badge-role">{user()?.role}</span>
              </div>
              <div>
                <strong>Status:</strong> <span class="badge badge-active">{user()?.status}</span>
              </div>
              <div>
                <strong>Registered At:</strong> {user()?.createdAt}
              </div>
            </div>
          )}
        </div>
      )}
    </Show>
  );
}
