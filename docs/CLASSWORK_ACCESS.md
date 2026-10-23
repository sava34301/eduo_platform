# Connected class homework — v12

Text stage: 7 October 2026; submission files: 8 October 2026; teacher files/version history and the connected inbox: 9 October 2026. `/api/classwork`, its inbox, hand-in/assignment save routes and its submission/task file download routes use the approved memberships in `/api/school`. They store new school-scoped records; they do not copy or replace existing owner-private homework or files.

## Permissions

| Account | Tasks and answers visible | Changes allowed |
| --- | --- | --- |
| Active administrator | All school tasks and retained answers, including archived/transferred pupil history | Create/manage tasks in active classes; review active pupils currently in the task's original class |
| Active assigned teacher | Own drafts and all published tasks for assigned active classes; answers of current active pupils in that class | Create tasks in assigned classes; manage/review own tasks only |
| Active student | Published tasks for their current class and their own retained submitted work/files | Text/file hand-in under their linked pupil ID; revision only after the latest review returns the work |
| Active parent | Published tasks and retained work for linked active children only | Read-only |
| No active membership | No tasks or pupil work | None |
| Anonymous preview | Fixed fictional profiles and records | None |

A client role, pupil name or pupil ID cannot select submission identity. The server derives it from the authenticated account and school member list. Internal submitter/reviewer account IDs and file storage keys are not returned in answer views. Administrator audit retains authenticated actors.

After a class transfer, students and parents retain access to their linked pupil's previous hand-ins. That does not permit a new hand-in to the old class. Former teachers lose access to that pupil's answers; assigned teachers in another class do not inherit old task access. Administrators can read historical answers, but only current active pupils in the task's original active class are reviewable. Suspension blocks all school homework access. Pupil/account archival removes family access until valid restoration; stored work remains intact.

## Task and work lifecycle

- New tasks begin as drafts. Publication is an explicit confirmed action. A published task's class cannot change; edits to its text, deadline and rubric affect future hand-ins only.
- Each answer keeps its original task conditions, deadline, criteria and submitted files. Submission time uses the server clock; the late label compares Bulgaria-local dates. Late work is accepted and clearly marked rather than silently blocked.
- A pending or completed hand-in cannot be overwritten. A return with nonempty guidance permits a new attempt; all answers and review decisions remain stored.
- A completed rubric review requires valid points for every retained criterion. Returning work can omit points. The server computes totals and never writes an official grade. AI assistance is an explicit student declaration, not an authorship probability.
- Archive requires confirmation and a reason, stops new hand-ins/reviews and retains history. Restore reopens those actions when current school scope permits them.
- Stable request IDs preserve exact retries, including matching file names, types, sizes and SHA-256 byte digests. Reusing an ID for changed content/files, stale versions and conflicting writes returns errors rather than replacing the earlier record.

## Submission files

The multipart hand-in route accepts one bounded JSON command and up to three files. Text may be empty only when at least one file is present. Allowed formats are PDF, DOCX, TXT, JPG/JPEG, PNG and WebP, up to 10 MiB per file and 20 MiB combined. The actual request stream is bounded to 20 MiB plus 64 KiB multipart overhead even without a Content-Length header. Unknown fields and client-supplied attachment references are rejected. Authentication and school/task scope are checked before file storage.

The complete selection is validated before any blob is written. Filenames are normalized to a basename and stripped of control and bidi formatting characters. Extension/MIME checks are followed by basic PDF/image signatures, valid UTF-8 text without binary control characters, or a bounded DOCX ZIP directory check for required entries. These are format checks, not malware scanning or full document/image validity checks. There is no inline rendering, OCR, handwriting-time verification or file-to-AI transfer.

The student form offers file selection and an image input with `capture=environment`, which requests camera capture where the browser/device supports it. Files remain in page memory until hand-in; failures retain the inputs. A revision selects its own files while earlier attachments remain in the work history. Reloading or leaving the page loses unsent file selections. Native camera hardware has not been tested.

Downloads require authenticated current membership and identify the school, assignment, pupil and file. Those URL identifiers are never sufficient authorization. The server finds the file only within an attempt of a visible submission. Teachers follow current class scope; pupils and linked parents follow their own retained work; administrators may read archived/transferred history. Suspension blocks downloads. The original owner file endpoint cannot retrieve these school files.

Decrypted bytes must match the saved size and SHA-256 digest. Downloads use the verified MIME type, attachment disposition, nosniff, a restrictive sandbox CSP and private/no-store caching. Missing or corrupt storage returns a recoverable availability error without erasing the saved metadata. The anonymous preview offers a deliberately public, authored fictional text example; it never falls back to a real file download.

## Teacher worksheets and task versions

`POST /api/classwork/assignment` uses the same bounded multipart parser and file checks as pupil hand-ins, but accepts only an assignment-save command. Only the author with current assigned-class scope or a school administrator can change an existing task. Assigned colleagues are read-only. New tasks remain drafts until explicit publication.

The editor sends a stable request ID and the IDs of the current saved files to keep. Those IDs are validated against the current assignment; arbitrary object keys, files from another task and IDs found only in history are not accepted as new attachments. Omitting this field in an older text-only editor preserves the current files. An explicit empty list excludes them from the next version. Retained and new selections share all count/size limits. New uploads occur only when saving. Unsent text/file choices stay in the open editor, and the editor cannot be dismissed or edited during an in-flight save.

Every task save or state change retains the preceding condition, files, class, publication state and timestamp. Historical save receipts remain inside encrypted records and are omitted from API views. A fingerprint binds the normalized fields, base version, retained IDs and uploaded byte metadata. Exact matching retries return the saved task without another version/audit/upload, including after later edits. Changed reuse or another actor using a receipt is rejected.

`GET /api/classwork/task-files/[id]` identifies school, assignment and a positive integer version. Current-class pupils and linked parents can download current and retained published versions. Assigned colleagues see published versions; the author can inspect draft history within assigned class scope; administrators can inspect all school versions. Draft versions are not exposed merely because a file was subsequently published. Suspended accounts have no download access. The endpoint shares the encrypted-byte, digest and private download protections of submission files.

After transfer, a child and linked parent receive no current worksheet files or broad old-class task history. They retain only files referenced by conditions in their own earlier hand-ins. A hand-in now snapshots worksheet metadata with its condition, redacting storage keys in responses. Existing earlier hand-ins are not backfilled. Replacing or excluding a task file never deletes its historical bytes. Retained versions and hand-in condition files appear beside the instructions in the interface.

## Connected homework inbox

`GET /api/classwork/inbox` derives activity from committed assignment versions, attempts and reviews. It announces publication, changed conditions, submissions, completed feedback, revision requests and archive/restore transitions. Unchanged condition saves and exact request retries do not invent duplicate events. Entries use stable source identifiers and saved timestamps. This is a view of retained work, not a delivery log or historical recipient audit; earlier retained activity can appear when the feature is first opened or access is restored.

Every request rechecks active membership. Teachers receive currently assigned-class activity and current active pupil work; colleagues have no author review action. Students and parents receive only published current-class tasks and linked-pupil work. After transfer, families retain their own earlier submission/review activity but receive no new former-class assignment announcements. Former teachers lose that pupil's work activity. Administrators retain archived/transferred work as read-only history where current review permissions do not apply. Anonymous examples are fictional and cannot save markers.

Entries contain only task/pupil display information and generic status descriptions, with no answer text, feedback text, AI declaration, scores or file metadata. Links open the school/task and, for work entries, the authorized pupil. The client accepts a requested pupil only from the server-returned permitted roster. The server still authorizes the actual homework and downloads.

The Bulgarian interface provides text, kind, class, pupil, unread/read and action filters, Bulgaria-local day/time groups, individual read/unread actions and a bulk action over exactly the currently displayed unread IDs. Reading does not complete a task, submit work, acknowledge receipt for another person or create a school audit event. Action labels follow the current latest attempt/review and current submission/review rights. Parents remain read-only for homework; their personal read markers are writable.

`POST /api/classwork/inbox` validates a captured directory revision and up to 200 unique IDs from the caller's current authorized window. Mixed invalid batches fail without partial changes. The authenticated account selects the personal namespace `eduo-classwork-inbox:<schoolId>:<userId>`; supplied identities are rejected. AES-GCM protects the `read-state` aggregate, including server read timestamps. A directory dependency and compare-and-swap guard the write in the D1 transaction. Concurrent tabs merge into the latest personal state, with four bounded attempts; exact retries leave timestamps/version unchanged. A failed write is not optimistically shown as saved; after a lost response, an exact retry recovers the committed state. Opening a homework link still proceeds if its read marker fails.

The latest 200 accessible entries are selected after authorization, and counters describe that window. Earlier work remains in homework detail. Up to 2,000 retained read markers are supported per account/school; overflow is rejected without truncation. The inbox uses manual refresh. It sends no email or push notification, records no delivery telemetry and has no background polling or external recipient workflow.

## Storage and guards

Records use the existing encrypted D1 namespace `eduo-school:<schoolId>` with `class-assignment` and `class-submission` kinds. No schema migration or new secret is introduced. An assignment aggregate retains its prior conditions/file references; a pupil/task pair has one submission aggregate containing attempts, file metadata, worksheet snapshots and review history. R2 bytes use AES-256-GCM with that same school namespace as authenticated additional data. Random object keys and file IDs are generated by the server; object keys remain inside encrypted records.

Each write checks the encrypted directory dependency and target record inside the same D1 batch as the record and school audit entry. Hand-ins and reviews also check their saved assignment dependency. A membership revocation, task change or concurrent record edit between validation and commit prevents the write and its audit event. UI forms retain the directory revision captured when opened.

R2 writes occur before the guarded assignment/submission audit transaction. On failure, cleanup checks the current saved target and deletes only this request's new objects that are not linked from a committed current or historical version/attempt. An error reported after a database commit retains the linked files. If commit state cannot be read or cleanup fails, deletion is deferred rather than risking saved work. Previously saved files are never deleted by a failed revision. R2 and D1 do not form a single atomic transaction; a scheduled orphan cleanup/reconciliation job and retention lifecycle remain future work.

## Pilot limits

Answer text is at most 20,000 characters and optional with files; review guidance is at most 3,000. Rubrics allow six unique criteria and at most 100 total points. A submission permits ten attempts and each attempt twenty reviews. An assignment permits 40 earlier versions, including retained state transitions. An aggregate exceeding 500,000 JSON characters is rejected without truncating history. Creation checks a school limit of 250 tasks including retained tasks; that count is a pilot capacity check, not a transactionally enforced quota across simultaneous different creates.

The list/detail implementation loads encrypted task and submission aggregates for the selected school before projecting visible results. Large-school pagination, archival storage and performance certification remain future work. Unsaved form text is temporary to the open page; it is not claimed to survive reloads.

External notification delivery and file deletion/retention administration are not implemented. Gradebook, tests, messages, documents and the original file registry remain on separate owner-private routes. Live AI, NEISPUO, signature providers and device enforcement are not connected by this stage. Institutional/guardian verification, retention, operational recovery and supervised school evaluation remain necessary before real-school use. No real identities were enrolled during development; Site sharing was preserved. The new inbox and teacher editor/version history have not had browser visual QA in this run.
