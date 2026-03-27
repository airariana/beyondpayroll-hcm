/**
 * Modified app.js integration code for Outlook workflow
 * Drop this code into your existing app.js file
 */

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', function() {
  // Initialize Canva panel
  initializeCanvaPanel();
  
  // Initialize Outlook integration
  initializeOutlookMode();
});

function initializeCanvaPanel() {
  const container = document.getElementById('canvaPanelContainer');
  if (container) {
    container.innerHTML = createCanvaPanel();
    
    // Enable Outlook mode styling
    document.getElementById('canvaPanel').classList.add('outlook-mode');
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

// ==================== CANVA PANEL CONTROLS ====================

// Open Canva panel (generic)
function openCanvaPanel() {
  document.getElementById('canvaPanel').style.display = 'block';
  document.getElementById('canvaOverlay').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

// Open Canva panel with prospect context
function openCanvaForProspect(prospect) {
  if (prospect) {
    setProspectContext(prospect);
  }
  openCanvaPanel();
}

// Toggle panel visibility
const originalToggle = window.toggleCanvaPanel;
window.toggleCanvaPanel = function() {
  const panel = document.getElementById('canvaPanel');
  const overlay = document.getElementById('canvaOverlay');
  
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
  } else {
    panel.style.display = 'none';
    overlay.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
};

// ==================== MODIFIED GENERATE FUNCTION ====================

// Override the standard generate function with Outlook-optimized version
const originalGenerateCanvaAsset = window.generateCanvaAsset;
window.generateCanvaAsset = async function() {
  if (!selectedAssetType) {
    alert('Please select an asset type first');
    return;
  }

  // Collect form data
  const prospectData = {
    name: window.currentProspect?.name || '',
    company: document.getElementById('canva-company').value,
    industry: document.getElementById('canva-industry').value,
    painPoint: document.getElementById('canva-painpoint').value,
    repName: document.getElementById('canva-repname').value,
    useBrand: document.getElementById('canva-usebrand').checked
  };

  // Show loading state
  document.getElementById('generationForm').style.display = 'none';
  document.getElementById('canvaLoading').style.display = 'block';

  try {
    // Use Outlook-optimized generation
    const result = await OutlookCanvaIntegration.generateWithOutlookUI(
      selectedAssetType,
      prospectData,
      {
        companyBrand: prospectData.useBrand ? 'beyondpayroll' : null,
        includeLinkInEmail: true,
        autoDownload: false
      }
    );

    // Hide loading, close main panel
    document.getElementById('canvaLoading').style.display = 'none';
    toggleCanvaPanel();

    // Outlook results panel opens automatically via generateWithOutlookUI
    
  } catch (error) {
    document.getElementById('canvaLoading').style.display = 'none';
    document.getElementById('canvaError').style.display = 'block';
    document.getElementById('errorMessage').textContent = error.message;
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

// Make functions available globally
window.openCanvaPanel = openCanvaPanel;
window.openCanvaForProspect = openCanvaForProspect;
window.setProspectContext = setProspectContext;
window.onEmailSent = onEmailSent;
window.copyCanvaUrlForOutlook = copyCanvaUrlForOutlook;
window.openCanvaAndCopy = openCanvaAndCopy;
window.exportCanvaToPDF = exportCanvaToPDF;
window.batchGenerateOneSheets = batchGenerateOneSheets;
