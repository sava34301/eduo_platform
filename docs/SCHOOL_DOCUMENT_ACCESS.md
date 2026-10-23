# School documents and parent signatures — v21, 18 October 2026

`Училищни документи` (`#school-documents`, `/api/school-documents`) is a school-membership workflow, separate from the earlier account-owned document demo. This stage supports **text documents with encrypted versioned attachments**, drawn signatures and read acknowledgment. Specialized statutory forms and verified-provider signing remain future stages. See [attachment access, recovery and limits](SCHOOL_DOCUMENT_FILES.md). The Site's existing public audience is preserved; school data requires an authenticated approved membership.

## Roles and recipients

- An active teacher can create a document for an assigned active class. Only that author while still assigned, or a school administrator, can see its draft and manage it. A class colleague cannot read another author's document. Administrators can read retained school history; edits require the current year and active class.
- A draft selects active pupils from that class. Publishing snapshots **every active approved parent for every selected pupil**. Each parent/child pair gets its own opaque request ID. Every selected pupil needs an approved parent; no pupil is silently omitted. A maximum of 80 parent requests applies per edition.
- Parents see only editions addressed to their own account and linked active children. Another parent of the same pupil has a separate request, signature and receipt. Siblings also require separate requests. Students, pending applicants, unrelated accounts and suspended members receive no parent document content.
- Approving a new parent after issue does not add them to an old recipient snapshot. A replacement edition is needed. Removing a child link or suspending the account removes reading and signing rights. On transfer, the linked family retains its own history but cannot sign an old-class request; the former teacher loses that pupil's recipient rows and signatures. The new teacher does not inherit old-class records. Administrators retain authorized transferred/archived history. Earlier-year signing and staff editing are closed.
- A family excluded from a replacement sees only its latest addressed edition, marked as retained. The new title, text, recipient identities and draft are not returned. Historical copies retain their own document/signature relationship.

Administrative enrollment includes a manual relationship-verification step; it is not independent institutional or external-provider identity verification.

## Version lifecycle

Save creates a private draft. A separate review displays the exact saved text, attachments, pupils and current parent counts; explicit confirmation issues it into the school workspace. Issuing is an in-app operation and does not send email/SMS/push.

An issued edition is immutable in text, attachment list, due date and required confirmation method. A separate replacement draft can be saved while parents continue reading/signing the current edition. Issuing the replacement resolves a new recipient snapshot and requires new receipts. Existing signatures stay on their original edition. Discarding the replacement draft preserves the issued version. Reasoned withdrawal closes new signatures while retaining saved receipts and the withdrawal information.

The mode is chosen by the issuer: either a drawn signature or acknowledgment without drawing. A parent cannot substitute acknowledgment for a required drawing. Verified provider signing remains separate and unavailable.

## Signing and evidence

The signed-in approved member supplies the receipt name on the server; a client cannot provide a different signer name or receipt fields. The request must identify its exact recipient slot, edition and document fingerprint and explicitly confirm the action. Drawings reuse the bounded `eduo-ink-v1` coordinates: 640 × 240, up to 40 strokes and 2,000 total points, no raw SVG, pressure or point timing.

Existing `eduo-school-document-v1` hashes preserve school/document/class/year/edition, title/category/content/due/signing mode and a digest of the snapshotted recipient set. New `eduo-school-document-v2` hashes also bind ordered attachment IDs, names, MIME, sizes and byte SHA-256 digests. Signing a file-bearing edition requires its exact displayed attachment list and available verified bytes. Parent views receive the recipient digest and only their own slots, not other families' identities.

`eduo-school-receipt-v1` covers receipt/school/document/edition, pupil and signer identifiers/names, server timestamp, confirmation method, exact content hash and drawing hash when present. These are content fingerprints and preserved school-account evidence; a separate provider signature is not fabricated.

Receipts use a `school-doc-receipt:` storage namespace plus the issued slot UUID. Other school modules accepting UUID record IDs cannot occupy a pending receipt key. Each receipt is an independent immutable encrypted record, so one parent's signing does not revise the shared document or complete another person's/child's request. Summary reads load receipt identifiers instead of every stored drawing; detail loads only the selected edition's currently permitted receipts.

An explicit download creates a printable HTML copy for the selected parent/child containing text, saved drawing, attachment metadata/hashes and receipt/digests. Attachment bytes are downloaded separately from the selected edition. Source text is escaped, drawing SVG is generated only from validated numeric coordinates, and a restrictive Content Security Policy blocks scripts and remote content. No fixed demo child is substituted. The readable downloaded copy is user requested; stored school records remain encrypted.

## Atomicity, privacy and limits

Document and receipt records use AES-GCM with the school scope as authenticated additional data. HTTPS protects transport. JSON writes require same origin, bound declared and streamed bodies to 128,000 bytes and cancel overflowing streams. Multipart draft uploads use a twenty MiB file-byte limit plus bounded form overhead, with independent count/per-file/combined checks. All responses are private/no-store. Encryption failure has no plaintext fallback.

Conditional D1 batches guard the captured directory and target document. Creation also guards a capacity ledger. The record, capacity change when applicable and encrypted audit commit together. Signature receipts additionally guard the current document payload. Revocation during commit refuses the signature; a final directory check blocks a captured read after rights change.

An exact persisted operation request recovers its original result. A different request/name/drawing cannot replace a signed receipt. Response loss can be recovered by checking current records or retrying the exact request. Competing signatures accept one receipt. An in-flight old-version signature is either recorded on that edition or refused; it never becomes a signature of a replacement.

Pilot bounds: 300 school document records, 12 issued editions each, 80 operations per record, 80 parent/child requests per edition, 880,000 serialized bytes for ordinary document changes and 900,000 for withdrawal. An operation and byte reserve allows a pending request to be withdrawn. Capacity failures preserve prior versions and receipts. No deletion, archive rotation, guaranteed throughput, retention service or backup certification is claimed.

## Interface, inbox and verification

The workspace provides search/status filters, class/pupil draft selection with approved-parent counts, separate saved-text review and issue confirmation, per-parent completion, historical edition choice, linked-child signing, typed acknowledgment, signed copies and explicit withdrawal. Unconfirmed writes preserve mounted editor/signature inputs. Refreshing resets confirmation when school/document revisions change. Module navigation and common app links offer an unsaved-work dialog; refresh/page-close has a native warning. Browser Back/Forward and actual touch/pen behavior have not been verified.

Parents receive a current-edition inbox item with exact school/document/child links. Withdrawal has a distinct unread notice even if the issue notice was already read. Only their own unsigned eligible request has an action; signature, withdrawal, transfer, year change and access removal close it. Other families' names, document bodies, drawings and receipt internals stay out of the feed. Read markers are not delivery or signing receipts. Staff track completion in the document register. Automatic refresh and external notifications remain future work.

`school-document-checks.mjs` contributes 107 isolated route/service checks; two additional checks exercise actual anonymous/signed-in API-helper envelopes. They cover role/recipient isolation, snapshots, multiple parents/children, excluded replacement privacy, exact hashes, encrypted immutable receipts, signed copy injection, transfer/unlink/suspension/archive/year behavior, unknown/forged fields, body/origin/media guards, current inbox actions, idempotent issue/sign recovery, real SQL rollback, races, revocation during reads/commits, capacity and receipt identifier collisions. Another 106 attachment checks cover multipart, encrypted versioned files, permissions, integrity, fault recovery and legacy compatibility. The complete suite passes **1,599** checks with synthetic identities and in-memory storage. No actual parents were invited or sent requests during development.

TypeScript and a production Worker build are release checks. Browser visual/pointer/keyboard QA, real school sessions, device hardware and external providers remain unverified. Real institutional onboarding, official forms, lifecycle/retention operations and verified-provider signing require further work.
