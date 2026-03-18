/* ════════════════════════════════════════════════════════════════════
   NURTURE CAMPAIGN SYSTEM
   
   For prospects who say:
   - "Not right now"
   - "Maybe later"
   - "Not the right timing"
   - "Call me in 6 months"
   - Lost interest / went cold
   
   Features:
   - Automatic nurture cadence (30/60/90 day check-ins)
   - Trigger-based re-engagement (company news, funding, hiring)
   - Seasonal touchpoints (renewal season, year-end planning)
   - Content drip (case studies, ROI calculators, webinars)
════════════════════════════════════════════════════════════════════ */

// ══════════════════════════════════════════════════════════════════════
// NURTURE CAMPAIGN DATA STRUCTURE
// ══════════════════════════════════════════════════════════════════════

const NURTURE_CAMPAIGNS = {
  // 30-day nurture (warm lead, just not ready yet)
  '30day': {
    name: '30-Day Warm Nurture',
    description: 'For prospects interested but timing isn\'t right',
    duration: 30,
    triggers: ['not_right_now', 'timing', 'maybe'],
    touchpoints: [
      {
        day: 7,
        type: 'email',
        subject: 'Quick thought for {company}',
        template: 'value_reminder',
        goal: 'Stay top of mind with light touch'
      },
      {
        day: 21,
        type: 'content',
        subject: 'ROI Calculator: {industry} companies',
        template: 'roi_calculator',
        goal: 'Provide self-service value tool'
      },
      {
        day: 30,
        type: 'check_in',
        subject: 'Checking back in - {company}',
        template: 'timing_check',
        goal: 'Re-qualify timing'
      }
    ]
  },
  
  // 60-day nurture (lukewarm, needs more warming)
  '60day': {
    name: '60-Day Standard Nurture',
    description: 'For prospects who need more education/time',
    duration: 60,
    triggers: ['need_time', 'evaluating', 'budget_next_quarter'],
    touchpoints: [
      {
        day: 14,
        type: 'case_study',
        subject: 'How {similar_company} solved {pain_point}',
        template: 'case_study',
        goal: 'Show proof in similar situation'
      },
      {
        day: 30,
        type: 'webinar',
        subject: 'Upcoming: {topic} for {industry}',
        template: 'webinar_invite',
        goal: 'Educational engagement'
      },
      {
        day: 45,
        type: 'market_insight',
        subject: '{industry} compliance changes in {year}',
        template: 'market_intel',
        goal: 'Position as thought leader'
      },
      {
        day: 60,
        type: 'check_in',
        subject: 'Timing update - {company}',
        template: 'requalify',
        goal: 'Re-engage conversation'
      }
    ]
  },
  
  // 90-day nurture (cold, long-term play)
  '90day': {
    name: '90-Day Long-Term Nurture',
    description: 'For prospects with 6-12 month timeline',
    duration: 90,
    triggers: ['call_me_later', '6_months', 'next_year', 'renewal_far_out'],
    touchpoints: [
      {
        day: 15,
        type: 'content',
        subject: 'Quarterly {industry} trends report',
        template: 'quarterly_report',
        goal: 'Value-add content'
      },
      {
        day: 30,
        type: 'case_study',
        subject: '{competitor_company} → ADP success story',
        template: 'competitor_win',
        goal: 'Competitive positioning'
      },
      {
        day: 45,
        type: 'tool',
        subject: 'Free tool: Compliance checklist for {state}',
        template: 'compliance_tool',
        goal: 'Practical utility'
      },
      {
        day: 60,
        type: 'market_intel',
        subject: '{year} HR tech landscape for {industry}',
        template: 'landscape_report',
        goal: 'Thought leadership'
      },
      {
        day: 75,
        type: 'event',
        subject: 'ADP client roundtable - {metro}',
        template: 'event_invite',
        goal: 'In-person opportunity'
      },
      {
        day: 90,
        type: 'check_in',
        subject: 'Quarterly check-in - {company}',
        template: 'quarterly_requalify',
        goal: 'Re-open conversation'
      }
    ]
  },
  
  // Seasonal nurture (triggers on specific dates)
  'seasonal': {
    name: 'Seasonal Nurture',
    description: 'Triggered by renewal season, budget cycles, compliance deadlines',
    duration: 'variable',
    triggers: ['renewal_season', 'q4_planning', 'year_end', 'compliance_deadline'],
    touchpoints: [
      {
        trigger: 'renewal_minus_90',
        type: 'email',
        subject: 'Planning for {renewal_month}? Let\'s talk.',
        template: 'renewal_planning',
        goal: 'Get ahead of renewal'
      },
      {
        trigger: 'q4_budget',
        type: 'content',
        subject: '{year+1} HR tech budget guide',
        template: 'budget_guide',
        goal: 'Influence budget planning'
      },
      {
        trigger: 'year_end_tax',
        type: 'alert',
        subject: 'Year-end payroll tax checklist',
        template: 'tax_deadline',
        goal: 'Timely help'
      }
    ]
  }
};

// ══════════════════════════════════════════════════════════════════════
// NURTURE PROSPECT STATUS & TRIGGERS
// ══════════════════════════════════════════════════════════════════════

const NURTURE_TRIGGERS = {
  // Explicit "not now" responses
  'not_right_now': {
    keywords: ['not right now', 'timing isn\'t right', 'not the right time', 'bad timing'],
    campaign: '30day',
    priority: 'medium'
  },
  
  'maybe': {
    keywords: ['maybe', 'possibly', 'might be interested', 'we\'ll see', 'let me think'],
    campaign: '30day',
    priority: 'medium'
  },
  
  'call_me_later': {
    keywords: ['call me in', 'reach out in', 'check back in', 'follow up in'],
    campaign: '90day',
    priority: 'low',
    extractTiming: true // Extract "6 months", "Q3", etc.
  },
  
  'evaluating': {
    keywords: ['evaluating options', 'looking at competitors', 'reviewing vendors', 'comparing'],
    campaign: '60day',
    priority: 'high',
    competitive: true
  },
  
  'budget': {
    keywords: ['no budget', 'budget next quarter', 'budget next year', 'waiting on budget'],
    campaign: '60day',
    priority: 'medium',
    extractTiming: true
  },
  
  'renewal_far_out': {
    keywords: ['renewal is', 'contract ends', 'locked in until', 'current vendor until'],
    campaign: '90day',
    priority: 'low',
    extractDate: true
  },
  
  // Implicit signals (no response, ghosting)
  'no_response': {
    keywords: null, // Triggered by no reply after 3+ attempts
    campaign: '60day',
    priority: 'low'
  },
  
  'opted_out': {
    keywords: ['not interested', 'remove me', 'stop emailing', 'unsubscribe'],
    campaign: null, // Don't nurture
    priority: 'archive'
  }
};

// ══════════════════════════════════════════════════════════════════════
// NURTURE FUNCTIONS
// ══════════════════════════════════════════════════════════════════════

/**
 * Move prospect to nurture campaign
 */
window.moveToNurture = function(prospectId, trigger, customNote) {
  const prospect = getProspects().find(p => p.id === prospectId || p.company === prospectId);
  if (!prospect) return;
  
  const triggerData = NURTURE_TRIGGERS[trigger];
  if (!triggerData) {
    console.error('Unknown nurture trigger:', trigger);
    return;
  }
  
  // Don't nurture if they opted out
  if (triggerData.priority === 'archive') {
    if (confirm('Archive ' + prospect.company + ' as "Not Interested"?')) {
      prospect.archived = true;
      prospect.archiveReason = 'opted_out';
      prospect.archivedDate = new Date().toISOString();
      saveProspect();
      showToast('✓ Archived - ' + prospect.company);
    }
    return;
  }
  
  const campaign = NURTURE_CAMPAIGNS[triggerData.campaign];
  if (!campaign) return;
  
  // Set nurture status
  prospect.status = 'nurture';
  prospect.nurtureCampaign = triggerData.campaign;
  prospect.nurtureStartDate = new Date().toISOString();
  prospect.nurtureTrigger = trigger;
  prospect.nurtureNote = customNote || triggerData.keywords[0];
  prospect.nurturePriority = triggerData.priority;
  
  // Save
  saveProspect();
  
  // Add notification
  if (typeof notifAdd === 'function') {
    notifAdd('alerts', 
      '🌱 Moved to Nurture: ' + prospect.company,
      campaign.name + ' • ' + campaign.duration + ' days',
      'NURTURE'
    );
  }
  
  showToast('✓ Moved to ' + campaign.name + ' - ' + prospect.company);
  
  // Render nurture schedule
  renderNurtureSchedule(prospect);
};

/**
 * Render nurture schedule for a prospect
 */
function renderNurtureSchedule(prospect) {
  if (!prospect.nurtureStartDate || !prospect.nurtureCampaign) return '';
  
  const campaign = NURTURE_CAMPAIGNS[prospect.nurturecampaign];
  if (!campaign) return '';
  
  const startDate = new Date(prospect.nurtureStartDate);
  
  let html = '<div class="nurture-schedule">';
  html += '<div class="nurture-header">';
  html += '<div class="nurture-title">🌱 ' + campaign.name + '</div>';
  html += '<div class="nurture-sub">' + campaign.description + '</div>';
  html += '</div>';
  
  campaign.touchpoints.forEach(function(touch) {
    const touchDate = new Date(startDate);
    touchDate.setDate(touchDate.getDate() + touch.day);
    
    const isPast = touchDate < new Date();
    const isToday = touchDate.toDateString() === new Date().toDateString();
    const isFuture = touchDate > new Date();
    
    const statusClass = isPast ? 'past' : isToday ? 'today' : 'future';
    const statusIcon = isPast ? '✓' : isToday ? '🔔' : '○';
    
    html += '<div class="nurture-touch ' + statusClass + '">';
    html += '<div class="nurture-touch-day">' + statusIcon + ' Day ' + touch.day + '</div>';
    html += '<div class="nurture-touch-type">' + touch.type.toUpperCase() + '</div>';
    html += '<div class="nurture-touch-subject">' + touch.subject + '</div>';
    html += '<div class="nurture-touch-date">' + touchDate.toLocaleDateString('en-US', {month: 'short', day: 'numeric'}) + '</div>';
    html += '<div class="nurture-touch-goal">' + touch.goal + '</div>';
    html += '</div>';
  });
  
  html += '</div>';
  
  return html;
}

/**
 * Get all nurture prospects
 */
window.getNurtureProspects = function() {
  return getProspects().filter(p => p.status === 'nurture');
};

/**
 * Get due nurture touchpoints for today
 */
window.getDueNurtureTouches = function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const prospects = getNurtureProspects();
  const due = [];
  
  prospects.forEach(function(prospect) {
    const campaign = NURTURE_CAMPAIGNS[prospect.nurtureCampaign];
    if (!campaign) return;
    
    const startDate = new Date(prospect.nurtureStartDate);
    startDate.setHours(0, 0, 0, 0);
    
    campaign.touchpoints.forEach(function(touch, idx) {
      const touchDate = new Date(startDate);
      touchDate.setDate(touchDate.getDate() + touch.day);
      touchDate.setHours(0, 0, 0, 0);
      
      if (touchDate.getTime() === today.getTime()) {
        due.push({
          prospect: prospect,
          touch: touch,
          touchIndex: idx,
          campaign: campaign
        });
      }
    });
  });
  
  return due;
};

/**
 * Auto-detect nurture trigger from prospect notes/status
 */
window.autoDetectNurtureTrigger = function(prospectId, text) {
  const lowerText = (text || '').toLowerCase();
  
  for (const [trigger, data] of Object.entries(NURTURE_TRIGGERS)) {
    if (!data.keywords) continue;
    
    for (const keyword of data.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return trigger;
      }
    }
  }
  
  return null;
};

console.log('✓ Nurture campaign system loaded');
console.log('  • 30/60/90 day campaigns');
console.log('  • Automatic trigger detection');
console.log('  • Seasonal touchpoints');
