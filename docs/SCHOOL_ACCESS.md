# School directory and access — v14

Directory implemented: 6 October 2026; connected homework added: 7 October 2026; submission files added: 8 October 2026; teacher worksheets/version history and inbox added: 9 October 2026; connected lessons/checkpoints and authored practice added: 11 October 2026. These workflows use school membership. Existing owner-private profile, practice, material and AI demonstrations remain separate.

## Access model

`GET /api/school` derives the platform account from authenticated request headers. Anonymous preview returns only fixed fictional records and cannot write. A directory's encrypted member list determines authorization; a caller cannot select a demonstration role to change it.

| Account state / role | Returned directory data | Permitted changes |
| --- | --- | --- |
| No membership or request | None | Create a separate empty environment; submit a request with a valid code |
| Pending, rejected or withdrawn applicant | Basic school identity and their own request/decision | Withdraw their pending request; submit a new request after a decision |
| Suspended member | Basic school identity and their own status/request | None in that school |
| Active administrator | School settings/code, all classes/pupils/members/requests and recent audit | School, roster and account administration; own rights cannot be changed |
| Active teacher | Own membership, assigned active classes and their active pupils | Read/export that roster |
| Active parent | Own membership, linked active pupils and their classes | Read/export those pupils |
| Active student | Own membership, one linked active pupil and that pupil's class | Read/export that pupil |

Non-administrator responses omit other accounts, pending applicants, school codes, audit records, internal verification notes and approving/reviewing account IDs. An applicant can see the reason communicated for their own decision. Names and email addresses are display information, not proof of school authority.

## Approval and lifecycle

1. A signed-in creator establishes an empty environment and becomes its initial administrator. Institution ownership is not independently verified by this action.
2. An applicant obtains a school code and already has permission to open the private Site. A code creates a pending request, without changing Site sharing or membership.
3. The administrator checks identity and relationships through the school's process, explicitly selects role and links, confirms the check and records a reason. No uploaded identity documents are requested.
4. Permissions take effect on subsequent server requests. Changes to scope and suspension are recorded. Restoration revalidates active classes/pupils and the single-active-student-account constraint.
5. Code rotation prevents new requests with the old code; existing accounts and pending requests remain. Codes do not expire automatically.

Archive actions retain records. An active class cannot be archived with active pupils or teacher assignments. A pupil cannot be archived while linked active accounts remain. Transferring a pupil keeps the stable pupil ID and parent links, while class-based teacher visibility follows the new class.

## Storage and consistency

- School aggregate: existing D1 `school_records`, owner namespace `eduo-school:<schoolId>`, record `directory`.
- Per-account discovery index: `eduo-memberships:<userId>`. Discovery is never sufficient authorization; every view is projected from current school membership.
- Code lookup: SHA-256 code key in a separate namespace; its payload and the directory containing the code are encrypted. Old lookup keys do not make rotated codes usable.
- AES-256-GCM uses the record namespace as authenticated additional data. The configured storage key and existing table are reused; no schema migration or new provider secret is needed.
- Compare-and-swap on the encrypted aggregate guards directory, audit and discovery writes in one D1 batch. Rejected stale changes add no audit event. Create, request and import identifiers handle exact retries without duplicating records.
- Imports validate the entire batch before committing, reject duplicate/existing active class numbers and never replace existing pupils. CSV export reuses formula-prefix protection.
- The audit interface returns the latest 80 events; earlier rows remain stored.

## Pilot limits and next work

The aggregate is bounded to 100 classes, 2,000 pupil records and 500 historical access requests per school; imports accept at most 100 rows. These include retained records. School year rollover, bulk historical-request retention, ownership recovery, backup/restore and scaled pagination are not implemented.

The new `/api/classwork` workflow and its hand-in/download routes use these memberships for class drafts/publication, pupil text/file submissions, linked-parent reading and teacher reviews. File downloads follow current answer visibility, including transfer, archival and suspension rules. See [class homework access](CLASSWORK_ACCESS.md) for the role and history rules. The original `/api/workspace` records, grades, tests, owner homework, file registry, documents and conversations still use owner-private demonstration roles. They are not joined to this directory or authorized by these memberships. No real accounts were enrolled for this release and the Site's existing owner-only audience was preserved. Browser review uses the anonymous fictional preview; authenticated permission and persistence behavior is tested with synthetic users against the actual routes and isolated SQLite.

Teacher worksheet downloads also check the requested task version: families see published class versions or the worksheet snapshots retained with their own work after transfer, while draft versions remain staff-private. The v12 `/api/classwork/inbox` view derives permitted activity from those records and stores encrypted read markers separately per account and school. Read changes guard the current directory revision and personal record in one transaction; they do not send external messages or create school audit entries. Transfer and suspension follow the same current homework permissions. See the inbox section in [class homework access](CLASSWORK_ACCESS.md).

The v13 `/api/school-learning` workflow uses current memberships for assigned-class lessons and authenticated pupil self-reports. Each checkpoint retains its exact lesson edition; families retain only their own saved sources after transfer. Directory and source dependencies guard its transactions. See [library access](SCHOOL_LEARNING_ACCESS.md) for scope and storage rules.

Next work includes migration of other workflows to stable school/class/pupil IDs and server membership checks, including answer-key access. Institutional and guardian verification procedures, file retention/reconciliation and operational review must precede real-school use. NEISPUO, signature providers, live AI, external notification delivery and device enforcement remain separate integrations. New v13 browser visual QA was unavailable; earlier anonymous preview reviews are historical evidence.

The v14 `/api/school-practice` workspace uses these memberships for authored questions attached to published lessons, pupil-only attempts, linked-child result reading and current-pupil analysis. Original conditions/results remain preserved across edits and transfers; source/practice/directory guards protect new writes. See [practice access](SCHOOL_PRACTICE_ACCESS.md). The original practice banks remain a separate owner demonstration.
