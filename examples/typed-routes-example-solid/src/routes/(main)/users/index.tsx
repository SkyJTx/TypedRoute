import * as v from "valibot";
import { defineRoute } from "@skyjt/typed-routes-solid";
import { useNavigate, Link } from "~/router";
import { createSignal, createEffect, For, Show } from "solid-js";
import { fetchUsers } from "~/services/api-client";
import type { UserRecord } from "~/services/db";

const roleSchema = v.picklist(["all", "admin", "engineer", "operator"]);

export const route = defineRoute({
  search: v.object({
    q: v.optional(v.string()),
    role: v.optional(roleSchema),
  }),
});

export default function UsersDirectoryPage() {
  const [search, searchError] = route.useSearch();
  const navigate = useNavigate();
  const [users, setUsers] = createSignal<UserRecord[]>([]);
  const [loading, setLoading] = createSignal(true);

  createEffect(
    () => search(),
    (validSearch) => {
      if (!validSearch) {
        setLoading(false);
        return;
      }
      setLoading(true);
      fetchUsers({ q: validSearch.q, role: validSearch.role })
        .then((res) => setUsers(res.users))
        .finally(() => setLoading(false));
    },
  );

  return (
    <Show
      when={search()}
      fallback={
        <div class="card" style={{ "text-align": "center", padding: "3rem 1.5rem" }}>
          <h2 class="card-title" style={{ color: "var(--color-danger)", "margin-bottom": "0.5rem" }}>
            Invalid Directory Filter
          </h2>
          <p style={{ color: "var(--color-text-muted)", "margin-bottom": "1.5rem" }}>
            The filter query <code>{JSON.stringify(searchError()?.rawSearch)}</code> failed schema validation on <code>{searchError()?.target}</code>.
          </p>
          <Link to="/users/" class="btn btn-primary">
            Reset Directory Filters
          </Link>
        </div>
      }
    >
      {(validSearch) => (
        <div class="card">
          <div style={{ display: "flex", "justify-content": "space-between", "align-items": "center", "margin-bottom": "1rem" }}>
            <h2 class="card-title" style={{ margin: 0 }}>Personnel Directory</h2>
            <Link to="/users/new" class="btn btn-primary">
              + Add Operator
            </Link>
          </div>

          <div class="filter-bar">
            <input
              type="text"
              class="input-text"
              placeholder="Filter by name..."
              value={validSearch().q || ""}
              onInput={(e) => {
                navigate("/users/", {
                  search: { q: e.currentTarget.value, role: validSearch().role },
                });
              }}
            />

            <select
              value={validSearch().role || "all"}
              onChange={(e) => {
                const nextRole = e.currentTarget.value as "all" | "admin" | "engineer" | "operator";
                navigate("/users/", {
                  search: { q: validSearch().q, role: nextRole },
                });
              }}
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="engineer">Engineer</option>
              <option value="operator">Operator</option>
            </select>
          </div>

          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <For each={users()}>
                  {(user) => (
                    <tr>
                      <td>#{user.id}</td>
                      <td>
                        <strong>{user.name}</strong>
                      </td>
                      <td style={{ color: "var(--color-text-muted)" }}>{user.email}</td>
                      <td>
                        <span class="badge badge-role">{user.role}</span>
                      </td>
                      <td>
                        <span class="badge badge-active">{user.status}</span>
                      </td>
                      <td>
                        <Link to="/users/:id" params={{ id: user.id }} class="btn btn-outline" style={{ padding: "0.25rem 0.6rem", "font-size": "0.8rem" }}>
                          View Details
                        </Link>
                      </td>
                    </tr>
                  )}
                </For>
                {users().length === 0 && !loading() && (
                  <tr>
                    <td colspan="6" style={{ "text-align": "center", color: "var(--color-text-muted)", padding: "2rem" }}>
                      No personnel matching current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Show>
  );
}
