# Market Intelligence Fix - Anti-Repetition Guide
## For BeyondPayroll Sales HQ MCP Server

---

## 🎯 Problem Statement

**Current Issue:** The market & competitive intelligence agent produces **repetitive, generic analysis** that doesn't pull **real-time data** from active sources.

**Symptoms:**
- Similar language across multiple reports
- Generic statements like "continues to focus on..."
- No specific dates or sources
- Doesn't detect week-over-week changes
- Hallucinated features or pricing

**Root Cause:** RSS feed and news searches aren't date-filtered, and there's no comparison logic to detect what's actually NEW.

---

## 🔧 Solution Overview

### Three-Part Fix:

1. **Date-Filtered Searches** - Only pull data from last 7 days
2. **Timestamp Storage** - Save findings with dates for comparison
3. **Change Detection** - Compare new data to previous week before outputting

---

## 📋 Implementation Steps

### Part 1: Date-Filtered Google News

**Current Code (WRONG):**
```javascript
async function fetchCompetitorNews(competitor) {
  const query = `"${competitor}" (HCM OR payroll OR PEO OR HR)`;
  const results = await searchGoogleNews(query);
  return results;
}
```

**Fixed Code (RIGHT):**
```javascript
async function fetchCompetitorNews(competitor) {
  const today = new Date();
  const sevenDaysAgo = new Date(today - 7 * 24 * 60 * 60 * 1000);
  const dateStr = sevenDaysAgo.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Force date filter in search query
  const query = `"${competitor}" (HCM OR payroll OR PEO OR HR) after:${dateStr}`;
  const results = await searchGoogleNews(query);
  
  // Double-check: filter results by pubDate
  return results.filter(r => isWithinLast7Days(r.pubDate));
}

function isWithinLast7Days(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = (now - date) / (1000 * 60 * 60 * 24);
  return diffDays <= 7;
}
```

---

### Part 2: RSS Feed Date Parsing

**Current Code (WRONG):**
```javascript
async function fetchBlogPosts(competitor) {
  const feed = await fetch(competitor.rssUrl);
  const xml = await feed.text();
  const posts = parseRSS(xml);
  return posts; // Returns ALL posts, including old ones
}
```

**Fixed Code (RIGHT):**
```javascript
async function fetchBlogPosts(competitor) {
  const feed = await fetch(competitor.rssUrl);
  const xml = await feed.text();
  const posts = parseRSS(xml);
  
  // Filter to last 7 days only
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  return posts.filter(post => {
    const pubDate = new Date(post.pubDate || post.updated);
    return pubDate >= sevenDaysAgo;
  });
}
```

**Example RSS Feed URLs:**
```javascript
const COMPETITOR_FEEDS = {
  'Paycom': 'https://www.paycom.com/blog/feed/',
  'Paylocity': 'https://www.paylocity.com/blog/feed/',
  'UKG': 'https://www.ukg.com/blog/feed/',
  'Workday': 'https://blog.workday.com/feed/',
  'Justworks': 'https://justworks.com/blog/feed/',
  'Rippling': 'https://www.rippling.com/blog/feed/',
  'TriNet': 'https://www.trinet.com/insights/feed/',
  'Insperity': 'https://www.insperity.com/blog/feed/'
};
```

---

### Part 3: Week-Over-Week Storage & Comparison

**Storage Schema:**

```javascript
// localStorage key: bp_competitive_intel_YYYY-WW
// Example: bp_competitive_intel_2026-W12

{
  "timestamp": "2026-03-25T00:00:00Z",
  "week": "2026-W12",
  "competitors": {
    "Paycom": {
      "product_updates": [
        {
          "title": "GONE Feature Launch",
          "date": "2026-03-22",
          "source": "https://paycom.com/blog/gone-feature"
        }
      ],
      "pricing": null,
      "news": [
        {
          "title": "Forbes: Paycom Q1 Growth",
          "date": "2026-03-20",
          "source": "https://forbes.com/..."
        }
      ],
      "linkedin": [
        {
          "title": "New self-service features",
          "date": "2026-03-23",
          "engagement": "142 likes"
        }
      ]
    },
    "Paylocity": { ... }
  }
}
```

**Save Function:**

```javascript
function saveCompetitorIntel(weekNumber, competitor, findings) {
  const key = `bp_competitive_intel_${weekNumber}`;
  
  // Load existing week data
  const weekData = JSON.parse(localStorage.getItem(key) || '{}');
  
  // Initialize if first competitor
  if (!weekData.competitors) {
    weekData.timestamp = new Date().toISOString();
    weekData.week = weekNumber;
    weekData.competitors = {};
  }
  
  // Store competitor findings
  weekData.competitors[competitor] = findings;
  
  // Save back
  localStorage.setItem(key, JSON.stringify(weekData));
}
```

**Compare Function:**

```javascript
function compareToLastWeek(weekNumber, competitor, currentFindings) {
  const lastWeek = getPreviousWeek(weekNumber); // e.g., "2026-W11"
  const lastWeekKey = `bp_competitive_intel_${lastWeek}`;
  
  const lastWeekData = JSON.parse(localStorage.getItem(lastWeekKey) || '{}');
  const lastWeekFindings = lastWeekData.competitors?.[competitor] || {};
  
  const changes = [];
  
  // Compare product updates
  if (currentFindings.product_updates?.length > 0) {
    const lastUpdates = lastWeekFindings.product_updates || [];
    const newUpdates = currentFindings.product_updates.filter(curr => 
      !lastUpdates.some(last => last.title === curr.title)
    );
    
    if (newUpdates.length > 0) {
      changes.push('NEW Product: ' + newUpdates.map(u => u.title).join(', '));
    }
  }
  
  // Compare pricing
  if (currentFindings.pricing && currentFindings.pricing !== lastWeekFindings.pricing) {
    changes.push('PRICING CHANGE: ' + currentFindings.pricing);
  }
  
  // Compare news coverage
  if (currentFindings.news?.length > 0) {
    const lastNews = lastWeekFindings.news || [];
    const newNews = currentFindings.news.filter(curr =>
      !lastNews.some(last => last.title === curr.title)
    );
    
    if (newNews.length > 0) {
      changes.push('NEW Coverage: ' + newNews.length + ' articles');
    }
  }
  
  // If no changes
  if (changes.length === 0) {
    return 'No significant changes vs. last week';
  }
  
  return changes.join(' | ');
}
```

**Helper Functions:**

```javascript
function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return d.getFullYear() + '-W' + String(weekNo).padStart(2, '0');
}

function getPreviousWeek(weekString) {
  // "2026-W12" → "2026-W11"
  const [year, week] = weekString.split('-W').map(Number);
  if (week === 1) {
    return `${year - 1}-W52`;
  }
  return `${year}-W${String(week - 1).padStart(2, '0')}`;
}
```

---

### Part 4: Anti-Hallucination Output Logic

**Before Outputting ANY Finding:**

```javascript
function formatCompetitorSummary(competitor, findings, changes) {
  const summary = {
    name: competitor,
    sections: []
  };
  
  // Product Updates
  if (findings.product_updates && findings.product_updates.length > 0) {
    summary.sections.push({
      label: 'Product Updates',
      content: findings.product_updates.map(u => 
        `${u.title} (${u.date}) - ${u.source}`
      ).join('\n')
    });
  } else {
    summary.sections.push({
      label: 'Product Updates',
      content: 'No product updates this week'
    });
  }
  
  // Pricing
  if (findings.pricing) {
    summary.sections.push({
      label: 'Pricing Changes',
      content: findings.pricing
    });
  } else {
    summary.sections.push({
      label: 'Pricing Changes',
      content: 'No pricing signals this week'
    });
  }
  
  // News Coverage
  if (findings.news && findings.news.length > 0) {
    summary.sections.push({
      label: 'News Coverage',
      content: findings.news.map(n => 
        `${n.title} (${n.date}) - ${n.source}`
      ).join('\n')
    });
  } else {
    summary.sections.push({
      label: 'News Coverage',
      content: 'No news coverage this week'
    });
  }
  
  // Week-over-Week
  summary.sections.push({
    label: 'vs. Last Week',
    content: changes
  });
  
  return summary;
}
```

**Critical Rule:** NEVER output generic statements like:
- ❌ "Continues to focus on..."
- ❌ "Known for their..."
- ❌ "Typically targets..."

**Always output specific, dated, sourced information:**
- ✅ "Launched GONE feature (March 22, 2026 - company blog)"
- ✅ "No product updates this week"
- ✅ "Forbes coverage on Q1 growth (March 20, 2026)"

---

## 🎯 Integration Points

### Where to Apply These Fixes:

Based on your repo structure, you likely have these files:

1. **MCP Server File** (probably in `sales_cadence_mcp` folder)
   - Apply date-filtering to all search functions
   - Add storage functions for week-over-week tracking

2. **Market Analysis Functions** (might be in `app.js` or separate file)
   - Update any Google News search calls
   - Add RSS feed parsing with date filters

3. **Intelligence Display** (in `index.html` or `app.js`)
   - Update UI to show "Last updated: [date]"
   - Display week-over-week changes prominently

---

## 📊 Testing Your Fix

### Test 1: Date Filtering Works

```javascript
// In browser console
const results = await fetchCompetitorNews('Paycom');
console.log('Oldest result:', results[results.length - 1].pubDate);
// Should be within last 7 days
```

### Test 2: Storage & Retrieval

```javascript
// Save test data
saveCompetitorIntel('2026-W12', 'Paycom', {
  product_updates: [{ title: 'Test', date: '2026-03-25' }],
  pricing: null,
  news: [],
  linkedin: []
});

// Retrieve
const data = localStorage.getItem('bp_competitive_intel_2026-W12');
console.log(JSON.parse(data));
```

### Test 3: Week-Over-Week Comparison

```javascript
// Run report twice (different weeks)
// First run: Should show "Baseline week"
// Second run: Should show "NEW: [feature]" or "No changes"
```

### Test 4: No Hallucination

Run competitive intelligence report. **Verify:**
- Every finding has a date
- Every finding has a source URL
- If no findings: Says "No activity this week"
- No generic "continues to focus" language

---

## 🔄 Workflow After Fix

```
Monday Morning: Run Competitive Intel
    ↓
1. Calculate current week (e.g., "2026-W12")
2. Load last week's data (e.g., "2026-W11")
    ↓
For each competitor:
    3. Search Google News (last 7 days only)
    4. Fetch RSS feeds (last 7 days only)
    5. Check LinkedIn (last 7 days only)
    ↓
6. Compare findings to last week's stored data
7. Generate change summary (NEW/UPDATE/No changes)
    ↓
8. Output report with:
   - Specific findings (dated, sourced)
   - Week-over-week changes
   - "No activity" where appropriate
    ↓
9. Save findings to localStorage with timestamp
    ↓
Next Monday: Repeat (now has prior week for comparison)
```

---

## 📋 Quality Checklist

Before finalizing any report, verify:

- [ ] All Google News results have `pubDate` within last 7 days
- [ ] All RSS feed posts have `pubDate` within last 7 days
- [ ] Findings stored with timestamps in localStorage
- [ ] Week-over-week comparison references actual prior data
- [ ] No generic "continues to focus on" language
- [ ] Every claim has date + source
- [ ] "No activity this week" appears when true (not hallucinated content)
- [ ] At least 3 competitors have SOME new information OR report notes "Quiet week"

---

## 🎯 Success Metrics

After implementing this fix:

### Quantitative:
- ✅ 100% of findings have timestamps within last 7 days
- ✅ 80%+ of reports show at least ONE "NEW" or "UPDATE" item
- ✅ 0% generic statements without sources
- ✅ Week-over-week comparison present in 100% of reports

### Qualitative:
- ✅ Reports feel current and actionable
- ✅ Changes are obvious and meaningful
- ✅ Team can spot competitive threats quickly
- ✅ No repeated analysis week after week

---

## 🐛 Troubleshooting

### Issue: Still Getting Old Data

**Cause:** Date filter not applied or RSS parser ignoring dates

**Fix:**
1. Log the raw results before filtering: `console.log('Raw:', results)`
2. Check if `pubDate` field exists: `results[0].pubDate`
3. Verify date parsing: `new Date(results[0].pubDate)`
4. Add fallback date field: `post.pubDate || post.updated || post.published`

### Issue: Week-Over-Week Shows "No Changes" Incorrectly

**Cause:** Comparison logic too strict (exact title match)

**Fix:** Use fuzzy matching for titles:
```javascript
const isSimilar = (a, b) => {
  const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const aClean = normalize(a);
  const bClean = normalize(b);
  return aClean.includes(bClean) || bClean.includes(aClean);
};
```

### Issue: localStorage Growing Too Large

**Cause:** Storing every week forever

**Fix:** Implement cleanup (keep last 8 weeks only):
```javascript
function cleanupOldIntel() {
  const currentWeek = getISOWeek(new Date());
  const weekNum = parseInt(currentWeek.split('-W')[1]);
  
  for (let i = 9; i < 52; i++) {
    const oldWeek = currentWeek.replace(/W\d+$/, `W${String(weekNum - i).padStart(2, '0')}`);
    localStorage.removeItem(`bp_competitive_intel_${oldWeek}`);
  }
}
```

---

## 📞 Support

If you need help implementing:

1. **Identify your MCP server file** - Check `sales_cadence_mcp` folder
2. **Find search functions** - Look for Google News and RSS parsing
3. **Test incrementally** - Implement date filtering first, then storage, then comparison
4. **Use console logging** - Log each step to verify data flow

---

## 🎉 Expected Results

**Before Fix:**
```
Paycom: Continues to focus on their single-database architecture 
and employee self-service features. They target mid-market companies.
```

**After Fix:**
```
Paycom:
- Product: Launched "GONE" auto-approval feature (March 22, 2026)
  Source: https://paycom.com/blog/gone-feature
- News: Forbes article on Q1 growth (March 20, 2026)
  Source: https://forbes.com/paycom-q1-2026
- LinkedIn: 3 sponsored posts targeting HR Directors (500-2000 EE)
- vs. Last Week: NEW - GONE feature not in prior week's report
```

---

**Version:** 1.0  
**Date:** March 25, 2026  
**Status:** Implementation Ready ✅
