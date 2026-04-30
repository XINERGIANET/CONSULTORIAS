import { httpClient as axios } from "../http/client";
import type { LaravelPaginated } from "../xpande/http";

export type ManagedUser = {
  id: number;
  name: string;
  email: string;
  is_superadmin: boolean;
  role_id?: number | null;
  cargo_id?: number | null;
  phone?: string | null;
  is_active?: boolean;
  contract_type?: string | null;
  salary?: string | null;
  cost_per_hour?: string | null;
  availability?: string | null;
  specialty?: string | null;
  role?: { id: number; name: string; slug: string };
  cargo?: { id: number; name: string };
  areas?: { id: number; name: string }[];
};

const p = "/api/users";

export async function fetchUsersPage(page = 1, q = ""): Promise<LaravelPaginated<ManagedUser>> {
  const { data } = await axios.get<LaravelPaginated<ManagedUser>>(p, { params: { page, q: q || undefined } });
  return data;
}

export async function fetchUser(id: number): Promise<ManagedUser> {
  const { data } = await axios.get<ManagedUser>(`${p}/${id}`);
  return data;
}

export async function createUser(payload: Record<string, unknown>): Promise<ManagedUser> {
  const { data } = await axios.post<ManagedUser>(p, payload);
  return data;
}

export async function updateUser(id: number, payload: Record<string, unknown>): Promise<ManagedUser> {
  const { data } = await axios.put<ManagedUser>(`${p}/${id}`, payload);
  return data;
}

export async function deleteUser(id: number): Promise<void> {
  await axios.delete(`${p}/${id}`);
}
