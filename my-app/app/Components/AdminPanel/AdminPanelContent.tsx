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

// ─── colour tokens (matches your existing teal/blue palette) ─────────────────
const C = {
  bg: "#f0f4f8",
  card: "#ffffff",
  primary: "#2563eb",
  primaryHover: "#1d4ed8",
  accent: "#0ea5e9",
  danger: "#ef4444",
  success: "#22c55e",
  border: "#e2e8f0",
  text: "#000000",
  muted: "#000000",
  badgeBg: "#eff6ff",
  badgeText: "#1d4ed8",
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
}

const Card = ({ children, style = {} }: CardProps) => (
  <div
    style={{
      background: C.card,
      borderRadius: 14,
      boxShadow: "0 1px 4px rgba(0,0,0,.07)",
      padding: 28,
      ...style,
    }}
  >
    {children}
  </div>
);

const SectionTitle = ({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) => (
  <h2
    style={{
      fontSize: 18,
      fontWeight: 700,
      color: C.text,
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 20,
    }}
  >
    <span style={{ fontSize: 20 }}>{icon}</span> {children}
  </h2>
);

interface InputProps {
  placeholder: string;
  type?: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  style?: CSSProperties;
}

const Input = ({
  placeholder,
  type = "text",
  value,
  onChange,
  style = {},
}: InputProps) => (
  <input
    type={type}
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    style={{
      width: "100%",
      padding: "10px 14px",
      borderRadius: 8,
      border: `1px solid ${C.border}`,
      fontSize: 14,
      color: C.text,
      outline: "none",
      boxSizing: "border-box",
      background: "#f8fafc",
      ...style,
    }}
  />
);

interface SelectProps {
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
  style?: CSSProperties;
}

const Select = ({ value, onChange, children, style = {} }: SelectProps) => (
  <select
    value={value}
    onChange={onChange}
    style={{
      width: "100%",
      padding: "10px 14px",
      borderRadius: 8,
      border: `1px solid ${C.border}`,
      fontSize: 14,
      color: C.text,
      background: "#f8fafc",
      outline: "none",
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
}

const Btn = ({
  onClick,
  children,
  color = C.primary,
  style = {},
  disabled = false,
}: BtnProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      background: disabled ? "#cbd5e1" : color,
      color: "#fff",
      border: "none",
      borderRadius: 8,
      padding: "10px 22px",
      fontSize: 14,
      fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "transform .08s ease, filter .08s ease, box-shadow .12s ease",
      ...style,
    }}
    onMouseEnter={(e: MouseEvent<HTMLButtonElement>) =>
      !disabled && ((e.currentTarget.style.filter = "brightness(0.94)"), (e.currentTarget.style.transform = "translateY(-1px)"), (e.currentTarget.style.boxShadow = "0 6px 14px rgba(15,23,42,0.18)"))
    }
    onMouseLeave={(e: MouseEvent<HTMLButtonElement>) =>
      ((e.currentTarget.style.filter = ""), (e.currentTarget.style.transform = ""), (e.currentTarget.style.boxShadow = ""))
    }
  >
    {children}
  </button>
);

interface BadgeProps {
  children: ReactNode;
  color?: string;
  text?: string;
}

const Badge = ({
  children,
  color = C.badgeBg,
  text = C.badgeText,
}: BadgeProps) => (
  <span
    style={{
      background: color,
      color: text,
      borderRadius: 20,
      padding: "2px 10px",
      fontSize: 12,
      fontWeight: 600,
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
    style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      cursor: "pointer",
    }}
  >
    <button
      style={{
        width: 50,
        height: 28,
        borderRadius: 14,
        border: "none",
        background: active ? "#22c55e" : "#cbd5e1",
        cursor: "pointer",
        transition: "background .2s",
        position: "relative",
        padding: 0,
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "#fff",
          position: "absolute",
          left: active ? 2 : 24,
          transition: "left .2s",
          boxShadow: "0 2px 4px rgba(0,0,0,.1)",
        }}
      />
    </button>
    <span
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: active ? "#22c55e" : "#000000",
      }}
    >
      {active ? "ACTIVE" : "INACTIVE"}
    </span>
  </div>
);

interface StatusPillProps {
  active: boolean;
}

const StatusPill = ({ active }: StatusPillProps) => (
  <span
    style={{
      background: active ? "#dcfce7" : "#fee2e2",
      color: active ? "#166534" : "#991b1b",
      borderRadius: 20,
      padding: "3px 12px",
      fontSize: 12,
      fontWeight: 600,
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
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 10px 40px rgba(0,0,0,.2)",
          maxWidth: 600,
          width: "90%",
          maxHeight: "90vh",
          overflow: "auto",
        }}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        <div
          style={{
            background: "linear-gradient(135deg,#6366f1,#2563eb)",
            color: "#fff",
            padding: "20px 24px",
            borderRadius: "12px 12px 0 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>📋</span>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,.2)",
              border: "none",
              color: "#fff",
              borderRadius: "50%",
              width: 32,
              height: 32,
              fontSize: 18,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: "24px" }}>{children}</div>
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
    onClick={onClick}
    style={{
      padding: "9px 20px",
      border: "none",
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      transition: "transform .08s ease, filter .08s ease",
      background: active ? C.primary : "transparent",
      color: active ? "#fff" : C.muted,
    }}
    onMouseEnter={(e: MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.filter = "brightness(0.96)";
      e.currentTarget.style.transform = "translateY(-1px)";
    }}
    onMouseLeave={(e: MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.filter = "";
      e.currentTarget.style.transform = "";
    }}
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
    onClick={onClick}
    style={{
      padding: "6px 16px",
      borderRadius: 20,
      border: `1px solid ${active ? C.primary : C.border}`,
      background: active ? C.primary : "#fff",
      color: active ? "#fff" : C.muted,
      fontSize: 13,
      fontWeight: 500,
      cursor: "pointer",
      transition: "transform .08s ease, filter .08s ease",
    }}
    onMouseEnter={(e: MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.filter = "brightness(0.96)";
      e.currentTarget.style.transform = "translateY(-1px)";
    }}
    onMouseLeave={(e: MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.style.filter = "";
      e.currentTarget.style.transform = "";
    }}
  >
    {label}
  </button>
);

interface TableHeadProps {
  cols: string[];
}

const TableHead = ({ cols }: TableHeadProps) => (
  <thead>
    <tr style={{ background: "#f8fafc" }}>
      {cols.map((c) => (
        <th
          key={c}
          style={{
            textAlign: "left",
            padding: "10px 14px",
            fontSize: 12,
            fontWeight: 700,
            color: C.text,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            borderBottom: `1px solid ${C.border}`,
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
}

function AdminUserSection() {
  const [tab, setTab] = useState<"admins" | "createAdmin" | "createUser">(
    "admins",
  );
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
  });
  const [admins, setAdmins] = useState<Array<Record<string, unknown>>>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);

  useEffect(() => {
    if (tab !== "admins") return;
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
  }, [tab]);

  const ROLES = [
    "SALES_ADMIN",
    "SALES_MANAGER",
    "SALES_EXECUTIVE",
    "PRESALES_MANAGER",
    "PRESALES_EXECUTIVE",
    "TERRITORY_DESIGN_MANAGER",
    "DESIGN_MANAGER",
    "DESIGNER",
    "MANAGER",
  ];

  return (
    <Card>
      <SectionTitle icon="👥">Admin & User Management</SectionTitle>

      {/* Tab row */}
      <div
        style={{
          display: "flex",
          gap: 6,
          background: "#f1f5f9",
          borderRadius: 10,
          padding: 5,
          width: "fit-content",
          marginBottom: 24,
        }}
      >
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
        <Tab
          label="Create User"
          active={tab === "createUser"}
          onClick={() => setTab("createUser")}
        />
      </div>

      {/* ── Admins List ── */}
      {tab === "admins" && (
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
                      background: i % 2 === 0 ? "#fff" : "#f8fafc",
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
      {tab === "createAdmin" && (
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
        <div style={{ maxWidth: 600 }}>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
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
                Role *
              </label>
              <Select
                value={userForm.role}
                onChange={(e) =>
                  setUserForm({ ...userForm, role: e.target.value })
                }
              >
                <option value="">Select Role</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.replace(/_/g, " ")}
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
                Username *
              </label>
              <Input
                placeholder="Username"
                value={userForm.username}
                onChange={(e) =>
                  setUserForm({ ...userForm, username: e.target.value })
                }
              />
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
                Password *
              </label>
              <Input
                placeholder="Password"
                type="password"
                value={userForm.password}
                onChange={(e) =>
                  setUserForm({ ...userForm, password: e.target.value })
                }
              />
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
                Email *
              </label>
              <Input
                placeholder="Email"
                type="email"
                value={userForm.email}
                onChange={(e) =>
                  setUserForm({ ...userForm, email: e.target.value })
                }
              />
            </div>
          </div>
          <Btn style={{ marginTop: 18 }}>Create User</Btn>
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
              color="#0ea5e9"
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
                style={{ background: "#f1f5f9", cursor: "not-allowed" }}
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
                color="#334155"
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
                          background: i % 2 === 0 ? "#fff" : "#f8fafc",
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
                          <Badge color="#f0fdf4" text="#166534">
                            {fromB}
                          </Badge>
                        </td>
                        <td style={{ padding: "12px 14px", fontSize: 14 }}>
                          <Badge color="#fef3c7" text="#d97706">
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
  const [roleFilter, setRoleFilter] = useState<string>("All");
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
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
  }, []);

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
                    background: i % 2 === 0 ? "#fff" : "#f8fafc",
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

  const load = () => {
    setLoading(true);
    void adminPanelApi
      .listSalesExecutives()
      .then((rows) => {
        setExecs(
          rows.map((r) => ({
            id: Number(r.id ?? 0),
            name: String(r.fullName ?? r.name ?? r.username ?? ""),
            email: String(r.email ?? ""),
            phone: String(r.phone ?? ""),
            branch: String(r.branch ?? ""),
            manager: String(r.managerName ?? r.managerUsername ?? r.managerId ?? "—"),
            status: Boolean(r.active ?? true),
          })),
        );
      })
      .catch(() => setExecs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const toggleStatus = (id: number, next: boolean) => {
    void adminPanelApi
      .updateSalesExecutive(id, { active: next })
      .then(() => load())
      .catch(() => {});
  };

  return (
    <Card>
      <SectionTitle icon="💼">Sales Executives Management</SectionTitle>
      {!loading ? (
        <p style={{ fontSize: 13, color: C.muted, marginTop: -12, marginBottom: 12 }}>
          {execs.length} sales executive(s).
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
              "Sales Manager",
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
                  background: i % 2 === 0 ? "#fff" : "#f8fafc",
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
                  <Badge color="#f0fdf4" text="#166534">
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
                      if (!window.confirm("Delete this sales executive?")) return;
                      void adminPanelApi.deleteSalesExecutive(e.id).then(() => load()).catch(() => {});
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
    loadLimits();
  }, []);

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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
        }}
      >
        <SectionTitle icon="📊">Lead Limit Management</SectionTitle>
        <Btn color="#0ea5e9" style={{ fontSize: 13, padding: "7px 16px" }} onClick={loadLimits}>
          ↻ Refresh
        </Btn>
      </div>

      {/* Default limit banner */}
      <div
        style={{
          background: "linear-gradient(135deg,#6366f1,#2563eb)",
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
          <p style={{ color: "#c7d2fe", fontSize: 13, margin: 0 }}>
            Default monthly limit for new users
          </p>
          <p
            style={{
              color: "#fff",
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
              background: "#fff",
            }}
          />
          <Btn
            color="#22c55e"
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
          background: "#f1f5f9",
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
                background: "#fef3c7",
                border: "1.5px solid #f59e0b",
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
              <span style={{ fontSize: 14, fontWeight: 600, color: "#92400e" }}>
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
                    border: `1px solid #f59e0b`,
                    fontSize: 13,
                    outline: "none",
                    background: "#fff",
                    minWidth: 140,
                  }}
                />
                <Btn
                  color="#f59e0b"
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
                      ? "#e2e8f0"
                      : u.pct < 50
                        ? "#22c55e"
                        : u.pct < 80
                          ? "#f59e0b"
                          : "#ef4444";
                  return (
                    <tr
                      key={u.userId}
                      style={{
                        background:
                          u.limit === 0
                            ? "#fff7f7"
                            : i % 2 === 0
                              ? "#fff"
                              : "#f8fafc",
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
                          color: u.current === 0 ? "#ef4444" : C.text,
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
                          color: u.remaining === 0 ? "#ef4444" : "#22c55e",
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
                              background: "#e2e8f0",
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
              color="#22c55e"
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
                  background: "#f8fafc",
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
                      background: "#f8fafc",
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
              background: "#f8fafc",
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
              color="#475569"
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
              color="#22c55e"
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
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div
      style={{
        background: C.bg,
        minHeight: "100vh",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        padding: "28px 32px",
      }}
    >
      {/* Quick nav cards - Modern compact design */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 28,
        }}
      >
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => scrollTo(s.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 20,
              padding: "10px 16px",
              cursor: "pointer",
              transition: "all .15s",
              fontSize: 13,
              fontWeight: 500,
              color: C.text,
            }}
            onMouseEnter={(e: MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.background = C.primary;
              e.currentTarget.style.color = "#fff";
              e.currentTarget.style.border = `1px solid ${C.primary}`;
            }}
            onMouseLeave={(e: MouseEvent<HTMLButtonElement>) => {
              e.currentTarget.style.background = C.card;
              e.currentTarget.style.color = C.text;
              e.currentTarget.style.border = `1px solid ${C.border}`;
            }}
          >
            <span style={{ fontSize: 14 }}>{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {/* Sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div id="adminUser">
          <AdminUserSection />
        </div>
        <div id="assign">
          <AssignSection />
        </div>
        <div id="branch">
          <BranchTransferSection />
        </div>
        <div id="allUsers">
          <AllUsersSection />
        </div>
        <div id="salesExec">
          <SalesExecSection />
        </div>
        <div id="leadLimit">
          <LeadLimitSection />
        </div>
      </div>
    </div>
  );
}
