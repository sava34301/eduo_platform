# Eduo — product concept and implementation, v21

Research refreshed: 13 October 2026. Latest release: encrypted school document attachments and immutable edition files, 18 October 2026.

## Product
A Bulgarian school platform connecting students, teachers, parents and administrators. Each learner has an editable learning profile, a personal practice history and an educational assistant context. Personalization means explanations and support can change; assessment criteria remain explicit and teacher controlled.

This repository implements a web pilot with a public Site audience and protected authenticated records. The School workspace, connected homework/inbox, class lesson library, practice, current/term/annual-grade journal, attendance and documents with encrypted attachments use approved school memberships and server-enforced class/pupil/recipient access. Original profile, practice, gradebook, file registry, messaging and file-document modules remain account-isolated demonstrations; their role selector is not authorization between real people. Institutional verification, remaining module migration, retention and operational review remain necessary before real-school use.

## October 18 — encrypted school document attachments, v21

Connected school documents now support up to three encrypted PDF/DOCX/TXT/image files per version, with ten MiB per file and twenty MiB combined. Authors retain/remove current draft files and add uploads; issue freezes the file list. Parents download only their addressed editions. Replacement and withdrawal retain earlier files and signatures, while excluded families receive no new attachment metadata or bytes.

New `eduo-school-document-v2` fingerprints bind ordered file metadata and actual byte hashes; existing v1 hashes/receipts stay unchanged. Signing requires the displayed file list and verifies saved bytes before committing. Download permissions are checked before storage access and again after decryption. Missing/tampered objects, changed rights and stale draft selectors are refused.

The interface adds file selection/restoration, saved-version downloads with inline retry errors, counts/history, file-aware confirmations and attachment metadata in printable copies. Lost upload responses recover original file identities; cleanup preserves any referenced history and defers when saved state is uncertain. Full retention/orphan cleanup, official forms and provider signing remain future work.

All **1,599** workflow checks pass, including 106 new actual-route attachment checks. TypeScript and the production Worker build are release checks; browser/hardware and real school/provider sessions remain unverified. See [attachment access, recovery and limits](SCHOOL_DOCUMENT_FILES.md).

## October 17 — school documents and parent signatures, v20

**Училищни документи** adds text-only drafts, saved-version review, explicit issue to every approved parent of selected pupils, separate parent/child requests, drawn signing or required read acknowledgment, encrypted immutable receipts, completion tracking, replacement/discard/withdrawal and printable signed copies. The existing file-document demo remains separate. Signature-provider integration and school attachments remain future stages.

Actual school roles govern this workspace. Only the author for an assigned current class or an administrator manages it; colleagues cannot read another author's document. A parent sees only personally addressed editions for linked active children. Other parents and siblings have independent receipts. Transfers, unlinking, suspension, archive and year changes restrict reading/signing, while administrators retain authorized history. A family excluded from a replacement receives no new title, body or recipient identities.

School-scoped encryption and conditional directory/document/ledger writes protect creation, issue and receipts. Receipt storage uses a separate namespace. Exact retry recovery preserves original versions and recipient IDs; no old signature carries into a replacement. Parent inbox items deep-link the document and child, and only eligible unsigned own requests need action. Data, strokes and other families' identities are excluded from notices.

All 1,493 checks pass, including 107 new document route/service checks and two actual request-helper envelope checks. TypeScript and the Worker build are release checks; browser/touch and real school/provider sessions remain unverified. Existing public Site sharing is preserved; school content stays membership-scoped. See [school document rules](SCHOOL_DOCUMENT_ACCESS.md).

## October 16 — screen-drawn signatures and two signing paths, v19

The user's clarification establishes two options: drawing directly on screen and, separately, electronic signing through a provider. The document demo now defaults to screen drawing with mouse/touch/pen, undo/clear controls, name and explicit version confirmation. Typed read acknowledgment remains available independently, including keyboard-only use. The provider option is visibly pending and refused by the server until connected.

The bounded drawing is stored inside the encrypted document record with a server timestamp, exact document version/content fingerprint, drawing SHA-256 and bound receipt SHA-256. Competing writes, changed-method/drawing retries and stale versions cannot replace existing evidence. Exact retries recover the original receipt. Replacement publication retains the earlier drawing in history and clears signing evidence from the new version. Printable, self-contained signed copies escape document text and render only validated numeric strokes.

Workspace writes now enforce same-origin JSON, a 128,000-byte streamed limit and private no-store responses. Document history growth is refused without truncation at the serialized record bound. Seventy actual-route signature checks extend the complete suite to 1,384. TypeScript passes; a production Worker build is required for publication. Browser interaction/hardware QA remains unavailable.

This remains the account-owned document demonstration with fictional recipients. School document permissions, real guardians, multiple recipients and provider delivery remain separate stages. The [signing scope](DOCUMENT_SIGNING.md) records the clarification, evidence formats and implementation boundaries.

## October 15 — term/annual decisions and complete PDF scope, v18

- The full 22-page updated specification is mapped by page and requirement in [complete traceability](COMPLETE_SPECIFICATION_TRACEABILITY.md). All 40 image entries and nine original concept entries are preserved; 13 additional PDF areas expand the searchable catalogue to 62 modules. Another demo's “built” claims, licences, official approvals or backend are not treated as this platform's readiness.
- **Дневник на класа** supports current, first/second-term and annual decisions. Summary values are explicit teacher input and excluded from current-grade means. One encrypted pupil/year/normalized-subject/period reservation prevents duplicates even across class transfers. Annulment releases a slot; replacement and blocked conflicting restoration keep old history intact. Index/target/directory/capacity/audit writes are atomic and exact old receipts remain compatible.
- **Училищни входящи** retains its stable URL and personal read state while adding grade versions, significant attendance changes and permitted explanation decisions to homework activity. Exact grade/lesson/pupil links, additional type filters, today/yesterday groups and last-loaded navigation counts are present. Private feedback, notes, explanation bodies and review reasons never enter the feed. Action state follows the latest relevant request and current permissions; corrections/cancel/restore do not resurrect an old returned action.
- Attendance review now distinguishes explicit refusal from a returned clarification request. Refusal preserves the absence and exact submitted/reviewed history. New source record revisions disambiguate identical timestamps. Refreshed grade forms keep drafts while using latest account/pupil/grade eligibility and resetting confirmation.
- All 1,314 isolated checks pass: 63 new summary-grade checks and 59 combined-activity checks extend the earlier 1,192. TypeScript passes; the release requires a production Worker build. Browser visual/interactive QA and actual school/provider/device operations remain unverified. Private access is preserved.

See [grade journal rules](SCHOOL_GRADEBOOK_ACCESS.md), [school activity scope](SCHOOL_ACTIVITY_ACCESS.md) and [full document checklist](COMPLETE_SPECIFICATION_TRACEABILITY.md). Subject-level assignments, separate director/admin authority, complete profiles, remaining administrative modules, exact Onest/dark/bottom-navigation design, provider/licensed integrations and operational launch conditions remain staged work.

## October 13 — connected attendance and reference scope, v17

- **Присъствия на класа** records human-confirmed lessons by class/date/period and snapshots the active roster as unmarked. Teacher roster controls preserve explicit choices; known-state corrections need reasons. Lesson edits/cancel/restore and pupil timelines keep earlier states.
- Linked parents explain only their child's absent record. Submissions stay pending; the lesson author or administrator approves or returns them explicitly. Parents can withdraw their own pending explanation. Colleagues read attendance without private explanation text. Family history follows approved links after transfer; administrators can finish pending transferred/archived pupil explanations without rewriting the original roster.
- Encrypted target/directory/ledger guards and atomic audits protect competing writes. Exact receipts recover accepted operations after a lost response without reverting later work. History/byte/action limits reserve capacity for accepted pending reviews. Draft refresh keeps fields and sparse roster choices while resetting confirmation; unavailable pupil changes are identified explicitly.
- **Модули на Eduo** incorporates all four newly supplied images: 40 distinct requested capabilities plus nine retained concept modules. Search, category/role/status filters, current/remaining details, valid workspace links and filtered CSV make the scope reviewable. Connected pilot parts, working demos, unfinished modules, provider-dependent work and human-delivered services are labeled separately. This catalogue does not implement every future module or acquire other vendors' content/services.
- Connected workspaces and the catalogue render independently of the older demo workspace's loading/error state. All 1,192 workflow checks pass, including 135 attendance checks and two new actual API-envelope checks. TypeScript passes; the release requires a production build. Browser visual/interactive QA, actual school operations and external providers remain unverified.

See [attendance access](SCHOOL_ATTENDANCE_ACCESS.md) and [reference requirement mapping and delivery stages](REFERENCE_FEATURE_SCOPE.md). Official absence rules, multi-class timetable, specialized registers, national exchange, actual payments/signatures, native apps and managed OS are further stages. The existing private audience is preserved.

## October 12 — school-connected current-grade journal, v16

- **Дневник на класа** uses approved memberships: assigned teachers record current grades, students read their own grades, parents select linked children and administrators inspect school history. The modern teacher roster/subject matrix, all-record view and family subject cards share class/subject/term/year/search/status filters, exact grade links and filtered CSV export.
- Confirmed human entry captures the value, subject, assessment type, date, term and feedback. Author/admin corrections need a reason and preserve every prior version. Annulment and explicit restoration change the informational mean without erasing history. Means do not determine term/annual grades. No AI or practice score creates a grade automatically.
- Original-class history follows a transferred pupil's authorized family link; former/new class teachers cannot read unrelated old-class grades. Suspended accounts and removed links lose access. Administrators retain archived/transferred/earlier-year history as read-only. Grade views redact account IDs and retry receipts.
- Encrypted target/directory/ledger guards, atomic audit/capacity changes and exact actor/content receipts protect competing writes and lost responses. An unconfirmed write is labeled honestly; explicit retries recover without duplication. Editors preserve current fields, refresh their base without replacing the draft and reset confirmation. Capacity limits preserve existing records and history.
- All 1,055 isolated workflow checks pass, including 126 new gradebook checks and two new actual API-envelope checks. TypeScript and the production build validate integration. Browser visual/interactive QA and real-school/provider operation were not verified. The private audience is preserved.

See [gradebook access and storage](SCHOOL_GRADEBOOK_ACCESS.md). This is a current-grade pilot: attendance, official assessment/year-closure rules, term/annual records and authorized national exchange remain later stages.

## October 11 — private-preview request recovery, v15

- The private preview's HTML sign-in/error pages are checked before JSON parsing across every client API path, including connected school pages, edits, uploads and the tutor. Empty/malformed/wrong data cannot reach rendering or confirm a save; JSON validation, access and conflict messages remain specific.
- Missing sign-in has a Bulgarian recovery screen and normal top-level ChatGPT sign-in link. A separate published-Site link preserves the current school/lesson/practice/pupil section while leaving preview-host query parameters behind. Existing membership enforcement and the private audience remain unchanged.
- Multipart uploads keep their browser-generated boundary. Failed requests retain current editor inputs, and unconfirmed writes ask the user to check saved work before trying again; no automatic write retry or fictional success is introduced.
- All 927 isolated checks pass, including 87 response/recovery regressions. TypeScript and the production build validate the source. Direct HTTP diagnostics reproduced the missing-session HTML response; the user's embedded browser session and visual interactions were not independently verified.

## October 11 — school-connected lesson practice, v14

- A modern **Упражнения за класа** workspace connects teacher-authored practice to published lessons and approved school roles. Authors create private drafts, reorder questions/options, add weights and explanations, preview the key, publish explicitly and archive/restore. Class/subject/status/search filters and lesson links connect the reader to practice.
- Students answer one question at a time or jump between questions, track selected answers, add an optional reflection and explicitly submit. The server derives the pupil, checks every choice and calculates weighted points. Keys and explanations are released with that pupil's completed attempt; parents read linked-child results only. New attempts preserve all earlier choices and results. There is no automatic official grade or understanding checkpoint.
- Each practice edition captures the full source lesson, questions, keys and explanations. Changed source/question/key content creates a new edition on author save; earlier attempts stay unchanged. A newer lesson is identified without silently replacing the captured practice source. Teacher analysis uses one latest current-edition attempt per current active pupil, with authorized individual history for staff/families.
- Transferred families retain only their completed old-class snapshots; new old-class text, titles and explanations stay withheld. Former teachers lose transferred/archived pupil history. Encryption, target/directory/source guards, strict scoring inputs and exact retry receipts preserve saved records and audit consistency. Failed editor input can be refreshed explicitly without losing questions.
- All 840 isolated workflow checks pass, including 137 new practice checks. TypeScript and the production build validate the source. Managed browser visual QA was unavailable; no live school or provider was exercised. The existing owner-private audience is preserved.

See [practice access and storage](SCHOOL_PRACTICE_ACCESS.md). This is authored formative practice with repeated attempts; live generation, secure examinations, licensed curriculum review and migration of the remaining demo modules are later stages.

## October 11 — school-connected lesson library, v13

- The modern **Библиотека на класа** workspace connects teacher materials to actual assigned classes. Authors/admins create private drafts, publish explicitly, edit with retained source versions and archive/restore. Assigned colleagues can read published material without author editing rights. Subject/class/status/text filters and deep lesson links serve all four roles.
- A full-page reader preserves the source text in full-text, short-section and slide layouts, with attribution and an optional validated HTTPS link. These layouts do not generate new explanations or video. The editor previews the text, keeps unsuccessful edits in page memory and disables in-flight actions.
- Students explicitly save a read/understanding/help checkpoint under their authenticated pupil identity. Teachers see currently permitted pupils' declared status; parents see linked children only. The record is a self-report, not mastery evidence or an official grade; opening the page creates no learning event and missing records infer no lack of effort.
- Each checkpoint keeps its source edition. Changed source text creates a new content edition, so earlier self-reports remain historical rather than claiming understanding of new content. Publication and archive/restore leave the edition unchanged. Transfer retains that child's recorded source snapshots without revealing new old-class content; former teachers lose the transferred pupil history.
- Encrypted school records, directory/source dependency guards, record revision checks and exact save/checkpoint receipts protect history across stale forms, concurrent writes and lost responses. The connected library reuses existing storage and adds no schema migration or provider secret.
- All 703 isolated workflow checks pass, including 104 new library checks. TypeScript and the production build validate the source. Managed browser visual QA was unavailable for this release; earlier responsive reviews describe earlier versions.

See [lesson access and storage](SCHOOL_LEARNING_ACCESS.md). The original learning demos remain separate, and live AI, NEISPUO, external delivery and signature providers remain disconnected. Private sharing is preserved; no real school accounts were enrolled.

## October 9 — connected homework inbox, v12

- A dedicated modern **Входящи за класа** workspace shows saved publications, changed instructions, submissions, feedback, revision requests and archive/restore activity. Day groups use Bulgaria-local time; search and type/class/pupil/read/action filters apply to the permitted entries. Links select the relevant task and authorized pupil.
- The actual school membership defines every role's view. Parent entries cover linked children only; transfer removes new old-class announcements while preserving that child's earlier work activity. Teachers lose transferred/archived pupil work; administrators retain authorized historical views. Entry previews omit answer/feedback text, scores, AI declarations and file metadata.
- Personal read/unread markers persist encrypted for each account and school. A bulk action covers the displayed snapshot, so later activity stays unread. Directory guards and compare-and-swap merges prevent revoked access and lost concurrent marker updates. Exact retries recover saved state after a lost response without another write.
- Outstanding work follows the latest attempt/review and current permissions, independently of read markers. Reading never completes a task or records a grade. The feed derives from saved history and is not proof of delivery or receipt. It uses manual refresh, a latest-200 authorized window and a 2,000-marker pilot capacity; no email or push is sent.
- All 599 isolated route checks pass, including 77 new inbox checks. TypeScript and the production build validate the changed source. Managed browser visual QA was unavailable for this release; earlier screenshots are evidence for their earlier versions only.

Other original modules keep their demonstration boundaries. Live AI, NEISPUO, external notification delivery and signature providers remain disconnected. No real school identities were enrolled, and the private Site audience is unchanged.

## October 9 — teacher worksheets and assignment versions

- The author or school administrator can attach worksheets and lesson documents to a task. The editor distinguishes saved files from new selections, lets staff exclude a saved file from the next version and restore it before saving, and shares the three-file/10 MiB each/20 MiB total limit across retained and new files. New uploads happen only on save. Save controls and editor fields are disabled while the request is pending.
- Every save and publication/archive/restore transition retains the preceding instructions, criteria and file references. The record permits 40 earlier versions and rejects capacity overflow without truncating history. Task detail exposes readable version history; students, parents and assigned colleagues see published versions only, while authors and administrators can inspect authorized drafts.
- Each future hand-in snapshots the task's current file metadata with its original condition. Replacing or excluding a worksheet leaves older submissions and historical downloads intact. Existing submissions without worksheet snapshots are preserved as they are; no content is backfilled into earlier work.
- Worksheet downloads check current school membership, class scope and the requested task version. Current-class families can read published materials. A transferred child and linked parent can read only worksheet versions retained in their own hand-ins, without seeing new files or the broader history of the former class. Draft versions remain private even when their file is later published.
- Stable save identifiers and fingerprints preserve exact file-save retries, including retries after later edits, without duplicating uploads, reverting the task or adding audit events. Concurrent edits, membership changes and storage failures preserve committed files and clean only new unlinked objects when commit state is known.
- The release passes 522 isolated route checks, including 78 new assignment-file checks. New browser visual QA was unavailable in this run; earlier visual checks remain dated evidence, not a certification of the new editor. TypeScript and the production build validate the changed application.

This v11 release added teacher task attachments to the school-connected workflow. Its connected inbox followed in v12 above. Live AI and national integrations remain future stages. Other original modules retain their demonstration boundaries. No real school accounts were enrolled and the Site audience is unchanged.

## October 8 — files connected to school homework

- Students can hand in text, files or both under their approved pupil account. The modern homework form offers a file picker and an image capture input, selected-file sizes and removal. A hand-in accepts up to three PDF, DOCX, TXT, JPG, PNG or WebP files, at most 10 MiB each and 20 MiB combined. File selections stay in page memory until submission; a failed save retains the inputs.
- Every submitted version keeps its encrypted files beside the answer, original task conditions and reviews. A revision uses a new file selection and retains the earlier files in history. Exact retries compare the saved byte digests and preserve the original hand-in without duplicate uploads or audit entries.
- Teachers, pupils, linked parents and administrators download files through current school membership and the existing answer-visibility rules. A former teacher loses access after a pupil transfer; the child and linked parent retain their own historical work. Internal storage keys are omitted from responses. Downloads verify the saved size and SHA-256 digest and use attachment disposition, private cache controls and nosniff.
- The server bounds the multipart request body, validates the whole selection before storage and checks basic file signatures or DOCX container entries. These checks do not provide malware scanning or certify full document/image validity. Files are downloaded, not rendered inline or sent to AI.
- Encrypted blob storage precedes the guarded submission transaction. Failed requests clean up only their new, unlinked uploads. An ambiguous database result preserves files referenced by a committed submission; an unavailable commit check defers cleanup. Retention and an operational cleanup job remain future work.
- Desktop file selection/removal and a fictional sample download were verified. Student controls and teacher/parent download cards fit a 320-pixel responsive browser layout. Native camera behavior and native mobile devices have not been tested. The release passes 444 isolated route checks.

This extended the October 7 text workflow without migrating the earlier owner-private file registry. Teacher task attachments were subsequently added on October 9 above. Notifications, official grades, live AI and national integrations remain separate stages. No real school accounts were enrolled and Site sharing is unchanged. See [class homework access](CLASSWORK_ACCESS.md) and [validation](VALIDATION.md).

## October 7 — homework connected to school accounts

- The new **Домашни за класа** workspace derives its account and permissions from approved school membership. Teachers create drafts for assigned classes and explicitly publish, archive or restore them. Students and parents cannot see staff drafts. An assigned colleague can read published work; the author or an administrator manages the task and its reviews.
- A student submits a text answer under their own stable pupil ID and declares AI assistance. The server selects that pupil rather than trusting a client identity. Pending work cannot be overwritten. A teacher can complete a rubric review or return it with guidance; a revision preserves every earlier answer and review.
- Each hand-in retains the instructions, deadline and criteria in effect at submission. Later assignment edits apply to future work. Points are computed from validated criterion entries on the server and never add a grade to the official gradebook. Missing work is not interpreted as low effort.
- Parents read only their linked children's answers and feedback. After a class transfer, the child and linked parent retain access to the child's submitted work, while the former teacher loses access to that pupil's answers. Administrators can inspect historical work for transferred or archived pupils; those historical answers cannot receive new reviews outside the original active class.
- Saves guard the school directory revision, target record and assignment dependency inside the same transaction as the encrypted record and school audit entry. Concurrent permission changes, archive actions and stale reviews cannot silently overwrite saved work. Exact request retries preserve the original hand-in or review.
- Desktop panels place the class roster beside the work and feedback. Phones stack those panels; long task forms scroll internally. Lists support class, status and text filters; detail URLs identify the selected school and assignment.

The October 7 stage initially accepted text only; the October 8 release above adds submission files. Official grades, notifications and live AI are not migrated into connected homework. The earlier owner-private homework demonstration remains separate. No real school accounts were enrolled and Site sharing remains unchanged.

## October 6 — school directory and approved account access

- A signed-in account can create an empty school environment with a name, town and school year. This creates a separate directory; it does not verify that the person represents an institution or populate the existing demonstration modules.
- Administrators create classes and numbered pupil profiles, move pupils between classes, and archive or restore records. Linked active accounts and duplicate class numbers are checked before changes. CSV import previews up to 100 rows and commits the entire batch or none; export contains only the caller's visible roster.
- A school code submits an access request. It never grants membership. Administrators review the applicant, record their verification basis, select a role, and explicitly assign classes or pupil links. Teacher views contain assigned classes only; parents see linked children only; students see their linked profile only.
- Administrators can change another member's scope or suspend/restore access. Self-demotion and self-suspension are blocked. Restoration revalidates the saved links. A pupil has at most one active student account.
- The server derives identity from platform-authenticated headers and membership from the encrypted school directory. A client-supplied role, name, email, school ID or join code cannot bypass membership checks. Pending, rejected, withdrawn and suspended accounts receive no roster data.
- The directory, its audit entry and discovery indexes commit together with a revision guard. Stale changes cannot overwrite newer membership decisions. School data uses a separate encrypted namespace without modifying earlier owner records.
- School-code rotation stops new requests using the old code and preserves existing memberships. Site sharing is unchanged: applicants must separately be permitted to open the private Site. The platform sends no external invitations.

See [school access design](SCHOOL_ACCESS.md) for scopes, limits and the remaining migration boundary.

## Research that informed the product

| Official source | Observed baseline | Product decision |
| --- | --- | --- |
| [Shkolo features](https://www.shkolo.bg/features/) and [school software](https://www.shkolo.bg/uchilishten-softuer/) | Digital gradebook, attendance, homework/tests, learning materials, communication, calendar, mobile apps; describes NEISPUO integration. | Make daily school work first-class. AI support belongs beside those workflows. |
| [AdminPlus official product site](https://www.adminplus.bg/) and [official support catalogue](https://dogovori.adminplus.bg/Questions) | Gradebook, student profile, reports, protocols, school documentation and administrative modules. | Add documents, review history, teacher controls and explicit integration status. |
| [Digitalna Ranitsa](https://edu.mon.bg/) and [MON announcement](https://www.mon.bg/news/balgariya-i-velikobritaniya-sthe-si-satrudnichat-v-oblastta-na-obrazovatelnite-tehnologii/) | Digital educational content for students, teachers and parents through individual educational accounts. | Keep a learning library and link to the official service without claiming content licensing or connected identities. |

These observations are from public product materials; they are not an exhaustive audit of every subscription, deployment or recently added AI capability. Eduo does not claim these products lack AI. Links to other platforms are external resources, not active technical integrations.

## September 28 campus redesign

The application now has a white grouped sidebar, blue action accents, self-hosted Bulgarian-capable Golos typography, a quieter page hierarchy and responsive role-specific working surfaces. The design direction draws on [Linear’s March 2026 design refresh](https://linear.app/now/behind-the-latest-design-refresh): clearer navigation, consistent controls and task-focused content. No competitor assets or source code were copied.

| Role | First screen and primary actions |
| --- | --- |
| Student | Upcoming homework, next learning topic, authored practice progress, subject library, real timetable and personal planner. |
| Teacher | Submission review queue, class roster, attendance and gradebook shortcuts, assessment feedback, lesson preparation. |
| Parent | Child overview, latest grades, attendance, homework, documents awaiting acknowledgment and a classroom conversation shortcut. |
| Administrator | School records, document queue, recent record changes, calendar and explicit connection states for external services. |

Classroom profiles support student search, CSV export and preselected grade entry. Grade corrections require a reason and preserve earlier values. Attendance can be reset to unmarked. Personal tasks, notes and notification read markers are scoped to the selected demonstration role. Parent screens do not offer student test submission, and staff lesson previews do not create student practice records. This presentation scoping is not a school authorization boundary.

Messages use a responsive conversation list and thread view, content search, mobile back navigation, and per-role/thread session-only drafts. Server-saved messages remain within the private pilot; they do not contact real recipients. Notifications open the related record. Device-local density and reduced-motion preferences apply to every role.

See [role and feature review](ROLE_AND_FEATURE_REVIEW.md) for implementation boundaries and staged production work.

## October 5 — specification expansion across all four roles

The attached **Eduo — Complete Platform Specification** informed this update. Its product workflows are incorporated into the existing application; artifact and GitHub setup instructions are excluded. See [specification mapping](SPECIFICATION_MAPPING.md) for implemented features and remaining dependencies.

- **Learning profile:** a full student page combines current/term/annual grades, attendance, homework punctuality, practice history, teacher remarks and earned achievements. Six explicit learning preferences can be selected or removed. Only enabled preferences are included in the tutor context when remembering is opted in. The system does not infer health, family circumstances or motivation from activity.
- **Practice and library:** three authored five-question banks use server scoring and post-submission explanations. A subject/search library combines authored lessons and published teacher materials. Readers can choose examples, steps or short sections, or navigate narrated slides. These are source-preserving layouts and device speech, not generated textbooks, videos or AI summaries. Audio is unavailable when the device has no Bulgarian voice.
- **Teacher assessment:** grade entry distinguishes current, first-term, second-term and annual grades. Terminal grades are unique by pupil, subject, academic year and period. Practice tests allow repeats; class tests enforce one submitted attempt and their due date on the server. A teacher may explicitly approve the displayed percentage-to-grade conversion once; it never happens automatically and does not grade engagement.
- **Lesson records:** scheduled lessons accept a topic, student guidance and optional HTTPS classroom link. Saved topics retain timetable context, revisions and earlier content. Staff can publish/unpublish saved learning materials; new materials begin as drafts and test answer templates remain staff-only in presentation.
- **Families:** a last-seven-days overview reports recorded results, attendance and upcoming work, with a text export. The fee register distinguishes a parent's declaration from a school's confirmation. Amounts use integer EUR cents; no payment is processed or card data collected.
- **Administration:** one class fee creates eight fictional pupil charges. Confirm/reopen actions preserve status history. Date-specific teacher absences create replacement slots; claim/release/cancel actions preserve history and check conflicts in the demonstration class. Timetables and daily cards display assigned replacements. Substitution notices open the affected date; staff reasons stay out of family presentation.
- **Notifications:** category filters and date groups cover grades, remarks, fees, replacements and school events alongside the earlier workflows. Notices remain inside the private workspace.

New revision-controlled workflows reject stale changes and keep audit entries with the guarded write. Existing encrypted records are retained. A one-time v7 seed adds explicitly fictional examples of a fee, praise, lesson and next-Monday replacement to existing owner workspaces as well as new workspaces. This remains a private demonstration with one class, one child/parent view and owner-level authentication; the role selector is not school authorization.

## October 2 — documents from draft to receipt

- The document workspace now has a searchable register, status/category filters, staff CSV export and a full-page reading view. Staff create a draft, attach encrypted files, preview the text and explicitly provide the saved version for parent review. Two editable authored templates help start routine information requests.
- A separate replacement draft leaves the currently issued document visible to the parent. Issuing that replacement preserves the earlier content, files, status and receipt in version history. Drafts remain out of the student/parent presentation; these filters do not replace real school authorization.
- Parent acknowledgment requires a name, explicit read confirmation and the version being reviewed. The server checks the version/fingerprint and creates a timestamped receipt. Repeated matching acknowledgments retain the original receipt. Changed or withdrawn versions cannot be acknowledged from an outdated form.
- Staff can withdraw a pending request with a required reason. Parents see the reason and no acknowledgment control. Document history retains issued versions and a timeline; copies include stored receipt details, and a staff register can be exported as CSV.
- The versioned SHA-256 format covers the document ID, title, category, deadline, content, version and attachment fingerprints. New uploads have byte digests; older attachments receive digests from their decrypted bytes when issued. Earlier content-only fingerprints and sample records remain clearly identified.
- Draft saves, issue, withdrawal and acknowledgment use guarded record writes with audit events in one transaction. Concurrent issue/acknowledgment cannot both claim the same revision. New document creation uses a retry identifier to avoid sequential duplicate drafts.

This remains one owner-private demonstration workspace with a fictional child and guardian. Requests and notices stay inside the workspace; no email or external message is sent. Acknowledgment is not a qualified electronic signature. Saved drafts persist; unsaved edits survive editor/preview and detail-tab switches only while the page remains open. Existing owner records are preserved; new fictional examples are seeded only for the anonymous preview and newly initialized workspaces.

## October 1 — homework review, criteria and version history

- A dedicated homework workspace replaces the assignment modal. Teachers see an oldest-first review queue, subject/search filters, archived work and CSV results. A full-page review desk places the student's answer beside feedback and criterion scoring on desktop, with stacked panels on phones.
- Teachers can define up to six criteria, each with guidance and an integer maximum, totaling no more than 100 points. Rubric edits apply to future hand-ins. Each submission stores the assignment and criteria as they were when handed in, so earlier work retains its original expectations.
- A completed rubric review requires feedback and valid points for every criterion. Staff can return a submission with guidance without assigning points. The server computes totals; these results never create an official grade automatically.
- Resubmitting retains the previous answer, attachments, feedback, scores and criteria. Repeated teacher reviews also retain their earlier decisions. Students and parents can inspect this history; parent homework views are read-only.
- Unsent student work and teacher review inputs survive switching tabs within the open detail page. Teacher review drafts also survive switching pupils there. These are temporary page drafts, not autosaved records across navigation or reload.
- Assignment edits, rubric changes, archive actions, hand-ins and reviews use revision checks. A hand-in additionally checks its assignment dependency inside the guarded write transaction, preventing submission against an assignment changed in the meantime. A rejected write does not add an audit event.

The new fictional fractions examples appear only in the anonymous preview and newly initialized workspaces. Existing owner workspaces are preserved. This remains a demonstration of role workflows, not school membership authorization. AI authorship detection and automatic grading are not introduced.

## September 30 — weekly timetables and absence review

- Teachers and administrators can edit subjects, teachers, rooms and lesson times for a selected week of the fictional 6. А class. A five-day desktop board becomes a day selector on smaller screens. Student and parent views are read-only; dashboards use the saved timetable. CSV export is available.
- Timetable validation rejects overlapping times, duplicate lesson slots, reversed time ranges, changes to past days and changes to lessons with marked attendance. Future weeks remain independent. Existing attendance retains a snapshot of its lesson details.
- Attendance includes a class roll, student/status/period history filters, CSV export and a teacher review queue. Counters count lessons, not days. Unmarked status allows correction without deleting the record.
- The demonstration parent can submit an explanation for their fictional child's absence or lateness. It remains pending until staff approve it or return it for clarification with a required note. Approval updates the attendance to excused. Manual corrections close the old explanation and preserve earlier events.
- Pending requests and decisions appear in the relevant role's notification center. These are in-workspace notices, not external messages.
- Timetable weeks and attendance records have revision checks. Each guarded record write and its audit entry share a D1 batch transaction. A stale write returns a conflict instead of overwriting a newer record; cross-record timetable/attendance operations are not a school-wide transaction.

This is still one owner-scoped demonstration workspace, not real school role authorization. Existing owner records are preserved. Two fictional attendance examples appear in the anonymous preview and newly initialized workspaces only. The update does not inject demonstration absences into existing workspaces.

## September 26 expansion (previous release)
- Redesigned the application around pending work, with a searchable workspace, responsive task panels, school timetable and learning library.
- Added a monthly calendar combining assignments, tests, document deadlines and editable school events. Events can be cancelled without erasing history. The ICS export creates all-day entries with Bulgaria-local event times in descriptions.
- Added structured draft/published tests with weighted questions, server scoring, per-question explanations, repeat practice attempts and teacher feedback. Published question sets remain immutable. Submission request IDs make sequential retries idempotent.
- Added personal planner tasks, completion and restoration, and editable notes.
- Added homework editing and reversible archive, retaining earlier submissions and preventing new submissions to archived work.
- Added progress reports with subject/period filters, attendance counts, audit history and CSV export that neutralizes spreadsheet formula prefixes.
- Existing encrypted workspaces receive the new sample modules once; earlier records are preserved.

The official [AdminPlus product page](https://www.adminplus.bg/) currently lists AI consultants alongside reports, calendars and administrative modules. Differentiation must rest on evaluated learning support and connected workflows, not a claim that competing platforms have no AI. [Shkolo's official list](https://www.shkolo.bg/features/) explicitly covers calendars and creating, assessing and tracking homework/tests. [Digitalna Ranitsa](https://edu.mon.bg/) remains an external educational resource; its client-rendered catalog was not audited or imported.

The new quiz workflows use the existing owner-scoped demonstration workspace. The role selector is not an access boundary. Full quiz keys can be opened by the authenticated owner in the editor; public workspace responses omit them. Demo sample content is authored locally. These are learning/practice tests, not secure examinations. No test score automatically becomes an official grade.

## Feature map

| Requirement | Implemented in this web pilot | Remaining production work |
| --- | --- | --- |
| Web + mobile + school OS | Responsive Bulgarian web application and saved device policy drafts. | Native mobile distribution, device agent, signed OS images, enrollment, updates, recovery and actual policy enforcement. |
| NEISPUO | Honest disconnected status and integration entry point. | Provider approval, current API contract, credentials, identifier mapping, validation, synchronization, conflict handling, retries and audit. |
| School administration | School creation, class/pupil directory, validated CSV import, approved membership, scoped roster access, connected homework/inbox and class lessons/checkpoints. Existing demo grades, attendance, timetable, events, messages and reports. | Migrate remaining learning/administrative records to school memberships, institutional verification, multi-class timetable administration, official reports and required registers. |
| Homework | Connected class drafts/publication, versioned teacher worksheets, text/file hand-ins, school-authorized encrypted downloads, teacher reviews/revisions, retained files/conditions/criteria and a membership-scoped activity inbox with personal read states. | Push/email delivery; deadlines policy, evaluated AI feedback, retention/reconciliation and validated integrity methods. |
| AI authorship checks | Explicit declaration of AI assistance; teacher-requested clarification; no fabricated detector confidence. | Any future signal must be validated, explain uncertainty, permit challenge and never be sole evidence of misconduct. |
| Personal agent | Persistent learning profile, preferences, exercise results; a server-side OpenAI Responses API adapter. | Connect an authorized API account and select a model; quality evaluation, multilingual curriculum grounding and data agreements. |
| Personalized books | Editable lesson, test and book templates for three demonstration topics. | Curriculum mapping, licensed official sources, reviewed generation at subject/grade scale. |
| Personalized video lessons | Editable video scripts and browser read-aloud of authored lessons. | A video/audio generation provider, rendering jobs, captions, credits and accessible exports. No video is generated in this version. |
| Merit recommendations | Practice portfolio with concrete correct/incorrect outcomes, visible to the demo teacher. | Validated mastery evidence, rubrics and optional teacher-reviewed assessment recommendations. No poor-grade recommendation from non-use. |
| Teacher tools | Editable lesson plans and materials; structured published practice tests, weighted scoring, detailed result review; homework rubrics and review history; manual grade entry. | Connected AI authoring, evaluated assessment recommendations and reviewed curriculum resources. |
| Classroom notes | Note text and photo/file upload, server upload time. | Optional witnessed capture or teacher checkpoints. A photograph cannot determine when handwriting was produced. |
| Paperless documents | Draft/preview/issue flow, encrypted attachments, replacement versions, withdrawal reasons, parent acknowledgment, exact-version receipts, timeline and exports. | Real guardian identity, multi-recipient distribution, appropriate signature provider, retention and verification policies. The demo acknowledgment is not a qualified signature. |
| Creative loophole learning | A product principle for a future teacher-led AI literacy exercise. | Use a disclosed challenge environment with no consequential grading. Production integrity defects should be repaired, not intentionally hidden. |

## Implemented flows
1. Assigned teacher drafts and publishes class homework → authenticated pupil submits text/files and declares AI help → author/administrator records feedback or returns it for revision → the pupil and linked parent can read preserved work, files and feedback.
2. Teacher adds a grade or attendance record → the same workspace's student/parent view displays it after navigation/reload.
3. Student changes explanation style → reads an authored lesson → answers a question → server checks the answer and records the result in the portfolio.
4. Staff saves and previews a document draft → issues it for parent review → parent acknowledges the exact version → receipt remains available; a later replacement preserves earlier issued content and receipts.
5. Teacher builds an editable material from a topic template → saves it in the library → downloads a text copy.
6. Administrator edits a device-policy draft → draft persists, without claiming any computer has received it.

## Storage and security
- Cloudflare D1 stores owner-scoped demonstration records and separately school-scoped directory, class assignment, submission and audit records, with AES-256-GCM encrypted JSON payloads.
- R2 stores AES-256-GCM encrypted file bytes; filenames and object references are in encrypted records. Connected homework files use the school namespace and store metadata within assignment versions or submission attempts, separately from the owner-private file registry. Student conditions retain worksheet references from the hand-in version.
- Every encryption has a random 96-bit IV and its owner or school namespace as authenticated additional data.
- The 256-bit key lives in the Sites secret store, not the repository. Losing the key makes existing records unrecoverable; key rotation and managed backup are future operational requirements.
- Identity comes from platform-authenticated headers, never from JSON input. Demonstration reads/downloads/writes use the owner scope. Directory and connected homework access, including file downloads, check the school's current membership, status and assigned classes/pupils. Connected homework responses redact internal submitter/reviewer account IDs and storage keys.
- Writes have schema validation; connected homework accepts up to three selected document/image files, at most 10 MiB each and 20 MiB combined, with bounded multipart parsing and basic format checks. Downloaded files use attachment disposition and nosniff; these checks are not malware scanning.
- Anonymous internal previews show only synthetic seed records. They cannot write.
- The role selector controls demonstration views only. The School and connected homework workspaces use authenticated membership and hide that selector. Anonymous preview exposes an explicitly fictional, read-only school profile choice.

## AI integration
The server calls the OpenAI Responses API only when both OPENAI_API_KEY and OPENAI_MODEL are configured. The UI requires explicit confirmation before sending the question, selected authored lesson and opted-in learning preferences. No grades, document contents or other students' records are sent. Requests use store:false, bounded input/output and a per-owner hourly request limit. Responses are educational assistance, never authoritative grading or evidence of authorship.

The unconfigured state is visible. The interactive authored lessons remain usable without a live AI provider, and do not masquerade as generated AI responses. The personal profile supplies context; it does not train a distinct foundation model per student.

[OpenAI text-generation documentation](https://developers.openai.com/api/docs/guides/text)
[OpenAI's retired classifier and limitations](https://openai.com/index/new-ai-classifier-for-indicating-ai-written-text/)

## Next product milestones
- Connect live AI and verify representative Bulgarian school tasks with teachers.
- Extend connected learning with licensed curriculum, evaluated practice content and editable pupil preferences; migrate gradebook, document and messaging modules to school memberships and pupil links. Extend the connected homework inbox with evaluated delivery/preferences when authorized recipients are established. Validate institutional enrollment and guardian-verification procedures, retention and recovery.
- Agree on NEISPUO integration specifications and test data exchange against an authorized environment.
- Integrate a selected signature provider and distinguish acknowledgments from legally required signatures.
- Add managed-device enrollment and signed agents; never treat browser fullscreen as exam security.
- Extend approved teaching content, assessment rubrics and accessibility, followed by a supervised school pilot.
