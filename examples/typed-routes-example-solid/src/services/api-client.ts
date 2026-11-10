import type routes from "virtual:file-routes";
import { createClient } from "@skyjt/typed-routes-solid";

export const apiClient = createClient<typeof routes>();

export async function fetchHealth() {
  const [data, error] = await apiClient.get("/api/health");
  if (error) {
    throw new Error(error.detail || "Health check failed");
  }
  return data;
}

export async function fetchUsers(params?: {
  q?: string;
  role?: "all" | "admin" | "engineer" | "operator";
  limit?: number;
}) {
  const search: {
    q?: string;
    role?: "all" | "admin" | "engineer" | "operator";
    limit?: number;
  } = {};
  if (params?.q) {
    search.q = params.q;
  }
  if (params?.role && params.role !== "all") {
    search.role = params.role;
  }
  if (params?.limit) {
    search.limit = params.limit;
  }

  const [data, error] = await apiClient.get("/api/users", { search });
  if (error) {
    throw new Error(error.detail || "Failed to fetch users");
  }
  return data;
}

export async function fetchUserById(id: number) {
  const [data, error] = await apiClient.get("/api/users/:id", {
    params: { id },
  });
  if (error) {
    throw new Error(error.detail || `User ${id} not found`);
  }
  return data;
}

export async function createUser(input: {
  name: string;
  email: string;
  role: "admin" | "engineer" | "operator";
}) {
  const [data, error] = await apiClient.post("/api/users", {
    body: input,
  });
  if (error) {
    throw new Error(error.detail || "Failed to create user");
  }
  return data;
}

export async function deleteUser(id: number) {
  const [data, error] = await apiClient.delete("/api/users/:id", {
    params: { id },
  });
  if (error) {
    throw new Error(error.detail || `Failed to delete user ${id}`);
  }
  return data;
}
