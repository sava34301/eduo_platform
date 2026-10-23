# School activity inbox — v18, 13 October 2026

The stable `#school-inbox` and `/api/classwork/inbox` addresses now present **Училищни входящи**. Existing owner/account/school read markers are retained; no namespace reset or fake read state is introduced. The latest 200 permitted events are selected only after each source's school/class/pupil authorization.

## Sources and visibility

| Source | Audience | Detail and action |
| --- | --- | --- |
| Published homework and permitted hand-in/review history | Existing assignment/submission permissions. | Exact school/task/pupil link; existing current submission/revision actions. |
| Current, term and annual grade versions | Student/linked parent for their own pupil; original teacher for currently permitted original-class pupils; administrator for school history. | Exact grade/pupil link. Original recorded values and each correction/annul/restore remain separate events. No grading action is inferred. Assigned colleagues receive no other-author grade notices. |
| Significant attendance marks/corrections | Existing authorized attendance row; colleagues may read ordinary attendance. | Exact lesson/pupil link. Absent, late, excused and corrections away from these states are included; an initial present/unmarked state does not flood family activity. |
| Explanation submission, approval/refusal/clarification, withdrawal and pending-case cancellation | Linked family, currently authorized lesson author and school administrator. | Bodies, sender names and reasons are omitted. Latest pending author/admin review or still-relevant returned parent clarification may be an action. Students have no parent-only action; colleagues receive no private-case events. |

Grade feedback, correction reasons, ordinary attendance notes, parent explanation text, actor account IDs and retry receipts never enter the feed. Grade values/status and lateness minutes are permitted summary facts; homework answers/rubric scores/files remain omitted. Source endpoints authorize the exact record again when opened.

Grade IDs use saved grade revision; attendance IDs use immutable pupil-history position. Exact retries cannot create duplicate activity. New attendance events retain their source record revision so a cancellation and later review remain correctly ordered even with identical timestamps; earlier records use existing history/time conservatively. A correction away from absence or later cancellation prevents a resolved returned request reappearing as an action. New clarification/review may create a new proper action.

Transfer removes the former teacher's pupil activity and does not grant the new teacher old-class history. Linked families retain only their own permitted records. Administrators retain allowed school history and may finish current-year transferred/archived pending explanations under the attendance rules. Suspension/unlinking removes the currently permitted feed. The directory is checked after source aggregation and again after personal-marker reading, closing revocation races.

## Read markers and interface

Existing encrypted per-account/school markers, 2,000-marker capacity, atomic directory-guarded merging and displayed-snapshot bulk reads remain in place. New activity stays unread after older bulk reads. Mixed authorized/foreign identifiers change none of the selected markers. A read marker is not proof of delivery, completion, grading or excuse approval.

The interface has role-specific descriptions, grade/attendance/explanation/work filters, today/yesterday/date groups in Bulgaria time, class/pupil/read/action/text filters and exact destination labels. The navigation counter updates from the last loaded inbox window. It is not a live subscription: source changes and school changes require a new inbox load/explicit refresh. There are no email, SMS or push sends.

The v18 combined-source checks cover family/classmate/colleague boundaries, immutable original grade events, mark isolation, mixed-batch refusal, lost-response activity, private-body redaction, current explanation actions, corrections/cancel/restore, identical timestamps, transfers and both read-revocation windows. The complete suite passes 1,314 isolated checks with synthetic identities and storage; TypeScript passes. Production build is required before release. Browser interactions, actual delivery and school-scale operation remain unverified.
