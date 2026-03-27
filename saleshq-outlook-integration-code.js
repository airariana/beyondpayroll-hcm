/**
 * Modified app.js integration code for Outlook workflow
 * Drop this code into your existing app.js file
 */

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', function() {
  console.log('🎨 Initializing Canva integration...');
  
  // Initialize Canva panel
  initializeCanvaPanel();
  
  // Initialize Outlook integration
  initializeOutlookMode();
  
  console.log('✅ Canva integration connected to existing research workflow');
});

function initializeCanvaPanel() {
  const container = document.getElementById('canvaPanelContainer');
  if (container) {
    container.innerHTML = createCanvaPanel();
    
    // Enable Outlook mode styling
    document.getElementById('canvaPanel').classList.add('outlook-mode');
    
    // Attach event handlers using event delegation (works on mobile)
    attachCanvaEventHandlers();
  }
}

// Attach all event handlers using event delegation
function attachCanvaEventHandlers() {
  const panel = document.getElementById('canvaPanel');
  if (!panel) return;
  
  // Asset type selection - use event delegation
  panel.addEventListener('click', function(e) {
    // Find clicked asset button
    const assetBtn = e.target.closest('.asset-type-btn');
    if (assetBtn) {
      const assetType = assetBtn.dataset.type;
      if (assetType) {
        selectAssetType(assetType);
      }
      return;
    }
    
    // Close button
    if (e.target.closest('.close-btn')) {
      toggleCanvaPanel();
      return;
    }
    
    // Generate button
    if (e.target.closest('#generateAssetBtn')) {
      generateCanvaAsset();
      return;
    }
    
    // Cancel button
    if (e.target.closest('#cancelGenerationBtn')) {
      resetGenerationForm();
      return;
    }
  });
  
  // Touch events for better mobile support
  panel.addEventListener('touchstart', function(e) {
    // Prevent double-tap zoom on buttons
    const isButton = e.target.closest('button, .asset-type-btn');
    if (isButton) {
      e.preventDefault();
    }
  }, { passive: false });
  
  // Overlay click to close
  const overlay = document.getElementById('canvaOverlay');
  if (overlay) {
    overlay.addEventListener('click', toggleCanvaPanel);
    overlay.addEventListener('touchstart', function(e) {
      e.preventDefault();
      toggleCanvaPanel();
    }, { passive: false });
  }
}

function initializeOutlookMode() {
  // Add Outlook badge to header
  const header = document.querySelector('.canva-header h3');
  if (header) {
    header.innerHTML += '<span class="outlook-badge">📧 Outlook Ready</span>';
  }
  
  // Add workflow instructions
  addOutlookInstructions();
}

function addOutlookInstructions() {
  const content = document.querySelector('.canva-content');
  if (content && !document.getElementById('outlookWorkflow')) {
    const instructions = `
      <div class="outlook-workflow" id="outlookWorkflow">
        <h4>📧 Outlook Workflow:</h4>
        <ol>
          <li>Select your asset type below</li>
          <li>Fill in prospect details (auto-fills if available)</li>
          <li>Generate your Canva design</li>
          <li>Get Outlook-ready email template</li>
          <li>Copy to Outlook and send!</li>
        </ol>
      </div>
    `;
    content.insertAdjacentHTML('afterbegin', instructions);
  }
}

// ==================== PROSPECT CONTEXT ====================

// Call this whenever user selects a prospect
function setProspectContext(prospect) {
  window.currentProspect = {
    name: prospect.name,
    company: prospect.company || prospect.companyName,
    industry: prospect.industry || prospect.vertical,
    painPoint: prospect.painPoint || prospect.challenges || prospect.notes,
    repName: 'John Smith', // Replace with actual logged-in user
    repTitle: 'Account Executive' // Replace with actual user title
  };
}

// ==================== ASSET SELECTION ====================

let selectedAssetType = null;

// Select asset type and show form
window.selectAssetType = function(assetType) {
  selectedAssetType = assetType;
  
  // Update UI - remove all selected states
  document.querySelectorAll('.asset-type-btn').forEach(btn => {
    btn.classList.remove('selected');
  });
  
  // Add selected state to clicked button
  const selectedBtn = document.querySelector(`[data-type="${assetType}"]`);
  if (selectedBtn) {
    selectedBtn.classList.add('selected');
  }
  
  // Update form header
  const assetConfig = CanvaIntegration.assetTypes[assetType];
  if (assetConfig) {
    document.getElementById('selectedAssetName').textContent = assetConfig.name;
  }
  
  // Show generation form
  document.getElementById('generationForm').style.display = 'block';
  
  // Auto-fill form if data available
  autoFillProspectData();
  
  // Scroll to form on mobile
  setTimeout(() => {
    const form = document.getElementById('generationForm');
    if (form && window.innerWidth < 768) {
      form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, 100);
};

// Auto-fill form with prospect data
function autoFillProspectData() {
  // Try enriched data first
  if (typeof CanvaWithEnrichedData !== 'undefined') {
    try {
      const enrichedData = CanvaWithEnrichedData.collectAllProspectData();
      document.getElementById('canva-company').value = enrichedData.company || '';
      document.getElementById('canva-industry').value = enrichedData.industry || '';
      document.getElementById('canva-painpoint').value = enrichedData.painPoint || '';
      return;
    } catch (e) {
      console.log('Could not load enriched data:', e);
    }
  }
  
  // Fallback to current prospect or window._hqProspect
  const prospect = window.currentProspect || window._hqProspect || {};
  document.getElementById('canva-company').value = prospect.company || '';
  document.getElementById('canva-industry').value = prospect.industry || '';
  document.getElementById('canva-painpoint').value = prospect.painPoint || prospect.challenges || '';
}

// Reset form
function resetGenerationForm() {
  selectedAssetType = null;
  document.querySelectorAll('.asset-type-btn').forEach(btn => {
    btn.classList.remove('selected');
  });
  document.getElementById('generationForm').style.display = 'none';
  document.getElementById('canvaLoading').style.display = 'none';
  document.getElementById('canvaError').style.display = 'none';
}

// ==================== CANVA PANEL CONTROLS ====================
// Define these IMMEDIATELY so they're available when page loads

// Open Canva panel (generic)
window.openCanvaPanel = function() {
  console.log('🎨 openCanvaPanel called');
  
  // Check if panel exists, if not, try to initialize
  let panel = document.getElementById('canvaPanel');
  
  if (!panel) {
    console.log('Panel not ready, initializing...');
    // Try to initialize if function is available
    if (typeof initializeCanvaPanel === 'function') {
      initializeCanvaPanel();
    }
    panel = document.getElementById('canvaPanel');
  }
  
  const overlay = document.getElementById('canvaOverlay');
  
  if (panel && overlay) {
    panel.style.display = 'block';
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
  } else {
    console.error('Canva panel elements not found');
  }
};

// Open Canva panel with prospect context
window.openCanvaForProspect = function(prospect) {
  if (prospect) {
    setProspectContext(prospect);
  }
  window.openCanvaPanel();
};

// Toggle panel visibility
window.toggleCanvaPanel = function() {
  const panel = document.getElementById('canvaPanel');
  const overlay = document.getElementById('canvaOverlay');
  
  if (!panel || !overlay) {
    // Try to open instead
    window.openCanvaPanel();
    return;
  }
  
  if (panel.style.display === 'none' || !panel.style.display) {
    panel.style.display = 'block';
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
  } else {
    panel.style.display = 'none';
    overlay.style.display = 'none';
    document.body.style.overflow = 'auto';
    
    // Reset form when closing
    if (typeof resetGenerationForm === 'function') {
      resetGenerationForm();
    }
  }
};

// ==================== MODIFIED GENERATE FUNCTION ====================

// Override the standard generate function with Outlook-optimized version
window.generateCanvaAsset = async function() {
  if (!selectedAssetType) {
    alert('Please select an asset type first');
    return;
  }

  // Show loading state
  document.getElementById('generationForm').style.display = 'none';
  document.getElementById('canvaLoading').style.display = 'block';

  try {
    // Use enriched data if available
    let prospectData;
    if (typeof CanvaWithEnrichedData !== 'undefined') {
      prospectData = CanvaWithEnrichedData.collectAllProspectData();
    } else {
      // Fallback to basic form data
      prospectData = {
        name: window.currentProspect?.name || '',
        company: document.getElementById('canva-company').value,
        industry: document.getElementById('canva-industry').value,
        painPoint: document.getElementById('canva-painpoint').value,
        repName: document.getElementById('canva-repname')?.value || 'Sales Rep',
        useBrand: document.getElementById('canva-usebrand')?.checked
      };
    }

    // Use Outlook-optimized generation if available
    let result;
    if (typeof OutlookCanvaIntegration !== 'undefined') {
      result = await OutlookCanvaIntegration.generateWithOutlookUI(
        selectedAssetType,
        prospectData,
        {
          companyBrand: prospectData.useBrand ? 'beyondpayroll' : null,
          includeLinkInEmail: true,
          autoDownload: false
        }
      );
    } else {
      // Fallback to standard generation
      result = await CanvaIntegration.generateAsset(selectedAssetType, prospectData);
    }

    // Hide loading, close main panel
    document.getElementById('canvaLoading').style.display = 'none';
    toggleCanvaPanel();

    // Show success notification
    if (result.success) {
      showNotification('✅ Canva asset generated successfully!');
    }
    
  } catch (error) {
    console.error('Generation failed:', error);
    document.getElementById('canvaLoading').style.display = 'none';
    document.getElementById('canvaError').style.display = 'block';
    const errorEl = document.getElementById('errorMessage');
    if (errorEl) {
      errorEl.textContent = error.message || 'Generation failed. Please try again.';
    }
  }
};

// ==================== WORKFLOW AUTOMATION ====================

// Auto-generate after email sent
async function onEmailSent(prospect, emailNumber) {
  // After first email, auto-generate one-pager
  if (emailNumber === 1) {
    try {
      const result = await OutlookCanvaIntegration.generateForOutlook(
        'oneSheet',
        prospect,
        { companyBrand: 'beyondpayroll' }
      );
      
      if (result.success) {
        showNotification('✅ One-pager ready for your follow-up email!');
        // Optionally store URL with prospect
        if (window.saveProspectAsset) {
          saveProspectAsset(prospect.id, result);
        }
      }
    } catch (error) {
      console.error('Auto-generation failed:', error);
    }
  }
}

// Helper: Show notification
function showNotification(message) {
  OutlookCanvaIntegration.showNotification(message, 'success', 4000);
}

// ==================== COMPANY BRAND SELECTOR (OPTIONAL) ====================

// If you need to switch between company brands, add this to your Canva panel

function addCompanySelector() {
  const form = document.getElementById('generationForm');
  if (form && !document.getElementById('companyBrandSelector')) {
    const selectorHTML = `
      <div class="company-selector" id="companyBrandSelector">
        <label>Which company brand?</label>
        <select id="canva-company-brand">
          <option value="beyondpayroll">Beyond Payroll</option>
          <option value="othercompany">Other Company</option>
        </select>
      </div>
    `;
    
    // Insert before the brand kit checkbox
    const brandCheckbox = form.querySelector('.form-group:has(#canva-usebrand)');
    if (brandCheckbox) {
      brandCheckbox.insertAdjacentHTML('beforebegin', selectorHTML);
    }
  }
}

// Call this after panel initialization if needed
// addCompanySelector();

// ==================== UTILITY FUNCTIONS ====================

// Copy Canva URL to clipboard (Outlook-formatted)
async function copyCanvaUrlForOutlook(url) {
  return await OutlookCanvaIntegration.copyForOutlook(url);
}

// Open Canva design and copy link
async function openCanvaAndCopy(url) {
  return await OutlookCanvaIntegration.openAndCopyForOutlook(url);
}

// Export design as PDF
async function exportCanvaToPDF(url) {
  return await OutlookCanvaIntegration.exportForOutlookAttachment(url);
}

// ==================== EXAMPLE USAGE ====================

/**
 * Example 1: User clicks "Generate Collateral" from toolbar
 */
function toolbarGenerateClick() {
  openCanvaPanel();
}

/**
 * Example 2: User clicks "Generate" from prospect detail view
 */
function prospectDetailGenerateClick(prospect) {
  setProspectContext(prospect);
  openCanvaPanel();
}

/**
 * Example 3: Auto-generate after email sent
 */
async function afterEmailSent(prospect) {
  await onEmailSent(prospect, prospect.emailsSent || 1);
}

/**
 * Example 4: Batch generate for multiple prospects
 */
async function batchGenerateOneSheets(prospects) {
  const results = [];
  
  for (const prospect of prospects) {
    try {
      const result = await OutlookCanvaIntegration.generateForOutlook(
        'oneSheet',
        prospect,
        { companyBrand: 'beyondpayroll' }
      );
      
      results.push({ 
        prospect: prospect.company, 
        success: true, 
        url: OutlookCanvaIntegration.extractDesignUrls(result)[0] 
      });
      
      // Wait 2 seconds between generations to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      results.push({ 
        prospect: prospect.company, 
        success: false, 
        error: error.message 
      });
    }
  }
  
  console.log('Batch generation complete:', results);
  return results;
}

// ==================== EXPORT ====================

// Additional functions to make available globally
// (openCanvaPanel and toggleCanvaPanel are already defined as window. properties above)
window.setProspectContext = setProspectContext;
window.onEmailSent = onEmailSent;

// Log that integration is ready
console.log('✅ Canva Outlook integration ready - all functions exported to window');
