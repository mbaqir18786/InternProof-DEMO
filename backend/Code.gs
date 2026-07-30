/**
 * InternProof — Google Apps Script Backend
 * ===========================================
 * Deployed as a Web App (Execute as: Me | Access: Anyone)
 *
 * Handles:
 *   doPost → New submission (writes to Sheets, sends mentor email)
 *   doPost → Status update (faculty approve/reject, TPO grant credits)
 *   doGet  → Read submissions (dashboard), get status (student tracker)
 *   doGet  → Company mentor token verification (approve / flag)
 *
 * SETUP STEPS:
 *   1. Create a new Google Sheet with 3 tabs:
 *      - "Submissions"
 *      - "VerificationTokens"
 *      - "ActivityAuditLog"
 *   2. Paste the Spreadsheet ID below (from the URL bar of your sheet).
 *   3. Set VERIFY_BASE_URL to your GitHub Pages URL + "/verify.html"
 *   4. Deploy as Web App → Copy the Web App URL → paste into js/api.js
 */

// ============================================================
// CONFIGURATION — FILL THESE IN
// ============================================================
const SPREADSHEET_ID  = '17rqWy88hiRd6PpNe6WLiSxbf0dW5m-TLptj4x7UJlvU';
const VERIFY_BASE_URL = 'https://mbaqir18786.github.io/InternProof-DEMO/verify.html';

// Sheet tab names (must match exactly)
const SHEET_SUBMISSIONS = 'Submissions';
const SHEET_TOKENS      = 'VerificationTokens';
const SHEET_AUDIT       = 'ActivityAuditLog';

// ============================================================
// CORS HEADERS — Required for browser fetch() calls
// ============================================================
function setCorsHeaders(output) {
  return output;
}

function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

// ============================================================
// doPost — Handles form submission and status updates
// ============================================================
function doPost(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    const payload = JSON.parse(e.postData.contents);
    const action  = payload.action;

    if (action === 'submit') {
      const result = handleNewSubmission(payload.data);
      output.setContent(JSON.stringify(result));

    } else if (action === 'updateStatus') {
      const result = handleStatusUpdate(payload.data);
      output.setContent(JSON.stringify(result));

    } else {
      output.setContent(JSON.stringify({ success: false, error: 'Unknown action.' }));
    }

  } catch (err) {
    output.setContent(JSON.stringify({ success: false, error: err.message }));
  }

  return output;
}

// ============================================================
// doGet — Handles dashboard reads, student status, company verify
// ============================================================
function doGet(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    const action = e.parameter.action;

    if (action === 'getSubmissions') {
      // Dashboard: returns all submissions as JSON array
      output.setContent(JSON.stringify(getAllSubmissions()));

    } else if (action === 'getStatus') {
      // Student tracker: looks up by roll number + optional submission ID
      const roll = e.parameter.roll || '';
      const id   = e.parameter.id   || '';
      output.setContent(JSON.stringify(getSubmissionStatus(roll, id)));

    } else if (action === 'getSubmissionByToken') {
      // Verify.html pre-fill: return submission details for a valid, unused token
      const token = e.parameter.token || '';
      output.setContent(JSON.stringify(getSubmissionByToken(token)));

    } else if (action === 'verifyToken') {
      // Company mentor clicked their email link
      const token    = e.parameter.token    || '';
      const decision = e.parameter.decision || ''; // 'approve' or 'flag'
      const remarks  = e.parameter.remarks  || '';
      output.setContent(JSON.stringify(handleCompanyVerification(token, decision, remarks)));

    } else {
      output.setContent(JSON.stringify({ success: false, error: 'Unknown action.' }));
    }

  } catch (err) {
    output.setContent(JSON.stringify({ success: false, error: err.message }));
  }

  return output;
}

// ============================================================
// HANDLER: New Submission
// ============================================================
function handleNewSubmission(data) {
  const ss          = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetSub    = ss.getSheetByName(SHEET_SUBMISSIONS);
  const sheetTokens = ss.getSheetByName(SHEET_TOKENS);
  const sheetAudit  = ss.getSheetByName(SHEET_AUDIT);

  // Generate unique IDs
  const submissionId = generateSubmissionId();
  const token        = generateToken();
  const now          = new Date();

  // Ensure header rows exist (first time only)
  ensureSubmissionsHeader(sheetSub);
  ensureTokensHeader(sheetTokens);
  ensureAuditHeader(sheetAudit);

  // Write to Submissions sheet
  sheetSub.appendRow([
    submissionId,                   // A: SubmissionID
    now,                            // B: Timestamp
    data.studentName    || '',      // C: StudentName
    data.rollNumber     || '',      // D: RollNumber
    data.studentEmail   || '',      // E: StudentEmail
    data.department     || '',      // F: Department
    data.internshipType || '',      // G: InternshipType
    data.companyName    || '',      // H: CompanyName
    data.roleTitle      || '',      // I: RoleTitle
    data.startDate      || '',      // J: StartDate
    data.endDate        || '',      // K: EndDate
    data.mentorName     || '',      // L: MentorName
    data.mentorEmail    || '',      // M: MentorEmail
    data.certificateLink || '',     // N: OfferLetterLink
    'Pending',                      // O: Status_Company
    'Pending',                      // P: Status_Faculty
    'Pending',                      // Q: Status_TPO
    '',                             // R: Remarks_Company
    '',                             // S: Remarks_Faculty
    '',                             // T: Remarks_TPO
    now                             // U: LastUpdated
  ]);

  // Write verification token
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
  sheetTokens.appendRow([
    token,        // A: Token
    submissionId, // B: SubmissionID
    expiresAt,    // C: ExpirationDate
    'FALSE'       // D: IsUsed
  ]);

  // Audit log entry
  sheetAudit.appendRow([
    generateLogId(),
    now,
    data.studentEmail || 'student',
    'Submission Created',
    submissionId
  ]);

  // Send branded verification email to company mentor
  sendMentorVerificationEmail(data, submissionId, token);

  // Send registration confirmation email to the student with their Submission ID
  sendStudentConfirmationEmail(data, submissionId);

  return {
    success:      true,
    submissionId: submissionId,
    message:      'Submission recorded. Verification email sent to ' + data.mentorEmail + '.'
  };
}

// ============================================================
// HANDLER: Status Update (Faculty / TPO actions from dashboard)
// ============================================================
function handleStatusUpdate(data) {
  const ss       = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet    = ss.getSheetByName(SHEET_SUBMISSIONS);
  const audit    = ss.getSheetByName(SHEET_AUDIT);
  const rows     = sheet.getDataRange().getValues();
  const now      = new Date();

  // Column indices (0-based, row[0] is header)
  const COL = { ID: 0, STATUS_CO: 14, STATUS_FA: 15, STATUS_TPO: 16,
                REM_CO: 17, REM_FA: 18, REM_TPO: 19, UPDATED: 20 };

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][COL.ID] === data.submissionId) {
      const rowNum = i + 1; // 1-based for Sheets API

      if (data.statusField === 'statusFaculty') {
        sheet.getRange(rowNum, COL.STATUS_FA + 1).setValue(data.newStatus);
        sheet.getRange(rowNum, COL.REM_FA + 1).setValue(data.remarks || '');
      } else if (data.statusField === 'statusTpo') {
        sheet.getRange(rowNum, COL.STATUS_TPO + 1).setValue(data.newStatus);
        sheet.getRange(rowNum, COL.REM_TPO + 1).setValue(data.remarks || '');
      }

      sheet.getRange(rowNum, COL.UPDATED + 1).setValue(now);

      // Audit log
      audit.appendRow([
        generateLogId(), now,
        data.actor || 'admin',
        data.statusField + ' → ' + data.newStatus,
        data.submissionId
      ]);

      return { success: true };
    }
  }

  return { success: false, error: 'Submission not found.' };
}

// ============================================================
// HANDLER: Company Mentor Token Verification (via email link)
// ============================================================
function handleCompanyVerification(token, decision, remarks) {
  const ss          = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetTokens = ss.getSheetByName(SHEET_TOKENS);
  const sheetSub    = ss.getSheetByName(SHEET_SUBMISSIONS);
  const sheetAudit  = ss.getSheetByName(SHEET_AUDIT);
  const now         = new Date();

  // Look up token
  const tokenRows = sheetTokens.getDataRange().getValues();
  let submissionId = null;
  let tokenRowNum  = null;

  for (let i = 1; i < tokenRows.length; i++) {
    if (tokenRows[i][0] === token) {
      // Check expiry and not already used
      const expiresAt = new Date(tokenRows[i][2]);
      const isUsed    = tokenRows[i][3].toString() === 'TRUE';

      if (isUsed)              return { success: false, error: 'This verification link has already been used.' };
      if (now > expiresAt)     return { success: false, error: 'This verification link has expired. Please contact the student to resend.' };

      submissionId = tokenRows[i][1];
      tokenRowNum  = i + 1;
      break;
    }
  }

  if (!submissionId) return { success: false, error: 'Invalid verification token.' };

  // Mark token as used
  sheetTokens.getRange(tokenRowNum, 4).setValue('TRUE');

  // Update submission status
  const subRows = sheetSub.getDataRange().getValues();
  const COL = { ID: 0, STATUS_CO: 14, REM_CO: 17, UPDATED: 20,
                STUDENT_NAME: 2, STUDENT_EMAIL: 4, COMPANY: 7, ROLE: 8 };

  for (let i = 1; i < subRows.length; i++) {
    if (subRows[i][COL.ID] === submissionId) {
      const rowNum      = i + 1;
      const newStatus   = (decision === 'approve') ? 'Verified' : 'Flagged';

      sheetSub.getRange(rowNum, COL.STATUS_CO + 1).setValue(newStatus);
      sheetSub.getRange(rowNum, COL.REM_CO + 1).setValue(remarks || '');
      sheetSub.getRange(rowNum, COL.UPDATED + 1).setValue(now);

      // Audit log
      sheetAudit.appendRow([
        generateLogId(), now,
        'company_mentor',
        'Company ' + newStatus,
        submissionId
      ]);

      // Notify the student by email
      const studentEmail = subRows[i][COL.STUDENT_EMAIL];
      const studentName  = subRows[i][COL.STUDENT_NAME];
      sendStudentStatusEmail(studentEmail, studentName, submissionId, newStatus, remarks);

      return {
        success: true,
        status:  newStatus,
        message: newStatus === 'Verified'
          ? 'Thank you! The internship has been verified successfully.'
          : 'Your response has been recorded. The student will be notified.'
      };
    }
  }

  return { success: false, error: 'Submission record not found for this token.' };
}

// ============================================================
// READ: Submission details by token (for verify.html pre-fill)
// Does NOT consume the token.
// ============================================================
function getSubmissionByToken(token) {
  if (!token) return { success: false, error: 'No token provided.' };

  const ss          = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetTokens = ss.getSheetByName(SHEET_TOKENS);
  const sheetSub    = ss.getSheetByName(SHEET_SUBMISSIONS);
  const now         = new Date();

  const tokenRows = sheetTokens.getDataRange().getValues();
  let submissionId = null;

  for (let i = 1; i < tokenRows.length; i++) {
    if (tokenRows[i][0] === token) {
      const expiresAt = new Date(tokenRows[i][2]);
      const isUsed    = tokenRows[i][3].toString() === 'TRUE';

      if (isUsed)          return { success: false, error: 'This verification link has already been used.' };
      if (now > expiresAt) return { success: false, error: 'This verification link has expired.' };

      submissionId = tokenRows[i][1];
      break;
    }
  }

  if (!submissionId) return { success: false, error: 'Invalid verification token.' };

  // Fetch the matching submission
  const subRows = sheetSub.getDataRange().getValues();
  for (let i = 1; i < subRows.length; i++) {
    if (subRows[i][0] === submissionId) {
      const r = subRows[i];
      return {
        success: true,
        data: {
          submissionId:    r[0],
          studentName:     r[2],
          rollNumber:      r[3],
          studentEmail:    r[4],
          department:      r[5],
          internshipType:  r[6],
          companyName:     r[7],
          roleTitle:       r[8],
          startDate:       r[9],
          endDate:         r[10],
          mentorName:      r[11],
          mentorEmail:     r[12],
          certificateLink: r[13],
          statusCompany:   r[14]
        }
      };
    }
  }

  return { success: false, error: 'Submission record not found for this token.' };
}

// ============================================================
// READ: All Submissions (for dashboard)
// ============================================================
function getAllSubmissions() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_SUBMISSIONS);
  const rows  = sheet.getDataRange().getValues();

  if (rows.length <= 1) return { success: true, data: [] };

  const headers = rows[0];
  const data = rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[toCamelCase(h)] = row[i]; });
    return obj;
  });

  return { success: true, data: data };
}

// ============================================================
// READ: Single Submission Status (for student tracker)
// ============================================================
function getSubmissionStatus(roll, id) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_SUBMISSIONS);
  const rows  = sheet.getDataRange().getValues();

  // Filter by roll number
  const matches = rows.slice(1).filter(r => String(r[3]) === String(roll));
  if (matches.length === 0) return { success: false, error: 'No submission found for this roll number.' };

  let record = null;
  if (id) {
    record = matches.find(r => r[0] === id) || null;
    if (!record) return { success: false, error: 'No submission found matching that ID.' };
  } else {
    // Most recent submission
    record = matches.sort((a, b) => new Date(b[1]) - new Date(a[1]))[0];
  }

  return {
    success: true,
    data: {
      submissionId:    record[0],
      timestamp:       record[1],
      studentName:     record[2],
      rollNumber:      record[3],
      studentEmail:    record[4],
      department:      record[5],
      internshipType:  record[6],
      companyName:     record[7],
      roleTitle:       record[8],
      startDate:       record[9],
      endDate:         record[10],
      mentorName:      record[11],
      mentorEmail:     record[12],
      certificateLink: record[13],
      statusCompany:   record[14],
      statusFaculty:   record[15],
      statusTpo:       record[16],
      remarksCompany:  record[17],
      remarksFaculty:  record[18],
      remarksTpo:      record[19],
      lastUpdated:     record[20]
    }
  };
}

// ============================================================
// EMAIL: Branded Mentor Verification Email
// ============================================================
function sendMentorVerificationEmail(data, submissionId, token) {
  const verifyUrl = VERIFY_BASE_URL
    + '?token=' + encodeURIComponent(token)
    + '&id='    + encodeURIComponent(submissionId);

  const approveUrl = verifyUrl + '&decision=approve';
  const flagUrl    = verifyUrl + '&decision=flag';

  const subject = '[InternProof] Please verify: ' + data.studentName + ' — ' + data.roleTitle;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background-color: #FAFAFA; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; }
    .wrapper { max-width: 580px; margin: 32px auto; background: #FFFFFF; border: 1px solid #EAEAEA; border-radius: 12px; overflow: hidden; }
    .header { background-color: #B7202E; padding: 28px 40px; }
    .header-logo { color: #FFFFFF; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
    .header-logo span { opacity: 0.85; }
    .header-sub { color: rgba(255,255,255,0.8); font-size: 13px; margin-top: 4px; }
    .body { padding: 36px 40px; }
    .greeting { font-size: 15px; color: #1A1A1A; margin-bottom: 16px; line-height: 1.5; }
    .info-table { width: 100%; border-collapse: collapse; margin: 24px 0; border: 1px solid #EAEAEA; border-radius: 8px; overflow: hidden; }
    .info-table th { background-color: #FAFAFA; text-align: left; padding: 10px 16px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #8E8E93; border-bottom: 1px solid #EAEAEA; }
    .info-table td { padding: 12px 16px; font-size: 13px; color: #1A1A1A; border-bottom: 1px solid #EAEAEA; }
    .info-table tr:last-child td { border-bottom: none; }
    .info-table td:first-child { color: #8E8E93; font-size: 12px; width: 40%; }
    .cta-section { text-align: center; margin: 32px 0 24px; }
    .btn-verify { display: inline-block; background-color: #B7202E; color: #FFFFFF; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 36px; border-radius: 8px; letter-spacing: -0.01em; }
    .btn-flag { display: inline-block; margin-top: 12px; color: #B7202E; text-decoration: none; font-size: 13px; font-weight: 500; border: 1px solid #EAEAEA; padding: 10px 24px; border-radius: 8px; }
    .note { background-color: #FEF7E0; border: 1px solid #F5D76E; border-radius: 8px; padding: 14px 18px; font-size: 12px; color: #7A5A00; margin-top: 24px; line-height: 1.6; }
    .footer { background-color: #FAFAFA; border-top: 1px solid #EAEAEA; padding: 20px 40px; text-align: center; }
    .footer p { font-size: 11px; color: #8E8E93; margin: 4px 0; }
    .id-pill { display: inline-block; background: #F1F1F1; border-radius: 4px; padding: 2px 8px; font-size: 12px; font-family: monospace; color: #4A4A4A; }
  </style>
</head>
<body>
  <div class="wrapper">
    
    <!-- HEADER -->
    <div class="header">
      <div class="header-logo">Intern<span>Proof</span></div>
      <div class="header-sub">Somaiya Vidyavihar University — Training & Placement Office</div>
    </div>

    <!-- BODY -->
    <div class="body">
      <p class="greeting">
        Dear <strong>${data.mentorName || 'Sir/Madam'}</strong>,<br><br>
        A student from <strong>Somaiya Vidyavihar University</strong> has listed you as their internship supervisor.
        We kindly request you to verify the internship details below and confirm their accuracy.
      </p>

      <!-- Details Table -->
      <table class="info-table">
        <tr><th colspan="2">Internship Details &nbsp; <span class="id-pill">${submissionId}</span></th></tr>
        <tr><td>Student Name</td><td><strong>${data.studentName}</strong></td></tr>
        <tr><td>Roll Number</td><td>${data.rollNumber}</td></tr>
        <tr><td>Department</td><td>${data.department}</td></tr>
        <tr><td>Organization</td><td>${data.companyName}</td></tr>
        <tr><td>Role / Position</td><td>${data.roleTitle}</td></tr>
        <tr><td>Duration</td><td>${data.startDate} to ${data.endDate}</td></tr>
        <tr><td>Offer Letter</td><td><a href="${data.certificateLink || '#'}" style="color:#B7202E;">View Document</a></td></tr>
      </table>

      <!-- CTA Buttons -->
      <div class="cta-section">
        <p style="font-size:13px; color:#4A4A4A; margin-bottom: 20px;">
          Please click one of the buttons below to confirm or dispute the details above.
        </p>
        <div>
          <a href="${approveUrl}" class="btn-verify">✓ &nbsp; Confirm & Verify Details</a>
        </div>
        <div>
          <a href="${flagUrl}" class="btn-flag">⚠ &nbsp; Flag a Discrepancy</a>
        </div>
      </div>

      <!-- Notice -->
      <div class="note">
        <strong>Note:</strong> This verification link is valid for <strong>7 days</strong>.
        If you did not supervise this student, please ignore this email or click "Flag a Discrepancy"
        and mention the issue in the remarks field.
      </div>
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <p><strong>Somaiya Vidyavihar University</strong> — Training & Placement Office</p>
      <p>Vidyavihar (East), Mumbai, Maharashtra 400 077</p>
      <p style="margin-top: 8px;">This is an automated email from InternProof. Please do not reply to this email.</p>
    </div>

  </div>
</body>
</html>`;

  GmailApp.sendEmail(data.mentorEmail, subject, '', { htmlBody: html });
}

// ============================================================
// EMAIL: Student Status Notification
// ============================================================
function sendStudentStatusEmail(studentEmail, studentName, submissionId, status, remarks) {
  const isVerified = status === 'Verified';
  const subject = '[InternProof] Your internship has been '
    + (isVerified ? 'verified ✓' : 'flagged ⚠') + ' — ' + submissionId;

  const statusColor  = isVerified ? '#10B981' : '#EF4444';
  const statusLabel  = isVerified ? '✓ Company Verified' : '⚠ Discrepancy Flagged';
  const statusMsg    = isVerified
    ? 'Your company supervisor has confirmed your internship details. Your submission is now progressing to Faculty review.'
    : 'Your company supervisor has flagged a discrepancy in your submission. Please review the remarks below and contact your TPO office.';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { margin: 0; padding: 0; background-color: #FAFAFA; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; }
    .wrapper { max-width: 580px; margin: 32px auto; background: #FFFFFF; border: 1px solid #EAEAEA; border-radius: 12px; overflow: hidden; }
    .header { background-color: #B7202E; padding: 28px 40px; }
    .header-logo { color: #FFFFFF; font-size: 20px; font-weight: 700; }
    .header-logo span { opacity: 0.85; }
    .body { padding: 36px 40px; }
    .status-pill { display: inline-block; background: ${statusColor}; color: white; font-size: 13px; font-weight: 600; padding: 8px 18px; border-radius: 99px; margin: 16px 0; }
    .footer { background: #FAFAFA; border-top: 1px solid #EAEAEA; padding: 20px 40px; text-align: center; }
    .footer p { font-size: 11px; color: #8E8E93; margin: 4px 0; }
    .remarks-box { background: #FEF7E0; border-left: 4px solid #F5C400; padding: 14px 18px; border-radius: 0 8px 8px 0; font-size: 13px; color: #1A1A1A; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="header-logo">Intern<span>Proof</span></div>
    </div>
    <div class="body">
      <p style="font-size:15px; color:#1A1A1A;">Dear <strong>${studentName}</strong>,</p>
      <div class="status-pill">${statusLabel}</div>
      <p style="font-size:14px; color:#4A4A4A; line-height:1.6;">${statusMsg}</p>
      ${remarks ? `<div class="remarks-box"><strong>Supervisor Remarks:</strong><br>${remarks}</div>` : ''}
      <p style="font-size:13px; color:#8E8E93; margin-top:24px;">
        Submission ID: <code>${submissionId}</code><br>
        Track your status anytime at the InternProof portal.
      </p>
    </div>
    <div class="footer">
      <p><strong>Somaiya Vidyavihar University</strong> — Training & Placement Office</p>
      <p>This is an automated message. Do not reply.</p>
    </div>
  </div>
</body>
</html>`;

  GmailApp.sendEmail(studentEmail, subject, '', { htmlBody: html });
}

// ============================================================
// EMAIL: Student Registration Confirmation & Submission ID
// ============================================================
function sendStudentConfirmationEmail(data, submissionId) {
  const subject = '[InternProof] Internship Registered Successfully — ' + submissionId;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { margin: 0; padding: 0; background-color: #FAFAFA; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; }
    .wrapper { max-width: 580px; margin: 32px auto; background: #FFFFFF; border: 1px solid #EAEAEA; border-radius: 12px; overflow: hidden; }
    .header { background-color: #B7202E; padding: 28px 40px; }
    .header-logo { color: #FFFFFF; font-size: 20px; font-weight: 700; }
    .header-logo span { opacity: 0.85; }
    .body { padding: 36px 40px; }
    .footer { background: #FAFAFA; border-top: 1px solid #EAEAEA; padding: 20px 40px; text-align: center; }
    .footer p { font-size: 11px; color: #8E8E93; margin: 4px 0; }
    .id-box { background: #F8F9FA; border: 1px solid #EAEAEA; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0; }
    .id-text { font-family: monospace; font-size: 20px; font-weight: bold; color: #B7202E; letter-spacing: 1px; }
    .detail-list { font-size: 13px; color: #4A4A4A; line-height: 1.6; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="header-logo">Intern<span>Proof</span></div>
    </div>
    <div class="body">
      <p style="font-size:15px; color:#1A1A1A;">Dear <strong>${data.studentName}</strong>,</p>
      <p style="font-size:14px; color:#4A4A4A; line-height:1.6;">
        Your internship verification request has been registered on the InternProof portal. 
        An automated verification link has been sent to your supervisor: <strong>${data.mentorName} (${data.mentorEmail})</strong>.
      </p>
      
      <div class="id-box">
        <p style="margin:0 0 6px 0; font-size:12px; color:#8E8E93; text-transform:uppercase; font-weight:600;">Your Submission ID</p>
        <div class="id-text">${submissionId}</div>
      </div>
      
      <p style="font-size:14px; color:#4A4A4A; line-height:1.6;">
        <strong>Keep this ID safe.</strong> You will need your Roll Number and this Submission ID to track your approval status on the portal.
      </p>
      
      <div class="detail-list">
        <strong>Registered Details:</strong><br>
        • Company: ${data.companyName}<br>
        • Position: ${data.roleTitle}<br>
        • Duration: ${data.startDate} to ${data.endDate}
      </div>
    </div>
    <div class="footer">
      <p><strong>Somaiya Vidyavihar University</strong> — Training & Placement Office</p>
      <p>This is an automated message. Do not reply.</p>
    </div>
  </div>
</body>
</html>`;

  GmailApp.sendEmail(data.studentEmail, subject, '', { htmlBody: html });
}

// ============================================================
// UTILITIES
// ============================================================

function generateSubmissionId() {
  const year   = new Date().getFullYear();
  const suffix = Math.floor(10000 + Math.random() * 90000);
  return 'IP-' + year + '-' + suffix;
}

function generateToken() {
  const chars  = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

function generateLogId() {
  return 'L-' + Math.floor(100000 + Math.random() * 900000);
}

function toCamelCase(str) {
  return str
    .toLowerCase()
    .replace(/[_\s](.)/g, (_, c) => c.toUpperCase())
    .replace(/^[A-Z]/, c => c.toLowerCase());
}

// ============================================================
// SHEET HEADER INITIALIZERS (run once automatically)
// ============================================================

function ensureSubmissionsHeader(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'SubmissionID', 'Timestamp', 'StudentName', 'RollNumber', 'StudentEmail',
      'Department', 'InternshipType', 'CompanyName', 'RoleTitle', 'StartDate', 'EndDate',
      'MentorName', 'MentorEmail', 'OfferLetterLink',
      'Status_Company', 'Status_Faculty', 'Status_TPO',
      'Remarks_Company', 'Remarks_Faculty', 'Remarks_TPO', 'LastUpdated'
    ]);
  }
}

function ensureTokensHeader(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Token', 'SubmissionID', 'ExpirationDate', 'IsUsed']);
  }
}

function ensureAuditHeader(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['LogID', 'Timestamp', 'Actor', 'Action', 'SubmissionID']);
  }
}
