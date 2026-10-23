# Connected school announcements — v22, 23 October 2026

`#school-announcements` and `/api/school-announcements` provide a school-membership announcement channel. This extends communication beyond the original account-owned conversation demo. It is an in-app notice workflow; direct conversations, replies, attachments, scheduling and email/SMS/push delivery remain separate stages.

## Authoring and audience

An active approved teacher creates a private draft for an assigned active class. The author, while still assigned, and school administrators can review it. Colleagues cannot see drafts. Administrators can also create school-wide announcements and read retained administrative history. Editing requires the current school year and active class when class-scoped.

The draft selects parents, students and/or teachers and a normal or important label. Saving does not publish. The review shows the exact saved text and current recipient counts by role. An explicit publish confirmation snapshots the active approved accounts eligible for the class or school scope. The author is excluded from their own audience. Each account has one recipient slot, including a parent linked to multiple pupils. Administrators have oversight access; they are not an audience role.

Family eligibility requires a currently linked active pupil in an active class; class announcements require that class. Teachers require a currently assigned active class. Snapshots do not retroactively add newly approved accounts. A new edition is needed to address them. Current role and relationship checks continue after publication, so transfer out, unlinking, suspension, assignment removal, class archive and school-year change remove the corresponding class-wide reading and confirmation rights. These are community notices, not personal learning evidence retained after transfer. Administrators retain authorized archive access.

## Versions and confirmation

Published text and audience are immutable. A replacement starts a separate private draft. Publishing snapshots a fresh audience and new read slots; earlier confirmations remain attached to their original edition. A recipient excluded from a replacement receives only their earlier addressed version, without the new title, body, draft or recipient identities. Discarding a replacement draft preserves the published edition. Reasoned withdrawal preserves text and saved receipts while closing fresh confirmations.

`eduo-announcement-v1` SHA-256 binds school, announcement, class, year, edition, title, body, priority, audience roles and recipient snapshot. An explicit “Прочетох тази версия” action binds the authenticated approved account to that edition and hash with a server timestamp. It is not an electronic signature, agreement, delivery receipt, or proof of understanding. Opening a page or marking an inbox item seen does not create a confirmation. Families see their own confirmation only. The author sees currently permitted recipient tracking rows; administrators retain authorized history.

Recipients can inspect their addressed historical editions. Only the current issued edition accepts fresh confirmations. Exact retries recover existing immutable receipts without changing their timestamps. Replacements, changed hashes, forged reader fields and competing independent requests cannot overwrite earlier evidence.

## Privacy, persistence and recovery

School-scoped AES-GCM protects the announcement, audience, read receipts and audit records in D1, with the school owner scope as authenticated additional data. Receipt keys use `school-announcement-read:` plus an opaque slot UUID, avoiding UUID-key collisions with other school modules. No real database or uploaded school data is committed to the GitHub repository.

The service projects permitted fields before responding. Other families' account IDs, names, read states, operation fingerprints and private replacement content are omitted. Responses are private/no-store. Writes require same-origin JSON with a 128,000-byte declared/streamed bound and cancellation on overflow. Text is rendered as text by React, not injected HTML.

Conditional D1 batches guard the captured directory and document payload. Creation also guards a capacity ledger. Record, capacity change and encrypted audit commit atomically. Read receipts guard both the exact document and directory. A final directory check refuses captured reads after access changes. Lost save/publish/read responses recover through exact requests; SQL failures roll back their batch. The client retains editing inputs, warns about unsaved navigation/page close, and retains an uncertain request when refreshing unchanged inputs.

Pilot limits: 200 announcements per school, 8 issued editions per announcement, 1–1,000 recipients per publication, 60 operations with one reserved for withdrawal, 850,000 ordinary serialized bytes and 880,000 for withdrawal. Growth failures preserve existing history. Retention/purge, backup/restore, guaranteed scale and independent institutional verification are not implemented by this stage.

## Inbox and interface

The workspace provides cards, search, class/status filters, private drafts, role/scope selection, saved-version review, read counts, individual tracking, edition selection and withdrawal. It appears in navigation for all four shell roles; actual server-side school membership determines permissions. The public fictional preview cannot write.

The school inbox links to the exact announcement and school. It uses generic summaries without the body or other recipients. An eligible unconfirmed read request needs action; confirmation and withdrawal close it. Withdrawal has a distinct unread notice. Inbox seen markers remain independent from explicit read receipts. Refresh is manual; no external notifications are sent by publishing this application update.

## Validation and remaining work

The announcement checks add 80 actual route/service checks, with two more actual API-client envelope checks, extending the full isolated suite from 1,599 to **1,681**. They use synthetic identities, real Node SQLite and an in-memory R2 adapter, covering privacy, roles, audience snapshots, fingerprints, encryption, immutable retries, replacements, read/inbox separation, withdrawal, transfer/unlink/suspension/reassignment/year behavior, body guards, capacity, SQL rollback, lost responses and revocation during reads/commits. TypeScript and a production Worker build are release checks. Managed-preview desktop QA checked navigation, search empty/recovery states, teacher detail/tracking, parent detail privacy and disabled fictional-preview write controls. Authenticated write flows, full keyboard traversal, mobile/touch, actual school enrollment and production concurrency/load remain unverified.

The existing Sites identity flow remains in use. Independent login without ChatGPT accounts is still an accepted requirement and needs a supported identity/deployment design. No external signature, national-system, live AI or notification provider is connected by this feature.
