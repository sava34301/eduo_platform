# School document attachments — v21, 18 October 2026

The connected `Училищни документи` workspace now accepts files with a private draft. This extends [school document access and signing](SCHOOL_DOCUMENT_ACCESS.md); it does not change the account-owned document demonstration or connect an external signature provider.

## Upload, issue and replace

An approved author for an assigned active class, or an administrator, can select PDF, DOCX, UTF-8 TXT, JPG/JPEG, PNG or WebP. A version allows at most three files, ten MiB per file and twenty MiB combined. Retained and incoming files share those limits. The form shows pending and saved files separately, allows removal/restoration, and preserves selected files after a failed save. Inputs have unsaved-work warnings. Refreshing after an uncertain response keeps the original retry command for an unchanged selection, rather than treating it as another upload.

`POST /api/school-documents/draft` accepts exactly one JSON `data` field and repeated `files` fields. The parser checks Origin, authentication, allowed form fields, declared and streamed bytes, and cancels an overflowing stream. Metadata remains strict. Every incoming file validates before any object is written. Filename, extension/MIME agreement and basic byte signatures are checked, including DOCX directory entries. These checks are not malware scanning or full semantic validation.

Actual file bytes receive SHA-256 digests and AES-GCM encryption, using the school scope as authenticated additional data. R2 keys use the `school-document-files/` prefix and random identifiers. Only public metadata reaches clients; storage keys stay server-side. There is no plaintext fallback.

Saving a replacement can retain selected current-draft file IDs and add uploads. A missing retention list preserves current files for older text-only clients; an explicit empty list excludes all files from the draft. Arbitrary, duplicate and foreign-version references are refused. Excluding a file does not erase it from an earlier issued edition. A new draft inherits the last edition's files; publishing freezes its own list, with new parent/child requests and no inherited signatures. Publication verifies each referenced encrypted blob and byte digest before committing.

## Fingerprints and signatures

New editions use `eduo-school-document-v2`: the previous school/document/class/year/edition, text, due date, signing mode and recipient-set digest, followed by ordered `{id,name,mime,size,sha256}` attachment metadata. Object keys are excluded. Changing file bytes, names, size, ID or order changes the document fingerprint.

Existing editions without a format field retain the exact `eduo-school-document-v1` serialization and hash; their attachment view normalizes to an empty list. Original receipt hashes and exact retries remain valid. New replacement editions use v2 independently of the old edition's format.

A new signature must supply the exact displayed attachment ID list for a file-bearing edition. Cached clients that cannot display attachments cannot sign it. The form asks the parent to confirm the text and attachments together; the server checks file availability/integrity before creating the immutable receipt. This confirms the selected edition and files, not whether a person actually opened or understood each one. A retry of an already committed signature recovers its original receipt even if a file later becomes unavailable.

Printable HTML copies contain the selected text, drawing/receipt and each attachment's name, byte length and SHA-256. They do not bundle attachment bytes; the interface tells users to download the files separately. Copies remain readable user-requested downloads, while server storage stays encrypted.

## Downloads and access changes

`GET /api/school-documents/files/:id?school=…&document=…` requires exactly one positive `edition` or `draftRevision`. The author and administrator can inspect a permitted draft only at its exact current revision. Families can download files only from editions addressed to their own account and currently linked active child. Selecting another document, school, edition or file ID cannot broaden access. Excluded replacement families retain only their original addressed files. A newly addressed family cannot read earlier unaddressed editions.

Withdrawal retains authorized historical downloads. Transfer preserves linked family history and closes old-class signing; reassigned teachers do not inherit old documents. Assignment removal, child unlinking and suspension remove the corresponding download rights. Administrator archive access follows the existing document rules.

The service checks permissions before reading R2, authenticates/decrypts the object, verifies saved size and SHA-256, then rechecks both the directory and document payload. A concurrent change refuses the captured response. Missing, corrupted or foreign-scope ciphertext returns a private error without bytes. Success uses attachment disposition, canonical MIME, `nosniff`, sandbox CSP and private/no-store headers. The client also checks MIME, length and digest before saving and keeps errors within the document so signing inputs stay mounted.

## Commit recovery and limits

Upload request fingerprints include ordered metadata and actual byte digests. Exact retries retain the same file identities without uploading duplicate objects; changed bytes or names cannot reuse a request. Conditional D1 writes retain directory/document/capacity guards and atomic audit records.

On failure, cleanup deletes only newly uploaded objects proven unreferenced by the authoritative saved draft and all issued editions. A lost response after a successful commit preserves referenced objects. If saved commit state is unavailable, cleanup defers deletion. Previously excluded draft objects are not automatically purged; retention, orphan reconciliation, backup/restore and storage operations need a separate implementation. No complete storage lifecycle is claimed.

## Verification

`scripts/school-document-file-checks.mjs` adds **106** checks through actual multipart, document, signing and download routes, real Node SQLite and an in-memory R2 adapter. They cover validation/byte bounds, encryption/scope, upload idempotency, retention/combined limits, version hashes, cached-client signing refusal, historical family privacy, membership cutoffs, missing/corrupt blobs, download/issue/sign revocation races, partial storage failure, SQL rollback, lost responses, cleanup and frozen v20 hash compatibility. The complete suite passes **1,599** checks with synthetic identities and content. TypeScript and the production Worker build are release checks.

Browser visual/focus/keyboard/touch/pen interaction, actual school enrollment, live R2/D1 failure behavior and external providers remain unverified. Official templates, institutional verification, retention operations and provider-based signing remain separate work.
