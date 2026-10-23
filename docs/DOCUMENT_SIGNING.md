# Document signing — v19, 16 October 2026

**v20 continuation:** School-connected text documents and per-parent/child signing are now a separate workspace. See [school document access](SCHOOL_DOCUMENT_ACCESS.md). The account-owned file-document demo and v19 evidence format described below remain intact.

The user's October 16 clarification establishes two separate signing paths: a person can **draw their signature directly on screen**, or use a **verified electronic-signature provider** when one is connected. Drawing is the primary implemented option. A typed read acknowledgment remains a third, distinct option for documents that only need acknowledgment and for keyboard-only use.

## Working scope

The original Documents module is still a private, account-owned demonstration with fictional parent/pupil recipients. Its role picker controls presentation, not school membership. Drawing, encrypted persistence, exact-version receipts, retained history and copies work within that scope. No school-recipient distribution, guardian verification, provider identity proof or external message is claimed.

The parent view offers:

- **Рисуван подпис**: draw with a mouse, touch or pen; undo a stroke or clear the field; enter a name and explicitly confirm the displayed document version and drawing.
- **Електронен подпис чрез доставчик**: a separate unavailable choice while provider integration is pending. The server refuses this method with 409 rather than substituting another method.
- **Само запознаване**: the existing typed acknowledgment, including keyboard-only use. It does not create a drawing or provider receipt.

Changing the name, drawing or selected method resets confirmation. Conflicting writes and failed responses keep the mounted draft. Browser refresh has an unsaved-input warning. In-app navigation can discard an unsaved drawing; drafts are not persisted in local storage. Signing a replacement version starts a fresh form. Anonymous previews can exercise the pad but cannot save.

## Drawing and storage

`eduo-ink-v1` stores integer `[x,y]` coordinates in a 640 × 240 view box, with at most 40 strokes and 2,000 points in total. Each stroke needs two points, and the drawing needs visible movement. Negative, fractional, non-finite, extra-coordinate and out-of-bounds values fail validation. Raw SVG/images and added metadata are refused. Pressure, point timing and handwriting analysis are not collected.

The published host uses HTTPS for transport. Workspace writes require same-origin JSON and refuse foreign Origin/cross-site requests. Both declared and streamed request sizes are bounded at 128,000 bytes; overflowing streams are cancelled. Successful and failed writes use `Cache-Control: private, no-store`.

The document, strokes and receipt are saved in the same AES-GCM-encrypted account-scoped D1 record. Account scope is authenticated additional data. The server decrypts authorized records for display; this is server-managed encryption. Missing encryption configuration fails the operation. Audit records contain the action and target, not the drawing. Generated signatures are not copied to files or third-party services during normal signing.

## Exact version and receipts

The existing `eduo-document-v1` fingerprint remains compatible and covers document ID/version, title/category/due/content and attachment byte fingerprints. Legacy formats remain labelled.

A drawn signature adds:

1. `signatureHash`: SHA-256 of a fixed-order `eduo-ink-v1` drawing representation.
2. `evidenceHash`: SHA-256 of `eduo-drawn-receipt-v1`, covering receipt ID, document ID/version/content fingerprint/format, drawn method, supplied name, server timestamp and drawing fingerprint.

These fingerprints identify saved content; the account-owned demo does not verify a person's real-world identity. Client-supplied receipt fields are rejected. The server derives digests and timestamps.

The encrypted record and success audit use a conditional atomic write. A stale form, changed hash, withdrawn/draft document, competing signature or different name/drawing/method cannot replace a completed receipt. An exact retry returns the original receipt and timestamp. A committed write with a lost response can be recovered using that same request.

Preparing a replacement draft keeps the issued signed version intact. Publishing it snapshots the previous method/drawing/receipt, clears that evidence from the new pending version and requires fresh confirmation. Retained signatures are shown and exported with their own historical document version. A 1,000,000-byte serialized record bound refuses further growth without truncating prior evidence.

## Copies and verification

An explicit download creates a self-contained printable HTML copy containing the document text, attachment fingerprints, saved drawing and receipt identifiers/digests. Supplied text is escaped, drawing SVG is generated only from validated numeric coordinates, and the copy uses a restrictive Content Security Policy without scripts or remote resources. A separate text receipt is available for drawn documents. Downloads are readable user-requested exports; the stored server record remains encrypted.

`scripts/document-signature-checks.mjs` adds 70 checks through actual workspace routes and encrypted SQLite records. Coverage includes scope, strict validation and limits, transport guards, source/receipt digests, immutable evidence, export injection, legacy acknowledgment compatibility, replacement history, concurrent writers, lost response recovery, SQL rollback, history capacity and unavailable encryption. The full suite has 1,384 checks.

TypeScript and the production Worker build are release checks. Browser pointer/keyboard interaction, visual layout, real touch/pen hardware and real school/provider sessions remain unverified in this environment. School document permissions, verified guardians, multiple recipients and provider delivery remain separate stages.
