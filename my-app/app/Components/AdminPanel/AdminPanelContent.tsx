"use client";
import {
  useState,
  useEffect,
  ReactNode,
  CSSProperties,
  ChangeEvent,
  MouseEvent,
} from "react";
import { adminPanelApi } from "@/lib/admin-panel-api";
import { leadLimitsApi } from "@/lib/lead-limits-api";
import { pickNumber } from "@/lib/api-normalize";
import { cn } from "@/lib/cn";
import {
  CRM_ROLE_STORAGE_KEY,
  CRM_USER_NAME_STORAGE_KEY,
  normalizeRole,
} from "@/lib/auth/api";

// ─── colour tokens (matches your existing teal/blue palette) ─────────────────
const C = {
  bg: "var(--crm-app-bg)",
  card: "var(--crm-surface)",
  surface: "var(--crm-surface-subtle)",
  elevated: "var(--crm-surface-elevated)",
  primary: "var(--crm-accent)",
  primaryHover: "var(--crm-accent-strong)",
  accent: "var(--crm-accent)",
  danger: "var(--crm-danger)",
  dangerBg: "var(--crm-danger-bg)",
  dangerText: "var(--crm-danger-text)",
  success: "var(--crm-success)",
  successBg: "var(--crm-success-bg)",
  successText: "var(--crm-success-text)",
  warningBg: "var(--crm-warning-bg)",
  warningText: "var(--crm-warning-text)",
  info: "var(--crm-info)",
  infoBg: "var(--crm-info-bg)",
  infoText: "var(--crm-info-text)",
  neutral: "var(--crm-neutral)",
  neutralBg: "var(--crm-neutral-bg)",
  neutralText: "var(--crm-neutral-text)",
  border: "var(--crm-border)",
  borderStrong: "var(--crm-border-strong)",
  text: "var(--crm-text-primary)",
  muted: "var(--crm-text-muted)",
  badgeBg: "var(--crm-accent-soft)",
  badgeText: "var(--crm-accent)",
  inputBg: "var(--crm-input-bg)",
  overlay: "var(--crm-overlay)",
  tabGrad: "var(--crm-tab-grad)",
  white: "#fff",
  disabled: "var(--crm-border-strong)",
};

/** `toBranch` values for POST /api/admin/branch-transfer — must match backend `User.branch`. */
const BRANCH_TRANSFER_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "HBR", label: "HBR" },
  { value: "JP_NAGAR", label: "JP Nagar" },
  { value: "SARJAPUR", label: "Sarjapur" },
];

// ─── reusable atoms ───────────────────────────────────────────────────────────
interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

const Card = ({ children, style = {}, className }: CardProps) => (
  <div
    className={cn(
      "rounded-[14px] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-7 shadow-[var(--crm-shadow-sm)]",
      className,
    )}
    style={{
      ...style,
    }}
  >
    {children}
  </div>
);

const SectionTitle = ({
  icon,
  children,
  className,
}: {
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <h2
    className={cn(
      "mb-5 flex items-center gap-2 text-lg font-bold text-[var(--crm-text-primary)]",
      className,
    )}
  >
    <span className="text-xl">{icon}</span> {children}
  </h2>
);

interface InputProps {
  placeholder: string;
  type?: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  style?: CSSProperties;
  className?: string;
}

const Input = ({
  placeholder,
  type = "text",
  value,
  onChange,
  style = {},
  className,
}: InputProps) => (
  <input
    type={type}
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    className={cn(
      "w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-input-bg)] px-3.5 py-2.5 text-sm text-[var(--crm-text-primary)] outline-none transition-colors focus:border-[var(--crm-accent)]",
      className,
    )}
    style={{
      boxSizing: "border-box",
      ...style,
    }}
  />
);

interface SelectProps {
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

const Select = ({
  value,
  onChange,
  children,
  style = {},
  className,
}: SelectProps) => (
  <select
    value={value}
    onChange={onChange}
    className={cn(
      "w-full rounded-lg border border-[var(--crm-border)] bg-[var(--crm-input-bg)] px-3.5 py-2.5 text-sm text-[var(--crm-text-primary)] outline-none transition-colors focus:border-[var(--crm-accent)]",
      className,
    )}
    style={{
      boxSizing: "border-box",
      ...style,
    }}
  >
    {children}
  </select>
);

interface BtnProps {
  onClick?: () => void;
  children: ReactNode;
  color?: string;
  style?: CSSProperties;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
}

const Btn = ({
  onClick,
  children,
  color = C.primary,
  style = {},
  disabled = false,
  className,
  type = "button",
}: BtnProps) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "rounded-lg px-[22px] py-2.5 text-sm font-semibold text-white shadow-[var(--crm-shadow-sm)] transition-all duration-150 hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60",
      className,
    )}
    style={{
      backgroundColor: disabled ? C.disabled : color,
      border: "none",
      ...style,
    }}
  >
    {children}
  </button>
);

interface BadgeProps {
  children: ReactNode;
  color?: string;
  text?: string;
  className?: string;
}

const Badge = ({
  children,
  color = C.badgeBg,
  text = C.badgeText,
  className,
}: BadgeProps) => (
  <span
    className={cn(
      "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
      className,
    )}
    style={{
      background: color,
      color: text,
    }}
  >
    {children}
  </span>
);

interface ToggleProps {
  active: boolean;
  onChange: (value: boolean) => void;
}

const Toggle = ({ active, onChange }: ToggleProps) => (
  <div
    onClick={() => onChange(!active)}
    className="flex cursor-pointer items-center gap-2"
  >
    <button
      type="button"
      aria-pressed={active}
      className="relative flex h-7 w-[50px] items-center rounded-full p-0"
      style={{
        border: "none",
        background: active ? C.success : C.disabled,
      }}
    >
      <div
        className="absolute h-6 w-6 rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,.1)] transition-all"
        style={{
          left: active ? 2 : 24,
        }}
      />
    </button>
    <span className="text-xs font-semibold" style={{ color: active ? C.success : C.text }}>
      {active ? "ACTIVE" : "INACTIVE"}
    </span>
  </div>
);

interface StatusPillProps {
  active: boolean;
}

const StatusPill = ({ active }: StatusPillProps) => (
  <span
    className="inline-flex rounded-full px-3 py-[3px] text-xs font-semibold"
    style={{
      background: active ? C.successBg : C.dangerBg,
      color: active ? C.successText : C.dangerText,
    }}
  >
    {active ? "ACTIVE" : "INACTIVE"}
  </span>
);

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const Modal = ({ isOpen, onClose, title, children }: ModalProps) => {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: C.overlay,
      }}
      onClick={onClose}
    >
      <div
        className="w-[90%] max-w-[600px] overflow-auto rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] shadow-[var(--crm-shadow-lg)]"
        style={{
          maxHeight: "90vh",
        }}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between rounded-t-xl px-6 py-5 text-white"
          style={{
            background: C.tabGrad,
          }}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-[22px]">📋</span>
            <h2 className="m-0 text-lg font-bold">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-lg text-white"
          >
            ✕
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

interface TabProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

const Tab = ({ label, active, onClick }: TabProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "rounded-lg px-5 py-[9px] text-sm font-semibold transition-all duration-150 hover:-translate-y-px",
      active
        ? "bg-[var(--crm-accent)] text-white"
        : "bg-transparent text-[var(--crm-text-muted)]",
    )}
  >
    {label}
  </button>
);

interface FilterBtnProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

const FilterBtn = ({ label, active, onClick }: FilterBtnProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "rounded-full border px-4 py-1.5 text-[13px] font-medium transition-all duration-150 hover:-translate-y-px",
      active
        ? "border-[var(--crm-accent)] bg-[var(--crm-accent)] text-white"
        : "border-[var(--crm-border)] bg-[var(--crm-surface)] text-[var(--crm-text-muted)]",
    )}
  >
    {label}
  </button>
);

interface TableHeadProps {
  cols: string[];
}

const TableHead = ({ cols }: TableHeadProps) => (
  <thead>
    <tr className="bg-[var(--crm-surface-subtle)]">
      {cols.map((c) => (
        <th
          key={c}
          className="border-b border-[var(--crm-border)] px-[14px] py-2.5 text-left text-xs font-bold uppercase tracking-[0.5px] text-[var(--crm-text-primary)]"
          style={{
          }}
        >
          {c}
        </th>
      ))}
    </tr>
  </thead>
);

// ─── SECTION 1 : Admins + Create Admin + Create User ─────────────────────────
interface AdminForm {
  username: string;
  password: string;
  email: string;
}

interface UserForm {
  role: string;
  username: string;
  password: string;
  email: string;
  fullName: string;
  phone: string;
  branch: string;
  parentId: string;
}

function AdminUserSection() {
  const [tab, setTab] = useState<"admins" | "createAdmin" | "createUser">(
    "admins",
  );
  const [viewerRole] = useState(() => {
    if (typeof window === "undefined") return "";
    const role = window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "";
    return normalizeRole(role);
  });
  const [adminForm, setAdminForm] = useState<AdminForm>({
    username: "",
    password: "",
    email: "",
  });
  const [userForm, setUserForm] = useState<UserForm>({
    role: "",
    username: "",
    password: "",
    email: "",
    fullName: "",
    phone: "",
    branch: "",
    parentId: "",
  });
  const [admins, setAdmins] = useState<Array<Record<string, unknown>>>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [salesManagers, setSalesManagers] = useState<Array<Record<string, unknown>>>([]);
  const [presalesManagers, setPresalesManagers] = useState<Array<Record<string, unknown>>>([]);
  const [salesAdmins, setSalesAdmins] = useState<Array<Record<string, unknown>>>([]);
  const [territoryDesignManagers, setTerritoryDesignManagers] = useState<Array<Record<string, unknown>>>([]);
  const [designManagers, setDesignManagers] = useState<Array<Record<string, unknown>>>([]);

  const canManageAdmins = viewerRole === "SUPER_ADMIN";
  const isSalesAdmin = viewerRole === "SALES_ADMIN";

  useEffect(() => {
    if (!canManageAdmins && tab !== "createUser") {
      setTab("createUser");
    }
  }, [canManageAdmins, tab]);

  useEffect(() => {
    if (tab !== "admins") return;
    if (!canManageAdmins) return;
    let cancelled = false;
    setAdminsLoading(true);
    void adminPanelApi
      .listAdmins()
      .then((rows) => {
        if (!cancelled) setAdmins(rows);
      })
      .catch(() => {
        if (!cancelled) setAdmins([]);
      })
      .finally(() => {
        if (!cancelled) setAdminsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canManageAdmins, tab]);

  useEffect(() => {
    if (!viewerRole) return;
    let cancelled = false;
    const allUsersReq = canManageAdmins
      ? adminPanelApi.listAllUsers().catch(() => [] as Array<Record<string, unknown>>)
      : Promise.resolve([] as Array<Record<string, unknown>>);
    void Promise.all([
      adminPanelApi.listManagers().catch(() => [] as Array<Record<string, unknown>>),
      adminPanelApi.listPreSales().catch(() => [] as Array<Record<string, unknown>>),
      allUsersReq,
    ]).then(([sm, pm, all]) => {
      if (cancelled) return;
      setSalesManagers(sm.filter((u) => String(u.active ?? true) !== "false"));
      setPresalesManagers(
        pm.filter(
          (u) =>
            String(u.active ?? true) !== "false" &&
            String(u.role ?? "").toUpperCase() === "PRESALES_MANAGER",
        ),
      );
      const activeUsers = all.filter((u) => String(u.active ?? true) !== "false");
      setSalesAdmins(activeUsers.filter((u) => String(u.role ?? "").toUpperCase() === "SALES_ADMIN"));
      setTerritoryDesignManagers(
        activeUsers.filter((u) => String(u.role ?? "").toUpperCase() === "TERRITORY_DESIGN_MANAGER"),
      );
      setDesignManagers(activeUsers.filter((u) => String(u.role ?? "").toUpperCase() === "DESIGN_MANAGER"));
    });
    return () => {
      cancelled = true;
    };
  }, [canManageAdmins, viewerRole]);

  const ROLES = [
    {
      label: "Sales Hierarchy",
      options: ["SALES_ADMIN", "SALES_MANAGER", "SALES_EXECUTIVE"],
    },
    {
      label: "Presales Hierarchy",
      options: ["PRESALES_MANAGER", "PRESALES_EXECUTIVE"],
    },
    {
      label: "Designer Hierarchy",
      options: ["TERRITORY_DESIGN_MANAGER", "DESIGN_MANAGER", "DESIGNER"],
    },
  ];
  const allowedRoleGroups = isSalesAdmin ? ROLES.slice(0, 2) : ROLES;
  const parentConfig: Record<string, { label: string; options: Array<Record<string, unknown>> }> = {
    SALES_MANAGER: { label: "Sales Admin *", options: salesAdmins },
    SALES_EXECUTIVE: { label: "Sales Manager *", options: salesManagers },
    PRESALES_MANAGER: { label: "Sales Admin *", options: salesAdmins },
    PRESALES_EXECUTIVE: { label: "Presales Manager *", options: presalesManagers },
    DESIGN_MANAGER: { label: "Territory Design Manager *", options: territoryDesignManagers },
    DESIGNER: { label: "Design Manager *", options: designManagers },
  };
  const parentRequirement = parentConfig[userForm.role];
  const needsParent = Boolean(parentRequirement);
  const parentOptions = parentRequirement?.options ?? [];
  const parentLabel = parentRequirement?.label ?? "Parent *";

  return (
    <Card>
      <SectionTitle icon="👥">Admin & User Management</SectionTitle>

      {/* Tab row */}
      <div
        style={{
          display: "flex",
          gap: 6,
          background: C.surface,
          borderRadius: 10,
          padding: 5,
          width: "fit-content",
          marginBottom: 24,
        }}
      >
        {canManageAdmins ? (
          <>
            <Tab
              label="Admins List"
              active={tab === "admins"}
              onClick={() => setTab("admins")}
            />
            <Tab
              label="Create Admin"
              active={tab === "createAdmin"}
              onClick={() => setTab("createAdmin")}
            />
          </>
        ) : null}
        <Tab
          label="Create User"
          active={tab === "createUser"}
          onClick={() => setTab("createUser")}
        />
      </div>

      {/* ── Admins List ── */}
      {canManageAdmins && tab === "admins" && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <TableHead
              cols={["ID", "Username", "Email", "Role", "Status", "Actions"]}
            />
            <tbody>
              {adminsLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      textAlign: "center",
                      padding: 32,
                      color: C.muted,
                      fontSize: 14,
                    }}
                  >
                    Loading admins...
                  </td>
                </tr>
              ) : admins.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      textAlign: "center",
                      padding: 32,
                      color: C.muted,
                      fontSize: 14,
                    }}
                  >
                    No admins found.
                  </td>
                </tr>
              ) : (
                admins.map((a, i) => (
                  <tr
                    key={String(a.id ?? i)}
                    style={{
                      background: i % 2 === 0 ? C.card : C.surface,
                      color: C.text,
                    }}
                  >
                    <td style={{ padding: "12px 14px", fontSize: 14, color: C.text }}>
                      {String(a.id ?? "-")}
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        fontSize: 14,
                        fontWeight: 600,
                        color: C.text,
                      }}
                    >
                      {String(a.username ?? a.fullName ?? "-")}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 14, color: C.muted }}>
                      {String(a.email ?? "-")}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <Badge>{String(a.role ?? "-")}</Badge>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <StatusPill active={Boolean(a.active ?? true)} />
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 13, color: C.muted }}>—</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Create Admin ── */}
      {canManageAdmins && tab === "createAdmin" && (
        <div style={{ maxWidth: 500 }}>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>
            Super Admin only — creates a new admin account.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Input
              placeholder="Username"
              value={adminForm.username}
              onChange={(e) =>
                setAdminForm({ ...adminForm, username: e.target.value })
              }
            />
            <Input
              placeholder="Password"
              type="password"
              value={adminForm.password}
              onChange={(e) =>
                setAdminForm({ ...adminForm, password: e.target.value })
              }
            />
            <Input
              placeholder="Email"
              type="email"
              value={adminForm.email}
              onChange={(e) =>
                setAdminForm({ ...adminForm, email: e.target.value })
              }
            />
            <Btn
              style={{ alignSelf: "flex-start" }}
              onClick={() => {
                void adminPanelApi
                  .createAdmin({
                    username: adminForm.username.trim(),
                    password: adminForm.password,
                    email: adminForm.email.trim(),
                  })
                  .then(() => {
                    setAdminForm({ username: "", password: "", email: "" });
                    setTab("admins");
                  })
                  .catch(() => {});
              }}
            >
              Create Admin
            </Btn>
          </div>
        </div>
      )}

      {/* ── Create User ── */}
      {tab === "createUser" && (
        <div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}
          >
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>Role *</label>
              <Select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                <option value="">Select Role</option>
                {allowedRoleGroups.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options
                      .filter((r) => !(isSalesAdmin && r === "SALES_ADMIN"))
                      .map((r) => (
                        <option key={r} value={r}>
                          {r.replace(/_/g, " ")}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </Select>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>Username *</label>
              <Input placeholder="Username" value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>Password *</label>
              <Input placeholder="Password" type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>Email *</label>
              <Input placeholder="Email" type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>Name *</label>
              <Input placeholder="Full Name" value={userForm.fullName} onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>Phone</label>
              <Input placeholder="Phone" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>Branch *</label>
              <Select value={userForm.branch} onChange={(e) => setUserForm({ ...userForm, branch: e.target.value })}>
                <option value="">Select Branch</option>
                {BRANCH_TRANSFER_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </Select>
            </div>
            {needsParent ? (
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>{parentLabel}</label>
                <Select value={userForm.parentId} onChange={(e) => setUserForm({ ...userForm, parentId: e.target.value })}>
                  <option value="">Select Parent</option>
                  {parentOptions.map((u) => (
                    <option key={String(u.id)} value={String(u.id)}>
                      {(u.fullName ?? u.name ?? u.username ?? `User ${u.id}`) as string}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
          </div>
          <Btn
            style={{ marginTop: 18, alignSelf: "flex-start" }}
            disabled={
              !userForm.role ||
              !userForm.username.trim() ||
              !userForm.password.trim() ||
              !userForm.email.trim() ||
              !userForm.fullName.trim() ||
              !userForm.branch.trim() ||
              (needsParent && !userForm.parentId)
            }
            onClick={() => {
              const payload: Record<string, unknown> = {
                username: userForm.username.trim(),
                password: userForm.password,
                email: userForm.email.trim(),
                fullName: userForm.fullName.trim(),
                name: userForm.fullName.trim(),
                phone: userForm.phone.trim() || undefined,
                branch: userForm.branch,
                role: userForm.role,
              };
              const parentId = Number(userForm.parentId);
              if (needsParent && Number.isFinite(parentId)) payload.managerId = parentId;

              let req: Promise<Record<string, unknown>>;
              if (userForm.role === "SALES_MANAGER") {
                req = adminPanelApi.createManager(payload);
              } else if (userForm.role === "SALES_EXECUTIVE") {
                req = adminPanelApi.createSalesExecutive(payload);
              } else {
                req = adminPanelApi.createPreSales(payload);
              }
              void req
                .then(() => {
                  setUserForm({
                    role: "",
                    username: "",
                    password: "",
                    email: "",
                    fullName: "",
                    phone: "",
                    branch: "",
                    parentId: "",
                  });
                })
                .catch(() => {});
            }}
          >
            Create User
          </Btn>
        </div>
      )}
    </Card>
  );
}

// ─── SECTION 2 : Assign Sales Executive to Manager ────────────────────────────
function AssignSection() {
  const [exec, setExec] = useState<string>("");
  const [mgr, setMgr] = useState<string>("");
  const [execs, setExecs] = useState<Array<Record<string, unknown>>>([]);
  const [managers, setManagers] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    void Promise.all([adminPanelApi.listSalesExecutives(), adminPanelApi.listManagers()])
      .then(([se, sm]) => {
        setExecs(se);
        setManagers(sm);
      })
      .catch(() => {
        setExecs([]);
        setManagers([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <Card>
      <SectionTitle icon="🔗">Assign Sales Executive to Manager</SectionTitle>
      <p style={{ fontSize: 13, color: C.muted, marginTop: -12, marginBottom: 14 }}>
        {loading ? "Loading users…" : "Updates the sales executive’s manager in the admin API."}
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr auto",
          gap: 14,
          alignItems: "flex-end",
          maxWidth: 700,
        }}
      >
        <div>
          <label
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: C.text,
              display: "block",
              marginBottom: 6,
            }}
          >
            Sales Executive
          </label>
          <Select value={exec} onChange={(e) => setExec(e.target.value)}>
            <option value="">Select Sales Executive</option>
            {execs.map((u) => (
              <option key={String(u.id)} value={String(u.id)}>
                {(u.fullName ?? u.name ?? u.username ?? `User ${u.id}`) as string}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: C.text,
              display: "block",
              marginBottom: 6,
            }}
          >
            Manager
          </label>
          <Select value={mgr} onChange={(e) => setMgr(e.target.value)}>
            <option value="">Select Manager</option>
            {managers.map((u) => (
              <option key={String(u.id)} value={String(u.id)}>
                {(u.fullName ?? u.name ?? u.username ?? `User ${u.id}`) as string}
              </option>
            ))}
          </Select>
        </div>
        <Btn
          disabled={!exec || !mgr}
          onClick={() => {
            void adminPanelApi
              .updateSalesExecutive(exec, { managerId: Number(mgr) })
              .then(() => {
                setExec("");
                setMgr("");
                load();
              })
              .catch(() => {});
          }}
        >
          Assign
        </Btn>
      </div>
    </Card>
  );
}

// ─── SECTION 3 : Branch Transfer ─────────────────────────────────────────────
function BranchTransferSection() {
  const [user, setUser] = useState<string>("");
  const [branchPick, setBranchPick] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [historyUserFilter, setHistoryUserFilter] = useState<string>("");
  const [transferUsers, setTransferUsers] = useState<Array<Record<string, unknown>>>([]);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadTransferUsers = () => {
    setLoadingUsers(true);
    void adminPanelApi
      .branchTransferUsers()
      .then(setTransferUsers)
      .catch(() => setTransferUsers([]))
      .finally(() => setLoadingUsers(false));
  };

  useEffect(() => {
    loadTransferUsers();
  }, []);

  useEffect(() => {
    if (!showHistory) return;
    setLoadingHistory(true);
    const uid =
      historyUserFilter.trim() === "" ? undefined : historyUserFilter.trim();
    void adminPanelApi
      .branchTransferHistory(uid)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [showHistory, historyUserFilter]);

  const selectedUser = transferUsers.find((u) => String(u.id) === user);
  const currentBranch = selectedUser
    ? String(selectedUser.branch ?? selectedUser.currentBranch ?? selectedUser.fromBranch ?? "")
    : "";

  return (
    <Card>
      {!showHistory ? (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <SectionTitle icon="🔄">Branch Transfer</SectionTitle>
            <Btn
              color={C.info}
              style={{ fontSize: 13, padding: "7px 16px" }}
              onClick={() => setShowHistory(true)}
            >
              ↻ History
            </Btn>
          </div>
          <p
            style={{
              fontSize: 13,
              color: C.muted,
              marginTop: -14,
              marginBottom: 20,
            }}
          >
            {loadingUsers
              ? "Loading eligible users…"
              : "Move a teammate between offices. Backend accepts userId, toBranch, and optional reason only."}
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 14,
            }}
          >
            <div>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.text,
                  display: "block",
                  marginBottom: 8,
                }}
              >
                Select User *
              </label>
              <Select value={user} onChange={(e) => setUser(e.target.value)}>
                <option value="">Select User</option>
                {transferUsers.map((u) => (
                  <option key={String(u.id)} value={String(u.id)}>
                    {(u.fullName ?? u.name ?? u.username ?? `User ${u.id}`) as string}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.text,
                  display: "block",
                  marginBottom: 8,
                }}
              >
                Current Branch
              </label>
              <Input
                placeholder="Auto-filled"
                value={currentBranch}
                onChange={() => {}}
                style={{ background: C.surface, color: C.muted, cursor: "not-allowed" }}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.text,
                  display: "block",
                  marginBottom: 8,
                }}
              >
                Target branch *
              </label>
              <Select
                value={branchPick}
                onChange={(e) => setBranchPick(e.target.value)}
              >
                <option value="">Select branch</option>
                {BRANCH_TRANSFER_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: C.text,
                display: "block",
                marginBottom: 8,
              }}
            >
              Reason (optional)
            </label>
            <textarea
              placeholder="e.g. Relocated to JP Nagar branch, internal team reshuffle…"
              value={reason}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setReason(e.target.value)
              }
              rows={3}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                fontSize: 14,
                resize: "vertical",
                outline: "none",
                boxSizing: "border-box",
                fontFamily: "inherit",
                color: C.text,
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
              marginTop: 20,
            }}
          >
            <Btn
              color={C.primary}
              style={{ fontSize: 14, padding: "9px 24px" }}
              disabled={!user || !branchPick}
              onClick={() => {
                void adminPanelApi
                  .branchTransfer({
                    userId: Number(user),
                    toBranch: branchPick,
                    reason: reason.trim() || undefined,
                  })
                  .then(() => {
                    setReason("");
                    setBranchPick("");
                    loadTransferUsers();
                  })
                  .catch(() => {});
              }}
            >
              ⇄ Transfer Branch
            </Btn>
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <SectionTitle icon="📋">Transfer History</SectionTitle>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>User filter</label>
              <Select
                value={historyUserFilter}
                onChange={(e) => setHistoryUserFilter(e.target.value)}
                style={{ minWidth: 200 }}
              >
                <option value="">All (Super Admin; may require role)</option>
                {transferUsers.map((u) => (
                  <option key={String(u.id)} value={String(u.id)}>
                    {(u.fullName ?? u.name ?? u.username ?? `User ${u.id}`) as string}
                  </option>
                ))}
              </Select>
              <Btn
                color={C.neutral}
                style={{ fontSize: 13, padding: "7px 16px" }}
                onClick={() => setShowHistory(false)}
              >
                ← Back
              </Btn>
            </div>
          </div>
          <p style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
            Audit API: <code>GET /api/admin/branch-transfer-history?userId=</code> (typically Super Admin).
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <TableHead
                cols={["User id", "From", "To", "When", "By", "Reason"]}
              />
              <tbody>
                {loadingHistory ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 24, textAlign: "center", color: C.muted }}>
                      Loading history…
                    </td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: 24, textAlign: "center", color: C.muted }}>
                      No transfer history.
                    </td>
                  </tr>
                ) : (
                  history.map((h, i) => {
                    const uid = String(h.userId ?? h.user ?? "-");
                    const fromB = String(h.fromBranch ?? h.from ?? h.oldBranch ?? "-");
                    const toB = String(h.toBranch ?? h.to ?? h.newBranch ?? "-");
                    const dateStr = String(
                      h.transferredAt ?? h.date ?? h.createdAt ?? h.timestamp ?? "-",
                    );
                    const reasonStr = String(h.reason ?? h.note ?? "");
                    const by = String(
                      h.performedByUsername ?? h.performedBy ?? h.adminUsername ?? "—",
                    );
                    return (
                      <tr
                        key={String(h.id ?? i)}
                        style={{
                          background: i % 2 === 0 ? C.card : C.surface,
                        }}
                      >
                        <td
                          style={{
                            padding: "12px 14px",
                            fontSize: 14,
                            fontWeight: 600,
                          }}
                        >
                          {uid}
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 14 }}>
                          <Badge color={C.successBg} text={C.successText}>
                            {fromB}
                          </Badge>
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 14 }}>
                          <Badge color={C.warningBg} text={C.warningText}>
                            {toB}
                          </Badge>
                        </td>
                        <td
                          style={{
                            padding: "12px 14px",
                            fontSize: 14,
                            color: C.muted,
                          }}
                        >
                          {dateStr}
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 12, color: C.muted }}>{by}</td>
                        <td style={{ padding: "12px 14px", fontSize: 14 }}>
                          {reasonStr}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

// ─── SECTION 4 : All Users Management ────────────────────────────────────────
const ALL_ROLES = [
  "All",
  "Sales Admin",
  "Sales Manager",
  "Sales Executive",
  "Presales Manager",
  "Presales Executive",
  "Territory Design Manager",
  "Design Manager",
  "Designer",
  "Manager",
];

interface User {
  id: number;
  username: string;
  email: string;
  name: string;
  phone: string;
  role: string;
  branch: string;
  managerId: string;
  status: boolean;
}

function AllUsersSection() {
  const [viewerRole] = useState(() => {
    if (typeof window === "undefined") return "";
    const role = window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "";
    return normalizeRole(role);
  });
  const [roleFilter, setRoleFilter] = useState<string>("All");
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (viewerRole !== "SUPER_ADMIN") return;
    let cancelled = false;
    void Promise.all([
      adminPanelApi.listAllUsers(),
      adminPanelApi.branchTransferUsers().catch(() => [] as Array<Record<string, unknown>>),
    ])
      .then(([rows, transferList]) => {
        if (cancelled) return;
        const branchById = new Map<number, string>();
        for (const bu of transferList) {
          const bid = Number(bu.id);
          const br = bu.branch;
          if (typeof br === "string" && br.trim()) branchById.set(bid, br.trim());
        }
        const normalized = rows.map((u, idx) => {
          const id = Number(u.id ?? idx + 1);
          const direct = typeof u.branch === "string" ? u.branch.trim() : "";
          const merged = direct || branchById.get(id) || "";
          return {
            id,
            username: String(u.username ?? ""),
            email: String(u.email ?? ""),
            name: String(u.fullName ?? u.name ?? ""),
            phone: String(u.phone ?? ""),
            role: String(u.role ?? ""),
            branch: merged || "—",
            managerId: String(u.managerId ?? "N/A"),
            status: Boolean(u.active ?? true),
          };
        });
        setUsers(normalized);
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [viewerRole]);

  const filteredUsers =
    roleFilter === "All"
      ? users
      : users.filter(
          (u) =>
            u.role.replace(/_/g, " ").toLowerCase() === roleFilter.toLowerCase(),
        );
  return (
    <Card>
      <SectionTitle icon="🏢">All Users Management</SectionTitle>
      {viewerRole !== "SUPER_ADMIN" ? (
        <p style={{ fontSize: 12, color: C.muted, marginBottom: 0 }}>
          All users listing is available only for Super Admin.
        </p>
      ) : null}
      {viewerRole === "SUPER_ADMIN" ? (
        <>
      <p style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
        Branch may be omitted for some roles in <code>/all-users</code>; when the same user appears in branch
        transfer eligibility, we show that branch here.
      </p>
      {/* filters */}
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}
      >
        {ALL_ROLES.map((r) => (
          <FilterBtn
            key={r}
            label={r}
            active={roleFilter === r}
            onClick={() => setRoleFilter(r)}
          />
        ))}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <TableHead
            cols={[
              "ID",
              "Username",
              "Email",
              "Name",
              "Phone",
              "Role",
              "Branch",
              "Manager ID",
              "Status",
            ]}
          />
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ padding: 24, textAlign: "center", color: C.muted }}>
                  No users loaded. Check login token and admin API access.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u, i) => (
                <tr
                  key={u.id}
                  style={{
                    background: i % 2 === 0 ? C.card : C.surface,
                  }}
                >
                  <td style={{ padding: "12px 14px", fontSize: 14 }}>{u.id}</td>
                  <td
                    style={{
                      padding: "12px 14px",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {u.username}
                  </td>
                  <td
                    style={{ padding: "12px 14px", fontSize: 14, color: C.muted }}
                  >
                    {u.email}
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 14 }}>{u.name}</td>
                  <td style={{ padding: "12px 14px", fontSize: 14 }}>
                    {u.phone}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <Badge>{u.role}</Badge>
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 14 }}>
                    {u.branch}
                  </td>
                  <td
                    style={{ padding: "12px 14px", fontSize: 14, color: C.muted }}
                  >
                    {u.managerId}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <StatusPill active={u.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
        </>
      ) : null}
    </Card>
  );
}

// ─── SECTION 5 : Sales Executives Management ─────────────────────────────────
interface SalesExecutive {
  id: number;
  name: string;
  email: string;
  phone: string;
  branch: string;
  manager: string;
  status: boolean;
}

function SalesExecSection() {
  const [execs, setExecs] = useState<SalesExecutive[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewerRole] = useState(() => {
    if (typeof window === "undefined") return "";
    const role = window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "";
    return normalizeRole(role);
  });
  const [viewerName] = useState(() => {
    if (typeof window === "undefined") return "";
    const name = window.localStorage.getItem(CRM_USER_NAME_STORAGE_KEY) ?? "";
    return name.trim();
  });
  const [allUsers, setAllUsers] = useState<Array<Record<string, unknown>>>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    role: "SALES_EXECUTIVE",
    fullName: "",
    email: "",
    phone: "",
    branch: "",
    username: "",
    password: "",
    parentId: "",
  });

  useEffect(() => {
    if (viewerRole === "PRESALES_MANAGER") {
      setCreateForm((prev) => ({ ...prev, role: "PRESALES_EXECUTIVE" }));
    } else if (viewerRole === "TERRITORY_DESIGN_MANAGER") {
      setCreateForm((prev) => ({ ...prev, role: "DESIGN_MANAGER" }));
    } else if (viewerRole === "DESIGN_MANAGER") {
      setCreateForm((prev) => ({ ...prev, role: "DESIGNER" }));
    } else if (viewerRole === "SALES_MANAGER") {
      setCreateForm((prev) => ({ ...prev, role: "SALES_EXECUTIVE" }));
    }
  }, [viewerRole]);

  const isSalesManagerViewer = viewerRole === "SALES_MANAGER";
  const isPresalesManagerViewer = viewerRole === "PRESALES_MANAGER";
  const isTerritoryDesignManagerViewer = viewerRole === "TERRITORY_DESIGN_MANAGER";
  const isDesignManagerViewer = viewerRole === "DESIGN_MANAGER";
  const isManagerViewer =
    isSalesManagerViewer ||
    isPresalesManagerViewer ||
    isTerritoryDesignManagerViewer ||
    isDesignManagerViewer;
  const managerTitle = isPresalesManagerViewer
    ? "Presales Executives"
    : isTerritoryDesignManagerViewer
      ? "Design Managers"
      : isDesignManagerViewer
        ? "Designers"
        : "Sales Executives";
  const parentLabel = isPresalesManagerViewer
    ? "Presales Manager *"
    : isTerritoryDesignManagerViewer
      ? createForm.role === "DESIGN_MANAGER"
        ? "Territory Design Manager *"
        : "Design Manager *"
      : isDesignManagerViewer
        ? "Design Manager *"
        : "Sales Manager *";

  const load = () => {
    setLoading(true);
    const listReq = isPresalesManagerViewer
      ? adminPanelApi.listPreSales()
      : isTerritoryDesignManagerViewer
        ? adminPanelApi.listDesignManagers()
        : isDesignManagerViewer
          ? adminPanelApi.listDesigners()
          : adminPanelApi.listSalesExecutives();
    const parentReq = !showCreate
      ? Promise.resolve([] as Array<Record<string, unknown>>)
      : isSalesManagerViewer
        ? adminPanelApi.listManagers().catch(() => [] as Array<Record<string, unknown>>)
        : isPresalesManagerViewer
          ? adminPanelApi.listPreSales().catch(() => [] as Array<Record<string, unknown>>)
          : isTerritoryDesignManagerViewer
            ? Promise.resolve([] as Array<Record<string, unknown>>)
          : isDesignManagerViewer
            ? adminPanelApi.listDesignManagers().catch(() => [] as Array<Record<string, unknown>>)
            : adminPanelApi.listAllUsers().catch(() => [] as Array<Record<string, unknown>>);
    void Promise.all([listReq, parentReq])
      .then(([rows, users]) => {
        const mapped = rows.map((r) => ({
            id: Number(r.id ?? 0),
            name: String(r.fullName ?? r.name ?? r.username ?? ""),
            email: String(r.email ?? ""),
            phone: String(r.phone ?? ""),
            branch: String(r.branch ?? ""),
            manager: String(r.managerName ?? r.managerUsername ?? r.managerId ?? "—"),
            status: Boolean(r.active ?? true),
          }));
        const filtered = isManagerViewer && viewerName
          ? mapped.filter((e) => e.manager.toLowerCase().includes(viewerName.toLowerCase()))
          : mapped;
        setExecs(filtered);
        setAllUsers(users);
      })
      .catch(() => setExecs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!viewerRole) return;
    load();
  }, [
    isDesignManagerViewer,
    isManagerViewer,
    isPresalesManagerViewer,
    isTerritoryDesignManagerViewer,
    showCreate,
    viewerRole,
    viewerName,
  ]);

  const toggleStatus = (id: number, next: boolean) => {
    const req = isPresalesManagerViewer
      ? adminPanelApi.updatePreSales(id, { active: next })
      : isTerritoryDesignManagerViewer
        ? adminPanelApi.updateDesignManager(id, { active: next })
        : isDesignManagerViewer
          ? adminPanelApi.updateDesigner(id, { active: next })
      : adminPanelApi.updateSalesExecutive(id, { active: next });
    void req
      .then(() => load())
      .catch(() => {});
  };

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionTitle icon="💼">
          {managerTitle} Management
        </SectionTitle>
        <Btn
          color={C.success}
          style={{ fontSize: 13, padding: "8px 16px" }}
          onClick={() => setShowCreate((v) => !v)}
        >
          + Create {managerTitle.slice(0, -1)}
        </Btn>
      </div>
      {showCreate ? (
        <div style={{ marginBottom: 18, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
          <h3 style={{ margin: "0 0 8px 0", fontSize: 20, fontWeight: 700 }}>
            Create {managerTitle.slice(0, -1)}
          </h3>
          <p style={{ margin: "0 0 12px 0", fontSize: 12, color: C.muted }}>
            Fill the details below to add a new executive.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>
                Role *
              </label>
              <Select
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
              >
                {isTerritoryDesignManagerViewer ? (
                  <>
                    <option value="DESIGN_MANAGER">Design Manager</option>
                    <option value="DESIGNER">Designer</option>
                  </>
                ) : isDesignManagerViewer ? (
                  <option value="DESIGNER">Designer</option>
                ) : (
                  <option value={isPresalesManagerViewer ? "PRESALES_EXECUTIVE" : "SALES_EXECUTIVE"}>
                    {isPresalesManagerViewer ? "Presales Executive" : "Sales Executive"}
                  </option>
                )}
              </Select>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>
                Name *
              </label>
              <Input
                placeholder="Full Name"
                value={createForm.fullName}
                onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>
                Email *
              </label>
              <Input
                placeholder="Email"
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>
                Phone *
              </label>
              <Input
                placeholder="Phone"
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>
                Branch *
              </label>
              <Select
                value={createForm.branch}
                onChange={(e) => setCreateForm({ ...createForm, branch: e.target.value })}
              >
                <option value="">Select Branch</option>
                {BRANCH_TRANSFER_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>
                {parentLabel}
              </label>
              <Select
                value={createForm.parentId}
                onChange={(e) => setCreateForm({ ...createForm, parentId: e.target.value })}
              >
                <option value="">Select Parent</option>
                {allUsers
                  .filter((u) => {
                    const role = String(u.role ?? "").toUpperCase();
                    if (isPresalesManagerViewer) return role === "PRESALES_MANAGER";
                    if (isTerritoryDesignManagerViewer) {
                      return createForm.role === "DESIGN_MANAGER"
                        ? role === "TERRITORY_DESIGN_MANAGER"
                        : role === "DESIGN_MANAGER";
                    }
                    if (isDesignManagerViewer) return role === "DESIGN_MANAGER";
                    return role === "SALES_MANAGER";
                  })
                  .map((u) => (
                    <option key={String(u.id)} value={String(u.id)}>
                      {String(u.fullName ?? u.name ?? u.username ?? `User ${u.id}`)}
                    </option>
                  ))}
              </Select>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>
                Username *
              </label>
              <Input
                placeholder="Username"
                value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>
                Password *
              </label>
              <Input
                placeholder="Password"
                type="password"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <Btn
              color={C.success}
              disabled={
                !createForm.fullName.trim() ||
                !createForm.email.trim() ||
                !createForm.phone.trim() ||
                !createForm.branch.trim() ||
                !createForm.username.trim() ||
                !createForm.password.trim() ||
                !createForm.parentId
              }
              onClick={() => {
                const payload = {
                  role: createForm.role,
                  fullName: createForm.fullName.trim(),
                  name: createForm.fullName.trim(),
                  email: createForm.email.trim(),
                  phone: createForm.phone.trim(),
                  branch: createForm.branch,
                  username: createForm.username.trim(),
                  password: createForm.password,
                  managerId: Number(createForm.parentId),
                };
                const req = isPresalesManagerViewer
                  ? adminPanelApi.createPreSales(payload)
                  : createForm.role === "DESIGN_MANAGER"
                    ? adminPanelApi.createDesignManager(payload)
                    : createForm.role === "DESIGNER"
                      ? adminPanelApi.createDesigner(payload)
                  : adminPanelApi.createSalesExecutive(payload);
                void req
                  .then(() => {
                    setCreateForm({
                      role: isTerritoryDesignManagerViewer
                        ? "DESIGN_MANAGER"
                        : isDesignManagerViewer
                          ? "DESIGNER"
                          : isPresalesManagerViewer
                            ? "PRESALES_EXECUTIVE"
                            : "SALES_EXECUTIVE",
                      fullName: "",
                      email: "",
                      phone: "",
                      branch: "",
                      username: "",
                      password: "",
                      parentId: "",
                    });
                    setShowCreate(false);
                    load();
                  })
                  .catch(() => {});
              }}
            >
              Save {managerTitle.slice(0, -1)}
            </Btn>
            <Btn color={C.neutral} onClick={() => setShowCreate(false)}>
              Cancel
            </Btn>
          </div>
        </div>
      ) : null}
      {!loading ? (
        <p style={{ fontSize: 13, color: C.muted, marginTop: -12, marginBottom: 12 }}>
          {execs.length} {managerTitle.toLowerCase()}.
        </p>
      ) : null}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <TableHead
            cols={[
              "ID",
              "Name",
              "Email",
              "Phone",
              "Branch",
              isPresalesManagerViewer
                ? "Presales Manager"
                : isTerritoryDesignManagerViewer
                  ? "TDM"
                  : isDesignManagerViewer
                    ? "Design Manager"
                    : "Sales Manager",
              "Status",
              "Actions",
            ]}
          />
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: 24, textAlign: "center", color: C.muted }}>
                  Loading…
                </td>
              </tr>
            ) : execs.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 24, textAlign: "center", color: C.muted }}>
                  No sales executives returned from the API.
                </td>
              </tr>
            ) : (
              execs.map((e, i) => (
              <tr
                key={e.id}
                style={{
                  background: i % 2 === 0 ? C.card : C.surface,
                }}
              >
                <td style={{ padding: "12px 14px", fontSize: 14 }}>{e.id}</td>
                <td
                  style={{
                    padding: "12px 14px",
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  {e.name}
                </td>
                <td
                  style={{ padding: "12px 14px", fontSize: 14, color: C.muted }}
                >
                  {e.email}
                </td>
                <td style={{ padding: "12px 14px", fontSize: 14 }}>
                  {e.phone}
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <Badge color={C.successBg} text={C.successText}>
                    {e.branch}
                  </Badge>
                </td>
                <td style={{ padding: "12px 14px", fontSize: 14 }}>
                  {e.manager}
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <Toggle
                    active={e.status}
                    onChange={() => toggleStatus(e.id, !e.status)}
                  />
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <Btn
                    color={C.danger}
                    style={{ padding: "5px 14px", fontSize: 13 }}
                    onClick={() => {
                      if (!window.confirm("Delete this executive?")) return;
                      const req = isPresalesManagerViewer
                        ? adminPanelApi.deletePreSales(e.id)
                        : isTerritoryDesignManagerViewer
                          ? adminPanelApi.deleteDesignManager(e.id)
                          : isDesignManagerViewer
                            ? adminPanelApi.deleteDesigner(e.id)
                        : adminPanelApi.deleteSalesExecutive(e.id);
                      void req.then(() => load()).catch(() => {});
                    }}
                  >
                    Delete
                  </Btn>
                </td>
              </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── SECTION 6 : Lead Limit Management ───────────────────────────────────────
const LIMIT_ROLES = [
  "Sales Executive",
  "Sales Manager",
  "Presales Executive",
  "Presales Manager",
];

const LIMIT_ROLE_TO_API: Record<string, string> = {
  "Sales Executive": "SALES_EXECUTIVE",
  "Sales Manager": "SALES_MANAGER",
  "Presales Executive": "PRESALES_EXECUTIVE",
  "Presales Manager": "PRESALES_MANAGER",
};

interface UserLimit {
  userId: number;
  name: string;
  role: string;
  branch: string;
  current: number;
  limit: number;
  remaining: number;
  pct: number;
}

function mapLimitUser(u: Record<string, unknown>, idx: number): UserLimit {
  const userId = Number(u.userId ?? u.id ?? idx);
  const limit = pickNumber(u, ["limit", "monthlyLimit", "leadLimit", "maxLeads"]) ?? 0;
  const current = pickNumber(u, ["current", "currentCount", "used", "leadsCount", "activeLeads"]) ?? 0;
  const remaining = pickNumber(u, ["remaining"]) ?? Math.max(0, limit - current);
  const pct = limit > 0 ? Math.round((current / limit) * 1000) / 10 : 0;
  return {
    userId,
    name: String(u.fullName ?? u.name ?? u.username ?? `User ${userId}`),
    role: String(u.role ?? ""),
    branch: String(u.branch ?? ""),
    current,
    limit,
    remaining,
    pct,
  };
}

function LeadLimitSection() {
  const [viewerRole] = useState(() => {
    if (typeof window === "undefined") return "";
    const role = window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "";
    return normalizeRole(role);
  });
  const canManageLeadLimits =
    viewerRole === "SUPER_ADMIN" ||
    viewerRole === "ADMIN" ||
    viewerRole === "SALES_ADMIN";
  const [defaultLimit, setDefaultLimit] = useState<string>("50");
  const [limitTab, setLimitTab] = useState<"users" | "role">("users");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [roleLimit, setRoleLimit] = useState<string>("");
  const [users, setUsers] = useState<UserLimit[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [bulkLimit, setBulkLimit] = useState<string>("");
  const [showModal, setShowModal] = useState(false);
  const [currentEditingUser, setCurrentEditingUser] =
    useState<UserLimit | null>(null);
  const [currentEditingLimit, setCurrentEditingLimit] = useState<string>("");
  const [limitsLoading, setLimitsLoading] = useState(false);

  const loadLimits = () => {
    setLimitsLoading(true);
    void Promise.all([leadLimitsApi.listUsers(), leadLimitsApi.getDefault()])
      .then(([rows, def]) => {
        setUsers(rows.map((r, i) => mapLimitUser(r, i)));
        const d = pickNumber(def, ["defaultLimit", "limit", "value"]);
        if (d !== undefined) setDefaultLimit(String(d));
      })
      .catch(() => {
        setUsers([]);
      })
      .finally(() => setLimitsLoading(false));
  };

  useEffect(() => {
    if (!canManageLeadLimits) return;
    loadLimits();
  }, [canManageLeadLimits]);

  const toggleRole = (r: string) =>
    setSelectedRoles((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );

  const toggleUserSelect = (userId: number) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((x) => x !== userId) : [...prev, userId],
    );
  };

  const toggleSelectAll = () => {
    if (users.length > 0 && selectedUserIds.length === users.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(users.map((u) => u.userId));
    }
  };

  const getSelectedCount = () => selectedUserIds.length;

  const allSelected = users.length > 0 && selectedUserIds.length === users.length;

  return (
    <Card>
      {!canManageLeadLimits ? (
        <>
          <SectionTitle icon="📊">Lead Limit Management</SectionTitle>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 0 }}>
            Lead limit management is available only for Admin, Sales Admin, and Super Admin.
          </p>
        </>
      ) : (
        <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <SectionTitle icon="📊">Lead Limit Management</SectionTitle>
        <Btn color={C.accent} style={{ fontSize: 13, padding: "7px 16px" }} onClick={loadLimits}>
          ↻ Refresh
        </Btn>
      </div>

      {/* Default limit banner */}
      <div
        style={{
          background: C.tabGrad,
          borderRadius: 16,
          padding: "20px 24px",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <p style={{ color: "rgba(255,255,255,0.78)", fontSize: 13, margin: 0 }}>
            Default monthly limit for new users
          </p>
          <p
            style={{
              color: C.white,
              fontSize: 13,
              marginTop: 6,
              fontWeight: 600,
            }}
          >
            📌 Current:{" "}
            <strong style={{ fontSize: 14 }}>{defaultLimit} leads/month</strong>
          </p>
        </div>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          <input
            type="number"
            value={defaultLimit}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setDefaultLimit(e.target.value)
            }
            style={{
              width: 80,
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              fontSize: 14,
              fontWeight: 700,
              textAlign: "center",
              outline: "none",
              background: C.card,
              color: C.text,
            }}
          />
          <Btn
            color={C.success}
            style={{ fontSize: 13, padding: "8px 18px" }}
            onClick={() => {
              const n = Number(defaultLimit);
              if (Number.isNaN(n)) return;
              void leadLimitsApi.setDefault(n).then(() => loadLimits()).catch(() => {});
            }}
          >
            Update Default
          </Btn>
        </div>
      </div>

      {/* Sub tabs */}
      <div
        style={{
          display: "flex",
          gap: 6,
          background: C.surface,
          borderRadius: 10,
          padding: 5,
          width: "fit-content",
          marginBottom: 20,
        }}
      >
        <Tab
          label="Per User Limits"
          active={limitTab === "users"}
          onClick={() => setLimitTab("users")}
        />
        <Tab
          label="Set by Role"
          active={limitTab === "role"}
          onClick={() => setLimitTab("role")}
        />
      </div>

      {limitTab === "users" && (
        <>
          {/* Selection section */}
          {getSelectedCount() > 0 && (
            <div
              style={{
                background: C.warningBg ?? "var(--crm-warning-bg)",
                border: "1.5px solid var(--crm-warning-text)",
                borderRadius: 12,
                padding: "16px 18px",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 16,
                justifyContent: "space-between",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--crm-warning-text)" }}>
                📋 {getSelectedCount()} user
                {getSelectedCount() !== 1 ? "s" : ""} selected
              </span>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <input
                  type="number"
                  placeholder="Enter limit"
                  value={bulkLimit}
                  onChange={(e) => setBulkLimit(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: `1px solid var(--crm-warning-text)`,
                    fontSize: 13,
                    outline: "none",
                    background: C.card,
                    color: C.text,
                    minWidth: 140,
                  }}
                />
                <Btn
                  color="var(--crm-warning-text)"
                  onClick={() => setShowModal(true)}
                  style={{ fontSize: 12, padding: "8px 14px" }}
                >
                  📋 Set Limit for Selected
                </Btn>
                <Btn
                  color={C.danger}
                  onClick={() => {
                    setSelectedUserIds([]);
                    setBulkLimit("");
                  }}
                  style={{ fontSize: 12, padding: "8px 14px" }}
                >
                  Clear Selection
                </Btn>
              </div>
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 13, color: C.muted }}>
              {limitsLoading ? "Loading…" : `${users.length} users`}
            </span>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                color: C.text,
              }}
            >
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                style={{
                  width: 16,
                  height: 16,
                  accentColor: C.primary,
                  cursor: "pointer",
                }}
              />
              Select All
            </label>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ borderBottom: `2px solid ${C.border}` }}>
                <tr>
                  <th
                    style={{
                      padding: "12px 14px",
                      textAlign: "left",
                      fontSize: 12,
                      fontWeight: 700,
                      color: C.muted,
                      width: 40,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      style={{
                        width: 16,
                        height: 16,
                        accentColor: C.primary,
                        cursor: "pointer",
                      }}
                    />
                  </th>
                  <th
                    style={{
                      padding: "12px 14px",
                      textAlign: "left",
                      fontSize: 12,
                      fontWeight: 700,
                      color: C.muted,
                      textTransform: "uppercase",
                    }}
                  >
                    Name
                  </th>
                  <th
                    style={{
                      padding: "12px 14px",
                      textAlign: "left",
                      fontSize: 12,
                      fontWeight: 700,
                      color: C.muted,
                      textTransform: "uppercase",
                    }}
                  >
                    Role
                  </th>
                  <th
                    style={{
                      padding: "12px 14px",
                      textAlign: "left",
                      fontSize: 12,
                      fontWeight: 700,
                      color: C.muted,
                      textTransform: "uppercase",
                    }}
                  >
                    Branch
                  </th>
                  <th
                    style={{
                      padding: "12px 14px",
                      textAlign: "left",
                      fontSize: 12,
                      fontWeight: 700,
                      color: C.muted,
                      textTransform: "uppercase",
                    }}
                  >
                    Current
                  </th>
                  <th
                    style={{
                      padding: "12px 14px",
                      textAlign: "left",
                      fontSize: 12,
                      fontWeight: 700,
                      color: C.muted,
                      textTransform: "uppercase",
                    }}
                  >
                    Limit
                  </th>
                  <th
                    style={{
                      padding: "12px 14px",
                      textAlign: "left",
                      fontSize: 12,
                      fontWeight: 700,
                      color: C.muted,
                      textTransform: "uppercase",
                    }}
                  >
                    Remaining
                  </th>
                  <th
                    style={{
                      padding: "12px 14px",
                      textAlign: "left",
                      fontSize: 12,
                      fontWeight: 700,
                      color: C.muted,
                      textTransform: "uppercase",
                    }}
                  >
                    Usage
                  </th>
                  <th
                    style={{
                      padding: "12px 14px",
                      textAlign: "left",
                      fontSize: 12,
                      fontWeight: 700,
                      color: C.muted,
                      textTransform: "uppercase",
                    }}
                  >
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {limitsLoading ? (
                  <tr>
                    <td colSpan={9} style={{ padding: 24, textAlign: "center", color: C.muted }}>
                      Loading lead limits…
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: 24, textAlign: "center", color: C.muted }}>
                      No users returned from lead-limits API.
                    </td>
                  </tr>
                ) : (
                  users.map((u, i) => {
                  const barColor =
                    u.pct === 0
                      ? C.borderStrong
                      : u.pct < 50
                        ? C.success
                        : u.pct < 80
                          ? "var(--crm-warning-text)"
                          : C.danger;
                  return (
                    <tr
                      key={u.userId}
                      style={{
                        background:
                          u.limit === 0
                            ? C.dangerBg
                            : i % 2 === 0
                              ? C.card
                              : C.surface,
                        color: C.text,
                      }}
                    >
                      <td style={{ padding: "12px 14px", textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(u.userId)}
                          onChange={() => toggleUserSelect(u.userId)}
                          style={{
                            width: 16,
                            height: 16,
                            accentColor: C.primary,
                            cursor: "pointer",
                          }}
                        />
                      </td>
                      <td
                        style={{
                          padding: "12px 14px",
                          fontWeight: 600,
                          fontSize: 14,
                        }}
                      >
                        {u.name}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <Badge>{u.role}</Badge>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 14 }}>
                        {u.branch}
                      </td>
                      <td
                        style={{
                          padding: "12px 14px",
                          fontSize: 14,
                          color: u.current === 0 ? C.danger : C.text,
                          fontWeight: 600,
                        }}
                      >
                        {u.current}
                      </td>
                      <td
                        style={{
                          padding: "12px 14px",
                          fontSize: 14,
                          fontWeight: 600,
                        }}
                      >
                        {u.limit}
                      </td>
                      <td
                        style={{
                          padding: "12px 14px",
                          fontSize: 14,
                          color: u.remaining === 0 ? C.danger : C.success,
                          fontWeight: 600,
                        }}
                      >
                        {u.remaining}
                      </td>
                      <td style={{ padding: "12px 14px", minWidth: 140 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <div
                            style={{
                              flex: 1,
                              height: 6,
                              background: C.borderStrong,
                              borderRadius: 3,
                            }}
                          >
                            <div
                              style={{
                                width: `${u.pct}%`,
                                height: "100%",
                                background: barColor,
                                borderRadius: 3,
                              }}
                            />
                          </div>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: barColor,
                              minWidth: 38,
                            }}
                          >
                            {u.pct}%
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <Btn
                          color={C.primary}
                          onClick={() => {
                            setCurrentEditingUser(u);
                            setCurrentEditingLimit(String(u.limit) || "");
                            setShowModal(true);
                          }}
                          style={{ fontSize: 12, padding: "5px 12px" }}
                        >
                          Set Limit
                        </Btn>
                      </td>
                    </tr>
                  );
                })
                )
                }
              </tbody>
            </table>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 16,
            }}
          >
            <Btn color={C.danger} style={{ fontSize: 13 }}>
              🗑 Cleanup Orphaned Leads
            </Btn>
          </div>
        </>
      )}

      {limitTab === "role" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 20,
            maxWidth: 700,
          }}
        >
          <div>
            <p
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: C.text,
                marginBottom: 12,
              }}
            >
              Select Roles
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {LIMIT_ROLES.map((r) => (
                <label
                  key={r}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(r)}
                    onChange={() => toggleRole(r)}
                    style={{ width: 16, height: 16, accentColor: C.primary }}
                  />
                  {r}
                </label>
              ))}
            </div>
          </div>
          <div>
            <p
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: C.text,
                marginBottom: 12,
              }}
            >
              Monthly Limit
            </p>
            <Input
              type="number"
              placeholder="Enter limit"
              value={roleLimit}
              onChange={(e) => setRoleLimit(e.target.value)}
              style={{ marginBottom: 14 }}
            />
            <Btn
              color={C.success}
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => {
                const lim = Number(roleLimit);
                if (Number.isNaN(lim) || selectedRoles.length === 0) return;
                const roles = selectedRoles
                  .map((r) => LIMIT_ROLE_TO_API[r] ?? r.replace(/\s+/g, "_").toUpperCase())
                  .filter(Boolean);
                void leadLimitsApi
                  .bulkRoles({ roles, limit: lim })
                  .then(() => {
                    setRoleLimit("");
                    loadLimits();
                  })
                  .catch(() => {});
              }}
            >
              🗓 Set Limit for Roles
            </Btn>
            <p
              style={{
                fontSize: 12,
                color: C.muted,
                marginTop: 8,
                textAlign: "center",
              }}
            >
              {selectedRoles.length} role
              {selectedRoles.length !== 1 ? "s" : ""} selected
            </p>
          </div>
        </div>
      )}

      {/* Modal for setting limit for selected users */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setCurrentEditingUser(null);
          setCurrentEditingLimit("");
        }}
        title="Set Monthly Lead Limit"
      >
        <div>
          <p
            style={{
              fontSize: 14,
              color: C.text,
              marginBottom: 16,
              fontWeight: 600,
            }}
          >
            Set the monthly lead limit for:
          </p>

          {/* Selected users cards */}
          <div
            style={{
              maxHeight: 300,
              overflowY: "auto",
              marginBottom: 20,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {currentEditingUser ? (
              <div
                style={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderLeft: `3px solid ${C.primary}`,
                  borderRadius: 8,
                  padding: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 20 }}>👤</div>
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: C.text,
                      margin: 0,
                    }}
                  >
                    {currentEditingUser.name}
                  </p>
                  <p
                    style={{
                      fontSize: 12,
                      color: C.muted,
                      margin: "4px 0 0 0",
                    }}
                  >
                    {currentEditingUser.role} • {currentEditingUser.branch}
                  </p>
                </div>
              </div>
            ) : (
              selectedUserIds.slice(0, 3).map((userId) => {
                const row = users.find((x) => x.userId === userId);
                if (!row) return null;
                return (
                  <div
                    key={userId}
                    style={{
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      borderLeft: `3px solid ${C.primary}`,
                      borderRadius: 8,
                      padding: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div style={{ fontSize: 20 }}>👤</div>
                    <div style={{ flex: 1 }}>
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: C.text,
                          margin: 0,
                        }}
                      >
                        {row.name}
                      </p>
                      <p
                        style={{
                          fontSize: 12,
                          color: C.muted,
                          margin: "4px 0 0 0",
                        }}
                      >
                        {row.role} • {row.branch}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {!currentEditingUser && selectedUserIds.length > 3 && (
            <p
              style={{
                fontSize: 12,
                color: C.muted,
                textAlign: "center",
                marginBottom: 16,
              }}
            >
              ... and {selectedUserIds.length - 3} more user
              {selectedUserIds.length - 3 !== 1 ? "s" : ""}
            </p>
          )}

          <label
            style={{
              display: "block",
              fontSize: 14,
              fontWeight: 600,
              color: C.text,
              marginBottom: 10,
            }}
          >
            Monthly Lead Limit:
          </label>
          <input
            type="number"
            value={currentEditingUser ? currentEditingLimit : bulkLimit}
            onChange={(e) =>
              currentEditingUser
                ? setCurrentEditingLimit(e.target.value)
                : setBulkLimit(e.target.value)
            }
            placeholder="e.g., 100"
            autoFocus
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 8,
              border: `2px solid ${C.primary}`,
              fontSize: 16,
              fontWeight: 600,
              outline: "none",
              boxSizing: "border-box",
              background: C.surface,
            }}
          />
          <p
            style={{
              fontSize: 12,
              color: C.muted,
              marginTop: 8,
            }}
          >
            Current limit:{" "}
            {currentEditingUser ? currentEditingLimit : bulkLimit || "0"}{" "}
            leads/month
          </p>

          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 24,
              justifyContent: "flex-end",
            }}
          >
            <Btn
              color={C.text}
              onClick={() => {
                setShowModal(false);
                setCurrentEditingUser(null);
                setCurrentEditingLimit("");
              }}
              style={{
                fontSize: 13,
              }}
            >
              Cancel
            </Btn>
            <Btn
              color={C.success}
              onClick={() => {
                const lim = Number(currentEditingUser ? currentEditingLimit : bulkLimit);
                if (Number.isNaN(lim)) return;
                if (currentEditingUser) {
                  void leadLimitsApi
                    .setUserLimit(currentEditingUser.userId, lim)
                    .then(() => {
                      setCurrentEditingUser(null);
                      setCurrentEditingLimit("");
                      setShowModal(false);
                      loadLimits();
                    })
                    .catch(() => {});
                } else {
                  void leadLimitsApi
                    .bulkUsers({ userIds: selectedUserIds, limit: lim })
                    .then(() => {
                      setShowModal(false);
                      setBulkLimit("");
                      setSelectedUserIds([]);
                      loadLimits();
                    })
                    .catch(() => {});
                }
              }}
              style={{
                fontSize: 13,
              }}
            >
              💾 Save Limit
            </Btn>
          </div>
        </div>
      </Modal>
        </>
      )}
    </Card>
  );
}

// ─── HERO / QUICK NAV ─────────────────────────────────────────────────────────
interface Section {
  id: string;
  label: string;
  icon: string;
  desc: string;
}

const SECTIONS: Section[] = [
  {
    id: "adminUser",
    label: "Admin & Users",
    icon: "👥",
    desc: "Create admins, users & view list",
  },
  {
    id: "assign",
    label: "Assign Executive",
    icon: "🔗",
    desc: "Map sales exec to manager",
  },
  {
    id: "branch",
    label: "Branch Transfer",
    icon: "🔄",
    desc: "Move staff between branches",
  },
  {
    id: "allUsers",
    label: "All Users",
    icon: "🏢",
    desc: "View & filter all roles",
  },
  {
    id: "salesExec",
    label: "Sales Executives",
    icon: "💼",
    desc: "Manage exec accounts",
  },
  {
    id: "leadLimit",
    label: "Lead Limits",
    icon: "📊",
    desc: "Set monthly lead quotas",
  },
];

// ─── MAIN CONTENT COMPONENT ───────────────────────────────────────────────────
export default function AdminPanelContent() {
  const [viewerRole] = useState(() => {
    if (typeof window === "undefined") return "";
    const role = window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "";
    return normalizeRole(role);
  });

  const isAdmin = viewerRole === "ADMIN";
  const isSalesAdmin = viewerRole === "SALES_ADMIN";
  const isSalesManager = viewerRole === "SALES_MANAGER";
  const isPresalesManager = viewerRole === "PRESALES_MANAGER";
  const isTerritoryDesignManager = viewerRole === "TERRITORY_DESIGN_MANAGER";
  const isDesignManager = viewerRole === "DESIGN_MANAGER";
  const isSuperAdmin = viewerRole === "SUPER_ADMIN";
  const canSeeLeadLimit = isSuperAdmin || isAdmin || isSalesAdmin;
  const baseSections = isSalesManager || isPresalesManager || isTerritoryDesignManager || isDesignManager
    ? SECTIONS.filter((section) => section.id === "salesExec")
    : SECTIONS.filter((section) => {
        if (section.id === "allUsers") return isSuperAdmin;
        if (section.id === "leadLimit") return canSeeLeadLimit;
        return true;
      });
  const sections = baseSections.map((section) => {
    if (section.id !== "salesExec") return section;
    if (isTerritoryDesignManager) {
      return { ...section, label: "Design Team", desc: "Create and manage design users" };
    }
    if (isDesignManager) {
      return { ...section, label: "Designers", desc: "Create and manage designers" };
    }
    return section;
  });

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div
      className="min-h-screen bg-[var(--crm-app-bg)] px-4 py-7 md:px-8"
      style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}
    >
      {/* Quick nav cards - Modern compact design */}
      <div className="mb-7 flex flex-wrap gap-2.5">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => scrollTo(s.id)}
            className="flex items-center gap-2 rounded-full border border-[var(--crm-border)] bg-[var(--crm-surface)] px-4 py-2.5 text-[13px] font-medium text-[var(--crm-text-primary)] transition-all duration-150 hover:-translate-y-px hover:border-[var(--crm-accent)] hover:bg-[var(--crm-accent)] hover:text-white"
          >
            <span className="text-sm">{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-6">
        {!isSalesManager &&
        !isPresalesManager &&
        !isTerritoryDesignManager &&
        !isDesignManager ? (
          <>
            <div id="adminUser">
              <AdminUserSection />
            </div>
            <div id="assign">
              <AssignSection />
            </div>
            <div id="branch">
              <BranchTransferSection />
            </div>
            {isSuperAdmin ? (
              <div id="allUsers">
                <AllUsersSection />
              </div>
            ) : null}
            <div id="salesExec">
              <SalesExecSection />
            </div>
            {canSeeLeadLimit ? (
              <div id="leadLimit">
                <LeadLimitSection />
              </div>
            ) : null}
          </>
        ) : (
          <div id="salesExec">
            <SalesExecSection />
          </div>
        )}
      </div>
    </div>
  );
}
