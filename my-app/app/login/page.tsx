"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CRM_ROLE_STORAGE_KEY,
  CRM_TOKEN_STORAGE_KEY,
  CRM_USER_NAME_STORAGE_KEY,
  getNameFromUser,
  getRoleFromUser,
  landingPathByRole,
  login,
} from "@/lib/auth/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081";

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(CRM_TOKEN_STORAGE_KEY)) {
      const role = localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "";
      router.replace(landingPathByRole(role));
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token, user } = await login(username, password);
      localStorage.setItem(CRM_TOKEN_STORAGE_KEY, token);
      const role = getRoleFromUser(user);
      const name = getNameFromUser(user);
      if (role) {
        localStorage.setItem(CRM_ROLE_STORAGE_KEY, role);
      } else {
        localStorage.removeItem(CRM_ROLE_STORAGE_KEY);
      }
      if (name) {
        localStorage.setItem(CRM_USER_NAME_STORAGE_KEY, name);
      } else {
        localStorage.removeItem(CRM_USER_NAME_STORAGE_KEY);
      }
      router.replace(landingPathByRole(role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-md border border-gray-200">
        <div className="flex flex-col items-center gap-2 mb-6">
          <Image
            src="/HowsCrmLogo.png"
            alt="CRM"
            width={56}
            height={56}
            className="rounded-lg"
          />
          <h1 className="text-xl font-bold text-gray-900 text-center">
            Sign in to CRM
          </h1>
          <p className="text-sm text-gray-500 text-center">
            Backend:{" "}
            <span className="font-mono text-gray-700">{apiBase}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
