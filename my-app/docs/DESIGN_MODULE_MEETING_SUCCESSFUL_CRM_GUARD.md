# Design Module ↔ CRM — Meeting Successful (allowlist once)

**Date:** 2026-11-26  
**Status:** Hub CRM guard shipped · Design Module must stop PUT lead stage for First Cut / Material / Sign-off  
**Example bug:** lead `8073621971` — already Closed, First Cut Successful reopened CRM to Meeting Successful

---

## Problem

Closed-only blocking was too weak. First Cut / Material Selection / Sign-off marked Successful was still putting CRM sales stage to **Meeting Successful**, even after Pre-10 was already done (or lead was Decision / Closed).

---

## Best solution

1. **Design (main fix):** First Cut / Material / Sign-off → call **only** appointment `meeting-outcome`. **Do not** PUT CRM lead → Meeting Successful.
2. **CRM (guard):** Design Auto may set Meeting Successful **only once**, and **only** from Meeting Scheduled / DRR (not after Pre-10 already done, not Closed/Decision).

---

## Paste this to Design Module

Hi Design Team,

Bug: First Cut / Material Selection Successful was updating CRM sales stage to **Meeting Successful** again (example lead 8073621971 — already Closed, reopened).

**Required change:**
1. First Cut / Material / Sign-off → call only  
   `PUT /v1/Appointment/{crmAppointmentId}/meeting-outcome`  
   Update Design MM locally.
2. **Do not** PUT CRM lead stage to Meeting Successful for those meetings.
3. PUT CRM Meeting Successful **only when** meeting-outcome returns  
   `applyCrmMeetingSuccessfulMilestone: true` (Pre-10 / DRR only).
4. Never run the Pre-10 Meeting Successful sales-stage process twice.

| Meeting | Design MM | meeting-outcome | CRM lead → Meeting Successful |
|---|---|---|---|
| Pre-10 / Scheduled | Yes | Yes | Yes (once) |
| DRR | Yes | Yes | Yes if eligible |
| First Cut | Yes | Yes | **No** |
| Material Selection | Yes | Yes | **No** |
| Sign-off | Yes | Yes | **No** |

CRM now rejects Design Auto Meeting Successful unless lead is still on Meeting Scheduled / DRR.

Thanks,  
CRM Team

---

## Hub CRM guard (already in Project-ERP)

| Piece | Location |
|-------|----------|
| Allowlist: Scheduled / DRR / Rescheduled / Cancelled only | `CrmSchedulingMilestoneHelper.isEligibleForDesignAutoMeetingSuccessful` |
| Past Pre-10 / Closed / Decision | `CrmSchedulingMilestoneHelper.isAlreadyPastPre10MeetingSuccessful` |
| Design Auto PUT lead reject | `CrmMilestoneMergeHelper.validateDesignAutoMeetingSuccessfulTransition` |
| `applyCrmMeetingSuccessfulMilestone` flag | `AppointmentController` `PUT .../meeting-outcome` |
| Design-only labels (first-cut, material, sign-off) | `CrmSchedulingMilestoneHelper.isDesignOnlyMeetingLabel` |
| Tests | `CrmMilestoneDesignAutoGuardTest` |

Design Auto actor header: `X-Activity-Performed-By: Design Module Auto`.
