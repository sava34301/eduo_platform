# School-connected attendance — v18, 13 October 2026

`#school-attendance` and `/api/school-attendance` use the approved school membership rather than the owner-demo role selector. The school directory, encrypted attendance record, creation ledger and audit use the existing D1 binding. This release does not migrate or rewrite the earlier owner-demo attendance records and adds no database migration or provider secret.

## Role and privacy rules

| Account | Read | Write |
| --- | --- | --- |
| Assigned lesson author | Lessons for assigned active classes and pupils still in the original class. Parent explanation text is visible only for their own lesson and currently permitted pupils. | Create a lesson record; mark the current original-class roster; reasoned corrections, metadata edits and cancel/restore. Review pending explanations for those pupils. |
| Assigned colleague | Authorized class attendance, ordinary attendance notes and marking history. Parent explanation bodies, senders and decision text are withheld. | No editing another teacher's lesson or reviewing its parent explanations. |
| Student | Their own active linked pupil's records, notes, explanations and history. Their retained records remain available after a class transfer. | No marking, parent explanation, review or self-excusing. |
| Linked parent | Only linked active pupils; their retained original-class records follow the link after transfer. | Explain an absent record; withdraw their own pending explanation. Neither action excuses the absence. |
| Administrator | School history, including archived/transferred pupils and earlier years. | Current-year active-class records; also finish current-year pending explanations for transferred/archived pupils without rewriting the original roster. |
| Pending, unrelated or suspended account | No school roster or attendance records. | None. A class or role query parameter cannot grant access. |

The list response contains only permitted rows and basic status; teacher notes and explanation text are omitted. The detail projection applies row-level permissions again. Views redact actor account IDs, retry identifiers and fingerprints. Family CSV contains only the selected permitted child; no explanation body, sender identity or hidden account ID is exported. Revocation during reading produces a conflict instead of releasing the previously captured view.

## Human-entered lesson workflow

A lesson key is unique for class, Bulgaria-local date and numbered lesson period (1–12). Creation requires a current-year, nonfuture date and captures the then-active 1–100 pupil roster. All pupils start **unmarked**. Absence is never inferred from an unopened platform or missing mark. This is a manually confirmed lesson record, not evidence from an official connected timetable or classroom sensor.

Statuses are unmarked, present, late, absent and excused. Late marks require 1–60 minutes; all other states require zero minutes. A batch is validated completely before any pupil changes. Known marks and an initial excused mark require a reason; unchanged rows are rejected rather than inventing history. The interface's fill-present action affects only originally unmarked rows whose draft is still unmarked, preserving explicit absences, notes and permission-blocked rows.

The linked parent submits an explanation for an absent row. It stays pending and the absence stays recorded. The lesson author or administrator explicitly approves (excused), refuses (still absent with a distinct decision), or returns it for clarification (still absent). A later explanation preserves earlier submissions and decisions. The original sender may withdraw a pending explanation. Manual correction away from absent closes the pending request with the correction reason. Cancelling the lesson closes pending explanations and excludes that lesson from current counters; restoration retains the closed explanations rather than resurrecting them.

Pupil and lesson history preserve exact states, notes, actor display names, timestamps, source record revisions for new events and reasons. Changing a subject/topic does not relabel an earlier event. There is no automatic official grade, penalty or AI decision. Counts are raw pupil/lesson records; they do not claim statutory fractional-absence calculations.

## Safe saves and pilot capacity

Every mutation has strict fields, explicit confirmation, captured directory/target revisions and an actor/content request receipt. Canonicalized roster fingerprints allow exact reordered-batch recovery. A prior accepted request recovers the latest currently permitted view without another write or reverting subsequent edits. Changed reuse is refused. Revoked membership is checked before receipt recovery.

Encrypted target, directory and creation-ledger guards run in the same D1 batch as the capacity update and audit. Concurrent writers have one winner; pre-commit SQL failures roll back the record, index and audit. Lost post-commit responses are reported as unconfirmed, and an explicit exact retry recovers the saved operation. The browser never automatically resubmits a write.

Limits: 250 lesson records per school in this pilot, 120 saved operations per lesson, 40 pupil events per lesson and 180,000 serialized UTF-8 bytes per lesson. Old records/history are never truncated to make room. Each accepted pending explanation reserves its review event, operation slot and 12,000 bytes; unrelated edits cannot consume those reserves. A refusal preserves the current record. These bounds are pilot limits and are insufficient as a full-school production retention plan.

The API checks identity, origin, media type and actual streamed bytes, cancels oversized input, returns private/no-store responses and fails honestly if encryption/storage is unavailable. Signed-in accounts with no school get an empty access state, never fictional attendance. Anonymous preview is read-only and fictional.

## Interface and verification

The workspace includes lesson cards, class/subject/year/date/search filters, selected-child views, filtered CSV, an author/admin review queue, pupil timelines and lesson metadata history. Confirmed roster/review forms keep failed inputs mounted. Refresh retains the draft, resets confirmation, identifies unavailable pupil changes and recognizes an already-created canonical lesson. Close/discard and reload warnings protect unsaved fields; loading and saves disable conflicting controls.

The attendance fixture contributes **135 checks**, plus two actual API-envelope checks; all **1,314** isolated workflow checks pass. Coverage includes family/colleague redaction, transfer/archive/unlink/revocation, exact retries, atomic invalid batches, target/directory/ledger races, rollback, lost responses, concurrency, last-slot creation, reserved reviews, read revocation, earlier-year views and byte-bounded bodies. TypeScript passes. The release also requires the production Worker build. Browser visual/interactive QA was unavailable; no actual school identities, provider or native devices were exercised.

## Official-source review

Reviewed 13 October 2026:

- [Shkolo parent explanations](https://help.shkolo.com/hc/bg-bg/articles/21708335951261) describes school-configured parent submission and child selection.
- [Shkolo administration of family absences](https://help.shkolo.com/hc/bg-bg/articles/22970471771933) distinguishes configured automatic handling and staff manual review.
- [AdminPlus products](https://dogovori.adminplus.bg/Products) describes pupil grade/absence entry and reports; the product search result was available while the full page timed out on the later retrieval.

Eduo's pilot uses explicit review as its own product choice. It does not copy another platform's institutional authority, statutory time windows, medical interfaces or absence-calculation rules. Full register compliance, official schedule integration, attachment/medical-note processing, school policy configuration, year closure and authorized NEISPUO exchange remain further work.
