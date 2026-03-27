/**
 * SalesHQ Canva Integration Module
 * Adds visual collateral generation to email outreach workflow
 */

// ==================== CANVA ASSET GENERATOR ====================

const CanvaIntegration = {
  // Asset type configurations
  assetTypes: {
    proposal: {
      name: 'Business Proposal',
      icon: '📄',
      designType: 'proposal',
      description: 'Visual proposal document with pricing and value prop'
    },
    oneSheet: {
      name: 'One-Pager',
      icon: '📋',
      designType: 'flyer',
      description: 'Single-page product/service overview'
    },
    caseStudy: {
      name: 'Case Study',
      icon: '📊',
      designType: 'doc',
      description: 'Client success story with metrics'
    },
    infographic: {
      name: 'Value Infographic',
      icon: '🎨',
      designType: 'infographic',
      description: 'Visual representation of ROI/benefits'
    },
    socialPost: {
      name: 'LinkedIn Post',
      icon: '💼',
      designType: 'instagram_post',
      description: 'Social proof post for sharing wins'
    },
    emailSignature: {
      name: 'Email Signature',
      icon: '✉️',
      designType: 'business_card',
      description: 'Branded email signature with CTA'
    }
  },

  // Generate Canva asset using Anthropic API with MCP
  async generateAsset(assetType, prospectData, brandKitId = null) {
    const config = this.assetTypes[assetType];
    if (!config) {
      throw new Error(`Unknown asset type: ${assetType}`);
    }

    // Build context-aware query
    const query = this.buildQuery(assetType, prospectData);

    // Call Cloudflare Worker which proxies to Anthropic API with Canva MCP server
    const payload = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: query
      }],
      mcp_servers: [{
        type: "url",
        url: "https://mcp.canva.com/mcp",
        name: "canva-mcp"
      }]
    };

    // Add brand kit if provided
    if (brandKitId) {
      payload.messages[0].content += `\n\nUse brand kit ID: ${brandKitId}`;
    }

    try {
      // Use your existing Cloudflare Worker endpoint
      const response = await fetch("https://sales-hq-api.ajbb705.workers.dev/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return this.extractCanvaResults(data);
    } catch (error) {
      console.error('Canva generation failed:', error);
      throw error;
    }
  },

  // Build context-aware query based on asset type and prospect
  buildQuery(assetType, prospectData) {
    // Extract enriched intelligence data
    const raw = prospectData.rawData || {};
    const painPoints = raw.painPoints || [];
    const buyingSignals = raw.buyingSignals || [];
    const objections = raw.objections || [];
    const keyQuotes = raw.keyQuotes || [];
    
    // Build context string from extracted intelligence
    let intelligenceContext = '';
    if (keyQuotes.length) {
      intelligenceContext += `\nKey quote from prospect: "${keyQuotes[0]}"`;
    }
    if (buyingSignals.length) {
      intelligenceContext += `\nBuying signals: ${buyingSignals.join(', ')}`;
    }
    if (objections.length) {
      intelligenceContext += `\nConcerns to address: ${objections.join(', ')}`;
    }
    if (painPoints.length > 0) {
      intelligenceContext += `\nSpecific pain points: ${painPoints.slice(0, 5).join(', ')}`;
    }
    
    const queries = {
      proposal: `Create a professional business proposal for ${prospectData.company || 'prospect'}.
        Industry: ${prospectData.industry || 'general'}
        Key pain point: ${prospectData.painPoint || 'operational efficiency'}
        Solution: Beyond Payroll - integrated payroll and workforce management${intelligenceContext}
        
        Include: Executive summary, problem statement directly addressing their challenges, our solution, pricing tiers, next steps
        Make it visually compelling with charts and graphics.
        ${keyQuotes.length ? 'Reference their specific concerns about: ' + keyQuotes[0] : ''}`,

      oneSheet: `Create a one-page product overview flyer for Beyond Payroll targeting ${prospectData.company || 'prospects'}.
        Industry focus: ${prospectData.industry || 'general business'}
        Their challenges: ${painPoints.slice(0, 3).join(', ') || prospectData.painPoint || 'operational efficiency'}${intelligenceContext}
        
        Highlight: Automated payroll, compliance tracking, workforce analytics
        Include: Key benefits addressing their specific pain points, ROI stats, customer logos, contact CTA
        Design style: Professional, clean, data-driven
        ${objections.length ? 'Address concern: ' + objections[0] : ''}`,

      caseStudy: `Create a case study document showcasing success with a client similar to ${prospectData.company || 'prospect'}.
        Industry: ${prospectData.industry || 'general'}
        Challenge: ${prospectData.painPoint || 'Manual payroll processes causing errors'}
        Specific pain points: ${painPoints.slice(0, 3).join(', ') || 'Payroll errors, compliance risks'}${intelligenceContext}
        
        Solution: Beyond Payroll automation
        Results: 75% time savings, 95% error reduction, $50K annual cost savings
        Include: Before/after comparison, testimonial quote (${keyQuotes.length ? 'similar to: "' + keyQuotes[0] + '"' : 'about time savings'}), metrics dashboard`,

      infographic: `Create an infographic showing the value proposition for ${prospectData.company || 'prospects'}.
        Focus: ${prospectData.painPoint || 'Payroll automation benefits'}
        Address these challenges: ${painPoints.slice(0, 4).join(', ') || 'Time waste, errors, compliance'}${intelligenceContext}
        
        Data points: 
        - 10 hours/week time savings (addresses: ${painPoints[0] || 'manual processes'})
        - 95% reduction in payroll errors
        - 60% faster month-end close
        - Full compliance automation (addresses: ${painPoints.find(p => p.includes('compliance') || p.includes('tax')) || 'regulatory requirements'})
        Design: Modern, colorful, icon-driven with data visualizations
        ${buyingSignals.length ? 'Emphasize: ' + buyingSignals[0] : ''}`,

      socialPost: `Create a LinkedIn post graphic announcing a partnership/win with ${prospectData.company || 'a client'}.
        Context: They were facing ${painPoints.slice(0, 2).join(' and ') || 'payroll challenges'}
        Message: "Excited to partner with [Company] to transform their workforce management"
        Include: Beyond Payroll logo, celebration theme, professional imagery
        Style: Corporate but warm, celebration-worthy`,

      emailSignature: `Create an email signature graphic for a Beyond Payroll sales representative.
        Name: ${prospectData.repName || 'Sales Rep'}
        Title: ${prospectData.repTitle || 'Account Executive'}
        Include: Logo, contact info, "Schedule a Demo" CTA button
        Style: Clean, professional, mobile-friendly`
    };

    return queries[assetType] || queries.oneSheet;
  },

  // Extract Canva URLs and metadata from API response
  extractCanvaResults(apiResponse) {
    const results = {
      success: false,
      designs: [],
      textResponse: '',
      error: null
    };

    try {
      // Process all content blocks
      for (const block of apiResponse.content) {
        // Extract text responses
        if (block.type === 'text') {
          results.textResponse += block.text + '\n';
        }

        // Extract MCP tool results (Canva design info)
        if (block.type === 'mcp_tool_result' && block.content) {
          for (const contentItem of block.content) {
            if (contentItem.type === 'text' && contentItem.text) {
              // Parse Canva design data
              try {
                const designData = JSON.parse(contentItem.text);
                if (designData.candidates || designData.designs) {
                  results.designs.push(designData);
                }
              } catch {
                // If not JSON, might be formatted text with URLs
                const urlMatch = contentItem.text.match(/https:\/\/[^\s]+/g);
                if (urlMatch) {
                  results.designs.push({ urls: urlMatch });
                }
              }
            }
          }
        }
      }

      results.success = results.designs.length > 0;
    } catch (error) {
      results.error = error.message;
    }

    return results;
  },

  // Get brand kits available to user
  async getBrandKits() {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: "List my available Canva brand kits"
          }],
          mcp_servers: [{
            type: "url",
            url: "https://mcp.canva.com/mcp",
            name: "canva-mcp"
          }]
        })
      });

      const data = await response.json();
      return this.extractCanvaResults(data);
    } catch (error) {
      console.error('Failed to get brand kits:', error);
      return { success: false, error: error.message };
    }
  }
};


// ==================== UI COMPONENTS ====================

function createCanvaPanel() {
  return `
    <div id="canvaPanel" class="canva-panel" style="display: none;">
      <div class="canva-header">
        <h3>🎨 Generate Sales Collateral</h3>
        <button onclick="toggleCanvaPanel()" class="close-btn">×</button>
      </div>

      <div class="canva-content">
        <!-- Asset Type Selection -->
        <div class="asset-selection">
          <h4>Select Asset Type</h4>
          <div class="asset-grid">
            ${Object.entries(CanvaIntegration.assetTypes).map(([key, config]) => `
              <button 
                class="asset-type-btn" 
                data-type="${key}"
                onclick="selectAssetType('${key}')"
              >
                <div class="asset-icon">${config.icon}</div>
                <div class="asset-name">${config.name}</div>
                <div class="asset-desc">${config.description}</div>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Generation Form -->
        <div id="generationForm" class="generation-form" style="display: none;">
          <h4>Customize Your <span id="selectedAssetName"></span></h4>
          
          <div class="form-group">
            <label>Prospect/Company Name</label>
            <input type="text" id="canva-company" placeholder="Acme Corp">
          </div>

          <div class="form-group">
            <label>Industry</label>
            <input type="text" id="canva-industry" placeholder="Healthcare, Manufacturing, etc.">
          </div>

          <div class="form-group">
            <label>Key Pain Point / Focus</label>
            <textarea id="canva-painpoint" rows="3" placeholder="Manual payroll processes causing compliance issues..."></textarea>
          </div>

          <div class="form-group">
            <label>Sales Rep Name (for signatures)</label>
            <input type="text" id="canva-repname" placeholder="John Smith">
          </div>

          <div class="form-group">
            <label>
              <input type="checkbox" id="canva-usebrand">
              Use Beyond Payroll Brand Kit
            </label>
          </div>

          <div class="form-actions">
            <button onclick="generateCanvaAsset()" class="btn-primary">
              🚀 Generate Asset
            </button>
            <button onclick="cancelGeneration()" class="btn-secondary">
              Cancel
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div id="canvaLoading" class="canva-loading" style="display: none;">
          <div class="spinner"></div>
          <p>Creating your sales collateral...</p>
          <p class="loading-tip">This may take 10-30 seconds</p>
        </div>

        <!-- Results Display -->
        <div id="canvaResults" class="canva-results" style="display: none;">
          <h4>✅ Your Asset is Ready!</h4>
          <div id="resultsContent"></div>
          <button onclick="resetCanvaPanel()" class="btn-primary">
            Create Another Asset
          </button>
        </div>

        <!-- Error Display -->
        <div id="canvaError" class="canva-error" style="display: none;">
          <h4>❌ Generation Failed</h4>
          <p id="errorMessage"></p>
          <button onclick="resetCanvaPanel()" class="btn-secondary">
            Try Again
          </button>
        </div>
      </div>
    </div>
  `;
}


// ==================== UI INTERACTIONS ====================

let selectedAssetType = null;

function toggleCanvaPanel() {
  const panel = document.getElementById('canvaPanel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function selectAssetType(assetType) {
  selectedAssetType = assetType;
  const config = CanvaIntegration.assetTypes[assetType];
  
  // Highlight selected button
  document.querySelectorAll('.asset-type-btn').forEach(btn => {
    btn.classList.remove('selected');
  });
  document.querySelector(`[data-type="${assetType}"]`).classList.add('selected');
  
  // Show form
  document.getElementById('selectedAssetName').textContent = config.name;
  document.getElementById('generationForm').style.display = 'block';
  
  // Auto-populate from current prospect if available
  if (window.currentProspect) {
    document.getElementById('canva-company').value = window.currentProspect.company || '';
    document.getElementById('canva-industry').value = window.currentProspect.industry || '';
    document.getElementById('canva-painpoint').value = window.currentProspect.painPoint || '';
  }
}

async function generateCanvaAsset() {
  if (!selectedAssetType) {
    alert('Please select an asset type first');
    return;
  }

  // Collect form data
  const prospectData = {
    company: document.getElementById('canva-company').value,
    industry: document.getElementById('canva-industry').value,
    painPoint: document.getElementById('canva-painpoint').value,
    repName: document.getElementById('canva-repname').value,
    useBrand: document.getElementById('canva-usebrand').checked
  };

  // Show loading state
  document.getElementById('generationForm').style.display = 'none';
  document.getElementById('canvaLoading').style.display = 'block';
  document.getElementById('canvaResults').style.display = 'none';
  document.getElementById('canvaError').style.display = 'none';

  try {
    // Generate asset
    const result = await CanvaIntegration.generateAsset(
      selectedAssetType,
      prospectData,
      prospectData.useBrand ? 'default' : null
    );

    if (result.success) {
      displayResults(result);
    } else {
      displayError(result.error || 'Failed to generate asset');
    }
  } catch (error) {
    displayError(error.message);
  }
}

function displayResults(result) {
  document.getElementById('canvaLoading').style.display = 'none';
  document.getElementById('canvaResults').style.display = 'block';

  let html = '<div class="results-list">';
  
  // Display text response
  if (result.textResponse) {
    html += `<div class="result-item">
      <h5>AI Response:</h5>
      <p>${result.textResponse}</p>
    </div>`;
  }

  // Display design links
  if (result.designs && result.designs.length > 0) {
    result.designs.forEach((design, index) => {
      if (design.urls) {
        design.urls.forEach(url => {
          html += `<div class="result-item">
            <h5>Design ${index + 1}:</h5>
            <a href="${url}" target="_blank" class="design-link">
              🎨 Open in Canva →
            </a>
            <button onclick="copyToClipboard('${url}')" class="btn-copy">
              📋 Copy Link
            </button>
          </div>`;
        });
      } else if (design.candidates) {
        design.candidates.forEach((candidate, i) => {
          if (candidate.url) {
            html += `<div class="result-item">
              <h5>Design Option ${i + 1}:</h5>
              <a href="${candidate.url}" target="_blank" class="design-link">
                🎨 Open in Canva →
              </a>
            </div>`;
          }
        });
      }
    });
  }

  html += '</div>';
  document.getElementById('resultsContent').innerHTML = html;
}

function displayError(message) {
  document.getElementById('canvaLoading').style.display = 'none';
  document.getElementById('canvaError').style.display = 'block';
  document.getElementById('errorMessage').textContent = message;
}

function resetCanvaPanel() {
  document.getElementById('generationForm').style.display = 'none';
  document.getElementById('canvaLoading').style.display = 'none';
  document.getElementById('canvaResults').style.display = 'none';
  document.getElementById('canvaError').style.display = 'none';
  
  // Reset form
  document.querySelectorAll('.asset-type-btn').forEach(btn => {
    btn.classList.remove('selected');
  });
  selectedAssetType = null;
}

function cancelGeneration() {
  resetCanvaPanel();
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert('Link copied to clipboard!');
  });
}


// ==================== WORKFLOW AUTOMATION ====================

// Auto-generate assets based on email campaign triggers
const CanvaWorkflows = {
  // Generate follow-up collateral after initial email
  async afterFirstEmail(prospect) {
    if (prospect.industry) {
      return await CanvaIntegration.generateAsset('oneSheet', prospect);
    }
  },

  // Generate proposal after discovery call
  async afterDiscoveryCall(prospect) {
    return await CanvaIntegration.generateAsset('proposal', prospect);
  },

  // Generate case study for similar industry wins
  async onDealClosed(prospect) {
    return await CanvaIntegration.generateAsset('caseStudy', prospect);
  },

  // Generate social proof after win
  async shareWinOnLinkedIn(prospect) {
    return await CanvaIntegration.generateAsset('socialPost', prospect);
  }
};


// ==================== EXPORT ====================

window.CanvaIntegration = CanvaIntegration;
window.CanvaWorkflows = CanvaWorkflows;
window.createCanvaPanel = createCanvaPanel;
window.toggleCanvaPanel = toggleCanvaPanel;
window.selectAssetType = selectAssetType;
window.generateCanvaAsset = generateCanvaAsset;
window.resetCanvaPanel = resetCanvaPanel;
window.cancelGeneration = cancelGeneration;
window.copyToClipboard = copyToClipboard;
