/**
 * Synchronous beforeInteractive bootstrap: apply Hallway `#payload=` into
 * this origin's localStorage BEFORE React/RequireAuth runs.
 * Keep in sync with hallway-handoff.ts key names.
 */
export const HALLWAY_HANDOFF_BOOTSTRAP = `
(function () {
  try {
    var hash = window.location.hash || "";
    if (hash.charAt(0) === "#") hash = hash.slice(1);
    if (!hash) return;
    var raw = null;
    var parts = hash.split("&");
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].indexOf("payload=") === 0) {
        raw = parts[i].slice("payload=".length);
        break;
      }
    }
    if (!raw) return;
    var data = JSON.parse(decodeURIComponent(raw));
    if (!data || typeof data.crm_token !== "string" || !data.crm_token.trim()) return;

    var keys = [
      "crm_token",
      "crm_role",
      "crm_user_name",
      "crm_login_username",
      "crm_user_id",
      "crm_active_module",
      "crm_designer_name",
      "crm_designer_id"
    ];
    for (var k = 0; k < keys.length; k++) {
      localStorage.removeItem(keys[k]);
    }

    localStorage.setItem("crm_token", String(data.crm_token).trim());

    var role = typeof data.crm_role === "string"
      ? data.crm_role.trim().toUpperCase().replace(/[\\s-]+/g, "_")
      : "";
    if (role === "PRE_SALES") role = "PRESALES_EXECUTIVE";
    if (role === "PRE_SALES_MANAGER") role = "PRESALES_MANAGER";
    if (role) localStorage.setItem("crm_role", role);

    if (typeof data.crm_user_name === "string" && data.crm_user_name.trim()) {
      localStorage.setItem("crm_user_name", data.crm_user_name.trim());
    }
    if (typeof data.crm_login_username === "string" && data.crm_login_username.trim()) {
      localStorage.setItem("crm_login_username", data.crm_login_username.trim());
    }
    if (data.crm_user_id != null && String(data.crm_user_id).trim()) {
      localStorage.setItem("crm_user_id", String(data.crm_user_id).trim());
    }

    var mod = typeof data.crm_active_module === "string"
      ? data.crm_active_module.trim().toLowerCase()
      : "";
    if (mod === "crm" || mod === "presales" || mod === "design" || mod === "admin") {
      localStorage.setItem("crm_active_module", mod);
    } else if (role === "PRESALES_EXECUTIVE" || role === "PRESALES_MANAGER") {
      localStorage.setItem("crm_active_module", "presales");
    } else if (role) {
      localStorage.setItem("crm_active_module", "crm");
    }

    if (typeof data.crm_designer_name === "string" && data.crm_designer_name.trim()) {
      localStorage.setItem("crm_designer_name", data.crm_designer_name.trim());
    }
    if (data.crm_designer_id != null && String(data.crm_designer_id).trim()) {
      localStorage.setItem("crm_designer_id", String(data.crm_designer_id).trim());
    }

    var path = "/Leads";
    if (role === "PRESALES_EXECUTIVE" || role === "PRESALES_MANAGER") {
      path = "/presales-leads";
    }

    var clean = window.location.pathname + window.location.search;

    // Preferred handoff route: clear hash; React /auth/accept routes by role.
    if (window.location.pathname === "/auth/accept") {
      window.history.replaceState(null, "", "/auth/accept");
      return;
    }

    // Direct /Leads#payload=... (or wrong path for role): clear hash, hard-correct if needed.
    if (clean.split("?")[0] !== path) {
      window.location.replace(window.location.origin + path);
      return;
    }
    window.history.replaceState(null, "", clean);
  } catch (e) {}
})();
`;
