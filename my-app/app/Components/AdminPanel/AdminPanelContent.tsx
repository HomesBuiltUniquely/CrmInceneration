"use client";
import {
  useState,
  ReactNode,
  CSSProperties,
  ChangeEvent,
  MouseEvent,
} from "react";

// ─── tiny helpers ────────────────────────────────────────────────────────────
const API = typeof window !== "undefined" ? window.location.origin : "";

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
  text: "#1e293b",
  muted: "#64748b",
  badgeBg: "#eff6ff",
  badgeText: "#1d4ed8",
};

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
      transition: "background .15s",
      ...style,
    }}
    onMouseEnter={(e: MouseEvent<HTMLButtonElement>) =>
      !disabled && (e.currentTarget.style.filter = "brightness(0.92)")
    }
    onMouseLeave={(e: MouseEvent<HTMLButtonElement>) =>
      (e.currentTarget.style.filter = "")
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
        color: active ? "#22c55e" : "#cbd5e1",
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
      transition: "all .15s",
      background: active ? C.primary : "transparent",
      color: active ? "#fff" : C.muted,
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
      transition: "all .15s",
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
            color: C.muted,
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
            <Btn style={{ alignSelf: "flex-start" }}>Create Admin</Btn>
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
  return (
    <Card>
      <SectionTitle icon="🔗">Assign Sales Executive to Manager</SectionTitle>
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
          </Select>
        </div>
        <Btn>Assign</Btn>
      </div>
    </Card>
  );
}

// ─── SECTION 3 : Branch Transfer ─────────────────────────────────────────────
function BranchTransferSection() {
  const [user, setUser] = useState<string>("");
  const [newBranch, setNewBranch] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const BRANCHES = [
    "HBR",
    "SARJAPURA",
    "JP_NAGAR",
    "WHITEFIELD",
    "KORAMANGALA",
  ];

  // Mock history data
  const history = [
    {
      id: 1,
      user: "Shalin J",
      from: "SARJAPURA",
      to: "HBR",
      date: "2024-01-15",
      reason: "Performance-based move",
    },
    {
      id: 2,
      user: "Meghana",
      from: "HBR",
      to: "JP_NAGAR",
      date: "2024-01-10",
      reason: "Internal team reshuffle",
    },
  ];

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
            A clean, single flow to move a teammate between branches while
            keeping all of their context intact.
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
                value=""
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
                New Branch *
              </label>
              <Select
                value={newBranch}
                onChange={(e) => setNewBranch(e.target.value)}
              >
                <option value="">Select Branch</option>
                {BRANCHES.map((b) => (
                  <option key={b}>{b}</option>
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
              }}
            />
          </div>
          <div
            style={{
              marginTop: 16,
              padding: "12px 14px",
              background: "#f0f9ff",
              borderRadius: 8,
              fontSize: 13,
              color: C.muted,
            }}
          >
            Leads & appointments remain linked to this user after transfer.
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
            <Btn
              color="#64748b"
              style={{ fontSize: 13, padding: "7px 16px" }}
              onClick={() => setShowHistory(false)}
            >
              ← Back
            </Btn>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <TableHead
                cols={["User", "From Branch", "To Branch", "Date", "Reason"]}
              />
              <tbody>
                {history.map((h, i) => (
                  <tr
                    key={h.id}
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
                      {h.user}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 14 }}>
                      <Badge color="#f0fdf4" text="#166534">
                        {h.from}
                      </Badge>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 14 }}>
                      <Badge color="#fef3c7" text="#d97706">
                        {h.to}
                      </Badge>
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        fontSize: 14,
                        color: C.muted,
                      }}
                    >
                      {h.date}
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 14 }}>
                      {h.reason}
                    </td>
                  </tr>
                ))}
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
  const mockUsers: User[] = [
    {
      id: 5,
      username: "SA",
      email: "vishal@hubinterior.com",
      name: "tdm",
      phone: "1234567890",
      role: "SALES_ADMIN",
      branch: "HBR",
      managerId: "N/A",
      status: true,
    },
    {
      id: 2,
      username: "TDM",
      email: "harsh@hubinterior.com",
      name: "tdm",
      phone: "1234567890",
      role: "TERRITORY_DESIGN_MANAGER",
      branch: "HBR",
      managerId: "N/A",
      status: true,
    },
  ];
  return (
    <Card>
      <SectionTitle icon="🏢">All Users Management</SectionTitle>
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
            {mockUsers.map((u, i) => (
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
            ))}
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
  const [execs, setExecs] = useState<SalesExecutive[]>([
    {
      id: 17,
      name: "Shalin J",
      email: "shalin@hubinterior.com",
      phone: "9986487141",
      branch: "SARJAPURA",
      manager: "Md_Razi",
      status: true,
    },
    {
      id: 18,
      name: "Jayashree",
      email: "jayashree@hubinterior.com",
      phone: "9741157574",
      branch: "SARJAPURA",
      manager: "Md_Razi",
      status: true,
    },
    {
      id: 19,
      name: "Yasin",
      email: "yasin@hubinterior.com",
      phone: "9740263074",
      branch: "HBR",
      manager: "Kulwanth",
      status: true,
    },
    {
      id: 23,
      name: "Meghana",
      email: "meghana@hubinterior.com",
      phone: "9741169293",
      branch: "HBR",
      manager: "Kulwanth",
      status: true,
    },
    {
      id: 38,
      name: "Priyanka",
      email: "priyanka@hubinterior.com",
      phone: "9741191415",
      branch: "JP_NAGAR",
      manager: "Udit_N",
      status: true,
    },
  ]);

  const toggleStatus = (id: number) => {
    setExecs(execs.map((e) => (e.id === id ? { ...e, status: !e.status } : e)));
  };
  return (
    <Card>
      <SectionTitle icon="💼">Sales Executives Management</SectionTitle>
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
            {execs.map((e, i) => (
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
                    onChange={() => toggleStatus(e.id)}
                  />
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <Btn
                    color={C.danger}
                    style={{ padding: "5px 14px", fontSize: 13 }}
                  >
                    Delete
                  </Btn>
                </td>
              </tr>
            ))}
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

interface UserLimit {
  name: string;
  role: string;
  branch: string;
  current: number;
  limit: number;
  remaining: number;
  pct: number;
}

function LeadLimitSection() {
  const [defaultLimit, setDefaultLimit] = useState<string>("50");
  const [limitTab, setLimitTab] = useState<"users" | "role">("users");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [roleLimit, setRoleLimit] = useState<string>("");
  const [selectedUsers, setSelectedUsers] = useState<number[] | "all">([]);
  const [bulkLimit, setBulkLimit] = useState<string>("");
  const [showModal, setShowModal] = useState(false);
  const [currentEditingUser, setCurrentEditingUser] =
    useState<UserLimit | null>(null);
  const [currentEditingLimit, setCurrentEditingLimit] = useState<string>("");

  const users: UserLimit[] = [
    {
      name: "Razi",
      role: "SALES_MANAGER",
      branch: "SARJAPURA",
      current: 0,
      limit: 0,
      remaining: 0,
      pct: 0,
    },
    {
      name: "Kulwanth",
      role: "SALES_MANAGER",
      branch: "N/A",
      current: 0,
      limit: 0,
      remaining: 0,
      pct: 0,
    },
    {
      name: "Udit",
      role: "SALES_MANAGER",
      branch: "JP_NAGAR",
      current: 0,
      limit: 0,
      remaining: 0,
      pct: 0,
    },
    {
      name: "Shalin J",
      role: "SALES_EXECUTIVE",
      branch: "SARJAPURA",
      current: 9,
      limit: 75,
      remaining: 66,
      pct: 11.8,
    },
    {
      name: "Meghana",
      role: "SALES_EXECUTIVE",
      branch: "HBR",
      current: 12,
      limit: 85,
      remaining: 73,
      pct: 14.1,
    },
    {
      name: "Aman Nirmal",
      role: "SALES_EXECUTIVE",
      branch: "SARJAPURA",
      current: 10,
      limit: 50,
      remaining: 40,
      pct: 20,
    },
  ];

  const toggleRole = (r: string) =>
    setSelectedRoles((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );

  const toggleUserSelect = (id: number) => {
    if (selectedUsers === "all") {
      setSelectedUsers([id]);
    } else if (Array.isArray(selectedUsers)) {
      setSelectedUsers(
        selectedUsers.includes(id)
          ? selectedUsers.filter((x) => x !== id)
          : [...selectedUsers, id],
      );
    }
  };

  const toggleSelectAll = () => {
    if (selectedUsers === "all") {
      setSelectedUsers([]);
    } else if (
      Array.isArray(selectedUsers) &&
      selectedUsers.length === users.length
    ) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers("all");
    }
  };

  const getSelectedCount = () => {
    if (selectedUsers === "all") return users.length;
    return Array.isArray(selectedUsers) ? selectedUsers.length : 0;
  };

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
        <Btn color="#0ea5e9" style={{ fontSize: 13, padding: "7px 16px" }}>
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
          <Btn color="#22c55e" style={{ fontSize: 13, padding: "8px 18px" }}>
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
                    setSelectedUsers([]);
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
              {users.length} users
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
                checked={
                  selectedUsers === "all" ||
                  (Array.isArray(selectedUsers) &&
                    selectedUsers.length === users.length)
                }
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
                      checked={
                        selectedUsers === "all" ||
                        (Array.isArray(selectedUsers) &&
                          selectedUsers.length === users.length)
                      }
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
                {users.map((u, i) => {
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
                      key={i}
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
                          checked={
                            selectedUsers === "all" ||
                            (Array.isArray(selectedUsers) &&
                              selectedUsers.includes(i))
                          }
                          onChange={() => toggleUserSelect(i)}
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
                })}
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
            ) : selectedUsers === "all" ? (
              users.slice(0, 3).map((user, idx) => (
                <div
                  key={idx}
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
                      {user.name}
                    </p>
                    <p
                      style={{
                        fontSize: 12,
                        color: C.muted,
                        margin: "4px 0 0 0",
                      }}
                    >
                      {user.role} • {user.branch}
                    </p>
                  </div>
                </div>
              ))
            ) : Array.isArray(selectedUsers) ? (
              selectedUsers.map((i) =>
                users[i] ? (
                  <div
                    key={i}
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
                        {users[i].name}
                      </p>
                      <p
                        style={{
                          fontSize: 12,
                          color: C.muted,
                          margin: "4px 0 0 0",
                        }}
                      >
                        {users[i].role} • {users[i].branch}
                      </p>
                    </div>
                  </div>
                ) : null,
              )
            ) : null}
          </div>

          {!currentEditingUser &&
            selectedUsers === "all" &&
            users.length > 3 && (
              <p
                style={{
                  fontSize: 12,
                  color: C.muted,
                  textAlign: "center",
                  marginBottom: 16,
                }}
              >
                ... and {users.length - 3} more user
                {users.length - 3 !== 1 ? "s" : ""}
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
              color="#cbd5e1"
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
                // Handle save
                if (currentEditingUser) {
                  alert(
                    `Limit set to ${currentEditingLimit} for ${currentEditingUser.name}`,
                  );
                  setCurrentEditingUser(null);
                  setCurrentEditingLimit("");
                } else {
                  alert(
                    `Limit set to ${bulkLimit} for ${getSelectedCount()} user(s)`,
                  );
                }
                setShowModal(false);
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
