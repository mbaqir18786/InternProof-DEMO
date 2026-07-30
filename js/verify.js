/**
 * InternProof — Company Mentor Verification Page
 * ================================================
 * Reads `token` (and optional `decision`) from the URL query string.
 *
 * Flow:
 *   1. Parse token from URL.
 *   2. If `decision` is already in the URL (one-click email link), submit immediately.
 *   3. Otherwise, fetch submission details from Apps Script and render the form.
 *   4. On button click, POST the decision back to Apps Script via API.verifyToken().
 */

document.addEventListener('DOMContentLoaded', async () => {

  // ----------------------------------------------------------------
  // STATE ELEMENTS
  // ----------------------------------------------------------------
  const stateLoading = document.getElementById('stateLoading');
  const stateError   = document.getElementById('stateError');
  const stateSuccess = document.getElementById('stateSuccess');
  const stateForm    = document.getElementById('stateForm');

  const btnApprove   = document.getElementById('btnApprove');
  const btnFlag      = document.getElementById('btnFlag');
  const remarksInput = document.getElementById('verifyRemarks');

  // ----------------------------------------------------------------
  // HELPERS
  // ----------------------------------------------------------------
  function showState(name) {
    [stateLoading, stateError, stateSuccess, stateForm].forEach(el => {
      el.style.display = 'none';
    });
    document.getElementById('state' + name).style.display = 'block';
  }

  function showError(title, message) {
    document.getElementById('errorTitle').textContent   = title;
    document.getElementById('errorMessage').textContent = message;
    showState('Error');
  }

  function showSuccess(approved) {
    const icon    = document.getElementById('successIcon');
    const title   = document.getElementById('successTitle');
    const message = document.getElementById('successMessage');

    if (approved) {
      icon.textContent    = '✓';
      icon.className      = 'verify-result-icon success';
      title.textContent   = 'Internship Verified Successfully';
      message.textContent = 'Thank you for confirming. The student will be notified and their submission will proceed to Faculty review.';
    } else {
      icon.textContent    = '⚠';
      icon.className      = 'verify-result-icon error';
      title.textContent   = 'Discrepancy Flagged';
      message.textContent = 'Your response has been recorded. The student and their TPO will be notified of the discrepancy.';
    }

    showState('Success');
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast     = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'info';
    if (type === 'success') icon = 'check-circle-2';
    if (type === 'error')   icon = 'alert-circle';

    toast.innerHTML = `
      <i data-lucide="${icon}" style="width:18px;height:18px;flex-shrink:0;"></i>
      <span>${message}</span>
    `;
    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity   = '0';
      toast.style.transform = 'translateY(12px) scale(0.95)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function setButtonsDisabled(disabled) {
    btnApprove.disabled = disabled;
    btnFlag.disabled    = disabled;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(str || ''));
    return d.innerHTML;
  }

  // ----------------------------------------------------------------
  // PARSE URL PARAMS
  // ----------------------------------------------------------------
  const params   = new URLSearchParams(window.location.search);
  const token    = params.get('token')    || '';
  const decisionParam = params.get('decision') || ''; // 'approve' or 'flag' (one-click)

  if (!token) {
    showError('No Token Found', 'This verification link is missing a required security token. Please use the exact link from the email sent by InternProof.');
    return;
  }

  // ----------------------------------------------------------------
  // ONE-CLICK DIRECT DECISION (approve / flag from email button)
  // ----------------------------------------------------------------
  if (decisionParam === 'approve' || decisionParam === 'flag') {
    showState('Loading');
    await submitDecision(decisionParam, '');
    return;
  }

  // ----------------------------------------------------------------
  // FETCH SUBMISSION DETAILS (to populate the form)
  // ----------------------------------------------------------------
  showState('Loading');

  if (!API.IS_LIVE) {
    // Offline / local mode — we can't look up by token without backend.
    // Show form with placeholder message.
    document.getElementById('mentorNameDisplay').textContent = 'Supervisor';
    document.getElementById('detailSubmissionId').textContent = 'LOCAL-MODE';
    document.getElementById('detailStudentName').textContent  = 'N/A (Offline Mode)';
    document.getElementById('detailRollNumber').textContent   = 'N/A';
    document.getElementById('detailDepartment').textContent   = 'N/A';
    document.getElementById('detailCompany').textContent      = 'N/A';
    document.getElementById('detailRole').textContent         = 'N/A';
    document.getElementById('detailDuration').textContent     = 'N/A';
    document.getElementById('detailCertLink').href            = '#';
    showState('Form');
    showToast('Offline mode: decisions will not be saved without Apps Script.', 'info');
    attachButtonListeners();
    return;
  }

  try {
    const json = await API.getSubmissionByToken(token);

    if (!json.success) {
      showError('Link Invalid or Expired', json.error || 'This verification link is no longer valid.');
      return;
    }

    populateForm(json.data);
    showState('Form');
    attachButtonListeners();

  } catch (err) {
    // If Apps Script URL not configured, still show the form (token will be validated on submit)
    populateForm(null);
    showState('Form');
    attachButtonListeners();
    showToast('Could not pre-load details. Your decision will still be recorded.', 'info');
  }

  // ----------------------------------------------------------------
  // POPULATE FORM WITH SUBMISSION DATA
  // ----------------------------------------------------------------
  function populateForm(data) {
    if (!data) return;

    const duration = (data.startDate && data.endDate)
      ? `${data.startDate} → ${data.endDate}`
      : '—';

    document.getElementById('mentorNameDisplay').textContent    = escapeHtml(data.mentorName || 'Supervisor');
    document.getElementById('detailSubmissionId').textContent   = escapeHtml(data.submissionId || '');
    document.getElementById('detailStudentName').textContent    = escapeHtml(data.studentName || '—');
    document.getElementById('detailRollNumber').textContent     = escapeHtml(data.rollNumber || '—');
    document.getElementById('detailDepartment').textContent     = escapeHtml(data.department || '—');
    document.getElementById('detailCompany').textContent        = escapeHtml(data.companyName || '—');
    document.getElementById('detailRole').textContent           = escapeHtml(data.roleTitle || '—');
    document.getElementById('detailDuration').textContent       = escapeHtml(duration);

    const certLink = document.getElementById('detailCertLink');
    if (data.certificateLink && data.certificateLink !== '#') {
      certLink.href          = data.certificateLink;
      certLink.style.display = 'inline';
    } else {
      certLink.textContent   = 'Not provided';
      certLink.removeAttribute('href');
      certLink.style.pointerEvents = 'none';
      certLink.style.opacity = '0.5';
    }
  }

  // ----------------------------------------------------------------
  // ATTACH BUTTON LISTENERS
  // ----------------------------------------------------------------
  function attachButtonListeners() {
    btnApprove.addEventListener('click', async () => {
      await submitDecision('approve', remarksInput.value.trim());
    });

    btnFlag.addEventListener('click', async () => {
      const remarks = remarksInput.value.trim();
      if (!remarks) {
        showToast('Please add a brief remark describing the discrepancy before flagging.', 'error');
        remarksInput.focus();
        return;
      }
      await submitDecision('flag', remarks);
    });
  }

  // ----------------------------------------------------------------
  // SUBMIT DECISION TO APPS SCRIPT
  // ----------------------------------------------------------------
  async function submitDecision(decision, remarks) {
    setButtonsDisabled(true);
    showState('Loading');

    try {
      const result = await API.verifyToken(token, decision, remarks);

      if (!result.success) {
        showError(
          result.error === 'This verification link has already been used.'
            ? 'Already Used'
            : 'Verification Failed',
          result.error || 'An error occurred. Please contact the TPO office.'
        );
        return;
      }

      showSuccess(decision === 'approve');

    } catch (err) {
      showError(
        'Connection Error',
        'Could not connect to the verification server. Please try again or contact the TPO office directly.'
      );
    }
  }

});
