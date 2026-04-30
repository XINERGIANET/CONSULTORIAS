import { httpClient as axios } from "../http/client";

export type LaravelPaginated<T> = {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export async function getJson<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await axios.get<T>(url, { params });
  return data;
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const { data } = await axios.post<T>(url, body);
  return data;
}

export async function putJson<T>(url: string, body: unknown): Promise<T> {
  const { data } = await axios.put<T>(url, body);
  return data;
}

export async function deleteJson(url: string): Promise<void> {
  await axios.delete(url);
}

export async function postFormData<T>(url: string, body: FormData): Promise<T> {
  const { data } = await axios.post<T>(url, body);
  return data;
}
