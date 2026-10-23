# Connected grade journal — v18, 13 October 2026

**Дневник на класа** stores teacher-entered current, term and annual grades in the school namespace. The earlier gradebook remains a separate owner-private demonstration. No demo grade is migrated into a pupil's school record.

## Role access

| Role | Read | Write |
| --- | --- | --- |
| Assigned active teacher | Grades whose original class is assigned and whose pupil is still active in that class. | Add to that class; correct, annul or restore their own current-year grades. |
| Assigned colleague | The same permitted class roster and grade history. | Create their own entries; cannot modify another teacher's grade. |
| Active administrator | School grade history, including transferred/archived pupils and earlier years. | Add/manage current-year original-class grades; also correct/annul/restore a transferred active pupil current-year term/annual decision. Earlier-year and archived-pupil history remains read-only. |
| Linked active student | Their own current and retained grades while their linked pupil/current class remain active. | None. |
| Linked active parent | Each linked active child's current and retained grades. | None. |
| Pending, suspended or unrelated account | Access status only, with no grades or pupil roster. Unrelated school/detail requests fail. | None. |
| Anonymous internal preview | Explicitly fictional role-specific grades. | None. |

The demo selector and URL role/pupil parameters never establish permission. A school membership index only finds schools; the encrypted directory authorizes the actual read/write. Grade reading checks the directory again after decrypting records, so an intervening revocation returns a conflict instead of a pupil response. Family history follows the pupil link after transfer; neither former nor new class teachers receive unrelated original-class history. Removing the parent link removes that child's retained history too.

## Entry and correction

A human chooses the pupil, subject, current/term/annual kind, integer value 2–6, date, first/second term and optional feedback. For a current grade they also choose an assessment type. They explicitly confirm the entry. The server supplies pupil/class snapshots, school year, author and timestamps. The submitted class must still match the pupil. Dates follow this pilot's September 1–August 31 academic-year bounds and cannot be future dates; these bounds are not a declaration of national assessment policy.

Correction keeps the pupil, original class, year and author. It needs the current record/directory revisions, confirmation and an explanatory reason. Each version retains its exact value, subject, assessment type, date, term, feedback, status, actor and reason. Annulment makes the record inactive without erasing it; only current-grade annulment/restoration changes the informational mean. An older retry cannot undo a later correction or restoration. No-op corrections and unconfirmed actions are refused.

The interface includes a teacher roster/subject matrix, all-record list, family subject cards, linked-child selection, class/subject/kind/term/year/search/status filters, feedback/history dialogs and filtered CSV export. Means use active current-kind values only; legacy records without a kind are current and are labeled as informational; they do not calculate a term/annual grade or rank pupils. Editors retain current fields on a failed request and can explicitly refresh their base. Refresh resets confirmation. A creation already found in the journal is identified without silently resubmitting it or replacing the draft. Discard and reload states are explicit.

## Term and annual decisions

v18 adds one active term grade per pupil/year/normalized subject/term and one active annual grade per pupil/year/normalized subject. The annual kind is recorded in the second-term field. Class is deliberately outside the key, so transferring a pupil cannot create another annual value for the same year. Subject text is NFKC-normalized, whitespace-collapsed and case-folded for the reservation; official subject identifiers and alias mapping remain future work.

The encrypted `grade-summary-index` stores active reservations. Creation, subject/period correction, annulment and restoration guard that index inside the same D1 batch as the grade, directory, capacity and audit. Moving into an occupied slot refuses all changes. Annulment releases the slot while keeping the full inactive record; a new replacement may claim it. Restoring the older record is blocked until the replacement is explicitly annulled. Exact old retries cannot release or reclaim another record's later reservation. The index rejects count/byte overflow without truncation (2,000 active slots, 800,000 serialized bytes).

Kinds cannot be silently converted through a correction. A teacher explicitly chooses final values; no average, practice score or AI proposal populates them. Current-year administrators can rectify a transferred active pupil's summary while preserving its original class/author; the earlier current-grade history stays read-only. Archived pupils and earlier years remain immutable. New current-kind fingerprints omit the default kind, preserving pre-v18 exact receipts and no-op comparison.

The interface adds kind filters, visibly labeled summary chips, first/second/annual family cells, kind-aware history and CSV, duplicate-period warnings and blocked conflicting restoration. Refreshed forms keep typed input but reset confirmation and use latest account/grade/pupil availability for action eligibility. Annual/current/term entry is a pilot workflow, not a certification of official policy or year closure.

## Persistence and ambiguous responses

`class-grade` records, version histories, receipts, capacity ledger and school audits are AES-256-GCM encrypted with the existing school namespace as authenticated data. The API strips actor account IDs and receipt request/fingerprint fields from grade views; visible actor names explain the history. No real pupil, external recipient or live grade was used in validation.

A conditional D1 batch changes the target, optional summary reservation, creation capacity and audit together. It compares the target ciphertext and directory snapshot; creation also compares a shared ledger. A collision cannot spend a phantom slot. A failed SQL audit rolls back the target and ledger. A lost response may leave a committed grade; the route and client say that the write is unconfirmed. A manual exact request replay verifies actor/content and returns the latest authorized state without another grade, version, capacity increment or audit. Writes are never automatically retried.

The pilot holds at most 2,000 grades per school and 40 versions per grade. Reaching creation capacity preserves reading and existing correction rights. Reaching version capacity preserves the complete history and refuses another change. Request bodies are limited to 32,000 actual bytes; oversized streams are cancelled. Responses are private/no-store, missing encryption returns an honest error, and origin/strict-schema checks reject forged fields.

## Product boundary and validation

This stage records **current, term and annual** grades. A teacher controls every value; practice, AI, effort telemetry and missing engagement create no grade automatically. Official assessment/date rules, teacher-subject assignment catalogs, institutional/guardian verification, year closure, official reporting, retention/backup and authorized NEISPUO exchange remain separate stages. The Site remains owner-private; opening it to a school requires the owner's audience decision.

The complete suite passes 1,314 isolated workflow checks, including 63 new summary-grade checks and 59 combined-source inbox checks, alongside the earlier workflows. It exercises all roles, validation, redaction, transfers/unlinking/archival, read/write revocation races, SQL rollback, lost responses, exact retries, concurrent corrections/creations, capacity, malformed/multibyte bodies and encryption failures. TypeScript and the production Worker build validate source integration. Browser visual/interactive QA, live school sessions and institutional readiness were not verified.

## Primary-source review

Public materials were checked on 12 October 2026. [Shkolo](https://www.shkolo.bg/) describes parent access to grades and school activity. [AdminPlus's module descriptions](https://dogovori.adminplus.bg/Products) describe grade entry/editing, pupil summaries and national integration. They support the choice to connect teacher records to family views; they do not establish that Eduo has official integration. The [Digitalna Ranica entry point](https://edu.mon.bg/) requires JavaScript and exposed no detailed public workflow in this check; no unsupported API or feature behavior was inferred from it.
