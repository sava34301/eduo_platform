# Eduo role and feature review

Release reviewed: 17 October 2026, v20. This web pilot includes a school-scoped directory, connected text/file homework, activity inbox, lesson library/practice, current/term/annual grades, attendance and parent text documents with signatures. A 62-entry catalogue preserves the 40 image capabilities and nine concept modules and adds 13 PDF areas. The Site's public audience is preserved; school records require approved authenticated membership. Original learning/administration/file-document demos still use account-owned fictional personas; role selection does not authorize those demos for real people.

## October 17 school documents, v20

| Role | Working behavior | Boundary |
| --- | --- | --- |
| Author teacher | Assigned-class text drafts, selected pupils/approved-parent counts, explicit saved-version issue, per-parent evidence/completion, replacement/discard/withdrawal and copies. | Colleagues' documents are private. Transfer/archive removes affected pupil receipt rows; earlier years cannot be edited. |
| Parent | Personally addressed editions for linked active children, separate signatures/acknowledgments for each parent and child, signed history/copies and exact inbox actions. | No other parent identity or signature, no unaddressed replacement text/title, no signing after withdrawal/transfer/year change or access removal. |
| Administrator | Current-school authoring plus retained permitted transferred/archived evidence. | Current active class/year required for changes. No claim of independent institutional or provider identity verification. |
| Student/pending/suspended/unrelated | No parental document content, signatures or actions. | The school profile role is derived from approved membership, not the demo role selector. |

All 1,493 isolated checks pass. Text-only scope, storage/evidence formats, recovery, limits and browser-verification boundaries are documented in [school document access](SCHOOL_DOCUMENT_ACCESS.md). Attachments, specialized forms, retention operations and provider-based signing remain future work.

## October 16 drawn signing, v19

The parent persona in the private document demo can draw on screen, undo/clear, enter a name and explicitly confirm the version. Drawing and read acknowledgment are distinct; provider-based electronic signing is a separate pending option. Staff and parent document views display the saved drawing, method and bound receipt. Historical versions and printable copies retain their own signature. Server authorization remains the account boundary for this demo; real school/guardian recipients, multiple parents and provider identity proof remain future work. See [signing scope and checks](DOCUMENT_SIGNING.md).

## October 13 term/annual grades and school activity, v18

| Role | New working behavior | Boundary |
| --- | --- | --- |
| Teacher author | Explicit current/term/annual entry, type filters and summary chips; one active summary per subject/period; reasoned correction, annul/replacement/restoration; own permitted grade notices and attendance/explanation actions. | No conversion of current kind by correction, automatic final value or conflicting restoration. Subject assignments and tighter journal read scope remain future work. |
| Student | Own term/annual values and history; exact-grade/lesson notices and personal read state. | No classmate data or parent-only explanation action. Formal single-attempt tests remain distinct from repeatable practice. |
| Parent | Linked-child period values, significant attendance changes and explicit approve/refuse/clarify decisions; relevant clarification action and preserved read state. | Feed omits private bodies; it is not email/push delivery. Complete family profile/documents/fees are not yet migrated. |
| Administrator | School grade/attendance activity; current-year transferred pupil summary rectification while preserving original snapshots; retained pending-explanation review. | Earlier-year/archived summary grades stay read-only. Current-grade transfer history does not become editable. |

1,314 isolated checks pass, including 63 new summary-grade and 59 activity checks; TypeScript passes. Production build is required and new browser QA was unavailable. The [PDF traceability](COMPLETE_SPECIFICATION_TRACEABILITY.md) records every role/AI/design/integration/launch area and its implementation boundary.

## October 13 connected attendance and reference scope, v17

| Role | Available behavior | Boundary |
| --- | --- | --- |
| Assigned lesson author | Capture a lesson and unmarked roster; mark/correct attendance, edit metadata, cancel/restore and review parent explanations; inspect exact history. | Only current active assigned-class pupils may be marked. Colleagues cannot edit or receive private explanation text. |
| Student | Own states, ordinary notes, explanation decisions and timelines, including retained original-class history. | Read-only; no self-excusing, inferred attendance or classmate history. |
| Parent | Select linked children, submit absence explanations and withdraw their own pending explanation; inspect decisions and retained history. | An explanation does not excuse an absence before an explicit staff decision. Removing the link removes access. |
| Administrator | Inspect school history and manage current-year active-class records; finish transferred/archived pending explanations. | Earlier years remain read-only; completing an accepted explanation does not change the original roster. |
| All catalogue viewers | Search/filter all reference requirements, see actual current/remaining scope and follow available workspace links. | Catalogue role filters do not authorize school access; planned/provider/service cards do not claim a working module. |

All 1,192 isolated checks pass, including 135 attendance checks and two new API-envelope checks. Safe-save tests cover exact recovery, atomic writes, revocation, concurrency and reserved review capacity. TypeScript passes; production build is required. New browser visual/interactive QA was unavailable. See [attendance access](SCHOOL_ATTENDANCE_ACCESS.md) and [reference scope](REFERENCE_FEATURE_SCOPE.md).

## October 12 connected current grades, v16

| Role | Available behavior | Boundary |
| --- | --- | --- |
| Assigned teacher author | Confirm a pupil's current grade, subject/type/date/term/feedback; inspect the roster/subject matrix; correct with a reason; annul/restore with exact history. | Current active-class and author rights govern edits. Colleagues read assigned-class history without editing another teacher's entries. |
| Student | Subject cards, own recorded values, feedback and every correction/annulment/restoration version. | No self-grading or classmate records. Retained original-class history follows the approved pupil link. |
| Parent | Linked-child selection, subject/current-grade views and preserved teacher feedback/history after transfer. | No pupil/teacher writes or unrelated-child data. Removing the link removes current and retained access. |
| Administrator | Inspect school records; explicitly manage current active-class grades; retain archived/transferred/earlier-year history. | Historical records remain read-only; the original teacher remains identifiable beside each correcting actor. |

All 1,055 isolated checks pass, including 126 gradebook checks and two additional actual API-envelope checks. Exact receipts, target/directory/ledger guards, atomic audits and bounded histories protect saves and ambiguity. Means are informational and do not assign a term/annual grade. Browser visual/interactive QA was unavailable. See [gradebook access](SCHOOL_GRADEBOOK_ACCESS.md).

## October 11 connected lesson practice, v14

| Role | Available behavior | Boundary |
| --- | --- | --- |
| Teacher author | Select a published lesson, draft questions/options/weights and explanations, preview the key, publish/edit/archive/restore; see a roster, saved results and latest-current-edition question-choice analysis. | Assigned active-class and author/admin rights govern edits. Colleagues read published practice/results without unpublished keys or edit controls. |
| Student | Answer current-class questions in their own rhythm, add a reflection, submit for server-scored points/explanations, retry and inspect the original-source history. | Only the server-derived pupil can submit. Current keys stay private until an authorized completed attempt. Results write no grade or understanding checkpoint. |
| Parent | Read linked-child practice and completed original-source answers/explanations, with child selection. | No pupil submission or classmate history. Transfers retain only the child's completed old-class snapshots. |
| Administrator | Manage practice in active classes; inspect authorized school history, including transferred/archived pupils. | No manufacturing pupil attempts. Historical pupils do not enter current question analysis. |

840 isolated workflow checks pass, including 137 new practice checks. Source/key changes produce a new edition without regrading earlier results. Target/directory/source guards, immutable attempts and exact receipts protect concurrent/lost-response behavior. Pending-action controls, editor refresh with input retention and responsive layouts are implemented; new browser visual QA was unavailable. See [practice access](SCHOOL_PRACTICE_ACCESS.md). Live AI, secure examinations and school-scale operations remain disconnected/unverified.

## October 11 connected lesson library, v13

| Role | Available behavior | Boundary |
| --- | --- | --- |
| Teacher author | Draft/publish class lessons with source attribution, edit versioned text, preview, archive/restore and see current pupils' declared status/history. | Current assigned-class and author rights required for edits; colleagues read published content only. Self-reports are not mastery scores. |
| Student | Read current class lessons in full, sections or slides; explicitly record read/understood/help; inspect exact-source checkpoint history. | New source editions do not inherit old understanding. Only the linked pupil can save a checkpoint. |
| Parent | Read linked children's class lessons and their declared status/source snapshots. | No classmate history or pupil checkpoint controls. Transfer retains only their own child's saved source snapshots. |
| Administrator | Manage lessons in active classes and inspect authorized school history, including archived/transferred pupils. | No setting pupil self-reports; retention, licensing and operational review remain future work. |

703 isolated route checks pass, including 104 new library checks. Source-preserving reading layouts and source links work without an AI provider; generative adaptation and video are not connected. TypeScript/build validate the source; new browser visual QA was unavailable. See [library access](SCHOOL_LEARNING_ACCESS.md).

## October 9 connected inbox, v12

| Role | Inbox behavior | Boundary |
| --- | --- | --- |
| Student | Published class tasks, own saved attempts/feedback and an action on current unsubmitted or returned work. | Reading is separate from submitting/completing. Transfer retains only that pupil's earlier old-task work activity. |
| Teacher | Published assigned-class activity and current active pupil submissions; author review actions on pending latest attempts. | Colleagues can read without author review rights. Transferred/archived pupil work drops from the view. |
| Parent | Publication and linked-child work/feedback, with personal read/unread state. | No classmate activity or homework submission; markers are separate from the child's account. |
| Administrator | School activity, including retained archived/transferred pupil history, and currently permitted review actions. | Historical entries do not grant a new review right. |

The modern inbox supports text/type/class/pupil/read/action filters, Bulgaria-local date groups, exact-pupil links and bulk marking of the currently displayed unread snapshot. Its latest-200 counters describe the permitted window. Markers are encrypted per account/school with directory guards and concurrent merge/retry behavior. It uses manual refresh and sends no push/email. 599 isolated route checks pass, including 77 new inbox checks; TypeScript/build validate the source. New browser visual QA was unavailable.

## October 9 additions

| Role | Versioned teacher worksheets | Boundary |
| --- | --- | --- |
| Teacher author | Add new files, keep/exclude current files, undo exclusions before save, inspect earlier conditions/files and private draft versions. | Current class scope and author rights are required; assigned colleagues read published versions only. File limits combine retained and new selections. |
| Student | Read current published worksheets and earlier published task versions; each hand-in retains the worksheet version used. | After transfer, only worksheets retained in the student's own hand-ins remain available. |
| Parent | Read linked-child class worksheets and retained files beside the child's submitted condition. | No upload; transfers remove new old-class worksheets and broad task history. |
| Administrator | Manage task files and read all retained school versions, including drafts. | Retention/deletion administration remains future work; excluding a file does not erase historical bytes. |

522 isolated route checks pass, including 78 new teacher-file checks. The new editor and history were not visually checked in a browser this run; earlier responsive checks remain historical evidence.

## October 8 additions

| Role | Connected homework files | Boundary |
| --- | --- | --- |
| Student | File picker, image capture input, size/count limits, removal, text/file-only hand-ins and preserved files for every revision. | Up to three files, 10 MiB each and 20 MiB combined; selected files are temporary until hand-in. Native camera capture is not device-tested. |
| Teacher | Download files beside the answer and its retained conditions/reviews. | Current assigned-class answer visibility governs downloads; transfer removes former-teacher access to pupil files. Teacher task attachments were added on October 9 above. |
| Parent | Download only their linked child's submitted files, including retained historical work after transfer. | Read-only; no upload or classmate access. |
| Administrator | Download school work files, including retained archived/transferred history. | No file deletion, retention manager or operational cleanup job yet. |

The server encrypts file bytes in the school namespace, verifies size/digests on download and excludes storage keys from views. Basic format checks do not provide malware scanning or full content validity. 444 isolated route checks cover the application workflows; phone-width review uses fictional read-only records.

## October 7 additions

| Role | Connected class homework | Boundary |
| --- | --- | --- |
| Teacher | Assigned-class drafts and publication; own assignment editing, archive/restore, text-answer review, explicit criterion points and revision guidance. | Published colleague work is read-only. Permissions are checked on the server and again inside writes. No official grade is created. |
| Student | Own class homework, text hand-in, AI-use declaration, original conditions, feedback and retained revisions. | Identity is derived from membership. An answer awaiting review cannot be overwritten. Submission files were added in the October 8 stage above. |
| Parent | Only linked children's published work, answers and review history, including preserved hand-ins after a class transfer. | Read-only. No classmates' answers or teacher/student actions. |
| Administrator | All school assignments, task lifecycle and active-class reviews; historical answers for archived/transferred pupils. | Historical answers outside the original active class are read-only. |
| Applicant or suspended member | School-account status and link back to the access workspace. | No class assignments or answers. |

Details: [class homework access](CLASSWORK_ACCESS.md). Browser review uses fictional read-only profiles; isolated route tests exercise authenticated identities and changes.

## October 6 additions

| Role | School workspace | Boundary |
| --- | --- | --- |
| Administrator | Empty school setup, classes, numbered pupil profiles, transfers/archive/restore, CSV import preview/export, approval queue, explicit class/pupil links, suspension/restoration and audit. | Creating a school does not verify institutional authority. Access approval requires a school verification process. |
| Teacher | Assigned class lists and their active pupils. | Directory read/export only; existing teaching modules are still a separate demonstration. |
| Parent | Only linked children and their class information. | Links require administrator approval; existing parent grade/document views are not migrated. |
| Student | Only the linked pupil profile and class. | One active student account per pupil; learning modules are not yet linked. |
| Applicant | Their pending/withdrawn/rejected request and communicated decision. | A school code submits a request and grants no roster access. |

Details and limits: [school access design](SCHOOL_ACCESS.md). No real accounts were enrolled and the private Site audience was unchanged.

## October 5 additions

| Role | New working surfaces | Boundary |
| --- | --- | --- |
| Student | Full learning profile, explicit learning preferences, evidence-based badges, three five-question practice banks, searchable library, source-based reading layouts and narrated slides. | Authored content and device speech work without an AI provider. No independently trained student model or inferred learning diagnosis. |
| Teacher | Current/term/annual grades, one-attempt class tests, explicit approval of result-to-grade conversion, lesson topics/classroom links, material publication, praise/remarks and substitution view. | Saved test scores are server-computed; official grade entry requires an explicit teacher action. School assessment rules and real staff authorization remain pending. |
| Parent | Weekly recorded-activity overview, child's full profile, fee declarations and school verification status, replacement teachers in timetable. | Summary is calculated from records, not AI inference. A declaration does not prove or process payment. |
| Administrator | Class fee creation, confirmation/reopening with history, date-based absences, replacement assignment/release/cancellation, updated notices and CSV reports. | Conflicts cover the demonstration class, not a complete school timetable. Real payment, identity and national integrations are not connected. |

The [specification mapping](SPECIFICATION_MAPPING.md) records remaining items from the supplied document. The earlier tables below describe the underlying workflows; the additions above extend their current status.

## Role flows

| Role | Implemented workflow | Important boundary |
| --- | --- | --- |
| Student | Dashboard → assignment and criteria → text/file submission and AI-use declaration → feedback, points or revision → preserved work history. Authored lessons, learning preferences, practice tests, notes and planner. | Personalization uses an editable profile and practice records. It does not train an independent model. Live AI is disconnected. |
| Teacher | Review queue → full-page work/feedback desk → rubric points or return with guidance → review history; roster → student → grade entry or reasoned correction; weekly timetable editing, class attendance and parent-explanation review; authored lesson templates and structured tests. | Rubric and test results are evidence, not automatic gradebook entries. Grade entry remains manual. Staff lesson previews do not write student attempts. |
| Parent | Child summary → grades/attendance → absence explanation → teacher decision; read-only timetable; homework answers, feedback, criteria and history; document → review → typed acknowledgment receipt; demo classroom conversation. | Acknowledgment is not a qualified electronic signature. There is one fictional child; real guardian verification is pending. Parent views have no homework or test submission controls. |
| Administrator | School summary → records/reports, document requests, calendar and audit; integration states; editable device-policy drafts. | No real national-system synchronization, enrolled devices or policy enforcement. |

## Detailed feature status

| Feature | Available now | Next required stage |
| --- | --- | --- |
| Navigation and search | Role-specific grouped menus, global record search, actionable notices, mobile drawer, visible loading/empty/error states. | Real-role navigation driven by verified school memberships. |
| Gradebook | School-connected current/term/annual grades with role/class/pupil scope, family subject views, author/admin corrections, feedback and exact annulment/restoration history. The earlier term/annual demo stays separate. | Official assessment rules, subject assignments, official absence rules, year lifecycle, year closure and national reporting. |
| Attendance | Connected lesson/roster snapshots, author/admin marking, linked-family history and explanations, private reviewed decisions, reasoned correction, cancel/restore and scoped CSV. Exact receipts and directory/target/ledger guards protect writes. | Official timetable/absence rules, school policy, medical/attached notes, year lifecycle, retention and national synchronization. |
| Timetable | Editable week for one demo class; lesson times, teacher/room details, overlap checks, protected past/recorded lessons; responsive daily view and CSV. | Multi-class/teacher/room conflict resolution, official calendar and term templates. |
| Homework | School-scoped class drafts/publication, versioned teacher worksheets, text/file hand-ins, current-membership downloads, linked-child reading, author/admin reviews, preserved conditions/files/history and connected activity with personal read states. Separate owner demonstration has a CSV review queue. | Deadlines policy, external delivery notifications, retention/reconciliation and evaluated AI assistance. |
| Tests and practice | Connected lesson practice uses actual school membership, authored questions, exact source/question editions, weighted scoring, original-result/explanation history and current-pupil analysis. The earlier one-attempt test/grade-conversion module remains an owner demo. | Curriculum/rubric evaluation, secure examinations and migration of the official test workflow. |
| AI integrity | AI-use declaration and teacher-requested clarification. No fabricated detector probabilities or automatic penalties. | Evaluate any future signal with error rates and a meaningful appeal process. |
| Personal tutor | Authored interactive lessons, preference-based explanations, practice history and a server AI adapter. | Authorized provider configuration, teacher evaluation and approved source retrieval. |
| Books and video | Editable teaching/book/video-script templates and browser read-aloud. | Licensed curriculum sources, evaluated generation, media rendering, captions and accessible exports. |
| Learning evidence | Practice portfolio and reports with concrete completed-work results. | Teacher-reviewed recommendations using explicit mastery criteria. No poor grade from inactivity or missing telemetry. |
| Classroom notes | Text/photo/file notes and upload timestamps. | Optional teacher checkpoints. A photo cannot prove when handwriting was produced. |
| Calendar | Combined homework, tests, documents and school events; filters, edits/cancellation and ICS export. | Authoritative school calendar administration and timetable/event coordination. |
| Planner | Role-scoped personal tasks, due dates, completion and restoration. | Real-account ownership after school identity work. |
| Messages | Searchable demo rooms, persistent in-workspace messages, temporary session drafts and mobile thread navigation. | Verified recipients, delivery channels, permissions and safeguarding workflows. |
| Documents | Searchable register; saved drafts, preview and explicit issue; encrypted attachments; exact-version parent acknowledgment; replacement history, withdrawal reasons, timeline and exports. Separate drafts preserve the current parent view. | Verified guardians and staff, multi-recipient distribution, delivery channels, signature-provider integration, retention and appropriate document rules. |
| Reports | Subject/period filters, class/personal results, attendance and audit; CSV export with formula-prefix protection. | Authoritative school reports and national-format exports. |
| NEISPUO | Explicit disconnected status and official-resource link. | Approved specification, credentials, mappings, authorized test environment, reconciliation and operational monitoring. |
| Mobile | Responsive web interface checked at phone and tablet widths. | Separate iOS/Android distribution and device-level testing. |
| School computers | Persistent policy drafts for learning/exam/free modes. | Signed operating-system images/agents, enrollment, enforcement, updates, recovery and supervised exam evaluation. |
| Encryption | Owner-scoped AES-256-GCM demonstration payloads/files and separately encrypted directory/homework/lesson/checkpoint records with membership authorization; homework downloads verify size and SHA-256. | Migrate remaining learning/file access to school tenancy; backup/restore, key lifecycle, retention and operational review. |

## Staged continuation

1. **School workflow migration:** extend the implemented directory memberships and class/pupil links to attendance, term/annual grades, profiles, messaging and documents; validate institutional and guardian-verification procedures.
2. **Teaching pilot:** approved Bulgarian curriculum resources, connected AI and measured quality; evaluate the implemented rubrics and review workflows with teachers.
3. **Official administration:** authorized NEISPUO integration, document/signature provider, required school registers and reliable import/export.
4. **Managed devices and native mobile:** enrollment, signed agents, policy enforcement, recovery and device testing.

The production stages require institutional access and provider configuration. This release does not represent those dependencies as completed features.
