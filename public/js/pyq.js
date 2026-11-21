// PYQ File Upload & Question Extractor Interactions

document.addEventListener('DOMContentLoaded', () => {
  const pyqForm = document.getElementById('pyqUploadForm');
  const paperFileInput = document.getElementById('paperFileInput');
  const uploadStatus = document.getElementById('pyqUploadStatus');
  const uploadBtn = document.getElementById('uploadPyqBtn');

  if (pyqForm) {
    pyqForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!paperFileInput.files || paperFileInput.files.length === 0) {
        alert('Please select at least one question paper file (PDF or TXT).');
        return;
      }

      const fileCount = paperFileInput.files.length;
      const formData = new FormData(pyqForm);

      uploadBtn.disabled = true;
      uploadBtn.innerHTML = fileCount > 1 
        ? `⏳ Uploading & Analyzing ${fileCount} Papers (OCR & Question Mapping)...`
        : '⏳ Uploading & Extracting Authentic Questions...';
      
      uploadStatus.className = 'alert alert-info';
      uploadStatus.innerHTML = `Analyzing ${fileCount} examination document${fileCount > 1 ? 's' : ''} using OCR and syllabus mapping. Please wait...`;
      uploadStatus.classList.remove('hidden');

      try {
        const res = await fetch('/pyqs/api/upload', {
          method: 'POST',
          body: formData
        });

        const data = await res.json();
        if (data.success) {
          uploadStatus.className = 'alert alert-success';
          const msg = fileCount > 1
            ? `✅ Successfully processed ${data.count || fileCount} question papers! Redirecting to analytics...`
            : `✅ Successfully uploaded and extracted questions from <strong>${data.pyq.year} (${data.pyq.examType})</strong>!`;
          uploadStatus.innerHTML = msg;

          setTimeout(() => {
            if (fileCount > 1 && data.pyq && data.pyq.subjectId) {
              window.location.href = `/pyqs/analytics/${data.pyq.subjectId}`;
            } else if (data.pyq && data.pyq.id) {
              window.location.href = `/pyqs/${data.pyq.id}`;
            } else {
              window.location.reload();
            }
          }, 1200);
        } else {
          uploadStatus.className = 'alert alert-danger';
          uploadStatus.innerHTML = `⚠️ Extraction error: ${data.error}`;
          uploadBtn.disabled = false;
          uploadBtn.innerHTML = '📤 Upload & Extract Questions';
        }
      } catch (err) {
        uploadStatus.className = 'alert alert-danger';
        uploadStatus.innerHTML = `⚠️ Error: ${err.message}`;
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = '📤 Upload & Extract Questions';
      }
    });
  }

  // Delete PYQ Confirmation & Action
  document.querySelectorAll('.delete-pyq-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const id = btn.dataset.id;
      const title = btn.dataset.title || 'this question paper';

      const confirmed = await window.showConfirmDialog({
        title: 'Delete Question Paper',
        message: `Are you sure you want to delete "${title}"? This will permanently remove the record and uploaded files.`,
        confirmText: 'Confirm Delete'
      });
      if (!confirmed) return;

      btn.disabled = true;
      const originalHtml = btn.innerHTML;
      btn.innerHTML = '⏳ Deleting...';

      try {
        const res = await fetch(`/pyqs/api/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          window.showToast('Question paper deleted successfully.', 'success');
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
          btn.innerHTML = originalHtml;
        }
      } catch (err) {
        window.showToast(`Error: ${err.message}`, 'error');
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
    });
  });
});
