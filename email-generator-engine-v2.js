// ══════════════════════════════════════════════════════════════════════════
//  EMAIL GENERATOR ENGINE V2 - SMART DATA INTEGRATION
//  Enhances existing email engine with smart suggestions and better context
//  File: email-generator-engine-v2.js
//  Date: March 25, 2026
// ══════════════════════════════════════════════════════════════════════════

(function() {
  'use strict';
  
  console.log('🚀 Loading Email Generator Engine V2...');
  
  // ══════════════════════════════════════════════════════════════════════════
  //  ENHANCED DATA COLLECTION
  // ══════════════════════════════════════════════════════════════════════════
  
  function egCollectProspectDataV2() {
    var p = window._hqProspect || {};

    var firstName   = (p.contact || p.contactName || '').split(' ')[0] || '';
    var companyName = p.company || '';
    var persona     = p.persona || p.title || p.contactTitle || '';
    var numEE       = p.headcount || p.numEE || p.employees || '';
    
    // ENHANCED: Multiple state field attempts + address extraction
    var state = p.state || p.hqState || p.headquarterState || p.stateHQ || '';
    if (!state && p.address) {
      var stateMatch = p.address.match(/\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/i);
      if (stateMatch) state = stateMatch[1];
    }
    
    var industry    = p.industry || '';
    var track       = p.track || 'WFN';
    var email       = p.email || '';
    var phone       = p.phone || '';
    var linkedin    = p.linkedin || '';
    var clientType  = p.clientType || '';
    var adpProducts = p.adpProducts ? Array.from(p.adpProducts).join(', ') : '';

    var competitor  = p.competitor || p.incumbent || '';
    try {
      var sreComp = document.querySelector('#sre-competitor')?.value || 
                    document.querySelector('[data-sre-competitor]')?.textContent || '';
      if (sreComp && !competitor) competitor = sreComp;
    } catch(e) {}

    var painPoints = [];
    var painMap = {
      'sre-401k': '401k admin errors', 'sre-wc': "workers' comp issues",
      'sre-aca': 'ACA compliance burden', 'sre-benefits': 'benefits admin errors',
      'sre-tax': 'multi-state tax complexity', 'sre-platform': 'payroll platform instability',
      'sre-gl': 'GL reconciliation issues', 'sre-support': 'poor HR/payroll support',
      'sre-i9': 'I-9/onboarding compliance gaps', 'sre-multi': 'multi-entity payroll complexity',
      'sre-manual': 'excessive manual HR/payroll processes'
    };
    Object.entries(painMap).forEach(function(kv) {
      var el = document.getElementById(kv[0]);
      if (el && el.checked) painPoints.push(kv[1]);
    });
    if (!painPoints.length && p.painPoints && p.painPoints.length) {
      painPoints = p.painPoints;
    }

    // Transcript (OCR from Google Vision)
    var transcript = '';
    var taEl = document.getElementById('sre-transcript');
    if (taEl && taEl.value.trim()) {
      transcript = taEl.value.trim().slice(0, 1200);
    } else if (p.transcript) {
      transcript = String(p.transcript).slice(0, 1200);
    }

    var aiFields = p.aiFields || {};
    var aiInsights = p.aiInsights || [];
    var aiSources = p.aiSources || [];
    var aiNotes = p.notes || window._mfProfileSummary || '';

    var enrichmentLines = [];
    Object.entries(aiFields).forEach(function(kv) {
      if (kv[1] && String(kv[1]).trim()) enrichmentLines.push(kv[0] + ': ' + kv[1]);
    });
    aiInsights.forEach(function(ins) {
      if (ins.label && ins.value) enrichmentLines.push(ins.label + ': ' + ins.value);
    });

    var sreRec = '', sreConf = '', sreWfn = '', srePeo = '';
    var analysis = window._sreAnalysis || null;
    if (analysis) {
      sreRec  = analysis.rec  || '';
      sreConf = analysis.conf ? analysis.conf + '%' : '';
      sreWfn  = analysis.wfn  ? 'WFN Score: ' + analysis.wfn : '';
      srePeo  = analysis.peo  ? 'PEO Score: ' + analysis.peo : '';
    }
    if (!sreRec && p.sreRecommendation) sreRec  = p.sreRecommendation;
    if (!sreConf && p.sreConfidence)    sreConf = p.sreConfidence;

    var intelSummary = '';
    try {
      var intelStore = JSON.parse(localStorage.getItem('bp_intel_results') || '{}');
      var co = companyName.replace(/\s+/g, '_');
      var intelDays = [1, 8, 15, 22];
      var latestIntel = null;
      intelDays.forEach(function(d) {
        var k = co + '_day' + d;
        if (intelStore[k] && intelStore[k].result) {
          if (!latestIntel || intelStore[k].ts > latestIntel.ts) latestIntel = intelStore[k];
        }
      });
      if (latestIntel) intelSummary = String(latestIntel.result).slice(0, 800);
    } catch(e) {}

    var marketIntelSummary = '';
    try {
      var miaBody = document.getElementById('wfn-mia-body') || document.getElementById('ts-mia-body');
      if (miaBody && miaBody.innerText && miaBody.innerText.length > 50) {
        marketIntelSummary = miaBody.innerText.slice(0, 800);
      }
      
      var compIntel = localStorage.getItem('bp_competitive_intel_' + companyName.replace(/\s+/g, '_'));
      if (compIntel && !marketIntelSummary) {
        try {
          var parsed = JSON.parse(compIntel);
          if (parsed.summary) marketIntelSummary = parsed.summary.slice(0, 800);
        } catch(e2) {}
      }
    } catch(e) {}

    return {
      firstName, companyName, persona, numEE, state, industry, track,
      email, phone, linkedin, clientType, adpProducts,
      competitor, painPoints, transcript,
      aiFields, aiInsights, aiSources, aiNotes,
      enrichmentLines, sreRec, sreConf, sreWfn, srePeo,
      intelSummary, marketIntelSummary
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SMART SUGGESTIONS GENERATOR
  // ══════════════════════════════════════════════════════════════════════════
  
  function egGenerateSmartSuggestionsV2(data) {
    var suggestions = [];
    
    if (data.painPoints && data.painPoints.length > 0) {
      suggestions.push({
        icon: '🎯',
        label: 'Pain Points',
        text: data.painPoints.slice(0, 3).join(', '),
        priority: 'high'
      });
    }
    
    if (data.transcript && data.transcript.length > 100) {
      var snippet = data.transcript.slice(0, 150) + '...';
      suggestions.push({
        icon: '📞',
        label: 'Call Transcript',
        text: snippet,
        priority: 'high'
      });
    }
    
    if (data.marketIntelSummary && data.marketIntelSummary.length > 50) {
      var snippet = data.marketIntelSummary.slice(0, 150) + '...';
      suggestions.push({
        icon: '📊',
        label: 'Market Analysis',
        text: snippet,
        priority: 'medium'
      });
    }
    
    if (data.intelSummary && data.intelSummary.length > 50) {
      var snippet = data.intelSummary.slice(0, 150) + '...';
      suggestions.push({
        icon: '🔄',
        label: 'Latest Intel',
        text: snippet,
        priority: 'medium'
      });
    }
    
    if (data.sreRec) {
      suggestions.push({
        icon: '🤖',
        label: 'SRE Recommendation',
        text: data.sreRec + (data.sreConf ? ' (' + data.sreConf + ' confidence)' : ''),
        priority: 'medium'
      });
    }
    
    if (data.competitor && data.competitor !== 'Unknown / Cold') {
      suggestions.push({
        icon: '⚔️',
        label: 'Incumbent',
        text: 'Currently using ' + data.competitor,
        priority: 'high'
      });
    }
    
    if (data.industry) {
      suggestions.push({
        icon: '🏢',
        label: 'Industry Context',
        text: data.numEE + ' employees in ' + data.industry + ' (' + data.state + ')',
        priority: 'low'
      });
    }
    
    return suggestions;
  }

  function egRenderSmartSuggestionsV2(suggestions) {
    var panel = document.getElementById('eg-intel-suggestions');
    var list = document.getElementById('eg-suggestions-list');
    
    if (!panel || !list) return;
    
    if (suggestions.length === 0) {
      panel.style.display = 'none';
      return;
    }
    
    var priorityOrder = { high: 1, medium: 2, low: 3 };
    suggestions.sort(function(a, b) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    
    var html = suggestions.map(function(s) {
      var priorityColor = s.priority === 'high' ? '#22c55e' : s.priority === 'medium' ? '#f59e0b' : '#94a3b8';
      return '<div class="eg-suggestion-card" onclick="egAddSuggestionV2(this)" data-text="' + 
        s.text.replace(/"/g, '&quot;').replace(/'/g, '&#39;') + '">' +
        '<div style="display:flex;align-items:center;gap:8px">' +
        '<span style="font-size:16px">' + s.icon + '</span>' +
        '<span style="font-size:11px;font-weight:600;color:var(--navy)">' + s.label + '</span>' +
        '<span style="margin-left:auto;width:6px;height:6px;border-radius:50%;background:' + priorityColor + '"></span>' +
        '</div>' +
        '<div style="font-size:11px;color:var(--text-2);margin-top:4px;line-height:1.5">' + s.text + '</div>' +
        '</div>';
    }).join('');
    
    list.innerHTML = html;
    panel.style.display = 'block';
  }

  window.egAddSuggestionV2 = function(el) {
    var text = el.getAttribute('data-text');
    var ctxEl = document.getElementById('eg-context');
    if (!ctxEl || !text) return;
    
    var current = ctxEl.value.trim();
    if (current) {
      ctxEl.value = current + '\n' + text;
    } else {
      ctxEl.value = text;
    }
    
    el.style.opacity = '0.5';
    el.style.pointerEvents = 'none';
    setTimeout(function() {
      el.style.opacity = '1';
      el.style.pointerEvents = 'auto';
    }, 1000);
    
    if (typeof showToast === 'function') showToast('✓ Added to context');
  };

  // ══════════════════════════════════════════════════════════════════════════
  //  ENHANCED OPEN EMAIL ENGINE (WRAPPER)
  // ══════════════════════════════════════════════════════════════════════════
  
  var _originalOpenEmailEngine = window.openEmailEngine;
  
  window.openEmailEngine = function(touchOverride) {
    // Call original if it exists
    if (_originalOpenEmailEngine) {
      _originalOpenEmailEngine.call(this, touchOverride);
    }
    
    // Apply V2 enhancements
    var d = egCollectProspectDataV2();
    
    // Enhanced state matching
    if (d.state) {
      var stSel = document.getElementById('eg-state');
      if (stSel) {
        var matched = Array.from(stSel.options).find(function(o) {
          return o.value.toLowerCase() === d.state.toLowerCase() ||
                 o.text.toLowerCase().includes(d.state.toLowerCase()) ||
                 d.state.toLowerCase().includes(o.value.toLowerCase());
        });
        if (matched) stSel.value = matched.value;
      }
    }

    // Enhanced context with better formatting
    var ctxLines = [];
    
    if (d.painPoints.length) {
      ctxLines.push('🎯 PAIN POINTS: ' + d.painPoints.join(', '));
    }
    
    if (d.transcript) {
      ctxLines.push('\n📞 CALL TRANSCRIPT:\n' + d.transcript);
    }
    
    if (d.marketIntelSummary) {
      ctxLines.push('\n📊 MARKET INTELLIGENCE:\n' + d.marketIntelSummary);
    }
    
    if (d.intelSummary) {
      ctxLines.push('\n🔄 LATEST INTEL:\n' + d.intelSummary);
    }
    
    if (d.sreRec) {
      ctxLines.push('\n🤖 SRE: ' + d.sreRec + (d.sreConf ? ' (' + d.sreConf + ' confidence)' : ''));
    }
    
    if (d.clientType === 'existing') {
      ctxLines.push('\n✓ EXISTING ADP CLIENT: ' + (d.adpProducts || 'unknown product'));
    }
    
    if (d.enrichmentLines.length) {
      ctxLines.push('\n📄 FROM DOCS: ' + d.enrichmentLines.slice(0, 5).join(' | '));
    }
    
    if (d.aiNotes) {
      ctxLines.push('\n📝 NOTES: ' + d.aiNotes.slice(0, 200));
    }

    var ctxEl = document.getElementById('eg-context');
    if (ctxEl && ctxLines.length) {
      ctxEl.value = ctxLines.join('\n');
    }

    // Generate and render smart suggestions
    var suggestions = egGenerateSmartSuggestionsV2(d);
    egRenderSmartSuggestionsV2(suggestions);

    // Enhanced data richness indicator
    var dataPoints = [
      d.companyName, 
      d.painPoints.length, 
      d.transcript, 
      d.enrichmentLines.length, 
      d.intelSummary, 
      d.marketIntelSummary,
      d.sreRec
    ].filter(Boolean).length;
    
    var richness = dataPoints >= 5 ? '🟢 Rich intel loaded' : 
                   dataPoints >= 3 ? '🟡 Moderate intel' : 
                   '🔴 Limited intel';
    
    var sub = document.getElementById('eg-modal-sub');
    if (sub) {
      var currentText = sub.textContent || '';
      if (!currentText.includes('🟢') && !currentText.includes('🟡') && !currentText.includes('🔴')) {
        sub.textContent = currentText + ' · ' + richness;
      } else {
        sub.textContent = currentText.replace(/[🟢🟡🔴].*$/, richness);
      }
    }
  };

  console.log('✓ Email Generator Engine V2 loaded successfully');
  
})();
