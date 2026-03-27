/**
 * SIGNATURE MANAGER WITH IMAGE UPLOAD
 * Full-featured email signature manager with image support
 */

// ==================== DATA STORAGE ====================

function getSignatures() {
  const stored = localStorage.getItem('bp_email_signatures');
  if (!stored) {
    // Return default signatures
    return [
      {
        id: 'wfn-default',
        name: 'Standard (WFN)',
        role: 'WFN',
        isDefault: true,
        text: '— AJ\nADP\nbeyondpayroll.net',
        image: null
      },
      {
        id: 'ts-default',
        name: 'Standard (TotalSource)',
        role: 'TS',
        isDefault: false,
        text: '— AJ\nADP TotalSource PEO\nbeyondpayroll.net',
        image: null
      }
    ];
  }
  return JSON.parse(stored);
}

function saveSignatures(signatures) {
  localStorage.setItem('bp_email_signatures', JSON.stringify(signatures));
}

function getDefaultSignature(role = 'WFN') {
  const signatures = getSignatures();
  const roleMatch = signatures.find(s => s.role === role && s.isDefault);
  if (roleMatch) return roleMatch;
  
  const anyDefault = signatures.find(s => s.isDefault);
  if (anyDefault) return anyDefault;
  
  return signatures[0] || null;
}

// ==================== MODAL UI ====================

function showSignatureManager() {
  const modal = document.createElement('div');
  modal.className = 'sig-manager-modal';
  modal.innerHTML = `
    <div class="sig-manager-overlay" onclick="closeSignatureManager()"></div>
    <div class="sig-manager-content">
      <div class="sig-manager-header">
        <h2>📧 Email Signatures</h2>
        <button class="sig-close-btn" onclick="closeSignatureManager()">&times;</button>
      </div>
      
      <div class="sig-outlook-note">
        <span class="sig-note-icon">📧</span>
        <div>
          <strong>Outlook Integration</strong>
          <p>The <strong>default signature</strong> is automatically appended when you click "Open in Outlook." Note: Outlook's built-in signatures won't auto-apply to mailto: links—use this signature manager to control what gets sent.</p>
        </div>
      </div>
      
      <button class="sig-new-btn" onclick="showSignatureEditor()">+ New Signature</button>
      
      <div id="sigListContainer" class="sig-list-container"></div>
    </div>
  `;
  
  document.body.appendChild(modal);
  renderSignatureList();
}

function closeSignatureManager() {
  const modal = document.querySelector('.sig-manager-modal');
  if (modal) modal.remove();
}

function renderSignatureList() {
  const container = document.getElementById('sigListContainer');
  if (!container) return;
  
  const signatures = getSignatures();
  
  container.innerHTML = signatures.map(sig => `
    <div class="sig-card">
      <div class="sig-card-header">
        <div>
          <h3>${sig.name}</h3>
          ${sig.role ? `<span class="sig-role-badge ${sig.role.toLowerCase()}">${sig.role}</span>` : ''}
          ${sig.isDefault ? '<span class="sig-default-badge">DEFAULT</span>' : ''}
        </div>
        <div class="sig-card-actions">
          <button class="sig-edit-btn" onclick="editSignature('${sig.id}')">Edit</button>
          ${!sig.isDefault ? `<button class="sig-delete-btn" onclick="deleteSignature('${sig.id}')">🗑</button>` : ''}
        </div>
      </div>
      
      <div class="sig-preview">
        ${sig.image ? `<img src="${sig.image}" alt="Signature image" class="sig-preview-image">` : ''}
        <pre>${sig.text}</pre>
      </div>
    </div>
  `).join('');
}

// ==================== SIGNATURE EDITOR ====================

function showSignatureEditor(signatureId = null) {
  const isEdit = !!signatureId;
  const sig = isEdit ? getSignatures().find(s => s.id === signatureId) : null;
  
  const editor = document.createElement('div');
  editor.className = 'sig-editor-modal';
  editor.innerHTML = `
    <div class="sig-editor-overlay" onclick="closeSignatureEditor()"></div>
    <div class="sig-editor-content">
      <div class="sig-editor-header">
        <h2>${isEdit ? '✏️ Edit Signature' : '➕ New Signature'}</h2>
        <button class="sig-close-btn" onclick="closeSignatureEditor()">&times;</button>
      </div>
      
      <div class="sig-editor-body">
        <div class="sig-form-group">
          <label>Signature Name</label>
          <input type="text" id="sigName" class="sig-input" placeholder="e.g., Professional, Casual, Executive" value="${sig?.name || ''}">
        </div>
        
        <div class="sig-form-group">
          <label>Role/Track (optional)</label>
          <select id="sigRole" class="sig-input">
            <option value="">None</option>
            <option value="WFN" ${sig?.role === 'WFN' ? 'selected' : ''}>WFN</option>
            <option value="TS" ${sig?.role === 'TS' ? 'selected' : ''}>TotalSource</option>
            <option value="Both" ${sig?.role === 'Both' ? 'selected' : ''}>Both</option>
          </select>
        </div>
        
        <div class="sig-form-group">
          <label>Signature Text</label>
          <textarea id="sigText" class="sig-textarea" rows="6" placeholder="— AJ&#10;ADP&#10;beyondpayroll.net">${sig?.text || ''}</textarea>
        </div>
        
        <div class="sig-form-group">
          <label>Signature Image (optional)</label>
          <div class="sig-image-controls">
            <button class="sig-upload-btn" onclick="document.getElementById('sigImageInput').click()">
              📷 Upload Image
            </button>
            ${sig?.image ? '<button class="sig-remove-image-btn" onclick="removeSignatureImage()">🗑 Remove Image</button>' : ''}
          </div>
          <input type="file" id="sigImageInput" accept="image/*" style="display: none" onchange="handleImageUpload(event)">
          <p class="sig-image-hint">Upload your photo, company logo, or screenshot (PNG, JPG, GIF - max 500KB)</p>
          
          <div id="sigImagePreview" class="sig-image-preview">
            ${sig?.image ? `<img src="${sig.image}" alt="Signature image">` : '<p>No image uploaded</p>'}
          </div>
        </div>
        
        <div class="sig-form-group">
          <label class="sig-checkbox-label">
            <input type="checkbox" id="sigIsDefault" ${sig?.isDefault ? 'checked' : ''}>
            Set as default signature
          </label>
        </div>
      </div>
      
      <div class="sig-editor-footer">
        <button class="sig-cancel-btn" onclick="closeSignatureEditor()">Cancel</button>
        <button class="sig-save-btn" onclick="saveSignature('${signatureId || ''}')">
          ${isEdit ? 'Save Changes' : 'Create Signature'}
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(editor);
}

function closeSignatureEditor() {
  const editor = document.querySelector('.sig-editor-modal');
  if (editor) editor.remove();
}

// ==================== IMAGE UPLOAD ====================

let currentImageData = null;

function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Validate file size (max 500KB)
  if (file.size > 500 * 1024) {
    alert('Image too large! Please use an image under 500KB.');
    return;
  }
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file (PNG, JPG, GIF).');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    currentImageData = e.target.result;
    
    // Update preview
    const preview = document.getElementById('sigImagePreview');
    if (preview) {
      preview.innerHTML = `<img src="${currentImageData}" alt="Signature image">`;
    }
    
    // Show remove button
    const controls = document.querySelector('.sig-image-controls');
    if (controls && !controls.querySelector('.sig-remove-image-btn')) {
      controls.insertAdjacentHTML('beforeend', '<button class="sig-remove-image-btn" onclick="removeSignatureImage()">🗑 Remove Image</button>');
    }
  };
  
  reader.readAsDataURL(file);
}

function removeSignatureImage() {
  currentImageData = null;
  
  const preview = document.getElementById('sigImagePreview');
  if (preview) {
    preview.innerHTML = '<p>No image uploaded</p>';
  }
  
  const removeBtn = document.querySelector('.sig-remove-image-btn');
  if (removeBtn) removeBtn.remove();
  
  document.getElementById('sigImageInput').value = '';
}

// ==================== SAVE/DELETE ====================

function saveSignature(editId) {
  const name = document.getElementById('sigName').value.trim();
  const role = document.getElementById('sigRole').value;
  const text = document.getElementById('sigText').value;
  const isDefault = document.getElementById('sigIsDefault').checked;
  
  if (!name) {
    alert('Please enter a signature name.');
    return;
  }
  
  if (!text) {
    alert('Please enter signature text.');
    return;
  }
  
  const signatures = getSignatures();
  
  // If setting as default, unset others
  if (isDefault) {
    signatures.forEach(s => s.isDefault = false);
  }
  
  if (editId) {
    // Edit existing
    const index = signatures.findIndex(s => s.id === editId);
    if (index !== -1) {
      signatures[index] = {
        ...signatures[index],
        name,
        role,
        text,
        isDefault,
        image: currentImageData !== undefined ? currentImageData : signatures[index].image
      };
    }
  } else {
    // Create new
    signatures.push({
      id: 'sig-' + Date.now(),
      name,
      role,
      text,
      isDefault,
      image: currentImageData
    });
  }
  
  saveSignatures(signatures);
  closeSignatureEditor();
  renderSignatureList();
  
  // Reset current image
  currentImageData = null;
}

function editSignature(id) {
  const sig = getSignatures().find(s => s.id === id);
  if (sig) {
    currentImageData = sig.image;
    showSignatureEditor(id);
  }
}

function deleteSignature(id) {
  if (!confirm('Delete this signature?')) return;
  
  const signatures = getSignatures().filter(s => s.id !== id);
  saveSignatures(signatures);
  renderSignatureList();
}

// ==================== EXPORTS ====================

window.showSignatureManager = showSignatureManager;
window.closeSignatureManager = closeSignatureManager;
window.showSignatureEditor = showSignatureEditor;
window.closeSignatureEditor = closeSignatureEditor;
window.handleImageUpload = handleImageUpload;
window.removeSignatureImage = removeSignatureImage;
window.saveSignature = saveSignature;
window.editSignature = editSignature;
window.deleteSignature = deleteSignature;
window.getDefaultSignature = getDefaultSignature;
window.getSignatures = getSignatures;

console.log('✅ Signature Manager with Image Upload loaded');
