/**
 * SalesHQ Canva + Outlook Integration
 * Handles Canva asset generation and Outlook email workflow
 */

const OutlookCanvaIntegration = {
  // Enhanced asset generation with Outlook-ready outputs
  async generateForOutlook(assetType, prospectData, options = {}) {
    const {
      companyBrand = 'beyondpayroll', // or your other company
      includeLinkInEmail = true,
      autoDownload = false
    } = options;

    // Generate the Canva asset
    const result = await CanvaIntegration.generateAsset(
      assetType, 
      prospectData,
      options.brandKitId
    );

    if (result.success) {
      // Process results for Outlook usage
      return this.prepareForOutlook(result, {
        assetType,
        prospectData,
        includeLinkInEmail,
        autoDownload
      });
    }

    return result;
  },

  // Prepare Canva results for Outlook insertion
  prepareForOutlook(canvaResult, options) {
    const outlookReady = {
      ...canvaResult,
      outlookActions: [],
      emailTemplates: {}
    };

    // Extract design URLs
    const designUrls = this.extractDesignUrls(canvaResult);

    if (designUrls.length > 0) {
      const primaryUrl = designUrls[0];

      // Create Outlook-ready actions
      outlookReady.outlookActions = [
        {
          type: 'copyLink',
          label: '📎 Copy Link for Outlook',
          url: primaryUrl,
          action: () => this.copyForOutlook(primaryUrl)
        },
        {
          type: 'openAndCopy',
          label: '🎨 Open in Canva + Copy Link',
          url: primaryUrl,
          action: () => this.openAndCopyForOutlook(primaryUrl)
        },
        {
          type: 'exportPdf',
          label: '📥 Export PDF for Attachment',
          url: primaryUrl,
          action: () => this.exportForOutlookAttachment(primaryUrl)
        }
      ];

      // Generate email templates
      outlookReady.emailTemplates = this.generateEmailTemplates(
        options.assetType,
        options.prospectData,
        primaryUrl
      );
    }

    return outlookReady;
  },

  // Extract all design URLs from Canva result
  extractDesignUrls(canvaResult) {
    const urls = [];

    if (canvaResult.designs) {
      canvaResult.designs.forEach(design => {
        if (design.urls) {
          urls.push(...design.urls);
        } else if (design.candidates) {
          design.candidates.forEach(candidate => {
            if (candidate.url) urls.push(candidate.url);
          });
        }
      });
    }

    return urls;
  },

  // Copy link with Outlook-friendly formatting
  async copyForOutlook(designUrl) {
    const outlookText = `View the attached document: ${designUrl}`;
    
    try {
      await navigator.clipboard.writeText(outlookText);
      this.showNotification('✅ Link copied! Ready to paste in Outlook');
      return true;
    } catch (error) {
      console.error('Copy failed:', error);
      this.showNotification('❌ Copy failed - please copy manually', 'error');
      return false;
    }
  },

  // Open design in Canva and copy link
  async openAndCopyForOutlook(designUrl) {
    // Open in new tab
    window.open(designUrl, '_blank');
    
    // Copy link
    await this.copyForOutlook(designUrl);
    
    this.showNotification(
      '🎨 Opened in Canva & copied link. Edit if needed, then paste in Outlook!',
      'info',
      5000
    );
  },

  // Export design as PDF for Outlook attachment
  async exportForOutlookAttachment(designUrl) {
    this.showNotification('📥 Exporting PDF... This may take a moment', 'info');

    try {
      // Call Cloudflare Worker which proxies to Anthropic API with Canva MCP
      const response = await fetch("https://sales-hq-api.ajbb705.workers.dev/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `Export this Canva design as PDF: ${designUrl}
                      Use the highest quality export settings.`
          }],
          mcp_servers: [{
            type: "url",
            url: "https://mcp.canva.com/mcp",
            name: "canva-mcp"
          }]
        })
      });

      const data = await response.json();
      
      // Extract download URL from response
      const downloadUrl = this.extractDownloadUrl(data);
      
      if (downloadUrl) {
        this.showNotification('✅ PDF ready! Download and attach to Outlook', 'success');
        window.open(downloadUrl, '_blank');
      } else {
        this.showNotification('⚠️ Please export manually from Canva', 'warning');
        window.open(designUrl, '_blank');
      }
    } catch (error) {
      console.error('Export failed:', error);
      this.showNotification('❌ Export failed - please download from Canva directly', 'error');
      window.open(designUrl, '_blank');
    }
  },

  // Extract download URL from export response
  extractDownloadUrl(apiResponse) {
    // Parse MCP tool results for download URLs
    for (const block of apiResponse.content) {
      if (block.type === 'mcp_tool_result' && block.content) {
        for (const item of block.content) {
          if (item.type === 'text' && item.text) {
            // Look for download URLs
            const urlMatch = item.text.match(/https:\/\/[^\s]+\.(pdf|png|jpg)/i);
            if (urlMatch) return urlMatch[0];
          }
        }
      }
    }
    return null;
  },

  // Generate email templates for different asset types
  generateEmailTemplates(assetType, prospectData, designUrl) {
    const templates = {
      proposal: {
        subject: `Custom Proposal for ${prospectData.company || 'Your Team'}`,
        body: `Hi ${prospectData.name || 'there'},

Following our conversation, I've put together a custom proposal outlining how Beyond Payroll can help ${prospectData.company || 'your team'} with ${prospectData.painPoint || 'workforce management'}.

View the proposal here: ${designUrl}

Key highlights:
• Automated payroll processing
• Full compliance management
• Real-time workforce analytics
• Dedicated support team

I'd love to walk you through this in detail. Are you available for a 15-minute call this week?

Best regards,
${prospectData.repName || 'Your Name'}
${prospectData.repTitle || 'Beyond Payroll'}`
      },

      oneSheet: {
        subject: `Quick Overview - Beyond Payroll for ${prospectData.company || 'Your Team'}`,
        body: `Hi ${prospectData.name || 'there'},

I wanted to share a quick one-pager showing how Beyond Payroll can help ${prospectData.company || 'your organization'}.

View here: ${designUrl}

This shows:
✓ How we solve ${prospectData.painPoint || 'payroll challenges'}
✓ ROI data from similar ${prospectData.industry || 'companies'}
✓ Implementation timeline

Would you have 10 minutes to discuss how this could work for your team?

Best,
${prospectData.repName || 'Your Name'}`
      },

      caseStudy: {
        subject: `Case Study: How ${prospectData.industry || 'A Similar Company'} Saved $50K Annually`,
        body: `Hi ${prospectData.name || 'there'},

I thought you'd be interested in this case study showing how a ${prospectData.industry || 'similar'} company transformed their payroll operations.

View the case study: ${designUrl}

Results:
• 75% reduction in payroll processing time
• 95% fewer compliance issues
• $50K annual cost savings

Similar challenges to what you mentioned about ${prospectData.painPoint || 'your current process'}.

Worth a quick conversation?

Best,
${prospectData.repName || 'Your Name'}`
      },

      infographic: {
        subject: `The ROI of Payroll Automation [Infographic]`,
        body: `Hi ${prospectData.name || 'there'},

I created this infographic showing the impact of modern payroll automation specifically for ${prospectData.industry || 'companies like yours'}.

View infographic: ${designUrl}

The data shows:
📊 10 hours/week time savings
📊 95% error reduction
📊 60% faster month-end close

These numbers are based on companies facing similar challenges to ${prospectData.painPoint || 'what you described'}.

Can we schedule a quick call to discuss?

Best,
${prospectData.repName || 'Your Name'}`
      },

      emailSignature: {
        subject: 'Email Signature',
        body: `Your new email signature is ready!

Link: ${designUrl}

To use in Outlook:
1. Open the design in Canva
2. Download as PNG
3. In Outlook: Settings > Signatures > Insert image

Let me know if you need help setting it up.`
      },

      socialPost: {
        subject: 'LinkedIn Post Ready',
        body: `Your LinkedIn celebration post is ready!

Link: ${designUrl}

Next steps:
1. Review and edit in Canva if needed
2. Download as PNG/JPG
3. Post to LinkedIn with your caption

Suggested caption:
"Excited to announce our partnership with ${prospectData.company}! Looking forward to helping them transform their workforce management. 🚀"

Let me know if you want any changes!`
      }
    };

    return templates[assetType] || templates.oneSheet;
  },

  // Show notification to user
  showNotification(message, type = 'success', duration = 3000) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `outlook-notification outlook-notification-${type}`;
    notification.textContent = message;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Remove after duration
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, duration);
  },

  // Generate asset and show Outlook-specific UI
  async generateWithOutlookUI(assetType, prospectData, options = {}) {
    // Show loading
    this.showNotification('🎨 Generating your asset...', 'info', 30000);

    try {
      const result = await this.generateForOutlook(assetType, prospectData, options);
      
      if (result.success) {
        this.displayOutlookResults(result, assetType);
        return result;
      } else {
        throw new Error(result.error || 'Generation failed');
      }
    } catch (error) {
      this.showNotification('❌ Generation failed: ' + error.message, 'error');
      throw error;
    }
  },

  // Display results with Outlook-specific actions
  displayOutlookResults(result, assetType) {
    // Get or create results container
    let container = document.getElementById('outlookCanvaResults');
    if (!container) {
      container = document.createElement('div');
      container.id = 'outlookCanvaResults';
      container.className = 'outlook-results-panel';
      document.body.appendChild(container);
    }

    // Build HTML
    let html = `
      <div class="outlook-results-header">
        <h3>✅ Your ${CanvaIntegration.assetTypes[assetType]?.name || 'Asset'} is Ready!</h3>
        <button onclick="OutlookCanvaIntegration.closeResults()" class="close-btn">×</button>
      </div>
      
      <div class="outlook-results-content">
        <div class="outlook-actions">
          <h4>📧 Use in Outlook:</h4>
    `;

    // Add Outlook-specific action buttons
    result.outlookActions?.forEach(action => {
      html += `
        <button class="outlook-action-btn" onclick='${action.action}'>
          ${action.label}
        </button>
      `;
    });

    html += `</div>`;

    // Add email template section
    if (result.emailTemplates) {
      const template = result.emailTemplates;
      html += `
        <div class="email-template-section">
          <h4>📝 Email Template (Ready to Copy):</h4>
          
          <div class="template-field">
            <label>Subject:</label>
            <div class="template-value">
              ${template.subject}
              <button onclick="OutlookCanvaIntegration.copyText('${this.escapeHtml(template.subject)}')" 
                      class="copy-mini-btn">📋</button>
            </div>
          </div>
          
          <div class="template-field">
            <label>Body:</label>
            <div class="template-value template-body">
              <pre>${template.body}</pre>
              <button onclick="OutlookCanvaIntegration.copyText(\`${this.escapeHtml(template.body)}\`)" 
                      class="copy-btn">📋 Copy Email Body</button>
            </div>
          </div>
        </div>
      `;
    }

    html += `
      </div>
    `;

    container.innerHTML = html;
    container.classList.add('show');
  },

  // Close results panel
  closeResults() {
    const container = document.getElementById('outlookCanvaResults');
    if (container) {
      container.classList.remove('show');
      setTimeout(() => container.remove(), 300);
    }
  },

  // Copy text to clipboard
  async copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showNotification('✅ Copied to clipboard!');
    } catch (error) {
      this.showNotification('❌ Copy failed - please copy manually', 'error');
    }
  },

  // Escape HTML for safe insertion
  escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/`/g, '\\`');
  }
};

// Export to global scope
window.OutlookCanvaIntegration = OutlookCanvaIntegration;
