export function isCrmInboxV2Client(): boolean {
  return process.env.NEXT_PUBLIC_CRM_INBOX_V2 === "1";
}