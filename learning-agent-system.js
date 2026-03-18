/* ════════════════════════════════════════════════════════════════════
   BACKGROUND LEARNING AGENT - COWORK INTEGRATION
   
   An AI agent that:
   1. Observes your actions in Sales HQ in real-time
   2. Learns your patterns, workflows, and preferences
   3. Builds a knowledge base of your work style
   4. Can execute tasks autonomously in Cowork when launched
   
   Examples of what it learns:
   - How you structure emails for different prospect types
   - Your preferred cadence timing and sequencing
   - Which competitive intel you reference most
   - Your typical follow-up patterns
   - Data entry patterns (how you fill prospect profiles)
   
   Cowork Integration:
   - Launches as an autonomous agent
   - Can complete tasks based on learned patterns
   - Asks for clarification when uncertain
   - Reports back on completed actions
════════════════════════════════════════════════════════════════════ */

// ══════════════════════════════════════════════════════════════════════
// AGENT KNOWLEDGE BASE STRUCTURE
// ══════════════════════════════════════════════════════════════════════

const AGENT_KNOWLEDGE_KEY = 'bp_agent_knowledge';

const AgentKnowledge = {
  // Email patterns
  emailPatterns: {
    subject_lines: {},        // Track successful subject line patterns
    opening_lines: {},        // Common opening hooks by industry/persona
    closing_lines: {},        // Signature closes
    cadence_timing: {},       // Preferred days/times for each touch
    tone_by_prospect: {},     // Aggressive/Consultative/Nurture by company type
    follow_up_triggers: {}    // What triggers you to follow up
  },
  
  // Prospect qualification patterns
  qualificationPatterns: {
    high_priority_signals: [],    // What makes you prioritize a prospect
    disqualification_signals: [], // What makes you deprioritize
    ideal_customer_profile: {},   // Characteristics of best-fit prospects
    timing_indicators: {},        // What signals "ready to buy" vs "nurture"
  },
  
  // Workflow patterns
  workflowPatterns: {
    daily_routine: [],            // Time-of-day activity patterns
    task_sequences: [],           // Common task chains (e.g., always run intel after adding prospect)
    tool_preferences: {},         // Which tools you use for what
    shortcuts: {},                // Custom shortcuts and quick actions you use
    batch_patterns: []            // When you batch similar tasks
  },
  
  // Data entry patterns
  dataPatterns: {
    field_defaults: {},           // Common values you enter (e.g., always pick "Professional Services")
    required_fields: [],          // Which fields you always fill vs skip
    enrichment_sources: {},       // Where you pull data from (LinkedIn, company site, etc.)
    notation_style: {}            // How you format notes, tags, etc.
  },
  
  // Competitive intel patterns
  intelPatterns: {
    common_competitors: {},       // Which competitors come up most by industry
    go_to_talking_points: {},    // Your favorite counter-positions
    objection_handling: {},       // How you handle common objections
    case_study_usage: {}          // Which case studies you reference when
  },
  
  // Content patterns
  contentPatterns: {
    resource_library: [],         // Which resources you share most
    content_by_stage: {},         // What content for what buyer stage
    attachment_preferences: {},   // PDF vs link, when to attach
    personalization_level: {}     // How much you customize by prospect
  },
  
  // Meeting patterns
  meetingPatterns: {
    prep_checklist: [],           // What you do before calls
    discovery_questions: [],      // Your go-to questions
    demo_flow: [],                // Typical demo sequence
    next_steps: {}                // Standard next steps by meeting type
  },
  
  // Metadata
  metadata: {
    learning_since: null,         // When agent started learning
    total_actions_observed: 0,    // Number of actions tracked
    last_updated: null,           // Last learning event
    confidence_score: 0,          // 0-100, how confident agent is
    cowork_launches: 0            // How many times launched to Cowork
  }
};

// ══════════════════════════════════════════════════════════════════════
// LEARNING FUNCTIONS - Real-time observation
// ══════════════════════════════════════════════════════════════════════

/**
 * Initialize the learning agent
 */
window.initLearningAgent = function() {
  // Load existing knowledge
  try {
    const stored = localStorage.getItem(AGENT_KNOWLEDGE_KEY);
    if (stored) {
      Object.assign(AgentKnowledge, JSON.parse(stored));
    } else {
      // First time - set metadata
      AgentKnowledge.metadata.learning_since = new Date().toISOString();
      saveAgentKnowledge();
    }
  } catch (e) {
    console.error('Error loading agent knowledge:', e);
  }
  
  // Start observing
  startObserving();
  
  console.log('🤖 Learning Agent initialized');
  console.log('  Learning since:', AgentKnowledge.metadata.learning_since);
  console.log('  Actions observed:', AgentKnowledge.metadata.total_actions_observed);
  console.log('  Confidence:', AgentKnowledge.metadata.confidence_score + '%');
};

/**
 * Save knowledge to localStorage
 */
function saveAgentKnowledge() {
  AgentKnowledge.metadata.last_updated = new Date().toISOString();
  localStorage.setItem(AGENT_KNOWLEDGE_KEY, JSON.stringify(AgentKnowledge));
}

/**
 * Start observing user actions
 */
function startObserving() {
  // Observe email composition
  observeEmailActions();
  
  // Observe prospect actions
  observeProspectActions();
  
  // Observe tool usage
  observeToolUsage();
  
  // Observe timing patterns
  observeTimingPatterns();
  
  console.log('👁 Agent observing your actions...');
}

// ══════════════════════════════════════════════════════════════════════
// OBSERVATION MODULES
// ══════════════════════════════════════════════════════════════════════

/**
 * Observe email composition patterns
 */
function observeEmailActions() {
  // Intercept ecMarkSent (when you mark an email as sent)
  const originalMarkSent = window.ecMarkSent;
  if (originalMarkSent) {
    window.ecMarkSent = function() {
      // Capture the email that was just sent
      const prospect = window._hqProspect;
      const touchIdx = window._ecActiveIdx;
      
      if (prospect && touchIdx !== undefined) {
        const touches = buildTouches(prospect);
        const touch = touches[touchIdx];
        
        if (touch) {
          // Learn subject line pattern
          learnSubjectLine(touch.subject, prospect.industry, touch.day);
          
          // Learn cadence timing
          learnCadenceTiming(touch.day, new Date().getHours());
          
          // Learn tone preference
          learnTonePreference(prospect.track, _sreCadenceTone);
        }
      }
      
      // Call original
      return originalMarkSent.apply(this, arguments);
    };
  }
}

/**
 * Observe prospect management patterns
 */
function observeProspectActions() {
  // Intercept saveProspect
  const originalSave = window.saveProspect;
  if (originalSave) {
    window.saveProspect = function() {
      const prospect = window._hqProspect;
      
      if (prospect) {
        // Learn field completion patterns
        learnFieldPatterns(prospect);
        
        // Learn qualification patterns
        learnQualificationSignals(prospect);
      }
      
      // Call original
      return originalSave.apply(this, arguments);
    };
  }
}

/**
 * Observe tool usage patterns
 */
function observeToolUsage() {
  // Track which tools are used when
  ['atRunAnalysis', 'sreRunWFN', 'sreRunTS', 'cdtRunIntelRefresh'].forEach(function(toolName) {
    const original = window[toolName];
    if (original) {
      window[toolName] = function() {
        // Log tool usage
        logToolUsage(toolName, new Date().getHours());
        
        // Call original
        return original.apply(this, arguments);
      };
    }
  });
}

/**
 * Observe timing patterns (when you work)
 */
function observeTimingPatterns() {
  // Track active hours
  setInterval(function() {
    const hour = new Date().getHours();
    const day = new Date().getDay();
    
    // Increment activity counter for this hour/day combo
    const key = day + '_' + hour;
    if (!AgentKnowledge.workflowPatterns.daily_routine[key]) {
      AgentKnowledge.workflowPatterns.daily_routine[key] = 0;
    }
    AgentKnowledge.workflowPatterns.daily_routine[key]++;
    
    // Save every 10 minutes
    if (Math.random() < 0.1) saveAgentKnowledge();
  }, 600000); // 10 minutes
}

// ══════════════════════════════════════════════════════════════════════
// LEARNING FUNCTIONS - Pattern extraction
// ══════════════════════════════════════════════════════════════════════

function learnSubjectLine(subject, industry, touchDay) {
  const key = industry + '_day' + touchDay;
  if (!AgentKnowledge.emailPatterns.subject_lines[key]) {
    AgentKnowledge.emailPatterns.subject_lines[key] = [];
  }
  AgentKnowledge.emailPatterns.subject_lines[key].push(subject);
  
  AgentKnowledge.metadata.total_actions_observed++;
  updateConfidenceScore();
}

function learnCadenceTiming(touchDay, hour) {
  const key = 'day' + touchDay;
  if (!AgentKnowledge.emailPatterns.cadence_timing[key]) {
    AgentKnowledge.emailPatterns.cadence_timing[key] = [];
  }
  AgentKnowledge.emailPatterns.cadence_timing[key].push(hour);
  
  AgentKnowledge.metadata.total_actions_observed++;
}

function learnTonePreference(track, tone) {
  if (!AgentKnowledge.emailPatterns.tone_by_prospect[track]) {
    AgentKnowledge.emailPatterns.tone_by_prospect[track] = {};
  }
  if (!AgentKnowledge.emailPatterns.tone_by_prospect[track][tone]) {
    AgentKnowledge.emailPatterns.tone_by_prospect[track][tone] = 0;
  }
  AgentKnowledge.emailPatterns.tone_by_prospect[track][tone]++;
  
  AgentKnowledge.metadata.total_actions_observed++;
}

function learnFieldPatterns(prospect) {
  // Track which fields are always filled
  const fields = ['industry', 'headcount', 'state', 'persona', 'track', 'painPoints'];
  
  fields.forEach(function(field) {
    if (prospect[field] && prospect[field] !== '') {
      if (!AgentKnowledge.dataPatterns.field_defaults[field]) {
        AgentKnowledge.dataPatterns.field_defaults[field] = {};
      }
      const value = Array.isArray(prospect[field]) ? prospect[field].join(',') : prospect[field];
      if (!AgentKnowledge.dataPatterns.field_defaults[field][value]) {
        AgentKnowledge.dataPatterns.field_defaults[field][value] = 0;
      }
      AgentKnowledge.dataPatterns.field_defaults[field][value]++;
    }
  });
  
  AgentKnowledge.metadata.total_actions_observed++;
}

function learnQualificationSignals(prospect) {
  // If prospect was marked as active/high priority
  if (prospect.approved || prospect.priority === 'high') {
    // Extract signals
    const signals = {
      industry: prospect.industry,
      headcount: prospect.headcount,
      track: prospect.track,
      painPoints: prospect.painPoints
    };
    
    AgentKnowledge.qualificationPatterns.high_priority_signals.push(signals);
  }
  
  AgentKnowledge.metadata.total_actions_observed++;
}

function logToolUsage(toolName, hour) {
  if (!AgentKnowledge.workflowPatterns.tool_preferences[toolName]) {
    AgentKnowledge.workflowPatterns.tool_preferences[toolName] = {
      count: 0,
      hours: []
    };
  }
  
  AgentKnowledge.workflowPatterns.tool_preferences[toolName].count++;
  AgentKnowledge.workflowPatterns.tool_preferences[toolName].hours.push(hour);
  
  AgentKnowledge.metadata.total_actions_observed++;
}

function updateConfidenceScore() {
  // Confidence increases with more observations
  const actions = AgentKnowledge.metadata.total_actions_observed;
  
  let score = 0;
  if (actions > 10) score = 20;
  if (actions > 50) score = 40;
  if (actions > 100) score = 60;
  if (actions > 250) score = 80;
  if (actions > 500) score = 95;
  
  AgentKnowledge.metadata.confidence_score = score;
}

// ══════════════════════════════════════════════════════════════════════
// COWORK INTEGRATION - Launch agent to complete tasks
// ══════════════════════════════════════════════════════════════════════

/**
 * Launch agent to Cowork with learned knowledge
 */
window.launchToCowork = function(task) {
  if (AgentKnowledge.metadata.confidence_score < 40) {
    if (!confirm('Agent confidence is low (' + AgentKnowledge.metadata.confidence_score + '%). Launch anyway?')) {
      return;
    }
  }
  
  // Package knowledge for Cowork
  const agentPackage = {
    task: task,
    knowledge: AgentKnowledge,
    context: {
      current_prospect: window._hqProspect,
      recent_activity: getRecentActivity(),
      active_campaigns: getNurtureProspects ? getNurtureProspects() : []
    }
  };
  
  // Increment launch counter
  AgentKnowledge.metadata.cowork_launches++;
  saveAgentKnowledge();
  
  // Create Cowork instructions
  const instructions = buildCoworkInstructions(task, agentPackage);
  
  // Log the launch
  console.log('🚀 Launching agent to Cowork');
  console.log('Task:', task);
  console.log('Confidence:', AgentKnowledge.metadata.confidence_score + '%');
  console.log('Knowledge package:', agentPackage);
  
  // Show modal with Cowork instructions
  showCoworkLaunchModal(instructions, agentPackage);
  
  return agentPackage;
};

/**
 * Build instructions for Cowork based on learned patterns
 */
function buildCoworkInstructions(task, agentPackage) {
  const k = agentPackage.knowledge;
  
  let instructions = '# AI Agent Instructions for Cowork\n\n';
  instructions += '## Task\n' + task + '\n\n';
  
  instructions += '## Learned Patterns from Sales HQ\n\n';
  
  // Email patterns
  if (k.emailPatterns.tone_by_prospect) {
    instructions += '### Email Tone Preferences\n';
    for (const [track, tones] of Object.entries(k.emailPatterns.tone_by_prospect)) {
      const preferred = Object.keys(tones).sort((a, b) => tones[b] - tones[a])[0];
      instructions += `- ${track}: ${preferred}\n`;
    }
    instructions += '\n';
  }
  
  // Timing patterns
  if (k.emailPatterns.cadence_timing) {
    instructions += '### Preferred Send Times\n';
    for (const [day, hours] of Object.entries(k.emailPatterns.cadence_timing)) {
      const avgHour = Math.round(hours.reduce((a, b) => a + b, 0) / hours.length);
      instructions += `- ${day}: Around ${avgHour}:00\n`;
    }
    instructions += '\n';
  }
  
  // Qualification patterns
  if (k.qualificationPatterns.high_priority_signals.length > 0) {
    instructions += '### High-Priority Prospect Signals\n';
    const signals = k.qualificationPatterns.high_priority_signals[0]; // Use most recent
    instructions += `- Industry: ${signals.industry || 'any'}\n`;
    instructions += `- Headcount: ${signals.headcount || 'any'}\n`;
    instructions += `- Track: ${signals.track || 'any'}\n`;
    instructions += '\n';
  }
  
  // Work hours
  instructions += '### Active Work Hours\n';
  instructions += 'Based on observed activity, I typically work:\n';
  const routine = k.workflowPatterns.daily_routine;
  const topHours = Object.entries(routine)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => {
      const [day, hour] = key.split('_');
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return `${days[day]} ${hour}:00`;
    });
  instructions += topHours.join(', ') + '\n\n';
  
  instructions += '## Current Context\n';
  if (agentPackage.context.current_prospect) {
    const p = agentPackage.context.current_prospect;
    instructions += `- Active prospect: ${p.company}\n`;
    instructions += `- Industry: ${p.industry}\n`;
    instructions += `- Track: ${p.track}\n`;
  }
  
  instructions += '\n## Execution Guidelines\n';
  instructions += '1. Follow my learned patterns above\n';
  instructions += '2. If uncertain, ask for clarification before executing\n';
  instructions += '3. Report back with completed actions\n';
  instructions += '4. Flag any deviations from normal patterns\n';
  
  return instructions;
}

/**
 * Show Cowork launch modal
 */
function showCoworkLaunchModal(instructions, agentPackage) {
  const modal = document.createElement('div');
  modal.className = 'ehc-modal-overlay';
  modal.innerHTML = `
    <div class="ehc-modal ehc-modal-large">
      <div class="ehc-modal-header">
        <div class="ehc-modal-title">🚀 Launch Agent to Cowork</div>
        <button class="ehc-modal-close" onclick="this.closest('.ehc-modal-overlay').remove()">✕</button>
      </div>
      <div class="ehc-modal-body">
        <div style="margin-bottom:16px">
          <strong>Task:</strong> ${agentPackage.task}
        </div>
        <div style="margin-bottom:16px">
          <strong>Agent Confidence:</strong> ${AgentKnowledge.metadata.confidence_score}%
          <div style="background:var(--border);height:8px;border-radius:4px;margin-top:6px">
            <div style="background:var(--green);height:100%;width:${AgentKnowledge.metadata.confidence_score}%;border-radius:4px;transition:width .3s"></div>
          </div>
        </div>
        <div style="margin-bottom:16px">
          <strong>Actions Observed:</strong> ${AgentKnowledge.metadata.total_actions_observed}
        </div>
        <div style="margin-bottom:16px">
          <strong>Learning Since:</strong> ${new Date(AgentKnowledge.metadata.learning_since).toLocaleDateString()}
        </div>
        
        <div style="background:var(--off-white);padding:16px;border-radius:8px;border:1px solid var(--border);margin-top:20px">
          <div style="font-weight:700;margin-bottom:12px">Copy these instructions to Cowork:</div>
          <textarea readonly style="width:100%;height:300px;font-family:monospace;font-size:11px;padding:12px;border:1px solid var(--border);border-radius:4px" onclick="this.select()">${instructions}</textarea>
        </div>
        
        <div style="display:flex;gap:12px;margin-top:20px">
          <button class="btn" onclick="navigator.clipboard.writeText(\`${instructions.replace(/`/g, '\\`')}\`);showToast('✓ Copied to clipboard')">📋 Copy to Clipboard</button>
          <button class="btn secondary" onclick="this.closest('.ehc-modal-overlay').remove()">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

/**
 * Get recent activity for context
 */
function getRecentActivity() {
  // Last 10 notifications
  if (typeof notifGetAll === 'function') {
    return notifGetAll().slice(0, 10);
  }
  return [];
}

/**
 * Export agent knowledge for backup/analysis
 */
window.exportAgentKnowledge = function() {
  const json = JSON.stringify(AgentKnowledge, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'agent-knowledge-' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  
  showToast('✓ Agent knowledge exported');
};

/**
 * Reset agent knowledge (start fresh)
 */
window.resetAgentKnowledge = function() {
  if (!confirm('Reset all learned patterns? This cannot be undone.')) return;
  
  localStorage.removeItem(AGENT_KNOWLEDGE_KEY);
  location.reload();
};

// Auto-initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLearningAgent);
} else {
  initLearningAgent();
}

console.log('🤖 Background Learning Agent loaded');
console.log('  • Real-time action observation');
console.log('  • Pattern learning and extraction');
console.log('  • Cowork integration ready');
