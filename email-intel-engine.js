// ══════════════════════════════════════════════════════════════════
// INTEL CONTEXT ENGINE
// Aggregates all prospect intelligence into structured email context
// ══════════════════════════════════════════════════════════════════

(function() {
  'use strict';

  // ── COMPETITIVE INTELLIGENCE DATABASE ────────────────────────────
  const COMP_INTEL = {
    'paycom': {
      name: 'Paycom',
      weaknesses: [
        'Single-vendor lock-in limits flexibility',
        'Support SLAs deteriorate post-sale',
        'Product plateaus at mid-market scale',
        'Limited integration ecosystem'
      ],
      adpAdvantages: [
        'Open API architecture with 150+ pre-built integrations',
        'Dedicated support tiers scale with client complexity',
        'Enterprise-grade platform from 1 to 10,000 employees',
        'Best-of-breed partner ecosystem'
      ],
      positioning: 'Single-database story sells well until prospects discover one vendor means no flexibility and slow support.'
    },
    'paylocity': {
      name: 'Paylocity',
      weaknesses: [
        'Implementation depth consistently underdelivers',
        'Post-sale support response times lag',
        'Compliance complexity handling is weak',
        'Multi-state tax filing requires manual oversight'
      ],
      adpAdvantages: [
        'SmartCompliance auto-files in all 50 states',
        'Implementation team with 75+ year combined ADP experience',
        'Dedicated compliance analysts monitor state-by-state changes',
        '24/7 certified payroll support'
      ],
      positioning: 'Clean UI and aggressive marketing, but implementation and compliance support consistently underdeliver.'
    },
    'ukg': {
      name: 'UKG',
      weaknesses: [
        'Enterprise pricing for mid-market clients',
        'Implementation timelines drag 6-9 months',
        'Clients report feeling under-resourced post-go-live',
        'Platform complexity overwhelming for <500 EE companies'
      ],
      adpAdvantages: [
        'Purpose-built mid-market platform (50-999 EEs sweet spot)',
        'Average 90-day implementation timeline',
        'Dedicated Account Manager from day 1',
        'Transparent pricing with no hidden enterprise fees'
      ],
      positioning: 'Enterprise complexity and pricing. Mid-market clients feel like small fish with dragging implementations.'
    },
    'dayforce': {
      name: 'Dayforce',
      weaknesses: [
        'Requires heavy IT involvement',
        'Steep learning curve for HR teams',
        'Implementation costs 2-3x initial quotes',
        'Significant internal expertise required post-launch'
      ],
      adpAdvantages: [
        'Business-user focused — HR teams drive it, not IT',
        'Intuitive interface with 2-hour user onboarding',
        'All-inclusive implementation pricing',
        'ADP manages system updates and maintenance'
      ],
      positioning: 'Real-time processing marketing is aggressive but requires heavy IT lift and steep learning curve.'
    },
    'workday': {
      name: 'Workday',
      weaknesses: [
        'Built for 5,000+ employee enterprises',
        'Mid-market clients overpay for unused features',
        'Configuration complexity requires consultants',
        'Annual costs often exceed $500K for <1,000 EEs'
      ],
      adpAdvantages: [
        'Right-sized for mid-market (50-999 employees)',
        'Pre-configured best practices, not blank canvas',
        'Transparent pricing starting at $12-18 PEPM',
        'No consultant dependency for routine changes'
      ],
      positioning: 'Enterprise-grade platform priced for enterprise. Mid-market overpays for complexity they never use.'
    },
    'paychex': {
      name: 'Paychex',
      weaknesses: [
        'PEO lacks carrier scale vs ADP TotalSource',
        'Thin benefits breadth and carrier options',
        'Compliance support reactive, not proactive',
        'HR support model is call-center not dedicated partner'
      ],
      adpAdvantages: [
        'TotalSource: largest PEO in US (650,000 worksite employees)',
        'Fortune 500 carrier access at SMB scale',
        'Dedicated HR Business Partner model',
        'Proactive compliance alerts and state-by-state monitoring'
      ],
      positioning: 'PEO offering lacks the carrier scale, benefits breadth, and dedicated HR depth of TotalSource.'
    },
    'justworks': {
      name: 'Justworks',
      weaknesses: [
        'Real ceiling at 100 employees',
        'Thinner HR support vs dedicated partner model',
        'Fewer benefit carrier options',
        'Limited customization for growing companies'
      ],
      adpAdvantages: [
        'Built for 10-500 employee companies (growth tier)',
        'Dedicated HR Business Partner from day 1',
        'National carrier portfolio with regional options',
        'Custom plan design as company scales'
      ],
      positioning: 'Built for startups, hits ceiling past 100 employees. HR support and benefits options thin out.'
    },
    'rippling': {
      name: 'Rippling',
      weaknesses: [
        'IT-forward — counterintuitive for HR teams',
        'PEO capabilities newer and less battle-tested',
        'Benefits administration learning curve steep',
        'Support quality inconsistent during scale-up'
      ],
      adpAdvantages: [
        'HR-native platform — designed for HR workflows',
        '50+ years PEO experience with TotalSource',
        'Benefits admin rated #1 by HR teams',
        'Support model scales with client complexity'
      ],
      positioning: 'Tech-buyer platform. HR teams find it counterintuitive and PEO is newer vs TotalSource track record.'
    },
    'trinet': {
      name: 'TriNet',
      weaknesses: [
        'Concentrated in tech and professional services',
        'Vertical model limiting outside core industries',
        'Effectiveness drops past 500 employees',
        'Benefits carriers skew to CA/tech hubs'
      ],
      adpAdvantages: [
        'Industry-agnostic platform (manufacturing to healthcare)',
        'Carrier portfolio covers all 50 states equally',
        'Built to scale from 10 to 999 employees',
        'No vertical lock-in or industry restrictions'
      ],
      positioning: 'Vertical model works in tech/professional services but limiting outside those or past 500 EEs.'
    },
    'insperity': {
      name: 'Insperity',
      weaknesses: [
        'Higher cost structure vs TotalSource',
        'Tech stack aging vs modern HR platforms',
        'Mobile/self-service capabilities lag',
        'Smaller carrier footprint'
      ],
      adpAdvantages: [
        'Competitive PEO pricing with transparent quotes',
        'Modern tech platform with mobile-first design',
        'Employee self-service rated 4.6/5',
        'Largest PEO carrier network in US'
      ],
      positioning: 'Higher cost structure with tech that hasn\'t kept pace with modern HR expectations.'
    },
    'bamboohr': {
      name: 'BambooHR',
      weaknesses: [
        'HRIS only — no payroll, benefits admin, or compliance',
        'Requires integrations with 3-5 vendors for full HCM',
        'Data syncing errors between systems',
        'No single source of truth'
      ],
      adpAdvantages: [
        'Unified platform — payroll, HR, benefits, compliance in one',
        'Single database eliminates sync errors',
        'One vendor relationship, one support number',
        'Pre-integrated modules vs bolt-on marketplace'
      ],
      positioning: 'HRIS-only tool requires 3-5 vendor integrations for full HCM. ADP is unified single platform.'
    },
    'isolved': {
      name: 'isolved',
      weaknesses: [
        'Reseller network creates inconsistent support',
        'Implementation quality varies by partner',
        'No direct relationship with platform provider',
        'Pricing lacks transparency'
      ],
      adpAdvantages: [
        'Direct ADP relationship — no middleman resellers',
        'Consistent implementation standards nationwide',
        'Transparent pricing and support SLAs',
        'Single escalation path for all issues'
      ],
      positioning: 'Reseller network means inconsistent implementation and support quality. No direct vendor relationship.'
    },
    'manual': {
      name: 'Manual/Spreadsheets',
      weaknesses: [
        'Massive compliance exposure (ACA, I-9, multi-state)',
        'Error-prone manual data entry',
        'No audit trail for DOL/IRS',
        'Time theft via manual timecards',
        'Benefits enrollment errors common'
      ],
      adpAdvantages: [
        'Automated compliance tracking (ACA, I-9, state-specific)',
        'Single-entry payroll with validation rules',
        'Complete audit trail for government reporting',
        'Biometric time clocks eliminate buddy punching',
        'Online benefits enrollment with eligibility validation'
      ],
      positioning: 'Running HR on spreadsheets creates legal and financial risk. Compliance exposure is real.'
    },
    // ── Existing ADP clients (upsell scenarios) ────────────────────
    'adp_run': {
      name: 'ADP RUN',
      weaknesses: [
        'Built for <50 employees',
        'Limited HR module depth',
        'No benefits administration',
        'Basic time tracking only',
        'Compliance tools thin at scale'
      ],
      adpAdvantages: [
        'WFN enterprise depth at mid-market price',
        'Full benefits admin with carrier connections',
        'Advanced time & scheduling with mobile app',
        'Dedicated support tier upgrade',
        'SmartCompliance for multi-state operations'
      ],
      positioning: 'Existing RUN client has outgrown it. WFN/TotalSource gives enterprise infrastructure RUN can\'t match.',
      isADP: true
    },
    'adp_wfn': {
      name: 'ADP WorkforceNow',
      weaknesses: [
        'Missing PEO co-employment benefits',
        'Self-managing workers comp',
        'Benefits costs not pooled',
        'No dedicated HR Business Partner',
        'Shared employment liability exposure'
      ],
      adpAdvantages: [
        'TotalSource adds Fortune 500 benefits at SMB scale',
        'Workers comp managed by ADP with better rates',
        'Pooled benefits purchasing power',
        'Dedicated HR Business Partner included',
        'Shared liability model reduces exposure'
      ],
      positioning: 'Existing WFN client. TotalSource adds co-employment layer — upgrade not replacement.',
      isADP: true
    },
    'adp_totalsource': {
      name: 'ADP TotalSource',
      weaknesses: [
        'May not be using full module suite',
        'New entities could be added',
        'Additional states may need coverage'
      ],
      adpAdvantages: [
        'Expand to new locations/entities',
        'Add Talent or Learning modules',
        'Increase HR Business Partner engagement',
        'Advanced analytics and reporting'
      ],
      positioning: 'Existing TotalSource client. Retention and expansion play — reinforce value and identify gaps.',
      isADP: true
    }
  };

  // ── PAIN POINT SOLUTION MAPPING ──────────────────────────────────
  const PAIN_SOLUTIONS = {
    'Multi-state tax issues': {
      solution: 'SmartCompliance auto-files in all 50 states',
      impact: 'Eliminates state tax penalties (avg $25K annually for 150-EE companies)',
      adpFeature: 'ADP Tax Service handles registration, filing, payments, and notices',
      evidence: 'Manual multi-state tax management'
    },
    'Manual/spreadsheet processes': {
      solution: 'Single-entry payroll with automated calculations',
      impact: 'Reduces payroll processing time by 60% (8 hours to 3 hours per cycle)',
      adpFeature: 'ADP WorkforceNow unified platform eliminates duplicate data entry',
      evidence: 'Spreadsheet-based payroll or HR processes'
    },
    'ACA compliance problems': {
      solution: 'Automated ACA tracking and 1095 generation',
      impact: 'Eliminates IRS penalties (avg $280 per employee for non-compliance)',
      adpFeature: 'SmartCompliance ACA Dashboard with real-time eligibility monitoring',
      evidence: 'ACA compliance tracking issues'
    },
    'Benefits payment errors': {
      solution: 'Integrated benefits admin with carrier connections',
      impact: 'Reduces benefits errors by 95% and admin time by 40%',
      adpFeature: 'ADP Benefits Administration with 200+ carrier integrations',
      evidence: 'Manual benefits enrollment or carrier data errors'
    },
    'Workers Comp issues': {
      solution: 'TotalSource manages workers comp with pooled rates',
      impact: 'Average 15-25% reduction in workers comp premiums',
      adpFeature: 'PEO co-employment model with master policy access',
      evidence: 'High workers comp costs or claims management issues'
    },
    'Platform failures': {
      solution: '99.9% uptime SLA with redundant infrastructure',
      impact: 'Eliminates payroll delays and system downtime',
      adpFeature: 'Enterprise-grade cloud platform with guaranteed uptime',
      evidence: 'Current system outages or reliability issues'
    },
    'Poor support/communication': {
      solution: 'Dedicated Account Manager and 24/7 certified payroll support',
      impact: 'Average response time under 2 hours for critical issues',
      adpFeature: 'Tiered support model scales with client complexity',
      evidence: 'Support quality complaints or slow response times'
    },
    'GL integration errors': {
      solution: '150+ pre-built GL integrations with automated sync',
      impact: 'Eliminates manual GL reconciliation (saves 4-6 hours per cycle)',
      adpFeature: 'ADP Marketplace with certified accounting integrations',
      evidence: 'Manual GL posting or reconciliation errors'
    },
    'I-9 / E-Verify errors': {
      solution: 'Digital I-9 with E-Verify integration and audit alerts',
      impact: 'Eliminates ICE penalties (up to $2,400 per I-9 violation)',
      adpFeature: 'ADP SmartCompliance I-9 Management',
      evidence: 'Manual I-9 tracking or E-Verify gaps'
    },
    'Slow/manual onboarding': {
      solution: 'Digital onboarding with e-signature and auto-provisioning',
      impact: 'Reduces time-to-productivity by 50% (10 days to 5 days)',
      adpFeature: 'ADP Onboarding with workflow automation',
      evidence: 'Paper-based or manual onboarding processes'
    },
    'Weak reporting/analytics': {
      solution: 'Real-time dashboards with 200+ pre-built reports',
      impact: 'Reduces report generation time by 80% and improves decision speed',
      adpFeature: 'ADP DataCloud with custom analytics',
      evidence: 'Limited reporting or manual report creation'
    },
    'No mobile/self-service': {
      solution: 'Mobile app with employee/manager self-service',
      impact: 'Reduces HR ticket volume by 70% (employee self-service adoption)',
      adpFeature: 'ADP Mobile app rated 4.6/5 stars',
      evidence: 'No employee self-service or mobile access'
    },
    'High turnover/retention': {
      solution: 'Talent Management suite with performance and learning',
      impact: 'Reduces turnover by 15-30% through structured development',
      adpFeature: 'ADP Performance Management and Learning Management',
      evidence: 'Retention issues or lack of talent development tools'
    },
    'General compliance risk': {
      solution: 'Comprehensive compliance monitoring across federal/state/local',
      impact: 'Proactive alerts prevent penalties (avg $50K saved annually)',
      adpFeature: 'SmartCompliance with dedicated compliance analysts',
      evidence: 'Compliance concerns or reactive approach'
    },
    'Multi-entity complexity': {
      solution: 'Multi-company/multi-state management in single platform',
      impact: 'Consolidates 3-5 separate systems into one unified view',
      adpFeature: 'ADP Enterprise HCM with entity hierarchy',
      evidence: 'Multiple entities or state operations'
    },
    'Benefits cost too high': {
      solution: 'TotalSource pooled purchasing power (650K worksite employees)',
      impact: 'Average 20-30% reduction in benefits costs vs individual policies',
      adpFeature: 'Fortune 500 carrier access at SMB scale',
      evidence: 'Rising benefits costs or limited carrier options'
    },
    'HR team overwhelmed': {
      solution: 'Dedicated HR Business Partner + self-service automation',
      impact: 'Reduces HR admin work by 40% freeing time for strategy',
      adpFeature: 'TotalSource HR Business Partner model',
      evidence: 'HR bandwidth constraints or administrative overload'
    }
  };

  // ── STATE COMPLIANCE INSIGHTS ─────────────────────────────────────
  const STATE_COMPLIANCE = {
    'VA': {
      regulations: ['Virginia Wage Payment Act', 'VOSH workplace safety', 'Virginia Unemployment Tax'],
      risks: 'Virginia requires semi-monthly pay for manufacturers, strict wage payment timing, and active VOSH inspections',
      adpSolution: 'ADP SmartCompliance monitors VA-specific requirements and auto-adjusts payroll schedules'
    },
    'MD': {
      regulations: ['Maryland Healthy Working Families Act', 'MD Wage and Hour Law', 'Montgomery County paid leave'],
      risks: 'Maryland has county-level sick leave mandates that vary by location — manual tracking creates exposure',
      adpSolution: 'ADP tracks county-specific accruals and enforces Maryland wage payment requirements'
    },
    'DC': {
      regulations: ['DC Paid Family Leave', 'DC Sick Leave Act', 'DC Wage Theft Prevention'],
      risks: 'DC has strictest paid leave mandates in region with complex notice requirements',
      adpSolution: 'ADP automates DC-PFL contributions and tracks notice/posting compliance'
    },
    'PA': {
      regulations: ['PA Wage Payment Law', 'Philadelphia Wage Tax', 'Local EIT variations'],
      risks: 'Pennsylvania has 500+ local tax jurisdictions — incorrect withholding creates penalties',
      adpSolution: 'ADP Tax Service handles all PA local tax filings automatically'
    },
    'NY': {
      regulations: ['NY Paid Sick Leave', 'NY Paid Family Leave', 'NYC Fair Workweek'],
      risks: 'New York layered mandates (state + NYC) with weekly wage payment requirements',
      adpSolution: 'ADP monitors NY state and NYC-specific requirements with automated accruals'
    },
    'NJ': {
      regulations: ['NJ Earned Sick Leave', 'NJ Family Leave Insurance', 'NJ Wage and Hour'],
      risks: 'NJ sick leave mandate applies to all employers with complex accrual rules',
      adpSolution: 'ADP automates NJ sick leave tracking and FLI contributions'
    },
    'CA': {
      regulations: ['CA Paid Sick Leave', 'CA Paid Family Leave', 'PAGA litigation risk'],
      risks: 'California has highest wage and hour litigation risk — PAGA claims average $500K+',
      adpSolution: 'ADP SmartCompliance includes CA-specific meal/rest break tracking and PAGA audit defense'
    },
    'TX': {
      regulations: ['TX Workers Comp (optional)', 'Local hiring ordinances', 'I-9/E-Verify requirements'],
      risks: 'Texas is non-subscriber state — workers comp optional but creates liability exposure',
      adpSolution: 'TotalSource PEO provides workers comp coverage with master policy access'
    },
    'FL': {
      regulations: ['FL Unemployment Tax', 'Local wage ordinances', 'E-Verify requirements'],
      risks: 'Florida E-Verify mandate for public contractors and strict UI tax compliance',
      adpSolution: 'ADP E-Verify integration and FL UI tax management'
    },
    'DEFAULT': {
      regulations: ['Federal FLSA', 'ACA compliance', 'I-9/E-Verify'],
      risks: 'Multi-state operations create complexity with overlapping federal and state requirements',
      adpSolution: 'ADP SmartCompliance monitors federal and state-specific regulations'
    }
  };

  // ── INDUSTRY BENCHMARKS ───────────────────────────────────────────
  const INDUSTRY_BENCHMARKS = {
    'Manufacturing': {
      avgHCMCost: 18,
      painPoints: ['Multi-state tax', 'Workers comp', 'Shift scheduling', 'Safety compliance'],
      peoCostSavings: '22-28%',
      topBenefit: 'Workers comp pooled rates'
    },
    'Healthcare': {
      avgHCMCost: 22,
      painPoints: ['Shift scheduling', 'Compliance', 'Benefits admin', 'High turnover'],
      peoCostSavings: '18-25%',
      topBenefit: 'Compliance monitoring and benefits admin'
    },
    'Professional Services': {
      avgHCMCost: 16,
      painPoints: ['Project tracking', 'Time billing', 'Talent retention', 'Benefits costs'],
      peoCostSavings: '20-30%',
      topBenefit: 'Benefits cost reduction'
    },
    'Retail': {
      avgHCMCost: 14,
      painPoints: ['High turnover', 'Scheduling', 'Wage and hour', 'Multi-location'],
      peoCostSavings: '15-22%',
      topBenefit: 'Automated scheduling and wage compliance'
    },
    'Technology': {
      avgHCMCost: 20,
      painPoints: ['Talent acquisition', 'Benefits expectations', 'Equity management', 'Remote workforce'],
      peoCostSavings: '18-25%',
      topBenefit: 'Competitive benefits and talent tools'
    },
    'Construction': {
      avgHCMCost: 16,
      painPoints: ['Workers comp', 'Certified payroll', 'Multi-state', 'Prevailing wage'],
      peoCostSavings: '25-35%',
      topBenefit: 'Workers comp and certified payroll'
    },
    'Hospitality': {
      avgHCMCost: 15,
      painPoints: ['Tip reporting', 'High turnover', 'Scheduling', 'Wage and hour'],
      peoCostSavings: '18-24%',
      topBenefit: 'Tip management and scheduling'
    },
    'Financial Services': {
      avgHCMCost: 19,
      painPoints: ['Compliance', 'Security', 'Benefits', 'Talent retention'],
      peoCostSavings: '15-22%',
      topBenefit: 'Security and compliance'
    },
    'DEFAULT': {
      avgHCMCost: 17,
      painPoints: ['Compliance', 'Benefits admin', 'Payroll accuracy'],
      peoCostSavings: '20-25%',
      topBenefit: 'Unified platform efficiency'
    }
  };

  // ══════════════════════════════════════════════════════════════════
  // MAIN INTEL AGGREGATION FUNCTION
  // ══════════════════════════════════════════════════════════════════

  window.buildEmailIntelContext = function(prospect) {
    if (!prospect) {
      console.warn('[buildEmailIntelContext] No prospect provided');
      return null;
    }

    const context = {
      // ── Core Firmographic ────────────────────────────────────────
      firstName: prospect.contact ? prospect.contact.split(' ')[0] : 'there',
      lastName: prospect.contact ? prospect.contact.split(' ').slice(1).join(' ') : '',
      fullName: prospect.contact || '',
      companyName: prospect.company || '[Company]',
      title: prospect.persona || 'HR/Finance decision-maker',
      headcount: prospect.headcount || '',
      industry: prospect.industry || 'their industry',
      state: prospect.state || 'Mid-Atlantic',
      email: prospect.email || '',
      phone: prospect.phone || '',
      
      // ── Headcount Analysis ────────────────────────────────────────
      headcountBand: null,
      headcountTier: null,
      
      // ── Track & Product ───────────────────────────────────────────
      track: prospect.track || 'WFN',
      trackLabel: prospect.track === 'TS' ? 'TotalSource PEO' : 'WorkforceNow',
      
      // ── Competitive Intelligence ──────────────────────────────────
      competitor: null,
      competitorData: null,
      isExistingADP: false,
      
      // ── Pain Points & Solutions ───────────────────────────────────
      painPoints: [],
      painPointsData: [],
      topPainPoint: null,
      
      // ── Buying Signals & Timeline ─────────────────────────────────
      timeline: null,
      budget: null,
      stage: null,
      champion: null,
      economicBuyer: null,
      
      // ── State Compliance ──────────────────────────────────────────
      stateCompliance: null,
      
      // ── Industry Benchmark ────────────────────────────────────────
      industryBenchmark: null,
      
      // ── AI-Discovered Intel ───────────────────────────────────────
      aiIntel: {
        revenue: null,
        growth: null,
        buyingSignals: [],
        keyQuotes: [],
        additionalContext: null
      },
      
      // ── Extended Profile Data ─────────────────────────────────────
      extendedProfile: null,
      
      // ── Gong Transcript Data ──────────────────────────────────────
      gongData: null,
      
      // ── Current ADP Products (for existing clients) ───────────────
      currentADPProducts: [],
      upsellOpportunity: null
    };

    // ── Process Headcount Band ────────────────────────────────────
    if (prospect.headcount && parseInt(prospect.headcount) > 0) {
      const hc = parseInt(prospect.headcount);
      const low = Math.max(1, Math.round(hc * 0.85));
      const high = Math.round(hc * 1.15);
      let tier = '';
      if (hc < 10) tier = 'micro-employer';
      else if (hc < 50) tier = 'small business';
      else if (hc < 150) tier = 'lower mid-market';
      else if (hc < 500) tier = 'mid-market';
      else if (hc < 1000) tier = 'upper mid-market';
      else tier = 'enterprise';
      
      context.headcountBand = `${low}–${high} employees`;
      context.headcountTier = tier;
    }

    // ── Process Competitor Intelligence ───────────────────────────
    if (prospect.competitor) {
      const compKey = prospect.competitor.toLowerCase().replace(/\s+/g, '_');
      const compData = COMP_INTEL[compKey];
      
      if (compData) {
        context.competitor = compData.name;
        context.competitorData = compData;
        context.isExistingADP = compData.isADP || false;
      } else {
        context.competitor = prospect.competitor;
      }
    }

    // ── Process Pain Points ───────────────────────────────────────
    if (prospect.painPoints && Array.isArray(prospect.painPoints) && prospect.painPoints.length > 0) {
      context.painPoints = prospect.painPoints;
      
      // Map pain points to solutions
      context.painPointsData = prospect.painPoints.map(function(pp) {
        const solutionData = PAIN_SOLUTIONS[pp];
        return {
          painPoint: pp,
          solution: solutionData ? solutionData.solution : null,
          impact: solutionData ? solutionData.impact : null,
          adpFeature: solutionData ? solutionData.adpFeature : null,
          evidence: solutionData ? solutionData.evidence : null
        };
      }).filter(function(pd) { return pd.solution !== null; });
      
      // Set top pain point (first one)
      if (context.painPointsData.length > 0) {
        context.topPainPoint = context.painPointsData[0];
      }
    }

    // ── Process Extended Profile ─────────────────────────────────
    if (prospect.extProfile) {
      context.extendedProfile = prospect.extProfile;
      context.timeline = prospect.extProfile.timeline || null;
      context.budget = prospect.extProfile.budget || null;
      context.stage = prospect.extProfile.stage || null;
      context.champion = prospect.extProfile.champion || null;
      context.economicBuyer = prospect.extProfile.econBuyer || null;
      
      // AI Intel from extended profile
      if (prospect.extProfile.revenue) context.aiIntel.revenue = prospect.extProfile.revenue;
      if (prospect.extProfile.growth) context.aiIntel.growth = prospect.extProfile.growth;
    }

    // ── Process State Compliance ──────────────────────────────────
    if (prospect.state) {
      const stateData = STATE_COMPLIANCE[prospect.state] || STATE_COMPLIANCE['DEFAULT'];
      context.stateCompliance = stateData;
    }

    // ── Process Industry Benchmark ────────────────────────────────
    if (prospect.industry) {
      const industryData = INDUSTRY_BENCHMARKS[prospect.industry] || INDUSTRY_BENCHMARKS['DEFAULT'];
      context.industryBenchmark = industryData;
    }

    // ── Process ADP Products (for existing clients) ───────────────
    if (prospect.adpProducts && Array.isArray(prospect.adpProducts)) {
      context.currentADPProducts = prospect.adpProducts;
      
      // Identify upsell opportunities
      if (context.isExistingADP && context.competitorData) {
        context.upsellOpportunity = {
          currentProduct: context.competitor,
          advantages: context.competitorData.adpAdvantages,
          positioning: context.competitorData.positioning
        };
      }
    }

    // ── Process MCA Result (if exists) ────────────────────────────
    if (prospect.mcaResult) {
      // MCA result already contains competitive analysis
      // Could be used to enhance competitive positioning
      context.mcaAnalysis = prospect.mcaResult;
    }

    return context;
  };

  // ══════════════════════════════════════════════════════════════════
  // SMART SUGGESTION ENGINE
  // Suggests what to include in email based on context
  // ══════════════════════════════════════════════════════════════════

  window.getEmailIntelSuggestions = function(intelContext) {
    if (!intelContext) return [];
    
    const suggestions = [];

    // ── Competitor-based suggestions ──────────────────────────────
    if (intelContext.competitorData && intelContext.competitorData.weaknesses) {
      suggestions.push({
        type: 'competitive',
        icon: '⚔️',
        title: 'Competitive Positioning Available',
        description: `${intelContext.competitor} weakness: ${intelContext.competitorData.weaknesses[0]}`,
        token: '{{competitorWeakness}}',
        value: intelContext.competitorData.weaknesses[0]
      });
    }

    // ── Pain point suggestions ────────────────────────────────────
    if (intelContext.topPainPoint) {
      suggestions.push({
        type: 'pain',
        icon: '🎯',
        title: 'Top Pain Point Identified',
        description: intelContext.topPainPoint.painPoint,
        token: '{{topPainPoint}}',
        value: intelContext.topPainPoint.painPoint,
        solution: intelContext.topPainPoint.solution,
        impact: intelContext.topPainPoint.impact
      });
    }

    // ── Timeline/urgency suggestions ──────────────────────────────
    if (intelContext.timeline) {
      suggestions.push({
        type: 'urgency',
        icon: '⏰',
        title: 'Timeline Identified',
        description: intelContext.timeline,
        token: '{{timeline}}',
        value: intelContext.timeline
      });
    }

    // ── Budget/ROI suggestions ────────────────────────────────────
    if (intelContext.budget) {
      suggestions.push({
        type: 'budget',
        icon: '💰',
        title: 'Budget Context Available',
        description: intelContext.budget,
        token: '{{budget}}',
        value: intelContext.budget
      });
    }

    // ── State compliance suggestions ──────────────────────────────
    if (intelContext.stateCompliance && intelContext.state !== 'Mid-Atlantic') {
      suggestions.push({
        type: 'compliance',
        icon: '⚖️',
        title: `${intelContext.state} Compliance Risk`,
        description: intelContext.stateCompliance.risks,
        token: '{{stateCompliance}}',
        value: intelContext.stateCompliance.risks
      });
    }

    // ── Industry benchmark suggestions ────────────────────────────
    if (intelContext.industryBenchmark && intelContext.headcount) {
      const hc = parseInt(intelContext.headcount);
      const avgCost = intelContext.industryBenchmark.avgHCMCost;
      const totalCost = hc * avgCost;
      suggestions.push({
        type: 'benchmark',
        icon: '📊',
        title: 'Industry Benchmark Available',
        description: `Avg HCM cost: $${avgCost} PEPM ($${totalCost.toLocaleString()}/yr for ${hc} EEs)`,
        token: '{{industryBenchmark}}',
        value: `$${avgCost} per employee per month`
      });
    }

    // ── Champion/buyer suggestions ────────────────────────────────
    if (intelContext.champion || intelContext.economicBuyer) {
      const contact = intelContext.champion || intelContext.economicBuyer;
      suggestions.push({
        type: 'stakeholder',
        icon: '👤',
        title: 'Key Stakeholder Identified',
        description: contact,
        token: '{{champion}}',
        value: contact
      });
    }

    return suggestions;
  };

  // ══════════════════════════════════════════════════════════════════
  // TOKEN RESOLVER
  // Resolves template tokens to actual values
  // ══════════════════════════════════════════════════════════════════

  window.resolveEmailTokens = function(text, intelContext) {
    if (!text || !intelContext) return text;

    let resolved = text;

    // ── Basic firmographic tokens ─────────────────────────────────
    resolved = resolved.replace(/\{\{firstName\}\}/g, intelContext.firstName || 'there');
    resolved = resolved.replace(/\{\{lastName\}\}/g, intelContext.lastName || '');
    resolved = resolved.replace(/\{\{fullName\}\}/g, intelContext.fullName || '');
    resolved = resolved.replace(/\{\{companyName\}\}/g, intelContext.companyName || '[Company]');
    resolved = resolved.replace(/\{\{title\}\}/g, intelContext.title || '');
    resolved = resolved.replace(/\{\{headcount\}\}/g, intelContext.headcount || '');
    resolved = resolved.replace(/\{\{headcountBand\}\}/g, intelContext.headcountBand || '');
    resolved = resolved.replace(/\{\{industry\}\}/g, intelContext.industry || '');
    resolved = resolved.replace(/\{\{state\}\}/g, intelContext.state || '');

    // ── Competitive tokens ────────────────────────────────────────
    if (intelContext.competitor) {
      resolved = resolved.replace(/\{\{competitor\}\}/g, intelContext.competitor);
    }
    if (intelContext.competitorData) {
      resolved = resolved.replace(/\{\{competitorWeakness\}\}/g, 
        intelContext.competitorData.weaknesses ? intelContext.competitorData.weaknesses[0] : '');
      resolved = resolved.replace(/\{\{adpAdvantage\}\}/g, 
        intelContext.competitorData.adpAdvantages ? intelContext.competitorData.adpAdvantages[0] : '');
    }

    // ── Pain point tokens ─────────────────────────────────────────
    if (intelContext.topPainPoint) {
      resolved = resolved.replace(/\{\{topPainPoint\}\}/g, intelContext.topPainPoint.painPoint || '');
      resolved = resolved.replace(/\{\{painSolution\}\}/g, intelContext.topPainPoint.solution || '');
      resolved = resolved.replace(/\{\{painImpact\}\}/g, intelContext.topPainPoint.impact || '');
    }

    // ── Timeline/budget tokens ────────────────────────────────────
    resolved = resolved.replace(/\{\{timeline\}\}/g, intelContext.timeline || '');
    resolved = resolved.replace(/\{\{budget\}\}/g, intelContext.budget || '');
    resolved = resolved.replace(/\{\{stage\}\}/g, intelContext.stage || '');
    resolved = resolved.replace(/\{\{champion\}\}/g, intelContext.champion || '');
    resolved = resolved.replace(/\{\{economicBuyer\}\}/g, intelContext.economicBuyer || '');

    // ── State compliance tokens ───────────────────────────────────
    if (intelContext.stateCompliance) {
      resolved = resolved.replace(/\{\{stateCompliance\}\}/g, intelContext.stateCompliance.risks || '');
      resolved = resolved.replace(/\{\{stateRegulations\}\}/g, 
        intelContext.stateCompliance.regulations ? intelContext.stateCompliance.regulations.join(', ') : '');
    }

    // ── Track tokens ──────────────────────────────────────────────
    resolved = resolved.replace(/\{\{track\}\}/g, intelContext.track || 'WFN');
    resolved = resolved.replace(/\{\{trackLabel\}\}/g, intelContext.trackLabel || 'WorkforceNow');

    return resolved;
  };

  console.log('[Intel Context Engine] Loaded successfully');

})();
