import type { UserRecord } from "./db";

export async function fetchHealth() {
  const res = await fetch("/api/health");
  if (!res.ok) throw new Error("Health check failed");
  return res.json() as Promise<{ status: string; uptime: number; timestamp: string }>;
}

export async function fetchUsers(params?: { q?: string; role?: string; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.q) searchParams.set("q", params.q);
  if (params?.role && params.role !== "all") searchParams.set("role", params.role);
  if (params?.limit) searchParams.set("limit", String(params.limit));

  const queryStr = searchParams.toString();
  const url = queryStr ? `/api/users?${queryStr}` : "/api/users";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json() as Promise<{ success: boolean; total: number; users: UserRecord[] }>;
}

export async function fetchUserById(id: number) {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) throw new Error(`User ${id} not found`);
  return res.json() as Promise<{ success: boolean; user: UserRecord }>;
}

export async function createUser(data: { name: string; email: string; role: "admin" | "engineer" | "operator" }) {
  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.error || "Failed to create user");
  }
  return res.json() as Promise<{ success: boolean; user: UserRecord }>;
}

export async function deleteUser(id: number) {
  const res = await fetch(`/api/users/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete user ${id}`);
  return res.json() as Promise<{ success: boolean; removed: UserRecord }>;
}
