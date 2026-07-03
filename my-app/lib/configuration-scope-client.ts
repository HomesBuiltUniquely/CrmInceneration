import type { CrmLeadType } from "@/lib/leads-filter";
import { getCrmAuthHeaders } from "@/lib/crm-client-auth";
import { readConfigurationScopeFrontendPrefs } from "@/lib/configuration-scope-frontend-prefs";

export type ScopeRoomUnit = {
  label: string;
  selected: boolean;
};

export type ScopeSelectedRoom = {
  id: string;
  roomName: string;
  iconLabel?: string;
  sortOrder?: number;
  units: ScopeRoomUnit[];
  falseCeilingRequired?: boolean;
  notes?: string;
};

export type ConfigurationScopeRequirements = {
  success?: boolean;
  leadId?: string;
  leadIdentifier?: string;
  leadType?: string;
  availableRoomCatalog: string[];
  selectedRooms: ScopeSelectedRoom[];
  miscAddOns: string[];
  kitchenLayout: string | null;
  materialFinish: string | null;
  familyContactName: string | null;
  familyContactRelationship: string | null;
  familyContactPhone: string | null;
  bookingType: string | null;
  projectUnderstanding: string | null;
  designStylePreference: string | null;
  expectedTimeline: string | null;
  internalExecutiveNotes: string | null;
  salesRiskNotes: string | null;
  designHandoffNotes: string | null;
  version: number;
  updatedAt?: string | null;
  updatedBy?: string | null;
};

export const TIMELINE_EXPECTATION_OPTIONS = [
  { value: "45 Days (Express)", label: "45 Days (Express)" },
  { value: "90 Days (Standard)", label: "90 Days (Standard)" },
] as const;

const PROJECT_UNDERSTANDING_SEP = "\n---\n";

/** Split Hub `projectUnderstanding` into property + family fields for §1 UI. */
export function splitProjectUnderstanding(value: string | null | undefined): {
  propertyNameSite: string;
  familySizeDetails: string;
} {
  const raw = (value ?? "").trim();
  if (!raw) return { propertyNameSite: "", familySizeDetails: "" };
  const idx = raw.indexOf(PROJECT_UNDERSTANDING_SEP);
  if (idx === -1) return { propertyNameSite: raw, familySizeDetails: "" };
  return {
    propertyNameSite: raw.slice(0, idx).trim(),
    familySizeDetails: raw.slice(idx + PROJECT_UNDERSTANDING_SEP.length).trim(),
  };
}

/** Join §1 property + family inputs for Hub `projectUnderstanding`. */
export function joinProjectUnderstanding(
  propertyNameSite: string,
  familySizeDetails: string,
): string | null {
  const property = propertyNameSite.trim();
  const family = familySizeDetails.trim();
  if (!property && !family) return null;
  if (!family) return property;
  if (!property) return family;
  return `${property}${PROJECT_UNDERSTANDING_SEP}${family}`;
}

export type ConfigurationScopeReference = {
  id: string;
  fileName?: string;
  originalFileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  s3Key?: string;
  viewUrl?: string;
  thumbnailUrl?: string;
  uploadedAt?: string;
  uploadedBy?: string;
};

export type ConfigurationScopeReferences = {
  success?: boolean;
  leadId?: string;
  leadType?: string;
  aestheticNotes?: string;
  references: ConfigurationScopeReference[];
  updatedAt?: string | null;
};

export const REFERENCE_ACCEPT =
  "image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf";
export const REFERENCE_MAX_BYTES = 10 * 1024 * 1024;
export const REFERENCE_MAX_FILES = 20;

const DEFAULT_MISC_ADD_ONS = [
  "Painting",
  "Granite",
  "Kitchen Tile",
  "Wallpaper",
  "Appliance",
  "Wooden Flooring",
];

export const DEFAULT_ROOM_CATALOG = ["Living Room", "Modular Kitchen"] as const;

/** Legacy catalog entries — hidden from Available Rooms (custom add still allowed). */
const HIDDEN_CATALOG_ROOMS = new Set(
  ["Foyer", "Master Bedroom", "Guest Bedroom"].map((name) => name.toLowerCase()),
);

function filterHiddenCatalogRooms(catalog: string[]): string[] {
  return catalog.filter(
    (name) => !HIDDEN_CATALOG_ROOMS.has(name.trim().toLowerCase()),
  );
}

/** Pre-selected on first open when nothing is saved yet. */
export const DEFAULT_SELECTED_ROOM_NAMES = ["Living Room", "Modular Kitchen"] as const;

const DEFAULT_UNIT_BY_ROOM: Record<string, string> = {
  "living room": "TV Unit",
  "modular kitchen": "Base Units",
};

function defaultUnitsForRoom(roomName: string): ScopeRoomUnit[] {
  const key = roomName.trim().toLowerCase();
  const label = DEFAULT_UNIT_BY_ROOM[key] ?? "Unit";
  return [{ label, selected: true }];
}

export function createDefaultSelectedRoom(
  roomName: string,
  sortOrder: number,
): ScopeSelectedRoom {
  return {
    id: `room-${roomName.toLowerCase().replace(/\s+/g, "-")}-${sortOrder}`,
    roomName,
    iconLabel: defaultRoomIcon(roomName),
    sortOrder,
    units: defaultUnitsForRoom(roomName),
    falseCeilingRequired: false,
    notes: "",
  };
}

export function buildDefaultSelectedRooms(): ScopeSelectedRoom[] {
  return DEFAULT_SELECTED_ROOM_NAMES.map((name, index) =>
    createDefaultSelectedRoom(name, index),
  );
}

/** Client fallback when Hub has no row yet or GET fails. */
export function createDefaultRequirements(): ConfigurationScopeRequirements {
  return {
    availableRoomCatalog: [...DEFAULT_ROOM_CATALOG],
    selectedRooms: buildDefaultSelectedRooms(),
    miscAddOns: [],
    kitchenLayout: null,
    materialFinish: null,
    familyContactName: null,
    familyContactRelationship: null,
    familyContactPhone: null,
    bookingType: null,
    projectUnderstanding: null,
    designStylePreference: null,
    expectedTimeline: null,
    internalExecutiveNotes: null,
    salesRiskNotes: null,
    designHandoffNotes: null,
    version: 0,
    updatedAt: null,
    updatedBy: null,
  };
}

function readNullableString(
  data: Record<string, unknown>,
  camel: string,
  snake: string,
): string | null {
  const camelVal = data[camel];
  if (typeof camelVal === "string") return camelVal;
  const snakeVal = data[snake];
  if (typeof snakeVal === "string") return snakeVal;
  return null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function normalizeSelectedRooms(value: unknown): ScopeSelectedRoom[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item, index) => {
      const roomName = String(item.roomName ?? item.room_name ?? "").trim();
      const rawUnits = item.units;
      const units = Array.isArray(rawUnits)
        ? rawUnits
            .filter((u): u is Record<string, unknown> => Boolean(u) && typeof u === "object")
            .map((u) => ({
              label: String(u.label ?? "").trim(),
              selected: u.selected !== false,
            }))
            .filter((u) => u.label)
        : [];
      return {
        id: String(item.id ?? `room-${index}`),
        roomName,
        iconLabel:
          typeof item.iconLabel === "string"
            ? item.iconLabel
            : typeof item.icon_label === "string"
              ? item.icon_label
              : defaultRoomIcon(roomName),
        sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : index,
        units,
        falseCeilingRequired: Boolean(item.falseCeilingRequired ?? item.false_ceiling_required),
        notes: typeof item.notes === "string" ? item.notes : "",
      };
    })
    .filter((room) => room.roomName);
}

function missingDefaultRooms(data: ConfigurationScopeRequirements): boolean {
  const selected = new Set(
    data.selectedRooms.map((room) => room.roomName.trim().toLowerCase()),
  );
  return DEFAULT_SELECTED_ROOM_NAMES.some(
    (name) => !selected.has(name.toLowerCase()),
  );
}

/** Add Living Room / Modular Kitchen when absent (e.g. partial version-0 row). */
export function ensureDefaultSelectedRooms(
  selectedRooms: ScopeSelectedRoom[],
): { rooms: ScopeSelectedRoom[]; changed: boolean } {
  const byKey = new Map(
    selectedRooms.map((room) => [room.roomName.trim().toLowerCase(), room]),
  );
  let changed = false;

  DEFAULT_SELECTED_ROOM_NAMES.forEach((name, index) => {
    const key = name.toLowerCase();
    if (!byKey.has(key)) {
      byKey.set(key, createDefaultSelectedRoom(name, index));
      changed = true;
    }
  });

  if (!changed) {
    return { rooms: selectedRooms, changed: false };
  }

  const rooms: ScopeSelectedRoom[] = DEFAULT_SELECTED_ROOM_NAMES.map((name, index) => {
    const key = name.toLowerCase();
    return { ...byKey.get(key)!, sortOrder: index };
  });

  for (const room of selectedRooms) {
    const key = room.roomName.trim().toLowerCase();
    if (!DEFAULT_SELECTED_ROOM_NAMES.some((name) => name.toLowerCase() === key)) {
      rooms.push(room);
    }
  }

  return { rooms, changed: true };
}

export function isFreshRequirementScope(
  data: ConfigurationScopeRequirements,
): boolean {
  return (
    (data.version ?? 0) === 0 &&
    data.selectedRooms.length === 0 &&
    !data.updatedAt
  );
}

/** Ensure catalog on first open; never re-add rooms the user removed. */
export function mergeRequirementDefaults(
  data: ConfigurationScopeRequirements,
): { requirements: ConfigurationScopeRequirements; needsPersist: boolean } {
  const catalog = filterHiddenCatalogRooms(
    data.availableRoomCatalog.length > 0
      ? [...data.availableRoomCatalog]
      : isFreshRequirementScope(data)
        ? [...DEFAULT_ROOM_CATALOG]
        : [],
  );

  let selectedRooms = data.selectedRooms;
  let needsPersist = false;

  if (isFreshRequirementScope(data)) {
    selectedRooms = buildDefaultSelectedRooms();
    needsPersist = true;
  }

  // Normalize default rooms to exactly one starter unit when they had none.
  selectedRooms = selectedRooms.map((room) => {
    const key = room.roomName.trim().toLowerCase();
    const isDefault = DEFAULT_SELECTED_ROOM_NAMES.some((name) => name.toLowerCase() === key);
    if (!isDefault || room.units.length > 0) return room;
    return { ...room, units: defaultUnitsForRoom(room.roomName) };
  });

  return {
    requirements: {
      ...data,
      availableRoomCatalog: catalog,
      selectedRooms,
    },
    needsPersist,
  };
}

export function toPutRequirementsBody(
  req: ConfigurationScopeRequirements,
): PutConfigurationScopeRequirementsBody {
  return {
    version: req.version,
    availableRoomCatalog: req.availableRoomCatalog,
    selectedRooms: req.selectedRooms,
    miscAddOns: req.miscAddOns,
    kitchenLayout: req.kitchenLayout,
    materialFinish: req.materialFinish,
    familyContactName: req.familyContactName,
    familyContactRelationship: req.familyContactRelationship,
    familyContactPhone: req.familyContactPhone,
    bookingType: req.bookingType,
    projectUnderstanding: req.projectUnderstanding,
    designStylePreference: req.designStylePreference,
    expectedTimeline: req.expectedTimeline,
    internalExecutiveNotes: req.internalExecutiveNotes,
    salesRiskNotes: req.salesRiskNotes,
    designHandoffNotes: req.designHandoffNotes,
  };
}

export type PutConfigurationScopeRequirementsBody = {
  version: number;
  availableRoomCatalog: string[];
  selectedRooms: ScopeSelectedRoom[];
  miscAddOns: string[];
  kitchenLayout: string | null;
  materialFinish: string | null;
  familyContactName: string | null;
  familyContactRelationship: string | null;
  familyContactPhone: string | null;
  bookingType: string | null;
  projectUnderstanding: string | null;
  designStylePreference: string | null;
  expectedTimeline: string | null;
  internalExecutiveNotes: string | null;
  salesRiskNotes: string | null;
  designHandoffNotes: string | null;
};

function requirementsPath(leadType: CrmLeadType, id: string): string {
  return `/api/crm/lead/${leadType}/${id}/configuration-scope/requirements`;
}

function referencesPath(leadType: CrmLeadType, id: string): string {
  return `/api/crm/lead/${leadType}/${id}/configuration-scope/references`;
}

export function configurationScopeReferenceContentProxyPath(
  leadType: CrmLeadType,
  id: string,
  referenceId: string,
): string {
  return `/api/crm/lead/${leadType}/${id}/configuration-scope/references/${encodeURIComponent(referenceId)}/content`;
}

/** Map Hub `viewUrl` → authenticated BFF proxy path for browser fetch. */
export function referenceViewUrlToProxy(
  viewUrl: string | undefined,
  leadType: CrmLeadType,
  id: string,
  referenceId: string,
): string {
  const trimmed = (viewUrl ?? "").trim();
  if (trimmed.startsWith("/api/crm/")) return trimmed;
  const match = trimmed.match(
    /\/configuration-scope\/references\/([^/]+)\/content\/?$/i,
  );
  if (match?.[1]) {
    return configurationScopeReferenceContentProxyPath(leadType, id, match[1]);
  }
  return configurationScopeReferenceContentProxyPath(leadType, id, referenceId);
}

export function referenceDisplayName(ref: ConfigurationScopeReference): string {
  return (
    ref.originalFileName?.trim() ||
    ref.fileName?.trim() ||
    ref.id
  );
}

export function validateReferenceFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const allowed =
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".pdf") ||
    file.type === "image/jpeg" ||
    file.type === "image/png" ||
    file.type === "application/pdf";
  if (!allowed) {
    return "Only JPG, PNG, and PDF files are allowed.";
  }
  if (file.size > REFERENCE_MAX_BYTES) {
    return "File must be 10 MB or smaller.";
  }
  return null;
}

function parseApiError(data: Record<string, unknown>, fallback: string): string {
  const msg =
    (typeof data.userMessage === "string" && data.userMessage.trim()) ||
    (typeof data.error === "string" && data.error.trim()) ||
    (typeof data.message === "string" && data.message.trim()) ||
    "";
  return msg || fallback;
}

async function readJson<T extends Record<string, unknown>>(
  res: Response,
  fallback: string,
): Promise<T> {
  let data: T = {} as T;
  try {
    data = (await res.json()) as T;
  } catch {
    data = {} as T;
  }
  if (!res.ok) {
    throw new Error(parseApiError(data, fallback));
  }
  if (data.success === false) {
    throw new Error(parseApiError(data, fallback));
  }
  return data;
}

function normalizeRequirements(
  data: Record<string, unknown>,
): ConfigurationScopeRequirements {
  const catalogFromCamel = readStringArray(data.availableRoomCatalog);
  const catalog =
    catalogFromCamel.length > 0
      ? catalogFromCamel
      : readStringArray(data.available_room_catalog);
  const selectedRaw = data.selectedRooms ?? data.selected_rooms;

  return {
    success: data.success === true,
    leadId: typeof data.leadId === "string" ? data.leadId : undefined,
    leadIdentifier:
      typeof data.leadIdentifier === "string" ? data.leadIdentifier : undefined,
    leadType: typeof data.leadType === "string" ? data.leadType : undefined,
    availableRoomCatalog: catalog,
    selectedRooms: normalizeSelectedRooms(selectedRaw),
    miscAddOns:
      readStringArray(data.miscAddOns).length > 0
        ? readStringArray(data.miscAddOns)
        : readStringArray(data.misc_addons),
    kitchenLayout:
      typeof data.kitchenLayout === "string"
        ? data.kitchenLayout
        : typeof data.kitchen_layout === "string"
          ? data.kitchen_layout
          : null,
    materialFinish:
      typeof data.materialFinish === "string"
        ? data.materialFinish
        : typeof data.material_finish === "string"
          ? data.material_finish
          : null,
    familyContactName: readNullableString(data, "familyContactName", "family_contact_name"),
    familyContactRelationship:
      readNullableString(data, "familyContactRelationship", "family_contact_relationship") ??
      readNullableString(data, "familyContactRole", "family_contact_role") ??
      readNullableString(data, "relationship", "relation"),
    familyContactPhone: readNullableString(data, "familyContactPhone", "family_contact_phone"),
    bookingType: readNullableString(data, "bookingType", "booking_type"),
    projectUnderstanding: readNullableString(
      data,
      "projectUnderstanding",
      "project_understanding",
    ),
    designStylePreference: readNullableString(
      data,
      "designStylePreference",
      "design_style_preference",
    ),
    expectedTimeline: readNullableString(data, "expectedTimeline", "expected_timeline"),
    internalExecutiveNotes: readNullableString(
      data,
      "internalExecutiveNotes",
      "internal_executive_notes",
    ),
    salesRiskNotes: readNullableString(data, "salesRiskNotes", "sales_risk_notes"),
    designHandoffNotes: readNullableString(data, "designHandoffNotes", "design_handoff_notes"),
    version: typeof data.version === "number" ? data.version : 0,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : null,
  };
}

function normalizeReferences(
  data: Record<string, unknown>,
): ConfigurationScopeReferences {
  return {
    success: data.success === true,
    leadId: typeof data.leadId === "string" ? data.leadId : undefined,
    leadType: typeof data.leadType === "string" ? data.leadType : undefined,
    aestheticNotes:
      typeof data.aestheticNotes === "string" ? data.aestheticNotes : "",
    references: Array.isArray(data.references)
      ? (data.references as ConfigurationScopeReference[])
      : [],
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
  };
}

export function miscAddOnOptions(catalog: string[], selected: string[]): string[] {
  const merged = new Set([...DEFAULT_MISC_ADD_ONS, ...catalog, ...selected]);
  return Array.from(merged);
}

export function defaultRoomIcon(roomName: string): string {
  const lower = roomName.toLowerCase();
  if (lower.includes("kitchen")) return "B";
  if (lower.includes("living")) return "🛋";
  if (lower.includes("bedroom") || lower.includes("master")) return "🛏";
  if (lower.includes("foyer")) return "🚪";
  return roomName.trim().charAt(0).toUpperCase() || "R";
}

/** Hub may not return relationship until column is deployed — fall back to local prefs. */
export function hydrateFamilyContactRelationship(
  requirements: ConfigurationScopeRequirements,
  leadType: string,
  leadId: string,
): ConfigurationScopeRequirements {
  const fromApi = requirements.familyContactRelationship?.trim();
  if (fromApi) return requirements;
  const fromPrefs = readConfigurationScopeFrontendPrefs(
    leadType,
    leadId,
  ).familyContactRelationship?.trim();
  if (!fromPrefs) return requirements;
  return { ...requirements, familyContactRelationship: fromPrefs };
}

export async function getConfigurationScopeRequirements(
  leadType: CrmLeadType,
  id: string,
): Promise<ConfigurationScopeRequirements> {
  const res = await fetch(requirementsPath(leadType, id), {
    credentials: "include",
    headers: getCrmAuthHeaders(),
    cache: "no-store",
  });

  if (res.status === 404) {
    return createDefaultRequirements();
  }

  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }

  if (!res.ok) {
    if (res.status >= 500) {
      throw new Error(parseApiError(data, "Unable to load requirement scope."));
    }
    return mergeRequirementDefaults(createDefaultRequirements()).requirements;
  }

  if (data.success === false) {
    return mergeRequirementDefaults(createDefaultRequirements()).requirements;
  }

  return hydrateFamilyContactRelationship(normalizeRequirements(data), leadType, id);
}

export async function putConfigurationScopeRequirements(
  leadType: CrmLeadType,
  id: string,
  body: PutConfigurationScopeRequirementsBody,
): Promise<ConfigurationScopeRequirements> {
  const res = await fetch(requirementsPath(leadType, id), {
    method: "PUT",
    credentials: "include",
    headers: getCrmAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }
  if (!res.ok) {
    const fallback =
      res.status === 409
        ? "Requirement scope was updated elsewhere. Refresh and retry."
        : "Unable to save requirement scope.";
    const err = new Error(parseApiError(data, fallback)) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  if (data.success === false) {
    const err = new Error(
      parseApiError(data, "Unable to save requirement scope."),
    ) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return hydrateFamilyContactRelationship(
    mergeRequirementDefaults(normalizeRequirements(data)).requirements,
    leadType,
    id,
  );
}

export async function getConfigurationScopeReferences(
  leadType: CrmLeadType,
  id: string,
): Promise<ConfigurationScopeReferences> {
  const res = await fetch(referencesPath(leadType, id), {
    credentials: "include",
    headers: getCrmAuthHeaders(),
    cache: "no-store",
  });
  const data = await readJson<Record<string, unknown>>(
    res,
    "Unable to load references.",
  );
  return normalizeReferences(data);
}

export async function uploadConfigurationScopeReference(
  leadType: CrmLeadType,
  id: string,
  file: File,
): Promise<ConfigurationScopeReferences> {
  const validationError = validateReferenceFile(file);
  if (validationError) throw new Error(validationError);

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(referencesPath(leadType, id), {
    method: "POST",
    credentials: "include",
    headers: getCrmAuthHeaders(),
    body: formData,
    cache: "no-store",
  });
  const data = await readJson<Record<string, unknown>>(
    res,
    "Unable to upload reference file.",
  );
  return normalizeReferences(data);
}

export async function deleteConfigurationScopeReference(
  leadType: CrmLeadType,
  id: string,
  referenceId: string,
): Promise<ConfigurationScopeReferences> {
  const res = await fetch(
    `${referencesPath(leadType, id)}/${encodeURIComponent(referenceId)}`,
    {
      method: "DELETE",
      credentials: "include",
      headers: getCrmAuthHeaders(),
      cache: "no-store",
    },
  );
  const data = await readJson<Record<string, unknown>>(
    res,
    "Unable to delete reference file.",
  );
  return normalizeReferences(data);
}

export async function putConfigurationScopeAestheticNotes(
  leadType: CrmLeadType,
  id: string,
  aestheticNotes: string,
): Promise<ConfigurationScopeReferences> {
  const res = await fetch(referencesPath(leadType, id), {
    method: "PUT",
    credentials: "include",
    headers: getCrmAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ aestheticNotes }),
    cache: "no-store",
  });
  const data = await readJson<Record<string, unknown>>(
    res,
    "Unable to save aesthetic notes.",
  );
  return normalizeReferences(data);
}

export async function fetchReferenceContentBlob(
  contentPath: string,
): Promise<{ blob: Blob; contentType: string }> {
  const res = await fetch(contentPath, {
    credentials: "include",
    headers: getCrmAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    let message = "Unable to load reference preview.";
    try {
      const data = (await res.json()) as Record<string, unknown>;
      message = parseApiError(data, message);
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  const contentType =
    res.headers.get("Content-Type")?.split(";")[0]?.trim() ||
    "application/octet-stream";
  const blob = await res.blob();
  return { blob, contentType };
}
