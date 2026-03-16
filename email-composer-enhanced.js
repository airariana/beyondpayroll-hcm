// ══════════════════════════════════════════════════════════════════
// ENHANCED EMAIL COMPOSER
// Template library, token picker, and intelligent composition
// ══════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ── TEMPLATE STORAGE ──────────────────────────────────────────────
  const TEMPLATES_KEY = 'bp_email_templates';
  const SIGNATURES_KEY = 'bp_email_signatures';

  function getTemplates() {
    try {
      return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveTemplates(templates) {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
  }

  function getSignatures() {
    try {
      const sigs = JSON.parse(localStorage.getItem(SIGNATURES_KEY) || 'null');
      if (!sigs) {
        // Create default signatures
        return [
          {
            id: 'default_wfn',
            name: 'Standard (WFN)',
            track: 'WFN',
            content: '— AJ\nADP\nbeyondpayroll.net',
            isDefault: true
          },
          {
            id: 'default_ts',
            name: 'Standard (TotalSource)',
            track: 'TS',
            content: '— AJ\nADP TotalSource PEO\nbeyondpayroll.net',
            isDefault: true
          }
        ];
      }
      return sigs;
    } catch {
      return [];
    }
  }

  function saveSignatures(signatures) {
    localStorage.setItem(SIGNATURES_KEY, JSON.stringify(signatures));
  }

  // ── DEFAULT TEMPLATE LIBRARY ──────────────────────────────────────
  function seedDefaultTemplates() {
    const existing = getTemplates();
    if (existing.length > 0) return; // Already seeded

    const defaults = [
      {
        id: 'cold_research',
        name: 'Cold Outreach - Research Brief',
        category: 'Cold Outreach',
        track: 'Both',
        subject: '{{companyName}} + {{stateCompliance}}',
        body: `Hi {{firstName}},

{{companyName}} — {{headcount}}-person {{industry}} in {{state}}. {{topPainPoint}} usually means {{painSolution}}.

Worth a 15-minute benchmark conversation?

— AJ
ADP
beyondpayroll.net`,
        description: 'Research-driven cold opener with pain point hook',
        created: new Date().toISOString()
      },
      {
        id: 'competitive_displacement',
        name: 'Competitive Displacement',
        category: 'Competitive',
        track: 'Both',
        subject: '{{competitor}} gap at {{companyName}}',
        body: `Hi {{firstName}},

{{competitor}} {{competitorWeakness}} — that's probably why {{topPainPoint}}.

{{painSolution}} eliminates that entirely. For {{headcount}}-person {{industry}} companies in {{state}}, we're seeing {{painImpact}}.

Does {{timeline}} work for a quick benchmark review?

— AJ
ADP
beyondpayroll.net`,
        description: 'Competitive positioning with specific competitor weakness',
        created: new Date().toISOString()
      },
      {
        id: 'compliance_alert',
        name: 'Compliance Alert',
        category: 'Compliance',
        track: 'Both',
        subject: '{{state}} compliance update — {{companyName}}',
        body: `Hi {{firstName}},

{{stateCompliance}}

{{painSolution}} for {{headcount}}-person {{industry}} companies handles this automatically.

Quick call to walk through {{state}}-specific requirements?

— AJ
ADP
beyondpayroll.net`,
        description: 'State-specific compliance hook',
        created: new Date().toISOString()
      },
      {
        id: 'roi_benchmark',
        name: 'ROI Benchmark',
        category: 'Value',
        track: 'Both',
        subject: 'HCM cost benchmark — {{companyName}}',
        body: `Hi {{firstName}},

{{industry}} companies at {{headcount}} employees typically pay {{industryBenchmark}} for full HCM.

Worth comparing what {{companyName}} is running now?

— AJ
ADP
beyondpayroll.net`,
        description: 'Industry benchmark with cost comparison',
        created: new Date().toISOString()
      },
      {
        id: 'breakup_email',
        name: 'Breakup Email',
        category: 'Breakup',
        track: 'Both',
        subject: 'Last one — {{companyName}}',
        body: `Hi {{firstName}},

Last note — {{topPainPoint}} doesn't fix itself.

If that changes and {{companyName}} wants to see what {{painSolution}} looks like in practice, I'm here.

— AJ
ADP
beyondpayroll.net`,
        description: 'Pattern interrupt breakup email',
        created: new Date().toISOString()
      },
      {
        id: 'peo_benefits',
        name: 'PEO Benefits Hook',
        category: 'PEO',
        track: 'TS',
        subject: 'Fortune 500 benefits at {{headcount}} employees',
        body: `Hi {{firstName}},

TotalSource PEO gives {{companyName}} Fortune 500 carrier access at {{headcount}} employees — {{industry}} companies typically see {{industryBenchmark}} in benefits cost reduction.

Worth a benefits benchmark review?

— AJ
ADP TotalSource PEO
beyondpayroll.net`,
        description: 'PEO benefits cost reduction angle',
        created: new Date().toISOString()
      },
      {
        id: 'adp_upsell',
        name: 'ADP Client Upsell',
        category: 'Upsell',
        track: 'Both',
        subject: '{{companyName}} + ADP upgrade path',
        body: `Hi {{firstName}},

{{competitor}} served you well at smaller scale — at {{headcount}} employees, {{adpAdvantage}}.

Quick conversation about what the upgrade path looks like?

— AJ
ADP
beyondpayroll.net`,
        description: 'Existing ADP client upgrade opportunity',
        created: new Date().toISOString()
      }
    ];

    saveTemplates(defaults);
    console.log('[Template Library] Seeded default templates');
  }

  // ── TEMPLATE MANAGER UI ───────────────────────────────────────────
  window.openTemplateLibrary = function() {
    seedDefaultTemplates(); // Ensure defaults exist

    const existing = document.getElementById('template-library-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'template-library-modal';
    modal.className = 'eec-modal-overlay';
    modal.onclick = function(e) {
      if (e.target === modal) modal.remove();
    };

    modal.innerHTML = `
      <div class="eec-modal">
        <div class="eec-modal-header">
          <div class="eec-modal-title">📧 Email Template Library</div>
          <button onclick="document.getElementById('template-library-modal').remove()" class="eec-modal-close">✕</button>
        </div>
        <div class="eec-modal-body">
          <div class="eec-template-controls">
            <button onclick="eecNewTemplate()" class="eec-btn-primary">+ New Template</button>
            <input type="text" id="eec-template-search" placeholder="Search templates..." class="eec-search-input" oninput="eecFilterTemplates()">
          </div>
          <div id="eec-template-list" class="eec-template-list"></div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    eecRenderTemplates();
  };

  window.eecRenderTemplates = function(filter = '') {
    const list = document.getElementById('eec-template-list');
    if (!list) return;

    const templates = getTemplates();
    const filtered = filter 
      ? templates.filter(t => 
          (t.name || '').toLowerCase().includes(filter.toLowerCase()) ||
          (t.category || '').toLowerCase().includes(filter.toLowerCase()) ||
          (t.body || '').toLowerCase().includes(filter.toLowerCase())
        )
      : templates;

    if (filtered.length === 0) {
      list.innerHTML = '<div class="eec-empty-state">No templates found. Create your first template!</div>';
      return;
    }

    list.innerHTML = filtered.map((t, i) => `
      <div class="eec-template-card">
        <div class="eec-template-card-header">
          <div class="eec-template-card-title">${escHtml(t.name || 'Untitled')}</div>
          <div class="eec-template-card-badges">
            ${t.category ? `<span class="eec-badge eec-badge-category">${escHtml(t.category)}</span>` : ''}
            ${t.track ? `<span class="eec-badge eec-badge-track eec-badge-${t.track.toLowerCase()}">${escHtml(t.track)}</span>` : ''}
          </div>
        </div>
        ${t.description ? `<div class="eec-template-card-desc">${escHtml(t.description)}</div>` : ''}
        <div class="eec-template-card-preview">
          <div class="eec-preview-label">Subject:</div>
          <div class="eec-preview-text">${escHtml(t.subject || '—')}</div>
          <div class="eec-preview-label" style="margin-top:8px">Body:</div>
          <div class="eec-preview-text eec-preview-body">${escHtml((t.body || '').substring(0, 150))}${(t.body || '').length > 150 ? '...' : ''}</div>
        </div>
        <div class="eec-template-card-actions">
          <button onclick="eecUseTemplate('${t.id}')" class="eec-btn-use">Use Template</button>
          <button onclick="eecEditTemplate('${t.id}')" class="eec-btn-edit">Edit</button>
          <button onclick="eecDeleteTemplate('${t.id}')" class="eec-btn-delete">Delete</button>
        </div>
      </div>
    `).join('');
  };

  window.eecFilterTemplates = function() {
    const search = document.getElementById('eec-template-search');
    if (search) eecRenderTemplates(search.value);
  };

  window.eecNewTemplate = function() {
    eecOpenTemplateEditor(null);
  };

  window.eecEditTemplate = function(templateId) {
    const templates = getTemplates();
    const template = templates.find(t => t.id === templateId);
    if (template) eecOpenTemplateEditor(template);
  };

  window.eecDeleteTemplate = function(templateId) {
    if (!confirm('Delete this template?')) return;
    let templates = getTemplates();
    templates = templates.filter(t => t.id !== templateId);
    saveTemplates(templates);
    eecRenderTemplates();
    if (typeof showToast === 'function') showToast('✓ Template deleted');
  };

  window.eecUseTemplate = function(templateId) {
    const templates = getTemplates();
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    // Get current prospect context
    const prospect = window._hqProspect;
    if (!prospect) {
      if (typeof showToast === 'function') showToast('⚠ Load a prospect first', true);
      return;
    }

    // Build intel context
    const intelContext = window.buildEmailIntelContext ? window.buildEmailIntelContext(prospect) : null;
    if (!intelContext) {
      if (typeof showToast === 'function') showToast('⚠ Intel engine not loaded', true);
      return;
    }

    // Resolve tokens in template
    const resolvedSubject = window.resolveEmailTokens ? window.resolveEmailTokens(template.subject, intelContext) : template.subject;
    const resolvedBody = window.resolveEmailTokens ? window.resolveEmailTokens(template.body, intelContext) : template.body;

    // Apply to composer
    const subjectEl = document.getElementById('emailSubject');
    const bodyEl = document.getElementById('emailBody');
    
    if (subjectEl) subjectEl.textContent = resolvedSubject;
    if (bodyEl) {
      bodyEl.innerText = resolvedBody;
      if (window.cdxUpdateBodyStats) window.cdxUpdateBodyStats();
    }

    // Close template library
    const modal = document.getElementById('template-library-modal');
    if (modal) modal.remove();

    if (typeof showToast === 'function') showToast('✓ Template applied');
  };

  window.eecOpenTemplateEditor = function(template) {
    const isNew = !template;
    const t = template || {
      id: 'tmpl_' + Date.now(),
      name: '',
      category: '',
      track: 'Both',
      subject: '',
      body: '',
      description: '',
      created: new Date().toISOString()
    };

    const existing = document.getElementById('template-editor-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'template-editor-modal';
    modal.className = 'eec-modal-overlay';
    modal.onclick = function(e) {
      if (e.target === modal) modal.remove();
    };

    modal.innerHTML = `
      <div class="eec-modal eec-modal-large">
        <div class="eec-modal-header">
          <div class="eec-modal-title">${isNew ? '📝 New Template' : '✏️ Edit Template'}</div>
          <button onclick="document.getElementById('template-editor-modal').remove()" class="eec-modal-close">✕</button>
        </div>
        <div class="eec-modal-body">
          <div class="eec-editor-form">
            <div class="eec-form-row">
              <div class="eec-form-group" style="flex:2">
                <label class="eec-form-label">Template Name *</label>
                <input type="text" id="eec-tmpl-name" class="eec-form-input" value="${escHtml(t.name)}" placeholder="e.g., Compliance Alert - Multi-State">
              </div>
              <div class="eec-form-group" style="flex:1">
                <label class="eec-form-label">Category</label>
                <select id="eec-tmpl-category" class="eec-form-input">
                  <option value="">Select...</option>
                  <option value="Cold Outreach" ${t.category === 'Cold Outreach' ? 'selected' : ''}>Cold Outreach</option>
                  <option value="Competitive" ${t.category === 'Competitive' ? 'selected' : ''}>Competitive</option>
                  <option value="Compliance" ${t.category === 'Compliance' ? 'selected' : ''}>Compliance</option>
                  <option value="Value" ${t.category === 'Value' ? 'selected' : ''}>Value/ROI</option>
                  <option value="PEO" ${t.category === 'PEO' ? 'selected' : ''}>PEO</option>
                  <option value="Upsell" ${t.category === 'Upsell' ? 'selected' : ''}>Upsell</option>
                  <option value="Breakup" ${t.category === 'Breakup' ? 'selected' : ''}>Breakup</option>
                  <option value="Follow-up" ${t.category === 'Follow-up' ? 'selected' : ''}>Follow-up</option>
                </select>
              </div>
              <div class="eec-form-group" style="flex:1">
                <label class="eec-form-label">Track</label>
                <select id="eec-tmpl-track" class="eec-form-input">
                  <option value="Both" ${t.track === 'Both' ? 'selected' : ''}>Both</option>
                  <option value="WFN" ${t.track === 'WFN' ? 'selected' : ''}>WFN Only</option>
                  <option value="TS" ${t.track === 'TS' ? 'selected' : ''}>TS Only</option>
                </select>
              </div>
            </div>
            
            <div class="eec-form-group">
              <label class="eec-form-label">Description</label>
              <input type="text" id="eec-tmpl-desc" class="eec-form-input" value="${escHtml(t.description || '')}" placeholder="Brief description of when to use this template">
            </div>

            <div class="eec-form-group">
              <label class="eec-form-label">Subject Line *</label>
              <input type="text" id="eec-tmpl-subject" class="eec-form-input" value="${escHtml(t.subject)}" placeholder="Use {{tokens}} for dynamic content">
              <div class="eec-token-hint">Available tokens: {{companyName}}, {{firstName}}, {{state}}, {{topPainPoint}}, {{competitor}}, {{timeline}}, etc.</div>
            </div>

            <div class="eec-form-group">
              <label class="eec-form-label">Email Body *</label>
              <textarea id="eec-tmpl-body" class="eec-form-textarea" rows="12" placeholder="Use {{tokens}} for dynamic content...">${escHtml(t.body)}</textarea>
              <div class="eec-token-picker-btn" onclick="eecShowTokenPicker('eec-tmpl-body')">Insert Token ▼</div>
            </div>

            <div class="eec-form-actions">
              <button onclick="eecSaveTemplate('${t.id}', ${isNew})" class="eec-btn-primary">Save Template</button>
              <button onclick="document.getElementById('template-editor-modal').remove()" class="eec-btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  };

  window.eecSaveTemplate = function(templateId, isNew) {
    const name = (document.getElementById('eec-tmpl-name') || {}).value || '';
    const category = (document.getElementById('eec-tmpl-category') || {}).value || '';
    const track = (document.getElementById('eec-tmpl-track') || {}).value || 'Both';
    const description = (document.getElementById('eec-tmpl-desc') || {}).value || '';
    const subject = (document.getElementById('eec-tmpl-subject') || {}).value || '';
    const body = (document.getElementById('eec-tmpl-body') || {}).value || '';

    if (!name.trim() || !subject.trim() || !body.trim()) {
      if (typeof showToast === 'function') showToast('⚠ Name, subject, and body required', true);
      return;
    }

    let templates = getTemplates();
    
    if (isNew) {
      templates.push({
        id: templateId,
        name: name.trim(),
        category: category,
        track: track,
        description: description.trim(),
        subject: subject.trim(),
        body: body.trim(),
        created: new Date().toISOString()
      });
    } else {
      const idx = templates.findIndex(t => t.id === templateId);
      if (idx >= 0) {
        templates[idx] = Object.assign(templates[idx], {
          name: name.trim(),
          category: category,
          track: track,
          description: description.trim(),
          subject: subject.trim(),
          body: body.trim(),
          updated: new Date().toISOString()
        });
      }
    }

    saveTemplates(templates);
    
    const editorModal = document.getElementById('template-editor-modal');
    if (editorModal) editorModal.remove();
    
    eecRenderTemplates();
    if (typeof showToast === 'function') showToast('✓ Template saved');
  };

  // ── TOKEN PICKER ──────────────────────────────────────────────────
  window.eecShowTokenPicker = function(targetInputId) {
    const existing = document.getElementById('eec-token-picker');
    if (existing) {
      existing.remove();
      return;
    }

    const tokens = [
      { group: 'Contact', tokens: ['{{firstName}}', '{{lastName}}', '{{fullName}}', '{{title}}'] },
      { group: 'Company', tokens: ['{{companyName}}', '{{headcount}}', '{{headcountBand}}', '{{industry}}', '{{state}}'] },
      { group: 'Competitive', tokens: ['{{competitor}}', '{{competitorWeakness}}', '{{adpAdvantage}}'] },
      { group: 'Pain & Solution', tokens: ['{{topPainPoint}}', '{{painSolution}}', '{{painImpact}}'] },
      { group: 'Timeline', tokens: ['{{timeline}}', '{{budget}}', '{{stage}}', '{{champion}}', '{{economicBuyer}}'] },
      { group: 'Compliance', tokens: ['{{stateCompliance}}', '{{stateRegulations}}'] },
      { group: 'Benchmark', tokens: ['{{industryBenchmark}}'] },
      { group: 'Track', tokens: ['{{track}}', '{{trackLabel}}'] }
    ];

    const picker = document.createElement('div');
    picker.id = 'eec-token-picker';
    picker.className = 'eec-token-picker';
    
    let html = '<div class="eec-token-picker-header">Insert Token</div>';
    tokens.forEach(g => {
      html += `<div class="eec-token-group">`;
      html += `<div class="eec-token-group-label">${g.group}</div>`;
      g.tokens.forEach(t => {
        html += `<div class="eec-token-item" onclick="eecInsertToken('${targetInputId}', '${t}')">${t}</div>`;
      });
      html += `</div>`;
    });
    
    picker.innerHTML = html;
    
    const btn = event.target;
    const rect = btn.getBoundingClientRect();
    picker.style.position = 'absolute';
    picker.style.top = (rect.bottom + 4) + 'px';
    picker.style.left = rect.left + 'px';
    
    document.body.appendChild(picker);
    
    // Close on outside click
    setTimeout(() => {
      document.addEventListener('click', function closeTokenPicker(e) {
        if (!picker.contains(e.target) && e.target !== btn) {
          picker.remove();
          document.removeEventListener('click', closeTokenPicker);
        }
      });
    }, 100);
  };

  window.eecInsertToken = function(targetInputId, token) {
    const input = document.getElementById(targetInputId);
    if (!input) return;
    
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const text = input.value;
    
    input.value = text.substring(0, start) + token + text.substring(end);
    input.selectionStart = input.selectionEnd = start + token.length;
    input.focus();
    
    const picker = document.getElementById('eec-token-picker');
    if (picker) picker.remove();
  };

  // ── SIGNATURE MANAGER ─────────────────────────────────────────────
  window.openSignatureManager = function() {
    const existing = document.getElementById('signature-manager-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'signature-manager-modal';
    modal.className = 'eec-modal-overlay';
    modal.onclick = function(e) {
      if (e.target === modal) modal.remove();
    };

    modal.innerHTML = `
      <div class="eec-modal">
        <div class="eec-modal-header">
          <div class="eec-modal-title">✍️ Email Signatures</div>
          <button onclick="document.getElementById('signature-manager-modal').remove()" class="eec-modal-close">✕</button>
        </div>
        <div class="eec-modal-body">
          <div style="background:rgba(184,146,10,.08);border:1px solid rgba(184,146,10,.2);border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:12px;color:var(--text-2);line-height:1.6">
            <strong style="color:var(--text);display:block;margin-bottom:4px">📬 Outlook Integration</strong>
            The <strong>default signature</strong> is automatically appended when you click "Open in Outlook." 
            Note: Outlook's built-in signatures won't auto-apply to mailto: links—use this signature manager to control what gets sent.
          </div>
          <div class="eec-template-controls">
            <button onclick="eecNewSignature()" class="eec-btn-primary">+ New Signature</button>
          </div>
          <div id="eec-signature-list" class="eec-signature-list"></div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    eecRenderSignatures();
  };

  window.eecRenderSignatures = function() {
    const list = document.getElementById('eec-signature-list');
    if (!list) return;

    const signatures = getSignatures();
    
    list.innerHTML = signatures.map(s => `
      <div class="eec-signature-card">
        <div class="eec-signature-card-header">
          <div class="eec-signature-card-title">${escHtml(s.name)}</div>
          <div class="eec-template-card-badges">
            ${s.track ? `<span class="eec-badge eec-badge-track eec-badge-${s.track.toLowerCase()}">${escHtml(s.track)}</span>` : ''}
            ${s.isDefault ? `<span class="eec-badge eec-badge-default">Default</span>` : ''}
          </div>
        </div>
        <div class="eec-signature-preview">${escHtml(s.content).replace(/\n/g, '<br>')}</div>
        <div class="eec-signature-card-actions">
          ${!s.isDefault ? `<button onclick="eecSetDefaultSignature('${s.id}')" class="eec-btn-secondary">Set Default</button>` : ''}
          <button onclick="eecEditSignature('${s.id}')" class="eec-btn-edit">Edit</button>
          ${!s.isDefault ? `<button onclick="eecDeleteSignature('${s.id}')" class="eec-btn-delete">Delete</button>` : ''}
        </div>
      </div>
    `).join('');
  };

  window.eecNewSignature = function() {
    eecOpenSignatureEditor(null);
  };

  window.eecEditSignature = function(signatureId) {
    const signatures = getSignatures();
    const signature = signatures.find(s => s.id === signatureId);
    if (signature) eecOpenSignatureEditor(signature);
  };

  window.eecDeleteSignature = function(signatureId) {
    if (!confirm('Delete this signature?')) return;
    let signatures = getSignatures();
    signatures = signatures.filter(s => s.id !== signatureId);
    saveSignatures(signatures);
    eecRenderSignatures();
    if (typeof showToast === 'function') showToast('✓ Signature deleted');
  };

  window.eecSetDefaultSignature = function(signatureId) {
    let signatures = getSignatures();
    signatures.forEach(s => {
      s.isDefault = (s.id === signatureId);
    });
    saveSignatures(signatures);
    eecRenderSignatures();
    if (typeof showToast === 'function') showToast('✓ Default signature updated');
  };

  window.eecOpenSignatureEditor = function(signature) {
    const isNew = !signature;
    const s = signature || {
      id: 'sig_' + Date.now(),
      name: '',
      track: 'Both',
      content: '',
      isDefault: false
    };

    const existing = document.getElementById('signature-editor-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'signature-editor-modal';
    modal.className = 'eec-modal-overlay';
    modal.onclick = function(e) {
      if (e.target === modal) modal.remove();
    };

    modal.innerHTML = `
      <div class="eec-modal">
        <div class="eec-modal-header">
          <div class="eec-modal-title">${isNew ? '✍️ New Signature' : '✏️ Edit Signature'}</div>
          <button onclick="document.getElementById('signature-editor-modal').remove()" class="eec-modal-close">✕</button>
        </div>
        <div class="eec-modal-body">
          <div class="eec-editor-form">
            <div class="eec-form-row">
              <div class="eec-form-group" style="flex:2">
                <label class="eec-form-label">Signature Name *</label>
                <input type="text" id="eec-sig-name" class="eec-form-input" value="${escHtml(s.name)}" placeholder="e.g., Professional - WFN Track">
              </div>
              <div class="eec-form-group" style="flex:1">
                <label class="eec-form-label">Track</label>
                <select id="eec-sig-track" class="eec-form-input">
                  <option value="Both" ${s.track === 'Both' ? 'selected' : ''}>Both</option>
                  <option value="WFN" ${s.track === 'WFN' ? 'selected' : ''}>WFN Only</option>
                  <option value="TS" ${s.track === 'TS' ? 'selected' : ''}>TS Only</option>
                </select>
              </div>
            </div>

            <div class="eec-form-group">
              <label class="eec-form-label">Signature Content *</label>
              <textarea id="eec-sig-content" class="eec-form-textarea" rows="6" placeholder="— AJ\nADP\nbeyondpayroll.net">${escHtml(s.content)}</textarea>
            </div>

            <div class="eec-form-actions">
              <button onclick="eecSaveSignature('${s.id}', ${isNew})" class="eec-btn-primary">Save Signature</button>
              <button onclick="document.getElementById('signature-editor-modal').remove()" class="eec-btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  };

  window.eecSaveSignature = function(signatureId, isNew) {
    const name = (document.getElementById('eec-sig-name') || {}).value || '';
    const track = (document.getElementById('eec-sig-track') || {}).value || 'Both';
    const content = (document.getElementById('eec-sig-content') || {}).value || '';

    if (!name.trim() || !content.trim()) {
      if (typeof showToast === 'function') showToast('⚠ Name and content required', true);
      return;
    }

    let signatures = getSignatures();
    
    if (isNew) {
      signatures.push({
        id: signatureId,
        name: name.trim(),
        track: track,
        content: content.trim(),
        isDefault: signatures.length === 0,
        created: new Date().toISOString()
      });
    } else {
      const idx = signatures.findIndex(s => s.id === signatureId);
      if (idx >= 0) {
        signatures[idx] = Object.assign(signatures[idx], {
          name: name.trim(),
          track: track,
          content: content.trim(),
          updated: new Date().toISOString()
        });
      }
    }

    saveSignatures(signatures);
    
    const editorModal = document.getElementById('signature-editor-modal');
    if (editorModal) editorModal.remove();
    
    eecRenderSignatures();
    if (typeof showToast === 'function') showToast('✓ Signature saved');
  };

  // ── HELPER: Get default signature for track ──────────────────────
  window.eecGetDefaultSignature = function(track) {
    const signatures = getSignatures();
    
    // Try to find track-specific default
    let sig = signatures.find(s => s.isDefault && (s.track === track || s.track === 'Both'));
    
    // Fallback to any default
    if (!sig) sig = signatures.find(s => s.isDefault);
    
    // Fallback to first signature
    if (!sig && signatures.length > 0) sig = signatures[0];
    
    return sig ? sig.content : '— AJ\nADP\nbeyondpayroll.net';
  };

  // Utility function for HTML escaping
  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  console.log('[Enhanced Email Composer] Loaded successfully');

})();
