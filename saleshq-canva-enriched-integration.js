/**
 * SalesHQ Canva Integration - Uses Existing Research Workflow
 * Plugs into window._hqProspect which already has all enriched data
 */

// Override the standard Canva generation to use enriched prospect data
const CanvaWithEnrichedData = {
  
  /**
   * Generate Canva asset using all available prospect data from your existing workflow
   */
  async generateWithEnrichedData(assetType, options = {}) {
    // Collect ALL available data from app.js globals (your existing function pattern)
    const enrichedData = this.collectAllProspectData();
    
    // Show what data we're using
    this.showDataRichness(enrichedData);
    
    // Generate with Outlook workflow
    return await OutlookCanvaIntegration.generateWithOutlookUI(
      assetType,
      enrichedData,
      options
    );
  },

  /**
   * Collect ALL available data from your existing workflow
   * Mirrors your egCollectProspectData() function pattern
   */
  collectAllProspectData() {
    const p = window._hqProspect || {};

    // ── Core firmographics (from your form fields) ──
    const firstName = (p.contact || p.contactName || '').split(' ')[0] || '';
    const companyName = p.company || '';
    const persona = p.persona || p.title || p.contactTitle || '';
    const numEE = p.headcount || p.numEE || p.employees || '';
    const state = p.state || p.hqState || '';
    const industry = p.industry || '';
    const track = p.track || 'WFN';
    const email = p.email || '';
    const phone = p.phone || '';
    const linkedin = p.linkedin || '';

    // ── AI-discovered fields (from your file uploads!) ──
    const aiFields = p.aiFields || {};
    const aiInsights = p.aiInsights || [];
    const aiSources = p.aiSources || [];
    const aiNotes = p.notes || window._mfProfileSummary || '';

    // Build enrichment string from AI-extracted data
    const enrichmentLines = [];
    Object.entries(aiFields).forEach(([key, value]) => {
      if (value && String(value).trim()) {
        enrichmentLines.push(`${key}: ${value}`);
      }
    });
    aiInsights.forEach(insight => {
      if (insight.label && insight.value) {
        enrichmentLines.push(`${insight.label}: ${insight.value}`);
      }
    });

    // ── Pain points (from SRE checkboxes) ──
    const painPoints = [];
    const painMap = {
      'sre-401k': '401k admin errors', 
      'sre-wc': "workers' comp issues",
      'sre-aca': 'ACA compliance burden', 
      'sre-benefits': 'benefits admin errors',
      'sre-tax': 'multi-state tax complexity', 
      'sre-platform': 'payroll platform instability',
      'sre-gl': 'GL reconciliation issues', 
      'sre-support': 'poor HR/payroll support',
      'sre-i9': 'I-9/onboarding compliance gaps', 
      'sre-multi': 'multi-entity payroll complexity',
      'sre-manual': 'excessive manual HR/payroll processes'
    };
    Object.entries(painMap).forEach(([id, label]) => {
      const el = document.getElementById(id);
      if (el && el.checked) painPoints.push(label);
    });
    if (!painPoints.length && p.painPoints && p.painPoints.length) {
      painPoints.push(...p.painPoints);
    }

    // ── Transcript (OCR from Google Vision or call recordings) ──
    let transcript = '';
    const taEl = document.getElementById('sre-transcript');
    if (taEl && taEl.value.trim()) {
      transcript = taEl.value.trim();
    } else if (p.transcript) {
      transcript = String(p.transcript);
    }

    // ── Intel Refresh results (from your cadence system) ──
    let intelSummary = '';
    try {
      const intelStore = JSON.parse(localStorage.getItem('bp_intel_results') || '{}');
      const co = companyName.replace(/\s+/g, '_');
      const intelDays = [1, 8, 15, 22];
      let latestIntel = null;
      intelDays.forEach(d => {
        const k = `${co}_day${d}`;
        if (intelStore[k] && intelStore[k].result) {
          if (!latestIntel || intelStore[k].ts > latestIntel.ts) {
            latestIntel = intelStore[k];
          }
        }
      });
      if (latestIntel) intelSummary = String(latestIntel.result);
    } catch(e) {
      console.error('Failed to load intel:', e);
    }

    // ── Market Intelligence (from Analysis Tools) ──
    let marketIntelSummary = '';
    try {
      // Check live DOM
      const miaBody = document.getElementById('wfn-mia-body') || 
                      document.getElementById('ts-mia-body');
      if (miaBody && miaBody.innerText && miaBody.innerText.length > 50) {
        marketIntelSummary = miaBody.innerText;
      }
      
      // Also check localStorage
      const compIntel = localStorage.getItem(`bp_competitive_intel_${companyName.replace(/\s+/g, '_')}`);
      if (compIntel && !marketIntelSummary) {
        const parsed = JSON.parse(compIntel);
        if (parsed.summary) marketIntelSummary = parsed.summary;
      }
    } catch(e) {
      console.error('Failed to load market intel:', e);
    }

    // ── SRE Analysis Results ──
    let sreRec = '', sreConf = '';
    const analysis = window._sreAnalysis || null;
    if (analysis) {
      sreRec = analysis.rec || '';
      sreConf = analysis.conf ? `${analysis.conf}%` : '';
    }
    if (!sreRec && p.sreRecommendation) sreRec = p.sreRecommendation;
    if (!sreConf && p.sreConfidence) sreConf = p.sreConfidence;

    // ── Competitor ──
    let competitor = p.competitor || p.incumbent || '';
    try {
      const sreComp = document.querySelector('#sre-competitor')?.value || 
                      document.querySelector('[data-sre-competitor]')?.textContent || '';
      if (sreComp && !competitor) competitor = sreComp;
    } catch(e) {}

    // ── Build comprehensive context for Canva ──
    const painPoint = this.buildPainPointNarrative(painPoints, enrichmentLines, transcript);
    const companyContext = this.buildCompanyContext({
      companyName, industry, numEE, state, competitor,
      marketIntelSummary, intelSummary, sreRec, enrichmentLines
    });

    return {
      // Basic fields for Canva
      name: firstName,
      company: companyName,
      industry: industry,
      painPoint: painPoint,
      
      // Extended data
      companyContext: companyContext,
      persona: persona,
      headcount: numEE,
      state: state,
      track: track,
      
      // Rep info
      repName: document.getElementById('canva-repname')?.value || 'Sales Rep',
      repTitle: 'Account Executive',
      
      // All the enriched data available for custom prompts
      rawData: {
        aiFields,
        aiInsights,
        aiSources,
        aiNotes,
        painPoints,
        transcript,
        intelSummary,
        marketIntelSummary,
        sreRec,
        sreConf,
        competitor,
        enrichmentLines
      }
    };
  },

  /**
   * Build narrative pain point from multiple sources
   */
  buildPainPointNarrative(painPoints, enrichmentLines, transcript) {
    const parts = [];
    
    if (painPoints.length) {
      parts.push(`Key challenges: ${painPoints.slice(0, 3).join(', ')}`);
    }
    
    if (enrichmentLines.length) {
      parts.push(`From uploaded docs: ${enrichmentLines.slice(0, 2).join(' | ')}`);
    }
    
    if (transcript) {
      // Extract first pain point mention from transcript
      const painMention = transcript.slice(0, 200);
      if (painMention.toLowerCase().includes('challenge') || 
          painMention.toLowerCase().includes('problem') ||
          painMention.toLowerCase().includes('issue')) {
        parts.push(`From call: ${painMention}`);
      }
    }
    
    return parts.join('. ') || 'Operational efficiency improvements needed';
  },

  /**
   * Build company context from market intel and research
   */
  buildCompanyContext(data) {
    const parts = [];
    
    if (data.companyName) {
      parts.push(`Company: ${data.companyName}`);
    }
    
    if (data.industry && data.numEE) {
      parts.push(`${data.industry} company with ${data.numEE} employees`);
    } else if (data.industry) {
      parts.push(`Industry: ${data.industry}`);
    }
    
    if (data.state) {
      parts.push(`Located in ${data.state}`);
    }
    
    if (data.competitor) {
      parts.push(`Currently using ${data.competitor}`);
    }
    
    if (data.sreRec) {
      parts.push(`SRE recommends: ${data.sreRec}`);
    }
    
    if (data.marketIntelSummary) {
      parts.push(`Market context: ${data.marketIntelSummary.slice(0, 200)}`);
    }
    
    if (data.intelSummary) {
      parts.push(`Latest intel: ${data.intelSummary.slice(0, 150)}`);
    }
    
    return parts.join('. ');
  },

  /**
   * Show data richness indicator
   */
  showDataRichness(enrichedData) {
    const dataPoints = [
      enrichedData.company,
      enrichedData.industry,
      enrichedData.rawData.painPoints.length,
      enrichedData.rawData.transcript,
      enrichedData.rawData.enrichmentLines.length,
      enrichedData.rawData.intelSummary,
      enrichedData.rawData.marketIntelSummary
    ].filter(Boolean).length;

    let richness, color, message;
    if (dataPoints >= 5) {
      richness = '🟢 Rich data loaded';
      color = '#10b981';
      message = `${dataPoints} data sources available for high-quality asset generation`;
    } else if (dataPoints >= 3) {
      richness = '🟡 Good data';
      color = '#f59e0b';
      message = `${dataPoints} data sources available`;
    } else {
      richness = '🔴 Basic data only';
      color = '#ef4444';
      message = `Only ${dataPoints} data sources. Upload files or run intel refresh for better results.`;
    }

    // Show notification
    OutlookCanvaIntegration.showNotification(
      `${richness} - ${message}`,
      dataPoints >= 3 ? 'success' : 'warning',
      4000
    );

    // Update Canva panel subtitle if it exists
    const sub = document.querySelector('#eg-modal-sub') || 
                document.querySelector('.canva-header p');
    if (sub) {
      sub.textContent = `${enrichedData.company || 'New Asset'} · ${richness}`;
      sub.style.color = color;
    }

    console.log('[Canva] Data richness:', {
      score: dataPoints,
      company: enrichedData.company,
      sources: {
        aiFields: Object.keys(enrichedData.rawData.aiFields).length,
        aiInsights: enrichedData.rawData.aiInsights.length,
        painPoints: enrichedData.rawData.painPoints.length,
        transcript: !!enrichedData.rawData.transcript,
        intelSummary: !!enrichedData.rawData.intelSummary,
        marketIntel: !!enrichedData.rawData.marketIntelSummary
      }
    });
  }
};

// Export to global scope
window.CanvaWithEnrichedData = CanvaWithEnrichedData;

// Override the standard generate function to use enriched data automatically
window.generateCanvaAssetEnriched = async function() {
  if (!selectedAssetType) {
    alert('Please select an asset type first');
    return;
  }

  // Get brand preference
  const useBrand = document.getElementById('canva-usebrand')?.checked;

  // Show loading
  document.getElementById('generationForm').style.display = 'none';
  document.getElementById('canvaLoading').style.display = 'block';

  try {
    // Generate with ALL enriched data from existing workflow
    const result = await CanvaWithEnrichedData.generateWithEnrichedData(
      selectedAssetType,
      {
        companyBrand: useBrand ? 'beyondpayroll' : null,
        includeLinkInEmail: true,
        autoDownload: false
      }
    );

    // Hide loading, close main panel
    document.getElementById('canvaLoading').style.display = 'none';
    toggleCanvaPanel();

    // Outlook results panel opens automatically

  } catch (error) {
    document.getElementById('canvaLoading').style.display = 'none';
    document.getElementById('canvaError').style.display = 'block';
    document.getElementById('errorMessage').textContent = error.message;
  }
};

console.log('✅ Canva integration connected to existing research workflow');
