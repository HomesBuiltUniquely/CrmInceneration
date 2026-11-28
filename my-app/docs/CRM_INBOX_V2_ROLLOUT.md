# CRM Inbox V2 — staging verification

## Environment

See [CRM_INBOX_ENV.md](./CRM_INBOX_ENV.md).

- NotifyProject: deploy with `crm_user_notifications` + `/v1/crm/inbox/*`
- Project-ERP: `hub.notify.crm-enabled=true`, `hub.notify.crm-legacy-enabled=false`
- CRM Next: `NEXT_PUBLIC_CRM_INBOX_V2=1`, `BASE_URL` → Hub

## Tests

1. **Dedup** — double-save appointment; one row per `(event_id, user_id)` in `crm_user_notifications`.
2. **Read sync** — mark read on browser A; browser B refresh shows `read_at` (no `crm_read_notification_ids_*`).
3. **SE RBAC** — SE inbox only contains rows fan-out at create for that `user_id`.
4. **Lead create** — single LEAD/CREATED inbox row for assignee + admins.
5. **SSE** — `/api/crm/inbox/stream` delivers `inbox_updated` / ping; bell refreshes within 20s.
6. **Legacy off** — `hub.notify.crm-legacy-enabled=false`; list APIs unused; bell still works with V2 flag.

## Cutover

1. Staging soak 48h.
2. Production: enable ERP `hub.notify.crm-enabled`, then FE flag.
3. After bell stable, set `hub.notify.crm-legacy-enabled=false`.