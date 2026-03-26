# Email Enhancement System - Integration Guide

## Overview
This enhancement adds a sophisticated email intelligence and composition system to your BeyondPayroll Sales HQ platform with:
- **Intel Context Engine**: Aggregates all prospect data into structured email context
- **Enhanced Composer**: Template library with dynamic token system
- **Email History & CRM**: Activity tracking, status management, and follow-up reminders
- **Signature Manager**: Multiple signature templates with track-based defaults

## Files Created
1. `email-intel-engine.js` - Intelligence aggregation engine
2. `email-composer-enhanced.js` - Template library and token system
3. `email-history-crm.js` - Email logging and CRM functionality
4. `email-enhancements-styles.css` - Complete CSS styling

## Integration Steps

### Step 1: Add CSS Styles
Add this to the `<head>` section of your index.html, **after** your existing styles:

```html
<!-- Email Enhancement Styles -->
<link rel="stylesheet" href="email-enhancements-styles.css">
```

### Step 2: Add JavaScript Files
Add these scripts **before** the closing `</body>` tag, **after** app.js:

```html
<!-- Email Enhancement Scripts -->
<script src="email-intel-engine.js"></script>
<script src="email-composer-enhanced.js"></script>
<script src="email-history-crm.js"></script>
```

### Step 3: Add Navigation Buttons
Add these buttons to your HQ navigation (in the existing nav bar):

```html
<!-- Add to HQ Navigation -->
<button onclick="openTemplateLibrary()" class="hq-nav-btn">
  📧 Templates
</button>
<button onclick="openEmailHistory()" class="hq-nav-btn">
  📊 Email History
</button>
<button onclick="openSignatureManager()" class="hq-nav-btn">
  ✍️ Signatures
</button>
```

### Step 4: Integrate with Email Engine
Modify your existing `egGenerate()` function to log emails. Add this **at the end** of the function, right before the final closing brace:

```javascript
// Add to egGenerate() function after email is generated
if (text && typeof logEmail === 'function') {
  const prospect = window._hqProspect;
  const intelContext = buildEmailIntelContext(prospect);
  
  logEmail({
    prospectId: prospect ? (prospect.id || prospect.company) : null,
    companyName: companyName,
    contactName: firstName + (persona ? ' (' + persona + ')' : ''),
    contactEmail: prospect ? prospect.email : '',
    subject: _lastSubject,
    body: _lastBody,
    touchType: touchLabel,
    track: track,
    status: 'generated',
    intelSnapshot: intelContext
  });
}
```

### Step 5: Add Smart Suggestions to Email Engine
Add an intel suggestions panel to the Email Engine modal. Insert this **inside** the Email Engine modal HTML (around line 4900 in index.html), after the context field:

```html
<!-- Intel Suggestions Panel -->
<div id="eg-intel-suggestions" style="display:none; margin-top:16px">
  <div style="font-size:11px;font-weight:700;color:var(--navy);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px">
    💡 Intel Suggestions
  </div>
  <div id="eg-suggestions-list" style="display:flex;flex-direction:column;gap:8px"></div>
</div>
```

Then add this function to populate suggestions when Email Engine opens:

```javascript
// Add this new function
function egShowIntelSuggestions() {
  const prospect = window._hqProspect;
  if (!prospect || !buildEmailIntelContext) return;
  
  const intelContext = buildEmailIntelContext(prospect);
  const suggestions = getEmailIntelSuggestions(intelContext);
  
  if (suggestions.length === 0) return;
  
  const panel = document.getElementById('eg-intel-suggestions');
  const list = document.getElementById('eg-suggestions-list');
  
  if (!panel || !list) return;
  
  list.innerHTML = suggestions.map(s => `
    <div style="background:var(--off-white);border:1px solid var(--border);border-radius:6px;padding:10px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <span style="font-size:14px">${s.icon}</span>
        <span style="font-size:11px;font-weight:700;color:var(--text-2)">${s.title}</span>
      </div>
      <div style="font-size:12px;color:var(--text)">${s.description}</div>
      ${s.solution ? `<div style="font-size:11px;color:var(--text-3);margin-top:4px">💡 ${s.solution}</div>` : ''}
    </div>
  `).join('');
  
  panel.style.display = 'block';
}

// Call this when Email Engine modal opens
// Add to openEmailEngine() function after modal is displayed
egShowIntelSuggestions();
```

### Step 6: Add Template Quick-Apply to Composer
Add a "Use Template" button to your existing email composer. Insert near the compose controls:

```html
<button onclick="openTemplateLibrary()" style="background:var(--gold);color:var(--white);border:none;padding:8px 14px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer">
  📧 Use Template
</button>
```

### Step 7: Auto-Save Email on mailto: Click
Modify your `egOpenMailto()` function to auto-log when email is opened in Outlook:

```javascript
// Add to egOpenMailto() function, before opening mailto:
if (typeof updateEmailStatus === 'function') {
  // Find most recent generated email for this prospect
  const history = getEmailHistory ? getEmailHistory() : [];
  const recent = history.find(e => 
    e.companyName === (window._hqProspect || {}).company &&
    e.status === 'generated'
  );
  if (recent) {
    updateEmailStatus(recent.id, 'sent');
  }
}
```

## Usage Examples

### Example 1: Creating a New Template
```javascript
// User clicks "Templates" → "New Template"
// Fills in:
// - Name: "Multi-State Compliance Alert"
// - Category: "Compliance"
// - Track: "Both"
// - Subject: "{{state}} compliance update — {{companyName}}"
// - Body: "Hi {{firstName}},\n\n{{stateCompliance}}..."
// System saves template with tokens
```

### Example 2: Using a Template
```javascript
// User loads a prospect with VA as state
// Clicks "Use Template" → selects "Multi-State Compliance Alert"
// System resolves:
// - {{firstName}} → "Sarah"
// - {{companyName}} → "Acme Corp"
// - {{state}} → "VA"
// - {{stateCompliance}} → "Virginia requires semi-monthly pay..."
// Email populates in composer with all tokens resolved
```

### Example 3: Viewing Email History
```javascript
// User clicks "Email History"
// System shows:
// - All generated emails grouped by date
// - Status badges (Generated, Sent, Replied)
// - Filter by prospect, status, timeframe
// - Activity timeline per prospect
// - Quick actions (Mark Sent, Mark Replied, Copy)
```

### Example 4: Intel-Powered Email Generation
```javascript
// Prospect loaded with:
// - competitor: "Paylocity"
// - painPoints: ["Multi-state tax issues"]
// - state: "VA"
// - timeline: "Q2 2025"

// Intel engine automatically provides:
// - Competitive positioning for Paylocity
// - Pain point solution mapping
// - VA compliance risks
// - Timeline urgency framing

// Email Engine uses this context for smarter generation
```

## Advanced Features

### Custom Token Creation
Add your own tokens by extending the `resolveEmailTokens()` function:

```javascript
// Add custom tokens
resolved = resolved.replace(/\{\{customField\}\}/g, intelContext.customValue);
```

### Email Analytics Dashboard
Query email history for insights:

```javascript
const history = getEmailHistory();
const sent = history.filter(e => e.status === 'sent');
const replied = history.filter(e => e.status === 'replied');
const replyRate = (replied.length / sent.length * 100).toFixed(1);
console.log('Reply rate:', replyRate + '%');
```

### Follow-Up Automation
Schedule follow-ups based on cadence:

```javascript
// After sending Day 1 email
const followUpDate = new Date();
followUpDate.setDate(followUpDate.getDate() + 3); // Day 4 follow-up
addFollowUpReminder(emailId, followUpDate.toISOString(), 'Send Day 4 Value Prop');
```

## Token Reference

### Firmographic Tokens
- `{{firstName}}` - Contact first name
- `{{lastName}}` - Contact last name
- `{{fullName}}` - Full contact name
- `{{companyName}}` - Company name
- `{{title}}` - Contact title/persona
- `{{headcount}}` - Number of employees
- `{{headcountBand}}` - Employee range (e.g., "85-115 employees")
- `{{industry}}` - Industry vertical
- `{{state}}` - State abbreviation

### Competitive Tokens
- `{{competitor}}` - Current vendor name
- `{{competitorWeakness}}` - Top competitor weakness
- `{{adpAdvantage}}` - Corresponding ADP advantage

### Pain & Solution Tokens
- `{{topPainPoint}}` - Highest priority pain point
- `{{painSolution}}` - ADP solution for pain point
- `{{painImpact}}` - Business impact metrics

### Timeline Tokens
- `{{timeline}}` - Decision timeline
- `{{budget}}` - Budget status
- `{{stage}}` - Sales stage
- `{{champion}}` - Internal champion name
- `{{economicBuyer}}` - Economic buyer name

### Compliance Tokens
- `{{stateCompliance}}` - State-specific compliance risks
- `{{stateRegulations}}` - List of state regulations

### Benchmark Tokens
- `{{industryBenchmark}}` - Industry average HCM cost

### Track Tokens
- `{{track}}` - WFN or TS
- `{{trackLabel}}` - "WorkforceNow" or "TotalSource PEO"

## Troubleshooting

### Templates Not Showing
Check that default templates were seeded:
```javascript
// Run in console
localStorage.getItem('bp_email_templates');
// Should return JSON array
```

### Tokens Not Resolving
Verify intel context is building:
```javascript
const prospect = window._hqProspect;
const context = buildEmailIntelContext(prospect);
console.log(context);
// Should show full intel object
```

### Email History Empty
Verify logging is working:
```javascript
// Check if emails are being logged
getEmailHistory();
// Should return array of logged emails
```

## Best Practices

1. **Always load a prospect** before using templates - tokens need data
2. **Review resolved content** before sending - tokens may have missing data
3. **Update email status** after sending - enables accurate tracking
4. **Use specific templates** for different scenarios - don't try to make one template do everything
5. **Check intel suggestions** before generating - they surface relevant context
6. **Create custom templates** for your most common scenarios
7. **Tag emails with touchType** for better analytics

## Support

For issues or questions:
1. Check browser console for errors
2. Verify all scripts loaded (check Network tab)
3. Ensure localStorage is enabled
4. Check that prospect data structure matches expected format

## Future Enhancements

Potential additions:
- Email A/B testing
- Automated follow-up sequences
- Email performance heatmaps
- Integration with external email services (SendGrid, etc.)
- Bulk email generation
- Email scoring/quality checks
- Optimal send time suggestions
