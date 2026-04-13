# AI Sales Agent - Integration Guide

## 📦 What You're Getting

A fully-functional AI-powered sales agent that:
- ✅ Analyzes prospect context using Anthropic AI
- ✅ Decides next best action (send email, draft for review, create task, update notes)
- ✅ Executes actions automatically or queues for approval
- ✅ Tracks complete action history
- ✅ Shows beautiful UI on prospect cards

## 🚀 Integration Steps

### Step 1: Add JavaScript File

Add this line to `index.html` **BEFORE** the closing `</body>` tag (after app.js):

```html
<!-- AI Sales Agent Module -->
<script src="saleshq-ai-agent.js"></script>
```

### Step 2: Add HTML Components

Add these HTML elements to your `index.html`:

**A) Approval Queue Button** (add to your top navigation bar):

```html
<!-- Add this where your other top nav buttons are -->
<button onclick="showApprovalQueue()" style="position:relative;font-size:11px;padding:8px 16px;background:var(--navy);color:var(--gold);border:1px solid var(--gold);border-radius:5px;cursor:pointer;font-weight:600;font-family:var(--fb)">
  📋 Agent Queue
  <span id="agent-approval-badge" style="position:absolute;top:-6px;right:-6px;background:#ef4444;color:#fff;font-size:9px;font-weight:700;padding:2px 6px;border-radius:10px;display:none"></span>
</button>
```

**B) Agent Controls in Prospect Cards** (modify your prospect card rendering):

In your `hqRenderBanner()` function or wherever you render prospect cards, add this:

```javascript
// Inside prospect card HTML, after your existing fields
${typeof renderAgentControls === 'function' ? renderAgentControls(p) : ''}
```

### Step 3: Add CSS Styles

Add this to your `<style>` section in `index.html`:

```css
/* AI Agent Styles */
.agent-controls {
  animation: agentSlideIn 0.3s ease;
}

@keyframes agentSlideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.agent-controls button {
  transition: all 0.2s ease;
}

.agent-controls button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.agent-controls button:active {
  transform: translateY(0);
}
```

### Step 4: Verify Dependencies

Make sure these functions exist in your `app.js`:
- ✅ `getProspects()`
- ✅ `saveProspectsLocal()`
- ✅ `generateEmailFromIntelligence()`
- ✅ `saveEmailToHistory()`
- ✅ `showToast()`
- ✅ `API_ENDPOINTS.anthropic`

**All of these already exist in your codebase! ✓**

## 🎯 How It Works

### User Flow

1. **User clicks "Start Agent"** on a prospect card
2. Agent analyzes context → AI decides action → Executes automatically or drafts for review
3. If drafted, email appears in **Approval Queue**
4. User can approve, edit, or reject
5. Agent continues on schedule (Day 3, Day 7, Day 14, etc.)

### AI Decision Logic

The AI considers:
- Days since first touch
- Previous actions taken
- Gong intelligence (pain points, research behavior, competitive signals)
- Email history
- Prospect profile

Then decides:
- **Send email** (low-risk, clear situation)
- **Draft email** (high-stakes, needs review)
- **Create task** (time for a call)
- **Update notes** (log intelligence)
- **Pause** (wait for signals)

### Example Scenarios

**Scenario 1: New Prospect, Day 0**
```
AI Decision: "send_email"
Reasoning: "First touch with clear pain points - send immediate value-based email"
Action: Auto-sends first touch email
Next: Day 3
```

**Scenario 2: Research Detected, Day 5**
```
AI Decision: "draft_email"
Reasoning: "OutSail research detected - personalized approach needed, draft for review"
Action: Creates draft in approval queue
Status: Waiting for approval
```

**Scenario 3: No Response, Day 14**
```
AI Decision: "create_task"
Reasoning: "Multiple emails sent with no response - time for phone call"
Action: Creates task "Call [Contact] - follow up on emails"
Next: Day 21
```

## 📊 UI Components

### 1. Agent Controls (on prospect card)
```
┌─────────────────────────────────┐
│ 🤖 AI Agent    ● Active    [Log]│
│ Actions: 3 | Next: 4/15/26      │
│ Last: email sent                │
│ [Pause]           [Stop]        │
└─────────────────────────────────┘
```

### 2. Approval Queue
```
┌─────────────────────────────────┐
│ 📋 Agent Approval Queue (2)  [×]│
├─────────────────────────────────┤
│ ABC Company                     │
│ To: John Smith (john@abc.com)   │
│                                 │
│ 🤖 AI Recommendation            │
│ "OutSail research detected..."  │
│                                 │
│ Subject: Saw you're evaluating  │
│ Body: Hi John, I noticed...     │
│                                 │
│ [✓ Approve & Send] [✏️ Edit] [✕]│
└─────────────────────────────────┘
```

### 3. Agent Log
```
┌─────────────────────────────────┐
│ 🤖 Agent Log: ABC Company    [×]│
├─────────────────────────────────┤
│ Started: 4/10/26                │
│ Total Actions: 5                │
│ Next Action: 4/15/26            │
│                                 │
│ Action History:                 │
│ ┌───────────────────────────┐  │
│ │ 📧 EMAIL SENT             │  │
│ │ 4/12/26 2:30 PM           │  │
│ │ AI: "Follow-up needed..." │  │
│ │ Subject: Following up...  │  │
│ └───────────────────────────┘  │
└─────────────────────────────────┘
```

## 🔧 Configuration

All agent behavior is defined in the AI prompt. To customize:

Edit `buildDecisionPrompt()` in `saleshq-ai-agent.js`:

```javascript
// Change timing rules
// Day 0-2: Send first touch email OR draft for review if high-stakes
// Day 3-7: Follow up if no response, create call task

// Change thresholds
// Never send more than 1 email per 3 days

// Change priorities
// If research behavior detected: Immediate personalized email
```

## 📈 Data Storage

Agent uses localStorage with these keys:
- `bp_agent_states` - Agent status and history per prospect
- `bp_agent_approval_queue` - Pending email drafts

Data structure:
```javascript
{
  "ABC Company": {
    status: "active",
    startedAt: "2026-04-10T...",
    lastActionAt: "2026-04-12T...",
    nextActionAt: "2026-04-15T...",
    actionHistory: [...],
    totalActions: 5
  }
}
```

## 🐛 Troubleshooting

**Agent won't start:**
- Check browser console for errors
- Verify Anthropic API is accessible via Cloudflare Worker
- Ensure prospect has company name

**AI decisions seem wrong:**
- Review agent log to see reasoning
- Adjust prompt in `buildDecisionPrompt()`
- Check that Gong intelligence is being captured

**Approval queue not updating:**
- Refresh page
- Check browser console
- Verify `updateApprovalBadge()` is being called

## 🎨 Customization

### Change Agent Timing
Edit the prompt's DECISION RULES section:
```javascript
1. Day 0-2: Send first touch email
2. Day 3-7: Follow up if no response
// etc.
```

### Add Custom Actions
1. Add new action type to `validActions` array
2. Add executor function (e.g., `executeCustomAction()`)
3. Update AI prompt to include new action
4. Add UI rendering for new action type

### Change UI Colors
Edit the `statusColors` object:
```javascript
const statusColors = {
  active: '#10b981',    // green
  paused: '#f59e0b',    // amber
  waiting_approval: '#3b82f6',  // blue
  error: '#ef4444'      // red
};
```

## ✅ Testing Checklist

After integration:
- [ ] Agent button appears on prospect cards
- [ ] "Start Agent" creates agent state
- [ ] AI makes decision (check console logs)
- [ ] Email drafts appear in approval queue
- [ ] Approval queue badge shows count
- [ ] Can approve/reject drafts
- [ ] Agent log shows action history
- [ ] Can pause/resume/stop agent
- [ ] Status badges update correctly

## 🚢 Deployment

1. Upload `saleshq-ai-agent.js` to your project folder
2. Deploy to Cloudflare Pages:
   ```bash
   wrangler pages deploy . --project-name=beyondpayrollportal
   ```

## 📝 Example Prospect Card Integration

Here's how to integrate agent controls into your existing prospect card rendering:

```javascript
function hqRenderBanner() {
  const p = window._hqProspect;
  if (!p) return;
  
  const html = `
    <div class="prospect-card">
      <!-- Your existing card content -->
      <div class="company-name">${p.company}</div>
      <div class="contact-info">...</div>
      <div class="pain-points">...</div>
      
      <!-- ADD THIS LINE -->
      ${typeof renderAgentControls === 'function' ? renderAgentControls(p) : ''}
      
      <!-- Rest of your card -->
    </div>
  `;
  
  // Render it
}
```

## 🎯 Next Steps

1. **Test with one prospect** - Start agent, let it run, review decisions
2. **Adjust timing** - Modify day rules if needed
3. **Add to more cards** - Integrate into all prospect views
4. **Monitor results** - Check agent logs regularly
5. **Refine prompts** - Improve AI decision quality over time

## 💡 Pro Tips

- Start with drafting mode (high-stakes prospects) before auto-send
- Review agent logs weekly to learn AI decision patterns
- Pause agents when you're manually working a deal
- Use approval queue as a "review before send" workflow
- Agent works best with good Gong intelligence data

---

**Questions?** Check the code comments or console.log outputs for debugging.

**Ready to deploy?** Upload the file and add the HTML snippets above!
