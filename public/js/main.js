// Main Client JS: Theme Toggle, Sidebar, Topic Progress, Syllabus AI & Study Modal

// Global Toast Notification Helper
window.showToast = function(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) {
    if (type === 'error') console.error(message);
    else console.log(message);
    return;
  }
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  const toast = document.createElement('div');
  toast.className = `toast-item toast-${type}`;
  toast.innerHTML = `
    <span style="font-size: 1.1rem; line-height: 1;">${icons[type] || '🔔'}</span>
    <span style="flex: 1;">${message}</span>
    <button type="button" class="toast-dismiss-btn" aria-label="Close">✕</button>
  `;
  const dismiss = () => {
    toast.style.animation = 'slideOutToast 0.25s forwards';
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 250);
  };
  toast.querySelector('.toast-dismiss-btn').addEventListener('click', dismiss);
  container.appendChild(toast);
  setTimeout(dismiss, 3500);
};

// Global Action Confirmation Dialog Helper (Desktop & Mobile Responsive)
window.showConfirmDialog = function({
  title = 'Are you sure?',
  message = 'Are you sure you want to delete this? This action cannot be undone.',
  confirmText = 'Confirm Delete',
  cancelText = 'Cancel',
  icon = '🗑️',
  isDanger = true
} = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('globalConfirmModal');
    if (!modal) {
      const ok = window.confirm(message);
      return resolve(ok);
    }

    const titleEl = document.getElementById('globalConfirmTitle');
    const msgEl = document.getElementById('globalConfirmMessage');
    const iconEl = document.getElementById('globalConfirmIcon');
    const okBtn = document.getElementById('globalConfirmOkBtn');
    const cancelBtn = document.getElementById('globalConfirmCancelBtn');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (iconEl) iconEl.textContent = icon;
    if (okBtn) {
      okBtn.textContent = confirmText;
      okBtn.className = isDanger ? 'btn btn-danger' : 'btn btn-primary';
    }
    if (cancelBtn) cancelBtn.textContent = cancelText;

    modal.style.display = 'flex';

    let resolved = false;

    function cleanup(res) {
      if (resolved) return;
      resolved = true;
      modal.style.display = 'none';
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey);
      resolve(res);
    }

    function onOk(e) {
      e.preventDefault();
      cleanup(true);
    }

    function onCancel(e) {
      e.preventDefault();
      cleanup(false);
    }

    function onBackdrop(e) {
      if (e.target === modal) cleanup(false);
    }

    function onKey(e) {
      if (e.key === 'Escape') cleanup(false);
    }

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    modal.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey);
  });
};

document.addEventListener('DOMContentLoaded', () => {
  // 1. Theme Toggle (Persisted in localStorage)
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const themeIcon = document.getElementById('themeIcon');
  const htmlEl = document.documentElement;

  const savedTheme = localStorage.getItem('cse_hub_theme') || 'light';
  htmlEl.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = htmlEl.getAttribute('data-theme') || 'light';
      const nextTheme = current === 'dark' ? 'light' : 'dark';
      htmlEl.setAttribute('data-theme', nextTheme);
      localStorage.setItem('cse_hub_theme', nextTheme);
      updateThemeIcon(nextTheme);
    });
  }

  function updateThemeIcon(theme) {
    if (!themeIcon) return;
    themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  // 2. Mobile Sidebar Toggle
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const sidebar = document.querySelector('.sidebar');
  if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
    });
  }

  // 3. Interactive Topic Checkbox Toggler
  document.querySelectorAll('.topic-checkbox').forEach(box => {
    box.addEventListener('change', async (e) => {
      const subjectId = e.target.dataset.subject;
      const topicName = e.target.dataset.topic;
      const topicItem = e.target.closest('.topic-item');

      try {
        const res = await fetch('/progress/api/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subjectId, topicName })
        });
        const data = await res.json();
        if (data.success) {
          if (data.result.isCompleted) {
            topicItem.classList.add('completed');
          } else {
            topicItem.classList.remove('completed');
          }

          // Update any progress percentage text on page
          const progressTxt = document.getElementById(`progress-text-${subjectId}`);
          const progressBar = document.getElementById(`progress-bar-${subjectId}`);
          if (data.subjectStats) {
            if (progressTxt) progressTxt.textContent = `${data.subjectStats.percentage}% (${data.subjectStats.completedTopicsCount}/${data.subjectStats.totalTopics})`;
            if (progressBar) progressBar.style.width = `${data.subjectStats.percentage}%`;
          }
        }
      } catch (err) {
        console.error('Failed to toggle topic:', err);
      }
    });
  });

  // ==========================================================
  // 4. Delete Subject Confirmation (Dashboard & Subject Page)
  // ==========================================================
  document.querySelectorAll('.delete-subject-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const subjectId = btn.dataset.id;
      const subjectName = btn.dataset.name || 'this subject';

      const confirmed = await window.showConfirmDialog({
        title: 'Delete Subject',
        message: `Are you sure you want to delete "${subjectName}"? This action cannot be undone.`,
        confirmText: 'Confirm Delete'
      });
      if (!confirmed) return;

      btn.disabled = true;
      const originalText = btn.innerHTML;
      btn.innerHTML = '⏳ Deleting...';

      try {
        const res = await fetch(`/syllabus/api/subject/${subjectId}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
          window.showToast(`Subject "${subjectName}" was successfully removed.`, 'success');
          setTimeout(() => {
            if (window.location.pathname.startsWith('/subject/')) {
              window.location.href = '/';
            } else {
              window.location.reload();
            }
          }, 600);
        } else {
          window.showToast(`Error deleting subject: ${data.error}`, 'error');
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
      } catch (err) {
        window.showToast(`Failed to delete subject: ${err.message}`, 'error');
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });
  });

  // ==========================================================
  // 4b. Delete Lecture / Study Note Confirmation
  // ==========================================================
  document.querySelectorAll('.delete-lecture-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const lectureId = btn.dataset.id;
      const title = btn.dataset.title || 'this study note';

      const confirmed = await window.showConfirmDialog({
        title: 'Delete Study Note',
        message: `Are you sure you want to delete "${title}"? This will permanently remove the study materials and markdown files.`,
        confirmText: 'Confirm Delete'
      });
      if (!confirmed) return;

      btn.disabled = true;
      const originalText = btn.innerHTML;
      btn.innerHTML = '⏳ Deleting...';

      try {
        const res = await fetch(`/library/api/${lectureId}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (data.success) {
          window.showToast('Study note deleted successfully.', 'success');
          const card = btn.closest('.card');
          if (card) {
            card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.95)';
            setTimeout(() => {
              if (card.parentNode) card.parentNode.removeChild(card);
              window.location.reload();
            }, 350);
          } else {
            window.location.reload();
          }
        } else {
          window.showToast(`Delete failed: ${data.error}`, 'error');
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
      } catch (err) {
        window.showToast(`Error: ${err.message}`, 'error');
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });
  });

  // ==========================================================
  // 5. Edit Subject Modal & Submission (Subject Page)
  // ==========================================================
  const editSubjectBtn = document.getElementById('editSubjectBtn');
  const editSubjectModal = document.getElementById('editSubjectModal');
  const editSubjectForm = document.getElementById('editSubjectForm');

  if (editSubjectBtn && editSubjectModal) {
    editSubjectBtn.addEventListener('click', () => {
      editSubjectModal.style.display = 'flex';
    });
  }

  if (editSubjectForm) {
    editSubjectForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const pathParts = window.location.pathname.split('/');
      const subjectId = pathParts[pathParts.length - 1];

      const name = document.getElementById('editNameInput').value.trim();
      const code = document.getElementById('editCodeInput').value.trim();
      const semester = parseInt(document.getElementById('editSemesterSelect').value, 10);
      const description = document.getElementById('editDescInput').value.trim();

      try {
        const res = await fetch(`/syllabus/api/subject/${subjectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, code, semester, description })
        });
        const data = await res.json();
        if (data.success) {
          window.location.reload();
        } else {
          alert(`Error updating subject: ${data.error}`);
        }
      } catch (err) {
        alert(`Update failed: ${err.message}`);
      }
    });
  }

  // ==========================================================
  // 6. PDF Syllabus Drag & Drop + Upload Pipeline
  // ==========================================================
  const dropzone = document.getElementById('pdfDropzone');
  const fileInput = document.getElementById('syllabusFileInput');
  const fileSelectedDisplay = document.getElementById('fileSelectedDisplay');
  const dropzonePrompt = document.getElementById('dropzonePrompt');
  const selectedFileName = document.getElementById('selectedFileName');
  const selectedFileSize = document.getElementById('selectedFileSize');
  const uploadForm = document.getElementById('syllabusUploadForm');
  const progressBox = document.getElementById('extractionProgress');
  const errorBox = document.getElementById('extractionErrorBox');
  const errorMsg = document.getElementById('extractionErrorMsg');
  const extractBtn = document.getElementById('extractSyllabusBtn');
  const previewSection = document.getElementById('previewSection');

  let selectedPdfFile = null;

  if (dropzone && fileInput) {
    // Click on dropzone to open file dialog (unless clicking on a button inside)
    dropzone.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON' && !e.target.closest('button')) {
        fileInput.click();
      }
    });

    // Keyboard accessibility for focused dropzone
    dropzone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });

    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
        try {
          fileInput.files = e.dataTransfer.files;
        } catch (err) {
          // Fallback if browser prohibits direct assignment to input.files
        }
        handleFileSelected(e.dataTransfer.files[0]);
      }
    });

    // Reset input value on click so choosing the same file again triggers change event
    fileInput.addEventListener('click', () => {
      fileInput.value = '';
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        handleFileSelected(fileInput.files[0]);
      }
    });

    function handleFileSelected(file) {
      if (!file) return;

      const isPdfExt = file.name.toLowerCase().endsWith('.pdf');
      const isPdfMime = file.type === 'application/pdf';

      if (!isPdfExt && !isPdfMime) {
        alert('Please select a valid PDF syllabus file (.pdf).');
        fileInput.value = '';
        selectedPdfFile = null;
        return;
      }

      if (file.size > 25 * 1024 * 1024) {
        alert('File size exceeds the 25MB limit. Please choose a smaller PDF.');
        fileInput.value = '';
        selectedPdfFile = null;
        return;
      }

      selectedPdfFile = file;

      if (dropzonePrompt) dropzonePrompt.style.display = 'none';
      if (fileSelectedDisplay) fileSelectedDisplay.style.display = 'block';
      if (selectedFileName) selectedFileName.textContent = file.name;
      if (selectedFileSize) {
        const formattedSize = file.size < 1024 * 1024
          ? `${(file.size / 1024).toFixed(1)} KB`
          : `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
        selectedFileSize.textContent = formattedSize;
      }
      if (errorBox) errorBox.style.display = 'none';
    }
  }

  // Handle PDF Syllabus Extraction Submit
  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const fileToUpload = selectedPdfFile || (fileInput && fileInput.files && fileInput.files[0]);

      if (!fileToUpload) {
        alert('Please choose a syllabus PDF to upload.');
        return;
      }

      const formData = new FormData();
      formData.append('syllabusPdf', fileToUpload, fileToUpload.name);
      const targetSemEl = document.getElementById('targetSemesterSelect');
      const semVal = targetSemEl ? targetSemEl.value : '';
      if (semVal) formData.append('semester', semVal);

      // UI status updates
      if (errorBox) errorBox.style.display = 'none';
      if (progressBox) progressBox.style.display = 'block';
      if (extractBtn) {
        extractBtn.disabled = true;
        extractBtn.innerHTML = '<span>⏳</span><span>Extracting with Gemini AI...</span>';
      }

      try {
        const res = await fetch('/syllabus/api/extract', {
          method: 'POST',
          body: formData
        });

        const data = await res.json();

        if (data.success && data.syllabus) {
          renderSyllabusPreview(data.syllabus);
        } else {
          throw new Error(data.error || 'Failed to extract syllabus from PDF.');
        }
      } catch (err) {
        console.error('Syllabus extraction error:', err);
        if (errorBox && errorMsg) {
          errorBox.style.display = 'flex';
          errorMsg.innerHTML = `<strong>Extraction Error:</strong> ${err.message}`;
        }
      } finally {
        if (progressBox) progressBox.style.display = 'none';
        if (extractBtn) {
          extractBtn.disabled = false;
          extractBtn.innerHTML = '<span>🤖</span><span>Extract Syllabus with Gemini AI</span>';
        }
      }
    });
  }

  // ==========================================================
  // 7. Render & Manage Extracted Syllabus Preview
  // ==========================================================
  let extractedSyllabusState = null;

  function renderSyllabusPreview(syllabusData, shouldScroll = true) {
    extractedSyllabusState = JSON.parse(JSON.stringify(syllabusData)); // deep clone
    const subjects = extractedSyllabusState.subjects || [];
    const semester = extractedSyllabusState.semester || 4;

    const container = document.getElementById('extractedSubjectsContainer');
    const semSelect = document.getElementById('previewSemesterSelect');
    const statSubjectCount = document.getElementById('statSubjectCount');
    const statUnitCount = document.getElementById('statUnitCount');
    const statTopicCount = document.getElementById('statTopicCount');
    const statEngine = document.getElementById('statEngine');

    if (semSelect) semSelect.value = String(semester);
    if (statSubjectCount) statSubjectCount.textContent = subjects.length;

    let totalUnits = 0;
    let totalTopics = 0;
    subjects.forEach(s => {
      totalUnits += (s.units || []).length;
      (s.units || []).forEach(u => {
        totalTopics += (u.topics || []).length;
      });
    });

    if (statUnitCount) statUnitCount.textContent = totalUnits;
    if (statTopicCount) statTopicCount.textContent = totalTopics;
    if (statEngine) statEngine.textContent = syllabusData.source === 'gemini' ? 'Gemini AI' : 'Smart Heuristic';

    if (container) {
      container.innerHTML = '';
      subjects.forEach((sub, sIdx) => {
        const card = createSubjectPreviewCard(sub, sIdx);
        container.appendChild(card);
      });
    }

    if (previewSection) {
      previewSection.style.display = 'block';
      if (shouldScroll) {
        previewSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  function createSubjectPreviewCard(sub, sIdx) {
    const card = document.createElement('div');
    card.className = 'extracted-subject-card';
    card.id = `extracted-sub-${sIdx}`;

    const unitsHtml = (sub.units || []).map((u, uIdx) => {
      const topicTags = (u.topics || []).map((t, tIdx) => `
        <span class="topic-tag" id="tag-${sIdx}-${uIdx}-${tIdx}">
          <span class="topic-tag-text" style="cursor: pointer;" title="Click to edit topic name" onclick="editExtractedTopic(${sIdx}, ${uIdx}, ${tIdx})">${escapeHtml(t)}</span>
          <button type="button" class="topic-tag-delete" title="Delete Topic" onclick="removeExtractedTopic(${sIdx}, ${uIdx}, ${tIdx})">✕</button>
        </span>
      `).join('');

      return `
        <div class="extracted-unit-box" id="unit-box-${sIdx}-${uIdx}">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
              <span class="unit-number-badge" style="font-size: 0.8rem;">Unit ${u.number}</span>
              <input type="text" class="form-control" style="font-weight: 600; font-size: 0.95rem; padding: 4px 8px; height: 32px;" 
                value="${escapeHtml(u.title)}" onchange="updateExtractedUnitTitle(${sIdx}, ${uIdx}, this.value)" oninput="updateExtractedUnitTitle(${sIdx}, ${uIdx}, this.value)">
            </div>
            <button type="button" class="btn btn-danger-outline btn-sm" style="padding: 2px 8px; font-size: 0.75rem;" onclick="removeExtractedUnit(${sIdx}, ${uIdx})">
              Delete Unit
            </button>
          </div>

          <div style="margin-top: 8px;">
            <label style="font-size: 0.78rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Topics (${(u.topics || []).length}):</label>
            <div class="topic-tag-list" id="topic-list-${sIdx}-${uIdx}">
              ${topicTags}
            </div>

            <!-- Add Topic Inline Input -->
            <div style="display: flex; gap: 6px; margin-top: 10px;">
              <input type="text" id="add-topic-input-${sIdx}-${uIdx}" class="form-control" placeholder="+ Add topic(s), separated by commas..." style="height: 30px; font-size: 0.82rem;" onkeydown="if(event.key === 'Enter'){ event.preventDefault(); addExtractedTopic(${sIdx}, ${uIdx}); }">
              <button type="button" class="btn btn-secondary btn-sm" style="height: 30px; font-size: 0.78rem; white-space: nowrap;" onclick="addExtractedTopic(${sIdx}, ${uIdx})">
                + Add
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
        <div style="display: grid; grid-template-columns: 140px 1fr 140px; gap: 12px; flex: 1;">
          <div>
            <label style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">SUBJECT CODE</label>
            <input type="text" class="form-control" value="${escapeHtml(sub.code)}" style="font-weight: 700; text-transform: uppercase;" onchange="updateExtractedSubjectCode(${sIdx}, this.value)" oninput="updateExtractedSubjectCode(${sIdx}, this.value)">
          </div>
          <div>
            <label style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">SUBJECT NAME</label>
            <input type="text" class="form-control" value="${escapeHtml(sub.name)}" style="font-weight: 700;" onchange="updateExtractedSubjectName(${sIdx}, this.value)" oninput="updateExtractedSubjectName(${sIdx}, this.value)">
          </div>
          <div>
            <label style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">SEMESTER</label>
            <select class="form-control" onchange="updateExtractedSubjectSemester(${sIdx}, this.value)">
              ${[1, 2, 3, 4, 5, 6, 7, 8].map(s => `<option value="${s}" ${s === (sub.semester || 4) ? 'selected' : ''}>Sem ${s}</option>`).join('')}
            </select>
          </div>
        </div>

        <button type="button" class="btn btn-danger-outline btn-sm" onclick="removeExtractedSubject(${sIdx})" title="Remove Subject from import">
          <span>🗑️ Remove</span>
        </button>
      </div>

      <div style="margin-bottom: 14px;">
        <label style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">SUBJECT OVERVIEW / DESCRIPTION</label>
        <input type="text" class="form-control" value="${escapeHtml(sub.description || '')}" placeholder="Short overview of learning objectives..." onchange="updateExtractedSubjectDesc(${sIdx}, this.value)" oninput="updateExtractedSubjectDesc(${sIdx}, this.value)">
      </div>

      <div id="units-wrapper-${sIdx}">
        ${unitsHtml}
      </div>

      <div style="margin-top: 14px; text-align: right;">
        <button type="button" class="btn btn-secondary btn-sm" onclick="addExtractedUnit(${sIdx})">
          <span>➕ Add Unit to ${escapeHtml(sub.name)}</span>
        </button>
      </div>
    `;

    return card;
  }

  // Window-level helper functions for interactive syllabus editing
  window.updateExtractedSubjectCode = function(sIdx, val) {
    if (extractedSyllabusState && extractedSyllabusState.subjects[sIdx]) {
      extractedSyllabusState.subjects[sIdx].code = val.trim().toUpperCase();
    }
  };

  window.updateExtractedSubjectName = function(sIdx, val) {
    if (extractedSyllabusState && extractedSyllabusState.subjects[sIdx]) {
      extractedSyllabusState.subjects[sIdx].name = val.trim();
    }
  };

  window.updateExtractedSubjectDesc = function(sIdx, val) {
    if (extractedSyllabusState && extractedSyllabusState.subjects[sIdx]) {
      extractedSyllabusState.subjects[sIdx].description = val.trim();
    }
  };

  window.updateExtractedSubjectSemester = function(sIdx, val) {
    if (extractedSyllabusState && extractedSyllabusState.subjects[sIdx]) {
      extractedSyllabusState.subjects[sIdx].semester = parseInt(val, 10);
    }
  };

  window.updateExtractedUnitTitle = function(sIdx, uIdx, val) {
    if (extractedSyllabusState && extractedSyllabusState.subjects[sIdx] && extractedSyllabusState.subjects[sIdx].units[uIdx]) {
      extractedSyllabusState.subjects[sIdx].units[uIdx].title = val.trim();
    }
  };

  window.removeExtractedTopic = function(sIdx, uIdx, tIdx) {
    if (extractedSyllabusState && extractedSyllabusState.subjects[sIdx] && extractedSyllabusState.subjects[sIdx].units[uIdx]) {
      extractedSyllabusState.subjects[sIdx].units[uIdx].topics.splice(tIdx, 1);
      renderSyllabusPreview(extractedSyllabusState, false);
    }
  };

  window.editExtractedTopic = function(sIdx, uIdx, tIdx) {
    if (extractedSyllabusState && extractedSyllabusState.subjects[sIdx] && extractedSyllabusState.subjects[sIdx].units[uIdx]) {
      const current = extractedSyllabusState.subjects[sIdx].units[uIdx].topics[tIdx];
      const updated = window.prompt('Edit Topic Name:', current);
      if (updated !== null && updated.trim()) {
        extractedSyllabusState.subjects[sIdx].units[uIdx].topics[tIdx] = updated.trim();
        renderSyllabusPreview(extractedSyllabusState, false);
      }
    }
  };

  window.addExtractedTopic = function(sIdx, uIdx) {
    const input = document.getElementById(`add-topic-input-${sIdx}-${uIdx}`);
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;

    if (extractedSyllabusState && extractedSyllabusState.subjects[sIdx] && extractedSyllabusState.subjects[sIdx].units[uIdx]) {
      if (!Array.isArray(extractedSyllabusState.subjects[sIdx].units[uIdx].topics)) {
        extractedSyllabusState.subjects[sIdx].units[uIdx].topics = [];
      }
      const parts = val.split(/[,;\n]+/).map(t => t.trim()).filter(Boolean);
      parts.forEach(p => {
        extractedSyllabusState.subjects[sIdx].units[uIdx].topics.push(p);
      });
      input.value = '';
      renderSyllabusPreview(extractedSyllabusState, false);
    }
  };

  window.removeExtractedUnit = function(sIdx, uIdx) {
    if (extractedSyllabusState && extractedSyllabusState.subjects[sIdx]) {
      extractedSyllabusState.subjects[sIdx].units.splice(uIdx, 1);
      renderSyllabusPreview(extractedSyllabusState, false);
    }
  };

  window.addExtractedUnit = function(sIdx) {
    if (extractedSyllabusState && extractedSyllabusState.subjects[sIdx]) {
      const units = extractedSyllabusState.subjects[sIdx].units || [];
      units.push({
        number: units.length + 1,
        title: `Unit ${units.length + 1}`,
        topics: ['New Topic']
      });
      extractedSyllabusState.subjects[sIdx].units = units;
      renderSyllabusPreview(extractedSyllabusState, false);
    }
  };

  window.removeExtractedSubject = async function(sIdx) {
    if (extractedSyllabusState && extractedSyllabusState.subjects) {
      const subName = extractedSyllabusState.subjects[sIdx]?.name || 'this subject';
      const confirmed = await window.showConfirmDialog({
        title: 'Remove Extracted Subject',
        message: `Are you sure you want to remove "${subName}" from this syllabus draft?`,
        confirmText: 'Remove Subject',
        confirmClass: 'btn-danger'
      });
      if (!confirmed) return;

      extractedSyllabusState.subjects.splice(sIdx, 1);
      if (extractedSyllabusState.subjects.length === 0) {
        window.discardExtractedSyllabus(true);
      } else {
        renderSyllabusPreview(extractedSyllabusState, false);
      }
      if (window.showToast) window.showToast(`Removed "${subName}" from draft.`, 'info');
    }
  };

  window.discardExtractedSyllabus = async function(skipConfirm = false) {
    if (!skipConfirm) {
      const confirmed = await window.showConfirmDialog({
        title: 'Discard Extracted Syllabus',
        message: 'Are you sure you want to discard this extracted syllabus preview? Any unconfirmed changes will be lost.',
        confirmText: 'Discard Draft',
        confirmClass: 'btn-danger'
      });
      if (!confirmed) return;
    }

    extractedSyllabusState = null;
    selectedPdfFile = null;
    if (previewSection) previewSection.style.display = 'none';
    if (fileInput) fileInput.value = '';
    if (dropzonePrompt) dropzonePrompt.style.display = 'block';
    if (fileSelectedDisplay) fileSelectedDisplay.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.showToast) window.showToast('Syllabus draft discarded.', 'info');
  };

  // Global Assigned Semester Dropdown Cascade
  const previewSemSelect = document.getElementById('previewSemesterSelect');
  if (previewSemSelect) {
    previewSemSelect.addEventListener('change', () => {
      const newSem = parseInt(previewSemSelect.value, 10) || 4;
      if (extractedSyllabusState && extractedSyllabusState.subjects) {
        extractedSyllabusState.semester = newSem;
        extractedSyllabusState.subjects.forEach(s => {
          s.semester = newSem;
        });
        renderSyllabusPreview(extractedSyllabusState, false);
      }
    });
  }

  // Add Another Subject Button Handler
  const addAnotherSubjectBtn = document.getElementById('addAnotherSubjectBtn');
  if (addAnotherSubjectBtn) {
    addAnotherSubjectBtn.addEventListener('click', () => {
      if (!extractedSyllabusState) return;
      const count = (extractedSyllabusState.subjects || []).length + 1;
      const targetSem = parseInt(document.getElementById('previewSemesterSelect').value, 10) || 4;

      extractedSyllabusState.subjects.push({
        name: `New Subject ${count}`,
        code: `CS-${targetSem}0${count}`,
        semester: targetSem,
        description: `Curriculum outline for Subject ${count}`,
        units: [
          { number: 1, title: 'Foundational Overview', topics: ['Core Concepts', 'Architecture'] }
        ]
      });
      renderSyllabusPreview(extractedSyllabusState, false);
    });
  }

  // ==========================================================
  // 8. Confirm & Save Extracted Subjects to Hub
  // ==========================================================
  const confirmAndSaveBtn = document.getElementById('confirmAndSaveBtn');
  if (confirmAndSaveBtn) {
    confirmAndSaveBtn.addEventListener('click', async () => {
      if (!extractedSyllabusState || !extractedSyllabusState.subjects || extractedSyllabusState.subjects.length === 0) {
        alert('No subjects available to save.');
        return;
      }

      const assignedSemester = parseInt(document.getElementById('previewSemesterSelect').value, 10) || 4;
      const overwrite = document.getElementById('overwriteCheckbox').checked;

      // Update semester on all subjects if set at top level
      extractedSyllabusState.subjects.forEach(sub => {
        if (!sub.semester) sub.semester = assignedSemester;
      });

      confirmAndSaveBtn.disabled = true;
      confirmAndSaveBtn.innerHTML = '<span>⏳</span><span>Saving Curriculum to Hub...</span>';

      try {
        const res = await fetch('/syllabus/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            semester: assignedSemester,
            subjects: extractedSyllabusState.subjects,
            overwrite
          })
        });

        const data = await res.json();
        if (data.success) {
          alert(`🎉 Successfully saved ${data.savedCount} subject(s) to Semester ${assignedSemester}!`);
          window.location.href = `/?semester=${assignedSemester}`;
        } else {
          let errorText = data.errors ? data.errors.join('\n') : data.error;
          alert(`Warning while saving subjects:\n${errorText}\n\nTip: Check "Update existing subjects" if you wish to overwrite duplicate codes.`);
        }
      } catch (err) {
        alert(`Failed to save syllabus: ${err.message}`);
      } finally {
        confirmAndSaveBtn.disabled = false;
        confirmAndSaveBtn.innerHTML = '<span>💾</span><span>Confirm & Save Subjects to Hub</span>';
      }
    });
  }

  // ==========================================================
  // 9. Manual Subject Form Creation
  // ==========================================================
  const manualForm = document.getElementById('manualSubjectForm');
  const manualAddUnitBtn = document.getElementById('manualAddUnitBtn');
  const manualUnitsContainer = document.getElementById('manualUnitsContainer');

  if (manualAddUnitBtn && manualUnitsContainer) {
    manualAddUnitBtn.addEventListener('click', () => {
      const unitCount = manualUnitsContainer.children.length + 1;
      const unitDiv = document.createElement('div');
      unitDiv.className = 'unit-edit-card card';
      unitDiv.style = 'background: var(--bg-primary); padding: 16px;';
      unitDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
            <span class="unit-number-badge">Unit ${unitCount}</span>
            <input type="text" class="form-control manual-unit-title" placeholder="Unit Title" value="Unit ${unitCount} Concepts" required>
          </div>
          <button type="button" class="btn btn-danger-outline btn-sm" onclick="this.closest('.unit-edit-card').remove()">✕</button>
        </div>
        <div>
          <label class="form-label" style="font-size: 0.8rem;">Topics (one per line or comma separated):</label>
          <textarea class="form-control manual-unit-topics" rows="3" placeholder="Topic 1&#10;Topic 2&#10;Topic 3"></textarea>
        </div>
      `;
      manualUnitsContainer.appendChild(unitDiv);
    });
  }

  if (manualForm) {
    manualForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const semester = parseInt(document.getElementById('manualSemSelect').value, 10);
      const code = document.getElementById('manualCodeInput').value.trim();
      const name = document.getElementById('manualNameInput').value.trim();
      const description = document.getElementById('manualDescInput').value.trim();

      const units = [];
      const unitCards = document.querySelectorAll('.unit-edit-card');
      unitCards.forEach((card, idx) => {
        const title = card.querySelector('.manual-unit-title').value.trim() || `Unit ${idx + 1}`;
        const rawTopics = card.querySelector('.manual-unit-topics').value;
        const topics = rawTopics
          .split(/[\n,;]/)
          .map(t => t.trim())
          .filter(t => t.length > 1);

        units.push({
          number: idx + 1,
          title,
          topics: topics.length > 0 ? topics : ['General Overview']
        });
      });

      try {
        const res = await fetch('/syllabus/api/subject/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, code, semester, description, units })
        });
        const data = await res.json();
        if (data.success) {
          alert(`🎉 Subject "${name}" created successfully in Semester ${semester}!`);
          window.location.href = `/subject/${data.subject.id}`;
        } else {
          alert(`Error creating subject: ${data.error}`);
        }
      } catch (err) {
        alert(`Failed to create subject: ${err.message}`);
      }
    });
  }

  // ==========================================================
  // 10. AI Topic Study Assistant Modal Pipeline
  // ==========================================================
  let currentStudyContext = null;
  const aiStudyModal = document.getElementById('aiStudyModal');
  const modalTopicTitle = document.getElementById('modalTopicTitle');
  const modalTopicSubtitle = document.getElementById('modalTopicSubtitle');
  const aiStudyLoading = document.getElementById('aiStudyLoading');
  const aiStudyContent = document.getElementById('aiStudyContent');
  const explanationControls = document.getElementById('explanationControls');
  const askTutorControls = document.getElementById('askTutorControls');
  const tutorQuestionInput = document.getElementById('tutorQuestionInput');
  const sendTutorQuestionBtn = document.getElementById('sendTutorQuestionBtn');
  const saveTopicToNotesBtn = document.getElementById('saveTopicToNotesBtn');

  let currentFeature = 'explanation';
  let currentLanguage = 'hinglish';
  let generatedCache = {};
  let currentInterconnectedHub = null;

  const modalTopicBadge = document.getElementById('modalTopicBadge');
  const modalPyqCount = document.getElementById('modalPyqCount');
  const modalLecCount = document.getElementById('modalLecCount');
  const modalToggleDoneBtn = document.getElementById('modalToggleDoneBtn');
  const modalToggleDoneText = document.getElementById('modalToggleDoneText');

  document.querySelectorAll('.open-ai-study-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const subjectId = btn.dataset.subjectId;
      const subjectName = btn.dataset.subjectName;
      const unitNumber = btn.dataset.unitNumber;
      const unitTitle = btn.dataset.unitTitle;
      const topic = btn.dataset.topic;

      currentStudyContext = { subjectId, subjectName, unitNumber, unitTitle, topic };
      generatedCache = {};
      currentFeature = 'explanation';
      currentInterconnectedHub = null;

      modalTopicTitle.textContent = topic;
      modalTopicSubtitle.textContent = `${subjectName} • Unit ${unitNumber}: ${unitTitle}`;

      // Reset badges
      if (modalTopicBadge) modalTopicBadge.style.display = 'none';
      if (modalPyqCount) modalPyqCount.textContent = '...';
      if (modalLecCount) modalLecCount.textContent = '...';

      // Reset tabs
      document.querySelectorAll('.ai-tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.feature === 'explanation');
      });

      aiStudyModal.style.display = 'flex';
      loadTopicAIFeature('explanation');

      // Fetch full interconnected topic data in background
      try {
        const hubRes = await fetch(`/subject/${subjectId}/topic-hub?topic=${encodeURIComponent(topic)}&unit=${unitNumber}`);
        const hubData = await hubRes.json();
        if (hubData.success && hubData.hub) {
          currentInterconnectedHub = hubData.hub;

          // Update badges
          if (modalPyqCount) modalPyqCount.textContent = hubData.hub.pyqs.appearances;
          if (modalLecCount) modalLecCount.textContent = hubData.hub.lectures.length;

          // Update importance badge in header
          if (modalTopicBadge) {
            modalTopicBadge.style.display = 'inline-block';
            modalTopicBadge.textContent = hubData.hub.importance.badge;
            if (hubData.hub.importance.level === 'HIGH') {
              modalTopicBadge.style.background = '#ef444420';
              modalTopicBadge.style.color = '#dc2626';
              modalTopicBadge.style.border = '1px solid #ef444440';
            } else if (hubData.hub.importance.level === 'MEDIUM') {
              modalTopicBadge.style.background = '#f59e0b20';
              modalTopicBadge.style.color = '#d97706';
              modalTopicBadge.style.border = '1px solid #f59e0b40';
            } else {
              modalTopicBadge.style.background = 'var(--bg-surface)';
              modalTopicBadge.style.color = 'var(--text-muted)';
              modalTopicBadge.style.border = '1px solid var(--border-color)';
            }
          }

          // Update completion button
          if (modalToggleDoneText) {
            modalToggleDoneText.textContent = hubData.hub.isCompleted ? 'Completed ✓ (Click to Undo)' : 'Mark Complete ✓';
          }
        }
      } catch (err) {
        console.warn('Could not fetch topic hub data:', err);
      }
    });
  });

  // Toggle Completion from inside Modal
  if (modalToggleDoneBtn) {
    modalToggleDoneBtn.addEventListener('click', async () => {
      if (!currentStudyContext) return;
      try {
        const res = await fetch('/progress/api/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subjectId: currentStudyContext.subjectId,
            topicName: currentStudyContext.topic
          })
        });
        const data = await res.json();
        if (data.success) {
          const isDone = data.result.isCompleted;
          if (modalToggleDoneText) {
            modalToggleDoneText.textContent = isDone ? 'Completed ✓ (Click to Undo)' : 'Mark Complete ✓';
          }
          // Update checkbox on subject page
          const matchingCheckbox = document.querySelector(`.topic-checkbox[data-subject="${currentStudyContext.subjectId}"][data-topic="${currentStudyContext.topic}"]`);
          if (matchingCheckbox) {
            matchingCheckbox.checked = isDone;
            const li = matchingCheckbox.closest('.topic-item');
            if (li) li.classList.toggle('completed', isDone);
          }
          // Update subject progress bar
          if (data.subjectStats) {
            const pb = document.getElementById(`progress-bar-${currentStudyContext.subjectId}`);
            const pt = document.getElementById(`progress-text-${currentStudyContext.subjectId}`);
            if (pb) pb.style.width = `${data.subjectStats.percentage}%`;
            if (pt) pt.textContent = `${data.subjectStats.percentage}% (${data.subjectStats.completedTopicsCount} / ${data.subjectStats.totalTopics} Topics)`;
          }
        }
      } catch (e) {
        alert(e.message);
      }
    });
  }

  // Tab switching
  document.querySelectorAll('.ai-tab-btn').forEach(tabBtn => {
    tabBtn.addEventListener('click', () => {
      document.querySelectorAll('.ai-tab-btn').forEach(b => b.classList.remove('active'));
      tabBtn.classList.add('active');
      currentFeature = tabBtn.dataset.feature;
      loadTopicAIFeature(currentFeature);
    });
  });

  // Language toggle for explanation (Hinglish, Hindi, English)
  document.querySelectorAll('.lang-toggle-btn').forEach(lBtn => {
    lBtn.addEventListener('click', () => {
      document.querySelectorAll('.lang-toggle-btn').forEach(b => b.classList.remove('active'));
      lBtn.classList.add('active');
      currentLanguage = lBtn.dataset.lang;
      generatedCache[`explanation_${currentLanguage}`] = null;
      loadTopicAIFeature('explanation');
    });
  });

  // Ask Tutor button
  if (sendTutorQuestionBtn) {
    sendTutorQuestionBtn.addEventListener('click', () => {
      const q = tutorQuestionInput.value.trim();
      if (!q) return;
      loadTopicAIFeature('askTutor', q);
    });
  }

  async function loadTopicAIFeature(feature, question = '') {
    if (!currentStudyContext) return;

    explanationControls.style.display = (feature === 'explanation') ? 'flex' : 'none';
    askTutorControls.style.display = (feature === 'askTutor') ? 'block' : 'none';

    // Handle Interconnected PYQs Tab
    if (feature === 'pyqs') {
      aiStudyLoading.style.display = 'none';
      aiStudyContent.style.display = 'block';
      if (saveTopicToNotesBtn) saveTopicToNotesBtn.style.display = 'none';

      const hub = currentInterconnectedHub;
      const pyqs = (hub && hub.pyqs) ? hub.pyqs : null;

      if (!pyqs || !pyqs.questions || pyqs.questions.length === 0) {
        renderMarkdownContent(`### 📑 Past Year Examination Questions (PYQs)\n\n> [!NOTE]\n> No direct questions for **${currentStudyContext.topic}** have been uploaded in past exam papers yet.\n\nUpload more university question papers in [PYQ Analyzer](/pyqs?subject=${currentStudyContext.subjectId}) to unlock automatic repeat detection and past questions for this topic!`);
        return;
      }

      let pyqMd = `### 📑 Authentic Past Exam Questions (${pyqs.appearances} Appearances • ${pyqs.totalMarks} Total Marks)\n\n`;
      if (pyqs.appearances >= 2) {
        pyqMd += `> [!IMPORTANT]\n> 🔥 **Exam Repeat Alert:** This topic appeared across **${pyqs.years.join(', ')}** in university examinations! Highly recommended for upcoming exams.\n\n`;
      }

      pyqs.questions.forEach((q, idx) => {
        pyqMd += `#### Question ${idx + 1}: ${q.year} (${q.examType || 'Exam'}) [${q.marks} Marks] - *${q.type}*\n\n"${q.question}"\n\n---\n\n`;
      });

      renderMarkdownContent(pyqMd);
      return;
    }

    // Handle Interconnected Lectures Tab
    if (feature === 'lectures') {
      aiStudyLoading.style.display = 'none';
      aiStudyContent.style.display = 'block';
      if (saveTopicToNotesBtn) saveTopicToNotesBtn.style.display = 'none';

      const hub = currentInterconnectedHub;
      const lectures = (hub && hub.lectures) ? hub.lectures : [];

      let lecMd = `### 🎥 Related Lectures & Transcripts for ${currentStudyContext.topic}\n\n`;

      if (lectures.length > 0) {
        lecMd += `Found **${lectures.length}** saved lecture(s) in your Study Library:\n\n`;
        lectures.forEach(l => {
          lecMd += `- **${l.lectureTitle}** (Unit ${l.unitNumber}) — Added on ${new Date(l.createdAt).toLocaleDateString()}\n  [Open Full Notes & Transcripts](/library/${l.id}) | [Export Markdown](/library/${l.id}/export/markdown)\n\n`;
        });
      } else {
        lecMd += `> [!NOTE]\n> No local lectures have been saved for this specific topic yet.\n\n`;
      }

      lecMd += `\n---\n\n#### 🔍 Recommended External Resources:\n- [Search Curated YouTube Lectures for "${currentStudyContext.topic}"](${hub ? hub.recommendedYoutubeSearchUrl : 'https://youtube.com'})\n- [Add a YouTube Lecture with AI Transcripts & Notes](/add-lecture?subject=${currentStudyContext.subjectId}&unit=${currentStudyContext.unitNumber}&topic=${encodeURIComponent(currentStudyContext.topic)})\n`;

      renderMarkdownContent(lecMd);
      return;
    }

    // Handle Interconnected Practice Tab
    if (feature === 'practice') {
      aiStudyLoading.style.display = 'none';
      aiStudyContent.style.display = 'block';
      if (saveTopicToNotesBtn) saveTopicToNotesBtn.style.display = 'none';

      const hub = currentInterconnectedHub;
      const sample = (hub && hub.practiceSample && hub.practiceSample.length > 0) ? hub.practiceSample[0] : null;

      let practiceMd = `### 🎯 Practice Center: ${currentStudyContext.topic}\n\nTest your understanding and retention using active recall tools:\n\n`;
      practiceMd += `1. **[Start Topic MCQ Quiz →](/practice/quiz?subject=${currentStudyContext.subjectId}&topic=${encodeURIComponent(currentStudyContext.topic)})** (5 timed multiple-choice questions with instant explanations)\n`;
      practiceMd += `2. **[Review Digital Flashcards →](/practice/flashcards?subject=${currentStudyContext.subjectId}&topic=${encodeURIComponent(currentStudyContext.topic)})** (Flippable active recall cards)\n`;
      practiceMd += `3. **[Full-Curriculum Mock Exam →](/practice/mock/${currentStudyContext.subjectId})** (Full timed university mock simulator)\n\n`;

      if (sample) {
        practiceMd += `---\n\n#### Sample Practice Question:\n**"${sample.question}"**\n\n- A) ${sample.options[0]}\n- B) ${sample.options[1]}\n- C) ${sample.options[2]}\n- D) ${sample.options[3]}\n\n*Click "Start Topic MCQ Quiz" above for interactive answering with score tracking.*`;
      }

      renderMarkdownContent(practiceMd);
      return;
    }

    // Standard AI Generation Features (Explanation, Short Notes, Questions, Revision, Ask Tutor)
    const cacheKey = (feature === 'explanation') ? `explanation_${currentLanguage}` : feature;
    if (generatedCache[cacheKey] && !question) {
      renderMarkdownContent(generatedCache[cacheKey]);
      if (saveTopicToNotesBtn) saveTopicToNotesBtn.style.display = 'inline-flex';
      return;
    }

    aiStudyContent.style.display = 'none';
    aiStudyLoading.style.display = 'block';
    if (saveTopicToNotesBtn) saveTopicToNotesBtn.style.display = 'none';

    try {
      const res = await fetch('/syllabus/api/topic-study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: currentStudyContext.subjectId,
          unitTitle: currentStudyContext.unitTitle,
          topic: currentStudyContext.topic,
          feature,
          language: currentLanguage,
          question
        })
      });

      const data = await res.json();
      if (data.success && data.content) {
        if (!question) generatedCache[cacheKey] = data.content;
        renderMarkdownContent(data.content);
        if (saveTopicToNotesBtn) saveTopicToNotesBtn.style.display = 'inline-flex';
      } else {
        renderMarkdownContent(`⚠️ **AI Error:** ${data.error || 'Failed to generate content.'}`);
      }
    } catch (err) {
      renderMarkdownContent(`⚠️ **Network Error:** ${err.message}`);
    } finally {
      aiStudyLoading.style.display = 'none';
      aiStudyContent.style.display = 'block';
    }
  }

  // Simple, fast Markdown-to-HTML parser for AI answers
  function renderMarkdownContent(mdText) {
    if (!aiStudyContent) return;

    let html = mdText
      // Code blocks
      .replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/gi, (match, lang, code) => {
        return `<pre><code class="language-${lang}">${escapeHtml(code.trim())}</code></pre>`;
      })
      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Headers
      .replace(/^### (.*$)/gim, '<h4 style="margin: 14px 0 6px; font-weight:700;">$1</h4>')
      .replace(/^## (.*$)/gim, '<h3 style="margin: 18px 0 8px; font-weight:700; color:var(--accent-primary);">$1</h3>')
      .replace(/^# (.*$)/gim, '<h2 style="margin: 22px 0 10px; font-weight:800;">$1</h2>')
      // Bold & Italic
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      // Blockquotes
      .replace(/^\> (.*$)/gim, '<blockquote style="border-left: 4px solid var(--accent-primary); padding-left: 12px; margin: 10px 0; color: var(--text-secondary);">$1</blockquote>')
      // Lists
      .replace(/^\s*[\-\*]\s+(.*$)/gim, '<li style="margin-bottom: 4px;">$1</li>')
      .replace(/^\s*(\d+)\.\s+(.*$)/gim, '<li style="margin-bottom: 4px;"><strong>$1.</strong> $2</li>')
      // Tables (Basic)
      .replace(/\|(.+)\|/g, (match) => {
        const cells = match.split('|').filter(c => c.trim().length > 0);
        if (cells.some(c => c.includes('---'))) return '';
        const tds = cells.map(c => `<td style="padding: 6px 12px; border: 1px solid var(--border-color);">${c.trim()}</td>`).join('');
        return `<tr>${tds}</tr>`;
      })
      // Paragraphs & Linebreaks
      .replace(/\n\n/g, '<br><br>');

    aiStudyContent.innerHTML = html;
  }

  // Save generated material into Study Library
  if (saveTopicToNotesBtn) {
    saveTopicToNotesBtn.addEventListener('click', async () => {
      if (!currentStudyContext) return;

      const studyMaterials = {
        hinglish: generatedCache['explanation_hinglish'] || '',
        examNotes: generatedCache['explanation_english'] || generatedCache['shortNotes'] || '',
        importantQuestions: generatedCache['importantQuestions'] || '',
        quickRevision: generatedCache['revisionSummary'] || ''
      };

      saveTopicToNotesBtn.disabled = true;
      saveTopicToNotesBtn.textContent = 'Saving...';

      try {
        const res = await fetch('/syllabus/api/topic-study/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subjectId: currentStudyContext.subjectId,
            unitNumber: currentStudyContext.unitNumber,
            unitTitle: currentStudyContext.unitTitle,
            topic: currentStudyContext.topic,
            studyMaterials
          })
        });

        const data = await res.json();
        if (data.success) {
          alert(`🎉 Saved AI study notes for "${currentStudyContext.topic}" into your Study Library!`);
        } else {
          alert(`Error saving notes: ${data.error}`);
        }
      } catch (err) {
        alert(`Failed to save: ${err.message}`);
      } finally {
        saveTopicToNotesBtn.disabled = false;
        saveTopicToNotesBtn.innerHTML = '<span>💾</span><span>Save to Study Library</span>';
      }
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Global Math & Markdown Formatters
  function wrapIfNeeded(expr) {
    const trimmed = (expr || '').trim();
    if (!trimmed) return '';
    let depth = 0;
    let hasTopLevelPlusMinus = false;
    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (depth === 0 && (ch === '+' || ch === '-')) {
        hasTopLevelPlusMinus = true;
        break;
      }
    }
    return hasTopLevelPlusMinus ? `(${trimmed})` : trimmed;
  }

  function cleanMathSnippet(math) {
    if (!math || typeof math !== 'string') return '';
    let m = math;

    while (/\\frac\{([^{}]+)\}\{([^{}]+)\}/.test(m)) {
      m = m.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_match, num, den) => {
        const cleanNum = wrapIfNeeded(num);
        const cleanDen = wrapIfNeeded(den);
        return `${cleanNum}/${cleanDen}`;
      });
    }

    const symbolMap = [
      [/\\leq?\b/g, '≤'],
      [/\\geq?\b/g, '≥'],
      [/\\neq?\b/g, '≠'],
      [/\\in\b/g, '∈'],
      [/\\notin\b/g, '∉'],
      [/\\subset\b/g, '⊂'],
      [/\\subseteq\b/g, '⊆'],
      [/\\forall\b/g, '∀'],
      [/\\exists\b/g, '∃'],
      [/\\rightarrow\b|\\to\b/g, '→'],
      [/\\leftarrow\b/g, '←'],
      [/\\leftrightarrow\b/g, '↔'],
      [/\\Rightarrow\b|\\implies\b/g, '⇒'],
      [/\\Leftarrow\b/g, '⇐'],
      [/\\Leftrightarrow\b|\\iff\b/g, '⇔'],
      [/\\land\b|\\wedge\b/g, '∧'],
      [/\\lor\b|\\vee\b/g, '∨'],
      [/\\neg\b|\\sim\b/g, '¬'],
      [/\\times\b/g, '×'],
      [/\\div\b/g, '÷'],
      [/\\pm\b/g, '±'],
      [/\\cdot\b/g, '·'],
      [/\\cap\b/g, '∩'],
      [/\\cup\b/g, '∪'],
      [/\\emptyset\b|\\varnothing\b/g, '∅'],
      [/\\infty\b/g, '∞'],
      [/\\sum\b/g, '∑'],
      [/\\prod\b/g, '∏'],
      [/\\sqrt\{([^{}]+)\}/g, '√($1)'],
      [/\\sqrt\b/g, '√'],
      [/\\alpha\b/g, 'α'],
      [/\\beta\b/g, 'β'],
      [/\\gamma\b/g, 'γ'],
      [/\\delta\b/g, 'δ'],
      [/\\theta\b/g, 'θ'],
      [/\\lambda\b/g, 'λ'],
      [/\\pi\b/g, 'π'],
      [/\\sigma\b/g, 'σ'],
      [/\\omega\b/g, 'ω'],
      [/\\Delta\b/g, 'Δ'],
      [/\\Sigma\b/g, 'Σ'],
      [/\\Omega\b/g, 'Ω'],
      [/\\mathbb\{R\}/g, 'ℝ'],
      [/\\mathbb\{Z\}/g, 'ℤ'],
      [/\\mathbb\{N\}/g, 'ℕ'],
      [/\\mathbb\{Q\}/g, 'ℚ'],
      [/\\text\{([^{}]+)\}/g, '$1'],
      [/\\mathrm\{([^{}]+)\}/g, '$1'],
      [/\\mathbf\{([^{}]+)\}/g, '<b>$1</b>'],
      [/\\left\(/g, '('],
      [/\\right\)/g, ')'],
      [/\\left\[/g, '['],
      [/\\right\]/g, ']'],
      [/\\left\\{/g, '{'],
      [/\\right\\}/g, '}'],
      [/\\\{/g, '{'],
      [/\\\}/g, '}']
    ];

    for (const [re, sym] of symbolMap) {
      m = m.replace(re, sym);
    }

    m = m.replace(/_\{([^{}]+)\}/g, '<sub>$1</sub>');
    m = m.replace(/_([a-zA-Z0-9\u0370-\u03ff])/g, '<sub>$1</sub>');
    m = m.replace(/\^\{([^{}]+)\}/g, '<sup>$1</sup>');
    m = m.replace(/\^([a-zA-Z0-9+-])/g, '<sup>$1</sup>');

    return m.trim();
  }

  window.formatMath = function(text) {
    if (!text || typeof text !== 'string') return text || '';
    let out = text;
    out = out.replace(/\$\$([\s\S]*?)\$\$/g, (_match, math) => cleanMathSnippet(math));
    out = out.replace(/\$([^\$\n\r]+?)\$/g, (_match, math) => cleanMathSnippet(math));
    if (/\\(frac|in|subset|subseteq|forall|exists|le|ge|ne|to|land|lor|neg|sqrt|times)/.test(out)) {
      out = cleanMathSnippet(out);
    }
    out = out.replace(/\$([^$\n\r]+?)\$/g, '$1');
    return out;
  };

  window.formatMarkdown = function(md) {
    if (!md) return '';
    const clean = window.formatMath(md);
    return clean
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/gim, '<code>$1</code>')
      .replace(/^\- (.*$)/gim, '<li>$1</li>')
      .replace(/\n/gim, '<br>');
  };

  // Clean raw LaTeX in existing markdown containers
  document.querySelectorAll('.markdown-body').forEach(el => {
    if (el.innerHTML.includes('$') || el.innerHTML.includes('\\frac')) {
      el.innerHTML = window.formatMath(el.innerHTML);
    }
  });
});
