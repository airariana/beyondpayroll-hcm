// ══════════════════════════════════════════════════════════════════════════
//  🤖 SALES HQ - AI SALES AGENT MODULE
// ══════════════════════════════════════════════════════════════════════════
// 
// Automated outreach & follow-up agent that:
// - Analyzes prospect context using AI
// - Decides next best action (send email, draft for review, create task, update notes)
// - Executes actions automatically or queues for approval
// - Tracks agent state and action history
//
// Created: April 12, 2026
// ══════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════
//  API ENDPOINT CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════
// Use Gemini instead of Anthropic - already configured in Sales HQ
const AGENT_API_ENDPOINT = typeof API_ENDPOINTS !== 'undefined' && API_ENDPOINTS.gemini 
  ? API_ENDPOINTS.gemini 
  : 'https://sales-hq-api.ajbb705.workers.dev/api/gemini';

console.log('[Agent] Using API endpoint:', AGENT_API_ENDPOINT);

// ══════════════════════════════════════════════════════════════════════════
//  AGENT STATE MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════

const AGENT_STORAGE_KEY = 'bp_agent_states';
const AGENT_QUEUE_KEY = 'bp_agent_approval_queue';

/**
 * Agent State Structure:
 * {
 *   company: string,              // Prospect company name (unique ID)
 *   status: 'active'|'paused'|'waiting_approval'|'stopped',
 *   startedAt: ISO string,
 *   lastActionAt: ISO string,
 *   nextActionAt: ISO string,
 *   actionHistory: [
 *     {
 *       type: 'email_sent'|'email_drafted'|'task_created'|'notes_updated',
 *       timestamp: ISO string,
 *       details: object,
 *       aiDecision: object
 *     }
 *   ],
 *   totalActions: number
 * }
 */

function getAgentStates() {
  try {
    return JSON.parse(localStorage.getItem(AGENT_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveAgentStates(states) {
  localStorage.setItem(AGENT_STORAGE_KEY, JSON.stringify(states));
}

function getAgentState(company) {
  const states = getAgentStates();
  return states[company] || null;
}

function saveAgentState(company, state) {
  const states = getAgentStates();
  states[company] = state;
  saveAgentStates(states);
}

function deleteAgentState(company) {
  const states = getAgentStates();
  delete states[company];
  saveAgentStates(states);
}

// Approval Queue Management
function getApprovalQueue() {
  try {
    return JSON.parse(localStorage.getItem(AGENT_QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveApprovalQueue(queue) {
  localStorage.setItem(AGENT_QUEUE_KEY, JSON.stringify(queue));
}

function addToApprovalQueue(item) {
  const queue = getApprovalQueue();
  queue.push({
    id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString(),
    ...item
  });
  saveApprovalQueue(queue);
  updateApprovalBadge();
}

function removeFromApprovalQueue(id) {
  const queue = getApprovalQueue();
  const filtered = queue.filter(item => item.id !== id);
  saveApprovalQueue(filtered);
  updateApprovalBadge();
}

function updateApprovalBadge() {
  const queue = getApprovalQueue();
  const badge = document.getElementById('agent-approval-badge');
  if (badge) {
    badge.textContent = queue.length;
    badge.style.display = queue.length > 0 ? 'flex' : 'none';
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  AI DECISION ENGINE
// ══════════════════════════════════════════════════════════════════════════

/**
 * Core AI function that analyzes prospect context and decides next action
 */
async function aiDecideNextAction(prospect) {
  const agentState = getAgentState(prospect.company);
  
  // Build context for AI
  const context = buildProspectContext(prospect, agentState);
  
  // Call Anthropic API via Cloudflare Worker
  const prompt = buildDecisionPrompt(context);
  
  try {
    const response = await fetch(AGENT_API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });
    
    if (!response.ok) {
      throw new Error('AI decision failed: ' + response.status);
    }
    
    const data = await response.json();
    const decision = parseAIDecision(data);
    
    return decision;
    
  } catch (error) {
    console.error('[Agent AI] Decision error:', error);
    throw error;
  }
}

/**
 * Build comprehensive context for AI decision
 */
function buildProspectContext(prospect, agentState) {
  // Get Gong intelligence if available
  const gongIntel = prospect.gongIntelligence || {};
  
  // Get email history
  const emailHistory = getProspectEmailHistory(prospect.company);
  
  // Calculate days since first touch
  const daysSinceStart = agentState ? 
    Math.floor((Date.now() - new Date(agentState.startedAt).getTime()) / (1000 * 60 * 60 * 24)) : 0;
  
  // Get primary contact
  let contactName = 'there';
  if (prospect.contacts && prospect.contacts.length > 0) {
    const primary = prospect.contacts.find(c => c.isPrimary) || prospect.contacts[0];
    contactName = primary.firstName || primary.fullName || 'there';
  } else if (prospect.contact) {
    contactName = prospect.contact.split(' ')[0];
  }
  
  return {
    // Prospect basics
    company: prospect.company || 'Unknown',
    contact: contactName,
    industry: prospect.industry || 'Unknown',
    headcount: prospect.headcount || 'Unknown',
    state: prospect.state || 'Unknown',
    
    // Pain points & intel
    painPoints: prospect.painPoints || [],
    gongIntel: {
      executiveSummary: gongIntel.executiveSummary || {},
      painPointMapping: gongIntel.painPointMapping || [],
      researchBehavior: gongIntel.researchBehavior || {},
      competitiveComparison: gongIntel.competitiveComparison || {}
    },
    
    // Agent state
    daysSinceStart: daysSinceStart,
    lastActionType: agentState?.actionHistory?.[agentState.actionHistory.length - 1]?.type || 'none',
    lastActionDate: agentState?.lastActionAt || null,
    totalActions: agentState?.totalActions || 0,
    actionHistory: agentState?.actionHistory || [],
    
    // Email history
    emailsSent: emailHistory.length,
    lastEmailDate: emailHistory.length > 0 ? emailHistory[emailHistory.length - 1].timestamp : null,
    
    // Product context
    track: window.selectedMITrack || 'TotalSource',
    clientType: prospect.clientType || 'New Prospect'
  };
}

/**
 * Build AI decision prompt
 */
function buildDecisionPrompt(context) {
  return `You are an AI sales agent for ADP working on behalf of AJ, an ADP sales rep. Your job is to analyze the prospect context and decide the next best action.

PROSPECT CONTEXT:
Company: ${context.company}
Contact: ${context.contact}
Industry: ${context.industry}
Headcount: ${context.headcount}
Track: ${context.track}
Client Type: ${context.clientType}

CURRENT STATE:
Days Since Start: ${context.daysSinceStart}
Total Actions Taken: ${context.totalActions}
Last Action: ${context.lastActionType}
Last Action Date: ${context.lastActionDate || 'N/A'}
Emails Sent: ${context.emailsSent}

INTELLIGENCE:
Pain Points: ${context.painPoints.join(', ') || 'None identified'}
Research Behavior: ${JSON.stringify(context.gongIntel.researchBehavior).substring(0, 200)}
Competitive Situation: ${context.gongIntel.executiveSummary?.primaryCompetitor || 'Unknown'}

ACTION HISTORY:
${context.actionHistory.slice(-3).map(a => `- ${a.type} on ${new Date(a.timestamp).toLocaleDateString()}`).join('\n') || 'No previous actions'}

DECISION RULES:
1. Day 0-2: Send first touch email OR draft for review if high-stakes
2. Day 3-7: Follow up if no response, create call task
3. Day 8-14: Research-based outreach if intel shows activity
4. Day 15+: Final touch or pause if no engagement
5. If research behavior detected: Immediate personalized email
6. If high pain points: Prioritize sending vs drafting
7. Never send more than 1 email per 3 days
8. Update notes after every action

AVAILABLE ACTIONS:
- send_email: Auto-send an email (use for low-risk, clear situations)
- draft_email: Draft email for AJ's review (use for high-stakes or complex situations)
- create_task: Create a reminder/task for AJ
- update_notes: Add intelligence to prospect notes
- pause: Wait for more time/signals before next action

OUTPUT FORMAT (JSON only, no markdown):
{
  "action": "send_email" | "draft_email" | "create_task" | "update_notes" | "pause",
  "reasoning": "2-3 sentence explanation of why this action",
  "priority": "high" | "medium" | "low",
  "waitDays": 0-14,
  "emailType": "first_touch" | "follow_up" | "research_pattern" | "competitive" | "final_touch" (if action is send_email or draft_email),
  "taskDescription": "string" (if action is create_task),
  "notesContent": "string" (if action is update_notes),
  "subjectLine": "string" (if action is send_email or draft_email)
}`;
}

/**
 * Parse AI decision response
 */
function parseAIDecision(data) {
  try {
    // Extract text from Gemini response format
    // Gemini returns: { candidates: [{ content: { parts: [{ text: "..." }] } }] }
    let text = '';
    
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      // Gemini format
      text = data.candidates[0].content.parts[0].text;
    } else if (data.content?.[0]?.text) {
      // Anthropic format (fallback)
      text = data.content[0].text;
    } else {
      throw new Error('Could not extract text from AI response');
    }
    
    // Clean up JSON (remove markdown code blocks if present)
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    
    const decision = JSON.parse(cleaned);
    
    // Validate decision
    const validActions = ['send_email', 'draft_email', 'create_task', 'update_notes', 'pause'];
    if (!validActions.includes(decision.action)) {
      throw new Error('Invalid action type: ' + decision.action);
    }
    
    return decision;
    
  } catch (error) {
    console.error('[Agent AI] Parse error:', error);
    console.error('[Agent AI] Raw response:', data);
    // Fallback decision
    return {
      action: 'pause',
      reasoning: 'AI decision parsing failed, pausing for manual review',
      priority: 'low',
      waitDays: 3
    };
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  ACTION EXECUTORS
// ══════════════════════════════════════════════════════════════════════════

/**
 * Execute the AI's decided action
 */
async function executeAgentAction(prospect, decision) {
  const company = prospect.company;
  
  switch (decision.action) {
    case 'send_email':
      return await executeSendEmail(prospect, decision);
      
    case 'draft_email':
      return await executeDraftEmail(prospect, decision);
      
    case 'create_task':
      return executeCreateTask(prospect, decision);
      
    case 'update_notes':
      return executeUpdateNotes(prospect, decision);
      
    case 'pause':
      return executePause(prospect, decision);
      
    default:
      throw new Error('Unknown action: ' + decision.action);
  }
}

/**
 * Send email automatically
 */
async function executeSendEmail(prospect, decision) {
  // Generate email using existing email generation system (if available)
  const gongIntel = prospect.gongIntelligence || {};
  let email;
  
  if (typeof generateEmailFromIntelligence === 'function') {
    email = generateEmailFromIntelligence(
      gongIntel,
      prospect.painPoints || [],
      gongIntel.researchBehavior || {}
    );
  } else {
    // Fallback: create a simple email
    const primaryContact = getPrimaryContact(prospect);
    email = {
      subjectLines: [decision.subjectLine || `Following up - ${prospect.company}`],
      body: `Hi ${primaryContact.firstName || 'there'},\n\nI wanted to follow up regarding ${prospect.company}.\n\nBest,\nAJ`,
      template: 'agent_fallback'
    };
  }
  
  // Override subject line with AI's suggestion
  if (decision.subjectLine) {
    email.subjectLines = [decision.subjectLine];
  }
  
  // Save to email history (safely - check if function exists)
  const primaryContact = getPrimaryContact(prospect);
  try {
    if (typeof saveEmailToHistory === 'function') {
      // Pass the full email object - saveEmailToHistory expects subjectLines array
      saveEmailToHistory(email, primaryContact.email, 'agent_auto');
    } else {
      // Fallback: store in localStorage directly
      const history = JSON.parse(localStorage.getItem('bp_email_history') || '{}');
      if (!history[prospect.company]) history[prospect.company] = [];
      history[prospect.company].push({
        subject: email.subjectLines[0],
        body: email.body,
        template: email.template,
        to: primaryContact.email,
        sentBy: 'agent_auto',
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('bp_email_history', JSON.stringify(history));
    }
  } catch (error) {
    console.warn('[Agent] Could not save email history:', error);
    // Continue anyway - don't block agent execution
  }
  
  // Record action in agent state
  const agentState = getAgentState(prospect.company) || createNewAgentState(prospect.company);
  agentState.actionHistory.push({
    type: 'email_sent',
    timestamp: new Date().toISOString(),
    details: {
      subject: email.subjectLines[0],
      template: email.template,
      emailType: decision.emailType
    },
    aiDecision: decision
  });
  agentState.lastActionAt = new Date().toISOString();
  agentState.nextActionAt = new Date(Date.now() + decision.waitDays * 24 * 60 * 60 * 1000).toISOString();
  agentState.totalActions++;
  saveAgentState(prospect.company, agentState);
  
  return {
    success: true,
    message: `Email sent to ${primaryContact.fullName || primaryContact.email}`,
    email: email
  };
}

/**
 * Draft email for review
 */
async function executeDraftEmail(prospect, decision) {
  // Generate email (safely - check if function exists)
  const gongIntel = prospect.gongIntelligence || {};
  let email;
  
  if (typeof generateEmailFromIntelligence === 'function') {
    email = generateEmailFromIntelligence(
      gongIntel,
      prospect.painPoints || [],
      gongIntel.researchBehavior || {}
    );
  } else {
    // Fallback: create a simple email
    const primaryContact = getPrimaryContact(prospect);
    email = {
      subjectLines: [decision.subjectLine || `Following up - ${prospect.company}`],
      body: `Hi ${primaryContact.firstName || 'there'},\n\nI wanted to follow up regarding ${prospect.company}.\n\nBest,\nAJ`,
      template: 'agent_fallback'
    };
  }
  
  // Override subject line with AI's suggestion
  if (decision.subjectLine) {
    email.subjectLines = [decision.subjectLine];
  }
  
  // Show email draft modal for review/download
  showEmailDraftModal(prospect, email, decision);
  
  // Update agent state
  const agentState = getAgentState(prospect.company) || createNewAgentState(prospect.company);
  agentState.status = 'active'; // Keep active since user handles sending
  agentState.lastActionAt = new Date().toISOString();
  agentState.actionHistory.push({
    type: 'email_drafted',
    timestamp: new Date().toISOString(),
    details: {
      subject: email.subjectLines[0],
      template: email.template
    },
    aiDecision: decision
  });
  agentState.totalActions++;
  saveAgentState(prospect.company, agentState);
  
  return {
    success: true,
    message: 'Email drafted - modal shown for review',
    email: email
  };
}

/**
 * Create task/reminder
 */
function executeCreateTask(prospect, decision) {
  const task = {
    company: prospect.company,
    description: decision.taskDescription,
    createdBy: 'agent',
    createdAt: new Date().toISOString(),
    priority: decision.priority
  };
  
  // Add to prospect notes as a task
  const currentNotes = prospect.notes || '';
  prospect.notes = `${currentNotes}\n\n🤖 AGENT TASK [${new Date().toLocaleDateString()}]: ${decision.taskDescription}`;
  
  // Update agent state
  const agentState = getAgentState(prospect.company) || createNewAgentState(prospect.company);
  agentState.actionHistory.push({
    type: 'task_created',
    timestamp: new Date().toISOString(),
    details: task,
    aiDecision: decision
  });
  agentState.lastActionAt = new Date().toISOString();
  agentState.nextActionAt = new Date(Date.now() + decision.waitDays * 24 * 60 * 60 * 1000).toISOString();
  agentState.totalActions++;
  saveAgentState(prospect.company, agentState);
  
  // Save prospect
  saveProspectChanges(prospect);
  
  return {
    success: true,
    message: 'Task created',
    task: task
  };
}

/**
 * Update prospect notes
 */
function executeUpdateNotes(prospect, decision) {
  const currentNotes = prospect.notes || '';
  const timestamp = new Date().toLocaleDateString();
  prospect.notes = `${currentNotes}\n\n🤖 AGENT UPDATE [${timestamp}]: ${decision.notesContent}`;
  
  // Update agent state
  const agentState = getAgentState(prospect.company) || createNewAgentState(prospect.company);
  agentState.actionHistory.push({
    type: 'notes_updated',
    timestamp: new Date().toISOString(),
    details: { content: decision.notesContent },
    aiDecision: decision
  });
  agentState.lastActionAt = new Date().toISOString();
  agentState.nextActionAt = new Date(Date.now() + decision.waitDays * 24 * 60 * 60 * 1000).toISOString();
  agentState.totalActions++;
  saveAgentState(prospect.company, agentState);
  
  // Save prospect
  saveProspectChanges(prospect);
  
  return {
    success: true,
    message: 'Notes updated',
    content: decision.notesContent
  };
}

/**
 * Pause agent
 */
function executePause(prospect, decision) {
  const agentState = getAgentState(prospect.company);
  if (agentState) {
    agentState.status = 'paused';
    agentState.nextActionAt = new Date(Date.now() + decision.waitDays * 24 * 60 * 60 * 1000).toISOString();
    saveAgentState(prospect.company, agentState);
  }
  
  return {
    success: true,
    message: `Agent paused for ${decision.waitDays} days`,
    reason: decision.reasoning
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════

function createNewAgentState(company) {
  return {
    company: company,
    status: 'active',
    startedAt: new Date().toISOString(),
    lastActionAt: null,
    nextActionAt: new Date().toISOString(),
    actionHistory: [],
    totalActions: 0
  };
}

function getPrimaryContact(prospect) {
  if (prospect.contacts && prospect.contacts.length > 0) {
    const primary = prospect.contacts.find(c => c.isPrimary) || prospect.contacts[0];
    return {
      fullName: [primary.firstName, primary.lastName].filter(Boolean).join(' ') || primary.fullName || 'Contact',
      email: primary.email || '',
      firstName: primary.firstName || ''
    };
  }
  return {
    fullName: prospect.contact || 'Contact',
    email: prospect.email || '',
    firstName: prospect.contact ? prospect.contact.split(' ')[0] : ''
  };
}

function getProspectEmailHistory(company) {
  // This would integrate with your existing email history system
  // For now, return empty array
  try {
    const history = JSON.parse(localStorage.getItem('bp_email_history') || '{}');
    return history[company] || [];
  } catch {
    return [];
  }
}

function saveProspectChanges(prospect) {
  // Save to localStorage
  const prospects = getProspects();
  const idx = prospects.findIndex(p => p.company === prospect.company);
  if (idx >= 0) {
    prospects[idx] = prospect;
  } else {
    prospects.push(prospect);
  }
  saveProspectsLocal(prospects);
  
  // Update current prospect if it's the one being edited
  if (window._hqProspect && window._hqProspect.company === prospect.company) {
    window._hqProspect = prospect;
  }
  
  // Firebase sync if available
  if (typeof fbSaveProspect === 'function') {
    fbSaveProspect(prospect);
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  MAIN AGENT CONTROLLER
// ══════════════════════════════════════════════════════════════════════════

/**
 * Start agent for a prospect (called when user clicks "Start Agent")
 */
async function startAgent(company) {
  try {
    // Get prospect
    const prospects = getProspects();
    const prospect = prospects.find(p => p.company === company);
    
    if (!prospect) {
      throw new Error('Prospect not found');
    }
    
    // Create or update agent state
    let agentState = getAgentState(company);
    if (!agentState) {
      agentState = createNewAgentState(company);
      saveAgentState(company, agentState);
    } else {
      agentState.status = 'active';
      agentState.nextActionAt = new Date().toISOString();
      saveAgentState(company, agentState);
    }
    
    // Show progress indicator
    showToast('🤖 Agent starting...', false);
    
    // Run agent
    await runAgent(prospect);
    
  } catch (error) {
    console.error('[Agent] Start error:', error);
    showToast('Agent failed: ' + error.message, true);
  }
}

/**
 * Run agent decision cycle
 */
async function runAgent(prospect) {
  const company = prospect.company;
  const agentState = getAgentState(company);
  
  if (!agentState || agentState.status !== 'active') {
    return;
  }
  
  try {
    // Update UI to show "thinking"
    updateAgentUI(company, 'Analyzing...');
    
    // AI decides next action
    const decision = await aiDecideNextAction(prospect);
    
    // Execute action
    const result = await executeAgentAction(prospect, decision);
    
    // Update UI
    const message = `${decision.action.replace('_', ' ')}: ${result.message}`;
    updateAgentUI(company, message);
    showToast('🤖 Agent: ' + message, false);
    
    // Refresh prospect card if visible
    if (typeof hqRenderBanner === 'function') {
      hqRenderBanner();
    }
    
  } catch (error) {
    console.error('[Agent] Run error:', error);
    
    // Mark agent as errored
    agentState.status = 'error';
    agentState.lastError = error.message;
    saveAgentState(company, agentState);
    
    updateAgentUI(company, 'Error: ' + error.message);
    showToast('🤖 Agent error: ' + error.message, true);
  }
}

/**
 * Pause agent
 */
function pauseAgent(company) {
  const agentState = getAgentState(company);
  if (agentState) {
    agentState.status = 'paused';
    saveAgentState(company, agentState);
    updateAgentUI(company, 'Paused');
    showToast('Agent paused', false);
  }
}

/**
 * Stop agent completely
 */
function stopAgent(company) {
  deleteAgentState(company);
  updateAgentUI(company, null);
  showToast('Agent stopped', false);
}

/**
 * Update agent UI on prospect card
 */
function updateAgentUI(company, statusText) {
  const badge = document.querySelector(`[data-agent-company="${company}"]`);
  if (badge) {
    if (statusText) {
      badge.textContent = statusText;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  UI COMPONENTS
// ══════════════════════════════════════════════════════════════════════════

/**
 * Render agent controls in prospect card
 */
function renderAgentControls(prospect) {
  const company = prospect.company;
  const agentState = getAgentState(company);
  
  if (!agentState) {
    // Not started - show start button
    return `
      <div class="agent-controls" style="margin-top:8px;padding:8px;background:var(--off-white);border-radius:6px;border-left:3px solid #8b5cf6">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="font-size:11px;font-weight:700;color:var(--text)">🤖 AI Sales Agent</span>
          <span style="font-size:9px;color:var(--text-2);font-style:italic">Not started</span>
        </div>
        <button onclick="startAgent('${company}')" style="font-size:10px;padding:6px 12px;background:#8b5cf6;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600;width:100%">
          Start Agent
        </button>
      </div>
    `;
  }
  
  // Active agent - show status and controls
  const statusColors = {
    active: '#10b981',
    paused: '#f59e0b',
    waiting_approval: '#3b82f6',
    error: '#ef4444'
  };
  
  const statusLabels = {
    active: '● Active',
    paused: '⏸ Paused',
    waiting_approval: '⏳ Waiting Approval',
    error: '⚠ Error'
  };
  
  const lastAction = agentState.actionHistory[agentState.actionHistory.length - 1];
  const nextActionDate = agentState.nextActionAt ? new Date(agentState.nextActionAt).toLocaleDateString() : 'N/A';
  
  return `
    <div class="agent-controls" style="margin-top:8px;padding:8px;background:var(--off-white);border-radius:6px;border-left:3px solid ${statusColors[agentState.status] || '#8b5cf6'}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:11px;font-weight:700;color:var(--text)">🤖 AI Agent</span>
          <span data-agent-company="${company}" style="font-size:9px;color:${statusColors[agentState.status]};font-weight:600">${statusLabels[agentState.status]}</span>
        </div>
        <button onclick="showAgentLog('${company}')" style="font-size:9px;padding:3px 8px;background:transparent;color:var(--text-2);border:1px solid var(--border);border-radius:3px;cursor:pointer">
          Log
        </button>
      </div>
      
      <div style="font-size:9px;color:var(--text-2);margin-bottom:8px">
        <div>Actions: ${agentState.totalActions} | Next: ${nextActionDate}</div>
        ${lastAction ? `<div style="margin-top:2px;font-style:italic">Last: ${lastAction.type.replace('_', ' ')}</div>` : ''}
      </div>
      
      <div style="display:flex;gap:6px">
        ${agentState.status === 'active' ? `
          <button onclick="pauseAgent('${company}')" style="flex:1;font-size:9px;padding:5px;background:#f59e0b;color:#fff;border:none;border-radius:3px;cursor:pointer;font-weight:600">
            Pause
          </button>
        ` : agentState.status === 'paused' ? `
          <button onclick="startAgent('${company}')" style="flex:1;font-size:9px;padding:5px;background:#10b981;color:#fff;border:none;border-radius:3px;cursor:pointer;font-weight:600">
            Resume
          </button>
        ` : ''}
        <button onclick="stopAgent('${company}')" style="flex:1;font-size:9px;padding:5px;background:#ef4444;color:#fff;border:none;border-radius:3px;cursor:pointer;font-weight:600">
          Stop
        </button>
      </div>
    </div>
  `;
}

/**
 * Show agent action log modal
 */
function showAgentLog(company) {
  const agentState = getAgentState(company);
  if (!agentState) return;
  
  const actionIcons = {
    email_sent: '📧',
    email_drafted: '✏️',
    task_created: '✅',
    notes_updated: '📝'
  };
  
  const html = `
    <div class="eec-modal-overlay" onclick="this.remove()">
      <div class="eec-modal" onclick="event.stopPropagation()" style="max-width:700px">
        <div class="eec-modal-header">
          <span class="eec-modal-title">🤖 Agent Log: ${company}</span>
          <button class="eec-modal-close" onclick="this.closest('.eec-modal-overlay').remove()">×</button>
        </div>
        <div class="eec-modal-body">
          <div style="margin-bottom:16px;padding:12px;background:var(--off-white);border-radius:6px">
            <div style="font-size:11px;font-weight:600;color:var(--text);margin-bottom:6px">Agent Stats</div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;font-size:10px">
              <div>
                <div style="color:var(--text-2)">Started</div>
                <div style="font-weight:600;color:var(--text)">${new Date(agentState.startedAt).toLocaleDateString()}</div>
              </div>
              <div>
                <div style="color:var(--text-2)">Total Actions</div>
                <div style="font-weight:600;color:var(--text)">${agentState.totalActions}</div>
              </div>
              <div>
                <div style="color:var(--text-2)">Next Action</div>
                <div style="font-weight:600;color:var(--text)">${agentState.nextActionAt ? new Date(agentState.nextActionAt).toLocaleDateString() : 'N/A'}</div>
              </div>
            </div>
          </div>
          
          <div style="font-size:11px;font-weight:600;color:var(--text);margin-bottom:8px">Action History</div>
          <div style="max-height:400px;overflow-y:auto">
            ${agentState.actionHistory.length === 0 ? 
              '<div style="text-align:center;padding:20px;color:var(--text-2);font-size:10px">No actions yet</div>' :
              agentState.actionHistory.slice().reverse().map(action => `
                <div style="padding:10px;background:var(--white);border:1px solid var(--border);border-radius:5px;margin-bottom:8px">
                  <div style="display:flex;align-items:center;justify-content:between;margin-bottom:6px">
                    <div style="display:flex;align-items:center;gap:6px">
                      <span style="font-size:14px">${actionIcons[action.type] || '🤖'}</span>
                      <span style="font-size:10px;font-weight:600;color:var(--text)">${action.type.replace('_', ' ').toUpperCase()}</span>
                    </div>
                    <span style="font-size:9px;color:var(--text-2)">${new Date(action.timestamp).toLocaleString()}</span>
                  </div>
                  
                  ${action.aiDecision ? `
                    <div style="font-size:9px;color:var(--text-2);margin-bottom:4px;font-style:italic">
                      AI Reasoning: ${action.aiDecision.reasoning}
                    </div>
                  ` : ''}
                  
                  <div style="font-size:9px;color:var(--text);background:var(--off-white);padding:6px;border-radius:3px">
                    ${JSON.stringify(action.details, null, 2).replace(/[{}"]/g, '').split('\n').join('<br>')}
                  </div>
                </div>
              `).join('')
            }
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', html);
}

/**
 * Show approval queue panel
 */
function showApprovalQueue() {
  const queue = getApprovalQueue();
  
  const html = `
    <div class="eec-modal-overlay" onclick="this.remove()">
      <div class="eec-modal eec-modal-large" onclick="event.stopPropagation()">
        <div class="eec-modal-header">
          <span class="eec-modal-title">📋 Agent Approval Queue (${queue.length})</span>
          <button class="eec-modal-close" onclick="this.closest('.eec-modal-overlay').remove()">×</button>
        </div>
        <div class="eec-modal-body">
          ${queue.length === 0 ? 
            '<div style="text-align:center;padding:40px;color:var(--text-2);font-size:12px">No items pending approval</div>' :
            queue.map(item => `
              <div style="padding:16px;background:var(--white);border:1px solid var(--border);border-radius:6px;margin-bottom:12px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                  <div>
                    <div style="font-size:12px;font-weight:700;color:var(--text)">${item.company}</div>
                    <div style="font-size:9px;color:var(--text-2)">To: ${item.contact.fullName} (${item.contact.email})</div>
                  </div>
                  <div style="font-size:9px;color:var(--text-2)">${new Date(item.timestamp).toLocaleString()}</div>
                </div>
                
                ${item.aiDecision ? `
                  <div style="padding:8px;background:#eff6ff;border-left:3px solid #3b82f6;margin-bottom:12px;border-radius:4px">
                    <div style="font-size:9px;font-weight:600;color:#1e40af;margin-bottom:4px">🤖 AI Recommendation</div>
                    <div style="font-size:9px;color:var(--text-2);font-style:italic">${item.aiDecision.reasoning}</div>
                  </div>
                ` : ''}
                
                <div style="margin-bottom:12px">
                  <div style="font-size:10px;font-weight:600;color:var(--text);margin-bottom:4px">Subject:</div>
                  <div style="font-size:10px;color:var(--text);padding:6px;background:var(--off-white);border-radius:4px">
                    ${item.email.subjectLines[0]}
                  </div>
                </div>
                
                <div style="margin-bottom:12px">
                  <div style="font-size:10px;font-weight:600;color:var(--text);margin-bottom:4px">Body:</div>
                  <div style="font-size:9px;color:var(--text);padding:10px;background:var(--off-white);border-radius:4px;max-height:150px;overflow-y:auto;white-space:pre-wrap">
                    ${item.email.body}
                  </div>
                </div>
                
                <div style="display:flex;gap:8px">
                  <button onclick="approveAndSendEmail('${item.id}')" style="flex:1;font-size:10px;padding:8px;background:#10b981;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600">
                    ✓ Approve & Send
                  </button>
                  <button onclick="editDraftEmail('${item.id}')" style="flex:1;font-size:10px;padding:8px;background:#3b82f6;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600">
                    ✏️ Edit
                  </button>
                  <button onclick="rejectDraft('${item.id}')" style="flex:1;font-size:10px;padding:8px;background:#ef4444;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:600">
                    ✕ Reject
                  </button>
                </div>
              </div>
            `).join('')
          }
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', html);
}

/**
 * Approve and send email from queue
 */
function approveAndSendEmail(itemId) {
  const queue = getApprovalQueue();
  const item = queue.find(i => i.id === itemId);
  
  if (!item) return;
  
  // Save to email history
  saveEmailToHistory({
    subject: item.email.subjectLines[0],
    body: item.email.body,
    template: item.email.template
  }, item.contact.email, 'agent_approved');
  
  // Update agent state
  const agentState = getAgentState(item.company);
  if (agentState) {
    agentState.status = 'active';
    agentState.actionHistory.push({
      type: 'email_sent',
      timestamp: new Date().toISOString(),
      details: {
        subject: item.email.subjectLines[0],
        template: item.email.template,
        approvedBy: 'user'
      },
      aiDecision: item.aiDecision
    });
    agentState.lastActionAt = new Date().toISOString();
    agentState.nextActionAt = new Date(Date.now() + (item.aiDecision?.waitDays || 3) * 24 * 60 * 60 * 1000).toISOString();
    agentState.totalActions++;
    saveAgentState(item.company, agentState);
  }
  
  // Remove from queue
  removeFromApprovalQueue(itemId);
  
  // Close modal and show success
  document.querySelector('.eec-modal-overlay')?.remove();
  showToast('✓ Email approved and sent', false);
}

/**
 * Reject draft
 */
function rejectDraft(itemId) {
  const queue = getApprovalQueue();
  const item = queue.find(i => i.id === itemId);
  
  if (!item) return;
  
  // Update agent state to paused
  const agentState = getAgentState(item.company);
  if (agentState) {
    agentState.status = 'paused';
    saveAgentState(item.company, agentState);
  }
  
  // Remove from queue
  removeFromApprovalQueue(itemId);
  
  // Close modal
  document.querySelector('.eec-modal-overlay')?.remove();
  showToast('Draft rejected - agent paused', false);
}

/**
 * Edit draft email
 */
function editDraftEmail(itemId) {
  // This would open the email in your existing email composer
  // For now, just show a message
  showToast('Email composer integration coming soon', false);
}

// ══════════════════════════════════════════════════════════════════════════
//  EMAIL DRAFT MODAL (TEXT FILE DOWNLOAD)
// ══════════════════════════════════════════════════════════════════════════

/**
 * Show email draft modal with copy/download options
 */
function showEmailDraftModal(prospect, email, aiDecision) {
  const primaryContact = getPrimaryContact(prospect);
  const timestamp = new Date().toISOString();
  const dateStr = new Date().toLocaleString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true 
  });
  
  // Format email as text file content
  const textContent = `TO: ${primaryContact.email}
FROM: AJ (your-email@adp.com)
SUBJECT: ${email.subjectLines[0]}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${email.body}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generated by AI Sales Agent
Date: ${dateStr}
Prospect: ${prospect.company}
Contact: ${primaryContact.fullName || primaryContact.firstName || 'Unknown'}
Template: ${email.template}
AI Priority: ${aiDecision.priority || 'Normal'}
AI Reasoning: ${aiDecision.reasoning || 'N/A'}
`;

  // Create modal HTML
  const modalHTML = `
    <div id="emailDraftModal" style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 20px;
    ">
      <div style="
        background: white;
        border-radius: 12px;
        max-width: 700px;
        width: 100%;
        max-height: 90vh;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        display: flex;
        flex-direction: column;
      ">
        <!-- Header -->
        <div style="
          padding: 24px;
          border-bottom: 1px solid #e5e7eb;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        ">
          <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 600;">
            📧 Email Draft Ready
          </h2>
          <p style="margin: 0; opacity: 0.9; font-size: 14px;">
            ${prospect.company} • ${primaryContact.fullName || primaryContact.email}
          </p>
        </div>
        
        <!-- Email Preview -->
        <div style="
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          background: #f9fafb;
        ">
          <div style="
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 20px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            line-height: 1.6;
            white-space: pre-wrap;
            color: #1f2937;
          " id="emailDraftContent">${textContent}</div>
        </div>
        
        <!-- Actions -->
        <div style="
          padding: 20px 24px;
          border-top: 1px solid #e5e7eb;
          background: white;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        ">
          <button onclick="copyDraftToClipboard()" style="
            flex: 1;
            min-width: 140px;
            padding: 12px 20px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
          " onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">
            📋 Copy Email
          </button>
          
          <button onclick="downloadDraftAsText('${prospect.company.replace(/'/g, "\\'")}', '${timestamp}')" style="
            flex: 1;
            min-width: 140px;
            padding: 12px 20px;
            background: #10b981;
            color: white;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
          " onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">
            💾 Download .txt
          </button>
          
          <button onclick="markDraftAsSent('${prospect.company.replace(/'/g, "\\'")}', '${primaryContact.email.replace(/'/g, "\\'")}', '${email.template.replace(/'/g, "\\'")}')" style="
            flex: 1;
            min-width: 140px;
            padding: 12px 20px;
            background: #8b5cf6;
            color: white;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
          " onmouseover="this.style.background='#7c3aed'" onmouseout="this.style.background='#8b5cf6'">
            ✅ Mark as Sent
          </button>
          
          <button onclick="closeDraftModal()" style="
            padding: 12px 20px;
            background: #6b7280;
            color: white;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
          " onmouseover="this.style.background='#4b5563'" onmouseout="this.style.background='#6b7280'">
            Close
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Remove existing modal if any
  const existingModal = document.getElementById('emailDraftModal');
  if (existingModal) existingModal.remove();
  
  // Add modal to page
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  console.log('[Agent] Email draft modal shown');
}

/**
 * Copy draft email to clipboard
 */
function copyDraftToClipboard() {
  const content = document.getElementById('emailDraftContent');
  if (!content) return;
  
  navigator.clipboard.writeText(content.textContent).then(() => {
    showToast('✓ Email copied to clipboard!', true);
  }).catch(err => {
    console.error('[Agent] Copy failed:', err);
    showToast('❌ Copy failed - try again', false);
  });
}

/**
 * Download draft as .txt file
 */
function downloadDraftAsText(companyName, timestamp) {
  const content = document.getElementById('emailDraftContent');
  if (!content) return;
  
  // Create filename: CompanyName_2026-04-13_1045.txt
  const date = new Date(timestamp);
  const filename = `${companyName.replace(/[^a-z0-9]/gi, '_')}_${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}_${String(date.getHours()).padStart(2,'0')}${String(date.getMinutes()).padStart(2,'0')}.txt`;
  
  // Create blob and download
  const blob = new Blob([content.textContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showToast(`✓ Downloaded ${filename}`, true);
  console.log('[Agent] Draft downloaded:', filename);
}

/**
 * Mark draft as sent (track in agent history)
 */
function markDraftAsSent(company, email, template) {
  // Update agent state to record email as sent
  const agentState = getAgentState(company);
  if (agentState) {
    agentState.actionHistory.push({
      type: 'email_sent_manually',
      timestamp: new Date().toISOString(),
      details: {
        email: email,
        template: template,
        sentVia: 'manual_after_draft'
      }
    });
    agentState.lastActionAt = new Date().toISOString();
    agentState.totalActions++;
    saveAgentState(company, agentState);
  }
  
  showToast('✓ Marked as sent - logged in agent history', true);
  closeDraftModal();
  
  // Refresh agent controls if render function exists
  if (typeof hqRenderBanner === 'function') {
    hqRenderBanner();
  }
}

/**
 * Close draft modal
 */
function closeDraftModal() {
  const modal = document.getElementById('emailDraftModal');
  if (modal) modal.remove();
}

// ══════════════════════════════════════════════════════════════════════════
//  INITIALIZATION
// ══════════════════════════════════════════════════════════════════════════

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  updateApprovalBadge();
});

// Expose functions globally
window.startAgent = startAgent;
window.pauseAgent = pauseAgent;
window.stopAgent = stopAgent;
window.showAgentLog = showAgentLog;
window.showApprovalQueue = showApprovalQueue;
window.approveAndSendEmail = approveAndSendEmail;
window.rejectDraft = rejectDraft;
window.editDraftEmail = editDraftEmail;
window.renderAgentControls = renderAgentControls;
window.showEmailDraftModal = showEmailDraftModal;
window.copyDraftToClipboard = copyDraftToClipboard;
window.downloadDraftAsText = downloadDraftAsText;
window.markDraftAsSent = markDraftAsSent;
window.closeDraftModal = closeDraftModal;

console.log('[AI Agent] Module loaded ✓');
