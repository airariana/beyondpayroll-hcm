/* ════════════════════════════════════════════════════════════════════
   NURTURE CAMPAIGN UI COMPONENTS
   
   Adds visual interface for nurture campaigns:
   1. Nurture view in Pipeline
   2. "Move to Nurture" buttons on prospect cards
   3. Nurture schedule display
   4. Nurture status indicators
════════════════════════════════════════════════════════════════════ */

// ══════════════════════════════════════════════════════════════════════
// ADD NURTURE TAB TO PIPELINE VIEW
// ══════════════════════════════════════════════════════════════════════

/**
 * Render nurture prospects view
 */
window.renderNurtureView = function() {
  const container = document.getElementById('portal-view');
  if (!container) return;
  
  const prospects = getNurtureProspects();
  
  let html = `
    <div style="padding:20px;max-width:1200px;margin:0 auto">
      <div style="margin-bottom:24px">
        <h2 style="font-family:var(--fd);font-size:24px;font-weight:700;color:var(--text);margin-bottom:8px">
          🌱 Nurture Campaigns
        </h2>
        <div style="font-size:14px;color:var(--text-3)">
          ${prospects.length} prospect${prospects.length !== 1 ? 's' : ''} in nurture · Automated re-engagement
        </div>
      </div>
      
      <!-- Filter by campaign type -->
      <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap">
        <button class="btn ${!window._nurtureFilter ? 'primary' : 'outline'}" onclick="filterNurture(null)">
          All (${prospects.length})
        </button>
        <button class="btn ${window._nurtureFilter === '30day' ? 'primary' : 'outline'}" onclick="filterNurture('30day')">
          30-Day (${prospects.filter(p => p.nurtureCampaign === '30day').length})
        </button>
        <button class="btn ${window._nurtureFilter === '60day' ? 'primary' : 'outline'}" onclick="filterNurture('60day')">
          60-Day (${prospects.filter(p => p.nurtureCampaign === '60day').length})
        </button>
        <button class="btn ${window._nurtureFilter === '90day' ? 'primary' : 'outline'}" onclick="filterNurture('90day')">
          90-Day (${prospects.filter(p => p.nurtureCampaign === '90day').length})
        </button>
      </div>
  `;
  
  if (prospects.length === 0) {
    html += `
      <div style="text-align:center;padding:60px 20px;background:var(--off-white);border-radius:12px;border:2px dashed var(--border)">
        <div style="font-size:48px;margin-bottom:16px">🌱</div>
        <div style="font-size:18px;font-weight:600;color:var(--text);margin-bottom:8px">No prospects in nurture</div>
        <div style="font-size:14px;color:var(--text-3);margin-bottom:24px">Move prospects here when they say "not right now" or "maybe later"</div>
        <button class="btn" onclick="hqTab('pipeline')">← Back to Pipeline</button>
      </div>
    `;
  } else {
    // Filter prospects
    let filtered = prospects;
    if (window._nurtureFilter) {
      filtered = prospects.filter(p => p.nurtureCampaign === window._nurtureFilter);
    }
    
    // Group by campaign
    const groups = {
      '30day': filtered.filter(p => p.nurtureCampaign === '30day'),
      '60day': filtered.filter(p => p.nurtureCampaign === '60day'),
      '90day': filtered.filter(p => p.nurtureCampaign === '90day')
    };
    
    Object.entries(groups).forEach(([campaign, list]) => {
      if (list.length === 0) return;
      
      const campaignData = NURTURE_CAMPAIGNS[campaign];
      
      html += `
        <div style="margin-bottom:32px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
            <div style="font-size:16px;font-weight:700;color:var(--text)">${campaignData.name}</div>
            <div style="font-size:12px;color:var(--text-3);background:var(--off-white);padding:4px 10px;border-radius:6px">
              ${list.length} prospect${list.length !== 1 ? 's' : ''}
            </div>
          </div>
          
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(350px,1fr));gap:16px">
      `;
      
      list.forEach(prospect => {
        html += renderNurtureCard(prospect, campaignData);
      });
      
      html += '</div></div>';
    });
  }
  
  html += '</div>';
  
  container.innerHTML = html;
};

/**
 * Render individual nurture prospect card
 */
function renderNurtureCard(prospect, campaign) {
  const startDate = new Date(prospect.nurtureStartDate);
  const today = new Date();
  const daysIn = Math.floor((today - startDate) / 86400000);
  const daysRemaining = campaign.duration - daysIn;
  const progressPct = Math.min(100, Math.round((daysIn / campaign.duration) * 100));
  
  // Find next touchpoint
  const nextTouch = campaign.touchpoints.find(t => t.day > daysIn);
  const nextTouchDate = nextTouch ? new Date(startDate.getTime() + (nextTouch.day * 86400000)) : null;
  
  const isTS = (prospect.track || '').toLowerCase().includes('ts');
  const trackColor = isTS ? 'var(--red)' : 'var(--blue)';
  const trackLabel = isTS ? 'TotalSource' : 'WFN';
  
  return `
    <div style="background:var(--white);border:2px solid var(--border);border-radius:12px;padding:16px;position:relative;overflow:hidden">
      <!-- Progress bar at top -->
      <div style="position:absolute;top:0;left:0;right:0;height:4px;background:var(--border)">
        <div style="height:100%;background:var(--green);width:${progressPct}%;transition:width .3s"></div>
      </div>
      
      <!-- Header -->
      <div style="display:flex;align-items:start;justify-content:space-between;gap:12px;margin-bottom:12px">
        <div style="flex:1;min-width:0">
          <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:4px">
            ${prospect.company || 'Unknown'}
          </div>
          <div style="font-size:12px;color:var(--text-3)">
            ${prospect.contact || 'No contact'} · ${prospect.industry || '?'} · ${prospect.headcount || '?'} EEs
          </div>
        </div>
        <div style="font-size:10px;font-weight:700;padding:4px 8px;border-radius:4px;background:${trackColor}15;color:${trackColor};border:1px solid ${trackColor}30;white-space:nowrap">
          ${trackLabel}
        </div>
      </div>
      
      <!-- Nurture info -->
      <div style="background:var(--off-white);padding:12px;border-radius:8px;margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:between;gap:8px;margin-bottom:8px">
          <div style="flex:1">
            <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">Progress</div>
            <div style="font-size:14px;font-weight:600;color:var(--text)">
              Day ${daysIn} of ${campaign.duration}
            </div>
          </div>
          <div style="flex:1">
            <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">Remaining</div>
            <div style="font-size:14px;font-weight:600;color:var(--text)">
              ${daysRemaining} days
            </div>
          </div>
        </div>
        
        ${nextTouch ? `
          <div style="padding-top:8px;border-top:1px solid var(--border)">
            <div style="font-size:11px;color:var(--text-3);margin-bottom:4px">Next Touch</div>
            <div style="font-size:12px;font-weight:600;color:var(--text)">
              Day ${nextTouch.day} — ${nextTouch.subject.replace(/\{[^}]+\}/g, prospect.company || '?')}
            </div>
            <div style="font-size:11px;color:var(--text-3);margin-top:2px">
              📅 ${nextTouchDate ? nextTouchDate.toLocaleDateString('en-US', {month: 'short', day: 'numeric'}) : '?'}
            </div>
          </div>
        ` : `
          <div style="padding-top:8px;border-top:1px solid var(--border)">
            <div style="font-size:12px;font-weight:600;color:var(--green)">✓ Campaign Complete</div>
          </div>
        `}
      </div>
      
      <!-- Reason -->
      ${prospect.nurtureNote ? `
        <div style="font-size:11px;color:var(--text-3);margin-bottom:12px;font-style:italic">
          "${prospect.nurtureNote}"
        </div>
      ` : ''}
      
      <!-- Actions -->
      <div style="display:flex;gap:8px">
        <button class="btn outline" onclick="viewNurtureSchedule('${prospect.id}')" style="flex:1;font-size:11px;padding:6px 12px">
          📅 Schedule
        </button>
        <button class="btn outline" onclick="exitNurture('${prospect.id}')" style="flex:1;font-size:11px;padding:6px 12px">
          ↩️ Back to Active
        </button>
      </div>
    </div>
  `;
}

/**
 * Filter nurture view
 */
window.filterNurture = function(campaign) {
  window._nurtureFilter = campaign;
  renderNurtureView();
};

/**
 * View nurture schedule modal
 */
window.viewNurtureSchedule = function(prospectId) {
  const prospects = getProspects();
  const prospect = prospects.find(p => p.id === prospectId || p.company === prospectId);
  
  if (!prospect || !prospect.nurtureCampaign) return;
  
  const campaign = NURTURE_CAMPAIGNS[prospect.nurtureCampaign];
  const startDate = new Date(prospect.nurtureStartDate);
  const today = new Date();
  const daysIn = Math.floor((today - startDate) / 86400000);
  
  let html = `
    <div class="ehc-modal-overlay">
      <div class="ehc-modal ehc-modal-large">
        <div class="ehc-modal-header">
          <div class="ehc-modal-title">📅 Nurture Schedule — ${prospect.company}</div>
          <button class="ehc-modal-close" onclick="this.closest('.ehc-modal-overlay').remove()">✕</button>
        </div>
        <div class="ehc-modal-body">
          <div style="margin-bottom:20px">
            <div style="font-size:14px;font-weight:600;margin-bottom:4px">${campaign.name}</div>
            <div style="font-size:12px;color:var(--text-3)">${campaign.description}</div>
          </div>
          
          <div style="position:relative;padding-left:24px">
            <!-- Timeline line -->
            <div style="position:absolute;left:11px;top:0;bottom:0;width:2px;background:var(--border)"></div>
  `;
  
  campaign.touchpoints.forEach((touch, idx) => {
    const touchDate = new Date(startDate.getTime() + (touch.day * 86400000));
    const isPast = touch.day < daysIn;
    const isToday = touch.day === daysIn;
    const isFuture = touch.day > daysIn;
    
    const dotColor = isPast ? 'var(--green)' : isToday ? 'var(--gold)' : 'var(--border)';
    const dotIcon = isPast ? '✓' : isToday ? '🔔' : '';
    
    html += `
      <div style="position:relative;margin-bottom:24px">
        <!-- Timeline dot -->
        <div style="position:absolute;left:-24px;top:4px;width:24px;height:24px;border-radius:50%;background:${dotColor};border:3px solid var(--white);display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff">
          ${dotIcon}
        </div>
        
        <!-- Touch card -->
        <div style="background:var(--off-white);padding:14px;border-radius:8px;border:1px solid var(--border);${isPast ? 'opacity:.6' : ''}">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="font-size:10px;font-weight:800;color:var(--text-3);background:var(--white);padding:2px 8px;border-radius:4px;border:1px solid var(--border)">
              DAY ${touch.day}
            </span>
            <span style="font-size:9px;font-weight:700;color:${isPast ? 'var(--green)' : isToday ? 'var(--gold)' : 'var(--text-3)'};text-transform:uppercase;letter-spacing:.5px">
              ${isPast ? 'SENT' : isToday ? 'DUE TODAY' : 'UPCOMING'}
            </span>
          </div>
          
          <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px">
            ${touch.subject.replace(/\{company\}/g, prospect.company).replace(/\{industry\}/g, prospect.industry || 'your industry')}
          </div>
          
          <div style="font-size:11px;color:var(--text-3);margin-bottom:6px">
            📅 ${touchDate.toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric'})}
          </div>
          
          <div style="font-size:11px;color:var(--text-2);background:var(--white);padding:8px;border-radius:4px;border:1px solid var(--border)">
            <strong>Type:</strong> ${touch.type} · <strong>Goal:</strong> ${touch.goal}
          </div>
        </div>
      </div>
    `;
  });
  
  html += `
          </div>
          
          <div style="margin-top:24px;display:flex;gap:12px">
            <button class="btn" onclick="this.closest('.ehc-modal-overlay').remove()">Close</button>
            <button class="btn secondary" onclick="exitNurture('${prospect.id}');this.closest('.ehc-modal-overlay').remove()">Exit Nurture</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', html);
};

/**
 * Exit nurture campaign
 */
window.exitNurture = function(prospectId) {
  if (!confirm('Remove prospect from nurture campaign and return to active pipeline?')) return;
  
  const prospects = getProspects();
  const prospect = prospects.find(p => p.id === prospectId || p.company === prospectId);
  
  if (!prospect) return;
  
  // Clear nurture status
  delete prospect.status;
  delete prospect.nurtureCampaign;
  delete prospect.nurtureStartDate;
  delete prospect.nurtureTrigger;
  delete prospect.nurtureNote;
  delete prospect.nurturePriority;
  
  // Save
  if (typeof saveProspect === 'function') saveProspect();
  
  showToast('✓ Moved back to active pipeline - ' + prospect.company);
  
  // Refresh view
  renderNurtureView();
};

// ══════════════════════════════════════════════════════════════════════
// ADD "MOVE TO NURTURE" BUTTON TO PROSPECT CARDS
// ══════════════════════════════════════════════════════════════════════

/**
 * Show move to nurture modal
 */
window.showMoveToNurtureModal = function(prospectId) {
  const prospects = getProspects();
  const prospect = prospects.find(p => p.id === prospectId || p.company === prospectId);
  
  if (!prospect) return;
  
  const html = `
    <div class="ehc-modal-overlay">
      <div class="ehc-modal">
        <div class="ehc-modal-header">
          <div class="ehc-modal-title">🌱 Move to Nurture Campaign</div>
          <button class="ehc-modal-close" onclick="this.closest('.ehc-modal-overlay').remove()">✕</button>
        </div>
        <div class="ehc-modal-body">
          <div style="margin-bottom:16px">
            <strong>${prospect.company}</strong>
          </div>
          
          <div style="margin-bottom:16px">
            <label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px">Why are they going to nurture?</label>
            <select id="nurture-trigger-select" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px" onchange="updateNurtureCampaignInfo()">
              <option value="">-- Select reason --</option>
              <option value="not_right_now">Not right now / Timing isn't right (30-day)</option>
              <option value="maybe">Maybe / Possibly (30-day)</option>
              <option value="call_me_later">Call me in 6+ months (90-day)</option>
              <option value="evaluating">Evaluating options / comparing vendors (60-day)</option>
              <option value="budget">No budget / Budget next quarter (60-day)</option>
              <option value="renewal_far_out">Renewal/contract far out (90-day)</option>
              <option value="no_response">No response after 3+ attempts (60-day)</option>
            </select>
          </div>
          
          <div id="campaign-info" style="display:none;margin-bottom:16px;padding:12px;background:var(--off-white);border-radius:8px;border:1px solid var(--border)">
            <div style="font-size:12px;font-weight:600;margin-bottom:4px" id="campaign-name"></div>
            <div style="font-size:11px;color:var(--text-3);margin-bottom:6px" id="campaign-desc"></div>
            <div style="font-size:11px;color:var(--text-2)" id="campaign-touches"></div>
          </div>
          
          <div style="margin-bottom:16px">
            <label style="display:block;font-size:12px;font-weight:600;margin-bottom:6px">Notes (optional)</label>
            <textarea id="nurture-note" placeholder="e.g., 'Follow up in Q3 when budget opens up'" style="width:100%;height:60px;padding:8px;border:1px solid var(--border);border-radius:6px;font-size:13px;resize:vertical"></textarea>
          </div>
          
          <div style="display:flex;gap:12px">
            <button class="btn" onclick="confirmMoveToNurture('${prospectId}')">Start Nurture Campaign</button>
            <button class="btn secondary" onclick="this.closest('.ehc-modal-overlay').remove()">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', html);
};

/**
 * Update campaign info based on selected trigger
 */
window.updateNurtureCampaignInfo = function() {
  const trigger = document.getElementById('nurture-trigger-select').value;
  const infoDiv = document.getElementById('campaign-info');
  
  if (!trigger) {
    infoDiv.style.display = 'none';
    return;
  }
  
  const triggerData = NURTURE_TRIGGERS[trigger];
  const campaign = NURTURE_CAMPAIGNS[triggerData.campaign];
  
  if (!campaign) return;
  
  document.getElementById('campaign-name').textContent = campaign.name;
  document.getElementById('campaign-desc').textContent = campaign.description;
  document.getElementById('campaign-touches').textContent = 
    `${campaign.touchpoints.length} touchpoints over ${campaign.duration} days`;
  
  infoDiv.style.display = 'block';
};

/**
 * Confirm and execute move to nurture
 */
window.confirmMoveToNurture = function(prospectId) {
  const trigger = document.getElementById('nurture-trigger-select').value;
  const note = document.getElementById('nurture-note').value.trim();
  
  if (!trigger) {
    alert('Please select a reason');
    return;
  }
  
  // Close modal
  document.querySelector('.ehc-modal-overlay').remove();
  
  // Move to nurture
  moveToNurture(prospectId, trigger, note || null);
};

console.log('✓ Nurture campaign UI components loaded');
