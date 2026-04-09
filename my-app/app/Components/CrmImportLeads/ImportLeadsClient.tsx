"use client";

import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import Image from "next/image";
import QuickAccessSidebar from "../Shared/QuickAccessSidebar";
import { dashboardSidebarSections } from "../Shared/sidebar-data";
import { Button, Select } from "../CrmLeadDetails/ui";
import { CRM_ROLE_STORAGE_KEY, CRM_TOKEN_STORAGE_KEY, normalizeRole } from "@/lib/auth/api";

const IMPORT_BASE = `${process.env.NEXT_PUBLIC_CRM_API_BASE ?? "http://localhost:8081"}/v1/import`;

type ImportStep = "upload" | "sheet" | "mapping" | "progress" | "results";
type AlertTone = "error" | "success";

type SheetInfo = {
  index: number;
  name: string;
  rowCount: number;
};

type ImportResult = {
  imported: number;
  failed: number;
  skipped: number;
  errors?: string[];
};

const BACKEND_STANDARD_FIELDS = [
  "name",
  "email",
  "phone",
  "propertyPincode",
  "assignee",
  "altPhoneNumber",
  "attemptsMade",
  "budget",
  "customerId",
  "designerName",
  "followUpDate",
  "languagePrefered",
  "leadSource",
  "propertyDetails",
  "status",
] as const;

const AUTO_MAP_ALIASES: Record<string, string> = {
  name: "name",
  fullname: "name",
  leadsource: "leadSource",
  source: "leadSource",
  email: "email",
  phone: "phone",
  mobilenumber: "phone",
  alternatephone: "altPhoneNumber",
  altphone: "altPhoneNumber",
  pincode: "propertyPincode",
  propertypincode: "propertyPincode",
  assignee: "assignee",
  budget: "budget",
  customerid: "customerId",
  designer: "designerName",
  designername: "designerName",
  followupdate: "followUpDate",
  language: "languagePrefered",
  languageprefered: "languagePrefered",
  propertydetails: "propertyDetails",
  attemptsmade: "attemptsMade",
  status: "status",
};

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function canonicalBackendField(field: string) {
  const normalized = normalizeKey(field);
  return (BACKEND_STANDARD_FIELDS as readonly string[]).find(
    (item) => normalizeKey(item) === normalized,
  );
}

function getAuthToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(CRM_TOKEN_STORAGE_KEY);
}

function isValidExcelFile(file: File) {
  return file.name.toLowerCase().endsWith(".xlsx");
}

function normalizeHeaderLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function ImportSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] md:px-6">
      <h2 className="text-[1.55rem] font-bold tracking-[-0.04em] text-slate-800">
        {title}
      </h2>
      <div className="mt-3 h-px bg-[#3794ff]" />
      <div className="mt-4">{children}</div>
    </section>
  );
}

function InfoPill({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
      <div className="text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-[0.92rem] font-semibold text-slate-800">{value}</div>
    </div>
  );
}

function MappingSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <Select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-xl border-slate-300 bg-white pr-11 bg-none text-[13.5px]"
      >
        {children}
      </Select>
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-500">
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </div>
  );
}

export default function ImportLeadsClient() {
  const [role, setRole] = useState("SUPER_ADMIN");
  useEffect(() => {
    const stored = window.localStorage.getItem(CRM_ROLE_STORAGE_KEY) ?? "SUPER_ADMIN";
    setRole(normalizeRole(stored) || "SUPER_ADMIN");
  }, []);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<ImportStep>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [excelSheets, setExcelSheets] = useState<SheetInfo[]>([]);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState<number>(0);
  const [selectedSheetName, setSelectedSheetName] = useState("");
  const [rowCount, setRowCount] = useState(0);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressText, setProgressText] = useState("Uploading and processing...");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [alert, setAlert] = useState<{ tone: AlertTone; message: string } | null>(
    null,
  );
  const [isBusy, setIsBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  function showError(message: string) {
    setAlert({ tone: "error", message });
  }

  function clearAlert() {
    setAlert(null);
  }

  function resetImport() {
    setStep("upload");
    setSelectedFile(null);
    setExcelSheets([]);
    setSelectedSheetIndex(0);
    setSelectedSheetName("");
    setRowCount(0);
    setExcelHeaders([]);
    setAvailableFields([]);
    setFieldMappings({});
    setProgressPercent(0);
    setProgressText("Uploading and processing...");
    setImportResult(null);
    setIsBusy(false);
    clearAlert();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function processSelectedFile(file: File) {
    if (!isValidExcelFile(file)) {
      showError("Only .xlsx files are allowed.");
      return;
    }

    setSelectedFile(file);
    setImportResult(null);
    setFieldMappings({});
    clearAlert();
    setIsBusy(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const authToken = getAuthToken();
      const response = await fetch(`${IMPORT_BASE}/excel/sheets`, {
        method: "POST",
        headers: authToken ? { Authorization: authToken.startsWith("Bearer ") ? authToken : `Bearer ${authToken}` } : {},
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "Failed to process file",
        );
      }

      const sheets = Array.isArray(data?.sheets) ? (data.sheets as SheetInfo[]) : [];
      setExcelSheets(sheets);

      if (sheets.length === 0) {
        throw new Error("No readable sheets were found in the uploaded file.");
      }

      if (sheets.length === 1) {
        await fetchHeadersForSheet(file, sheets[0].index, sheets[0].name);
      } else {
        setStep("sheet");
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : "Error processing file.");
    } finally {
      setIsBusy(false);
    }
  }

  async function fetchHeadersForSheet(
    file: File,
    sheetIndex: number,
    knownSheetName?: string,
  ) {
    setIsBusy(true);
    clearAlert();

    const formData = new FormData();
    formData.append("file", file);
    formData.append("sheetIndex", String(sheetIndex));

    try {
      const authToken = getAuthToken();
      const response = await fetch(`${IMPORT_BASE}/excel/headers`, {
        method: "POST",
        headers: authToken ? { Authorization: authToken.startsWith("Bearer ") ? authToken : `Bearer ${authToken}` } : {},
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "Failed to read sheet headers",
        );
      }

      const headers = Array.isArray(data?.headers) ? (data.headers as string[]) : [];
      const fieldsFromApi = Array.isArray(data?.availableFields)
        ? (data.availableFields as string[])
        : [];
      const fields = Array.from(
        new Set([
          ...fieldsFromApi.map((field) => canonicalBackendField(field) ?? field),
          ...BACKEND_STANDARD_FIELDS,
        ]),
      );

      const autoMap: Record<string, string> = {};
      for (const header of headers) {
        const normalized = normalizeKey(header);
        const aliasField = AUTO_MAP_ALIASES[normalized];
        const standardMatch =
          aliasField ??
          fields.find((field) => normalizeKey(field) === normalized);
        autoMap[header] =
          standardMatch ?? `custom_${header.replace(/[^a-zA-Z0-9]/g, "_")}`;
      }

      setSelectedSheetIndex(sheetIndex);
      setSelectedSheetName(
        typeof data?.sheetName === "string" ? data.sheetName : knownSheetName ?? "",
      );
      setRowCount(typeof data?.rowCount === "number" ? data.rowCount : 0);
      setExcelHeaders(headers);
      setAvailableFields(fields);
      setFieldMappings(autoMap);
      setStep("mapping");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Error loading sheet.");
    } finally {
      setIsBusy(false);
    }
  }

  async function startImport() {
    if (!selectedFile) {
      showError("Please choose an Excel file first.");
      return;
    }

    if (Object.keys(fieldMappings).length === 0) {
      showError("Please map at least one column before importing.");
      return;
    }
    clearAlert();
    setStep("progress");
    setProgressPercent(30);
    setProgressText("Uploading file...");
    setIsBusy(true);

    const formData = new FormData();
    formData.append("file", selectedFile);
    const sanitizedMapping = Object.fromEntries(
      Object.entries(fieldMappings).filter(
        ([, target]) => !!target && target !== "notMapped",
      ),
    );
    formData.append("fieldMapping", JSON.stringify(sanitizedMapping));
    formData.append("sheetIndex", String(selectedSheetIndex));

    try {
      const authToken = getAuthToken();

      setProgressPercent(60);
      setProgressText("Processing leads...");

      const response = await fetch(`${IMPORT_BASE}/excel/import`, {
        method: "POST",
        headers: authToken ? { Authorization: authToken.startsWith("Bearer ") ? authToken : `Bearer ${authToken}` } : {},
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      setProgressPercent(100);
      setProgressText("Complete!");

      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "Import failed",
        );
      }

      setImportResult({
        imported: typeof data?.imported === "number" ? data.imported : 0,
        failed: typeof data?.failed === "number" ? data.failed : 0,
        skipped: typeof data?.skipped === "number" ? data.skipped : 0,
        errors: Array.isArray(data?.errors) ? (data.errors as string[]) : [],
      });
      setAlert({ tone: "success", message: "Import completed successfully." });
      setStep("results");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Error importing leads.");
      setStep("mapping");
    } finally {
      setIsBusy(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void processSelectedFile(file);
    }
  }

  function updateMapping(header: string, value: string) {
    setFieldMappings((current) => {
      const next = { ...current };
      if (value === "notMapped") {
        delete next[header];
      } else {
        const duplicateHeader = Object.entries(next).find(
          ([key, mapped]) => key !== header && mapped === value,
        )?.[0];
        if (duplicateHeader) {
          showError(
            `\`${value}\` is already mapped with "${duplicateHeader}". Duplicate backend mapping is not allowed.`,
          );
          return current;
        }
        next[header] = value;
      }
      return next;
    });
  }

  return (
    <div
      className="min-h-screen bg-[#f7f9fc] xl:h-screen xl:overflow-hidden"
      style={{
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div className="grid min-h-screen xl:h-screen xl:grid-cols-[auto_minmax(0,1fr)]">
        <div className="hidden xl:block">
          <QuickAccessSidebar
            appBadge="HO WS"
            appName="Hows"
            appTagline="by HUB"
            sections={dashboardSidebarSections}
            profileName={role.replace(/_/g, " ")}
            profileRole={role}
            profileInitials="AD"
          />
        </div>

        <div className="bg-[#f7f9fc] xl:h-screen xl:overflow-y-auto">
          <div className="border-b border-slate-200 bg-white shadow-sm">
            <div className="flex min-h-16 items-center justify-between px-4 md:px-6">
              <div className="flex items-center gap-3">
                <Image
                  src="/HowsCrmLogo.png"
                  alt="Hows CRM"
                  width={46}
                  height={46}
                />
                <div>
                  <div className="text-[1.6rem] font-extrabold tracking-[-0.04em] text-slate-900">
                    Import Leads
                  </div>
                  <div className="text-sm text-slate-500">
                    Upload Excel files and map columns to the original CRM import API
                  </div>
                </div>
              </div>
            </div>
          </div>

          <main className="px-4 py-6 md:px-6 lg:px-8">
            <div className="mx-auto max-w-[1120px] space-y-5">
              <div className="overflow-hidden rounded-xl bg-gradient-to-r from-[#6278ea] via-[#6b6fe0] to-[#7c44b6] shadow-[0_12px_28px_rgba(92,100,220,0.2)]">
                <div className="flex min-h-[74px] items-center gap-3 px-6 py-4">
                  <span className="text-[1.7rem] leading-none">📊</span>
                  <h1 className="text-[1.7rem] font-bold tracking-[-0.04em] text-white">
                    Import Leads from Excel
                  </h1>
                </div>
              </div>

              {alert ? (
                <div
                  className={[
                    "rounded-2xl border px-4 py-3 text-sm font-medium",
                    alert.tone === "error"
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700",
                  ].join(" ")}
                >
                  {alert.message}
                </div>
              ) : null}

              <ImportSection
                title={
                  step === "upload"
                    ? "Step 1: Upload Excel File"
                    : step === "sheet"
                      ? "Step 2: Select Sheet to Import"
                      : step === "mapping"
                        ? "Step 3: Map Excel Columns to Lead Fields"
                        : step === "progress"
                          ? "Step 4: Importing..."
                          : "Step 5: Import Complete!"
                }
              >
                {step === "upload" ? (
                  <div className="space-y-4">
                    <p className="text-[0.95rem] text-slate-600">
                      Upload an Excel file (`.xlsx`) containing lead data.
                      The first row should contain column headers.
                    </p>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          void processSelectedFile(file);
                        }
                      }}
                    />

                    <label
                      className={[
                        "flex min-h-[190px] cursor-pointer flex-col items-center justify-center rounded-[24px] border-2 border-dashed px-6 py-8 text-center transition-all",
                        dragActive
                          ? "border-emerald-400 bg-emerald-50"
                          : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40",
                      ].join(" ")}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragActive(true);
                      }}
                      onDragLeave={() => setDragActive(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-12 w-12 text-emerald-500"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <path d="m17 8-5-5-5 5" />
                        <path d="M12 3v12" />
                      </svg>
                      <div className="mt-4 text-[1rem] font-bold text-slate-800">
                        Click to upload or drag and drop
                      </div>
                      <div className="mt-1.5 text-[0.88rem] text-slate-500">
                        Excel file (.xlsx only)
                      </div>
                    </label>

                    {selectedFile ? (
                      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
                        Selected file: {selectedFile.name}
                      </div>
                    ) : null}

                  </div>
                ) : null}

                {step === "sheet" ? (
                  <div className="space-y-5">
                    <p className="text-[0.95rem] text-slate-600">
                      Your Excel file contains multiple sheets. Select which sheet
                      you want to import data from.
                    </p>

                    <div className="grid gap-4 md:grid-cols-2">
                      <InfoPill label="File" value={selectedFile?.name ?? "Not selected"} />
                      <InfoPill label="Total Sheets" value={excelSheets.length} />
                    </div>

                    <div className="grid gap-3">
                      {excelSheets.map((sheet) => (
                        <button
                          key={`${sheet.index}-${sheet.name}`}
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            selectedFile
                              ? void fetchHeadersForSheet(
                                  selectedFile,
                                  sheet.index,
                                  sheet.name,
                                )
                              : undefined
                          }
                          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <div>
                            <div className="text-[1rem] font-bold text-slate-800">
                              {sheet.name}
                            </div>
                            <div className="mt-0.5 text-[0.88rem] text-slate-500">
                              {sheet.rowCount} rows • Sheet {sheet.index + 1} of{" "}
                              {excelSheets.length}
                            </div>
                          </div>
                          <span className="text-[1.5rem] text-blue-500">→</span>
                        </button>
                      ))}
                    </div>

                    <Button type="button" variant="ghost" onClick={resetImport}>
                      ← Back
                    </Button>
                  </div>
                ) : null}

                {step === "mapping" ? (
                  <div className="space-y-5">
                    <p className="text-[0.95rem] text-slate-600">
                      Map your Excel columns to backend lead fields. Standard fields
                      go to database columns, and unmatched columns can stay as
                      dynamic fields.
                    </p>

                    <div className="grid gap-4 md:grid-cols-3">
                      <InfoPill label="File" value={selectedFile?.name ?? "Not selected"} />
                      <InfoPill label="Sheet" value={selectedSheetName} />
                      <InfoPill label="Rows" value={`${rowCount} leads`} />
                    </div>

                    <div className="space-y-2.5">
                      {excelHeaders.map((header) => {
                        const currentMapping = fieldMappings[header] ?? "notMapped";
                        return (
                          <div
                            key={header}
                            className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 lg:grid-cols-[minmax(220px,1fr)_32px_minmax(260px,1.1fr)] lg:items-center"
                          >
                            <div className="text-[0.94rem] font-semibold text-slate-800">
                              📄 {header}
                            </div>
                            <div className="hidden text-center text-xl text-slate-400 lg:block">
                              →
                            </div>
                            <MappingSelect
                              value={currentMapping}
                              onChange={(value) => updateMapping(header, value)}
                            >
                              <option value="notMapped">[ Not Mapped ]</option>
                              <optgroup label="Standard Fields">
                                {availableFields.map((field) => (
                                  <option key={field} value={field}>
                                    {field}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Custom Field">
                                <option value={`custom_${header.replace(/[^a-zA-Z0-9]/g, "_")}`}>
                                  {header} (Dynamic)
                                </option>
                              </optgroup>
                            </MappingSelect>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          if (excelSheets.length > 1) {
                            setStep("sheet");
                          } else {
                            resetImport();
                          }
                        }}
                      >
                        ← Back
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        onClick={() => void startImport()}
                        disabled={isBusy}
                      >
                        {isBusy ? "Importing..." : "Import Leads →"}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {step === "progress" ? (
                  <div className="space-y-4">
                    <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <p className="text-center text-[0.95rem] font-medium text-slate-600">
                      {progressText}
                    </p>
                  </div>
                ) : null}

                {step === "results" && importResult ? (
                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                        <div className="text-[1.7rem] font-bold text-emerald-700">
                          {importResult.imported}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-emerald-800">
                          Successfully Imported
                        </div>
                      </div>
                      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4">
                        <div className="text-[1.7rem] font-bold text-rose-700">
                          {importResult.failed}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-rose-800">
                          Failed
                        </div>
                      </div>
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                        <div className="text-[1.7rem] font-bold text-amber-700">
                          {importResult.skipped}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-amber-800">
                          Skipped (Empty Rows)
                        </div>
                      </div>
                    </div>

                    {importResult.errors && importResult.errors.length > 0 ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                        <h3 className="text-[1.1rem] font-bold text-amber-900">
                          Import Errors
                        </h3>
                        <div className="mt-4 space-y-2">
                          {importResult.errors.map((item, index) => (
                            <div
                              key={`${item}-${index}`}
                              className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-amber-800"
                            >
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <Button type="button" variant="primary" onClick={resetImport}>
                      Import Another File
                    </Button>
                  </div>
                ) : null}
              </ImportSection>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
