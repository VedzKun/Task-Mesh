const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Request failed');
  return data;
}

export const api = {
  get:    <T>(path: string, token?: string | null) => request<T>(path, { method: 'GET' }, token),
  post:   <T>(path: string, body: any, token?: string | null) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }, token),
  patch:  <T>(path: string, body: any, token?: string | null) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, token),
  delete: <T>(path: string, token?: string | null) => request<T>(path, { method: 'DELETE' }, token),
};

export type ApiResponse<T> = { success: boolean; data: T; pagination?: Pagination };
export type Pagination = { page: number; limit: number; total: number; pages: number };
