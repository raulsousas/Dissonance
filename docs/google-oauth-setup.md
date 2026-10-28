# Google OAuth 2.0 Setup

This guide walks you through creating Google OAuth 2.0 credentials so users can sign in to Guilda with their Google account.

---

## Prerequisites

- A Google account with access to [Google Cloud Console](https://console.cloud.google.com/).
- The Guilda backend running and accessible at a known URL.

---

## Step 1 — Create a Google Cloud Project

1. Go to [https://console.cloud.google.com/](https://console.cloud.google.com/).
2. Click the project selector in the top navigation bar.
3. Click **New Project**.
4. Name it (e.g., `Guilda`) and click **Create**.
5. Make sure the new project is selected in the project selector.

---

## Step 2 — Enable the Google Identity API

1. In the left sidebar, go to **APIs & Services → Library**.
2. Search for **"Google Identity"** or **"OAuth"**.
3. Select **Google Identity Toolkit API** (or just verify it's already enabled under **APIs & Services → Enabled APIs**).
   - The core OAuth 2.0 / OpenID Connect endpoints are always available; no specific API needs enabling beyond having an OAuth consent screen configured.

---

## Step 3 — Configure the OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**.
2. Choose **External** (so any Google account can be used — access is controlled by Guilda's allowlist, not Google).
3. Fill in:
   - **App name:** `Guilda`
   - **User support email:** your email address
   - **Developer contact information:** your email address
4. Click **Save and Continue**.
5. On the **Scopes** screen, click **Add or Remove Scopes** and add:
   - `openid`
   - `email`
   - `profile`
6. Click **Update**, then **Save and Continue**.
7. On the **Test Users** screen: if your app is in **Testing** mode, add the email addresses of users who should be able to log in during testing. In **Production** mode this is not required.
8. Click **Save and Continue**, then **Back to Dashboard**.

> **Publishing status:** While developing locally, leave the app in **Testing** mode. Before sharing with friends, click **Publish App** to move it to Production. In Testing mode only explicitly added test users can complete the OAuth flow.

---

## Step 4 — Create OAuth 2.0 Credentials

1. Go to **APIs & Services → Credentials**.
2. Click **Create Credentials → OAuth 2.0 Client ID**.
3. Set **Application type** to **Web application**.
4. Name it (e.g., `Guilda Web`).
5. Under **Authorized redirect URIs**, click **Add URI** and add:

   | Environment | URI |
   |---|---|
   | Local development | `http://localhost:4000/auth/google/callback` |
   | Production | `https://your-domain.com/auth/google/callback` |

6. Click **Create**.
7. Copy the **Client ID** and **Client Secret** shown in the dialog.

---

## Step 5 — Configure Environment Variables

Open your `.env` file (copied from `.env.example`) and fill in:

```dotenv
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET
GOOGLE_REDIRECT_URI=http://localhost:4000/auth/google/callback
```

Replace `http://localhost:4000` with your production domain when deploying.

---

## Common Errors

| Error | Cause | Fix |
|---|---|---|
| `redirect_uri_mismatch` | The redirect URI in the request doesn't exactly match an authorized URI in Google Cloud Console | Add the exact URI (including scheme and port) in the Cloud Console credentials |
| `access_blocked: This app's request is invalid` | App is in Testing mode and the user is not on the test users list | Add the user to the test users list, or publish the app |
| `Error 400: invalid_request` | Missing or malformed parameters | Check that `GOOGLE_CLIENT_ID` and `GOOGLE_REDIRECT_URI` are set correctly in `.env` |

---

## Security Notes

- Never commit `GOOGLE_CLIENT_SECRET` to version control.
- In production, use HTTPS. Google does not allow `http://` redirect URIs for production applications (only `localhost` is exempt).
- Guilda's allowlist (`FIRST_ADMIN_EMAIL` and the admin panel) controls who can actually use the application. Having a Google account is not enough — users must be on the allowlist.
