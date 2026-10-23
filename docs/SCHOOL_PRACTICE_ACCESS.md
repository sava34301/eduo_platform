# Connected lesson practice — v14, 11 October 2026

`/api/school-practice` connects teacher-authored single-choice practice to published school lessons. It derives each account's rights from the same approved directory used by connected homework and the lesson library. The demonstration role selector never changes these rights. Anonymous previews contain only fictional read-only records.

## Role scope

| Role | Read | Write |
| --- | --- | --- |
| Teacher author | Own assigned-class drafts, published assigned-class practice, current active pupils' attempts and current-edition question analysis. Current author key is available for managed practice. | Save/publish/edit/archive/restore authored practice for currently assigned active classes. Any published active lesson in that class can be used as a source. |
| Assigned colleague | Published practice, current active pupil attempts and question analysis. No unpublished draft or unsubmitted current author key. Completed pupil attempts include their original keys and explanations. | None for another author's practice. No pupil submission. |
| Student | Published current-class questions and captured lesson text; own completed attempts, original keys, explanations and reflection. After transfer, only their completed old-class snapshots remain. | Submit a new attempt under the server-derived pupil identity while both practice and its source lesson are published/active. No author action or supplied score. |
| Parent | Linked active children's class practice and completed attempts. Transfer retains only those children's saved source/question snapshots. | None; no pupil submission. |
| Administrator | School practice and retained pupil history, including transferred/archived pupils. | Manage practice in active classes. No pupil submission. |
| Pending, suspended or unrelated account | Account/request status only, or no school view. | None. |

A transferred family does not receive a current old-class title, source, question text, explanation, practice revision, author key or teacher analysis. Detail falls back to the latest permitted completed snapshot and uses revision zero. Former teachers lose the transferred/archived pupil's attempt history. The new class teacher does not inherit old-class practice. Suspension removes current and retained access on subsequent server requests.

## Authoring and source editions

Authors select an active published lesson; drafts cannot be used to publish source text indirectly. The save names the exact lesson record revision and captures its text, subject, attribution, HTTPS source link and content edition on the server. Practice keeps its original lesson/class association.

The editor supports 1–12 questions, 2–5 distinct options per question, exactly one correct option, an authored explanation and an integer weight of 1–5 points. IDs and normalized option text must be unique within their respective question/set. An option in the key must belong to that question. Client-supplied authors and unknown fields are rejected.

New practice saves as an author-private draft. Explicit publication makes it available to the class. Saving changed published content creates a new practice edition immediately; previous attempts retain their original conditions. Title, instructions, source snapshot, question order/content, keys, explanations and weights all participate in edition comparison. Unchanged saves and publish/archive/restore increase the record revision without changing the content edition.

A later lesson edit does not silently replace the practice source. The detail marks that the lesson has a newer edition while continuing to display the captured text. An explicit author save captures the current lesson and creates a new practice edition if the source changed. Source archival stops new attempts and prevents publication/restoration until the source is restored. Historical results remain readable.

## Attempts and feedback

- An attempt must include exactly one valid option for every question in the currently submitted practice edition. The server rejects unknown/duplicate questions, foreign options, incomplete answers, supplied pupil identities and supplied scores. Answers are stored in authored question order.
- The server awards the question's weight for its exact correct option and zero otherwise. It records the total/max, server timestamp, optional pupil reflection and complete source/question/key/explanation snapshot. This writes no official grade, learner checkpoint or owner-demo grade.
- Current question payloads omit `correctOptionId` and explanations for students/parents. Only a completed permitted attempt releases its snapshot's keys and explanations. Current author keys and teacher analysis are separate staff fields. Actor IDs and receipt fingerprints are removed from returned attempts.
- New attempts append history; they never alter or regrade a prior result. A question correction starts a new content edition. Previous successes do not count as completion of the new edition.
- Teacher question analysis takes only the last attempt for each current active pupil in that practice edition, so repeated attempts do not multiply pupil coverage. Transferred/archived pupils and other editions are excluded from current analysis. Administrators can still inspect their retained records individually.

This is formative practice with repeat attempts and released explanations, not a secure examination. Results reflect choices on these authored questions and can include outside help. No conclusion about effort or broad mastery is inferred from a result or a missing attempt.

## Storage and write consistency

The existing encrypted D1 `school_records` table is reused under `eduo-school:<schoolId>`. Practice records use kind `class-practice`; pupil work uses kind `class-practice-work` and stable ID `practice-work:<practiceId>:<pupilId>`. AES-GCM binds the namespace as authenticated data. No new schema migration, file storage or provider secret is added.

Every mutation checks the active membership and captured directory revision. A D1 batch conditionally writes the target using its encrypted payload as a compare-and-swap guard and writes its encrypted school audit only if that exact target payload committed. Save/publication/restoration guard the source lesson; attempts guard both practice and source. A membership, source or target change between validation and commit blocks both target and audit. Concurrent edits/submissions have one winner; stale callers receive 409.

Save receipts retain a request ID, actor and SHA-256 content fingerprint through practice history. Attempt receipts retain the canonical submitted choices/reflection and base revisions as a fingerprint. Exact older retries recover saved state without reverting later content or adding an audit; changed reuse is rejected. Recovery still requires current authorization. Unknown lost-response results can be retried with the same request; HTTP success is not fabricated after a database failure.

POST input is streamed with a 150,000-byte cap, including requests without a content length; an over-limit stream is cancelled. Foreign Origin/cross-site mutations are rejected. Every response uses `private, no-store`. All retained HTML-facing text is rendered as text by React; source links inherit the lesson library's validated HTTPS contract.

## Interface and pilot limits

The Bulgarian **Упражнения за класа** workspace follows the existing blue campus design, with sage/gold feedback, responsive practice cards, class/subject/status/search filters and lesson deep links. The lesson reader links to practice for that lesson. Author controls include reorder/add/remove options/questions, answer-key preview, source edition, state confirmations, failed-input retention and explicit refresh without losing entered questions. Student controls include per-question navigation, selected-answer progress, clear choice, optional reflection, explicit submit and discard confirmation. Saved reviews show choices, points, explanations and original source text. Parents have linked-child selection; teachers have a roster and question-choice counts.

Selected answers and unsaved editor input stay in page memory. They are not server drafts and are lost when navigating to another section or reloading. Reload warnings and explicit in-page discard controls are present; no claim of cross-page draft recovery is made. Read/open actions create no attempt or learning evidence. Refresh is manual; practice does not add homework inbox entries, email, push or automatic AI generation.

Pilot bounds are 250 retained practice records per school, 40 prior record revisions per practice, 40 attempts per pupil/practice, and 500,000 JSON characters per aggregate, whichever is reached first. Limits reject a new write rather than truncate saved history; the student detail explicitly disables new attempts at the count limit. The per-school creation count is a pilot quota, not an atomic concurrent enrollment limit. Pagination, retention/recovery administration, curriculum validation and school-scale throughput remain future work.

## Verification

The release has 840 isolated workflow checks, including 137 new practice checks in `scripts/school-practice-checks.mjs`, against the actual application routes with synthetic users, Node SQLite and in-memory R2. Coverage includes role and answer-key privacy, exact weighted scoring, source capture, changed/unchanged editions, earlier-result preservation, parent/classmate isolation, transfers, suspension/archival, concurrent updates, dependency revocation, failed/lost transactions, retry recovery, input limits/cancellation, encryption and retained-capacity behavior. TypeScript and the production Worker build validate source compilation. Managed browser visual/interactive QA was unavailable for this release. No live school identities, AI provider, official integration or school-scale load was exercised.
