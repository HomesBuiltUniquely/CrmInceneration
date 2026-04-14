export const CRM_THEME_STORAGE_KEY = "crm-theme";

export type CrmTheme = "light" | "dark";

export const DEFAULT_THEME: CrmTheme = "light";

export function isCrmTheme(value: string | null | undefined): value is CrmTheme {
  return value === "light" || value === "dark";
}

export function resolveInitialTheme(): CrmTheme {
  if (typeof window === "undefined") return DEFAULT_THEME;

  const stored = window.localStorage.getItem(CRM_THEME_STORAGE_KEY);
  if (isCrmTheme(stored)) return stored;

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(theme: CrmTheme) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
}
