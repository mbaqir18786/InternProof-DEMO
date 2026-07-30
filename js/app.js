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
  
  const timeNodeFaculty = document.getElementById('timeNodeFaculty');
  const timeNodeFacultyStatus = document.getElementById('timeNodeFacultyStatus');
  const timeNodeFacultyDesc = document.getElementById('timeNodeFacultyDesc');
  
  const timeNodeTpo = document.getElementById('timeNodeTpo');
  const timeNodeTpoStatus = document.getElementById('timeNodeTpoStatus');
  const timeNodeTpoDesc = document.getElementById('timeNodeTpoDesc');

  let currentStep = 1;

  // --- INITIALIZE ICONOGRAPHY ---
  lucide.createIcons();

  // --- NAVIGATION TAB SWITCHING ---
  tabSubmit.addEventListener('click', () => {
    tabSubmit.classList.add('active');
    tabTrack.classList.remove('active');
    panelSubmit.classList.add('active');
    panelTrack.classList.remove('active');
  });

  tabTrack.addEventListener('click', () => {
    tabTrack.classList.add('active');
    tabSubmit.classList.remove('active');
    panelTrack.classList.add('active');
    panelSubmit.classList.remove('active');
  });

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

      // Reset form & wizard UI
      form.reset();
      currentStep = 1;
      updateWizardUI();
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = originalText;

      // Show success toast with generated ID
      showToast(`Submission successful! ID: ${result.submissionId}`, 'success');

      // Auto‑switch to tracking view and pre‑fill lookup fields
      document.getElementById('trackRollNumber').value = data.rollNumber;
      document.getElementById('trackSubmissionId').value = result.submissionId;
      tabTrack.click();
      triggerLookup(data.rollNumber, result.submissionId);
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
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    trackResultMeta.textContent = `ID: ${record.submissionId} | Registered on ${dateFormatted}`;

    // Node 1: Submission
    timeNodeSubmitDate.textContent = `Completed on ${new Date(record.timestamp).toLocaleDateString('en-IN')}`;
    
    // Reset classes
    const nodes = [
      { circle: timeNodeCompany, status: timeNodeCompanyStatus, desc: timeNodeCompanyDesc },
      { circle: timeNodeFaculty, status: timeNodeFacultyStatus, desc: timeNodeFacultyDesc },
      { circle: timeNodeTpo, status: timeNodeTpoStatus, desc: timeNodeTpoDesc }
    ];
    nodes.forEach(n => {
      n.circle.className = 'timeline-icon';
      n.circle.innerHTML = '';
    });
    companyRemarksBox.style.display = 'none';

    // Node 2: Company Status styling
    if (record.statusCompany === 'Verified') {
      timeNodeCompany.classList.add('completed');
      timeNodeCompany.innerHTML = `<i data-lucide="check" style="width: 14px; height: 14px;"></i>`;
      timeNodeCompanyStatus.innerHTML = `<span class="badge badge-success">Verified</span>`;
      timeNodeCompanyDesc.textContent = `Approved by external supervisor (${record.mentorName}).`;
      
      if (record.remarksCompany) {
        companyRemarksBox.style.display = 'block';
        companyRemarksBox.className = 'remarks-box';
        companyRemarksText.textContent = record.remarksCompany;
      }
    } else if (record.statusCompany === 'Flagged') {
      timeNodeCompany.classList.add('flagged');
      timeNodeCompany.innerHTML = `<i data-lucide="alert-triangle" style="width: 14px; height: 14px;"></i>`;
      timeNodeCompanyStatus.innerHTML = `<span class="badge badge-danger">Discrepancy Flagged</span>`;
      timeNodeCompanyDesc.textContent = `Action Required: Details contested by mentor (${record.mentorName}).`;
      
      if (record.remarksCompany) {
        companyRemarksBox.style.display = 'block';
        companyRemarksBox.className = 'remarks-box flagged';
        companyRemarksText.textContent = record.remarksCompany;
      }
    } else {
      timeNodeCompany.classList.add('pending');
      timeNodeCompany.innerHTML = `<i data-lucide="loader" class="shimmer" style="width: 14px; height: 14px;"></i>`;
      timeNodeCompanyStatus.innerHTML = `<span class="badge badge-warning">Awaiting Review</span>`;
      timeNodeCompanyDesc.textContent = `Verification link sent to ${record.mentorEmail}.`;
    }

    // Node 3: Faculty Status styling
    if (record.statusCompany === 'Flagged') {
      timeNodeFaculty.innerHTML = `<i data-lucide="minus" style="width: 14px; height: 14px;"></i>`;
      timeNodeFacultyStatus.textContent = 'Hold';
      timeNodeFacultyDesc.textContent = 'Review paused due to company discrepancy report.';
    } else if (record.statusCompany === 'Pending') {
      timeNodeFaculty.innerHTML = `<i data-lucide="clock" style="width: 14px; height: 14px;"></i>`;
      timeNodeFacultyStatus.textContent = 'Pending';
      timeNodeFacultyDesc.textContent = 'Awaiting company approval before faculty audit.';
    } else {
      // Company is verified, check Faculty
      if (record.statusFaculty === 'Approved') {
        timeNodeFaculty.classList.add('completed');
        timeNodeFaculty.innerHTML = `<i data-lucide="check" style="width: 14px; height: 14px;"></i>`;
        timeNodeFacultyStatus.innerHTML = `<span class="badge badge-success">Approved</span>`;
        timeNodeFacultyDesc.textContent = 'Internship details endorsed by department head.';
      } else {
        timeNodeFaculty.classList.add('pending');
        timeNodeFaculty.innerHTML = `<i data-lucide="loader" class="shimmer" style="width: 14px; height: 14px;"></i>`;
        timeNodeFacultyStatus.innerHTML = `<span class="badge badge-warning">Awaiting Audit</span>`;
        timeNodeFacultyDesc.textContent = 'Submitted to department faculty coordinator.';
      }
    }

    // Node 4: TPO status styling
    if (record.statusFaculty !== 'Approved') {
      timeNodeTpo.innerHTML = `<i data-lucide="minus" style="width: 14px; height: 14px;"></i>`;
      timeNodeTpoStatus.textContent = 'Hold';
      timeNodeTpoDesc.textContent = 'Awaiting faculty approval recommendations.';
    } else {
      if (record.statusTpo === 'Approved') {
        timeNodeTpo.classList.add('completed');
        timeNodeTpo.innerHTML = `<i data-lucide="award" style="width: 14px; height: 14px;"></i>`;
        timeNodeTpoStatus.innerHTML = `<span class="badge badge-success">Credits Released</span>`;
        timeNodeTpoDesc.textContent = 'Internship verified. Credit records updated in university ledger.';
      } else {
        timeNodeTpo.classList.add('pending');
        timeNodeTpo.innerHTML = `<i data-lucide="loader" class="shimmer" style="width: 14px; height: 14px;"></i>`;
        timeNodeTpoStatus.innerHTML = `<span class="badge badge-warning">Under Final Review</span>`;
        timeNodeTpoDesc.textContent = 'Compilation of documents for final ledger release.';
      }
    }

    // Rerender Lucide Icons inside timeline
    lucide.createIcons();
    showToast('Application details loaded.', 'success');
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
