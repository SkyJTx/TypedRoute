import { Link } from "../router";

export default function NotFoundPage() {
  return (
    <div class="card" style={{ "text-align": "center", padding: "3rem 1.5rem" }}>
      <h2 style={{ "font-size": "2rem", "margin-bottom": "0.5rem" }}>404 - Zone Uncharted</h2>
      <p style={{ color: "var(--color-text-muted)", "margin-bottom": "1.5rem" }}>
        The sector you requested does not exist within the Fortress of Meropide.
      </p>
      <Link to="/" class="btn btn-primary">
        Return to Safety (Dashboard)
      </Link>
    </div>
  );
}