# Security

This document summarises the security measures in place in Guilda. It is updated as new protections are implemented.

---

## Authentication

- **Google OAuth 2.0 / OpenID Connect only.** No passwords are stored or handled by Guilda.
- The backend validates the OAuth `state` parameter to prevent CSRF on the callback.
- ID tokens from Google are verified before trusting any claims.
- Sessions are stored server-side. The client receives only an opaque session token via an HttpOnly, SameSite=Lax cookie (Secure flag enabled in production).

## Access Control

- **Allowlist-based.** Having a Google account is not enough — users must be explicitly approved by an admin or hold a valid invite link.
- The allowlist is enforced on the server. Frontend-only access checks are not relied upon.
- The first admin is set via the `FIRST_ADMIN_EMAIL` environment variable, not through the UI.

## Authorisation

- Every API endpoint and Phoenix Channel event validates that the requesting user has the appropriate role and server/channel membership before performing any action.
- Resource ownership checks prevent IDOR (Insecure Direct Object Reference) attacks — changing a UUID in a request URL or body does not grant access to another user's data.
- Role permissions are stored as a bitmask in the database and checked server-side on every mutating operation.

## Input Validation

- All incoming data is validated through Ecto changesets before touching the database.
- Ecto uses parameterised queries — SQL injection is not possible through Ecto's standard query interface.

## XSS and CSRF

- The API is JSON-only; no server-rendered HTML with user content is produced.
- Phoenix sets `x-content-type-options: nosniff` and `content-security-policy` headers by default.
- The frontend sanitises any user-generated content before rendering.
- Non-GET API requests require a valid session cookie. The SameSite=Lax policy prevents cross-site form submissions from carrying the cookie.

## File Uploads

- Maximum file size: 25 MB per file (configurable via `MAX_UPLOAD_BYTES`).
- Uploaded files are validated by MIME type against an allowlist.
- Files are stored in S3-compatible object storage (LocalStack locally, real S3/R2 in production), not on the application server's local filesystem.
- Presigned URLs are used to serve files; the application server does not proxy file downloads.

## Rate Limiting

- Rate limiting is applied to: the OAuth callback endpoint, invite consumption, message sending, and file upload endpoints.

## Secrets and Logging

- All secrets are loaded from environment variables. No secrets appear in source code.
- Logs filter out sensitive parameters (`password`, `token`, cookie values).
- Errors returned to clients are generic; internal details are logged server-side only.

## Transport Security

- In production, HTTPS is required and enforced via `force_ssl` in Phoenix configuration.
- WebRTC (LiveKit) also requires HTTPS in production.

## CORS

- CORS is restricted to the configured `FRONTEND_URL` origin.

---

## Reporting Security Issues

This is a private application. If you discover a security issue, contact the repository owner directly rather than opening a public issue.
