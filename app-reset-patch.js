/* ════════════════════════════════════════════════════════════════════
   RESET BUTTON COMPREHENSIVE FIX
   Add this code to the END of your app.js file
   
   This fixes the issue where "Reset All" buttons in pipeline prospect
   cards call tsReset() instead of cdtResetAll() or prospect-specific reset
════════════════════════════════════════════════════════════════════ */

// ══════════════════════════════════════════════════════════════════════
// PATCH: Ensure tsReset is properly scoped (already exists, just expose it)
// ══════════════════════════════════════════════════════════════════════
// tsReset already exists at line 10048, no changes needed there

// ══════════════════════════════════════════════════════════════════════
// NEW: Add prospect-specific cadence reset function
// ══════════════════════════════════════════════════════════════════════
window.resetProspectCadence = function(prospectId) {
  // If no ID passed, use current prospect
  if (!prospectId && window._hqProspect) {
    prospectId = window._hqProspect.id || window._hqProspect.company;
  }
  
  if (!prospectId) {
    console.warn('No prospect ID provided for reset');
    return;
  }
  
  // Confirm before resetting
  if (!confirm('Reset all touch statuses for this prospect and restart the cadence from today?')) {
    return;
  }
  
  // Clear the prospect's cadence data
  const prospects = getProspects();
  const prospect = prospects.find(function(p) {
    return (p.id === prospectId) || (p.company === prospectId);
  });
  
  if (!prospect) {
    console.warn('Prospect not found:', prospectId);
    return;
  }
  
  // Clear statuses for this specific prospect
  const statusKey = 'ec_statuses_' + (prospect.company || prospectId);
  const notesKey = 'ec_notes_' + (prospect.company || prospectId);
  localStorage.removeItem(statusKey);
  localStorage.removeItem(notesKey);
  
  // If this is the currently loaded prospect, also clear in-memory state
  if (window._hqProspect && 
      (window._hqProspect.id === prospectId || window._hqProspect.company === prospectId)) {
    window._ecStatuses = {};
    window._ecNotes = {};
    window._ecLaunched = {};
    window._ecChecks = {};
    window._ecSentAt = {};
    
    // Reset start date to today
    if (typeof cdtResetStart === 'function') cdtResetStart();
    if (typeof cdtSetStart === 'function') {
      cdtSetStart(new Date().toISOString().split('T')[0]);
    }
    
    // Re-render everything
    if (typeof ecRenderAll === 'function') ecRenderAll();
    if (typeof cdtRender === 'function') cdtRender();
  }
  
  showToast('✓ Cadence reset for ' + (prospect.company || 'prospect'));
  
  // Refresh the pipeline view if it's open
  if (typeof ppRenderDrawer === 'function') ppRenderDrawer();
};

// ══════════════════════════════════════════════════════════════════════
// PATCH: Auto-fix ALL "Reset All" buttons in the DOM
// ══════════════════════════════════════════════════════════════════════
function patchAllResetButtons() {
  // Find all buttons
  document.querySelectorAll('button').forEach(function(btn) {
    const text = btn.textContent.trim();
    
    // Skip if already patched
    if (btn.dataset.resetPatched === 'true') return;
    
    // Check if it's a Reset All button
    if (text.includes('Reset All') || text === '↺ Reset All') {
      // Mark as patched
      btn.dataset.resetPatched = 'true';
      
      // Check context to determine which reset function to call
      const isCadenceTracker = btn.closest('#cdt-progress, .cdt-progress-bar, [data-view="composer"]');
      const isPipelineCard = btn.closest('.pd-card, .prospect-card, .pp-drawer-item, [data-prospect-id]');
      const isTotalSource = btn.closest('#ts-analyzer, .ts-card, [data-tool="totalsource"]');
      
      // Remove any existing onclick
      btn.onclick = null;
      
      // Add the correct handler
      if (isCadenceTracker) {
        // Cadence tracker - use cdtResetAll
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          if (typeof cdtResetAll === 'function') {
            cdtResetAll();
          } else {
            console.error('cdtResetAll function not found');
          }
        });
        console.log('✓ Patched Reset All button (cadence tracker)');
        
      } else if (isPipelineCard) {
        // Pipeline prospect card - use prospect-specific reset
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          
          // Try to find prospect ID from the card
          const card = btn.closest('.pd-card, .prospect-card, [data-prospect-id]');
          const prospectId = card ? (card.dataset.prospectId || card.dataset.company) : null;
          
          if (typeof resetProspectCadence === 'function') {
            resetProspectCadence(prospectId);
          } else {
            console.error('resetProspectCadence function not found');
          }
        });
        console.log('✓ Patched Reset All button (pipeline card)');
        
      } else if (isTotalSource) {
        // TotalSource analyzer - use tsReset
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          if (typeof tsReset === 'function') {
            tsReset();
          } else {
            console.error('tsReset function not found');
          }
        });
        console.log('✓ Patched Reset All button (TotalSource)');
        
      } else {
        // Unknown context - default to cdtResetAll if loaded prospect, else tsReset
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          
          if (window._hqProspect && typeof cdtResetAll === 'function') {
            cdtResetAll();
          } else if (typeof tsReset === 'function') {
            tsReset();
          } else {
            console.error('No reset function available');
          }
        });
        console.log('✓ Patched Reset All button (generic)');
      }
    }
  });
}

// ══════════════════════════════════════════════════════════════════════
// RUN: Patch on load and on DOM changes
// ══════════════════════════════════════════════════════════════════════

// Patch immediately
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', patchAllResetButtons);
} else {
  patchAllResetButtons();
}

// Patch again after a short delay (for dynamically loaded content)
setTimeout(patchAllResetButtons, 500);
setTimeout(patchAllResetButtons, 2000);

// Watch for new buttons being added to DOM
const resetButtonObserver = new MutationObserver(function(mutations) {
  let foundNewButtons = false;
  
  mutations.forEach(function(mutation) {
    mutation.addedNodes.forEach(function(node) {
      if (node.nodeType === 1) { // Element node
        if (node.tagName === 'BUTTON' || node.querySelector('button')) {
          foundNewButtons = true;
        }
      }
    });
  });
  
  if (foundNewButtons) {
    // Debounce the patching
    clearTimeout(window._resetPatchTimeout);
    window._resetPatchTimeout = setTimeout(patchAllResetButtons, 100);
  }
});

// Start observing
resetButtonObserver.observe(document.body, {
  childList: true,
  subtree: true
});

console.log('✓ Reset button patch loaded - all Reset All buttons will be automatically fixed');

// ══════════════════════════════════════════════════════════════════════
// MANUAL TRIGGER: Call this if you need to re-patch buttons manually
// ══════════════════════════════════════════════════════════════════════
window.repatchResetButtons = patchAllResetButtons;
