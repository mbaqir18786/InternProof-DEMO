/**
 * InternProof — Admin Dashboard Controller
 * Faculty & TPO verification, approval, and data management.
 *
 * Data source: Google Sheets via Apps Script (API layer in js/api.js).
 * Falls back to localStorage cache when offline.
 * No mock data — only real student entries appear here.
 */

document.addEventListener('DOMContentLoaded', () => {

  // ============================================================
  // CONSTANTS & STATE
  // ============================================================

  // Simple credential store for admin accounts.
  // In production this would be Google Apps Script auth.
  const ADMIN_ACCOUNTS = [
    { email: 'tpo@somaiya.edu',     password: 'tpo2026',     role: 'tpo',     name: 'TPO Office' },
    { email: 'faculty@somaiya.edu', password: 'faculty2026', role: 'faculty', name: 'Faculty Mentor' },
  ];

  // Blocked generic public domains (mirrored from app.js for consistency)
  const PUBLIC_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];

  let currentAdmin = null;  // Set after successful login
  let currentFilter = 'all';
  let activeSubmissionId = null;

  // ============================================================
  // DOM REFERENCES
  // ============================================================
  const loginScreen    = document.getElementById('loginScreen');
  const dashboardScreen = document.getElementById('dashboardScreen');

  const loginForm      = document.getElementById('loginForm');
  const loginEmail     = document.getElementById('loginEmail');
  const loginPassword  = document.getElementById('loginPassword');
  const loginRole      = document.getElementById('loginRole');
  const btnLogin       = document.getElementById('btnLogin');

  const btnLogout      = document.getElementById('btnLogout');
  const btnRefresh     = document.getElementById('btnRefresh');
  const btnExport      = document.getElementById('btnExport');

  const adminAvatarInitial = document.getElementById('adminAvatarInitial');
  const adminDisplayName   = document.getElementById('adminDisplayName');
  const adminDisplayRole   = document.getElementById('adminDisplayRole');

  const tableBody  = document.getElementById('tableBody');
  const tableEmpty = document.getElementById('tableEmpty');
  const tableCount = document.getElementById('tableCount');
  const topbarTitle = document.getElementById('topbarTitle');
  const tableTitle  = document.getElementById('tableTitle');

  const searchInput = document.getElementById('searchInput');
  const deptFilter  = document.getElementById('deptFilter');

  const metricTotal    = document.getElementById('metricTotal');
  const metricPending  = document.getElementById('metricPending');
  const metricVerified = document.getElementById('metricVerified');
  const metricFlagged  = document.getElementById('metricFlagged');

  const badgeAll     = document.getElementById('badgeAll');
  const badgePending = document.getElementById('badgePending');

  // Modal refs
  const detailModal  = document.getElementById('detailModal');
  const modalClose   = document.getElementById('modalClose');
  const actionButtons = document.getElementById('actionButtons');
  const actionRemarks = document.getElementById('actionRemarks');
  const actionSection = document.getElementById('actionSection');

  const navAll     = document.getElementById('navAll');
  const navPending = document.getElementById('navPending');
  const navVerified = document.getElementById('navVerified');
  const navFlagged  = document.getElementById('navFlagged');
  const navApproved = document.getElementById('navApproved');
  const navTpoReady = document.getElementById('navTpoReady');

  // ============================================================
  // ICONS INIT
  // ============================================================
  lucide.createIcons();

  // ============================================================
  // PASSWORD TOGGLE
  // ============================================================
  const togglePasswordBtn = document.getElementById('togglePassword');
  if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener('click', () => {
      const isPassword = loginPassword.type === 'password';
      loginPassword.type = isPassword ? 'text' : 'password';
      togglePasswordBtn.innerHTML = isPassword
        ? '<i data-lucide="eye-off" style="width:16px;height:16px;"></i>'
        : '<i data-lucide="eye" style="width:16px;height:16px;"></i>';
      lucide.createIcons();
    });
  }

  // ============================================================
  // AUTH — LOGIN / LOGOUT
  // ============================================================

  // Check if a session is already saved
  const savedSession = sessionStorage.getItem('internproof_admin');
  if (savedSession) {
    currentAdmin = JSON.parse(savedSession);
    enterDashboard();
  }

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    let valid = true;

    // Validate email ends in @somaiya.edu
    const email = loginEmail.value.trim().toLowerCase();
    const emailGroup = loginEmail.closest('.form-group');
    if (!email.endsWith('@somaiya.edu')) {
      emailGroup.classList.add('has-error');
      valid = false;
    } else {
      emailGroup.classList.remove('has-error');
    }

    // Validate password not empty
    const pass = loginPassword.value;
    const passGroup = loginPassword.closest('.form-group');
    if (!pass) {
      passGroup.classList.add('has-error');
      valid = false;
    } else {
      passGroup.classList.remove('has-error');
    }

    if (!valid) return;

    // Match against known admin accounts
    const match = ADMIN_ACCOUNTS.find(
      a => a.email === email && a.password === pass && a.role === loginRole.value
    );

    if (!match) {
      showToast('Invalid credentials or role selection. Please try again.', 'error');
      return;
    }

    currentAdmin = match;
    sessionStorage.setItem('internproof_admin', JSON.stringify(match));
    enterDashboard();
  });

  btnLogout.addEventListener('click', () => {
    sessionStorage.removeItem('internproof_admin');
    currentAdmin = null;
    dashboardScreen.style.display = 'none';
    loginScreen.style.display = 'flex';
    showToast('Signed out successfully.', 'success');
  });

  function enterDashboard() {
    loginScreen.style.display = 'none';
    dashboardScreen.style.display = 'grid';

    // Populate admin identity in sidebar
    adminDisplayName.textContent = currentAdmin.name;
    adminDisplayRole.textContent = currentAdmin.role === 'tpo' ? 'TPO Administrator' : 'Faculty Mentor';
    adminAvatarInitial.textContent = currentAdmin.name.charAt(0).toUpperCase();

    // Show TPO-only elements
    if (currentAdmin.role === 'tpo') {
      navTpoReady.style.display = 'flex';
      btnExport.style.display = 'flex';
    }

    lucide.createIcons();
    renderDashboard();
  }

  // ============================================================
  // DATA ACCESS — Via API layer (Google Sheets / localStorage fallback)
  // ============================================================

  // Cached in-memory so filtering/search works synchronously between refreshes
  let _submissionsCache = [];

  async function fetchSubmissions() {
    try {
      const result = await API.getSubmissions();
      if (result.success && Array.isArray(result.data)) {
        _submissionsCache = result.data;
        if (result.cached) showToast('Using cached data (network unavailable).', 'info');
      }
    } catch (err) {
      showToast('Could not load submissions. Using local cache.', 'error');
      _submissionsCache = JSON.parse(localStorage.getItem('internproof_submissions') || '[]');
    }
  }

  function getSubmissions() {
    // Synchronous read from in-memory cache
    return _submissionsCache;
  }

  // ============================================================
  // METRICS COMPUTATION
  // ============================================================

  function updateMetrics(submissions) {
    const total    = submissions.length;
    const pending  = submissions.filter(s => s.statusCompany === 'Pending').length;
    const verified = submissions.filter(s => s.statusCompany === 'Verified').length;
    const flagged  = submissions.filter(s => s.statusCompany === 'Flagged').length;

    metricTotal.textContent    = total;
    metricPending.textContent  = pending;
    metricVerified.textContent = verified;
    metricFlagged.textContent  = flagged;

    badgeAll.textContent     = total;
    badgePending.textContent = pending;
  }

  // ============================================================
  // FILTERING LOGIC
  // ============================================================

  function applyFilters(submissions) {
    let filtered = [...submissions];

    // Sidebar view filter
    switch (currentFilter) {
      case 'pending':  filtered = filtered.filter(s => s.statusCompany === 'Pending');  break;
      case 'verified': filtered = filtered.filter(s => s.statusCompany === 'Approved' || s.statusCompany === 'Verified'); break;
      case 'flagged':  filtered = filtered.filter(s => s.statusCompany === 'Flagged');  break;
    }

    // Department filter
    const dept = deptFilter.value;
    if (dept) filtered = filtered.filter(s => s.department === dept);

    // Search query
    const query = searchInput.value.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter(s =>
        s.studentName.toLowerCase().includes(query) ||
        s.rollNumber.includes(query) ||
        s.companyName.toLowerCase().includes(query)
      );
    }

    return filtered;
  }

  // ============================================================
  // TABLE RENDERING
  // ============================================================

  async function renderDashboard() {
    await fetchSubmissions();
    const all      = getSubmissions();
    const filtered = applyFilters(all);

    updateMetrics(all);
    renderTable(filtered);
  }

  function renderTable(rows) {
    tableBody.innerHTML = '';

    if (rows.length === 0) {
      document.getElementById('submissionsTable').style.display = 'none';
      tableEmpty.style.display = 'block';
      tableCount.textContent = 'No records found';
      lucide.createIcons();
      return;
    }

    document.getElementById('submissionsTable').style.display = 'table';
    tableEmpty.style.display = 'none';

    rows.forEach(sub => {
      const tr = document.createElement('tr');
      tr.dataset.id = sub.submissionId;

      const dateStr = new Date(sub.timestamp).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: '2-digit'
      });

      const typeLabel = sub.internshipType === 'internal' ? 'Internal' : 'External';

      tr.innerHTML = `
        <td>
          <div class="cell-name">
            ${escapeHtml(sub.studentName)}
            <span class="cell-name-sub">${escapeHtml(sub.rollNumber)}</span>
          </div>
        </td>
        <td>${escapeHtml(sub.department)}</td>
        <td>
          <div class="cell-name">
            ${escapeHtml(sub.companyName)}
            <span class="cell-name-sub">${escapeHtml(sub.roleTitle)}</span>
          </div>
        </td>
        <td><span class="badge ${sub.internshipType === 'internal' ? 'badge-warning' : 'badge-success'}">${typeLabel}</span></td>
        <td>${statusBadge(sub.statusCompany)}</td>
        <td style="color: var(--text-muted); font-size: 12px;">${dateStr}</td>
        <td>
          <div class="cell-actions">
            <button class="btn btn-secondary btn-sm btn-view-detail" data-id="${sub.submissionId}">
              Review
            </button>
          </div>
        </td>
      `;

      tableBody.appendChild(tr);
    });

    // Attach row-level Review button listeners
    document.querySelectorAll('.btn-view-detail').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openDetailModal(btn.dataset.id);
      });
    });

    // Click whole row also opens modal
    tableBody.querySelectorAll('tr').forEach(tr => {
      tr.addEventListener('click', () => openDetailModal(tr.dataset.id));
    });

    tableCount.textContent = `Showing ${rows.length} record${rows.length !== 1 ? 's' : ''}`;
    lucide.createIcons();
  }

  // ============================================================
  // STATUS BADGE HELPER
  // ============================================================

  function statusBadge(status) {
    switch (status) {
      case 'Verified':
      case 'Approved':
        return `<span class="badge badge-success">${status}</span>`;
      case 'Flagged':
        return `<span class="badge badge-danger">Flagged</span>`;
      case 'Pending':
      default:
        return `<span class="badge badge-warning">Pending</span>`;
    }
  }

  // ============================================================
  // DETAIL MODAL
  // ============================================================

  function openDetailModal(submissionId) {
    const all = getSubmissions();
    const sub = all.find(s => s.submissionId === submissionId);
    if (!sub) return;

    activeSubmissionId = submissionId;

    // Populate header
    document.getElementById('modalTitle').textContent = `${sub.roleTitle} at ${sub.companyName}`;
    document.getElementById('modalSubtitle').textContent = `ID: ${sub.submissionId} · Submitted by ${sub.studentName}`;

    // Student section
    document.getElementById('detStudentName').textContent  = sub.studentName;
    document.getElementById('detRollNumber').textContent   = sub.rollNumber;
    document.getElementById('detDepartment').textContent   = sub.department;
    document.getElementById('detStudentEmail').textContent = sub.studentEmail;

    // Internship section
    document.getElementById('detCompany').textContent     = sub.companyName;
    document.getElementById('detRole').textContent        = sub.roleTitle;
    document.getElementById('detDuration').textContent    = `${sub.startDate} → ${sub.endDate}`;
    document.getElementById('detType').textContent        = sub.internshipType === 'internal' ? 'Internal (College)' : 'External (Company)';
    document.getElementById('detMentorName').textContent  = sub.mentorName;
    document.getElementById('detMentorEmail').textContent = sub.mentorEmail;

    const certLink = document.getElementById('detCertLink');
    certLink.href = sub.certificateLink || '#';
    certLink.textContent = 'Open Document ';
    certLink.insertAdjacentHTML('beforeend', '<i data-lucide="external-link" style="width:12px;height:12px;"></i>');

    // Status section
    document.getElementById('detStatusCompany').innerHTML = statusBadge(sub.statusCompany);
    document.getElementById('detStatusFaculty').innerHTML = statusBadge(sub.statusFaculty);

    // Company remarks
    const companyRemarksWrap = document.getElementById('detRemarksCompanyWrapper');
    if (sub.remarksCompany) {
      companyRemarksWrap.style.display = 'flex';
      document.getElementById('detRemarksCompany').textContent = sub.remarksCompany;
    } else {
      companyRemarksWrap.style.display = 'none';
    }

    // Faculty remarks
    const facultyRemarksWrap = document.getElementById('detRemarksFacultyWrapper');
    if (sub.remarksFaculty) {
      facultyRemarksWrap.style.display = 'flex';
      document.getElementById('detRemarksFaculty').textContent = sub.remarksFaculty;
    } else {
      facultyRemarksWrap.style.display = 'none';
    }

    // Reset remarks textarea
    actionRemarks.value = '';
    buildActionButtons(sub);

    detailModal.classList.remove('hidden');
    lucide.createIcons();
  }

  function closeDetailModal() {
    detailModal.classList.add('hidden');
    activeSubmissionId = null;
  }

  modalClose.addEventListener('click', closeDetailModal);
  detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) closeDetailModal();
  });

  // ============================================================
  // ACTION BUTTONS — Role-based, State-aware
  // ============================================================

  function buildActionButtons(sub) {
    actionButtons.innerHTML = '';
    actionSection.style.display = 'block';

    // TPO (or any admin) can manually update status if company has not yet verified
    if (sub.statusCompany === 'Pending') {
      actionButtons.innerHTML = `
        <button class="btn btn-secondary btn-sm" id="actFlag">
          <i data-lucide="alert-triangle"></i> Flag
        </button>
        <button class="btn btn-primary btn-sm" id="actApprove">
          <i data-lucide="check-circle-2"></i> Mark Approved
        </button>
      `;
      document.getElementById('actApprove').addEventListener('click', () =>
        updateStatus(activeSubmissionId, 'statusCompany', 'Approved', 'remarks')
      );
      document.getElementById('actFlag').addEventListener('click', () =>
        updateStatus(activeSubmissionId, 'statusCompany', 'Flagged', 'remarks')
      );
    } else {
      actionSection.style.display = 'none';
    }

    lucide.createIcons();
  }

  // ============================================================
  // STATUS UPDATE — Writes to Google Sheets via API layer
  // ============================================================

  async function updateStatus(submissionId, statusField, newStatus, remarksField) {
    const remarks = actionRemarks.value.trim();

    try {
      // Optimistically close modal and show a saving indicator
      closeDetailModal();
      showToast('Saving…', 'info');

      await API.updateStatus(submissionId, statusField, newStatus, remarks, currentAdmin.email);

      const label = newStatus === 'Approved' ? 'Approved'
                  : newStatus === 'Rejected' ? 'Rejected'
                  : newStatus;
      showToast(`Submission marked as "${label}" successfully.`, 'success');
      renderDashboard();
    } catch (err) {
      showToast('Could not save: ' + err.message, 'error');
      // Re-open the modal so the user doesn't lose their action
    }
  }

  // ============================================================
  // SIDEBAR NAV SWITCHING
  // ============================================================

  const navItems = [navAll, navPending, navVerified, navFlagged];

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      currentFilter = item.dataset.view;

      const titles = {
        all:      'All Submissions',
        pending:  'Awaiting Company Review',
        verified: 'Company Approved',
        flagged:  'Discrepancies Flagged',
      };
      const t = titles[currentFilter] || 'Submissions';
      topbarTitle.textContent = t;
      tableTitle.textContent  = t;

      renderDashboard();
    });
  });

  // ============================================================
  // SEARCH & FILTER LISTENERS
  // ============================================================

  searchInput.addEventListener('input', () => {
    const all = getSubmissions();
    const filtered = applyFilters(all);
    updateMetrics(all);
    renderTable(filtered);
  });
  deptFilter.addEventListener('change', () => {
    const all = getSubmissions();
    const filtered = applyFilters(all);
    updateMetrics(all);
    renderTable(filtered);
  });
  btnRefresh.addEventListener('click', async () => {
    await renderDashboard();
    showToast('Data refreshed.', 'success');
  });

  // ============================================================
  // EXPORT CSV (TPO only)
  // ============================================================

  btnExport.addEventListener('click', async () => {
    // Ensure we have the latest data before exporting
    if (_submissionsCache.length === 0) await fetchSubmissions();
    const all = getSubmissions();
    if (all.length === 0) {
      showToast('No submissions to export yet.', 'error');
      return;
    }

    const headers = [
      'Submission ID', 'Timestamp', 'Student Name', 'Roll Number', 'Email',
      'Department', 'Type', 'Company', 'Role', 'Start Date', 'End Date',
      'Mentor Name', 'Mentor Email', 'Certificate Link',
      'Status: Company', 'Status: Faculty', 'Status: TPO',
      'Remarks: Company', 'Remarks: Faculty', 'Remarks: TPO', 'Last Updated'
    ];

    const rows = all.map(s => [
      s.submissionId, s.timestamp, s.studentName, s.rollNumber, s.studentEmail,
      s.department, s.internshipType, s.companyName, s.roleTitle, s.startDate, s.endDate,
      s.mentorName, s.mentorEmail, s.certificateLink,
      s.statusCompany, s.statusFaculty, s.statusTpo,
      s.remarksCompany || '', s.remarksFaculty || '', s.remarksTpo || '', s.lastUpdated || ''
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `InternProof_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Report exported as CSV successfully.', 'success');
  });

  // ============================================================
  // TOAST NOTIFICATIONS (shared utility)
  // ============================================================

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle-2';
    if (type === 'error')   iconName = 'alert-circle';

    toast.innerHTML = `
      <i data-lucide="${iconName}" style="width:18px;height:18px;flex-shrink:0;"></i>
      <span>${message}</span>
    `;
    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px) scale(0.95)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ============================================================
  // XSS PROTECTION — escape HTML before inserting user content
  // ============================================================

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str || ''));
    return div.innerHTML;
  }

});
