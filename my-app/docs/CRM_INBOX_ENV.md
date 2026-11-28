# CRM Inbox V2 — environment

Set on the Next.js app (e.g. `.env.local`):

```env
BASE_URL=http://localhost:8081
NEXT_PUBLIC_CRM_INBOX_V2=1
CRM_INBOX_V2=1
NOTIFY_API_URL=http://localhost:8080
```

Set on Project-ERP:

```properties
hub.notify.crm-enabled=true
hub.notify.crm-legacy-enabled=false
```

Roll back legacy bell data path only (inbox off):

```properties
hub.notify.crm-legacy-enabled=true
```

Unset `NEXT_PUBLIC_CRM_INBOX_V2` or set to `0`.