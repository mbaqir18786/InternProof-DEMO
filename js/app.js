/**
 * InternProof - Client-Side App Controller
 * Handles Multi-step Validation, Tab Switching, Toasts, and Mock API storage.
 */

document.addEventListener('DOMContentLoaded', () => {
  
  // --- DATABASE INIT ---
  if (!localStorage.getItem('internproof_submissions')) {
    localStorage.setItem('internproof_submissions', JSON.stringify([]));
  }

  // --- ELEMENT REFERENCES ---
  const tabSubmit = document.getElementById('tabSubmit');
  const tabTrack = document.getElementById('tabTrack');
  const panelSubmit = document.getElementById('panelSubmit');
  const panelTrack = document.getElementById('panelTrack');
  
  const form = document.getElementById('internshipForm');
  const trackForm = document.getElementById('trackForm');
  
  const steps = Array.from(document.querySelectorAll('.form-step'));
  const stepItems = Array.from(document.querySelectorAll('.step-item'));
  const stepProgressBar = document.getElementById('stepProgressBar');
  
  const btnNextList = document.querySelectorAll('.btn-next');
  const btnPrevList = document.querySelectorAll('.btn-prev');
  const btnAdminPortal = document.getElementById('btnAdminPortal');
  
  // Track Status UI Nodes
  const trackResultPanel = document.getElementById('trackResultPanel');
  const trackResultTitle = document.getElementById('trackResultTitle');
  const trackResultMeta = document.getElementById('trackResultMeta');
  const companyRemarksBox = document.getElementById('companyRemarksBox');
  const companyRemarksText = document.getElementById('companyRemarksText');

  const timeNodeSubmit = document.getElementById('timeNodeSubmit');
  const timeNodeSubmitDate = document.getElementById('timeNodeSubmitDate');
  const timeNodeCompany = document.getElementById('timeNodeCompany');
  const timeNodeCompanyStatus = document.getElementById('timeNodeCompanyStatus');
  const timeNodeCompanyDesc = document.getElementById('timeNodeCompanyDesc');
  const successPanel = document.getElementById('successPanel');
  const successSubId = document.getElementById('successSubId');

  let currentStep = 1;

  // --- INITIALIZE ICONOGRAPHY ---
  lucide.createIcons();

  // ----------------------------------------------------------------
  // HELPERS: switch active tab + persist in URL hash
  // ----------------------------------------------------------------
  function showTab(tab) {
    if (tab === 'track') {
      tabTrack.classList.add('active');
      tabSubmit.classList.remove('active');
      panelTrack.classList.add('active');
      panelSubmit.classList.remove('active');
      history.replaceState(null, '', '#track');
    } else {
      tabSubmit.classList.add('active');
      tabTrack.classList.remove('active');
      panelSubmit.classList.add('active');
      panelTrack.classList.remove('active');
      history.replaceState(null, '', '#submit');
    }
  }

  // Restore tab from hash on page load
  if (window.location.hash === '#track') showTab('track');

  // --- NAVIGATION TAB SWITCHING ---
  tabSubmit.addEventListener('click', () => showTab('submit'));
  tabTrack.addEventListener('click',  () => showTab('track'));

  btnAdminPortal.addEventListener('click', () => {
    window.location.href = 'dashboard.html';
  });

  // --- STEP FORM WIZARD LOGIC ---
  const updateWizardUI = () => {
    // Show active step, hide others
    steps.forEach((step, idx) => {
      if (idx + 1 === currentStep) {
        step.classList.add('active');
      } else {
        step.classList.remove('active');
      }
    });

    // Update Step circle items styling
    stepItems.forEach((item, idx) => {
      const stepNum = idx + 1;
      item.classList.remove('active', 'completed');
      if (stepNum === currentStep) {
        item.classList.add('active');
      } else if (stepNum < currentStep) {
        item.classList.add('completed');
      }
    });

    // Progress bar width indicator computation
    const completedStepsCount = currentStep - 1;
    const totalTransitions = stepItems.length - 1;
    const progressPercent = (completedStepsCount / totalTransitions) * 100;
    stepProgressBar.style.width = `${progressPercent}%`;

    // Initialize Review Step contents if currentStep is 4
    if (currentStep === 4) {
      populateReviewData();
    }
  };

  btnNextList.forEach(btn => {
    btn.addEventListener('click', () => {
      if (validateStep(currentStep)) {
        currentStep++;
        updateWizardUI();
      } else {
        showToast('Please correct validation errors before proceeding.', 'error');
      }
    });
  });

  btnPrevList.forEach(btn => {
    btn.addEventListener('click', () => {
      currentStep--;
      updateWizardUI();
    });
  });

  // --- STRICT FORM VALIDATION RULES ---
  const validateStep = (stepNumber) => {
    let isValid = true;

    if (stepNumber === 1) {
      const name = document.getElementById('studentName');
      const roll = document.getElementById('rollNumber');
      const dept = document.getElementById('department');
      const email = document.getElementById('studentEmail');

      // Full Name Validation
      if (!name.value.trim()) {
        toggleInputError(name, true);
        isValid = false;
      } else {
        toggleInputError(name, false);
      }

      // Roll Number validation (Exactly 11 digits)
      const rollRegex = /^\d{11}$/;
      if (!rollRegex.test(roll.value.trim())) {
        toggleInputError(roll, true);
        isValid = false;
      } else {
        toggleInputError(roll, false);
      }

      // Department Selection
      if (!dept.value) {
        toggleInputError(dept, true);
        isValid = false;
      } else {
        toggleInputError(dept, false);
      }

      // Somaiya Email validation (must end with @somaiya.edu)
      const emailValue = email.value.trim().toLowerCase();
      const isSomaiyaEmail = emailValue.endsWith('@somaiya.edu') && emailValue.length > 12;
      if (!isSomaiyaEmail) {
        toggleInputError(email, true);
        isValid = false;
      } else {
        toggleInputError(email, false);
      }
    }

    else if (stepNumber === 2) {
      const type = document.getElementById('internshipType');
      const org = document.getElementById('companyName');
      const role = document.getElementById('roleTitle');
      const start = document.getElementById('startDate');
      const end = document.getElementById('endDate');
      const mentor = document.getElementById('mentorName');
      const mentorEmail = document.getElementById('mentorEmail');
      const mentorEmailError = document.getElementById('mentorEmailError');

      // Organization Name
      if (!org.value.trim()) {
        toggleInputError(org, true);
        isValid = false;
      } else {
        toggleInputError(org, false);
      }

      // Role Title
      if (!role.value.trim()) {
        toggleInputError(role, true);
        isValid = false;
      } else {
        toggleInputError(role, false);
      }

      // Start Date
      if (!start.value) {
        toggleInputError(start, true);
        isValid = false;
      } else {
        toggleInputError(start, false);
      }

      // End Date (Must be after Start Date)
      if (!end.value) {
        toggleInputError(end, true);
        isValid = false;
      } else if (new Date(end.value) <= new Date(start.value)) {
        toggleInputError(end, true);
        isValid = false;
      } else {
        toggleInputError(end, false);
      }

      // Mentor Name
      if (!mentor.value.trim()) {
        toggleInputError(mentor, true);
        isValid = false;
      } else {
        toggleInputError(mentor, false);
      }

      // Strict Mentor Email validation
      const emailVal = mentorEmail.value.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      if (!emailRegex.test(emailVal)) {
        mentorEmailError.textContent = "Please enter a valid supervisor email address.";
        toggleInputError(mentorEmail, true);
        isValid = false;
      } 
      // Rule 1: No @gmail.com or generic public domains allowed
      else if (emailVal.endsWith('@gmail.com') || emailVal.endsWith('@yahoo.com') || emailVal.endsWith('@outlook.com') || emailVal.endsWith('@hotmail.com')) {
        mentorEmailError.textContent = "Generic emails (@gmail.com, etc.) are blocked. Use a corporate/institutional domain.";
        toggleInputError(mentorEmail, true);
        isValid = false;
      } 
      // Rule 2: If type is internal, domain MUST be @somaiya.edu
      else if (type.value === 'internal' && !emailVal.endsWith('@somaiya.edu')) {
        mentorEmailError.textContent = "Internal college mentors must use a @somaiya.edu email address.";
        toggleInputError(mentorEmail, true);
        isValid = false;
      }
      // Rule 3: If type is external, domain CANNOT be @somaiya.edu
      else if (type.value === 'external' && emailVal.endsWith('@somaiya.edu')) {
        mentorEmailError.textContent = "External corporate mentors cannot use a university @somaiya.edu email.";
        toggleInputError(mentorEmail, true);
        isValid = false;
      } 
      else {
        toggleInputError(mentorEmail, false);
      }
    }

    else if (stepNumber === 3) {
      const certLink = document.getElementById('certificateLink');
      
      // Simple URL format verification (must start with http/https)
      try {
        const urlObj = new URL(certLink.value.trim());
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
          throw new Error();
        }
        toggleInputError(certLink, false);
      } catch (err) {
        toggleInputError(certLink, true);
        isValid = false;
      }
    }

    return isValid;
  };

  const toggleInputError = (element, show) => {
    const group = element.closest('.form-group');
    if (show) {
      group.classList.add('has-error');
    } else {
      group.classList.remove('has-error');
    }
  };

  // --- REVIEW DATA POPULATION ---
  const populateReviewData = () => {
    document.getElementById('revStudentName').textContent = document.getElementById('studentName').value;
    document.getElementById('revRollDept').textContent = `${document.getElementById('rollNumber').value} (${document.getElementById('department').value})`;
    document.getElementById('revStudentEmail').textContent = document.getElementById('studentEmail').value;
    
    const typeLabel = document.getElementById('internshipType').value === 'internal' ? 'Internal Project' : 'External Company';
    document.getElementById('revCompanyType').textContent = `${document.getElementById('companyName').value} [${typeLabel}]`;
    document.getElementById('revRoleTitle').textContent = document.getElementById('roleTitle').value;
    document.getElementById('revDuration').textContent = `From ${document.getElementById('startDate').value} to ${document.getElementById('endDate').value}`;
    document.getElementById('revMentorInfo').textContent = `${document.getElementById('mentorName').value} (${document.getElementById('mentorEmail').value})`;
    
    const link = document.getElementById('certificateLink').value;
    const linkEl = document.getElementById('revCertificateLink');
    linkEl.textContent = link;
    linkEl.href = link;
  };

  // Dynamic label adjustment for step 2 based on type selection
  document.getElementById('internshipType').addEventListener('change', (e) => {
    const orgLabel = document.querySelector('label[for="companyName"]');
    const mentorEmailHelper = document.getElementById('mentorEmailHelper');
    const mentorEmail = document.getElementById('mentorEmail');

    if (e.target.value === 'internal') {
      orgLabel.textContent = "College Department/Research Lab Name";
      mentorEmailHelper.textContent = "Internal supervisors MUST use an official @somaiya.edu address. Public domains blocked.";
      mentorEmail.placeholder = "professor.name@somaiya.edu";
    } else {
      orgLabel.textContent = "Organization/Company Name";
      mentorEmailHelper.textContent = "External supervisors must use a corporate address (no @somaiya.edu or @gmail.com).";
      mentorEmail.placeholder = "mentor@company.com";
    }
    // Revalidate if user typed anything
    if (mentorEmail.value) {
      validateStep(2);
    }
  });

  // --- SUBMISSION ACTION ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!validateStep(4)) return;

    const btnSubmit = document.getElementById('btnSubmitForm');
    const originalText = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<i data-lucide="loader" class="shimmer" style="width: 16px; height: 16px; display: inline-block;"></i> Submitting...`;
    lucide.createIcons();

    // Gather form data
    const data = {
      studentName: document.getElementById('studentName').value,
      rollNumber: document.getElementById('rollNumber').value,
      studentEmail: document.getElementById('studentEmail').value,
      department: document.getElementById('department').value,
      internshipType: document.getElementById('internshipType').value,
      companyName: document.getElementById('companyName').value,
      roleTitle: document.getElementById('roleTitle').value,
      startDate: document.getElementById('startDate').value,
      endDate: document.getElementById('endDate').value,
      mentorName: document.getElementById('mentorName').value,
      mentorEmail: document.getElementById('mentorEmail').value,
      certificateLink: document.getElementById('certificateLink').value,
    };

    try {
      const result = await API.submitInternship(data);
      if (!result.success) throw new Error(result.error || 'Submission failed');

      btnSubmit.disabled = false;
      btnSubmit.innerHTML = originalText;

      // ---- Show success panel with Submission ID ----
      form.style.display = 'none';
      successSubId.textContent = result.submissionId;
      successPanel.style.display = 'block';
      lucide.createIcons();

      // Copy-to-clipboard button
      document.getElementById('btnCopyId').addEventListener('click', () => {
        navigator.clipboard.writeText(result.submissionId).then(() => {
          showToast('Submission ID copied to clipboard!', 'success');
        }).catch(() => {
          showToast('Could not copy. Please copy manually: ' + result.submissionId, 'info');
        });
      });

      // Track My Status button
      document.getElementById('btnTrackStatus').addEventListener('click', () => {
        // Pre-fill tracking fields and switch to track tab
        document.getElementById('trackRollNumber').value = data.rollNumber;
        document.getElementById('trackSubmissionId').value = result.submissionId;
        // Reset submit tab for next use
        form.style.display = 'block';
        successPanel.style.display = 'none';
        form.reset();
        currentStep = 1;
        updateWizardUI();
        showTab('track');
        triggerLookup(data.rollNumber, result.submissionId);
      });

    } catch (err) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = originalText;
      showToast(err.message, 'error');
    }
  });

  // --- TRACKING LOOKUP LOGIC ---
  trackForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const rollInput = document.getElementById('trackRollNumber');
    const idInput = document.getElementById('trackSubmissionId');

    // Validate roll input
    const rollRegex = /^\d{11}$/;
    if (!rollRegex.test(rollInput.value.trim())) {
      toggleInputError(rollInput, true);
      showToast('Please enter a valid 11-digit roll number.', 'error');
      return;
    }
    toggleInputError(rollInput, false);

    triggerLookup(rollInput.value.trim(), idInput.value.trim());
  });

  const triggerLookup = async (rollNum, submissionId) => {
    // Show loading state
    trackResultPanel.style.display = 'none';

    try {
      const result = await API.getStatus(rollNum, submissionId);
      if (!result.success) {
        showToast(result.error || 'No record found for this Roll Number.', 'error');
        return;
      }
      // Render Timeline Results
      renderTimeline(result.data);
    } catch (err) {
      showToast(err.message || 'Could not load status. Try again.', 'error');
    }
  };

  const renderTimeline = (record) => {
    trackResultPanel.style.display = 'block';
    trackResultTitle.textContent = `${record.roleTitle} at ${record.companyName}`;

    const dateFormatted = new Date(record.timestamp).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
    trackResultMeta.textContent = `ID: ${record.submissionId} | Submitted on ${dateFormatted}`;

    // Node 1: Submission (always complete)
    timeNodeSubmitDate.textContent = `Completed on ${new Date(record.timestamp).toLocaleDateString('en-IN')}`;

    // Node 2: Company Verification (final status)
    const status = record.statusCompany || 'Pending';
    timeNodeCompany.className = 'timeline-icon';
    timeNodeCompany.innerHTML = '';

    if (status === 'Approved' || status === 'Verified') {
      timeNodeCompany.classList.add('completed');
      timeNodeCompany.innerHTML = '<i data-lucide="check" style="width:14px;height:14px;"></i>';
      timeNodeCompanyStatus.textContent = 'Approved by Supervisor';
      timeNodeCompanyDesc.textContent = 'Your internship has been verified and approved.';
    } else if (status === 'Flagged') {
      timeNodeCompany.classList.add('flagged');
      timeNodeCompany.innerHTML = '<i data-lucide="alert-triangle" style="width:14px;height:14px;"></i>';
      timeNodeCompanyStatus.textContent = 'Discrepancy Flagged';
      timeNodeCompanyDesc.textContent = 'Your supervisor raised a concern. Check remarks below.';
    } else {
      timeNodeCompany.classList.add('pending');
      timeNodeCompany.innerHTML = '<i data-lucide="loader" style="width:14px;height:14px;"></i>';
      timeNodeCompanyStatus.textContent = 'Pending';
      timeNodeCompanyDesc.textContent = 'Waiting for supervisor to respond to the verification email.';
    }

    // Show remarks if available
    const remarks = record.remarks || record.remarksCompany || '';
    if (remarks) {
      companyRemarksBox.style.display = 'block';
      companyRemarksText.textContent = remarks;
    } else {
      companyRemarksBox.style.display = 'none';
    }

    lucide.createIcons();
  };

  // --- GENERAL TOAST NOTIFICATION HELPERS ---
  const showToast = (message, type = 'info') => {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Choose icon type based on alert status
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle-2';
    if (type === 'error') iconName = 'alert-circle';
    
    toast.innerHTML = `
      <i data-lucide="${iconName}" style="width: 18px; height: 18px; flex-shrink: 0;"></i>
      <span>${message}</span>
    `;
    
    container.appendChild(toast);
    lucide.createIcons();

    // Auto fadeout after 4 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(12px) scale(0.95)';
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 4000);
  };

});
