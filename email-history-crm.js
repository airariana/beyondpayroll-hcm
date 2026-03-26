// ══════════════════════════════════════════════════════════════════
// EMAIL HISTORY & CRM TRACKING
// Email logging, activity timelines, and follow-up management
// ══════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ── STORAGE KEYS ──────────────────────────────────────────────────
  const EMAIL_HISTORY_KEY = 'bp_email_history';
  const FOLLOW_UPS_KEY = 'bp_follow_ups';

  function getEmailHistory() {
    try {
      return JSON.parse(localStorage.getItem(EMAIL_HISTORY_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveEmailHistory(history) {
    localStorage.setItem(EMAIL_HISTORY_KEY, JSON.stringify(history));
  }

  function getFollowUps() {
    try {
      return JSON.parse(localStorage.getItem(FOLLOW_UPS_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveFollowUps(followUps) {
    localStorage.setItem(FOLLOW_UPS_KEY, JSON.stringify(followUps));
  }

  // ── EMAIL STATUS ENUM ─────────────────────────────────────────────
  const EMAIL_STATUS = {
    DRAFT: 'draft',
    GENERATED: 'generated',
    SENT: 'sent',
    REPLIED: 'replied',
    BOUNCED: 'bounced',
    CLOSED: 'closed'
  };

  // ── LOG EMAIL ─────────────────────────────────────────────────────
  window.logEmail = function(emailData) {
    const history = getEmailHistory();
    
    const logEntry = {
      id: 'email_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      
      // Prospect info
      prospectId: emailData.prospectId || null,
      companyName: emailData.companyName || '',
      contactName: emailData.contactName || '',
      contactEmail: emailData.contactEmail || '',
      
      // Email content
      subject: emailData.subject || '',
      body: emailData.body || '',
      
      // Metadata
      touchType: emailData.touchType || null,
      track: emailData.track || 'WFN',
      status: emailData.status || EMAIL_STATUS.GENERATED,
      
      // Intel context (what was available when email was created)
      intelSnapshot: emailData.intelSnapshot || null,
      
      // Tracking
      sentAt: null,
      repliedAt: null,
      closedAt: null,
      
      // Notes
      notes: ''
    };
    
    history.unshift(logEntry); // Add to beginning
    
    // Keep only last 1000 emails
    if (history.length > 1000) history.length = 1000;
    
    saveEmailHistory(history);
    
    // Notify if function exists
    if (typeof notifAdd === 'function') {
      notifAdd('email', '📧 Email Logged', emailData.companyName + ' · ' + emailData.touchType, 'HISTORY');
    }
    
    return logEntry.id;
  };

  // ── UPDATE EMAIL STATUS ───────────────────────────────────────────
  window.updateEmailStatus = function(emailId, newStatus, notes) {
    const history = getEmailHistory();
    const email = history.find(e => e.id === emailId);
    
    if (!email) {
      console.warn('[updateEmailStatus] Email not found:', emailId);
      return false;
    }
    
    email.status = newStatus;
    
    // Update timestamps
    if (newStatus === EMAIL_STATUS.SENT && !email.sentAt) {
      email.sentAt = new Date().toISOString();
    } else if (newStatus === EMAIL_STATUS.REPLIED && !email.repliedAt) {
      email.repliedAt = new Date().toISOString();
    } else if (newStatus === EMAIL_STATUS.CLOSED && !email.closedAt) {
      email.closedAt = new Date().toISOString();
    }
    
    // Add notes if provided
    if (notes) {
      email.notes = (email.notes ? email.notes + '\n\n' : '') + 
        '[' + new Date().toLocaleString() + '] ' + notes;
    }
    
    saveEmailHistory(history);
    
    return true;
  };

  // ── GET EMAILS FOR PROSPECT ───────────────────────────────────────
  window.getProspectEmails = function(prospectId) {
    if (!prospectId) return [];
    const history = getEmailHistory();
    return history.filter(e => e.prospectId === prospectId);
  };

  // ── EMAIL HISTORY VIEWER ──────────────────────────────────────────
  window.openEmailHistory = function() {
    const existing = document.getElementById('email-history-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'email-history-modal';
    modal.className = 'ehc-modal-overlay';
    modal.onclick = function(e) {
      if (e.target === modal) modal.remove();
    };

    modal.innerHTML = `
      <div class="ehc-modal ehc-modal-xlarge">
        <div class="ehc-modal-header">
          <div class="ehc-modal-title">📧 Email History & Activity Log</div>
          <button onclick="document.getElementById('email-history-modal').remove()" class="ehc-modal-close">✕</button>
        </div>
        <div class="ehc-modal-body">
          <div class="ehc-controls">
            <input type="text" id="ehc-search" placeholder="Search by company, contact, or subject..." class="ehc-search-input" oninput="ehcFilterHistory()">
            <div class="ehc-filters">
              <select id="ehc-filter-status" class="ehc-filter-select" onchange="ehcFilterHistory()">
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="generated">Generated</option>
                <option value="sent">Sent</option>
                <option value="replied">Replied</option>
                <option value="bounced">Bounced</option>
                <option value="closed">Closed</option>
              </select>
              <select id="ehc-filter-track" class="ehc-filter-select" onchange="ehcFilterHistory()">
                <option value="">All Tracks</option>
                <option value="WFN">WFN</option>
                <option value="TS">TotalSource</option>
              </select>
              <select id="ehc-filter-timeframe" class="ehc-filter-select" onchange="ehcFilterHistory()">
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
              </select>
            </div>
          </div>
          <div id="ehc-stats" class="ehc-stats"></div>
          <div id="ehc-history-list" class="ehc-history-list"></div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    ehcRenderHistory();
  };

  window.ehcRenderHistory = function() {
    const history = getEmailHistory();
    
    // Apply filters
    const searchText = (document.getElementById('ehc-search') || {}).value || '';
    const statusFilter = (document.getElementById('ehc-filter-status') || {}).value || '';
    const trackFilter = (document.getElementById('ehc-filter-track') || {}).value || '';
    const timeframeFilter = (document.getElementById('ehc-filter-timeframe') || {}).value || 'all';
    
    let filtered = history;
    
    // Search filter
    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(e => 
        (e.companyName || '').toLowerCase().includes(search) ||
        (e.contactName || '').toLowerCase().includes(search) ||
        (e.subject || '').toLowerCase().includes(search) ||
        (e.body || '').toLowerCase().includes(search)
      );
    }
    
    // Status filter
    if (statusFilter) {
      filtered = filtered.filter(e => e.status === statusFilter);
    }
    
    // Track filter
    if (trackFilter) {
      filtered = filtered.filter(e => e.track === trackFilter);
    }
    
    // Timeframe filter
    if (timeframeFilter !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      
      if (timeframeFilter === 'today') {
        cutoff.setHours(0, 0, 0, 0);
      } else if (timeframeFilter === 'week') {
        cutoff.setDate(cutoff.getDate() - 7);
      } else if (timeframeFilter === 'month') {
        cutoff.setMonth(cutoff.getMonth() - 1);
      } else if (timeframeFilter === 'quarter') {
        cutoff.setMonth(cutoff.getMonth() - 3);
      }
      
      filtered = filtered.filter(e => new Date(e.timestamp) >= cutoff);
    }
    
    // Render stats
    ehcRenderStats(filtered, history.length);
    
    // Render history list
    const list = document.getElementById('ehc-history-list');
    if (!list) return;
    
    if (filtered.length === 0) {
      list.innerHTML = '<div class="ehc-empty-state">No emails found matching your filters.</div>';
      return;
    }
    
    // Group by date
    const grouped = {};
    filtered.forEach(e => {
      const date = new Date(e.timestamp).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(e);
    });
    
    let html = '';
    Object.keys(grouped).forEach(date => {
      html += `<div class="ehc-date-group">
        <div class="ehc-date-label">${date}</div>
        <div class="ehc-date-emails">`;
      
      grouped[date].forEach(e => {
        html += ehcRenderEmailCard(e);
      });
      
      html += `</div></div>`;
    });
    
    list.innerHTML = html;
  };

  function ehcRenderEmailCard(email) {
    const statusClass = 'ehc-status-' + email.status;
    const statusLabel = {
      'draft': '📝 Draft',
      'generated': '⚡ Generated',
      'sent': '📤 Sent',
      'replied': '✅ Replied',
      'bounced': '❌ Bounced',
      'closed': '🔒 Closed'
    }[email.status] || email.status;
    
    const time = new Date(email.timestamp).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    });
    
    const trackClass = email.track === 'TS' ? 'ehc-track-ts' : 'ehc-track-wfn';
    
    return `
      <div class="ehc-email-card">
        <div class="ehc-email-card-header">
          <div class="ehc-email-card-meta">
            <div class="ehc-email-card-company">${escHtml(email.companyName)}</div>
            <div class="ehc-email-card-contact">${escHtml(email.contactName)}</div>
            <div class="ehc-email-card-time">${time}</div>
          </div>
          <div class="ehc-email-card-badges">
            ${email.touchType ? `<span class="ehc-badge ehc-badge-touch">${escHtml(email.touchType)}</span>` : ''}
            <span class="ehc-badge ${trackClass}">${email.track}</span>
            <span class="ehc-badge ${statusClass}">${statusLabel}</span>
          </div>
        </div>
        
        <div class="ehc-email-card-subject">
          <span class="ehc-subject-label">Subject:</span>
          ${escHtml(email.subject)}
        </div>
        
        <div class="ehc-email-card-preview">
          ${escHtml((email.body || '').substring(0, 200))}${(email.body || '').length > 200 ? '...' : ''}
        </div>
        
        <div class="ehc-email-card-actions">
          <button onclick="ehcViewEmail('${email.id}')" class="ehc-btn-view">👁️ View</button>
          ${email.status === 'generated' ? `<button onclick="ehcMarkAsSent('${email.id}')" class="ehc-btn-action">📤 Mark Sent</button>` : ''}
          ${email.status === 'sent' ? `<button onclick="ehcMarkAsReplied('${email.id}')" class="ehc-btn-action">✅ Mark Replied</button>` : ''}
          <button onclick="ehcCopyEmail('${email.id}')" class="ehc-btn-action">📋 Copy</button>
          ${email.prospectId ? `<button onclick="ehcViewProspectTimeline('${email.prospectId}')" class="ehc-btn-action">📊 Timeline</button>` : ''}
        </div>
      </div>
    `;
  }

  function ehcRenderStats(filtered, total) {
    const statsEl = document.getElementById('ehc-stats');
    if (!statsEl) return;
    
    const byStatus = {};
    filtered.forEach(e => {
      byStatus[e.status] = (byStatus[e.status] || 0) + 1;
    });
    
    const sentCount = byStatus['sent'] || 0;
    const repliedCount = byStatus['replied'] || 0;
    const replyRate = sentCount > 0 ? Math.round((repliedCount / sentCount) * 100) : 0;
    
    statsEl.innerHTML = `
      <div class="ehc-stat">
        <div class="ehc-stat-value">${filtered.length}</div>
        <div class="ehc-stat-label">Emails${filtered.length !== total ? ' (filtered)' : ''}</div>
      </div>
      <div class="ehc-stat">
        <div class="ehc-stat-value">${byStatus['sent'] || 0}</div>
        <div class="ehc-stat-label">Sent</div>
      </div>
      <div class="ehc-stat">
        <div class="ehc-stat-value">${byStatus['replied'] || 0}</div>
        <div class="ehc-stat-label">Replied</div>
      </div>
      <div class="ehc-stat">
        <div class="ehc-stat-value">${replyRate}%</div>
        <div class="ehc-stat-label">Reply Rate</div>
      </div>
    `;
  }

  window.ehcFilterHistory = function() {
    ehcRenderHistory();
  };

  window.ehcViewEmail = function(emailId) {
    const history = getEmailHistory();
    const email = history.find(e => e.id === emailId);
    if (!email) return;
    
    const existing = document.getElementById('email-detail-modal');
    if (existing) existing.remove();
    
    const statusClass = 'ehc-status-' + email.status;
    const statusLabel = {
      'draft': '📝 Draft',
      'generated': '⚡ Generated',
      'sent': '📤 Sent',
      'replied': '✅ Replied',
      'bounced': '❌ Bounced',
      'closed': '🔒 Closed'
    }[email.status] || email.status;
    
    const modal = document.createElement('div');
    modal.id = 'email-detail-modal';
    modal.className = 'ehc-modal-overlay';
    modal.onclick = function(e) {
      if (e.target === modal) modal.remove();
    };
    
    modal.innerHTML = `
      <div class="ehc-modal ehc-modal-large">
        <div class="ehc-modal-header">
          <div class="ehc-modal-title">📧 Email Detail</div>
          <button onclick="document.getElementById('email-detail-modal').remove()" class="ehc-modal-close">✕</button>
        </div>
        <div class="ehc-modal-body">
          <div class="ehc-email-detail">
            <div class="ehc-detail-meta">
              <div class="ehc-detail-row">
                <span class="ehc-detail-label">Company:</span>
                <span class="ehc-detail-value">${escHtml(email.companyName)}</span>
              </div>
              <div class="ehc-detail-row">
                <span class="ehc-detail-label">Contact:</span>
                <span class="ehc-detail-value">${escHtml(email.contactName)} ${email.contactEmail ? '&lt;' + escHtml(email.contactEmail) + '&gt;' : ''}</span>
              </div>
              <div class="ehc-detail-row">
                <span class="ehc-detail-label">Touch Type:</span>
                <span class="ehc-detail-value">${escHtml(email.touchType || '—')}</span>
              </div>
              <div class="ehc-detail-row">
                <span class="ehc-detail-label">Track:</span>
                <span class="ehc-detail-value">${email.track}</span>
              </div>
              <div class="ehc-detail-row">
                <span class="ehc-detail-label">Status:</span>
                <span class="ehc-badge ${statusClass}">${statusLabel}</span>
              </div>
              <div class="ehc-detail-row">
                <span class="ehc-detail-label">Generated:</span>
                <span class="ehc-detail-value">${new Date(email.timestamp).toLocaleString()}</span>
              </div>
              ${email.sentAt ? `<div class="ehc-detail-row">
                <span class="ehc-detail-label">Sent:</span>
                <span class="ehc-detail-value">${new Date(email.sentAt).toLocaleString()}</span>
              </div>` : ''}
              ${email.repliedAt ? `<div class="ehc-detail-row">
                <span class="ehc-detail-label">Replied:</span>
                <span class="ehc-detail-value">${new Date(email.repliedAt).toLocaleString()}</span>
              </div>` : ''}
            </div>
            
            <div class="ehc-detail-content">
              <div class="ehc-detail-section">
                <div class="ehc-detail-section-label">Subject</div>
                <div class="ehc-detail-subject">${escHtml(email.subject)}</div>
              </div>
              
              <div class="ehc-detail-section">
                <div class="ehc-detail-section-label">Body</div>
                <div class="ehc-detail-body">${escHtml(email.body).replace(/\n/g, '<br>')}</div>
              </div>
              
              ${email.notes ? `<div class="ehc-detail-section">
                <div class="ehc-detail-section-label">Notes</div>
                <div class="ehc-detail-notes">${escHtml(email.notes).replace(/\n/g, '<br>')}</div>
              </div>` : ''}
            </div>
            
            <div class="ehc-detail-actions">
              <button onclick="ehcCopyEmail('${email.id}')" class="ehc-btn-primary">📋 Copy Email</button>
              ${email.status === 'generated' ? `<button onclick="ehcMarkAsSent('${email.id}'); document.getElementById('email-detail-modal').remove();" class="ehc-btn-primary">📤 Mark as Sent</button>` : ''}
              ${email.status === 'sent' ? `<button onclick="ehcMarkAsReplied('${email.id}'); document.getElementById('email-detail-modal').remove();" class="ehc-btn-primary">✅ Mark as Replied</button>` : ''}
              <button onclick="ehcAddNoteToEmail('${email.id}')" class="ehc-btn-secondary">📝 Add Note</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  };

  window.ehcMarkAsSent = function(emailId) {
    updateEmailStatus(emailId, EMAIL_STATUS.SENT);
    ehcRenderHistory();
    if (typeof showToast === 'function') showToast('✓ Marked as sent');
  };

  window.ehcMarkAsReplied = function(emailId) {
    updateEmailStatus(emailId, EMAIL_STATUS.REPLIED);
    ehcRenderHistory();
    if (typeof showToast === 'function') showToast('✓ Marked as replied');
  };

  window.ehcCopyEmail = function(emailId) {
    const history = getEmailHistory();
    const email = history.find(e => e.id === emailId);
    if (!email) return;
    
    const text = 'Subject: ' + email.subject + '\n\n' + email.body;
    navigator.clipboard.writeText(text);
    if (typeof showToast === 'function') showToast('✓ Email copied');
  };

  window.ehcAddNoteToEmail = function(emailId) {
    const note = prompt('Add a note to this email:');
    if (!note) return;
    
    updateEmailStatus(emailId, null, note);
    if (typeof showToast === 'function') showToast('✓ Note added');
    
    // Refresh detail view if open
    const detailModal = document.getElementById('email-detail-modal');
    if (detailModal) {
      detailModal.remove();
      ehcViewEmail(emailId);
    }
  };

  // ── PROSPECT ACTIVITY TIMELINE ────────────────────────────────────
  window.ehcViewProspectTimeline = function(prospectId) {
    const emails = getProspectEmails(prospectId);
    
    const existing = document.getElementById('prospect-timeline-modal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.id = 'prospect-timeline-modal';
    modal.className = 'ehc-modal-overlay';
    modal.onclick = function(e) {
      if (e.target === modal) modal.remove();
    };
    
    const companyName = emails.length > 0 ? emails[0].companyName : 'Prospect';
    
    modal.innerHTML = `
      <div class="ehc-modal ehc-modal-large">
        <div class="ehc-modal-header">
          <div class="ehc-modal-title">📊 Activity Timeline — ${escHtml(companyName)}</div>
          <button onclick="document.getElementById('prospect-timeline-modal').remove()" class="ehc-modal-close">✕</button>
        </div>
        <div class="ehc-modal-body">
          <div class="ehc-timeline">
            ${emails.map(e => `
              <div class="ehc-timeline-item">
                <div class="ehc-timeline-dot ${e.status === 'replied' ? 'ehc-timeline-dot-success' : ''}"></div>
                <div class="ehc-timeline-content">
                  <div class="ehc-timeline-date">${new Date(e.timestamp).toLocaleDateString()} ${new Date(e.timestamp).toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'})}</div>
                  <div class="ehc-timeline-title">${escHtml(e.touchType || 'Email')} — ${escHtml(e.subject)}</div>
                  <div class="ehc-timeline-status">Status: ${e.status}</div>
                  <button onclick="ehcViewEmail('${e.id}')" class="ehc-timeline-btn">View Email</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
  };

  // ── FOLLOW-UP MANAGEMENT ──────────────────────────────────────────
  window.addFollowUpReminder = function(emailId, followUpDate, notes) {
    const followUps = getFollowUps();
    
    followUps.push({
      id: 'fu_' + Date.now(),
      emailId: emailId,
      followUpDate: followUpDate,
      notes: notes || '',
      completed: false,
      createdAt: new Date().toISOString()
    });
    
    saveFollowUps(followUps);
    if (typeof showToast === 'function') showToast('✓ Follow-up reminder added');
  };

  window.getUpcomingFollowUps = function() {
    const followUps = getFollowUps();
    const now = new Date();
    
    return followUps
      .filter(fu => !fu.completed && new Date(fu.followUpDate) >= now)
      .sort((a, b) => new Date(a.followUpDate) - new Date(b.followUpDate));
  };

  // Utility function for HTML escaping
  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  console.log('[Email History & CRM] Loaded successfully');

})();
