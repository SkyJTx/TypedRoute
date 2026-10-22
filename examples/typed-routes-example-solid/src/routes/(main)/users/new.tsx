import { createSignal } from "solid-js";
import { useNavigate, Link } from "~/router";
import { createUser } from "~/services/api-client";

export default function NewUserPage() {
  const navigate = useNavigate();
  const [name, setName] = createSignal("");
  const [email, setEmail] = createSignal("");
  const [role, setRole] = createSignal<"admin" | "engineer" | "operator">("operator");
  const [error, setError] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (!name() || !email()) {
      setError("Please fill out all required fields.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createUser({ name: name(), email: email(), role: role() });
      navigate("/users/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register operator");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="card" style={{ "max-width": "550px", margin: "0 auto" }}>
      <h2 class="card-title">Register New Operator</h2>
      <p style={{ "margin-bottom": "1.25rem", color: "var(--color-text-muted)" }}>
        Add an authorized operator to the Fortress of Meropide registry.
      </p>

      {error() && (
        <div style={{ padding: "0.75rem 1rem", "background-color": "var(--color-danger-light)", color: "var(--color-danger)", "border-radius": "var(--radius)", "margin-bottom": "1rem" }}>
          {error()}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div class="form-group">
          <label class="form-label">Full Name</label>
          <input
            type="text"
            class="input-text"
            style={{ width: "100%" }}
            placeholder="e.g. Clorinde Champion"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
          />
        </div>

        <div class="form-group">
          <label class="form-label">Email Address</label>
          <input
            type="email"
            class="input-text"
            style={{ width: "100%" }}
            placeholder="e.g. clorinde@meropide.fn"
            value={email()}
            onInput={(e) => setEmail(e.currentTarget.value)}
          />
        </div>

        <div class="form-group">
          <label class="form-label">Assigned Role</label>
          <select
            style={{ width: "100%" }}
            value={role()}
            onChange={(e) => setRole(e.currentTarget.value as "admin" | "engineer" | "operator")}
          >
            <option value="operator">Operator (Field Security)</option>
            <option value="engineer">Engineer (Workshop Dynamics)</option>
            <option value="admin">Administrator (Administrative Authority)</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", "margin-top": "1.5rem" }}>
          <button type="submit" class="btn btn-primary" disabled={submitting()}>
            {submitting() ? "Registering..." : "Submit Registration"}
          </button>
          <Link to="/users/" class="btn btn-outline">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
