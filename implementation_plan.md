# InternProof – Implementation Plan

## Goal
Migrate the frontend from using `localStorage` as a pseudo‑backend to a real backend powered by the Google Apps Script Web App (`backend/Code.gs`).
The new architecture will:
- Send student submissions to the Apps Script endpoint which writes to a Google Sheet and dispatches branded Somaiya‑themed emails.
- Retrieve status information for students via the API.
- Provide the admin dashboard with live data and allow faculty/TPO to update statuses.
- Offer a public verification page (`verify.html`) for company mentors to approve/flag an internship via a secure token.
- Keep an offline fallback (localStorage) for development, automatically activated when the `SCRIPT_URL` in `js/api.js` is empty.

---

## User Review Required
> [!IMPORTANT]
> The deployment URL of the Apps Script Web App must be inserted into `js/api.js` (`SCRIPT_URL` constant). Without this the app will operate in offline mode only.
>
> Verify that the Google Sheet has the required columns (see the **Google Sheet Schema** section in Phase 0) and that the Apps Script project has the necessary OAuth scopes (`https://www.googleapis.com/auth/spreadsheets`, `https://www.googleapis.com/auth/script.send_mail`).
>
> Confirm the branding colors and email template meet the Somaiya style guide before the first live deployment.

---

## Open Questions
> [!WARNING]
> 1. **Domain restriction for mentor emails** – The spec says “no gmail.com emails allowed, only somaiya.edu or other companies”. Should the backend reject any mentor email that ends with `@gmail.com` **and** is *external*? The current Apps Script code only checks for `@somaiya.edu` for internal internships. Please confirm the exact rule.
>
> 2. **Authentication for admin dashboard** – Currently we use static credentials displayed on the login screen (e.g., `faculty@example.com / password123`). Do you want to keep this simple hard‑coded approach, or switch to a Google‑based login (OAuth) later?
>
> 3. **Token lifetime** – How long should a mentor verification token be valid (e.g., 48 h, 7 days)? This influences the `handleCompanyVerification` implementation.

---

## Proposed Changes

### Frontend – API Layer
#### [NEW] `js/api.js`
- Implements a thin wrapper (`API`) exposing the methods used throughout the app:
  - `submitInternship(data)` – POST to `action=submit`.
  - `getStatus(roll, id)` – GET `action=getStatus`.
  - `getSubmissions()` – GET `action=getSubmissions` (admin dashboard).
  - `updateStatus(submissionId, statusField, newStatus, remarks, actor)` – POST `action=updateStatus`.
  - `verifyToken(token, decision, remarks)` – GET `action=verifyToken` (used by `verify.html`).
- Auto‑detects live mode via a non‑empty `SCRIPT_URL`; otherwise falls back to the existing localStorage logic.
- Mirrors successful writes to localStorage for instant UI feedback and offline resilience.

### Student Portal – `js/app.js`
- Remove all direct `localStorage` reads/writes.
- Import `API` from `api.js` and:
  - On final step (submission) call `API.submitInternship(formData)`.
  - On status‑tracker page call `API.getStatus(roll, id)`.
- Adjust UI flow to handle promise rejections (network errors) and display toast messages.
- Keep client‑side validation unchanged.

### Admin Dashboard – `js/dashboard.js`
- Replace the mock data load (`localStorage.getItem('internproof_submissions')`) with `API.getSubmissions()`.
- Replace status‑update actions (faculty/TPO approve/reject) with `API.updateStatus(...)`.
- Refresh the table after each update by re‑fetching the latest data.
- Add a small banner indicating whether the app is in **Live** or **Offline** mode (`API.IS_LIVE`).

### Verify Page – `verify.html` & `js/verify.js`
- New public page that reads URL parameters `token`, `decision` and `remarks`.
- Calls `API.verifyToken(token, decision, remarks)` and displays a friendly success/failure message.
- Uses the same branding (Somaiya red header, white background) as the rest of the app.
- No authentication required – the token itself is the secret.

### Backend – `backend/Code.gs`
- No code changes required at this stage (already supports `submit`, `getStatus`, `getSubmissions`, `verifyToken`).
- Ensure the `handleCompanyVerification` function sanitises the `remarks` field and returns a clear JSON payload.

### Styles – `css/main.css`
- Add a tiny helper class `.live-banner { background:#B7202E; color:#fff; padding:4px 8px; font-size:0.85rem; border-radius:4px; }`.
- No visual redesign needed; just a marker.

---

## Verification Plan
### Automated Tests
- Run the local development server (`python -m http.server 8000`).
- Open `index.html` → complete a full submission flow → verify the response contains a `submissionId` and that the UI shows a success toast.
- Open `dashboard.html` → confirm the new row appears in the table.
- Click the **Approve** button for a submission → ensure the status column updates to `Approved`.
- Open `verify.html?token=TEST123&decision=approve` (use a token generated in the sheet) → verify the page shows a success message.

### Manual Verification
- Deploy the Apps Script as a Web App (Anyone, even anonymous). Copy the URL into `js/api.js`.
- Perform the same flows against the live backend and confirm:
  - Data appears in the Google Sheet.
  - Emails are sent with the Somaiya branding (check Gmail inbox of a test mentor address).
  - Token links in the email open `verify.html` and correctly update the sheet.
- Test the domain restriction rule for mentor emails (try `mentor@gmail.com` – should be blocked).

---

*End of implementation plan.*
