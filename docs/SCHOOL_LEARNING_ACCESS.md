# School-connected learning library — v13, 11 October 2026

`GET/POST /api/school-learning` uses current approved `/api/school` memberships. The **Библиотека на класа** workspace is separate from the original owner-private material, profile, practice and AI demonstrations. Existing work is preserved; no content or progress is automatically migrated or seeded into a real school.

## Permissions

| Account | Read access | Write access |
| --- | --- | --- |
| Active administrator | All school lessons, draft/published editions and retained pupil source snapshots, including archived/transferred history | Manage lessons in active classes; no pupil self-report writes |
| Active assigned teacher | Own drafts, published materials for assigned active classes and learning history of current active pupils in those classes | Create in assigned classes; change/publish/archive/restore own lessons only |
| Active student | Published current-class materials and the source snapshots retained with their own earlier learning checkpoints | Record their own checkpoint on the current published, unarchived lesson for their current class |
| Active linked parent | Published materials for linked children's current classes and those children's retained learning snapshots | None |
| Pending/suspended or unrelated account | No lesson content or pupil learning history | None |
| Anonymous preview | Fixed fictional lesson and profiles | None |

The authenticated school member determines the role, author and pupil. Strict input schemas reject supplied identities and unknown fields. URL role parameters affect only the fictional preview. Detail pupil selection accepts only the server-returned permitted roster. Responses omit creator/submitter account IDs and save receipts. Internal authenticated actors remain in encrypted school audit records.

After a transfer, the child and linked parent keep their earlier checkpoint source text. Their retained view does not reveal later titles, sources or text from the former class. A former teacher loses that pupil's learning history; a teacher or peer in the new class does not inherit the old lesson. Administrator historical access does not authorize a pupil checkpoint. Archival and suspension preserve stored work while limiting current access.

## Lessons and editions

New materials begin as private drafts. The editor includes title, subject, summary, text, source attribution and an optional HTTPS link without embedded credentials. The application treats these as plain text and never fetches the source URL or claims licensing/official curriculum approval. Source links open only when a visitor chooses them.

Publication is a confirmed action. A published lesson's class cannot change. Saving changed published content makes the new content immediately available to its class; the editor explains this. Earlier content and learner checkpoints remain intact. Archiving requires a reason, keeps readable history and stops new checkpoints; restore reopens checkpoints when current membership permits.

Record `revision` protects every save/state transition. Content `edition` changes when title, subject, summary, text or source changes. Publication, archive/restore and unchanged-content saves change only record revision; these do not invalidate current-edition checkpoints. Draft editions are omitted from family/colleague history even when later content is published. Authors/admins may inspect authorized earlier drafts. History is deduplicated by content edition for the reader.

The reader presents full text, expandable source paragraphs or one paragraph per slide. All source paragraphs are preserved in every layout. There is no generated summary, rewritten textbook, narration or rendered video in this connected reader. The original demo library/device speech remains separate.

## Explicit learning checkpoints

Only the linked active student can save **Прочетох**, **Разбирам** or **Имам нужда от помощ**. Opening, scrolling or navigating slides does not create evidence. Staff and parents can read the visible pupil history; they cannot set these choices on behalf of the pupil. A checkpoint is a self-report, not measured mastery, attendance, grading, verified reading or an assessment of effort. Missing records have no negative grade consequence.

Each checkpoint retains the complete lesson condition/edition and a server timestamp. Later choices append history. Current counts use the latest checkpoint per pupil and match it to the current content edition; old-edition checkpoints display **По-ранна версия** and do not claim understanding of new text. Archive/restore keeps the same edition when content is unchanged.

Stable request UUIDs make exact save/checkpoint retries return already committed state without another record, timestamp or audit event. Lesson fingerprints bind the normalized content, class and base revision, and historical save receipts remain available after later edits. Changed reuse or another actor's receipt is rejected. Checkpoints compare the saved actor, content edition and status. A lost response can be retried with the same input; a new form/request is needed for a new choice. UI controls retain unsuccessful selections/editor text until the page/editor is left, disable in-flight actions and do not optimistically claim a successful save.

## Storage, guards and limits

- Existing encrypted D1 `school_records`, school namespace `eduo-school:<schoolId>`; no new table, migration, secret or R2 object.
- `class-lesson` aggregates contain source content, prior revisions and encrypted internal save receipts. `class-learning-progress`, ID `lesson-work:<lessonId>:<pupilId>`, contains that pair's checkpoint snapshots.
- AES-GCM authenticates the school namespace. Every write uses compare-and-swap on the target plus the directory payload dependency; checkpoints also guard the lesson payload. Record and school audit commit in one D1 batch. Concurrent source edits, directory revocation and stale pupil revisions prevent both write and audit.
- Up to 250 retained lessons per school, 40 earlier lesson record revisions, 60 checkpoints per pupil/lesson, and 500,000 JSON characters per aggregate. Text is at most 20,000 characters, summary 500 and source URL 2,000. Overflow returns an error without truncation. The lesson count is a pilot capacity check, not an atomic quota across simultaneous different creates.
- Requests are bounded to 50,000 characters, reject foreign/cross-site writes and return private/no-store responses. JSON values are validated before storage.

The selected school's encrypted lesson/progress aggregates are loaded before permission projection. School-scale pagination, source licensing workflows, retention, operational backup/recovery and performance evaluation remain future work. This stage sends no email/push, does not add learning events to the homework inbox and does not connect live AI or NEISPUO.

## Verification

104 new isolated route checks are in `scripts/school-learning-checks.mjs`, contributing to 703 passing platform checks. They cover identity/scope, draft secrecy, source validation, source/checkpoint snapshots, edition semantics, parent isolation, transfer/archival/suspension, retries, encrypted storage, CAS conflicts, dependency revocation, injected failures/lost responses, capacities, route limits and preservation of the original workspace. TypeScript and the production build pass. Browser visual/interactive QA was unavailable in this run, so responsive CSS is implemented but new rendering is not visually certified. All test identities/content are synthetic; no real school enrollment occurred, and private Site sharing is preserved.

## v14 lesson practice link

Published current-class lesson readers link to **Упражнения за класа**, filtered by school and lesson. The separate practice endpoint enforces membership, captures the lesson source in an authored question edition and records pupil-only scored attempts. It does not change lesson self-reports or create an official grade. See [practice access](SCHOOL_PRACTICE_ACCESS.md).
