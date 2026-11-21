// Note Viewer & Editor

document.addEventListener('DOMContentLoaded', () => {
  // Tab switching
  document.querySelectorAll('.note-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      document.querySelectorAll('.note-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.note-content-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const pane = document.getElementById(target);
      if (pane) pane.classList.add('active');
    });
  });

  // Toggle Edit Mode
  const editToggleBtn = document.getElementById('editToggleBtn');
  const viewContainer = document.getElementById('viewModeContainer');
  const editContainer = document.getElementById('editModeContainer');
  const saveEditsBtn = document.getElementById('saveEditsBtn');

  if (editToggleBtn && viewContainer && editContainer) {
    editToggleBtn.addEventListener('click', () => {
      const isEditing = editContainer.style.display === 'block';
      if (isEditing) {
        editContainer.style.display = 'none';
        viewContainer.style.display = 'block';
        editToggleBtn.textContent = '✏️ Edit Notes';
      } else {
        editContainer.style.display = 'block';
        viewContainer.style.display = 'none';
        editToggleBtn.textContent = '👁️ View Notes';
      }
    });
  }

  // Save Edits via AJAX
  if (saveEditsBtn) {
    saveEditsBtn.addEventListener('click', async () => {
      const lectureId = saveEditsBtn.dataset.id;
      const updatedMaterials = {
        hinglish: document.getElementById('editHinglish') ? document.getElementById('editHinglish').value : '',
        examNotes: document.getElementById('editExamNotes') ? document.getElementById('editExamNotes').value : '',
        importantQuestions: document.getElementById('editQuestions') ? document.getElementById('editQuestions').value : '',
        quickRevision: document.getElementById('editRevision') ? document.getElementById('editRevision').value : '',
        codeExamples: document.getElementById('editCode') ? document.getElementById('editCode').value : ''
      };

      saveEditsBtn.disabled = true;
      saveEditsBtn.textContent = 'Saving...';

      try {
        const res = await fetch(`/library/api/${lectureId}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ materials: updatedMaterials })
        });
        const data = await res.json();
        if (data.success) {
          alert('✅ Notes updated successfully!');
          window.location.reload();
        } else {
          alert(`Update failed: ${data.error}`);
        }
      } catch (err) {
        alert(`Error saving edits: ${err.message}`);
      } finally {
        saveEditsBtn.disabled = false;
        saveEditsBtn.textContent = '💾 Save Changes';
      }
    });
  }

  // Print to PDF
  const printPdfBtn = document.getElementById('printPdfBtn');
  if (printPdfBtn) {
    printPdfBtn.addEventListener('click', () => {
      window.print();
    });
  }
});
