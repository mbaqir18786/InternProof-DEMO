/**
 * InternProof — Frontend API Gateway
 * =====================================
 * Central communication layer between the frontend and
 * the Google Apps Script Web App backend.
 *
 * SETUP:
 *   After deploying Code.gs as a Web App, paste the deployment
 *   URL into SCRIPT_URL below. Leave it empty to run in
 *   offline/localStorage mode automatically.
 */

const API = (() => {

  // ----------------------------------------------------------------
  // CONFIGURATION
  // Paste your Apps Script Web App URL here after deployment.
  // Example: 'https://script.google.com/macros/s/AKfyc.../exec'
  // ----------------------------------------------------------------
  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbynpVS7dv-a_UGHCZpFo5VI5swwLNQcE6-RqTiSeB5dbDUtV54yKcDoocmQm68vLYae1g/exec';

  // If SCRIPT_URL is empty the app runs in localStorage-only mode.
  const IS_LIVE = SCRIPT_URL.trim().length > 0;

  // ----------------------------------------------------------------
  // LOCAL STORAGE HELPERS (offline / development mode)
  // ----------------------------------------------------------------
  const LOCAL_KEY = 'internproof_submissions';

  function localRead() {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
  }

  function localWrite(data) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
  }

  function localGenerateId() {
    const year   = new Date().getFullYear();
    const suffix = Math.floor(10000 + Math.random() * 90000);
    return 'IP-' + year + '-' + suffix;
  }

  // ----------------------------------------------------------------
  // SUBMIT — New Internship Submission
  // ----------------------------------------------------------------
  async function submitInternship(data) {
    if (IS_LIVE) {
      // Send to Google Apps Script → writes to Sheets + sends email
      try {
        const res = await fetch(SCRIPT_URL, {
          method:  'POST',
          headers: { 'Content-Type': 'text/plain' }, // text/plain avoids CORS preflight
          body:    JSON.stringify({ action: 'submit', data }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Submission failed.');

        // Mirror to localStorage for instant UI feedback
        const entry = { ...data, submissionId: json.submissionId,
          statusCompany: 'Pending', statusFaculty: 'Pending', statusTpo: 'Pending',
          remarksCompany: '', remarksFaculty: '', remarksTpo: '',
          timestamp: new Date().toISOString() };
        const all = localRead();
        all.push(entry);
        localWrite(all);

        return { success: true, submissionId: json.submissionId };
      } catch (err) {
        throw new Error('Could not reach the server. Check your connection. (' + err.message + ')');
      }
    } else {
      // OFFLINE MODE — localStorage only
      const id = localGenerateId();
      const entry = {
        ...data,
        submissionId:   id,
        statusCompany:  'Pending',
        statusFaculty:  'Pending',
        statusTpo:      'Pending',
        remarksCompany: '',
        remarksFaculty: '',
        remarksTpo:     '',
        timestamp:      new Date().toISOString(),
      };
      const all = localRead();
      all.push(entry);
      localWrite(all);
      return { success: true, submissionId: id };
    }
  }

  // ----------------------------------------------------------------
  // GET STATUS — Student Status Tracker
  // ----------------------------------------------------------------
  async function getStatus(roll, id) {
    if (IS_LIVE) {
      try {
        const params = new URLSearchParams({ action: 'getStatus', roll, id });
        const res  = await fetch(SCRIPT_URL + '?' + params.toString());
        const json = await res.json();
        return json; // { success, data } or { success: false, error }
      } catch (err) {
        throw new Error('Could not reach the server. (' + err.message + ')');
      }
    } else {
      // OFFLINE MODE — read from localStorage
      const all = localRead();
      const matches = all.filter(s => String(s.rollNumber) === String(roll));
      if (matches.length === 0) return { success: false, error: 'No record found for this roll number.' };

      let record = id
        ? matches.find(s => s.submissionId === id) || null
        : matches.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

      if (!record) return { success: false, error: 'No record found matching that Submission ID.' };
      return { success: true, data: record };
    }
  }

  // ----------------------------------------------------------------
  // GET ALL — Admin Dashboard (all submissions)
  // ----------------------------------------------------------------
  async function getSubmissions() {
    if (IS_LIVE) {
      try {
        const params = new URLSearchParams({ action: 'getSubmissions' });
        const res    = await fetch(SCRIPT_URL + '?' + params.toString());
        const json   = await res.json();

        // Sync down into localStorage for offline resilience
        if (json.success && Array.isArray(json.data)) {
          localWrite(json.data);
        }
        return json;
      } catch (err) {
        // Fall back to localStorage cache if network fails
        console.warn('API unavailable, using local cache.', err.message);
        return { success: true, data: localRead(), cached: true };
      }
    } else {
      return { success: true, data: localRead() };
    }
  }

  // ----------------------------------------------------------------
  // UPDATE STATUS — Faculty / TPO actions from admin dashboard
  // ----------------------------------------------------------------
  async function updateStatus(submissionId, statusField, newStatus, remarks, actor) {
    if (IS_LIVE) {
      try {
        const res = await fetch(SCRIPT_URL, {
          method:  'POST',
          headers: { 'Content-Type': 'text/plain' },
          body:    JSON.stringify({
            action: 'updateStatus',
            data:   { submissionId, statusField, newStatus, remarks, actor }
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Update failed.');
      } catch (err) {
        throw new Error('Could not reach the server. (' + err.message + ')');
      }
    }

    // Always update localStorage so the UI reflects changes immediately
    const all = localRead();
    const idx = all.findIndex(s => s.submissionId === submissionId);
    if (idx !== -1) {
      all[idx][statusField] = newStatus;

      const remarkKey = statusField === 'statusFaculty' ? 'remarksFaculty'
                      : statusField === 'statusTpo'     ? 'remarksTpo'
                      : 'remarksCompany';
      all[idx][remarkKey]   = remarks || '';
      all[idx].lastUpdated  = new Date().toISOString();
      localWrite(all);
    }

    return { success: true };
  }

  // ----------------------------------------------------------------
  // VERIFY TOKEN — Company mentor token verification page
  // ----------------------------------------------------------------
  async function verifyToken(token, decision, remarks) {
    if (IS_LIVE) {
      const params = new URLSearchParams({ action: 'verifyToken', token, decision, remarks: remarks || '' });
      const res    = await fetch(SCRIPT_URL + '?' + params.toString());
      return await res.json();
    } else {
      return { success: false, error: 'Token verification requires the live Apps Script backend.' };
    }
  }

  // ----------------------------------------------------------------
  // GET SUBMISSION BY TOKEN — Used by verify.html to pre-fill form
  // ----------------------------------------------------------------
  async function getSubmissionByToken(token) {
    if (IS_LIVE) {
      try {
        const params = new URLSearchParams({ action: 'getSubmissionByToken', token });
        const res    = await fetch(SCRIPT_URL + '?' + params.toString());
        return await res.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    } else {
      return { success: false, error: 'Requires the live backend.' };
    }
  }

  // ----------------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------------
  return {
    submitInternship, getStatus, getSubmissions, updateStatus,
    verifyToken, getSubmissionByToken,
    IS_LIVE,
    _scriptUrl: SCRIPT_URL   // exposed for verify.js fetch calls
  };

})();
