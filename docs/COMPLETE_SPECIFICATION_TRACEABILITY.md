# Complete specification traceability — v18, 13 October 2026

Source: the newly attached 22-page **Eduo — Complete Platform Specification (2)**. All 15 sections were read; the design table on page 15 was also rendered and inspected. The document describes a separate Claude demo and Flask v0.4 codebase. Its “built” labels and 52-test claim are not treated as evidence about this Sites implementation.

The functional requirements are accepted alongside the 40 screenshot requirements and the original concept. The source's artifact, ZIP and GitHub-project setup are excluded under the user's earlier instruction. No existing Site, identity system or data is replaced to imitate those separate project descriptions.

Coverage labels below describe **this** private implementation: **connected** means a working school-membership-scoped pilot part, **demo** means fictional owner-private workflows, **provider** means an external/licensed dependency, **planned** means missing implementation, **operational** means an unverified organizational launch condition, and **platform** means the current Sites equivalent of an architectural requirement. Neither the feature catalogue nor this checklist certifies official school readiness.

## Roles and everyday work

| PDF pages | Requirement | Coverage in this release | Remaining requirement |
| --- | --- | --- | --- |
| 1–3 | Student, teacher, parent and director experiences; reserved school admin role | Connected account approval, class/pupil links and four role views; current admin combines director/admin functions. | Separate director/admin authority and a complete school-wide dashboard. |
| 3 | Students see their own data only | Connected homework, lessons/checkpoints, authored practice, grades, attendance and inbox derive the pupil from the approved link. | Migrate personal profile, tutor, planner and the remaining demos. |
| 3 | Teacher access by class **and subject**, without another teacher's gradebook | Connected class assignments and author-controlled writes; inbox grade notices are limited to the original teacher's permitted pupils. | Subject registry/teaching assignments and tighter journal read scope; current assigned colleagues can still read class grades. |
| 3 | Parents see and act only for linked children | Connected family selection/current and retained child records, explanations/inbox and school documents with per-parent/child signing. | Fees, direct messaging, combined profile/home and specialized document administration. |
| 3 | Director sees the whole school and manages events, fees and substitutions | School admin directory and authorized grade/attendance history are connected; other administrative areas are demos. | Separate role and school-wide administrative migration. |
| 3 | Relationship-scoped messaging | Demo one-to-one conversations. | Student-to-own-teacher, parent-to-child's-teacher, staff/colleague and director recipient validation, unread state and safeguarding. |
| 3, 10–11 | AI receives first name only; learning memory excludes private-life/health/family content and is deletable | Live school AI is disconnected. Opt-in preferences exist in the owner demo. | Minimal-data provider context, visible/deletable memory, scope/consent enforcement and evaluation. |
| 4 | Student home: average, rank, absences, upcoming work/tests/events, subject averages, recent grades and tutor shortcut | Demo dashboard; connected grade/attendance/work/practice pages supply individually authorized records. | A combined real-pupil dashboard, specified rank policy and authoritative timetable/events. |
| 4, 10–11 | Tutor uses permitted grades, weak subjects, deadlines and learning notes; provides hints | Provider adapter and authored demo explanations. | Approved provider, school-scoped evidence and evaluated guided responses; no full homework/essay generation for submission. |
| 4, 10 | Learning notes: last eight messages, every third question, up to six notes and individual deletion | Planned, recorded as a separate catalogue module. | Explicit memory lifecycle, extraction evaluation, deletion and provider-context exclusion after removal. |
| 4, 10–11 | Adaptive practice: five questions, optional topic, weak-subject default, level/profile adaptation, explanations, history and average | Connected teacher-authored lesson practice with weighted server scoring and immutable attempts; demo subject banks. | Evaluated AI question generation and connected preferences. Formative practice remains distinct from single-attempt formal tests. |
| 4, 9 | Weekly timetable, today highlight, events and substitution banners | Working demo week/day timetable and replacement view. | Multi-class/teacher/room school scheduling, publication and event coordination. |
| 4, 6–7 | Homework deadlines, text submission, teacher feedback and family visibility | Connected text/file submissions, exact conditions, author review and retained history. One outstanding submission cannot be overwritten; a requested revision is explicit. | Deadline policy, remaining notifications and evaluated AI support. |
| 4, 6, 11–12 | AI check on every hand-in, teacher-only signal, reason/question, threshold styling and warning | AI-use declaration and human clarification; no detector or invented likelihood. | Validated signal/error rates, permitted provider context, review/appeal and nonblocking delivery; a prompt's percentage is not validated authorship probability. |
| 4, 6 | Class test once before deadline; server key, explanations, score/grade and teacher result analysis | Working owner demo; connected authored practice protects keys but permits formative retries. | School-scoped formal assessment, approved scale, one-attempt rule, class/question analysis and safe result-to-grade conversion. |
| 4–5, 7–8 | Full profile: grades, absences, remarks, sanctions, badges, homework/practice statistics and rank | Working demo profile; individually connected records have separate family/pupil views. | Unified real-pupil evidence and human-entered remarks/sanctions with reasons, history and review. |
| 5 | Badges: punctuality, five tutor questions, extra reading, mean ≥5.50 and three practices | Demo evidence badges. | Real-record criteria and teacher controls. Opening a page or missing telemetry cannot establish mastery/effort. |
| 5, 7, 10 | Searchable teacher lesson library and AI drafts | Connected assigned-class draft/publication, source editions, reading layouts and pupil self-reports. | Wider library moderation/licensing and evaluated drafting. |
| 5, 10 | Explain a lesson using the pupil's profile, with two self-check questions | Demo source-based reading layouts; connected reader preserves authored content. | Evaluated source-grounded adaptation and self-check generation. |
| 5, 10 | Personal video lesson: 5–7 slides, narration, play/pause/skip | Demo/source reader has slides and optional browser voice. | Personal generated scripts, accessible narration/captions, media jobs and real video files. |
| 5, 11 | Effort evidence: tutor questions, reading, personal lessons, videos, practice and punctuality | Demo counters; connected practice/checkpoints and original homework deadlines preserve concrete evidence. | Unified verified-record portfolio. Self-reports are labeled; missing use creates no negative grade or inferred laziness. |
| 5–7 | Teacher class/subject cards, averages, submitted work, excuses and substitutions | Connected directory, homework review queue, grade matrix and attendance review; old class dashboard is a demo. | Real teacher class/subject landing page and substitutions. |
| 5–6 | Current grades 2–6 with feedback and family notice | Connected human entries, corrections, annulment/restoration and stable inbox events. | Approved school assessment rules and subject-specific authorization. |
| 6 | Current, term and annual grades; one active term record per subject/term and one annual record per subject/year; means use current grades | **Connected in v18**. Encrypted pupil/year/normalized-subject reservations, atomic corrections/release/replacement/restoration, family type views and CSV. Legacy current-grade receipts remain compatible. | Official subject IDs, dates/assessment policy, year closure and national exchange. |
| 6 | Attendance: present, late, absent; family notices | Connected unmarked roster snapshots and explicit marks; significant status changes generate permitted inbox events. | Official schedule/absence policy, range processing and external delivery. |
| 6 | Lesson topic by date | Connected attendance records include subject/topic and metadata history; scheduled lesson journal remains a demo. | Authoritative schedule/lesson journal and statutory register. |
| 6 | Teacher accepts/rejects AI extra-grade proposals from concrete evidence; no duplicate grade conversion | Provider-dependent proposal generation; explicit manual grading and demo test conversion already exist. | Saved school-scoped proposals, criteria, acceptance/rejection reasons, idempotent linkage and evaluated generation. |
| 7 | Teacher reads own pupil profile and adds praise, note or sanction | Working demo remarks/profile. | School-scoped human decisions, permissions, reason/history and appropriate pupil/parent review. |
| 7–8 | Parent excuse note over a date range; approve/refuse and track state | Connected per-pupil/per-lesson explanation, returned clarification, approval, explicit refusal and original-sender withdrawal. Inbox actions follow current rights and relevant latest request. | Date-range submission, attachments/medical sources, school-configured policy and validated statutory rules. |
| 7, 9–10 | Six event types: class test, test, parent meeting, consultation, trip, other; class/date/note and family notification | Working demo calendar/ICS and notices. | School event audience, teacher class scope, director school scope and real delivery. |
| 7, 11 | Teaching assistant drafts 40-minute plan, six-question test or five homework tasks; teacher edits/publishes | Editable author templates and provider adapter in demo. | Evaluated generation, approved curriculum and real-role publication. |
| 7, 9 | Teachers cover eligible substitutions; director creates absences; timetable-derived slots, no duplicate cover, private reason | Working demo absence/claim/assign/release/cancel history for one class. | School-wide availability/conflicts, subject/room permissions and transactional assignment. |
| 7–8 | Parent home places pending signatures first and has a card for every child | Demo home and directory-linked children/individual connected views. | Combined real-family dashboard; parent/child recipient documents are connected. |
| 8, 11 | About 90-word weekly AI summary per child from actual grades, absences, work, practice, remarks and events | Deterministic seven-day demo summary. | Real-child aggregation first; optional evaluated provider phrasing of verified facts. |
| 8–9 | Fees in euro with deadline; declare paid; director class-wide charges, owed totals and CSV | Working demo uses declarations and separate staff verification; this does not move money. | Real family/financial scope, idempotent provider transactions, reconciliation/refunds and authorized reporting. |
| 8, 10 | Draw with finger/mouse, explicit read confirmation, exact document SHA-256/time and signed archive; teachers see each parent state | **School-connected in v21** with encrypted edition-bound attachments: approved parent/child snapshots, independent requests, drawing/acknowledgment, encrypted immutable receipts, per-parent tracking, signed copies and retained editions. Excluded replacements remain private. | Institutional enrollment/verification, specialized document rules and retention operations. Provider-based electronic signing stays a separate second path, as clarified on October 16. |
| 8–9 | Director dashboard: pupil/teacher/class counts, pending notes, class averages, absences and submitted-work percentages | Directory and permitted journal/attendance records are connected; combined director view remains a demo. | School-wide coherent denominators and separate director authority. |
| 9 | Director pupil reports sorted by mean, absence/lateness and Cyrillic CSV | Working demo reports; connected journal/directory/attendance filtered CSV. | Unified school reports with approved definitions and access scope. |
| 9–10 | Notifications for grades, absences, work, remarks, fees, events and documents; day/time, filters, unread counter and bulk read | **Connected in v18** for work, grades, significant attendance changes and private-case activity. Today/yesterday groups, exact links, personal encrypted markers and displayed-window counter. | Migrate other event sources, notification preferences, automatic refresh and external delivery. Read does not prove delivery or completion. |
| 9–10 | One-to-one messages with unread count, timestamps and automatic read | Working owner demo. | Relationship-scoped recipients and real personal delivery/read state. |

## AI, integrations and expanded school operations

| PDF pages | Requirement | Current coverage | Remaining requirement |
| --- | --- | --- | --- |
| 10–12 | All nine AI capabilities advise within their stated input/output scope | Provider adapter exists; all school AI remains disconnected. Authored alternatives are labeled. | Tutor, notes, adaptation, video scripts, quizzes, signals, grade proposals, teaching drafts and parent narration each need evaluated structured output and permissions. |
| 11 | Tutor avoids collecting private information/secrecy and supports a pupil describing danger, including a verified help contact | A generic provider safety prompt exists in the demo. | Evaluated Bulgarian safeguarding behavior, verified school/contact escalation information and human support procedures. No new medical/legal advice is claimed. |
| 12, 21–22 | Loophole/case learning: teacher confirms or dismisses false signals and missed cases; later checks learn from permitted examples | Planned/provider-dependent catalogue module. | Reliable human case labels, privacy/redaction, school isolation, evaluation/versioning and no automatic accusation or penalty. |
| 13 | Rankings by class, school, city and country | Demo local evidence; no connected national ranking. | Explicit comparable datasets, permissible aggregation and fair definitions; do not fabricate positions. |
| 13, 19 | Archive of prior years | Connected retained authorized history; no guaranteed multi-year archive service. | Year closure, archive navigation, retention policy, tested backup/restore and operations. |
| 13, 19 | Virtual classroom/Teams link on timetable | Demo validated HTTPS lesson link. | School-scoped schedule link, provider accounts/rooms and authorized invitation/access. |
| 13–14, 19 | НВО/ДЗИ, clubs, competitions and olympiads | Planned catalogue modules. | Validated results/source imports, human corrections, participation/permissions and history. |
| 14, 19 | Full-day organization diary | Planned. | Groups, assigned staff, schedules, themes/attendance and family view. |
| 14, 19 | Pupil movement: enrollment, transfer and leaving | Connected numbered pupil creation/transfer/archive/restore and membership controls. | Official enrollment/leaving records, dates, reasons, identifiers and approved exchanges. |
| 14, 19 | Director orders, council decisions, correspondence, protocols and control books | Planned specialized registers; general document demo exists. | Sequential numbering, issue/correction rules, duties, recipients and preserved official versions. |
| 14, 19 | Thematic plans and lecturer-hours book | Planned catalogue modules. | School year/subject/class plans, conducted-work linkage, extra-hours approval and authorized reports. |
| 14, 19 | Staff appraisal and teacher portfolios | Planned. | Agreed criteria, evidence, self-review/response, qualifications, privacy and human decisions. |
| 14, 20 | Asset inventory and kindergarten meals/menus/allergens | Planned; both now explicitly represented. | Movements/repair/retirement, menu/portion workflows and tightly scoped sensitive data. |
| 14, 19–20 | NEISPUO two-way exchange; imports from national/AdminPro exports | Connected directory CSV preview/import/export only. | Authorized specification, mapping/credentials, validation, reconciliation and official testing. |
| 14, 19 | Microsoft 365/Google Workspace sign-in and files | Provider-dependent; current Site sign-in stays in place. | School tenant approval, identity mapping, minimal file scopes and revocation. |
| 14, 20 | aSc timetable integration | Provider/licence-dependent, distinct from screenshot-requested own generation. | Licensed interface/format, school identities, conflict review and explicit publication. |
| 14 | Mozaik 3D and large licensed material/test libraries | Author content only; no licence transfer or acquired vendor catalogue. | Author/publisher rights and permitted integrations; do not copy quantities into a readiness claim. |
| 14 | 850+ official templates, exam protocols and diplomas on MОН forms | General document demo; official forms unimplemented. | Authorized current templates, validated mappings, issue/signature/printing rules and licensed libraries. |
| 1, 14, 19 | Native iOS/Android apps | Responsive web only. | Separate apps, secure sessions, permissions/offline behavior, device testing and store distribution. |
| 1, 20, 22 | Controlled school OS/devices, website/app blocking, lab/exam mode and school-account sign-in | Owner-demo policy drafts, no enrolled/enforced devices. | Decide supported system/management product; signed agents/images, enrollment, enforcement, updates and tested recovery. |
| 21 | Teacher requests photographed class work; compare content to lesson; temporary processing | Notes/upload demo only. | School-scoped request/response/review, accepted file/camera workflow, retention control and evaluated content comparison. Photo timestamps cannot prove handwriting production time. |
| 22 | Personalized whole textbooks and actual generated video | Per-lesson authored layouts/slides only. | Licensed inputs, correctness review, accessible media, cost/jobs and publication controls. |

## Design and platform requirements

| PDF pages | Requirement | This project | Remaining work |
| --- | --- | --- | --- |
| 1, 10, 15 | Eduo branding and Bulgarian interface | Applied; modern responsive cards/navigation. | Maintain consistent localized content as modules connect. |
| 15 | Exact light/dark palette and grade-color meanings | Existing calm campus palette has blue/violet/sage/gold accents and distinct grade colors. | Adopt the exact source token table and audit contrast across every state. |
| 15 | Onest, 30px headings, 16px card titles, 15px body, 32px numbers | Existing self-hosted Golos retained. | Licensed Onest assets and a verified type-scale rollout. |
| 10, 15 | 248px sidebar, mobile bottom navigation, 12-column layout, 22px corners and 18px gaps | Existing 240px sidebar, mobile drawer and responsive grids. | Source-specific layout and bottom-navigation implementation/interaction QA. |
| 10, 15 | Automatic device dark mode | Planned; not claimed by this release. | Semantic color tokens, controls/portals/charts/media states and device-theme verification. |
| 16–17 | Browser → server → database/provider; API keys only on server | Platform equivalent: Vinext/Cloudflare Workers, encrypted D1/R2 and server provider adapter. | Preserve minimal secrets and evaluate any configured external provider. |
| 16–17 | School/users/classes/pupils/parents/subjects/teachings and educational records | Connected directory plus versioned school homework, lessons, practice, grades and attendance. | Subjects/teaching assignments and migration of remaining record types; no forced 22-table rewrite. |
| 17 | Protected login, sessions, passwords/rate limits and CSRF/security headers | Host-owned ChatGPT sign-in, private audience, same-origin guarded requests and authenticated school scope. | Review the actual host/session/security-header contract; do not seed the PDF's demo password or replace native authentication with a demo login. |
| 17, 19–21 | Staff MFA, invitations, password reset | Native sign-in remains authoritative; app-level flows not implemented. | Supported identity-provider capabilities and approved enrollment/invitation flows; no unsolicited external messages. |
| 17 | Store money in euro cents | Demo charge amounts use explicit financial fields; no actual payments. | Confirm integer-cent invariants throughout real provider/reconciliation work. |
| 19–21 | Migrations, daily backups and operational database | Existing D1 schema/migrations and encrypted records; no PostgreSQL migration or verified daily backup program. | Choose/verify the production storage and backup/restore operations; do not confuse Node SQLite test fixtures with hosted D1. |
| 20–21 | Encryption, HTTPS, audit, hidden test keys and independent security review | Encrypted records/files, same-origin routes, atomic audits and server-scored protected keys are exercised by isolated checks. | Independent review, actual school/session/device testing and verified operating controls. |

The source palette remains an explicit design requirement:

| Token | Light | Dark |
| --- | --- | --- |
| Primary | `#5B54B8` | `#8F88F0` |
| Growth | `#3F6E4D` | `#8DC19C` |
| AI | `#C9A24B` | `#E0BC6A` |
| Alert | `#B4432F` | `#F0A393` |
| Background | `#F3F1EC` | `#121116` |
| Surface | `#FFFFFF` | `#1B1A21` |
| Text | `#1B1A1F` | `#F1EFF5` |

## Operational launch conditions from pages 20–21

These conditions are retained as requirements with **no claim that they are complete**: legal entity able to contract; school controller/processor agreements; documented privacy/impact assessment; clear child/parent AI notices and applicable permissions; an appropriate AI-provider data agreement; professional review of Ministry AI guidance and signatures by document type; official national-system authorization and document-rule review; verified hosting/data residency; staff authentication/enrollment controls; daily backup/restore; independent security review; actual payment provider; staffed school support, training and a help centre.

They are not reasons to stop reversible development or ask for another publishing confirmation. This release uses isolated fictional identities/data, changes no sharing, enrolls no real school accounts, sends no messages or payments, and connects no provider or enrolled device.

## Traceability and release evidence

- The catalogue keeps the original 40 image entries and nine concept entries, then adds 13 PDF-specific module areas: subject assignments, full pupil profile, learning memory, formal tests, family summary, school notifications, classroom requests, integrity-case review, kindergarten meals, cloud suites, aSc integration, licensed 3D content and official-template libraries. All 62 IDs are distinct and link only to real application sections.
- v18 connects term/annual grades and grade/attendance/private-case inbox activity; it does not represent every planned card as implemented. References to another version's feature parity or “instant shared data” are not substituted for this app's verified behavior. Current inbox refresh is explicit, and its counts cover the latest 200 permitted events.
- 1,314 isolated workflow checks pass against actual route code, including the new final-grade/reservation and combined-inbox cases. TypeScript passes; the publishing workflow requires the production Worker build. Browser visual/interactive QA was unavailable. No live provider, actual pupil identity or institutional compliance was certified.

The source's five-phase roadmap is retained through [product history](PRODUCT_SPEC.md), [module scope](REFERENCE_FEATURE_SCOPE.md) and this page-level checklist. New ideas append to the scope without deleting earlier requirements.
