import { z } from "zod";
import type { OfflinePaymentMethodId, PaymentChannelChoice } from "@/lib/booking-payment-display";

const offlineMethodIds = ["CASH", "CHEQUE", "BANK_TRANSFER", "DD"] as const;

export const sendPaymentFormSchema = z
  .object({
    versionId: z.string().min(1, "Select a quotation version."),
    type: z.enum(["online", "offline"]),
    method: z.enum(offlineMethodIds).or(z.literal("")).optional(),
    amount: z.number().positive("Amount must be greater than 0."),
    notes: z.string().max(2000).optional(),
    proofCount: z.number().int().min(0),
  })
  .superRefine((value, ctx) => {
    if (value.type === "offline") {
      if (!value.method) {
        ctx.addIssue({
          code: "custom",
          path: ["method"],
          message: "Choose an offline payment method.",
        });
      }
      if (value.proofCount < 1) {
        ctx.addIssue({
          code: "custom",
          path: ["proofCount"],
          message: "Upload at least one payment proof.",
        });
      }
    }
  });

export type SendPaymentFormValues = z.infer<typeof sendPaymentFormSchema>;

export type SendPaymentFieldErrors = Partial<
  Record<"versionId" | "type" | "method" | "amount" | "notes" | "proofCount" | "root", string>
>;

export function validateSendPaymentForm(input: {
  versionId: string;
  type: PaymentChannelChoice;
  method: OfflinePaymentMethodId | "";
  amount: number | null;
  notes: string;
  proofCount: number;
}): { ok: true; values: SendPaymentFormValues } | { ok: false; errors: SendPaymentFieldErrors } {
  const parsed = sendPaymentFormSchema.safeParse({
    versionId: input.versionId,
    type: input.type,
    method: input.method || undefined,
    amount: input.amount ?? 0,
    notes: input.notes,
    proofCount: input.proofCount,
  });

  if (parsed.success) {
    return { ok: true, values: parsed.data };
  }

  const errors: SendPaymentFieldErrors = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? "root") as keyof SendPaymentFieldErrors;
    if (!errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}
