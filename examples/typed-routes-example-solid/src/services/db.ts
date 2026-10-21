export interface UserRecord {
  id: number;
  name: string;
  email: string;
  role: "admin" | "engineer" | "operator";
  status: "active" | "suspended";
  createdAt: string;
}

export const usersStore: UserRecord[] = [
  {
    id: 1,
    name: "Wriothesley",
    email: "duke@fortress.meropide.fn",
    role: "admin",
    status: "active",
    createdAt: "2026-01-10T08:00:00Z",
  },
  {
    id: 2,
    name: "Sigewinne",
    email: "head.nurse@infirmary.meropide.fn",
    role: "operator",
    status: "active",
    createdAt: "2026-01-15T09:30:00Z",
  },
  {
    id: 3,
    name: "Jurieu",
    email: "jurieu.mechanic@workshop.meropide.fn",
    role: "engineer",
    status: "active",
    createdAt: "2026-02-01T14:15:00Z",
  },
];
