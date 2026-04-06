const BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) ||
  "http://localhost:8081";

export const CRM_TOKEN_STORAGE_KEY = "crm_token";

export function getAuthApiBaseUrl(): string {
  return BASE.replace(/\/$/, "");
}

export type LoginResult = {
  token: string;
  user: Record<string, unknown>;
};

export async function login(
  username: string,
  password: string
): Promise<LoginResult> {
  const res = await fetch(`${getAuthApiBaseUrl()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string" ? data.message : "Login failed"
    );
  }
  if (data.success === false) {
    throw new Error(
      typeof data.message === "string" ? data.message : "Login failed"
    );
  }
  const token = data.token;
  const user = data.user;
  if (typeof token !== "string" || typeof user !== "object" || user === null) {
    throw new Error("Unexpected login response from server");
  }
  return { token, user: user as Record<string, unknown> };
}

export async function getMe(token: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${getAuthApiBaseUrl()}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string"
        ? data.message
        : "Failed to load current user"
    );
  }
  return data;
}

export async function logout(token: string): Promise<void> {
  try {
    await fetch(`${getAuthApiBaseUrl()}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Still clear client session if the network fails
  }
}

export async function validateToken(
  token: string
): Promise<Record<string, unknown>> {
  const res = await fetch(`${getAuthApiBaseUrl()}/api/auth/validate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  return data as Record<string, unknown>;
}
