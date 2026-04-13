// ══════════════════════════════════════════════════════════════════════════
// 🔬 TECH INTELLIGENCE ENHANCEMENTS FOR SALES HQ
// ══════════════════════════════════════════════════════════════════════════
// Four-module analysis system: Tech Stack Parser, Competitive Intel,
// Pain Point Detection, and Benefits Intelligence
//
// INTEGRATION POINTS:
// - Insert after line 13756 (before analyzePainPointsFromTranscripts)
// - Called from runEnhancedMarketIntel() analysis flow
// ══════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════
// MODULE 1: ENHANCED TECH STACK PARSER
// ══════════════════════════════════════════════════════════════════════════

/**
 * Tech stack categories and vendor patterns
 */
const TECH_STACK_CATEGORIES = {
  'HCM Core': {
    vendors: ['Workday', 'UKG', 'UKG Pro', 'UKG Ready', 'Dayforce', 'Oracle HCM', 'SAP SuccessFactors', 'ADP Workforce Now', 'ADP WFN'],
    keywords: ['HRIS', 'HCM', 'system of record', 'core HR', 'employee data']
  },
  'Payroll': {
    vendors: ['ADP', 'Paychex', 'Paylocity', 'Gusto', 'Rippling', 'Xero', 'QuickBooks Payroll', 'Deel', 'Papaya Global'],
    keywords: ['payroll', 'pay run', 'paycheck', 'wage', 'garnishment', 'tax filing']
  },
  'Time & Attendance': {
    vendors: ['Kronos', 'UKG Dimensions', 'UKG Ready', 'ADP Time', 'TCP', 'TimeClock Plus', 'Deputy', 'When I Work', 'TSheets'],
    keywords: ['time clock', 'attendance', 'timekeeping', 'punch', 'schedule', 'shift']
  },
  'Benefits Administration': {
    vendors: ['Benefitfocus', 'bswift', 'PlanSource', 'Employee Navigator', 'Ease', 'Maxwell Health', 'Zenefits'],
    keywords: ['benefits enrollment', 'open enrollment', 'COBRA', 'FSA', 'HSA', 'benefits admin']
  },
  'Recruiting/ATS': {
    vendors: ['Greenhouse', 'Lever', 'iCIMS', 'Jobvite', 'SmartRecruiters', 'BambooHR', 'Workable', 'JazzHR'],
    keywords: ['applicant tracking', 'ATS', 'recruiting', 'candidate', 'job posting', 'hiring']
  },
  'Performance Management': {
    vendors: ['Lattice', '15Five', 'Culture Amp', 'Betterworks', 'Reflektive', 'PerformYard', 'ClearCompany'],
    keywords: ['performance review', 'goal setting', 'OKR', '360 review', 'continuous feedback', 'performance management']
  },
  'Learning Management': {
    vendors: ['Cornerstone', 'Docebo', 'TalentLMS', 'Absorb LMS', 'SAP Litmos', 'KnowBe4'],
    keywords: ['LMS', 'training', 'compliance training', 'learning', 'courses', 'e-learning']
  },
  'Accounting/ERP': {
    vendors: ['NetSuite', 'Sage Intacct', 'QuickBooks', 'Xero', 'Microsoft Dynamics', 'SAP', 'Oracle Financials'],
    keywords: ['accounting', 'ERP', 'general ledger', 'GL', 'financial system', 'AP', 'AR']
  },
  'Background Checks': {
    vendors: ['Sterling', 'First Check', 'Checkr', 'HireRight', 'GoodHire', 'Accurate Background'],
    keywords: ['background check', 'screening', 'drug test', 'criminal check', 'employment verification']
  },
  'Assessment Tools': {
    vendors: ['Criteria Corp', 'Curricula Corp', 'Wonderlic', 'Predictive Index', 'Caliper', 'Hogan'],
    keywords: ['assessment', 'personality test', 'cognitive test', 'aptitude', 'skills test', 'pre-employment']
  },
  'e-Signature': {
    vendors: ['DocuSign', 'Adobe Sign', 'HelloSign', 'SignNow', 'PandaDoc'],
    keywords: ['e-signature', 'electronic signature', 'document signing', 'esign', 'digital signature']
  },
  '401k Provider': {
    vendors: ['Fidelity', 'Vanguard', 'Empower', 'Principal', 'ADP Retirement', 'Vestwell', 'Guideline', 'Human Interest'],
    keywords: ['401k', '403b', 'retirement plan', 'retirement provider', 'pension']
  },
  'Benefits Broker': {
    vendors: ['Lockton', 'Marsh McLennan', 'Aon', 'Willis Towers Watson', 'Brown & Brown', 'Hub International', 'Arthur J. Gallagher'],
    keywords: ['broker', 'benefits broker', 'insurance broker', 'benefits consultant']
  },
  'Medical Insurance': {
    vendors: ['UnitedHealthcare', 'Cigna', 'Aetna', 'Anthem', 'Blue Cross Blue Shield', 'BCBS', 'Humana', 'Kaiser'],
    keywords: ['medical insurance', 'health insurance', 'medical carrier', 'health plan']
  },
  'Dental Insurance': {
    vendors: ['MetLife', 'Delta Dental', 'Cigna Dental', 'Guardian', 'Principal', 'Ameritas', 'Sun Life'],
    keywords: ['dental insurance', 'dental carrier', 'dental plan']
  },
  'Vision Insurance': {
    vendors: ['VSP', 'EyeMed', 'Cigna Vision', 'MetLife Vision', 'Guardian Vision', 'Avesis'],
    keywords: ['vision insurance', 'vision carrier', 'vision plan', 'eye care']
  },
  'Disability Insurance': {
    vendors: ['MetLife', 'Guardian', 'Principal', 'Lincoln Financial', 'Unum', 'The Standard', 'New York Life', 'Sun Life'],
    keywords: ['disability insurance', 'STD', 'LTD', 'short-term disability', 'long-term disability']
  },
  'Life Insurance': {
    vendors: ['MetLife', 'Principal', 'Guardian', 'Lincoln Financial', 'Unum', 'New York Life', 'Sun Life', 'Prudential'],
    keywords: ['life insurance', 'group life', 'voluntary life', 'term life']
  },
  'FSA/HSA Admin': {
    vendors: ['WEX', 'HealthEquity', 'Optum Bank', 'PayFlex', 'Fidelity HSA', 'HSA Bank', 'Further'],
    keywords: ['FSA', 'HSA', 'flexible spending', 'health savings', 'dependent care FSA', 'DCFSA']
  },
  'PEO': {
    vendors: ['ADP TotalSource', 'Insperity', 'TriNet', 'Justworks', 'Paychex PEO', 'G&A Partners', 'CoAdvantage', 'ExtensisHR'],
    keywords: ['PEO', 'professional employer organization', 'co-employment', 'ASO']
  }
};

/**
 * Parse tech stack from transcript text
 * Returns structured categorization with counts and detected vendors
 */
function parseTechStack(transcriptText) {
  const detected = {
    systems: [],
    categoryBreakdown: {},
    totalSystemCount: 0,
    fragmentationScore: 0,
    multiCountryDetected: false,
    countries: []
  };
  
  const textLower = transcriptText.toLowerCase();
  
  // Detect systems by category
  Object.keys(TECH_STACK_CATEGORIES).forEach(category => {
    const config = TECH_STACK_CATEGORIES[category];
    const foundVendors = [];
    
    // Check each vendor pattern
    config.vendors.forEach(vendor => {
      const vendorPattern = new RegExp('\\b' + vendor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      if (vendorPattern.test(transcriptText)) {
        foundVendors.push(vendor);
      }
    });
    
    // Check keywords for generic mentions
    const hasKeywordMention = config.keywords.some(kw => {
      const kwPattern = new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      return kwPattern.test(transcriptText);
    });
    
    if (foundVendors.length > 0 || hasKeywordMention) {
      detected.categoryBreakdown[category] = {
        vendors: foundVendors,
        hasGenericMention: hasKeywordMention && foundVendors.length === 0,
        count: foundVendors.length || (hasKeywordMention ? 1 : 0)
      };
      
      foundVendors.forEach(v => {
        detected.systems.push({
          vendor: v,
          category: category
        });
      });
    }
  });
  
  detected.totalSystemCount = detected.systems.length;
  
  // Calculate fragmentation score (0-100)
  // Based on: number of systems, number of categories, lack of integration
  const categoryCount = Object.keys(detected.categoryBreakdown).length;
  detected.fragmentationScore = Math.min(100, 
    (detected.totalSystemCount * 5) + (categoryCount * 3)
  );
  
  // Detect multi-country operations
  const countryPatterns = [
    { name: 'Canada', patterns: [/\bcanada\b/i, /\bcanadian\b/i, /\bqc\b/i, /\bontario\b/i, /\balberta\b/i] },
    { name: 'Australia', patterns: [/\baustralia\b/i, /\baussie\b/i, /\bsydney\b/i, /\bmelbourne\b/i] },
    { name: 'UK', patterns: [/\buk\b/i, /\bunited kingdom\b/i, /\blondon\b/i, /\bbritish\b/i] },
    { name: 'Mexico', patterns: [/\bmexico\b/i, /\bmexican\b/i] }
  ];
  
  countryPatterns.forEach(c => {
    if (c.patterns.some(p => p.test(transcriptText))) {
      detected.countries.push(c.name);
    }
  });
  
  detected.multiCountryDetected = detected.countries.length > 0;
  
  return detected;
}

// ══════════════════════════════════════════════════════════════════════════
// MODULE 2: COMPETITIVE INTELLIGENCE INJECTION
// ══════════════════════════════════════════════════════════════════════════

/**
 * Detect competitors from tech stack and transcript text
 * Returns structured competitive intelligence with COMP_DATA integration
 */
function detectCompetitiveIntelligence(techStack, transcriptText, compData) {
  const intelligence = {
    primaryCompetitor: null,
    allCompetitors: [],
    battleCards: [],
    displacementOpportunity: null
  };
  
  // Map of competitor mentions (case-insensitive)
  const competitorMentions = [
    { name: 'UKG', aliases: ['UKG', 'Ultimate Kronos', 'Kronos', 'UltiPro'], track: 'WFN' },
    { name: 'Paylocity', aliases: ['Paylocity'], track: 'WFN' },
    { name: 'Dayforce', aliases: ['Dayforce', 'Ceridian'], track: 'WFN' },
    { name: 'Workday', aliases: ['Workday'], track: 'WFN' },
    { name: 'Rippling', aliases: ['Rippling'], track: 'WFN' },
    { name: 'Paycom', aliases: ['Paycom'], track: 'WFN' },
    { name: 'Insperity', aliases: ['Insperity'], track: 'PEO' },
    { name: 'TriNet', aliases: ['TriNet'], track: 'PEO' },
    { name: 'Justworks', aliases: ['Justworks'], track: 'PEO' },
    { name: 'Paychex PEO', aliases: ['Paychex PEO', 'Paychex'], track: 'PEO' }
  ];
  
  const textLower = transcriptText.toLowerCase();
  
  // Detect all competitor mentions
  competitorMentions.forEach(comp => {
    const mentioned = comp.aliases.some(alias => {
      const pattern = new RegExp('\\b' + alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
      return pattern.test(transcriptText);
    });
    
    if (mentioned) {
      intelligence.allCompetitors.push({
        name: comp.name,
        track: comp.track,
        hasCompData: !!compData[comp.name]
      });
    }
  });
  
  // Also check tech stack for competitors
  techStack.systems.forEach(sys => {
    const matchingComp = competitorMentions.find(c => 
      c.aliases.some(a => a.toLowerCase() === sys.vendor.toLowerCase())
    );
    if (matchingComp && !intelligence.allCompetitors.some(c => c.name === matchingComp.name)) {
      intelligence.allCompetitors.push({
        name: matchingComp.name,
        track: matchingComp.track,
        hasCompData: !!compData[matchingComp.name],
        detectedFrom: 'tech_stack'
      });
    }
  });
  
  // Set primary competitor (first HCM/PEO system detected, or first mentioned)
  if (intelligence.allCompetitors.length > 0) {
    // Prioritize HCM Core competitors
    const hcmComp = intelligence.allCompetitors.find(c => c.track === 'WFN');
    intelligence.primaryCompetitor = hcmComp || intelligence.allCompetitors[0];
  }
  
  // Generate battle cards using COMP_DATA
  intelligence.allCompetitors.forEach(comp => {
    if (compData[comp.name]) {
      intelligence.battleCards.push({
        competitor: comp.name,
        track: comp.track,
        strengths: compData[comp.name].strengths,
        weaknesses: compData[comp.name].weaknesses,
        positioning: generatePositioning(comp.name, compData[comp.name])
      });
    }
  });
  
  // Determine displacement opportunity
  if (intelligence.primaryCompetitor) {
    const primary = intelligence.primaryCompetitor.name;
    const isDisplacementTarget = ['UKG', 'Dayforce', 'Insperity', 'Paychex PEO'].includes(primary);
    
    intelligence.displacementOpportunity = {
      isViable: isDisplacementTarget,
      reasoning: isDisplacementTarget 
        ? `${primary} displacement opportunity - leverage ${compData[primary]?.weaknesses[0] || 'platform challenges'}`
        : `${primary} is a strong competitor - focus on differentiation`,
      recommendedStrategy: isDisplacementTarget ? 'aggressive' : 'consultative'
    };
  }
  
  return intelligence;
}

/**
 * Generate ADP positioning against competitor
 */
function generatePositioning(competitorName, compData) {
  const basePositioning = {
    'UKG': 'ADP offers superior platform stability and compliance automation vs UKG\'s recent challenges',
    'Dayforce': 'ADP provides client certainty and roadmap clarity vs Dayforce PE buyout uncertainty',
    'Insperity': 'ADP TotalSource delivers better retention and earnings stability vs Insperity\'s recent struggles',
    'Paychex PEO': 'ADP offers stronger compliance automation and platform reliability',
    'Rippling': 'ADP provides enterprise-grade support and stability vs Rippling\'s rapid-growth challenges',
    'TriNet': 'ADP delivers better value and simpler platform experience'
  };
  
  return basePositioning[competitorName] || `ADP differentiates through ${compData.weaknesses[0]}`;
}

// ══════════════════════════════════════════════════════════════════════════
// MODULE 3: PAIN POINT DETECTOR
// ══════════════════════════════════════════════════════════════════════════

/**
 * Detect specific integration pain patterns and explicit complaints
 */
function detectPainPatterns(transcriptText) {
  const patterns = {
    integrationPains: [],
    separationComplaints: [],
    manualWorkarounds: [],
    dataQualityIssues: [],
    vendorFrustrations: []
  };
  
  const text = transcriptText;
  const textLower = transcriptText.toLowerCase();
  
  // Integration pain signals
  const integrationSignals = [
    { pattern: /separate(?:d)?.*(?:want|need|like).*integrat/i, type: 'explicit_integration_request' },
    { pattern: /(?:don't|doesnt|not).*talk to each other/i, type: 'disconnected_systems' },
    { pattern: /manual(?:ly)? transfer/i, type: 'manual_data_transfer' },
    { pattern: /(?:re-enter|reenter|double[- ]entry)/i, type: 'duplicate_data_entry' },
    { pattern: /(?:export.*import|CSV.*upload)/i, type: 'file_transfer_workaround' },
    { pattern: /(?:three|3|four|4|five|5|multiple).*different systems/i, type: 'system_fragmentation' },
    { pattern: /wish.*(?:all in one|integrated|single system)/i, type: 'consolidation_desire' }
  ];
  
  integrationSignals.forEach(sig => {
    const match = text.match(sig.pattern);
    if (match) {
      patterns.integrationPains.push({
        type: sig.type,
        quote: extractContext(text, match.index, 80),
        severity: 'High'
      });
    }
  });
  
  // Separation complaints (like DocuSign example)
  const separationSignals = [
    { pattern: /([\w\s]+)\s+(?:is )?(?:currently )?separate.*(?:want|need|like).*integrat/i, vendor: true },
    { pattern: /(\w+)\s+(?:doesn't|dont|not).*integrat/i, vendor: true },
    { pattern: /wish (\w+) was (?:in|part of)/i, vendor: true }
  ];
  
  separationSignals.forEach(sig => {
    const match = text.match(sig.pattern);
    if (match) {
      patterns.separationComplaints.push({
        vendor: sig.vendor ? match[1] : 'Unknown',
        quote: extractContext(text, match.index, 100),
        severity: 'High'
      });
    }
  });
  
  // Manual workaround detection
  const workaroundSignals = [
    /manual(?:ly)?\s+(?:build|create|update|maintain)/i,
    /spreadsheet.*track/i,
    /have to.*(?:remember|check|verify)/i,
    /admin.*spend.*time.*on/i
  ];
  
  workaroundSignals.forEach(pattern => {
    const match = text.match(pattern);
    if (match) {
      patterns.manualWorkarounds.push({
        quote: extractContext(text, match.index, 80),
        severity: 'Medium'
      });
    }
  });
  
  // Data quality issues
  const dataQualitySignals = [
    /data.*(?:wrong|incorrect|outdated|stale)/i,
    /(?:can't|cant).*trust.*data/i,
    /(?:missing|incomplete).*information/i,
    /sync.*(?:issue|problem|fail)/i
  ];
  
  dataQualitySignals.forEach(pattern => {
    const match = text.match(pattern);
    if (match) {
      patterns.dataQualityIssues.push({
        quote: extractContext(text, match.index, 80),
        severity: 'High'
      });
    }
  });
  
  // Vendor frustration signals
  const frustrationSignals = [
    { pattern: /frustrated with (\w+)/i, hasVendor: true },
    { pattern: /(\w+).*(?:terrible|awful|horrible|nightmare)/i, hasVendor: true },
    { pattern: /support.*(?:slow|bad|unresponsive)/i, hasVendor: false },
    { pattern: /looking to replace (\w+)/i, hasVendor: true }
  ];
  
  frustrationSignals.forEach(sig => {
    const match = text.match(sig.pattern);
    if (match) {
      patterns.vendorFrustrations.push({
        vendor: sig.hasVendor ? match[1] : 'Unknown',
        quote: extractContext(text, match.index, 100),
        severity: 'High'
      });
    }
  });
  
  return patterns;
}

/**
 * Extract surrounding context from text
 */
function extractContext(text, index, length) {
  const start = Math.max(0, index - 20);
  const end = Math.min(text.length, index + length);
  let context = text.substring(start, end).trim();
  
  if (start > 0) context = '...' + context;
  if (end < text.length) context = context + '...';
  
  return context;
}

// ══════════════════════════════════════════════════════════════════════════
// MODULE 4: BENEFITS INTELLIGENCE
// ══════════════════════════════════════════════════════════════════════════

/**
 * Parse benefits broker and carrier relationships from tech stack
 * Critical for TotalSource PEO positioning
 */
function parseBenefitsIntelligence(techStack) {
  const benefits = {
    hasBroker: false,
    broker: null,
    carriers: {
      medical: [],
      dental: [],
      vision: [],
      life: [],
      disability: [],
      retirement: []
    },
    carrierCount: 0,
    multiCarrierComplexity: false,
    tsOpportunity: null
  };
  
  // Extract broker
  if (techStack.categoryBreakdown['Benefits Broker']) {
    benefits.hasBroker = true;
    benefits.broker = techStack.categoryBreakdown['Benefits Broker'].vendors[0] || 'Unknown Broker';
  }
  
  // Extract carriers by type
  const carrierMapping = [
    { category: 'Medical Insurance', key: 'medical' },
    { category: 'Dental Insurance', key: 'dental' },
    { category: 'Vision Insurance', key: 'vision' },
    { category: 'Life Insurance', key: 'life' },
    { category: 'Disability Insurance', key: 'disability' },
    { category: '401k Provider', key: 'retirement' }
  ];
  
  carrierMapping.forEach(m => {
    if (techStack.categoryBreakdown[m.category]) {
      benefits.carriers[m.key] = techStack.categoryBreakdown[m.category].vendors;
    }
  });
  
  // Count total carriers
  Object.values(benefits.carriers).forEach(arr => {
    benefits.carrierCount += arr.length;
  });
  
  // Determine multi-carrier complexity (4+ different carriers = high complexity)
  benefits.multiCarrierComplexity = benefits.carrierCount >= 4;
  
  // Generate TotalSource opportunity assessment
  if (benefits.hasBroker || benefits.carrierCount > 0) {
    benefits.tsOpportunity = {
      viable: true,
      score: calculateTSScore(benefits),
      reasoning: generateTSReasoning(benefits),
      talkTrack: generateTSTalkTrack(benefits)
    };
  }
  
  return benefits;
}

/**
 * Calculate TotalSource opportunity score (0-100)
 */
function calculateTSScore(benefits) {
  let score = 0;
  
  // Base score for having benefits carriers
  if (benefits.carrierCount > 0) score += 30;
  
  // Complexity bonus
  if (benefits.carrierCount >= 4) score += 20;
  if (benefits.carrierCount >= 7) score += 15;
  
  // Broker relationship bonus (easier entry point)
  if (benefits.hasBroker) score += 20;
  
  // Multi-carrier management complexity
  if (benefits.multiCarrierComplexity) score += 15;
  
  return Math.min(100, score);
}

/**
 * Generate TotalSource positioning reasoning
 */
function generateTSReasoning(benefits) {
  if (benefits.multiCarrierComplexity) {
    return `High carrier complexity (${benefits.carrierCount} carriers) creates admin burden - TotalSource consolidates benefits under single umbrella with Fortune 100 buying power`;
  } else if (benefits.carrierCount >= 3) {
    return `Multiple carriers (${benefits.carrierCount}) indicate benefits administration complexity - TotalSource simplifies with integrated platform`;
  } else if (benefits.hasBroker) {
    return `Current broker relationship (${benefits.broker}) - TotalSource can work with existing broker or provide full benefits consulting`;
  } else {
    return `Benefits administration present - TotalSource can streamline with PEO benefits offering`;
  }
}

/**
 * Generate TotalSource talk track
 */
function generateTSTalkTrack(benefits) {
  if (benefits.carrierCount >= 7) {
    return `"I noticed you're managing ${benefits.carrierCount} different carriers - how much time does your team spend coordinating benefits enrollment across all of them?"`;
  } else if (benefits.multiCarrierComplexity) {
    return `"With ${benefits.carrierCount} carriers, you're essentially running multiple benefit programs. Have you looked at how much you could save with Fortune 100-level buying power?"`;
  } else if (benefits.hasBroker) {
    return `"I see you work with ${benefits.broker} - we actually partner with many brokers, or can provide full benefits consulting if you want to consolidate."`;
  } else {
    return `"How are you handling benefits administration today? We're seeing companies save 20-30% by moving to our PEO model."`;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// INTEGRATED ANALYSIS FUNCTION
// ══════════════════════════════════════════════════════════════════════════

/**
 * Master function that runs all four intelligence modules
 * Called from runEnhancedMarketIntel() workflow
 */
async function runTechIntelligenceAnalysis(extractedTranscripts) {
  // Combine all transcript text
  const fullTranscript = extractedTranscripts.map(t => t.text).join('\n\n');
  
  // Run all four modules
  const techStack = parseTechStack(fullTranscript);
  const competitive = detectCompetitiveIntelligence(techStack, fullTranscript, COMP_DATA);
  const painPatterns = detectPainPatterns(fullTranscript);
  const benefits = parseBenefitsIntelligence(techStack);
  
  // Return consolidated intelligence
  return {
    techStack: techStack,
    competitive: competitive,
    painPatterns: painPatterns,
    benefits: benefits,
    summary: {
      systemCount: techStack.totalSystemCount,
      fragmentationScore: techStack.fragmentationScore,
      primaryCompetitor: competitive.primaryCompetitor?.name || 'None detected',
      integrationPainCount: painPatterns.integrationPains.length,
      benefitsComplexity: benefits.multiCarrierComplexity ? 'High' : 'Normal',
      tsOpportunityScore: benefits.tsOpportunity?.score || 0
    }
  };
}

// ══════════════════════════════════════════════════════════════════════════
// RENDERING FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════

/**
 * Render tech stack analysis in dashboard
 */
function renderTechStackSection(techIntel) {
  const ts = techIntel.techStack;
  
  let html = `
    <div style="background: var(--white); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem; margin-bottom: 1.5rem;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
        <h3 style="font-size: 15px; font-weight: 600; margin: 0; display: flex; align-items: center; gap: 8px;">
          <span>🔧</span> Tech Stack Analysis
        </h3>
        <div style="display: flex; gap: 12px;">
          <span style="font-size: 12px; padding: 4px 10px; background: var(--blue-bg); color: var(--blue); border-radius: 12px; font-weight: 600;">
            ${ts.totalSystemCount} Systems
          </span>
          <span style="font-size: 12px; padding: 4px 10px; background: ${ts.fragmentationScore >= 50 ? 'var(--red-bg)' : 'var(--green-bg)'}; color: ${ts.fragmentationScore >= 50 ? 'var(--err)' : 'var(--green)'}; border-radius: 12px; font-weight: 600;">
            ${ts.fragmentationScore}/100 Fragmentation
          </span>
        </div>
      </div>
  `;
  
  // Category breakdown
  if (Object.keys(ts.categoryBreakdown).length > 0) {
    html += `
      <div style="display: grid; gap: 8px; margin-top: 12px;">
    `;
    
    Object.keys(ts.categoryBreakdown).forEach(category => {
      const cat = ts.categoryBreakdown[category];
      const vendorList = cat.vendors.length > 0 
        ? cat.vendors.join(', ') 
        : `${category} (generic mention)`;
      
      html += `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--off-white); border-radius: var(--radius-sm);">
          <div style="font-size: 13px; color: var(--text-2);">${category}</div>
          <div style="font-size: 13px; font-weight: 600; color: var(--text-1);">${vendorList}</div>
        </div>
      `;
    });
    
    html += `</div>`;
  }
  
  // Multi-country flag
  if (ts.multiCountryDetected) {
    html += `
      <div style="margin-top: 12px; padding: 10px 12px; background: var(--gold-bg); border-left: 3px solid var(--gold); border-radius: var(--radius-sm);">
        <div style="font-size: 13px; font-weight: 600; color: var(--text-1); margin-bottom: 4px;">
          🌍 Multi-Country Operations Detected
        </div>
        <div style="font-size: 12px; color: var(--text-2);">
          Countries: ${ts.countries.join(', ')}
        </div>
      </div>
    `;
  }
  
  html += `</div>`;
  return html;
}

/**
 * Render competitive intelligence section
 */
function renderCompetitiveSection(techIntel) {
  const comp = techIntel.competitive;
  
  if (comp.allCompetitors.length === 0) {
    return '';
  }
  
  let html = `
    <div style="background: var(--white); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem; margin-bottom: 1.5rem;">
      <h3 style="font-size: 15px; font-weight: 600; margin: 0 0 1rem 0; display: flex; align-items: center; gap: 8px;">
        <span>⚔️</span> Competitive Intelligence
      </h3>
  `;
  
  // Primary competitor
  if (comp.primaryCompetitor) {
    html += `
      <div style="padding: 12px; background: var(--red-bg); border-left: 3px solid var(--err); border-radius: var(--radius-sm); margin-bottom: 12px;">
        <div style="font-size: 13px; font-weight: 600; color: var(--err); margin-bottom: 4px;">
          Primary Competitor: ${comp.primaryCompetitor.name}
        </div>
        <div style="font-size: 12px; color: var(--text-2);">
          Track: ${comp.primaryCompetitor.track}
        </div>
      </div>
    `;
  }
  
  // Battle cards
  if (comp.battleCards.length > 0) {
    html += `<div style="margin-top: 12px;">`;
    
    comp.battleCards.forEach(card => {
      html += `
        <div style="margin-bottom: 12px; padding: 12px; background: var(--off-white); border-radius: var(--radius-sm);">
          <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">${card.competitor}</div>
          
          <div style="margin-bottom: 8px;">
            <div style="font-size: 12px; color: var(--text-3); margin-bottom: 4px;">Their Strengths:</div>
            <div style="font-size: 12px; color: var(--text-2);">
              ${card.strengths.map(s => `• ${s}`).join('<br>')}
            </div>
          </div>
          
          <div style="margin-bottom: 8px;">
            <div style="font-size: 12px; color: var(--text-3); margin-bottom: 4px;">Their Weaknesses:</div>
            <div style="font-size: 12px; color: var(--err);">
              ${card.weaknesses.map(w => `• ${w}`).join('<br>')}
            </div>
          </div>
          
          <div style="padding: 8px; background: var(--blue-bg); border-radius: var(--radius-sm); margin-top: 8px;">
            <div style="font-size: 12px; font-weight: 600; color: var(--blue);">
              ADP Positioning: ${card.positioning}
            </div>
          </div>
        </div>
      `;
    });
    
    html += `</div>`;
  }
  
  // Displacement opportunity
  if (comp.displacementOpportunity) {
    const opp = comp.displacementOpportunity;
    html += `
      <div style="padding: 12px; background: ${opp.isViable ? 'var(--green-bg)' : 'var(--gold-bg)'}; border-left: 3px solid ${opp.isViable ? 'var(--green)' : 'var(--gold)'}; border-radius: var(--radius-sm); margin-top: 12px;">
        <div style="font-size: 13px; font-weight: 600; margin-bottom: 4px;">
          ${opp.isViable ? '✓' : '⚠️'} Displacement Assessment
        </div>
        <div style="font-size: 12px; color: var(--text-2); margin-bottom: 4px;">
          ${opp.reasoning}
        </div>
        <div style="font-size: 12px; font-weight: 600; color: var(--text-1);">
          Strategy: ${opp.recommendedStrategy}
        </div>
      </div>
    `;
  }
  
  html += `</div>`;
  return html;
}

/**
 * Render pain pattern detection section
 */
function renderPainPatternsSection(techIntel) {
  const pain = techIntel.painPatterns;
  
  const totalPains = 
    pain.integrationPains.length + 
    pain.separationComplaints.length + 
    pain.manualWorkarounds.length +
    pain.dataQualityIssues.length +
    pain.vendorFrustrations.length;
  
  if (totalPains === 0) {
    return '';
  }
  
  let html = `
    <div style="background: var(--white); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem; margin-bottom: 1.5rem;">
      <h3 style="font-size: 15px; font-weight: 600; margin: 0 0 1rem 0; display: flex; align-items: center; gap: 8px;">
        <span>🚨</span> Pain Pattern Detection
        <span style="font-size: 12px; padding: 4px 10px; background: var(--red-bg); color: var(--err); border-radius: 12px; font-weight: 600; margin-left: 8px;">
          ${totalPains} Detected
        </span>
      </h3>
  `;
  
  // Integration pains
  if (pain.integrationPains.length > 0) {
    html += `
      <div style="margin-bottom: 12px;">
        <div style="font-size: 13px; font-weight: 600; color: var(--err); margin-bottom: 8px;">
          🔗 Integration Pain Points (${pain.integrationPains.length})
        </div>
        ${pain.integrationPains.map(p => `
          <div style="padding: 10px; background: var(--red-bg); border-left: 3px solid var(--err); border-radius: var(--radius-sm); margin-bottom: 8px;">
            <div style="font-size: 12px; color: var(--text-2); margin-bottom: 4px;">
              Type: <strong>${p.type.replace(/_/g, ' ').toUpperCase()}</strong>
            </div>
            <div style="font-size: 12px; color: var(--text-1); font-style: italic;">
              "${p.quote}"
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  // Separation complaints
  if (pain.separationComplaints.length > 0) {
    html += `
      <div style="margin-bottom: 12px;">
        <div style="font-size: 13px; font-weight: 600; color: var(--err); margin-bottom: 8px;">
          💔 Separation Complaints (${pain.separationComplaints.length})
        </div>
        ${pain.separationComplaints.map(p => `
          <div style="padding: 10px; background: var(--red-bg); border-left: 3px solid var(--err); border-radius: var(--radius-sm); margin-bottom: 8px;">
            <div style="font-size: 12px; color: var(--text-2); margin-bottom: 4px;">
              Vendor: <strong>${p.vendor}</strong>
            </div>
            <div style="font-size: 12px; color: var(--text-1); font-style: italic;">
              "${p.quote}"
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  // Manual workarounds
  if (pain.manualWorkarounds.length > 0) {
    html += `
      <div style="margin-bottom: 12px;">
        <div style="font-size: 13px; font-weight: 600; color: var(--gold); margin-bottom: 8px;">
          🛠️ Manual Workarounds (${pain.manualWorkarounds.length})
        </div>
        ${pain.manualWorkarounds.map(p => `
          <div style="padding: 10px; background: var(--gold-bg); border-left: 3px solid var(--gold); border-radius: var(--radius-sm); margin-bottom: 8px;">
            <div style="font-size: 12px; color: var(--text-1); font-style: italic;">
              "${p.quote}"
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  // Vendor frustrations
  if (pain.vendorFrustrations.length > 0) {
    html += `
      <div style="margin-bottom: 12px;">
        <div style="font-size: 13px; font-weight: 600; color: var(--err); margin-bottom: 8px;">
          😤 Vendor Frustrations (${pain.vendorFrustrations.length})
        </div>
        ${pain.vendorFrustrations.map(p => `
          <div style="padding: 10px; background: var(--red-bg); border-left: 3px solid var(--err); border-radius: var(--radius-sm); margin-bottom: 8px;">
            <div style="font-size: 12px; color: var(--text-2); margin-bottom: 4px;">
              Vendor: <strong>${p.vendor}</strong>
            </div>
            <div style="font-size: 12px; color: var(--text-1); font-style: italic;">
              "${p.quote}"
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  html += `</div>`;
  return html;
}

/**
 * Render benefits intelligence section
 */
function renderBenefitsSection(techIntel) {
  const ben = techIntel.benefits;
  
  if (!ben.hasBroker && ben.carrierCount === 0) {
    return '';
  }
  
  let html = `
    <div style="background: var(--white); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem; margin-bottom: 1.5rem;">
      <h3 style="font-size: 15px; font-weight: 600; margin: 0 0 1rem 0; display: flex; align-items: center; gap: 8px;">
        <span>💼</span> Benefits Intelligence
        ${ben.tsOpportunity ? `
          <span style="font-size: 12px; padding: 4px 10px; background: var(--green-bg); color: var(--green); border-radius: 12px; font-weight: 600; margin-left: 8px;">
            TS Score: ${ben.tsOpportunity.score}/100
          </span>
        ` : ''}
      </h3>
  `;
  
  // Broker info
  if (ben.hasBroker) {
    html += `
      <div style="padding: 10px 12px; background: var(--blue-bg); border-left: 3px solid var(--blue); border-radius: var(--radius-sm); margin-bottom: 12px;">
        <div style="font-size: 13px; font-weight: 600; color: var(--blue);">
          Current Broker: ${ben.broker}
        </div>
      </div>
    `;
  }
  
  // Carrier breakdown
  if (ben.carrierCount > 0) {
    html += `
      <div style="margin-bottom: 12px;">
        <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px; color: var(--text-1);">
          Carrier Breakdown (${ben.carrierCount} total)
        </div>
        <div style="display: grid; gap: 6px;">
    `;
    
    Object.keys(ben.carriers).forEach(type => {
      if (ben.carriers[type].length > 0) {
        html += `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--off-white); border-radius: var(--radius-sm);">
            <div style="font-size: 12px; color: var(--text-2); text-transform: capitalize;">${type}</div>
            <div style="font-size: 12px; font-weight: 600; color: var(--text-1);">${ben.carriers[type].join(', ')}</div>
          </div>
        `;
      }
    });
    
    html += `
        </div>
      </div>
    `;
  }
  
  // TotalSource opportunity
  if (ben.tsOpportunity) {
    html += `
      <div style="padding: 12px; background: var(--green-bg); border-left: 3px solid var(--green); border-radius: var(--radius-sm);">
        <div style="font-size: 13px; font-weight: 600; color: var(--green); margin-bottom: 8px;">
          🎯 TotalSource Opportunity
        </div>
        <div style="font-size: 12px; color: var(--text-2); margin-bottom: 8px;">
          ${ben.tsOpportunity.reasoning}
        </div>
        <div style="padding: 8px; background: var(--white); border-radius: var(--radius-sm); margin-top: 8px;">
          <div style="font-size: 11px; color: var(--text-3); margin-bottom: 4px; text-transform: uppercase; font-weight: 600;">
            Suggested Talk Track:
          </div>
          <div style="font-size: 12px; color: var(--text-1); font-style: italic;">
            ${ben.tsOpportunity.talkTrack}
          </div>
        </div>
      </div>
    `;
  }
  
  html += `</div>`;
  return html;
}

// ══════════════════════════════════════════════════════════════════════════
// END OF TECH INTELLIGENCE ENHANCEMENTS
// ══════════════════════════════════════════════════════════════════════════
