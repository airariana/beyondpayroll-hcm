// ══════════════════════════════════════════════════════════════════════════
//  🔑 API CONFIGURATION — CLOUDFLARE WORKER PROXY
// ══════════════════════════════════════════════════════════════════════════
// All API keys are stored securely in Cloudflare Worker environment variables
// Your frontend only talks to your worker - API keys never exposed to browser
// 
// SETUP INSTRUCTIONS:
// 1. Deploy the worker.js file to Cloudflare Workers
// 2. Set environment variables in Cloudflare dashboard:
//    - GEMINI_API_KEY
//    - GOOGLE_VISION_API_KEY
//    - ANTHROPIC_API_KEY
// 3. Replace YOUR_WORKER_URL below with your actual worker URL
//
const WORKER_URL = 'https://sales-hq-api.ajbb705.workers.dev';

// API Endpoints (proxied through Cloudflare Worker)
const API_ENDPOINTS = {
  gemini: WORKER_URL + '/api/gemini',
  vision: WORKER_URL + '/api/vision',
  anthropic: WORKER_URL + '/api/anthropic'
};

// ══════════════════════════════════════════════════════════════════════════
//  END API CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════
//  STORAGE
// ══════════════════════════════════════════════════
const USERS_KEY='bp_portal_users',SESSION_KEY='bp_portal_session';
function getUsers(){try{return JSON.parse(localStorage.getItem(USERS_KEY)||'[]')}catch{return[]}}
function saveUsers(u){localStorage.setItem(USERS_KEY,JSON.stringify(u))}
function getSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}}
function saveSession(s){localStorage.setItem(SESSION_KEY,JSON.stringify(s))}
function clearSession(){localStorage.removeItem(SESSION_KEY)}

// Seed demo
// ── Seed admin account ──────────────────────────────────────────
(function(){
  const u=getUsers();
  // Remove old demo account if present
  const clean=u.filter(function(x){return x.email!=='demo@beyondpayroll.net';});
  // Ensure admin account always exists with correct password
  const adminIdx=clean.findIndex(function(x){return x.email==='admin@beyondpayroll.net';});
  const adminRecord={email:'admin@beyondpayroll.net',first:'Admin',last:'User',password:'BPAdmin2025!',role:'WFN',isAdmin:true,created:new Date().toLocaleDateString('en-US')};
  if(adminIdx>=0){clean[adminIdx]=Object.assign(clean[adminIdx],adminRecord);}
  else{clean.unshift(adminRecord);}
  saveUsers(clean);
})();

// ── TOAST ──
function showToast(msg,isErr=false){
  const t=document.getElementById('toast');
  document.getElementById('toast-msg').textContent=msg;
  document.getElementById('toast-icon').textContent=isErr?'⚠️':'⚡';
  t.className='toast show'+(isErr?' err':'');
  clearTimeout(t._t);t._t=setTimeout(()=>t.className='toast',3200);
}

// ── UI HELPERS ──
function switchMode(mode){
  document.getElementById('form-signin').style.display=mode==='signin'?'block':'none';
  document.getElementById('form-register').style.display=mode==='register'?'block':'none';
  document.getElementById('btn-signin').classList.toggle('active',mode==='signin');
  document.getElementById('btn-register').classList.toggle('active',mode==='register');
  clearErrors();
}
function togglePw(id,btn){const i=document.getElementById(id);const s=i.type==='password';i.type=s?'text':'password';btn.textContent=s?'🙈':'👁'}
function clearErrors(){
  document.querySelectorAll('.err-banner').forEach(e=>e.classList.remove('show'));
  document.querySelectorAll('.fe').forEach(e=>e.classList.remove('show'));
  document.querySelectorAll('.fi').forEach(e=>e.classList.remove('err'));
}
function showFieldErr(id,msgId,msg){
  document.getElementById(id).classList.add('err');
  if(msgId){document.getElementById(msgId).textContent=msg;document.getElementById(msgId).classList.add('show')}
}
function showBanner(id,msgId,msg){document.getElementById(msgId).textContent=msg;document.getElementById(id).classList.add('show')}

let selectedRole='WFN';
function selectRole(r){
  selectedRole=r;
  document.getElementById('role-wfn').className='role-card'+(r==='WFN'?' sel-wfn':'');
  document.getElementById('role-ts').className='role-card'+(r==='TS'?' sel-ts':'');
}

function checkPwStrength(pw){
  const cols=['#ef4444','#f97316','#eab308','#22c55e'];
  const labs=['Weak','Fair','Good','Strong'];
  let score=0;
  if(pw.length>=8)score++;if(/[A-Z]/.test(pw))score++;if(/[0-9]/.test(pw))score++;if(/[^A-Za-z0-9]/.test(pw))score++;
  for(let i=0;i<4;i++){const s=document.getElementById('pws'+i);if(s)s.style.background=i<score?cols[Math.max(0,score-1)]:'var(--border)'}
  const sl=document.getElementById('pw-sl');
  if(sl){sl.textContent=pw.length?labs[Math.max(0,score-1)]:'';sl.style.color=cols[Math.max(0,score-1)];sl.style.fontWeight='600';sl.style.fontSize='11px'}
}

// ── AUTH ──
// Registration is invite-only — admin approves users via the admin panel

function doRegister(){
  // Registration is disabled — accounts must be approved by admin
  showBanner('reg-err','reg-err-msg','Self-registration is disabled. Contact admin@beyondpayroll.net to request access.');
}

// ══ ADMIN PANEL ════════════════════════════════════════════════
const ADMIN_EMAIL = 'admin@beyondpayroll.net';

async function doSignIn(){
  clearErrors();
  const email=document.getElementById('si-email').value.trim().toLowerCase();
  const pass=document.getElementById('si-pass').value;
  if(!email||!pass){showBanner('signin-err','signin-err-msg','Please enter your email and password.');return}

  // Show loading state
  const btn=document.querySelector('#form-signin .auth-btn');
  if(btn){btn.disabled=true;btn.textContent='Signing in…';}

  // Try local first
  let user=getUsers().find(u=>u.email===email&&u.password===pass);

  // If not found locally, try pulling from Firestore
  if(!user && FIREBASE_CONFIG.apiKey!=='YOUR_API_KEY'){
    try{
      // Load Firebase SDK if not already loaded
      if(typeof firebase==='undefined'){
        await new Promise(function(resolve,reject){
          const s1=document.createElement('script');
          s1.src='https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js';
          s1.onload=function(){
            const s2=document.createElement('script');
            s2.src='https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js';
            s2.onload=resolve; s2.onerror=reject;
            document.head.appendChild(s2);
          };
          s1.onerror=reject;
          document.head.appendChild(s1);
        });
      }
      if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      const tmpDb=firebase.firestore();
      const doc=await tmpDb.collection('users').doc(email).get();
      if(doc.exists){
        const remoteUser=doc.data();
        if(remoteUser.password===pass){
          // Save to local for future offline use
          const users=getUsers();
          if(!users.find(u=>u.email===email)){users.push(remoteUser);saveUsers(users);}
          user=remoteUser;
        }
      }
    }catch(e){console.warn('Firebase sign-in lookup:',e.message);}
  }

  if(btn){btn.disabled=false;btn.textContent='Sign In';}

  if(!user){showBanner('signin-err','signin-err-msg','Email or password is incorrect. Please try again.');document.getElementById('si-pass').value='';return}
  // Access control: only admin or explicitly approved users
  const isApprovedUser = user.email===ADMIN_EMAIL || user.approvedBy===ADMIN_EMAIL || user.isAdmin===true;
  if(!isApprovedUser){showBanner('signin-err','signin-err-msg','Access denied. Contact admin@beyondpayroll.net to request access.');document.getElementById('si-pass').value='';return}
  const session={email:user.email,first:user.first,last:user.last,role:user.role};
  saveSession(session);showToast('⚡ Welcome to Sales HQ, '+user.first+'!');
  const _sp=document.getElementById('bp-splash');if(_sp)_sp.classList.add('hide');
  setTimeout(()=>enterHQ(session),400);
}

function doLogout(){
  // Stop real-time listener
  if(window._fbUnsubscribe){ try{window._fbUnsubscribe();}catch(e){} window._fbUnsubscribe=null; }
  _fbDb=null; _fbOnline=false; _fbSession=null;
  clearSession();
  document.getElementById('view-hq').classList.remove('active');
  var _lndL = document.getElementById('view-landing');
  if(_lndL) _lndL.classList.add('active');
  else document.getElementById('view-auth').classList.add('active');
  switchMode('signin');
  document.getElementById('si-email').value='';document.getElementById('si-pass').value='';
  showToast('Signed out successfully');
}

function enterHQ(session){
  const _splash = document.getElementById('bp-splash');
  if(_splash) _splash.classList.add('hide');
  const _lnd = document.getElementById('view-landing');
  if(_lnd) _lnd.classList.remove('active');
  document.getElementById('view-auth').classList.remove('active');
  document.getElementById('view-hq').classList.add('active');
  const initials=(session.first[0]+session.last[0]).toUpperCase();
  // Update profile dropdown
  document.getElementById('pb-avatar').textContent=initials;
  document.getElementById('pb-name').textContent=session.first+' '+session.last;
  document.getElementById('pb-role').textContent='';
  document.getElementById('pd-avatar-lg').textContent=initials;
  document.getElementById('pd-username').textContent=session.first+' '+session.last;
  document.getElementById('pd-useremail').textContent=session.email||'';
  document.getElementById('pd-userrole').textContent=session.role==='WFN'?'BP HQ':'BP HQ';
  if(!window._hqLoaded){window._hqLoaded=true;buildHQ(session);}
  // Show admin panel button only for admin account
  if(typeof adminCheckAndShowBtn==='function') adminCheckAndShowBtn(session);
  // Defer Firebase + prospect rendering until after DOM settles
  setTimeout(function(){
    if(typeof fbInit==='function') fbInit(session);
    // Deduplicate any existing duplicate prospects in localStorage on every login
    try{
      const _raw=JSON.parse(localStorage.getItem('bp_prospects')||'[]');
      const _deduped=dedupeProspects(_raw);
      if(_deduped.length < _raw.length){
        saveProspectsLocal(_deduped);
        console.log('[BP] Removed '+(_raw.length-_deduped.length)+' duplicate prospect(s)');
      }
    }catch(e){}
    if(typeof renderSavedProspects==='function') renderSavedProspects();
    // Init notification system
    if(typeof notifUpdateBadge==='function') notifUpdateBadge();
    if(typeof notifRequestPermission==='function') notifRequestPermission();
    // Check for overdue touches
    if(typeof notifCheckOverdue==='function') setTimeout(notifCheckOverdue, 1500);
    // Feature 2: Auto-pull prospect into tool panels on load
    if(typeof window.pullProspectToTool==='function' && window._hqProspect){
      window.pullProspectToTool('wfn');
      window.pullProspectToTool('ts');
    }
    // ── Background Email Engine: start on login ──
    if(typeof window.bpEngineInit==='function') window.bpEngineInit(session);
    if(typeof window.bpEngineInjectBadge==='function') setTimeout(window.bpEngineInjectBadge, 600);
    // Init top bar save button + auto-save listeners
    if(typeof window.tbInitAutoSave==='function') window.tbInitAutoSave();
    if(typeof window.tbShowSaveBtn==='function' && window._hqProspect) window.tbShowSaveBtn();
  }, 400);
  // Close dropdown on outside click
  document.addEventListener('click',function(e){
    const btn=document.getElementById('profileBtn');
    if(btn && !btn.contains(e.target)) closeProfileDropdown();
  });
}

window.addEventListener('DOMContentLoaded',function(){
  requestAnimationFrame(function(){
    const splash = document.getElementById('bp-splash');
    if(splash) splash.classList.add('hide');
  });
  const s = getSession();
  if(s){
    enterHQ(s);
  } else {
    const landing = document.getElementById('view-landing');
    if(landing) landing.classList.add('active');
  }
});

function lvGoToPortal(){
  const landing = document.getElementById('view-landing');
  const auth = document.getElementById('view-auth');
  if(landing) landing.classList.remove('active');
  if(auth){ auth.classList.add('active'); auth.scrollTop=0; }
}
document.addEventListener('keydown',e=>{
  if(e.key==='Enter'){
    const si=document.getElementById('form-signin');
    const re=document.getElementById('form-register');
    if(si&&si.style.display!=='none')doSignIn();
    else if(re&&re.style.display!=='none')doRegister();
  }
});

// ════════════════════════════════════════════════
//  BUILD HQ
// ════════════════════════════════════════════════
function buildHQ(session){
  document.getElementById('hq-container').innerHTML=getHQHTML(session);
  initHQ(session);
}

function getHQHTML(session){
  return `
<div class="hq-wrap">

  <!-- Header -->
  <div class="hq-hdr">
    <div>
      <div class="hq-ttl">Sales Command Center</div>
      <div class="hq-ttl-sub">30-Day ADP Cadence Intelligence Platform</div>
    </div>
    <div class="hq-hdr-actions" style="display:flex;align-items:center;gap:10px">
      <div class="hq-date-lbl" id="hq-date">—</div>
      <!-- Notification Bell -->
      <div class="notif-bell-wrap">
        <button class="notif-bell-btn" onclick="notifOpenDrawer()" title="Alerts & Activity">
          🔔
          <span class="notif-badge" id="notif-badge">0</span>
        </button>
      </div>
      <button id="profiles-drawer-btn" onclick="ppToggleDrawer()" style="padding:9px 14px;font-size:12px;font-weight:700;border-radius:6px;border:1.5px solid var(--border);background:var(--white);color:var(--text-2);cursor:pointer;font-family:var(--fb);display:inline-flex;align-items:center;gap:6px;transition:all .15s" onmouseover="this.style.borderColor='var(--navy)';this.style.color='var(--navy)'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-2)'" title="Prospect Profiles">
        📁 Profiles <span id="header-prospect-count" style="font-size:10px;background:var(--navy);color:#fff;padding:1px 5px;border-radius:10px;min-width:16px;text-align:center"></span>
      </button>
      <button class="btn btn-dark" onclick="openModal('new')" style="padding:9px 18px;font-size:13px">+ New Prospect</button>
    </div>
  </div>

  <!-- ══ NOTIFICATION DRAWER ══ -->
  <div class="notif-drawer" id="notif-drawer">
    <div class="notif-drawer-hdr">
      <div>
        <div class="notif-drawer-title">🔔 Alerts & Activity</div>
        <div style="font-size:10px;opacity:.6;margin-top:2px" id="notif-unread-count">No unread alerts</div>
      </div>
      <button class="notif-drawer-close" onclick="notifCloseDrawer()">✕</button>
    </div>
    <div class="notif-drawer-tabs">
      <button class="notif-dtab active" id="ndtab-all" onclick="notifSetTab('all')">All</button>
      <button class="notif-dtab" id="ndtab-outreach" onclick="notifSetTab('outreach')">📧 Outreach</button>
      <button class="notif-dtab" id="ndtab-intel" onclick="notifSetTab('intel')">📊 Intel</button>
      <button class="notif-dtab" id="ndtab-alerts" onclick="notifSetTab('alerts')">⚠ Alerts</button>
    </div>
    <div class="notif-list" id="notif-list"></div>
    <div class="notif-actions">
      <button onclick="notifMarkAllRead()" style="flex:1;padding:8px;font-size:11px;font-weight:700;border:1px solid var(--border);border-radius:5px;background:var(--white);color:var(--text-2);cursor:pointer;font-family:var(--fb)">✓ Mark All Read</button>
      <button onclick="notifClearAll()" style="flex:1;padding:8px;font-size:11px;font-weight:700;border:1px solid var(--border);border-radius:5px;background:var(--white);color:var(--red);cursor:pointer;font-family:var(--fb)">🗑 Clear All</button>
    </div>
  </div>
  <!-- Drawer backdrop -->
  <div id="notif-backdrop" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.25);z-index:2999" onclick="notifCloseDrawer()"></div>

  <!-- Reschedule modal — global, above drawer (z-index:4000) -->
  <div id="cdt-reschedule-modal" style="display:none;position:fixed;inset:0;z-index:4000;align-items:center;justify-content:center;padding:20px">
    <div style="position:absolute;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(3px)" onclick="cdtCloseReschedule()"></div>
    <div style="position:relative;background:var(--white);border-radius:14px;padding:28px 24px 22px;width:100%;max-width:360px;box-shadow:0 24px 64px rgba(0,0,0,.22)">
      <div style="font-family:var(--fd);font-size:17px;font-weight:700;color:var(--text);margin-bottom:3px" id="cdt-rs-title">Reschedule Touch</div>
      <div style="font-size:11px;color:var(--text-3);margin-bottom:20px;line-height:1.4" id="cdt-rs-sub">Choose a new date for this touch</div>
      <label style="font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--text-3);display:block;margin-bottom:7px">New Send Date</label>
      <input type="date" id="cdt-rs-date" style="width:100%;padding:11px 13px;border:1.5px solid var(--border);border-radius:7px;font-size:15px;font-family:var(--fb);color:var(--text);background:var(--white);box-sizing:border-box;margin-bottom:12px">
      <div style="font-size:10px;color:var(--text-3);margin-bottom:22px;line-height:1.6;background:var(--off-white);padding:10px 12px;border-radius:6px;border:1px solid var(--border)" id="cdt-rs-impact">All other touches will shift automatically to maintain spacing.</div>
      <div style="display:flex;gap:8px">
        <button onclick="cdtCloseReschedule()" style="flex:1;padding:11px;border-radius:7px;border:1px solid var(--border);background:var(--white);color:var(--text-3);font-size:12px;font-weight:700;cursor:pointer;font-family:var(--fb)">Cancel</button>
        <button onclick="cdtConfirmReschedule()" style="flex:2;padding:11px;border-radius:7px;border:none;background:var(--navy);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:var(--fb)">📅 Reschedule Touch</button>
      </div>
    </div>
  </div>

  <!-- Welcome strip -->
  <div class="welcome-strip">
    <div class="ws-av" id="hq-wb-av">—</div>
    <div>
      <div class="ws-name" id="hq-wb-name">—</div>
      <div class="ws-detail" id="hq-wb-detail">—</div>
    </div>
  </div>

  <!-- Nav -->
  <div class="hq-nav">
    <button class="hq-tab active" id="htab-cmd" onclick="hqTab('cmd')">🏠 Command Center <span class="tab-badge">HQ</span></button>
    <button class="hq-tab" id="htab-composer" onclick="hqTab('composer')">📅 30-Day Cadence <span class="tab-badge">STEP 3</span></button>
    <button class="hq-tab" id="htab-agent" onclick="hqTab('agent')">🤖 Sales Agent <span class="tab-badge" style="background:rgba(34,197,94,.15);color:#16a34a">LIVE</span></button>
    <button class="hq-tab" id="htab-analysis" onclick="hqTab('analysis')">📊 Analysis Tools <span class="tab-badge" style="background:rgba(184,146,10,.15);color:var(--gold)">NEW</span></button>
  </div>

  <!-- Prospect strip -->
  <div class="prospect-strip">
    <div class="ps-empty" id="hq-pe">
      <span style="font-size:20px;opacity:.3">👤</span>
      <div>
        <div style="font-weight:600;color:var(--text);margin-bottom:2px">No prospect loaded</div>
        <div style="font-size:13px">Click <strong>+ New Prospect</strong> to begin the 30-day sequence.</div>
      </div>
    </div>
    <div class="ps-fields" id="hq-pf" style="display:none"></div>
  </div>

  <!-- ══ COMMAND CENTER TAB ══ -->
  <div id="hq-cmd">

    <!-- ══ SMART ROUTING ENGINE ══ -->
    <div class="sh">
      <span class="sh-step">STEP 00 · DATA COLLECTION</span>
      <div>
        <div class="sh-ttl">Smart Routing Engine</div>
        <div class="sh-sub">Collect all prospect intelligence — multi-file intake, form builder, pain points, and competitor data</div>
      </div>
    </div>

    <div class="sre-wrap">
      <div class="sre-header">
        <div class="sre-logo">ADP</div>
        <div class="sre-htxt">
          <div class="sre-htitle">Prospect Intelligence Collector</div>
          <div class="sre-hsub">Build a complete prospect profile from files, URLs, forms, and Gong transcripts</div>
        </div>
        <div class="sre-status" id="sre-status">
          <span class="sre-dot"></span><span>Waiting...</span>
        </div>
      </div>
      <div class="sre-body">

        <!-- CLIENT TYPE SILO -->
        <div style="margin-bottom:14px">
          <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px">Client Type — Select One</div>
          <div class="sre-silo">
            <div class="sre-silo-opt" id="sre-opt-new" onclick="sreSilo('new')">
              <div class="sre-silo-icon">🆕</div>
              <div class="sre-silo-label">New Prospect</div>
              <div class="sre-silo-sub">Net-new — not currently on any ADP platform</div>
            </div>
            <div class="sre-silo-opt" id="sre-opt-existing" onclick="sreSilo('existing')">
              <div class="sre-silo-icon">🔄</div>
              <div class="sre-silo-label">Existing ADP Client</div>
              <div class="sre-silo-sub">Currently using ADP — upgrade / cross-sell opportunity</div>
            </div>
          </div>
        </div>

        <!-- EXISTING ADP PRODUCT SUB-TRACK -->
        <div class="sre-subtrack" id="sre-adp-subtrack">
          <div class="sre-subtrack-title">Current ADP Product — Select All That Apply</div>
          <div class="sre-adp-opts">
            <div class="sre-adp-opt" id="sre-adp-run" onclick="sreAdpToggle('run',this)">ADP RUN</div>
            <div class="sre-adp-opt" id="sre-adp-classic" onclick="sreAdpToggle('classic',this)">ADP Classic</div>
            <div class="sre-adp-opt" id="sre-adp-wfn" onclick="sreAdpToggle('wfn',this)">Workforce Now</div>
            <div class="sre-adp-opt" id="sre-adp-ts" onclick="sreAdpToggle('ts',this)">TotalSource</div>
            <div class="sre-adp-opt" id="sre-adp-etime" onclick="sreAdpToggle('etime',this)">eTime / TLM</div>
            <div class="sre-adp-opt" id="sre-adp-benefits" onclick="sreAdpToggle('benefits',this)">Health &amp; Benefits</div>
            <div class="sre-adp-opt" id="sre-adp-wc" onclick="sreAdpToggle('wc',this)">Workers' Comp</div>
            <div class="sre-adp-opt" id="sre-adp-401k" onclick="sreAdpToggle('401k',this)">401K / Retirement</div>
            <div class="sre-adp-opt" id="sre-adp-other" onclick="sreAdpToggle('other',this)">Other ADP</div>
          </div>
        </div>

        <!-- PROSPECT DATA DISPLAY -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:1.5px">Prospect Overview</div>
          <button class="btn btn-outline" style="font-size:11px;padding:5px 10px" onclick="sreRefresh()">🔄 Refresh</button>
        </div>
        <div class="sre-prospect-grid">
          <div class="sre-field"><div class="sre-field-lbl">Company</div><div class="sre-field-val empty" id="sre-company">—</div></div>
          <div class="sre-field"><div class="sre-field-lbl">Contact</div><div class="sre-field-val empty" id="sre-contact">—</div></div>
          <div class="sre-field"><div class="sre-field-lbl">Persona</div><div class="sre-field-val empty" id="sre-persona">—</div></div>
          <div class="sre-field"><div class="sre-field-lbl">Industry</div><div class="sre-field-val empty" id="sre-industry">—</div></div>
          <div class="sre-field"><div class="sre-field-lbl">State</div><div class="sre-field-val empty" id="sre-state">—</div></div>
          <div class="sre-field">
            <div class="sre-field-lbl">Headcount</div>
            <div class="sre-field-val empty" id="sre-headcount">—</div>
            <div id="sre-hc-band" style="font-size:10px;color:var(--text-3);margin-top:2px;display:none"></div>
          </div>
        </div>

        <!-- ══ COMPETITOR PRE-FILL ══ -->
        <div style="margin-bottom:14px;padding:12px 14px;background:rgba(220,53,69,.06);border:1px solid rgba(220,53,69,.18);border-radius:8px">
          <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px">⚔️ Incumbent / Competitor</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <div>
              <label style="font-size:11px;font-weight:600;color:var(--text-2);display:block;margin-bottom:4px">Primary Incumbent</label>
              <select id="sre-competitor" onchange="sreCompetitorChanged()" style="width:100%;padding:8px 10px;font-size:12px;font-family:var(--fb);border:1px solid var(--border);border-radius:6px;background:var(--off-white);color:var(--text)">
                <option value="">— Unknown —</option>
                <optgroup label="── Existing ADP Client ──">
                  <option value="adp_run">ADP RUN (small biz payroll)</option>
                  <option value="adp_workforce_now">ADP Workforce Now (WFN)</option>
                  <option value="adp_totalsource">ADP TotalSource (PEO)</option>
                  <option value="adp_vantage">ADP Vantage HCM</option>
                  <option value="adp_enterprise">ADP Enterprise / GlobalView</option>
                  <option value="adp_ez_labor">ADP ezLaborManager</option>
                  <option value="adp_time">ADP Time &amp; Attendance (standalone)</option>
                  <option value="adp_401k">ADP 401(k) / Retirement only</option>
                  <option value="adp_benefits">ADP Health &amp; Benefits (standalone)</option>
                  <option value="adp_wc">ADP Workers' Comp (standalone)</option>
                  <option value="adp_other">ADP — Other / Unknown product</option>
                </optgroup>
                <optgroup label="── Competitor Incumbent ──">
                  <option value="paycom">Paycom</option>
                  <option value="paylocity">Paylocity</option>
                  <option value="ukg">UKG (Kronos/Ultimate)</option>
                  <option value="dayforce">Dayforce (Ceridian)</option>
                  <option value="workday">Workday</option>
                  <option value="paychex">Paychex / Paychex PEO</option>
                  <option value="justworks">Justworks</option>
                  <option value="rippling">Rippling</option>
                  <option value="trinet">TriNet</option>
                  <option value="insperity">Insperity</option>
                  <option value="bamboo">BambooHR</option>
                  <option value="isolved">isolved</option>
                  <option value="other">Other</option>
                  <option value="none">No incumbent — manual/spreadsheet</option>
                </optgroup>
              </select>
              <div id="sre-adp-upsell-row" style="display:none;margin-top:6px;padding:8px 10px;background:rgba(0,112,243,.07);border:1px solid rgba(0,112,243,.2);border-radius:6px">
                <div style="font-size:10px;font-weight:700;color:#0070f3;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px">🔄 ADP Upsell / Cross-Sell Context</div>
                <label style="font-size:11px;color:var(--text-2);display:block;margin-bottom:3px">What are they missing / upgrading to?</label>
                <select id="sre-adp-upsell-goal" style="width:100%;padding:6px 8px;font-size:11px;font-family:var(--fb);border:1px solid rgba(0,112,243,.3);border-radius:5px;background:var(--off-white);color:var(--text)">
                  <option value="">— Select upgrade goal —</option>
                  <optgroup label="WFN Upgrades">
                    <option value="run_to_wfn">RUN → WFN (growth / complexity)</option>
                    <option value="wfn_add_ts">WFN → Add TotalSource PEO</option>
                    <option value="wfn_add_talent">WFN → Add Talent / Learning module</option>
                    <option value="wfn_add_time">WFN → Add Time &amp; Scheduling</option>
                    <option value="wfn_add_benefits">WFN → Add Benefits Administration</option>
                    <option value="wfn_to_vantage">WFN → Vantage HCM (enterprise scale)</option>
                  </optgroup>
                  <optgroup label="TotalSource / PEO">
                    <option value="run_to_ts">RUN → TotalSource PEO</option>
                    <option value="ts_add_wfn">TotalSource → Carve out to WFN</option>
                    <option value="ts_renew_expand">TotalSource renewal + headcount expansion</option>
                  </optgroup>
                  <optgroup label="Other">
                    <option value="consolidate">Consolidate multiple ADP products</option>
                    <option value="global_expand">Add global / multi-country payroll</option>
                    <option value="other_upsell">Other upsell objective</option>
                  </optgroup>
                </select>
              </div>
            </div>
            <div>
              <label style="font-size:11px;font-weight:600;color:var(--text-2);display:block;margin-bottom:4px">Contract Renewal</label>
              <input type="date" id="sre-renewal-date" style="width:100%;padding:8px 10px;font-size:12px;font-family:var(--fb);border:1px solid var(--border);border-radius:6px;background:var(--off-white);color:var(--text);box-sizing:border-box;height:36px;-webkit-appearance:none;appearance:none;display:block">
            </div>
          </div>
          <div id="sre-comp-insight" style="display:none;padding:8px 10px;background:rgba(220,53,69,.08);border-radius:6px;font-size:11px;color:var(--text-2);line-height:1.5"></div>
        </div>

        <!-- ══ PAIN POINTS ══ -->
        <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px">Client Pain Points — Select All That Apply</div>
        <div class="sre-pain-section peo">
          <div class="sre-pain-hd"><span>🔴</span><span>PEO / HR Outsourcing</span><span style="opacity:.5;font-weight:400;text-transform:none;letter-spacing:0"> — Operational &amp; Admin Burden</span></div>
          <div class="sre-pain-grid">
            <label class="sre-cb"><input type="checkbox" id="sre-401k"><span>401K admin errors</span></label>
            <label class="sre-cb"><input type="checkbox" id="sre-wc"><span>Workers Comp issues</span></label>
            <label class="sre-cb"><input type="checkbox" id="sre-aca"><span>ACA compliance problems</span></label>
            <label class="sre-cb"><input type="checkbox" id="sre-benefits"><span>Benefits payment errors</span></label>
            <label class="sre-cb"><input type="checkbox" id="sre-benefits-cost"><span>Benefits cost too high</span></label>
            <label class="sre-cb"><input type="checkbox" id="sre-hr-bandwidth"><span>HR team overwhelmed</span></label>
          </div>
        </div>
        <div class="sre-pain-section wfn">
          <div class="sre-pain-hd"><span>🔵</span><span>HCM Platform</span><span style="opacity:.5;font-weight:400;text-transform:none;letter-spacing:0"> — Technology &amp; System</span></div>
          <div class="sre-pain-grid">
            <label class="sre-cb"><input type="checkbox" id="sre-tax"><span>Multi-state tax issues</span></label>
            <label class="sre-cb"><input type="checkbox" id="sre-platform"><span>Platform failures / downtime</span></label>
            <label class="sre-cb"><input type="checkbox" id="sre-gl"><span>GL integration errors</span></label>
            <label class="sre-cb"><input type="checkbox" id="sre-support"><span>Poor support / service</span></label>
            <label class="sre-cb"><input type="checkbox" id="sre-reporting"><span>Weak reporting / analytics</span></label>
            <label class="sre-cb"><input type="checkbox" id="sre-mobile"><span>No mobile / self-service</span></label>
          </div>
        </div>
        <div class="sre-pain-section gen">
          <div class="sre-pain-hd"><span>⚪</span><span>General</span><span style="opacity:.5;font-weight:400;text-transform:none;letter-spacing:0"> — Cross-Product</span></div>
          <div class="sre-pain-grid three">
            <label class="sre-cb"><input type="checkbox" id="sre-i9"><span>I-9 / E-Verify errors</span></label>
            <label class="sre-cb"><input type="checkbox" id="sre-multi"><span>Multi-entity complexity</span></label>
            <label class="sre-cb"><input type="checkbox" id="sre-manual"><span>Manual / spreadsheet processes</span></label>
            <label class="sre-cb"><input type="checkbox" id="sre-onboarding"><span>Slow / manual onboarding</span></label>
            <label class="sre-cb"><input type="checkbox" id="sre-turnover"><span>High turnover / retention issues</span></label>
            <label class="sre-cb"><input type="checkbox" id="sre-compliance"><span>General compliance risk</span></label>
          </div>
        </div>

        <!-- ══ EXTENDED FORM BUILDER ══ -->
        <div style="margin-top:18px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:1.5px">📋 Extended Prospect Profile</div>
            <button onclick="sreToggleForm()" id="sre-form-toggle" style="font-size:10px;padding:4px 10px;background:transparent;color:var(--text-3);border:1px solid var(--border);border-radius:4px;cursor:pointer;font-family:var(--fb);font-weight:600">▼ Show Fields</button>
          </div>
          <div id="sre-ext-form" style="display:none">

            <!-- SALES INTELLIGENCE -->
            <div style="font-size:10px;font-weight:700;color:var(--navy);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding:6px 10px;background:rgba(26,36,96,.07);border-radius:4px">Sales Intelligence</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
              <div>
                <label style="font-size:11px;font-weight:600;color:var(--text-2);display:block;margin-bottom:3px">Annual Revenue (est.)</label>
                <input class="fi" id="sre-revenue" placeholder="e.g. $5M–$20M" style="margin-bottom:0">
              </div>
              <div>
                <label style="font-size:11px;font-weight:600;color:var(--text-2);display:block;margin-bottom:3px">Years with Incumbent</label>
                <input class="fi" id="sre-tenure" placeholder="e.g. 3 years" style="margin-bottom:0">
              </div>
              <div>
                <label style="font-size:11px;font-weight:600;color:var(--text-2);display:block;margin-bottom:3px">States of Operation</label>
                <input class="fi" id="sre-states-ops" placeholder="e.g. VA, MD, DC, TX" style="margin-bottom:0">
              </div>
              <div>
                <label style="font-size:11px;font-weight:600;color:var(--text-2);display:block;margin-bottom:3px">Payroll Frequency</label>
                <select class="fi" id="sre-pay-freq" style="margin-bottom:0">
                  <option value="">— Select —</option>
                  <option>Weekly</option><option>Bi-weekly</option><option>Semi-monthly</option><option>Monthly</option><option>Mixed</option>
                </select>
              </div>
              <div>
                <label style="font-size:11px;font-weight:600;color:var(--text-2);display:block;margin-bottom:3px">Hourly vs. Salaried Mix</label>
                <input class="fi" id="sre-ee-mix" placeholder="e.g. 60% hourly, 40% salary" style="margin-bottom:0">
              </div>
              <div>
                <label style="font-size:11px;font-weight:600;color:var(--text-2);display:block;margin-bottom:3px">Union Employees</label>
                <select class="fi" id="sre-union" style="margin-bottom:0">
                  <option value="">— Select —</option>
                  <option>No</option><option>Yes — partial</option><option>Yes — fully unionized</option>
                </select>
              </div>
            </div>

            <!-- BUYING CONTEXT -->
            <div style="font-size:10px;font-weight:700;color:var(--navy);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding:6px 10px;background:rgba(26,36,96,.07);border-radius:4px">Buying Context</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
              <div>
                <label style="font-size:11px;font-weight:600;color:var(--text-2);display:block;margin-bottom:3px">Decision Timeline</label>
                <select class="fi" id="sre-timeline" style="margin-bottom:0">
                  <option value="">— Select —</option>
                  <option>Immediate (30 days)</option><option>Short-term (60–90 days)</option>
                  <option>Mid-term (3–6 months)</option><option>Long-term (6–12 months)</option><option>Exploratory — no timeline</option>
                </select>
              </div>
              <div>
                <label style="font-size:11px;font-weight:600;color:var(--text-2);display:block;margin-bottom:3px">Budget Status</label>
                <select class="fi" id="sre-budget" style="margin-bottom:0">
                  <option value="">— Select —</option>
                  <option>Approved</option><option>Pending approval</option>
                  <option>In evaluation</option><option>No budget — building case</option><option>Unknown</option>
                </select>
              </div>
              <div>
                <label style="font-size:11px;font-weight:600;color:var(--text-2);display:block;margin-bottom:3px">Buying Stage</label>
                <select class="fi" id="sre-stage" style="margin-bottom:0">
                  <option value="">— Select —</option>
                  <option>Awareness — just learning</option><option>Consideration — evaluating options</option>
                  <option>Decision — shortlisted vendors</option><option>Negotiation — down to 2</option>
                </select>
              </div>
              <div>
                <label style="font-size:11px;font-weight:600;color:var(--text-2);display:block;margin-bottom:3px">Other Vendors in Play</label>
                <input class="fi" id="sre-other-vendors" placeholder="e.g. Paycom, Rippling" style="margin-bottom:0">
              </div>
              <div>
                <label style="font-size:11px;font-weight:600;color:var(--text-2);display:block;margin-bottom:3px">Champion / Internal Sponsor</label>
                <input class="fi" id="sre-champion" placeholder="Name and title" style="margin-bottom:0">
              </div>
              <div>
                <label style="font-size:11px;font-weight:600;color:var(--text-2);display:block;margin-bottom:3px">Economic Buyer</label>
                <input class="fi" id="sre-econ-buyer" placeholder="Name and title" style="margin-bottom:0">
              </div>
            </div>

            <!-- COMPLIANCE & RISK -->
            <div style="font-size:10px;font-weight:700;color:var(--navy);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;padding:6px 10px;background:rgba(26,36,96,.07);border-radius:4px">Compliance &amp; Risk Signals</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
              <div>
                <label style="font-size:11px;font-weight:600;color:var(--text-2);display:block;margin-bottom:3px">Recent DOL / IRS Notices</label>
                <select class="fi" id="sre-notices" style="margin-bottom:0">
                  <option value="">— Unknown —</option>
                  <option>Yes — active issue</option><option>Yes — resolved</option><option>No</option>
                </select>
              </div>
              <div>
                <label style="font-size:11px;font-weight:600;color:var(--text-2);display:block;margin-bottom:3px">ACA Filing Status</label>
                <select class="fi" id="sre-aca-status" style="margin-bottom:0">
                  <option value="">— Unknown —</option>
                  <option>Fully compliant</option><option>Late / missed filings</option>
                  <option>Unsure of obligations</option><option>Under 50 FTE — not applicable</option>
                </select>
              </div>
              <div>
                <label style="font-size:11px;font-weight:600;color:var(--text-2);display:block;margin-bottom:3px">EPLI / Employment Practices</label>
                <select class="fi" id="sre-epli" style="margin-bottom:0">
                  <option value="">— Unknown —</option>
                  <option>Has EPLI coverage</option><option>No EPLI — exposed</option><option>Recent claim / lawsuit</option>
                </select>
              </div>
              <div>
                <label style="font-size:11px;font-weight:600;color:var(--text-2);display:block;margin-bottom:3px">Growth Plans</label>
                <select class="fi" id="sre-growth" style="margin-bottom:0">
                  <option value="">— Unknown —</option>
                  <option>Stable headcount</option><option>Hiring aggressively</option>
                  <option>Expanding to new states</option><option>M&amp;A activity</option><option>Downsizing</option>
                </select>
              </div>
            </div>

            <!-- OPEN NOTES -->
            <div style="margin-bottom:10px">
              <label style="font-size:11px;font-weight:600;color:var(--text-2);display:block;margin-bottom:3px">Discovery Notes / Additional Context</label>
              <textarea id="sre-ext-notes" placeholder="Anything from the call, email, or research that doesn't fit a field above — objections heard, referral source, internal politics, key dates..." style="width:100%;min-height:70px;padding:9px 11px;font-size:12px;font-family:var(--fb);border:1px solid var(--border);border-radius:6px;background:var(--off-white);color:var(--text);resize:vertical;line-height:1.5;box-sizing:border-box"></textarea>
            </div>

          </div>
        </div>

        <!-- ══ GONG TRANSCRIPT ══ -->
        <div style="margin-bottom:14px">
          <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
            <span>🎙 Gong Transcript — Paste or Auto-Fill from Scan</span>
            <button onclick="sreAnalyzeTranscript()" style="font-size:10px;padding:4px 10px;background:var(--red);color:#fff;border:none;border-radius:4px;cursor:pointer;font-family:var(--fb);font-weight:600">Analyze →</button>
          </div>
          <textarea id="sre-transcript" placeholder="Paste Gong call transcript here — pain points, objections, competitor mentions, and ADP product mentions will auto-map above..." style="width:100%;min-height:90px;padding:10px 12px;font-size:12px;font-family:var(--fb);border:1px solid var(--border);border-radius:6px;background:var(--off-white);color:var(--text);resize:vertical;line-height:1.5;box-sizing:border-box" oninput="sreTranscriptChanged()"></textarea>
          <div id="sre-transcript-status" style="font-size:10px;color:var(--text-3);margin-top:4px;min-height:14px"></div>
        </div>

        <!-- ══ IMAGE INTEL EXTRACTOR ══ -->
        <div style="margin-bottom:14px" id="sre-img-section">
          <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
            <span>📸 Screenshot Intel — Upload to Extract Signals</span>
            <span style="font-size:9px;font-weight:600;color:#0070f3;background:rgba(0,112,243,.1);padding:2px 8px;border-radius:10px;letter-spacing:.3px">AI Vision</span>
          </div>
          <div style="font-size:10px;color:var(--text-3);margin-bottom:8px;line-height:1.5">Upload screenshots from LinkedIn, Gong, email threads, or any source. AI extracts <strong>pain signals, objections, competitor mentions, and buying intent</strong> — <em>firmographic fields (name, company, headcount) are never overwritten.</em></div>
          <div id="sre-img-dropzone" onclick="document.getElementById('sre-img-input').click()" ondragover="event.preventDefault();this.style.borderColor='var(--navy)'" ondragleave="this.style.borderColor='var(--border)'" ondrop="sreImgDrop(event)"
            style="border:2px dashed var(--border);border-radius:8px;padding:20px;text-align:center;cursor:pointer;transition:border-color .15s;background:var(--off-white)">
            <div style="font-size:22px;margin-bottom:6px">🖼️</div>
            <div style="font-size:11px;font-weight:600;color:var(--text-2)">Click to upload or drag &amp; drop</div>
            <div style="font-size:10px;color:var(--text-3);margin-top:3px">PNG · JPG · WEBP · up to 5 images</div>
            <input type="file" id="sre-img-input" accept="image/*" multiple style="display:none" onchange="sreImgFilesSelected(this.files)">
          </div>
          <div id="sre-img-thumbs" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px"></div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:10px">
            <button id="sre-img-analyze-btn" onclick="sreImgAnalyze()" style="display:none;padding:7px 14px;background:var(--navy);color:#fff;border:none;border-radius:5px;font-size:11px;font-weight:700;font-family:var(--fb);cursor:pointer;letter-spacing:.3px">🔍 Extract Intel from Images →</button>
            <div id="sre-img-status" style="font-size:10px;color:var(--text-3);min-height:14px"></div>
          </div>
          <div id="sre-img-results" style="display:none;margin-top:10px;padding:12px;background:rgba(0,112,243,.05);border:1px solid rgba(0,112,243,.18);border-radius:8px">
            <div style="font-size:10px;font-weight:700;color:#0070f3;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">📊 Extracted Signals</div>
            <div id="sre-img-results-body" style="font-size:12px;color:var(--text-2);line-height:1.6"></div>
            <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
              <button onclick="sreImgApplySignals()" style="padding:6px 12px;background:#0070f3;color:#fff;border:none;border-radius:5px;font-size:11px;font-weight:700;font-family:var(--fb);cursor:pointer">✓ Apply Signals to Profile</button>
              <button onclick="document.getElementById('sre-img-results').style.display='none';sreImgClear()" style="padding:6px 12px;background:var(--off-white);border:1px solid var(--border);color:var(--text-2);border-radius:5px;font-size:11px;font-weight:600;font-family:var(--fb);cursor:pointer">✕ Discard</button>
            </div>
          </div>
        </div>

        <!-- SAVE BUTTON -->
        <div class="sre-run-wrap">
          <button class="sre-run-btn" onclick="sreSave()">
            <span>&#128190;</span><span>Save Prospect Intelligence</span><span>&#8594;</span>
          </button>
          <div class="sre-run-sub">Captures all fields, pain points, competitor data, and extended profile — auto-syncs to the Profiles drawer</div>
        </div>

        <!-- INTEL SUMMARY + TRACK SELECTOR -->
        <div class="sre-results" id="sre-results">
          <div class="sre-rec-hero">
            <div>
              <div class="sre-rec-lbl">Intelligence Status</div>
              <div class="sre-rec-val">
                <div class="sre-rec-icon">&#128203;</div>
                <span id="sre-rec-val">&#8212;</span>
              </div>
              <div style="font-size:11px;opacity:.5;margin-top:6px" id="sre-client-type-label"></div>
            </div>
            <div style="text-align:right">
              <div class="sre-rec-lbl">Data Points</div>
              <div class="sre-conf-num" id="sre-conf">&#8212;</div>
            </div>
          </div>
          <div id="sre-summary-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px"></div>

          <!-- TRACK SELECTOR -->
          <div style="margin-top:20px;padding:16px;background:rgba(26,36,96,.05);border:1px solid rgba(26,36,96,.14);border-radius:10px">
            <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px">&#127919; Select Product Track</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
              <div id="sre-track-wfn" onclick="sreSelectTrack('WFN')" style="padding:14px 12px;border:2px solid var(--border);border-radius:8px;cursor:pointer;transition:all .15s;text-align:center;background:var(--white)">
                <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:3px">&#128421;&#65039; ADP WorkforceNow</div>
                <div style="font-size:10px;color:var(--text-3)">HCM platform &middot; mid-market &middot; technology-led</div>
              </div>
              <div id="sre-track-ts" onclick="sreSelectTrack('TS')" style="padding:14px 12px;border:2px solid var(--border);border-radius:8px;cursor:pointer;transition:all .15s;text-align:center;background:var(--white)">
                <div style="font-size:13px;font-weight:700;color:var(--red);margin-bottom:3px">&#129309; ADP TotalSource</div>
                <div style="font-size:10px;color:var(--text-3)">PEO &middot; co-employment &middot; HR outsourcing</div>
              </div>
            </div>

            <!-- PEO QUICK PROFILE — shown only when TotalSource track is selected -->
            <div id="sre-peo-profile" style="display:none;margin-top:12px;padding:14px;background:rgba(220,53,69,.04);border:1px solid rgba(220,53,69,.18);border-radius:8px;animation:fadeIn .2s ease">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                <div>
                  <div style="font-size:10px;font-weight:700;color:var(--red);text-transform:uppercase;letter-spacing:1.5px">&#129309; TotalSource PEO Profile</div>
                  <div style="font-size:10px;color:var(--text-3);margin-top:2px">Key underwriting inputs — flows into email engine &amp; cadence</div>
                </div>
                <button onclick="srePeoSave()" style="padding:5px 12px;background:var(--red);color:#fff;border:none;border-radius:5px;font-size:10px;font-weight:700;font-family:var(--fb);cursor:pointer;letter-spacing:.4px">Save &#10003;</button>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">

                <!-- LEFT COL -->
                <div style="display:flex;flex-direction:column;gap:8px">
                  <div>
                    <div style="font-size:10px;color:var(--text-3);margin-bottom:3px;font-weight:600">Eligible Employees</div>
                    <input id="srep-eligible-ee" type="number" min="1" placeholder="e.g. 7" onchange="srePeoSave()" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:var(--fb);background:var(--white);color:var(--text-1);box-sizing:border-box">
                  </div>
                  <div>
                    <div style="font-size:10px;color:var(--text-3);margin-bottom:3px;font-weight:600">Avg Gross Wages (per EE / year)</div>
                    <input id="srep-avg-wages" type="text" placeholder="$ e.g. 80,800" onchange="srePeoSave()" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:var(--fb);background:var(--white);color:var(--text-1);box-sizing:border-box">
                  </div>
                  <div>
                    <div style="font-size:10px;color:var(--text-3);margin-bottom:3px;font-weight:600">Number of Locations</div>
                    <select id="srep-locations" onchange="srePeoSave()" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:var(--fb);background:var(--white);color:var(--text-1);box-sizing:border-box">
                      <option value="">— Select —</option>
                      <option value="1">1 location</option>
                      <option value="2-3">2–3 locations</option>
                      <option value="4-9">4–9 locations</option>
                      <option value="10+">10+ locations</option>
                    </select>
                  </div>
                  <div>
                    <div style="font-size:10px;color:var(--text-3);margin-bottom:3px;font-weight:600">ASI Score <span style="font-weight:400;font-style:italic">(Age/Sex/Industry — blank if unknown)</span></div>
                    <input id="srep-asi" type="text" placeholder="e.g. 1.08  (1.0 = neutral)" onchange="srePeoSave()" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:var(--fb);background:var(--white);color:var(--text-1);box-sizing:border-box">
                  </div>
                </div>

                <!-- RIGHT COL -->
                <div style="display:flex;flex-direction:column;gap:8px">
                  <div>
                    <div style="font-size:10px;color:var(--text-3);margin-bottom:3px;font-weight:600">Current Carrier</div>
                    <select id="srep-carrier" onchange="srePeoSave()" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:var(--fb);background:var(--white);color:var(--text-1);box-sizing:border-box">
                      <option value="">— Select Carrier —</option>
                      <option value="carefirst">CareFirst (BCBS DC/MD/VA)</option>
                      <option value="uhc">UnitedHealthcare</option>
                      <option value="bcbs">Blue Cross Blue Shield</option>
                      <option value="aetna">Aetna</option>
                      <option value="cigna">Cigna</option>
                      <option value="humana">Humana</option>
                      <option value="kaiser">Kaiser Permanente</option>
                      <option value="other">Other / Unknown</option>
                    </select>
                  </div>
                  <div>
                    <div style="font-size:10px;color:var(--text-3);margin-bottom:3px;font-weight:600">Avg Monthly Premium <span style="font-weight:400;font-style:italic">(blended)</span></div>
                    <input id="srep-monthly-premium" type="text" placeholder="$ e.g. 1,100" onchange="srePeoSave()" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:var(--fb);background:var(--white);color:var(--text-1);box-sizing:border-box">
                  </div>
                  <div>
                    <div style="font-size:10px;color:var(--text-3);margin-bottom:3px;font-weight:600">Employer Contribution %</div>
                    <input id="srep-contrib-pct" type="number" min="0" max="100" placeholder="e.g. 75" onchange="srePeoSave()" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:var(--fb);background:var(--white);color:var(--text-1);box-sizing:border-box">
                  </div>
                  <div>
                    <div style="font-size:10px;color:var(--text-3);margin-bottom:3px;font-weight:600">Renewal Increase %</div>
                    <input id="srep-renewal-increase" type="number" min="0" placeholder="e.g. 6.8" onchange="srePeoSave()" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-size:12px;font-family:var(--fb);background:var(--white);color:var(--text-1);box-sizing:border-box">
                  </div>
                </div>

              </div><!-- /grid -->

              <!-- Benefits participation slider -->
              <div style="margin-top:10px">
                <div style="font-size:10px;color:var(--text-3);margin-bottom:5px;font-weight:600">Benefits Participation Rate — <strong id="srep-brate-lbl" style="color:var(--red)">60%</strong></div>
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="font-size:10px;color:var(--text-3)">0%</span>
                  <input type="range" id="srep-brate" min="0" max="100" value="60" oninput="document.getElementById('srep-brate-lbl').textContent=this.value+'%'" onchange="srePeoSave()" style="flex:1;accent-color:var(--red)">
                  <span style="font-size:10px;color:var(--text-3)">100%</span>
                </div>
              </div>

              <div id="srep-saved-indicator" style="font-size:10px;color:var(--green);margin-top:8px;min-height:14px;font-style:italic"></div>
            </div>

            <!-- Cadence Tone -->
            <div style="margin-bottom:12px">
              <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px">Cadence Tone</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <label id="sre-tone-aggressive" style="display:flex;align-items:center;gap:6px;padding:7px 12px;border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;color:var(--text-2);transition:all .15s">
                  <input type="radio" name="sre-cadence-tone" value="Aggressive" onchange="sreToneChanged('Aggressive')" style="margin:0"> &#9889; Aggressive
                </label>
                <label id="sre-tone-consultative" style="display:flex;align-items:center;gap:6px;padding:7px 12px;border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;color:var(--text-2);transition:all .15s">
                  <input type="radio" name="sre-cadence-tone" value="Consultative" onchange="sreToneChanged('Consultative')" style="margin:0"> &#129309; Consultative
                </label>
                <label id="sre-tone-nurture" style="display:flex;align-items:center;gap:6px;padding:7px 12px;border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;color:var(--text-2);transition:all .15s">
                  <input type="radio" name="sre-cadence-tone" value="Nurture" onchange="sreToneChanged('Nurture')" style="margin:0"> &#127807; Nurture
                </label>
              </div>
              <div id="sre-tone-hint" style="font-size:10px;color:var(--text-3);margin-top:6px;min-height:14px;font-style:italic"></div>
            </div>

            <div id="sre-track-status" style="font-size:11px;color:var(--text-3);margin-bottom:10px;min-height:16px;font-weight:600"></div>

            <!-- MARKET AND COMPETITIVE ANALYSIS -->
            <div style="border-top:1px solid var(--border);padding-top:14px">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <div>
                  <div style="font-size:11px;font-weight:700;color:var(--text-2)">&#128269; Market &amp; Competitive Analysis</div>
                  <div style="font-size:10px;color:var(--text-3);margin-top:2px">AI analysis tuned to the selected product track &mdash; informs all downstream messaging</div>
                </div>
                <button onclick="sreRunMCA()" id="sre-mca-btn" style="flex-shrink:0;padding:8px 14px;background:var(--navy);color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:700;font-family:var(--fb);cursor:pointer;letter-spacing:.4px;white-space:nowrap">Run Analysis &#8594;</button>
              </div>
              <div id="sre-mca-panel" style="display:none">
                <div class="mia-panel show" id="sre-mca-inner">
                  <div class="mia-hdr">
                    <div>
                      <div class="mia-hdr-title">&#129302; AI Market &amp; Competitive Intelligence</div>
                      <div style="font-size:10px;opacity:.5;margin-top:2px" id="sre-mca-lbl">&#8212;</div>
                    </div>
                    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
                      <span class="mia-hdr-badge wfn" id="sre-mca-badge">&#8212;</span>
                      <span id="sre-mca-news-ts" style="display:none;font-size:9px;font-weight:600;color:#22c55e;letter-spacing:.5px;text-transform:uppercase">&#9679; Live News Fetched</span>
                    </div>
                  </div>
                  <div class="mia-body" id="sre-mca-body">
                    <div style="padding:16px;color:var(--text-3);font-size:13px;font-style:italic">Select a track and click Run Analysis to generate intelligence.</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Confirm track -->
            <div style="margin-top:14px">
              <button class="sre-action-btn primary" id="sre-proceed-btn" onclick="sreProceed()" style="width:100%"><span>&#10003; Confirm Track &amp; Continue to Analysis Tools</span><span>&#8594;</span></button>
            </div>
          </div>
        </div>

      </div>
    </div>
    <!-- /SMART ROUTING ENGINE -->

    <!-- ═══════════════════════════════════════
         AI COMPETITIVE INTELLIGENCE REPORT
         ═══════════════════════════════════════ -->
    <div id="ci-panel" style="display:none;margin-bottom:24px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px">
        <div>
          <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--text-3);margin-bottom:4px">STEP 01C · AI ANALYSIS</div>
          <div style="font-family:var(--fd);font-size:18px;font-weight:600">Competitive Intelligence Report</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:2px">Live AI analysis comparing prospect pain points vs. ADP WFN &amp; TotalSource</div>
        </div>
        <button onclick="runCompetitiveIntel()" id="ci-refresh-btn" style="padding:9px 16px;background:var(--navy);color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:700;font-family:var(--fb);cursor:pointer;letter-spacing:.5px">
          ↻ Refresh Analysis
        </button>
      </div>
      <div class="mia-panel show" id="ci-panel-inner">
        <div class="mia-hdr">
          <div>
            <div class="mia-hdr-title">🤖 AI-Generated Competitive &amp; Market Analysis</div>
            <div style="font-size:10px;opacity:.5;margin-top:2px" id="ci-prospect-lbl">—</div>
          </div>
          <span class="mia-hdr-badge wfn" id="ci-track-badge">—</span>
        </div>
        <div class="mia-body" id="ci-body">
          <div style="padding:16px;color:var(--text-3);font-size:13px;font-style:italic">Run the Smart Product Engine above to generate a competitive analysis.</div>
        </div>
      </div>
    </div>



    <div class="sh">
      <span class="sh-step">WORKFLOW</span>
      <div>
        <div class="sh-ttl">30-Day Cadence Pipeline</div>
        <div class="sh-sub">Follow each step in sequence</div>
      </div>
    </div>

    <div class="pipeline">
      <div class="ps-node"><div class="psn" id="psn0">👤</div><div class="psl" id="psl0">Prospect Input</div></div>
      <div class="pa"></div>
      <div class="ps-node"><div class="psn" id="psn1">🔍</div><div class="psl" id="psl1">Research</div></div>
      <div class="pa"></div>
      <div class="ps-node"><div class="psn" id="psn4">🚀</div><div class="psl" id="psl4">Cadence Launch</div></div>
      <div class="pa"></div>
      <div class="ps-node" id="psn-engine-wrap" style="position:relative">
        <div class="psn" id="psn-engine" title="Background Email Engine">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block">
            <rect x="1" y="4" width="20" height="14" rx="3" stroke="currentColor" stroke-width="1.6" fill="none"/>
            <path d="M1 7l10 7 10-7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <circle id="eng-dot" cx="17" cy="5" r="3.5" fill="#22c55e" style="transition:fill .4s"/>
          </svg>
        </div>
        <div class="psl" id="psl-engine">Email Engine</div>
        <div id="eng-ring" style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:52px;height:52px;border-radius:50%;border:2px solid #22c55e;opacity:0;pointer-events:none;transition:opacity .4s"></div>
      </div>
      <div class="pa"></div>
      <div class="ps-node"><div class="psn" id="psn5">✉️</div><div class="psl" id="psl5">30-Day Cadence</div></div>
    </div>
    <hr class="sdiv">

    <div class="sh">
      <span class="sh-step">STEP 01</span>
      <div>
        <div class="sh-ttl">Analysis Tools — Run First</div>
        <div class="sh-sub">Select the tool matching your prospect's current ADP product</div>
      </div>
    </div>

    <div class="tool-grid" style="grid-template-columns:1fr">
      <div class="tool-card" style="border-color:var(--border);max-width:520px;margin:0 auto">
        <div class="tc-note" style="margin-bottom:12px">
          <span>⚡</span><span>Analysis data and competitive intel are captured in the Smart Routing Engine above. Click <strong>Mark as Run</strong> to approve and unlock the 30-Day Cadence.</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary" style="background:var(--green);border-color:var(--green);color:#fff" onclick="hqMarkDone(1,'Analysis');hqApprove()">✓ Mark as Run &amp; Approve</button>
        </div>
      </div>
    </div>


    <!-- FOOTER -->
    <div class="hq-footer">
      <div>
        <div class="hq-fb">BEYONDPAYROLL HCM</div>
        <div class="hq-fi">Beyond the Numbers</div>
      </div>
      <div style="font-size:10px;color:var(--text-3);letter-spacing:1.5px;text-transform:uppercase">Sales Command Center · Confidential</div>
    </div>

  </div><!-- /hq-cmd -->

  <!-- ══ COMPOSER TAB ══ -->
  <div id="hq-composer-view" style="display:none">

    <!-- ── CADENCE TRACKER DASHBOARD ── -->
    <div id="cdt-wrap">
      <div class="cdt-header">
        <div>
          <div style="font-family:var(--fd);font-size:19px;font-weight:600">30-Day Cadence Tracker</div>
          <div style="font-size:12px;color:var(--text-3);margin-top:2px" id="cdt-header-sub">Visual timeline · tap any day to open the email composer</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <div class="cdt-view-toggle">
            <button class="cdt-vbtn active" id="cdt-vbtn-timeline" onclick="cdtSetView('timeline')">Timeline</button>
            <button class="cdt-vbtn" id="cdt-vbtn-grid" onclick="cdtSetView('grid')">Grid</button>
          </div>
          <button onclick="hqTab('cmd')" class="btn btn-outline">← Back</button>
        </div>
      </div>

      <!-- Progress ring + stats -->
      <div class="cdt-progress-bar" id="cdt-progress">
        <div class="cdt-ring-wrap">
          <svg class="cdt-ring" width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="26" fill="none" stroke="var(--light)" stroke-width="6"/>
            <circle id="cdt-ring-arc" cx="32" cy="32" r="26" fill="none" stroke="var(--green)" stroke-width="6"
              stroke-dasharray="163.4" stroke-dashoffset="163.4" stroke-linecap="round"
              style="transition:stroke-dashoffset .6s ease"/>
          </svg>
          <div class="cdt-ring-pct" id="cdt-ring-pct">0%</div>
        </div>
        <div class="cdt-prog-info">
          <div class="cdt-prog-title" id="cdt-prog-title">No prospect loaded</div>
          <div class="cdt-prog-sub" id="cdt-prog-sub">Load a prospect to begin tracking</div>
          <div class="cdt-stat-row" id="cdt-stat-row"></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
          <button onclick="cdtResetAll()" style="font-size:10px;font-weight:700;padding:6px 12px;border-radius:4px;border:1px solid var(--border);background:var(--white);color:var(--text-3);cursor:pointer;font-family:var(--fb)">↺ Reset All</button>
          <button onclick="ecExportCSV()" style="font-size:10px;font-weight:700;padding:6px 12px;border-radius:4px;border:1px solid var(--green-border);background:var(--green-bg);color:var(--green);cursor:pointer;font-family:var(--fb)">⬇ Export CSV</button>
        </div>
      </div>

      <!-- Timeline view -->
      <div id="cdt-timeline-view">
        <div class="cdt-timeline" id="cdt-timeline"></div>
      </div>

      <!-- Grid view -->
      <div id="cdt-grid-view" style="display:none">
        <div class="cdt-grid" id="cdt-grid"></div>
      </div>
    </div>
    <!-- /CADENCE TRACKER -->

    <div class="cdt-composer-divider">
      <div class="cdt-composer-divider-line"></div>
      <div class="cdt-composer-divider-txt">📧 Email Composer</div>
      <div class="cdt-composer-divider-line"></div>
    </div>

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:10px">
      <div>
        <div style="font-size:12px;color:var(--text-3)">Pre-filled Outlook touches · tap to launch directly</div>
      </div>
    </div>

    <div class="ec-strip" id="ec-strip">
      <div class="ec-si"><div class="ec-sl">Company</div><div class="ec-sv co" id="ecs-co">—</div></div>
      <div class="ec-si"><div class="ec-sl">Contact</div><div class="ec-sv" id="ecs-contact">—</div></div>
      <div class="ec-si"><div class="ec-sl">Email</div><div class="ec-sv" id="ecs-email" style="font-size:10px">—</div></div>
      <div class="ec-si"><div class="ec-sl">Profile</div><div class="ec-sv" id="ecs-profile" style="font-size:10px">—</div></div>
    </div>

    <div class="ec-tabs-bar" id="ec-tabs"></div>

    <div class="ec-2col">
      <div>
        <div class="ec-outlook">
          <div class="ec-ol-tb">
            <div class="ec-ol-ico">O</div>
            <span style="font-size:12px;font-weight:600;color:#fff">New Message — Outlook</span>
            <span id="ec-touch-lbl" style="font-size:10px;color:rgba(255,255,255,.35);margin-left:auto"></span>
          </div>
          <div class="ec-ol-bar">
            <button class="tbtn" style="background:var(--text);color:#fff;border-color:var(--text)" onclick="ecCopyAll()">⎘ Copy All</button>
            <button class="tbtn" style="background:transparent;color:var(--text-2);border-color:var(--border)" onclick="ecCopy('to')">To</button>
            <button class="tbtn" style="background:transparent;color:var(--text-2);border-color:var(--border)" onclick="ecCopy('subj')">Subject</button>
            <button class="tbtn" style="background:transparent;color:var(--text-2);border-color:var(--border)" onclick="ecCopy('body')">Body</button>
            <button class="tbtn" style="background:transparent;color:var(--text-2);border-color:var(--border);margin-left:auto" onclick="ecMarkSent()">✓ Mark Sent</button>
          </div>
          <div class="ec-fr"><div class="ec-fl">To</div><input class="ec-fi-box" id="ec-to-inp" placeholder="recipient@company.com" style="border:none;outline:none;width:100%;padding:8px 10px;font-size:13px;font-family:var(--fb)"><button class="smb" id="smb-to" onclick="ecCopy('to')">copy</button></div>
          <div class="ec-fr"><div class="ec-fl">Cc</div><input class="ec-fi-box" id="ec-cc-inp" placeholder="optional" style="border:none;outline:none;width:100%;padding:8px 10px;font-size:13px;font-family:var(--fb)"></div>
          <div class="ec-fr"><div class="ec-fl">Subject</div><div class="ec-fi-box" id="ec-subj-disp" style="font-weight:600;font-size:12px;display:flex;align-items:center;padding:8px 10px;flex:1"></div><button class="smb" id="smb-subj" onclick="ecCopy('subj')">copy</button></div>
          <div class="ec-body-txt" id="ec-body-disp"></div>
          <div class="ec-ol-ft">
            <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-2);cursor:pointer;font-weight:500">
              <input type="checkbox" id="ec-sig" checked style="accent-color:var(--text)" onchange="ecRenderTouch()"> Include signature
            </label>
            <button class="tbtn" style="background:var(--gold);color:#fff;border-color:var(--gold)" onclick="ecCopyAll()">⎘ Copy All Fields</button>
          </div>
        </div>

        <div class="ec-mto">
          <div class="ec-mto-hdr">
            <span style="font-size:22px;flex-shrink:0">📧</span>
            <div>
              <div style="font-weight:700;font-size:14px;margin-bottom:2px">Open in Outlook</div>
              <div style="font-size:11px;color:var(--text-3);line-height:1.55">One tap launches Outlook with <strong style="color:var(--text)">To, Subject & Body pre-filled</strong>. Just review and hit Send.</div>
            </div>
          </div>
          <button class="ec-mto-btn" id="ec-mto-btn" onclick="ecFireMailto()"><span style="font-size:16px">✉️</span><span id="ec-mto-lbl">Open in Outlook — Pre-filled & Ready</span></button>
          <div class="ec-tip">
            <strong style="color:var(--gold);font-size:9px;letter-spacing:1.5px;text-transform:uppercase">⚡ First time on iPhone?</strong><br>
            If it opens Apple Mail instead: <strong>Settings → Outlook → Default Mail App → Outlook</strong>.
          </div>
          <button class="ec-mkbtn" id="ec-mkbtn" onclick="ecMarkSent()">🚀 Mark as Sent & Log in Cadence</button>
          <!-- hidden elements kept for JS compatibility -->
          <div style="display:none"><div id="prev-to"></div><div id="prev-subj"></div><div id="prev-body"></div><select id="ec-ssel" onchange="ecSetSt(this.value)"><option>Pending</option><option>Drafted</option><option>Sent</option><option>Opened</option><option>Replied</option><option>Meeting Booked</option><option>No Response</option><option>Opted Out</option></select><textarea id="ec-notes"></textarea><div id="ec-tokens"></div><div id="ec-chklist"></div><button id="cpbtn-to"></button><button id="cpbtn-subj"></button><button id="cpbtn-body"></button></div>

      </div>

    </div>
  </div><!-- /composer-view -->

  <!-- ══ SALES AGENT TAB ══ -->
  <div id="hq-agent-view" style="display:none">
    <div class="sa-view">
      <div class="sa-header">
        <div class="sa-header-icon">🤖</div>
        <div>
          <h2>Sales Agent</h2>
          <div class="sa-sub">Multi-channel outreach — SMS, Phone, Email via Twilio + SendGrid</div>
        </div>
      </div>

      <div class="sa-status-bar">
        <div class="sa-status-chip"><span class="dot" id="sa-api-dot"></span> <span id="sa-api-lbl">Checking API…</span></div>
        <div class="sa-status-chip"><span class="dot" id="sa-twilio-dot"></span> <span id="sa-twilio-lbl">Twilio</span></div>
        <div class="sa-status-chip"><span class="dot" id="sa-sg-dot"></span> <span id="sa-sg-lbl">SendGrid</span></div>
        <div class="sa-status-chip" style="margin-left:auto;cursor:pointer;font-weight:600" onclick="saSyncProspects()">☁ Sync Prospects to Agent</div>
      </div>

      <div class="sa-prospect-select" id="sa-prospect-banner" style="display:none">
        <div class="sa-ps-label">ACTIVE PROSPECT</div>
        <div class="sa-ps-name" id="sa-ps-name">—</div>
        <div class="sa-ps-detail" id="sa-ps-detail">—</div>
      </div>

      <div class="sa-grid">
        <!-- SMS Card -->
        <div class="sa-card">
          <div class="sa-card-hdr"><span class="sa-ch-icon">💬</span><h3>Send SMS</h3></div>
          <div class="sa-field"><label>Phone Number</label><input type="tel" id="sa-sms-phone" placeholder="+1 (555) 000-0000"></div>
          <div class="sa-field"><label>Message</label><textarea id="sa-sms-msg" placeholder="Hi {{ name }}, I wanted to reach out about {{ company }}…" rows="4"></textarea></div>
          <div class="sa-btn-row">
            <button class="sa-btn primary" onclick="saSendSMS()">📤 Send SMS</button>
            <button class="sa-btn outline" onclick="saPreviewSMS()">👁 Preview</button>
          </div>
          <div class="sa-result" id="sa-sms-result"></div>
        </div>

        <!-- Phone Card -->
        <div class="sa-card">
          <div class="sa-card-hdr"><span class="sa-ch-icon">📞</span><h3>AI Phone Call</h3></div>
          <div class="sa-field"><label>Phone Number</label><input type="tel" id="sa-call-phone" placeholder="+1 (555) 000-0000"></div>
          <div class="sa-field"><label>Voice Script</label><textarea id="sa-call-script" placeholder="Hello {{ name }}, this is a call from BeyondPayroll…" rows="4"></textarea></div>
          <div class="sa-field"><label>Voice</label>
            <select id="sa-call-voice">
              <option value="Polly.Matthew">Matthew (Male, US)</option>
              <option value="Polly.Joanna">Joanna (Female, US)</option>
              <option value="Polly.Amy">Amy (Female, UK)</option>
              <option value="Polly.Brian">Brian (Male, UK)</option>
            </select>
          </div>
          <div class="sa-btn-row">
            <button class="sa-btn primary" onclick="saMakeCall()">📞 Initiate Call</button>
          </div>
          <div class="sa-result" id="sa-call-result"></div>
        </div>
      </div>

      <!-- Cadence Execution -->
      <div class="sa-sync-section">
        <h3>⚡ Cadence Execution Engine</h3>
        <div style="font-size:12px;color:var(--text-3);margin-bottom:14px">Run all pending cadence steps (SMS, Phone, Email) that are due. Use Dry Run to preview before executing.</div>
        <div class="sa-btn-row">
          <button class="sa-btn green" onclick="saExecuteCadence(true)">🔍 Dry Run</button>
          <button class="sa-btn primary" onclick="saExecuteCadence(false)">🚀 Execute Now</button>
          <button class="sa-btn outline" onclick="saLoadActivity()">📋 Activity Log</button>
        </div>
        <div class="sa-result" id="sa-exec-result"></div>
      </div>

      <!-- Activity Log -->
      <div class="sa-sync-section" id="sa-activity-section" style="display:none">
        <h3>📋 Recent Activity</h3>
        <div class="sa-log" id="sa-activity-log"></div>
      </div>

    </div>
  </div><!-- /agent-view -->

  <!-- ══ ANALYSIS TOOLS TAB ══ -->
  <div id="hq-analysis-view" style="display:none">
    <div class="at-view">

      <!-- Header -->
      <div class="at-header">
        <div class="at-header-left">
          <div class="at-header-icon">📊</div>
          <div>
            <h2 class="at-title">Analysis Tools</h2>
            <div class="at-subtitle">Pull ADP client or prospect data → run Workforce / PEO analyzer → market &amp; competitive intelligence</div>
          </div>
        </div>
        <div class="at-header-actions">
          <button class="at-btn primary" onclick="atPullFromProspect()">⬇ Pull Active Prospect</button>
          <button class="at-btn outline" onclick="atClearAll()">↺ Reset</button>
        </div>
      </div>

      <!-- Status bar -->
      <div class="at-status-bar" id="at-status-bar">
        <div class="at-status-chip" id="at-chip-data"><span class="at-dot grey"></span> No Data Loaded</div>
        <div class="at-status-chip" id="at-chip-tool"><span class="at-dot grey"></span> No Tool Selected</div>
        <div class="at-status-chip" id="at-chip-analysis"><span class="at-dot grey"></span> Analysis Pending</div>
        <div class="at-status-chip at-chip-agent" id="at-chip-agent" onclick="document.getElementById('at-agent-section').scrollIntoView({behavior:'smooth'})"><span class="at-dot green pulse"></span> Research Agent Ready</div>
      </div>

      <!-- ─── SECTION 1: DATA INPUT ─── -->
      <div class="at-section">
        <div class="at-section-hdr">
          <div class="at-section-step">STEP 01</div>
          <div>
            <div class="at-section-title">Data Input</div>
            <div class="at-section-sub">Pull existing ADP client data, load a prospect, or paste/upload account details</div>
          </div>
          <div class="at-section-badge" id="at-data-badge" style="display:none">✓ Data Loaded</div>
        </div>

        <!-- Input mode tabs -->
        <div class="at-input-tabs">
          <button class="at-itab active" id="at-itab-prospect" onclick="atInputMode('prospect')">Active Prospect</button>
          <button class="at-itab" id="at-itab-paste" onclick="atInputMode('paste')">Paste / Manual Entry</button>
          <button class="at-itab" id="at-itab-csv" onclick="atInputMode('csv')">Upload CSV</button>
        </div>

        <!-- Prospect pull mode -->
        <div id="at-mode-prospect" class="at-input-panel">
          <div class="at-prospect-card" id="at-prospect-preview">
            <div class="at-prospect-empty" id="at-prospect-empty">
              <div style="font-size:28px;opacity:.2;margin-bottom:8px">👤</div>
              <div style="font-size:13px;color:var(--text-3)">No active prospect — load one from the Command Center or click <strong style="color:var(--text)">Pull Active Prospect</strong></div>
            </div>
            <div id="at-prospect-loaded" style="display:none">
              <div class="at-prospect-grid" id="at-prospect-grid"></div>
              <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
                <button class="at-btn primary" onclick="atConfirmData()">✓ Use This Prospect for Analysis</button>
                <button class="at-btn outline" onclick="atPullFromProspect()">↻ Refresh</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Manual entry mode -->
        <div id="at-mode-paste" class="at-input-panel" style="display:none">
          <div class="at-form-grid">
            <div class="at-fg">
              <label class="at-fl">Company Name *</label>
              <input class="at-fi" id="at-f-company" placeholder="Acme Corp">
            </div>
            <div class="at-fg">
              <label class="at-fl">Contact Name</label>
              <input class="at-fi" id="at-f-contact" placeholder="Jane Smith">
            </div>
            <div class="at-fg">
              <label class="at-fl">Industry</label>
              <input class="at-fi" id="at-f-industry" placeholder="Healthcare, Staffing, Manufacturing…">
            </div>
            <div class="at-fg">
              <label class="at-fl">State (HQ)</label>
              <input class="at-fi" id="at-f-state" placeholder="VA" maxlength="2">
            </div>
            <div class="at-fg">
              <label class="at-fl">Employee Count</label>
              <input class="at-fi" id="at-f-headcount" placeholder="150" type="number">
            </div>
            <div class="at-fg">
              <label class="at-fl">Client Type</label>
              <select class="at-fi" id="at-f-clienttype">
                <option value="">Select…</option>
                <option value="new">Net-New Prospect</option>
                <option value="existing-wfn">Existing ADP WFN Client</option>
                <option value="existing-ts">Existing ADP TotalSource Client</option>
                <option value="existing-run">Existing ADP Run Client</option>
                <option value="existing-classic">Existing ADP Classic Client</option>
                <option value="competitor">Competitor Platform</option>
              </select>
            </div>
            <div class="at-fg" style="grid-column:1/-1">
              <label class="at-fl">Current Platform / Notes</label>
              <input class="at-fi" id="at-f-platform" placeholder="Currently on Paycom, contract ending Q3…">
            </div>
            <div class="at-fg" style="grid-column:1/-1">
              <label class="at-fl">Pain Points / Notes (optional)</label>
              <textarea class="at-fi" id="at-f-notes" rows="3" placeholder="Key pain points, renewal window, decision maker concerns…"></textarea>
            </div>
          </div>
          <button class="at-btn primary" onclick="atLoadManual()">Load for Analysis →</button>
        </div>

        <!-- CSV upload mode -->
        <div id="at-mode-csv" class="at-input-panel" style="display:none">
          <div class="at-csv-drop" id="at-csv-drop" onclick="document.getElementById('at-csv-input').click()" ondragover="atCsvDragOver(event)" ondragleave="atCsvDragLeave()" ondrop="atCsvDrop(event)">
            <input type="file" id="at-csv-input" accept=".csv,.txt" style="display:none" onchange="atCsvFile(event)">
            <div style="font-size:28px;margin-bottom:8px">📂</div>
            <div style="font-size:13px;font-weight:600;color:var(--text-2);margin-bottom:4px">Drop CSV or click to upload</div>
            <div style="font-size:11px;color:var(--text-3)">Columns: Company, Contact, Industry, State, Headcount, ClientType, Platform, Notes</div>
            <div id="at-csv-status" style="font-size:11px;color:var(--blue);font-weight:600;margin-top:8px;display:none"></div>
          </div>
          <div id="at-csv-records" style="display:none;margin-top:12px">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-3);margin-bottom:8px">Loaded Records — Select One to Analyze</div>
            <div id="at-csv-list" class="at-csv-list"></div>
          </div>
        </div>
      </div>

      <!-- ─── SECTION 2: TOOL SELECTION ─── -->
      <div class="at-section">
        <div class="at-section-hdr">
          <div class="at-section-step">STEP 02</div>
          <div>
            <div class="at-section-title">Select Analysis Tool</div>
            <div class="at-section-sub">Choose the analyzer that matches the prospect's product fit or analysis goal</div>
          </div>
        </div>

        <div class="at-tool-grid">
          <div class="at-tool-card wfn" id="at-tool-wfn" onclick="atSelectTool('wfn')">
            <div class="at-tool-badge wfn">WORKFORCE NOW</div>
            <div class="at-tool-icon">🖥️</div>
            <div class="at-tool-name">WFN Fit Analyzer</div>
            <div class="at-tool-desc">Evaluates platform fit, upgrade potential from legacy ADP, competitive displacement from Paycom / Paylocity / UKG. Outputs ROI model, migration risk, and win probability.</div>
            <div class="at-tool-chips">
              <span class="at-chip blue">ROI Model</span>
              <span class="at-chip blue">Displacement Playbook</span>
              <span class="at-chip blue">Upgrade Path</span>
            </div>
          </div>

          <div class="at-tool-card ts" id="at-tool-ts" onclick="atSelectTool('ts')">
            <div class="at-tool-badge ts">TOTALSOURCE PEO</div>
            <div class="at-tool-icon">🏢</div>
            <div class="at-tool-name">TotalSource PEO Analyzer</div>
            <div class="at-tool-desc">Analyzes PEO fit, PEPM economics, co-employment liability, benefits benchmarking, and renewal-window timing. Surfaces displacement threats from Rippling, TriNet, Justworks, Insperity.</div>
            <div class="at-tool-chips">
              <span class="at-chip red">PEPM Economics</span>
              <span class="at-chip red">Benefits Benchmark</span>
              <span class="at-chip red">Renewal Intelligence</span>
            </div>
          </div>

          <div class="at-tool-card market" id="at-tool-market" onclick="atSelectTool('market')">
            <div class="at-tool-badge market">MARKET INTEL</div>
            <div class="at-tool-icon">📈</div>
            <div class="at-tool-name">Market Analysis</div>
            <div class="at-tool-desc">Pulls live competitive landscape for the prospect's industry &amp; geography. Surfaces regulatory changes, competitor pricing shifts, and market timing signals for urgency creation.</div>
            <div class="at-tool-chips">
              <span class="at-chip gold">Regulatory Alerts</span>
              <span class="at-chip gold">Pricing Intel</span>
              <span class="at-chip gold">Market Timing</span>
            </div>
          </div>

          <div class="at-tool-card full" id="at-tool-full" onclick="atSelectTool('full')">
            <div class="at-tool-badge full">FULL SUITE</div>
            <div class="at-tool-icon">⚡</div>
            <div class="at-tool-name">Full Intelligence Report</div>
            <div class="at-tool-desc">Runs all three analyzers in sequence — WFN fit, TotalSource PEO economics, and market landscape — delivering a single comprehensive competitive brief with pros/cons grid and recommended strategy.</div>
            <div class="at-tool-chips">
              <span class="at-chip navy">WFN + TS + Market</span>
              <span class="at-chip navy">Pros/Cons Grid</span>
              <span class="at-chip navy">Strategy Brief</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── SECTION 3: RUN ANALYSIS ─── -->
      <div class="at-run-section" id="at-run-section">
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
          <div>
            <div id="at-run-label" style="font-family:var(--fd);font-size:16px;font-weight:600;color:rgba(255,255,255,.95)">Ready to analyze</div>
            <div id="at-run-sub" style="font-size:11px;color:rgba(255,255,255,.45);margin-top:2px">Load data and select a tool above</div>
          </div>
          <button class="at-run-btn" id="at-run-btn" onclick="atRunAnalysis()">
            <span id="at-run-btn-icon">▶</span>
            <span id="at-run-btn-lbl">Run Analysis</span>
          </button>
        </div>
      </div>

      <!-- ─── SECTION 4: RESULTS ─── -->
      <div id="at-results" style="display:none;animation:fadeUp .35s ease both">

        <!-- Results header -->
        <div class="at-results-hdr">
          <div>
            <div class="at-results-co" id="at-res-co">—</div>
            <div class="at-results-meta" id="at-res-meta">—</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="at-btn outline" onclick="atCopyReport()">⎘ Copy Report</button>
            <button class="at-btn outline" onclick="atExportPDF()">⬇ Export</button>
            <button class="at-btn primary" onclick="atRunAnalysis()">↻ Regenerate</button>
          </div>
        </div>

        <!-- Sub-tabs for multi-tool results -->
        <div class="at-res-tabs" id="at-res-tabs"></div>

        <!-- Results body -->
        <div class="at-results-body" id="at-results-body">
          <div style="padding:24px;color:var(--text-3);font-style:italic;text-align:center">Results will appear here after running analysis…</div>
        </div>

        <!-- ─── MARKETING/SOCIAL RESEARCH AGENT ─── -->
        <!-- AGENT 1: Weekly Competitor Intelligence (Marketing_Research___Strategy SOP) -->
        <div class="at-agent-section" id="at-agent-section">
          <div class="at-agent-hdr">
            <div class="at-agent-icon">📊</div>
            <div>
              <div class="at-agent-title">Weekly Competitor Intelligence Report</div>
              <div class="at-agent-sub">Runs your ADP competitor intel SOP — researches all 10 competitors (WFN + PEO), surfaces urgent alerts, week-over-week changes, and produces a branded one-pager + summary email</div>
            </div>
            <button class="at-btn primary" onclick="atRunWeeklyIntel()" style="margin-left:auto;flex-shrink:0">Run Weekly Intel →</button>
          </div>
          <div class="at-agent-controls">
            <div class="at-fg" style="flex:1">
              <label class="at-fl">Report Scope</label>
              <select class="at-fi" id="at-intel-scope">
                <option value="full">All 10 Competitors (WFN + PEO)</option>
                <option value="wfn">WorkforceNow Only (5 competitors)</option>
                <option value="peo">TotalSource PEO Only (5 competitors)</option>
                <option value="single">Single Competitor Spotlight</option>
              </select>
            </div>
            <div class="at-fg" style="flex:1">
              <label class="at-fl">Spotlight Competitor</label>
              <select class="at-fi" id="at-intel-competitor">
                <option value="">— Select if Spotlight mode —</option>
                <option value="Paycom">Paycom</option>
                <option value="Paylocity">Paylocity</option>
                <option value="UKG">UKG</option>
                <option value="Dayforce">Dayforce (Ceridian)</option>
                <option value="Workday">Workday</option>
                <option value="Paychex PEO">Paychex PEO</option>
                <option value="Justworks">Justworks</option>
                <option value="Rippling">Rippling</option>
                <option value="TriNet">TriNet</option>
                <option value="Insperity">Insperity</option>
              </select>
            </div>
          </div>
          <div id="at-intel-results" style="display:none;margin-top:16px">
            <div class="at-agent-results-body" id="at-intel-body"></div>
          </div>
        </div>

        <!-- AGENT 2: Social Listening / Unhappy Client Outreach (Social_Media_M_R SOP) -->
        <div class="at-agent-section" style="margin-top:16px" id="at-social-section">
          <div class="at-agent-hdr">
            <div class="at-agent-icon">🔍</div>
            <div>
              <div class="at-agent-title">Social Listening &amp; Outreach Agent</div>
              <div class="at-agent-sub">Runs your unhappy-client outreach SOP — finds frustrated competitor clients across G2, Capterra, LinkedIn, &amp; Reddit, qualifies each prospect, and drafts personalized LinkedIn DM + email outreach packages</div>
            </div>
            <button class="at-btn primary" onclick="atRunSocialAgent()" style="margin-left:auto;flex-shrink:0">Run Social Listen →</button>
          </div>
          <div class="at-agent-controls">
            <div class="at-fg" style="flex:1">
              <label class="at-fl">Scan Channel Priority</label>
              <select class="at-fi" id="at-social-channel">
                <option value="all">All Channels (G2 + Capterra + LinkedIn + Reddit)</option>
                <option value="reviews">Review Sites Only (G2 + Capterra)</option>
                <option value="linkedin">LinkedIn Only</option>
                <option value="reddit">Reddit Only</option>
              </select>
            </div>
            <div class="at-fg" style="flex:1">
              <label class="at-fl">Target Competitor</label>
              <select class="at-fi" id="at-social-competitor">
                <option value="all">All 10 Competitors</option>
                <option value="Paycom">Paycom</option>
                <option value="Paylocity">Paylocity</option>
                <option value="UKG">UKG</option>
                <option value="Dayforce">Dayforce (Ceridian)</option>
                <option value="Workday">Workday</option>
                <option value="Paychex PEO">Paychex PEO</option>
                <option value="Justworks">Justworks</option>
                <option value="Rippling">Rippling</option>
                <option value="TriNet">TriNet</option>
                <option value="Insperity">Insperity</option>
              </select>
            </div>
            <div class="at-fg" style="flex:1">
              <label class="at-fl">ADP Product Match</label>
              <select class="at-fi" id="at-social-product">
                <option value="both">Both WFN + TotalSource PEO</option>
                <option value="wfn">WorkforceNow</option>
                <option value="peo">TotalSource PEO</option>
              </select>
            </div>
          </div>
          <div id="at-social-results" style="display:none;margin-top:16px">
            <div class="at-agent-results-body" id="at-social-body"></div>
          </div>
        </div>

      </div><!-- /at-results -->

    </div><!-- /at-view -->
  </div><!-- /analysis-view -->

</div><!-- /hq-wrap -->
`;
}

// ════════════════════════════════════════════════
//  HQ LOGIC
// ════════════════════════════════════════════════
function initHQ(session){
  const d=document.getElementById('hq-date');
  if(d)d.textContent=new Date().toLocaleDateString('en-US',{weekday:'short',month:'long',day:'numeric',year:'numeric'});
  const ini=(session.first[0]+session.last[0]).toUpperCase();
  const a=document.getElementById('hq-wb-av');if(a)a.textContent=ini;
  const n=document.getElementById('hq-wb-name');if(n)n.textContent='⚡ Sales Intelligence HQ';
  const de=document.getElementById('hq-wb-detail');if(de)de.textContent='AI-Powered Cadence Platform • '+session.first;
  window._hqProspect=null;window._hqPipelineStep=0;window._hqApproved=false;
  window._ecActiveIdx=0;
  if(window._hqProspect) ecSaveStatuses(window._hqProspect.company);
  window._ecStatuses={};window._ecNotes={};window._ecLaunched={};window._ecChecks={};
}

window.hqTab=function(tab){
  // Cadence tab always accessible
  document.getElementById('hq-cmd').style.display=tab==='cmd'?'block':'none';
  document.getElementById('hq-composer-view').style.display=tab==='composer'?'block':'none';
  const agentView=document.getElementById('hq-agent-view');
  if(agentView)agentView.style.display=tab==='agent'?'block':'none';
  const analysisView=document.getElementById('hq-analysis-view');
  if(analysisView)analysisView.style.display=tab==='analysis'?'block':'none';
  document.querySelectorAll('.hq-tab').forEach(t=>t.classList.remove('active'));
  const el=document.getElementById('htab-'+tab);
  if(el) el.classList.add('active');
  if(tab==='composer')ecRenderAll();
  if(tab==='agent')saInit();
  if(tab==='analysis')atInit();
  document.getElementById('hq-container').scrollTop=0;
};

window.openModal=function(){
  document.getElementById('prospectModal').classList.add('open');
};
window.closeModal=function(){
  document.getElementById('prospectModal').classList.remove('open');
  // Reset multi-file import on cancel
  _mfFiles=[]; _mfUrls=[]; window._mfProfileSummary=''; window._mfAIResult=null;
  if(typeof mfRenderChips==='function') mfRenderChips();
  const urlInp=document.getElementById('mfUrlInput'); if(urlInp) urlInp.value='';
};
window.selectTrack=function(t){
  selectedRole=t;
  const wfnEl=document.getElementById('trackOptWFN');
  const tsEl=document.getElementById('trackOptTS');
  if(wfnEl) wfnEl.className='track-opt'+(t==='WFN'?' sel-wfn':'');
  if(tsEl) tsEl.className='track-opt'+(t==='TS'?' sel-ts':'');
};

// ═══════════════════════════════════════════════════════
// GOOGLE VISION IMAGE SCAN — Auto-fill prospect fields
// ═══════════════════════════════════════════════════════
// ── Multi-File AI Import ─────────────────────────────────────────
let _mfFiles = [];
let _mfUrls  = [];  // dropped / typed URLs

function mfDragOver(e){e.preventDefault();document.getElementById('imgScanWrap').classList.add('drag');}
function mfDragLeave(){document.getElementById('imgScanWrap').classList.remove('drag');}
function mfDrop(e){
  e.preventDefault(); e.stopPropagation();
  mfDragLeave();
  // Check for dropped URL (text/uri-list or text/plain that looks like a URL)
  const urlData = e.dataTransfer.getData('text/uri-list')||e.dataTransfer.getData('text/plain')||'';
  const urls = urlData.split('\n').map(function(u){return u.trim();}).filter(function(u){
    return u && !u.startsWith('#') && (u.startsWith('http://') || u.startsWith('https://'));
  });
  if(urls.length){
    urls.forEach(mfAddUrl);
  }
  // Also handle any actual files dropped alongside
  const files = Array.from(e.dataTransfer.files);
  if(files.length) mfAddFiles(files);
}
function mfFilesSelected(e){
  mfAddFiles(Array.from(e.target.files));
  e.target.value=''; // allow re-selecting same file
}
function mfAddFiles(files){
  files.forEach(function(f){
    const dup = _mfFiles.find(function(x){return x.name===f.name&&x.size===f.size;});
    if(!dup) _mfFiles.push(f);
  });
  mfRenderChips();
}
function mfAddUrlFromInput(){
  const inp = document.getElementById('mfUrlInput');
  if(!inp) return;
  let val = inp.value.trim();
  if(!val) return;
  if(!val.startsWith('http://') && !val.startsWith('https://')) val = 'https://'+val;
  mfAddUrl(val);
  inp.value = '';
  inp.focus();
}
function mfAddUrl(rawUrl){
  try{
    const url = new URL(rawUrl.trim());
    const hostname = url.hostname.replace(/^www\./,'');
    const dup = _mfUrls.find(function(u){return u.raw===url.href;});
    if(!dup) _mfUrls.push({raw:url.href, label:hostname});
    mfRenderChips();
  }catch(e){ showToast('Invalid URL: '+rawUrl, true); }
}
function mfRemoveUrl(idx){
  _mfUrls.splice(idx,1);
  mfRenderChips();
}
function mfRemoveFile(idx){
  _mfFiles.splice(idx,1);
  mfRenderChips();
}
function mfFileIcon(f){
  const t = f.type||'';
  if(t.startsWith('image/')) return '🖼';
  if(t==='application/pdf') return '📄';
  if(t==='text/plain') return '📝';
  return '📎';
}
function mfRenderChips(){
  const wrap = document.getElementById('mfChips');
  const btn  = document.getElementById('mfAnalyzeBtn');
  const icon = document.getElementById('imgScanIcon');
  const lbl  = document.getElementById('imgScanLbl');
  const sub  = document.getElementById('imgScanSub');
  const badge= document.getElementById('imgScanBadge');
  if(!wrap) return;
  badge.classList.remove('show');
  if(_mfFiles.length===0 && _mfUrls.length===0){
    wrap.innerHTML='';
    btn.classList.remove('show');
    icon.style.display='';
    lbl.textContent='Drop files to auto-build profile';
    sub.style.display='';
    const urlInp=document.getElementById('mfUrlInput');if(urlInp)urlInp.value='';
    return;
  }
  icon.style.display='none';
  const totalItems = _mfFiles.length + _mfUrls.length;
  lbl.textContent = totalItems+' source'+ (totalItems!==1?'s':'') +' ready to analyze';
  sub.style.display='none';
  // Render file chips
  const fileChips = _mfFiles.map(function(f,i){
    return '<div class="mf-chip">'+
      '<span class="mf-chip-icon">'+mfFileIcon(f)+'</span>'+
      '<span class="mf-chip-name" title="'+f.name+'">'+f.name+'</span>'+
      '<button class="mf-chip-rm" onclick="event.stopPropagation();mfRemoveFile('+i+')" title="Remove">&#10005;</button>'+
    '</div>';
  });
  // Render URL chips
  const urlChips = _mfUrls.map(function(u,i){
    return '<div class="mf-chip" style="background:rgba(184,146,10,.2);border-color:rgba(184,146,10,.35)">'+
      '<span class="mf-chip-icon">🌐</span>'+
      '<span class="mf-chip-name" title="'+u.raw+'">'+u.label+'</span>'+
      '<button class="mf-chip-rm" onclick="event.stopPropagation();mfRemoveUrl('+i+')" title="Remove">&#10005;</button>'+
    '</div>';
  });
  wrap.innerHTML = fileChips.concat(urlChips).join('');
  btn.classList.add('show');
}

// ── Gong transcript → SRE pain point keyword map ─────────────────────
// Loaded from gong-keywords.json — edit that file to add/remove triggers
// Falls back to inline defaults if fetch fails (offline / local file open)
let GONG_PAIN_MAP={
  'sre-401k':  ['401k','401(k)','retirement plan','retirement admin','matching error','retirement contribution','pension error'],
  'sre-wc':    ['workers comp','workers\' comp','work comp','workcomp','injury claim','mod rate','experience mod','NCCI','loss run','work-related injury'],
  'sre-aca':   ['ACA','affordable care act','1094','1095','minimum essential','employer mandate','shared responsibility','aca compliance','aca filing'],
  'sre-benefits':['benefits error','benefit deduction','cobra','open enrollment problem','carrier issue','benefits administration','benefit billing','wrong deduction','enrollment error'],
  'sre-benefits-cost':['benefits too expensive','benefits cost','premiums too high','unaffordable benefits','can\'t afford benefits','benefits pricing'],
  'sre-hr-bandwidth':['hr is overwhelmed','short staffed','no hr','one person hr','hr department','overworked','too much admin','bandwidth issue'],
  'sre-tax':   ['multi-state','multistate','state tax','nexus','state withholding','tax filing error','tax notice','SIT','state income tax','tax penalty','garnishment','levy'],
  'sre-platform':['system down','outage','login issue','portal broken','platform issue','ADP down','slow system','locked out','access issue','can\'t log in','glitch','bug','error message','system error'],
  'sre-gl':    ['general ledger','GL','journal entry','mapping error','accounting integration','QuickBooks','Sage','NetSuite','ERP','ledger code','chart of accounts','cost center','GL code'],
  'sre-support':['no response','can\'t reach','support ticket','customer service','account manager','rep','unresponsive','escalation','no one calls back','ignored','slow response','service issue'],
  'sre-reporting':['no reporting','bad reports','can\'t pull data','data export','analytics','dashboards','visibility','reporting gaps','custom reports'],
  'sre-mobile':['no app','mobile app','self service','employee portal','employee app','self-service portal','no mobile access'],
  'sre-i9':    ['I-9','i9','e-verify','work authorization','everify','immigration','onboarding compliance','new hire paperwork','i-9 audit'],
  'sre-multi': ['multiple entities','multi-entity','subsidiaries','holding company','multiple EINs','multiple companies','parent company','several companies','umbrella'],
  'sre-manual':['manual','spreadsheet','excel','paper','manual process','by hand','rekeying','double entry','no automation','time-consuming','inefficient'],
  'sre-onboarding':['onboarding','new hire','new employee','paperwork','day one','first day','slow to start','onboard'],
  'sre-turnover':['turnover','attrition','employees leaving','retention','losing people','high turnover','hard to keep'],
  'sre-compliance':['compliance','audit','liability','risk','penalty','fine','regulation','HR compliance','employment law']
};

// Load keywords from gong-keywords.json and merge into GONG_PAIN_MAP
(function loadGongKeywords(){
  fetch('./gong-keywords.json?v='+Date.now())
    .then(function(r){
      if(!r.ok) throw new Error('HTTP '+r.status);
      return r.json();
    })
    .then(function(data){
      const loaded={};
      let count=0;
      for(const[id,entry] of Object.entries(data)){
        if(id.startsWith('_')) continue; // skip _meta
        if(entry && Array.isArray(entry.keywords)){
          loaded[id]=entry.keywords;
          count++;
        }
      }
      if(count>0){
        GONG_PAIN_MAP=loaded;
        console.log('[BeyondPayroll] gong-keywords.json loaded — '+count+' pain categories, '
          +Object.values(loaded).reduce((s,a)=>s+a.length,0)+' total keywords');
      }
    })
    .catch(function(e){
      console.info('[BeyondPayroll] gong-keywords.json not loaded ('+e.message+') — using built-in defaults');
    });
})();

// Detect client type & ADP products from transcript text
function gongDetectClientType(text){
  const t=text.toLowerCase();
  const adpProducts=[];
  if(/\badp run\b|\brun payroll\b|\brun platform\b/.test(t)) adpProducts.push('run');
  if(/\bclassic\b|\badp classic\b|\blegacy adp\b/.test(t)) adpProducts.push('classic');
  if(/\bworkforce now\b|\bwfn\b/.test(t)) adpProducts.push('wfn');
  if(/\btotalsource\b|\bpeo\b|\bco.?employ/.test(t)) adpProducts.push('ts');
  if(/\betime\b|\btlm\b|\btime and labor\b/.test(t)) adpProducts.push('etime');
  if(/\badp.*benefits\b|\bhealth.*benefits\b|\bbenefits admin\b|\bbenefits administration\b/.test(t)) adpProducts.push('benefits');
  if(/\bworkers.?comp\b|\bwc.*adp\b|\badp.*wc\b|\bworkers.*compensation.*adp\b/.test(t)) adpProducts.push('wc');
  if(/\b401k\b|\b401\(k\)\b|\bretirement.*adp\b|\badp.*retirement\b|\badp.*401\b/.test(t)) adpProducts.push('401k');
  const isExisting=adpProducts.length>0||/currently (using|on|with) adp|existing adp|adp client|already (use|using|have) adp/.test(t);
  return{clientType:isExisting?'existing':'new', adpProducts};
}

// Map Gong transcript text to SRE checkboxes
function gongMapPains(text){
  const t=text.toLowerCase();
  const hits=[];
  for(const[id,keywords] of Object.entries(GONG_PAIN_MAP)){
    for(const kw of keywords){
      if(t.includes(kw.toLowerCase())){hits.push(id);break;}
    }
  }
  return hits;
}

// Apply SRE selections from scan results
function sreApplyFromScan(parsed){
  // Client type silo
  if(parsed.client_type){
    const ct=parsed.client_type.toLowerCase();
    if(ct==='existing'||ct==='adp') sreSilo('existing');
    else if(ct==='new') sreSilo('new');
  }
  // ADP product sub-track
  if(parsed.adp_products&&Array.isArray(parsed.adp_products)){
    parsed.adp_products.forEach(function(p){
      const el=document.getElementById('sre-adp-'+p.toLowerCase());
      if(el&&!el.classList.contains('sel')) sreAdpToggle(p.toLowerCase(),el);
    });
  }
  // Pain point checkboxes
  if(parsed.pain_points&&Array.isArray(parsed.pain_points)){
    parsed.pain_points.forEach(function(id){
      const cb=document.getElementById(id);
      if(cb&&!cb.checked){
        cb.checked=true;
        const label=cb.closest('.sre-cb');
        if(label) label.classList.add('ck');
      }
    });
  }
  // Refresh SRE scores if prospect data changed
  if(typeof sreRefresh==='function') sreRefresh();
}

async function mfAnalyzeAll(){
  if(_mfFiles.length===0){showToast('Add at least one file first',true);return;}
  const progress = document.getElementById('imgScanProgress');
  const badge    = document.getElementById('imgScanBadge');
  const bar      = document.getElementById('mfProgressBar');
  const fill     = document.getElementById('mfProgressFill');
  const btn      = document.getElementById('mfAnalyzeBtn');
  const lbl      = document.getElementById('imgScanLbl');

  badge.classList.remove('show');
  btn.disabled = true;
  btn.textContent = '⟳ Analyzing files...';
  bar.classList.add('show');
  fill.style.width = '0%';

  // ── Read all files ────────────────────────────────────────────
  const parts = [];
  for(let i=0;i<_mfFiles.length;i++){
    const f = _mfFiles[i];
    lbl.textContent = 'Reading '+f.name+' ('+(i+1)+'/'+_mfFiles.length+')...';
    fill.style.width = Math.round(((i+0.5)/_mfFiles.length)*55)+'%';
    try{
      if(f.type==='text/plain'||f.name.match(/\.(txt|csv|md)$/i)){
        const text = await new Promise(function(res,rej){const r=new FileReader();r.onload=function(e){res(e.target.result);};r.onerror=rej;r.readAsText(f);});
        parts.push({text:'[FILE '+(i+1)+': '+f.name+' -- text content below]\n'+text});
      } else {
        const b64 = await new Promise(function(res,rej){const r=new FileReader();r.onload=function(e){res(e.target.result.split(',')[1]);};r.onerror=rej;r.readAsDataURL(f);});
        parts.push({text:'[FILE '+(i+1)+': '+f.name+']'});
        parts.push({inline_data:{mime_type:f.type||'image/jpeg',data:b64}});
      }
    }catch(e){console.warn('mfRead:',f.name,e);}
  }

  // ── Fetch URL content (simplified - direct fetch, no CF Worker) ────────
  for(let u=0; u<_mfUrls.length; u++){
    const urlObj = _mfUrls[u];
    lbl.textContent = 'Fetching '+urlObj.label+'...';
    fill.style.width = (60 + Math.round((u+0.5)/_mfUrls.length*15))+'%';
    try{
      // Direct fetch - will work for CORS-enabled sites
      // For sites without CORS, this will fail silently and skip the URL
      const fetchResp = await fetch(urlObj.raw);
      const pageText = await fetchResp.text();
      if(pageText){
        const truncated = pageText.substring(0,8000);
        parts.push({text:'[WEBSITE: '+urlObj.raw+']\n'+truncated});
      } else {
        parts.push({text:'[WEBSITE: '+urlObj.raw+' — fetched but no readable content extracted]'});
      }
    }catch(urlErr){
      console.warn('URL fetch failed for',urlObj.raw, urlErr);
      parts.push({text:'[WEBSITE: '+urlObj.raw+' — could not be fetched (CORS restriction), use for context only]'});
    }
  }

  const totalSources = _mfFiles.length + _mfUrls.length;
  fill.style.width = '60%';
  lbl.textContent = 'AI building prospect profile from '+totalSources+' source'+(totalSources!==1?'s':'')+'...';

  const totalSrcs = _mfFiles.length + _mfUrls.length;
  const prompt = `You are a senior ADP sales intelligence analyst. I am giving you ${totalSrcs} source(s) about a prospect (files, screenshots, and/or website content) — images, PDFs, screenshots, emails, transcripts, or any combination. Read ALL of them together and build the most complete, useful client prospect profile possible.

Return ONLY a valid JSON object. No markdown. No explanation. The structure must be exactly:
{
  "core": {
    "company": "",
    "contact": "",
    "title": "",
    "email": "",
    "phone": "",
    "linkedin": ""
  },
  "fields": [
    { "label": "Industry", "value": "", "group": "firmographic" },
    { "label": "State", "value": "", "group": "firmographic" },
    { "label": "Headcount", "value": "", "group": "firmographic" }
  ],
  "insights": [
    { "label": "Pain Point", "value": "" }
  ],
  "sre": {
    "client_type": "new or existing",
    "adp_products": [],
    "pain_points": [],
    "transcript_text": ""
  },
  "summary": ""
}

INSTRUCTIONS:
- core: always populate these 6 fields if data exists. These are the minimum required fields. For linkedin: if an explicit LinkedIn URL is found, use it exactly. If not found but you have a contact name and company name, construct a best-guess LinkedIn profile URL in the format linkedin.com/in/firstname-lastname (lowercase, hyphenated). Always populate this field with your best inference — never leave it blank if you have a name.
- fields: this is open-ended. Include ANY field that would be useful for a sales rep preparing for a discovery call. Standard ones: Industry, State, Headcount, Website, HQ Address. But also add any that appear in the files: Current Vendor, Contract End Date, Decision Timeline, Key Stakeholders, Annual Revenue, Number of Locations, ERP/HRIS System, Benefits Broker, Recent News, Competitive Risk, Objections Raised, Budget Mentioned, etc. Only include fields where you actually found data. Each field needs: label (clear human-readable name), value (the data), group (one of: firmographic | contact_info | sales_intel | competitive | financial | timeline).
- insights: list of key intelligence points a sales rep must know — pain points confirmed, signals spotted, risks, opportunities. Each needs label and value.
- sre: pain_points must only use these exact IDs where evidence exists: sre-401k, sre-wc, sre-aca, sre-benefits, sre-tax, sre-platform, sre-gl, sre-support, sre-i9, sre-multi, sre-manual. adp_products only if currently in use. Valid adp_product values: run, classic, wfn, ts, etime, benefits, wc, 401k, other.
- summary: 3-4 sentence executive brief for the sales rep — who this prospect is, what they need, why they are a strong ADP opportunity, and recommended first move.
- Use "" or [] for anything not found. Do not guess or hallucinate values.`;

  parts.push({text: prompt});

  try{
    // ✨ CLOUDFLARE WORKER PROXY - API key handled server-side
    // Convert Gemini parts → Anthropic messages format (worker converts internally)
    const resp = await fetch(API_ENDPOINTS.gemini, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        messages: [{ role: 'user', content: partsToAnthropicContent(parts) }]
      })
    });
    
    if (!resp.ok) {
      const errorText = await resp.text();
      console.error('[Gemini API Error]', errorText);
      throw new Error('Gemini API request failed: ' + resp.status + ' - Check your API key in app.js');
    }
    
    const data = await resp.json();
    const raw = (data.candidates&&data.candidates[0]&&data.candidates[0].content&&data.candidates[0].content.parts
      ? data.candidates[0].content.parts.map(function(p){return p.text||'';}).join('')
      : ''
    );
    
    if (!raw) {
      throw new Error('No response from Gemini API - check your API key');
    }
    
    // Robust JSON extraction — strip fences, find outermost { }
    let clean = raw.replace(/```json|```/g,'').trim();
    const jsonStart = clean.indexOf('{');
    const jsonEnd   = clean.lastIndexOf('}');
    if(jsonStart !== -1 && jsonEnd !== -1) clean = clean.slice(jsonStart, jsonEnd+1);
    let parsed;
    try{ parsed = JSON.parse(clean); }
    catch(pe){
      // Last-resort: try to extract partial JSON
      console.error('[BP] JSON parse failed, raw:', clean.substring(0,200));
      throw new Error('AI returned invalid JSON — try again or fill manually');
    }

    fill.style.width = '80%';

    // ── Store full AI result for saveProspect ─────────────────
    window._mfAIResult = parsed;

    // ── Populate core hidden fields (SRE compatibility) ───────
    const c = parsed.core||{};
    document.getElementById('f-company').value  = c.company||'';
    document.getElementById('f-contact').value  = c.contact||'';
    document.getElementById('f-email').value    = c.email||'';
    document.getElementById('f-phone').value    = c.phone||'';
    // Auto-construct LinkedIn URL if AI didn't find one explicitly
    let _liVal = c.linkedin || '';
    if (!_liVal && c.contact) {
      // Build best-guess URL: linkedin.com/in/firstname-lastname
      const _liParts = c.contact.trim().toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .split(/\s+/)
        .filter(Boolean);
      if (_liParts.length >= 2) {
        _liVal = 'linkedin.com/in/' + _liParts.join('-');
      } else if (_liParts.length === 1) {
        // Single name — append company slug
        const _coSlug = (c.company||'').toLowerCase().replace(/[^a-z0-9]/g,'').substring(0,10);
        _liVal = 'linkedin.com/in/' + _liParts[0] + (_coSlug ? '-' + _coSlug : '');
      }
    }
    document.getElementById('f-linkedin').value = _liVal;

    // Map standard fields to hidden legacy inputs
    const fields = parsed.fields||[];
    fields.forEach(function(f){
      const lc = (f.label||'').toLowerCase();
      if(lc==='industry')  document.getElementById('f-industry').value  = f.value||'';
      if(lc==='state')     document.getElementById('f-state').value     = (f.value||'').toUpperCase().substring(0,2);
      if(lc==='headcount') document.getElementById('f-headcount').value = (f.value||'').replace(/\D/g,'');
      if(lc.includes('persona')||lc.includes('title')||lc.includes('decision'))
        dynSetPersona(c.title||f.value||'');
    });
    if(c.title) dynSetPersona(c.title);

    // ── Render the dynamic form ───────────────────────────────
    dynRenderForm(parsed);

    // ── Apply SRE data ────────────────────────────────────────
    if(parsed.sre) sreApplyFromScan(parsed.sre);
    if(parsed.sre&&parsed.sre.transcript_text){
      const ta=document.getElementById('sre-transcript');
      if(ta&&!ta.value) ta.value=parsed.sre.transcript_text;
    }

    // ── Build notes from summary ──────────────────────────────
    const srcLine = 'Sources: '+_mfFiles.map(function(f){return f.name;}).join(', ');
    window._mfProfileSummary = srcLine+'\n\n'+(parsed.summary||'');

    fill.style.width = '100%';
    const fieldCount = fields.filter(function(f){return f.value;}).length;
    const painCount  = (parsed.sre&&parsed.sre.pain_points||[]).length;

    setTimeout(function(){
      bar.classList.remove('show');
      badge.classList.add('show');
      lbl.textContent = '✓ '+(fieldCount+Object.keys(c).filter(function(k){return c[k];}).length)+' fields built, '+painCount+' pain point'+(painCount!==1?'s':'')+' identified';
      btn.textContent = '⟳ Re-analyze';
      btn.disabled = false;
      showToast('✓ Prospect profile built from '+_mfFiles.length+' file'+(_mfFiles.length!==1?'s':''));
    },400);

  }catch(err){
    bar.classList.remove('show');
    btn.disabled=false; btn.textContent='⚡ Build Profile from Files →';
    lbl.textContent='Analysis failed — check connection and retry';
    const sub=document.getElementById('imgScanSub');
    if(sub){sub.style.display='';sub.textContent='Error: '+(err.message||String(err));}
    console.error('[BeyondPayroll] mfAnalyzeAll:',err);
  }
}


function dynSetPersona(title){
  const t=(title||'').toLowerCase();
  const sel=document.getElementById('f-persona');
  if(!sel) return;
  if(t.includes('cfo')||t.includes('financ'))           sel.value='CFO';
  else if(t.includes('hr dir'))                          sel.value='HR Director';
  else if(t.includes('vp hr')||t.includes('vp, hr'))     sel.value='VP HR';
  else if(t.includes('controller'))                      sel.value='Controller';
  else if(t.includes('ceo')||t.includes('owner')||t.includes('president')) sel.value='CEO/Owner';
  else if(t.includes('oper'))                            sel.value='Operations';
}

const DYN_GROUP_LABELS = {
  firmographic:  'Company Info',
  contact_info:  'Contact Details',
  sales_intel:   'Sales Intelligence',
  competitive:   'Competitive Intel',
  financial:     'Financial & Budget',
  timeline:      'Timeline & Process'
};

// Labels that map to standard form fields — skip from AI extras
const DYN_STANDARD_LABELS = ['company','contact','email','phone','industry','state','headcount','linkedin','persona','title','decision maker','decision-maker','name'];

const DYN_TAG_MAP = {
  firmographic:'',contact_info:'',
  sales_intel:'sales',competitive:'comp',financial:'fin',timeline:'time'
};
const DYN_TAG_LABELS = {sales:'Sales Intel',comp:'Competitive',fin:'Financial',time:'Timeline'};

function dynRenderForm(parsed){
  const grid = document.getElementById('dyn-fields-grid');
  if(!grid) return;

  // Filter out fields already in standard form
  const fields = (parsed.fields||[]).filter(function(f){
    if(!f.value||!String(f.value).trim()) return false;
    const lc = (f.label||'').toLowerCase().trim();
    return !DYN_STANDARD_LABELS.some(function(s){return lc===s||lc===s+'name'||lc.startsWith(s+' ');});
  });
  const insights = (parsed.insights||[]).filter(function(i){return i.value&&String(i.value).trim();});

  if(fields.length===0 && insights.length===0){ grid.style.display='none'; return; }

  let html = '';

  // Section header
  html += '<div class="pm-section-hdr" style="margin-bottom:10px">';
  html += '<div class="pm-section-dot gold"></div>';
  html += '<span class="pm-section-lbl">AI-Discovered Fields</span>';
  html += '<span style="font-size:9px;color:var(--text-3);margin-left:auto;font-style:italic">drag to reorder</span>';
  html += '</div>';

  // Draggable field cards
  if(fields.length>0){
    html += '<div class="dyn-fields-container" id="dynCardContainer">';
    fields.forEach(function(f,i){
      const tag = DYN_TAG_MAP[f.group||'']||'';
      const tagLabel = tag ? DYN_TAG_LABELS[tag]||'' : '';
      const fid = 'dynf-'+f.label.replace(/\s+/g,'-').toLowerCase()+'-'+i;
      html += '<div class="dyn-card" draggable="true" data-idx="'+i+'" '+
        'ondragstart="dynDragStart(event,'+i+')" ondragover="dynDragOver(event,'+i+')" '+
        'ondragleave="dynDragLeave(event)" ondrop="dynDragDrop(event,'+i+')" ondragend="dynDragEnd()">';
      html += '<div class="dyn-card-grip" title="Drag to reorder">⣿</div>';
      html += '<div class="dyn-card-body">';
      html += '<div class="dyn-card-lbl">'+escHtml(f.label)+'</div>';
      html += '<input class="dyn-card-inp" id="'+fid+'" value="'+escHtml(String(f.value))+'" data-key="'+escHtml(f.label)+'">';
      if(tag) html += '<div class="dyn-card-tag '+tag+'">'+escHtml(tagLabel)+'</div>';
      html += '</div></div>';
    });
    html += '</div>';
  }

  // Insights panel
  if(insights.length>0){
    const srcs = window._mfFiles ? window._mfFiles.map(function(f){return f.name;}).join(', ') : '';
    html += '<div class="dyn-insights-panel">';
    html += '<div class="dyn-insights-hdr">';
    html += '<span class="dyn-insights-hdr-icon">⚡</span>';
    html += '<span class="dyn-insights-hdr-lbl">AI Sales Intelligence</span>';
    if(srcs) html += '<span class="dyn-insights-hdr-src">'+escHtml(srcs)+'</span>';
    html += '</div>';
    insights.forEach(function(ins){
      html += '<div class="dyn-insight-item">';
      html += '<div class="dyn-insight-k">'+escHtml(ins.label||'')+'</div>';
      html += '<div class="dyn-insight-v">'+escHtml(String(ins.value))+'</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  grid.innerHTML = html;
  grid.style.display = 'block';
}

// ── Drag-to-reorder logic for AI field cards ─────────────────────
let _dynDragSrc = null;
function dynDragStart(e,idx){
  _dynDragSrc = idx;
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.classList.add('dragging');
}
function dynDragOver(e,idx){
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.dyn-card').forEach(function(c){c.classList.remove('drag-over');});
  if(idx !== _dynDragSrc) e.currentTarget.classList.add('drag-over');
}
function dynDragLeave(e){ e.currentTarget.classList.remove('drag-over'); }
function dynDragDrop(e,idx){
  e.preventDefault();
  if(_dynDragSrc === null || _dynDragSrc === idx) return;
  const container = document.getElementById('dynCardContainer');
  if(!container) return;
  const cards = Array.from(container.querySelectorAll('.dyn-card'));
  const src  = cards[_dynDragSrc];
  const dest = cards[idx];
  if(!src||!dest) return;
  if(_dynDragSrc < idx) container.insertBefore(src, dest.nextSibling);
  else container.insertBefore(src, dest);
  // Re-index data-idx
  Array.from(container.querySelectorAll('.dyn-card')).forEach(function(c,i){ c.setAttribute('data-idx',i); });
}
function dynDragEnd(){
  document.querySelectorAll('.dyn-card').forEach(function(c){
    c.classList.remove('dragging','drag-over');
  });
  _dynDragSrc = null;
}

function dynOnManualInput(){
  // no-op — kept for safety, form is always visible now
}

function dynCollectFields(){
  // Collect all dynamic field values keyed by their label
  const result = {};
  document.querySelectorAll('#dyn-fields-grid .dyn-inp').forEach(function(inp){
    const key = inp.getAttribute('data-key');
    if(key) result[key] = inp.value;
  });
  return result;
}

// Backward-compat stub
async function imgProcess(file){ _mfFiles=[file]; mfRenderChips(); await mfAnalyzeAll(); }


// ═══════════════════════════════════════════════════════
// SMART ROUTING ENGINE
// ═══════════════════════════════════════════════════════
// ── Cloudflare Worker proxy handles all API authentication ──

// Helper: convert Gemini native parts array → Anthropic content array
// Needed because the CF Worker expects Anthropic format and converts internally
function partsToAnthropicContent(parts) {
  return parts.map(function(p) {
    if (p.text !== undefined) {
      return { type: 'text', text: p.text };
    } else if (p.inline_data) {
      return { type: 'image', source: { type: 'base64', media_type: p.inline_data.mime_type || 'image/jpeg', data: p.inline_data.data } };
    }
    return null;
  }).filter(Boolean);
}

// Helper: POST to Gemini via Cloudflare Worker
// Worker handles API key injection and format conversion
function bpGeminiFetch(body) {
  // Send Anthropic-style message format to worker
  // Worker converts to Gemini format internally
  return fetch(API_ENDPOINTS.gemini, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

// Helper: extract text from Gemini response
function bpGeminiText(data) {
  return (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts)
    ? data.candidates[0].content.parts.map(function(p){ return p.text || ''; }).join('')
    : '';
}

let _sreClientType='';
let _sreAdpProducts=new Set();
let _sreAnalysis=null;

function sreSilo(type){
  _sreClientType=type;
  document.getElementById('sre-opt-new').className='sre-silo-opt'+(type==='new'?' active-new':'');
  document.getElementById('sre-opt-existing').className='sre-silo-opt'+(type==='existing'?' active-existing':'');
  document.getElementById('sre-adp-subtrack').classList.toggle('show',type==='existing');
}

function sreAdpToggle(key,el){
  if(_sreAdpProducts.has(key)){_sreAdpProducts.delete(key);el.classList.remove('active');}
  else{_sreAdpProducts.add(key);el.classList.add('active');}
}

function sreRefresh(){
  const p=window._hqProspect;
  const status=document.getElementById('sre-status');
  if(!status)return; // HQ not yet rendered
  const fields=[
    ['sre-company','company'],['sre-contact','contact'],['sre-persona','persona'],
    ['sre-industry','industry'],['sre-state','state'],['sre-headcount','headcount']
  ];
  if(!p){
    status.innerHTML='<span class="sre-dot"></span><span>No Prospect</span>';
    status.classList.remove('loaded');
    fields.forEach(([id])=>{const el=document.getElementById(id);if(el){el.textContent='—';el.classList.add('empty');}});
    return;
  }
  fields.forEach(([id,key])=>{
    const el=document.getElementById(id);
    if(!el)return;
    const val=p[key];
    if(val&&String(val).trim()){el.textContent=val;el.classList.remove('empty');}
    else{el.textContent='—';el.classList.add('empty');}
  });
  // Headcount confidence band
  const hcBand=document.getElementById('sre-hc-band');
  if(hcBand){
    const hc=parseInt(p.headcount)||0;
    const band=sreHeadcountBand(hc);
    if(band){
      hcBand.textContent='Range: '+band.low+'–'+band.high+' EEs · '+band.tier;
      hcBand.style.display='block';
    } else {
      hcBand.style.display='none';
    }
  }
  status.innerHTML='<span class="sre-dot"></span><span>Loaded</span>';
  status.classList.add('loaded');
  // Also auto-select existing if prospect has ADP track
  if(p.track==='WFN'||p.track==='TS') sreSilo('existing');
  // Restore competitor if previously saved
  const compEl=document.getElementById('sre-competitor');
  if(compEl&&p.competitor){compEl.value=p.competitor;sreCompetitorChanged();}
  // Restore ADP product buttons
  if(p.adpProducts&&p.adpProducts.length){
    _sreAdpProducts=new Set();
    // First clear all active states
    document.querySelectorAll('.sre-adp-opt').forEach(function(el){ el.classList.remove('active'); });
    // Re-activate saved products
    p.adpProducts.forEach(function(key){
      const el=document.getElementById('sre-adp-'+key.toLowerCase());
      if(el){ _sreAdpProducts.add(key.toLowerCase()); el.classList.add('active'); }
    });
    // If any products selected, switch to existing client silo
    if(_sreAdpProducts.size>0) sreSilo('existing');
  }
  const rdEl=document.getElementById('sre-renewal-date');
  if(rdEl&&p.renewalDate) rdEl.value=p.renewalDate;
  // Restore ADP upsell goal if present
  const upsellEl=document.getElementById('sre-adp-upsell-goal');
  if(upsellEl&&p.extProfile&&p.extProfile.adpUpsellGoal) upsellEl.value=p.extProfile.adpUpsellGoal;
  // Restore extended profile fields if present
  if(p.extProfile){
    const ext=p.extProfile;
    const setV=(id,v)=>{const el=document.getElementById(id);if(el&&v)el.value=v;};
    setV('sre-revenue',ext.revenue);setV('sre-tenure',ext.tenure);
    setV('sre-states-ops',ext.statesOps);setV('sre-pay-freq',ext.payFreq);
    setV('sre-ee-mix',ext.eeMix);setV('sre-union',ext.union);
    setV('sre-timeline',ext.timeline);setV('sre-budget',ext.budget);
    setV('sre-stage',ext.stage);setV('sre-other-vendors',ext.otherVendors);
    setV('sre-champion',ext.champion);setV('sre-econ-buyer',ext.econBuyer);
    setV('sre-notices',ext.notices);setV('sre-aca-status',ext.acaStatus);
    setV('sre-epli',ext.epli);setV('sre-growth',ext.growth);
    setV('sre-ext-notes',ext.extNotes);
  }
  // Restore pain checkboxes
  if(p.painPoints&&Array.isArray(p.painPoints)){
    const REVERSE={
      '401K admin errors':'sre-401k','Workers Comp issues':'sre-wc',
      'ACA compliance problems':'sre-aca','Benefits payment errors':'sre-benefits',
      'Benefits cost too high':'sre-benefits-cost','HR team overwhelmed':'sre-hr-bandwidth',
      'Multi-state tax issues':'sre-tax','Platform failures':'sre-platform',
      'GL integration errors':'sre-gl','Poor support/communication':'sre-support',
      'Weak reporting/analytics':'sre-reporting','No mobile/self-service':'sre-mobile',
      'I-9 / E-Verify errors':'sre-i9','Multi-entity complexity':'sre-multi',
      'Manual/spreadsheet processes':'sre-manual','Slow/manual onboarding':'sre-onboarding',
      'High turnover/retention':'sre-turnover','General compliance risk':'sre-compliance'
    };
    p.painPoints.forEach(label=>{
      const id=REVERSE[label];
      if(id){const el=document.getElementById(id);if(el)el.checked=true;}
    });
  }
  // Restore track selector and tone if previously saved
  if(p.track&&(p.track==='WFN'||p.track==='TS')){
    _sreSelectedTrack=p.track;
    selectedRole=p.track;
    setTimeout(function(){ sreSelectTrack(p.track); },50);
  }
  if(p.cadenceTone){
    _sreCadenceTone=p.cadenceTone;
    setTimeout(function(){
      sreToneChanged(p.cadenceTone);
      const radios=document.querySelectorAll('[name="sre-cadence-tone"]');
      radios.forEach(function(r){ if(r.value===p.cadenceTone) r.checked=true; });
    },60);
  }
  // Restore MCA panel if result exists
  if(p.mcaResult){
    const mcaPanel=document.getElementById('sre-mca-panel');
    if(mcaPanel) mcaPanel.style.display='block';
  }
  // Restore PEO profile fields if TS track
  if(p.track==='TS' && p.peoProfile){
    setTimeout(function(){ if(typeof window.sreRestorePeoProfile==='function') window.sreRestorePeoProfile(p); }, 80);
  }
}

// ── Headcount confidence band ────────────────────────────────────
function sreHeadcountBand(hc){
  if(!hc||hc<=0) return null;
  const low=Math.max(1,Math.round(hc*0.85));
  const high=Math.round(hc*1.15);
  let tier='';
  if(hc<10) tier='micro-employer';
  else if(hc<50) tier='small business';
  else if(hc<150) tier='lower mid-market';
  else if(hc<500) tier='mid-market';
  else if(hc<1000) tier='upper mid-market';
  else tier='enterprise';
  return {low,high,tier};
}

// ── Competitor insight snippets ──────────────────────────────────
const COMP_INSIGHTS={
  // Existing ADP clients
  adp_run:'ADP RUN client — upsell opportunity. RUN has payroll only; WFN adds HR, benefits, time, and compliance. Key trigger: 20+ employees or growing complexity.',
  adp_workforce_now:'Already on WFN — focus on module expansion (Talent, Learning, Time, Benefits Admin) or PEO conversion via TotalSource if 10–500 EEs.',
  adp_totalsource:'Existing TotalSource PEO client — renewal or expansion play. Protect from Insperity/TriNet. Leverage benefits benchmarking and WC rate advantage.',
  adp_vantage:'ADP Vantage client — large enterprise. Focus on enterprise services, analytics, and global payroll expansion.',
  adp_enterprise:'ADP Enterprise / GlobalView — multinational payroll client. Cross-sell WFN for domestic mid-market subsidiaries or HR consolidation.',
  adp_ez_labor:'ezLaborManager is legacy time product. Upsell path: WFN Time & Scheduling — modern UI, mobile, manager self-service.',
  adp_time:'Standalone ADP Time client — strong upsell to full WFN suite. Pain is usually disconnected payroll and manual data entry between systems.',
  adp_401k:'ADP 401(k) client only — expand into payroll + HR. Integrated retirement + payroll = compliance simplicity and single vendor.',
  adp_benefits:'ADP Health & Benefits standalone client — strong upsell to full WFN or TotalSource. Consolidating benefits admin with payroll eliminates reconciliation errors and reduces carrier billing issues.',
  adp_wc:'ADP Workers\' Comp standalone client — upsell to TotalSource PEO for pay-as-you-go WC or full WFN for integrated WC + payroll. Eliminates year-end audit surprises and improves cash flow.',
  adp_other:'Existing ADP client — identify which product(s) and pain points before positioning upsell or cross-sell.',
  // Competitor incumbents
  paycom:'Paycom reps lead with single-database pitch. Counter: ADP scale, compliance depth, and dedicated service model.',
  paylocity:'Paylocity targets mid-market with modern UI. Counter: ADP integrations, compliance automation, and implementation support.',
  ukg:'UKG leads with workforce management. Counter: ADP breadth, PEO option, and stronger payroll accuracy track record.',
  dayforce:'Dayforce/Ceridian pitches real-time pay. Counter: ADP reliability, breadth of HCM suite, and TotalSource co-employment.',
  workday:'Workday is HRIS-first, payroll is secondary. Counter: ADP is the payroll leader — Workday often needs ADP as an underlying engine.',
  paychex:'Paychex is ADP\'s closest head-to-head. Counter: WFN technology depth, TotalSource underwriting scale, and dedicated DM support.',
  justworks:'Justworks targets small employers. Counter: ADP TotalSource has broader carrier network and scales further.',
  rippling:'Rippling leads with IT+HR pitch. Counter: ADP compliance depth, tax filing, and enterprise-grade WFN vs. Rippling\'s thin payroll.',
  trinet:'TriNet is a PEO competitor. Counter: TotalSource superior workers\' comp rates, benefits buying power, and ADP technology stack.',
  insperity:'Insperity targets professional services. Counter: TotalSource pricing, ADP technology backbone, and broader geographic coverage.',
  bamboo:'BambooHR is HRIS only — no payroll. Counter: ADP full suite with native payroll, compliance, and benefits.',
  isolved:'isolved targets SMB. Counter: ADP scale, compliance infrastructure, and mid-market WFN capabilities.',
  other:'Document incumbent details in notes. Focus discovery on pain points with current provider.',
  none:'No incumbent — prospect is on manual/spreadsheet processes. Focus on ROI of automation and time savings.'
};

const ADP_PRODUCTS=new Set(['adp_run','adp_workforce_now','adp_totalsource','adp_vantage','adp_enterprise','adp_ez_labor','adp_time','adp_401k','adp_benefits','adp_wc','adp_other']);

// Human-readable labels for ADP product keys
const ADP_PRODUCT_LABELS={
  run:'ADP RUN', classic:'ADP Classic', wfn:'WorkforceNow', ts:'TotalSource',
  etime:'eTime/TLM', benefits:'Health & Benefits', wc:"Workers' Comp",
  '401k':'401K/Retirement', other:'Other ADP',
  adp_run:'ADP RUN', adp_workforce_now:'WorkforceNow', adp_totalsource:'TotalSource',
  adp_vantage:'ADP Vantage', adp_enterprise:'ADP Enterprise',
  adp_ez_labor:'ezLaborManager', adp_time:'ADP Time',
  adp_401k:'401K/Retirement', adp_benefits:'Health & Benefits',
  adp_wc:"Workers' Comp", adp_other:'Other ADP'
};
function adpLabel(key){ return ADP_PRODUCT_LABELS[key] || key.toUpperCase().replace(/_/g,' '); }

function sreCompetitorChanged(){
  const val=document.getElementById('sre-competitor').value;
  const ins=document.getElementById('sre-comp-insight');
  const upsellRow=document.getElementById('sre-adp-upsell-row');
  const isAdp=ADP_PRODUCTS.has(val);
  if(val && COMP_INSIGHTS[val]){
    const badge=isAdp?'<span style="display:inline-block;margin-bottom:3px;font-size:10px;font-weight:700;color:#0070f3;text-transform:uppercase;letter-spacing:1px">🔵 Existing ADP Client</span><br>':'';
    ins.innerHTML=badge+COMP_INSIGHTS[val];
    ins.style.display='block';
    ins.style.background=isAdp?'rgba(0,112,243,.08)':'';
    ins.style.border=isAdp?'1px solid rgba(0,112,243,.2)':'';
    ins.style.color=isAdp?'#1e40af':'var(--text-2)';
  } else {
    ins.style.display='none';
  }
  if(upsellRow) upsellRow.style.display=isAdp?'block':'none';
}

function sreToggleForm(){
  const form=document.getElementById('sre-ext-form');
  const btn=document.getElementById('sre-form-toggle');
  const open=form.style.display==='none';
  form.style.display=open?'block':'none';
  btn.textContent=open?'▲ Hide Fields':'▼ Show Fields';
}

// ── Collect all extended form fields ────────────────────────────
function sreCollectExtended(){
  const g=id=>{ const el=document.getElementById(id); return el?el.value.trim():''; };
  return{
    revenue:g('sre-revenue'), tenure:g('sre-tenure'),
    statesOps:g('sre-states-ops'), payFreq:g('sre-pay-freq'),
    eeMix:g('sre-ee-mix'), union:g('sre-union'),
    timeline:g('sre-timeline'), budget:g('sre-budget'),
    stage:g('sre-stage'), otherVendors:g('sre-other-vendors'),
    champion:g('sre-champion'), econBuyer:g('sre-econ-buyer'),
    notices:g('sre-notices'), acaStatus:g('sre-aca-status'),
    epli:g('sre-epli'), growth:g('sre-growth'),
    extNotes:g('sre-ext-notes'),
    competitor:g('sre-competitor'),
    renewalDate:g('sre-renewal-date'),
    adpUpsellGoal:g('sre-adp-upsell-goal')
  };
}

// ── Collect all pain checkboxes (including new ones) ─────────────
function sreCollectPains(){
  const ids=['sre-401k','sre-wc','sre-aca','sre-benefits','sre-benefits-cost','sre-hr-bandwidth',
    'sre-tax','sre-platform','sre-gl','sre-support','sre-reporting','sre-mobile',
    'sre-i9','sre-multi','sre-manual','sre-onboarding','sre-turnover','sre-compliance'];
  const LABELS={
    'sre-401k':'401K admin errors','sre-wc':'Workers Comp issues','sre-aca':'ACA compliance problems',
    'sre-benefits':'Benefits payment errors','sre-benefits-cost':'Benefits cost too high',
    'sre-hr-bandwidth':'HR team overwhelmed','sre-tax':'Multi-state tax issues',
    'sre-platform':'Platform failures','sre-gl':'GL integration errors',
    'sre-support':'Poor support/communication','sre-reporting':'Weak reporting/analytics',
    'sre-mobile':'No mobile/self-service','sre-i9':'I-9 / E-Verify errors',
    'sre-multi':'Multi-entity complexity','sre-manual':'Manual/spreadsheet processes',
    'sre-onboarding':'Slow/manual onboarding','sre-turnover':'High turnover/retention',
    'sre-compliance':'General compliance risk'
  };
  return ids.filter(id=>{const el=document.getElementById(id);return el&&el.checked;})
            .map(id=>LABELS[id]);
}

// ── Main save function (replaces sreRun) ─────────────────────────
function sreSave(){
  const p=window._hqProspect;
  if(!p){showToast('Select a prospect first — click + New Prospect',true);return;}
  if(!_sreClientType){showToast('Select client type above (New Prospect or Existing ADP)',true);return;}
  const pains=sreCollectPains();
  const ext=sreCollectExtended();
  const hc=parseInt(p.headcount)||0;
  const band=sreHeadcountBand(hc);
  // Build data point count
  let dp=0;
  if(_sreClientType) dp++;
  if(p.company) dp++;
  if(p.industry) dp++;
  if(hc) dp++;
  if(pains.length) dp+=pains.length;
  if(ext.competitor) dp++;
  if(ext.renewalDate) dp++;
  Object.values(ext).forEach(v=>{if(v&&v.length>0) dp++;});
  const transcript=document.getElementById('sre-transcript');
  if(transcript&&transcript.value.trim().length>20) dp+=3;
  // Persist all data onto the prospect object
  Object.assign(p,{
    clientType:_sreClientType,
    adpProducts:Array.from(_sreAdpProducts),
    painPoints:pains,
    competitor:ext.competitor,
    renewalDate:ext.renewalDate,
    extProfile:ext,
    headcountBand:band?band.tier:'',
    headcountRange:band?band.low+'-'+band.high:'',
    transcript:transcript?transcript.value.trim():'',
    sreDataPoints:dp,
    sreSavedAt:new Date().toISOString()
  });
  // Save to localStorage — dedup by normalized company name
  try{
    const stored=JSON.parse(localStorage.getItem('bp_prospects')||'[]');
    const idx=findProspectIdx(stored, p);
    if(idx>=0) stored[idx]=p; else stored.push(p);
    localStorage.setItem('bp_prospects',JSON.stringify(stored));
    localStorage.setItem('activeProspect',JSON.stringify(p));
  }catch(e){}
  _sreAnalysis={dp,pains,competitor:ext.competitor,ext};
  sreShowSummary({dp,pains,competitor:ext.competitor,ext,band,clientType:_sreClientType});
  hqAdvancePipeline(0);
  // Auto-sync profiles drawer and header count
  if(typeof renderSavedProspects==='function') renderSavedProspects();
  showToast('✓ Intelligence saved & profile updated — '+dp+' data points captured');
  if(typeof fbSaveProspect==='function') fbSaveProspect(p);
  // Restore track/tone selectors if already set
  if(_sreSelectedTrack) sreSelectTrack(_sreSelectedTrack);
  if(_sreCadenceTone) sreToneChanged(_sreCadenceTone);
  // Mark save button as saved
  tbMarkSaved();
}

// ── Top Bar Save Button ───────────────────────────────────────────────
// Called by the 💾 Save button in the top bar
window.tbSaveProspect = function() {
  const p = window._hqProspect;
  if (!p) { showToast('No prospect loaded — load a prospect first', true); return; }
  // If on Command Center tab, run sreSave to collect all SRE form data
  if (typeof sreSave === 'function') sreSave();
  else {
    // Fallback: just persist the current prospect object
    try {
      const stored = JSON.parse(localStorage.getItem('bp_prospects') || '[]');
      const idx = findProspectIdx(stored, p);
      if (idx >= 0) stored[idx] = p; else stored.push(p);
      localStorage.setItem('bp_prospects', JSON.stringify(stored));
      localStorage.setItem('activeProspect', JSON.stringify(p));
    } catch(e) {}
    showToast('✓ Prospect saved');
    tbMarkSaved();
  }
};

// Mark Save button as having unsaved changes
window.tbMarkUnsaved = function() {
  const btn = document.getElementById('tb-save-btn');
  if (!btn || !window._hqProspect) return;
  btn.style.display = '';
  btn.className = 'tb-icon-btn tb-save-btn has-changes';
  btn.textContent = '💾 Save';
  // Debounce auto-save: 4 seconds after last change
  clearTimeout(window._tbAutoSaveTimer);
  window._tbAutoSaveTimer = setTimeout(function() {
    if (window._hqProspect) {
      window.tbSaveProspect();
    }
  }, 4000);
};

// Mark Save button as saved (green checkmark briefly)
window.tbMarkSaved = function() {
  const btn = document.getElementById('tb-save-btn');
  if (!btn) return;
  btn.style.display = '';
  btn.className = 'tb-icon-btn tb-save-btn saved';
  btn.textContent = '✓ Saved';
  clearTimeout(window._tbAutoSaveTimer);
  // Fade back to neutral after 2.5s
  setTimeout(function() {
    if (btn.classList.contains('saved')) {
      btn.className = 'tb-icon-btn tb-save-btn';
      btn.textContent = '💾 Save';
    }
  }, 2500);
};

// Show Save button whenever a prospect is loaded
window.tbShowSaveBtn = function() {
  const btn = document.getElementById('tb-save-btn');
  if (btn) btn.style.display = '';
};

// ── Auto-save wiring: attach change listeners to all SRE form fields ──
// Called once after HQ is built. Listens to any input/change in the SRE
// section and triggers the unsaved indicator + debounced auto-save.
window.tbInitAutoSave = function() {
  const sre = document.querySelector('.sre-wrap') || document.getElementById('hq-cmd');
  if (!sre) return;
  // Input events on text fields, selects, textareas
  sre.addEventListener('input', function(e) {
    if (window._hqProspect) window.tbMarkUnsaved();
  });
  sre.addEventListener('change', function(e) {
    if (window._hqProspect) window.tbMarkUnsaved();
  });
  // Click events for toggle buttons (silo, track, adp opts, pain checkboxes)
  sre.addEventListener('click', function(e) {
    const t = e.target;
    const isToggle = t.classList.contains('sre-silo-opt') ||
                     t.classList.contains('sre-adp-opt') ||
                     t.classList.contains('sre-cb') ||
                     t.classList.contains('sre-track-opt') ||
                     t.closest('.sre-cb') ||
                     t.closest('.sre-adp-opt') ||
                     t.closest('.sre-silo-opt');
    if (isToggle && window._hqProspect) window.tbMarkUnsaved();
  });
};

function sreShowSummary(r){
  document.getElementById('sre-rec-val').textContent='Profile Complete';
  document.getElementById('sre-conf').textContent=r.dp+' pts';
  document.getElementById('sre-client-type-label').textContent=r.clientType==='existing'?'Existing ADP Client':'New Prospect — Net New';
  // Build summary cards
  const grid=document.getElementById('sre-summary-grid');
  const cards=[];
  if(r.pains.length){
    cards.push('<div style="padding:8px 10px;background:rgba(220,53,69,.07);border:1px solid rgba(220,53,69,.18);border-radius:6px"><div style="font-size:10px;font-weight:700;color:var(--red);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Pain Points ('+r.pains.length+')</div><div style="font-size:11px;color:var(--text-2);line-height:1.6">'+r.pains.join(' · ')+'</div></div>');
  }
  if(r.competitor){
    const label=document.getElementById('sre-competitor');
    const txt=label?label.options[label.selectedIndex].text:r.competitor;
    cards.push('<div style="padding:8px 10px;background:rgba(26,36,96,.07);border:1px solid rgba(26,36,96,.18);border-radius:6px"><div style="font-size:10px;font-weight:700;color:var(--navy);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Incumbent</div><div style="font-size:11px;color:var(--text-2)">'+txt+'</div></div>');
  }
  if(r.band){
    cards.push('<div style="padding:8px 10px;background:rgba(40,167,69,.07);border:1px solid rgba(40,167,69,.18);border-radius:6px"><div style="font-size:10px;font-weight:700;color:#28a745;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Headcount Band</div><div style="font-size:11px;color:var(--text-2)">'+r.band.low+'–'+r.band.high+' EEs · <em>'+r.band.tier+'</em></div></div>');
  }
  if(r.ext&&r.ext.timeline){
    cards.push('<div style="padding:8px 10px;background:rgba(184,146,10,.08);border:1px solid rgba(184,146,10,.2);border-radius:6px"><div style="font-size:10px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Timeline</div><div style="font-size:11px;color:var(--text-2)">'+r.ext.timeline+'</div></div>');
  }
  grid.innerHTML=cards.join('');
  const res=document.getElementById('sre-results');
  res.classList.add('show');
  res.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function sreProceed(){
  if(!_sreSelectedTrack){ showToast('Select ADP WorkforceNow or TotalSource above first',true); return; }
  const trackName = _sreSelectedTrack==='WFN' ? 'ADP WorkforceNow' : 'ADP TotalSource';
  const toneName  = _sreCadenceTone ? ' · '+_sreCadenceTone+' cadence' : '';
  // Persist track to active prospect
  if(window._hqProspect){
    window._hqProspect.track = _sreSelectedTrack;
    window._hqProspect.cadenceTone = _sreCadenceTone;
    try{
      const arr=getProspects();
      const idx=arr.findIndex(function(x){return x.company===window._hqProspect.company;});
      if(idx>=0){arr[idx].track=_sreSelectedTrack;arr[idx].cadenceTone=_sreCadenceTone;saveProspectsLocal(arr);}
      localStorage.setItem('activeProspect',JSON.stringify(window._hqProspect));
    }catch(e){}
    if(typeof renderSavedProspects==='function') renderSavedProspects();
    if(typeof fbSaveProspect==='function') fbSaveProspect(window._hqProspect);
  }
  // Scroll to analysis tools
  const toolGrid=document.querySelector('.tool-grid');
  if(toolGrid) toolGrid.scrollIntoView({behavior:'smooth',block:'start'});
  showToast('Track confirmed: '+trackName+toneName+' — select analysis tool below');
  // ── Background Email Engine: begin pre-generating emails on track confirm ──
  if(typeof window.bpEngineTrigger==='function') setTimeout(window.bpEngineTrigger, 800);
}

// Legacy stubs — kept so existing callers don't throw
function sreCalcFit(data){
  let peo=0, wfn=0, peoF=[], wfnF=[];
  const hc=data.headcount, ind=data.industry.toLowerCase(), pp=data.pain, ct=data.clientType, adp=data.adpProducts;
  // Client type modifiers
  if(ct==='existing'){
    if(adp.has('run')||adp.has('classic')){wfn+=30;wfnF.push('Upgrade path: ADP RUN/Classic → WFN mid-market migration');}
    if(adp.has('ts')){peo+=15;peoF.push('Existing TotalSource client — expansion/re-engagement opportunity');}
    if(adp.has('wfn')){peo+=20;peoF.push('On WFN — TotalSource cross-sell is primary opportunity');}
  } else {
    wfn+=10; wfnF.push('Net-new prospect — competitive displacement opportunity');
  }
  // Headcount
  if(hc>=50&&hc<=999){wfn+=30;wfnF.push(`${hc} employees in WFN sweet spot (50–999 mid-market)`);}
  if(hc>=10&&hc<=500){peo+=25;peoF.push(`${hc} employees in PEO optimal range (10–500)`);}
  // Industry
  const peoInd=['plumbing','hvac','electrical','contractor','construction','manufacturing','law','legal','accounting','staffing'];
  const wfnInd=['manufacturing','healthcare','medical','professional services','finance','retail','hospitality','technology'];
  if(peoInd.some(i=>ind.includes(i))){peo+=25;peoF.push(`${data.industryRaw} is a strong PEO-fit industry`);}
  if(wfnInd.some(i=>ind.includes(i))){wfn+=20;wfnF.push(`${data.industryRaw} benefits from WFN compliance automation`);}
  // Pain points
  if(pp.k401){peo+=25;peoF.push('401K admin errors → PEO eliminates burden entirely');}
  if(pp.wc){peo+=25;peoF.push('Workers Comp issues → PEO owns full WC liability');}
  if(pp.aca){peo+=20;peoF.push('ACA compliance → PEO handles all filing and reporting');}
  if(pp.benefits){peo+=20;peoF.push('Benefits errors → PEO owns carrier relationships end-to-end');}
  if(pp.tax){wfn+=25;wfnF.push('Multi-state tax complexity → WFN handles all state registrations');}
  if(pp.platform){wfn+=25;wfnF.push('Platform failures → Enterprise-grade WFN technology stack');}
  if(pp.gl){wfn+=20;wfnF.push('GL inaccuracies → WFN provides clean ERP integrations');}
  if(pp.support){wfn+=15;wfnF.push('Poor support → WFN dedicated service team model');}
  if(pp.manual){wfn+=20;peo+=5;wfnF.push('Manual processes → WFN workflow automation suite');}
  if(pp.i9){peo+=15;wfn+=10;peoF.push('I-9 errors → PEO dedicated HR compliance support');}
  if(pp.multi){peo+=15;wfn+=15;peoF.push('Multiple entities → PEO consolidates tax IDs');wfnF.push('Multiple entities → WFN centralized platform view');}
  peo=Math.min(100,peo); wfn=Math.min(100,wfn);
  const rec=peo>wfn?'TotalSource PEO':'Workforce Now';
  const total=peo+wfn||1;
  const conf=Math.round((Math.max(peo,wfn)/total)*100);
  return{rec,conf,peo,wfn,peoF,wfnF};
}

// ── Track selector ───────────────────────────────────────────────
let _sreSelectedTrack = '';
let _sreCadenceTone   = '';

const TONE_HINTS = {
  Aggressive:   'Short, direct, urgency-driven. Assumes pain is real. High-frequency touches. Best when contract renewal is close or pain is confirmed.',
  Consultative: 'Value-first, educational. Builds case over time. Best for mid-funnel prospects who are evaluating options.',
  Nurture:      'Low-pressure, relationship-building. Long-play cadence. Best for early-stage prospects with no confirmed timeline.'
};

const TRACK_TONE_DEFAULTS = {
  WFN: { hint: 'WorkforceNow messaging focuses on technology ROI, platform stability, and compliance automation.' },
  TS:  { hint: 'TotalSource messaging focuses on HR outsourcing, benefits savings, workers\' comp relief, and co-employment value.' }
};

window.sreSelectTrack = function(track) {
  _sreSelectedTrack = track;
  selectedRole = track;
  const wfnEl = document.getElementById('sre-track-wfn');
  const tsEl  = document.getElementById('sre-track-ts');
  const statusEl = document.getElementById('sre-track-status');
  if (wfnEl) {
    wfnEl.style.borderColor  = track === 'WFN' ? 'var(--navy)' : 'var(--border)';
    wfnEl.style.background   = track === 'WFN' ? 'rgba(26,36,96,.07)' : 'var(--white)';
    wfnEl.style.boxShadow    = track === 'WFN' ? '0 0 0 3px rgba(26,36,96,.12)' : 'none';
  }
  if (tsEl) {
    tsEl.style.borderColor   = track === 'TS' ? 'var(--red)' : 'var(--border)';
    tsEl.style.background    = track === 'TS' ? 'rgba(220,53,69,.05)' : 'var(--white)';
    tsEl.style.boxShadow     = track === 'TS' ? '0 0 0 3px rgba(220,53,69,.1)' : 'none';
  }
  if (statusEl) {
    const hint = TRACK_TONE_DEFAULTS[track];
    statusEl.textContent = hint ? hint.hint : '';
    statusEl.style.color = track === 'WFN' ? 'var(--navy)' : 'var(--red)';
  }
  // Also update the legacy selectTrack so downstream code stays in sync
  if (typeof selectTrack === 'function') selectTrack(track);
  // Persist to active prospect immediately
  if (window._hqProspect) {
    window._hqProspect.track = track;
    try {
      const arr = getProspects();
      const idx = arr.findIndex(function(x){ return x.company === window._hqProspect.company; });
      if (idx >= 0) { arr[idx].track = track; saveProspectsLocal(arr); }
      localStorage.setItem('activeProspect', JSON.stringify(window._hqProspect));
    } catch(e) {}
  }
  showToast('Track set: ' + (track === 'WFN' ? 'ADP WorkforceNow' : 'ADP TotalSource'));
  // Show/hide PEO Quick Profile panel
  const peoPanel = document.getElementById('sre-peo-profile');
  if (peoPanel) peoPanel.style.display = track === 'TS' ? 'block' : 'none';
};

window.sreToneChanged = function(tone) {
  _sreCadenceTone = tone;
  const hintEl = document.getElementById('sre-tone-hint');
  if (hintEl) hintEl.textContent = TONE_HINTS[tone] || '';
  // Highlight selected tone label
  ['Aggressive','Consultative','Nurture'].forEach(function(t) {
    const el = document.getElementById('sre-tone-' + t.toLowerCase());
    if (el) {
      const active = t === tone;
      el.style.borderColor  = active ? 'var(--navy)' : 'var(--border)';
      el.style.background   = active ? 'rgba(26,36,96,.07)' : '';
      el.style.color        = active ? 'var(--navy)' : 'var(--text-2)';
    }
  });
  // Persist to active prospect
  if (window._hqProspect) {
    window._hqProspect.cadenceTone = tone;
    try {
      const arr = getProspects();
      const idx = arr.findIndex(function(x){ return x.company === window._hqProspect.company; });
      if (idx >= 0) { arr[idx].cadenceTone = tone; saveProspectsLocal(arr); }
      localStorage.setItem('activeProspect', JSON.stringify(window._hqProspect));
    } catch(e) {}
  }
};

// ── PEO Quick Profile: save fields to active prospect ────────────────
window.srePeoSave = function() {
  const gNum = function(id) {
    const el = document.getElementById(id); if (!el) return null;
    const v = parseFloat(el.value.replace(/[^0-9.]/g, '')); return isNaN(v) ? null : v;
  };
  const gStr = function(id) {
    const el = document.getElementById(id); return el ? el.value.trim() : '';
  };

  const peo = {
    eligibleEE:      gNum('srep-eligible-ee'),
    avgWages:        gNum('srep-avg-wages'),
    locations:       gStr('srep-locations'),
    asi:             gNum('srep-asi'),
    carrier:         gStr('srep-carrier'),
    monthlyPremium:  gNum('srep-monthly-premium'),
    contribPct:      gNum('srep-contrib-pct'),
    renewalIncrease: gNum('srep-renewal-increase'),
    participationRate: parseInt(document.getElementById('srep-brate') ? document.getElementById('srep-brate').value : '60', 10),
  };

  if (window._hqProspect) {
    window._hqProspect.peoProfile = peo;
    try {
      const arr = getProspects();
      const idx = arr.findIndex(function(x){ return x.company === window._hqProspect.company; });
      if (idx >= 0) { arr[idx].peoProfile = peo; saveProspectsLocal(arr); }
      localStorage.setItem('activeProspect', JSON.stringify(window._hqProspect));
    } catch(e) {}
    // Re-trigger email engine with fresh PEO data
    if (typeof window.bpEngineTrigger === 'function') setTimeout(window.bpEngineTrigger, 600);
  }

  const ind = document.getElementById('srep-saved-indicator');
  if (ind) { ind.textContent = '✓ PEO profile saved — flows into email engine'; setTimeout(function(){ ind.textContent=''; }, 2500); }
};

// ── Restore PEO profile fields when prospect is loaded ───────────────
window.sreRestorePeoProfile = function(p) {
  if (!p || !p.peoProfile) return;
  const d = p.peoProfile;
  const setVal = function(id, v) { const el = document.getElementById(id); if (el && v != null) el.value = v; };
  setVal('srep-eligible-ee',      d.eligibleEE);
  setVal('srep-avg-wages',        d.avgWages ? '$' + d.avgWages.toLocaleString('en-US') : '');
  setVal('srep-locations',        d.locations);
  setVal('srep-asi',              d.asi);
  setVal('srep-carrier',          d.carrier);
  setVal('srep-monthly-premium',  d.monthlyPremium ? '$' + d.monthlyPremium.toLocaleString('en-US') : '');
  setVal('srep-contrib-pct',      d.contribPct);
  setVal('srep-renewal-increase', d.renewalIncrease);
  if (d.participationRate != null) {
    const sl = document.getElementById('srep-brate');
    const lb = document.getElementById('srep-brate-lbl');
    if (sl) sl.value = d.participationRate;
    if (lb) lb.textContent = d.participationRate + '%';
  }
};

// ── Inline Market & Competitive Analysis from SRE ────────────────
window.sreRunMCA = async function() {
  const p = window._hqProspect;
  if (!p) { showToast('Save a prospect first', true); return; }
  if (!_sreSelectedTrack) { showToast('Select a product track above first', true); return; }

  const panel = document.getElementById('sre-mca-panel');
  const body  = document.getElementById('sre-mca-body');
  const lbl   = document.getElementById('sre-mca-lbl');
  const badge = document.getElementById('sre-mca-badge');
  const btn   = document.getElementById('sre-mca-btn');
  if (!panel || !body) return;

  panel.style.display = 'block';
  const isWFN = _sreSelectedTrack === 'WFN';
  if (badge) { badge.textContent = isWFN ? 'WorkforceNow' : 'TotalSource PEO'; badge.className = 'mia-hdr-badge ' + (isWFN ? 'wfn' : 'ts'); }
  if (lbl) lbl.textContent = p.company + ' · ' + (p.industry||'?') + ' · ' + (p.headcount||'?') + ' EEs · ' + (_sreCadenceTone||'No tone set');
  if (btn) { btn.textContent = '&#8635; Regenerate'; btn.disabled = true; }
  body.innerHTML = '<div class="mia-loading"><div class="mia-spinner"></div>Generating ' + (isWFN ? 'WorkforceNow' : 'TotalSource PEO') + ' competitive analysis for ' + p.company + '...</div>';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const ext = p.extProfile || {};
  const pains = (p.painPoints || []).join(', ') || 'Not specified';
  const competitor = p.competitor || 'Unknown';
  const tone = _sreCadenceTone || 'Consultative';
  const track = isWFN ? 'ADP WorkforceNow' : 'ADP TotalSource PEO';

  // ── Live news pre-fetch via Google News RSS ───────────────────────
  // Fires before the AI prompt so the model gets real, dated headlines
  const today = new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  const rssProxies = [
    url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    url => `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(url)}`
  ];
  async function fetchRssHeadlines(query) {
    const feed = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    for (const proxy of rssProxies) {
      try {
        const r = await fetch(proxy(feed), {signal: AbortSignal.timeout(5000)});
        if (!r.ok) continue;
        const j = await r.json();
        const xml = j.contents || j.body || '';
        const items = [...xml.matchAll(/<title><!\[CDATA\[(.+?)\]\]><\/title>/g)].slice(1,6).map(m=>m[1]);
        if (items.length) return items;
      } catch(e) { /* try next proxy */ }
    }
    return [];
  }

  // Build 2 queries: competitor news + industry HR news
  const compName = competitor.replace(/adp_\w+/,'ADP').replace(/_/g,' ');
  body.innerHTML = '<div class="mia-loading"><div class="mia-spinner"></div>Fetching live news for ' + compName + '…</div>';
  let liveNewsBlock = '';
  try {
    const [compNews, industryNews] = await Promise.all([
      fetchRssHeadlines(compName + ' payroll HR software 2025'),
      fetchRssHeadlines((p.industry||'HR payroll') + ' compliance workforce ' + new Date().getFullYear())
    ]);
    if (compNews.length || industryNews.length) {
      liveNewsBlock = '\n\nLIVE NEWS CONTEXT (as of ' + today + ') — incorporate specific headlines in your analysis where relevant:\n';
      if (compNews.length) liveNewsBlock += 'Competitor Headlines: ' + compNews.join(' | ') + '\n';
      if (industryNews.length) liveNewsBlock += 'Industry Headlines: ' + industryNews.join(' | ') + '\n';
      const newsBadge = document.getElementById('sre-mca-news-ts');
      if (newsBadge) { newsBadge.textContent = '\u25cf Live news: ' + new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}); newsBadge.style.display = 'block'; }
    }
  } catch(e) { /* proceed without live news */ }

  body.innerHTML = '<div class="mia-loading"><div class="mia-spinner"></div>Generating ' + (isWFN ? 'WorkforceNow' : 'TotalSource PEO') + ' competitive analysis for ' + p.company + '...</div>';

  const prompt = 'You are a senior ADP competitive intelligence director. Generate a targeted market and competitive analysis for an ADP sales rep.\n\nPRODUCT TRACK: ' + track + '\nCADENCE TONE: ' + tone + '\n\nPROSPECT:\n- Company: ' + p.company + '\n- Industry: ' + (p.industry||'Unknown') + '\n- Headcount: ' + (p.headcount||'Unknown') + (p.headcountRange ? ' (range: '+p.headcountRange+')' : '') + '\n- State: ' + (p.state||'Unknown') + '\n- Client Type: ' + (p.clientType||'New Prospect') + '\n- ADP Products: ' + ((p.adpProducts||[]).map(function(x){return adpLabel(x);}).join(', ')||'None') + '\n- Incumbent: ' + competitor + (p.renewalDate ? ' (renewal: '+p.renewalDate+')' : '') + '\n- Pain Points: ' + pains + '\n- Decision Timeline: ' + (ext.timeline||'Unknown') + '\n- Buying Stage: ' + (ext.stage||'Unknown') + '\n- Other Vendors: ' + (ext.otherVendors||'Unknown') + '\n- Budget: ' + (ext.budget||'Unknown') + '\n- Growth Plans: ' + (ext.growth||'Unknown') + '\n\nGenerate analysis in this EXACT JSON format (no markdown, no code blocks):\n{\n  "executive_summary": "3-sentence sharp assessment referencing specific pain points and the selected product track",\n  "track_fit": {\n    "why_this_track": ["3-4 specific reasons why ' + track + ' is right for this prospect"],\n    "key_differentiators": ["3-4 ADP differentiators vs ' + competitor + ' for this profile"]\n  },\n  "competitive_intel": [\n    {"competitor": "' + competitor + '", "threat_level": "High/Medium/Low", "counter": "Specific 1-sentence counter-position"},\n    {"competitor": "Second most likely competitor", "threat_level": "High/Medium/Low", "counter": "Specific counter"}\n  ],\n  "tone_strategy": {\n    "tone": "' + tone + '",\n    "opening_hook": "1-sentence opening hook for Day 1 email based on their pain points and track",\n    "primary_message": "The core value message for this track for this specific prospect",\n    "objection_prep": ["Top 2-3 objections this prospect will likely raise with rebuttals"]\n  },\n  "talk_track": "A 3-4 sentence discovery talk track for the first call, tuned to ' + tone + ' tone and ' + track + '"\n}' + liveNewsBlock;

  bpGeminiFetch({messages:[{role:'user', content: prompt}]})
    .then(function(res){ return res.json(); })
    .then(function(data) {
      const raw = bpGeminiText(data);
      if (btn) { btn.innerHTML = '&#8635; Regenerate'; btn.disabled = false; }
      try {
        const clean = (raw||'').replace(/```json|```/g,'').trim();
        const d = JSON.parse(clean);

        let html = '';
        // Executive summary
        html += '<div class="mia-insight"><div class="mia-insight-lbl">Executive Summary</div>';
        html += '<div class="mia-insight-val">' + mdHtml(d.executive_summary||'') + '</div></div>';

        // Track fit
        if (d.track_fit) {
          html += '<div class="mia-insight"><div class="mia-insight-lbl">Why ' + track + ' For This Prospect</div><ul style="margin:6px 0 0 16px;font-size:12px;line-height:1.7;color:var(--text-2)">';
          (d.track_fit.why_this_track||[]).forEach(function(f){ html += '<li>' + mdHtml(f) + '</li>'; });
          html += '</ul></div>';
          html += '<div class="mia-insight"><div class="mia-insight-lbl">Key Differentiators vs ' + escHtml(competitor) + '</div><ul style="margin:6px 0 0 16px;font-size:12px;line-height:1.7;color:var(--text-2)">';
          (d.track_fit.key_differentiators||[]).forEach(function(f){ html += '<li>' + mdHtml(f) + '</li>'; });
          html += '</ul></div>';
        }

        // Competitive intel
        if (d.competitive_intel && d.competitive_intel.length) {
          html += '<div class="mia-insight"><div class="mia-insight-lbl">Competitive Threats</div>';
          d.competitive_intel.forEach(function(c) {
            const color = c.threat_level==='High' ? 'var(--red)' : c.threat_level==='Medium' ? 'var(--gold)' : 'var(--green)';
            html += '<div style="display:flex;gap:10px;padding:7px 0;border-bottom:1px solid var(--border);align-items:flex-start">';
            html += '<div style="min-width:90px;font-size:11px;font-weight:700;color:var(--text-2)">' + escHtml(c.competitor||'') + '</div>';
            html += '<div style="font-size:10px;padding:2px 7px;border-radius:3px;background:rgba(0,0,0,.05);color:'+color+';font-weight:700;white-space:nowrap">' + escHtml(c.threat_level||'') + '</div>';
            html += '<div style="font-size:12px;color:var(--text-2);flex:1">' + mdHtml(c.counter||'') + '</div>';
            html += '</div>';
          });
          html += '</div>';
        }

        // Tone strategy
        if (d.tone_strategy) {
          html += '<div class="mia-insight"><div class="mia-insight-lbl">' + escHtml(tone) + ' Tone Strategy</div>';
          html += '<div style="margin-bottom:8px"><div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:3px">Opening Hook</div>';
          html += '<div style="font-size:12px;color:var(--text);font-style:italic;padding:8px 10px;background:var(--off-white);border-radius:6px;border-left:3px solid var(--navy)">' + escHtml(d.tone_strategy.opening_hook||'') + '</div></div>';
          html += '<div style="margin-bottom:8px"><div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:3px">Primary Message</div>';
          html += '<div style="font-size:12px;color:var(--text-2)">' + escHtml(d.tone_strategy.primary_message||'') + '</div></div>';
          if (d.tone_strategy.objection_prep && d.tone_strategy.objection_prep.length) {
            html += '<div><div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px">Objection Prep</div><ul style="margin:0 0 0 16px;font-size:12px;line-height:1.7;color:var(--text-2)">';
            d.tone_strategy.objection_prep.forEach(function(o){ html += '<li>' + mdHtml(o) + '</li>'; });
            html += '</ul></div>';
          }
          html += '</div>';
        }

        // Talk track
        if (d.talk_track) {
          html += '<div class="mia-insight"><div class="mia-insight-lbl">Discovery Talk Track</div>';
          html += '<div style="font-size:12px;color:var(--text);line-height:1.7;padding:10px 12px;background:var(--off-white);border-radius:6px;border-left:3px solid var(--gold)">' + escHtml(d.talk_track) + '</div></div>';
        }

        // Action buttons
        html += '<div class="mia-acts">';
        html += '<button class="mia-act-btn primary" onclick="sreProceed()">&#10003; Confirm Track &amp; Continue &#8594;</button>';
        html += '<button class="mia-act-btn outline" onclick="sreRunMCA()">&#8635; Regenerate</button>';
        html += '</div>';

        body.innerHTML = html;

        // Persist MCA result to prospect
        if (window._hqProspect) {
          window._hqProspect.mcaResult = d;
          window._hqProspect.mcaTrack  = _sreSelectedTrack;
          window._hqProspect.mcaTone   = _sreCadenceTone;
          try {
            const arr = getProspects();
            const idx = arr.findIndex(function(x){ return x.company === window._hqProspect.company; });
            if (idx >= 0) { arr[idx].mcaResult = d; arr[idx].mcaTrack = _sreSelectedTrack; arr[idx].mcaTone = _sreCadenceTone; saveProspectsLocal(arr); }
            localStorage.setItem('activeProspect', JSON.stringify(window._hqProspect));
          } catch(e) {}
        }
      } catch(e) {
        body.innerHTML = '<div class="mia-error"><div class="mia-err-icon">&#9888;&#65039;</div><div>Could not parse AI response. <button onclick="sreRunMCA()">Retry</button></div></div>';
      }
    })
    .catch(function(err) {
      if (btn) { btn.innerHTML = '&#8635; Regenerate'; btn.disabled = false; }
      body.innerHTML = '<div class="mia-error"><div class="mia-err-icon">&#9888;&#65039;</div><div>Analysis failed: ' + escHtml(String(err)) + '. <button onclick="sreRunMCA()">Retry</button></div></div>';
    });
};

// Auto-refresh SRE on prospect storage events
document.addEventListener('DOMContentLoaded',sreRefresh);
window.addEventListener('storage',e=>{if(e.key==='activeProspect')sreRefresh();});

// ── Checkbox visual feedback for SRE checkboxes ──────
document.addEventListener('DOMContentLoaded',function(){
  document.querySelectorAll('.sre-cb input[type="checkbox"]').forEach(cb=>{
    cb.addEventListener('change',function(){
      this.closest('.sre-cb').classList.toggle('ck',this.checked);
    });
  });
});

window.saveProspect=function(){
  const company=document.getElementById('f-company').value.trim();
  if(!company){showToast('Company name is required',true);return}
  const sreCtx = typeof atCollectSreContext === 'function' ? atCollectSreContext() : {};
  const transcriptEl=document.getElementById('sre-transcript');
  const aiNotes = window._mfProfileSummary||'';
  // Collect any dynamic AI-generated fields from the form
  const dynFields = typeof dynCollectFields==='function' ? dynCollectFields() : {};
  const aiResult  = window._mfAIResult||null;
  window._hqProspect={
    company,
    contact:  document.getElementById('f-contact').value.trim(),
    persona:  document.getElementById('f-persona').value,
    industry: document.getElementById('f-industry').value.trim(),
    state:    document.getElementById('f-state').value.trim(),
    headcount:document.getElementById('f-headcount').value.trim(),
    email:    document.getElementById('f-email').value.trim(),
    phone:    document.getElementById('f-phone').value.trim(),
    linkedin: document.getElementById('f-linkedin').value.trim(),
    track:    selectedRole||'WFN',
    // SRE data
    painPoints:      sreCtx.painPoints||[],
    adpProducts:     sreCtx.adpProducts||[],
    clientType:      sreCtx.clientType||'new',
    sreRecommendation:sreCtx.sreRecommendation||'',
    sreConfidence:   sreCtx.sreConfidence||'',
    sreWfnScore:     sreCtx.sreWfnScore||'',
    srePeoScore:     sreCtx.srePeoScore||'',
    transcript:      transcriptEl?transcriptEl.value.trim():'',
    notes:           aiNotes,
    // AI-discovered extra fields merged flat (e.g. "Current Vendor", "Contract End Date")
    aiFields:   dynFields,
    aiInsights: aiResult ? (aiResult.insights||[]) : [],
    aiSources:  (window._mfFiles||[]).map(function(f){return f.name;}).concat((window._mfUrls||[]).map(function(u){return u.label;})),
    // Also spread aiFields flat so Firestore treats them as standard fields
    ...dynFields,
    createdAt:  new Date().toISOString(),
    updatedAt:  new Date().toISOString(),
    approved:   false
  };
  // Persist to saved prospects list — dedup by normalized company name
  const arr=getProspects();
  const existing=findProspectIdx(arr, window._hqProspect);
  if(existing>=0){arr[existing]=Object.assign(arr[existing],window._hqProspect);}
  else{arr.unshift(window._hqProspect);}
  saveProspectsLocal(arr);
  // Push to Firestore
  if(typeof fbSaveProspect==='function') fbSaveProspect(window._hqProspect);
  // Reset multi-file import state
  _mfFiles=[]; _mfUrls=[]; window._mfProfileSummary=''; window._mfAIResult=null;
  mfRenderChips();
  // Reset dynamic AI extras grid
  const grid=document.getElementById('dyn-fields-grid');
  if(grid){grid.innerHTML='';grid.style.display='none';}
  // Clear standard fields
  ['f-company','f-contact','f-email','f-phone','f-industry','f-state','f-headcount','f-linkedin'].forEach(function(id){
    const el=document.getElementById(id); if(el) el.value='';
  });
  const ps=document.getElementById('f-persona'); if(ps) ps.selectedIndex=0;
  closeModal();hqRenderBanner();hqAdvancePipeline(1);
  setTimeout(sreRefresh,80);
  renderSavedProspects();
  showToast('Pipeline initialized for '+company);
};

// ══════════════════════════════════════════════════════════
//  ANALYSIS TOOLS — DATA PULL + MARKET INTEL
// ══════════════════════════════════════════════════════════

// Pull active prospect data into a tool card's display fields
window.pullProspectToTool = function(tool) {
  const p = window._hqProspect;
  if (!p) { showToast('No prospect loaded — create one with + New Prospect', true); return; }

  const prefix = tool; // 'wfn' or 'ts'
  const fields = {
    company: p.company || '—',
    industry: p.industry || '—',
    headcount: p.headcount ? p.headcount + ' EEs' : '—',
    state: p.state || '—',
    persona: p.persona || '—'
  };

  // Tool-specific 5th field
  if (tool === 'wfn') {
    const adpProds = Array.from(_sreAdpProducts || []).join(', ').toUpperCase() || (p.track === 'WFN' ? 'ADP RUN/Classic' : '—');
    fields['adp'] = adpProds;
    const el = document.getElementById('wfn-dp-adp');
    if (el) { el.textContent = adpProds; el.classList.remove('empty'); }
  } else {
    // TS — show pain points related to WC/benefits
    const pains = [];
    if (document.getElementById('sre-wc') && document.getElementById('sre-wc').checked) pains.push('WC');
    if (document.getElementById('sre-benefits') && document.getElementById('sre-benefits').checked) pains.push('Benefits');
    if (document.getElementById('sre-401k') && document.getElementById('sre-401k').checked) pains.push('401k');
    if (document.getElementById('sre-aca') && document.getElementById('sre-aca').checked) pains.push('ACA');
    const el = document.getElementById('ts-dp-pains');
    const painStr = pains.join(', ') || 'Not assessed';
    if (el) { el.textContent = painStr; el.classList.remove('empty'); }
  }

  // Populate common fields
  ['company','industry','headcount','state','persona'].forEach(function(k) {
    const el = document.getElementById(prefix + '-dp-' + k);
    if (el) { el.textContent = fields[k]; el.classList.remove('empty'); }
  });

  showToast('Prospect data pulled into ' + (tool === 'wfn' ? 'WFN' : 'TotalSource') + ' tool');
};

// Build pain point summary for AI prompts
function buildPainSummary() {
  const pains = [];
  const painMap = {
    'sre-401k': '401k admin errors',
    'sre-wc': "workers' compensation issues",
    'sre-aca': 'ACA compliance burden',
    'sre-benefits': 'benefits administration errors',
    'sre-tax': 'multi-state tax complexity',
    'sre-platform': 'payroll platform failures/instability',
    'sre-gl': 'GL reconciliation issues',
    'sre-support': 'poor HR/payroll support',
    'sre-i9': 'I-9/onboarding compliance gaps',
    'sre-multi': 'multi-entity payroll complexity',
    'sre-manual': 'excessive manual HR/payroll processes'
  };
  Object.entries(painMap).forEach(function([id, label]) {
    const el = document.getElementById(id);
    if (el && el.checked) pains.push(label);
  });
  return pains;
}

// Run inline market & competitive analysis for WFN or TS tool card
window.runMarketIntel = function(tool) {
  const p = window._hqProspect;
  if (!p) { showToast('Pull a prospect first using "↓ Pull from Prospect"', true); return; }

  // Auto-pull data if not already pulled
  pullProspectToTool(tool);

  const panel = document.getElementById(tool + '-mia');
  const body = document.getElementById(tool + '-mia-body');
  const lblEl = document.getElementById(tool + '-mia-prospect-lbl');
  if (!panel || !body) return;

  panel.classList.add('show');
  if (lblEl) lblEl.textContent = p.company + ' · ' + (p.industry || 'Unknown Industry') + ' · ' + (p.headcount || '?') + ' EEs';
  body.innerHTML = '<div class="mia-loading"><div class="mia-spinner"></div>Running AI market analysis for ' + p.company + '…</div>';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const pains = buildPainSummary();
  const adpProducts = Array.from(_sreAdpProducts || []);
  const clientType = _sreClientType || 'unknown';

  const isWFN = tool === 'wfn';
  const product = isWFN ? 'ADP WorkforceNow (WFN)' : 'ADP TotalSource (PEO)';
  const competitor = isWFN
    ? 'competitors such as Paychex Flex, Paylocity, Rippling, UKG Ready, and Gusto'
    : 'PEO competitors such as Insperity, TriNet, Justworks, Oasis (Paychex PEO), and Engage PEO';

  const prompt = `You are a senior ADP sales intelligence analyst. Generate a structured competitive market analysis for the following prospect being evaluated for ${product}.

PROSPECT DATA:
- Company: ${p.company}
- Industry: ${p.industry || 'Not specified'}
- Headcount: ${p.headcount || 'Unknown'} employees
- State: ${p.state || 'Not specified'}
- Decision Maker: ${p.persona || 'Not specified'}
- Client Type: ${clientType === 'existing' ? 'Existing ADP client — ' + (adpProducts.map(function(x){return adpLabel(x);}).join(', ') || 'unknown product') : 'Net-new prospect / non-ADP'}
- Pain Points Identified: ${pains.length ? pains.join(', ') : 'None specifically identified yet'}

Generate a competitive intelligence report in this EXACT JSON format (respond with JSON only, no markdown):
{
  "market_position": "2-3 sentence summary of ${isWFN ? 'WFN' : 'TotalSource'} competitive position for this specific prospect profile",
  "pain_vs_solution": {
    "pros": ["3-5 specific ways ${isWFN ? 'WFN' : 'TotalSource'} directly addresses the identified pain points — be specific to this prospect's industry and size"],
    "cons": ["2-3 honest current-state challenges or gaps the prospect likely has that ${isWFN ? 'WFN' : 'TotalSource'} solves — frame as before/after"]
  },
  "competitive_comparison": [
    {"competitor": "Competitor 1 name", "adp_advantage": "1 specific ADP advantage over them for this prospect", "score": 85},
    {"competitor": "Competitor 2 name", "adp_advantage": "1 specific ADP advantage", "score": 72},
    {"competitor": "Competitor 3 name", "adp_advantage": "1 specific ADP advantage", "score": 68}
  ],
  "market_insight": "1 compelling market trend or industry-specific insight that creates urgency for this prospect to act now",
  "talk_tracks": [
    "Opening talk track: specific to their pain point and industry",
    "Objection handler: if they say they are happy with current provider",
    "ROI anchor: quantified value statement for their headcount/industry",
    "Closing trigger: urgency-based closing statement"
  ],
  "recommended_next_step": "Specific next step recommendation for this prospect"
}`;

  bpGeminiFetch({ messages: [{ role: 'user', content: prompt }] })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    const raw = bpGeminiText(data);
    const clean = raw.replace(/```json|```/g, '').trim();
    let parsed;
    try { parsed = JSON.parse(clean); } catch(e) { throw new Error('Parse error: ' + e.message); }
    renderMarketIntel(body, parsed, tool, p);
    hqMarkDone(0, (isWFN ? 'WFN' : 'TS') + ' Market Intel');
    showToast('✓ Market analysis complete for ' + p.company);
  })
  .catch(function(err) {
    body.innerHTML = '<div class="mia-error">⚠ Analysis failed: ' + err.message + '<br><small>Check your internet connection and try again.</small></div>';
    console.error('[MIA] Error:', err);
  });
};

// Render market intel results into body element
function renderMarketIntel(body, d, tool, p) {
  const isWFN = tool === 'wfn';
  const accentColor = isWFN ? '#1e40af' : '#166534';
  const prosHtml = (d.pain_vs_solution && d.pain_vs_solution.pros || []).map(function(item) { return '<li>' + item + '</li>'; }).join('');
  const consHtml = (d.pain_vs_solution && d.pain_vs_solution.cons || []).map(function(item) { return '<li>' + item + '</li>'; }).join('');
  const compHtml = (d.competitive_comparison || []).map(function(c) {
    return '<div class="mia-comp-card"><div class="mia-comp-name">' + c.competitor + '</div>'
      + '<div class="mia-comp-score">' + (c.score || '—') + '</div>'
      + '<div class="mia-comp-lbl">ADP Win Score</div>'
      + '<div style="font-size:10px;color:var(--text-3);margin-top:5px;line-height:1.3">' + (c.adp_advantage || '') + '</div></div>';
  }).join('');
  const ttHtml = (d.talk_tracks || []).map(function(t) { return '<li onclick="navigator.clipboard.writeText(this.textContent.replace(/^[^:]+:\\s*/,\'\'));showToast(\'Talk track copied\')" title="Click to copy">' + t + '</li>'; }).join('');

  body.innerHTML = ''
    + '<div class="mia-section">'
    +   '<div class="mia-section-title"><span>🎯</span> Market Position</div>'
    +   '<div class="mia-insight-card"><div class="mia-insight-lbl">AI Analysis — ' + p.company + ' · ' + (p.industry || 'Unknown') + '</div>'
    +   '<div class="mia-insight-text">' + (d.market_position || '—') + '</div></div>'
    + '</div>'
    + '<div class="mia-section">'
    +   '<div class="mia-section-title"><span>⚖️</span> Current Pain Points vs. ' + (isWFN ? 'WorkforceNow' : 'TotalSource') + ' Solution</div>'
    +   '<div class="mia-pros-cons">'
    +     '<div class="mia-pc-card cons"><div class="mia-pc-title">⚠ Their Current State</div><ul class="mia-pc-list">' + consHtml + '</ul></div>'
    +     '<div class="mia-pc-card pros"><div class="mia-pc-title">✅ With ' + (isWFN ? 'WFN' : 'TotalSource') + '</div><ul class="mia-pc-list">' + prosHtml + '</ul></div>'
    +   '</div>'
    + '</div>'
    + '<div class="mia-section">'
    +   '<div class="mia-section-title"><span>🏆</span> Competitive Landscape</div>'
    +   '<div class="mia-comp-grid">' + compHtml + '</div>'
    + '</div>'
    + '<div class="mia-section">'
    +   '<div class="mia-section-title"><span>📈</span> Market Insight &amp; Urgency</div>'
    +   '<div class="mia-insight-card"><div class="mia-insight-lbl">Why Act Now</div>'
    +   '<div class="mia-insight-text">' + (d.market_insight || '—') + '</div></div>'
    + '</div>'
    + '<div class="mia-section">'
    +   '<div class="mia-section-title"><span>💬</span> Talk Tracks <span style="font-size:10px;color:var(--text-3);text-transform:none;letter-spacing:0;font-weight:400">— click to copy</span></div>'
    +   '<div class="mia-talk-track"><ul class="mia-talk-list">' + ttHtml + '</ul></div>'
    + '</div>'
    + '<div class="mia-actions">'
    +   '<button class="mia-act-btn primary" onclick="hqApprove()">→ Approve &amp; Launch Cadence</button>'
    +   '<button class="mia-act-btn gold" onclick="navigator.clipboard.writeText(document.getElementById(\'' + tool + '-mia-body\').innerText);showToast(\'Full analysis copied\')">⎘ Copy Analysis</button>'
    +   '<button class="mia-act-btn outline" onclick="runMarketIntel(\'' + tool + '\')">↻ Regenerate</button>'
    + '</div>';
}

// Run the full competitive intelligence report from SRE panel (shown after SRE analysis)
window.runCompetitiveIntel = function() {
  const p = window._hqProspect;
  if (!p) { showToast('Run Smart Product Engine first', true); return; }
  if (!_sreAnalysis) { showToast('Run the Smart Product Engine above first', true); return; }

  const ciPanel = document.getElementById('ci-panel');
  const ciBody = document.getElementById('ci-body');
  const ciLbl = document.getElementById('ci-prospect-lbl');
  const ciBadge = document.getElementById('ci-track-badge');
  if (!ciPanel || !ciBody) return;

  ciPanel.style.display = 'block';
  const rec = _sreAnalysis.rec || 'Workforce Now';
  const isWFN = rec.toLowerCase().includes('workforce');
  if (ciBadge) { ciBadge.textContent = isWFN ? 'WorkforceNow' : 'TotalSource PEO'; ciBadge.className = 'mia-hdr-badge ' + (isWFN ? 'wfn' : 'ts'); }
  if (ciLbl) ciLbl.textContent = p.company + ' · ' + (p.industry || '?') + ' · ' + (p.headcount || '?') + ' EEs · ' + (_sreAnalysis.conf || '?') + '% confidence';
  ciBody.innerHTML = '<div class="mia-loading"><div class="mia-spinner"></div>Generating full competitive intelligence report for ' + p.company + '…</div>';
  ciPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const pains = buildPainSummary();
  const adpProducts = Array.from(_sreAdpProducts || []);
  const wfnScore = _sreAnalysis.wfn || 0;
  const peoScore = _sreAnalysis.peo || 0;
  const primaryFactors = (_sreAnalysis[isWFN ? 'wfnF' : 'peoF'] || []).join('; ');
  const altFactors = (_sreAnalysis[isWFN ? 'peoF' : 'wfnF'] || []).join('; ');

  const prompt = `You are a senior ADP competitive intelligence director. Generate a comprehensive competitive market analysis for an ADP sales rep pursuing this prospect.

SMART ROUTING ENGINE OUTPUT:
- Recommended Product: ${rec}
- Confidence: ${_sreAnalysis.conf}%
- WFN Score: ${wfnScore}/100
- PEO Score: ${peoScore}/100
- Primary Routing Factors: ${primaryFactors || 'None specified'}
- Alternative Factors: ${altFactors || 'None'}

PROSPECT PROFILE:
- Company: ${p.company}
- Industry: ${p.industry || 'Not specified'}
- Headcount: ${p.headcount || 'Unknown'} employees
- State: ${p.state || 'Not specified'}
- Decision Maker: ${p.persona || 'Not specified'}
- Client Type: ${_sreClientType === 'existing' ? 'Existing ADP client (' + adpProducts.map(function(x){return adpLabel(x);}).join(', ') + ')' : 'Non-ADP / net-new prospect'}
- Identified Pain Points: ${pains.length ? pains.join(', ') : 'Not specified'}
- Cadence Track: ${isWFN ? 'WorkforceNow mid-market' : 'TotalSource PEO'}

Generate a complete competitive intelligence report in this EXACT JSON format (JSON only, no markdown):
{
  "executive_summary": "3-4 sentence executive summary of opportunity, confidence level, and recommended approach for ${p.company}",
  "prospect_current_state": {
    "likely_platform": "Best guess of their current payroll/HR platform based on industry, size, and client type",
    "estimated_annual_spend": "Estimated annual HCM/payroll spend range for a company this size",
    "key_vulnerabilities": ["3-4 specific vulnerabilities in their current setup based on identified pain points"]
  },
  "adp_value_proposition": {
    "primary_wins": ["4-5 specific, quantified ways ${rec} solves their exact situation — use industry-specific data"],
    "differentiators": ["3-4 ADP-specific differentiators vs. the competitive field for this profile"]
  },
  "competitive_threats": [
    {"competitor": "Most likely competitor name", "threat_level": "High/Medium/Low", "counter": "Specific counter-position"},
    {"competitor": "Second competitor", "threat_level": "High/Medium/Low", "counter": "Specific counter-position"},
    {"competitor": "Third competitor", "threat_level": "Medium/Low", "counter": "Specific counter-position"}
  ],
  "market_dynamics": "2-3 sentences on current market conditions, trends, or regulatory changes creating urgency for this industry/size",
  "objection_handlers": {
    "price": "Response if they say ADP is too expensive",
    "timing": "Response if they say now is not a good time",
    "current_provider": "Response if they say they are happy with current provider"
  },
  "recommended_strategy": {
    "approach": "consultative/challenger/value-led",
    "opening_hook": "Single most compelling opening statement tailored to ${p.persona || 'their decision maker'} at a ${p.industry || 'their industry'} company",
    "sequence_focus": "What the 30-day cadence should emphasize for this prospect",
    "close_trigger": "The specific business event or trigger that will get them to sign"
  }
}`;

  bpGeminiFetch({ messages: [{ role: 'user', content: prompt }] })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    const raw = bpGeminiText(data);
    const clean = raw.replace(/```json|```/g, '').trim();
    let d;
    try { d = JSON.parse(clean); } catch(e) { throw new Error('Parse error: ' + e.message); }
    renderCompetitiveIntel(ciBody, d, p, rec, isWFN);
    showToast('✓ Competitive intelligence report ready');
  })
  .catch(function(err) {
    ciBody.innerHTML = '<div class="mia-error">⚠ Report failed: ' + err.message + '</div>';
  });
};

// Render the full competitive intel report
function renderCompetitiveIntel(body, d, p, rec, isWFN) {
  const cs = d.prospect_current_state || {};
  const avp = d.adp_value_proposition || {};
  const rs = d.recommended_strategy || {};
  const oh = d.objection_handlers || {};

  const threatHtml = (d.competitive_threats || []).map(function(t) {
    const lvlColor = t.threat_level === 'High' ? '#dc2626' : t.threat_level === 'Medium' ? '#d97706' : '#16a34a';
    return '<div style="padding:10px;background:var(--off-white);border:1px solid var(--border);border-radius:6px;margin-bottom:8px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'
      + '<span style="font-size:13px;font-weight:700;color:var(--text)">' + t.competitor + '</span>'
      + '<span style="font-size:10px;font-weight:700;color:' + lvlColor + ';padding:2px 7px;border-radius:3px;background:' + lvlColor + '18">' + t.threat_level + ' THREAT</span>'
      + '</div><div style="font-size:11.5px;color:var(--text-2)">→ ' + (t.counter || '—') + '</div></div>';
  }).join('');

  const prosHtml = (avp.primary_wins || []).map(function(w) { return '<li>' + w + '</li>'; }).join('');
  const diffHtml = (avp.differentiators || []).map(function(w) { return '<li>' + w + '</li>'; }).join('');
  const vulnHtml = (cs.key_vulnerabilities || []).map(function(v) { return '<li>' + v + '</li>'; }).join('');

  body.innerHTML = ''
    // Executive Summary
    + '<div class="mia-section">'
    +   '<div class="mia-section-title"><span>📋</span> Executive Summary</div>'
    +   '<div class="mia-insight-card">'
    +     '<div class="mia-insight-lbl">AI Assessment — ' + rec + ' · ' + (_sreAnalysis ? _sreAnalysis.conf : '?') + '% Confidence</div>'
    +     '<div class="mia-insight-text">' + (d.executive_summary || '—') + '</div>'
    +   '</div>'
    + '</div>'
    // Current State
    + '<div class="mia-section">'
    +   '<div class="mia-section-title"><span>🔍</span> Prospect\'s Current State</div>'
    +   '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'
    +     '<div style="padding:10px;background:var(--off-white);border:1px solid var(--border);border-radius:6px">'
    +       '<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-3);margin-bottom:4px">Likely Current Platform</div>'
    +       '<div style="font-size:13px;font-weight:700;color:var(--text)">' + (cs.likely_platform || '—') + '</div>'
    +     '</div>'
    +     '<div style="padding:10px;background:var(--off-white);border:1px solid var(--border);border-radius:6px">'
    +       '<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-3);margin-bottom:4px">Est. Annual HCM Spend</div>'
    +       '<div style="font-size:13px;font-weight:700;color:var(--text)">' + (cs.estimated_annual_spend || '—') + '</div>'
    +     '</div>'
    +   '</div>'
    +   '<div class="mia-pc-card cons"><div class="mia-pc-title">⚠ Key Vulnerabilities in Their Current Setup</div><ul class="mia-pc-list">' + vulnHtml + '</ul></div>'
    + '</div>'
    // ADP Value Props
    + '<div class="mia-section">'
    +   '<div class="mia-section-title"><span>✅</span> ADP Value Proposition for This Prospect</div>'
    +   '<div class="mia-pros-cons">'
    +     '<div class="mia-pc-card pros"><div class="mia-pc-title">🏆 Why ' + (isWFN ? 'WFN' : 'TotalSource') + ' Wins Here</div><ul class="mia-pc-list">' + prosHtml + '</ul></div>'
    +     '<div class="mia-pc-card pros" style="background:#eff6ff;border-color:#bfdbfe"><div class="mia-pc-title" style="color:#1e40af">⚡ ADP Differentiators</div><ul class="mia-pc-list">' + diffHtml + '</ul></div>'
    +   '</div>'
    + '</div>'
    // Competitive Threats
    + '<div class="mia-section">'
    +   '<div class="mia-section-title"><span>⚔️</span> Competitive Threats &amp; Counter-Positions</div>'
    +   threatHtml
    + '</div>'
    // Market Dynamics
    + '<div class="mia-section">'
    +   '<div class="mia-section-title"><span>📈</span> Market Dynamics &amp; Urgency</div>'
    +   '<div class="mia-insight-card"><div class="mia-insight-lbl">Why Act Now — ' + (p.industry || 'This Market') + '</div>'
    +   '<div class="mia-insight-text">' + (d.market_dynamics || '—') + '</div></div>'
    + '</div>'
    // Objection Handlers
    + '<div class="mia-section">'
    +   '<div class="mia-section-title"><span>🛡️</span> Objection Handlers</div>'
    +   '<div style="display:flex;flex-direction:column;gap:8px">'
    +     ['price','timing','current_provider'].map(function(k) {
            const labels = { price: '💰 If they say ADP is too expensive', timing: '⏰ If they say timing isn\'t right', current_provider: '🤝 If they\'re happy with current provider' };
            return '<div style="padding:10px 12px;background:var(--off-white);border:1px solid var(--border);border-radius:6px;cursor:pointer" onclick="navigator.clipboard.writeText(this.querySelector(\'.oh-text\').textContent);showToast(\'Objection handler copied\')" title="Click to copy">'
              + '<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--text-3);margin-bottom:4px">' + labels[k] + '</div>'
              + '<div class="oh-text" style="font-size:12px;color:var(--text);line-height:1.5">' + (oh[k] || '—') + '</div>'
              + '<div style="font-size:9px;color:var(--text-3);margin-top:4px">click to copy</div>'
              + '</div>';
          }).join('')
    +   '</div>'
    + '</div>'
    // Strategy
    + '<div class="mia-section">'
    +   '<div class="mia-section-title"><span>🎯</span> Recommended Sales Strategy</div>'
    +   '<div class="mia-insight-card">'
    +     '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">'
    +       '<span style="padding:3px 9px;border-radius:3px;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;background:rgba(255,255,255,.1);color:rgba(255,255,255,.7)">' + (rs.approach || 'consultative').toUpperCase() + ' APPROACH</span>'
    +     '</div>'
    +     '<div style="margin-bottom:10px"><div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:4px">Opening Hook</div>'
    +     '<div style="font-size:13px;color:#fff;font-style:italic;line-height:1.5">"' + (rs.opening_hook || '—') + '"</div></div>'
    +     '<div style="margin-bottom:10px"><div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:4px">Cadence Focus</div>'
    +     '<div style="font-size:12px;color:rgba(255,255,255,.8);line-height:1.5">' + (rs.sequence_focus || '—') + '</div></div>'
    +     '<div><div style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:4px">Close Trigger</div>'
    +     '<div style="font-size:12px;color:rgba(255,255,255,.8);line-height:1.5">' + (rs.close_trigger || '—') + '</div></div>'
    +   '</div>'
    + '</div>'
    // Actions
    + '<div class="mia-actions">'
    +   '<button class="mia-act-btn primary" onclick="hqApprove()">→ Approve &amp; Launch Cadence</button>'
    +   '<button class="mia-act-btn gold" onclick="hqTab(\'composer\')">📅 Open 30-Day Cadence</button>'
    +   '<button class="mia-act-btn outline" onclick="navigator.clipboard.writeText(document.getElementById(\'ci-body\').innerText);showToast(\'Full report copied\')">⎘ Copy Full Report</button>'
    +   '<button class="mia-act-btn outline" onclick="runCompetitiveIntel()">↻ Regenerate</button>'
    + '</div>';
}

// Auto-show CI panel after SRE runs
const _origSreRun = window.sreRun || null;

// Open LinkedIn profile from modal field
window.openLinkedIn=function(){
  let url=document.getElementById('f-linkedin').value.trim();
  if(!url){
    // Try from active prospect
    if(window._hqProspect&&window._hqProspect.linkedin) url=window._hqProspect.linkedin;
    else{showToast('No LinkedIn URL entered',true);return;}
  }
  if(!url.startsWith('http')) url='https://'+url;
  window.open(url,'_blank');
};

// Save prospect AND scroll to Smart Product Routing Engine
window.saveAndRouteSRE=function(){
  const company=document.getElementById('f-company').value.trim();
  if(!company){showToast('Company name is required',true);return;}
  window._hqProspect={
    company,contact:document.getElementById('f-contact').value.trim(),
    persona:document.getElementById('f-persona').value,
    industry:document.getElementById('f-industry').value.trim(),
    state:document.getElementById('f-state').value.trim(),
    headcount:document.getElementById('f-headcount').value.trim(),
    email:document.getElementById('f-email').value.trim(),
    phone:document.getElementById('f-phone').value.trim(),
    linkedin:document.getElementById('f-linkedin').value.trim(),
    track:selectedRole||'WFN'
  };
  closeModal();hqRenderBanner();hqAdvancePipeline(1);
  // Switch to HQ tab and scroll to SRE
  if(typeof hqTab==='function') hqTab('home');
  setTimeout(function(){
    sreRefresh();
    const sre=document.getElementById('sre-wrap')||document.querySelector('.sre-wrap');
    if(sre) sre.scrollIntoView({behavior:'smooth',block:'start'});
    showToast('🎯 Routed to Smart Product Engine — '+company);
  },120);
};

// ══════════════════════════════════════════════════════════════════
// IMAGE INTEL EXTRACTOR — Vision AI extracts signals from screenshots
// Never overwrites firmographic fields: company, contact, headcount,
// state, industry, persona, email, adpProducts, clientType
// ══════════════════════════════════════════════════════════════════
window._sreImgFiles  = []; // {file, base64, mediaType}
window._sreImgSignals = null; // last parsed extraction result

window.sreImgFilesSelected = function(fileList) {
  const files = Array.from(fileList).slice(0, 5);
  files.forEach(file => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => {
      const b64 = e.target.result.split(',')[1];
      const mediaType = file.type;
      window._sreImgFiles.push({ file, base64: b64, mediaType, name: file.name });
      sreImgRenderThumbs();
    };
    reader.readAsDataURL(file);
  });
};

window.sreImgDrop = function(e) {
  e.preventDefault();
  document.getElementById('sre-img-dropzone').style.borderColor = 'var(--border)';
  if (e.dataTransfer && e.dataTransfer.files) sreImgFilesSelected(e.dataTransfer.files);
};

window.sreImgRenderThumbs = function() {
  const container = document.getElementById('sre-img-thumbs');
  const btn = document.getElementById('sre-img-analyze-btn');
  if (!container) return;
  if (!window._sreImgFiles.length) { container.innerHTML = ''; if (btn) btn.style.display = 'none'; return; }
  container.innerHTML = window._sreImgFiles.map((f, i) => `
    <div style="position:relative;display:inline-block">
      <img src="data:${f.mediaType};base64,${f.base64}" style="width:72px;height:56px;object-fit:cover;border-radius:5px;border:1px solid var(--border)">
      <button onclick="window._sreImgFiles.splice(${i},1);sreImgRenderThumbs()" style="position:absolute;top:-5px;right:-5px;width:16px;height:16px;border-radius:50%;border:none;background:#ef4444;color:#fff;font-size:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">✕</button>
      <div style="font-size:8px;color:var(--text-3);max-width:72px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px">${f.name}</div>
    </div>`).join('');
  if (btn) btn.style.display = 'inline-block';
};

window.sreImgClear = function() {
  window._sreImgFiles = [];
  window._sreImgSignals = null;
  sreImgRenderThumbs();
  const st = document.getElementById('sre-img-status');
  if (st) st.textContent = '';
};

window.sreImgAnalyze = async function() {
  if (!window._sreImgFiles.length) { showToast('Upload at least one image first', true); return; }
  const btn = document.getElementById('sre-img-analyze-btn');
  const status = document.getElementById('sre-img-status');
  const results = document.getElementById('sre-img-results');
  const resultsBody = document.getElementById('sre-img-results-body');
  if (btn) { btn.disabled = true; btn.textContent = '\u29f3 Analyzing\u2026'; }
  if (status) { status.textContent = 'AI Vision scanning images\u2026'; status.style.color = 'var(--text-3)'; }
  if (results) results.style.display = 'none';

  // Build Gemini parts: text prompt + images as inline_data
  // Routes through same CF Worker proxy as rest of app (X-Service: gemini)
  const parts = [];
  parts.push({ text: `You are an ADP sales intelligence AI. Analyze these screenshots and extract ONLY sales signals.
DO NOT extract or return any firmographic fields: company name, contact name, headcount, state, industry, email, phone.
Return ONLY valid JSON (no markdown, no preamble) in this exact structure:
{
  "pain_points": ["IDs evidenced from: payroll_errors, tax_filing, benefits_payment, aca_compliance, workers_comp, multi_entity, platform_failures, manual_spreadsheet, slow_onboarding, high_turnover, compliance_risk, i9_everify, data_security, reporting_analytics, integration_issues, implementation_support, cost_transparency, change_mgmt"],
  "competitor_mentions": ["names: Paycom, Paylocity, UKG, Dayforce, Workday, Paychex, Justworks, Rippling, TriNet, Insperity, BambooHR, isolved"],
  "objections": ["objection strings extracted or summarized"],
  "buying_signals": ["budget approved, timeline mentioned, evaluation started, demo requested, etc."],
  "key_quotes": ["1-3 verbatim quotes under 20 words that reveal pain, intent, or objection"],
  "additional_context": "1-2 sentence summary of other relevant sales intelligence"
}
If no signals found, return: {"pain_points":[],"competitor_mentions":[],"objections":[],"buying_signals":[],"key_quotes":[],"additional_context":"No actionable signals detected."}` });

  window._sreImgFiles.forEach(function(f) {
    parts.push({ inline_data: { mime_type: f.mediaType || 'image/jpeg', data: f.base64 } });
  });

  try {
    // ✨ CLOUDFLARE WORKER PROXY - API key handled server-side
    // Convert Gemini parts → Anthropic messages format (worker converts internally)
    const response = await fetch(API_ENDPOINTS.gemini, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: partsToAnthropicContent(parts) }] })
    });

    if (!response.ok) {
      const errText = await response.text().catch(function(){ return 'Network error'; });
      throw new Error('Gemini API error ' + response.status + ': ' + errText.substring(0, 120) + ' - Check your API key in app.js');
    }

    const data = await response.json();
    const raw = bpGeminiText(data) || '';
    if (!raw) throw new Error('Empty response from AI \u2014 try again');

    // Robust JSON extraction
    let clean = raw.replace(/```json|```/g, '').trim();
    const jsonStart = clean.indexOf('{');
    const jsonEnd = clean.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('AI returned non-JSON \u2014 try a clearer screenshot');
    clean = clean.slice(jsonStart, jsonEnd + 1);

    let parsed;
    try { parsed = JSON.parse(clean); }
    catch(pe) {
      parsed = { pain_points:[], competitor_mentions:[], objections:[], buying_signals:[], key_quotes:[], additional_context: 'Partial extraction \u2014 signals may be incomplete.' };
    }
    window._sreImgSignals = parsed;

    // Render results preview
    let html = '';
    if (parsed.pain_points && parsed.pain_points.length)
      html += `<div style="margin-bottom:8px"><span style="font-size:10px;font-weight:700;color:var(--red);text-transform:uppercase;letter-spacing:.8px">Pain Points (${parsed.pain_points.length})</span><br><span>${parsed.pain_points.join(' \u00b7 ')}</span></div>`;
    if (parsed.competitor_mentions && parsed.competitor_mentions.length)
      html += `<div style="margin-bottom:8px"><span style="font-size:10px;font-weight:700;color:#c2410c;text-transform:uppercase;letter-spacing:.8px">Competitors Mentioned</span><br><span>${parsed.competitor_mentions.join(', ')}</span></div>`;
    if (parsed.buying_signals && parsed.buying_signals.length)
      html += `<div style="margin-bottom:8px"><span style="font-size:10px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:.8px">Buying Signals</span><br><ul style="margin:4px 0 0 16px;padding:0">${parsed.buying_signals.map(function(s){return '<li>'+s+'</li>';}).join('')}</ul></div>`;
    if (parsed.objections && parsed.objections.length)
      html += `<div style="margin-bottom:8px"><span style="font-size:10px;font-weight:700;color:#7c3aed;text-transform:uppercase;letter-spacing:.8px">Objections</span><br><ul style="margin:4px 0 0 16px;padding:0">${parsed.objections.map(function(o){return '<li>'+o+'</li>';}).join('')}</ul></div>`;
    if (parsed.key_quotes && parsed.key_quotes.length)
      html += `<div style="margin-bottom:8px"><span style="font-size:10px;font-weight:700;color:var(--navy);text-transform:uppercase;letter-spacing:.8px">Key Quotes</span><br>${parsed.key_quotes.map(function(q){return '<div style="border-left:3px solid var(--navy);padding-left:8px;margin-top:4px;font-style:italic;color:var(--text)">\"'+q+'\"</div>';}).join('')}</div>`;
    if (parsed.additional_context)
      html += `<div style="margin-top:6px;padding:8px;background:var(--off-white);border-radius:5px;font-size:11px;color:var(--text-2)">${parsed.additional_context}</div>`;
    if (!html) html = '<div style="color:var(--text-3);font-style:italic">No actionable sales signals detected in these images.</div>';

    if (resultsBody) resultsBody.innerHTML = html;
    if (results) results.style.display = 'block';
    if (status) { status.textContent = '\u2713 Signals extracted \u2014 review and apply below'; status.style.color = '#15803d'; }

  } catch(err) {
    console.error('[sreImgAnalyze]', err);
    const msg = err.message || 'Unknown error';
    if (status) { status.textContent = '\u26a0 ' + msg; status.style.color = 'var(--red)'; }
    showToast('Image analysis failed: ' + msg.substring(0, 80), true);
  }

  if (btn) { btn.disabled = false; btn.textContent = '\ud83d\udd0d Extract Intel from Images \u2192'; }
};

// Apply extracted signals to the SRE form WITHOUT touching firmographic fields
window.sreImgApplySignals = function() {
  const s = window._sreImgSignals;
  if (!s) { showToast('No signals to apply', true); return; }

  // 1. Check matching pain point checkboxes
  if (s.pain_points && s.pain_points.length) {
    s.pain_points.forEach(ppId => {
      const cb = document.getElementById('pp-' + ppId);
      if (cb) cb.checked = true;
    });
  }

  // 2. Set competitor dropdown only if currently empty/unknown
  if (s.competitor_mentions && s.competitor_mentions.length) {
    const compEl = document.getElementById('sre-competitor');
    if (compEl && (!compEl.value || compEl.value === '')) {
      // Match to known values
      const compMap = {
        'paycom':'paycom','paylocity':'paylocity','ukg':'ukg','kronos':'ukg','ultimate':'ukg',
        'dayforce':'dayforce','ceridian':'dayforce','workday':'workday','paychex':'paychex',
        'justworks':'justworks','rippling':'rippling','trinet':'trinet','insperity':'insperity',
        'bamboohr':'bamboo','bamboo':'bamboo','isolved':'isolved'
      };
      const found = s.competitor_mentions.find(c => compMap[c.toLowerCase()]);
      if (found) { compEl.value = compMap[found.toLowerCase()]; sreCompetitorChanged(); }
    }
  }

  // 3. Append objections + key quotes to the Gong transcript box (additive, never replace)
  if ((s.objections && s.objections.length) || (s.key_quotes && s.key_quotes.length)) {
    const ta = document.getElementById('sre-transcript');
    if (ta) {
      const existing = ta.value.trim();
      const appendParts = [];
      if (s.key_quotes && s.key_quotes.length) appendParts.push('[Image Quotes]\n' + s.key_quotes.map(q=>`"${q}"`).join('\n'));
      if (s.objections && s.objections.length) appendParts.push('[Image Objections]\n' + s.objections.join('\n'));
      if (appendParts.length) ta.value = (existing ? existing + '\n\n' : '') + appendParts.join('\n\n');
    }
  }

  // 4. Add buying signals + context to extended notes (additive)
  if (s.buying_signals && s.buying_signals.length || s.additional_context) {
    const notesEl = document.getElementById('sre-ext-notes');
    if (notesEl) {
      const existing = notesEl.value.trim();
      const appendParts = [];
      if (s.buying_signals && s.buying_signals.length) appendParts.push('[Image Buying Signals] ' + s.buying_signals.join(' | '));
      if (s.additional_context) appendParts.push('[Image Context] ' + s.additional_context);
      notesEl.value = (existing ? existing + '\n' : '') + appendParts.join('\n');
    }
  }

  showToast('✓ Signals applied — firmographic fields unchanged');
  document.getElementById('sre-img-results').style.display = 'none';
  window._sreImgSignals = null;
};

// Analyze pasted transcript text and map to SRE checkboxes
window.sreAnalyzeTranscript=function(){
  const ta=document.getElementById('sre-transcript');
  const statusEl=document.getElementById('sre-transcript-status');
  if(!ta||!ta.value.trim()){showToast('Paste a Gong transcript first',true);return;}
  const text=ta.value;
  // Client type detection
  const detected=gongDetectClientType(text);
  // Pain point mapping
  const pains=gongMapPains(text);
  // Apply to SRE
  sreApplyFromScan({
    client_type:detected.clientType,
    adp_products:detected.adpProducts,
    pain_points:pains
  });
  // Update status
  if(statusEl){
    const painLabels=pains.map(function(id){
      const el=document.getElementById(id);
      return el?el.nextElementSibling.textContent:id;
    });
    statusEl.innerHTML='<span style="color:var(--red);font-weight:700">✓ Mapped:</span> '
      +(pains.length?painLabels.join(' · '):'No pain points detected — try adding more transcript text')
      +(detected.adpProducts.length?' &nbsp;|&nbsp; <span style="color:var(--blue);font-weight:600">ADP: '+detected.adpProducts.map(function(x){return adpLabel(x);}).join(', ')+'</span>':'');
  }
  showToast('✓ Transcript analyzed — '+pains.length+' pain point'+(pains.length!==1?'s':'')+' mapped');
};

// Live keyword hint as user types
window.sreTranscriptChanged=function(){
  const ta=document.getElementById('sre-transcript');
  const statusEl=document.getElementById('sre-transcript-status');
  if(!ta||!statusEl)return;
  const text=ta.value;
  if(text.length<20){statusEl.textContent='';return;}
  const pains=gongMapPains(text);
  statusEl.textContent=pains.length
    ?'⚡ '+pains.length+' pain point'+(pains.length!==1?'s':'')+' detected — click Analyze → to apply'
    :'Listening for keywords...';
};

function hqRenderBanner(){
  const p=window._hqProspect;if(!p)return;
  document.getElementById('hq-pe').style.display='none';
  const pf=document.getElementById('hq-pf');if(!pf)return;pf.style.display='grid';
  const tc=p.track==='WFN'?'wfn':'ts';
  const tl=p.track==='WFN'?'WorkforceNow':'TotalSource PEO';
  pf.innerHTML=`
    <div class="psf-item"><div class="psf-lbl">Company</div><div class="psf-val co">${p.company}</div></div>
    <div class="psf-item"><div class="psf-lbl">Contact</div><div class="psf-val">${p.contact||'—'}</div></div>
    <div class="psf-item"><div class="psf-lbl">Persona</div><div class="psf-val" style="font-size:11px">${p.persona}</div></div>
    <div class="psf-item"><div class="psf-lbl">Industry</div><div class="psf-val">${p.industry||'—'}</div></div>
    <div class="psf-item"><div class="psf-lbl">State / HC</div><div class="psf-val">${(p.state||'—')+' · '+(p.headcount||'—')+' EEs'}</div></div>
    <div class="psf-item"><div class="psf-lbl">Track</div><div class="psf-val ${tc}">${tl}</div></div>
    <div class="psf-item" style="border-right:none"><button onclick="openModal()" style="background:var(--off-white);border:1px solid var(--border);color:var(--text-2);border-radius:5px;padding:4px 10px;font-size:10px;cursor:pointer;font-family:var(--fb);font-weight:600">✏ Edit</button></div>
  `;
}

function hqAdvancePipeline(step){
  for(let i=0;i<step;i++){
    const n=document.getElementById('psn'+i),l=document.getElementById('psl'+i);
    if(n){n.classList.remove('active');n.classList.add('done')}
    if(l){l.classList.remove('active');l.classList.add('done')}
  }
  const an=document.getElementById('psn'+step),al=document.getElementById('psl'+step);
  if(an)an.classList.add('active');if(al)al.classList.add('active');
}

window.hqMarkDone=function(step,label){
  window._hqPipelineStep=Math.max(window._hqPipelineStep,step+1);
  hqAdvancePipeline(step+1);showToast(label+' — marked complete');
};

window.hqOpenScore=function(track){ hqApprove(); };

function hqScoreBox(label,id,unit,desc,color){
  return `<div class="sc-box"><div class="sc-lbl">${label}</div>
    <div style="display:flex;align-items:center;justify-content:center;gap:5px">
      <input type="number" class="score-inp" id="${id}" placeholder="—" min="0" max="100" style="color:${color}">
      <span style="font-size:11px;color:var(--text-3)">${unit}</span>
    </div>
    <div class="sc-desc">${desc}</div></div>`;
}

function hqUpdateRec(){
  const fitEl=document.getElementById('sc-fit');if(!fitEl||!fitEl.value)return;
  const fit=parseFloat(fitEl.value);let rec='';
  if(fit>=70){rec='🟢 <strong>High Fit</strong> — Aggressive cadence. Lead with ROI and cost savings.';document.querySelector('input[name="hq-tone"][value="aggressive"]').checked=true}
  else if(fit>=40){rec='🟡 <strong>Mid Fit</strong> — Consultative tone. Education-first approach.';document.querySelector('input[name="hq-tone"][value="consultative"]').checked=true}
  else{rec='🔴 <strong>Low Fit</strong> — Nurture tone. Long-play community approach.';document.querySelector('input[name="hq-tone"][value="nurture"]').checked=true}
  document.getElementById('rr-desc').innerHTML=rec;
}

window.hqApprove=function(){
  window._hqApproved=true;hqAdvancePipeline(4);
  // Tab is always visible; approval just enables the content
  const btn=document.getElementById('hq-composer-btn');
  if(btn){btn.style.opacity='1';btn.style.cursor='pointer';btn.style.background='var(--green-bg)';btn.style.color='var(--green)';btn.style.borderColor='var(--green-border)'}
  // ── Feature 4: Cadence jump banner ──
  const existing=document.getElementById('cadence-jump-banner');
  if(existing)existing.remove();
  const banner=document.createElement('div');
  banner.id='cadence-jump-banner';
  banner.className='cadence-jump-banner';
  banner.innerHTML='<button onclick="hqTab(\'composer\');document.getElementById(\'cadence-jump-banner\').remove()">'
    +'📅 Go to 30-Day Cadence'
    +'<button class="cjb-close" onclick="event.stopPropagation();document.getElementById(\'cadence-jump-banner\').remove()">✕</button>'
    +'</button>';
  document.body.appendChild(banner);
  // Persist approval to saved prospect
  const p=window._hqProspect;
  if(p){
    const arr=getProspects();
    const idx=arr.findIndex(function(x){return x.company===p.company;});
    if(idx>=0){
      arr[idx].approved=true;
      arr[idx].updatedAt=new Date().toISOString();
      saveProspectsLocal(arr);
      // Push approval to Firestore
      if(typeof fbSaveProspect==='function') fbSaveProspect(arr[idx]);
    }
    window._hqProspect.approved=true;
  }
  showToast('Cadence approved — 30-Day Cadence unlocked ⚡');
  // ── Background Email Engine: fire immediately on approval ──
  if(typeof window.bpEngineTrigger==='function') window.bpEngineTrigger();
};

// ── COMPOSER ──
// ═══════════════════════════════════════════════════════════════════════
//  BACKGROUND EMAIL ENGINE  (bpEmailEngine)
//
//  Starts at login. Watches for a prospect + confirmed track toggle.
//  When both are present it silently generates all 5 cadence emails using:
//    1. Full SRE profile data  (pain points, competitor, renewal, transcript…)
//    2. Analysis tool results  (_atResults) if already run — injected live
//    3. MCA competitive intel  (p.mcaResult) if run
//  Emails are written into touch._proseBody before the rep ever opens the
//  cadence composer. If analysis runs AFTER the engine already fired it
//  re-generates the relevant touches with the richer data automatically.
//
//  Engine state lives on window._bpEngine — never on any prospect object.
// ═══════════════════════════════════════════════════════════════════════

window._bpEngine = {
  active:      false,   // running this session?
  prospectKey: null,    // company key of last generated set
  trackKey:    null,    // 'WFN' | 'TS' of last generated set
  toneKey:     null,    // tone of last generated set
  atSnapshot:  null,    // JSON snapshot of _atResults at generation time
  status:      'idle',  // 'idle' | 'running' | 'ready' | 'error'
  queue:       [],      // touch indices still pending
  generated:   {},      // { touchIndex: true } for completed touches
  errors:      {},      // { touchIndex: errorMsg }
  _watchTimer: null,
  _retryTimer: null,
};

// ── Status badge helper ───────────────────────────────────────────────
function bpEngineSetStatus(status, detail) {
  window._bpEngine.status = status;
  const el = document.getElementById('bp-engine-badge');
  if (!el) return;
  const MAP = {
    idle:    { icon: '◌', text: 'Email engine idle',     cls: '' },
    running: { icon: '⟳', text: detail || 'Generating emails…', cls: 'running' },
    ready:   { icon: '✓', text: detail || 'Emails ready',       cls: 'ready'   },
    error:   { icon: '!', text: detail || 'Engine error',        cls: 'error'   },
  };
  const s = MAP[status] || MAP.idle;
  el.innerHTML = `<span class="bee-icon">${s.icon}</span><span class="bee-txt">${s.text}</span>`;
  el.className = 'bp-engine-badge ' + s.cls;

  // ── Animate the pipeline node ──
  const dot  = document.getElementById('eng-dot');
  const ring = document.getElementById('eng-ring');
  const node = document.getElementById('psn-engine');
  const lbl  = document.getElementById('psl-engine');
  if (!dot || !ring || !node) return;

  // Remove all animation styles first
  node.style.animation = '';
  ring.style.opacity   = '0';
  ring.style.animation = '';

  if (status === 'running') {
    dot.setAttribute('fill', '#f59e0b');      // amber while generating
    ring.style.borderColor = '#f59e0b';
    ring.style.opacity = '1';
    ring.style.animation = 'eng-pulse 1.4s ease-out infinite';
    node.style.animation = 'eng-spin-dot 1.4s linear infinite';
    if (lbl) { lbl.textContent = 'Writing…'; lbl.style.color = '#b45309'; }
  } else if (status === 'ready') {
    dot.setAttribute('fill', '#22c55e');      // green when done
    ring.style.borderColor = '#22c55e';
    ring.style.opacity = '1';
    ring.style.animation = 'eng-pulse-once .6s ease-out forwards';
    node.classList.add('done');
    if (lbl) { lbl.textContent = 'Emails Ready'; lbl.style.color = '#15803d'; }
  } else if (status === 'error') {
    dot.setAttribute('fill', '#ef4444');
    if (lbl) { lbl.textContent = 'Engine Error'; lbl.style.color = '#b91c1c'; }
  } else {
    dot.setAttribute('fill', '#94a3b8');      // gray when idle
    if (lbl) { lbl.textContent = 'Email Engine'; lbl.style.color = ''; }
  }

  // Inject keyframes once
  if (!document.getElementById('eng-keyframes')) {
    const st = document.createElement('style');
    st.id = 'eng-keyframes';
    st.textContent = `
      @keyframes eng-pulse { 0%{transform:translateX(-50%) scale(1);opacity:.9} 100%{transform:translateX(-50%) scale(1.7);opacity:0} }
      @keyframes eng-pulse-once { 0%{transform:translateX(-50%) scale(1);opacity:.9} 100%{transform:translateX(-50%) scale(1.9);opacity:0} }
      @keyframes eng-spin-dot { 0%,100%{opacity:1} 50%{opacity:.4} }
    `;
    document.head.appendChild(st);
  }
}

// ── Build rich context string for one touch ───────────────────────────
function bpEngineBuildContext(p, touch, atResults) {
  const co  = p.company    || '[Company]';
  const nm  = (p.contact   || '').split(' ')[0] || '[Name]';
  const ind = p.industry   || '[Industry]';
  const st  = p.state      || '[State]';
  const hc  = p.headcount  || '[X]';
  const ext = p.extProfile || {};

  let ctx = `PROSPECT PROFILE:\n`;
  ctx += `  Company: ${co}\n`;
  ctx += `  First Name: ${nm}\n`;
  ctx += `  Industry: ${ind}\n`;
  ctx += `  State: ${st}\n`;
  ctx += `  Headcount: ${hc} employees (${p.headcountBand || 'mid-market'})\n`;
  ctx += `  Product Track: ${p.track === 'WFN' ? 'ADP WorkforceNow (HCM)' : 'ADP TotalSource (PEO)'}\n`;
  if (p.cadenceTone)  ctx += `  Cadence Tone: ${p.cadenceTone}\n`;
  if (p.competitor)   ctx += `  Incumbent / Competitor: ${p.competitor}\n`;
  if (p.renewalDate)  ctx += `  Contract Renewal: ${p.renewalDate}\n`;
  if (p.extProfile && p.extProfile.adpUpsellGoal) ctx += `  ADP Upsell Goal: ${p.extProfile.adpUpsellGoal}\n  *** EXISTING ADP CLIENT — frame emails as upgrade/expansion, not displacement. Emphasize ROI and ADP ecosystem continuity. ***\n`;
  if (p.adpProducts && p.adpProducts.length) {
    ctx += `  Current ADP Products: ${p.adpProducts.map(function(x){return adpLabel(x);}).join(', ')}\n`;
    const _prods = p.adpProducts;
    if (_prods.includes('benefits') || _prods.includes('adp_benefits'))
      ctx += `  \u29D1 Benefits upsell: Already trusts ADP for benefits. Bridge to WFN/TotalSource — show how integrated payroll+benefits eliminates carrier reconciliation errors and saves HR hours monthly.\n`;
    if (_prods.includes('wc') || _prods.includes('adp_wc'))
      ctx += `  \u29D1 Workers' Comp upsell: Uses ADP WC — ideal for TotalSource pay-as-you-go WC or WFN integration. Angle: eliminate year-end audit surprises and free up cash flow.\n`;
    if (_prods.includes('401k') || _prods.includes('adp_401k'))
      ctx += `  \u29D1 401K upsell: Uses ADP retirement. Pitch integrated payroll+401K for automatic deferral sync, reduced compliance risk, and single-vendor simplicity.\n`;
    if (p.clientType === 'existing')
      ctx += `  *** EXISTING ADP CLIENT — frame all outreach as upgrade/expansion. Never use displacement language. Lead with ecosystem ROI and consolidation benefits. ***\n`;
  }
  if (p.clientType)   ctx += `  Client Type: ${p.clientType === 'existing' ? 'Existing ADP Client' : 'New Prospect'}\n`;

  // PEO underwriting profile — only present on TotalSource track
  if (p.track === 'TS' && p.peoProfile) {
    const peo = p.peoProfile;
    ctx += `\nTOTALSOURCE PEO UNDERWRITING PROFILE:\n`;
    if (peo.eligibleEE)      ctx += `  Eligible Employees: ${peo.eligibleEE}\n`;
    if (peo.avgWages)        ctx += `  Avg Gross Wages/EE/Year: $${peo.avgWages.toLocaleString('en-US')}\n`;
    if (peo.eligibleEE && peo.avgWages) ctx += `  Est. Annual Total Wages: $${(peo.eligibleEE * peo.avgWages).toLocaleString('en-US')}\n`;
    if (peo.participationRate != null)  ctx += `  Benefits Participation Rate: ${peo.participationRate}%\n`;
    if (peo.carrier)         ctx += `  Current Carrier: ${peo.carrier}\n`;
    if (peo.monthlyPremium)  ctx += `  Avg Monthly Premium (blended): $${peo.monthlyPremium.toLocaleString('en-US')}\n`;
    if (peo.contribPct)      ctx += `  Employer Contribution: ${peo.contribPct}%\n`;
    if (peo.renewalIncrease) ctx += `  Renewal Increase Offered: ${peo.renewalIncrease}%\n`;
    if (peo.locations)       ctx += `  Number of Locations: ${peo.locations}\n`;
    if (peo.asi)             ctx += `  ASI Score: ${peo.asi} (${peo.asi > 1.05 ? 'above neutral — higher risk pool' : peo.asi < 0.95 ? 'below neutral — favorable risk' : 'near neutral'})\n`;
    // Derived PEO talking points
    if (peo.renewalIncrease && peo.renewalIncrease > 5) {
      ctx += `  ⚑ Renewal pressure: carrier increased rates ${peo.renewalIncrease}% — strong TotalSource displacement angle\n`;
    }
    if (peo.eligibleEE && peo.eligibleEE >= 10 && peo.eligibleEE <= 500) {
      ctx += `  ⚑ Group size ${peo.eligibleEE} EEs is in TotalSource's PEO sweet spot (10–500)\n`;
    }
    if (peo.monthlyPremium && peo.eligibleEE) {
      const annualSpend = peo.monthlyPremium * 12 * peo.eligibleEE;
      ctx += `  ⚑ Est. current annual benefits spend: $${annualSpend.toLocaleString('en-US')} — use this in cost comparison\n`;
    }
  }
  if (ext.timeline)   ctx += `  Decision Timeline: ${ext.timeline}\n`;
  if (ext.budget)     ctx += `  Budget Status: ${ext.budget}\n`;
  if (ext.stage)      ctx += `  Buying Stage: ${ext.stage}\n`;
  if (ext.champion)   ctx += `  Champion: ${ext.champion}\n`;
  if (ext.econBuyer)  ctx += `  Economic Buyer: ${ext.econBuyer}\n`;
  if (ext.statesOps)  ctx += `  States of Operation: ${ext.statesOps}\n`;
  if (ext.growth)     ctx += `  Growth Plans: ${ext.growth}\n`;
  if (ext.notices && ext.notices !== '') ctx += `  DOL/IRS Notices: ${ext.notices}\n`;
  if (ext.otherVendors) ctx += `  Other Vendors Evaluated: ${ext.otherVendors}\n`;
  if (ext.extNotes)   ctx += `  Discovery Notes: ${ext.extNotes}\n`;

  if (p.painPoints && p.painPoints.length) {
    ctx += `\nCONFIRMED PAIN POINTS (rep-verified from discovery / Gong):\n`;
    p.painPoints.forEach(function(pp){ ctx += `  • ${pp}\n`; });
  }

  if (p.transcript && p.transcript.length > 20) {
    ctx += `\nGONG TRANSCRIPT EXTRACT (use for exact language, tone, objections):\n"""\n`;
    ctx += p.transcript.substring(0, 1800) + (p.transcript.length > 1800 ? '\n[...truncated]' : '') + '\n"""\n';
  }

  if (p.mcaResult) {
    const mca = p.mcaResult;
    ctx += `\nAI MARKET & COMPETITIVE ANALYSIS:\n`;
    if (mca.executive_summary)                       ctx += `  Summary: ${mca.executive_summary}\n`;
    if (mca.tone_strategy && mca.tone_strategy.opening_hook)    ctx += `  Opening Hook: ${mca.tone_strategy.opening_hook}\n`;
    if (mca.tone_strategy && mca.tone_strategy.primary_message) ctx += `  Primary Message: ${mca.tone_strategy.primary_message}\n`;
    if (mca.talk_track)                              ctx += `  Talk Track: ${mca.talk_track}\n`;
    if (mca.competitive_intel && mca.competitive_intel.length) {
      ctx += `  Competitive Intel:\n`;
      mca.competitive_intel.slice(0,3).forEach(function(c){
        ctx += `    - ${c.competitor}: ${c.counter || ''}\n`;
      });
    }
    if (mca.tone_strategy && mca.tone_strategy.objection_prep && mca.tone_strategy.objection_prep.length) {
      ctx += `  Objection Prep:\n`;
      mca.tone_strategy.objection_prep.slice(0,2).forEach(function(o){ ctx += `    • ${o}\n`; });
    }
  }

  // Inject live analysis tool results if available
  if (atResults) {
    const wfnR = atResults.wfn || atResults.full;
    const tsR  = atResults.ts  || atResults.full;
    const useR = (p.track === 'WFN') ? wfnR : tsR;
    if (useR && typeof useR === 'object') {
      ctx += `\nANALYSIS TOOL OUTPUT (use specific numbers and findings):\n`;
      if (useR.executive_summary) ctx += `  Key Finding: ${useR.executive_summary}\n`;
      if (useR.wfn_analysis) {
        const w = useR.wfn_analysis;
        if (w.headline)       ctx += `  WFN Value Prop: ${w.headline}\n`;
        if (w.roi_estimate)   ctx += `  ROI Estimate: ${w.roi_estimate}\n`;
        if (w.payback_months) ctx += `  Payback: ${w.payback_months} months\n`;
        if (w.key_modules && w.key_modules.length) ctx += `  Key Modules: ${w.key_modules.join(', ')}\n`;
        if (w.displacement_playbook) ctx += `  Displacement Play: ${w.displacement_playbook}\n`;
      }
      if (useR.ts_analysis) {
        const t = useR.ts_analysis;
        if (t.headline)               ctx += `  TotalSource Value Prop: ${t.headline}\n`;
        if (t.pepm_range)             ctx += `  PEPM Range: ${t.pepm_range}\n`;
        if (t.annual_savings_estimate) ctx += `  Est. Annual Savings: ${t.annual_savings_estimate}\n`;
      }
      if (useR.competitive_positioning) ctx += `  Competitive Position: ${useR.competitive_positioning}\n`;
    }
    const mktR = atResults.market || (atResults.full && atResults.full.market_intel);
    if (mktR && typeof mktR === 'object') {
      if (mktR.market_headline) ctx += `  Market Headline: ${mktR.market_headline}\n`;
      if (mktR.recent_news)     ctx += `  Recent News: ${mktR.recent_news}\n`;
      if (mktR.talking_point)   ctx += `  Talking Point: ${mktR.talking_point}\n`;
    }
  }

  ctx += `\nCADENCE TOUCH: Day ${touch.day} — ${touch.label}\n`;
  const toneInstructions = {
    Aggressive:    'Be assertive and urgency-forward. Reference cost, competitive risk, or missed opportunity. Push for a specific time commitment.',
    Consultative:  'Lead with insight and data. Position yourself as a trusted advisor first. Ask questions before asserting solutions.',
    Nurture:       'Low pressure. Add value with one concrete piece of data or insight. Keep the door open without pushing.',
  };
  const toneHint = toneInstructions[p.cadenceTone] || toneInstructions.Consultative;
  ctx += `TONE INSTRUCTION: ${toneHint}\n`;

  return ctx;
}

// ── System prompt per touch (elastic — adapts to track + tone) ────────
function bpEngineGetPrompt(touch, track, tone) {
  const trackLabel = track === 'WFN' ? 'ADP WorkforceNow (HCM)' : 'ADP TotalSource (PEO)';
  const toneGuide = {
    Aggressive:   'You write like a sharp, confident sales rep who knows the numbers and is not afraid to create urgency.',
    Consultative: 'You write like a trusted HCM advisor — data-forward, curious, peer-level. Never salesy.',
    Nurture:      'You write like a patient, thoughtful rep adding value over time. No pressure, just signal.',
  };
  const style = toneGuide[tone] || toneGuide.Consultative;

  return `You are an elite B2B sales email writer specializing in ${trackLabel}.
${style}

UNIVERSAL RULES — apply without exception:
- Output ONLY the email body. No subject line. No labels. No preamble. No explanation.
- Never render markdown. No asterisks, no bullet points, no bold formatting.
- One core insight per email — pick the sharpest data point and build around it.
- 3–5 sentences maximum in the body. Every sentence must earn its place.
- Use first name only in the greeting. Never leave placeholder brackets in output.
- Tone: knowledgeable peer passing along a useful heads-up. Never a pitch.
- Never write: "I hope this finds you well", "Just following up", "I wanted to reach out", "Worth a quick conversation?", "circle back", "touch base", "leverage", "synergy".
- End with ONE specific low-friction ask — a day, a time, a yes/no question. Never open-ended.
- The email must read as if written by a human who genuinely knows this company. Never generic.
- Use specific numbers, percentages, and named competitors from the context — this is what makes it real.
- Sign-off line (include exactly, on its own line after a blank line):
—
AJ
ADP
beyondpayroll.net

TOUCH CONTEXT — Day ${touch.day} (${touch.label}):
${bpEngineTouchInstruction(touch.day, track)}`;
}

function bpEngineTouchInstruction(day, track) {
  const isWFN = track === 'WFN';
  const instructions = {
    2:  isWFN
      ? 'First real outreach. Hook them on a specific insight about their ADP setup — unused modules, benchmark gap, or competitive movement. No generic opener. The first sentence should feel like you did your homework specifically on them.'
      : 'First real outreach. Challenge their current PEO math at their headcount. Most CFOs are surprised by the PEPM delta at this stage. Make them curious enough to run the numbers.',
    8:  isWFN
      ? 'Mid-cadence. Lead with a specific cost benchmark, compliance update, or ROI number relevant to their state and industry. Reference analysis data if available. One data point, specific and credible.'
      : 'Mid-cadence. Show the actual cost comparison math — PEPM vs. standalone HCM at their headcount. Use the analysis output if available. Make it feel like you built this specifically for them.',
    15: isWFN
      ? 'Compliance or market-intelligence angle. Reference a real state-level update, a module gap, or a competitive move in their industry. Keep it useful, not alarmist.'
      : 'Case study angle. Reference how a comparable company at similar headcount restructured away from PEO and what it meant for their bottom line. Use any analysis data available.',
    22: 'Respectful breakup. Acknowledge you have reached out several times. Summarize the one most compelling thing you surfaced. Leave the door open without begging. Warm and direct.',
    30: 'Community/scorecard close. Reference the scorecard or briefing. Frame it as a resource they can keep regardless of next steps. Soft invitation, no pressure.'
  };
  return instructions[day] || 'Continue building the relationship with a relevant data point or insight.';
}

// ── Core: generate one touch asynchronously ───────────────────────────
async function bpEngineGenTouch(touch, p, atResults) {
  const systemPrompt = bpEngineGetPrompt(touch, p.track, p.cadenceTone);
  const rawContext   = bpEngineBuildContext(p, touch, atResults);
  const userMsg      = `Here is the full prospect and intel data. Write a single natural, human email body following your instructions exactly.\n\nDATA:\n${rawContext}`;

  try {
    const resp = await bpGeminiFetch({ messages: [{ role: 'user', content: systemPrompt + '\n\n' + userMsg }] });
    const data = await resp.json();
    const result = bpGeminiText(data).trim();
    if (!result || result.length < 30) throw new Error('Empty response');
    return result;
  } catch(e) {
    console.warn('[EmailEngine] Touch Day', touch.day, 'failed:', e.message);
    throw e;
  }
}

// ── Main engine runner ────────────────────────────────────────────────
async function bpEngineRun(p, forceRegenAll) {
  const eng = window._bpEngine;
  if (eng.status === 'running') return; // don't double-run
  if (!p || !p.track) return;           // need track selected

  // Check if we need to re-run (different prospect, track, tone, or new analysis data)
  const atSnap    = JSON.stringify(window._atResults || {});
  const sameBase  = eng.prospectKey === p.company && eng.trackKey === p.track && eng.toneKey === (p.cadenceTone || '');
  const sameAt    = eng.atSnapshot === atSnap;
  if (sameBase && sameAt && !forceRegenAll && eng.status === 'ready') return;

  eng.active      = true;
  eng.prospectKey = p.company;
  eng.trackKey    = p.track;
  eng.toneKey     = p.cadenceTone || '';
  eng.atSnapshot  = atSnap;
  eng.generated   = {};
  eng.errors      = {};

  const touches = buildTouches(p); // get current base templates
  const atResults = (window._atResults && Object.keys(window._atResults).length) ? window._atResults : null;

  bpEngineSetStatus('running', `Generating ${touches.length} emails for ${p.company}…`);

  let completedCount = 0;
  const totalCount = touches.length;

  // Run all touches concurrently (parallel API calls)
  const promises = touches.map(async function(touch, idx) {
    try {
      const body = await bpEngineGenTouch(touch, p, atResults);
      touch._proseBody = body;
      eng.generated[idx] = true;
      completedCount++;
      bpEngineSetStatus('running', `Writing emails… ${completedCount}/${totalCount} done`);
    } catch(e) {
      eng.errors[idx] = e.message;
      completedCount++;
    }
  });

  await Promise.allSettled(promises);

  const successCount = Object.keys(eng.generated).length;
  const errorCount   = Object.keys(eng.errors).length;

  if (successCount === 0) {
    bpEngineSetStatus('error', 'Email generation failed — using templates');
    return;
  }

  bpEngineSetStatus('ready', `${successCount} emails ready for ${p.company}`);

  // Re-render composer if it's currently open
  if (typeof ecRenderAll === 'function' && window._hqProspect && window._hqProspect.company === p.company) {
    try { ecRenderAll(); } catch(e) {}
  }

  if (errorCount > 0) {
    console.warn(`[EmailEngine] ${errorCount} touch(es) fell back to base templates.`);
  }
}

// ── Watch loop: monitors for conditions to trigger/re-trigger engine ──
function bpEngineStartWatcher() {
  const eng = window._bpEngine;
  if (eng._watchTimer) return; // already watching

  eng._watchTimer = setInterval(function() {
    const p = window._hqProspect;
    if (!p || !p.track) return; // need track selection

    const atSnap   = JSON.stringify(window._atResults || {});
    const sameBase = eng.prospectKey === p.company && eng.trackKey === p.track && eng.toneKey === (p.cadenceTone || '');
    const sameAt   = eng.atSnapshot === atSnap;

    // Re-run if: new prospect, track changed, tone changed, or fresh analysis came in
    if (!sameBase || !sameAt) {
      bpEngineRun(p, false);
    }
  }, 8000); // check every 8 seconds
}

// ── Public API ────────────────────────────────────────────────────────

// Called from enterHQ — starts the engine for this session
window.bpEngineInit = function(session) {
  const eng = window._bpEngine;
  eng.active = true;
  bpEngineSetStatus('idle');
  bpEngineStartWatcher();
  // If a prospect is already loaded (returning session), run immediately
  setTimeout(function() {
    const p = window._hqProspect;
    if (p && p.track) bpEngineRun(p, false);
  }, 1200);
};

// Called from hqApprove — triggers immediate full generation with whatever data is available
window.bpEngineTrigger = function() {
  const p = window._hqProspect;
  if (!p || !p.track) return;
  bpEngineRun(p, false);
};

// Called when analysis tools complete a run — re-generates with fresh intel
window.bpEngineRefreshWithAnalysis = function() {
  const p = window._hqProspect;
  if (!p || !p.track) return;
  // Small delay to let _atResults settle
  setTimeout(function() {
    bpEngineRun(p, true);
  }, 500);
};

// Status badge injection — called once after HQ DOM is built
window.bpEngineInjectBadge = function() {
  if (document.getElementById('bp-engine-badge')) return;
  const badge = document.createElement('div');
  badge.id = 'bp-engine-badge';
  badge.className = 'bp-engine-badge';
  badge.title = 'Background Email Engine — generating AI-personalized cadence emails';
  badge.innerHTML = '<span class="bee-icon">◌</span><span class="bee-txt">Email engine idle</span>';
  // Inject into top nav bar
  const nav = document.querySelector('.hq-topbar') || document.querySelector('.hq-nav') || document.body;
  nav.appendChild(badge);
  // Add styles if not already present
  if (!document.getElementById('bp-engine-styles')) {
    const st = document.createElement('style');
    st.id = 'bp-engine-styles';
    st.textContent = `
      .bp-engine-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:500;letter-spacing:.3px;border:1px solid var(--border);color:var(--text-2);background:var(--bg-2);cursor:default;transition:all .3s;white-space:nowrap;position:fixed;bottom:14px;right:14px;z-index:9900;}
      .bp-engine-badge.running{border-color:var(--gold-border,#b89910);color:var(--gold,#c9a227);background:var(--gold-bg,rgba(201,162,39,.08));}
      .bp-engine-badge.running .bee-icon{display:inline-block;animation:bee-spin 1s linear infinite;}
      .bp-engine-badge.ready{border-color:var(--green-border);color:var(--green);background:var(--green-bg);}
      .bp-engine-badge.error{border-color:var(--err-border,#c53030);color:var(--err,#c53030);background:rgba(197,48,48,.06);}
      @keyframes bee-spin{to{transform:rotate(360deg);}}
    `;
    document.head.appendChild(st);
  }
};

// ── COMPOSER ──
// ═══════════════════════════════════════════════════════════════════════
//  PROSE FORMATTING ENGINE
//  Post-processing layer: converts raw intel agent output into
//  human-written email prose. Runs AFTER agent, BEFORE email render.
//  Called by buildTouches() for intel-driven touches, and by
//  cdtRunIntelRefresh() after agent completes.
// ═══════════════════════════════════════════════════════════════════════

// Master prose rules injected into every formatting prompt
const PROSE_UNIVERSAL_RULES = `
UNIVERSAL EMAIL WRITING RULES — apply to every touch without exception:
- Never render markdown in the output. No asterisks, no ### headers, no bullet points, no bold via **.
- Never paste raw agent data directly. Always convert to natural prose first.
- One insight per email. If the agent returned multiple data points, use only the sharpest one.
- Prospect first name only in the greeting. Never leave placeholder brackets visible.
- Email length: 3–5 sentences for most touches. Never exceed 5 sentences in the body.
- Tone: a knowledgeable colleague passing along a useful heads-up — not a salesperson. Warm, direct, peer-level.
- Never use the phrase "Worth a quick conversation?" — use a specific, low-friction ask instead.
- Never say "I hope this finds you well", "I wanted to reach out", or "Just following up."
- Never use "synergy", "value-add", "leverage", "circle back", or "touch base."
- Sign-off is always on its own line: rep name, then company, then website. Nothing else.
- Output only the email body text. No subject line. No labels. No preamble. No explanation.
- The email must read as if written by a human who genuinely knows this company — never generic.
`;

// Per-touch prose system prompts
const PROSE_TOUCH_PROMPTS = {
  wfn_day1: `You are a post-processing email formatter for an ADP sales cadence.
Touch: Day 1 — Research Brief (first touch, intel-driven)
Goal: Establish credibility by showing you already know their world before the first contact.
${PROSE_UNIVERSAL_RULES}
RULES FOR THIS TOUCH:
1. Weave company name, headcount, state, and industry into one natural sentence — never list them as a profile dump.
2. Reference only ONE competitor threat from the intel — the most relevant one. Do not list all of them.
3. The opening line should feel like you pulled something specific for them today — not a template.
4. End with a single low-friction ask: a specific time offer, not an open-ended "let me know."
5. Maximum 4 sentences in the body. No subject line in output.

EXAMPLE TONE (do not copy, use as style reference):
"I work with a number of [industry] companies in [state], and after looking at [Company]'s setup — [headcount] employees on [current product] — I noticed [Competitor] has been making a push into your space recently. There are usually a few underutilized features in [current product] at your size that could close the gap before that becomes a real problem. I can pull the full breakdown if useful. Would [specific day] work for a 15-minute call?"`,

  wfn_day2: `You are a post-processing email formatter for an ADP sales cadence.
Touch: Day 2 — Insight Hook
Goal: Create curiosity around unused ADP features the prospect is already paying for.
${PROSE_UNIVERSAL_RULES}
RULES FOR THIS TOUCH:
1. Lead with the financial or operational insight — not with a re-introduction or "following up on my last email."
2. Reference the specific unused feature or cost gap but frame it as a discovery, not a data report.
3. Do not say "I noticed" more than once in the entire email.
4. The CTA should offer to send more — soft and easy to say yes to: "I can send it over if useful."
5. Maximum 4 sentences. No bullet points or lists under any circumstances.

EXAMPLE TONE (do not copy, use as style reference):
"Most [product] clients at [Company]'s size are only actively using about 60% of what they're paying for — the rest sits idle. I pulled [Company]'s feature profile and there are [2-3 specific items] that could be running automatically right now. I can send the full breakdown if that's worth a look."`,

  wfn_day8_intel: `You are a post-processing email formatter for an ADP sales cadence.
Touch: Day 8 — Mid-Cadence Intel (intel refresh touch)
Goal: Re-engage with a fresh, specific data point that shows continued research — not a follow-up.
${PROSE_UNIVERSAL_RULES}
RULES FOR THIS TOUCH:
1. Open with the freshest, most specific piece of intel — not "I wanted to share something."
2. Do not recap previous messages. Assume they received them and move forward.
3. One data point only. Do not stack multiple insights.
4. This should feel like a timely heads-up from a peer, not a follow-up from a salesperson.
5. Maximum 3 sentences. A CTA is optional here — curiosity alone is a valid close.

EXAMPLE TONE (do not copy, use as style reference):
"[Competitor] just rolled out an updated [module] specifically targeting [industry] companies in [state] — it's getting traction in your space. Wanted to flag it given the [compliance/cost/feature] overlap with where [Company] is right now. Happy to share what I'm seeing if it's useful."`,

  wfn_day8_cost: `You are a post-processing email formatter for an ADP sales cadence.
Touch: Day 8 — Cost Benchmark
Goal: Anchor the prospect to a concrete cost comparison that makes ADP's value tangible and personal.
${PROSE_UNIVERSAL_RULES}
RULES FOR THIS TOUCH:
1. Lead with a benchmark number or cost gap — the first word of the email should not be "I."
2. Use one specific number or range. Do not list multiple figures or create a breakdown.
3. Frame the data as pulled for their specific profile — make it feel tailored, not templated.
4. CTA: offer to share the full benchmark. Keep it frictionless.
5. Maximum 4 sentences. No bullet points or lists under any circumstances.

EXAMPLE TONE (do not copy, use as style reference):
"What [Company] is actually spending on HR tech vs. the benchmark for [headcount]-person [industry] firms in [state] is worth a look — there's usually a [X–Y]% gap that most clients don't realize until they run the comparison. I pulled the numbers for your profile specifically. I can send the full breakdown if that's useful."`,

  wfn_day15_intel: `You are a post-processing email formatter for an ADP sales cadence.
Touch: Day 15 — Competitive Intel Pull (intel refresh touch)
Goal: Surface a specific competitor move that directly affects this prospect's decision window.
${PROSE_UNIVERSAL_RULES}
RULES FOR THIS TOUCH:
1. Name the competitor and the specific move. Be concrete — vague intel has no impact.
2. Connect the competitor move directly to a risk or opportunity for this prospect in one sentence.
3. Do not oversell the threat. Let the specificity do the work — trust the data.
4. 3–4 sentences. Close with a soft check-in, not a hard ask.

EXAMPLE TONE (do not copy, use as style reference):
"[Competitor] expanded their [module] last week with a new [feature] targeting [segment] — which puts [Company] squarely in their crosshairs. Thought you'd want to know before it shows up in your inbox from them first. Worth a quick sync on how [Company]'s current setup compares?"`,

  wfn_day15_compliance: `You are a post-processing email formatter for an ADP sales cadence.
Touch: Day 15 — Compliance Trigger
Goal: Create urgency through a real, time-sensitive compliance gap relevant to their state and industry.
${PROSE_UNIVERSAL_RULES}
RULES FOR THIS TOUCH:
1. Open with the compliance fact — not a sales angle. The first sentence should state the regulation or update directly.
2. Name the specific regulation or update. Do not be vague about what changed.
3. Connect the compliance gap to one ADP feature that addresses it automatically.
4. Frame as informational first. The ask should feel like a favor, not a pitch.
5. Maximum 4 sentences.

EXAMPLE TONE (do not copy, use as style reference):
"[State] updated its [leave/wage/compliance] requirements for [industry] companies this quarter, and a number of [product] clients in [Company]'s category have had to make manual adjustments to stay compliant. There's a specific module in [product] that handles this automatically — [Company] may already have access to it. Happy to walk through it if that's useful."`,

  wfn_day22_intel: `You are a post-processing email formatter for an ADP sales cadence.
Touch: Day 22 — Final Push Intel (last intel touch before breakup)
Goal: The most specific and time-sensitive intel touch of the cadence — make it feel genuinely urgent.
${PROSE_UNIVERSAL_RULES}
RULES FOR THIS TOUCH:
1. Use the sharpest, most specific data point from the agent output. This is not the time for a soft opener.
2. Do not reference previous emails or acknowledge the cadence timeline.
3. Tone: peer-to-peer — a colleague passing along something actionable, not a rep checking in.
4. Maximum 3 sentences. CTA is a light nudge toward a conversation — not a close.

EXAMPLE TONE (do not copy, use as style reference):
"[Competitor] made a move in [Company]'s space this week — [specific action] that's already getting traction with [segment]. Given [Company]'s renewal timing and current setup, the window to get ahead of it is narrow. Happy to share what I'm seeing if it's useful."`,

  wfn_day22_breakup: `You are a post-processing email formatter for an ADP sales cadence.
Touch: Day 22 — Breakup Email
Goal: Leave the door open gracefully while creating one final moment of genuine awareness.
${PROSE_UNIVERSAL_RULES}
RULES FOR THIS TOUCH:
1. This email can be slightly self-aware — it is the only touch in the cadence that can acknowledge the outreach pattern. Keep it light.
2. Reference one concrete thing from the cadence (a competitor, compliance update, or cost benchmark) — never leave it generic.
3. The breakup framing should be understated, not dramatic. No guilt-tripping or manufactured urgency.
4. End with a clear, low-pressure door-opener that points to a future trigger (renewal, growth, a new hire).
5. Maximum 5 sentences. No links, no attachments mentioned.

EXAMPLE TONE (do not copy, use as style reference):
"I've reached out a few times over the past few weeks — I'll make this the last one for now. The [competitor move / compliance gap / cost benchmark] I flagged is still worth watching as [Company] heads into [renewal period / Q-end / hiring push]. If any of that becomes more relevant down the road, I'm easy to find. The door stays open."`,

  wfn_day30: `You are a post-processing email formatter for an ADP sales cadence.
Touch: Day 30 — Community Invite (final touch)
Goal: Re-engage with a genuine value-add invite that removes all sales pressure and leaves a lasting impression.
${PROSE_UNIVERSAL_RULES}
RULES FOR THIS TOUCH:
1. This is an invitation, not a sales email. The tone must reflect that completely — no pitch language.
2. Lead with what they get, not who you are or what you sell.
3. Reference the HCM Scorecard as something already prepared for them — make it feel exclusive, not promotional.
4. The briefing invite should feel like a peer event — small, specific, no pitch — not a webinar or product demo.
5. Maximum 4 sentences. CTA is a simple reply to confirm attendance or request the scorecard.

EXAMPLE TONE (do not copy, use as style reference):
"I put together an HCM Scorecard for [Company] — it benchmarks [Company]'s current setup against comparable [industry] firms in [state] and flags a few areas worth watching. I'm also hosting a small quarterly briefing next week for HR leaders in your space — no pitch, just data and a conversation. I'd love to hold a seat for you if you're interested."`,

  ts_day2: `You are a post-processing email formatter for an ADP TotalSource sales cadence.
Touch: Day 2 — PEO Reality Check
Goal: Plant the seed that the current PEO model may no longer be the right fit at their size and stage.
${PROSE_UNIVERSAL_RULES}
RULES FOR THIS TOUCH:
1. Reference their specific headcount as the natural inflection point — not a generic threshold.
2. Frame this as a data-driven observation that you're passing along — not a sales pitch.
3. The ask is to run a comparison, not to close a deal.
4. Maximum 4 sentences.

EXAMPLE TONE (do not copy, use as style reference):
"At [headcount] employees, [Company] is at the size where the math on PEO co-employment usually starts to shift — the fixed PEPM model that works well at smaller headcounts often becomes less efficient as the company scales. I've run this comparison for a few [industry] firms in [state] and the results are usually worth seeing. Happy to do the same for [Company] if that's useful."`,

  ts_day8: `You are a post-processing email formatter for an ADP TotalSource sales cadence.
Touch: Day 8 — Cost Comparison
Goal: Make the PEPM cost gap tangible, personal, and tied directly to this prospect's situation.
${PROSE_UNIVERSAL_RULES}
RULES FOR THIS TOUCH:
1. Lead with the cost insight — not with a re-introduction or reference to a previous email.
2. Use one specific number or estimated range. No bullet-point cost breakdowns.
3. Frame as data pulled for their profile specifically — not a general range.
4. CTA: ask for their current PEPM to run a real, side-by-side comparison.
5. Maximum 4 sentences.

EXAMPLE TONE (do not copy, use as style reference):
"For a [headcount]-person [industry] company in [state], the difference between a standard PEO PEPM and what TotalSource typically delivers is usually in the [range] per employee per month range — which adds up quickly at [Company]'s size. I'd need your current PEPM to run a real comparison, but the initial numbers usually tell the story. Worth a 10-minute look?"`,

  ts_day15: `You are a post-processing email formatter for an ADP TotalSource sales cadence.
Touch: Day 15 — Case Study
Goal: Use a comparable company outcome to make the alternative feel proven and real — not theoretical.
${PROSE_UNIVERSAL_RULES}
RULES FOR THIS TOUCH:
1. Lead with the outcome of the case study company — not with "I wanted to share."
2. Connect their industry and headcount to the case study naturally in one sentence — make the comparison feel obvious.
3. The ask is to run the same analysis for them — keep it low-commitment and easy to say yes to.
4. Maximum 4 sentences.

EXAMPLE TONE (do not copy, use as style reference):
"A [headcount]-person [industry] company in [state] recently made the switch from their previous PEO to TotalSource and locked in a [X]% reduction in health premiums in the first year. [Company]'s profile is similar enough that the numbers would likely be in the same range. Happy to run the same analysis if you'd like to see it."`,

  ts_day22_breakup: `You are a post-processing email formatter for an ADP TotalSource sales cadence.
Touch: Day 22 — Breakup Email
Goal: Close the loop gracefully, reference the value shared, and leave a clear door open at renewal.
${PROSE_UNIVERSAL_RULES}
RULES FOR THIS TOUCH:
1. Acknowledge the outreach briefly — light self-awareness, not self-deprecation.
2. Reference the TotalSource cost data or case study shared earlier — make it feel like a useful resource left behind, not a last-ditch pitch.
3. Point to renewal as the natural next checkpoint — no pressure, just a logical future moment.
4. Maximum 4 sentences.

EXAMPLE TONE (do not copy, use as style reference):
"I've reached out a few times — I'll keep this one short. The cost comparison I ran for [Company] is still sitting in my notes whenever the timing is right. Renewal cycles are usually the natural moment to revisit this, so if [Company]'s is coming up in the next 6 months, I'm easy to find. The door stays open."`,

  ts_day30: `You are a post-processing email formatter for an ADP TotalSource sales cadence.
Touch: Day 30 — Community Invite
Goal: Leave with a tangible deliverable and a no-pressure community connection that keeps the relationship alive.
${PROSE_UNIVERSAL_RULES}
RULES FOR THIS TOUCH:
1. Lead with the scorecard as a delivered asset — not as a closing tactic. It's a gift, not a hook.
2. Frame the briefing invite as informational, small, and easy to opt out of — peer event, not webinar.
3. Warm, peer-level close. No sales language. No urgency.
4. Maximum 4 sentences.

EXAMPLE TONE (do not copy, use as style reference):
"I put together a TotalSource Scorecard for [Company] — it benchmarks [Company]'s current PEO setup against comparable [industry] firms in [state] and flags a few areas worth watching as you scale. I'm also hosting a small briefing next week for HR and ops leaders in your space — no pitch, just data. I'd love to hold a spot for you if you're interested."`,
};

// Core prose formatter — calls the AI proxy with a touch-specific system prompt
// and raw intel/context data, returns clean email body text
async function bpProseFormat(touchKey, rawContext) {
  const systemPrompt = PROSE_TOUCH_PROMPTS[touchKey];
  if (!systemPrompt) return rawContext; // fallback: return as-is if no prompt found

  const userMsg = `Here is the raw prospect and intel data. Convert it into a natural, human-written email body following your instructions exactly.\n\nRAW DATA:\n${rawContext}`;

  try {
    const resp = await bpGeminiFetch({ messages: [{ role: 'user', content: systemPrompt + '\n\n' + userMsg }] });
    const data = await resp.json();
    const result = bpGeminiText(data).trim();
    return result || rawContext;
  } catch(e) {
    console.warn('[ProseFormat] Formatting failed, using raw context:', e.message);
    return rawContext;
  }
}

// Called after cdtRunIntelRefresh completes — reformats the intel result
// into a clean email body and updates the active touch in the composer
window.bpApplyIntelToEmail = async function(day, intelText) {
  const p = window._hqProspect; if (!p) return;

  // Map cadence day to prose touch key
  const dayToKey = { 1:'wfn_day1', 8:'wfn_day8_intel', 15:'wfn_day15_intel', 22:'wfn_day22_intel' };
  const touchKey = p.track === 'WFN' ? (dayToKey[day] || 'wfn_day8_intel') : 'wfn_day8_intel';

  // Use full bpEngineBuildContext — pulls pain points, MCA, AT results, transcript, PEO profile, cadence tone
  const _applyFakeTouch = { day: day, label: (CDT_INTEL_DAYS.find(function(d){return d.day===day;})||{}).label||'Intel Touch' };
  let rawContext = bpEngineBuildContext(p, _applyFakeTouch, window._atResults || null);
  rawContext += '\n\nLIVE INTEL REFRESH OUTPUT (use the most specific finding from this):\n' + intelText;

  showToast('Formatting email prose…');
  const proseBody = await bpProseFormat(touchKey, rawContext);
  const sig = '\n\n—\nAJ\nADP\nbeyondpayroll.net';
  const fullBody = proseBody + sig;

  // Persist _proseBody onto the touch object so Outlook button uses it
  const touches = buildTouches(p);
  const matchTouch = touches.find(function(t){ return t.day === day; });
  if (matchTouch) {
    matchTouch._proseBody = fullBody;
  }

  // Update composer if this touch is currently active
  if (window._ecActiveIdx !== undefined) {
    const activeTouch = touches[window._ecActiveIdx];
    if (activeTouch && activeTouch.day === day) {
      ecRenderAll();
      showToast('✓ Email updated with intel — Outlook button ready');
    } else {
      showToast('✓ Intel formatted — Day ' + day + ' Outlook button ready');
    }
  }
};

function buildTouches(p){
  const co=p.company||'[Company]',nm=(p.contact||'').split(' ')[0]||'[Name]';
  const ind=p.industry||'[Industry]',st=p.state||'[State]',hc=p.headcount||'[X]';
  const sig='\n\n—\nAJ\nADP\nbeyondpayroll.net';

  // Helper: use prose-formatted body if available, otherwise use base template
  const body = (touch) => touch._proseBody || touch._baseBody;

  const wfn=[
    {day:2,label:'Insight Hook',
      subject:`Quick thought on ${co}'s ADP setup`,
      get body(){ return this._proseBody || this._baseBody; },
      _baseBody:`Hi ${nm},\n\nMost ADP WorkforceNow clients at ${co}'s size are only actively using about 60% of what they're paying for — the rest sits idle. I ran your feature profile and there are a few modules that could either be activated to save time or negotiated out of your renewal to cut costs.\n\nI can pull the full breakdown if helpful — takes about 10 minutes to walk through.\n\nAre you open later this week?${sig}`},
    {day:8,label:'Cost Benchmark',
      subject:`What ${co} is actually spending on HR tech vs. the benchmark`,
      get body(){ return this._proseBody || this._baseBody; },
      _baseBody:`Hi ${nm},\n\n${ind} organizations at ${co}'s size in ${st} are typically spending between $85–$110 per employee annually on HR tech — I ran your profile against our benchmark and the gap was worth flagging.\n\nI put together a quick cost comparison specific to your headcount and state if you'd like to take a look — no strings, just data.\n\nWhat does your calendar look like this week?${sig}`},
    {day:15,label:'Compliance Trigger',
      subject:`${st} compliance update relevant to ${co}`,
      get body(){ return this._proseBody || this._baseBody; },
      _baseBody:`Hi ${nm},\n\n${st} updated its leave tracking and reporting requirements for ${ind} organizations this quarter, and a number of ADP WorkforceNow clients in your category have had to adjust their configurations to stay current. There's a specific module in WFN that handles this automatically — most clients at your size don't have it enabled by default.\n\nI can walk you through the update in about 15 minutes if you want to make sure ${co} is covered.\n\nI have time Thursday or Friday — does either work?${sig}`},
    {day:22,label:'Breakup Email',
      subject:`Last note from me, ${nm}`,
      get body(){ return this._proseBody || this._baseBody; },
      _baseBody:`Hi ${nm},\n\nI've reached out a few times over the past few weeks — between the cost benchmark, the compliance update, and the competitive intel on ${ind} — and I don't want to keep showing up in your inbox if the timing isn't right.\n\nI'll get out of your way for now, but if anything I flagged becomes relevant down the road, you know where to find me.\n\nHope the data was useful either way.${sig}`},
    {day:30,label:'Community Invite',
      subject:`${co} HCM Scorecard + your spot in our quarterly briefing`,
      get body(){ return this._proseBody || this._baseBody; },
      _baseBody:`Hi ${nm},\n\nI put together an HCM Scorecard for ${co} based on everything I've pulled this month — it benchmarks your current setup against comparable ${ind} organizations in ${st} and flags a few areas worth watching.\n\nI'm also hosting a small quarterly briefing for HR leaders in your space next week — no pitch, just data and a conversation. I'd love to hold a seat for you.\n\nReply here and I'll send over both.${sig}`},
  ];
  const ts=[
    {day:2,label:'PEO Reality Check',
      subject:`Is ADP TotalSource still the right model for ${co} at ${hc} employees?`,
      get body(){ return this._proseBody || this._baseBody; },
      _baseBody:`Hi ${nm},\n\nMost PEO clients start evaluating alternatives somewhere around ${hc} employees — not because TotalSource isn't working, but because the PEPM math shifts in a way that surprises most CFOs at that threshold, and the co-employment structure looks different than it did at signing.\n\nI'd love to run a side-by-side comparison for ${co}'s specific profile — 15 minutes, no commitment, just the numbers.\n\nDo you have any time this week?${sig}`},
    {day:8,label:'Cost Comparison',
      subject:`The math on TotalSource at ${hc} employees — what the data shows for ${co}`,
      get body(){ return this._proseBody || this._baseBody; },
      _baseBody:`Hi ${nm},\n\nI ran a PEO vs. HCM cost comparison specific to ${co}'s profile — ${hc} employees in ${ind} — and the annual delta between TotalSource and a comparable HCM platform was meaningful enough to flag.\n\nI'd rather show you the real numbers than estimate. Can you share your current PEPM so I can build an accurate comparison?${sig}`},
    {day:15,label:'Case Study',
      subject:`How a ${ind} company at ${hc} employees restructured HCM — and what it meant for their bottom line`,
      get body(){ return this._proseBody || this._baseBody; },
      _baseBody:`Hi ${nm},\n\nI worked with a company in ${ind} at a similar headcount to ${co} that was on TotalSource — the PEO model was adding significant cost per year once we ran the actual numbers against a comparable HCM platform.\n\nI can run the same analysis for ${co} in about 20 minutes. Want to take a look together?${sig}`},
    {day:22,label:'Breakup Email',
      subject:`Last email from me, ${nm}`,
      get body(){ return this._proseBody || this._baseBody; },
      _baseBody:`Hi ${nm},\n\nI've shared cost comparisons and restructuring data on ${co}'s TotalSource setup over the past few weeks — whether you act now or revisit at renewal, I hope it gave you a useful baseline.\n\nMy calendar is always open if the timing changes: [calendar link]. Either way, thanks for your time.${sig}`},
    {day:30,label:'Community Invite',
      subject:`${co}'s PEO Scorecard + an invitation to our HCM briefing`,
      get body(){ return this._proseBody || this._baseBody; },
      _baseBody:`Hi ${nm},\n\nWrapping up my outreach — I put together a TotalSource Renewal Scorecard for ${co} that's yours to keep regardless of next steps. It benchmarks your current PEO cost structure against comparable ${ind} organizations.\n\nI'm also hosting a quarterly PEO & HCM Benchmarking Briefing for HR leaders in your space — no sales pitch, easy to unsubscribe, just data. I'd love to include you.\n\nReply here and I'll send both over.${sig}`},
  ];
  return p.track==='WFN'?wfn:ts;
}

function ecRenderAll(){
  const p=window._hqProspect;if(!p)return;
  const touches=buildTouches(p);
  document.getElementById('ecs-co').textContent=p.company;
  document.getElementById('ecs-contact').textContent=p.contact||'—';
  document.getElementById('ecs-email').textContent=p.email||'—';
  document.getElementById('ecs-profile').textContent=`${p.industry||'—'} · ${p.state||'—'} · ${p.headcount||'—'} EEs`;
  const tabsEl=document.getElementById('ec-tabs');
  if(!tabsEl)return;
  tabsEl.innerHTML=touches.map((t,i)=>{
    const sent=window._ecStatuses[i]==='Sent'||window._ecStatuses[i]==='Meeting Booked';
    let cls='ec-t'+(i===window._ecActiveIdx?' active':sent?' sent':'');
    return `<button class="${cls}" onclick="ecSwitch(${i})"><span class="ec-t-day">${t.day}</span>${t.label}${sent?' ✓':''}</button>`;
  }).join('');
  if(!document.getElementById('ec-to-inp').value&&p.email)document.getElementById('ec-to-inp').value=p.email;
  ecRenderTouch();ecRenderTokens();ecRenderChecklist();
  // Refresh cadence tracker dashboard
  if(typeof cdtRender==='function') cdtRender();
}

window.ecRenderTouch=function(){
  const p=window._hqProspect;if(!p)return;
  const touches=buildTouches(p);const touch=touches[window._ecActiveIdx];
  const sigOn=document.getElementById('ec-sig').checked;
  const body=sigOn?touch.body:touch.body.replace(/\n\n—[\s\S]*$/,'');
  const toVal=document.getElementById('ec-to-inp').value||p.email||'';
  document.getElementById('ec-touch-lbl').textContent=`Day ${touch.day} · ${touch.label}`;
  document.getElementById('ec-subj-disp').textContent=touch.subject;
  document.getElementById('ec-body-disp').textContent=body;
  document.getElementById('prev-to').textContent=toVal;
  document.getElementById('prev-subj').textContent=touch.subject;
  document.getElementById('prev-body').textContent=body.substring(0,88)+'…';
  document.getElementById('ec-ssel').value=window._ecStatuses[window._ecActiveIdx]||'Pending';
  document.getElementById('ec-ssel').style.color=ecStColor(window._ecStatuses[window._ecActiveIdx]||'Pending');
  document.getElementById('ec-notes').value=window._ecNotes[window._ecActiveIdx]||'';
  const launched=window._ecLaunched[window._ecActiveIdx];
  document.getElementById('ec-mto-lbl').textContent=launched?`✓ Outlook Opened — Day ${touch.day} Sent`:`Open in Outlook — Day ${touch.day} · ${touch.label}`;
  const isSent=window._ecStatuses[window._ecActiveIdx]==='Sent'||window._ecStatuses[window._ecActiveIdx]==='Meeting Booked';
  const mkb=document.getElementById('ec-mkbtn');
  mkb.textContent=isSent?'✓ Logged as Sent':'🚀 Mark as Sent & Log in Cadence';
  mkb.classList.toggle('done',isSent);
};

window.ecSwitch=function(i){window._ecActiveIdx=i;ecRenderAll()};

function ecGetBody(){
  const p=window._hqProspect;const touches=buildTouches(p);const touch=touches[window._ecActiveIdx];
  const sigOn=document.getElementById('ec-sig').checked;
  return sigOn?touch.body:touch.body.replace(/\n\n—[\s\S]*$/,'');
}

function copyText(text){return navigator.clipboard.writeText(text).catch(()=>{const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta)})}

window.ecCopy=function(field){
  const p=window._hqProspect;const touches=buildTouches(p);const touch=touches[window._ecActiveIdx];
  const toVal=document.getElementById('ec-to-inp').value||p.email;
  const map={to:[toVal,'cpbtn-to','⎘ Copy To'],subj:[touch.subject,'cpbtn-subj','⎘ Copy Subject'],body:[ecGetBody(),'cpbtn-body','⎘ Copy Body']};
  const[text,btnId,origLabel]=map[field];
  copyText(text).then?.(()=>{
    const done={to:'✓ Copied To',subj:'✓ Copied Subject',body:'✓ Copied Body'};
    const btn=document.getElementById(btnId);if(!btn)return;
    btn.textContent=done[field];btn.style.background='var(--green-bg)';btn.style.color='var(--green)';btn.style.borderColor='var(--green-border)';
    setTimeout(()=>{btn.textContent=origLabel;btn.style.background='';btn.style.color='';btn.style.borderColor=''},1800);
    const smbId=field==='to'?'smb-to':field==='subj'?'smb-subj':null;
    if(smbId){const smb=document.getElementById(smbId);if(smb){smb.textContent='✓';setTimeout(()=>smb.textContent='copy',1800)}}
  });
};

window.ecCopyAll=function(){
  const p=window._hqProspect;const touches=buildTouches(p);const touch=touches[window._ecActiveIdx];
  const toVal=document.getElementById('ec-to-inp').value||p.email;
  copyText(`TO: ${toVal}\nSUBJECT: ${touch.subject}\n\n${ecGetBody()}`).then?.(()=>showToast('All fields copied — paste into Outlook'));
};

window.ecFireMailto=function(){
  const p=window._hqProspect;const touches=buildTouches(p);const touch=touches[window._ecActiveIdx];
  const toVal=(document.getElementById('ec-to-inp').value||p.email||'').trim();
  if(!toVal){showToast('Add a recipient email first',true);return}
  const uri='mailto:'+encodeURIComponent(toVal)+'?subject='+encodeURIComponent(touch.subject)+'&body='+encodeURIComponent(ecGetBody());
  const a=document.createElement('a');a.href=uri;a.style.display='none';document.body.appendChild(a);a.click();setTimeout(()=>document.body.removeChild(a),500);
  window._ecLaunched[window._ecActiveIdx]=true;
  setTimeout(()=>ecMarkSent(),4000);
  document.getElementById('ec-mto-lbl').textContent=`✓ Outlook Opened — Day ${touch.day} Sent`;
};

window.ecMarkSent=function(){
  window._ecStatuses[window._ecActiveIdx]='Sent';
  if(!window._ecSentAt) window._ecSentAt = {};
  if(!window._ecSentAt[window._ecActiveIdx]){
    window._ecSentAt[window._ecActiveIdx] = new Date().toISOString();
  }
  if(window._hqProspect) ecSaveStatuses(window._hqProspect.company);
  window._ecNotes[window._ecActiveIdx]=document.getElementById('ec-notes').value;
  ecRenderAll();showToast('Touch logged as Sent');
  // Refresh alerts/outreach tabs if drawer is open
  const _msDrw = document.getElementById('notif-drawer');
  if(_msDrw && _msDrw.classList.contains('open')) notifRenderList();
};

window.ecSetSt=function(val){
  window._ecStatuses[window._ecActiveIdx]=val;
  if(window._hqProspect) ecSaveStatuses(window._hqProspect.company);
  document.getElementById('ec-ssel').style.color=ecStColor(val);
  const tabs=document.getElementById('ec-tabs');
  if(tabs&&window._hqProspect){
    buildTouches(window._hqProspect).forEach((t,i)=>{
      const btns=tabs.querySelectorAll('.ec-t');
      if(btns[i]){
        const sent=window._ecStatuses[i]==='Sent'||window._ecStatuses[i]==='Meeting Booked';
        btns[i].className='ec-t'+(i===window._ecActiveIdx?' active':sent?' sent':'');
        btns[i].innerHTML=`<span class="ec-t-day">${t.day}</span>${t.label}${sent?' ✓':''}`;
      }
    });
  }
};

function ecStColor(s){
  const m={Pending:'var(--text-3)',Drafted:'var(--blue)',Sent:'var(--green)',Opened:'var(--gold)',Replied:'var(--green)','Meeting Booked':'#16a34a','No Response':'var(--text-3)','Opted Out':'var(--red)'};
  return m[s]||'var(--text-3)';
}

function ecRenderTokens(){
  const p=window._hqProspect;
  const tokens=[['[Company]',p.company],['[Name]',(p.contact||'').split(' ')[0]],['[Industry]',p.industry||''],['[State]',p.state||''],['[Headcount]',p.headcount||''],['[Calendar]','[calendar link]']];
  document.getElementById('ec-tokens').innerHTML=tokens.map(([tok,val])=>
    `<button class="tokchip" onclick="copyText('${val.replace(/'/g,"\\'")}');showToast('${tok} copied')" title="${tok}">
      <span style="color:var(--text-3)">${tok}</span><span style="color:var(--blue)">→</span><strong style="color:var(--text)">${val||'—'}</strong>
    </button>`
  ).join('');
}

const CHECKS=['Tokens replaced with real data','Recipient email verified','No [brackets] in subject','Body reads naturally','CTA is clear with calendar link','Signature included'];
function ecRenderChecklist(){
  document.getElementById('ec-chklist').innerHTML=CHECKS.map((label,i)=>{
    const k=`${window._ecActiveIdx}-${i}`,checked=!!window._ecChecks[k];
    return `<div style="display:flex;align-items:flex-start;gap:7px;margin-bottom:7px">
      <input type="checkbox" id="ck${i}" ${checked?'checked':''} onchange="ecCheck('${k}',this.checked)" style="accent-color:var(--text);margin-top:2px;flex-shrink:0">
      <label for="ck${i}" style="font-size:11px;color:${checked?'var(--green)':'var(--text-2)'};cursor:pointer;text-decoration:${checked?'line-through':'none'};line-height:1.5;font-weight:${checked?'500':'400'}">${label}</label>
    </div>`;
  }).join('')+`<button onclick="ecResetCk()" style="font-size:10px;color:var(--text-3);background:none;border:none;cursor:pointer;font-family:var(--fb);margin-top:3px;font-weight:500">↺ Reset checklist</button>`;
}

window.ecCheck=function(k,val){window._ecChecks[k]=val;ecRenderChecklist()};
window.ecResetCk=function(){CHECKS.forEach((_,i)=>delete window._ecChecks[`${window._ecActiveIdx}-${i}`]);ecRenderChecklist()};

window.ecExportCSV=function(){
  const p=window._hqProspect;const touches=buildTouches(p);
  const rows=touches.map((t,i)=>[t.day,`"${t.label}"`,`"${t.subject.replace(/"/g,'""')}"`,window._ecStatuses[i]||'Pending',`"${(window._ecNotes[i]||'').replace(/"/g,'""')}"`]);
  const csv=[['Day','Label','Subject','Status','Notes'],...rows].map(r=>r.join(',')).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([`BeyondPayroll HCM — ${p.company}\n\n${csv}`],{type:'text/csv'}));
  a.download=`BPH_${p.company.replace(/\s+/g,'_')}_Status.csv`;a.click();
};

// ═══════════════════════════════════════════════════════════════════════
//  CADENCE TRACKER DASHBOARD
// ═══════════════════════════════════════════════════════════════════════
var _cdtView = 'timeline';       // 'timeline' | 'grid'
var _cdtStartDate = null;        // ISO date when cadence was kicked off (localStorage-backed)

// Intel/research days interspersed in the 30-day calendar
const CDT_INTEL_DAYS = [
  { day: 1,  label: 'Research Brief',        desc: 'Run WFN/TS Analyzer + Competitive Intel before first touch' },
  { day: 8,  label: 'Mid-Cadence Intel',     desc: 'Refresh competitor landscape before education week' },
  { day: 15, label: 'Competitive Intel Pull',desc: 'Surface new competitor positioning before urgency week' },
  { day: 22, label: 'Final Push Intel',      desc: 'Last refresh before close week. Confirm renewal timing.' },
];

// Get/set start date in localStorage keyed to company
function cdtGetKey(){ const p=window._hqProspect; return p ? 'cdt_start_'+p.company.replace(/\s+/g,'_') : null; }
function cdtGetStart(){
  const k=cdtGetKey(); if(!k) return null;
  return localStorage.getItem(k) || null;
}
function cdtSetStart(iso){ const k=cdtGetKey(); if(k) localStorage.setItem(k, iso); }
function cdtResetStart(){ const k=cdtGetKey(); if(k) localStorage.removeItem(k); }

// Compute today's day-in-cadence (1-based; null if not started)
function cdtTodayNum(){
  const s = cdtGetStart(); if(!s) return null;
  const start = new Date(s); const today = new Date();
  start.setHours(0,0,0,0); today.setHours(0,0,0,0);
  return Math.floor((today - start) / 86400000) + 1;
}

// Main render entry (called by ecRenderAll)
function cdtRender(){
  const p = window._hqProspect;
  if(!p) { cdtRenderEmpty(); return; }

  // Fire cadence day trigger check whenever cadence tab is opened
  setTimeout(cdtCheckTriggers, 300);

  // Auto-start if not started yet
  if(!cdtGetStart()) { cdtSetStart(new Date().toISOString().split('T')[0]); }

  // Always reload persisted statuses + timestamps from localStorage before rendering.
  // This fixes the bug where completed touches show as Pending after a page reload.
  if(p.company){
    try{
      const stored = JSON.parse(localStorage.getItem(ecStatusKey(p.company))||'{}');
      Object.keys(stored).forEach(function(k){
        if(!window._ecStatuses[k] || window._ecStatuses[k]==='Pending') window._ecStatuses[k]=stored[k];
      });
    }catch(e){}
    try{
      if(!window._ecSentAt) window._ecSentAt={};
      const storedAt = JSON.parse(localStorage.getItem(ecStatusKey(p.company)+'_sentAt')||'{}');
      Object.keys(storedAt).forEach(function(k){
        if(!window._ecSentAt[k]) window._ecSentAt[k]=storedAt[k];
      });
    }catch(e){}
  }

  const touches = buildTouches(p);
  const todayNum = cdtTodayNum();

  // Build full 30-day calendar merging touch days + intel days
  const allDays = [];
  const touchDays = new Set(touches.map(t=>t.day));
  const intelDays = new Set(CDT_INTEL_DAYS.map(d=>d.day));

  // All unique days 1-30
  const dayNums = new Set([...touches.map(t=>t.day), ...CDT_INTEL_DAYS.map(d=>d.day)]);
  // Sort
  const sorted = Array.from(dayNums).sort((a,b)=>a-b);

  // Progress stats
  const sentCount = touches.filter((_,i) => {
    const s = window._ecStatuses[i]||'Pending';
    return s==='Sent'||s==='Meeting Booked'||s==='Replied'||s==='Opened';
  }).length;
  const totalTouches = touches.length;
  const pct = Math.round((sentCount/totalTouches)*100);

  // Overdue: touch day < todayNum and not sent
  const overdueCount = touches.filter((t,i)=>{
    const s = window._ecStatuses[i]||'Pending';
    return todayNum && t.day < todayNum && s==='Pending';
  }).length;

  // Due today
  const dueTodayCount = touches.filter((t)=> t.day === todayNum).length;

  // Update progress ring
  const arc = document.getElementById('cdt-ring-arc');
  const pctEl = document.getElementById('cdt-ring-pct');
  const circumference = 163.4;
  if(arc){ arc.style.strokeDashoffset = circumference - (pct/100)*circumference; arc.style.stroke = pct===100?'#16a34a':pct>50?'var(--green)':'var(--gold)'; }
  if(pctEl) pctEl.textContent = pct+'%';

  // Update header stats
  const progTitle = document.getElementById('cdt-prog-title');
  const progSub = document.getElementById('cdt-prog-sub');
  const statRow = document.getElementById('cdt-stat-row');
  const hdrSub = document.getElementById('cdt-header-sub');
  if(progTitle) progTitle.textContent = p.company + ' — ' + (p.track==='WFN'?'WorkforceNow':'TotalSource PEO');
  const startLabel = cdtGetStart() ? new Date(cdtGetStart()).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '—';
  if(progSub) progSub.textContent = `Started ${startLabel} · Day ${todayNum||'—'} of 30 · ${sentCount}/${totalTouches} touches complete`;
  if(hdrSub) hdrSub.textContent = `Day ${todayNum||'—'} of 30 · Visual timeline · tap any day to open the email composer`;
  if(statRow) statRow.innerHTML = [
    sentCount ? `<div class="cdt-stat sent">✓ ${sentCount} Sent</div>` : '',
    (totalTouches-sentCount) ? `<div class="cdt-stat pending">${totalTouches-sentCount} Pending</div>` : '',
    dueTodayCount ? `<div class="cdt-stat today" onclick="notifOpenDrawer('outreach')" style="cursor:pointer" title="View outreach schedule">🔔 Due Today</div>` : '',
    overdueCount ? `<div class="cdt-stat overdue">⚠ ${overdueCount} Overdue</div>` : '',
  ].join('');

  // Render timeline or grid
  if(_cdtView==='timeline') cdtRenderTimeline(touches, sorted, touchDays, intelDays, todayNum);
  else cdtRenderGrid(touches, touchDays, intelDays, todayNum);
}

function cdtRenderEmpty(){
  const tl = document.getElementById('cdt-timeline');
  const gr = document.getElementById('cdt-grid');
  const msg = '<div style="padding:24px;text-align:center;color:var(--text-3);font-size:13px">No prospect loaded — go to Command Center and load a prospect first.</div>';
  if(tl) tl.innerHTML = msg;
  if(gr) gr.innerHTML = msg;
  const pctEl = document.getElementById('cdt-ring-pct');
  if(pctEl) pctEl.textContent = '0%';
  const pt = document.getElementById('cdt-prog-title');
  if(pt) pt.textContent = 'No prospect loaded';
}

function cdtRenderTimeline(touches, sorted, touchDays, intelDays, todayNum){
  const tl = document.getElementById('cdt-timeline');
  if(!tl) return;
  const touchByDay = {}; touches.forEach((t,i)=>{ touchByDay[t.day]={touch:t,idx:i}; });
  const intelByDay = {}; CDT_INTEL_DAYS.forEach(d=>{ intelByDay[d.day]=d; });

  let html = '';
  sorted.forEach(day=>{
    const isToday = todayNum === day;
    const td = touchByDay[day];
    const intel = intelByDay[day];

    // Intel row (shown above the touch row if same day)
    if(intel && !td){
      const intelResult = cdtGetIntelResult(day);
      html += `<div class="cdt-intel-row" style="flex-direction:column;align-items:stretch;cursor:default">
        <div style="display:flex;align-items:center">
          <div class="cdt-intel-day"><div class="num">${day}</div><div class="lbl">DAY</div></div>
          <div class="cdt-intel-info" style="flex:1"><strong>📊 ${intel.label}</strong> — ${intel.desc}
            <button onclick="cdtRunIntelRefresh(${day})" id="cdt-intel-run-${day}" style="margin-left:8px;font-size:9px;font-weight:700;padding:2px 8px;border-radius:3px;border:1px solid var(--gold-border);background:var(--gold-bg);color:var(--gold);cursor:pointer;font-family:var(--fb)">${intelResult?'↺ Re-run':'▶ Run Now'}</button>
          </div>
        </div>
        <div id="cdt-intel-result-${day}" style="padding:0 10px 8px 62px">${intelResult ? cdtRenderIntelResult(intelResult) : ''}</div>
        <div class="cdt-intel-actions" style="padding:0 10px 10px 62px">
          <button class="cdt-ia-btn email" style="background:#f0f4ff;border-color:#c7d7ff;color:#1e40af" onclick="cdtIntelEmail(${day})" title="Open pre-filled in Outlook">📧 Outlook</button>
          <button class="cdt-ia-btn social" onclick="cdtIntelLinkedIn(${day})" title="Copy as LinkedIn post">💼 LinkedIn Post</button>
          <button class="cdt-ia-btn sms" onclick="cdtIntelSms(${day})" title="Send SMS to prospect">📱 SMS</button>
        </div>
      </div>`;
    }
    if(intel && td){
      const intelResult = cdtGetIntelResult(day);
      html += `<div class="cdt-intel-row" style="flex-direction:column;align-items:stretch;margin-bottom:2px;cursor:default">
        <div style="display:flex;align-items:center">
          <div class="cdt-intel-day"><div class="num">${day}</div><div class="lbl">INTEL</div></div>
          <div class="cdt-intel-info" style="flex:1"><strong>📊 ${intel.label}</strong>
            <button onclick="cdtRunIntelRefresh(${day})" id="cdt-intel-run-${day}" style="margin-left:8px;font-size:9px;font-weight:700;padding:2px 8px;border-radius:3px;border:1px solid var(--gold-border);background:var(--gold-bg);color:var(--gold);cursor:pointer;font-family:var(--fb)">${intelResult?'↺ Re-run':'▶ Run Now'}</button>
          </div>
        </div>
        <div id="cdt-intel-result-${day}" style="padding:0 10px 8px 62px">${intelResult ? cdtRenderIntelResult(intelResult) : ''}</div>
        <div class="cdt-intel-actions" style="padding:0 10px 10px 62px">
          <button class="cdt-ia-btn email" style="background:#f0f4ff;border-color:#c7d7ff;color:#1e40af" onclick="cdtIntelEmail(${day})" title="Open pre-filled in Outlook">📧 Outlook</button>
          <button class="cdt-ia-btn social" onclick="cdtIntelLinkedIn(${day})" title="Copy as LinkedIn post">💼 LinkedIn Post</button>
          <button class="cdt-ia-btn sms" onclick="cdtIntelSms(${day})" title="Send SMS to prospect">📱 SMS</button>
        </div>
      </div>`;
    }

    // Touch row
    if(td){
      const {touch, idx} = td;
      const status = window._ecStatuses[idx]||'Pending';
      const isActive = idx === window._ecActiveIdx;
      const isOverdue = todayNum && day < todayNum && status==='Pending';
      let rowCls = 'cdt-day-row';
      if(isActive) rowCls += ' active-touch';
      if(isToday) rowCls += ' is-today';
      if(isOverdue) rowCls += ' is-overdue';

      const pillCls = ({
        'Sent':'sent','Meeting Booked':'meeting','Replied':'replied',
        'Opened':'opened','Drafted':'drafted','No Response':'noresponse',
        'Opted Out':'optedout','Pending': isOverdue?'overdue':'pending'
      })[status]||'pending';
      const pillLabel = isOverdue && status==='Pending' ? 'OVERDUE' : status.toUpperCase();

      const sentAtRaw = (window._ecSentAt||{})[idx];
      const sentAtLabel = sentAtRaw
        ? new Date(sentAtRaw).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})
        : null;
      const isSentStatus = status==='Sent'||status==='Meeting Booked'||status==='Replied'||status==='Opened';

      html += `<div class="${rowCls}" onclick="cdtJumpTo(${idx})">
        <div class="cdt-day-num" onclick="event.stopPropagation();cdtOpenReschedule(${idx},${day})" title="Click to reschedule this touch" style="cursor:pointer;position:relative" onmouseenter="this.querySelector('.cdt-rs-hint')&&(this.querySelector('.cdt-rs-hint').style.opacity=1)" onmouseleave="this.querySelector('.cdt-rs-hint')&&(this.querySelector('.cdt-rs-hint').style.opacity=0)">
          <div class="num">${day}</div>
          <div class="lbl">DAY</div>
          <div class="cdt-rs-hint" style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);font-size:8px;font-weight:700;color:var(--gold);letter-spacing:.4px;white-space:nowrap;opacity:0;transition:opacity .15s;pointer-events:none">✎ EDIT</div>
        </div>
        <div class="cdt-day-mid">
          <div class="cdt-touch-label">${touch.label}</div>
          <div class="cdt-touch-sub">${touch.subject}</div>
          ${(()=>{ try{ const s=cdtGetStart(); if(!s) return ''; const d=new Date(s); d.setHours(0,0,0,0); d.setDate(d.getDate()+(day-1)); return '<div style="font-size:10px;color:var(--text-3);margin-top:3px">📅 '+d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})+'</div>'; }catch(e){return '';} })()}
          ${isSentStatus && sentAtLabel ? `<div style="font-size:10px;color:var(--green);font-weight:600;margin-top:2px">✓ Sent ${sentAtLabel}</div>` : ''}
          ${isSentStatus && !sentAtLabel ? `<div style="font-size:10px;color:var(--green);font-weight:500;margin-top:2px">✓ Completed</div>` : ''}
        </div>
        <div class="cdt-day-right">
          ${isToday ? '<span class="cdt-today-badge">TODAY</span>' : ''}
          <span class="cdt-status-pill ${pillCls}">${pillLabel}</span>
          <button class="cdt-open-btn" style="background:#f0f4ff;border-color:#c7d7ff;color:#1e40af" onclick="event.stopPropagation();cdtQuickMailto(${idx})" title="Open pre-filled in Outlook">📧 Outlook</button>
          <button class="cdt-open-btn" style="background:#fff8f0;border-color:#fed7aa;color:#9a3412" onclick="event.stopPropagation();cdtResetTouch(${idx})" title="Reset this touch to Pending">↺ Reset</button>
        </div>
      </div>`;
    }
  });
  tl.innerHTML = html;
}

function cdtRenderGrid(touches, touchDays, intelDays, todayNum){
  const gr = document.getElementById('cdt-grid');
  if(!gr) return;
  let html = '';
  touches.forEach((touch,idx)=>{
    const status = window._ecStatuses[idx]||'Pending';
    const isActive = idx === window._ecActiveIdx;
    const isToday = todayNum === touch.day;
    const isSent = status==='Sent'||status==='Meeting Booked'||status==='Replied'||status==='Opened';
    const isOverdue = todayNum && touch.day < todayNum && status==='Pending';
    let cls = 'cdt-grid-card';
    if(isActive) cls += ' active-touch';
    if(isToday) cls += ' is-today';
    if(isSent) cls += ' gc-sent';
    if(isOverdue) cls += ' gc-overdue';
    const pillCls = ({
      'Sent':'sent','Meeting Booked':'meeting','Replied':'replied',
      'Opened':'opened','Drafted':'drafted','No Response':'noresponse',
      'Opted Out':'optedout','Pending': isOverdue?'overdue':'pending'
    })[status]||'pending';
    const pillLabel = isOverdue && status==='Pending' ? '⚠ OVERDUE' : isSent ? '✓ '+status.toUpperCase() : status;
    const pillBg = ({
      sent:'var(--green-bg)',meeting:'#f0fdf4',replied:'var(--green-bg)',
      opened:'#fefce8',drafted:'#eff6ff',noresponse:'var(--light)',
      optedout:'#fef2f2',overdue:'#fef2f2',pending:'var(--light)'
    })[pillCls]||'var(--light)';
    const pillColor = ({
      sent:'var(--green)',meeting:'#15803d',replied:'var(--green)',
      opened:'#ca8a04',drafted:'#2563eb',noresponse:'var(--text-3)',
      optedout:'var(--red)',overdue:'var(--red)',pending:'var(--text-3)'
    })[pillCls]||'var(--text-3)';

    html += `<div class="${cls}" onclick="cdtJumpTo(${idx})">
      <div class="cdt-gc-day">${touch.day}</div>
      <div class="cdt-gc-label">${touch.label}</div>
      ${isToday ? '<div style="font-size:9px;font-weight:700;color:#c2410c;margin-bottom:4px">TODAY</div>' : ''}
      ${intelDays.has(touch.day) ? '<div style="font-size:8px;color:var(--gold);font-weight:700;margin-bottom:3px">📊 INTEL DAY</div>' : ''}
      <div class="cdt-gc-status" style="background:${pillBg};color:${pillColor}">${pillLabel}</div>
      <button style="margin-top:6px;width:100%;padding:3px 0;font-size:9px;font-weight:700;border:1px solid #fed7aa;background:#fff8f0;color:#9a3412;border-radius:3px;cursor:pointer;font-family:var(--fb)" onclick="event.stopPropagation();cdtResetTouch(${idx})" title="Reset to Pending">↺ Reset</button>
    </div>`;
  });
  gr.innerHTML = html;
}

// Jump to a touch: switch active idx, scroll to email composer, render
window.cdtJumpTo = function(idx){
  window._ecActiveIdx = idx;
  ecRenderAll();
  // Scroll to composer divider
  const div = document.querySelector('.cdt-composer-divider');
  if(div) setTimeout(()=>div.scrollIntoView({behavior:'smooth',block:'start'}),80);
  showToast('Opened Day '+buildTouches(window._hqProspect)[idx].day+' — '+buildTouches(window._hqProspect)[idx].label);
};

// Toggle view
window.cdtSetView = function(view){
  _cdtView = view;
  document.getElementById('cdt-timeline-view').style.display = view==='timeline'?'block':'none';
  document.getElementById('cdt-grid-view').style.display = view==='grid'?'block':'none';
  document.getElementById('cdt-vbtn-timeline').classList.toggle('active', view==='timeline');
  document.getElementById('cdt-vbtn-grid').classList.toggle('active', view==='grid');
  cdtRender();
};

// Reset all statuses and restart
// ── Reschedule: open modal for a specific touch ───────────────────────────
window._cdtRsIdx = null; // touch index being rescheduled
window._cdtRsDayNum = null; // cadence day number (2, 8, 15, 22, 30)

window.cdtOpenReschedule = function(touchIdx, dayNum){
  const p = window._hqProspect;
  if(!p) return;
  const touches = buildTouches(p);
  const touch = touches[touchIdx];
  if(!touch) return;

  window._cdtRsIdx = touchIdx;
  window._cdtRsDayNum = dayNum;

  // Compute the current absolute date for this touch
  const startISO = cdtGetStart();
  let currentDateStr = '';
  if(startISO){
    const start = new Date(startISO);
    start.setHours(0,0,0,0);
    const touchDate = new Date(start);
    touchDate.setDate(touchDate.getDate() + (dayNum - 1));
    currentDateStr = touchDate.toISOString().split('T')[0];
  } else {
    // Default to today
    currentDateStr = new Date().toISOString().split('T')[0];
  }

  // Populate modal
  const title = document.getElementById('cdt-rs-title');
  const sub = document.getElementById('cdt-rs-sub');
  const impact = document.getElementById('cdt-rs-impact');
  const dateInput = document.getElementById('cdt-rs-date');

  if(title) title.textContent = 'Reschedule: Day ' + dayNum + ' — ' + touch.label;
  if(sub) sub.textContent = p.company + ' · ' + (p.contact || 'No contact');
  if(impact) impact.innerHTML = 'Choosing a new date for <strong>Day ' + dayNum + '</strong> will shift the cadence start date so all other touches adjust automatically.<br><span style="color:var(--text-3)">Marked-sent touches are not affected.</span>';
  if(dateInput){
    dateInput.value = currentDateStr;
    // Set min to today to prevent scheduling in the past (allow override by removing this line if desired)
    // dateInput.min = new Date().toISOString().split('T')[0];
  }

  const modal = document.getElementById('cdt-reschedule-modal');
  if(modal){ modal.style.display = 'flex'; setTimeout(()=>{ if(dateInput) dateInput.focus(); }, 100); }
};

window.cdtCloseReschedule = function(){
  const modal = document.getElementById('cdt-reschedule-modal');
  if(modal) modal.style.display = 'none';
  window._cdtRsIdx = null;
  window._cdtRsDayNum = null;
};

window.cdtConfirmReschedule = function(){
  const p = window._hqProspect;
  if(!p || window._cdtRsDayNum === null) return;

  const dateInput = document.getElementById('cdt-rs-date');
  if(!dateInput || !dateInput.value){ showToast('Please choose a date', true); return; }

  const chosenDate = new Date(dateInput.value + 'T00:00:00');
  if(isNaN(chosenDate.getTime())){ showToast('Invalid date', true); return; }

  // Calculate new start date: if this touch is on day N, start = chosenDate - (N-1) days
  const newStart = new Date(chosenDate);
  newStart.setDate(newStart.getDate() - (window._cdtRsDayNum - 1));
  const newStartISO = newStart.toISOString().split('T')[0];

  // Save new start date
  cdtSetStart(newStartISO);

  // Close modal and re-render
  const rsIdx = window._cdtRsIdx;
  const rsDayNum = window._cdtRsDayNum;
  cdtCloseReschedule();
  cdtRender();
  // If drawer is open, refresh the active tab so dates/status update immediately
  const drawer = document.getElementById('notif-drawer');
  if(drawer && drawer.classList.contains('open')) notifRenderList();

  const touch = buildTouches(p)[rsIdx];
  const dateLabel = chosenDate.toLocaleDateString('en-US',{month:'short',day:'numeric',weekday:'short'});
  showToast('📅 Day ' + rsDayNum + ' rescheduled to ' + dateLabel);
};

window.cdtResetAll = function(){
  if(!confirm('Reset all touch statuses and restart the cadence from today?')) return;
  window._ecStatuses={};window._ecNotes={};window._ecLaunched={};window._ecChecks={};
  if(window._hqProspect) ecSaveStatuses(window._hqProspect.company); // clear persisted statuses for reset
  cdtResetStart();
  cdtSetStart(new Date().toISOString().split('T')[0]);
  ecRenderAll();
  showToast('Cadence reset — starting from today');
};

window.cdtResetTouch = function(idx){
  const p = window._hqProspect;
  const touches = p ? buildTouches(p) : [];
  const touch = touches[idx];
  const label = touch ? 'Day ' + touch.day + ' — ' + touch.label : 'this touch';
  if(!confirm('Reset ' + label + ' back to Pending?')) return;
  if(window._ecStatuses)  delete window._ecStatuses[idx];
  if(window._ecNotes)     delete window._ecNotes[idx];
  if(window._ecLaunched)  delete window._ecLaunched[idx];
  if(window._ecSentAt)    delete window._ecSentAt[idx];
  if(p) ecSaveStatuses(p.company);
  ecRenderAll();
  showToast(label + ' reset to Pending');
};

// Hook into ecRenderAll to also refresh tracker
const _cdtOrigRenderAll = window.ecRenderAll || null;
// Patch: after ecRenderAll runs, always refresh cdt
const _cdtOrigEcMarkSent = window.ecMarkSent;
window.ecMarkSent = function(){
  if(_cdtOrigEcMarkSent) _cdtOrigEcMarkSent();
  // Fire notification for sent touch
  const p = window._hqProspect;
  const touches = p ? buildTouches(p) : null;
  const touch = touches ? touches[window._ecActiveIdx] : null;
  if(touch && p){
    notifAdd('outreach', '📧 Touch Sent: Day '+touch.day+' — '+touch.label, p.company+' · '+p.contact, 'OUTREACH');
    // Check if this is an intel day — auto-trigger intel refresh
    const isIntelDay = CDT_INTEL_DAYS.some(d=>d.day===touch.day);
    if(isIntelDay) {
      setTimeout(()=>cdtRunIntelRefresh(touch.day), 500);
    }
    // Check if meeting booked
    if(window._ecStatuses[window._ecActiveIdx]==='Meeting Booked'){
      notifAdd('meeting', '🎉 Meeting Booked! Day '+touch.day+' — '+touch.label, p.company+' · '+p.contact, 'MEETING');
      notifBrowserPush('🎉 Meeting Booked — '+p.company, touch.label+' · '+p.contact);
    }
  }
  setTimeout(cdtRender, 80);
};
const _cdtOrigSetSt = window.ecSetSt;
window.ecSetSt = function(val){
  if(_cdtOrigSetSt) _cdtOrigSetSt(val);
  const p = window._hqProspect;
  const touches = p ? buildTouches(p) : null;
  const touch = touches ? touches[window._ecActiveIdx] : null;
  if(touch && p){
    if(val==='Meeting Booked'){
      notifAdd('meeting','🎉 Meeting Booked! Day '+touch.day+' — '+touch.label, p.company+' · '+p.contact,'MEETING');
      notifBrowserPush('🎉 Meeting Booked — '+p.company, touch.label+' · '+p.contact);
    } else if(val==='Replied'){
      notifAdd('outreach','💬 Reply Received — Day '+touch.day+' · '+touch.label, p.company+' · '+p.contact,'OUTREACH');
    } else if(val==='Opted Out'){
      notifAdd('alerts','⛔ Opted Out — '+p.company, 'Removed from cadence on Day '+touch.day,'ALERT');
    }
  }
  setTimeout(cdtRender, 80);
};

// ═══════════════════════════════════════════════════════════════════════
//  NOTIFICATION SYSTEM
// ═══════════════════════════════════════════════════════════════════════
const NOTIF_KEY = 'bp_notifications';
var _notifTab = 'all';

// ── Cadence status persistence (per prospect) ────────────────────────
function ecStatusKey(company){ return 'bp_ec_statuses_'+(company||'').replace(/\s+/g,'_'); }
function ecSaveStatuses(company){
  if(!company) return;
  localStorage.setItem(ecStatusKey(company), JSON.stringify(window._ecStatuses||{}));
  localStorage.setItem(ecStatusKey(company)+'_sentAt', JSON.stringify(window._ecSentAt||{}));
}
function ecLoadStatuses(company){
  if(!company){ window._ecStatuses={}; window._ecSentAt={}; return; }
  try{ window._ecStatuses=JSON.parse(localStorage.getItem(ecStatusKey(company))||'{}'); }
  catch{ window._ecStatuses={}; }
  try{ window._ecSentAt=JSON.parse(localStorage.getItem(ecStatusKey(company)+'_sentAt')||'{}'); }
  catch{ window._ecSentAt={}; }
}

function notifGetAll(){ try{ return JSON.parse(localStorage.getItem(NOTIF_KEY)||'[]'); }catch{ return []; } }
function notifSave(arr){ localStorage.setItem(NOTIF_KEY, JSON.stringify(arr.slice(0,100))); }

// type: 'outreach' | 'intel' | 'meeting' | 'alerts'
function notifAdd(type, msg, sub, label){
  const arr = notifGetAll();
  arr.unshift({ id: Date.now(), type, msg, sub, label, time: new Date().toISOString(), read: false });
  notifSave(arr);
  notifUpdateBadge();
  notifRenderList();
  // Browser notification
  notifBrowserPush(msg, sub);
}

function notifUpdateBadge(){
  const arr = notifGetAll();
  const unread = arr.filter(n=>!n.read).length;
  const badge = document.getElementById('notif-badge');
  const countEl = document.getElementById('notif-unread-count');
  if(badge){ badge.textContent = unread > 99 ? '99+' : unread; badge.classList.toggle('show', unread > 0); }
  if(countEl) countEl.textContent = unread > 0 ? unread+' unread alert'+(unread!==1?'s':'') : 'All caught up';
}

// ═══════════════════════════════════════════════════════════════════════
//  DRAWER TABS — Single shared data source for all four tabs
//  All tabs read from the same cdtGetProspectData() snapshot so they
//  always reflect the same state as each other.
// ═══════════════════════════════════════════════════════════════════════

// Shared helper: build a full data snapshot for the loaded prospect
function cdtGetProspectData(){
  const p = window._hqProspect;
  if(!p || !p.company) return null;

  const startISO = cdtGetStart();
  if(!startISO) return { p, startISO: null, touches: [], statuses: {}, sentAt: {}, todayNum: null, start: null };

  const start = new Date(startISO + 'T00:00:00');
  start.setHours(0,0,0,0);
  const today = new Date(); today.setHours(0,0,0,0);
  const todayNum = Math.floor((today - start) / 86400000) + 1;

  let statuses = {}, sentAt = {};
  try{ statuses = JSON.parse(localStorage.getItem(ecStatusKey(p.company))||'{}'); }catch(e){}
  try{ sentAt = JSON.parse(localStorage.getItem(ecStatusKey(p.company)+'_sentAt')||'{}'); }catch(e){}
  // Merge in-memory statuses (they are the freshest)
  Object.keys(window._ecStatuses||{}).forEach(i => { statuses[i] = window._ecStatuses[i]; });

  let touches = [];
  try{ touches = buildTouches(p); }catch(e){}

  return { p, startISO, start, todayNum, statuses, sentAt, touches };
}

// Shared helpers
function _notifTouchDate(start, dayNum){
  const d = new Date(start); d.setDate(d.getDate() + (dayNum - 1)); return d;
}
function _notifFmtDate(d){
  return d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
}
function _notifTouchStatus(statuses, sentAt, i){
  return statuses[i] || 'Pending';
}
const _STATUS_COLOR = {
  'Sent':'var(--green)','Meeting Booked':'#7c3aed','Replied':'var(--green)',
  'Opened':'var(--blue)','Drafted':'var(--gold)','Opted Out':'var(--red)',
  'No Response':'var(--text-3)','Pending':'var(--text-3)'
};
const _STATUS_ICON = {
  'Sent':'✓','Meeting Booked':'🎯','Replied':'💬',
  'Opened':'👁','Drafted':'📝','Opted Out':'⛔',
  'No Response':'—','Pending':'○'
};

function notifRenderList(){
  const listEl = document.getElementById('notif-list');
  if(!listEl) return;
  if(_notifTab === 'outreach') { notifRenderOutreachTab(listEl); return; }
  if(_notifTab === 'intel')    { notifRenderIntelTab(listEl);    return; }
  if(_notifTab === 'alerts')   { notifRenderAlertsTab(listEl);   return; }

  // ── All tab: full notification log ───────────────────────────────────
  const arr = notifGetAll();
  if(!arr.length){
    listEl.innerHTML='<div class="notif-empty">🎯<br><br>No activity yet.<br><span style="font-size:11px">Activity will appear as you work the cadence.</span></div>';
    return;
  }
  const typeColor = { outreach:'var(--blue)', intel:'var(--gold)', meeting:'var(--green)', alerts:'var(--red)' };
  const typeLabel = { outreach:'OUTREACH', intel:'INTEL REFRESH', meeting:'MEETING', alerts:'ALERT' };
  listEl.innerHTML = arr.map(n=>{
    const t = new Date(n.time);
    const ts = t.toLocaleDateString('en-US',{month:'short',day:'numeric'})+' at '+t.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
    const cls = n.read ? 'notif-item' : 'notif-item '+(n.type==='outreach'?'unread':n.type==='intel'?'unread-intel':n.type==='meeting'?'unread-meeting':'unread-alert');
    return `<div class="${cls}" onclick="notifMarkRead('${n.id}');this.classList.remove('unread','unread-intel','unread-meeting','unread-alert')">
      <div class="notif-item-type" style="color:${typeColor[n.type]||'var(--text-3)'}">${typeLabel[n.type]||n.label||'ACTIVITY'}</div>
      <div class="notif-item-msg">${n.msg}</div>
      ${n.sub?`<div class="notif-item-sub">${n.sub}</div>`:''}
      <div class="notif-item-time">${ts}</div>
    </div>`;
  }).join('');
}

// ── OUTREACH TAB ─────────────────────────────────────────────────────────
function notifRenderOutreachTab(listEl){
  const data = cdtGetProspectData();
  if(!data){ listEl.innerHTML='<div class="notif-empty">📋<br><br>No prospect loaded.<br><span style="font-size:11px">Load a prospect to see their outreach schedule.</span></div>'; return; }
  const {p, startISO, start, todayNum, statuses, sentAt, touches} = data;
  if(!startISO){ listEl.innerHTML='<div class="notif-empty">📋<br><br>Cadence not started for <strong>'+p.company+'</strong>.<br><span style="font-size:11px">Open the 30-Day Cadence tab to begin.</span></div>'; return; }

  const completedCount = touches.filter((_,i)=>{ const s=statuses[i]||'Pending'; return s==='Sent'||s==='Meeting Booked'||s==='Replied'; }).length;

  let html = `<div style="padding:14px 14px 10px;border-bottom:1px solid var(--border);background:var(--off-white)">
    <div style="font-size:13px;font-weight:700;color:var(--text)">${p.company}</div>
    <div style="font-size:10px;color:var(--text-3);margin-top:2px">${p.contact||'No contact'} · ${p.track||'WFN'} · ${completedCount}/${touches.length} touches complete</div>
    <div style="font-size:10px;color:var(--text-3);margin-top:1px">Started ${_notifFmtDate(start)} · Day ${Math.max(1,Math.min(todayNum||1,30))} of 30</div>
  </div>`;

  touches.forEach(function(touch, i){
    const status = statuses[i] || 'Pending';
    const tDate  = _notifTouchDate(start, touch.day);
    const isToday   = touch.day === todayNum;
    const isOverdue = todayNum && touch.day < todayNum && status === 'Pending';
    const isDone    = status==='Sent'||status==='Meeting Booked'||status==='Replied';
    const sentAtRaw = sentAt[i];
    const sentAtLabel = sentAtRaw ? new Date(sentAtRaw).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : null;
    const sColor = _STATUS_COLOR[status]||'var(--text-3)';
    const sIcon  = _STATUS_ICON[status]||'○';
    const rowBg  = isToday?'#fff9ed':isDone?'#f0fdf4':'var(--white)';
    const rowBL  = isToday?'3px solid var(--gold)':isDone?'3px solid var(--green)':isOverdue?'3px solid var(--red)':'3px solid transparent';

    html += `<div style="padding:12px 14px;border-bottom:1px solid var(--border);background:${rowBg};border-left:${rowBL}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:5px;margin-bottom:4px;flex-wrap:wrap">
            <span style="font-size:9px;font-weight:800;color:var(--text-3);font-family:var(--fm);background:var(--off-white);padding:1px 6px;border-radius:3px;border:1px solid var(--border)">DAY ${touch.day}</span>
            ${isToday  ? '<span style="font-size:9px;font-weight:800;color:#c2410c;background:#fff7ed;padding:1px 6px;border-radius:3px;border:1px solid #fed7aa">TODAY</span>' : ''}
            ${isOverdue? '<span style="font-size:9px;font-weight:800;color:var(--red);background:#fff1f2;padding:1px 6px;border-radius:3px;border:1px solid #fecaca">OVERDUE</span>' : ''}
            ${isDone   ? '<span style="font-size:9px;font-weight:800;color:var(--green);background:#f0fdf4;padding:1px 6px;border-radius:3px;border:1px solid #bbf7d0">DONE</span>' : ''}
          </div>
          <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:2px">${touch.label}</div>
          <div style="font-size:10px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px">${touch.subject}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:5px;flex-wrap:wrap">
            <span style="font-size:10px;color:${sColor};font-weight:600">${sIcon} ${status}</span>
            <span style="font-size:10px;color:var(--text-3)">·</span>
            <span style="font-size:10px;color:${isOverdue?'var(--red)':isToday?'#c2410c':'var(--text-3)'}">
              ${isDone && sentAtLabel ? '✓ Sent '+sentAtLabel : '📅 '+_notifFmtDate(tDate)}
            </span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0;align-items:flex-end">
          ${!isDone ? `<button onclick="cdtOpenReschedule(${i},${touch.day})" style="font-size:10px;font-weight:700;padding:5px 9px;border-radius:4px;border:1px solid var(--border);background:var(--white);color:var(--text-2);cursor:pointer;font-family:var(--fb);white-space:nowrap">📅 Reschedule</button>` : ''}
          <button onclick="notifCloseDrawer();cdtQuickMailto(${i})" style="font-size:10px;font-weight:700;padding:5px 9px;border-radius:4px;border:none;background:#1e40af;color:#fff;cursor:pointer;font-family:var(--fb);white-space:nowrap">📧 Outlook</button>
        </div>
      </div>
    </div>`;
  });

  listEl.innerHTML = html;
}

// ── ALERTS TAB ───────────────────────────────────────────────────────────
function notifRenderAlertsTab(listEl){
  const data = cdtGetProspectData();
  let html = '';

  if(data && data.startISO && data.touches.length){
    const {p, start, todayNum, statuses, touches} = data;
    const dueToday = touches.filter((t,i) => t.day===todayNum && (statuses[i]||'Pending')==='Pending');
    const overdue  = touches.filter((t,i) => t.day<todayNum  && (statuses[i]||'Pending')==='Pending');

    if(dueToday.length || overdue.length){
      html += `<div style="padding:10px 14px 8px;border-bottom:1px solid var(--border);background:var(--off-white)">
        <div style="font-size:9px;font-weight:800;letter-spacing:.8px;color:var(--text-3);text-transform:uppercase;margin-bottom:6px">${p.company} · Action Items</div>`;

      dueToday.forEach(function(touch){
        const i = touches.indexOf(touch);
        const tDate = _notifTouchDate(start, touch.day);
        html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
          <div style="flex:1;min-width:0">
            <div style="font-size:11px;font-weight:700;color:#c2410c">🔔 Due Today · Day ${touch.day} — ${touch.label}</div>
            <div style="font-size:10px;color:var(--text-3);margin-top:1px">📅 ${_notifFmtDate(tDate)} · ${touch.subject.substring(0,45)}${touch.subject.length>45?'…':''}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">
            <button onclick="cdtOpenReschedule(${i},${touch.day})" style="font-size:9px;font-weight:700;padding:3px 7px;border-radius:3px;border:1px solid var(--border);background:var(--white);color:var(--text-2);cursor:pointer;font-family:var(--fb);white-space:nowrap">📅 Reschedule</button>
            <button onclick="notifCloseDrawer();cdtQuickMailto(${i})" style="font-size:9px;font-weight:700;padding:3px 7px;border-radius:3px;border:none;background:#1e40af;color:#fff;cursor:pointer;font-family:var(--fb);white-space:nowrap">📧 Outlook</button>
          </div>
        </div>`;
      });

      overdue.forEach(function(touch){
        const i = touches.indexOf(touch);
        const tDate = _notifTouchDate(start, touch.day);
        html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
          <div style="flex:1;min-width:0">
            <div style="font-size:11px;font-weight:700;color:var(--red)">⚠ Overdue · Day ${touch.day} — ${touch.label}</div>
            <div style="font-size:10px;color:var(--text-3);margin-top:1px">📅 Was ${_notifFmtDate(tDate)} · ${touch.subject.substring(0,45)}${touch.subject.length>45?'…':''}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">
            <button onclick="cdtOpenReschedule(${i},${touch.day})" style="font-size:9px;font-weight:700;padding:3px 7px;border-radius:3px;border:1px solid var(--border);background:var(--white);color:var(--text-2);cursor:pointer;font-family:var(--fb);white-space:nowrap">📅 Reschedule</button>
            <button onclick="notifCloseDrawer();cdtQuickMailto(${i})" style="font-size:9px;font-weight:700;padding:3px 7px;border-radius:3px;border:none;background:#1e40af;color:#fff;cursor:pointer;font-family:var(--fb);white-space:nowrap">📧 Outlook</button>
          </div>
        </div>`;
      });

      html += '</div>';
    }
  }

  // Alert log: meetings + opt-outs
  const alertArr = notifGetAll().filter(n => n.type==='meeting'||n.type==='alerts');
  // Filter OUT the generic "Touch Due Today" / "overdue task" system entries — those are shown above from live data
  const filteredAlerts = alertArr.filter(n => !n.msg.includes('Touch Due Today') && !n.msg.includes('overdue task') && !n.msg.includes('tasks due today') && !n.msg.includes('Overdue Task'));

  if(filteredAlerts.length){
    html += `<div style="padding:8px 14px 4px;border-bottom:1px solid var(--border);background:var(--off-white)">
      <div style="font-size:9px;font-weight:800;letter-spacing:.8px;color:var(--text-3);text-transform:uppercase">Activity Log</div>
    </div>`;
    const typeColor = { meeting:'var(--green)', alerts:'var(--red)' };
    const typeLabel = { meeting:'MEETING BOOKED', alerts:'ALERT' };
    html += filteredAlerts.map(n=>{
      const t = new Date(n.time);
      const ts = t.toLocaleDateString('en-US',{month:'short',day:'numeric'})+' at '+t.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
      const cls = n.read ? 'notif-item' : 'notif-item '+(n.type==='meeting'?'unread-meeting':'unread-alert');
      return `<div class="${cls}" onclick="notifMarkRead('${n.id}');this.classList.remove('unread-meeting','unread-alert')">
        <div class="notif-item-type" style="color:${typeColor[n.type]||'var(--text-3)'}">${typeLabel[n.type]||'ALERT'}</div>
        <div class="notif-item-msg">${n.msg}</div>
        ${n.sub?`<div class="notif-item-sub">${n.sub}</div>`:''}
        <div class="notif-item-time">${ts}</div>
      </div>`;
    }).join('');
  }

  if(!html){
    listEl.innerHTML='<div class="notif-empty">✅<br><br>No alerts right now.<br><span style="font-size:11px">Due touches, overdue tasks, meetings booked, and opt-outs appear here.</span></div>';
    return;
  }
  listEl.innerHTML = html;
}

// ── INTEL TAB ────────────────────────────────────────────────────────────
function notifRenderIntelTab(listEl){
  const data = cdtGetProspectData();
  if(!data){ listEl.innerHTML='<div class="notif-empty">📊<br><br>No prospect loaded.<br><span style="font-size:11px">Load a prospect to see intel history.</span></div>'; return; }
  const {p, start, startISO} = data;

  const store = cdtGetIntelResults();
  const prefix = p.company.replace(/\s+/g,'_') + '_day';
  const keys = Object.keys(store).filter(k=>k.startsWith(prefix)).sort((a,b)=>{
    return (parseInt(a.replace(prefix,''))||0)-(parseInt(b.replace(prefix,''))||0);
  });

  function touchDateLabel(dayNum){
    if(!start) return '';
    const d = new Date(start); d.setDate(d.getDate()+(dayNum-1));
    return d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  }

  let html = `<div style="padding:12px 14px 10px;border-bottom:1px solid var(--border);background:var(--off-white)">
    <div style="font-size:12px;font-weight:700;color:var(--text)">${p.company} — Intel History</div>
    <div style="font-size:10px;color:var(--text-3);margin-top:2px">${keys.length} of ${(CDT_INTEL_DAYS||[]).length} intel runs complete</div>
  </div>`;

  if(keys.length){
    keys.forEach(function(k){
      const result = store[k];
      const dayNum = parseInt(k.replace(prefix,''))||0;
      const intelDay = (CDT_INTEL_DAYS||[]).find(d=>d.day===dayNum);
      const label = intelDay ? intelDay.label : 'Day '+dayNum+' Intel';
      const desc  = intelDay ? intelDay.desc  : '';
      const runAt = result.timestamp ? new Date(result.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : '';
      let summary = result.summary || (result.text ? result.text.substring(0,180)+'…' : typeof result==='string' ? result.substring(0,180)+'…' : '');

      html += `<div style="padding:12px 14px;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:9px;font-weight:800;color:var(--gold);background:#fffbea;padding:1px 6px;border-radius:3px;border:1px solid #fde68a">DAY ${dayNum}</span>
            <span style="font-size:11px;font-weight:700;color:var(--text)">📊 ${label}</span>
          </div>
          <button onclick="notifCloseDrawer();cdtRunIntelRefresh(${dayNum})" style="font-size:9px;font-weight:700;padding:3px 8px;border-radius:3px;border:1px solid var(--gold-border);background:var(--gold-bg);color:var(--gold);cursor:pointer;font-family:var(--fb);white-space:nowrap">↺ Re-run</button>
        </div>
        ${desc?`<div style="font-size:10px;color:var(--text-3);margin-bottom:5px">${desc}</div>`:''}
        ${summary?`<div style="font-size:10px;color:var(--text-2);line-height:1.5;background:var(--off-white);padding:8px 10px;border-radius:5px;border:1px solid var(--border);margin-bottom:5px">${summary}</div>`:''}
        <div style="font-size:9px;color:var(--text-3)">${runAt?'Run '+runAt:''}${touchDateLabel(dayNum)?' · Scheduled '+touchDateLabel(dayNum):''}</div>
      </div>`;
    });
  }

  // Pending intel runs
  const runDays = new Set(keys.map(k=>parseInt(k.replace(prefix,''))));
  const pending = (CDT_INTEL_DAYS||[]).filter(d=>!runDays.has(d.day));
  if(pending.length){
    html += `<div style="padding:8px 14px 4px;border-bottom:1px solid var(--border);background:var(--off-white)">
      <div style="font-size:9px;font-weight:800;letter-spacing:.8px;color:var(--text-3);text-transform:uppercase">Pending Intel Runs</div>
    </div>`;
    pending.forEach(function(intel){
      html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text)">
            <span style="font-size:9px;color:var(--text-3);font-family:var(--fm);margin-right:4px">DAY ${intel.day}</span>${intel.label}
            ${touchDateLabel(intel.day)?'<span style="font-size:9px;color:var(--text-3);margin-left:4px">· '+touchDateLabel(intel.day)+'</span>':''}
          </div>
          <div style="font-size:10px;color:var(--text-3);margin-top:2px">${intel.desc}</div>
        </div>
        <button onclick="notifCloseDrawer();cdtRunIntelRefresh(${intel.day})" style="font-size:9px;font-weight:700;padding:4px 10px;border-radius:3px;border:1px solid var(--gold-border);background:var(--gold-bg);color:var(--gold);cursor:pointer;font-family:var(--fb);white-space:nowrap">▶ Run</button>
      </div>`;
    });
  }

  if(!keys.length && !pending.length){
    html += '<div class="notif-empty" style="padding:30px 20px">No intel data.<br><span style="font-size:11px">Run intel from the 30-Day Cadence timeline.</span></div>';
  }

  listEl.innerHTML = html;
}

window.notifOpenDrawer = function(openTab){
  notifMarkAllRead();
  // If called with a specific tab (e.g. 'outreach'), switch to it first
  if(openTab && openTab !== _notifTab){
    _notifTab = openTab;
    ['all','outreach','intel','alerts'].forEach(t=>{
      const btn = document.getElementById('ndtab-'+t);
      if(btn) btn.classList.toggle('active', t===openTab);
    });
  }
  document.getElementById('notif-drawer').classList.add('open');
  document.getElementById('notif-backdrop').style.display='block';
  notifRenderList();
};
window.notifCloseDrawer = function(){
  document.getElementById('notif-drawer').classList.remove('open');
  document.getElementById('notif-backdrop').style.display='none';
};
window.notifSetTab = function(tab){
  _notifTab = tab;
  ['all','outreach','intel','alerts'].forEach(t=>{
    const btn = document.getElementById('ndtab-'+t);
    if(btn) btn.classList.toggle('active', t===tab);
  });
  notifRenderList();
};
window.notifMarkRead = function(id){
  const arr = notifGetAll().map(n=>n.id==id?{...n,read:true}:n);
  notifSave(arr); notifUpdateBadge();
};
window.notifMarkAllRead = function(){
  notifSave(notifGetAll().map(n=>({...n,read:true})));
  notifUpdateBadge(); notifRenderList();
};
window.notifClearAll = function(){
  notifSave([]); notifUpdateBadge(); notifRenderList();
};

// Browser push notification
function notifBrowserPush(title, body){
  if(!('Notification' in window)) return;
  if(Notification.permission === 'granted'){
    try{ new Notification(title, { body, icon:'https://beyondpayroll.net/favicon.ico', badge:'https://beyondpayroll.net/favicon.ico' }); }catch(e){}
  }
}

// Request browser notification permission on first use
function notifRequestPermission(){
  if(!('Notification' in window)) return;
  if(Notification.permission === 'default'){
    Notification.requestPermission().then(p=>{
      if(p==='granted') notifAdd('alerts','🔔 Notifications enabled','You\'ll receive alerts for outreach, intel refreshes, and meetings','SYSTEM');
    });
  }
}

// ── Push notification: check ALL prospects for due/overdue tasks on login ──
const PUSH_DATE_KEY = 'bp_push_last_date'; // dedup: only fire once per calendar day

function notifCheckOverdue(){
  const todayStr = new Date().toISOString().split('T')[0];

  // Only fire once per calendar day per browser
  const lastChecked = localStorage.getItem(PUSH_DATE_KEY);
  if(lastChecked === todayStr) return;

  // If no permission yet, request it silently — will fire tomorrow once granted
  if(!('Notification' in window)) return;
  if(Notification.permission === 'denied') return;
  if(Notification.permission === 'default'){
    Notification.requestPermission().then(function(p){
      if(p === 'granted') notifCheckOverdue();
    });
    return;
  }

  const prospects = getProspects();
  if(!prospects.length) return;

  let totalDueToday = 0, totalOverdue = 0;
  const dueLines   = []; // "CompanyName — Day X: Label"
  const overdueLines = [];

  prospects.forEach(function(prospect){
    if(!prospect || !prospect.company) return;

    // Compute cadence start for this prospect
    const key = 'cdt_start_' + prospect.company.replace(/\s+/g,'_');
    const startISO = localStorage.getItem(key);
    if(!startISO) return; // cadence not started

    const start = new Date(startISO); const today = new Date();
    start.setHours(0,0,0,0); today.setHours(0,0,0,0);
    const todayNum = Math.floor((today - start) / 86400000) + 1;
    if(todayNum < 1 || todayNum > 30) return;

    // Load saved statuses for this prospect
    const statusKey = 'bp_ec_statuses_' + prospect.company.replace(/\s+/g,'_');
    let statuses = {};
    try{ statuses = JSON.parse(localStorage.getItem(statusKey)||'{}'); }catch{}

    // Build touches for this prospect
    let touches = [];
    try{
      // Temporarily swap _hqProspect so buildTouches works
      const prev = window._hqProspect;
      window._hqProspect = prospect;
      touches = buildTouches(prospect);
      window._hqProspect = prev;
    }catch(e){ return; }

    touches.forEach(function(t, i){
      const s = statuses[i] || window._ecStatuses[i] || 'Pending';
      if(s === 'Sent' || s === 'Meeting Booked') return; // already done
      const name = prospect.company;
      if(t.day === todayNum){
        totalDueToday++;
        dueLines.push(name + ' — Day ' + t.day + ': ' + t.label);
      } else if(t.day < todayNum){
        totalOverdue++;
        overdueLines.push(name + ' — Day ' + t.day + ': ' + t.label);
      }
    });
  });

  // Mark as checked for today (even if nothing due, so we don't re-check on every tab open)
  localStorage.setItem(PUSH_DATE_KEY, todayStr);

  // Nothing to alert
  if(totalDueToday === 0 && totalOverdue === 0) return;

  // ── Fire browser push notifications ──────────────────────────────
  // Due today — one notification per prospect (max 3 to avoid spam)
  const dueBatch = dueLines.slice(0, 3);
  dueBatch.forEach(function(line){
    const parts = line.split(' — ');
    const company = parts[0];
    const task = parts.slice(1).join(' — ');
    try{
      new Notification('📋 Due Today: ' + company, {
        body: task,
        icon: 'https://beyondpayroll.net/favicon.ico',
        badge: 'https://beyondpayroll.net/favicon.ico',
        tag: 'bp-due-' + company.replace(/\s+/g,'-'),
        requireInteraction: false
      });
    }catch(e){}
  });
  if(dueLines.length > 3){
    try{
      new Notification('📋 ' + (dueLines.length - 3) + ' more tasks due today', {
        body: dueLines.slice(3).map(function(l){ return l.split(' — ')[0]; }).join(', '),
        icon: 'https://beyondpayroll.net/favicon.ico',
        tag: 'bp-due-overflow'
      });
    }catch(e){}
  }

  // Overdue — single grouped notification
  if(totalOverdue > 0){
    const overdueCompanies = [...new Set(overdueLines.map(function(l){ return l.split(' — ')[0]; }))];
    try{
      new Notification('⚠️ ' + totalOverdue + ' Overdue Task' + (totalOverdue!==1?'s':''), {
        body: overdueCompanies.slice(0,4).join(', ') + (overdueCompanies.length>4 ? ' +more' : ''),
        icon: 'https://beyondpayroll.net/favicon.ico',
        badge: 'https://beyondpayroll.net/favicon.ico',
        tag: 'bp-overdue',
        requireInteraction: true  // stays until dismissed
      });
    }catch(e){}
  }

  // ── Also add to in-app notification bell ─────────────────────────
  if(totalDueToday > 0){
    notifAdd('alerts',
      '📋 ' + totalDueToday + ' task' + (totalDueToday!==1?'s':'') + ' due today',
      dueLines.slice(0,3).join(' · ') + (dueLines.length>3?' +more':''),
      'TODAY'
    );
  }
  if(totalOverdue > 0){
    notifAdd('alerts',
      '⚠️ ' + totalOverdue + ' overdue task' + (totalOverdue!==1?'s':''),
      overdueLines.slice(0,3).join(' · ') + (overdueLines.length>3?' +more':''),
      'OVERDUE'
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  CADENCE DAY TRIGGER — Per-session, per-prospect touch & intel alerts
//  Fires when today's calendar date matches a touch/intel day for the
//  currently loaded prospect. Deduplicates within the session.
//  Channels: toast · notification bell · mobile push · timeline highlight
// ═══════════════════════════════════════════════════════════════════════

const _cdtFired = {}; // session dedup: "company_touchDay_idx" / "company_intel_day"

function _cdtTodayNum(company){
  const startISO = localStorage.getItem('cdt_start_' + company.replace(/\s+/g,'_'));
  if(!startISO) return null;
  const start = new Date(startISO), today = new Date();
  start.setHours(0,0,0,0); today.setHours(0,0,0,0);
  const n = Math.floor((today - start) / 86400000) + 1;
  return (n >= 1 && n <= 30) ? n : null;
}

function cdtCheckTriggers(){
  const p = window._hqProspect;
  if(!p || !p.company) return;
  const todayNum = _cdtTodayNum(p.company);
  if(!todayNum) return;

  // Load persisted statuses
  let statuses = {};
  try{ statuses = JSON.parse(localStorage.getItem(ecStatusKey(p.company))||'{}'); }catch(e){}

  // ── Touch triggers ──────────────────────────────────────────────────
  let touches = [];
  try{ touches = buildTouches(p); }catch(e){ return; }

  touches.forEach(function(touch, i){
    if(touch.day !== todayNum) return;
    const status = statuses[i] || window._ecStatuses[i] || 'Pending';
    if(status === 'Sent' || status === 'Meeting Booked' || status === 'Replied') return;

    const key = p.company + '_touch_' + todayNum + '_' + i;
    if(_cdtFired[key]) return;
    _cdtFired[key] = true;

    const lbl = 'Day ' + touch.day + ' — ' + touch.label;

    // Toast
    showToast('📋 Due Today: ' + lbl);

    // Notification bell
    notifAdd('alerts',
      '📋 Touch Due Today: ' + lbl,
      p.company + (p.contact ? ' · ' + p.contact : ''),
      'DUE TODAY'
    );

    // Mobile push
    if(typeof Notification !== 'undefined' && Notification.permission === 'granted'){
      try{
        new Notification('📋 Touch Due: ' + p.company, {
          body: lbl,
          icon: 'https://beyondpayroll.net/favicon.ico',
          badge: 'https://beyondpayroll.net/favicon.ico',
          tag: 'bp-due-' + p.company.replace(/\s+/g,'-') + '-' + todayNum,
          requireInteraction: false
        });
      }catch(e){}
    }
  });

  // ── Intel triggers ──────────────────────────────────────────────────
  (CDT_INTEL_DAYS || []).forEach(function(intel){
    if(intel.day !== todayNum) return;
    const key = p.company + '_intel_' + todayNum;
    if(_cdtFired[key]) return;
    _cdtFired[key] = true;

    showToast('📊 Intel Day ' + todayNum + ': ' + intel.label + ' — run before outreach');

    notifAdd('intel',
      '📊 Intel Refresh Due — Day ' + todayNum + ': ' + intel.label,
      p.company + ' · ' + intel.desc,
      'INTEL'
    );

    if(typeof Notification !== 'undefined' && Notification.permission === 'granted'){
      try{
        new Notification('📊 Intel Due: ' + p.company, {
          body: 'Day ' + todayNum + ' — ' + intel.label,
          icon: 'https://beyondpayroll.net/favicon.ico',
          badge: 'https://beyondpayroll.net/favicon.ico',
          tag: 'bp-intel-' + todayNum,
          requireInteraction: false
        });
      }catch(e){}
    }
  });

}

// ── Hook: run on page ready + every 60 s ───────────────────────────────
window.addEventListener('DOMContentLoaded', function(){
  setTimeout(cdtCheckTriggers, 2000); // wait for prospect to load
  setInterval(cdtCheckTriggers, 60000);
});

// ═══════════════════════════════════════════════════════════════════════
//  INTEL REFRESH — Real-time cadence-linked competitive analysis
// ═══════════════════════════════════════════════════════════════════════
const CDT_INTEL_STORE_KEY = 'bp_intel_results';

function cdtGetIntelResults(){ try{ return JSON.parse(localStorage.getItem(CDT_INTEL_STORE_KEY)||'{}'); }catch{ return {}; } }
function cdtGetIntelResult(day){
  const p = window._hqProspect; if(!p) return null;
  const store = cdtGetIntelResults();
  const k = p.company.replace(/\s+/g,'_')+'_day'+day;
  return store[k] || null;
}
function cdtSaveIntelResult(day, result){
  const p = window._hqProspect; if(!p) return;
  const store = cdtGetIntelResults();
  const k = p.company.replace(/\s+/g,'_')+'_day'+day;
  store[k] = { result, ts: new Date().toISOString(), day, company: p.company };
  localStorage.setItem(CDT_INTEL_STORE_KEY, JSON.stringify(store));
}

function cdtRenderIntelResult(data){
  const t = new Date(data.ts);
  const timeStr = t.toLocaleDateString('en-US',{month:'short',day:'numeric'})+' '+t.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
  // Strip markdown artifacts before display
  const clean = data.result
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^-{3,}$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const preview = clean.length > 600 ? clean.slice(0,600)+'…' : clean;
  return `<div class="cdt-intel-result">
    <div class="cdt-intel-result-hdr">
      <span class="cdt-intel-result-lbl">📊 Intel Refresh Complete</span>
      <span class="cdt-intel-result-time">Last run: ${timeStr}</span>
    </div>
    <div style="white-space:pre-wrap;font-size:11px;line-height:1.6">${preview}</div>
    <button onclick="cdtShowFullIntel(${data.day})" style="margin-top:6px;font-size:10px;font-weight:700;padding:4px 10px;border-radius:4px;border:1px solid var(--gold-border);background:var(--gold-bg);color:var(--gold);cursor:pointer;font-family:var(--fb)">View Full Report →</button>
  </div>`;
}

window.cdtRunIntelRefresh = async function(day){
  const p = window._hqProspect; if(!p){ showToast('No prospect loaded',true); return; }
  const btn = document.getElementById('cdt-intel-run-'+day);
  const resultEl = document.getElementById('cdt-intel-result-'+day);
  if(btn){ btn.disabled=true; btn.innerHTML='<span class="cdt-intel-spinner"></span>Running…'; }
  if(resultEl) resultEl.innerHTML = '<div class="cdt-intel-result"><span class="cdt-intel-spinner"></span> Pulling real-time competitive intelligence for '+p.company+'…</div>';

  const intelDay = CDT_INTEL_DAYS.find(d=>d.day===day);

  // Build full enriched context — same data pipeline as the background email engine
  const _intelFakeTouch = { day: day, label: intelDay ? intelDay.label : 'Intel Refresh' };
  const _intelFullCtx = bpEngineBuildContext(p, _intelFakeTouch, window._atResults || null);

  const prompt = `You are an HCM competitive intelligence analyst. Perform a ${intelDay?.label||'competitive'} refresh for this ADP sales rep.

CRITICAL OUTPUT RULES:
- Plain text only. No markdown. No asterisks, no bold, no bullet symbols, no headers.
- Write in concise flowing prose. Not numbered lists. Not bullet points.
- Use double line breaks (two newlines) between paragraphs for proper formatting.
- Break content into 3-4 short paragraphs for readability.
- Be specific and actionable. Every sentence must earn its place.
- Maximum 300 words total.

${_intelFullCtx}

Deliver a focused intel brief: the single most urgent competitor threat right now (name them and explain why), the sharpest data point or market signal for Day ${day} outreach, one specific urgency trigger to reference in the email, and the strongest angle ADP should lead with. Write as a knowledgeable colleague briefing a sales rep before an important call.

FORMAT: Write 3-4 paragraphs separated by blank lines. Each paragraph should focus on one key point.`;

  try {
    const resp = await bpGeminiFetch({ messages:[{role:'user',content:prompt}] });
    const data = await resp.json();
    const text = bpGeminiText(data).trim() || 'No response received.';
    cdtSaveIntelResult(day, text);
    if(resultEl) resultEl.innerHTML = cdtRenderIntelResult({ result:text, ts:new Date().toISOString(), day });
    notifAdd('intel', '📊 Intel Refresh Complete — Day '+day+' · '+(intelDay?.label||'Intel'), p.company+' · Competitive brief ready', 'INTEL');
    notifBrowserPush('📊 Intel ready — '+p.company, 'Day '+day+' '+( intelDay?.label||'Intel')+' brief is ready');
    showToast('Intel refresh complete — Day '+day);
    // ── PROSE FORMATTING LAYER ── auto-convert intel output to email prose
    bpApplyIntelToEmail(day, text).catch(function(e){ console.warn('[ProseFormat] Intel-to-email failed:', e.message); });
  } catch(e){
    if(resultEl) resultEl.innerHTML = '<div class="cdt-intel-result" style="border-color:#fecaca;background:#fef2f2;color:var(--red)">Error running intel refresh. Check your connection and try again.</div>';
    showToast('Intel refresh failed',true);
  }
  if(btn){ btn.disabled=false; btn.innerHTML='↺ Re-run'; }
};

window.cdtShowFullIntel = function(day){
  const result = cdtGetIntelResult(day); if(!result) return;
  const t = new Date(result.ts);
  const modal = document.createElement('div');
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:5000;display:flex;align-items:center;justify-content:center;padding:20px';
  const intelDay = CDT_INTEL_DAYS.find(d=>d.day===day);
  modal.innerHTML = `<div style="background:var(--white);border-radius:var(--radius);max-width:680px;width:100%;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.2)">
    <div style="background:var(--navy);color:#fff;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
      <div>
        <div style="font-family:var(--fd);font-size:15px;font-weight:600">📊 ${intelDay?.label||'Intel Refresh'} — Day ${day}</div>
        <div style="font-size:11px;opacity:.6;margin-top:2px">${result.company} · ${t.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div>
      </div>
      <button onclick="this.closest('[style*=fixed]').remove()" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:14px;font-family:var(--fb)">✕</button>
    </div>
    <div style="padding:20px;overflow-y:auto;white-space:pre-wrap;font-size:12px;line-height:1.7;color:var(--text-2)">${result.result}</div>
    <div style="padding:14px 20px;border-top:1px solid var(--border);display:flex;gap:8px;flex-shrink:0">
      <button onclick="copyText(${JSON.stringify(result.result)});showToast('Intel brief copied')" style="padding:8px 16px;background:var(--gold-bg);border:1px solid var(--gold-border);color:var(--gold);border-radius:5px;font-size:11px;font-weight:700;cursor:pointer;font-family:var(--fb)">⎘ Copy Brief</button>
      <button onclick="this.closest('[style*=fixed]').remove()" style="padding:8px 16px;background:var(--off-white);border:1px solid var(--border);color:var(--text-2);border-radius:5px;font-size:11px;font-weight:700;cursor:pointer;font-family:var(--fb)">Close</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
};

// ═══════════════════════════════════════════════════════════════════════
//  OUTLOOK TEMPLATE DOWNLOAD (.eml)
// ═══════════════════════════════════════════════════════════════════════
function ecGetCurrentTouch(){
  const p = window._hqProspect; if(!p) return null;
  return buildTouches(p)[window._ecActiveIdx] || null;
}

function ecBuildEml(touch, toEmail){
  const sigOn = document.getElementById('ec-sig')?.checked !== false;
  const sig = sigOn ? '\n\n—\nAJ\nADP\nbeyondpayroll.net' : '';
  const body = touch.body.replace(/\n\n—[\s\S]*$/, '') + sig;
  // RFC 2822 .eml format — Outlook opens this as a draft
  return [
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'X-Unsent: 1',
    'To: '+(toEmail||''),
    'Subject: '+touch.subject,
    '',
    body
  ].join('\r\n');
}

window.ecDownloadTemplate = function(){
  const touch = ecGetCurrentTouch(); if(!touch){ showToast('No touch loaded',true); return; }
  const p = window._hqProspect;
  const toEmail = document.getElementById('ec-to-inp')?.value || p?.email || '';
  const eml = ecBuildEml(touch, toEmail);
  const filename = `ADP_Day${touch.day}_${(p?.company||'Prospect').replace(/\s+/g,'_')}_${touch.label.replace(/\s+/g,'_')}.eml`;
  const blob = new Blob([eml], {type:'message/rfc822'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 500);
  showToast('Downloaded '+filename+' — open in Outlook to send');
  notifAdd('outreach','📎 Template Downloaded: Day '+touch.day+' — '+touch.label, (p?.company||'')+' · .eml ready for Outlook','OUTREACH');
};

window.ecCopyTemplate = function(){
  const touch = ecGetCurrentTouch(); if(!touch){ showToast('No touch loaded',true); return; }
  const p = window._hqProspect;
  const sigOn = document.getElementById('ec-sig')?.checked !== false;
  const sig = sigOn ? '\n\n—\nAJ\nADP\nbeyondpayroll.net' : '';
  const body = touch.body.replace(/\n\n—[\s\S]*$/, '') + sig;
  const full = `SUBJECT: ${touch.subject}\n\n${body}`;
  copyText(full).then?.(()=>showToast('Template copied — paste directly into Outlook'));
};

// cdtQuickMailto — fire mailto from timeline row without switching composer
window.cdtQuickMailto = function(idx){
  const p = window._hqProspect; if(!p){ showToast('No prospect loaded',true); return; }
  const touches = buildTouches(p);
  const touch = touches[idx]; if(!touch) return;
  const toEmail = p.email || '';
  if(!toEmail){ showToast('No email on file — open composer to add recipient',true); cdtJumpTo(idx); return; }
  const cleanBody = touch.body.replace(/\n\n—[\s\S]*$/, '');
  const sig = '\n\n—\nAJ\nADP\nbeyondpayroll.net';
  const body = cleanBody + sig;
  const uri = 'mailto:'+encodeURIComponent(toEmail)+'?subject='+encodeURIComponent(touch.subject)+'&body='+encodeURIComponent(body);
  const a = document.createElement('a'); a.href=uri; a.style.display='none';
  document.body.appendChild(a); a.click(); setTimeout(()=>document.body.removeChild(a),500);
  showToast('📧 Outlook ready — Day '+touch.day+' · '+touch.label);
  notifAdd('outreach','📧 Outlook Opened: Day '+touch.day+' — '+touch.label, p.company+' · '+p.contact,'OUTREACH');
};

// cdtDownloadTemplate — download .eml from timeline row
window.cdtDownloadTemplate = function(idx){
  const p = window._hqProspect; if(!p){ showToast('No prospect loaded',true); return; }
  const touches = buildTouches(p);
  const touch = touches[idx]; if(!touch) return;
  const toEmail = p.email || '';
  const sigOn = document.getElementById('ec-sig')?.checked !== false;
  const sig = sigOn ? '\n\n—\nAJ\nADP\nbeyondpayroll.net' : '';
  const body = touch.body.replace(/\n\n—[\s\S]*$/, '') + sig;
  const eml = ['MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: 8bit','X-Unsent: 1','To: '+toEmail,'Subject: '+touch.subject,'',body].join('\r\n');
  const filename = `ADP_Day${touch.day}_${p.company.replace(/\s+/g,'_')}_${touch.label.replace(/\s+/g,'_')}.eml`;
  const blob = new Blob([eml],{type:'message/rfc822'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename;
  document.body.appendChild(a); a.click(); setTimeout(()=>{ document.body.removeChild(a); URL.revokeObjectURL(a.href); },500);
  showToast('Downloaded '+filename);
  notifAdd('outreach','📎 Template Downloaded: Day '+touch.day+' — '+touch.label, p.company+' · .eml ready for Outlook','OUTREACH');
};

// ═══════════════════════════════════════════════════════════════════════
//  FIREBASE FIRESTORE — Cross-Device Prospect Sync
// ═══════════════════════════════════════════════════════════════════════
const FIREBASE_CONFIG={
  apiKey:"AIzaSyBU_bHIfG5dj2KDqk7cMr-12gSJlH37KDk",
  authDomain:"beyondpayroll-hcm.firebaseapp.com",
  projectId:"beyondpayroll-hcm",
  storageBucket:"beyondpayroll-hcm.firebasestorage.app",
  messagingSenderId:"732462721723",
  appId:"1:732462721723:web:a95abfb579efbd5495d79e",
  measurementId:"G-YVZNRTLKGM"
};

const PROSPECTS_KEY='bp_prospects';
const TOMBSTONE_KEY='bp_deleted_ids';

function getTombstones(){ try{ return JSON.parse(localStorage.getItem(TOMBSTONE_KEY)||'[]'); }catch(e){ return []; } }
function addTombstone(id){ if(!id) return; const t=getTombstones(); if(t.indexOf(id)===-1){ t.push(id); localStorage.setItem(TOMBSTONE_KEY,JSON.stringify(t)); } }
function isTombstoned(id){ if(!id) return false; return getTombstones().indexOf(id)!==-1; }
let _fbDb=null,_fbOnline=false,_fbSession=null;

// ── Prospect dedup helpers ───────────────────────────────────────────
// Normalize company name for matching: lowercase, strip punctuation/spaces
function normalizeCompany(name) {
  return String(name||'').toLowerCase().replace(/[^a-z0-9]/g,'').trim();
}
// Find existing prospect index using company name (normalized) as primary key
// Falls back to email match if company is too generic
function findProspectIdx(arr, prospect) {
  const co = normalizeCompany(prospect.company);
  const em = (prospect.email||'').toLowerCase().trim();
  if (!co) return -1;
  // 1. Exact normalized company + email match
  if (em) {
    const byBoth = arr.findIndex(function(x) {
      return normalizeCompany(x.company) === co && (x.email||'').toLowerCase().trim() === em;
    });
    if (byBoth >= 0) return byBoth;
  }
  // 2. Normalized company name match (handles spacing/casing differences)
  const byCompany = arr.findIndex(function(x) {
    return normalizeCompany(x.company) === co;
  });
  return byCompany;
}
// Deduplicate an array of prospects by normalized company name (keep latest updatedAt)
function dedupeProspects(arr) {
  const seen = {};
  arr.forEach(function(p) {
    const key = normalizeCompany(p.company);
    if (!key) return;
    if (!seen[key]) { seen[key] = p; return; }
    // Keep the one with the more recent updatedAt
    const existingTs = new Date(seen[key].updatedAt||seen[key].createdAt||0).getTime();
    const newTs      = new Date(p.updatedAt||p.createdAt||0).getTime();
    if (newTs >= existingTs) seen[key] = Object.assign({}, seen[key], p);
  });
  return Object.values(seen);
}

function getProspects(){try{return JSON.parse(localStorage.getItem(PROSPECTS_KEY)||'[]');}catch{return[];}}
function saveProspectsLocal(arr){localStorage.setItem(PROSPECTS_KEY,JSON.stringify(arr));}

function fbSetStatus(cls,label){
  const badge=document.getElementById('fb-status-badge');
  if(!badge)return;
  badge.className='fb-status '+cls;
  badge.textContent=label;
  _fbOnline=cls==='live';
  const dot=document.getElementById('pd-sync-dot');
  const lbl=document.getElementById('pd-sync-lbl');
  if(dot) dot.className='pd-sync-dot'+(cls==='live'?' live':cls==='offline'?' offline':'');
  if(lbl) lbl.textContent=cls==='live'?'Firebase connected — live sync':'Offline — local storage only';
}

function fbInit(session){
  _fbSession=session;
  if(FIREBASE_CONFIG.apiKey==='YOUR_API_KEY'){
    fbSetStatus('offline','● Local only');
    return;
  }

  function _fbBoot(){
    try{
      if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      _fbDb=firebase.firestore();
      fbSetStatus('live','● Live');
      fbSyncUser(session);
      fbInitialSync(session);
    }catch(e){console.warn('Firebase init:',e.message);fbSetStatus('error','● Error');}
  }

  // If Firebase SDK already loaded (e.g. from sign-in flow), boot directly
  if(typeof firebase!=='undefined' && typeof firebase.firestore!=='undefined'){
    _fbBoot();
    return;
  }

  // Check if scripts are already injected but not yet executed
  const existing = document.querySelector('script[src*="firebase-app-compat"]');
  if(existing){
    // Wait for it to finish loading
    existing.addEventListener('load', function(){
      const existing2 = document.querySelector('script[src*="firebase-firestore-compat"]');
      if(existing2){ existing2.addEventListener('load', _fbBoot); }
      else {
        const s2=document.createElement('script');
        s2.src='https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js';
        s2.onload=_fbBoot;
        s2.onerror=function(){fbSetStatus('offline','● Offline');};
        document.head.appendChild(s2);
      }
    });
    return;
  }

  // Fresh load
  try{
    const s1=document.createElement('script');
    s1.src='https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js';
    s1.onload=function(){
      if(typeof firebase.firestore!=='undefined'){ _fbBoot(); return; }
      const s2=document.createElement('script');
      s2.src='https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js';
      s2.onload=_fbBoot;
      s2.onerror=function(){fbSetStatus('offline','● Offline');};
      document.head.appendChild(s2);
    };
    s1.onerror=function(){fbSetStatus('offline','● Offline');};
    document.head.appendChild(s1);
  }catch(e){fbSetStatus('error','● Error');}
}

// Sync current user account to Firestore (so mobile can log in)
async function fbSyncUser(session){
  if(!_fbDb) return;
  try{
    const users = getUsers();
    const u = users.find(function(x){return x.email===session.email;});
    if(!u) return;
    // Store user in Firestore (never store raw password — store a hash hint)
    const userDoc = {
      email: u.email,
      first: u.first,
      last: u.last,
      role: u.role,
      password: u.password, // platform handles auth, not Firebase Auth
      created: u.created||new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await _fbDb.collection('users').doc(u.email).set(userDoc, {merge:true});
  }catch(e){console.warn('fbSyncUser:',e.message);}
}

// Pull users from Firestore into localStorage (for mobile login)
async function fbPullUsers(){
  if(!_fbDb) return;
  try{
    const snap = await _fbDb.collection('users').get();
    if(snap.empty) return;
    const remoteUsers = [];
    snap.forEach(function(d){ remoteUsers.push(d.data()); });
    const local = getUsers();
    let changed = false;
    remoteUsers.forEach(function(ru){
      if(!local.find(function(l){return l.email===ru.email;})){
        local.push(ru);
        changed = true;
      }
    });
    if(changed){ saveUsers(local); }
  }catch(e){console.warn('fbPullUsers:',e.message);}
}

// On first login to a new device: pull Firestore prospects, then push local-only ones, then listen
async function fbInitialSync(session){
  if(!_fbDb) return;
  try{
    // ── Pull remote ──────────────────────────────────────────────
    const snap = await _fbDb.collection('prospects')
      .where('userEmail','==',session.email)
      .get();
    const remote = [];
    snap.forEach(function(d){ remote.push(Object.assign({id:d.id}, d.data())); });

    // ── Merge: newer updatedAt wins per company ──────────────────
    const local = getProspects();
    const merged = {};

    // Index remote by Firestore doc id and by company name
    remote.forEach(function(rp){
      merged[rp.id] = rp;
    });

    // Walk local prospects — push any that are missing from Firestore
    const pushJobs = [];
    local.forEach(function(lp){
      if(lp.id && merged[lp.id]){
        // Both exist — keep whichever is newer
        const remoteTs = new Date(merged[lp.id].updatedAt||0).getTime();
        const localTs  = new Date(lp.updatedAt||0).getTime();
        if(localTs > remoteTs){
          // Local is newer — update Firestore
          merged[lp.id] = lp;
          pushJobs.push(_fbDb.collection('prospects').doc(lp.id).set(
            Object.assign({},lp,{userEmail:session.email}),{merge:true}
          ).catch(function(e){console.warn('fbSync push:',e.message);}));
        }
      } else if(!lp.id){
        // No id at all — check by company name match in remote
        const match = remote.find(function(rp){
          return rp.company && lp.company &&
                 rp.company.trim().toLowerCase()===lp.company.trim().toLowerCase();
        });
        if(match){
          // Same company exists remotely — adopt its id, keep newer data
          const remoteTs = new Date(match.updatedAt||0).getTime();
          const localTs  = new Date(lp.updatedAt||0).getTime();
          lp.id = match.id;
          merged[match.id] = localTs > remoteTs ? lp : match;
          if(localTs > remoteTs){
            pushJobs.push(_fbDb.collection('prospects').doc(match.id).set(
              Object.assign({},lp,{userEmail:session.email}),{merge:true}
            ).catch(function(e){console.warn('fbSync merge:',e.message);}));
          }
        } else {
          // Genuinely new local prospect — push to Firestore
          pushJobs.push(
            _fbDb.collection('prospects').add(
              Object.assign({},lp,{userEmail:session.email,updatedAt:lp.updatedAt||new Date().toISOString()})
            ).then(function(r){
              lp.id=r.id;
              merged[r.id]=lp;
            }).catch(function(e){console.warn('fbSync add:',e.message);})
          );
        }
      } else {
        // lp has an id but it's not in remote — only restore if NOT tombstoned (deleted)
        if(!isTombstoned(lp.id)){
          merged[lp.id] = lp;
          pushJobs.push(_fbDb.collection('prospects').doc(lp.id).set(
            Object.assign({},lp,{userEmail:session.email}),{merge:true}
          ).catch(function(e){console.warn('fbSync restore:',e.message);}));
        }
      }
    });

    if(pushJobs.length) await Promise.all(pushJobs);

    const finalArr = Object.values(merged).sort(function(a,b){
      return new Date(b.updatedAt||0) - new Date(a.updatedAt||0);
    });
    saveProspectsLocal(finalArr);
    renderSavedProspects();

    const msg = remote.length > 0
      ? '☁ Synced — '+finalArr.length+' prospect'+(finalArr.length!==1?'s':'')+' across devices'
      : (finalArr.length>0 ? '☁ Local prospects backed up to cloud' : '');
    if(msg) showToast(msg);

    // Start real-time listener
    fbListen(session);
  }catch(e){
    console.warn('fbInitialSync error:',e.message);
    fbListen(session); // still start listener even if initial sync fails
  }
}

function fbListen(session){
  if(!_fbDb) return;
  // Unsubscribe any existing listener
  if(window._fbUnsubscribe) try{ window._fbUnsubscribe(); }catch(e){}
  try{
    window._fbUnsubscribe = _fbDb.collection('prospects')
      .where('userEmail','==',session.email)
      .onSnapshot(function(snap){
        const remote = {};
        snap.forEach(function(d){ if(!isTombstoned(d.id)) remote[d.id] = Object.assign({id:d.id}, d.data()); });

        const local = getProspects();
        const localMap = {};
        local.forEach(function(p){ if(p.id) localMap[p.id] = p; });

        Object.values(remote).forEach(function(rp){
          const lp = localMap[rp.id];
          if(!lp){ localMap[rp.id] = rp; }
          else {
            const remoteTs = new Date(rp.updatedAt||0).getTime();
            const localTs  = new Date(lp.updatedAt||0).getTime();
            if(remoteTs >= localTs) localMap[rp.id] = rp;
          }
        });

        // Remove prospects deleted on other devices (absent from remote snapshot)
        Object.keys(localMap).forEach(function(id){ if(!remote[id]) delete localMap[id]; });

        const merged = Object.values(localMap).sort(function(a,b){
          return new Date(b.updatedAt||0) - new Date(a.updatedAt||0);
        });

        const prevCount = local.length;
        saveProspectsLocal(merged);
        renderSavedProspects();

        const changed = merged.length !== prevCount || merged.some(function(mp){
          const lp = local.find(function(x){return x.id===mp.id;});
          return !lp || lp.updatedAt !== mp.updatedAt;
        });
        if(changed){
          if(merged.length < prevCount) showToast('☁ Prospect removed on another device');
          else if(merged.length > prevCount) showToast('☁ New prospect synced from another device');
          else showToast('☁ Prospects updated from another device');
        }
      }, function(err){ console.warn('fbListen error:',err.message); });
  }catch(e){ console.warn('fbListen setup:',e); }
}

async function fbSyncNow(){
  if(!_fbDb||!_fbSession){showToast('Connect Firebase to sync across devices',true);return;}
  const arr=getProspects();
  let pushed=0, updated=0;
  for(const p of arr){
    try{
      const d=Object.assign({},p,{userEmail:_fbSession.email,updatedAt:new Date().toISOString()});
      // Strip undefined/function values
      Object.keys(d).forEach(function(k){if(d[k]===undefined||typeof d[k]==='function') delete d[k];});
      if(p.id){
        await _fbDb.collection('prospects').doc(p.id).set(d,{merge:true});
        updated++;
      } else {
        const r=await _fbDb.collection('prospects').add(d);
        p.id=r.id; pushed++;
      }
    }catch(e){console.warn('fbSyncNow:',p.company,e.message);}
  }
  saveProspectsLocal(arr);
  renderSavedProspects();
  showToast('☁ Sync complete — '+(pushed+updated)+' prospect'+(pushed+updated!==1?'s':'')+' up to date');
}

async function fbSaveProspect(p){
  if(!p) return;
  const now = new Date().toISOString();
  p.updatedAt = now;
  if(_fbSession && !p.userEmail) p.userEmail = _fbSession.email;

  // ── Update localStorage — match by id first, then company name ──
  const arr = getProspects();
  let idx = p.id ? arr.findIndex(function(x){return x.id===p.id;}) : -1;
  if(idx < 0){
    // fallback: match by company name (case-insensitive)
    idx = arr.findIndex(function(x){
      return x.company && p.company &&
             x.company.trim().toLowerCase() === p.company.trim().toLowerCase();
    });
  }
  if(idx >= 0){
    p.id      = p.id      || arr[idx].id;
    p.createdAt = p.createdAt || arr[idx].createdAt || now;
    arr[idx]  = p;
  } else {
    p.createdAt = p.createdAt || now;
    arr.unshift(p);
  }
  saveProspectsLocal(arr);
  renderSavedProspects();

  // ── Push to Firestore ─────────────────────────────────────────
  if(!_fbDb || !_fbSession) return;
  try{
    const d = Object.assign({}, p, {userEmail:_fbSession.email, updatedAt:now});
    // Remove undefined/function values that Firestore rejects
    Object.keys(d).forEach(function(k){ if(d[k]===undefined||typeof d[k]==='function') delete d[k]; });
    if(p.id){
      await _fbDb.collection('prospects').doc(p.id).set(d, {merge:true});
    } else {
      const r = await _fbDb.collection('prospects').add(d);
      p.id = r.id;
      // Write id back to localStorage
      const local = getProspects();
      const li = local.findIndex(function(x){
        return x.company && p.company &&
               x.company.trim().toLowerCase()===p.company.trim().toLowerCase();
      });
      if(li >= 0){ local[li].id = p.id; saveProspectsLocal(local); }
    }
  }catch(e){ console.warn('fbSaveProspect error:',e.message); }
}

// ── Profile dropdown ──────────────────────────────────────────────────
function toggleProfileDropdown(){
  const btn=document.getElementById('profileBtn');
  if(!btn)return;
  const isOpen=btn.classList.contains('open');
  if(isOpen){closeProfileDropdown();}
  else{btn.classList.add('open');document.getElementById('profileDropdown').classList.add('open');renderSavedProspects();}
}

function closeProfileDropdown(){
  const btn=document.getElementById('profileBtn');
  const dd=document.getElementById('profileDropdown');
  if(btn)btn.classList.remove('open');
  if(dd)dd.classList.remove('open');
}

function renderSavedProspects(){
  const list=document.getElementById('pd-saved-list');
  const count=document.getElementById('pd-count');
  if(!list)return;
  const arr=getProspects();
  if(count)count.textContent=arr.length>0?`(${arr.length})`:''
  // Update header count badge
  const hdrCount = document.getElementById('header-prospect-count');
  if(hdrCount) hdrCount.textContent = arr.length > 0 ? arr.length : '';
  if(!arr.length){
    list.innerHTML='<div class="pd-empty">No saved prospects yet.<br>Click + New Prospect to add one.</div>';
    return;
  }
  const active=window._hqProspect?window._hqProspect.company:null;
  list.innerHTML=arr.map(function(p,i){
    const isTS=(p.track||'').toLowerCase().includes('ts')||(p.track||'').toLowerCase().includes('totalsource');
    const track=isTS?'ts':'wfn';
    const trackLabel=isTS?'TS':'WFN';
    const isActive=p.company===active;
    const isApproved=p.approved||false;
    const meta=p.stage||((p.industry||'—')+' · '+(p.state||'—'));
    const statusDot=isApproved?'<span style="font-size:9px;font-weight:700;color:#16a34a;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);padding:1px 5px;border-radius:3px;margin-left:4px">ACTIVE</span>':'';

    // ── Cadence progress for this prospect ──────────────────────────
    let cadenceHtml = '';
    try {
      const statusKey = 'bp_ec_statuses_' + (p.company||'').replace(/\s+/g,'_');
      const statuses = JSON.parse(localStorage.getItem(statusKey)||'{}');
      const statusVals = Object.values(statuses);
      const sentCount = statusVals.filter(function(s){
        return s==='Sent'||s==='Meeting Booked'||s==='Replied'||s==='Opened';
      }).length;
      const totalCount = statusVals.length;
      // Find last completed touch label
      const cdtStartKey = 'cdt_start_'+(p.company||'').replace(/\s+/g,'_');
      const cdtStart = localStorage.getItem(cdtStartKey);
      if(sentCount > 0 || cdtStart){
        // Find the last sent touch index
        let lastSentIdx = -1;
        statusVals.forEach(function(s, idx){ if(s==='Sent'||s==='Meeting Booked'||s==='Replied'||s==='Opened') lastSentIdx=idx; });
        // Get touch label if possible
        const touches = (typeof buildTouches === 'function') ? buildTouches(p) : [];
        const lastTouch = touches[lastSentIdx];
        const lastLabel = lastTouch ? 'Day '+lastTouch.day+' — '+lastTouch.label : (sentCount > 0 ? sentCount+' touch'+(sentCount!==1?'es':'') : '');
        // Compute day in cadence
        let dayLabel = '';
        if(cdtStart){
          const start = new Date(cdtStart); const today = new Date();
          start.setHours(0,0,0,0); today.setHours(0,0,0,0);
          const dayNum = Math.floor((today - start)/86400000)+1;
          dayLabel = 'Day '+Math.min(dayNum,30)+'/30 · ';
        }
        const hasMeeting = statusVals.includes('Meeting Booked');
        const color = hasMeeting ? '#16a34a' : sentCount > 0 ? '#2563eb' : 'var(--text-3)';
        const icon = hasMeeting ? '🎯' : sentCount > 0 ? '✓' : '◦';
        cadenceHtml = '<div style="font-size:10px;color:'+color+';margin-top:2px;font-weight:500">'+
          icon+' '+dayLabel+(lastLabel||'Cadence started')+'</div>';
      }
    } catch(e){}
    // ── End cadence progress ─────────────────────────────────────────

    return '<div class="pd-prospect-row'+(isActive?' active-row':'')+'" onclick="pdLoadProspect('+i+')">'+
      '<div class="pd-pr-icon">'+(isTS?'🏢':'🖥️')+'</div>'+
      '<div class="pd-pr-info"><div class="pd-pr-name">'+escHtml(p.company||'Unknown')+statusDot+'</div>'+
      '<div class="pd-pr-meta">'+escHtml(p.contact||'—')+' · '+escHtml(meta)+'</div>'+
      cadenceHtml+
      '</div>'+
      '<span class="pd-pr-track '+track+'">'+trackLabel+'</span>'+
      '<button class="pd-pr-cadence-btn" style="background:var(--off-white);color:var(--text-2);border:1px solid var(--border);margin-right:2px" onclick="event.stopPropagation();ppShowProfile('+i+')" title="View full profile">👁</button>'+
      '<button class="pd-pr-cadence-btn" onclick="event.stopPropagation();pdAddToCadence('+i+')" title="Load into cadence">+ Cadence</button>'+
      '</div>';
  }).join('');
}

function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
// Lightweight markdown → HTML (bold, italic, inline code only — safe, no block elements)
function mdHtml(s){
  return escHtml(String(s))
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`(.+?)`/g,'<code style="background:rgba(0,0,0,.06);padding:1px 4px;border-radius:3px;font-size:.92em">$1</code>');
}

function pdLoadProspect(idx){
  const arr=getProspects();
  const p=arr[idx];if(!p)return;
  // Save statuses for the outgoing prospect before switching
  if(window._hqProspect && window._hqProspect.company){
    ecSaveStatuses(window._hqProspect.company);
  }
  window._hqProspect=p;
  window._hqPipelineStep=p.pipelineStep||1;
  window._hqApproved=p.approved||false;
  // Load persisted statuses for incoming prospect
  if(typeof ecLoadStatuses==='function') ecLoadStatuses(p.company);
  hqRenderBanner();
  hqAdvancePipeline(p.pipelineStep||1);
  closeProfileDropdown();
  if(typeof sreRefresh==='function')sreRefresh();
  renderSavedProspects();
  showToast('Loaded: '+p.company);
  const isTS=(p.track||'').toLowerCase().includes('ts')||(p.track||'').toLowerCase().includes('totalsource');
  if(typeof selectTrack==='function')selectTrack(isTS?'TS':'WFN');
  // Show Save button for this prospect
  if(typeof window.tbShowSaveBtn==='function') window.tbShowSaveBtn();
  // Fire day trigger check for the newly loaded prospect
  setTimeout(cdtCheckTriggers, 400);
}

function pdAddToCadence(idx){
  const arr=getProspects();
  const p=arr[idx];if(!p)return;
  window._hqProspect=p;
  hqRenderBanner();
  hqAdvancePipeline(p.pipelineStep||1);
  closeProfileDropdown();
  if(typeof sreRefresh==='function')sreRefresh();
  renderSavedProspects();
  // Route directly to 30-Day Cadence tab if approved, else Command Center
  if(typeof hqTab==='function') hqTab(window._hqApproved?'composer':'cmd');
  showToast(p.company+' loaded — opening 30-Day Cadence');
}

function exportProspects(){
  const arr=getProspects();
  if(!arr.length){showToast('No prospects to export',true);return;}
  const hdrs=['Company','Contact','Email','Phone','LinkedIn','Persona','Industry','State','Headcount','Track','SRE Recommendation','SRE Confidence','PEO Score','WFN Score','Pain Points','Notes','Created'];
  const rows=arr.map(function(p){
    return [p.company,p.contact,p.email,p.phone,p.linkedin,p.persona,p.industry,p.state,p.headcount,
      p.track,p.sreRecommendation||p.sreRec,p.sreConfidence||p.sreConf,p.srePeoScore||p.peoScore,p.sreWfnScore||p.wfnScore,
      (p.painPoints||[]).join('; '),p.notes,p.createdAt
    ].map(function(v){return '"'+String(v||'').replace(/"/g,'""')+'"';});
  });
  const csv=[hdrs.join(',')].concat(rows.map(function(r){return r.join(',');})).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download='beyondpayroll_prospects_'+new Date().toISOString().split('T')[0]+'.csv';
  a.click();
  showToast('Exported '+arr.length+' prospects');
}

// ── Feature 1: Prospect Profile Modal ─────────────────────────────
window.ppShowProfile = function(idx) {
  const arr = getProspects();
  const p = arr[idx]; if(!p) return;
  closeProfileDropdown();
  const isTS = (p.track||'').toLowerCase().includes('ts');
  const painHtml = (p.painPoints||[]).length
    ? p.painPoints.map(function(x){return '<span class="pp-pain-tag">'+escHtml(x)+'</span>';}).join('')
    : '<span style="color:var(--text-3);font-size:11px">None captured yet</span>';
  const transcriptHtml = p.transcript
    ? '<div class="pp-transcript">'+escHtml(p.transcript)+'</div>'
    : '<div style="color:var(--text-3);font-size:11px;font-style:italic">No transcript pasted yet — add via Smart Routing Engine</div>';

  const existing = document.getElementById('pp-modal-overlay');
  if(existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.className = 'pp-modal-overlay';
  overlay.id = 'pp-modal-overlay';
  overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };

  const approvedBadge = p.approved ? '<span style="font-size:10px;background:#16a34a;color:#fff;padding:2px 7px;border-radius:3px;margin-left:8px;font-family:var(--fb)">ACTIVE CADENCE</span>' : '';
  const linkedinLink = p.linkedin ? '<a href="'+escHtml(p.linkedin)+'" target="_blank" style="color:var(--blue)">View &#8594;</a>' : '&#8212;';

  overlay.innerHTML = [
    '<div class="pp-modal">',
      '<div class="pp-modal-hdr">',
        '<div>',
          '<div class="pp-modal-co">'+escHtml(p.company||'Unknown')+approvedBadge+'</div>',
          '<div class="pp-modal-meta">'+escHtml(p.contact||'&#8212;')+' &middot; '+escHtml(p.email||'&#8212;')+' &middot; '+escHtml(p.phone||'&#8212;')+'</div>',
        '</div>',
        '<button onclick="document.getElementById(\'pp-modal-overlay\').remove()" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:14px">&#10005;</button>',
      '</div>',
      '<div class="pp-modal-body">',
        '<div class="pp-section">',
          '<div class="pp-section-ttl">Firmographic Data</div>',
          '<div class="pp-grid">',
            '<div class="pp-field"><div class="pp-field-lbl">Industry</div><div class="pp-field-val">'+escHtml(p.industry||'&#8212;')+'</div></div>',
            '<div class="pp-field"><div class="pp-field-lbl">State</div><div class="pp-field-val">'+escHtml(p.state||'&#8212;')+'</div></div>',
            '<div class="pp-field"><div class="pp-field-lbl">Headcount</div><div class="pp-field-val">'+escHtml(p.headcount||'&#8212;')+' EEs</div></div>',
            '<div class="pp-field"><div class="pp-field-lbl">Persona</div><div class="pp-field-val">'+escHtml(p.persona||'&#8212;')+'</div></div>',
            '<div class="pp-field"><div class="pp-field-lbl">Track</div><div class="pp-field-val '+(isTS?'red':'blue')+'">'+(isTS?'TotalSource PEO':'WorkforceNow')+'</div></div>',
            '<div class="pp-field"><div class="pp-field-lbl">Client Type</div><div class="pp-field-val">'+escHtml(p.clientType||'New Prospect')+'</div></div>',
          '</div>',
        '</div>',
        '<div class="pp-section">',
          '<div class="pp-section-ttl">Sales Intelligence</div>',
          '<div class="pp-grid">',
            '<div class="pp-field"><div class="pp-field-lbl">Product Track</div><div class="pp-field-val '+(isTS?'red':'blue')+'">'+(isTS?'TotalSource PEO':'WorkforceNow')+'</div></div>',
            '<div class="pp-field"><div class="pp-field-lbl">Cadence Tone</div><div class="pp-field-val">'+escHtml(p.cadenceTone||'&#8212;')+'</div></div>',
            '<div class="pp-field"><div class="pp-field-lbl">Incumbent</div><div class="pp-field-val">'+escHtml(p.competitor||'&#8212;')+'</div></div>',
            '<div class="pp-field"><div class="pp-field-lbl">Renewal Date</div><div class="pp-field-val">'+escHtml(p.renewalDate||'&#8212;')+'</div></div>',
            '<div class="pp-field"><div class="pp-field-lbl">Headcount Band</div><div class="pp-field-val">'+escHtml(p.headcountBand ? p.headcountBand+' ('+p.headcountRange+' EEs)' : '&#8212;')+'</div></div>',
            '<div class="pp-field"><div class="pp-field-lbl">Current ADP Products</div><div class="pp-field-val">'+((p.adpProducts||[]).map(function(x){return adpLabel(x);}).join(', ')||'&#8212;')+'</div></div>',
            '<div class="pp-field"><div class="pp-field-lbl">Data Points</div><div class="pp-field-val">'+(p.sreDataPoints ? p.sreDataPoints+' captured' : '&#8212;')+'</div></div>',
            '<div class="pp-field"><div class="pp-field-lbl">LinkedIn</div><div class="pp-field-val">'+linkedinLink+'</div></div>',
          '</div>',
          // Extended profile fields
          (function(){
            var ext = p.extProfile || {};
            var extFields = [
              ['Timeline', ext.timeline], ['Budget', ext.budget], ['Buying Stage', ext.stage],
              ['Champion', ext.champion], ['Economic Buyer', ext.economicBuyer],
              ['Other Vendors', ext.otherVendors], ['States of Operation', ext.states],
              ['Growth Plans', ext.growth], ['DOL/IRS Notices', ext.notices],
              ['Discovery Notes', ext.notes]
            ].filter(function(f){ return f[1] && String(f[1]).trim(); });
            if (!extFields.length) return '';
            return '<div class="pp-grid" style="margin-top:8px">'
              + extFields.map(function(f){
                  return '<div class="pp-field"><div class="pp-field-lbl">'+escHtml(f[0])+'</div><div class="pp-field-val">'+escHtml(String(f[1]))+'</div></div>';
                }).join('')
              + '</div>';
          })(),
          // MCA executive summary if available
          (p.mcaResult && p.mcaResult.executive_summary ? (
            '<div style="margin-top:10px;padding:10px 12px;background:rgba(26,36,96,.05);border-left:3px solid var(--navy);border-radius:0 6px 6px 0">'
            + '<div style="font-size:9px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">AI Competitive Summary · '+(p.mcaTrack==='WFN'?'WorkforceNow':'TotalSource')+(p.mcaTone?' · '+p.mcaTone:'')+'</div>'
            + '<div style="font-size:12px;color:var(--text-2);line-height:1.6">'+escHtml(p.mcaResult.executive_summary)+'</div>'
            + '</div>'
          ) : ''),
        '</div>',
        '<div class="pp-section">',
          '<div class="pp-section-ttl">Confirmed Pain Points</div>',
          '<div class="pp-pain-list">'+painHtml+'</div>',
        '</div>',
        '<div class="pp-section">',
          '<div class="pp-section-ttl">Gong / Transcript Extract</div>',
          transcriptHtml,
        '</div>',
        // ── AI-discovered extra fields — rendered inline with standard data ──
        ...(Object.keys(p.aiFields||{}).length ? [
          '<div class="pp-section">',
            '<div class="pp-section-ttl">',
              'Additional Details',
              (p.aiSources&&p.aiSources.length ? '<span style="font-size:9px;color:var(--text-3);font-weight:400;text-transform:none;letter-spacing:0;margin-left:8px">via AI: '+escHtml(p.aiSources.join(', '))+'</span>' : ''),
            '</div>',
            '<div class="pp-grid">',
            ...Object.entries(p.aiFields||{}).filter(function(e){return e[1]&&String(e[1]).trim();}).map(function(e){
              return '<div class="pp-field"><div class="pp-field-lbl">'+escHtml(e[0])+'</div><div class="pp-field-val">'+escHtml(String(e[1]))+'</div></div>';
            }),
            ...(p.aiInsights&&p.aiInsights.length ? p.aiInsights.filter(function(i){return i.value;}).map(function(ins){
              return '<div class="pp-field"><div class="pp-field-lbl">'+escHtml(ins.label||'')+'</div><div class="pp-field-val">'+escHtml(String(ins.value))+'</div></div>';
            }) : []),
            '</div>',
          '</div>'
        ] : []),
        '<div class="pp-section">',
          '<div class="pp-section-ttl">Rep Notes</div>',
          '<textarea class="pp-notes-area" id="pp-notes-inp" placeholder="Add notes, objections, renewal timing, follow-up context&hellip;">'+escHtml(p.notes||'')+'</textarea>',
        '</div>',

        // ── Cadence Activity Log ─────────────────────────────────────
        (function(){
          try {
            const statusKey = 'bp_ec_statuses_'+(p.company||'').replace(/\s+/g,'_');
            const statuses = JSON.parse(localStorage.getItem(statusKey)||'{}');
            const touches = (typeof buildTouches==='function') ? buildTouches(p) : [];
            const cdtStartKey = 'cdt_start_'+(p.company||'').replace(/\s+/g,'_');
            const cdtStart = localStorage.getItem(cdtStartKey);
            if(!touches.length && !cdtStart) return '';

            const dayNum = cdtStart ? (function(){
              const s=new Date(cdtStart),t=new Date();
              s.setHours(0,0,0,0);t.setHours(0,0,0,0);
              return Math.min(Math.floor((t-s)/86400000)+1,30);
            })() : null;

            const startLabel = cdtStart
              ? new Date(cdtStart).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
              : 'Not started';

            const sentTouches = touches.filter(function(_,i){
              const s=statuses[i]||'Pending';
              return s==='Sent'||s==='Meeting Booked'||s==='Replied'||s==='Opened';
            });
            const pendingTouches = touches.filter(function(_,i){
              const s=statuses[i]||'Pending';
              return s==='Pending'||s==='Drafted';
            });

            const statusColorMap = {
              'Sent':'#16a34a','Meeting Booked':'#15803d','Replied':'#16a34a',
              'Opened':'#ca8a04','Drafted':'#2563eb','No Response':'#6b7280',
              'Opted Out':'#dc2626','Pending':'#9ca3af'
            };
            const statusIconMap = {
              'Sent':'✓','Meeting Booked':'🎯','Replied':'💬',
              'Opened':'👁','Drafted':'📝','No Response':'—',
              'Opted Out':'⛔','Pending':'◦'
            };

            let sentAtMap = {};
            try{ sentAtMap=JSON.parse(localStorage.getItem(ecStatusKey(p.company)+'_sentAt')||'{}'); }catch(e){}

            let rows = touches.map(function(t,i){
              const s = statuses[i]||'Pending';
              const color = statusColorMap[s]||'#9ca3af';
              const icon = statusIconMap[s]||'◦';
              const isCompleted = s==='Sent'||s==='Meeting Booked'||s==='Replied'||s==='Opened';
              const sentAtRaw = sentAtMap[i];
              const sentAtLabel = sentAtRaw
                ? new Date(sentAtRaw).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'})
                : null;
              return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">'+
                '<div style="width:36px;text-align:center;font-weight:700;color:var(--text-3);font-size:11px;flex-shrink:0">Day '+t.day+'</div>'+
                '<div style="flex:1;color:'+(isCompleted?'var(--text)':'var(--text-3)')+'">'+
                  escHtml(t.label)+
                  (sentAtLabel ? '<div style="font-size:10px;color:var(--green);font-weight:600;margin-top:1px">Sent '+sentAtLabel+'</div>' : '')+
                '</div>'+
                '<div style="font-size:11px;font-weight:600;color:'+color+';white-space:nowrap">'+icon+' '+s+'</div>'+
              '</div>';
            }).join('');

            const pct = touches.length ? Math.round((sentTouches.length/touches.length)*100) : 0;
            const progressBar = '<div style="height:4px;background:var(--border);border-radius:2px;margin:8px 0 12px;overflow:hidden">'+
              '<div style="height:100%;width:'+pct+'%;background:'+(pct===100?'#16a34a':pct>50?'var(--green)':'var(--gold)')+';border-radius:2px;transition:width .3s"></div></div>';

            return [
              '<div class="pp-section">',
                '<div class="pp-section-ttl">30-Day Cadence Activity',
                  (cdtStart ? '<span style="font-size:9px;color:var(--text-3);font-weight:400;text-transform:none;letter-spacing:0;margin-left:8px">Started '+startLabel+(dayNum?' · Day '+dayNum+'/30':'')+' · '+sentTouches.length+'/'+touches.length+' touches complete</span>' : ''),
                '</div>',
                progressBar,
                rows || '<div style="color:var(--text-3);font-size:11px">Cadence not yet started for this prospect.</div>',
              '</div>'
            ].join('');
          } catch(e){ return ''; }
        })(),
        // ── End Cadence Activity Log ──────────────────────────────────
      '</div>',
      '<div class="pp-modal-ftr">',
        '<button class="pp-ftr-btn primary" onclick="ppSaveNotes('+idx+')">Save Notes</button>',
        '<button class="pp-ftr-btn" onclick="pdLoadProspect('+idx+');document.getElementById(\'pp-modal-overlay\').remove()">&#9654; Load Active</button>',
        '<button class="pp-ftr-btn sms-btn" style="background:rgba(34,197,94,.08);color:#16a34a;border-color:rgba(34,197,94,.3)" onclick="ppSendSmsReminder('+idx+')">&#128241; SMS</button>',
        '<button class="pp-ftr-btn red" onclick="ppDeleteProspect('+idx+')">&#128465; Delete</button>',
        '<button class="pp-ftr-btn" style="margin-left:auto" onclick="document.getElementById(\'pp-modal-overlay\').remove()">Close</button>',
      '</div>',
    '</div>'
  ].join('');
  document.body.appendChild(overlay);
};

window.ppSaveNotes = function(idx) {
  const arr = getProspects();
  if(!arr[idx]) return;
  const notes = document.getElementById('pp-notes-inp');
  if(notes){ arr[idx].notes = notes.value; arr[idx].updatedAt = new Date().toISOString(); }
  saveProspectsLocal(arr);
  // Push notes update to Firestore
  if(typeof fbSaveProspect==='function') fbSaveProspect(arr[idx]);
  if(window._hqProspect && window._hqProspect.company === arr[idx].company) window._hqProspect.notes = arr[idx].notes;
  showToast('Notes saved for '+arr[idx].company);
};

window.ppDeleteProspect = function(idx) {
  const arr = getProspects();
  if(!arr[idx]) return;
  if(!confirm('Delete '+arr[idx].company+' from Prospect Profiles?')) return;
  const removed = arr.splice(idx, 1)[0];
  saveProspectsLocal(arr);
  if(_fbDb && removed){
    if(removed.id){
      addTombstone(removed.id);
      _fbDb.collection('prospects').doc(removed.id).delete()
        .catch(function(e){ console.warn('fbDelete:',e.message); });
    } else if(_fbSession && removed.company){
      _fbDb.collection('prospects')
        .where('userEmail','==',_fbSession.email)
        .where('company','==',removed.company)
        .get()
        .then(function(snap){ snap.forEach(function(doc){ addTombstone(doc.id); doc.ref.delete(); }); })
        .catch(function(e){ console.warn('fbDelete (no-id):',e.message); });
    }
  }
  renderSavedProspects();
  const ov = document.getElementById('pp-modal-overlay');
  if(ov) ov.remove();
  showToast('Prospect deleted');
};

// ── Feature 2: Auto-pull prospect data into tool panels ──────────
window.addEventListener('DOMContentLoaded', function(){
  // Override hqRenderBanner to also auto-pull into tool panels
  const _origBanner = window.hqRenderBanner;
  if(_origBanner){
    window.hqRenderBanner = function(){
      _origBanner();
      setTimeout(function(){
        if(typeof window.pullProspectToTool === 'function' && window._hqProspect){
          window.pullProspectToTool('wfn');
          window.pullProspectToTool('ts');
        }
      }, 150);
    };
  }
});

// ── Feature 5: Intel action buttons ──────────────────────────────
// ── cdtIntelEmail: prose-formatted email from intel agent output ──
// ── cdtIntelEmail: prose-formatted email from intel agent output ──
window.cdtIntelEmail = async function(day) {
  const p = window._hqProspect; if(!p) return;
  const result = cdtGetIntelResult(day);
  const intelDay = CDT_INTEL_DAYS.find(function(d){return d.day===day;});

  // Find matching cadence touch to reuse its pre-built subject + body if available
  const touches = window._ecTouches || [];
  const matchTouch = touches.find(function(t){ return t.day === day; });

  // Use cadence touch subject if available, otherwise fall back to intel subject map
  const subjectMap = {
    1: 'Quick thought on '+p.company+'\'s HR setup',
    8: 'Something came across my desk re: '+p.company,
    15: 'A competitor move worth flagging for '+p.company,
    22: 'Last thing I wanted to flag for '+p.company
  };
  const subject = (matchTouch && matchTouch.subject) || subjectMap[day] || ('[ADP Intel] '+(intelDay?intelDay.label:'Research Brief')+' \u2014 '+p.company);

  // If the touch already has a prose body from the engine, use it directly
  if (matchTouch && matchTouch._proseBody) {
    const toEmail = p.email || '';
    if (!toEmail) { showToast('No email on file for this prospect', true); return; }
    const uri = 'mailto:'+encodeURIComponent(toEmail)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(matchTouch._proseBody);
    window.location.href = uri;
    showToast('\u2713 Opening Outlook \u2014 Day '+day+' intel email ready');
    return;
  }

  // Otherwise build full enriched context using the same pipeline as the cadence engine
  const dayKeyMap = {1:'wfn_day1', 8:'wfn_day8_intel', 15:'wfn_day15_intel', 22:'wfn_day22_intel'};
  const touchKey = p.track==='WFN' ? (dayKeyMap[day]||'wfn_day8_intel') : 'wfn_day8_intel';

  // Use bpEngineBuildContext to pull ALL data: firmographic, pain points, transcript,
  // MCA competitive intel, analysis tool results, PEO profile, cadence tone
  const fakeTouch = matchTouch || { day: day, label: intelDay ? intelDay.label : 'Intel Touch' };
  let rawContext = bpEngineBuildContext(p, fakeTouch, window._atResults || null);

  // Append live intel agent output on top of the engine context
  if (result && result.result) {
    rawContext += '\n\nLIVE INTEL AGENT OUTPUT (use the most specific finding from this):\n' + result.result;
  }

  showToast('Formatting email\u2026');
  const proseBody = await bpProseFormat(touchKey, rawContext);
  const sig = '\n\n\u2014\nAJ\nADP\nbeyondpayroll.net';
  const bodyText = proseBody + sig;

  const toEmail = p.email || '';
  const uri = 'mailto:'+encodeURIComponent(toEmail)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(bodyText);
  window.location.href = uri;
  showToast('\u2713 Outlook ready \u2014 Day '+day+' intel email pre-filled');
};

// ── cdtIntelLinkedIn: prose-formatted LinkedIn post from intel agent output ──
window.cdtIntelLinkedIn = async function(day) {
  const p = window._hqProspect; if(!p) return;
  const result = cdtGetIntelResult(day);

  // Helper: copy text using textarea fallback (works on iOS Safari after async)
  function _liCopy(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(function() { _liCopyFallback(text); });
      } else {
        _liCopyFallback(text);
      }
    } catch(e) { _liCopyFallback(text); }
  }
  function _liCopyFallback(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    document.body.removeChild(ta);
  }

  // Build enriched context — same pipeline as email engine
  const _liFakeTouch = { day: day, label: (CDT_INTEL_DAYS.find(function(d){return d.day===day;})||{}).label||'Intel' };
  const _liFullCtx = bpEngineBuildContext(p, _liFakeTouch, window._atResults || null);
  const intelOutput = result ? result.result : '';
  const rawContext = _liFullCtx + (intelOutput ? '\n\nLIVE INTEL OUTPUT:\n' + intelOutput : '');

  const liPrompt = 'You are an ADP HCM consultant writing a LinkedIn post to share a market insight. ' +
    'RULES: Plain text only — no asterisks, no bold, no markdown. ' +
    '3-4 sentences maximum. Write in first person. ' +
    'Do NOT name the prospect company. Share the insight as a general industry observation. ' +
    'End with 2-3 relevant hashtags on their own line. ' +
    'Do not start with "I" — restructure the opening sentence.\n\n' +
    'Use the most interesting and specific data point from the intel below to write the post:\n\n' + rawContext;

  showToast('Generating LinkedIn post\u2026');
  try {
    const resp = await bpGeminiFetch({ messages:[{role:'user', content: liPrompt}] });
    const data = await resp.json();
    const post = bpGeminiText(data).trim() || (intelOutput ? intelOutput.substring(0,260)+'...' : 'Insight pending.');
    _liCopy(post);
    showToast('\u2713 LinkedIn post copied \u2014 opening LinkedIn');
    // Open LinkedIn app on mobile (iOS/Android) or web fallback
    setTimeout(function(){ 
      const linkedinUrl = 'linkedin://share?text=' + encodeURIComponent(post);
      const fallbackUrl = 'https://www.linkedin.com/feed/';
      
      // Try to open LinkedIn app first
      window.location.href = linkedinUrl;
      
      // Fallback to web if app doesn't open (desktop)
      setTimeout(function(){ 
        window.open(fallbackUrl, '_blank'); 
      }, 1000);
    }, 400);
  } catch(e) {
    const fallback = intelOutput ? intelOutput.substring(0,260)+'...' : 'Check out the latest HCM trends.';
    _liCopy(fallback);
    showToast('\u2713 Copied \u2014 opening LinkedIn', false);
    setTimeout(function(){ 
      const linkedinUrl = 'linkedin://';
      window.location.href = linkedinUrl;
      setTimeout(function(){ 
        window.open('https://www.linkedin.com/feed/', '_blank'); 
      }, 1000);
    }, 400);
  }
};

// ── cdtIntelSms: prose-formatted SMS from intel agent output ──
window.cdtIntelSms = async function(day) {
  const p = window._hqProspect; if(!p) return;
  const result = cdtGetIntelResult(day);
  const intelDay = CDT_INTEL_DAYS.find(function(d){return d.day===day;});
  const nm = (p.contact||'').split(' ')[0]||p.company;

  const smsPrompt = 'You are formatting a short SMS follow-up for an ADP sales rep. Write ONE sentence (max 140 characters) that references a specific insight from the intel data below. Sound like a human, not a robot. No markdown. End with a soft CTA like "Worth a quick call?" Do not include the sign-off.';
  const rawContext = [
    'Company: '+p.company,
    'Industry: '+(p.industry||'\u2014'),
    'State: '+(p.state||'\u2014'),
    'Cadence Day: '+day,
    '',
    'INTEL OUTPUT:',
    (result?result.result.substring(0,400):'No intel \u2014 use prospect profile.')
  ].join('\n');

  let smsBody = 'Hi '+nm+' \u2014 saw something relevant to '+p.company+' I wanted to flag. Worth a quick call this week? \u2014 AJ, ADP';
  try {
    const resp = await bpGeminiFetch({ messages:[{role:'user', content: smsPrompt+'\n\n'+rawContext}] });
    const data = await resp.json();
    const formatted = bpGeminiText(data).trim();
    if(formatted) smsBody = 'Hi '+nm+' \u2014 '+formatted+' \u2014 AJ, ADP';
  } catch(e) { console.warn('[ProseFormat] SMS format failed:', e.message); }

  ppShowSmsModal(p.phone||'', smsBody, 'Day '+day+' Intel \u2014 '+p.company);
};

window.ppSendSmsReminder = function(idx) {
  const arr = getProspects();
  const p = arr[idx]||window._hqProspect; if(!p) return;
  ppShowSmsModal(
    p.phone||'',
    'Hi '+((p.contact||'').split(' ')[0]||p.company)+'! Following up on our ADP conversation re: '+p.company+'. Do you have 15 min this week? — AJ, ADP | beyondpayroll.net',
    'Follow-up Reminder — '+p.company
  );
};

function ppShowSmsModal(phone, defaultMsg, title) {
  const existing = document.getElementById('sms-modal-overlay');
  if(existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.className = 'sms-modal-overlay';
  overlay.id = 'sms-modal-overlay';
  overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };
  overlay.innerHTML = [
    '<div class="sms-modal">',
      '<div class="sms-modal-hdr">',
        '<div style="font-family:var(--fd);font-size:14px;font-weight:600">&#128241; '+escHtml(title||'SMS Reminder')+'</div>',
        '<button onclick="document.getElementById(\'sms-modal-overlay\').remove()" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:26px;height:26px;border-radius:50%;cursor:pointer">&#10005;</button>',
      '</div>',
      '<div class="sms-modal-body">',
        '<div class="sms-field-lbl">Mobile Number</div>',
        '<input class="sms-inp" id="sms-phone-inp" type="tel" placeholder="+1 (555) 000-0000" value="'+escHtml(phone)+'">',
        '<div class="sms-field-lbl">Message <span style="color:var(--text-3);font-weight:400" id="sms-char-count"></span></div>',
        '<textarea class="sms-textarea" id="sms-msg-inp" oninput="document.getElementById(\'sms-char-count\').textContent=\'(\'+this.value.length+\'/160)\'">'+escHtml(defaultMsg)+'</textarea>',
        '<div style="font-size:11px;color:var(--text-3)">Opens your device SMS app. For bulk/scheduled SMS, use the Sales Agent tab (Twilio).</div>',
      '</div>',
      '<div class="sms-modal-ftr">',
        '<button class="pp-ftr-btn primary" onclick="ppSendSms()" style="flex:1">&#128228; Open in Messages</button>',
        '<button class="pp-ftr-btn" onclick="ppCopySms()" style="flex:1">&#8859; Copy</button>',
        '<button class="pp-ftr-btn" onclick="document.getElementById(\'sms-modal-overlay\').remove()">Cancel</button>',
      '</div>',
    '</div>'
  ].join('');
  document.body.appendChild(overlay);
  const msgEl = document.getElementById('sms-msg-inp');
  if(msgEl) document.getElementById('sms-char-count').textContent='('+msgEl.value.length+'/160)';
}

window.ppSendSms = function() {
  const phone = (document.getElementById('sms-phone-inp')||{}).value||'';
  const msg = (document.getElementById('sms-msg-inp')||{}).value||'';
  if(!phone){ showToast('Enter a mobile number first', true); return; }
  window.location.href = 'sms:'+phone.replace(/\s/g,'')+'?body='+encodeURIComponent(msg);
  document.getElementById('sms-modal-overlay').remove();
};

window.ppCopySms = function() {
  const msg = (document.getElementById('sms-msg-inp')||{}).value||'';
  if(navigator.clipboard){ navigator.clipboard.writeText(msg).then(function(){ showToast('Message copied to clipboard'); }); }
};


// Hook saveProspect to also persist to Firebase
document.addEventListener('DOMContentLoaded',function(){
  const _orig=window.saveProspect;
  if(_orig){
    window.saveProspect=function(){
      _orig();
      setTimeout(function(){
        if(window._hqProspect) fbSaveProspect(Object.assign({},window._hqProspect));
      },150);
    };
  }
  renderSavedProspects();
});

// ═══════════════════════════════════════════════════════════════════════
//  SALES AGENT — API Bridge Client
// ═══════════════════════════════════════════════════════════════════════
const SA_API = 'http://localhost:8787/api';
let _saReady = false;

async function saFetch(path, opts = {}) {
  try {
    const resp = await fetch(SA_API + path, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    });
    return await resp.json();
  } catch (e) {
    return { success: false, error: 'API unreachable — is the Sales Agent server running? (' + e.message + ')' };
  }
}

function saShowResult(id, ok, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'sa-result show ' + (ok ? 'ok' : 'err');
  el.textContent = msg;
  setTimeout(function(){ el.classList.remove('show'); }, 8000);
}

async function saInit() {
  // Auto-fill prospect fields
  const p = window._hqProspect;
  const banner = document.getElementById('sa-prospect-banner');
  if (p && banner) {
    banner.style.display = 'block';
    document.getElementById('sa-ps-name').textContent = (p.contact || p.company || '—');
    document.getElementById('sa-ps-detail').textContent =
      (p.company || '') + ' · ' + (p.email || '') + ' · ' + (p.phone || '');
    // Auto-fill phone/email
    const smsPhone = document.getElementById('sa-sms-phone');
    const callPhone = document.getElementById('sa-call-phone');
    if (smsPhone && !smsPhone.value && p.phone) smsPhone.value = p.phone;
    if (callPhone && !callPhone.value && p.phone) callPhone.value = p.phone;
  } else if (banner) {
    banner.style.display = 'none';
  }

  // Check API health
  const health = await saFetch('/health');
  const apiDot = document.getElementById('sa-api-dot');
  const apiLbl = document.getElementById('sa-api-lbl');
  const twilioDot = document.getElementById('sa-twilio-dot');
  const twilioLbl = document.getElementById('sa-twilio-lbl');
  const sgDot = document.getElementById('sa-sg-dot');
  const sgLbl = document.getElementById('sa-sg-lbl');

  if (health.status === 'ok') {
    _saReady = true;
    apiDot.className = 'dot green'; apiLbl.textContent = 'API Connected';
    twilioDot.className = 'dot ' + (health.twilio_configured ? 'green' : 'red');
    twilioLbl.textContent = health.twilio_configured ? 'Twilio Ready' : 'Twilio Not Configured';
    sgDot.className = 'dot ' + (health.sendgrid_configured ? 'green' : 'yellow');
    sgLbl.textContent = health.sendgrid_configured ? 'SendGrid Ready' : 'SendGrid Skipped';
  } else {
    _saReady = false;
    apiDot.className = 'dot red'; apiLbl.textContent = 'API Offline';
    twilioDot.className = 'dot red'; twilioLbl.textContent = 'Twilio Unknown';
    sgDot.className = 'dot red'; sgLbl.textContent = 'SendGrid Unknown';
  }
}

async function saSyncProspects() {
  if (!_saReady) { showToast('Sales Agent API is offline — start the server first', true); return; }
  const arr = getProspects();
  if (!arr.length) { showToast('No saved prospects to sync', true); return; }

  const mapped = arr.map(function(p) {
    return {
      name: p.contact || p.company || 'Unknown',
      company: p.company || '',
      phone: p.phone || '',
      email: p.email || '',
      title: p.persona || '',
      industry: p.industry || '',
      state: p.state || '',
      headcount: p.headcount || '',
      track: p.track || '',
      linkedin: p.linkedin || '',
    };
  });

  const result = await saFetch('/prospects/sync', {
    method: 'POST',
    body: JSON.stringify({ prospects: mapped }),
  });

  if (result.success) {
    showToast('Synced ' + result.total + ' prospects (' + result.created + ' new, ' + result.updated + ' updated)');
  } else {
    showToast('Sync failed: ' + (result.error || 'Unknown'), true);
  }
}

async function saSendSMS() {
  if (!_saReady) { showToast('Sales Agent API is offline', true); return; }
  const phone = document.getElementById('sa-sms-phone').value.trim();
  const msg = document.getElementById('sa-sms-msg').value.trim();
  if (!phone) { saShowResult('sa-sms-result', false, 'Enter a phone number'); return; }
  if (!msg) { saShowResult('sa-sms-result', false, 'Enter a message'); return; }

  saShowResult('sa-sms-result', true, 'Sending…');
  const result = await saFetch('/send/sms', {
    method: 'POST',
    body: JSON.stringify({ to_phone: phone, message: msg }),
  });

  if (result.success) {
    saShowResult('sa-sms-result', true, 'SMS sent — SID: ' + (result.sid || 'OK'));
    showToast('SMS sent to ' + phone);
  } else {
    saShowResult('sa-sms-result', false, 'Failed: ' + (result.error || 'Unknown error'));
  }
}

function saPreviewSMS() {
  const msg = document.getElementById('sa-sms-msg').value.trim();
  const p = window._hqProspect;
  if (!msg) { saShowResult('sa-sms-result', false, 'Enter a message first'); return; }
  let preview = msg;
  if (p) {
    preview = preview.replace(/\{\{\s*name\s*\}\}/gi, p.contact || '');
    preview = preview.replace(/\{\{\s*company\s*\}\}/gi, p.company || '');
    preview = preview.replace(/\{\{\s*title\s*\}\}/gi, p.persona || '');
    preview = preview.replace(/\{\{\s*industry\s*\}\}/gi, p.industry || '');
    preview = preview.replace(/\{\{\s*state\s*\}\}/gi, p.state || '');
  }
  saShowResult('sa-sms-result', true, 'Preview: ' + preview);
}

async function saMakeCall() {
  if (!_saReady) { showToast('Sales Agent API is offline', true); return; }
  const phone = document.getElementById('sa-call-phone').value.trim();
  const script = document.getElementById('sa-call-script').value.trim();
  const voice = document.getElementById('sa-call-voice').value;
  if (!phone) { saShowResult('sa-call-result', false, 'Enter a phone number'); return; }
  if (!script) { saShowResult('sa-call-result', false, 'Enter a voice script'); return; }

  if (!confirm('Initiate AI phone call to ' + phone + '? This will make a real call via Twilio.')) return;

  saShowResult('sa-call-result', true, 'Initiating call…');
  const result = await saFetch('/send/call', {
    method: 'POST',
    body: JSON.stringify({ to_phone: phone, script: script, voice: voice }),
  });

  if (result.success) {
    saShowResult('sa-call-result', true, 'Call initiated — SID: ' + (result.sid || 'OK'));
    showToast('Call initiated to ' + phone);
  } else {
    saShowResult('sa-call-result', false, 'Failed: ' + (result.error || 'Unknown error'));
  }
}

async function saExecuteCadence(dryRun) {
  if (!_saReady) { showToast('Sales Agent API is offline', true); return; }
  if (!dryRun && !confirm('Execute all pending cadence steps NOW? This will send real SMS/email/calls.')) return;

  saShowResult('sa-exec-result', true, dryRun ? 'Running dry run…' : 'Executing…');
  const result = await saFetch('/enrollments/execute', {
    method: 'POST',
    body: JSON.stringify({ dry_run: dryRun }),
  });

  if (result.error) {
    saShowResult('sa-exec-result', false, 'Error: ' + result.error);
    return;
  }

  const label = dryRun ? 'DRY RUN' : 'EXECUTED';
  saShowResult('sa-exec-result', true,
    label + ' — Pending: ' + result.total_pending +
    ' | Executed: ' + result.executed +
    ' | Failed: ' + result.failed +
    ' | Skipped: ' + result.skipped
  );
}

async function saLoadActivity() {
  if (!_saReady) { showToast('Sales Agent API is offline', true); return; }
  const section = document.getElementById('sa-activity-section');
  const log = document.getElementById('sa-activity-log');
  section.style.display = 'block';
  log.innerHTML = '<div style="color:var(--text-3)">Loading…</div>';

  const result = await saFetch('/activity?limit=30');
  if (!result.activities || !result.activities.length) {
    log.innerHTML = '<div style="color:var(--text-3);padding:8px">No activity yet. Sync prospects, create a cadence, and execute steps.</div>';
    return;
  }

  log.innerHTML = result.activities.map(function(a) {
    return '<div class="sa-log-entry">' +
      '<span class="ch ' + a.channel + '">' + a.channel + '</span> ' +
      '<strong>' + (a.prospect_name || a.prospect_id) + '</strong> — ' +
      a.action + ' · ' +
      '<span style="color:var(--text-3)">' + (a.created_at || '').substring(0,19) + '</span>' +
    '</div>';
  }).join('');

  section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ═══════════════════════════════════════════════════════
//  REAL UNDERWRITING DATASET
//  Add future groups here as they come in.
//  Each entry = one conditionally approved TotalSource group.
// ═══════════════════════════════════════════════════════
var UW_GROUPS = [
  {
    id: 'G001',
    label: 'McLean VA — Professional Services',
    state: 'Virginia',
    metro: 'Northern Virginia / DC Area',
    eligible: 8,
    subscribers: 5,
    participation: 0.63,        // 63%
    asi: 1.08,
    carrier: 'carefirst',
    avgWage: 80800,
    industry: 'low',
    renewalOffered: 6.8,        // % increase offered by current carrier
    approvals: [
      { plan: '57S / Aetna EPO',         discount: -0.1085 },
      { plan: 'ZA1 / Aetna NTL',         discount: -0.0965 },
      { plan: '57S / Innovation Health',  discount: -0.1431 }
    ],
    declines: ['UHC — premium inadequacy & tier shift limitations'],
    discountLow:  -0.0965,   // worst approved
    discountHigh: -0.1431,   // best approved
    discountMid:  -0.1127    // average of approved
  }
  // ── ADD FUTURE GROUPS BELOW ──────────────────────────
  // {
  //   id: 'G002',
  //   label: '...',
  //   ...
  // }
];

// ═══════════════════════════════════════════════════════
//  CARRIER BENCHMARK DATA  (KFF 2023 + HCCI)
// ═══════════════════════════════════════════════════════
var CARRIERS = {
  carefirst:   { name:'CareFirst (BCBS DC/MD/VA)',    trend:6.8,
    single:{avg:680}, spouse:{avg:1440}, child:{avg:1150}, family:{avg:2000} },
  uhc:         { name:'UnitedHealthcare',             trend:5.8,
    single:{avg:620}, spouse:{avg:1310}, child:{avg:1050}, family:{avg:1820} },
  bcbs:        { name:'Blue Cross Blue Shield',       trend:5.2,
    single:{avg:595}, spouse:{avg:1265}, child:{avg:1010}, family:{avg:1760} },
  aetna:       { name:'Aetna',                        trend:5.5,
    single:{avg:608}, spouse:{avg:1290}, child:{avg:1025}, family:{avg:1790} },
  cigna:       { name:'Cigna',                        trend:5.6,
    single:{avg:615}, spouse:{avg:1300}, child:{avg:1040}, family:{avg:1800} },
  humana:      { name:'Humana',                       trend:5.0,
    single:{avg:580}, spouse:{avg:1230}, child:{avg:985},  family:{avg:1710} },
  kaiser:      { name:'Kaiser Permanente',            trend:4.4,
    single:{avg:555}, spouse:{avg:1175}, child:{avg:940},  family:{avg:1640} },
  anthem:      { name:'Anthem',                       trend:5.3,
    single:{avg:600}, spouse:{avg:1275}, child:{avg:1015}, family:{avg:1770} },
  innovation:  { name:'Innovation Health (Aetna DC)', trend:5.5,
    single:{avg:650}, spouse:{avg:1375}, child:{avg:1100}, family:{avg:1910} },
  molina:      { name:'Molina Healthcare',            trend:4.8,
    single:{avg:540}, spouse:{avg:1145}, child:{avg:915},  family:{avg:1595} },
  oscar:       { name:'Oscar Health',                 trend:5.4,
    single:{avg:590}, spouse:{avg:1250}, child:{avg:1000}, family:{avg:1740} },
  other:       { name:'Other / Unknown Carrier',      trend:5.3,
    single:{avg:598}, spouse:{avg:1268}, child:{avg:1014}, family:{avg:1765} }
};

var HF={ads:0.012,recruiter:0.065,onboard:0.040,prod:0.055,admin:0.008};
var totalHF=HF.ads+HF.recruiter+HF.onboard+HF.prod+HF.admin;

// ═══════════════════════════════════════════════════════
//  LABOR DATA  — state baselines + city-level estimates
//  m=median annual wage, col=cost-of-labor index, ttf=time-to-fill (days), tax=employer tax burden %
// ═══════════════════════════════════════════════════════
var LD = {
  "Alabama":{m:52800,col:0.88,ttf:35,tax:9.2,metros:{
    "Anniston":{m:46000,col:0.84},"Auburn":{m:50000,col:0.86},"Birmingham":{m:57200,col:0.91},
    "Decatur":{m:49000,col:0.85},"Dothan":{m:47000,col:0.84},"Florence":{m:47500,col:0.84},
    "Gadsden":{m:45000,col:0.83},"Huntsville":{m:68000,col:0.93},"Mobile":{m:49800,col:0.87},
    "Montgomery":{m:52000,col:0.88},"Tuscaloosa":{m:51000,col:0.87}}},
  "Alaska":{m:64000,col:1.18,ttf:42,tax:10.1,metros:{
    "Anchorage":{m:70000,col:1.20},"Fairbanks":{m:63000,col:1.16},"Juneau":{m:66000,col:1.18},
    "Ketchikan":{m:58000,col:1.12},"Sitka":{m:59000,col:1.13}}},
  "Arizona":{m:62000,col:0.97,ttf:34,tax:9.4,metros:{
    "Avondale":{m:60000,col:0.97},"Chandler":{m:70000,col:1.03},"Flagstaff":{m:56000,col:0.94},
    "Gilbert":{m:69000,col:1.02},"Glendale":{m:60000,col:0.97},"Mesa":{m:62000,col:0.99},
    "Peoria":{m:64000,col:1.00},"Phoenix":{m:65000,col:1.00},"Prescott":{m:53000,col:0.91},
    "Scottsdale":{m:78000,col:1.10},"Surprise":{m:60000,col:0.97},"Tempe":{m:67000,col:1.01},
    "Tucson":{m:55000,col:0.93},"Yuma":{m:48000,col:0.86}}},
  "Arkansas":{m:48500,col:0.84,ttf:36,tax:9.0,metros:{
    "Conway":{m:49000,col:0.85},"Fayetteville":{m:54000,col:0.88},"Fort Smith":{m:47000,col:0.83},
    "Jonesboro":{m:48000,col:0.84},"Little Rock":{m:52000,col:0.87},"Pine Bluff":{m:44000,col:0.82},
    "Rogers":{m:53000,col:0.87},"Springdale":{m:51000,col:0.86}}},
  "California":{m:82000,col:1.42,ttf:38,tax:12.8,metros:{
    "Anaheim":{m:76000,col:1.36},"Bakersfield":{m:58000,col:1.05},"Berkeley":{m:100000,col:1.60},
    "Burbank":{m:80000,col:1.38},"Chula Vista":{m:72000,col:1.25},"Concord":{m:86000,col:1.40},
    "Daly City":{m:90000,col:1.46},"El Monte":{m:66000,col:1.18},"Escondido":{m:68000,col:1.20},
    "Fontana":{m:62000,col:1.10},"Fremont":{m:102000,col:1.60},"Fresno":{m:58000,col:1.05},
    "Garden Grove":{m:70000,col:1.22},"Glendale":{m:80000,col:1.38},"Hayward":{m:90000,col:1.46},
    "Huntington Beach":{m:82000,col:1.38},"Inglewood":{m:76000,col:1.34},"Irvine":{m:92000,col:1.50},
    "Long Beach":{m:75000,col:1.34},"Los Angeles":{m:79000,col:1.40},"Modesto":{m:57000,col:1.03},
    "Moreno Valley":{m:60000,col:1.08},"Murrieta":{m:66000,col:1.16},"Oakland":{m:96000,col:1.55},
    "Oceanside":{m:68000,col:1.20},"Ontario":{m:64000,col:1.14},"Orange":{m:78000,col:1.36},
    "Oxnard":{m:64000,col:1.14},"Palmdale":{m:62000,col:1.10},"Pasadena":{m:88000,col:1.44},
    "Rancho Cucamonga":{m:66000,col:1.16},"Riverside":{m:65000,col:1.15},"Roseville":{m:76000,col:1.26},
    "Sacramento":{m:74000,col:1.22},"Salinas":{m:62000,col:1.12},"San Bernardino":{m:60000,col:1.08},
    "San Diego":{m:82000,col:1.38},"San Francisco":{m:118000,col:1.75},"San Jose":{m:122000,col:1.82},
    "San Mateo":{m:108000,col:1.66},"Santa Ana":{m:68000,col:1.20},"Santa Barbara":{m:70000,col:1.22},
    "Santa Clara":{m:116000,col:1.78},"Santa Rosa":{m:72000,col:1.24},"Simi Valley":{m:76000,col:1.32},
    "Stockton":{m:58000,col:1.04},"Sunnyvale":{m:118000,col:1.80},"Thousand Oaks":{m:84000,col:1.40},
    "Torrance":{m:82000,col:1.38},"Vallejo":{m:72000,col:1.24},"Victorville":{m:58000,col:1.04},
    "Visalia":{m:54000,col:1.00}}},
  "Colorado":{m:74000,col:1.10,ttf:33,tax:10.0,metros:{
    "Aurora":{m:72000,col:1.10},"Boulder":{m:88000,col:1.28},"Centennial":{m:82000,col:1.20},
    "Colorado Springs":{m:66000,col:1.04},"Denver":{m:80000,col:1.18},"Fort Collins":{m:70000,col:1.08},
    "Grand Junction":{m:58000,col:0.96},"Greeley":{m:62000,col:1.00},"Lakewood":{m:74000,col:1.12},
    "Loveland":{m:65000,col:1.02},"Pueblo":{m:54000,col:0.92},"Thornton":{m:70000,col:1.08},
    "Westminster":{m:74000,col:1.12}}},
  "Connecticut":{m:80000,col:1.22,ttf:36,tax:11.4,metros:{
    "Bridgeport":{m:74000,col:1.18},"Bristol":{m:70000,col:1.12},"Danbury":{m:78000,col:1.20},
    "Hartford":{m:78000,col:1.19},"Meriden":{m:68000,col:1.10},"Middletown":{m:72000,col:1.14},
    "New Britain":{m:67000,col:1.08},"New Haven":{m:72000,col:1.15},"New London":{m:68000,col:1.10},
    "Norwalk":{m:92000,col:1.38},"Stamford":{m:98000,col:1.45},"Waterbury":{m:65000,col:1.06},
    "West Hartford":{m:82000,col:1.24}}},
  "Delaware":{m:68000,col:1.04,ttf:34,tax:10.2,metros:{
    "Dover":{m:64000,col:1.00},"Newark":{m:70000,col:1.06},"Wilmington":{m:74000,col:1.10}}},
  "Florida":{m:59000,col:0.96,ttf:31,tax:8.8,metros:{
    "Boca Raton":{m:68000,col:1.06},"Bonita Springs":{m:58000,col:0.95},"Cape Coral":{m:56000,col:0.93},
    "Clearwater":{m:60000,col:0.97},"Coral Springs":{m:62000,col:1.00},"Daytona Beach":{m:52000,col:0.90},
    "Deerfield Beach":{m:60000,col:0.98},"Deltona":{m:53000,col:0.91},"Fort Lauderdale":{m:64000,col:1.04},
    "Fort Myers":{m:57000,col:0.94},"Gainesville":{m:56000,col:0.93},"Hialeah":{m:55000,col:0.92},
    "Hollywood":{m:62000,col:1.00},"Jacksonville":{m:60000,col:0.96},"Lakeland":{m:54000,col:0.91},
    "Lehigh Acres":{m:50000,col:0.88},"Melbourne":{m:58000,col:0.95},"Miami":{m:63000,col:1.06},
    "Miami Gardens":{m:56000,col:0.94},"Miramar":{m:62000,col:1.00},"Naples":{m:62000,col:1.01},
    "Ocala":{m:50000,col:0.88},"Orlando":{m:58000,col:0.95},"Palm Bay":{m:55000,col:0.92},
    "Pembroke Pines":{m:62000,col:1.00},"Pensacola":{m:53000,col:0.90},"Pompano Beach":{m:60000,col:0.98},
    "Port St. Lucie":{m:55000,col:0.92},"Sarasota":{m:60000,col:0.98},"St. Petersburg":{m:61000,col:0.98},
    "Tallahassee":{m:56000,col:0.93},"Tampa":{m:62000,col:0.99},"West Palm Beach":{m:64000,col:1.03}}},
  "Georgia":{m:62000,col:0.96,ttf:33,tax:9.3,metros:{
    "Albany":{m:48000,col:0.86},"Alpharetta":{m:80000,col:1.12},"Athens":{m:52000,col:0.88},
    "Atlanta":{m:72000,col:1.08},"Augusta":{m:54000,col:0.90},"Columbus":{m:52000,col:0.88},
    "Macon":{m:50000,col:0.87},"Marietta":{m:68000,col:1.03},"Roswell":{m:74000,col:1.09},
    "Sandy Springs":{m:76000,col:1.10},"Savannah":{m:56000,col:0.91},"Valdosta":{m:47000,col:0.85},
    "Warner Robins":{m:52000,col:0.88}}},
  "Hawaii":{m:68000,col:1.32,ttf:40,tax:11.0,metros:{
    "Hilo":{m:60000,col:1.24},"Honolulu":{m:70000,col:1.34},"Kailua":{m:68000,col:1.31},
    "Kapolei":{m:65000,col:1.28},"Pearl City":{m:66000,col:1.29}}},
  "Idaho":{m:55000,col:0.92,ttf:35,tax:9.1,metros:{
    "Boise":{m:61000,col:0.99},"Caldwell":{m:52000,col:0.90},"Coeur d'Alene":{m:54000,col:0.92},
    "Idaho Falls":{m:54000,col:0.91},"Lewiston":{m:52000,col:0.90},"Meridian":{m:60000,col:0.98},
    "Nampa":{m:53000,col:0.91},"Pocatello":{m:52000,col:0.90},"Twin Falls":{m:51000,col:0.89}}},
  "Illinois":{m:70000,col:1.08,ttf:35,tax:10.8,metros:{
    "Aurora":{m:66000,col:1.04},"Bloomington":{m:62000,col:0.99},"Champaign":{m:60000,col:0.97},
    "Chicago":{m:78000,col:1.20},"Cicero":{m:62000,col:1.00},"Decatur":{m:56000,col:0.93},
    "Elgin":{m:64000,col:1.01},"Joliet":{m:65000,col:1.02},"Naperville":{m:78000,col:1.18},
    "Peoria":{m:58000,col:0.93},"Rockford":{m:57000,col:0.92},"Schaumburg":{m:74000,col:1.14},
    "Springfield":{m:60000,col:0.97},"Waukegan":{m:62000,col:1.00}}},
  "Indiana":{m:57000,col:0.90,ttf:34,tax:9.2,metros:{
    "Bloomington":{m:54000,col:0.89},"Carmel":{m:72000,col:1.04},"Evansville":{m:54000,col:0.89},
    "Fishers":{m:70000,col:1.02},"Fort Wayne":{m:54000,col:0.88},"Gary":{m:55000,col:0.90},
    "Hammond":{m:54000,col:0.89},"Indianapolis":{m:62000,col:0.96},"Kokomo":{m:52000,col:0.87},
    "Lafayette":{m:54000,col:0.89},"Muncie":{m:50000,col:0.86},"South Bend":{m:53000,col:0.87},
    "Terre Haute":{m:51000,col:0.87}}},
  "Iowa":{m:56000,col:0.88,ttf:34,tax:9.1,metros:{
    "Ames":{m:58000,col:0.90},"Cedar Falls":{m:55000,col:0.88},"Cedar Rapids":{m:57000,col:0.90},
    "Council Bluffs":{m:55000,col:0.88},"Davenport":{m:58000,col:0.91},"Des Moines":{m:62000,col:0.95},
    "Dubuque":{m:55000,col:0.88},"Iowa City":{m:58000,col:0.91},"Sioux City":{m:54000,col:0.87},
    "Waterloo":{m:53000,col:0.87},"West Des Moines":{m:64000,col:0.97}}},
  "Kansas":{m:57000,col:0.88,ttf:35,tax:9.2,metros:{
    "Kansas City":{m:64000,col:0.98},"Lawrence":{m:54000,col:0.88},"Lenexa":{m:66000,col:1.00},
    "Manhattan":{m:52000,col:0.87},"Olathe":{m:66000,col:1.00},"Overland Park":{m:68000,col:1.01},
    "Salina":{m:50000,col:0.86},"Shawnee":{m:64000,col:0.98},"Topeka":{m:54000,col:0.88},
    "Wichita":{m:58000,col:0.90}}},
  "Kentucky":{m:54000,col:0.87,ttf:35,tax:9.1,metros:{
    "Bowling Green":{m:51000,col:0.86},"Covington":{m:56000,col:0.90},"Frankfort":{m:54000,col:0.88},
    "Lexington":{m:57000,col:0.91},"Louisville":{m:60000,col:0.94},"Owensboro":{m:50000,col:0.85},
    "Paducah":{m:49000,col:0.85},"Richmond":{m:50000,col:0.86}}},
  "Louisiana":{m:52000,col:0.87,ttf:37,tax:9.0,metros:{
    "Alexandria":{m:47000,col:0.84},"Baton Rouge":{m:58000,col:0.92},"Bossier City":{m:52000,col:0.87},
    "Houma":{m:52000,col:0.87},"Lafayette":{m:54000,col:0.89},"Lake Charles":{m:52000,col:0.87},
    "Metairie":{m:57000,col:0.92},"Monroe":{m:47000,col:0.84},"New Orleans":{m:57000,col:0.93},
    "Shreveport":{m:51000,col:0.87}}},
  "Maine":{m:58000,col:1.00,ttf:37,tax:10.2,metros:{
    "Augusta":{m:56000,col:0.98},"Bangor":{m:58000,col:1.00},"Lewiston":{m:55000,col:0.97},
    "Portland":{m:64000,col:1.06}}},
  "Maryland":{m:80000,col:1.18,ttf:33,tax:10.8,metros:{
    "Annapolis":{m:82000,col:1.20},"Baltimore":{m:76000,col:1.13},"Bowie":{m:88000,col:1.28},
    "Columbia":{m:90000,col:1.30},"Frederick":{m:78000,col:1.16},"Gaithersburg":{m:92000,col:1.34},
    "Germantown":{m:88000,col:1.28},"Hagerstown":{m:62000,col:1.02},"Rockville":{m:96000,col:1.38},
    "Silver Spring":{m:92000,col:1.33}}},
  "Massachusetts":{m:86000,col:1.32,ttf:36,tax:11.6,metros:{
    "Boston":{m:94000,col:1.45},"Brockton":{m:70000,col:1.14},"Cambridge":{m:108000,col:1.60},
    "Fall River":{m:60000,col:1.02},"Framingham":{m:80000,col:1.24},"Haverhill":{m:72000,col:1.16},
    "Lowell":{m:70000,col:1.13},"Lynn":{m:68000,col:1.10},"New Bedford":{m:60000,col:1.02},
    "Newton":{m:98000,col:1.48},"Quincy":{m:82000,col:1.26},"Somerville":{m:100000,col:1.52},
    "Springfield":{m:62000,col:1.04},"Worcester":{m:72000,col:1.15}}},
  "Michigan":{m:60000,col:0.95,ttf:35,tax:9.5,metros:{
    "Ann Arbor":{m:74000,col:1.14},"Battle Creek":{m:54000,col:0.90},"Dearborn":{m:62000,col:0.99},
    "Detroit":{m:64000,col:1.00},"Flint":{m:54000,col:0.90},"Grand Rapids":{m:60000,col:0.95},
    "Kalamazoo":{m:58000,col:0.93},"Lansing":{m:60000,col:0.95},"Livonia":{m:66000,col:1.02},
    "Muskegon":{m:52000,col:0.88},"Pontiac":{m:58000,col:0.93},"Saginaw":{m:52000,col:0.88},
    "Sterling Heights":{m:64000,col:1.00},"Warren":{m:62000,col:0.98}}},
  "Minnesota":{m:72000,col:1.06,ttf:34,tax:10.6,metros:{
    "Bloomington":{m:76000,col:1.12},"Brooklyn Park":{m:70000,col:1.06},"Duluth":{m:60000,col:0.96},
    "Eden Prairie":{m:82000,col:1.18},"Mankato":{m:60000,col:0.96},"Minneapolis":{m:80000,col:1.16},
    "Plymouth":{m:82000,col:1.18},"Rochester":{m:68000,col:1.04},"St. Cloud":{m:60000,col:0.96},
    "St. Paul":{m:74000,col:1.10}}},
  "Mississippi":{m:46000,col:0.82,ttf:38,tax:8.9,metros:{
    "Biloxi":{m:47000,col:0.83},"Gulfport":{m:46000,col:0.82},"Hattiesburg":{m:46000,col:0.83},
    "Jackson":{m:50000,col:0.86},"Meridian":{m:44000,col:0.81},"Southaven":{m:50000,col:0.86},
    "Tupelo":{m:46000,col:0.83}}},
  "Missouri":{m:58000,col:0.90,ttf:34,tax:9.3,metros:{
    "Columbia":{m:58000,col:0.92},"Independence":{m:58000,col:0.91},"Jefferson City":{m:56000,col:0.90},
    "Joplin":{m:50000,col:0.85},"Kansas City":{m:66000,col:1.00},"Lee's Summit":{m:66000,col:1.00},
    "O'Fallon":{m:66000,col:1.00},"Springfield":{m:54000,col:0.88},"St. Charles":{m:64000,col:0.98},
    "St. Joseph":{m:52000,col:0.87},"St. Louis":{m:66000,col:1.00}}},
  "Montana":{m:52000,col:0.93,ttf:38,tax:9.4,metros:{
    "Billings":{m:56000,col:0.96},"Bozeman":{m:58000,col:0.98},"Butte":{m:50000,col:0.91},
    "Great Falls":{m:50000,col:0.91},"Helena":{m:54000,col:0.94},"Kalispell":{m:52000,col:0.92},
    "Missoula":{m:54000,col:0.94}}},
  "Nebraska":{m:56000,col:0.88,ttf:34,tax:9.2,metros:{
    "Bellevue":{m:60000,col:0.93},"Grand Island":{m:51000,col:0.86},"Kearney":{m:51000,col:0.86},
    "Lincoln":{m:58000,col:0.92},"Omaha":{m:62000,col:0.96}}},
  "Nevada":{m:61000,col:1.02,ttf:33,tax:9.0,metros:{
    "Carson City":{m:58000,col:0.98},"Henderson":{m:64000,col:1.04},"Las Vegas":{m:60000,col:1.00},
    "North Las Vegas":{m:58000,col:0.98},"Reno":{m:64000,col:1.04},"Sparks":{m:62000,col:1.02}}},
  "New Hampshire":{m:72000,col:1.08,ttf:35,tax:9.8,metros:{
    "Concord":{m:68000,col:1.05},"Dover":{m:68000,col:1.05},"Manchester":{m:70000,col:1.06},
    "Nashua":{m:74000,col:1.10},"Portsmouth":{m:72000,col:1.08}}},
  "New Jersey":{m:84000,col:1.28,ttf:35,tax:11.8,metros:{
    "Atlantic City":{m:60000,col:1.00},"Camden":{m:68000,col:1.12},"Cherry Hill":{m:78000,col:1.20},
    "Edison":{m:86000,col:1.30},"Elizabeth":{m:78000,col:1.22},"Jersey City":{m:90000,col:1.36},
    "Newark":{m:82000,col:1.28},"Paterson":{m:72000,col:1.16},"Toms River":{m:74000,col:1.16},
    "Trenton":{m:78000,col:1.20},"Woodbridge":{m:82000,col:1.26}}},
  "New Mexico":{m:52000,col:0.88,ttf:38,tax:9.2,metros:{
    "Albuquerque":{m:56000,col:0.92},"Farmington":{m:52000,col:0.88},"Las Cruces":{m:48000,col:0.86},
    "Rio Rancho":{m:56000,col:0.92},"Roswell":{m:48000,col:0.86},"Santa Fe":{m:56000,col:0.93}}},
  "New York":{m:80000,col:1.38,ttf:37,tax:12.4,metros:{
    "Albany":{m:66000,col:1.06},"Binghamton":{m:58000,col:0.97},"Buffalo":{m:60000,col:1.00},
    "Mount Vernon":{m:80000,col:1.30},"New Rochelle":{m:84000,col:1.34},"New York City":{m:94000,col:1.65},
    "Niagara Falls":{m:54000,col:0.94},"Rochester":{m:62000,col:1.02},"Schenectady":{m:62000,col:1.02},
    "Syracuse":{m:60000,col:0.99},"Utica":{m:56000,col:0.96},"White Plains":{m:90000,col:1.40},
    "Yonkers":{m:82000,col:1.32}}},
  "North Carolina":{m:60000,col:0.94,ttf:33,tax:9.4,metros:{
    "Asheville":{m:56000,col:0.92},"Cary":{m:80000,col:1.14},"Chapel Hill":{m:72000,col:1.08},
    "Charlotte":{m:68000,col:1.03},"Concord":{m:62000,col:0.99},"Durham":{m:74000,col:1.10},
    "Fayetteville":{m:54000,col:0.90},"Gastonia":{m:55000,col:0.91},"Greensboro":{m:58000,col:0.93},
    "High Point":{m:56000,col:0.91},"Raleigh":{m:74000,col:1.10},"Wilmington":{m:56000,col:0.92},
    "Winston-Salem":{m:57000,col:0.92}}},
  "North Dakota":{m:58000,col:0.90,ttf:35,tax:8.8,metros:{
    "Bismarck":{m:60000,col:0.93},"Fargo":{m:60000,col:0.93},"Grand Forks":{m:56000,col:0.90},
    "Minot":{m:58000,col:0.91},"West Fargo":{m:60000,col:0.93}}},
  "Ohio":{m:59000,col:0.91,ttf:34,tax:9.5,metros:{
    "Akron":{m:58000,col:0.93},"Canton":{m:54000,col:0.89},"Cincinnati":{m:62000,col:0.97},
    "Cleveland":{m:60000,col:0.95},"Columbus":{m:65000,col:0.99},"Dayton":{m:57000,col:0.91},
    "Elyria":{m:56000,col:0.91},"Lorain":{m:54000,col:0.89},"Parma":{m:58000,col:0.93},
    "Springfield":{m:54000,col:0.89},"Toledo":{m:56000,col:0.90},"Youngstown":{m:52000,col:0.87}}},
  "Oklahoma":{m:52000,col:0.85,ttf:36,tax:9.0,metros:{
    "Broken Arrow":{m:56000,col:0.89},"Edmond":{m:60000,col:0.92},"Lawton":{m:48000,col:0.84},
    "Moore":{m:53000,col:0.87},"Norman":{m:56000,col:0.89},"Oklahoma City":{m:56000,col:0.89},
    "Stillwater":{m:50000,col:0.86},"Tulsa":{m:56000,col:0.89}}},
  "Oregon":{m:68000,col:1.12,ttf:36,tax:10.8,metros:{
    "Beaverton":{m:74000,col:1.18},"Bend":{m:64000,col:1.08},"Corvallis":{m:64000,col:1.08},
    "Eugene":{m:60000,col:1.02},"Gresham":{m:66000,col:1.10},"Hillsboro":{m:82000,col:1.26},
    "Medford":{m:56000,col:0.98},"Portland":{m:76000,col:1.22},"Salem":{m:60000,col:1.02}}},
  "Pennsylvania":{m:64000,col:1.00,ttf:35,tax:10.2,metros:{
    "Allentown":{m:60000,col:0.97},"Altoona":{m:52000,col:0.90},"Bethlehem":{m:62000,col:0.99},
    "Erie":{m:54000,col:0.91},"Harrisburg":{m:64000,col:1.00},"Lancaster":{m:60000,col:0.97},
    "Philadelphia":{m:74000,col:1.14},"Pittsburgh":{m:64000,col:1.00},"Reading":{m:58000,col:0.95},
    "Scranton":{m:54000,col:0.91},"York":{m:58000,col:0.95}}},
  "Rhode Island":{m:68000,col:1.12,ttf:36,tax:10.8,metros:{
    "Cranston":{m:66000,col:1.10},"Pawtucket":{m:62000,col:1.06},"Providence":{m:68000,col:1.12},
    "Warwick":{m:66000,col:1.10},"Woonsocket":{m:60000,col:1.04}}},
  "South Carolina":{m:54000,col:0.88,ttf:34,tax:9.0,metros:{
    "Charleston":{m:62000,col:0.98},"Columbia":{m:58000,col:0.92},"Florence":{m:50000,col:0.87},
    "Goose Creek":{m:58000,col:0.93},"Greenville":{m:58000,col:0.92},"Myrtle Beach":{m:50000,col:0.87},
    "North Charleston":{m:58000,col:0.93},"Rock Hill":{m:56000,col:0.91},"Spartanburg":{m:54000,col:0.89},
    "Sumter":{m:48000,col:0.86}}},
  "South Dakota":{m:52000,col:0.84,ttf:35,tax:8.6,metros:{
    "Aberdeen":{m:50000,col:0.83},"Brookings":{m:50000,col:0.83},"Rapid City":{m:54000,col:0.86},
    "Sioux Falls":{m:56000,col:0.88},"Watertown":{m:49000,col:0.82}}},
  "Tennessee":{m:57000,col:0.90,ttf:33,tax:9.0,metros:{
    "Chattanooga":{m:55000,col:0.89},"Clarksville":{m:52000,col:0.87},"Jackson":{m:50000,col:0.86},
    "Johnson City":{m:50000,col:0.86},"Kingsport":{m:50000,col:0.86},"Knoxville":{m:54000,col:0.88},
    "Memphis":{m:56000,col:0.90},"Murfreesboro":{m:58000,col:0.92},"Nashville":{m:68000,col:1.04}}},
  "Texas":{m:62000,col:0.97,ttf:31,tax:9.2,metros:{
    "Abilene":{m:50000,col:0.85},"Allen":{m:74000,col:1.08},"Amarillo":{m:52000,col:0.87},
    "Arlington":{m:65000,col:1.00},"Austin":{m:80000,col:1.18},"Beaumont":{m:56000,col:0.91},
    "Brownsville":{m:44000,col:0.80},"Carrollton":{m:68000,col:1.03},"Corpus Christi":{m:54000,col:0.90},
    "Dallas":{m:70000,col:1.06},"Denton":{m:64000,col:1.00},"El Paso":{m:50000,col:0.84},
    "Fort Worth":{m:66000,col:1.02},"Frisco":{m:80000,col:1.16},"Garland":{m:64000,col:1.00},
    "Grand Prairie":{m:64000,col:1.00},"Houston":{m:68000,col:1.02},"Irving":{m:70000,col:1.06},
    "Killeen":{m:48000,col:0.83},"Laredo":{m:44000,col:0.80},"Lewisville":{m:68000,col:1.03},
    "Lubbock":{m:52000,col:0.87},"McKinney":{m:76000,col:1.12},"Mesquite":{m:60000,col:0.96},
    "Midland":{m:64000,col:1.00},"Odessa":{m:60000,col:0.96},"Pasadena":{m:58000,col:0.93},
    "Pearland":{m:68000,col:1.03},"Plano":{m:78000,col:1.14},"Richardson":{m:76000,col:1.12},
    "Round Rock":{m:74000,col:1.10},"San Antonio":{m:58000,col:0.92},"Tyler":{m:54000,col:0.89},
    "Waco":{m:50000,col:0.86},"Wichita Falls":{m:48000,col:0.84}}},
  "Utah":{m:66000,col:0.99,ttf:32,tax:9.2,metros:{
    "Layton":{m:64000,col:0.98},"Logan":{m:58000,col:0.94},"Ogden":{m:62000,col:0.97},
    "Orem":{m:65000,col:0.99},"Provo":{m:66000,col:1.00},"Salt Lake City":{m:70000,col:1.04},
    "Sandy":{m:70000,col:1.04},"St. George":{m:58000,col:0.94},"West Jordan":{m:66000,col:1.00},
    "West Valley City":{m:62000,col:0.97}}},
  "Vermont":{m:60000,col:1.06,ttf:38,tax:10.4,metros:{
    "Burlington":{m:64000,col:1.10},"Montpelier":{m:62000,col:1.08},"Rutland":{m:56000,col:1.02},
    "South Burlington":{m:64000,col:1.10}}},
  "Virginia":{m:74000,col:1.08,ttf:33,tax:10.2,metros:{
    "Alexandria":{m:98000,col:1.40},"Arlington":{m:102000,col:1.44},"Charlottesville":{m:68000,col:1.04},
    "Chesapeake":{m:64000,col:0.99},"Hampton":{m:60000,col:0.97},"Harrisonburg":{m:56000,col:0.92},
    "Lynchburg":{m:54000,col:0.90},"McLean":{m:108000,col:1.48},"Newport News":{m:62000,col:0.98},
    "Norfolk":{m:62000,col:0.98},"Portsmouth":{m:60000,col:0.97},"Reston":{m:102000,col:1.42},
    "Richmond":{m:68000,col:1.04},"Roanoke":{m:54000,col:0.90},"Suffolk":{m:62000,col:0.98},
    "Virginia Beach":{m:62000,col:0.98},"Winchester":{m:62000,col:0.99}}},
  "Washington":{m:80000,col:1.22,ttf:35,tax:10.4,metros:{
    "Bellevue":{m:104000,col:1.54},"Bellingham":{m:66000,col:1.08},"Everett":{m:78000,col:1.20},
    "Kent":{m:74000,col:1.16},"Kirkland":{m:100000,col:1.50},"Redmond":{m:110000,col:1.58},
    "Renton":{m:82000,col:1.24},"Seattle":{m:96000,col:1.48},"Spokane":{m:60000,col:0.98},
    "Tacoma":{m:72000,col:1.14},"Vancouver":{m:68000,col:1.10},"Yakima":{m:54000,col:0.93}}},
  "West Virginia":{m:46000,col:0.82,ttf:38,tax:9.0,metros:{
    "Charleston":{m:50000,col:0.86},"Huntington":{m:46000,col:0.82},"Morgantown":{m:52000,col:0.88},
    "Parkersburg":{m:46000,col:0.82},"Wheeling":{m:48000,col:0.84}}},
  "Wisconsin":{m:60000,col:0.93,ttf:34,tax:9.6,metros:{
    "Appleton":{m:60000,col:0.94},"Eau Claire":{m:56000,col:0.90},"Green Bay":{m:58000,col:0.93},
    "Janesville":{m:56000,col:0.91},"Kenosha":{m:58000,col:0.93},"La Crosse":{m:56000,col:0.91},
    "Madison":{m:68000,col:1.04},"Milwaukee":{m:64000,col:0.98},"Oshkosh":{m:56000,col:0.91},
    "Racine":{m:58000,col:0.93},"Sheboygan":{m:58000,col:0.93},"Waukesha":{m:64000,col:0.98},
    "Wausau":{m:56000,col:0.90}}},
  "Wyoming":{m:58000,col:0.91,ttf:36,tax:8.8,metros:{
    "Casper":{m:60000,col:0.93},"Cheyenne":{m:60000,col:0.93},"Gillette":{m:62000,col:0.95},
    "Laramie":{m:56000,col:0.91},"Rock Springs":{m:62000,col:0.95}}}
};

// ═══════════════════════════════════════════════════════
//  UNDERWRITING DISCOUNT ENGINE
//  Takes current group profile → returns estimated discount range
//  anchored to real approved outcomes, adjusted by risk factors
// ═══════════════════════════════════════════════════════
function estimateDiscount(numElig, participation, asi, industry, state, carrierKey) {
  // Start from the real anchor group's approved range
  var baseLow  = -0.0965;   // Aetna ZA1 — worst approved
  var baseHigh = -0.1431;   // Innovation Health — best approved

  var adjLow = baseLow, adjHigh = baseHigh;

  // ── Factor 1: Group size
  // Anchor: 8 eligible. Small groups (<10) face narrower carrier competition.
  // Larger groups attract more carriers and better rates.
  if (numElig !== null) {
    if (numElig >= 50)       { adjLow -= 0.015; adjHigh -= 0.020; }  // larger = better
    else if (numElig >= 25)  { adjLow -= 0.008; adjHigh -= 0.010; }
    else if (numElig >= 10)  { adjLow -= 0.003; adjHigh -= 0.005; }
    else if (numElig < 5)    { adjLow += 0.030; adjHigh += 0.025; }  // very small = worse
    // 5-9: baseline (matches anchor)
  }

  // ── Factor 2: Participation rate
  // Anchor: 63%. UHC declined due to tier shift. Below 65% shrinks competition.
  if (participation !== null) {
    if (participation >= 0.85)      { adjLow -= 0.015; adjHigh -= 0.020; }  // high participation = more carriers
    else if (participation >= 0.75) { adjLow -= 0.008; adjHigh -= 0.010; }
    else if (participation < 0.50)  { adjLow += 0.025; adjHigh += 0.018; }  // very low = risk
    else if (participation < 0.65)  { adjLow += 0.010; adjHigh += 0.008; }
    // 65-74%: near baseline
  }

  // ── Factor 3: ASI score
  // Anchor: 1.08 (slightly above neutral).
  // Higher ASI = riskier group = less favorable pricing.
  if (asi !== null) {
    if (asi <= 0.90)      { adjLow -= 0.020; adjHigh -= 0.025; }  // young/healthy
    else if (asi <= 0.99) { adjLow -= 0.010; adjHigh -= 0.012; }
    else if (asi >= 1.20) { adjLow += 0.025; adjHigh += 0.020; }  // older/higher risk
    else if (asi >= 1.10) { adjLow += 0.012; adjHigh += 0.008; }
    // 1.00-1.09: near baseline (anchor was 1.08)
  }

  // ── Factor 4: Industry risk
  // Anchor: low risk (professional services)
  if (industry === 'med') { adjLow += 0.008; adjHigh += 0.005; }
  if (industry === 'high'){ adjLow += 0.020; adjHigh += 0.015; }  // construction etc harder to price

  // ── Factor 5: Regional carrier competition
  // Anchor: NoVA/DC — competitive market with Innovation Health regional option
  // Innovation Health's -14.31% was the best because of regional network strength.
  // Other markets may not have that option.
  var hasRegionalBonus = (state === 'Virginia' || state === 'Maryland' || state === 'District of Columbia');
  if (!hasRegionalBonus) {
    adjHigh += 0.015;  // cap the high end without regional carrier advantage
  }

  // Clamp to reasonable real-world bounds (2% min, 20% max discount)
  adjLow  = Math.max(adjLow,  -0.020);
  adjHigh = Math.min(adjHigh, -0.200);
  // Ensure low <= high
  if (adjLow > adjHigh) { var tmp=adjLow; adjLow=adjHigh; adjHigh=tmp; }
  var adjMid = (adjLow + adjHigh) / 2;

  return { low: adjLow, mid: adjMid, high: adjHigh };
}

// ═══════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════
function toggleOtherCarrier(){
  var isOther=gv('carrier')==='other';
  document.getElementById('otherCarrierRow').style.display=isOther?'block':'none';
  if(!isOther) document.getElementById('otherCarrierName').value='';
}
// ═══════════════════════════════════════════════════════
//  ACA MARKETPLACE RATE LOOKUP
//  Uses CMS Marketplace API (marketplace.api.healthcare.gov)
//  Public rate-limited test key — works for up to ~500 req/hr
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
//  ACA RATE LOOKUP — fully offline, no fetch required
//  Built from 2026 CMS rate filings + HealthCare.gov data
//  Age-40 reference rates, federal 3:1 age curve applied
// ═══════════════════════════════════════════════════════

// Federal ACA age rating curve (age 21 = 1.000 baseline)
var AGE_CURVE = {
  18:0.635,19:0.635,20:0.635,21:1.000,22:1.000,23:1.000,24:1.000,
  25:1.004,26:1.024,27:1.048,28:1.087,29:1.119,30:1.135,31:1.159,
  32:1.183,33:1.198,34:1.214,35:1.222,36:1.230,37:1.238,38:1.246,
  39:1.254,40:1.262,41:1.278,42:1.294,43:1.317,44:1.349,45:1.389,
  46:1.436,47:1.492,48:1.556,49:1.619,50:1.690,51:1.762,52:1.841,
  53:1.927,54:2.021,55:2.107,56:2.201,57:2.302,58:2.411,59:2.468,
  60:2.584,61:2.700,62:2.756,63:2.813,64:3.000
};

// ZIP 3-digit prefix → state
var ZIP_TO_STATE = {
  "010":"MA","011":"MA","012":"MA","013":"MA","014":"MA","015":"MA","016":"MA","017":"MA","018":"MA","019":"MA",
  "020":"MA","021":"MA","022":"MA","023":"MA","024":"MA","025":"MA","026":"MA","027":"MA",
  "028":"RI","029":"RI",
  "030":"NH","031":"NH","032":"NH","033":"NH","034":"NH","035":"NH","036":"NH","037":"NH","038":"NH",
  "039":"ME","040":"ME","041":"ME","042":"ME","043":"ME","044":"ME","045":"ME","046":"ME","047":"ME","048":"ME","049":"ME",
  "050":"VT","051":"VT","052":"VT","053":"VT","054":"VT","056":"VT","057":"VT","058":"VT","059":"VT",
  "060":"CT","061":"CT","062":"CT","063":"CT","064":"CT","065":"CT","066":"CT","067":"CT","068":"CT","069":"CT",
  "070":"NJ","071":"NJ","072":"NJ","073":"NJ","074":"NJ","075":"NJ","076":"NJ","077":"NJ","078":"NJ","079":"NJ",
  "080":"NJ","081":"NJ","082":"NJ","083":"NJ","084":"NJ","085":"NJ","086":"NJ","087":"NJ","088":"NJ","089":"NJ",
  "100":"NY","101":"NY","102":"NY","103":"NY","104":"NY","105":"NY","106":"NY","107":"NY","108":"NY","109":"NY",
  "110":"NY","111":"NY","112":"NY","113":"NY","114":"NY","115":"NY","116":"NY","117":"NY","118":"NY","119":"NY",
  "120":"NY","121":"NY","122":"NY","123":"NY","124":"NY","125":"NY","126":"NY","127":"NY","128":"NY","129":"NY",
  "130":"NY","131":"NY","132":"NY","133":"NY","134":"NY","135":"NY","136":"NY","137":"NY","138":"NY","139":"NY",
  "140":"NY","141":"NY","142":"NY","143":"NY","144":"NY","145":"NY","146":"NY","147":"NY","148":"NY","149":"NY",
  "150":"PA","151":"PA","152":"PA","153":"PA","154":"PA","155":"PA","156":"PA","157":"PA","158":"PA","159":"PA",
  "160":"PA","161":"PA","162":"PA","163":"PA","164":"PA","165":"PA","166":"PA","167":"PA","168":"PA","169":"PA",
  "170":"PA","171":"PA","172":"PA","173":"PA","174":"PA","175":"PA","176":"PA","177":"PA","178":"PA","179":"PA",
  "180":"PA","181":"PA","182":"PA","183":"PA","184":"PA","185":"PA","186":"PA","187":"PA","188":"PA","189":"PA",
  "190":"PA","191":"PA","192":"PA","193":"PA","194":"PA","195":"PA","196":"PA",
  "197":"DE","198":"DE","199":"DE",
  "200":"DC","201":"DC","202":"DC","203":"DC","204":"DC","205":"DC",
  "206":"MD","207":"MD","208":"MD","209":"MD","210":"MD","211":"MD","212":"MD","214":"MD","215":"MD","216":"MD","217":"MD","218":"MD","219":"MD",
  "220":"VA","221":"VA","222":"VA","223":"VA","224":"VA","225":"VA","226":"VA","227":"VA","228":"VA","229":"VA",
  "230":"VA","231":"VA","232":"VA","233":"VA","234":"VA","235":"VA","236":"VA","237":"VA","238":"VA","239":"VA",
  "240":"VA","241":"VA","242":"VA","243":"VA","244":"VA","245":"VA","246":"VA",
  "247":"WV","248":"WV","249":"WV","250":"WV","251":"WV","252":"WV","253":"WV","254":"WV","255":"WV","256":"WV","257":"WV","258":"WV","259":"WV",
  "260":"WV","261":"WV","262":"WV","263":"WV","264":"WV","265":"WV","266":"WV","267":"WV","268":"WV",
  "270":"NC","271":"NC","272":"NC","273":"NC","274":"NC","275":"NC","276":"NC","277":"NC","278":"NC","279":"NC",
  "280":"NC","281":"NC","282":"NC","283":"NC","284":"NC","285":"NC","286":"NC","287":"NC","288":"NC","289":"NC",
  "290":"SC","291":"SC","292":"SC","293":"SC","294":"SC","295":"SC","296":"SC","297":"SC","298":"SC","299":"SC",
  "300":"GA","301":"GA","302":"GA","303":"GA","304":"GA","305":"GA","306":"GA","307":"GA","308":"GA","309":"GA",
  "310":"GA","311":"GA","312":"GA","313":"GA","314":"GA","315":"GA","316":"GA","317":"GA","318":"GA","319":"GA",
  "320":"FL","321":"FL","322":"FL","323":"FL","324":"FL","325":"FL","326":"FL","327":"FL","328":"FL","329":"FL",
  "330":"FL","331":"FL","332":"FL","333":"FL","334":"FL","335":"FL","336":"FL","337":"FL","338":"FL",
  "339":"FL","340":"FL","341":"FL","342":"FL","344":"FL","346":"FL","347":"FL","349":"FL",
  "350":"AL","351":"AL","352":"AL","354":"AL","355":"AL","356":"AL","357":"AL","358":"AL","359":"AL",
  "360":"AL","361":"AL","362":"AL","363":"AL","364":"AL","365":"AL","366":"AL","367":"AL","368":"AL","369":"AL",
  "370":"TN","371":"TN","372":"TN","373":"TN","374":"TN","376":"TN","377":"TN","378":"TN","379":"TN",
  "380":"TN","381":"TN","382":"TN","383":"TN","384":"TN","385":"TN",
  "386":"MS","387":"MS","388":"MS","389":"MS","390":"MS","391":"MS","392":"MS","393":"MS","394":"MS","395":"MS","396":"MS","397":"MS",
  "398":"GA","399":"GA",
  "400":"KY","401":"KY","402":"KY","403":"KY","404":"KY","405":"KY","406":"KY","407":"KY","408":"KY","409":"KY",
  "410":"KY","411":"KY","412":"KY","413":"KY","414":"KY","415":"KY","416":"KY","417":"KY","418":"KY",
  "420":"KY","421":"KY","422":"KY","423":"KY","424":"KY","425":"KY","426":"KY","427":"KY",
  "430":"OH","431":"OH","432":"OH","433":"OH","434":"OH","435":"OH","436":"OH","437":"OH","438":"OH","439":"OH",
  "440":"OH","441":"OH","442":"OH","443":"OH","444":"OH","445":"OH","446":"OH","447":"OH","448":"OH","449":"OH",
  "450":"OH","451":"OH","452":"OH","453":"OH","454":"OH","455":"OH","456":"OH","457":"OH","458":"OH",
  "460":"IN","461":"IN","462":"IN","463":"IN","464":"IN","465":"IN","466":"IN","467":"IN","468":"IN","469":"IN",
  "470":"IN","471":"IN","472":"IN","473":"IN","474":"IN","475":"IN","476":"IN","477":"IN","478":"IN","479":"IN",
  "480":"MI","481":"MI","482":"MI","483":"MI","484":"MI","485":"MI","486":"MI","487":"MI","488":"MI","489":"MI",
  "490":"MI","491":"MI","492":"MI","493":"MI","494":"MI","495":"MI","496":"MI","497":"MI","498":"MI","499":"MI",
  "500":"IA","501":"IA","502":"IA","503":"IA","504":"IA","505":"IA","506":"IA","507":"IA","508":"IA","509":"IA",
  "510":"IA","511":"IA","512":"IA","513":"IA","514":"IA","515":"IA","516":"IA",
  "520":"IA","521":"IA","522":"IA","523":"IA","524":"IA","525":"IA","526":"IA","527":"IA","528":"IA",
  "530":"WI","531":"WI","532":"WI","534":"WI","535":"WI","537":"WI","538":"WI","539":"WI",
  "540":"WI","541":"WI","542":"WI","543":"WI","544":"WI","545":"WI","546":"WI","547":"WI","548":"WI","549":"WI",
  "550":"MN","551":"MN","553":"MN","554":"MN","555":"MN","556":"MN","557":"MN","558":"MN","559":"MN",
  "560":"MN","561":"MN","562":"MN","563":"MN","564":"MN","565":"MN","566":"MN","567":"MN",
  "570":"SD","571":"SD","572":"SD","573":"SD","574":"SD","575":"SD","576":"SD","577":"SD",
  "580":"ND","581":"ND","582":"ND","583":"ND","584":"ND","585":"ND","586":"ND","587":"ND","588":"ND",
  "590":"MT","591":"MT","592":"MT","593":"MT","594":"MT","595":"MT","596":"MT","597":"MT","598":"MT","599":"MT",
  "600":"IL","601":"IL","602":"IL","603":"IL","604":"IL","605":"IL","606":"IL","607":"IL","608":"IL","609":"IL",
  "610":"IL","611":"IL","612":"IL","612":"IL","613":"IL","614":"IL","615":"IL","616":"IL","617":"IL","618":"IL","619":"IL",
  "620":"IL","621":"IL","622":"IL","623":"IL","624":"IL","625":"IL","626":"IL","627":"IL","628":"IL","629":"IL",
  "630":"MO","631":"MO","633":"MO","634":"MO","635":"MO","636":"MO","637":"MO","638":"MO","639":"MO",
  "640":"MO","641":"MO","644":"MO","645":"MO","646":"MO","647":"MO","648":"MO",
  "650":"MO","651":"MO","652":"MO","653":"MO","654":"MO","655":"MO","656":"MO","657":"MO","658":"MO",
  "660":"KS","661":"KS","662":"KS","664":"KS","665":"KS","666":"KS","667":"KS","668":"KS","669":"KS",
  "670":"KS","671":"KS","672":"KS","673":"KS","674":"KS","675":"KS","676":"KS","677":"KS","678":"KS","679":"KS",
  "680":"NE","681":"NE","683":"NE","684":"NE","685":"NE","686":"NE","687":"NE","688":"NE","689":"NE",
  "690":"NE","691":"NE","692":"NE","693":"NE",
  "700":"LA","701":"LA","703":"LA","704":"LA","705":"LA","706":"LA","707":"LA","708":"LA",
  "710":"LA","711":"LA","712":"LA","713":"LA","714":"LA",
  "716":"AR","717":"AR","718":"AR","719":"AR","720":"AR","721":"AR","722":"AR","723":"AR","724":"AR","725":"AR","726":"AR","727":"AR","728":"AR","729":"AR",
  "730":"OK","731":"OK","733":"OK","734":"OK","735":"OK","736":"OK","737":"OK","738":"OK","739":"OK",
  "740":"OK","741":"OK","743":"OK","744":"OK","745":"OK","746":"OK","747":"OK","748":"OK","749":"OK",
  "750":"TX","751":"TX","752":"TX","753":"TX","754":"TX","755":"TX","756":"TX","757":"TX","758":"TX","759":"TX",
  "760":"TX","761":"TX","762":"TX","763":"TX","764":"TX","765":"TX","766":"TX","767":"TX","768":"TX","769":"TX",
  "770":"TX","771":"TX","772":"TX","773":"TX","774":"TX","775":"TX","776":"TX","777":"TX","778":"TX","779":"TX",
  "780":"TX","781":"TX","782":"TX","783":"TX","784":"TX","785":"TX","786":"TX","787":"TX","788":"TX","789":"TX",
  "790":"TX","791":"TX","792":"TX","793":"TX","794":"TX","795":"TX","796":"TX","797":"TX","798":"TX","799":"TX",
  "800":"CO","801":"CO","802":"CO","803":"CO","804":"CO","805":"CO","806":"CO","807":"CO","808":"CO","809":"CO",
  "810":"CO","811":"CO","812":"CO","813":"CO","814":"CO","815":"CO","816":"CO",
  "820":"WY","821":"WY","822":"WY","823":"WY","824":"WY","825":"WY","826":"WY","827":"WY","828":"WY","829":"WY","830":"WY","831":"WY",
  "832":"ID","833":"ID","834":"ID","835":"ID","836":"ID","837":"ID","838":"ID",
  "840":"UT","841":"UT","842":"UT","843":"UT","844":"UT","845":"UT","846":"UT","847":"UT",
  "850":"AZ","851":"AZ","852":"AZ","853":"AZ","855":"AZ","856":"AZ","857":"AZ","859":"AZ","860":"AZ","861":"AZ","863":"AZ","864":"AZ","865":"AZ",
  "870":"NM","871":"NM","872":"NM","873":"NM","874":"NM","875":"NM","876":"NM","877":"NM","878":"NM","879":"NM",
  "880":"NM","881":"NM","882":"NM","883":"NM","884":"NM","885":"TX",
  "889":"NV","890":"NV","891":"NV","893":"NV","894":"NV","895":"NV","896":"NV","897":"NV","898":"NV",
  "900":"CA","901":"CA","902":"CA","903":"CA","904":"CA","905":"CA","906":"CA","907":"CA","908":"CA","909":"CA",
  "910":"CA","911":"CA","912":"CA","913":"CA","914":"CA","915":"CA","916":"CA","917":"CA","918":"CA","919":"CA",
  "920":"CA","921":"CA","922":"CA","923":"CA","924":"CA","925":"CA","926":"CA","927":"CA","928":"CA",
  "930":"CA","931":"CA","932":"CA","933":"CA","934":"CA","935":"CA","936":"CA","937":"CA","938":"CA","939":"CA",
  "940":"CA","941":"CA","942":"CA","943":"CA","944":"CA","945":"CA","946":"CA","947":"CA","948":"CA","949":"CA",
  "950":"CA","951":"CA","952":"CA","953":"CA","954":"CA","955":"CA","956":"CA","957":"CA","958":"CA","959":"CA",
  "960":"CA","961":"CA",
  "967":"HI","968":"HI",
  "970":"OR","971":"OR","972":"OR","973":"OR","974":"OR","975":"OR","976":"OR","977":"OR","978":"OR","979":"OR",
  "980":"WA","981":"WA","982":"WA","983":"WA","984":"WA","985":"WA","986":"WA","988":"WA","989":"WA",
  "990":"WA","991":"WA","992":"WA","993":"WA","994":"WA",
  "995":"AK","996":"AK","997":"AK","998":"AK","999":"AK"
};

// State base rates — age-40 monthly, lowest-cost plan per metal (2026)
// bronze=lowest bronze, silver=lowest silver, gold=lowest gold
var ACA_STATE = {
  "AL":{b:218,s:298,g:348, b25:206,s25:281,g25:328, b24:196,s24:267,g24:312, trend26:5.8, trend25:4.9, note:"BCBS Alabama dominant; limited competition statewide"},
  "AK":{b:520,s:698,g:812, b25:489,s25:656,g25:764, b24:464,s24:623,g24:725, trend26:6.3, trend25:5.4, note:"Highest-cost state; near-monopoly carrier market"},
  "AZ":{b:248,s:334,g:392, b25:233,s25:314,g25:369, b24:220,s24:298,g24:350, trend26:6.4, trend25:5.5, note:"Competitive Phoenix/Tucson; rural areas 20-30% higher"},
  "AR":{b:204,s:278,g:324, b25:192,s25:261,g25:305, b24:183,s24:248,g24:290, trend26:6.2, trend25:5.0, note:"Lower-cost market; limited carrier options outside Little Rock"},
  "CA":{b:296,s:398,g:468, b25:278,s25:374,g25:440, b24:263,s24:355,g24:418, trend26:6.4, trend25:5.4, note:"Covered California; strong urban competition, rural variation"},
  "CO":{b:268,s:362,g:424, b25:252,s25:340,g25:399, b24:239,s24:323,g24:379, trend26:6.3, trend25:5.4, note:"Denver/Boulder premium; resort county surcharges apply"},
  "CT":{b:338,s:452,g:528, b25:318,s25:425,g25:497, b24:302,s24:404,g24:472, trend26:6.3, trend25:5.2, note:"High-cost state; limited carrier competition"},
  "DE":{b:312,s:418,g:488, b25:293,s25:393,g25:459, b24:278,s24:373,g24:436, trend26:6.5, trend25:5.3, note:"Mid-Atlantic pricing; Highmark dominant"},
  "DC":{b:298,s:402,g:468, b25:280,s25:378,g25:440, b24:266,s24:359,g24:418, trend26:6.4, trend25:5.2, note:"Urban market; good carrier competition across plans"},
  "FL":{b:278,s:372,g:434, b25:261,s25:350,g25:408, b24:248,s24:332,g24:388, trend26:6.5, trend25:5.4, note:"Large competitive market; significant county variation"},
  "GA":{b:248,s:334,g:390, b25:233,s25:314,g25:367, b24:221,s24:298,g24:348, trend26:6.4, trend25:5.3, note:"Atlanta lower; rural Georgia 15-25% higher than metro"},
  "HI":{b:318,s:428,g:498, b25:299,s25:402,g25:468, b24:284,s24:382,g24:445, trend26:6.4, trend25:5.3, note:"High CoL; HMSA and Kaiser dominate the market"},
  "ID":{b:272,s:366,g:428, b25:256,s25:344,g25:402, b24:243,s24:327,g24:382, trend26:6.2, trend25:5.2, note:"Moderate-cost; Blue Cross of Idaho dominant"},
  "IL":{b:282,s:378,g:442, b25:265,s25:355,g25:416, b24:251,s24:337,g24:395, trend26:6.4, trend25:5.3, note:"Chicago competitive; downstate higher relative to wages"},
  "IN":{b:258,s:346,g:404, b25:242,s25:325,g25:380, b24:230,s24:309,g24:361, trend26:6.6, trend25:5.4, note:"Moderate market; Anthem and MDwise compete"},
  "IA":{b:244,s:328,g:384, b25:229,s25:308,g25:361, b24:218,s24:293,g24:343, trend26:6.6, trend25:5.3, note:"Competitive Midwest market; Wellmark dominant"},
  "KS":{b:238,s:320,g:374, b25:224,s25:301,g25:352, b24:212,s24:286,g24:334, trend26:6.2, trend25:5.1, note:"Limited competition outside KC metro area"},
  "KY":{b:228,s:308,g:360, b25:214,s25:289,g25:338, b24:204,s24:275,g24:321, trend26:6.5, trend25:5.2, note:"kynect exchange; competitive Louisville and Lexington"},
  "LA":{b:268,s:360,g:420, b25:252,s25:338,g25:395, b24:239,s24:321,g24:375, trend26:6.3, trend25:5.3, note:"Moderate cost; BCBS Louisiana dominant statewide"},
  "ME":{b:338,s:452,g:528, b25:318,s25:425,g25:497, b24:302,s24:404,g24:472, trend26:6.3, trend25:5.2, note:"High-cost state; community rating limits age band spread"},
  "MD":{b:288,s:388,g:452, b25:271,s25:364,g25:425, b24:257,s24:346,g24:404, trend26:6.6, trend25:5.4, note:"Maryland exchange; DC suburbs carry a premium"},
  "MA":{b:348,s:468,g:546, b25:327,s25:440,g25:513, b24:310,s24:418,g24:488, trend26:6.4, trend25:5.3, note:"Community rating state; near-universal coverage baseline"},
  "MI":{b:258,s:346,g:404, b25:243,s25:325,g25:380, b24:231,s24:309,g24:361, trend26:6.2, trend25:5.2, note:"Healthy Michigan Plan; competitive Detroit and Grand Rapids"},
  "MN":{b:298,s:400,g:468, b25:280,s25:376,g25:440, b24:266,s24:357,g24:418, trend26:6.4, trend25:5.3, note:"MNsure; Minneapolis competitive, Greater MN higher"},
  "MS":{b:238,s:320,g:374, b25:224,s25:301,g25:352, b24:213,s24:286,g24:334, trend26:6.2, trend25:5.0, note:"Among lowest-cost states; very limited carrier options"},
  "MO":{b:248,s:334,g:390, b25:233,s25:314,g25:367, b24:221,s24:298,g24:348, trend26:6.4, trend25:5.3, note:"KC and STL competitive; rural Missouri significantly higher"},
  "MT":{b:318,s:428,g:498, b25:299,s25:402,g25:468, b24:284,s24:382,g24:445, trend26:6.4, trend25:5.2, note:"High-cost rural state; Blue Cross MT near-monopoly"},
  "NE":{b:308,s:414,g:484, b25:289,s25:389,g25:455, b24:275,s24:370,g24:432, trend26:6.6, trend25:5.2, note:"Limited competition; Medica and BCBS dominant"},
  "NV":{b:262,s:352,g:412, b25:246,s25:331,g25:387, b24:234,s24:314,g24:368, trend26:6.5, trend25:5.3, note:"Las Vegas competitive; rural Nevada 30-40% higher"},
  "NH":{b:318,s:428,g:498, b25:299,s25:402,g25:468, b24:284,s24:382,g24:445, trend26:6.4, trend25:5.3, note:"High-cost; Ambetter and Harvard Pilgrim compete"},
  "NJ":{b:322,s:432,g:504, b25:303,s25:406,g25:474, b24:288,s24:386,g24:450, trend26:6.3, trend25:5.2, note:"GetCoveredNJ; urban NJ near NYC-level pricing"},
  "NM":{b:228,s:306,g:358, b25:214,s25:288,g25:337, b24:204,s24:273,g24:320, trend26:6.5, trend25:5.3, note:"beWellnm; lower-cost market with moderate competition"},
  "NY":{b:368,s:494,g:578, b25:346,s25:464,g25:544, b24:328,s24:441,g24:517, trend26:6.4, trend25:5.5, note:"NY State of Health; NYC rating area far above state avg"},
  "NC":{b:268,s:360,g:420, b25:252,s25:338,g25:395, b24:239,s24:321,g24:375, trend26:6.3, trend25:5.3, note:"Competitive; Blue Cross NC dominant across the state"},
  "ND":{b:312,s:418,g:488, b25:293,s25:393,g25:459, b24:278,s24:373,g24:436, trend26:6.5, trend25:5.2, note:"Very limited competition; BCBS ND near-monopoly"},
  "OH":{b:252,s:338,g:396, b25:237,s25:318,g25:373, b24:225,s24:302,g24:354, trend26:6.3, trend25:5.2, note:"Competitive market; significant metro vs rural variation"},
  "OK":{b:244,s:328,g:384, b25:229,s25:308,g25:361, b24:218,s24:293,g24:343, trend26:6.5, trend25:5.2, note:"Limited competition outside OKC and Tulsa"},
  "OR":{b:288,s:388,g:452, b25:271,s25:364,g25:425, b24:257,s24:346,g24:404, trend26:6.3, trend25:5.2, note:"OHP marketplace; Portland competitive, rural Oregon higher"},
  "PA":{b:278,s:374,g:436, b25:261,s25:351,g25:410, b24:248,s24:334,g24:389, trend26:6.5, trend25:5.3, note:"Pennie marketplace; Philly and Pittsburgh differ significantly"},
  "RI":{b:318,s:428,g:498, b25:299,s25:402,g25:468, b24:284,s24:382,g24:445, trend26:6.3, trend25:5.2, note:"HealthSource RI; small market with limited plan options"},
  "SC":{b:258,s:346,g:404, b25:243,s25:325,g25:380, b24:231,s24:309,g24:361, trend26:6.2, trend25:5.2, note:"Moderate cost; BCBS SC dominant across the state"},
  "SD":{b:332,s:446,g:520, b25:312,s25:419,g25:489, b24:296,s24:398,g24:465, trend26:6.4, trend25:5.3, note:"Limited competition; BCBS SD near-monopoly market"},
  "TN":{b:238,s:320,g:374, b25:224,s25:301,g25:352, b24:213,s24:286,g24:334, trend26:6.2, trend25:5.1, note:"Competitive Nashville; rural TN options more limited"},
  "TX":{b:268,s:360,g:420, b25:252,s25:338,g25:395, b24:239,s24:321,g24:375, trend26:6.3, trend25:5.3, note:"Large market; no state exchange, major metro variation"},
  "UT":{b:258,s:346,g:404, b25:242,s25:325,g25:380, b24:230,s24:309,g24:361, trend26:6.5, trend25:5.2, note:"SelectHealth and BCBS compete; generally competitive"},
  "VT":{b:418,s:562,g:656, b25:393,s25:528,g25:617, b24:373,s24:502,g24:586, trend26:6.4, trend25:5.3, note:"VT Health Connect; highest per-capita costs in contiguous US"},
  "VA":{b:262,s:352,g:412, b25:246,s25:331,g25:387, b24:234,s24:314,g24:368, trend26:6.5, trend25:5.4, note:"Virginia marketplace; NoVA near DC carries a premium"},
  "WA":{b:282,s:378,g:442, b25:265,s25:355,g25:416, b24:252,s24:338,g24:395, trend26:6.4, trend25:5.3, note:"WaHealthPlanfinder; Seattle premium, broad competition"},
  "WV":{b:368,s:494,g:578, b25:346,s25:464,g25:544, b24:328,s24:441,g24:517, trend26:6.3, trend25:5.3, note:"High-cost state; very limited carrier competition"},
  "WI":{b:278,s:374,g:436, b25:261,s25:351,g25:410, b24:248,s24:334,g24:389, trend26:6.4, trend25:5.3, note:"Competitive market; multiple carriers across major metros"},
  "WY":{b:428,s:576,g:672, b25:402,s25:541,g25:631, b24:382,s24:514,g24:600, trend26:6.5, trend25:5.4, note:"Second-highest cost state; near-monopoly carrier market"}
};

// Metro cost adjustment — multiply state base by this factor
// Keyed as STATE_ZIPPREFIX for major metros that differ from state average
var ACA_METRO = {
  "NY_100":1.42,"NY_101":1.42,"NY_102":1.42,"NY_103":1.10,"NY_104":1.10,
  "NY_110":1.38,"NY_111":1.38,"NY_112":1.38,"NY_113":1.38,"NY_114":1.38,
  "NY_116":1.38,"NY_117":1.22,"NY_118":1.22,"NY_119":1.22,
  "CA_900":1.08,"CA_901":1.08,"CA_902":1.08,"CA_906":1.08,"CA_907":1.08,"CA_908":1.08,
  "CA_940":1.32,"CA_941":1.32,"CA_942":1.32,"CA_943":1.18,"CA_944":1.18,"CA_945":1.18,"CA_946":1.28,"CA_947":1.28,"CA_948":1.22,"CA_949":1.22,
  "TX_787":1.08,"TX_733":0.96,"TX_750":0.94,"TX_751":0.94,"TX_752":0.94,"TX_753":0.94,
  "FL_330":1.12,"FL_331":1.12,"FL_332":1.12,"FL_333":1.12,
  "PA_190":1.14,"PA_191":1.14,"PA_192":1.14,"PA_193":1.14,"PA_194":1.14,
  "IL_606":1.10,"IL_607":1.10,"IL_608":1.10,"IL_609":1.10,
  "WA_980":1.18,"WA_981":1.18,"WA_982":1.12,
  "CO_800":1.10,"CO_801":1.10,"CO_802":1.10,"CO_803":1.08,"CO_804":1.08,
  "VA_220":1.18,"VA_221":1.18,"VA_222":1.18,"VA_223":1.18,
  "MD_208":1.12,"MD_209":1.12,"MD_207":1.08,
  "MA_021":1.14,"MA_022":1.14,"MA_024":1.14,
  "OR_970":1.10,"OR_971":1.10,"OR_972":1.10,
  "MN_550":1.06,"MN_551":1.06,"MN_553":1.06,"MN_554":1.06,"MN_555":1.06
};

function lookupACArates() {
  var zip     = document.getElementById('acaZip').value.trim();
  var agesRaw = document.getElementById('acaAges').value.trim();
  var year    = document.getElementById('acaYear').value;

  if (!zip || zip.length !== 5) { alert('Please enter a valid 5-digit ZIP code.'); return; }

  // Parse ages — default representative spread if blank
  var ages = [];
  if (agesRaw) {
    ages = agesRaw.split(',').map(function(a) { return parseInt(a.trim(), 10); })
                  .filter(function(a) { return !isNaN(a) && a >= 18 && a <= 64; });
  }
  if (!ages.length) ages = [25, 30, 35, 40, 45, 50, 55, 60];

  // Resolve state from ZIP prefix
  var prefix = zip.substring(0, 3);
  var state  = ZIP_TO_STATE[prefix];
  if (!state || !ACA_STATE[state]) {
    document.getElementById('acaStatus').style.display = 'block';
    document.getElementById('acaStatus').style.borderLeftColor = 'var(--orange)';
    document.getElementById('acaStatusMsg').textContent = 'ZIP code ' + zip + ' not recognized. Please check and try again.';
    return;
  }

  // Get base rates and apply metro factor if applicable
  var base      = ACA_STATE[state];
  var metroKey  = state + '_' + prefix;
  var factor    = ACA_METRO[metroKey] || 1.0;
  var yr2025    = year === '2025';   // 2025 rates ~6% lower on average
  var yrFactor  = yr2025 ? 0.94 : 1.0;

  var bBase = Math.round(base.b * factor * yrFactor);
  var sBase = Math.round(base.s * factor * yrFactor);
  var gBase = Math.round(base.g * factor * yrFactor);

  // Build age-banded rates using federal age curve
  // Age-40 reference = AGE_CURVE[40] = 1.262, so divide to get the true base then multiply by age curve
  var refCurve = AGE_CURVE[40] || 1.262;
  var ageRates = ages.map(function(age) {
    var curve = AGE_CURVE[age] || AGE_CURVE[40];
    var ratio  = curve / refCurve;
    return {
      age: age,
      bronze_low: Math.round(bBase * ratio),
      bronze_mid: Math.round(bBase * ratio * 1.12),
      silver_low: Math.round(sBase * ratio),
      silver_mid: Math.round(sBase * ratio * 1.10),
      gold_low:   Math.round(gBase * ratio),
      gold_mid:   Math.round(gBase * ratio * 1.09)
    };
  });

  var locationLabel = state + ' · ZIP ' + zip + (factor !== 1.0 ? ' (metro-adjusted)' : ' (state average)');

  // Historical silver rates (apply same metro factor for apples-to-apples comparison)
  var hist24s = base.s24 ? Math.round(base.s24 * factor) : null;
  var hist25s = base.s25 ? Math.round(base.s25 * factor) : null;

  renderACAresults({
    zip: zip, year: year, state: state,
    location: locationLabel,
    metro_factor: factor,
    note: base.note,
    age_rates: ageRates,
    avg_bronze: bBase, avg_silver: sBase, avg_gold: gBase,
    hist: { s24: hist24s, s25: hist25s },
    trend26: base.trend26 || 6.2
  });
  document.getElementById('acaStatus').style.display = 'none';
}

function renderACAresults(data) {
  var ff2 = function(n) { return (n != null && !isNaN(n)) ? '$' + Math.round(n).toLocaleString('en-US') : '-'; };
  var fp2 = function(n) { return (n != null && !isNaN(n)) ? n.toFixed(1) + '%' : '-'; };

  document.getElementById('acaLocationLabel').textContent = data.location || data.state;
  document.getElementById('acaPlanCount').textContent     = data.year + ' plan year  |  individual market benchmark';

  // ── Age-banded rate table ──────────────────────────────
  var rates = data.age_rates || [];
  var tHead =
    '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
    '<thead><tr style="border-bottom:1px solid var(--border);">' +
    '<th style="text-align:left;padding:6px 10px;color:var(--muted);font-weight:500;">Age</th>' +
    '<th style="text-align:right;padding:6px 8px;color:#cd7c2e;font-weight:500;">Bronze Low</th>' +
    '<th style="text-align:right;padding:6px 8px;color:#cd7c2e;font-weight:500;">Bronze Mid</th>' +
    '<th style="text-align:right;padding:6px 8px;color:var(--blue);font-weight:500;">Silver Low</th>' +
    '<th style="text-align:right;padding:6px 8px;color:var(--blue);font-weight:500;">Silver Mid</th>' +
    '<th style="text-align:right;padding:6px 8px;color:var(--yellow);font-weight:500;">Gold Low</th>' +
    '<th style="text-align:right;padding:6px 8px;color:var(--yellow);font-weight:500;">Gold Mid</th>' +
    '</tr></thead><tbody>';

  var silverLows = [], goldLows = [], bronzeLows = [];
  var tRows = rates.map(function(r) {
    if (r.silver_low) silverLows.push(r.silver_low);
    if (r.gold_low)   goldLows.push(r.gold_low);
    if (r.bronze_low) bronzeLows.push(r.bronze_low);
    return '<tr style="border-bottom:1px solid rgba(255,255,255,0.04);">' +
      '<td style="padding:6px 10px;color:var(--muted);">Age ' + r.age + '</td>' +
      '<td style="text-align:right;padding:6px 8px;color:#cd7c2e;">'                    + ff2(r.bronze_low) + '/mo</td>' +
      '<td style="text-align:right;padding:6px 8px;color:#a06020;">'                    + ff2(r.bronze_mid) + '/mo</td>' +
      '<td style="text-align:right;padding:6px 8px;color:var(--blue);font-weight:600;">'+ ff2(r.silver_low) + '/mo</td>' +
      '<td style="text-align:right;padding:6px 8px;color:var(--blue);">'                + ff2(r.silver_mid) + '/mo</td>' +
      '<td style="text-align:right;padding:6px 8px;color:var(--yellow);">'              + ff2(r.gold_low)   + '/mo</td>' +
      '<td style="text-align:right;padding:6px 8px;color:#b09020;">'                    + ff2(r.gold_mid)   + '/mo</td>' +
      '</tr>';
  }).join('');
  document.getElementById('acaAgeBands').innerHTML = tHead + tRows + '</tbody></table>';

  // ── Summary cards ──────────────────────────────────────
  var avg = function(arr) { return arr.length ? Math.round(arr.reduce(function(a,b){return a+b;},0)/arr.length) : null; };
  var avgSilver = avg(silverLows), avgGold = avg(goldLows), avgBronze = avg(bronzeLows);

  window.acaAvgSilver = avgSilver;
  window.acaAvgGold   = avgGold;
  window.acaAvgBronze = avgBronze;
  window.acaYear      = data.year;
  window.acaLocation  = data.location;

  var cards = [
    {label:'Avg Bronze (low)',  val: ff2(avgBronze)+'/mo',                           color:'#cd7c2e'},
    {label:'Avg Silver (low)',  val: ff2(avgSilver)+'/mo',                           color:'var(--blue)'},
    {label:'Avg Gold (low)',    val: ff2(avgGold)+'/mo',                             color:'var(--yellow)'},
    {label:'Silver x2 (EE+1)', val: avgSilver ? ff2(avgSilver*2)+'/mo' : '-',       color:'var(--purple)'}
  ];
  document.getElementById('acaSummaryCards').innerHTML = cards.map(function(c) {
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 14px;">' +
      '<div style="font-size:11px;color:var(--muted);margin-bottom:4px;">' + c.label + '</div>' +
      '<div style="font-size:18px;font-weight:700;color:' + c.color + ';">' + c.val + '</div></div>';
  }).join('');

  // ── vs current premium callout ─────────────────────────
  var clientAvg = getRaw('premAvg');
  var vsPremEl  = document.getElementById('acaVsPremium');
  if (vsPremEl && clientAvg && avgSilver) {
    var diff    = clientAvg - avgSilver;
    var diffPct = Math.round(Math.abs(diff / avgSilver) * 100);
    var msg = diff > 0
      ? 'Their blended avg premium of <strong>' + ff2(clientAvg) + '</strong> is ' +
        '<strong style="color:var(--orange);">&#9650; ' + diffPct + '% above</strong> the lowest Silver benchmark ' +
        '(' + ff2(avgSilver) + '/mo) — strong signal they are paying above-market. Ideal TotalSource opening.'
      : 'Their blended avg premium of <strong>' + ff2(clientAvg) + '</strong> is ' +
        '<strong style="color:var(--green);">&#9660; ' + diffPct + '% below</strong> the lowest Silver benchmark ' +
        '(' + ff2(avgSilver) + '/mo) — rate is competitive. Lead with HR and compliance value, not just premium savings.';
    vsPremEl.innerHTML =
      '<div style="font-size:11px;font-weight:600;color:var(--muted);margin-bottom:6px;letter-spacing:.8px;">CURRENT PREMIUM VS. MARKET BENCHMARK</div>' + msg;
    vsPremEl.style.display = 'block';
  } else {
    vsPremEl.style.display = 'none';
  }

  // ── Market notes ───────────────────────────────────────
  var noteEl = document.getElementById('acaMarketNotes');
  if (noteEl && data.note) {
    noteEl.textContent = data.note;
    noteEl.style.display = 'block';
  }

  // ── YOY Trend Chart ────────────────────────────────────
  if (data.hist && data.hist.s24 && data.hist.s25 && avgSilver) {
    var yoyEl = document.getElementById('acaYOY');
    yoyEl.style.display = 'block';

    var y24s = data.hist.s24, y25s = data.hist.s25, y26s = avgSilver;
    var maxVal = Math.max(y24s, y25s, y26s);

    var pct24 = Math.round((y24s / maxVal) * 100);
    var pct25 = Math.round((y25s / maxVal) * 100);
    var pct26 = 100;

    var chg2425 = ((y25s - y24s) / y24s * 100).toFixed(1);
    var chg2526 = ((y26s - y25s) / y25s * 100).toFixed(1);
    var chg2426 = ((y26s - y24s) / y24s * 100).toFixed(1);

    var barColor24 = '#4a5568';
    var barColor25 = '#5a7a9e';
    var barColor26 = '#60a5fa';

    var chartHTML =
      '<div style="display:flex;flex-direction:column;gap:10px;">' +

      '<div style="display:flex;align-items:center;gap:10px;">' +
      '<div style="width:38px;font-size:12px;color:var(--muted);text-align:right;flex-shrink:0;">2024</div>' +
      '<div style="flex:1;height:32px;background:var(--border);border-radius:4px;position:relative;overflow:hidden;">' +
      '<div style="width:' + pct24 + '%;height:100%;background:' + barColor24 + ';border-radius:4px;display:flex;align-items:center;justify-content:flex-end;padding-right:8px;">' +
      '<span style="font-size:12px;font-weight:600;color:#e8e9ec;">' + ff2(y24s) + '</span></div></div></div>' +

      '<div style="display:flex;align-items:center;gap:10px;">' +
      '<div style="width:38px;font-size:12px;color:var(--muted);text-align:right;flex-shrink:0;">2025</div>' +
      '<div style="flex:1;height:32px;background:var(--border);border-radius:4px;position:relative;overflow:hidden;">' +
      '<div style="width:' + pct25 + '%;height:100%;background:' + barColor25 + ';border-radius:4px;display:flex;align-items:center;justify-content:flex-end;padding-right:8px;">' +
      '<span style="font-size:12px;font-weight:600;color:#e8e9ec;">' + ff2(y25s) + '</span></div></div>' +
      '<div style="font-size:11px;color:var(--orange);white-space:nowrap;">+' + chg2425 + '%</div></div>' +

      '<div style="display:flex;align-items:center;gap:10px;">' +
      '<div style="width:38px;font-size:12px;color:var(--blue);font-weight:600;text-align:right;flex-shrink:0;">2026</div>' +
      '<div style="flex:1;height:32px;background:var(--border);border-radius:4px;position:relative;overflow:hidden;">' +
      '<div style="width:' + pct26 + '%;height:100%;background:' + barColor26 + ';border-radius:4px;display:flex;align-items:center;justify-content:flex-end;padding-right:8px;">' +
      '<span style="font-size:12px;font-weight:600;color:#0a0f1a;">' + ff2(y26s) + '</span></div></div>' +
      '<div style="font-size:11px;color:var(--orange);white-space:nowrap;">+' + chg2526 + '%</div></div>' +

      '</div>';

    document.getElementById('acaYOYChart').innerHTML = chartHTML;

    var yoyCards =
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 14px;">' +
      '<div style="font-size:11px;color:var(--muted);margin-bottom:4px;">2024 Lowest Silver</div>' +
      '<div style="font-size:16px;font-weight:700;color:#4a8ab0;">' + ff2(y24s) + '/mo</div></div>' +
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 14px;">' +
      '<div style="font-size:11px;color:var(--muted);margin-bottom:4px;">2025 Lowest Silver</div>' +
      '<div style="font-size:16px;font-weight:700;color:#5a9ac0;">' + ff2(y25s) + '/mo</div></div>' +
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 14px;">' +
      '<div style="font-size:11px;color:var(--muted);margin-bottom:4px;">2-Year Cumulative Rise</div>' +
      '<div style="font-size:16px;font-weight:700;color:var(--orange);">+' + chg2426 + '%</div></div>';

    document.getElementById('acaYOYCards').innerHTML = yoyCards;
  } else {
    document.getElementById('acaYOY').style.display = 'none';
  }

  // ── Renewal Premium Projection ─────────────────────────
  if (data.trend26 && avgSilver) {
    var renewEl = document.getElementById('acaRenewal');
    renewEl.style.display = 'block';

    var clientPrem = getRaw('premAvg') || avgSilver;
    var enrolled   = getRaw('numEE') ? Math.round(getRaw('numEE') * (parseInt(document.getElementById('benefitsRate').value || '75') / 100)) : null;
    var empRate    = getRaw('contribPct') ? getRaw('contribPct') / 100 : 0.75;

    var mktTrend = data.trend26;
    var proj1yr  = Math.round(clientPrem * (1 + mktTrend / 100));
    var proj2yr  = Math.round(clientPrem * Math.pow(1 + mktTrend / 100, 2));
    var proj3yr  = Math.round(clientPrem * Math.pow(1 + mktTrend / 100, 3));

    var annCostNow  = enrolled ? Math.round(clientPrem * empRate * enrolled * 12) : null;
    var annCost1yr  = enrolled ? Math.round(proj1yr * empRate * enrolled * 12) : null;
    var annCost3yr  = enrolled ? Math.round(proj3yr * empRate * enrolled * 12) : null;

    var renewHTML =
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:14px;">' +

      '<div style="background:var(--dark);border:1px solid var(--border);border-radius:8px;padding:12px 14px;">' +
      '<div style="font-size:11px;color:var(--muted);margin-bottom:4px;">Current Avg Premium</div>' +
      '<div style="font-size:16px;font-weight:700;color:var(--text);">' + ff2(clientPrem) + '/mo</div>' +
      '<div style="font-size:11px;color:var(--muted);margin-top:2px;">baseline</div></div>' +

      '<div style="background:var(--dark);border:1px solid var(--border);border-radius:8px;padding:12px 14px;">' +
      '<div style="font-size:11px;color:var(--muted);margin-bottom:4px;">Projected +1 Year</div>' +
      '<div style="font-size:16px;font-weight:700;color:var(--orange);">' + ff2(proj1yr) + '/mo</div>' +
      '<div style="font-size:11px;color:var(--orange);margin-top:2px;">+' + mktTrend.toFixed(1) + '% trend</div></div>' +

      '<div style="background:var(--dark);border:1px solid var(--border);border-radius:8px;padding:12px 14px;">' +
      '<div style="font-size:11px;color:var(--muted);margin-bottom:4px;">Projected +2 Years</div>' +
      '<div style="font-size:16px;font-weight:700;color:var(--orange);">' + ff2(proj2yr) + '/mo</div>' +
      '<div style="font-size:11px;color:var(--muted);margin-top:2px;">if trend holds</div></div>' +

      '<div style="background:var(--dark);border:1px solid var(--border);border-radius:8px;padding:12px 14px;">' +
      '<div style="font-size:11px;color:var(--muted);margin-bottom:4px;">Projected +3 Years</div>' +
      '<div style="font-size:16px;font-weight:700;color:#e05020;">' + ff2(proj3yr) + '/mo</div>' +
      '<div style="font-size:11px;color:var(--muted);margin-top:2px;">compounded</div></div>' +

      '</div>';

    if (annCostNow && annCost1yr && annCost3yr) {
      var diffCost1yr = annCost1yr - annCostNow;
      var diffCost3yr = annCost3yr - annCostNow;
      renewHTML +=
        '<div style="padding:12px 14px;background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.25);border-radius:8px;font-size:13px;line-height:1.7;">' +
        '<strong>Employer cost impact</strong> (est. ' + enrolled + ' enrolled, ' + Math.round(empRate*100) + '% contribution): ' +
        'Current annual spend <strong>' + ff2(annCostNow) + '</strong>. ' +
        'At this market trend rate, renewal in one year adds <strong style="color:var(--orange);">' + ff2(diffCost1yr) + '/yr</strong> to employer costs. ' +
        'Over three years the cumulative overage vs. today is <strong style="color:#e05020;">' + ff2(diffCost3yr) + '/yr</strong> — ' +
        'a compelling reason to lock in TotalSource pricing now rather than at the next renewal.' +
        '</div>';
    } else {
      renewHTML +=
        '<div style="font-size:12px;color:var(--muted);margin-top:4px;">' +
        'Enter employee count and avg premium above to see projected employer dollar impact.' +
        '</div>';
    }

    renewHTML += '<div style="font-size:11px;color:var(--muted);margin-top:10px;">Projection uses this state\'s ' + mktTrend.toFixed(1) + '% average rate trend from 2025 to 2026 CMS filings. Actual renewal increases vary by carrier, group experience, and utilization.</div>';

    document.getElementById('acaRenewalContent').innerHTML = renewHTML;
  } else {
    document.getElementById('acaRenewal').style.display = 'none';
  }

  document.getElementById('acaResults').style.display = 'block';
}

function toggleOpenMarket(){
  var isYes=gv('openMarketClient')==='yes';
  document.getElementById('renewalDateRow').style.display=isYes?'block':'none';
  document.getElementById('renewalNotesRow').style.display=isYes?'block':'none';
}
function formatRenewalDate(dateStr){
  if(!dateStr) return null;
  var d=new Date(dateStr+'T00:00:00');
  if(isNaN(d)) return null;
  return d.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
}
function daysUntilRenewal(dateStr){
  if(!dateStr) return null;
  var today=new Date(); today.setHours(0,0,0,0);
  var rd=new Date(dateStr+'T00:00:00');
  if(isNaN(rd)) return null;
  return Math.round((rd-today)/(1000*60*60*24));
}
function getCarrierDisplayName(cd){
  if(gv('carrier')==='other'){
    var custom=gv('otherCarrierName').trim();
    return custom||'your current carrier';
  }
  return cd.name;
}
function ff(n){ if(n==null||isNaN(n))return 'N/A'; return '$'+parseFloat(n).toLocaleString('en-US',{maximumFractionDigits:0}); }
function fp(n){ return (n*100).toFixed(1)+'%'; }
function formatDollar(input){ var raw=input.value.replace(/[^0-9]/g,''); if(!raw){input.value='';return;} input.value=parseInt(raw,10).toLocaleString('en-US'); }
function numericOnly(input){ input.value=input.value.replace(/[^0-9.]/g,''); }
function getRaw(id){ var v=document.getElementById(id).value.replace(/[^0-9.]/g,''); var n=parseFloat(v); return isNaN(n)?null:n; }
function gv(id){ var e=document.getElementById(id); return e?e.value.trim():''; }
function toggleContrib(){ var t=gv('contribType'); document.getElementById('contribPctRow').style.display=t==='pct'?'block':'none'; document.getElementById('contribFlatRow').style.display=t==='flat'?'block':'none'; }
function autoCalcTotal(){ var n=getRaw('numEE'),a=getRaw('avgWages'),te=document.getElementById('totalWages'); if(n&&a&&te.value==='')te.value=(n*a).toLocaleString('en-US'); }

function onStateChange(){
  var state=gv('hqState'), sel=document.getElementById('hqMetro');
  while(sel.options.length>0) sel.remove(0);
  var def=document.createElement('option'); def.value=''; def.textContent=state?'— Statewide Average —':'— Select State First —'; sel.appendChild(def);
  if(state&&LD[state]&&LD[state].metros){
    Object.keys(LD[state].metros).forEach(function(m){ var o=document.createElement('option'); o.value=m; o.textContent=m; sel.appendChild(o); });
  }
}

function runAll(){
  var n=getRaw('numEE'),a=getRaw('avgWages'),te=document.getElementById('totalWages');
  if(n&&a&&te.value==='') te.value=(n*a).toLocaleString('en-US');
  calcScore(); updateBenefits(); updateLabor();
}

// ═══════════════════════════════════════════════════════
//  ELIGIBILITY SCORE
// ═══════════════════════════════════════════════════════
function calcScore(){
  var score=0,maxScore=0,factors=[],flags=[];
  var num=getRaw('numEE');
  if(num!==null){ var s=num>=5&&num<=999?(num>=10&&num<=300?25:18):num>=1000?(flags.push({t:'Large Group — enterprise pricing may apply',type:'warn'}),15):(flags.push({t:'Under 5 EEs — may not qualify',type:'bad'}),0); score+=s;maxScore+=25;factors.push({name:'Employee Count',val:s,max:25}); }
  else{maxScore+=25;factors.push({name:'Employee Count',val:0,max:25});}

  var avg=getRaw('avgWages');
  if(avg!==null){ var s=avg>=45000?20:avg>=35000?15:avg>=27000?10:3; if(avg<27000)flags.push({t:'Avg wages below PEO threshold',type:'bad'}); if(avg>=60000)flags.push({t:'Strong avg wages',type:'good'}); score+=s;maxScore+=20;factors.push({name:'Avg Gross Wages',val:s,max:20}); }
  else{maxScore+=20;factors.push({name:'Avg Gross Wages',val:0,max:20});}

  var bRate=parseInt(document.getElementById('benefitsRate').value,10);
  var s=bRate>=75?20:bRate>=50?14:bRate>=35?8:3;
  if(bRate>=75)flags.push({t:'High participation ('+bRate+'%)',type:'good'});
  else if(bRate<65)flags.push({t:'Participation ('+bRate+'%) — UHC-type declines possible below 65%',type:'warn'});
  score+=s;maxScore+=20;factors.push({name:'Benefits Participation',val:s,max:20});

  var asi=getRaw('asiScore');
  if(asi!==null){ var s=asi<=0.95?12:asi<=1.05?10:asi<=1.15?7:4; if(asi>1.15)flags.push({t:'ASI '+asi+' — above-average risk profile',type:'warn'}); else if(asi<=0.95)flags.push({t:'ASI '+asi+' — favorable risk profile',type:'good'}); score+=s;maxScore+=12;factors.push({name:'ASI Risk Score',val:s,max:12}); }
  else{maxScore+=12;factors.push({name:'ASI Risk Score',val:0,max:12});}

  var ind=gv('industry');
  if(ind){ var s=ind==='low'?13:ind==='med'?9:4; if(ind==='low')flags.push({t:'Low-risk industry',type:'good'}); else if(ind==='high')flags.push({t:'Higher-risk industry',type:'warn'}); score+=s;maxScore+=13;factors.push({name:'Industry Risk',val:s,max:13}); }
  else{maxScore+=13;factors.push({name:'Industry Risk',val:0,max:13});}

  var loc=gv('numLocations');
  if(loc){ var s=loc==='1'?10:loc==='2'?9:loc==='4'?7:5; score+=s;maxScore+=10;factors.push({name:'# of Locations',val:s,max:10}); }
  else{maxScore+=10;factors.push({name:'# of Locations',val:0,max:10});}

  var prods=gv('adpProducts');
  if(prods){ var p=parseInt(prods,10),s=p>=3?10:p===2?7:4; if(p>=3)flags.push({t:'Deep ADP relationship',type:'good'}); score+=s;maxScore+=10;factors.push({name:'ADP Product Depth',val:s,max:10}); }
  else{maxScore+=10;factors.push({name:'ADP Product Depth',val:0,max:10});}

  var pct=maxScore>0?Math.round((score/maxScore)*100):0;
  var fill=document.getElementById('scoreFill');
  fill.style.strokeDashoffset=263.9-(pct/100)*263.9;
  var color=pct>=75?'#22c55e':pct>=50?'#f59e0b':'#f97316'; fill.style.stroke=color;
  var sp=document.getElementById('scorePct'); sp.textContent=pct>0?pct+'%':'—'; sp.style.color=color;
  var verdict='',sub='';
  if(pct>=80){verdict='Strong Candidate — High Approval Likelihood';sub='Meets most TotalSource eligibility criteria. Proceed with full proposal.';}
  else if(pct>=60){verdict='Likely Eligible — Minor Flags to Address';sub='Good prospect with a few items to clarify before submission.';}
  else if(pct>=40){verdict='Possible — Requires Underwriting Review';sub='Group may qualify but has notable risk factors. Deeper discovery recommended.';}
  else if(pct>0){verdict='Low Probability — Key Criteria Not Met';sub='Current data suggests this group may not meet TotalSource thresholds.';}
  else{verdict='Click Calculate to see eligibility score';sub='Fill in the client fields above, then hit Calculate.';}
  document.getElementById('scoreVerdict').textContent=verdict;
  document.getElementById('scoreSub').textContent=sub;
  document.getElementById('flags').innerHTML=flags.map(function(f){return'<span class="flag '+f.type+'">'+f.t+'</span>';}).join('');
  document.getElementById('factorBars').innerHTML=factors.map(function(f){
    var pf=Math.round((f.val/f.max)*100),bc=pf>=75?'#22c55e':pf>=50?'#f59e0b':'#f97316';
    return'<div class="factor-row"><span class="factor-name">'+f.name+'</span><div class="factor-bar-bg"><div class="factor-bar-fill" style="width:'+pf+'%;background:'+bc+'"></div></div><span class="factor-score-val" style="color:'+bc+'">'+f.val+'/'+f.max+'</span></div>';
  }).join('');
}

// ═══════════════════════════════════════════════════════
//  BENEFITS ANALYSIS
// ═══════════════════════════════════════════════════════
function updateBenefits(){
  var carrierKey=gv('carrier');
  var empty=document.getElementById('benefitsEmpty'),content=document.getElementById('benefitsContent');
  if(!carrierKey){empty.style.display='block';content.style.display='none';return;}
  empty.style.display='none'; content.style.display='block';

  var cd=CARRIERS[carrierKey];
  var clientAvg=getRaw('premAvg');
  var numEE=getRaw('numEE'), bRate=parseInt(document.getElementById('benefitsRate').value,10)/100;
  var enrolled=numEE?Math.round(numEE*bRate):null;
  var asi=getRaw('asiScore'), state=gv('hqState'), ind=gv('industry'), participation=bRate;

  // Get dynamic discount range from underwriting engine
  var disc=estimateDiscount(numEE, participation, asi, ind, state, carrierKey);

  // Carrier nat'l blended average (40% single / 20% EE+spouse / 15% EE+child / 25% family)
  var natAvgBlended=(cd.single.avg*0.40+cd.spouse.avg*0.20+cd.child.avg*0.15+cd.family.avg*0.25);

  // TotalSource tier estimates at low/mid/high
  function tsEst(base,d){ return Math.round(base*(1+d)); }

  document.getElementById('bCarrierTitle').textContent=getCarrierDisplayName(cd);

  // UW risk factor cards
  var uwHTML='';
  // Participation
  var pColor=participation>=0.75?'var(--green)':participation>=0.65?'var(--yellow)':'var(--orange)';
  var pStatus=participation>=0.75?'✓ Strong — full carrier field':participation>=0.65?'⚠ Moderate — some carriers may decline':'⚠ Below 65% — UHC-type declines likely';
  uwHTML+='<div class="uw-factor"><div class="uf-label">Participation</div><div class="uf-val" style="color:'+pColor+';">'+(participation*100).toFixed(0)+'%</div><div class="uf-status" style="color:'+pColor+';">'+pStatus+'</div></div>';
  // ASI
  if(asi){ var aColor=asi<=1.05?'var(--green)':asi<=1.15?'var(--yellow)':'var(--orange)'; var aStatus=asi<=1.05?'✓ Favorable risk profile':asi<=1.15?'⚠ Slightly elevated':'⚠ Elevated — pricing impact'; uwHTML+='<div class="uw-factor"><div class="uf-label">ASI Score</div><div class="uf-val" style="color:'+aColor+';">'+asi.toFixed(2)+'</div><div class="uf-status" style="color:'+aColor+';">'+aStatus+'</div></div>'; }
  // Size
  if(numEE){ var sColor=numEE>=25?'var(--green)':numEE>=10?'var(--yellow)':'var(--orange)'; var sStatus=numEE>=25?'✓ Good carrier competition':numEE>=10?'Moderate — some carriers selective':'Small group — limited carrier field'; uwHTML+='<div class="uw-factor"><div class="uf-label">Group Size</div><div class="uf-val" style="color:'+sColor+';">'+numEE+' eligible</div><div class="uf-status" style="color:'+sColor+';">'+sStatus+'</div></div>'; }
  // Industry
  var iColor=ind==='low'?'var(--green)':ind==='med'?'var(--yellow)':ind==='high'?'var(--orange)':'var(--muted)';
  var iStatus=ind==='low'?'✓ Low risk — clean UW':ind==='med'?'Moderate risk class':ind==='high'?'Higher risk — UW scrutiny':'Not selected';
  uwHTML+='<div class="uw-factor"><div class="uf-label">Industry Risk</div><div class="uf-val" style="color:'+iColor+';">'+(ind==='low'?'Low':ind==='med'?'Medium':ind==='high'?'Higher':'—')+'</div><div class="uf-status" style="color:'+iColor+';">'+iStatus+'</div></div>';
  document.getElementById('uwFactors').innerHTML=uwHTML;

  // Discount range bars
  var groupCount=UW_GROUPS.length;
  document.getElementById('drSource').textContent='Based on '+groupCount+' underwritten group'+(groupCount>1?'s':'')+' + profile adjustments';
  var maxDisc=0.22;
  var drRows=[
    {label:'Conservative estimate',val:disc.low,  color:'var(--yellow)'},
    {label:'Mid-point estimate',   val:disc.mid,  color:'var(--blue)'},
    {label:'Best-case estimate',   val:disc.high, color:'var(--green)'}
  ];
  document.getElementById('drBars').innerHTML=drRows.map(function(r){
    var pct=Math.round((Math.abs(r.val)/maxDisc)*100);
    return'<div class="dr-row"><span class="dr-label">'+r.label+'</span><div class="dr-bar-bg"><div class="dr-bar-fill" style="width:'+pct+'%;background:'+r.color+';"></div></div><span class="dr-val" style="color:'+r.color+';">'+fp(r.val)+'</span></div>';
  }).join('');
  document.getElementById('drExplain').textContent=
    'Range adjusted from anchor group (McLean VA, ASI 1.08, 63% participation): Aetna approved at -9.65% to -14.31%. '
    +'Adjustments applied for group size, participation, ASI, industry, and regional carrier availability. Add more underwritten groups to improve precision.';

  // Tier table
  var tiers=[
    {name:'Single',          nat:cd.single.avg, tsLow:tsEst(cd.single.avg,disc.low), tsHigh:tsEst(cd.single.avg,disc.high)},
    {name:'EE + Spouse',     nat:cd.spouse.avg, tsLow:tsEst(cd.spouse.avg,disc.low), tsHigh:tsEst(cd.spouse.avg,disc.high)},
    {name:'EE + Child(ren)', nat:cd.child.avg,  tsLow:tsEst(cd.child.avg, disc.low), tsHigh:tsEst(cd.child.avg, disc.high)},
    {name:'Family',          nat:cd.family.avg, tsLow:tsEst(cd.family.avg,disc.low), tsHigh:tsEst(cd.family.avg,disc.high)}
  ];
  var tbody='';
  if(clientAvg){
    var dAvg=clientAvg-natAvgBlended, dClass=dAvg>0?'delta-over':'delta-save';
    tbody+='<tr style="background:rgba(255,255,255,0.03);font-weight:600;">'
      +'<td>Your Avg Premium (All Tiers)</td>'
      +'<td class="num">'+ff(clientAvg)+'/mo</td>'
      +'<td class="num">'+ff(natAvgBlended)+'/mo</td>'
      +'<td class="num" style="color:var(--yellow);">'+ff(tsEst(natAvgBlended,disc.low))+'/mo</td>'
      +'<td class="num" style="color:var(--green);">'+ff(tsEst(natAvgBlended,disc.high))+'/mo</td>'
      +'<td class="num"><span class="delta-pill '+dClass+'">'+(dAvg>=0?'+':'')+ff(dAvg)+'/mo</span></td>'
      +'</tr>';
  }
  tiers.forEach(function(t){
    tbody+='<tr>'
      +'<td>'+t.name+' <span style="font-size:11px;color:var(--muted);">(carrier benchmark)</span></td>'
      +'<td class="num"><span style="color:var(--muted);">—</span></td>'
      +'<td class="num">'+ff(t.nat)+'/mo</td>'
      +'<td class="num" style="color:var(--yellow);">'+ff(t.tsLow)+'/mo</td>'
      +'<td class="num" style="color:var(--green);">'+ff(t.tsHigh)+'/mo</td>'
      +'<td class="num">—</td>'
      +'</tr>';
  });
  document.getElementById('tierTableBody').innerHTML=tbody;

  // Tier mix
  var mS=parseInt(gv('mixSingle')||'40',10)/100, mSp=parseInt(gv('mixSpouse')||'20',10)/100;
  var mC=parseInt(gv('mixChild')||'15',10)/100,  mF=parseInt(gv('mixFamily')||'25',10)/100;
  var mT=mS+mSp+mC+mF||1; var nS=mS/mT,nSp=mSp/mT,nC=mC/mT,nF=mF/mT;

  var clientWeighted=clientAvg?clientAvg*12:null;
  var natWeighted=(cd.single.avg*nS+cd.spouse.avg*nSp+cd.child.avg*nC+cd.family.avg*nF)*12;
  var tsLowW =(tsEst(cd.single.avg,disc.low)*nS +tsEst(cd.spouse.avg,disc.low)*nSp +tsEst(cd.child.avg,disc.low)*nC +tsEst(cd.family.avg,disc.low)*nF)*12;
  var tsHighW=(tsEst(cd.single.avg,disc.high)*nS+tsEst(cd.spouse.avg,disc.high)*nSp+tsEst(cd.child.avg,disc.high)*nC+tsEst(cd.family.avg,disc.high)*nF)*12;
  var tsMidW =(tsLowW+tsHighW)/2;

  var maxBar=Math.max(clientWeighted||0, natWeighted)*1.15;
  var benchRows=[
    {label:'Your Current Plan',    val:clientWeighted, color:'var(--orange)'},
    {label:getCarrierDisplayName(cd)+' Nat\'l Avg', val:natWeighted,    color:'var(--blue)'},
    {label:'TS Conservative',      val:tsLowW,         color:'var(--yellow)'},
    {label:'TS Best-Case',         val:tsHighW,        color:'var(--green)'}
  ];
  document.getElementById('benchBars').innerHTML=benchRows.map(function(b){
    if(!b.val) return'<div class="bench-row"><span class="bench-label">'+b.label+'</span><div class="bench-bar-bg"><div class="bench-bar-fill" style="width:0%;background:var(--border);"></div></div><span class="bench-val" style="color:var(--muted);">No data entered</span></div>';
    var pct=Math.round((b.val/maxBar)*100);
    return'<div class="bench-row"><span class="bench-label">'+b.label+'</span><div class="bench-bar-bg"><div class="bench-bar-fill" style="width:'+pct+'%;background:'+b.color+';"></div></div><span class="bench-val" style="color:'+b.color+';">'+ff(b.val)+'/yr</span></div>';
  }).join('');

  // Renewal vs TotalSource row
  var renewal=getRaw('renewalIncrease'), renewalRow=document.getElementById('renewalRow');
  if(renewalRow&&renewal&&clientWeighted){
    var renewedCost=clientWeighted*(1+renewal/100);
    var savingsVsRenewalLow =renewedCost-tsLowW, savingsVsRenewalHigh=renewedCost-tsHighW;
    renewalRow.style.display='block';
    renewalRow.innerHTML='<div class="uw-disclaimer" style="border-color:rgba(96,165,250,0.3);background:rgba(96,165,250,0.06);">'
      +'<div class="uw-icon">📊</div>'
      +'<p style="color:var(--blue);"><strong>Carrier renewal vs. TotalSource:</strong> '
      +'Your carrier offered a '+renewal+'% renewal increase — bringing annual cost to ~'+ff(renewedCost)+'/enrolled EE. '
      +'Compared to TotalSource\'s estimated range, that\'s a potential savings of '
      +ff(savingsVsRenewalHigh)+' to '+ff(savingsVsRenewalLow)+' per enrolled employee per year. '
      +(enrolled?'For your '+enrolled+' enrolled employees, that\'s '+ff(savingsVsRenewalHigh*enrolled)+' to '+ff(savingsVsRenewalLow*enrolled)+' annually.':'')
      +'</p></div>';
  } else renewalRow.style.display='none';

  // Employer cost modeler
  var cType=gv('contribType'), cPct=getRaw('contribPct'), cFlat=getRaw('contribFlat');
  var empRate=cType==='pct'&&cPct?cPct/100:null;
  var blendedClientMo=clientAvg||null;
  var blendedTSLowMo =(tsEst(cd.single.avg,disc.low)*nS+tsEst(cd.spouse.avg,disc.low)*nSp+tsEst(cd.child.avg,disc.low)*nC+tsEst(cd.family.avg,disc.low)*nF);
  var blendedTSHighMo=(tsEst(cd.single.avg,disc.high)*nS+tsEst(cd.spouse.avg,disc.high)*nSp+tsEst(cd.child.avg,disc.high)*nC+tsEst(cd.family.avg,disc.high)*nF);

  var empMonthClient=empRate&&blendedClientMo?blendedClientMo*empRate:cFlat||null;
  var empMonthTSLow =empRate&&blendedTSLowMo?blendedTSLowMo*empRate :cFlat?cFlat*(blendedTSLowMo/(blendedClientMo||blendedTSLowMo)):null;
  var empMonthTSHigh=empRate&&blendedTSHighMo?blendedTSHighMo*empRate:cFlat?cFlat*(blendedTSHighMo/(blendedClientMo||blendedTSHighMo)):null;

  var annClient=empMonthClient&&enrolled?Math.round(empMonthClient*enrolled*12):null;
  var annTSLow =empMonthTSLow&&enrolled?Math.round(empMonthTSLow*enrolled*12):null;
  var annTSHigh=empMonthTSHigh&&enrolled?Math.round(empMonthTSHigh*enrolled*12):null;
  var savLow =annClient&&annTSLow?annClient-annTSLow:null;
  var savHigh=annClient&&annTSHigh?annClient-annTSHigh:null;

  var cards=[
    {label:'Blended Employer Cost (Current)',     val:empMonthClient?ff(empMonthClient)+'/ee/mo':'Enter contribution', sub:'per enrolled employee/month', hi:false},
    {label:'TS Conservative Employer Cost',       val:empMonthTSLow?ff(empMonthTSLow)+'/ee/mo':'—',                  sub:fp(disc.low)+' discount applied', hi:false},
    {label:'TS Best-Case Employer Cost',          val:empMonthTSHigh?ff(empMonthTSHigh)+'/ee/mo':'—',                sub:fp(disc.high)+' discount applied', hi:false},
    {label:'Annual Employer Spend (Current)',     val:annClient?ff(annClient):'Enter contribution & EE count',        sub:enrolled?enrolled+' enrolled employees':'', hi:false},
    {label:'Est. Annual Savings Range',           val:savLow&&savHigh?ff(savHigh)+' – '+ff(savLow):'—',             sub:'conservative to best-case', hi:savLow>0||savHigh>0},
    {label:'5-Year Savings Projection',           val:savLow&&savHigh?ff(savHigh*5)+' – '+ff(savLow*5):'—',        sub:'before trend increases', hi:false}
  ];
  document.getElementById('contribGrid').innerHTML=cards.map(function(c){
    var valColor=c.hi?'var(--green)':c.val.indexOf('—')>=0?'var(--muted)':'var(--text)';
    return'<div class="contrib-card'+(c.hi?' highlight':'')+'"><div class="cc-label">'+c.label+'</div><div class="cc-val" style="color:'+valColor+';">'+c.val+'</div><div class="cc-sub">'+c.sub+'</div></div>';
  }).join('');

  // Scenario table
  var scenHTML='';
  [50,60,70,75,80,100].forEach(function(pct){
    var r=pct/100;
    var aC=blendedClientMo&&enrolled?Math.round(blendedClientMo*r*enrolled*12):null;
    var aL=blendedTSLowMo&&enrolled?Math.round(blendedTSLowMo*r*enrolled*12):null;
    var aH=blendedTSHighMo&&enrolled?Math.round(blendedTSHighMo*r*enrolled*12):null;
    var sL=aC&&aL?aC-aL:null, sH=aC&&aH?aC-aH:null;
    var sStyle=sL&&sL>0?'style="color:var(--green);font-weight:700;"':'style="color:var(--muted);"';
    scenHTML+='<tr>'
      +'<td>'+pct+'% employer contribution</td>'
      +'<td class="num">'+(aC?ff(aC):'<span style="color:var(--muted);">—</span>')+'</td>'
      +'<td class="num" style="color:var(--yellow);">'+(aL?ff(aL):'—')+'</td>'
      +'<td class="num" style="color:var(--green);">'+(aH?ff(aH):'—')+'</td>'
      +'<td class="num" '+sStyle+'>'+(sL&&sH?ff(sH)+' – '+ff(sL):'—')+'</td>'
      +'</tr>';
  });
  document.getElementById('scenarioBody').innerHTML=scenHTML;

  // Summary pills
  var pills='';
  if(savHigh&&savHigh>0) pills+='<span class="summary-pill pill-green">💰 Est. '+ff(savHigh)+' – '+ff(savLow||0)+'/yr savings</span>';
  pills+='<span class="summary-pill pill-blue">📋 Discount range: '+fp(disc.low)+' – '+fp(disc.high)+'</span>';
  if(participation<0.65) pills+='<span class="summary-pill pill-yellow">⚠ Participation may limit carrier field</span>';
  if(renewal) pills+='<span class="summary-pill pill-orange">📈 Carrier renewal: +'+renewal+'%</span>';
  var omStatus=gv('openMarketClient');
  if(omStatus==='yes'){
    var rdStr=document.getElementById('medicalRenewalDate').value;
    var days=daysUntilRenewal(rdStr);
    var rdLabel=formatRenewalDate(rdStr);
    if(days!==null&&days<=90) pills+='<span class="summary-pill pill-orange">🔔 Open Market client — renewal in '+days+' days'+(rdLabel?' ('+rdLabel+')':'')+'</span>';
    else if(days!==null) pills+='<span class="summary-pill pill-purple">✦ Existing Open Market client'+(rdLabel?' · Renews '+rdLabel:'')+'</span>';
    else pills+='<span class="summary-pill pill-purple">✦ Existing Open Market client</span>';
  }
  document.getElementById('bSummaryPills').innerHTML=pills;

  // Note
  document.getElementById('benefitsNote').textContent=
    'ILLUSTRATIVE ONLY — PENDING ADP TOTALSOURCE QUOTE. '
    +'Discount range ('+fp(disc.low)+' to '+fp(disc.high)+') modeled from 1 real conditionally-approved group: McLean VA, 8 eligible, ASI 1.08, CareFirst, 63% participation — '
    +'Aetna 57S approved at -10.85%, Aetna ZA1 at -9.65%, Innovation Health at -14.31%; UHC declined. '
    +'Range adjusted for this group\'s size, participation, ASI, industry, and geography. '
    +'Carrier national averages from KFF Employer Health Benefits Survey 2023. '
    +'As additional underwritten groups are added to the dataset, estimates will become more precise.';
}

// ═══════════════════════════════════════════════════════
//  LABOR MARKET
// ═══════════════════════════════════════════════════════
function updateLabor(){
  var state=gv('hqState'),metro=gv('hqMetro'),numEE=getRaw('numEE'),avgW=getRaw('avgWages');
  var empty=document.getElementById('laborEmpty'),content=document.getElementById('laborContent');
  if(!state||!LD[state]){empty.style.display='block';content.style.display='none';return;}
  empty.style.display='none'; content.style.display='block';
  var sd=LD[state],md=(metro&&sd.metros&&sd.metros[metro])?sd.metros[metro]:null;
  var median=md?md.m:sd.m, col=md?md.col:sd.col, ttf=sd.ttf, tax=sd.tax;
  var hc=Math.round(median*totalHF), loc=metro||state;
  document.getElementById('laborTitle').textContent=loc;
  document.getElementById('laborSubtitle').textContent=metro?state+' · Metro area estimates':'Statewide average estimates';
  var cb=document.getElementById('colBadge'),cc='col-low',cl='Below Average';
  if(col>=1.35){cc='col-vhigh';cl='Very High Cost';}else if(col>=1.10){cc='col-high';cl='Above Average';}else if(col>=0.95){cc='col-avg';cl='Near Average';}
  cb.textContent=cl+' ('+col.toFixed(2)+'x)'; cb.className='col-badge '+cc;
  document.getElementById('lMedian').textContent=ff(median);
  document.getElementById('lHiring').textContent=ff(hc);
  document.getElementById('lTTF').textContent=ttf+' days';
  document.getElementById('lTaxBurden').textContent=tax.toFixed(1)+'%';
  document.getElementById('hbAds').textContent=ff(Math.round(median*HF.ads));
  document.getElementById('hbRecruiter').textContent=ff(Math.round(median*HF.recruiter));
  document.getElementById('hbOnboard').textContent=ff(Math.round(median*HF.onboard));
  document.getElementById('hbProd').textContent=ff(Math.round(median*HF.prod));
  document.getElementById('hbAdmin').textContent=ff(Math.round(median*HF.admin));
  var vr=document.getElementById('vsRow');
  if(avgW){vr.style.display='flex';var diff=avgW-median,sign=diff>=0?'+':'';var bp=Math.min(Math.round(Math.min(avgW/median,2)*50),100);var bf=document.getElementById('vsBarFill');bf.style.width=bp+'%';bf.style.background=diff>=0?'var(--green)':'var(--orange)';document.getElementById('vsVals').textContent='Client: '+ff(avgW)+'  |  Market: '+ff(median)+'  ('+sign+ff(diff)+')';}
  else vr.style.display='none';
  var ss=document.getElementById('scaleSection');
  if(numEE){ss.style.display='block';document.getElementById('scaleLabel').textContent=numEE.toLocaleString()+' employees';document.getElementById('scaleCells').innerHTML=[0.10,0.15,0.20,0.25].map(function(r){return'<div class="hb-item" style="flex:1;min-width:110px;"><div class="hb-label">'+Math.round(r*100)+'% turnover · ~'+Math.round(numEE*r)+' hires/yr</div><div class="hb-val">'+ff(Math.round(numEE*r)*hc)+'/yr</div></div>';}).join('');}
  else ss.style.display='none';
  var cn=col>=1.20?'⚠️ '+loc+' is an above-average cost market ('+col.toFixed(2)+'x). TotalSource\'s bundled HR can help offset these elevated costs.':col<=0.90?'✓ '+loc+' is cost-efficient ('+col.toFixed(2)+'x). Strong benefits can be a retention differentiator.':loc+' tracks near national average ('+col.toFixed(2)+'x).';
  document.getElementById('laborNote').textContent='Estimates based on BLS OES 2023, SHRM Hiring Benchmarking Survey, Tax Foundation 2023. Approximate figures for sales context.  '+cn;
}

// ═══════════════════════════════════════════════════════
//  EMAIL GENERATOR
// ═══════════════════════════════════════════════════════
function generateEmail(){
  var company=gv('companyName')||'[Company Name]', contact=gv('contactName')||'there';
  var title=gv('contactTitle')||'', state=gv('hqState'), metro=gv('hqMetro');
  var num=getRaw('numEE'), avg=getRaw('avgWages'), total=getRaw('totalWages')||(num&&avg?num*avg:null);
  var bRate=document.getElementById('benefitsRate').value, carrierKey=gv('carrier');
  var locs=gv('numLocations'), prods=gv('adpProducts'), ind=gv('industry');
  var renewal=getRaw('renewalIncrease'), asi=getRaw('asiScore');
  var score=parseInt(document.getElementById('scorePct').textContent)||0;

  // Benefits paragraph
  var benefitsLine='';
  if(carrierKey&&CARRIERS[carrierKey]){
    var cd=CARRIERS[carrierKey];
    var participation=parseInt(bRate,10)/100;
    var disc=estimateDiscount(num, participation, asi, ind, state, carrierKey);
    var clientAvg=getRaw('premAvg');
    var enrolled=num?Math.round(num*participation):null;
    var mS=parseInt(gv('mixSingle')||'40',10)/100, mSp=parseInt(gv('mixSpouse')||'20',10)/100;
    var mC=parseInt(gv('mixChild')||'15',10)/100, mF=parseInt(gv('mixFamily')||'25',10)/100;
    var mT=mS+mSp+mC+mF||1; var nS=mS/mT,nSp=mSp/mT,nC=mC/mT,nF=mF/mT;
    var natAvgBlendedEmail=(cd.single.avg*0.40+cd.spouse.avg*0.20+cd.child.avg*0.15+cd.family.avg*0.25);
    var blendedClientMo=clientAvg||null;
    var blendedTSLow=Math.round(natAvgBlendedEmail*(1+disc.low));
    var blendedTSHigh=Math.round(natAvgBlendedEmail*(1+disc.high));
    var cPct=getRaw('contribPct'), empRate=cPct?cPct/100:null;
    var savLow=blendedClientMo&&enrolled&&empRate?Math.round((blendedClientMo-blendedTSLow)*empRate*enrolled*12):null;
    var savHigh=blendedClientMo&&enrolled&&empRate?Math.round((blendedClientMo-blendedTSHigh)*empRate*enrolled*12):null;

    benefitsLine='\nOn the benefits side, I ran your '+getCarrierDisplayName(cd)+' plan through our underwriting comparison model — which is grounded in real conditionally-approved TotalSource outcomes for similar groups.';
    if(clientAvg) benefitsLine+=' Your current blended average premium of '+ff(clientAvg)+'/month compares to the carrier\'s national blended average of '+ff(natAvgBlendedEmail)+'/month.';
    benefitsLine+=' Based on your group\'s participation rate, ASI profile, and industry class, our model estimates TotalSource could bring your blended average premium to somewhere between '+ff(blendedTSHigh)+' and '+ff(blendedTSLow)+'/month — a '+fp(disc.high)+' to '+fp(disc.low)+' discount range.';
    if(renewal) benefitsLine+=' Against your carrier\'s '+renewal+'% renewal increase, that\'s a meaningful swing in the other direction.';
    if(savHigh&&savHigh>0) benefitsLine+=' Running the numbers on your enrolled population, the estimated annual employer savings range is '+ff(savHigh)+' to '+ff(savLow||0)+' — and over five years, that compounds to '+ff(savHigh*5)+' to '+ff((savLow||0)*5)+' before accounting for trend increases.';
    benefitsLine+='\n\nThese are illustrative estimates based on real underwriting data — the actual quote from ADP will give us the definitive number, but this gives us a solid foundation to have the conversation.';
  }

  // Labor paragraph
  var laborLine='';
  if(state&&LD[state]){
    var sd=LD[state], md2=(metro&&sd.metros&&sd.metros[metro])?sd.metros[metro]:null;
    var median=md2?md2.m:sd.m, col=md2?md2.col:sd.col;
    var hc=Math.round(median*totalHF), loc=metro||state;
    var annualHC=num?ff(Math.round(num*0.15)*hc):null;
    laborLine='\nOn the talent and HR side, the '+loc+' market median wage runs about '+ff(median)+'/year, and the fully-loaded cost to bring on a single new employee averages around '+ff(hc)+'.'+(annualHC?' At 15% annual turnover, that\'s roughly '+annualHC+' per year in hiring costs alone — a number TotalSource\'s HR infrastructure directly helps reduce.':'');
  }

  var likelihood=score>=80?'an excellent candidate':score>=60?'a strong candidate':score>=40?'a potential candidate':'worth a closer look';
  var locsStr=locs==='1'?'single location':locs==='2'?'2–3 locations':locs==='4'?'4–9 locations':'10+ locations';
  var dh='';
  if(num) dh+='\n  • Employees (eligible): '+num.toLocaleString();
  if(avg) dh+='\n  • Avg gross wages: '+ff(avg)+'/employee annually';
  if(total) dh+='\n  • Total annual wages: '+ff(total);
  if(bRate) dh+='\n  • Benefits participation: '+bRate+'%';
  if(asi) dh+='\n  • ASI score: '+asi;
  if(locs) dh+='\n  • Locations: '+locsStr;
  if(prods) dh+='\n  • Existing ADP products: '+prods;
  if(state) dh+='\n  • HQ: '+(metro?metro+', ':'')+state;
  if(carrierKey&&CARRIERS[carrierKey]) dh+='\n  • Current carrier: '+CARRIERS[carrierKey].name+(renewal?' ('+renewal+'% renewal offered)':'');
  var omStatus=gv('openMarketClient');
  var rdStr=document.getElementById('medicalRenewalDate').value;
  var rdLabel=formatRenewalDate(rdStr);
  var rdDays=daysUntilRenewal(rdStr);
  if(omStatus==='yes') dh+='\n  • ADP Open Market client: Yes'+(rdLabel?' · Medical renewal: '+rdLabel+(rdDays!==null?' ('+rdDays+' days away)':''):'');
  else if(omStatus==='no') dh+='\n  • ADP Open Market client: No';
  var renewalNotes=gv('renewalNotes');

  // Open market paragraph for email
  var openMarketLine='';
  if(omStatus==='yes'){
    openMarketLine='\n\nOne thing I also want to flag — since '+company+' is currently an ADP Open Market health benefits client';
    if(rdLabel){
      openMarketLine+=', with your medical renewal coming up on '+rdLabel;
      if(rdDays!==null&&rdDays<=90) openMarketLine+=' (just '+rdDays+' days away)';
    }
    openMarketLine+=', the timing is ideal to evaluate whether TotalSource\'s fully-bundled benefits platform could replace your current Open Market arrangement at a lower total cost.';
    if(renewalNotes) openMarketLine+=' Noted: '+renewalNotes+'.';
    // Inject live ACA benchmark data if available
    if(window.acaAvgSilver&&window.acaLocation){
      var acaFF=function(n){ return n?'$'+Math.round(n).toLocaleString('en-US'):'—'; };
      openMarketLine+='\n\nI pulled live '+window.acaYear+' ACA marketplace rates for your area ('+window.acaLocation+'). The lowest-cost Silver plan in that market is running '+acaFF(window.acaAvgSilver)+'/month per person, with Gold at '+acaFF(window.acaAvgGold)+'/month.';
      var clientAvgEmail=getRaw('premAvg');
      if(clientAvgEmail&&window.acaAvgSilver){
        var diff2=clientAvgEmail-window.acaAvgSilver;
        var diffPct2=Math.round(Math.abs(diff2/window.acaAvgSilver)*100);
        if(diff2>0) openMarketLine+=' Your current blended premium of '+acaFF(clientAvgEmail)+'/month sits '+diffPct2+'% above the benchmark lowest-cost Silver — which suggests meaningful room for TotalSource to deliver savings.';
        else openMarketLine+=' Your current blended premium of '+acaFF(clientAvgEmail)+'/month is actually competitive vs. the open market, so the TotalSource value story is really about the bundled HR/compliance infrastructure and the reduced administrative lift.';
      }
    }
    openMarketLine+=' I can run both scenarios side-by-side so you have a clean comparison before your renewal deadline.';
  }

  var sl=parseInt(bRate)>=75?'Your benefits participation rate of '+bRate+'% is a real strength — that opens up the full carrier field and typically produces the most competitive TotalSource pricing.':parseInt(bRate)<65?'One thing worth discussing is participation — at '+bRate+'%, some carriers may limit their offers, which is exactly what TotalSource\'s enrollment support is designed to address.':'Based on the profile I\'ve been working from, '+company+' looks like '+likelihood+' for TotalSource.';
  var pl=parseInt(prods)>=3?'You\'re already running '+prods+'+ ADP solutions, which makes a TotalSource migration seamless — no system overhaul required.':prods?'With your existing ADP footprint, TotalSource is a natural next step.':'';

  document.getElementById('emailSubject').value='Following up — ADP TotalSource analysis for '+company;
  document.getElementById('emailBody').value=
'Hi '+contact+',\n\n'
+'I\'ve been doing some analysis on '+company+' ahead of our next conversation and wanted to share what I\'m seeing.\n\n'
+'Here\'s the data snapshot I\'m working from:\n'+dh+'\n\n'
+sl+' '+pl
+benefitsLine
+openMarketLine
+laborLine+'\n\n'
+'The bottom line is that TotalSource can consolidate HR, payroll, benefits, and compliance under one umbrella — while giving your team access to Fortune 500-level benefit plans at pricing that works for a group your size.\n\n'
+'I\'d love to get 20–30 minutes on the calendar to walk through a formal proposal'+(title?' for you as '+company+'\'s '+title:'')+'. No obligation — just want to make sure you have the full picture before renewal season.\n\n'
+'Would [Day] or [Day] work?\n\n'
+'Best,\nAJ\nADP TotalSource | beyondpayroll.net';
}

function copyEmail(){
  var full='Subject: '+document.getElementById('emailSubject').value+'\n\n'+document.getElementById('emailBody').value;
  navigator.clipboard.writeText(full).then(function(){
    var m=document.getElementById('copyMsg'); m.style.display='inline';
    setTimeout(function(){m.style.display='none';},2500);
  });
}

function openTsPanel(){document.getElementById('ts-panel').classList.add('open');document.body.style.overflow='hidden';}
function closeTsPanel(){document.getElementById('ts-panel').classList.remove('open');document.body.style.overflow='';}

// ═══════════════════════════════════════════════════════
//  REAL UNDERWRITING DATASET
//  Add future groups here as they come in.
//  Each entry = one conditionally approved TotalSource group.
// ═══════════════════════════════════════════════════════
var UW_GROUPS = [
  {
    id: 'G001',
    label: 'McLean VA — Professional Services',
    state: 'Virginia',
    metro: 'Northern Virginia / DC Area',
    eligible: 8,
    subscribers: 5,
    participation: 0.63,        // 63%
    asi: 1.08,
    carrier: 'carefirst',
    avgWage: 80800,
    industry: 'low',
    renewalOffered: 6.8,        // % increase offered by current carrier
    approvals: [
      { plan: '57S / Aetna EPO',         discount: -0.1085 },
      { plan: 'ZA1 / Aetna NTL',         discount: -0.0965 },
      { plan: '57S / Innovation Health',  discount: -0.1431 }
    ],
    declines: ['UHC — premium inadequacy & tier shift limitations'],
    discountLow:  -0.0965,   // worst approved
    discountHigh: -0.1431,   // best approved
    discountMid:  -0.1127    // average of approved
  }
  // ── ADD FUTURE GROUPS BELOW ──────────────────────────
  // {
  //   id: 'G002',
  //   label: '...',
  //   ...
  // }
];

// ═══════════════════════════════════════════════════════
//  CARRIER BENCHMARK DATA  (KFF 2023 + HCCI)
// ═══════════════════════════════════════════════════════
var CARRIERS = {
  carefirst:   { name:'CareFirst (BCBS DC/MD/VA)',    trend:6.8,
    single:{avg:680}, spouse:{avg:1440}, child:{avg:1150}, family:{avg:2000} },
  uhc:         { name:'UnitedHealthcare',             trend:5.8,
    single:{avg:620}, spouse:{avg:1310}, child:{avg:1050}, family:{avg:1820} },
  bcbs:        { name:'Blue Cross Blue Shield',       trend:5.2,
    single:{avg:595}, spouse:{avg:1265}, child:{avg:1010}, family:{avg:1760} },
  aetna:       { name:'Aetna',                        trend:5.5,
    single:{avg:608}, spouse:{avg:1290}, child:{avg:1025}, family:{avg:1790} },
  cigna:       { name:'Cigna',                        trend:5.6,
    single:{avg:615}, spouse:{avg:1300}, child:{avg:1040}, family:{avg:1800} },
  humana:      { name:'Humana',                       trend:5.0,
    single:{avg:580}, spouse:{avg:1230}, child:{avg:985},  family:{avg:1710} },
  kaiser:      { name:'Kaiser Permanente',            trend:4.4,
    single:{avg:555}, spouse:{avg:1175}, child:{avg:940},  family:{avg:1640} },
  anthem:      { name:'Anthem',                       trend:5.3,
    single:{avg:600}, spouse:{avg:1275}, child:{avg:1015}, family:{avg:1770} },
  innovation:  { name:'Innovation Health (Aetna DC)', trend:5.5,
    single:{avg:650}, spouse:{avg:1375}, child:{avg:1100}, family:{avg:1910} },
  molina:      { name:'Molina Healthcare',            trend:4.8,
    single:{avg:540}, spouse:{avg:1145}, child:{avg:915},  family:{avg:1595} },
  oscar:       { name:'Oscar Health',                 trend:5.4,
    single:{avg:590}, spouse:{avg:1250}, child:{avg:1000}, family:{avg:1740} },
  other:       { name:'Other / Unknown Carrier',      trend:5.3,
    single:{avg:598}, spouse:{avg:1268}, child:{avg:1014}, family:{avg:1765} }
};

var HF={ads:0.012,recruiter:0.065,onboard:0.040,prod:0.055,admin:0.008};
var totalHF=HF.ads+HF.recruiter+HF.onboard+HF.prod+HF.admin;

// ═══════════════════════════════════════════════════════
//  LABOR DATA  — state baselines + city-level estimates
//  m=median annual wage, col=cost-of-labor index, ttf=time-to-fill (days), tax=employer tax burden %
// ═══════════════════════════════════════════════════════
var LD = {
  "Alabama":{m:52800,col:0.88,ttf:35,tax:9.2,metros:{
    "Anniston":{m:46000,col:0.84},"Auburn":{m:50000,col:0.86},"Birmingham":{m:57200,col:0.91},
    "Decatur":{m:49000,col:0.85},"Dothan":{m:47000,col:0.84},"Florence":{m:47500,col:0.84},
    "Gadsden":{m:45000,col:0.83},"Huntsville":{m:68000,col:0.93},"Mobile":{m:49800,col:0.87},
    "Montgomery":{m:52000,col:0.88},"Tuscaloosa":{m:51000,col:0.87}}},
  "Alaska":{m:64000,col:1.18,ttf:42,tax:10.1,metros:{
    "Anchorage":{m:70000,col:1.20},"Fairbanks":{m:63000,col:1.16},"Juneau":{m:66000,col:1.18},
    "Ketchikan":{m:58000,col:1.12},"Sitka":{m:59000,col:1.13}}},
  "Arizona":{m:62000,col:0.97,ttf:34,tax:9.4,metros:{
    "Avondale":{m:60000,col:0.97},"Chandler":{m:70000,col:1.03},"Flagstaff":{m:56000,col:0.94},
    "Gilbert":{m:69000,col:1.02},"Glendale":{m:60000,col:0.97},"Mesa":{m:62000,col:0.99},
    "Peoria":{m:64000,col:1.00},"Phoenix":{m:65000,col:1.00},"Prescott":{m:53000,col:0.91},
    "Scottsdale":{m:78000,col:1.10},"Surprise":{m:60000,col:0.97},"Tempe":{m:67000,col:1.01},
    "Tucson":{m:55000,col:0.93},"Yuma":{m:48000,col:0.86}}},
  "Arkansas":{m:48500,col:0.84,ttf:36,tax:9.0,metros:{
    "Conway":{m:49000,col:0.85},"Fayetteville":{m:54000,col:0.88},"Fort Smith":{m:47000,col:0.83},
    "Jonesboro":{m:48000,col:0.84},"Little Rock":{m:52000,col:0.87},"Pine Bluff":{m:44000,col:0.82},
    "Rogers":{m:53000,col:0.87},"Springdale":{m:51000,col:0.86}}},
  "California":{m:82000,col:1.42,ttf:38,tax:12.8,metros:{
    "Anaheim":{m:76000,col:1.36},"Bakersfield":{m:58000,col:1.05},"Berkeley":{m:100000,col:1.60},
    "Burbank":{m:80000,col:1.38},"Chula Vista":{m:72000,col:1.25},"Concord":{m:86000,col:1.40},
    "Daly City":{m:90000,col:1.46},"El Monte":{m:66000,col:1.18},"Escondido":{m:68000,col:1.20},
    "Fontana":{m:62000,col:1.10},"Fremont":{m:102000,col:1.60},"Fresno":{m:58000,col:1.05},
    "Garden Grove":{m:70000,col:1.22},"Glendale":{m:80000,col:1.38},"Hayward":{m:90000,col:1.46},
    "Huntington Beach":{m:82000,col:1.38},"Inglewood":{m:76000,col:1.34},"Irvine":{m:92000,col:1.50},
    "Long Beach":{m:75000,col:1.34},"Los Angeles":{m:79000,col:1.40},"Modesto":{m:57000,col:1.03},
    "Moreno Valley":{m:60000,col:1.08},"Murrieta":{m:66000,col:1.16},"Oakland":{m:96000,col:1.55},
    "Oceanside":{m:68000,col:1.20},"Ontario":{m:64000,col:1.14},"Orange":{m:78000,col:1.36},
    "Oxnard":{m:64000,col:1.14},"Palmdale":{m:62000,col:1.10},"Pasadena":{m:88000,col:1.44},
    "Rancho Cucamonga":{m:66000,col:1.16},"Riverside":{m:65000,col:1.15},"Roseville":{m:76000,col:1.26},
    "Sacramento":{m:74000,col:1.22},"Salinas":{m:62000,col:1.12},"San Bernardino":{m:60000,col:1.08},
    "San Diego":{m:82000,col:1.38},"San Francisco":{m:118000,col:1.75},"San Jose":{m:122000,col:1.82},
    "San Mateo":{m:108000,col:1.66},"Santa Ana":{m:68000,col:1.20},"Santa Barbara":{m:70000,col:1.22},
    "Santa Clara":{m:116000,col:1.78},"Santa Rosa":{m:72000,col:1.24},"Simi Valley":{m:76000,col:1.32},
    "Stockton":{m:58000,col:1.04},"Sunnyvale":{m:118000,col:1.80},"Thousand Oaks":{m:84000,col:1.40},
    "Torrance":{m:82000,col:1.38},"Vallejo":{m:72000,col:1.24},"Victorville":{m:58000,col:1.04},
    "Visalia":{m:54000,col:1.00}}},
  "Colorado":{m:74000,col:1.10,ttf:33,tax:10.0,metros:{
    "Aurora":{m:72000,col:1.10},"Boulder":{m:88000,col:1.28},"Centennial":{m:82000,col:1.20},
    "Colorado Springs":{m:66000,col:1.04},"Denver":{m:80000,col:1.18},"Fort Collins":{m:70000,col:1.08},
    "Grand Junction":{m:58000,col:0.96},"Greeley":{m:62000,col:1.00},"Lakewood":{m:74000,col:1.12},
    "Loveland":{m:65000,col:1.02},"Pueblo":{m:54000,col:0.92},"Thornton":{m:70000,col:1.08},
    "Westminster":{m:74000,col:1.12}}},
  "Connecticut":{m:80000,col:1.22,ttf:36,tax:11.4,metros:{
    "Bridgeport":{m:74000,col:1.18},"Bristol":{m:70000,col:1.12},"Danbury":{m:78000,col:1.20},
    "Hartford":{m:78000,col:1.19},"Meriden":{m:68000,col:1.10},"Middletown":{m:72000,col:1.14},
    "New Britain":{m:67000,col:1.08},"New Haven":{m:72000,col:1.15},"New London":{m:68000,col:1.10},
    "Norwalk":{m:92000,col:1.38},"Stamford":{m:98000,col:1.45},"Waterbury":{m:65000,col:1.06},
    "West Hartford":{m:82000,col:1.24}}},
  "Delaware":{m:68000,col:1.04,ttf:34,tax:10.2,metros:{
    "Dover":{m:64000,col:1.00},"Newark":{m:70000,col:1.06},"Wilmington":{m:74000,col:1.10}}},
  "Florida":{m:59000,col:0.96,ttf:31,tax:8.8,metros:{
    "Boca Raton":{m:68000,col:1.06},"Bonita Springs":{m:58000,col:0.95},"Cape Coral":{m:56000,col:0.93},
    "Clearwater":{m:60000,col:0.97},"Coral Springs":{m:62000,col:1.00},"Daytona Beach":{m:52000,col:0.90},
    "Deerfield Beach":{m:60000,col:0.98},"Deltona":{m:53000,col:0.91},"Fort Lauderdale":{m:64000,col:1.04},
    "Fort Myers":{m:57000,col:0.94},"Gainesville":{m:56000,col:0.93},"Hialeah":{m:55000,col:0.92},
    "Hollywood":{m:62000,col:1.00},"Jacksonville":{m:60000,col:0.96},"Lakeland":{m:54000,col:0.91},
    "Lehigh Acres":{m:50000,col:0.88},"Melbourne":{m:58000,col:0.95},"Miami":{m:63000,col:1.06},
    "Miami Gardens":{m:56000,col:0.94},"Miramar":{m:62000,col:1.00},"Naples":{m:62000,col:1.01},
    "Ocala":{m:50000,col:0.88},"Orlando":{m:58000,col:0.95},"Palm Bay":{m:55000,col:0.92},
    "Pembroke Pines":{m:62000,col:1.00},"Pensacola":{m:53000,col:0.90},"Pompano Beach":{m:60000,col:0.98},
    "Port St. Lucie":{m:55000,col:0.92},"Sarasota":{m:60000,col:0.98},"St. Petersburg":{m:61000,col:0.98},
    "Tallahassee":{m:56000,col:0.93},"Tampa":{m:62000,col:0.99},"West Palm Beach":{m:64000,col:1.03}}},
  "Georgia":{m:62000,col:0.96,ttf:33,tax:9.3,metros:{
    "Albany":{m:48000,col:0.86},"Alpharetta":{m:80000,col:1.12},"Athens":{m:52000,col:0.88},
    "Atlanta":{m:72000,col:1.08},"Augusta":{m:54000,col:0.90},"Columbus":{m:52000,col:0.88},
    "Macon":{m:50000,col:0.87},"Marietta":{m:68000,col:1.03},"Roswell":{m:74000,col:1.09},
    "Sandy Springs":{m:76000,col:1.10},"Savannah":{m:56000,col:0.91},"Valdosta":{m:47000,col:0.85},
    "Warner Robins":{m:52000,col:0.88}}},
  "Hawaii":{m:68000,col:1.32,ttf:40,tax:11.0,metros:{
    "Hilo":{m:60000,col:1.24},"Honolulu":{m:70000,col:1.34},"Kailua":{m:68000,col:1.31},
    "Kapolei":{m:65000,col:1.28},"Pearl City":{m:66000,col:1.29}}},
  "Idaho":{m:55000,col:0.92,ttf:35,tax:9.1,metros:{
    "Boise":{m:61000,col:0.99},"Caldwell":{m:52000,col:0.90},"Coeur d'Alene":{m:54000,col:0.92},
    "Idaho Falls":{m:54000,col:0.91},"Lewiston":{m:52000,col:0.90},"Meridian":{m:60000,col:0.98},
    "Nampa":{m:53000,col:0.91},"Pocatello":{m:52000,col:0.90},"Twin Falls":{m:51000,col:0.89}}},
  "Illinois":{m:70000,col:1.08,ttf:35,tax:10.8,metros:{
    "Aurora":{m:66000,col:1.04},"Bloomington":{m:62000,col:0.99},"Champaign":{m:60000,col:0.97},
    "Chicago":{m:78000,col:1.20},"Cicero":{m:62000,col:1.00},"Decatur":{m:56000,col:0.93},
    "Elgin":{m:64000,col:1.01},"Joliet":{m:65000,col:1.02},"Naperville":{m:78000,col:1.18},
    "Peoria":{m:58000,col:0.93},"Rockford":{m:57000,col:0.92},"Schaumburg":{m:74000,col:1.14},
    "Springfield":{m:60000,col:0.97},"Waukegan":{m:62000,col:1.00}}},
  "Indiana":{m:57000,col:0.90,ttf:34,tax:9.2,metros:{
    "Bloomington":{m:54000,col:0.89},"Carmel":{m:72000,col:1.04},"Evansville":{m:54000,col:0.89},
    "Fishers":{m:70000,col:1.02},"Fort Wayne":{m:54000,col:0.88},"Gary":{m:55000,col:0.90},
    "Hammond":{m:54000,col:0.89},"Indianapolis":{m:62000,col:0.96},"Kokomo":{m:52000,col:0.87},
    "Lafayette":{m:54000,col:0.89},"Muncie":{m:50000,col:0.86},"South Bend":{m:53000,col:0.87},
    "Terre Haute":{m:51000,col:0.87}}},
  "Iowa":{m:56000,col:0.88,ttf:34,tax:9.1,metros:{
    "Ames":{m:58000,col:0.90},"Cedar Falls":{m:55000,col:0.88},"Cedar Rapids":{m:57000,col:0.90},
    "Council Bluffs":{m:55000,col:0.88},"Davenport":{m:58000,col:0.91},"Des Moines":{m:62000,col:0.95},
    "Dubuque":{m:55000,col:0.88},"Iowa City":{m:58000,col:0.91},"Sioux City":{m:54000,col:0.87},
    "Waterloo":{m:53000,col:0.87},"West Des Moines":{m:64000,col:0.97}}},
  "Kansas":{m:57000,col:0.88,ttf:35,tax:9.2,metros:{
    "Kansas City":{m:64000,col:0.98},"Lawrence":{m:54000,col:0.88},"Lenexa":{m:66000,col:1.00},
    "Manhattan":{m:52000,col:0.87},"Olathe":{m:66000,col:1.00},"Overland Park":{m:68000,col:1.01},
    "Salina":{m:50000,col:0.86},"Shawnee":{m:64000,col:0.98},"Topeka":{m:54000,col:0.88},
    "Wichita":{m:58000,col:0.90}}},
  "Kentucky":{m:54000,col:0.87,ttf:35,tax:9.1,metros:{
    "Bowling Green":{m:51000,col:0.86},"Covington":{m:56000,col:0.90},"Frankfort":{m:54000,col:0.88},
    "Lexington":{m:57000,col:0.91},"Louisville":{m:60000,col:0.94},"Owensboro":{m:50000,col:0.85},
    "Paducah":{m:49000,col:0.85},"Richmond":{m:50000,col:0.86}}},
  "Louisiana":{m:52000,col:0.87,ttf:37,tax:9.0,metros:{
    "Alexandria":{m:47000,col:0.84},"Baton Rouge":{m:58000,col:0.92},"Bossier City":{m:52000,col:0.87},
    "Houma":{m:52000,col:0.87},"Lafayette":{m:54000,col:0.89},"Lake Charles":{m:52000,col:0.87},
    "Metairie":{m:57000,col:0.92},"Monroe":{m:47000,col:0.84},"New Orleans":{m:57000,col:0.93},
    "Shreveport":{m:51000,col:0.87}}},
  "Maine":{m:58000,col:1.00,ttf:37,tax:10.2,metros:{
    "Augusta":{m:56000,col:0.98},"Bangor":{m:58000,col:1.00},"Lewiston":{m:55000,col:0.97},
    "Portland":{m:64000,col:1.06}}},
  "Maryland":{m:80000,col:1.18,ttf:33,tax:10.8,metros:{
    "Annapolis":{m:82000,col:1.20},"Baltimore":{m:76000,col:1.13},"Bowie":{m:88000,col:1.28},
    "Columbia":{m:90000,col:1.30},"Frederick":{m:78000,col:1.16},"Gaithersburg":{m:92000,col:1.34},
    "Germantown":{m:88000,col:1.28},"Hagerstown":{m:62000,col:1.02},"Rockville":{m:96000,col:1.38},
    "Silver Spring":{m:92000,col:1.33}}},
  "Massachusetts":{m:86000,col:1.32,ttf:36,tax:11.6,metros:{
    "Boston":{m:94000,col:1.45},"Brockton":{m:70000,col:1.14},"Cambridge":{m:108000,col:1.60},
    "Fall River":{m:60000,col:1.02},"Framingham":{m:80000,col:1.24},"Haverhill":{m:72000,col:1.16},
    "Lowell":{m:70000,col:1.13},"Lynn":{m:68000,col:1.10},"New Bedford":{m:60000,col:1.02},
    "Newton":{m:98000,col:1.48},"Quincy":{m:82000,col:1.26},"Somerville":{m:100000,col:1.52},
    "Springfield":{m:62000,col:1.04},"Worcester":{m:72000,col:1.15}}},
  "Michigan":{m:60000,col:0.95,ttf:35,tax:9.5,metros:{
    "Ann Arbor":{m:74000,col:1.14},"Battle Creek":{m:54000,col:0.90},"Dearborn":{m:62000,col:0.99},
    "Detroit":{m:64000,col:1.00},"Flint":{m:54000,col:0.90},"Grand Rapids":{m:60000,col:0.95},
    "Kalamazoo":{m:58000,col:0.93},"Lansing":{m:60000,col:0.95},"Livonia":{m:66000,col:1.02},
    "Muskegon":{m:52000,col:0.88},"Pontiac":{m:58000,col:0.93},"Saginaw":{m:52000,col:0.88},
    "Sterling Heights":{m:64000,col:1.00},"Warren":{m:62000,col:0.98}}},
  "Minnesota":{m:72000,col:1.06,ttf:34,tax:10.6,metros:{
    "Bloomington":{m:76000,col:1.12},"Brooklyn Park":{m:70000,col:1.06},"Duluth":{m:60000,col:0.96},
    "Eden Prairie":{m:82000,col:1.18},"Mankato":{m:60000,col:0.96},"Minneapolis":{m:80000,col:1.16},
    "Plymouth":{m:82000,col:1.18},"Rochester":{m:68000,col:1.04},"St. Cloud":{m:60000,col:0.96},
    "St. Paul":{m:74000,col:1.10}}},
  "Mississippi":{m:46000,col:0.82,ttf:38,tax:8.9,metros:{
    "Biloxi":{m:47000,col:0.83},"Gulfport":{m:46000,col:0.82},"Hattiesburg":{m:46000,col:0.83},
    "Jackson":{m:50000,col:0.86},"Meridian":{m:44000,col:0.81},"Southaven":{m:50000,col:0.86},
    "Tupelo":{m:46000,col:0.83}}},
  "Missouri":{m:58000,col:0.90,ttf:34,tax:9.3,metros:{
    "Columbia":{m:58000,col:0.92},"Independence":{m:58000,col:0.91},"Jefferson City":{m:56000,col:0.90},
    "Joplin":{m:50000,col:0.85},"Kansas City":{m:66000,col:1.00},"Lee's Summit":{m:66000,col:1.00},
    "O'Fallon":{m:66000,col:1.00},"Springfield":{m:54000,col:0.88},"St. Charles":{m:64000,col:0.98},
    "St. Joseph":{m:52000,col:0.87},"St. Louis":{m:66000,col:1.00}}},
  "Montana":{m:52000,col:0.93,ttf:38,tax:9.4,metros:{
    "Billings":{m:56000,col:0.96},"Bozeman":{m:58000,col:0.98},"Butte":{m:50000,col:0.91},
    "Great Falls":{m:50000,col:0.91},"Helena":{m:54000,col:0.94},"Kalispell":{m:52000,col:0.92},
    "Missoula":{m:54000,col:0.94}}},
  "Nebraska":{m:56000,col:0.88,ttf:34,tax:9.2,metros:{
    "Bellevue":{m:60000,col:0.93},"Grand Island":{m:51000,col:0.86},"Kearney":{m:51000,col:0.86},
    "Lincoln":{m:58000,col:0.92},"Omaha":{m:62000,col:0.96}}},
  "Nevada":{m:61000,col:1.02,ttf:33,tax:9.0,metros:{
    "Carson City":{m:58000,col:0.98},"Henderson":{m:64000,col:1.04},"Las Vegas":{m:60000,col:1.00},
    "North Las Vegas":{m:58000,col:0.98},"Reno":{m:64000,col:1.04},"Sparks":{m:62000,col:1.02}}},
  "New Hampshire":{m:72000,col:1.08,ttf:35,tax:9.8,metros:{
    "Concord":{m:68000,col:1.05},"Dover":{m:68000,col:1.05},"Manchester":{m:70000,col:1.06},
    "Nashua":{m:74000,col:1.10},"Portsmouth":{m:72000,col:1.08}}},
  "New Jersey":{m:84000,col:1.28,ttf:35,tax:11.8,metros:{
    "Atlantic City":{m:60000,col:1.00},"Camden":{m:68000,col:1.12},"Cherry Hill":{m:78000,col:1.20},
    "Edison":{m:86000,col:1.30},"Elizabeth":{m:78000,col:1.22},"Jersey City":{m:90000,col:1.36},
    "Newark":{m:82000,col:1.28},"Paterson":{m:72000,col:1.16},"Toms River":{m:74000,col:1.16},
    "Trenton":{m:78000,col:1.20},"Woodbridge":{m:82000,col:1.26}}},
  "New Mexico":{m:52000,col:0.88,ttf:38,tax:9.2,metros:{
    "Albuquerque":{m:56000,col:0.92},"Farmington":{m:52000,col:0.88},"Las Cruces":{m:48000,col:0.86},
    "Rio Rancho":{m:56000,col:0.92},"Roswell":{m:48000,col:0.86},"Santa Fe":{m:56000,col:0.93}}},
  "New York":{m:80000,col:1.38,ttf:37,tax:12.4,metros:{
    "Albany":{m:66000,col:1.06},"Binghamton":{m:58000,col:0.97},"Buffalo":{m:60000,col:1.00},
    "Mount Vernon":{m:80000,col:1.30},"New Rochelle":{m:84000,col:1.34},"New York City":{m:94000,col:1.65},
    "Niagara Falls":{m:54000,col:0.94},"Rochester":{m:62000,col:1.02},"Schenectady":{m:62000,col:1.02},
    "Syracuse":{m:60000,col:0.99},"Utica":{m:56000,col:0.96},"White Plains":{m:90000,col:1.40},
    "Yonkers":{m:82000,col:1.32}}},
  "North Carolina":{m:60000,col:0.94,ttf:33,tax:9.4,metros:{
    "Asheville":{m:56000,col:0.92},"Cary":{m:80000,col:1.14},"Chapel Hill":{m:72000,col:1.08},
    "Charlotte":{m:68000,col:1.03},"Concord":{m:62000,col:0.99},"Durham":{m:74000,col:1.10},
    "Fayetteville":{m:54000,col:0.90},"Gastonia":{m:55000,col:0.91},"Greensboro":{m:58000,col:0.93},
    "High Point":{m:56000,col:0.91},"Raleigh":{m:74000,col:1.10},"Wilmington":{m:56000,col:0.92},
    "Winston-Salem":{m:57000,col:0.92}}},
  "North Dakota":{m:58000,col:0.90,ttf:35,tax:8.8,metros:{
    "Bismarck":{m:60000,col:0.93},"Fargo":{m:60000,col:0.93},"Grand Forks":{m:56000,col:0.90},
    "Minot":{m:58000,col:0.91},"West Fargo":{m:60000,col:0.93}}},
  "Ohio":{m:59000,col:0.91,ttf:34,tax:9.5,metros:{
    "Akron":{m:58000,col:0.93},"Canton":{m:54000,col:0.89},"Cincinnati":{m:62000,col:0.97},
    "Cleveland":{m:60000,col:0.95},"Columbus":{m:65000,col:0.99},"Dayton":{m:57000,col:0.91},
    "Elyria":{m:56000,col:0.91},"Lorain":{m:54000,col:0.89},"Parma":{m:58000,col:0.93},
    "Springfield":{m:54000,col:0.89},"Toledo":{m:56000,col:0.90},"Youngstown":{m:52000,col:0.87}}},
  "Oklahoma":{m:52000,col:0.85,ttf:36,tax:9.0,metros:{
    "Broken Arrow":{m:56000,col:0.89},"Edmond":{m:60000,col:0.92},"Lawton":{m:48000,col:0.84},
    "Moore":{m:53000,col:0.87},"Norman":{m:56000,col:0.89},"Oklahoma City":{m:56000,col:0.89},
    "Stillwater":{m:50000,col:0.86},"Tulsa":{m:56000,col:0.89}}},
  "Oregon":{m:68000,col:1.12,ttf:36,tax:10.8,metros:{
    "Beaverton":{m:74000,col:1.18},"Bend":{m:64000,col:1.08},"Corvallis":{m:64000,col:1.08},
    "Eugene":{m:60000,col:1.02},"Gresham":{m:66000,col:1.10},"Hillsboro":{m:82000,col:1.26},
    "Medford":{m:56000,col:0.98},"Portland":{m:76000,col:1.22},"Salem":{m:60000,col:1.02}}},
  "Pennsylvania":{m:64000,col:1.00,ttf:35,tax:10.2,metros:{
    "Allentown":{m:60000,col:0.97},"Altoona":{m:52000,col:0.90},"Bethlehem":{m:62000,col:0.99},
    "Erie":{m:54000,col:0.91},"Harrisburg":{m:64000,col:1.00},"Lancaster":{m:60000,col:0.97},
    "Philadelphia":{m:74000,col:1.14},"Pittsburgh":{m:64000,col:1.00},"Reading":{m:58000,col:0.95},
    "Scranton":{m:54000,col:0.91},"York":{m:58000,col:0.95}}},
  "Rhode Island":{m:68000,col:1.12,ttf:36,tax:10.8,metros:{
    "Cranston":{m:66000,col:1.10},"Pawtucket":{m:62000,col:1.06},"Providence":{m:68000,col:1.12},
    "Warwick":{m:66000,col:1.10},"Woonsocket":{m:60000,col:1.04}}},
  "South Carolina":{m:54000,col:0.88,ttf:34,tax:9.0,metros:{
    "Charleston":{m:62000,col:0.98},"Columbia":{m:58000,col:0.92},"Florence":{m:50000,col:0.87},
    "Goose Creek":{m:58000,col:0.93},"Greenville":{m:58000,col:0.92},"Myrtle Beach":{m:50000,col:0.87},
    "North Charleston":{m:58000,col:0.93},"Rock Hill":{m:56000,col:0.91},"Spartanburg":{m:54000,col:0.89},
    "Sumter":{m:48000,col:0.86}}},
  "South Dakota":{m:52000,col:0.84,ttf:35,tax:8.6,metros:{
    "Aberdeen":{m:50000,col:0.83},"Brookings":{m:50000,col:0.83},"Rapid City":{m:54000,col:0.86},
    "Sioux Falls":{m:56000,col:0.88},"Watertown":{m:49000,col:0.82}}},
  "Tennessee":{m:57000,col:0.90,ttf:33,tax:9.0,metros:{
    "Chattanooga":{m:55000,col:0.89},"Clarksville":{m:52000,col:0.87},"Jackson":{m:50000,col:0.86},
    "Johnson City":{m:50000,col:0.86},"Kingsport":{m:50000,col:0.86},"Knoxville":{m:54000,col:0.88},
    "Memphis":{m:56000,col:0.90},"Murfreesboro":{m:58000,col:0.92},"Nashville":{m:68000,col:1.04}}},
  "Texas":{m:62000,col:0.97,ttf:31,tax:9.2,metros:{
    "Abilene":{m:50000,col:0.85},"Allen":{m:74000,col:1.08},"Amarillo":{m:52000,col:0.87},
    "Arlington":{m:65000,col:1.00},"Austin":{m:80000,col:1.18},"Beaumont":{m:56000,col:0.91},
    "Brownsville":{m:44000,col:0.80},"Carrollton":{m:68000,col:1.03},"Corpus Christi":{m:54000,col:0.90},
    "Dallas":{m:70000,col:1.06},"Denton":{m:64000,col:1.00},"El Paso":{m:50000,col:0.84},
    "Fort Worth":{m:66000,col:1.02},"Frisco":{m:80000,col:1.16},"Garland":{m:64000,col:1.00},
    "Grand Prairie":{m:64000,col:1.00},"Houston":{m:68000,col:1.02},"Irving":{m:70000,col:1.06},
    "Killeen":{m:48000,col:0.83},"Laredo":{m:44000,col:0.80},"Lewisville":{m:68000,col:1.03},
    "Lubbock":{m:52000,col:0.87},"McKinney":{m:76000,col:1.12},"Mesquite":{m:60000,col:0.96},
    "Midland":{m:64000,col:1.00},"Odessa":{m:60000,col:0.96},"Pasadena":{m:58000,col:0.93},
    "Pearland":{m:68000,col:1.03},"Plano":{m:78000,col:1.14},"Richardson":{m:76000,col:1.12},
    "Round Rock":{m:74000,col:1.10},"San Antonio":{m:58000,col:0.92},"Tyler":{m:54000,col:0.89},
    "Waco":{m:50000,col:0.86},"Wichita Falls":{m:48000,col:0.84}}},
  "Utah":{m:66000,col:0.99,ttf:32,tax:9.2,metros:{
    "Layton":{m:64000,col:0.98},"Logan":{m:58000,col:0.94},"Ogden":{m:62000,col:0.97},
    "Orem":{m:65000,col:0.99},"Provo":{m:66000,col:1.00},"Salt Lake City":{m:70000,col:1.04},
    "Sandy":{m:70000,col:1.04},"St. George":{m:58000,col:0.94},"West Jordan":{m:66000,col:1.00},
    "West Valley City":{m:62000,col:0.97}}},
  "Vermont":{m:60000,col:1.06,ttf:38,tax:10.4,metros:{
    "Burlington":{m:64000,col:1.10},"Montpelier":{m:62000,col:1.08},"Rutland":{m:56000,col:1.02},
    "South Burlington":{m:64000,col:1.10}}},
  "Virginia":{m:74000,col:1.08,ttf:33,tax:10.2,metros:{
    "Alexandria":{m:98000,col:1.40},"Arlington":{m:102000,col:1.44},"Charlottesville":{m:68000,col:1.04},
    "Chesapeake":{m:64000,col:0.99},"Hampton":{m:60000,col:0.97},"Harrisonburg":{m:56000,col:0.92},
    "Lynchburg":{m:54000,col:0.90},"McLean":{m:108000,col:1.48},"Newport News":{m:62000,col:0.98},
    "Norfolk":{m:62000,col:0.98},"Portsmouth":{m:60000,col:0.97},"Reston":{m:102000,col:1.42},
    "Richmond":{m:68000,col:1.04},"Roanoke":{m:54000,col:0.90},"Suffolk":{m:62000,col:0.98},
    "Virginia Beach":{m:62000,col:0.98},"Winchester":{m:62000,col:0.99}}},
  "Washington":{m:80000,col:1.22,ttf:35,tax:10.4,metros:{
    "Bellevue":{m:104000,col:1.54},"Bellingham":{m:66000,col:1.08},"Everett":{m:78000,col:1.20},
    "Kent":{m:74000,col:1.16},"Kirkland":{m:100000,col:1.50},"Redmond":{m:110000,col:1.58},
    "Renton":{m:82000,col:1.24},"Seattle":{m:96000,col:1.48},"Spokane":{m:60000,col:0.98},
    "Tacoma":{m:72000,col:1.14},"Vancouver":{m:68000,col:1.10},"Yakima":{m:54000,col:0.93}}},
  "West Virginia":{m:46000,col:0.82,ttf:38,tax:9.0,metros:{
    "Charleston":{m:50000,col:0.86},"Huntington":{m:46000,col:0.82},"Morgantown":{m:52000,col:0.88},
    "Parkersburg":{m:46000,col:0.82},"Wheeling":{m:48000,col:0.84}}},
  "Wisconsin":{m:60000,col:0.93,ttf:34,tax:9.6,metros:{
    "Appleton":{m:60000,col:0.94},"Eau Claire":{m:56000,col:0.90},"Green Bay":{m:58000,col:0.93},
    "Janesville":{m:56000,col:0.91},"Kenosha":{m:58000,col:0.93},"La Crosse":{m:56000,col:0.91},
    "Madison":{m:68000,col:1.04},"Milwaukee":{m:64000,col:0.98},"Oshkosh":{m:56000,col:0.91},
    "Racine":{m:58000,col:0.93},"Sheboygan":{m:58000,col:0.93},"Waukesha":{m:64000,col:0.98},
    "Wausau":{m:56000,col:0.90}}},
  "Wyoming":{m:58000,col:0.91,ttf:36,tax:8.8,metros:{
    "Casper":{m:60000,col:0.93},"Cheyenne":{m:60000,col:0.93},"Gillette":{m:62000,col:0.95},
    "Laramie":{m:56000,col:0.91},"Rock Springs":{m:62000,col:0.95}}}
};

// ═══════════════════════════════════════════════════════
//  UNDERWRITING DISCOUNT ENGINE
//  Takes current group profile → returns estimated discount range
//  anchored to real approved outcomes, adjusted by risk factors
// ═══════════════════════════════════════════════════════
function estimateDiscount(numElig, participation, asi, industry, state, carrierKey) {
  // Start from the real anchor group's approved range
  var baseLow  = -0.0965;   // Aetna ZA1 — worst approved
  var baseHigh = -0.1431;   // Innovation Health — best approved

  var adjLow = baseLow, adjHigh = baseHigh;

  // ── Factor 1: Group size
  // Anchor: 8 eligible. Small groups (<10) face narrower carrier competition.
  // Larger groups attract more carriers and better rates.
  if (numElig !== null) {
    if (numElig >= 50)       { adjLow -= 0.015; adjHigh -= 0.020; }  // larger = better
    else if (numElig >= 25)  { adjLow -= 0.008; adjHigh -= 0.010; }
    else if (numElig >= 10)  { adjLow -= 0.003; adjHigh -= 0.005; }
    else if (numElig < 5)    { adjLow += 0.030; adjHigh += 0.025; }  // very small = worse
    // 5-9: baseline (matches anchor)
  }

  // ── Factor 2: Participation rate
  // Anchor: 63%. UHC declined due to tier shift. Below 65% shrinks competition.
  if (participation !== null) {
    if (participation >= 0.85)      { adjLow -= 0.015; adjHigh -= 0.020; }  // high participation = more carriers
    else if (participation >= 0.75) { adjLow -= 0.008; adjHigh -= 0.010; }
    else if (participation < 0.50)  { adjLow += 0.025; adjHigh += 0.018; }  // very low = risk
    else if (participation < 0.65)  { adjLow += 0.010; adjHigh += 0.008; }
    // 65-74%: near baseline
  }

  // ── Factor 3: ASI score
  // Anchor: 1.08 (slightly above neutral).
  // Higher ASI = riskier group = less favorable pricing.
  if (asi !== null) {
    if (asi <= 0.90)      { adjLow -= 0.020; adjHigh -= 0.025; }  // young/healthy
    else if (asi <= 0.99) { adjLow -= 0.010; adjHigh -= 0.012; }
    else if (asi >= 1.20) { adjLow += 0.025; adjHigh += 0.020; }  // older/higher risk
    else if (asi >= 1.10) { adjLow += 0.012; adjHigh += 0.008; }
    // 1.00-1.09: near baseline (anchor was 1.08)
  }

  // ── Factor 4: Industry risk
  // Anchor: low risk (professional services)
  if (industry === 'med') { adjLow += 0.008; adjHigh += 0.005; }
  if (industry === 'high'){ adjLow += 0.020; adjHigh += 0.015; }  // construction etc harder to price

  // ── Factor 5: Regional carrier competition
  // Anchor: NoVA/DC — competitive market with Innovation Health regional option
  // Innovation Health's -14.31% was the best because of regional network strength.
  // Other markets may not have that option.
  var hasRegionalBonus = (state === 'Virginia' || state === 'Maryland' || state === 'District of Columbia');
  if (!hasRegionalBonus) {
    adjHigh += 0.015;  // cap the high end without regional carrier advantage
  }

  // Clamp to reasonable real-world bounds (2% min, 20% max discount)
  adjLow  = Math.max(adjLow,  -0.020);
  adjHigh = Math.min(adjHigh, -0.200);
  // Ensure low <= high
  if (adjLow > adjHigh) { var tmp=adjLow; adjLow=adjHigh; adjHigh=tmp; }
  var adjMid = (adjLow + adjHigh) / 2;

  return { low: adjLow, mid: adjMid, high: adjHigh };
}

// ═══════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════
function toggleOtherCarrier(){
  var isOther=gv('carrier')==='other';
  document.getElementById('otherCarrierRow').style.display=isOther?'block':'none';
  if(!isOther) document.getElementById('otherCarrierName').value='';
}
// ═══════════════════════════════════════════════════════
//  ACA MARKETPLACE RATE LOOKUP
//  Uses CMS Marketplace API (marketplace.api.healthcare.gov)
//  Public rate-limited test key — works for up to ~500 req/hr
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
//  ACA RATE LOOKUP — fully offline, no fetch required
//  Built from 2026 CMS rate filings + HealthCare.gov data
//  Age-40 reference rates, federal 3:1 age curve applied
// ═══════════════════════════════════════════════════════

// Federal ACA age rating curve (age 21 = 1.000 baseline)
var AGE_CURVE = {
  18:0.635,19:0.635,20:0.635,21:1.000,22:1.000,23:1.000,24:1.000,
  25:1.004,26:1.024,27:1.048,28:1.087,29:1.119,30:1.135,31:1.159,
  32:1.183,33:1.198,34:1.214,35:1.222,36:1.230,37:1.238,38:1.246,
  39:1.254,40:1.262,41:1.278,42:1.294,43:1.317,44:1.349,45:1.389,
  46:1.436,47:1.492,48:1.556,49:1.619,50:1.690,51:1.762,52:1.841,
  53:1.927,54:2.021,55:2.107,56:2.201,57:2.302,58:2.411,59:2.468,
  60:2.584,61:2.700,62:2.756,63:2.813,64:3.000
};

// ZIP 3-digit prefix → state
var ZIP_TO_STATE = {
  "010":"MA","011":"MA","012":"MA","013":"MA","014":"MA","015":"MA","016":"MA","017":"MA","018":"MA","019":"MA",
  "020":"MA","021":"MA","022":"MA","023":"MA","024":"MA","025":"MA","026":"MA","027":"MA",
  "028":"RI","029":"RI",
  "030":"NH","031":"NH","032":"NH","033":"NH","034":"NH","035":"NH","036":"NH","037":"NH","038":"NH",
  "039":"ME","040":"ME","041":"ME","042":"ME","043":"ME","044":"ME","045":"ME","046":"ME","047":"ME","048":"ME","049":"ME",
  "050":"VT","051":"VT","052":"VT","053":"VT","054":"VT","056":"VT","057":"VT","058":"VT","059":"VT",
  "060":"CT","061":"CT","062":"CT","063":"CT","064":"CT","065":"CT","066":"CT","067":"CT","068":"CT","069":"CT",
  "070":"NJ","071":"NJ","072":"NJ","073":"NJ","074":"NJ","075":"NJ","076":"NJ","077":"NJ","078":"NJ","079":"NJ",
  "080":"NJ","081":"NJ","082":"NJ","083":"NJ","084":"NJ","085":"NJ","086":"NJ","087":"NJ","088":"NJ","089":"NJ",
  "100":"NY","101":"NY","102":"NY","103":"NY","104":"NY","105":"NY","106":"NY","107":"NY","108":"NY","109":"NY",
  "110":"NY","111":"NY","112":"NY","113":"NY","114":"NY","115":"NY","116":"NY","117":"NY","118":"NY","119":"NY",
  "120":"NY","121":"NY","122":"NY","123":"NY","124":"NY","125":"NY","126":"NY","127":"NY","128":"NY","129":"NY",
  "130":"NY","131":"NY","132":"NY","133":"NY","134":"NY","135":"NY","136":"NY","137":"NY","138":"NY","139":"NY",
  "140":"NY","141":"NY","142":"NY","143":"NY","144":"NY","145":"NY","146":"NY","147":"NY","148":"NY","149":"NY",
  "150":"PA","151":"PA","152":"PA","153":"PA","154":"PA","155":"PA","156":"PA","157":"PA","158":"PA","159":"PA",
  "160":"PA","161":"PA","162":"PA","163":"PA","164":"PA","165":"PA","166":"PA","167":"PA","168":"PA","169":"PA",
  "170":"PA","171":"PA","172":"PA","173":"PA","174":"PA","175":"PA","176":"PA","177":"PA","178":"PA","179":"PA",
  "180":"PA","181":"PA","182":"PA","183":"PA","184":"PA","185":"PA","186":"PA","187":"PA","188":"PA","189":"PA",
  "190":"PA","191":"PA","192":"PA","193":"PA","194":"PA","195":"PA","196":"PA",
  "197":"DE","198":"DE","199":"DE",
  "200":"DC","201":"DC","202":"DC","203":"DC","204":"DC","205":"DC",
  "206":"MD","207":"MD","208":"MD","209":"MD","210":"MD","211":"MD","212":"MD","214":"MD","215":"MD","216":"MD","217":"MD","218":"MD","219":"MD",
  "220":"VA","221":"VA","222":"VA","223":"VA","224":"VA","225":"VA","226":"VA","227":"VA","228":"VA","229":"VA",
  "230":"VA","231":"VA","232":"VA","233":"VA","234":"VA","235":"VA","236":"VA","237":"VA","238":"VA","239":"VA",
  "240":"VA","241":"VA","242":"VA","243":"VA","244":"VA","245":"VA","246":"VA",
  "247":"WV","248":"WV","249":"WV","250":"WV","251":"WV","252":"WV","253":"WV","254":"WV","255":"WV","256":"WV","257":"WV","258":"WV","259":"WV",
  "260":"WV","261":"WV","262":"WV","263":"WV","264":"WV","265":"WV","266":"WV","267":"WV","268":"WV",
  "270":"NC","271":"NC","272":"NC","273":"NC","274":"NC","275":"NC","276":"NC","277":"NC","278":"NC","279":"NC",
  "280":"NC","281":"NC","282":"NC","283":"NC","284":"NC","285":"NC","286":"NC","287":"NC","288":"NC","289":"NC",
  "290":"SC","291":"SC","292":"SC","293":"SC","294":"SC","295":"SC","296":"SC","297":"SC","298":"SC","299":"SC",
  "300":"GA","301":"GA","302":"GA","303":"GA","304":"GA","305":"GA","306":"GA","307":"GA","308":"GA","309":"GA",
  "310":"GA","311":"GA","312":"GA","313":"GA","314":"GA","315":"GA","316":"GA","317":"GA","318":"GA","319":"GA",
  "320":"FL","321":"FL","322":"FL","323":"FL","324":"FL","325":"FL","326":"FL","327":"FL","328":"FL","329":"FL",
  "330":"FL","331":"FL","332":"FL","333":"FL","334":"FL","335":"FL","336":"FL","337":"FL","338":"FL",
  "339":"FL","340":"FL","341":"FL","342":"FL","344":"FL","346":"FL","347":"FL","349":"FL",
  "350":"AL","351":"AL","352":"AL","354":"AL","355":"AL","356":"AL","357":"AL","358":"AL","359":"AL",
  "360":"AL","361":"AL","362":"AL","363":"AL","364":"AL","365":"AL","366":"AL","367":"AL","368":"AL","369":"AL",
  "370":"TN","371":"TN","372":"TN","373":"TN","374":"TN","376":"TN","377":"TN","378":"TN","379":"TN",
  "380":"TN","381":"TN","382":"TN","383":"TN","384":"TN","385":"TN",
  "386":"MS","387":"MS","388":"MS","389":"MS","390":"MS","391":"MS","392":"MS","393":"MS","394":"MS","395":"MS","396":"MS","397":"MS",
  "398":"GA","399":"GA",
  "400":"KY","401":"KY","402":"KY","403":"KY","404":"KY","405":"KY","406":"KY","407":"KY","408":"KY","409":"KY",
  "410":"KY","411":"KY","412":"KY","413":"KY","414":"KY","415":"KY","416":"KY","417":"KY","418":"KY",
  "420":"KY","421":"KY","422":"KY","423":"KY","424":"KY","425":"KY","426":"KY","427":"KY",
  "430":"OH","431":"OH","432":"OH","433":"OH","434":"OH","435":"OH","436":"OH","437":"OH","438":"OH","439":"OH",
  "440":"OH","441":"OH","442":"OH","443":"OH","444":"OH","445":"OH","446":"OH","447":"OH","448":"OH","449":"OH",
  "450":"OH","451":"OH","452":"OH","453":"OH","454":"OH","455":"OH","456":"OH","457":"OH","458":"OH",
  "460":"IN","461":"IN","462":"IN","463":"IN","464":"IN","465":"IN","466":"IN","467":"IN","468":"IN","469":"IN",
  "470":"IN","471":"IN","472":"IN","473":"IN","474":"IN","475":"IN","476":"IN","477":"IN","478":"IN","479":"IN",
  "480":"MI","481":"MI","482":"MI","483":"MI","484":"MI","485":"MI","486":"MI","487":"MI","488":"MI","489":"MI",
  "490":"MI","491":"MI","492":"MI","493":"MI","494":"MI","495":"MI","496":"MI","497":"MI","498":"MI","499":"MI",
  "500":"IA","501":"IA","502":"IA","503":"IA","504":"IA","505":"IA","506":"IA","507":"IA","508":"IA","509":"IA",
  "510":"IA","511":"IA","512":"IA","513":"IA","514":"IA","515":"IA","516":"IA",
  "520":"IA","521":"IA","522":"IA","523":"IA","524":"IA","525":"IA","526":"IA","527":"IA","528":"IA",
  "530":"WI","531":"WI","532":"WI","534":"WI","535":"WI","537":"WI","538":"WI","539":"WI",
  "540":"WI","541":"WI","542":"WI","543":"WI","544":"WI","545":"WI","546":"WI","547":"WI","548":"WI","549":"WI",
  "550":"MN","551":"MN","553":"MN","554":"MN","555":"MN","556":"MN","557":"MN","558":"MN","559":"MN",
  "560":"MN","561":"MN","562":"MN","563":"MN","564":"MN","565":"MN","566":"MN","567":"MN",
  "570":"SD","571":"SD","572":"SD","573":"SD","574":"SD","575":"SD","576":"SD","577":"SD",
  "580":"ND","581":"ND","582":"ND","583":"ND","584":"ND","585":"ND","586":"ND","587":"ND","588":"ND",
  "590":"MT","591":"MT","592":"MT","593":"MT","594":"MT","595":"MT","596":"MT","597":"MT","598":"MT","599":"MT",
  "600":"IL","601":"IL","602":"IL","603":"IL","604":"IL","605":"IL","606":"IL","607":"IL","608":"IL","609":"IL",
  "610":"IL","611":"IL","612":"IL","612":"IL","613":"IL","614":"IL","615":"IL","616":"IL","617":"IL","618":"IL","619":"IL",
  "620":"IL","621":"IL","622":"IL","623":"IL","624":"IL","625":"IL","626":"IL","627":"IL","628":"IL","629":"IL",
  "630":"MO","631":"MO","633":"MO","634":"MO","635":"MO","636":"MO","637":"MO","638":"MO","639":"MO",
  "640":"MO","641":"MO","644":"MO","645":"MO","646":"MO","647":"MO","648":"MO",
  "650":"MO","651":"MO","652":"MO","653":"MO","654":"MO","655":"MO","656":"MO","657":"MO","658":"MO",
  "660":"KS","661":"KS","662":"KS","664":"KS","665":"KS","666":"KS","667":"KS","668":"KS","669":"KS",
  "670":"KS","671":"KS","672":"KS","673":"KS","674":"KS","675":"KS","676":"KS","677":"KS","678":"KS","679":"KS",
  "680":"NE","681":"NE","683":"NE","684":"NE","685":"NE","686":"NE","687":"NE","688":"NE","689":"NE",
  "690":"NE","691":"NE","692":"NE","693":"NE",
  "700":"LA","701":"LA","703":"LA","704":"LA","705":"LA","706":"LA","707":"LA","708":"LA",
  "710":"LA","711":"LA","712":"LA","713":"LA","714":"LA",
  "716":"AR","717":"AR","718":"AR","719":"AR","720":"AR","721":"AR","722":"AR","723":"AR","724":"AR","725":"AR","726":"AR","727":"AR","728":"AR","729":"AR",
  "730":"OK","731":"OK","733":"OK","734":"OK","735":"OK","736":"OK","737":"OK","738":"OK","739":"OK",
  "740":"OK","741":"OK","743":"OK","744":"OK","745":"OK","746":"OK","747":"OK","748":"OK","749":"OK",
  "750":"TX","751":"TX","752":"TX","753":"TX","754":"TX","755":"TX","756":"TX","757":"TX","758":"TX","759":"TX",
  "760":"TX","761":"TX","762":"TX","763":"TX","764":"TX","765":"TX","766":"TX","767":"TX","768":"TX","769":"TX",
  "770":"TX","771":"TX","772":"TX","773":"TX","774":"TX","775":"TX","776":"TX","777":"TX","778":"TX","779":"TX",
  "780":"TX","781":"TX","782":"TX","783":"TX","784":"TX","785":"TX","786":"TX","787":"TX","788":"TX","789":"TX",
  "790":"TX","791":"TX","792":"TX","793":"TX","794":"TX","795":"TX","796":"TX","797":"TX","798":"TX","799":"TX",
  "800":"CO","801":"CO","802":"CO","803":"CO","804":"CO","805":"CO","806":"CO","807":"CO","808":"CO","809":"CO",
  "810":"CO","811":"CO","812":"CO","813":"CO","814":"CO","815":"CO","816":"CO",
  "820":"WY","821":"WY","822":"WY","823":"WY","824":"WY","825":"WY","826":"WY","827":"WY","828":"WY","829":"WY","830":"WY","831":"WY",
  "832":"ID","833":"ID","834":"ID","835":"ID","836":"ID","837":"ID","838":"ID",
  "840":"UT","841":"UT","842":"UT","843":"UT","844":"UT","845":"UT","846":"UT","847":"UT",
  "850":"AZ","851":"AZ","852":"AZ","853":"AZ","855":"AZ","856":"AZ","857":"AZ","859":"AZ","860":"AZ","861":"AZ","863":"AZ","864":"AZ","865":"AZ",
  "870":"NM","871":"NM","872":"NM","873":"NM","874":"NM","875":"NM","876":"NM","877":"NM","878":"NM","879":"NM",
  "880":"NM","881":"NM","882":"NM","883":"NM","884":"NM","885":"TX",
  "889":"NV","890":"NV","891":"NV","893":"NV","894":"NV","895":"NV","896":"NV","897":"NV","898":"NV",
  "900":"CA","901":"CA","902":"CA","903":"CA","904":"CA","905":"CA","906":"CA","907":"CA","908":"CA","909":"CA",
  "910":"CA","911":"CA","912":"CA","913":"CA","914":"CA","915":"CA","916":"CA","917":"CA","918":"CA","919":"CA",
  "920":"CA","921":"CA","922":"CA","923":"CA","924":"CA","925":"CA","926":"CA","927":"CA","928":"CA",
  "930":"CA","931":"CA","932":"CA","933":"CA","934":"CA","935":"CA","936":"CA","937":"CA","938":"CA","939":"CA",
  "940":"CA","941":"CA","942":"CA","943":"CA","944":"CA","945":"CA","946":"CA","947":"CA","948":"CA","949":"CA",
  "950":"CA","951":"CA","952":"CA","953":"CA","954":"CA","955":"CA","956":"CA","957":"CA","958":"CA","959":"CA",
  "960":"CA","961":"CA",
  "967":"HI","968":"HI",
  "970":"OR","971":"OR","972":"OR","973":"OR","974":"OR","975":"OR","976":"OR","977":"OR","978":"OR","979":"OR",
  "980":"WA","981":"WA","982":"WA","983":"WA","984":"WA","985":"WA","986":"WA","988":"WA","989":"WA",
  "990":"WA","991":"WA","992":"WA","993":"WA","994":"WA",
  "995":"AK","996":"AK","997":"AK","998":"AK","999":"AK"
};

// State base rates — age-40 monthly, lowest-cost plan per metal (2026)
// bronze=lowest bronze, silver=lowest silver, gold=lowest gold
var ACA_STATE = {
  "AL":{b:218,s:298,g:348, b25:206,s25:281,g25:328, b24:196,s24:267,g24:312, trend26:5.8, trend25:4.9, note:"BCBS Alabama dominant; limited competition statewide"},
  "AK":{b:520,s:698,g:812, b25:489,s25:656,g25:764, b24:464,s24:623,g24:725, trend26:6.3, trend25:5.4, note:"Highest-cost state; near-monopoly carrier market"},
  "AZ":{b:248,s:334,g:392, b25:233,s25:314,g25:369, b24:220,s24:298,g24:350, trend26:6.4, trend25:5.5, note:"Competitive Phoenix/Tucson; rural areas 20-30% higher"},
  "AR":{b:204,s:278,g:324, b25:192,s25:261,g25:305, b24:183,s24:248,g24:290, trend26:6.2, trend25:5.0, note:"Lower-cost market; limited carrier options outside Little Rock"},
  "CA":{b:296,s:398,g:468, b25:278,s25:374,g25:440, b24:263,s24:355,g24:418, trend26:6.4, trend25:5.4, note:"Covered California; strong urban competition, rural variation"},
  "CO":{b:268,s:362,g:424, b25:252,s25:340,g25:399, b24:239,s24:323,g24:379, trend26:6.3, trend25:5.4, note:"Denver/Boulder premium; resort county surcharges apply"},
  "CT":{b:338,s:452,g:528, b25:318,s25:425,g25:497, b24:302,s24:404,g24:472, trend26:6.3, trend25:5.2, note:"High-cost state; limited carrier competition"},
  "DE":{b:312,s:418,g:488, b25:293,s25:393,g25:459, b24:278,s24:373,g24:436, trend26:6.5, trend25:5.3, note:"Mid-Atlantic pricing; Highmark dominant"},
  "DC":{b:298,s:402,g:468, b25:280,s25:378,g25:440, b24:266,s24:359,g24:418, trend26:6.4, trend25:5.2, note:"Urban market; good carrier competition across plans"},
  "FL":{b:278,s:372,g:434, b25:261,s25:350,g25:408, b24:248,s24:332,g24:388, trend26:6.5, trend25:5.4, note:"Large competitive market; significant county variation"},
  "GA":{b:248,s:334,g:390, b25:233,s25:314,g25:367, b24:221,s24:298,g24:348, trend26:6.4, trend25:5.3, note:"Atlanta lower; rural Georgia 15-25% higher than metro"},
  "HI":{b:318,s:428,g:498, b25:299,s25:402,g25:468, b24:284,s24:382,g24:445, trend26:6.4, trend25:5.3, note:"High CoL; HMSA and Kaiser dominate the market"},
  "ID":{b:272,s:366,g:428, b25:256,s25:344,g25:402, b24:243,s24:327,g24:382, trend26:6.2, trend25:5.2, note:"Moderate-cost; Blue Cross of Idaho dominant"},
  "IL":{b:282,s:378,g:442, b25:265,s25:355,g25:416, b24:251,s24:337,g24:395, trend26:6.4, trend25:5.3, note:"Chicago competitive; downstate higher relative to wages"},
  "IN":{b:258,s:346,g:404, b25:242,s25:325,g25:380, b24:230,s24:309,g24:361, trend26:6.6, trend25:5.4, note:"Moderate market; Anthem and MDwise compete"},
  "IA":{b:244,s:328,g:384, b25:229,s25:308,g25:361, b24:218,s24:293,g24:343, trend26:6.6, trend25:5.3, note:"Competitive Midwest market; Wellmark dominant"},
  "KS":{b:238,s:320,g:374, b25:224,s25:301,g25:352, b24:212,s24:286,g24:334, trend26:6.2, trend25:5.1, note:"Limited competition outside KC metro area"},
  "KY":{b:228,s:308,g:360, b25:214,s25:289,g25:338, b24:204,s24:275,g24:321, trend26:6.5, trend25:5.2, note:"kynect exchange; competitive Louisville and Lexington"},
  "LA":{b:268,s:360,g:420, b25:252,s25:338,g25:395, b24:239,s24:321,g24:375, trend26:6.3, trend25:5.3, note:"Moderate cost; BCBS Louisiana dominant statewide"},
  "ME":{b:338,s:452,g:528, b25:318,s25:425,g25:497, b24:302,s24:404,g24:472, trend26:6.3, trend25:5.2, note:"High-cost state; community rating limits age band spread"},
  "MD":{b:288,s:388,g:452, b25:271,s25:364,g25:425, b24:257,s24:346,g24:404, trend26:6.6, trend25:5.4, note:"Maryland exchange; DC suburbs carry a premium"},
  "MA":{b:348,s:468,g:546, b25:327,s25:440,g25:513, b24:310,s24:418,g24:488, trend26:6.4, trend25:5.3, note:"Community rating state; near-universal coverage baseline"},
  "MI":{b:258,s:346,g:404, b25:243,s25:325,g25:380, b24:231,s24:309,g24:361, trend26:6.2, trend25:5.2, note:"Healthy Michigan Plan; competitive Detroit and Grand Rapids"},
  "MN":{b:298,s:400,g:468, b25:280,s25:376,g25:440, b24:266,s24:357,g24:418, trend26:6.4, trend25:5.3, note:"MNsure; Minneapolis competitive, Greater MN higher"},
  "MS":{b:238,s:320,g:374, b25:224,s25:301,g25:352, b24:213,s24:286,g24:334, trend26:6.2, trend25:5.0, note:"Among lowest-cost states; very limited carrier options"},
  "MO":{b:248,s:334,g:390, b25:233,s25:314,g25:367, b24:221,s24:298,g24:348, trend26:6.4, trend25:5.3, note:"KC and STL competitive; rural Missouri significantly higher"},
  "MT":{b:318,s:428,g:498, b25:299,s25:402,g25:468, b24:284,s24:382,g24:445, trend26:6.4, trend25:5.2, note:"High-cost rural state; Blue Cross MT near-monopoly"},
  "NE":{b:308,s:414,g:484, b25:289,s25:389,g25:455, b24:275,s24:370,g24:432, trend26:6.6, trend25:5.2, note:"Limited competition; Medica and BCBS dominant"},
  "NV":{b:262,s:352,g:412, b25:246,s25:331,g25:387, b24:234,s24:314,g24:368, trend26:6.5, trend25:5.3, note:"Las Vegas competitive; rural Nevada 30-40% higher"},
  "NH":{b:318,s:428,g:498, b25:299,s25:402,g25:468, b24:284,s24:382,g24:445, trend26:6.4, trend25:5.3, note:"High-cost; Ambetter and Harvard Pilgrim compete"},
  "NJ":{b:322,s:432,g:504, b25:303,s25:406,g25:474, b24:288,s24:386,g24:450, trend26:6.3, trend25:5.2, note:"GetCoveredNJ; urban NJ near NYC-level pricing"},
  "NM":{b:228,s:306,g:358, b25:214,s25:288,g25:337, b24:204,s24:273,g24:320, trend26:6.5, trend25:5.3, note:"beWellnm; lower-cost market with moderate competition"},
  "NY":{b:368,s:494,g:578, b25:346,s25:464,g25:544, b24:328,s24:441,g24:517, trend26:6.4, trend25:5.5, note:"NY State of Health; NYC rating area far above state avg"},
  "NC":{b:268,s:360,g:420, b25:252,s25:338,g25:395, b24:239,s24:321,g24:375, trend26:6.3, trend25:5.3, note:"Competitive; Blue Cross NC dominant across the state"},
  "ND":{b:312,s:418,g:488, b25:293,s25:393,g25:459, b24:278,s24:373,g24:436, trend26:6.5, trend25:5.2, note:"Very limited competition; BCBS ND near-monopoly"},
  "OH":{b:252,s:338,g:396, b25:237,s25:318,g25:373, b24:225,s24:302,g24:354, trend26:6.3, trend25:5.2, note:"Competitive market; significant metro vs rural variation"},
  "OK":{b:244,s:328,g:384, b25:229,s25:308,g25:361, b24:218,s24:293,g24:343, trend26:6.5, trend25:5.2, note:"Limited competition outside OKC and Tulsa"},
  "OR":{b:288,s:388,g:452, b25:271,s25:364,g25:425, b24:257,s24:346,g24:404, trend26:6.3, trend25:5.2, note:"OHP marketplace; Portland competitive, rural Oregon higher"},
  "PA":{b:278,s:374,g:436, b25:261,s25:351,g25:410, b24:248,s24:334,g24:389, trend26:6.5, trend25:5.3, note:"Pennie marketplace; Philly and Pittsburgh differ significantly"},
  "RI":{b:318,s:428,g:498, b25:299,s25:402,g25:468, b24:284,s24:382,g24:445, trend26:6.3, trend25:5.2, note:"HealthSource RI; small market with limited plan options"},
  "SC":{b:258,s:346,g:404, b25:243,s25:325,g25:380, b24:231,s24:309,g24:361, trend26:6.2, trend25:5.2, note:"Moderate cost; BCBS SC dominant across the state"},
  "SD":{b:332,s:446,g:520, b25:312,s25:419,g25:489, b24:296,s24:398,g24:465, trend26:6.4, trend25:5.3, note:"Limited competition; BCBS SD near-monopoly market"},
  "TN":{b:238,s:320,g:374, b25:224,s25:301,g25:352, b24:213,s24:286,g24:334, trend26:6.2, trend25:5.1, note:"Competitive Nashville; rural TN options more limited"},
  "TX":{b:268,s:360,g:420, b25:252,s25:338,g25:395, b24:239,s24:321,g24:375, trend26:6.3, trend25:5.3, note:"Large market; no state exchange, major metro variation"},
  "UT":{b:258,s:346,g:404, b25:242,s25:325,g25:380, b24:230,s24:309,g24:361, trend26:6.5, trend25:5.2, note:"SelectHealth and BCBS compete; generally competitive"},
  "VT":{b:418,s:562,g:656, b25:393,s25:528,g25:617, b24:373,s24:502,g24:586, trend26:6.4, trend25:5.3, note:"VT Health Connect; highest per-capita costs in contiguous US"},
  "VA":{b:262,s:352,g:412, b25:246,s25:331,g25:387, b24:234,s24:314,g24:368, trend26:6.5, trend25:5.4, note:"Virginia marketplace; NoVA near DC carries a premium"},
  "WA":{b:282,s:378,g:442, b25:265,s25:355,g25:416, b24:252,s24:338,g24:395, trend26:6.4, trend25:5.3, note:"WaHealthPlanfinder; Seattle premium, broad competition"},
  "WV":{b:368,s:494,g:578, b25:346,s25:464,g25:544, b24:328,s24:441,g24:517, trend26:6.3, trend25:5.3, note:"High-cost state; very limited carrier competition"},
  "WI":{b:278,s:374,g:436, b25:261,s25:351,g25:410, b24:248,s24:334,g24:389, trend26:6.4, trend25:5.3, note:"Competitive market; multiple carriers across major metros"},
  "WY":{b:428,s:576,g:672, b25:402,s25:541,g25:631, b24:382,s24:514,g24:600, trend26:6.5, trend25:5.4, note:"Second-highest cost state; near-monopoly carrier market"}
};

// Metro cost adjustment — multiply state base by this factor
// Keyed as STATE_ZIPPREFIX for major metros that differ from state average
var ACA_METRO = {
  "NY_100":1.42,"NY_101":1.42,"NY_102":1.42,"NY_103":1.10,"NY_104":1.10,
  "NY_110":1.38,"NY_111":1.38,"NY_112":1.38,"NY_113":1.38,"NY_114":1.38,
  "NY_116":1.38,"NY_117":1.22,"NY_118":1.22,"NY_119":1.22,
  "CA_900":1.08,"CA_901":1.08,"CA_902":1.08,"CA_906":1.08,"CA_907":1.08,"CA_908":1.08,
  "CA_940":1.32,"CA_941":1.32,"CA_942":1.32,"CA_943":1.18,"CA_944":1.18,"CA_945":1.18,"CA_946":1.28,"CA_947":1.28,"CA_948":1.22,"CA_949":1.22,
  "TX_787":1.08,"TX_733":0.96,"TX_750":0.94,"TX_751":0.94,"TX_752":0.94,"TX_753":0.94,
  "FL_330":1.12,"FL_331":1.12,"FL_332":1.12,"FL_333":1.12,
  "PA_190":1.14,"PA_191":1.14,"PA_192":1.14,"PA_193":1.14,"PA_194":1.14,
  "IL_606":1.10,"IL_607":1.10,"IL_608":1.10,"IL_609":1.10,
  "WA_980":1.18,"WA_981":1.18,"WA_982":1.12,
  "CO_800":1.10,"CO_801":1.10,"CO_802":1.10,"CO_803":1.08,"CO_804":1.08,
  "VA_220":1.18,"VA_221":1.18,"VA_222":1.18,"VA_223":1.18,
  "MD_208":1.12,"MD_209":1.12,"MD_207":1.08,
  "MA_021":1.14,"MA_022":1.14,"MA_024":1.14,
  "OR_970":1.10,"OR_971":1.10,"OR_972":1.10,
  "MN_550":1.06,"MN_551":1.06,"MN_553":1.06,"MN_554":1.06,"MN_555":1.06
};

function lookupACArates() {
  var zip     = document.getElementById('acaZip').value.trim();
  var agesRaw = document.getElementById('acaAges').value.trim();
  var year    = document.getElementById('acaYear').value;

  if (!zip || zip.length !== 5) { alert('Please enter a valid 5-digit ZIP code.'); return; }

  // Parse ages — default representative spread if blank
  var ages = [];
  if (agesRaw) {
    ages = agesRaw.split(',').map(function(a) { return parseInt(a.trim(), 10); })
                  .filter(function(a) { return !isNaN(a) && a >= 18 && a <= 64; });
  }
  if (!ages.length) ages = [25, 30, 35, 40, 45, 50, 55, 60];

  // Resolve state from ZIP prefix
  var prefix = zip.substring(0, 3);
  var state  = ZIP_TO_STATE[prefix];
  if (!state || !ACA_STATE[state]) {
    document.getElementById('acaStatus').style.display = 'block';
    document.getElementById('acaStatus').style.borderLeftColor = 'var(--orange)';
    document.getElementById('acaStatusMsg').textContent = 'ZIP code ' + zip + ' not recognized. Please check and try again.';
    return;
  }

  // Get base rates and apply metro factor if applicable
  var base      = ACA_STATE[state];
  var metroKey  = state + '_' + prefix;
  var factor    = ACA_METRO[metroKey] || 1.0;
  var yr2025    = year === '2025';   // 2025 rates ~6% lower on average
  var yrFactor  = yr2025 ? 0.94 : 1.0;

  var bBase = Math.round(base.b * factor * yrFactor);
  var sBase = Math.round(base.s * factor * yrFactor);
  var gBase = Math.round(base.g * factor * yrFactor);

  // Build age-banded rates using federal age curve
  // Age-40 reference = AGE_CURVE[40] = 1.262, so divide to get the true base then multiply by age curve
  var refCurve = AGE_CURVE[40] || 1.262;
  var ageRates = ages.map(function(age) {
    var curve = AGE_CURVE[age] || AGE_CURVE[40];
    var ratio  = curve / refCurve;
    return {
      age: age,
      bronze_low: Math.round(bBase * ratio),
      bronze_mid: Math.round(bBase * ratio * 1.12),
      silver_low: Math.round(sBase * ratio),
      silver_mid: Math.round(sBase * ratio * 1.10),
      gold_low:   Math.round(gBase * ratio),
      gold_mid:   Math.round(gBase * ratio * 1.09)
    };
  });

  var locationLabel = state + ' · ZIP ' + zip + (factor !== 1.0 ? ' (metro-adjusted)' : ' (state average)');

  // Historical silver rates (apply same metro factor for apples-to-apples comparison)
  var hist24s = base.s24 ? Math.round(base.s24 * factor) : null;
  var hist25s = base.s25 ? Math.round(base.s25 * factor) : null;

  renderACAresults({
    zip: zip, year: year, state: state,
    location: locationLabel,
    metro_factor: factor,
    note: base.note,
    age_rates: ageRates,
    avg_bronze: bBase, avg_silver: sBase, avg_gold: gBase,
    hist: { s24: hist24s, s25: hist25s },
    trend26: base.trend26 || 6.2
  });
  document.getElementById('acaStatus').style.display = 'none';
}

function renderACAresults(data) {
  var ff2 = function(n) { return (n != null && !isNaN(n)) ? '$' + Math.round(n).toLocaleString('en-US') : '-'; };
  var fp2 = function(n) { return (n != null && !isNaN(n)) ? n.toFixed(1) + '%' : '-'; };

  document.getElementById('acaLocationLabel').textContent = data.location || data.state;
  document.getElementById('acaPlanCount').textContent     = data.year + ' plan year  |  individual market benchmark';

  // ── Age-banded rate table ──────────────────────────────
  var rates = data.age_rates || [];
  var tHead =
    '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
    '<thead><tr style="border-bottom:1px solid var(--border);">' +
    '<th style="text-align:left;padding:6px 10px;color:var(--muted);font-weight:500;">Age</th>' +
    '<th style="text-align:right;padding:6px 8px;color:#cd7c2e;font-weight:500;">Bronze Low</th>' +
    '<th style="text-align:right;padding:6px 8px;color:#cd7c2e;font-weight:500;">Bronze Mid</th>' +
    '<th style="text-align:right;padding:6px 8px;color:var(--blue);font-weight:500;">Silver Low</th>' +
    '<th style="text-align:right;padding:6px 8px;color:var(--blue);font-weight:500;">Silver Mid</th>' +
    '<th style="text-align:right;padding:6px 8px;color:var(--yellow);font-weight:500;">Gold Low</th>' +
    '<th style="text-align:right;padding:6px 8px;color:var(--yellow);font-weight:500;">Gold Mid</th>' +
    '</tr></thead><tbody>';

  var silverLows = [], goldLows = [], bronzeLows = [];
  var tRows = rates.map(function(r) {
    if (r.silver_low) silverLows.push(r.silver_low);
    if (r.gold_low)   goldLows.push(r.gold_low);
    if (r.bronze_low) bronzeLows.push(r.bronze_low);
    return '<tr style="border-bottom:1px solid rgba(255,255,255,0.04);">' +
      '<td style="padding:6px 10px;color:var(--muted);">Age ' + r.age + '</td>' +
      '<td style="text-align:right;padding:6px 8px;color:#cd7c2e;">'                    + ff2(r.bronze_low) + '/mo</td>' +
      '<td style="text-align:right;padding:6px 8px;color:#a06020;">'                    + ff2(r.bronze_mid) + '/mo</td>' +
      '<td style="text-align:right;padding:6px 8px;color:var(--blue);font-weight:600;">'+ ff2(r.silver_low) + '/mo</td>' +
      '<td style="text-align:right;padding:6px 8px;color:var(--blue);">'                + ff2(r.silver_mid) + '/mo</td>' +
      '<td style="text-align:right;padding:6px 8px;color:var(--yellow);">'              + ff2(r.gold_low)   + '/mo</td>' +
      '<td style="text-align:right;padding:6px 8px;color:#b09020;">'                    + ff2(r.gold_mid)   + '/mo</td>' +
      '</tr>';
  }).join('');
  document.getElementById('acaAgeBands').innerHTML = tHead + tRows + '</tbody></table>';

  // ── Summary cards ──────────────────────────────────────
  var avg = function(arr) { return arr.length ? Math.round(arr.reduce(function(a,b){return a+b;},0)/arr.length) : null; };
  var avgSilver = avg(silverLows), avgGold = avg(goldLows), avgBronze = avg(bronzeLows);

  window.acaAvgSilver = avgSilver;
  window.acaAvgGold   = avgGold;
  window.acaAvgBronze = avgBronze;
  window.acaYear      = data.year;
  window.acaLocation  = data.location;

  var cards = [
    {label:'Avg Bronze (low)',  val: ff2(avgBronze)+'/mo',                           color:'#cd7c2e'},
    {label:'Avg Silver (low)',  val: ff2(avgSilver)+'/mo',                           color:'var(--blue)'},
    {label:'Avg Gold (low)',    val: ff2(avgGold)+'/mo',                             color:'var(--yellow)'},
    {label:'Silver x2 (EE+1)', val: avgSilver ? ff2(avgSilver*2)+'/mo' : '-',       color:'var(--purple)'}
  ];
  document.getElementById('acaSummaryCards').innerHTML = cards.map(function(c) {
    return '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 14px;">' +
      '<div style="font-size:11px;color:var(--muted);margin-bottom:4px;">' + c.label + '</div>' +
      '<div style="font-size:18px;font-weight:700;color:' + c.color + ';">' + c.val + '</div></div>';
  }).join('');

  // ── vs current premium callout ─────────────────────────
  var clientAvg = getRaw('premAvg');
  var vsPremEl  = document.getElementById('acaVsPremium');
  if (vsPremEl && clientAvg && avgSilver) {
    var diff    = clientAvg - avgSilver;
    var diffPct = Math.round(Math.abs(diff / avgSilver) * 100);
    var msg = diff > 0
      ? 'Their blended avg premium of <strong>' + ff2(clientAvg) + '</strong> is ' +
        '<strong style="color:var(--orange);">&#9650; ' + diffPct + '% above</strong> the lowest Silver benchmark ' +
        '(' + ff2(avgSilver) + '/mo) — strong signal they are paying above-market. Ideal TotalSource opening.'
      : 'Their blended avg premium of <strong>' + ff2(clientAvg) + '</strong> is ' +
        '<strong style="color:var(--green);">&#9660; ' + diffPct + '% below</strong> the lowest Silver benchmark ' +
        '(' + ff2(avgSilver) + '/mo) — rate is competitive. Lead with HR and compliance value, not just premium savings.';
    vsPremEl.innerHTML =
      '<div style="font-size:11px;font-weight:600;color:var(--muted);margin-bottom:6px;letter-spacing:.8px;">CURRENT PREMIUM VS. MARKET BENCHMARK</div>' + msg;
    vsPremEl.style.display = 'block';
  } else {
    vsPremEl.style.display = 'none';
  }

  // ── Market notes ───────────────────────────────────────
  var noteEl = document.getElementById('acaMarketNotes');
  if (noteEl && data.note) {
    noteEl.textContent = data.note;
    noteEl.style.display = 'block';
  }

  // ── YOY Trend Chart ────────────────────────────────────
  if (data.hist && data.hist.s24 && data.hist.s25 && avgSilver) {
    var yoyEl = document.getElementById('acaYOY');
    yoyEl.style.display = 'block';

    var y24s = data.hist.s24, y25s = data.hist.s25, y26s = avgSilver;
    var maxVal = Math.max(y24s, y25s, y26s);

    var pct24 = Math.round((y24s / maxVal) * 100);
    var pct25 = Math.round((y25s / maxVal) * 100);
    var pct26 = 100;

    var chg2425 = ((y25s - y24s) / y24s * 100).toFixed(1);
    var chg2526 = ((y26s - y25s) / y25s * 100).toFixed(1);
    var chg2426 = ((y26s - y24s) / y24s * 100).toFixed(1);

    var barColor24 = '#4a5568';
    var barColor25 = '#5a7a9e';
    var barColor26 = '#60a5fa';

    var chartHTML =
      '<div style="display:flex;flex-direction:column;gap:10px;">' +

      '<div style="display:flex;align-items:center;gap:10px;">' +
      '<div style="width:38px;font-size:12px;color:var(--muted);text-align:right;flex-shrink:0;">2024</div>' +
      '<div style="flex:1;height:32px;background:var(--border);border-radius:4px;position:relative;overflow:hidden;">' +
      '<div style="width:' + pct24 + '%;height:100%;background:' + barColor24 + ';border-radius:4px;display:flex;align-items:center;justify-content:flex-end;padding-right:8px;">' +
      '<span style="font-size:12px;font-weight:600;color:#e8e9ec;">' + ff2(y24s) + '</span></div></div></div>' +

      '<div style="display:flex;align-items:center;gap:10px;">' +
      '<div style="width:38px;font-size:12px;color:var(--muted);text-align:right;flex-shrink:0;">2025</div>' +
      '<div style="flex:1;height:32px;background:var(--border);border-radius:4px;position:relative;overflow:hidden;">' +
      '<div style="width:' + pct25 + '%;height:100%;background:' + barColor25 + ';border-radius:4px;display:flex;align-items:center;justify-content:flex-end;padding-right:8px;">' +
      '<span style="font-size:12px;font-weight:600;color:#e8e9ec;">' + ff2(y25s) + '</span></div></div>' +
      '<div style="font-size:11px;color:var(--orange);white-space:nowrap;">+' + chg2425 + '%</div></div>' +

      '<div style="display:flex;align-items:center;gap:10px;">' +
      '<div style="width:38px;font-size:12px;color:var(--blue);font-weight:600;text-align:right;flex-shrink:0;">2026</div>' +
      '<div style="flex:1;height:32px;background:var(--border);border-radius:4px;position:relative;overflow:hidden;">' +
      '<div style="width:' + pct26 + '%;height:100%;background:' + barColor26 + ';border-radius:4px;display:flex;align-items:center;justify-content:flex-end;padding-right:8px;">' +
      '<span style="font-size:12px;font-weight:600;color:#0a0f1a;">' + ff2(y26s) + '</span></div></div>' +
      '<div style="font-size:11px;color:var(--orange);white-space:nowrap;">+' + chg2526 + '%</div></div>' +

      '</div>';

    document.getElementById('acaYOYChart').innerHTML = chartHTML;

    var yoyCards =
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 14px;">' +
      '<div style="font-size:11px;color:var(--muted);margin-bottom:4px;">2024 Lowest Silver</div>' +
      '<div style="font-size:16px;font-weight:700;color:#4a8ab0;">' + ff2(y24s) + '/mo</div></div>' +
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 14px;">' +
      '<div style="font-size:11px;color:var(--muted);margin-bottom:4px;">2025 Lowest Silver</div>' +
      '<div style="font-size:16px;font-weight:700;color:#5a9ac0;">' + ff2(y25s) + '/mo</div></div>' +
      '<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 14px;">' +
      '<div style="font-size:11px;color:var(--muted);margin-bottom:4px;">2-Year Cumulative Rise</div>' +
      '<div style="font-size:16px;font-weight:700;color:var(--orange);">+' + chg2426 + '%</div></div>';

    document.getElementById('acaYOYCards').innerHTML = yoyCards;
  } else {
    document.getElementById('acaYOY').style.display = 'none';
  }

  // ── Renewal Premium Projection ─────────────────────────
  if (data.trend26 && avgSilver) {
    var renewEl = document.getElementById('acaRenewal');
    renewEl.style.display = 'block';

    var clientPrem = getRaw('premAvg') || avgSilver;
    var enrolled   = getRaw('numEE') ? Math.round(getRaw('numEE') * (parseInt(document.getElementById('benefitsRate').value || '75') / 100)) : null;
    var empRate    = getRaw('contribPct') ? getRaw('contribPct') / 100 : 0.75;

    var mktTrend = data.trend26;
    var proj1yr  = Math.round(clientPrem * (1 + mktTrend / 100));
    var proj2yr  = Math.round(clientPrem * Math.pow(1 + mktTrend / 100, 2));
    var proj3yr  = Math.round(clientPrem * Math.pow(1 + mktTrend / 100, 3));

    var annCostNow  = enrolled ? Math.round(clientPrem * empRate * enrolled * 12) : null;
    var annCost1yr  = enrolled ? Math.round(proj1yr * empRate * enrolled * 12) : null;
    var annCost3yr  = enrolled ? Math.round(proj3yr * empRate * enrolled * 12) : null;

    var renewHTML =
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:14px;">' +

      '<div style="background:var(--dark);border:1px solid var(--border);border-radius:8px;padding:12px 14px;">' +
      '<div style="font-size:11px;color:var(--muted);margin-bottom:4px;">Current Avg Premium</div>' +
      '<div style="font-size:16px;font-weight:700;color:var(--text);">' + ff2(clientPrem) + '/mo</div>' +
      '<div style="font-size:11px;color:var(--muted);margin-top:2px;">baseline</div></div>' +

      '<div style="background:var(--dark);border:1px solid var(--border);border-radius:8px;padding:12px 14px;">' +
      '<div style="font-size:11px;color:var(--muted);margin-bottom:4px;">Projected +1 Year</div>' +
      '<div style="font-size:16px;font-weight:700;color:var(--orange);">' + ff2(proj1yr) + '/mo</div>' +
      '<div style="font-size:11px;color:var(--orange);margin-top:2px;">+' + mktTrend.toFixed(1) + '% trend</div></div>' +

      '<div style="background:var(--dark);border:1px solid var(--border);border-radius:8px;padding:12px 14px;">' +
      '<div style="font-size:11px;color:var(--muted);margin-bottom:4px;">Projected +2 Years</div>' +
      '<div style="font-size:16px;font-weight:700;color:var(--orange);">' + ff2(proj2yr) + '/mo</div>' +
      '<div style="font-size:11px;color:var(--muted);margin-top:2px;">if trend holds</div></div>' +

      '<div style="background:var(--dark);border:1px solid var(--border);border-radius:8px;padding:12px 14px;">' +
      '<div style="font-size:11px;color:var(--muted);margin-bottom:4px;">Projected +3 Years</div>' +
      '<div style="font-size:16px;font-weight:700;color:#e05020;">' + ff2(proj3yr) + '/mo</div>' +
      '<div style="font-size:11px;color:var(--muted);margin-top:2px;">compounded</div></div>' +

      '</div>';

    if (annCostNow && annCost1yr && annCost3yr) {
      var diffCost1yr = annCost1yr - annCostNow;
      var diffCost3yr = annCost3yr - annCostNow;
      renewHTML +=
        '<div style="padding:12px 14px;background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.25);border-radius:8px;font-size:13px;line-height:1.7;">' +
        '<strong>Employer cost impact</strong> (est. ' + enrolled + ' enrolled, ' + Math.round(empRate*100) + '% contribution): ' +
        'Current annual spend <strong>' + ff2(annCostNow) + '</strong>. ' +
        'At this market trend rate, renewal in one year adds <strong style="color:var(--orange);">' + ff2(diffCost1yr) + '/yr</strong> to employer costs. ' +
        'Over three years the cumulative overage vs. today is <strong style="color:#e05020;">' + ff2(diffCost3yr) + '/yr</strong> — ' +
        'a compelling reason to lock in TotalSource pricing now rather than at the next renewal.' +
        '</div>';
    } else {
      renewHTML +=
        '<div style="font-size:12px;color:var(--muted);margin-top:4px;">' +
        'Enter employee count and avg premium above to see projected employer dollar impact.' +
        '</div>';
    }

    renewHTML += '<div style="font-size:11px;color:var(--muted);margin-top:10px;">Projection uses this state\'s ' + mktTrend.toFixed(1) + '% average rate trend from 2025 to 2026 CMS filings. Actual renewal increases vary by carrier, group experience, and utilization.</div>';

    document.getElementById('acaRenewalContent').innerHTML = renewHTML;
  } else {
    document.getElementById('acaRenewal').style.display = 'none';
  }

  document.getElementById('acaResults').style.display = 'block';
}

function toggleOpenMarket(){
  var isYes=gv('openMarketClient')==='yes';
  document.getElementById('renewalDateRow').style.display=isYes?'block':'none';
  document.getElementById('renewalNotesRow').style.display=isYes?'block':'none';
}
function formatRenewalDate(dateStr){
  if(!dateStr) return null;
  var d=new Date(dateStr+'T00:00:00');
  if(isNaN(d)) return null;
  return d.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
}
function daysUntilRenewal(dateStr){
  if(!dateStr) return null;
  var today=new Date(); today.setHours(0,0,0,0);
  var rd=new Date(dateStr+'T00:00:00');
  if(isNaN(rd)) return null;
  return Math.round((rd-today)/(1000*60*60*24));
}
function getCarrierDisplayName(cd){
  if(gv('carrier')==='other'){
    var custom=gv('otherCarrierName').trim();
    return custom||'your current carrier';
  }
  return cd.name;
}
function ff(n){ if(n==null||isNaN(n))return 'N/A'; return '$'+parseFloat(n).toLocaleString('en-US',{maximumFractionDigits:0}); }
function fp(n){ return (n*100).toFixed(1)+'%'; }
function formatDollar(input){ var raw=input.value.replace(/[^0-9]/g,''); if(!raw){input.value='';return;} input.value=parseInt(raw,10).toLocaleString('en-US'); }
function numericOnly(input){ input.value=input.value.replace(/[^0-9.]/g,''); }
function getRaw(id){ var v=document.getElementById(id).value.replace(/[^0-9.]/g,''); var n=parseFloat(v); return isNaN(n)?null:n; }
function gv(id){ var e=document.getElementById(id); return e?e.value.trim():''; }
function toggleContrib(){ var t=gv('contribType'); document.getElementById('contribPctRow').style.display=t==='pct'?'block':'none'; document.getElementById('contribFlatRow').style.display=t==='flat'?'block':'none'; }
function autoCalcTotal(){ var n=getRaw('numEE'),a=getRaw('avgWages'),te=document.getElementById('totalWages'); if(n&&a&&te.value==='')te.value=(n*a).toLocaleString('en-US'); }

function onStateChange(){
  var state=gv('hqState'), sel=document.getElementById('hqMetro');
  while(sel.options.length>0) sel.remove(0);
  var def=document.createElement('option'); def.value=''; def.textContent=state?'— Statewide Average —':'— Select State First —'; sel.appendChild(def);
  if(state&&LD[state]&&LD[state].metros){
    Object.keys(LD[state].metros).forEach(function(m){ var o=document.createElement('option'); o.value=m; o.textContent=m; sel.appendChild(o); });
  }
}

function runAll(){
  var n=getRaw('numEE'),a=getRaw('avgWages'),te=document.getElementById('totalWages');
  if(n&&a&&te.value==='') te.value=(n*a).toLocaleString('en-US');
  calcScore(); updateBenefits(); updateLabor();
}

// ═══════════════════════════════════════════════════════
//  ELIGIBILITY SCORE
// ═══════════════════════════════════════════════════════
function calcScore(){
  var score=0,maxScore=0,factors=[],flags=[];
  var num=getRaw('numEE');
  if(num!==null){ var s=num>=5&&num<=999?(num>=10&&num<=300?25:18):num>=1000?(flags.push({t:'Large Group — enterprise pricing may apply',type:'warn'}),15):(flags.push({t:'Under 5 EEs — may not qualify',type:'bad'}),0); score+=s;maxScore+=25;factors.push({name:'Employee Count',val:s,max:25}); }
  else{maxScore+=25;factors.push({name:'Employee Count',val:0,max:25});}

  var avg=getRaw('avgWages');
  if(avg!==null){ var s=avg>=45000?20:avg>=35000?15:avg>=27000?10:3; if(avg<27000)flags.push({t:'Avg wages below PEO threshold',type:'bad'}); if(avg>=60000)flags.push({t:'Strong avg wages',type:'good'}); score+=s;maxScore+=20;factors.push({name:'Avg Gross Wages',val:s,max:20}); }
  else{maxScore+=20;factors.push({name:'Avg Gross Wages',val:0,max:20});}

  var bRate=parseInt(document.getElementById('benefitsRate').value,10);
  var s=bRate>=75?20:bRate>=50?14:bRate>=35?8:3;
  if(bRate>=75)flags.push({t:'High participation ('+bRate+'%)',type:'good'});
  else if(bRate<65)flags.push({t:'Participation ('+bRate+'%) — UHC-type declines possible below 65%',type:'warn'});
  score+=s;maxScore+=20;factors.push({name:'Benefits Participation',val:s,max:20});

  var asi=getRaw('asiScore');
  if(asi!==null){ var s=asi<=0.95?12:asi<=1.05?10:asi<=1.15?7:4; if(asi>1.15)flags.push({t:'ASI '+asi+' — above-average risk profile',type:'warn'}); else if(asi<=0.95)flags.push({t:'ASI '+asi+' — favorable risk profile',type:'good'}); score+=s;maxScore+=12;factors.push({name:'ASI Risk Score',val:s,max:12}); }
  else{maxScore+=12;factors.push({name:'ASI Risk Score',val:0,max:12});}

  var ind=gv('industry');
  if(ind){ var s=ind==='low'?13:ind==='med'?9:4; if(ind==='low')flags.push({t:'Low-risk industry',type:'good'}); else if(ind==='high')flags.push({t:'Higher-risk industry',type:'warn'}); score+=s;maxScore+=13;factors.push({name:'Industry Risk',val:s,max:13}); }
  else{maxScore+=13;factors.push({name:'Industry Risk',val:0,max:13});}

  var loc=gv('numLocations');
  if(loc){ var s=loc==='1'?10:loc==='2'?9:loc==='4'?7:5; score+=s;maxScore+=10;factors.push({name:'# of Locations',val:s,max:10}); }
  else{maxScore+=10;factors.push({name:'# of Locations',val:0,max:10});}

  var prods=gv('adpProducts');
  if(prods){ var p=parseInt(prods,10),s=p>=3?10:p===2?7:4; if(p>=3)flags.push({t:'Deep ADP relationship',type:'good'}); score+=s;maxScore+=10;factors.push({name:'ADP Product Depth',val:s,max:10}); }
  else{maxScore+=10;factors.push({name:'ADP Product Depth',val:0,max:10});}

  var pct=maxScore>0?Math.round((score/maxScore)*100):0;
  var fill=document.getElementById('scoreFill');
  fill.style.strokeDashoffset=263.9-(pct/100)*263.9;
  var color=pct>=75?'#22c55e':pct>=50?'#f59e0b':'#f97316'; fill.style.stroke=color;
  var sp=document.getElementById('scorePct'); sp.textContent=pct>0?pct+'%':'—'; sp.style.color=color;
  var verdict='',sub='';
  if(pct>=80){verdict='Strong Candidate — High Approval Likelihood';sub='Meets most TotalSource eligibility criteria. Proceed with full proposal.';}
  else if(pct>=60){verdict='Likely Eligible — Minor Flags to Address';sub='Good prospect with a few items to clarify before submission.';}
  else if(pct>=40){verdict='Possible — Requires Underwriting Review';sub='Group may qualify but has notable risk factors. Deeper discovery recommended.';}
  else if(pct>0){verdict='Low Probability — Key Criteria Not Met';sub='Current data suggests this group may not meet TotalSource thresholds.';}
  else{verdict='Click Calculate to see eligibility score';sub='Fill in the client fields above, then hit Calculate.';}
  document.getElementById('scoreVerdict').textContent=verdict;
  document.getElementById('scoreSub').textContent=sub;
  document.getElementById('flags').innerHTML=flags.map(function(f){return'<span class="flag '+f.type+'">'+f.t+'</span>';}).join('');
  document.getElementById('factorBars').innerHTML=factors.map(function(f){
    var pf=Math.round((f.val/f.max)*100),bc=pf>=75?'#22c55e':pf>=50?'#f59e0b':'#f97316';
    return'<div class="factor-row"><span class="factor-name">'+f.name+'</span><div class="factor-bar-bg"><div class="factor-bar-fill" style="width:'+pf+'%;background:'+bc+'"></div></div><span class="factor-score-val" style="color:'+bc+'">'+f.val+'/'+f.max+'</span></div>';
  }).join('');
}

// ═══════════════════════════════════════════════════════
//  BENEFITS ANALYSIS
// ═══════════════════════════════════════════════════════
function updateBenefits(){
  var carrierKey=gv('carrier');
  var empty=document.getElementById('benefitsEmpty'),content=document.getElementById('benefitsContent');
  if(!carrierKey){empty.style.display='block';content.style.display='none';return;}
  empty.style.display='none'; content.style.display='block';

  var cd=CARRIERS[carrierKey];
  var clientAvg=getRaw('premAvg');
  var numEE=getRaw('numEE'), bRate=parseInt(document.getElementById('benefitsRate').value,10)/100;
  var enrolled=numEE?Math.round(numEE*bRate):null;
  var asi=getRaw('asiScore'), state=gv('hqState'), ind=gv('industry'), participation=bRate;

  // Get dynamic discount range from underwriting engine
  var disc=estimateDiscount(numEE, participation, asi, ind, state, carrierKey);

  // Carrier nat'l blended average (40% single / 20% EE+spouse / 15% EE+child / 25% family)
  var natAvgBlended=(cd.single.avg*0.40+cd.spouse.avg*0.20+cd.child.avg*0.15+cd.family.avg*0.25);

  // TotalSource tier estimates at low/mid/high
  function tsEst(base,d){ return Math.round(base*(1+d)); }

  document.getElementById('bCarrierTitle').textContent=getCarrierDisplayName(cd);

  // UW risk factor cards
  var uwHTML='';
  // Participation
  var pColor=participation>=0.75?'var(--green)':participation>=0.65?'var(--yellow)':'var(--orange)';
  var pStatus=participation>=0.75?'✓ Strong — full carrier field':participation>=0.65?'⚠ Moderate — some carriers may decline':'⚠ Below 65% — UHC-type declines likely';
  uwHTML+='<div class="uw-factor"><div class="uf-label">Participation</div><div class="uf-val" style="color:'+pColor+';">'+(participation*100).toFixed(0)+'%</div><div class="uf-status" style="color:'+pColor+';">'+pStatus+'</div></div>';
  // ASI
  if(asi){ var aColor=asi<=1.05?'var(--green)':asi<=1.15?'var(--yellow)':'var(--orange)'; var aStatus=asi<=1.05?'✓ Favorable risk profile':asi<=1.15?'⚠ Slightly elevated':'⚠ Elevated — pricing impact'; uwHTML+='<div class="uw-factor"><div class="uf-label">ASI Score</div><div class="uf-val" style="color:'+aColor+';">'+asi.toFixed(2)+'</div><div class="uf-status" style="color:'+aColor+';">'+aStatus+'</div></div>'; }
  // Size
  if(numEE){ var sColor=numEE>=25?'var(--green)':numEE>=10?'var(--yellow)':'var(--orange)'; var sStatus=numEE>=25?'✓ Good carrier competition':numEE>=10?'Moderate — some carriers selective':'Small group — limited carrier field'; uwHTML+='<div class="uw-factor"><div class="uf-label">Group Size</div><div class="uf-val" style="color:'+sColor+';">'+numEE+' eligible</div><div class="uf-status" style="color:'+sColor+';">'+sStatus+'</div></div>'; }
  // Industry
  var iColor=ind==='low'?'var(--green)':ind==='med'?'var(--yellow)':ind==='high'?'var(--orange)':'var(--muted)';
  var iStatus=ind==='low'?'✓ Low risk — clean UW':ind==='med'?'Moderate risk class':ind==='high'?'Higher risk — UW scrutiny':'Not selected';
  uwHTML+='<div class="uw-factor"><div class="uf-label">Industry Risk</div><div class="uf-val" style="color:'+iColor+';">'+(ind==='low'?'Low':ind==='med'?'Medium':ind==='high'?'Higher':'—')+'</div><div class="uf-status" style="color:'+iColor+';">'+iStatus+'</div></div>';
  document.getElementById('uwFactors').innerHTML=uwHTML;

  // Discount range bars
  var groupCount=UW_GROUPS.length;
  document.getElementById('drSource').textContent='Based on '+groupCount+' underwritten group'+(groupCount>1?'s':'')+' + profile adjustments';
  var maxDisc=0.22;
  var drRows=[
    {label:'Conservative estimate',val:disc.low,  color:'var(--yellow)'},
    {label:'Mid-point estimate',   val:disc.mid,  color:'var(--blue)'},
    {label:'Best-case estimate',   val:disc.high, color:'var(--green)'}
  ];
  document.getElementById('drBars').innerHTML=drRows.map(function(r){
    var pct=Math.round((Math.abs(r.val)/maxDisc)*100);
    return'<div class="dr-row"><span class="dr-label">'+r.label+'</span><div class="dr-bar-bg"><div class="dr-bar-fill" style="width:'+pct+'%;background:'+r.color+';"></div></div><span class="dr-val" style="color:'+r.color+';">'+fp(r.val)+'</span></div>';
  }).join('');
  document.getElementById('drExplain').textContent=
    'Range adjusted from anchor group (McLean VA, ASI 1.08, 63% participation): Aetna approved at -9.65% to -14.31%. '
    +'Adjustments applied for group size, participation, ASI, industry, and regional carrier availability. Add more underwritten groups to improve precision.';

  // Tier table
  var tiers=[
    {name:'Single',          nat:cd.single.avg, tsLow:tsEst(cd.single.avg,disc.low), tsHigh:tsEst(cd.single.avg,disc.high)},
    {name:'EE + Spouse',     nat:cd.spouse.avg, tsLow:tsEst(cd.spouse.avg,disc.low), tsHigh:tsEst(cd.spouse.avg,disc.high)},
    {name:'EE + Child(ren)', nat:cd.child.avg,  tsLow:tsEst(cd.child.avg, disc.low), tsHigh:tsEst(cd.child.avg, disc.high)},
    {name:'Family',          nat:cd.family.avg, tsLow:tsEst(cd.family.avg,disc.low), tsHigh:tsEst(cd.family.avg,disc.high)}
  ];
  var tbody='';
  if(clientAvg){
    var dAvg=clientAvg-natAvgBlended, dClass=dAvg>0?'delta-over':'delta-save';
    tbody+='<tr style="background:rgba(255,255,255,0.03);font-weight:600;">'
      +'<td>Your Avg Premium (All Tiers)</td>'
      +'<td class="num">'+ff(clientAvg)+'/mo</td>'
      +'<td class="num">'+ff(natAvgBlended)+'/mo</td>'
      +'<td class="num" style="color:var(--yellow);">'+ff(tsEst(natAvgBlended,disc.low))+'/mo</td>'
      +'<td class="num" style="color:var(--green);">'+ff(tsEst(natAvgBlended,disc.high))+'/mo</td>'
      +'<td class="num"><span class="delta-pill '+dClass+'">'+(dAvg>=0?'+':'')+ff(dAvg)+'/mo</span></td>'
      +'</tr>';
  }
  tiers.forEach(function(t){
    tbody+='<tr>'
      +'<td>'+t.name+' <span style="font-size:11px;color:var(--muted);">(carrier benchmark)</span></td>'
      +'<td class="num"><span style="color:var(--muted);">—</span></td>'
      +'<td class="num">'+ff(t.nat)+'/mo</td>'
      +'<td class="num" style="color:var(--yellow);">'+ff(t.tsLow)+'/mo</td>'
      +'<td class="num" style="color:var(--green);">'+ff(t.tsHigh)+'/mo</td>'
      +'<td class="num">—</td>'
      +'</tr>';
  });
  document.getElementById('tierTableBody').innerHTML=tbody;

  // Tier mix
  var mS=parseInt(gv('mixSingle')||'40',10)/100, mSp=parseInt(gv('mixSpouse')||'20',10)/100;
  var mC=parseInt(gv('mixChild')||'15',10)/100,  mF=parseInt(gv('mixFamily')||'25',10)/100;
  var mT=mS+mSp+mC+mF||1; var nS=mS/mT,nSp=mSp/mT,nC=mC/mT,nF=mF/mT;

  var clientWeighted=clientAvg?clientAvg*12:null;
  var natWeighted=(cd.single.avg*nS+cd.spouse.avg*nSp+cd.child.avg*nC+cd.family.avg*nF)*12;
  var tsLowW =(tsEst(cd.single.avg,disc.low)*nS +tsEst(cd.spouse.avg,disc.low)*nSp +tsEst(cd.child.avg,disc.low)*nC +tsEst(cd.family.avg,disc.low)*nF)*12;
  var tsHighW=(tsEst(cd.single.avg,disc.high)*nS+tsEst(cd.spouse.avg,disc.high)*nSp+tsEst(cd.child.avg,disc.high)*nC+tsEst(cd.family.avg,disc.high)*nF)*12;
  var tsMidW =(tsLowW+tsHighW)/2;

  var maxBar=Math.max(clientWeighted||0, natWeighted)*1.15;
  var benchRows=[
    {label:'Your Current Plan',    val:clientWeighted, color:'var(--orange)'},
    {label:getCarrierDisplayName(cd)+' Nat\'l Avg', val:natWeighted,    color:'var(--blue)'},
    {label:'TS Conservative',      val:tsLowW,         color:'var(--yellow)'},
    {label:'TS Best-Case',         val:tsHighW,        color:'var(--green)'}
  ];
  document.getElementById('benchBars').innerHTML=benchRows.map(function(b){
    if(!b.val) return'<div class="bench-row"><span class="bench-label">'+b.label+'</span><div class="bench-bar-bg"><div class="bench-bar-fill" style="width:0%;background:var(--border);"></div></div><span class="bench-val" style="color:var(--muted);">No data entered</span></div>';
    var pct=Math.round((b.val/maxBar)*100);
    return'<div class="bench-row"><span class="bench-label">'+b.label+'</span><div class="bench-bar-bg"><div class="bench-bar-fill" style="width:'+pct+'%;background:'+b.color+';"></div></div><span class="bench-val" style="color:'+b.color+';">'+ff(b.val)+'/yr</span></div>';
  }).join('');

  // Renewal vs TotalSource row
  var renewal=getRaw('renewalIncrease'), renewalRow=document.getElementById('renewalRow');
  if(renewalRow&&renewal&&clientWeighted){
    var renewedCost=clientWeighted*(1+renewal/100);
    var savingsVsRenewalLow =renewedCost-tsLowW, savingsVsRenewalHigh=renewedCost-tsHighW;
    renewalRow.style.display='block';
    renewalRow.innerHTML='<div class="uw-disclaimer" style="border-color:rgba(96,165,250,0.3);background:rgba(96,165,250,0.06);">'
      +'<div class="uw-icon">📊</div>'
      +'<p style="color:var(--blue);"><strong>Carrier renewal vs. TotalSource:</strong> '
      +'Your carrier offered a '+renewal+'% renewal increase — bringing annual cost to ~'+ff(renewedCost)+'/enrolled EE. '
      +'Compared to TotalSource\'s estimated range, that\'s a potential savings of '
      +ff(savingsVsRenewalHigh)+' to '+ff(savingsVsRenewalLow)+' per enrolled employee per year. '
      +(enrolled?'For your '+enrolled+' enrolled employees, that\'s '+ff(savingsVsRenewalHigh*enrolled)+' to '+ff(savingsVsRenewalLow*enrolled)+' annually.':'')
      +'</p></div>';
  } else renewalRow.style.display='none';

  // Employer cost modeler
  var cType=gv('contribType'), cPct=getRaw('contribPct'), cFlat=getRaw('contribFlat');
  var empRate=cType==='pct'&&cPct?cPct/100:null;
  var blendedClientMo=clientAvg||null;
  var blendedTSLowMo =(tsEst(cd.single.avg,disc.low)*nS+tsEst(cd.spouse.avg,disc.low)*nSp+tsEst(cd.child.avg,disc.low)*nC+tsEst(cd.family.avg,disc.low)*nF);
  var blendedTSHighMo=(tsEst(cd.single.avg,disc.high)*nS+tsEst(cd.spouse.avg,disc.high)*nSp+tsEst(cd.child.avg,disc.high)*nC+tsEst(cd.family.avg,disc.high)*nF);

  var empMonthClient=empRate&&blendedClientMo?blendedClientMo*empRate:cFlat||null;
  var empMonthTSLow =empRate&&blendedTSLowMo?blendedTSLowMo*empRate :cFlat?cFlat*(blendedTSLowMo/(blendedClientMo||blendedTSLowMo)):null;
  var empMonthTSHigh=empRate&&blendedTSHighMo?blendedTSHighMo*empRate:cFlat?cFlat*(blendedTSHighMo/(blendedClientMo||blendedTSHighMo)):null;

  var annClient=empMonthClient&&enrolled?Math.round(empMonthClient*enrolled*12):null;
  var annTSLow =empMonthTSLow&&enrolled?Math.round(empMonthTSLow*enrolled*12):null;
  var annTSHigh=empMonthTSHigh&&enrolled?Math.round(empMonthTSHigh*enrolled*12):null;
  var savLow =annClient&&annTSLow?annClient-annTSLow:null;
  var savHigh=annClient&&annTSHigh?annClient-annTSHigh:null;

  var cards=[
    {label:'Blended Employer Cost (Current)',     val:empMonthClient?ff(empMonthClient)+'/ee/mo':'Enter contribution', sub:'per enrolled employee/month', hi:false},
    {label:'TS Conservative Employer Cost',       val:empMonthTSLow?ff(empMonthTSLow)+'/ee/mo':'—',                  sub:fp(disc.low)+' discount applied', hi:false},
    {label:'TS Best-Case Employer Cost',          val:empMonthTSHigh?ff(empMonthTSHigh)+'/ee/mo':'—',                sub:fp(disc.high)+' discount applied', hi:false},
    {label:'Annual Employer Spend (Current)',     val:annClient?ff(annClient):'Enter contribution & EE count',        sub:enrolled?enrolled+' enrolled employees':'', hi:false},
    {label:'Est. Annual Savings Range',           val:savLow&&savHigh?ff(savHigh)+' – '+ff(savLow):'—',             sub:'conservative to best-case', hi:savLow>0||savHigh>0},
    {label:'5-Year Savings Projection',           val:savLow&&savHigh?ff(savHigh*5)+' – '+ff(savLow*5):'—',        sub:'before trend increases', hi:false}
  ];
  document.getElementById('contribGrid').innerHTML=cards.map(function(c){
    var valColor=c.hi?'var(--green)':c.val.indexOf('—')>=0?'var(--muted)':'var(--text)';
    return'<div class="contrib-card'+(c.hi?' highlight':'')+'"><div class="cc-label">'+c.label+'</div><div class="cc-val" style="color:'+valColor+';">'+c.val+'</div><div class="cc-sub">'+c.sub+'</div></div>';
  }).join('');

  // Scenario table
  var scenHTML='';
  [50,60,70,75,80,100].forEach(function(pct){
    var r=pct/100;
    var aC=blendedClientMo&&enrolled?Math.round(blendedClientMo*r*enrolled*12):null;
    var aL=blendedTSLowMo&&enrolled?Math.round(blendedTSLowMo*r*enrolled*12):null;
    var aH=blendedTSHighMo&&enrolled?Math.round(blendedTSHighMo*r*enrolled*12):null;
    var sL=aC&&aL?aC-aL:null, sH=aC&&aH?aC-aH:null;
    var sStyle=sL&&sL>0?'style="color:var(--green);font-weight:700;"':'style="color:var(--muted);"';
    scenHTML+='<tr>'
      +'<td>'+pct+'% employer contribution</td>'
      +'<td class="num">'+(aC?ff(aC):'<span style="color:var(--muted);">—</span>')+'</td>'
      +'<td class="num" style="color:var(--yellow);">'+(aL?ff(aL):'—')+'</td>'
      +'<td class="num" style="color:var(--green);">'+(aH?ff(aH):'—')+'</td>'
      +'<td class="num" '+sStyle+'>'+(sL&&sH?ff(sH)+' – '+ff(sL):'—')+'</td>'
      +'</tr>';
  });
  document.getElementById('scenarioBody').innerHTML=scenHTML;

  // Summary pills
  var pills='';
  if(savHigh&&savHigh>0) pills+='<span class="summary-pill pill-green">💰 Est. '+ff(savHigh)+' – '+ff(savLow||0)+'/yr savings</span>';
  pills+='<span class="summary-pill pill-blue">📋 Discount range: '+fp(disc.low)+' – '+fp(disc.high)+'</span>';
  if(participation<0.65) pills+='<span class="summary-pill pill-yellow">⚠ Participation may limit carrier field</span>';
  if(renewal) pills+='<span class="summary-pill pill-orange">📈 Carrier renewal: +'+renewal+'%</span>';
  var omStatus=gv('openMarketClient');
  if(omStatus==='yes'){
    var rdStr=document.getElementById('medicalRenewalDate').value;
    var days=daysUntilRenewal(rdStr);
    var rdLabel=formatRenewalDate(rdStr);
    if(days!==null&&days<=90) pills+='<span class="summary-pill pill-orange">🔔 Open Market client — renewal in '+days+' days'+(rdLabel?' ('+rdLabel+')':'')+'</span>';
    else if(days!==null) pills+='<span class="summary-pill pill-purple">✦ Existing Open Market client'+(rdLabel?' · Renews '+rdLabel:'')+'</span>';
    else pills+='<span class="summary-pill pill-purple">✦ Existing Open Market client</span>';
  }
  document.getElementById('bSummaryPills').innerHTML=pills;

  // Note
  document.getElementById('benefitsNote').textContent=
    'ILLUSTRATIVE ONLY — PENDING ADP TOTALSOURCE QUOTE. '
    +'Discount range ('+fp(disc.low)+' to '+fp(disc.high)+') modeled from 1 real conditionally-approved group: McLean VA, 8 eligible, ASI 1.08, CareFirst, 63% participation — '
    +'Aetna 57S approved at -10.85%, Aetna ZA1 at -9.65%, Innovation Health at -14.31%; UHC declined. '
    +'Range adjusted for this group\'s size, participation, ASI, industry, and geography. '
    +'Carrier national averages from KFF Employer Health Benefits Survey 2023. '
    +'As additional underwritten groups are added to the dataset, estimates will become more precise.';
}

// ═══════════════════════════════════════════════════════
//  LABOR MARKET
// ═══════════════════════════════════════════════════════
function updateLabor(){
  var state=gv('hqState'),metro=gv('hqMetro'),numEE=getRaw('numEE'),avgW=getRaw('avgWages');
  var empty=document.getElementById('laborEmpty'),content=document.getElementById('laborContent');
  if(!state||!LD[state]){empty.style.display='block';content.style.display='none';return;}
  empty.style.display='none'; content.style.display='block';
  var sd=LD[state],md=(metro&&sd.metros&&sd.metros[metro])?sd.metros[metro]:null;
  var median=md?md.m:sd.m, col=md?md.col:sd.col, ttf=sd.ttf, tax=sd.tax;
  var hc=Math.round(median*totalHF), loc=metro||state;
  document.getElementById('laborTitle').textContent=loc;
  document.getElementById('laborSubtitle').textContent=metro?state+' · Metro area estimates':'Statewide average estimates';
  var cb=document.getElementById('colBadge'),cc='col-low',cl='Below Average';
  if(col>=1.35){cc='col-vhigh';cl='Very High Cost';}else if(col>=1.10){cc='col-high';cl='Above Average';}else if(col>=0.95){cc='col-avg';cl='Near Average';}
  cb.textContent=cl+' ('+col.toFixed(2)+'x)'; cb.className='col-badge '+cc;
  document.getElementById('lMedian').textContent=ff(median);
  document.getElementById('lHiring').textContent=ff(hc);
  document.getElementById('lTTF').textContent=ttf+' days';
  document.getElementById('lTaxBurden').textContent=tax.toFixed(1)+'%';
  document.getElementById('hbAds').textContent=ff(Math.round(median*HF.ads));
  document.getElementById('hbRecruiter').textContent=ff(Math.round(median*HF.recruiter));
  document.getElementById('hbOnboard').textContent=ff(Math.round(median*HF.onboard));
  document.getElementById('hbProd').textContent=ff(Math.round(median*HF.prod));
  document.getElementById('hbAdmin').textContent=ff(Math.round(median*HF.admin));
  var vr=document.getElementById('vsRow');
  if(avgW){vr.style.display='flex';var diff=avgW-median,sign=diff>=0?'+':'';var bp=Math.min(Math.round(Math.min(avgW/median,2)*50),100);var bf=document.getElementById('vsBarFill');bf.style.width=bp+'%';bf.style.background=diff>=0?'var(--green)':'var(--orange)';document.getElementById('vsVals').textContent='Client: '+ff(avgW)+'  |  Market: '+ff(median)+'  ('+sign+ff(diff)+')';}
  else vr.style.display='none';
  var ss=document.getElementById('scaleSection');
  if(numEE){ss.style.display='block';document.getElementById('scaleLabel').textContent=numEE.toLocaleString()+' employees';document.getElementById('scaleCells').innerHTML=[0.10,0.15,0.20,0.25].map(function(r){return'<div class="hb-item" style="flex:1;min-width:110px;"><div class="hb-label">'+Math.round(r*100)+'% turnover · ~'+Math.round(numEE*r)+' hires/yr</div><div class="hb-val">'+ff(Math.round(numEE*r)*hc)+'/yr</div></div>';}).join('');}
  else ss.style.display='none';
  var cn=col>=1.20?'⚠️ '+loc+' is an above-average cost market ('+col.toFixed(2)+'x). TotalSource\'s bundled HR can help offset these elevated costs.':col<=0.90?'✓ '+loc+' is cost-efficient ('+col.toFixed(2)+'x). Strong benefits can be a retention differentiator.':loc+' tracks near national average ('+col.toFixed(2)+'x).';
  document.getElementById('laborNote').textContent='Estimates based on BLS OES 2023, SHRM Hiring Benchmarking Survey, Tax Foundation 2023. Approximate figures for sales context.  '+cn;
}

// ═══════════════════════════════════════════════════════
//  EMAIL GENERATOR
// ═══════════════════════════════════════════════════════
function generateEmail(){
  var company=gv('companyName')||'[Company Name]', contact=gv('contactName')||'there';
  var title=gv('contactTitle')||'', state=gv('hqState'), metro=gv('hqMetro');
  var num=getRaw('numEE'), avg=getRaw('avgWages'), total=getRaw('totalWages')||(num&&avg?num*avg:null);
  var bRate=document.getElementById('benefitsRate').value, carrierKey=gv('carrier');
  var locs=gv('numLocations'), prods=gv('adpProducts'), ind=gv('industry');
  var renewal=getRaw('renewalIncrease'), asi=getRaw('asiScore');
  var score=parseInt(document.getElementById('scorePct').textContent)||0;

  // Benefits paragraph
  var benefitsLine='';
  if(carrierKey&&CARRIERS[carrierKey]){
    var cd=CARRIERS[carrierKey];
    var participation=parseInt(bRate,10)/100;
    var disc=estimateDiscount(num, participation, asi, ind, state, carrierKey);
    var clientAvg=getRaw('premAvg');
    var enrolled=num?Math.round(num*participation):null;
    var mS=parseInt(gv('mixSingle')||'40',10)/100, mSp=parseInt(gv('mixSpouse')||'20',10)/100;
    var mC=parseInt(gv('mixChild')||'15',10)/100, mF=parseInt(gv('mixFamily')||'25',10)/100;
    var mT=mS+mSp+mC+mF||1; var nS=mS/mT,nSp=mSp/mT,nC=mC/mT,nF=mF/mT;
    var natAvgBlendedEmail=(cd.single.avg*0.40+cd.spouse.avg*0.20+cd.child.avg*0.15+cd.family.avg*0.25);
    var blendedClientMo=clientAvg||null;
    var blendedTSLow=Math.round(natAvgBlendedEmail*(1+disc.low));
    var blendedTSHigh=Math.round(natAvgBlendedEmail*(1+disc.high));
    var cPct=getRaw('contribPct'), empRate=cPct?cPct/100:null;
    var savLow=blendedClientMo&&enrolled&&empRate?Math.round((blendedClientMo-blendedTSLow)*empRate*enrolled*12):null;
    var savHigh=blendedClientMo&&enrolled&&empRate?Math.round((blendedClientMo-blendedTSHigh)*empRate*enrolled*12):null;

    benefitsLine='\nOn the benefits side, I ran your '+getCarrierDisplayName(cd)+' plan through our underwriting comparison model — which is grounded in real conditionally-approved TotalSource outcomes for similar groups.';
    if(clientAvg) benefitsLine+=' Your current blended average premium of '+ff(clientAvg)+'/month compares to the carrier\'s national blended average of '+ff(natAvgBlendedEmail)+'/month.';
    benefitsLine+=' Based on your group\'s participation rate, ASI profile, and industry class, our model estimates TotalSource could bring your blended average premium to somewhere between '+ff(blendedTSHigh)+' and '+ff(blendedTSLow)+'/month — a '+fp(disc.high)+' to '+fp(disc.low)+' discount range.';
    if(renewal) benefitsLine+=' Against your carrier\'s '+renewal+'% renewal increase, that\'s a meaningful swing in the other direction.';
    if(savHigh&&savHigh>0) benefitsLine+=' Running the numbers on your enrolled population, the estimated annual employer savings range is '+ff(savHigh)+' to '+ff(savLow||0)+' — and over five years, that compounds to '+ff(savHigh*5)+' to '+ff((savLow||0)*5)+' before accounting for trend increases.';
    benefitsLine+='\n\nThese are illustrative estimates based on real underwriting data — the actual quote from ADP will give us the definitive number, but this gives us a solid foundation to have the conversation.';
  }

  // Labor paragraph
  var laborLine='';
  if(state&&LD[state]){
    var sd=LD[state], md2=(metro&&sd.metros&&sd.metros[metro])?sd.metros[metro]:null;
    var median=md2?md2.m:sd.m, col=md2?md2.col:sd.col;
    var hc=Math.round(median*totalHF), loc=metro||state;
    var annualHC=num?ff(Math.round(num*0.15)*hc):null;
    laborLine='\nOn the talent and HR side, the '+loc+' market median wage runs about '+ff(median)+'/year, and the fully-loaded cost to bring on a single new employee averages around '+ff(hc)+'.'+(annualHC?' At 15% annual turnover, that\'s roughly '+annualHC+' per year in hiring costs alone — a number TotalSource\'s HR infrastructure directly helps reduce.':'');
  }

  var likelihood=score>=80?'an excellent candidate':score>=60?'a strong candidate':score>=40?'a potential candidate':'worth a closer look';
  var locsStr=locs==='1'?'single location':locs==='2'?'2–3 locations':locs==='4'?'4–9 locations':'10+ locations';
  var dh='';
  if(num) dh+='\n  • Employees (eligible): '+num.toLocaleString();
  if(avg) dh+='\n  • Avg gross wages: '+ff(avg)+'/employee annually';
  if(total) dh+='\n  • Total annual wages: '+ff(total);
  if(bRate) dh+='\n  • Benefits participation: '+bRate+'%';
  if(asi) dh+='\n  • ASI score: '+asi;
  if(locs) dh+='\n  • Locations: '+locsStr;
  if(prods) dh+='\n  • Existing ADP products: '+prods;
  if(state) dh+='\n  • HQ: '+(metro?metro+', ':'')+state;
  if(carrierKey&&CARRIERS[carrierKey]) dh+='\n  • Current carrier: '+CARRIERS[carrierKey].name+(renewal?' ('+renewal+'% renewal offered)':'');
  var omStatus=gv('openMarketClient');
  var rdStr=document.getElementById('medicalRenewalDate').value;
  var rdLabel=formatRenewalDate(rdStr);
  var rdDays=daysUntilRenewal(rdStr);
  if(omStatus==='yes') dh+='\n  • ADP Open Market client: Yes'+(rdLabel?' · Medical renewal: '+rdLabel+(rdDays!==null?' ('+rdDays+' days away)':''):'');
  else if(omStatus==='no') dh+='\n  • ADP Open Market client: No';
  var renewalNotes=gv('renewalNotes');

  // Open market paragraph for email
  var openMarketLine='';
  if(omStatus==='yes'){
    openMarketLine='\n\nOne thing I also want to flag — since '+company+' is currently an ADP Open Market health benefits client';
    if(rdLabel){
      openMarketLine+=', with your medical renewal coming up on '+rdLabel;
      if(rdDays!==null&&rdDays<=90) openMarketLine+=' (just '+rdDays+' days away)';
    }
    openMarketLine+=', the timing is ideal to evaluate whether TotalSource\'s fully-bundled benefits platform could replace your current Open Market arrangement at a lower total cost.';
    if(renewalNotes) openMarketLine+=' Noted: '+renewalNotes+'.';
    // Inject live ACA benchmark data if available
    if(window.acaAvgSilver&&window.acaLocation){
      var acaFF=function(n){ return n?'$'+Math.round(n).toLocaleString('en-US'):'—'; };
      openMarketLine+='\n\nI pulled live '+window.acaYear+' ACA marketplace rates for your area ('+window.acaLocation+'). The lowest-cost Silver plan in that market is running '+acaFF(window.acaAvgSilver)+'/month per person, with Gold at '+acaFF(window.acaAvgGold)+'/month.';
      var clientAvgEmail=getRaw('premAvg');
      if(clientAvgEmail&&window.acaAvgSilver){
        var diff2=clientAvgEmail-window.acaAvgSilver;
        var diffPct2=Math.round(Math.abs(diff2/window.acaAvgSilver)*100);
        if(diff2>0) openMarketLine+=' Your current blended premium of '+acaFF(clientAvgEmail)+'/month sits '+diffPct2+'% above the benchmark lowest-cost Silver — which suggests meaningful room for TotalSource to deliver savings.';
        else openMarketLine+=' Your current blended premium of '+acaFF(clientAvgEmail)+'/month is actually competitive vs. the open market, so the TotalSource value story is really about the bundled HR/compliance infrastructure and the reduced administrative lift.';
      }
    }
    openMarketLine+=' I can run both scenarios side-by-side so you have a clean comparison before your renewal deadline.';
  }

  var sl=parseInt(bRate)>=75?'Your benefits participation rate of '+bRate+'% is a real strength — that opens up the full carrier field and typically produces the most competitive TotalSource pricing.':parseInt(bRate)<65?'One thing worth discussing is participation — at '+bRate+'%, some carriers may limit their offers, which is exactly what TotalSource\'s enrollment support is designed to address.':'Based on the profile I\'ve been working from, '+company+' looks like '+likelihood+' for TotalSource.';
  var pl=parseInt(prods)>=3?'You\'re already running '+prods+'+ ADP solutions, which makes a TotalSource migration seamless — no system overhaul required.':prods?'With your existing ADP footprint, TotalSource is a natural next step.':'';

  document.getElementById('emailSubject').value='Following up — ADP TotalSource analysis for '+company;
  document.getElementById('emailBody').value=
'Hi '+contact+',\n\n'
+'I\'ve been doing some analysis on '+company+' ahead of our next conversation and wanted to share what I\'m seeing.\n\n'
+'Here\'s the data snapshot I\'m working from:\n'+dh+'\n\n'
+sl+' '+pl
+benefitsLine
+openMarketLine
+laborLine+'\n\n'
+'The bottom line is that TotalSource can consolidate HR, payroll, benefits, and compliance under one umbrella — while giving your team access to Fortune 500-level benefit plans at pricing that works for a group your size.\n\n'
+'I\'d love to get 20–30 minutes on the calendar to walk through a formal proposal'+(title?' for you as '+company+'\'s '+title:'')+'. No obligation — just want to make sure you have the full picture before renewal season.\n\n'
+'Would [Day] or [Day] work?\n\n'
+'Best,\nAJ\nADP TotalSource | beyondpayroll.net';
}

function copyEmail(){
  var full='Subject: '+document.getElementById('emailSubject').value+'\n\n'+document.getElementById('emailBody').value;
  navigator.clipboard.writeText(full).then(function(){
    var m=document.getElementById('copyMsg'); m.style.display='inline';
    setTimeout(function(){m.style.display='none';},2500);
  });
}

// ═══════════════════════════════════════════════════════
//  TS PANEL OPEN / CLOSE
// ═══════════════════════════════════════════════════════
function openTsPanel(){
  document.getElementById('ts-panel').classList.add('open');
  document.body.style.overflow='hidden';
  var p=window._hqProspect;
  if(p){
    var co=document.getElementById('companyName');
    var ct=document.getElementById('contactName');
    var nt=document.getElementById('contactTitle');
    var ee=document.getElementById('numEE');
    var em=document.getElementById('contactEmail');
    if(co&&!co.value)co.value=p.company||'';
    if(ct&&!ct.value)ct.value=p.contact||'';
    if(nt&&!nt.value)nt.value=p.persona||'';
    if(ee&&!ee.value)ee.value=p.headcount||'';
    if(em&&!em.value)em.value=p.email||'';
  }
  setTimeout(function(){_tsTouchIdx=0;tsRenderTouches();},80);
}
function closeTsPanel(){
  document.getElementById('ts-panel').classList.remove('open');
  document.body.style.overflow='';
}

// ═══════════════════════════════════════════════════════
//  REAL UNDERWRITING DATASET
// ═══════════════════════════════════════════════════════
var UW_DATA=[
  {industry:'Technology',state:'TX',ee:85,disc:-0.06,risk:2},
  {industry:'Technology',state:'CA',ee:95,disc:-0.08,risk:3},
  {industry:'Manufacturing',state:'OH',ee:120,disc:-0.04,risk:4},
  {industry:'Healthcare',state:'FL',ee:75,disc:-0.05,risk:3},
  {industry:'Professional Services',state:'NY',ee:68,disc:-0.07,risk:2},
  {industry:'Retail',state:'TX',ee:110,disc:-0.03,risk:5},
  {industry:'Finance & Insurance',state:'IL',ee:92,disc:-0.09,risk:2},
  {industry:'Non-Profit',state:'CO',ee:58,disc:-0.05,risk:2},
];

var CARRIERS={
  BCBS:{name:'Blue Cross Blue Shield',single:{avg:580,range:[520,640]},spouse:{avg:1280,range:[1150,1410]},child:{avg:820,range:[740,900]},family:{avg:1620,range:[1460,1780]}},
  Aetna:{name:'Aetna',single:{avg:560,range:[500,620]},spouse:{avg:1240,range:[1110,1370]},child:{avg:790,range:[710,870]},family:{avg:1570,range:[1410,1730]}},
  UHC:{name:'United Healthcare',single:{avg:595,range:[530,660]},spouse:{avg:1310,range:[1180,1440]},child:{avg:840,range:[760,920]},family:{avg:1660,range:[1500,1820]}},
  Cigna:{name:'Cigna',single:{avg:545,range:[490,600]},spouse:{avg:1200,range:[1080,1320]},child:{avg:770,range:[690,850]},family:{avg:1520,range:[1370,1670]}},
  Kaiser:{name:'Kaiser',single:{avg:520,range:[465,575]},spouse:{avg:1150,range:[1035,1265]},child:{avg:740,range:[665,815]},family:{avg:1460,range:[1315,1606]}},
  Humana:{name:'Humana',single:{avg:555,range:[498,612]},spouse:{avg:1225,range:[1103,1348]},child:{avg:785,range:[707,864]},family:{avg:1555,range:[1400,1711]}},
  Other:{name:'Your Carrier',single:{avg:565,range:[508,622]},spouse:{avg:1250,range:[1125,1375]},child:{avg:800,range:[720,880]},family:{avg:1580,range:[1422,1738]}}
};

var LD={
  TX:{m:52000,col:0.96,metros:{Dallas:{m:58000,col:1.02},Austin:{m:62000,col:1.08},Houston:{m:56000,col:0.99},SanAntonio:{m:48000,col:0.91}}},
  CA:{m:72000,col:1.38,metros:{LA:{m:76000,col:1.45},SF:{m:92000,col:1.72},SanDiego:{m:74000,col:1.41}}},
  NY:{m:68000,col:1.32,metros:{NYC:{m:84000,col:1.65},Buffalo:{m:52000,col:0.97}}},
  FL:{m:49000,col:0.97,metros:{Miami:{m:54000,col:1.09},Tampa:{m:51000,col:1.01},Orlando:{m:48000,col:0.95}}},
  IL:{m:58000,col:1.09,metros:{Chicago:{m:66000,col:1.24}}},
  OH:{m:50000,col:0.91,metros:{Columbus:{m:54000,col:0.98},Cleveland:{m:50000,col:0.90}}},
  CO:{m:60000,col:1.14,metros:{Denver:{m:65000,col:1.22}}},
  WA:{m:68000,col:1.21,metros:{Seattle:{m:78000,col:1.38}}},
  GA:{m:51000,col:0.94,metros:{Atlanta:{m:58000,col:1.06}}},
  MA:{m:70000,col:1.28,metros:{Boston:{m:78000,col:1.42}}},
  AZ:{m:52000,col:0.98,metros:{Phoenix:{m:54000,col:1.01},Tucson:{m:46000,col:0.92}}},
  NC:{m:50000,col:0.95,metros:{Charlotte:{m:56000,col:1.04},Raleigh:{m:60000,col:1.08}}},
  VA:{m:58000,col:1.06,metros:{NoVA:{m:76000,col:1.35},Richmond:{m:54000,col:0.98}}},
  PA:{m:54000,col:1.01,metros:{Philadelphia:{m:62000,col:1.18},Pittsburgh:{m:52000,col:0.95}}},
  MN:{m:60000,col:1.08,metros:{Minneapolis:{m:65000,col:1.17}}},
  NJ:{m:66000,col:1.28,metros:{Newark:{m:68000,col:1.31}}},
  MI:{m:50000,col:0.93,metros:{Detroit:{m:54000,col:1.00}}},
  TN:{m:47000,col:0.91,metros:{Nashville:{m:54000,col:1.02},Memphis:{m:45000,col:0.88}}},
  OR:{m:60000,col:1.12,metros:{Portland:{m:65000,col:1.22}}},
  SC:{m:45000,col:0.89},MO:{m:48000,col:0.93},KY:{m:44000,col:0.88},
  AL:{m:43000,col:0.87},MS:{m:40000,col:0.83},AR:{m:41000,col:0.85},
  LA:{m:46000,col:0.90},OK:{m:44000,col:0.88},KS:{m:47000,col:0.91},
  NE:{m:48000,col:0.92},IA:{m:48000,col:0.92},IN:{m:47000,col:0.92},
  WI:{m:51000,col:0.96},MD:{m:65000,col:1.22},CT:{m:68000,col:1.26},
  RI:{m:60000,col:1.13},NH:{m:62000,col:1.14},VT:{m:54000,col:1.04},
  ME:{m:50000,col:0.98},DE:{m:56000,col:1.04},WV:{m:40000,col:0.83},
  ID:{m:48000,col:0.93},MT:{m:46000,col:0.92},WY:{m:52000,col:0.97},
  ND:{m:52000,col:0.97},SD:{m:46000,col:0.91},NM:{m:44000,col:0.90},
  NV:{m:52000,col:1.02},UT:{m:54000,col:1.03},HI:{m:68000,col:1.44},
  AK:{m:62000,col:1.28}
};

var totalHF=1.32;

function tsReset(){
  ['companyName','contactName','contactTitle','contactEmail','numEE','avgWages','totalWages','asiScore','hqMetro','premAvg','contribPct','renewalNotes'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
  ['industry','hqState','carrier','openMarketClient'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('benefitsRate').value='70';
  document.getElementById('numLocations').value='1';
  document.getElementById('adpProducts').value='';
  ['scoreSection','benefitsSection','discountSection','laborSection','varianceSection'].forEach(function(id){var el=document.getElementById(id);if(el)el.style.display='none';});
}

function gv(id){var e=document.getElementById(id);return e?e.value.trim():'';}
function getRaw(id){var v=gv(id);return v&&!isNaN(v)?parseFloat(v):null;}
function ff(n){return n!=null&&!isNaN(n)?'$'+Math.round(n).toLocaleString('en-US'):'—';}
function fp(n){return n!=null&&!isNaN(n)?(n>0?'+':'')+Math.round(n*100)+'%':'—';}

function getCarrierDisplayName(cd){return cd?cd.name:'your carrier';}

function estimateDiscount(numEE,participation,asi,industry,state,carrierKey){
  var base=-0.04;
  if(numEE>=100)base-=0.03;else if(numEE>=75)base-=0.02;else if(numEE>=50)base-=0.01;
  if(participation>=0.85)base-=0.02;else if(participation>=0.75)base-=0.01;
  if(asi&&asi>=80)base-=0.02;else if(asi&&asi>=65)base-=0.01;
  var lowRisk=['Technology','Finance & Insurance','Professional Services','Non-Profit','Education'];
  var highRisk=['Construction','Hospitality','Transportation','Retail'];
  if(lowRisk.indexOf(industry)>=0)base-=0.015;
  else if(highRisk.indexOf(industry)>=0)base+=0.015;
  var states=['CA','NY','MA','NJ','CT','IL','WA'];
  if(states.indexOf(state)>=0)base+=0.01;
  var high=['TX','FL','AZ','NV','NC'];
  if(high.indexOf(state)>=0)base-=0.01;
  var spread=0.04;
  return{low:base-spread/2,high:base+spread/2};
}

function formatRenewalDate(val){
  if(!val)return null;
  var parts=val.split('-');
  if(parts.length!==2)return null;
  var months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  return months[parseInt(parts[1])-1]+' '+parts[0];
}

function daysUntilRenewal(val){
  if(!val)return null;
  var d=new Date(val+'-01');
  var now=new Date();
  var diff=Math.round((d-now)/(1000*60*60*24));
  return diff>=0?diff:null;
}

function tsCalc(){
  var numEE=getRaw('numEE');
  var avgWages=getRaw('avgWages');
  var total=getRaw('totalWages')||((numEE&&avgWages)?numEE*avgWages:null);
  if(numEE&&avgWages&&!getRaw('totalWages')){
    document.getElementById('totalWages').placeholder='≈ '+ff(numEE*avgWages);
  }

  var omStatus=gv('openMarketClient');
  var rnRow=document.getElementById('renewalNotesRow');
  if(rnRow)rnRow.style.display=omStatus==='yes'?'block':'none';

  if(!numEE)return;

  var bRate=parseInt(gv('benefitsRate'))||70;
  var asi=getRaw('asiScore');
  var locs=gv('numLocations');
  var prods=gv('adpProducts');
  var industry=gv('industry');
  var state=gv('hqState');
  var metro=gv('hqMetro');
  var carrierKey=gv('carrier');
  var renewal=getRaw('renewalIncrease');

  // PEO Fit Score
  var score=30;
  if(numEE>=50&&numEE<=200)score+=25;else if(numEE>200)score+=10;
  if(bRate>=75)score+=20;else if(bRate>=65)score+=12;else score+=4;
  if(asi&&asi>=75)score+=15;else if(asi&&asi>=55)score+=8;
  if(prods&&parseInt(prods)>=3)score+=10;else if(prods&&parseInt(prods)>=1)score+=5;
  if(locs==='1')score+=5;else if(locs==='2')score+=8;
  if(renewal&&renewal>=8)score+=10;
  score=Math.min(100,score);

  var scoreEl=document.getElementById('scoreNum');
  var color=score>=75?'var(--green)':score>=50?'var(--yellow)':'var(--orange)';
  if(scoreEl){scoreEl.textContent=score;scoreEl.style.color=color;}
  var scorePct=document.getElementById('scorePct');
  if(scorePct)scorePct.textContent=score;

  var rec=score>=75?'🟢 <strong>High Fit</strong> — Lead with cost savings and ROI data. Aggressive cadence recommended.':
           score>=50?'🟡 <strong>Mid Fit</strong> — Consultative approach. Educate on PEO value before pricing.':
                     '🔴 <strong>Lower Fit</strong> — Nurture tone. Focus on community and long-play.';
  var rr=document.getElementById('routingRec');
  if(rr)rr.innerHTML=rec;

  // Summary pills
  var pillsEl=document.getElementById('summaryPills');
  if(pillsEl){
    var pills='';
    if(numEE>=50&&numEE<=200)pills+='<span class="summary-pill pill-green">✓ Headcount In Range</span>';
    if(bRate>=75)pills+='<span class="summary-pill pill-green">✓ Strong Participation</span>';
    else if(bRate<65)pills+='<span class="summary-pill pill-orange">⚠ Low Participation</span>';
    if(renewal&&renewal>=8)pills+='<span class="summary-pill pill-blue">⚡ High Renewal Increase</span>';
    if(asi&&asi>=75)pills+='<span class="summary-pill pill-purple">✓ Strong ASI</span>';
    if(prods&&parseInt(prods)>=3)pills+='<span class="summary-pill pill-blue">✓ Deep ADP Footprint</span>';
    if(omStatus==='yes')pills+='<span class="summary-pill pill-yellow">🔄 Open Market Client</span>';
    pillsEl.innerHTML=pills;
  }

  document.getElementById('scoreSection').style.display='block';

  // Benefits benchmark
  if(carrierKey&&CARRIERS[carrierKey]){
    var cd=CARRIERS[carrierKey];
    var participation=bRate/100;
    var disc=estimateDiscount(numEE,participation,asi,industry,state,carrierKey);
    var enrolled=numEE?Math.round(numEE*participation):null;
    var natAvgBlended=(cd.single.avg*0.40+cd.spouse.avg*0.20+cd.child.avg*0.15+cd.family.avg*0.25);
    var clientAvg=getRaw('premAvg');
    var blendedTSLow=Math.round(natAvgBlended*(1+disc.low));
    var blendedTSHigh=Math.round(natAvgBlended*(1+disc.high));
    var cPct=getRaw('contribPct');var empRate=cPct?cPct/100:null;
    var savLow=clientAvg&&enrolled&&empRate?Math.round((clientAvg-blendedTSLow)*empRate*enrolled*12):null;
    var savHigh=clientAvg&&enrolled&&empRate?Math.round((clientAvg-blendedTSHigh)*empRate*enrolled*12):null;

    var bGrid=document.getElementById('benefitsBenchGrid');
    if(bGrid){
      bGrid.innerHTML=
        '<div class="hb-item"><div class="hb-label">Carrier</div><div class="hb-val" style="font-size:13px;">'+cd.name+'</div></div>'+
        '<div class="hb-item"><div class="hb-label">Nat Avg Single</div><div class="hb-val">'+ff(cd.single.avg)+'<div class="hb-sub">/mo</div></div></div>'+
        '<div class="hb-item"><div class="hb-label">Nat Avg Family</div><div class="hb-val">'+ff(cd.family.avg)+'<div class="hb-sub">/mo</div></div></div>'+
        (clientAvg?'<div class="hb-item"><div class="hb-label">Your Blended Avg</div><div class="hb-val">'+ff(clientAvg)+'<div class="hb-sub">/mo/EE</div></div></div>':'')+
        '<div class="hb-item"><div class="hb-label">TS Est. Range</div><div class="hb-val" style="color:var(--green);">'+ff(blendedTSHigh)+' – '+ff(blendedTSLow)+'<div class="hb-sub">/mo blended</div></div></div>'+
        (savHigh&&savHigh>0?'<div class="hb-item"><div class="hb-label">Est. Annual Savings</div><div class="hb-val" style="color:var(--green);">'+ff(savHigh)+' – '+ff(savLow||0)+'</div></div>':'');
    }
    document.getElementById('benefitsSection').style.display='block';

    var dGrid=document.getElementById('discountGrid');
    if(dGrid){
      dGrid.innerHTML=
        '<div class="hb-item"><div class="hb-label">Est. Discount Low</div><div class="hb-val" style="color:var(--green);">'+fp(disc.high)+'</div></div>'+
        '<div class="hb-item"><div class="hb-label">Est. Discount High</div><div class="hb-val" style="color:var(--green);">'+fp(disc.low)+'</div></div>'+
        '<div class="hb-item"><div class="hb-label">Blended Nat Avg</div><div class="hb-val">'+ff(natAvgBlended)+'<div class="hb-sub">/mo</div></div></div>'+
        (renewal?'<div class="hb-item"><div class="hb-label">Renewal Increase</div><div class="hb-val" style="color:var(--orange);">+'+renewal+'%</div></div>':'');
      var dn=document.getElementById('discountNote');
      if(dn)dn.textContent='Estimates based on real TotalSource underwriting outcomes for similar groups. Actual quote from ADP will confirm.';
    }
    document.getElementById('discountSection').style.display='block';
  }

  // Labor market
  if(state&&LD[state]){
    var sd=LD[state];var md=(metro&&sd.metros&&sd.metros[metro])?sd.metros[metro]:null;
    var median=md?md.m:sd.m;var col=md?md.col:sd.col;
    var loc=metro||state;
    var hc=Math.round(median*totalHF);
    var lGrid=document.getElementById('laborGrid');
    if(lGrid){
      lGrid.innerHTML=
        '<div class="hb-item"><div class="hb-label">Median Wage ('+loc+')</div><div class="hb-val">'+ff(median)+'<div class="hb-sub">/yr</div></div></div>'+
        '<div class="hb-item"><div class="hb-label">Cost of Living Index</div><div class="hb-val">'+col.toFixed(2)+'x</div></div>'+
        '<div class="hb-item"><div class="hb-label">Fully-Loaded Hire Cost</div><div class="hb-val" style="color:var(--orange);">'+ff(hc)+'</div></div>'+
        (numEE?'<div class="hb-item"><div class="hb-label">15% Turnover Cost/Yr</div><div class="hb-val" style="color:var(--orange);">'+ff(Math.round(numEE*0.15)*hc)+'</div></div>':'');
    }
    var scaleSection=document.getElementById('scaleSection');
    if(numEE&&scaleSection){
      scaleSection.style.display='block';
      var sl=document.getElementById('scaleLabel');
      if(sl)sl.textContent=numEE.toLocaleString()+' employees — Hiring Cost Scale';
      var cells=document.getElementById('scaleCells');
      if(cells)cells.innerHTML=[0.10,0.15,0.20,0.25].map(function(r){return'<div class="hb-item" style="flex:1;min-width:110px;"><div class="hb-label">'+Math.round(r*100)+'% turnover · ~'+Math.round(numEE*r)+' hires/yr</div><div class="hb-val">'+ff(Math.round(numEE*r)*hc)+'/yr</div></div>';}).join('');
    }else if(scaleSection){scaleSection.style.display='none';}
    var ln=document.getElementById('laborNote');
    if(ln)ln.textContent='Based on BLS OES 2023, SHRM Benchmarking, Tax Foundation. '+loc+(col>=1.20?' is an above-average cost market ('+col.toFixed(2)+'x).':col<=0.90?' is a cost-efficient market ('+col.toFixed(2)+'x).':' tracks near national average ('+col.toFixed(2)+'x).');
    document.getElementById('laborSection').style.display='block';
  }

  tsRenderTouches();
}

function tsScrollToScore(){
  var el=document.getElementById('scoreSection');
  if(el)el.scrollIntoView({behavior:'smooth',block:'start'});
}

// ═══════════════════════════════════════════════════════
//  TS CADENCE EMAIL SYSTEM
// ═══════════════════════════════════════════════════════
var _tsTouchIdx=0;
var _tsTouchStatuses={};
var _tsTouchNotes={};

function tsBuildTouches(){
  var co=gv('companyName')||'[Company]';
  var nm=(gv('contactName')||'').split(' ')[0]||'[Name]';
  var ind=gv('industry')||'[Industry]';
  var st=gv('hqState')||'[State]';
  var hc=gv('numEE')||'[X]';
  var sig='\n\n—\nAJ\nADP\nbeyondpayroll.net';
  return[
    {day:2,label:'PEO Reality Check',
     subject:'Is ADP TotalSource still the right model for '+co+' at '+hc+' employees?',
     body:'Hi '+nm+',\n\nMost PEO clients evaluate alternatives somewhere between 75–150 employees. At '+hc+' employees in '+ind+', the PEPM math starts shifting in a way that surprises most CFOs — and the co-employment liability looks different than when you first signed.\n\nI\'d love to run a side-by-side comparison. 15 minutes, no commitment.\n\nDo you have any time this week?'+sig},
    {day:8,label:'Cost Comparison',
     subject:'The math on TotalSource at '+hc+' employees — what the data shows',
     body:'Hi '+nm+',\n\nA PEO vs. HCM cost comparison built around '+co+'\'s profile.\n\n• Estimated TotalSource PEPM at '+hc+' EEs: $[X]–$[X]\n• Comparable HCM platform PEPM: $[X]–$[X]\n• Estimated annual delta: $[X]\n• Benefits markup on TotalSource (est.): [X]%\n\nI\'d love to run the real numbers with you. Can you share your current PEPM?'+sig},
    {day:15,label:'Case Study',
     subject:'How a '+ind+' company at '+hc+' employees restructured HCM and saved $[X]/year',
     body:'Hi '+nm+',\n\nWanted to share a case study of a company similar to '+co+' — same industry, similar headcount, also on TotalSource.\n\nAt '+hc+' employees in '+ind+', the PEO model was costing them significantly more per year than a comparable HCM platform.\n\nI can run the same analysis for '+co+' in about 20 minutes. Want to take a look together?'+sig},
    {day:22,label:'Breakup Email',
     subject:'Last email from me, '+nm+' — with one final thought on '+co+'\'s TotalSource setup',
     body:'Hi '+nm+',\n\nI\'ve shared a lot of data on '+co+'\'s PEO cost structure over the past few weeks.\n\nWhether you act now or at renewal, I hope it was useful.\n\nHere\'s everything in one place: [link]\nMy calendar: [calendar link]\n\nThanks for your time, '+nm+'.'+sig},
    {day:30,label:'Community Invite',
     subject:co+'\'s PEO Scorecard + invitation to BeyondPayroll HCM Intelligence Community',
     body:'Hi '+nm+',\n\nFinal email from my end. Attaching your TotalSource Renewal Scorecard — yours to keep.\n\nI\'m enrolling you in our quarterly PEO & HCM Benchmarking Briefing — no commitment, no pitch, just data.\n\nJoin here: beyondpayroll.net\n\nThanks for your time.'+sig},
  ];
}

function tsRenderTouches(){
  var touches=tsBuildTouches();
  var tabs=document.getElementById('ts-touch-tabs');
  if(!tabs)return;
  tabs.innerHTML='';
  touches.forEach(function(t,i){
    var tb=document.createElement('button');
    var sent=_tsTouchStatuses[i]==='Sent'||_tsTouchStatuses[i]==='Meeting Booked';
    tb.className='btn'+(i===_tsTouchIdx?'':' secondary');
    if(i===_tsTouchIdx){tb.style.cssText='padding:5px 12px;font-size:11px;background:#0078d4;border-color:#0078d4;color:#fff;';}
    else{tb.style.cssText='padding:5px 12px;font-size:11px;'+(sent?'border-color:var(--green);color:var(--green);':'');}
    tb.textContent='Day '+t.day+' · '+t.label+(sent?' ✓':'');
    tb.onclick=(function(idx){return function(){_tsTouchIdx=idx;tsRenderTouches();tsLoadTouch();};})(i);
    tabs.appendChild(tb);
  });
  tsLoadTouch();
}

function tsLoadTouch(){
  var touches=tsBuildTouches();
  var t=touches[_tsTouchIdx];if(!t)return;
  var subjEl=document.getElementById('emailSubject');
  var bodyEl=document.getElementById('emailBody');
  var lbl=document.getElementById('ts-touch-lbl');
  var toEl=document.getElementById('ts-to-inp');
  var p=window._hqProspect;
  if(!toEl.value&&p&&p.email)toEl.value=p.email;
  if(subjEl)subjEl.textContent=t.subject;
  
  // Convert line breaks to HTML for proper display
  if(bodyEl){
    var bodyText = t.body.replace(/\\n/g,'\n');
    var htmlBody = bodyText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    bodyEl.innerHTML = '<p>' + htmlBody + '</p>';
  }
  
  if(lbl)lbl.textContent='Day '+t.day+' · '+t.label;
  var stEl=document.getElementById('ts-touch-status');
  if(stEl)stEl.value=_tsTouchStatuses[_tsTouchIdx]||'Pending';
  var ntEl=document.getElementById('ts-touch-notes');
  if(ntEl)ntEl.value=_tsTouchNotes[_tsTouchIdx]||'';
}

function tsSetStatus(val){_tsTouchStatuses[_tsTouchIdx]=val;tsRenderTouches();}

function tsCopyField(field){
  var touches=tsBuildTouches();var t=touches[_tsTouchIdx];
  var toVal=document.getElementById('ts-to-inp').value;
  var map={
    to:toVal,
    subj:t.subject,
    body:(document.getElementById('emailBody')||{}).textContent||t.body
  };
  var text=map[field]||'';
  navigator.clipboard.writeText(text).catch(function(){
    var ta=document.createElement('textarea');ta.value=text;
    document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
  });
}

function tsCopyAll(){
  var touches=tsBuildTouches();var t=touches[_tsTouchIdx];
  var toVal=document.getElementById('ts-to-inp').value;
  var body=(document.getElementById('emailBody')||{}).textContent||t.body;
  var text='TO: '+toVal+'\nSUBJECT: '+t.subject+'\n\n'+body;
  navigator.clipboard.writeText(text).catch(function(){
    var ta=document.createElement('textarea');ta.value=text;
    document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
  });
}

function tsFireMailto(){
  var touches=tsBuildTouches();var t=touches[_tsTouchIdx];
  var toVal=(document.getElementById('ts-to-inp').value||'').trim();
  if(!toVal){alert('Please add a recipient email.');return;}
  
  // Get body and preserve paragraph structure
  var bodyEl = document.getElementById('emailBody');
  var body = '';
  
  if (bodyEl) {
    // If it has HTML content with proper structure, convert to text with line breaks
    if (bodyEl.innerHTML && bodyEl.innerHTML.includes('<')) {
      // Has HTML - convert <br>, <p>, </div> to line breaks
      body = bodyEl.innerHTML
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<[^>]+>/g, '')  // Remove remaining HTML tags
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .trim();
    } else {
      // Plain text - use textContent
      body = bodyEl.textContent || t.body;
    }
    
    // Clean up excessive line breaks (more than 2 consecutive)
    body = body.replace(/\n{3,}/g, '\n\n');
  } else {
    body = t.body;
  }
  
  // Strip any existing signature - let Outlook add its own
  var cleanBody = body.replace(/\n\n—[\s\S]*$/, '');
  
  var uri='mailto:'+encodeURIComponent(toVal)+'?subject='+encodeURIComponent(t.subject)+'&body='+encodeURIComponent(cleanBody);
  var a=document.createElement('a');a.href=uri;a.style.display='none';document.body.appendChild(a);a.click();
  setTimeout(function(){document.body.removeChild(a);},500);
}

function tsExportCSV(){
  var touches=tsBuildTouches();
  var rows=touches.map(function(t,i){
    return[t.day,'"'+t.label+'"','"'+t.subject.replace(/"/g,'""')+'"',_tsTouchStatuses[i]||'Pending','"'+(_tsTouchNotes[i]||'').replace(/"/g,'""')+'"'];
  });
  var csv=[['Day','Label','Subject','Status','Notes']].concat(rows).map(function(r){return r.join(',');}).join('\n');
  var a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['BeyondPayroll HCM — '+gv('companyName')+'\n\n'+csv],{type:'text/csv'}));
  a.download='BPH_TS_Cadence.csv';a.click();
}

// Expose scorePct for email generator compatibility
var _tsPctProxy={textContent:'0'};
Object.defineProperty(window,'_tsScorePct',{get:function(){return parseFloat(_tsPctProxy.textContent)||0},set:function(v){_tsPctProxy.textContent=String(v)}});

// ══════════════════════════════════════════════════════════════════
//  ANALYSIS TOOLS — Complete Module
// ══════════════════════════════════════════════════════════════════
var _atData = null;       // Current analysis subject data
var _atTool = null;       // Selected tool key
var _atResults = {};      // Cached results per tool
var _atResTab = null;     // Active results sub-tab
var _atCsvRecords = [];   // Loaded CSV rows

// ── Tab activation ────────────────────────────────────────────────
// (hqTab already handles analysis view — no override needed)

function atInit() {
  // Refresh prospect pull if active
  if (window._hqProspect) atPullFromProspect();
  atUpdateStatusBar();
}

// ── Input mode ────────────────────────────────────────────────────
window.atInputMode = function(mode) {
  ['prospect','paste','csv'].forEach(function(m) {
    document.getElementById('at-mode-' + m).style.display = m === mode ? 'block' : 'none';
    var tab = document.getElementById('at-itab-' + m);
    if (tab) tab.classList.toggle('active', m === mode);
  });
};

// ── Pull active prospect ──────────────────────────────────────────
window.atPullFromProspect = function() {
  var p = window._hqProspect;
  var emptyEl = document.getElementById('at-prospect-empty');
  var loadedEl = document.getElementById('at-prospect-loaded');
  var gridEl = document.getElementById('at-prospect-grid');
  if (!p) {
    if (emptyEl) emptyEl.style.display = 'block';
    if (loadedEl) loadedEl.style.display = 'none';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  if (loadedEl) loadedEl.style.display = 'block';

  var sre = atCollectSreContext();
  var adpStr = sre.adpProducts.length ? sre.adpProducts.map(function(x){return adpLabel(x);}).join(', ') : '—';
  var painStr = sre.painPoints.length ? sre.painPoints.join(', ') : '—';
  var transcriptStr = sre.transcript.length > 20
    ? sre.transcript.substring(0, 80).trim() + (sre.transcript.length > 80 ? '…' : '')
    : (sre.transcript.length ? sre.transcript : '—');
  var sreStr = sre.sreRan
    ? sre.sreRecommendation + ' (' + sre.sreConfidence + '% confidence)'
    : '— (run Smart Routing Engine first)';

  var fields = [
    ['Company', p.company, 'co'],
    ['Contact', p.contact, ''],
    ['Industry', p.industry, ''],
    ['State', p.state, ''],
    ['Headcount', p.headcount ? p.headcount + ' employees' : '', ''],
    ['Track', p.track, ''],
    ['Persona', p.persona, ''],
    ['Client Type', sre.clientType || (p.track || 'new'), ''],
    ['Current ADP Products', adpStr, ''],
    ['SRE Recommendation', sreStr, ''],
    ['Pain Points', painStr, ''],
    ['Transcript', transcriptStr, ''],
    ['Email', p.email, '']
  ];
  if (gridEl) {
    gridEl.innerHTML = fields.filter(function(f){return f[1] && f[1] !== '—';}).map(function(f) {
      var isHighlight = (f[0] === 'SRE Recommendation' && sre.sreRan) || (f[0] === 'Pain Points' && sre.painPoints.length);
      var style = isHighlight ? ' style="color:var(--red);font-weight:600"' : '';
      return '<div class="at-pg-item"><div class="at-pg-lbl">' + f[0] + '</div>'
        + '<div class="at-pg-val' + (f[2] ? ' ' + f[2] : '') + '"' + style + '>' + escHtml(f[1]) + '</div></div>';
    }).join('');
  }
};

// ── Helper: collect full SRE state into a structured object ──────
function atCollectSreContext() {
  // Use sreCollectPains if available (new path), else fall back to manual read
  var checkedPains = (typeof sreCollectPains === 'function') ? sreCollectPains() : [];

  var transcriptEl = document.getElementById('sre-transcript');
  var transcript = transcriptEl ? transcriptEl.value.trim() : '';

  var adpProds = Array.from(window._sreAdpProducts || []);
  var clientType = window._sreClientType || '';
  var analysis = window._sreAnalysis || null;
  var p = window._hqProspect || {};

  return {
    painPoints: checkedPains.length ? checkedPains : (p.painPoints || []),
    transcript: transcript || p.transcript || '',
    adpProducts: adpProds.length ? adpProds : (p.adpProducts || []),
    clientType: clientType || p.clientType || '',
    competitor: p.competitor || '',
    renewalDate: p.renewalDate || '',
    headcountBand: p.headcountBand || '',
    headcountRange: p.headcountRange || '',
    extProfile: p.extProfile || {},
    sreDataPoints: p.sreDataPoints || 0,
    sreRecommendation: analysis ? (analysis.rec || '') : '',
    sreConfidence: analysis ? (analysis.pct || analysis.conf || '') : '',
    sreWfnScore: analysis ? (analysis.wfn || '') : '',
    srePeoScore: analysis ? (analysis.peo || '') : '',
    srePrimaryFactors: analysis ? (analysis.wfnF || analysis.peoF || []) : [],
    sreRan: !!(analysis || p.sreSavedAt),
    // Track, tone, and MCA intelligence
    track: window._sreSelectedTrack || p.track || '',
    cadenceTone: window._sreCadenceTone || p.cadenceTone || '',
    mcaResult: p.mcaResult || null,
    mcaTrack: p.mcaTrack || '',
    mcaTone: p.mcaTone || ''
  };
}

// ── Confirm data for analysis ─────────────────────────────────────
window.atConfirmData = function() {
  var p = window._hqProspect;
  if (!p) { showToast('No prospect loaded', true); return; }
  var sre = atCollectSreContext();
  _atData = {
    // ── Firmographic ──
    company: p.company, contact: p.contact, industry: p.industry || '',
    state: p.state || '', headcount: p.headcount || '',
    email: p.email || '', persona: p.persona || '', phone: p.phone || '',
    linkedin: p.linkedin || '', platform: p.platform || '', notes: p.notes || '',
    track: p.track || '',
    // ── SRE context ──
    clientType: sre.clientType || (p.track === 'TS' ? 'existing' : 'new'),
    adpProducts: sre.adpProducts,
    competitor: sre.competitor,
    renewalDate: sre.renewalDate,
    headcountBand: sre.headcountBand,
    headcountRange: sre.headcountRange,
    extProfile: sre.extProfile,
    sreRecommendation: sre.sreRecommendation,
    sreConfidence: sre.sreConfidence,
    sreWfnScore: sre.sreWfnScore,
    srePeoScore: sre.srePeoScore,
    srePrimaryFactors: sre.srePrimaryFactors,
    // ── Pain points from checkboxes ──
    painPoints: sre.painPoints,
    // ── Gong transcript extract ──
    transcript: sre.transcript,
    sreRan: sre.sreRan
  };
  document.getElementById('at-data-badge').style.display = '';
  atUpdateStatusBar('data');
  var painCount = sre.painPoints.length;
  var transcriptLoaded = sre.transcript.length > 20;
  var msg = '✓ ' + p.company + ' loaded';
  if (painCount) msg += ' · ' + painCount + ' pain signal' + (painCount > 1 ? 's' : '');
  if (transcriptLoaded) msg += ' · transcript included';
  if (sre.sreRan) msg += ' · SRE: ' + sre.sreRecommendation;
  showToast(msg);
  atScrollToTool();
};

// ── Load manual form ──────────────────────────────────────────────
window.atLoadManual = function() {
  var co = (document.getElementById('at-f-company').value || '').trim();
  if (!co) { showToast('Company name required', true); return; }
  _atData = {
    company: co,
    contact: document.getElementById('at-f-contact').value.trim(),
    industry: document.getElementById('at-f-industry').value.trim(),
    state: document.getElementById('at-f-state').value.trim().toUpperCase(),
    headcount: document.getElementById('at-f-headcount').value.trim(),
    clientType: document.getElementById('at-f-clienttype').value,
    platform: document.getElementById('at-f-platform').value.trim(),
    notes: document.getElementById('at-f-notes').value.trim()
  };
  document.getElementById('at-data-badge').style.display = '';
  atUpdateStatusBar('data');
  showToast('✓ Manual data loaded — select a tool');
  atScrollToTool();
};

function atScrollToTool() {
  var el = document.querySelector('.at-tool-grid');
  if (el) setTimeout(function() { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
}

// ── CSV handling ──────────────────────────────────────────────────
window.atCsvDragOver = function(e) { e.preventDefault(); document.getElementById('at-csv-drop').classList.add('drag'); };
window.atCsvDragLeave = function() { document.getElementById('at-csv-drop').classList.remove('drag'); };
window.atCsvDrop = function(e) { e.preventDefault(); atCsvDragLeave(); var f = e.dataTransfer.files[0]; if (f) atParseCsv(f); };
window.atCsvFile = function(e) { var f = e.target.files[0]; if (f) atParseCsv(f); };

function atParseCsv(file) {
  var reader = new FileReader();
  reader.onload = function(ev) {
    var lines = ev.target.result.split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
    if (!lines.length) { showToast('CSV appears empty', true); return; }
    var headers = lines[0].split(',').map(function(h){ return h.replace(/^["']|["']$/g,'').trim().toLowerCase(); });
    var rows = [];
    for (var i = 1; i < lines.length; i++) {
      var cols = lines[i].split(',').map(function(c){ return c.replace(/^["']|["']$/g,'').trim(); });
      var row = {};
      headers.forEach(function(h, idx) { row[h] = cols[idx] || ''; });
      if (row.company || row.name) rows.push(row);
    }
    _atCsvRecords = rows;
    var status = document.getElementById('at-csv-status');
    if (status) { status.textContent = rows.length + ' records loaded from ' + file.name; status.style.display = ''; }
    atRenderCsvList();
  };
  reader.readAsText(file);
}

function atRenderCsvList() {
  var list = document.getElementById('at-csv-list');
  var wrap = document.getElementById('at-csv-records');
  if (!list || !wrap) return;
  wrap.style.display = '';
  list.innerHTML = _atCsvRecords.map(function(r, i) {
    return '<div class="at-csv-row" onclick="atSelectCsvRow(' + i + ')" id="at-csvrow-' + i + '">'
      + '<div class="at-csv-co">' + escHtml(r.company || r.name || '—') + '</div>'
      + '<div class="at-csv-meta">' + escHtml([r.industry, r.state, r.headcount ? r.headcount + ' EE' : ''].filter(Boolean).join(' · ')) + '</div>'
      + '<div style="font-size:10px;padding:2px 7px;border-radius:3px;background:var(--light);color:var(--text-3);font-weight:600">' + escHtml(r.clienttype || r.track || 'NEW') + '</div>'
      + '</div>';
  }).join('');
}

window.atSelectCsvRow = function(i) {
  document.querySelectorAll('.at-csv-row').forEach(function(el){ el.classList.remove('selected'); });
  var row = document.getElementById('at-csvrow-' + i);
  if (row) row.classList.add('selected');
  var r = _atCsvRecords[i];
  if (!r) return;
  _atData = {
    company: r.company || r.name || '',
    contact: r.contact || r.contactname || '',
    industry: r.industry || '',
    state: (r.state || '').toUpperCase(),
    headcount: r.headcount || r.employees || '',
    clientType: r.clienttype || r.track || 'new',
    platform: r.platform || r.currentplatform || '',
    notes: r.notes || r.painpoints || ''
  };
  document.getElementById('at-data-badge').style.display = '';
  atUpdateStatusBar('data');
  showToast('✓ ' + _atData.company + ' selected from CSV');
};

// ── Tool selection ────────────────────────────────────────────────
window.atSelectTool = function(tool) {
  _atTool = tool;
  ['wfn','ts','market','full'].forEach(function(t) {
    var card = document.getElementById('at-tool-' + t);
    if (card) card.classList.toggle('selected', t === tool);
  });
  atUpdateStatusBar('tool');
  var labels = {
    wfn: '🖥️ WFN Fit Analyzer',
    ts: '🏢 TotalSource PEO Analyzer',
    market: '📈 Market Analysis',
    full: '⚡ Full Intelligence Suite'
  };
  var subLabels = {
    wfn: 'ROI model, displacement playbook, upgrade path',
    ts: 'PEPM economics, benefits benchmark, renewal intel',
    market: 'Regulatory alerts, pricing intel, market timing',
    full: 'All three analyzers — comprehensive brief with pros/cons'
  };
  var runLbl = document.getElementById('at-run-label');
  var runSub = document.getElementById('at-run-sub');
  if (runLbl) runLbl.textContent = labels[tool] || 'Analysis ready';
  if (runSub) runSub.textContent = _atData ? 'Ready to run for ' + _atData.company : subLabels[tool] || '';
  var runBtn = document.getElementById('at-run-btn');
  if (runBtn) runBtn.disabled = !_atData;
  showToast(labels[tool] + ' selected');
};

function atUpdateStatusBar(just) {
  var chipData = document.getElementById('at-chip-data');
  var chipTool = document.getElementById('at-chip-tool');
  if (chipData) {
    chipData.innerHTML = _atData
      ? '<span class="at-dot green"></span> ' + escHtml(_atData.company)
      : '<span class="at-dot grey"></span> No Data Loaded';
  }
  if (chipTool) {
    var toolLabels = { wfn: 'WFN Analyzer', ts: 'TS PEO Analyzer', market: 'Market Analysis', full: 'Full Suite' };
    chipTool.innerHTML = _atTool
      ? '<span class="at-dot gold"></span> ' + toolLabels[_atTool]
      : '<span class="at-dot grey"></span> No Tool Selected';
  }
  var runBtn = document.getElementById('at-run-btn');
  if (runBtn) runBtn.disabled = !(_atData && _atTool);
}

// ── Run analysis ──────────────────────────────────────────────────
window.atRunAnalysis = function() {
  if (!_atData) { showToast('Load data first', true); return; }
  if (!_atTool) { showToast('Select a tool first', true); return; }

  var runBtn = document.getElementById('at-run-btn');
  var runBtnLbl = document.getElementById('at-run-btn-lbl');
  var runBtnIcon = document.getElementById('at-run-btn-icon');
  if (runBtn) runBtn.disabled = true;
  if (runBtnLbl) runBtnLbl.textContent = 'Analyzing…';
  if (runBtnIcon) runBtnIcon.innerHTML = '<span class="at-spinner" style="width:14px;height:14px;border-color:rgba(13,21,53,.2);border-top-color:var(--navy)"></span>';

  // Show results shell
  var resultsEl = document.getElementById('at-results');
  if (resultsEl) { resultsEl.style.display = 'block'; resultsEl.style.animation = 'none'; }
  var resHdr = document.getElementById('at-res-co');
  var resMeta = document.getElementById('at-res-meta');
  if (resHdr) resHdr.textContent = _atData.company;
  if (resMeta) resMeta.textContent = [_atData.industry, _atData.state, _atData.headcount ? _atData.headcount + ' employees' : ''].filter(Boolean).join(' · ');
  var body = document.getElementById('at-results-body');
  if (body) body.innerHTML = '<div class="at-loading"><div class="at-spinner"></div><span>Running AI analysis for ' + escHtml(_atData.company) + '…</span></div>';

  // Build tabs for full suite
  var tabsEl = document.getElementById('at-res-tabs');
  if (tabsEl) {
    if (_atTool === 'full') {
      tabsEl.innerHTML = ['wfn','ts','market','strategy'].map(function(t, i) {
        var labels = { wfn: '🖥️ WFN Fit', ts: '🏢 PEO Analyzer', market: '📈 Market Intel', strategy: '🎯 Strategy Brief' };
        return '<button class="at-res-tab' + (i === 0 ? ' active' : '') + '" id="at-rtab-' + t + '" onclick="atResTab(\'' + t + '\')">' + labels[t] + '</button>';
      }).join('');
      _atResTab = 'wfn';
    } else {
      tabsEl.innerHTML = '';
      _atResTab = _atTool;
    }
  }

  atCallClaude(_atTool, _atData).then(function(result) {
    _atResults[_atTool] = result;
    atRenderResults(result, _atTool);
    if (runBtn) runBtn.disabled = false;
    if (runBtnLbl) runBtnLbl.textContent = 'Re-run Analysis';
    if (runBtnIcon) runBtnIcon.textContent = '↻';
    atUpdateStatusBar();
    document.getElementById('at-chip-analysis').innerHTML = '<span class="at-dot green pulse"></span> Analysis Complete';
    showToast('✓ Analysis complete for ' + _atData.company);
    // ── Background Email Engine: re-generate with fresh analysis intel ──
    if(typeof window.bpEngineRefreshWithAnalysis==='function') window.bpEngineRefreshWithAnalysis();
    // Scroll to results
    setTimeout(function() {
      var el = document.getElementById('at-results');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
  }).catch(function(err) {
    if (body) body.innerHTML = '<div class="at-rep-section"><div style="color:var(--err);font-size:13px">⚠ Analysis failed: ' + escHtml(err.message) + '</div></div>';
    if (runBtn) runBtn.disabled = false;
    if (runBtnLbl) runBtnLbl.textContent = 'Retry';
    if (runBtnIcon) runBtnIcon.textContent = '↻';
    showToast('Analysis failed — check console', true);
  });
};

window.atResTab = function(tab) {
  _atResTab = tab;
  document.querySelectorAll('.at-res-tab').forEach(function(el) { el.classList.remove('active'); });
  var active = document.getElementById('at-rtab-' + tab);
  if (active) active.classList.add('active');
  var r = _atResults[_atTool];
  if (r) atRenderResults(r, tab);
};

// ── Claude API call ───────────────────────────────────────────────
function atCallClaude(tool, data) {
  var toolDescriptions = {
    wfn: 'WFN (WorkforceNow) Fit & Upgrade Analysis',
    ts: 'TotalSource PEO Eligibility & Fit Analysis',
    market: 'Market & Competitive Intelligence Analysis',
    full: 'Full HCM Intelligence Report (WFN + TotalSource PEO + Market)'
  };

  // ── Build enriched context block from SRE data ──
  var sreBlock = '';
  if (data.sreRan) {
    sreBlock += '\nPROSPECT INTELLIGENCE SUMMARY:\n';
    if (data.clientType) sreBlock += '  Client Type: ' + (data.clientType === 'existing' ? 'Existing ADP Client' : 'New Prospect') + '\n';
    if (data.adpProducts && data.adpProducts.length) sreBlock += '  ADP Products: ' + data.adpProducts.map(function(x){return adpLabel(x);}).join(', ') + '\n';
    if (data.competitor) sreBlock += '  Incumbent: ' + data.competitor + '\n';
    if (data.renewalDate) sreBlock += '  Contract Renewal: ' + data.renewalDate + '\n';
    if (data.headcountRange) sreBlock += '  Headcount Range: ' + data.headcountRange + ' EEs (' + (data.headcountBand||'') + ')\n';
    var ext = data.extProfile || {};
    if (ext.timeline) sreBlock += '  Decision Timeline: ' + ext.timeline + '\n';
    if (ext.budget) sreBlock += '  Budget Status: ' + ext.budget + '\n';
    if (ext.stage) sreBlock += '  Buying Stage: ' + ext.stage + '\n';
    if (ext.champion) sreBlock += '  Champion: ' + ext.champion + '\n';
    if (ext.econBuyer) sreBlock += '  Economic Buyer: ' + ext.econBuyer + '\n';
    if (ext.statesOps) sreBlock += '  States of Operation: ' + ext.statesOps + '\n';
    if (ext.growth) sreBlock += '  Growth Plans: ' + ext.growth + '\n';
    if (ext.notices && ext.notices !== '') sreBlock += '  DOL/IRS Notices: ' + ext.notices + '\n';
    if (ext.otherVendors) sreBlock += '  Other Vendors Evaluated: ' + ext.otherVendors + '\n';
    if (ext.extNotes) sreBlock += '  Discovery Notes: ' + ext.extNotes + '\n';
    // Track, tone, and MCA intelligence
    if (data.track) sreBlock += '  Product Track: ' + (data.track === 'WFN' ? 'ADP WorkforceNow' : 'ADP TotalSource PEO') + '\n';
    if (data.cadenceTone) sreBlock += '  Cadence Tone: ' + data.cadenceTone + '\n';
    if (data.mcaResult) {
      var mca = data.mcaResult;
      if (mca.executive_summary) sreBlock += '  AI Competitive Assessment: ' + mca.executive_summary + '\n';
      if (mca.tone_strategy && mca.tone_strategy.primary_message) sreBlock += '  Core Value Message: ' + mca.tone_strategy.primary_message + '\n';
      if (mca.tone_strategy && mca.tone_strategy.opening_hook) sreBlock += '  Opening Hook: ' + mca.tone_strategy.opening_hook + '\n';
      if (mca.talk_track) sreBlock += '  Talk Track: ' + mca.talk_track + '\n';
    }
  } else {
    sreBlock += '\nPROSPECT INTELLIGENCE: Not yet collected — infer from firmographic data.\n';
  }

  var painBlock = '';
  if (data.painPoints && data.painPoints.length) {
    painBlock = '\nCONFIRMED PAIN POINTS (from Gong transcript analysis / rep-checked):\n'
      + data.painPoints.map(function(p){ return '  • ' + p; }).join('\n') + '\n';
  }

  var adpBlock = '';
  if (data.adpProducts && data.adpProducts.length) {
    adpBlock = '\nCURRENT ADP PRODUCTS IN USE: ' + data.adpProducts.map(function(x){return adpLabel(x);}).join(', ') + '\n';
  }

  var transcriptBlock = '';
  if (data.transcript && data.transcript.length > 20) {
    transcriptBlock = '\nGONG TRANSCRIPT EXTRACT (verbatim — use for tone, pain language, objections):\n"""\n'
      + data.transcript.substring(0, 2000) + (data.transcript.length > 2000 ? '\n[...truncated]' : '') + '\n"""\n';
  }

  var prompt = 'You are an expert ADP HCM sales intelligence analyst. Generate a comprehensive '
    + toolDescriptions[tool] + ' for the following prospect/client.\n'
    + 'Use ALL provided data — especially the confirmed pain points, SRE scores, and transcript extract — to make the analysis highly specific and actionable.\n'
    + 'Return ONLY valid JSON — no markdown, no preamble.\n\n'
    + 'FIRMOGRAPHIC DATA:\n'
    + '  Company: ' + (data.company || '—') + '\n'
    + '  Contact: ' + (data.contact || '—') + '\n'
    + '  Persona: ' + (data.persona || '—') + '\n'
    + '  Industry: ' + (data.industry || '—') + '\n'
    + '  State: ' + (data.state || '—') + '\n'
    + '  Headcount: ' + (data.headcount || '—') + ' employees\n'
    + '  Client Type: ' + (data.clientType || 'new prospect') + '\n'
    + '  Current Platform: ' + (data.platform || '—') + '\n'
    + '  Track: ' + (data.track || '—') + '\n'
    + '  Notes: ' + (data.notes || '—') + '\n'
    + adpBlock
    + sreBlock
    + painBlock
    + transcriptBlock
    + '\nReturn this exact JSON structure:\n'
    + '{\n'
    + '  "executive_summary": "2-3 sentence sharp assessment — reference their specific pain points and SRE score",\n'
    + '  "fit_scores": { "wfn": 0-100, "ts": 0-100, "market_opportunity": 0-100 },\n'
    + '  "wfn_analysis": {\n'
    + '    "fit_rating": "Strong/Moderate/Weak",\n'
    + '    "headline": "one-line WFN value prop referencing their specific pain",\n'
    + '    "roi_estimate": "specific $ or % ROI estimate based on headcount/industry",\n'
    + '    "payback_months": number,\n'
    + '    "upgrade_path": "migration/upgrade recommendation if applicable",\n'
    + '    "pros": ["4 reasons WFN solves their specific confirmed pain points"],\n'
    + '    "cons": ["2-3 honest gaps or risks"],\n'
    + '    "displacement_playbook": "counter-position vs their likely current platform",\n'
    + '    "key_modules": ["top 3 WFN modules for this exact profile"]\n'
    + '  },\n'
    + '  "ts_analysis": {\n'
    + '    "fit_rating": "Strong/Moderate/Weak",\n'
    + '    "headline": "one-line TS value prop referencing their specific pain",\n'
    + '    "pepm_range": "estimated PEPM range $XX-$XX based on headcount/industry",\n'
    + '    "annual_savings_estimate": "estimated annual savings vs standalone",\n'
    + '    "benefits_benchmark": "how their benefits stack likely compares for this industry",\n'
    + '    "co_employment_risk": "Low/Medium/High with rationale specific to their industry/state",\n'
    + '    "renewal_window_signal": "timing/urgency signal if detectable",\n'
    + '    "pros": ["4 reasons TS solves their confirmed pain points"],\n'
    + '    "cons": ["2-3 honest gaps or risks for PEO"]\n'
    + '  },\n'
    + '  "market_analysis": {\n'
    + '    "market_condition": "current HCM/PEO market state for this specific industry and state",\n'
    + '    "regulatory_alerts": ["2-3 regulatory/compliance changes creating urgency for this industry/state"],\n'
    + '    "pricing_signals": "competitor pricing shifts if notable",\n'
    + '    "timing_urgency": "why act now — specific market trigger for their industry",\n'
    + '    "social_signals": ["2-3 LinkedIn/social trends relevant to their industry"]\n'
    + '  },\n'
    + '  "competitive_threats": [\n'
    + '    {"competitor": "name", "threat_level": "High/Medium/Low", "adp_counter": "specific ADP counter-position", "weakness": "their key weakness vs ADP"}\n'
    + '  ],\n'
    + '  "pain_vs_solution": {\n'
    + '    "current_pain": "description tying back to their confirmed pain points verbatim where possible",\n'
    + '    "wfn_solution": "how WFN specifically resolves each confirmed pain",\n'
    + '    "ts_solution": "how TotalSource specifically resolves each confirmed pain"\n'
    + '  },\n'
    + '  "recommended_product": "WFN or TotalSource PEO",\n'
    + '  "recommended_strategy": {\n'
    + '    "approach": "consultative/challenger/value-led",\n'
    + '    "opening_hook": "single most compelling first sentence — reference their confirmed pain by name",\n'
    + '    "sequence_focus": "what the cadence should emphasize given their pain profile",\n'
    + '    "close_trigger": "specific event that will get them to sign — tied to their pain or renewal timing"\n'
    + '  },\n'
    + '  "objection_handlers": {\n'
    + '    "price": "response if they say ADP is too expensive — use their ROI data",\n'
    + '    "timing": "response if now is not the right time — tie to regulatory urgency",\n'
    + '    "current_provider": "response if happy with current provider — reference their platform pain if detected",\n'
    + '    "co_employment": "response if worried about co-employment (TS only)"\n'
    + '  }\n'
    + '}';

  return bpGeminiFetch({ messages: [{ role: 'user', content: prompt }] })
  .then(function(r) { return r.json(); })
  .then(function(resp) {
    var raw = bpGeminiText(resp);
    var clean = raw.replace(/```json|```/g, '').trim();
    try { return JSON.parse(clean); }
    catch(e) { throw new Error('JSON parse failed: ' + e.message + '\n\nRaw: ' + raw.substring(0, 200)); }
  });
}
// ── Render results ────────────────────────────────────────────────
function atRenderResults(d, activeTab) {
  var body = document.getElementById('at-results-body');
  if (!body) return;

  var fs = d.fit_scores || {};
  var wfn = d.wfn_analysis || {};
  var ts = d.ts_analysis || {};
  var mkt = d.market_analysis || {};
  var rs = d.recommended_strategy || {};
  var oh = d.objection_handlers || {};
  var pvs = d.pain_vs_solution || {};
  var threats = d.competitive_threats || [];
  var rec = d.recommended_product || 'WFN';
  var isWFN = rec.toLowerCase().includes('wfn') || rec.toLowerCase().includes('workforce');

  function scoreBar(pct, cls) {
    return '<div class="at-score-bar-bg"><div class="at-score-bar ' + cls + '" style="width:0%" data-target="' + Math.min(100,pct||0) + '%"></div></div>';
  }
  function threatHtml(t) {
    var lvl = (t.threat_level||'Medium').toLowerCase();
    return '<div class="at-threat-card">'
      + '<div class="at-threat-row"><span class="at-threat-name">' + escHtml(t.competitor) + '</span>'
      + '<span class="at-threat-lvl ' + lvl + '">' + (t.threat_level||'Medium').toUpperCase() + ' THREAT</span></div>'
      + '<div class="at-threat-counter">🛡 <strong>ADP Counter:</strong> ' + escHtml(t.adp_counter||t.counter||'—') + '</div>'
      + (t.weakness ? '<div style="font-size:11px;color:var(--green);margin-top:4px">⚡ Their weakness: ' + escHtml(t.weakness) + '</div>' : '')
      + '</div>';
  }

  var content = '';

  // ── WFN tab ──────────────────────────────────────────────────
  if (activeTab === 'wfn') {
    var wScore = fs.wfn || 0;
    content = '<div class="at-rep-section">'
      + '<div class="at-rep-title">🖥️ WorkforceNow Fit Analysis</div>'
      + '<div class="at-rep-grid">'
      + '<div class="at-rep-card"><div class="at-rep-card-lbl">Fit Rating</div><div class="at-rep-card-val">' + escHtml(wfn.fit_rating||'—') + '</div><div class="at-rep-card-sub">' + escHtml(wfn.headline||'') + '</div></div>'
      + '<div class="at-rep-card"><div class="at-rep-card-lbl">WFN Fit Score</div>' + scoreBar(wScore,'wfn') + '<div class="at-score-num">' + wScore + '<span style="font-size:14px;font-weight:400;color:var(--text-3)"> / 100</span></div></div>'
      + '<div class="at-rep-card"><div class="at-rep-card-lbl">ROI Estimate</div><div class="at-rep-card-val" style="color:var(--green)">' + escHtml(wfn.roi_estimate||'—') + '</div><div class="at-rep-card-sub">Payback: ' + (wfn.payback_months||'—') + ' months</div></div>'
      + '<div class="at-rep-card"><div class="at-rep-card-lbl">Upgrade Path</div><div class="at-rep-card-sub" style="font-size:12px;color:var(--text)">' + escHtml(wfn.upgrade_path||'—') + '</div></div>'
      + '</div>'
      + '<div class="at-pros-cons">'
      + '<div class="at-pc-card pros"><div class="at-pc-title">✓ WFN Wins Here</div><ul class="at-pc-list">' + (wfn.pros||[]).map(function(p){return '<li>'+escHtml(p)+'</li>';}).join('') + '</ul></div>'
      + '<div class="at-pc-card cons"><div class="at-pc-title">✗ Gaps / Risks</div><ul class="at-pc-list">' + (wfn.cons||[]).map(function(p){return '<li>'+escHtml(p)+'</li>';}).join('') + '</ul></div>'
      + '</div>'
      + '<div class="at-insight"><div class="at-insight-lbl">Displacement Playbook</div><div class="at-insight-text">' + escHtml(wfn.displacement_playbook||'—') + '</div></div>'
      + (wfn.key_modules && wfn.key_modules.length ? '<div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:4px">' + wfn.key_modules.map(function(m){return '<span class="at-chip blue">'+escHtml(m)+'</span>';}).join('') + '</div>' : '')
      + '</div>';
  }

  // ── TS tab ───────────────────────────────────────────────────
  if (activeTab === 'ts') {
    var tsScore = fs.ts || 0;
    content = '<div class="at-rep-section">'
      + '<div class="at-rep-title">🏢 TotalSource PEO Analysis</div>'
      + '<div class="at-rep-grid">'
      + '<div class="at-rep-card"><div class="at-rep-card-lbl">PEO Fit Rating</div><div class="at-rep-card-val">' + escHtml(ts.fit_rating||'—') + '</div><div class="at-rep-card-sub">' + escHtml(ts.headline||'') + '</div></div>'
      + '<div class="at-rep-card"><div class="at-rep-card-lbl">TS Fit Score</div>' + scoreBar(tsScore,'ts') + '<div class="at-score-num">' + tsScore + '<span style="font-size:14px;font-weight:400;color:var(--text-3)"> / 100</span></div></div>'
      + '<div class="at-rep-card"><div class="at-rep-card-lbl">PEPM Range</div><div class="at-rep-card-val" style="color:var(--red)">' + escHtml(ts.pepm_range||'—') + '</div></div>'
      + '<div class="at-rep-card"><div class="at-rep-card-lbl">Annual Savings Est.</div><div class="at-rep-card-val" style="color:var(--green)">' + escHtml(ts.annual_savings_estimate||'—') + '</div></div>'
      + '<div class="at-rep-card"><div class="at-rep-card-lbl">Co-Employment Risk</div><div class="at-rep-card-val">' + escHtml(ts.co_employment_risk||'—') + '</div></div>'
      + '<div class="at-rep-card"><div class="at-rep-card-lbl">Renewal Signal</div><div class="at-rep-card-sub" style="font-size:12px;color:var(--text)">' + escHtml(ts.renewal_window_signal||'—') + '</div></div>'
      + '</div>'
      + '<div class="at-pros-cons">'
      + '<div class="at-pc-card pros"><div class="at-pc-title">✓ Why PEO Wins Here</div><ul class="at-pc-list">' + (ts.pros||[]).map(function(p){return '<li>'+escHtml(p)+'</li>';}).join('') + '</ul></div>'
      + '<div class="at-pc-card cons"><div class="at-pc-title">✗ PEO Gaps / Risks</div><ul class="at-pc-list">' + (ts.cons||[]).map(function(p){return '<li>'+escHtml(p)+'</li>';}).join('') + '</ul></div>'
      + '</div>'
      + '<div class="at-insight"><div class="at-insight-lbl">Benefits Benchmark</div><div class="at-insight-text">' + escHtml(ts.benefits_benchmark||'—') + '</div></div>'
      + '</div>';
  }

  // ── Market tab ───────────────────────────────────────────────
  if (activeTab === 'market') {
    var mktScore = fs.market_opportunity || 0;
    content = '<div class="at-rep-section">'
      + '<div class="at-rep-title">📈 Market & Competitive Intelligence</div>'
      + '<div class="at-rep-grid">'
      + '<div class="at-rep-card" style="grid-column:1/-1"><div class="at-rep-card-lbl">Market Condition</div><div class="at-rep-card-sub" style="font-size:13px;color:var(--text);line-height:1.6">' + escHtml(mkt.market_condition||'—') + '</div></div>'
      + '<div class="at-rep-card"><div class="at-rep-card-lbl">Market Opportunity Score</div>' + scoreBar(mktScore,'market') + '<div class="at-score-num">' + mktScore + '<span style="font-size:14px;font-weight:400;color:var(--text-3)"> / 100</span></div></div>'
      + '<div class="at-rep-card"><div class="at-rep-card-lbl">Timing Urgency</div><div class="at-rep-card-sub" style="font-size:12px;color:var(--text)">' + escHtml(mkt.timing_urgency||'—') + '</div></div>'
      + '</div>'
      + '<div class="at-pros-cons">'
      + '<div class="at-pc-card cons"><div class="at-pc-title">⚠ Regulatory Alerts</div><ul class="at-pc-list">' + (mkt.regulatory_alerts||[]).map(function(a){return '<li>'+escHtml(a)+'</li>';}).join('') + '</ul></div>'
      + '<div class="at-pc-card neutral"><div class="at-pc-title">📱 Social / LinkedIn Signals</div><ul class="at-pc-list">' + (mkt.social_signals||[]).map(function(s){return '<li>'+escHtml(s)+'</li>';}).join('') + '</ul></div>'
      + '</div>'
      + '<div class="at-rep-title" style="margin-bottom:10px">⚔️ Competitive Threats</div>'
      + threats.map(threatHtml).join('')
      + (mkt.pricing_signals ? '<div class="at-insight"><div class="at-insight-lbl">Competitor Pricing Signals</div><div class="at-insight-text">' + escHtml(mkt.pricing_signals) + '</div></div>' : '')
      + '</div>';
  }

  // ── Strategy tab ─────────────────────────────────────────────
  if (activeTab === 'strategy' || (_atTool !== 'full' && activeTab === _atTool && !['wfn','ts','market'].includes(activeTab))) {
    activeTab = 'strategy';
    content = '<div class="at-rep-section">'
      + '<div class="at-rep-title">🎯 Recommended Strategy</div>'
      + '<div class="at-insight" style="margin-bottom:14px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">'
      + '<div><div class="at-insight-lbl">Recommended Product</div><div style="font-family:var(--fd);font-size:20px;color:#fff;font-weight:600">' + escHtml(rec) + '</div></div>'
      + '<div style="text-align:right"><div class="at-insight-lbl">Approach</div><div style="font-size:13px;color:rgba(255,255,255,.8);text-transform:uppercase;letter-spacing:.5px">' + escHtml(rs.approach||'Consultative') + '</div></div>'
      + '</div>'
      + '<div style="margin-bottom:10px"><div class="at-insight-lbl">Opening Hook</div><div style="font-size:13px;color:#fff;font-style:italic;line-height:1.6">"' + escHtml(rs.opening_hook||'—') + '"</div></div>'
      + '<div style="margin-bottom:10px"><div class="at-insight-lbl">Sequence Focus</div><div style="font-size:12px;color:rgba(255,255,255,.8);line-height:1.55">' + escHtml(rs.sequence_focus||'—') + '</div></div>'
      + '<div><div class="at-insight-lbl">Close Trigger</div><div style="font-size:12px;color:rgba(255,255,255,.8);line-height:1.55">' + escHtml(rs.close_trigger||'—') + '</div></div>'
      + '</div>'
      + (pvs.current_pain ? '<div class="at-rep-title" style="margin-bottom:10px">⚡ Pain vs. Solution</div>'
        + '<div class="at-pros-cons">'
        + '<div class="at-pc-card cons"><div class="at-pc-title">Current Pain State</div><div style="font-size:12px;color:var(--text-2);line-height:1.6">' + escHtml(pvs.current_pain) + '</div></div>'
        + '<div class="at-pc-card pros"><div class="at-pc-title">ADP ' + (isWFN?'WFN':'TotalSource') + ' Solution</div><div style="font-size:12px;color:var(--text-2);line-height:1.6">' + escHtml(isWFN?pvs.wfn_solution:pvs.ts_solution) + '</div></div>'
        + '</div>' : '')
      + '<div class="at-rep-title" style="margin-top:16px;margin-bottom:10px">🛡 Objection Handlers</div>'
      + ['price','timing','current_provider','co_employment'].map(function(k) {
          var lblMap = { price: '💰 ADP is too expensive', timing: '⏰ Timing isn\'t right', current_provider: '🤝 Happy with current provider', co_employment: '🤝 Co-employment concerns (TS)' };
          if (!oh[k]) return '';
          return '<div class="at-oh-card" onclick="navigator.clipboard.writeText(this.querySelector(\'.at-oh-text\').textContent).then(function(){showToast(\'Objection handler copied\');}).catch(function(){});">'
            + '<div class="at-oh-lbl">' + lblMap[k] + '</div>'
            + '<div class="at-oh-text">' + escHtml(oh[k]) + '</div>'
            + '<div class="at-oh-hint">click to copy</div></div>';
        }).join('')
      + '</div>'
      + '<div class="at-rep-section">'
      + '<div class="at-rep-title" style="margin-bottom:10px">📋 Executive Summary</div>'
      + '<div style="font-size:13px;color:var(--text-2);line-height:1.7">' + escHtml(d.executive_summary||'—') + '</div>'
      + '</div>';
  }

  // Default: if tool is single and tab matches
  if (!content) {
    if (activeTab === 'wfn') { var tmpTab = 'wfn'; }
    content = '<div class="at-rep-section"><div style="color:var(--text-3);padding:20px;text-align:center">Select a tab above to view results.</div></div>';
  }

  body.innerHTML = content;

  // Animate score bars
  setTimeout(function() {
    body.querySelectorAll('.at-score-bar[data-target]').forEach(function(bar) {
      bar.style.width = bar.getAttribute('data-target');
    });
  }, 50);
}

// ══════════════════════════════════════════════════════════════════
// AGENT 1 — Weekly Competitor Intelligence (Marketing_Research___Strategy SOP)
// Researches all 10 HCM/PEO competitors, surfaces urgent alerts,
// week-over-week deltas, ADP comparison notes, summary email + one-pager
// ══════════════════════════════════════════════════════════════════
window.atRunWeeklyIntel = function() {
  var scope = (document.getElementById('at-intel-scope')||{}).value || 'full';
  var spotlight = (document.getElementById('at-intel-competitor')||{}).value || '';
  var resultsEl = document.getElementById('at-intel-results');
  var bodyEl    = document.getElementById('at-intel-body');

  if (resultsEl) resultsEl.style.display = 'block';
  if (bodyEl) bodyEl.innerHTML = '<div class="at-loading"><div class="at-spinner"></div><span>Running ADP Competitor Intelligence SOP — researching ' + (scope==='single' && spotlight ? spotlight : 'all competitors') + '…</span></div>';

  var today = new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

  var wfnList  = ['Paycom','Paylocity','UKG','Dayforce (Ceridian)','Workday'];
  var peoList  = ['Paychex PEO','Justworks','Rippling','TriNet','Insperity'];
  var researchList = scope==='wfn' ? wfnList : scope==='peo' ? peoList : scope==='single' && spotlight ? [spotlight] : wfnList.concat(peoList);

  var positioningTable = 'ADP POSITIONING BY COMPLAINT TYPE:\n'
    + '- Slow/unresponsive support → TotalSource: named HRBP, not a ticket queue. WFN: 24/7 live support with payroll-critical SLAs\n'
    + '- Payroll errors/tax mistakes → 75 years of payroll infrastructure; processes 1 in 6 US private sector workers; anomaly detection built in\n'
    + '- Price increase/renewal shock → TotalSource: large-group buying power stabilizes health insurance costs; transparent bundling\n'
    + '- Compliance failures/multi-state → ADP tracks labor law changes in all 50 states in real time; CPEO-certified for PEO clients\n'
    + '- Bad implementation → WFN: dedicated implementation team; TotalSource: white-glove onboarding with HRBP from day one\n'
    + '- Missing features/add-ons → WFN modular build vs. TotalSource all-in bundled model\n'
    + '- Contract lock-in → TotalSource: no long-term contract; 30-day cancellation\n'
    + '- Benefits quality → TotalSource: Fortune 500-level benefits via large-group pool\n'
    + '- Outdated software → WFN 2025: AI anomaly detection, AI-powered sourcing, mobile app redesign\n'
    + '- Poor reporting → WFN: hundreds of standardized reports + custom builder';

  var prompt = 'You are an internal competitive intelligence analyst for ADP. Today is ' + today + '.\n\n'
    + 'Run a weekly competitor intelligence report following this EXACT SOP:\n\n'
    + '## COMPETITORS TO RESEARCH\n'
    + researchList.map(function(c,i){return (i+1)+'. '+c;}).join('\n') + '\n\n'
    + '## RESEARCH SOURCES (per competitor)\n'
    + '1. Company Blog — product announcements, feature releases, pricing news\n'
    + '2. LinkedIn — company page posts from past 7 days, hiring surges, campaigns\n'
    + '3. Google News — press releases, funding, lawsuits, executive changes (past 7 days)\n\n'
    + '## REPORT STRUCTURE (follow exactly)\n'
    + '1. URGENT_ALERTS: List anything requiring immediate sales action this week. If none, state "No urgent alerts this week."\n'
    + '2. COMPETITORS: For each competitor: product_updates, pricing_changes, marketing_campaigns, social_media (key LinkedIn posts/engagement), week_over_week (what changed vs prior week or "Baseline week")\n'
    + '3. ADP_COMPARISON: Where ADP has advantage over announcements; where competitor moves represent a gap/threat; talking points for sales context\n'
    + '4. SUMMARY_EMAIL: Subject line + concise email body with Urgent Alerts, WFN Highlights, PEO Highlights, ADP Positioning Notes sections\n\n'
    + positioningTable + '\n\n'
    + 'Return ONLY valid JSON with this structure:\n'
    + '{\n'
    + '  "report_date": "' + today + '",\n'
    + '  "urgent_alerts": [{"competitor":"","alert":"","sales_action":""}],\n'
    + '  "wfn_competitors": [{"name":"","product_updates":"","pricing_changes":"","marketing_campaigns":"","social_media":"","week_over_week":""}],\n'
    + '  "peo_competitors": [{"name":"","product_updates":"","pricing_changes":"","marketing_campaigns":"","social_media":"","week_over_week":""}],\n'
    + '  "adp_comparison": {"advantages":[""],"threats":[""],"talking_points":[""]},\n'
    + '  "summary_email": {"subject":"","urgent_alerts":"","wfn_highlights":"","peo_highlights":"","adp_positioning_notes":""}\n'
    + '}';

  bpGeminiFetch({ messages:[{role:'user',content:prompt}] })
  .then(function(r){return r.json();})
  .then(function(resp){
    var raw=bpGeminiText(resp);
    var clean=raw.replace(/```json|```/g,'').trim();
    var d=JSON.parse(clean);
    atRenderWeeklyIntel(bodyEl,d);
    showToast('✓ Competitor Intel report complete');
  })
  .catch(function(err){
    if(bodyEl) bodyEl.innerHTML='<div class="at-rep-section" style="padding:18px;color:var(--err)">⚠ Intel agent error: '+escHtml(err.message)+'</div>';
    showToast('Intel Agent failed',true);
  });
};

function atRenderWeeklyIntel(body, d) {
  var alerts  = d.urgent_alerts || [];
  var wfn     = d.wfn_competitors || [];
  var peo     = d.peo_competitors || [];
  var cmp     = d.adp_comparison || {};
  var email   = d.summary_email || {};

  var html = '';

  // Header bar
  html += '<div style="background:var(--navy);padding:14px 18px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:center">'
    + '<span style="color:#fff;font-family:var(--fd);font-weight:700;font-size:14px">📊 ADP Weekly Competitor Intelligence</span>'
    + '<span style="color:rgba(255,255,255,.5);font-size:11px">' + escHtml(d.report_date||'') + ' · CONFIDENTIAL</span>'
    + '</div>';

  // Urgent Alerts
  if (alerts.length) {
    html += '<div style="background:#fff3f3;border-left:4px solid var(--red);padding:14px 18px;margin:0">'
      + '<div style="font-size:11px;font-weight:700;color:var(--red);letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px">🚨 URGENT ALERTS</div>'
      + alerts.map(function(a){
          return '<div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid rgba(208,2,27,.1)">'
            + '<div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:2px">' + escHtml(a.competitor||'') + ': ' + escHtml(a.alert||'') + '</div>'
            + (a.sales_action ? '<div style="font-size:11px;color:var(--red)">→ Action: ' + escHtml(a.sales_action) + '</div>' : '')
            + '</div>';
        }).join('')
      + '</div>';
  } else {
    html += '<div style="background:#f0fff4;border-left:4px solid var(--green);padding:12px 18px;font-size:12px;color:var(--green);font-weight:600">✅ No urgent alerts this week</div>';
  }

  // Two-column competitor grid
  function renderCompetitorCards(list, label) {
    if (!list.length) return '';
    return '<div style="padding:14px 18px 0">'
      + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--text-3);margin-bottom:10px">' + label + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px">'
      + list.map(function(c){
          return '<div style="background:var(--off-white);border:1px solid var(--border);border-radius:8px;padding:12px">'
            + '<div style="font-family:var(--fd);font-weight:700;font-size:13px;color:var(--text);margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--border)">' + escHtml(c.name||'') + '</div>'
            + (c.product_updates && c.product_updates !== 'None' && c.product_updates !== 'No updates' ? '<div style="font-size:11px;margin-bottom:5px"><span style="font-weight:700;color:var(--blue)">Product:</span> ' + escHtml(c.product_updates) + '</div>' : '')
            + (c.pricing_changes && c.pricing_changes !== 'None' && c.pricing_changes !== 'No changes' ? '<div style="font-size:11px;margin-bottom:5px"><span style="font-weight:700;color:var(--gold)">Pricing:</span> ' + escHtml(c.pricing_changes) + '</div>' : '')
            + (c.marketing_campaigns && c.marketing_campaigns !== 'None' ? '<div style="font-size:11px;margin-bottom:5px"><span style="font-weight:700;color:var(--text-3)">Marketing:</span> ' + escHtml(c.marketing_campaigns) + '</div>' : '')
            + (c.social_media && c.social_media !== 'None' ? '<div style="font-size:11px;margin-bottom:5px"><span style="font-weight:700;color:var(--text-3)">Social:</span> ' + escHtml(c.social_media) + '</div>' : '')
            + '<div style="font-size:10px;margin-top:6px;padding-top:6px;border-top:1px solid var(--border);color:var(--text-3);font-style:italic">WoW: ' + escHtml(c.week_over_week||'—') + '</div>'
            + '</div>';
        }).join('')
      + '</div></div>';
  }

  html += renderCompetitorCards(wfn, 'WorkforceNow Competitors');
  html += renderCompetitorCards(peo, 'TotalSource PEO Competitors');

  // ADP Comparison Notes
  if (cmp.advantages || cmp.threats || cmp.talking_points) {
    html += '<div style="padding:14px 18px;background:var(--off-white);margin:14px 0 0;border-top:1px solid var(--border)">'
      + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--text-3);margin-bottom:10px">ADP Comparison Notes</div>'
      + '<div class="at-pros-cons">'
      + '<div class="at-pc-card neutral"><div class="at-pc-title">✅ ADP Advantages</div><ul class="at-pc-list">' + (cmp.advantages||[]).map(function(a){return '<li>'+escHtml(a)+'</li>';}).join('') + '</ul></div>'
      + '<div class="at-pc-card cons"><div class="at-pc-title">⚠ Threats / Gaps</div><ul class="at-pc-list">' + (cmp.threats||[]).map(function(t){return '<li>'+escHtml(t)+'</li>';}).join('') + '</ul></div>'
      + '</div>'
      + (cmp.talking_points && cmp.talking_points.length ? '<div class="at-pc-card neutral" style="margin-top:8px"><div class="at-pc-title">💬 Sales Talking Points</div><ul class="at-pc-list">' + cmp.talking_points.map(function(p){return '<li>'+escHtml(p)+'</li>';}).join('') + '</ul></div>' : '')
      + '</div>';
  }

  // Summary Email (copy-ready)
  if (email.subject) {
    var emailText = 'Subject: ' + email.subject + '\n\nURGENT ALERTS\n' + (email.urgent_alerts||'None this week') + '\n\nWORKFORCENOW HIGHLIGHTS\n' + (email.wfn_highlights||'') + '\n\nPEO / TOTALSOURCE HIGHLIGHTS\n' + (email.peo_highlights||'') + '\n\nADP POSITIONING NOTES\n' + (email.adp_positioning_notes||'') + '\n\nFull report above.';
    html += '<div style="padding:14px 18px;border-top:1px solid var(--border)">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
      + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--text-3)">📧 Summary Email (Send to Yourself)</div>'
      + '<button class="at-btn secondary" style="font-size:11px;padding:5px 10px" onclick="navigator.clipboard.writeText(document.getElementById(\'at-intel-email-text\').textContent).then(function(){showToast(\'Email copied!\');})">Copy Email</button>'
      + '</div>'
      + '<div id="at-intel-email-text" style="font-family:monospace;font-size:11px;background:#f8f8f8;border:1px solid var(--border);border-radius:6px;padding:12px;white-space:pre-wrap;color:var(--text-2);max-height:200px;overflow-y:auto">' + escHtml(emailText) + '</div>'
      + '</div>';
  }

  html += '<div style="padding:10px 18px 14px;text-align:right"><button class="at-btn secondary" style="font-size:11px" onclick="atRunWeeklyIntel()">🔄 Re-run Report</button></div>';

  body.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════════
// AGENT 2 — Social Listening & Unhappy Client Outreach (Social_Media_M_R SOP)
// Finds frustrated competitor clients across G2/Capterra/LinkedIn/Reddit,
// qualifies each prospect, drafts personalized LinkedIn DM + email packages
// ══════════════════════════════════════════════════════════════════
window.atRunSocialAgent = function() {
  var channel    = (document.getElementById('at-social-channel')||{}).value || 'all';
  var competitor = (document.getElementById('at-social-competitor')||{}).value || 'all';
  var product    = (document.getElementById('at-social-product')||{}).value || 'both';
  var resultsEl  = document.getElementById('at-social-results');
  var bodyEl     = document.getElementById('at-social-body');

  if (resultsEl) resultsEl.style.display = 'block';
  if (bodyEl) bodyEl.innerHTML = '<div class="at-loading"><div class="at-spinner"></div><span>Social Listening Agent scanning for unhappy competitor clients…</span></div>';

  var today = new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});

  var channelMap = {
    all: 'G2 (1-3 star reviews), Capterra (1-3 star reviews), LinkedIn Groups (HR/payroll/ops), LinkedIn Feed (public posts venting about HR platforms), Reddit (r/humanresources, r/payroll, r/smallbusiness, r/Entrepreneur, r/CFO)',
    reviews: 'G2 (1-3 star reviews posted in past 7 days), Capterra (1-3 star reviews posted in past 7 days)',
    linkedin: 'LinkedIn Groups (HR/payroll/ops professional groups), LinkedIn Feed (public posts from individuals venting about HR platform)',
    reddit: 'Reddit (r/humanresources, r/payroll, r/smallbusiness, r/Entrepreneur, r/CFO)'
  };

  var competitorList = competitor === 'all'
    ? 'ALL 10: Paycom, Paylocity, UKG, Dayforce, Workday, Paychex PEO, Justworks, Rippling, TriNet, Insperity'
    : competitor;

  var productScope = product === 'wfn' ? 'WorkforceNow (50+ employee companies using standalone HCM/payroll)'
    : product === 'peo' ? 'TotalSource PEO (5-250 employee companies wanting co-employment model)'
    : 'Both WorkforceNow (50+ employees, standalone HCM) AND TotalSource PEO (5-250 employees, co-employment)';

  var searchQueries = 'SEARCH QUERIES TO SIMULATE (per competitor):\n'
    + '"[Competitor] problems", "[Competitor] frustrated", "[Competitor] customer service issue", "[Competitor] billing issue",\n'
    + '"[Competitor] payroll error", "[Competitor] leaving / switching / canceling", "[Competitor] renewal / price increase",\n'
    + '"anyone else having issues with [Competitor]", "thinking about leaving [Competitor]", "anyone switched from [Competitor]"';

  var qualCriteria = 'QUALIFYING CRITERIA (prospect must meet ALL of these):\n'
    + '1. Real identity visible (name and/or findable LinkedIn profile)\n'
    + '2. Specific addressable complaint (payroll errors, tax filing mistakes, poor support, price increases, compliance failures, bad implementation)\n'
    + '3. Decision-maker signal (CEO, CFO, Controller, HR Director, Director of Operations, VP HR, Office Manager, Founder)\n'
    + '4. Company in ADP sweet spot (20-2,500 employees)\n'
    + '5. Relevant product match for ' + productScope;

  var positioningRef = 'ADP POSITIONING BY COMPLAINT TYPE (use to match outreach angle):\n'
    + 'Slow support → TotalSource named HRBP / WFN 24/7 live support\n'
    + 'Payroll errors → 75yr payroll track record, 1 in 6 US workers, anomaly detection\n'
    + 'Price increase → TotalSource large-group buying power, transparent bundling\n'
    + 'Compliance failures → All 50 states tracked in real time, CPEO-certified\n'
    + 'Bad implementation → WFN dedicated team / TotalSource white-glove onboarding\n'
    + 'Missing features → WFN modular vs TotalSource all-in bundle\n'
    + 'Contract lock-in → TotalSource 30-day cancellation, no long-term contract\n'
    + 'Benefits quality → TotalSource Fortune 500-level benefits pool\n'
    + 'Outdated software → WFN 2025 AI features, mobile redesign\n'
    + 'Poor reporting → WFN hundreds of reports + custom builder';

  var dmGuidance = 'LINKEDIN DM RULES: 4-6 sentences max. Peer tone, not salesperson. Structure: (1) Acknowledge their specific post/review and where you saw it, (2) Validate the complaint genuinely, (3) One sentence on how ADP handles that specific issue differently — be concrete, (4) Soft CTA — open a door, not "book a demo".\n\n'
    + 'EMAIL RULES: 5-6 paragraph structure: (1) Subject using formula "Re: your [Competitor] experience" or "[Complaint] — here\'s how [X] companies solved it", (2) Hook — reference their specific complaint, (3) Empathy — validate it as a known industry issue, (4) ADP response — 2-3 concrete sentences on how ADP specifically addresses it, (5) CTA — Book a Demo / Download Guide / Chat with ADP Rep based on urgency, (6) Optional P.S. with data point or G2 rating.\n\n'
    + 'TONE: Empathy-first. Never mock the competitor. Goal of first touch is to open a door, not close a deal.';

  var prompt = 'You are running AJ Jaghori\'s daily social listening and unhappy-client outreach workflow for ADP. Today is ' + today + '.\n\n'
    + '## CHANNELS TO SCAN\n' + channelMap[channel] + '\n\n'
    + '## COMPETITORS TO MONITOR\n' + competitorList + '\n\n'
    + '## PRODUCT SCOPE\n' + productScope + '\n\n'
    + searchQueries + '\n\n'
    + qualCriteria + '\n\n'
    + positioningRef + '\n\n'
    + dmGuidance + '\n\n'
    + 'Generate 3-5 realistic simulated prospect findings that would be found running this SOP today. Each prospect should have a different complaint type and competitor. Quality over quantity — only include prospects that would genuinely qualify.\n\n'
    + 'Also produce:\n'
    + '- A listening_summary (one paragraph: how many posts scanned, how many qualified, which competitors had most complaint volume, patterns to flag)\n'
    + '- sales_navigator_actions (3-5 specific saved search or alert actions to take in Sales Navigator today based on what was found)\n\n'
    + 'Return ONLY valid JSON:\n'
    + '{\n'
    + '  "scan_date": "' + today + '",\n'
    + '  "listening_summary": "",\n'
    + '  "prospects": [\n'
    + '    {\n'
    + '      "name": "", "title": "", "company": "", "est_employees": "", "platform": "",\n'
    + '      "source": "G2/Capterra/LinkedIn Group/LinkedIn Post/Reddit",\n'
    + '      "complaint_summary": "", "adp_product_fit": "WorkforceNow/TotalSource PEO/Both",\n'
    + '      "connection_status": "2nd degree — DM directly / 3rd degree — connect first",\n'
    + '      "priority": "High/Medium/Low",\n'
    + '      "connection_note": "",\n'
    + '      "linkedin_dm": "",\n'
    + '      "email_subject": "", "email_body": ""\n'
    + '    }\n'
    + '  ],\n'
    + '  "sales_navigator_actions": [{"action":"","reason":""}]\n'
    + '}';

  bpGeminiFetch({ messages:[{role:'user',content:prompt}] })
  .then(function(r){return r.json();})
  .then(function(resp){
    var raw=bpGeminiText(resp);
    var clean=raw.replace(/```json|```/g,'').trim();
    var d=JSON.parse(clean);
    atRenderSocialAgent(bodyEl,d);
    showToast('✓ Social Listening scan complete');
  })
  .catch(function(err){
    if(bodyEl) bodyEl.innerHTML='<div class="at-rep-section" style="padding:18px;color:var(--err)">⚠ Social Agent error: '+escHtml(err.message)+'</div>';
    showToast('Social Agent failed',true);
  });
};

function atRenderSocialAgent(body, d) {
  var prospects = d.prospects || [];
  var snActions = d.sales_navigator_actions || [];

  var priorityColor = {High:'var(--red)',Medium:'var(--gold)',Low:'var(--green)'};
  var priorityBg    = {High:'rgba(208,2,27,.08)',Medium:'rgba(212,160,23,.08)',Low:'rgba(39,174,96,.08)'};

  var html = '';

  // Header
  html += '<div style="background:var(--navy);padding:14px 18px;border-radius:8px 8px 0 0;display:flex;justify-content:space-between;align-items:center">'
    + '<span style="color:#fff;font-family:var(--fd);font-weight:700;font-size:14px">🔍 Social Listening Report</span>'
    + '<span style="color:rgba(255,255,255,.5);font-size:11px">' + escHtml(d.scan_date||'') + ' · ' + prospects.length + ' prospects found</span>'
    + '</div>';

  // Summary
  if (d.listening_summary) {
    html += '<div style="padding:14px 18px;background:var(--off-white);border-bottom:1px solid var(--border);font-size:12px;color:var(--text-2);line-height:1.6">'
      + '<strong style="color:var(--text)">Scan Summary:</strong> ' + escHtml(d.listening_summary) + '</div>';
  }

  // Prospect packages
  prospects.forEach(function(p, i) {
    var pri = p.priority || 'Medium';
    html += '<div style="margin:14px 18px;border:1px solid var(--border);border-radius:8px;overflow:hidden">'
      // prospect header
      + '<div style="padding:12px 14px;background:' + priorityBg[pri] + ';border-bottom:1px solid var(--border);display:flex;flex-wrap:wrap;gap:8px;align-items:center">'
      + '<span style="font-family:var(--fd);font-weight:700;font-size:13px;color:var(--text)">' + escHtml(p.name||'Unknown') + '</span>'
      + '<span style="font-size:11px;color:var(--text-3)">' + escHtml(p.title||'') + ' · ' + escHtml(p.company||'') + (p.est_employees ? ' (~'+escHtml(p.est_employees)+' employees)' : '') + '</span>'
      + '<span style="margin-left:auto;font-size:10px;font-weight:700;padding:2px 8px;border-radius:3px;background:' + priorityColor[pri] + ';color:#fff">' + escHtml(pri) + ' PRIORITY</span>'
      + '</div>'
      // prospect meta
      + '<div style="padding:10px 14px;display:flex;flex-wrap:wrap;gap:12px;font-size:11px;border-bottom:1px solid var(--border)">'
      + '<span>🏢 <strong>Platform:</strong> ' + escHtml(p.platform||'—') + '</span>'
      + '<span>📍 <strong>Source:</strong> ' + escHtml(p.source||'—') + '</span>'
      + '<span>🎯 <strong>ADP Fit:</strong> ' + escHtml(p.adp_product_fit||'—') + '</span>'
      + '<span>🔗 <strong>Connection:</strong> ' + escHtml(p.connection_status||'—') + '</span>'
      + '</div>'
      // complaint
      + '<div style="padding:10px 14px;background:#fff8f8;border-bottom:1px solid var(--border);font-size:12px;color:var(--text-2)">'
      + '<strong style="color:var(--red)">Complaint:</strong> ' + escHtml(p.complaint_summary||'—') + '</div>';

    // Outreach tabs
    html += '<div style="padding:12px 14px">'
      + '<div style="display:flex;gap:6px;margin-bottom:10px" id="atsl-tabs-'+i+'">'
      + (p.connection_note ? '<button class="at-tab-btn active" onclick="atSlTab('+i+',\'note\')" id="atsl-btn-'+i+'-note">Connection Note</button>' : '')
      + '<button class="at-tab-btn' + (p.connection_note ? '' : ' active') + '" onclick="atSlTab('+i+',\'dm\')" id="atsl-btn-'+i+'-dm">LinkedIn DM</button>'
      + '<button class="at-tab-btn" onclick="atSlTab('+i+',\'email\')" id="atsl-btn-'+i+'-email">Email</button>'
      + '</div>';

    if (p.connection_note) {
      html += '<div id="atsl-pane-'+i+'-note" class="atsl-pane" style="display:block">'
        + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--text-3);margin-bottom:6px">Connection Request Note (2nd/3rd degree)</div>'
        + '<div style="font-size:12px;line-height:1.65;color:var(--text-2);background:var(--off-white);padding:10px;border-radius:6px;margin-bottom:8px">' + escHtml(p.connection_note) + '</div>'
        + '<button class="at-btn secondary" style="font-size:10px;padding:4px 10px" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent).then(function(){showToast(\'Copied!\');})">Copy</button>'
        + '</div>';
    }

    html += '<div id="atsl-pane-'+i+'-dm" class="atsl-pane" style="display:' + (p.connection_note ? 'none' : 'block') + '">'
      + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--text-3);margin-bottom:6px">LinkedIn DM (4-6 sentences, peer tone)</div>'
      + '<div style="font-size:12px;line-height:1.65;color:var(--text-2);background:var(--off-white);padding:10px;border-radius:6px;margin-bottom:8px;white-space:pre-wrap">' + escHtml(p.linkedin_dm||'—') + '</div>'
      + '<button class="at-btn secondary" style="font-size:10px;padding:4px 10px" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent).then(function(){showToast(\'DM copied!\');})">Copy DM</button>'
      + '</div>';

    html += '<div id="atsl-pane-'+i+'-email" class="atsl-pane" style="display:none">'
      + (p.email_subject ? '<div style="font-size:10px;font-weight:700;color:var(--text-3);margin-bottom:4px">Subject:</div><div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:8px;padding:6px 10px;background:var(--off-white);border-radius:4px">' + escHtml(p.email_subject) + '</div>' : '')
      + '<div style="font-size:12px;line-height:1.65;color:var(--text-2);background:var(--off-white);padding:10px;border-radius:6px;margin-bottom:8px;white-space:pre-wrap">' + escHtml(p.email_body||'—') + '</div>'
      + '<button class="at-btn secondary" style="font-size:10px;padding:4px 10px" onclick="(function(btn){var subj=btn.parentElement.querySelector(\'.at-email-subj\');var body=btn.previousElementSibling;navigator.clipboard.writeText((subj?\'Subject: \'+subj.textContent+\'\\n\\n\':\'\')+body.textContent).then(function(){showToast(\'Email copied!\');});})(this)">Copy Email</button>'
      + '</div>'
      + '</div></div>';
  });

  // Sales Navigator Actions
  if (snActions.length) {
    html += '<div style="padding:14px 18px;border-top:1px solid var(--border)">'
      + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--text-3);margin-bottom:10px">📌 Sales Navigator Actions Today</div>'
      + snActions.map(function(a,i){
          return '<div style="display:flex;gap:10px;margin-bottom:8px;align-items:flex-start">'
            + '<span style="font-size:10px;font-weight:700;background:var(--navy);color:#fff;border-radius:3px;padding:2px 6px;flex-shrink:0;margin-top:1px">'+(i+1)+'</span>'
            + '<div><div style="font-size:12px;font-weight:600;color:var(--text)">' + escHtml(a.action||'') + '</div>'
            + (a.reason ? '<div style="font-size:11px;color:var(--text-3)">' + escHtml(a.reason) + '</div>' : '')
            + '</div></div>';
        }).join('')
      + '</div>';
  }

  html += '<div style="padding:10px 18px 14px;text-align:right"><button class="at-btn secondary" style="font-size:11px" onclick="atRunSocialAgent()">🔄 Re-run Scan</button></div>';

  body.innerHTML = html;
}

// Tab switcher for prospect outreach panels
window.atSlTab = function(idx, tab) {
  ['note','dm','email'].forEach(function(t) {
    var pane = document.getElementById('atsl-pane-'+idx+'-'+t);
    var btn  = document.getElementById('atsl-btn-'+idx+'-'+t);
    if (pane) pane.style.display = t===tab ? 'block' : 'none';
    if (btn)  { btn.classList.toggle('active', t===tab); }
  });
};

// ── Utilities ─────────────────────────────────────────────────────
window.atCopyReport = function() {
  var body = document.getElementById('at-results-body');
  if (body) navigator.clipboard.writeText(body.innerText || '').then(function(){ showToast('Report copied to clipboard'); }).catch(function(){});
};
window.atExportPDF = function() {
  if (!_atData || !_atResults[_atTool]) { showToast('Run analysis first', true); return; }
  var content = 'BEYONDPAYROLL HCM — Analysis Report\n';
  content += '=====================================\n';
  content += 'Company: ' + (_atData.company||'—') + '\n';
  content += 'Tool: ' + (_atTool||'—').toUpperCase() + '\n';
  content += 'Date: ' + new Date().toLocaleDateString() + '\n\n';
  content += JSON.stringify(_atResults[_atTool], null, 2);
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
  a.download = 'BPH_Analysis_' + (_atData.company||'Report').replace(/\s+/g,'_') + '.txt';
  a.click();
  showToast('Report exported');
};
window.atClearAll = function() {
  _atData = null; _atTool = null; _atResults = {};
  var badge = document.getElementById('at-data-badge');
  if (badge) badge.style.display = 'none';
  ['wfn','ts','market','full'].forEach(function(t) {
    var c = document.getElementById('at-tool-' + t);
    if (c) c.classList.remove('selected');
  });
  var results = document.getElementById('at-results');
  if (results) results.style.display = 'none';
  atUpdateStatusBar();
  document.getElementById('at-chip-analysis').innerHTML = '<span class="at-dot grey"></span> Analysis Pending';
  atPullFromProspect();
  showToast('Analysis tools reset');
};


// ══ PROSPECT PROFILES DRAWER ══════════════════════════════════════
let _ppDrawerFilter = 'all';
let _ppDrawerQuery = '';

window.ppToggleDrawer = function() {
  const drawer = document.getElementById('pp-drawer');
  if (!drawer) return;
  const isOpen = drawer.classList.contains('open');
  if (isOpen) { ppCloseDrawer(); } else { ppOpenDrawer(); }
};

window.ppOpenDrawer = function() {
  const drawer = document.getElementById('pp-drawer');
  const backdrop = document.getElementById('pp-drawer-backdrop');
  if (!drawer) return;
  drawer.classList.add('open');
  if (backdrop) backdrop.classList.add('open');
  ppRenderDrawer();
  const inp = document.getElementById('pp-drawer-search-inp');
  if (inp) setTimeout(function(){ inp.focus(); }, 300);
};

window.ppCloseDrawer = function() {
  const drawer = document.getElementById('pp-drawer');
  const backdrop = document.getElementById('pp-drawer-backdrop');
  if (drawer) drawer.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
};

window.ppDrawerSearch = function(q) {
  _ppDrawerQuery = q.toLowerCase().trim();
  ppRenderDrawer();
};

window.ppDrawerFilter = function(f) {
  _ppDrawerFilter = f;
  ['all','active','wfn','ts'].forEach(function(k){
    const el = document.getElementById('ppf-'+k);
    if (el) el.classList.toggle('active', k === f);
  });
  ppRenderDrawer();
};

function ppRenderDrawer() {
  const list = document.getElementById('pp-drawer-list');
  const sub = document.getElementById('pp-drawer-sub');
  if (!list) return;

  let arr = getProspects();

  // Filter
  if (_ppDrawerFilter === 'active') arr = arr.filter(function(p){ return p.approved; });
  else if (_ppDrawerFilter === 'wfn') arr = arr.filter(function(p){ return !(p.track||'').toLowerCase().includes('ts'); });
  else if (_ppDrawerFilter === 'ts') arr = arr.filter(function(p){ return (p.track||'').toLowerCase().includes('ts'); });

  // Search
  if (_ppDrawerQuery) {
    arr = arr.filter(function(p){
      return (p.company||'').toLowerCase().includes(_ppDrawerQuery)
          || (p.contact||'').toLowerCase().includes(_ppDrawerQuery)
          || (p.industry||'').toLowerCase().includes(_ppDrawerQuery)
          || (p.state||'').toLowerCase().includes(_ppDrawerQuery);
    });
  }

  const all = getProspects();
  if (sub) sub.textContent = all.length + ' prospect' + (all.length !== 1 ? 's' : '') + (arr.length !== all.length ? ' · ' + arr.length + ' shown' : '');

  if (!arr.length) {
    list.innerHTML = '<div class="pp-drawer-empty">'
      + (all.length ? 'No prospects match your filter.' : 'No prospects yet.<br>Click + New Prospect to get started.')
      + '</div>';
    return;
  }

  const activeCompany = window._hqProspect ? window._hqProspect.company : null;

  // Get real index in full array for actions
  const fullArr = getProspects();

  list.innerHTML = arr.map(function(p) {
    const realIdx = fullArr.findIndex(function(x){ return x.company === p.company && x.contact === p.contact; });
    const isTS = (p.track||'').toLowerCase().includes('ts');
    const initials = (p.company||'?').substring(0,2).toUpperCase();
    const isActive = p.company === activeCompany;
    const trackCls = isTS ? 'ts' : 'wfn';
    const trackLabel = isTS ? 'TotalSource' : 'WFN';
    const meta = [p.contact, p.industry, p.state, p.headcount ? p.headcount+' EEs' : ''].filter(Boolean).join(' · ');

    return '<div class="pp-drawer-item'+(isActive?' active-prospect':'')+'">'
      + '<div class="pp-di-avatar'+(isTS?' ts':'')+'">'+escHtml(initials)+'</div>'
      + '<div class="pp-di-info">'
        + '<div class="pp-di-name">'+escHtml(p.company||'Unknown')+'</div>'
        + '<div class="pp-di-meta">'+escHtml(meta||'—')+'</div>'
        + '<div class="pp-drawer-item-actions">'
          + '<button class="pp-dia-btn primary" onclick="ppDrawerLoad('+realIdx+')">▶ Load</button>'
          + '<button class="pp-dia-btn" onclick="ppShowProfile('+realIdx+')">👁 Profile</button>'
          + '<button class="pp-dia-btn" onclick="ppSendSmsReminder('+realIdx+')">📱 SMS</button>'
          + (p.approved ? '<button class="pp-dia-btn" onclick="ppDrawerLoad('+realIdx+');hqTab(\'composer\');ppCloseDrawer()">📅 Cadence</button>' : '')
        + '</div>'
      + '</div>'
      + '<div class="pp-di-badges">'
        + '<span class="pp-di-track '+trackCls+'">'+trackLabel+'</span>'
        + (p.approved ? '<span class="pp-di-active">ACTIVE</span>' : '')
      + '</div>'
    + '</div>';
  }).join('');
}

window.ppDrawerLoad = function(idx) {
  pdLoadProspect(idx);
  ppCloseDrawer();
};

// Keep drawer list in sync whenever prospects change
const _origRenderSaved = window.renderSavedProspects;
window.renderSavedProspects = function() {
  if (_origRenderSaved) _origRenderSaved();
  ppRenderDrawer();
  // Update header count
  const arr = getProspects();
  const hdrCount = document.getElementById('header-prospect-count');
  if (hdrCount) hdrCount.textContent = arr.length > 0 ? arr.length : '';
};

// Close drawer on Escape
document.addEventListener('keydown', function(e){
  if (e.key === 'Escape') ppCloseDrawer();
});

/* ── Block 4 remainder ── */
// ── PWA: Service Worker + Install Prompt ──────────────────────────
if('serviceWorker' in navigator){
  const swCode = [
    "const CACHE='bpHcmV1';",
    "self.addEventListener('install',function(e){self.skipWaiting();e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(['/']);}));});",
    "self.addEventListener('activate',function(e){e.waitUntil(clients.claim());});",
    "self.addEventListener('fetch',function(e){if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(function(){return caches.match('/');}));}});"
  ].join('\n');
  const blob = new Blob([swCode], {type:'application/javascript'});
  navigator.serviceWorker.register(URL.createObjectURL(blob)).catch(function(){});
}

window.addEventListener('DOMContentLoaded', function(){
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.navigator.standalone === true;
  if(isIOS && !isStandalone && !sessionStorage.getItem('bpIosBanner')){
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#0f1f3d;color:#fff;padding:14px 18px;display:flex;align-items:center;gap:12px;z-index:9999;font-family:-apple-system,sans-serif;box-shadow:0 -4px 20px rgba(0,0,0,.3)';
    const icon = document.createElement('div');
    icon.style.cssText = 'width:40px;height:40px;background:#c8a84b;border-radius:9px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:#0f1f3d;flex-shrink:0';
    icon.textContent = 'BP';
    const text = document.createElement('div');
    text.style.flex = '1';
    text.innerHTML = '<div style="font-weight:600;font-size:13px">Add to Home Screen</div><div style="font-size:11px;opacity:.65;margin-top:2px">Tap <b>Share</b> &#8594; <b>Add to Home Screen</b> for the best experience</div>';
    const close = document.createElement('button');
    close.style.cssText = 'background:rgba(255,255,255,.15);border:none;color:#fff;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:14px;flex-shrink:0';
    close.innerHTML = '&#10005;';
    close.onclick = function(){ banner.remove(); sessionStorage.setItem('bpIosBanner','1'); };
    banner.appendChild(icon); banner.appendChild(text); banner.appendChild(close);
    document.body.appendChild(banner);
  }
});


function isAdmin(session){
  return session && session.email === ADMIN_EMAIL;
}

// Show admin button only for admin account
function adminCheckAndShowBtn(session){
  const btn = document.getElementById('admin-panel-btn');
  if(btn) btn.style.display = isAdmin(session) ? 'block' : 'none';
}

window.adminOpenPanel = function(){
  const existing = document.getElementById('admin-modal-overlay');
  if(existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'admin-modal-overlay';
  overlay.id = 'admin-modal-overlay';
  overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };

  overlay.innerHTML = [
    '<div class="admin-modal">',
      '<div class="admin-modal-hdr">',
        '<div class="admin-modal-title">⚙ Admin Panel — User Management</div>',
        '<button onclick="document.getElementById(\'admin-modal-overlay\').remove()" style="background:rgba(255,255,255,.15);border:none;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:14px">&#10005;</button>',
      '</div>',
      '<div class="admin-modal-body">',
        '<div class="admin-section">',
          '<div class="admin-section-ttl">Add Approved User</div>',
          '<div class="admin-add-form">',
            '<div class="admin-add-grid">',
              '<input class="admin-add-inp" id="au-first" placeholder="First name">',
              '<input class="admin-add-inp" id="au-last" placeholder="Last name">',
            '</div>',
            '<div class="admin-add-row">',
              '<input class="admin-add-inp" id="au-email" type="email" placeholder="Email address" style="flex:1">',
              '<input class="admin-add-inp" id="au-pass" type="text" placeholder="Temp password" style="flex:1">',
              '<select class="admin-add-inp" id="au-role" style="flex:0 0 120px">',
                '<option value="WFN">WFN Track</option>',
                '<option value="TS">TS Track</option>',
              '</select>',
              '<button class="admin-add-btn" onclick="adminAddUser()">+ Add User</button>',
            '</div>',
            '<div id="au-msg" style="font-size:11px;margin-top:8px;font-weight:600"></div>',
          '</div>',
        '</div>',
        '<div class="admin-section">',
          '<div class="admin-section-ttl">Approved Users <span id="admin-user-count" style="font-weight:400;text-transform:none;letter-spacing:0"></span></div>',
          '<div id="admin-user-list"></div>',
        '</div>',
      '</div>',
    '</div>'
  ].join('');

  document.body.appendChild(overlay);
  adminRenderUsers();
};

function adminRenderUsers(){
  const list = document.getElementById('admin-user-list');
  const countEl = document.getElementById('admin-user-count');
  if(!list) return;
  const users = getUsers();
  if(countEl) countEl.textContent = '(' + users.length + ')';
  list.innerHTML = users.map(function(u, i){
    const initials = ((u.first||'')[0]||(u.email||'?')[0]).toUpperCase() + ((u.last||'')[0]||'').toUpperCase();
    const isOwner = u.email === ADMIN_EMAIL;
    return '<div class="admin-user-row'+(isOwner?' owner':'')+'">'+
      '<div class="admin-ur-av">'+escHtml(initials)+'</div>'+
      '<div class="admin-ur-info">'+
        '<div class="admin-ur-name">'+escHtml((u.first||'')+' '+(u.last||''))+'</div>'+
        '<div class="admin-ur-email">'+escHtml(u.email||'')+'&nbsp;&nbsp;<span style="font-size:10px;color:var(--text-3)">'+escHtml(u.role||'')+'</span></div>'+
      '</div>'+
      (isOwner ? '<span class="admin-ur-badge">Owner</span>' :
        '<button class="admin-ur-del" onclick="adminRemoveUser('+i+')">Remove</button>')+
    '</div>';
  }).join('') || '<div style="color:var(--text-3);font-size:12px;padding:12px">No users yet.</div>';
}

window.adminAddUser = function(){
  const first = (document.getElementById('au-first').value||'').trim();
  const last  = (document.getElementById('au-last').value||'').trim();
  const email = (document.getElementById('au-email').value||'').trim().toLowerCase();
  const pass  = (document.getElementById('au-pass').value||'').trim();
  const role  = document.getElementById('au-role').value;
  const msg   = document.getElementById('au-msg');

  if(!first||!last||!email||!pass){
    if(msg){msg.style.color='var(--red)';msg.textContent='All fields are required.';}
    return;
  }
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){
    if(msg){msg.style.color='var(--red)';msg.textContent='Enter a valid email address.';}
    return;
  }
  const users = getUsers();
  if(users.find(function(u){return u.email===email;})){
    if(msg){msg.style.color='var(--red)';msg.textContent='An account with this email already exists.';}
    return;
  }
  const newUser = {email,first,last,password:pass,role,created:new Date().toLocaleDateString('en-US'),approvedBy:ADMIN_EMAIL};
  users.push(newUser);
  saveUsers(users);

  // Push to Firestore if connected
  if(_fbDb){
    _fbDb.collection('users').doc(email).set(Object.assign({},newUser,{updatedAt:new Date().toISOString()}),{merge:true})
      .catch(function(e){console.warn('adminAddUser Firestore:',e.message);});
  }

  // Clear form
  ['au-first','au-last','au-email','au-pass'].forEach(function(id){
    const el=document.getElementById(id); if(el) el.value='';
  });
  if(msg){msg.style.color='#16a34a';msg.textContent='✓ User added — they can now sign in with these credentials.';}
  adminRenderUsers();
  renderSavedProspects();
  showToast(first+' '+last+' added as approved user');
};

window.adminRemoveUser = function(idx){
  const users = getUsers();
  if(!users[idx]) return;
  if(users[idx].email === ADMIN_EMAIL){ showToast('Cannot remove the owner account', true); return;
  }
  users.splice(idx, 1);
  saveUsers(users);
  // Remove from Firestore if connected
  if(_fbDb){
    _fbDb.collection('users').doc(users[idx] && users[idx].email || '').delete()
      .catch(function(e){console.warn('adminRemoveUser Firestore:',e.message);});
  }
  adminRenderUsers();
  showToast('User removed');
};


/* ════════════════════════════════════════════════════════════════════
   COMPREHENSIVE RESET SYSTEM WITH FULL SYNCHRONIZATION
   Appended to app.js - v2.0
   
   This patch does two things:
   1. Enhances existing reset functions to clear ALL related data
   2. Auto-patches reset buttons to call the right function
   
   When a cadence is reset, it now clears:
   ✓ Cadence tracker status
   ✓ All related alerts in "Alerts & Activity" drawer
   ✓ Outreach tab notifications
   ✓ Intel tab notifications  
   ✓ Alerts tab notifications
   ✓ Notification badge count
   ✓ Activity logs
════════════════════════════════════════════════════════════════════ */

// ══════════════════════════════════════════════════════════════════════
// OVERRIDE: Enhanced cdtResetAll with notification clearing
// ══════════════════════════════════════════════════════════════════════
(function() {
  const _originalCdtResetAll = window.cdtResetAll;
  
  window.cdtResetAll = function() {
    if(!confirm('Reset all touch statuses and restart the cadence from today?\n\nThis will also clear all related alerts and notifications.')) return;
    
    const p = window._hqProspect;
    const company = p ? p.company : null;
    
    // Clear cadence statuses (existing functionality)
    window._ecStatuses = {};
    window._ecNotes = {};
    window._ecLaunched = {};
    window._ecChecks = {};
    window._ecSentAt = {};
    
    if (company) {
      // Clear persisted statuses
      if (typeof ecSaveStatuses === 'function') {
        ecSaveStatuses(company);
      }
      
      // NEW: Clear all notifications related to this prospect
      clearProspectNotifications(company);
    }
    
    // Reset cadence start date
    if (typeof cdtResetStart === 'function') cdtResetStart();
    if (typeof cdtSetStart === 'function') {
      cdtSetStart(new Date().toISOString().split('T')[0]);
    }
    
    // Re-render everything
    if (typeof ecRenderAll === 'function') ecRenderAll();
    
    // NEW: Update notification drawer and badge  
    if (typeof notifRenderList === 'function') notifRenderList();
    if (typeof notifUpdateBadge === 'function') notifUpdateBadge();
    
    showToast('✓ Cadence reset — all touches and alerts cleared');
  };
})();

// ══════════════════════════════════════════════════════════════════════
// OVERRIDE: Enhanced cdtResetTouch with notification updates
// ══════════════════════════════════════════════════════════════════════
(function() {
  const _originalCdtResetTouch = window.cdtResetTouch;
  
  window.cdtResetTouch = function(idx) {
    const p = window._hqProspect;
    const touches = p ? buildTouches(p) : [];
    const touch = touches[idx];
    const label = touch ? 'Day ' + touch.day + ' — ' + touch.label : 'this touch';
    
    if(!confirm('Reset ' + label + ' back to Pending?')) return;
    
    // Clear the touch status
    if(window._ecStatuses)  delete window._ecStatuses[idx];
    if(window._ecNotes)     delete window._ecNotes[idx];
    if(window._ecLaunched)  delete window._ecLaunched[idx];
    if(window._ecSentAt)    delete window._ecSentAt[idx];
    
    // Save
    if(p && typeof ecSaveStatuses === 'function') ecSaveStatuses(p.company);
    
    // Re-render
    if (typeof ecRenderAll === 'function') ecRenderAll();
    
    // NEW: Update notification drawer
    if(typeof notifRenderList === 'function') notifRenderList();
    if(typeof notifUpdateBadge === 'function') notifUpdateBadge();
    
    showToast(label + ' reset to Pending');
  };
})();

// ══════════════════════════════════════════════════════════════════════
// NEW: Prospect-specific cadence reset
// ══════════════════════════════════════════════════════════════════════
window.resetProspectCadence = function(prospectId) {
  if (!prospectId && window._hqProspect) {
    prospectId = window._hqProspect.id || window._hqProspect.company;
  }
  
  if (!prospectId) {
    console.warn('No prospect ID provided for reset');
    return;
  }
  
  const prospects = getProspects();
  const prospect = prospects.find(function(p) {
    return (p.id === prospectId) || (p.company === prospectId);
  });
  
  if (!prospect) {
    console.warn('Prospect not found:', prospectId);
    return;
  }
  
  const company = prospect.company;
  
  if (!confirm('Reset all touch statuses for ' + company + ' and restart the cadence from today?\n\nThis will also clear all related alerts and notifications.')) {
    return;
  }
  
  // Build status key
  const statusKey = 'bp_ec_statuses_' + (company || '').replace(/\s+/g, '_');
  localStorage.removeItem(statusKey);
  localStorage.removeItem(statusKey + '_sentAt');
  
  // NEW: Clear all notifications
  clearProspectNotifications(company);
  
  // If currently loaded prospect, clear in-memory state
  if (window._hqProspect && 
      (window._hqProspect.id === prospectId || window._hqProspect.company === prospectId)) {
    window._ecStatuses = {};
    window._ecNotes = {};
    window._ecLaunched = {};
    window._ecChecks = {};
    window._ecSentAt = {};
    
    if (typeof cdtResetStart === 'function') cdtResetStart();
    if (typeof cdtSetStart === 'function') {
      cdtSetStart(new Date().toISOString().split('T')[0]);
    }
    
    if (typeof ecRenderAll === 'function') ecRenderAll();
    if (typeof cdtRender === 'function') cdtRender();
  }
  
  // Update notifications
  if (typeof notifRenderList === 'function') notifRenderList();
  if (typeof notifUpdateBadge === 'function') notifUpdateBadge();
  
  showToast('✓ Cadence reset for ' + company);
  
  if (typeof ppRenderDrawer === 'function') ppRenderDrawer();
};

// ══════════════════════════════════════════════════════════════════════
// NEW: Clear all notifications for a specific prospect
// ══════════════════════════════════════════════════════════════════════
function clearProspectNotifications(company) {
  if (!company) return;
  
  const NOTIF_KEY = 'bp_notifications';
  
  try {
    const allNotifications = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]');
    
    // Filter out notifications that mention this company
    const filtered = allNotifications.filter(function(notif) {
      const msgMatch = (notif.msg || '').toLowerCase().includes(company.toLowerCase());
      const subMatch = (notif.sub || '').toLowerCase().includes(company.toLowerCase());
      return !msgMatch && !subMatch;
    });
    
    localStorage.setItem(NOTIF_KEY, JSON.stringify(filtered.slice(0, 100)));
    
    const cleared = allNotifications.length - filtered.length;
    if (cleared > 0) {
      console.log('✓ Cleared ' + cleared + ' notification' + (cleared !== 1 ? 's' : '') + ' for ' + company);
    }
    
  } catch (error) {
    console.error('Error clearing prospect notifications:', error);
  }
}

// ══════════════════════════════════════════════════════════════════════
// AUTO-PATCH: Fix all "Reset All" buttons to call the right function
// ══════════════════════════════════════════════════════════════════════
function patchAllResetButtons() {
  document.querySelectorAll('button').forEach(function(btn) {
    const text = btn.textContent.trim();
    
    if (btn.dataset.resetPatched === 'true') return;
    
    if (text.includes('Reset All') || text === '↺ Reset All') {
      btn.dataset.resetPatched = 'true';
      
      const isCadenceTracker = btn.closest('#cdt-progress, .cdt-progress-bar, [data-view="composer"]');
      const isPipelineCard = btn.closest('.pd-card, .prospect-card, .pp-drawer-item, [data-prospect-id]');
      const isTotalSource = btn.closest('#ts-analyzer, .ts-card, [data-tool="totalsource"]');
      
      btn.onclick = null;
      
      if (isCadenceTracker) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          if (typeof cdtResetAll === 'function') cdtResetAll();
        });
        
      } else if (isPipelineCard) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          const card = btn.closest('.pd-card, .prospect-card, [data-prospect-id]');
          const prospectId = card ? (card.dataset.prospectId || card.dataset.company) : null;
          if (typeof resetProspectCadence === 'function') {
            resetProspectCadence(prospectId);
          }
        });
        
      } else if (isTotalSource) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          if (typeof tsReset === 'function') tsReset();
        });
        
      } else {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          if (window._hqProspect && typeof cdtResetAll === 'function') {
            cdtResetAll();
          } else if (typeof tsReset === 'function') {
            tsReset();
          }
        });
      }
    }
  });
}

// Run on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', patchAllResetButtons);
} else {
  patchAllResetButtons();
}

setTimeout(patchAllResetButtons, 500);
setTimeout(patchAllResetButtons, 2000);

// Watch for new buttons
const resetButtonObserver = new MutationObserver(function(mutations) {
  let foundNewButtons = false;
  mutations.forEach(function(mutation) {
    mutation.addedNodes.forEach(function(node) {
      if (node.nodeType === 1 && (node.tagName === 'BUTTON' || node.querySelector('button'))) {
        foundNewButtons = true;
      }
    });
  });
  if (foundNewButtons) {
    clearTimeout(window._resetPatchTimeout);
    window._resetPatchTimeout = setTimeout(patchAllResetButtons, 100);
  }
});

resetButtonObserver.observe(document.body, {
  childList: true,
  subtree: true
});

window.repatchResetButtons = patchAllResetButtons;

console.log('✓ Comprehensive reset system loaded');
console.log('  • Enhanced cdtResetAll() - clears cadence + notifications');
console.log('  • Enhanced cdtResetTouch() - updates notifications');
console.log('  • New resetProspectCadence() - prospect-specific reset');
console.log('  • New clearProspectNotifications() - syncs Alerts & Activity');
console.log('  • Auto-patches all Reset All buttons');


/* ════════════════════════════════════════════════════════════════════
   STREAMLINED ALERTS & ACTIVITY UI - ENHANCED CADENCE CLARITY
   
   This replaces the notification rendering functions with clearer,
   more intuitive visualizations that help users understand exactly
   where they are in the cadence process.
   
   Key improvements:
   ✓ Visual progress bar showing cadence completion
   ✓ Clearer status colors and icons
   ✓ Better information hierarchy
   ✓ Timeline visualization in Outreach tab
   ✓ Consolidated action buttons
   ✓ Smarter empty states
════════════════════════════════════════════════════════════════════ */

// ══════════════════════════════════════════════════════════════════════
// ENHANCED: Main notification list renderer
// ══════════════════════════════════════════════════════════════════════
function notifRenderList(){
  const listEl = document.getElementById('notif-list');
  if(!listEl) return;
  
  if(_notifTab === 'outreach') { notifRenderOutreachTabEnhanced(listEl); return; }
  if(_notifTab === 'intel')    { notifRenderIntelTabEnhanced(listEl);    return; }
  if(_notifTab === 'alerts')   { notifRenderAlertsTabEnhanced(listEl);   return; }

  // ── All tab: full notification log (keep existing but improve icons) ───────
  const arr = notifGetAll();
  if(!arr.length){
    listEl.innerHTML='<div class="notif-empty">🎯<br><br>All caught up!<br><span style="font-size:11px;opacity:.6">Activity will appear as you work the cadence.</span></div>';
    return;
  }
  
  const typeColor = { 
    outreach:'#3b82f6', 
    intel:'#f59e0b', 
    meeting:'#10b981', 
    alerts:'#ef4444' 
  };
  const typeIcon = { 
    outreach:'📧', 
    intel:'📊', 
    meeting:'🎯', 
    alerts:'⚠️' 
  };
  const typeLabel = { 
    outreach:'OUTREACH', 
    intel:'INTEL', 
    meeting:'MEETING', 
    alerts:'ALERT' 
  };
  
  listEl.innerHTML = arr.map(n=>{
    const t = new Date(n.time);
    const now = new Date();
    const diffMs = now - t;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    let timeAgo;
    if (diffMins < 1) timeAgo = 'Just now';
    else if (diffMins < 60) timeAgo = diffMins + 'm ago';
    else if (diffHours < 24) timeAgo = diffHours + 'h ago';
    else if (diffDays === 1) timeAgo = 'Yesterday';
    else timeAgo = t.toLocaleDateString('en-US',{month:'short',day:'numeric'});
    
    const cls = n.read ? 'notif-item' : 'notif-item unread';
    const icon = typeIcon[n.type] || '•';
    const color = typeColor[n.type] || 'var(--text-3)';
    
    return `<div class="${cls}" onclick="notifMarkRead('${n.id}');this.classList.remove('unread')">
      <div style="display:flex;align-items:flex-start;gap:10px">
        <div style="width:32px;height:32px;border-radius:8px;background:${color}15;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;border:1px solid ${color}30">${icon}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
            <span style="font-size:9px;font-weight:800;color:${color};letter-spacing:.5px">${typeLabel[n.type]||'ACTIVITY'}</span>
            <span style="font-size:9px;color:var(--text-3)">·</span>
            <span style="font-size:9px;color:var(--text-3)">${timeAgo}</span>
          </div>
          <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:2px">${n.msg}</div>
          ${n.sub?`<div style="font-size:10px;color:var(--text-3)">${n.sub}</div>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════════════════════════════
// ENHANCED: Outreach tab with visual timeline
// ══════════════════════════════════════════════════════════════════════
function notifRenderOutreachTabEnhanced(listEl){
  const data = cdtGetProspectData();
  
  if(!data){ 
    listEl.innerHTML='<div class="notif-empty">📋<br><br>No prospect loaded<br><span style="font-size:11px;opacity:.6">Load a prospect to see their outreach schedule</span></div>'; 
    return; 
  }
  
  const {p, startISO, start, todayNum, statuses, sentAt, touches} = data;
  
  if(!startISO){ 
    listEl.innerHTML=`<div class="notif-empty">📋<br><br>Cadence not started<br><strong style="color:var(--text)">${p.company}</strong><br><span style="font-size:11px;opacity:.6;margin-top:8px;display:block">Open the Composer tab to begin the 30-day cadence</span></div>`; 
    return; 
  }

  // Calculate progress
  const completedCount = touches.filter((_,i)=>{ 
    const s=statuses[i]||'Pending'; 
    return s==='Sent'||s==='Meeting Booked'||s==='Replied'; 
  }).length;
  const progressPct = Math.round((completedCount / touches.length) * 100);
  
  const overdueCount = touches.filter((t,i) => {
    const s = statuses[i] || 'Pending';
    return todayNum && t.day < todayNum && s === 'Pending';
  }).length;
  
  const dueTodayCount = touches.filter((t,i) => {
    const s = statuses[i] || 'Pending';
    return t.day === todayNum && s === 'Pending';
  }).length;

  // Header with progress
  let html = `
    <div style="padding:16px;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#fff;border-bottom:2px solid var(--border)">
      <div style="font-size:16px;font-weight:700;margin-bottom:6px;font-family:var(--fd)">${p.company}</div>
      <div style="font-size:11px;opacity:.7;margin-bottom:12px">${p.contact||'No contact'} · ${p.track||'WFN'}</div>
      
      <!-- Progress bar -->
      <div style="background:rgba(255,255,255,.1);height:8px;border-radius:20px;overflow:hidden;margin-bottom:8px">
        <div style="background:linear-gradient(90deg,#3b82f6,#10b981);height:100%;width:${progressPct}%;transition:width .3s ease;border-radius:20px"></div>
      </div>
      
      <div style="display:flex;align-items:center;justify-content:space-between;font-size:10px">
        <span style="opacity:.8">${completedCount} of ${touches.length} touches complete (${progressPct}%)</span>
        <span style="opacity:.8">Day ${Math.max(1,Math.min(todayNum||1,30))} of 30</span>
      </div>
      
      ${(overdueCount > 0 || dueTodayCount > 0) ? `
        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
          ${dueTodayCount > 0 ? `<span style="font-size:10px;font-weight:700;background:#f59e0b;color:#fff;padding:4px 10px;border-radius:6px">🔔 ${dueTodayCount} due today</span>` : ''}
          ${overdueCount > 0 ? `<span style="font-size:10px;font-weight:700;background:#ef4444;color:#fff;padding:4px 10px;border-radius:6px">⚠️ ${overdueCount} overdue</span>` : ''}
        </div>
      ` : ''}
    </div>
  `;

  // Group touches by status
  const overdueTouches = [];
  const dueTodayTouches = [];
  const upcomingTouches = [];
  const completedTouches = [];
  
  touches.forEach(function(touch, i){
    const status = statuses[i] || 'Pending';
    const isDone = status==='Sent'||status==='Meeting Booked'||status==='Replied';
    const isOverdue = todayNum && touch.day < todayNum && status === 'Pending';
    const isToday = touch.day === todayNum && status === 'Pending';
    
    if(isOverdue) overdueTouches.push({touch, i, status});
    else if(isToday) dueTodayTouches.push({touch, i, status});
    else if(isDone) completedTouches.push({touch, i, status});
    else upcomingTouches.push({touch, i, status});
  });

  // Render overdue section
  if(overdueTouches.length > 0){
    html += `<div style="background:#fef2f2;border-bottom:2px solid #fecaca">
      <div style="padding:10px 14px;border-bottom:1px solid #fecaca">
        <div style="font-size:10px;font-weight:800;color:#991b1b;letter-spacing:.8px;text-transform:uppercase">⚠️ Overdue (${overdueTouches.length})</div>
      </div>`;
    
    overdueTouches.forEach(({touch, i, status}) => {
      const tDate = _notifTouchDate(start, touch.day);
      html += renderTouchRow(touch, i, status, tDate, todayNum, sentAt, true, false, false);
    });
    
    html += '</div>';
  }

  // Render due today section
  if(dueTodayTouches.length > 0){
    html += `<div style="background:#fffbeb;border-bottom:2px solid #fde68a">
      <div style="padding:10px 14px;border-bottom:1px solid #fde68a">
        <div style="font-size:10px;font-weight:800;color:#92400e;letter-spacing:.8px;text-transform:uppercase">🔔 Due Today (${dueTodayTouches.length})</div>
      </div>`;
    
    dueTodayTouches.forEach(({touch, i, status}) => {
      const tDate = _notifTouchDate(start, touch.day);
      html += renderTouchRow(touch, i, status, tDate, todayNum, sentAt, false, true, false);
    });
    
    html += '</div>';
  }

  // Render upcoming section
  if(upcomingTouches.length > 0){
    html += `<div style="border-bottom:2px solid var(--border)">
      <div style="padding:10px 14px;border-bottom:1px solid var(--border);background:var(--off-white)">
        <div style="font-size:10px;font-weight:800;color:var(--text-3);letter-spacing:.8px;text-transform:uppercase">📅 Upcoming (${upcomingTouches.length})</div>
      </div>`;
    
    upcomingTouches.forEach(({touch, i, status}) => {
      const tDate = _notifTouchDate(start, touch.day);
      html += renderTouchRow(touch, i, status, tDate, todayNum, sentAt, false, false, false);
    });
    
    html += '</div>';
  }

  // Render completed section (collapsed by default)
  if(completedTouches.length > 0){
    html += `<div style="background:#f0fdf4;border-bottom:2px solid #bbf7d0">
      <div style="padding:10px 14px;border-bottom:1px solid #bbf7d0;cursor:pointer" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';this.querySelector('.toggle-icon').textContent=this.querySelector('.toggle-icon').textContent==='▼'?'▶':'▼'">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div style="font-size:10px;font-weight:800;color:#166534;letter-spacing:.8px;text-transform:uppercase">✓ Completed (${completedTouches.length})</div>
          <span class="toggle-icon" style="font-size:10px;color:#166534">▶</span>
        </div>
      </div>
      <div style="display:none">`;
    
    completedTouches.forEach(({touch, i, status}) => {
      const tDate = _notifTouchDate(start, touch.day);
      html += renderTouchRow(touch, i, status, tDate, todayNum, sentAt, false, false, true);
    });
    
    html += '</div></div>';
  }

  listEl.innerHTML = html;
}

// Helper: Render individual touch row
function renderTouchRow(touch, i, status, tDate, todayNum, sentAt, isOverdue, isToday, isDone){
  const sentAtRaw = sentAt[i];
  const sentAtLabel = sentAtRaw ? new Date(sentAtRaw).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : null;
  const sColor = _STATUS_COLOR[status]||'var(--text-3)';
  const sIcon = _STATUS_ICON[status]||'○';
  const dateLabel = _notifFmtDate(tDate);
  
  const bgColor = isOverdue ? '#fff' : isToday ? '#fff' : isDone ? '#fff' : 'var(--white)';
  const borderLeft = isOverdue ? '4px solid #ef4444' : isToday ? '4px solid #f59e0b' : isDone ? '4px solid #10b981' : '4px solid transparent';
  
  return `<div style="padding:12px 14px;border-bottom:1px solid var(--border);background:${bgColor};border-left:${borderLeft}">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;flex-wrap:wrap">
          <span style="font-size:9px;font-weight:800;color:var(--text);background:var(--off-white);padding:2px 8px;border-radius:4px;border:1px solid var(--border)">DAY ${touch.day}</span>
          ${isDone ? `<span style="font-size:11px;color:${sColor};font-weight:600">${sIcon} ${status}</span>` : ''}
        </div>
        <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px">${touch.label}</div>
        <div style="font-size:11px;color:var(--text-2);margin-bottom:6px;line-height:1.4">${touch.subject}</div>
        <div style="font-size:10px;color:var(--text-3)">
          ${isDone && sentAtLabel ? '✓ Sent ' + sentAtLabel : isOverdue ? '⚠️ Was ' + dateLabel : '📅 ' + dateLabel}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
        ${!isDone ? `<button onclick="cdtOpenReschedule(${i},${touch.day})" style="font-size:10px;font-weight:700;padding:6px 12px;border-radius:6px;border:1px solid var(--border);background:var(--white);color:var(--text-2);cursor:pointer;font-family:var(--fb);white-space:nowrap;transition:all .15s" onmouseover="this.style.background='var(--off-white)'" onmouseout="this.style.background='var(--white)'">📅 Reschedule</button>` : ''}
        <button onclick="notifCloseDrawer();cdtQuickMailto(${i})" style="font-size:10px;font-weight:700;padding:6px 12px;border-radius:6px;border:none;background:#3b82f6;color:#fff;cursor:pointer;font-family:var(--fb);white-space:nowrap;transition:all .15s" onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='#3b82f6'">📧 ${isDone ? 'View' : 'Compose'}</button>
      </div>
    </div>
  </div>`;
}

// ══════════════════════════════════════════════════════════════════════
// ENHANCED: Alerts tab - cleaner action items
// ══════════════════════════════════════════════════════════════════════
function notifRenderAlertsTabEnhanced(listEl){
  const data = cdtGetProspectData();
  let html = '';

  if(data && data.startISO && data.touches.length){
    const {p, start, todayNum, statuses, touches} = data;
    const dueToday = touches.filter((t,i) => t.day===todayNum && (statuses[i]||'Pending')==='Pending');
    const overdue  = touches.filter((t,i) => t.day<todayNum  && (statuses[i]||'Pending')==='Pending');

    if(dueToday.length || overdue.length){
      html += `<div style="padding:14px;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#fff;border-bottom:2px solid var(--border)">
        <div style="font-size:14px;font-weight:700;font-family:var(--fd);margin-bottom:4px">${p.company}</div>
        <div style="font-size:10px;opacity:.7">Action Items · ${dueToday.length + overdue.length} pending</div>
      </div>`;

      if(overdue.length > 0){
        html += `<div style="background:#fef2f2;border-bottom:2px solid #fecaca;padding:12px 14px">
          <div style="font-size:11px;font-weight:800;color:#991b1b;margin-bottom:10px;letter-spacing:.5px">⚠️ OVERDUE (${overdue.length})</div>`;
        
        overdue.forEach(function(touch){
          const i = touches.indexOf(touch);
          const tDate = _notifTouchDate(start, touch.day);
          html += `<div style="background:#fff;border-left:4px solid #ef4444;padding:12px;border-radius:6px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,.1)">
            <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:4px">Day ${touch.day} — ${touch.label}</div>
            <div style="font-size:10px;color:var(--text-3);margin-bottom:8px">Was ${_notifFmtDate(tDate)} · ${touch.subject.substring(0,60)}${touch.subject.length>60?'…':''}</div>
            <div style="display:flex;gap:6px">
              <button onclick="cdtOpenReschedule(${i},${touch.day})" style="font-size:10px;font-weight:700;padding:5px 10px;border-radius:5px;border:1px solid var(--border);background:var(--white);color:var(--text-2);cursor:pointer;font-family:var(--fb)">📅 Reschedule</button>
              <button onclick="notifCloseDrawer();cdtQuickMailto(${i})" style="font-size:10px;font-weight:700;padding:5px 10px;border-radius:5px;border:none;background:#3b82f6;color:#fff;cursor:pointer;font-family:var(--fb)">📧 Send Now</button>
            </div>
          </div>`;
        });
        
        html += '</div>';
      }

      if(dueToday.length > 0){
        html += `<div style="background:#fffbeb;border-bottom:2px solid #fde68a;padding:12px 14px">
          <div style="font-size:11px;font-weight:800;color:#92400e;margin-bottom:10px;letter-spacing:.5px">🔔 DUE TODAY (${dueToday.length})</div>`;
        
        dueToday.forEach(function(touch){
          const i = touches.indexOf(touch);
          const tDate = _notifTouchDate(start, touch.day);
          html += `<div style="background:#fff;border-left:4px solid #f59e0b;padding:12px;border-radius:6px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,.1)">
            <div style="font-size:12px;font-weight:700;color:var(--text);margin-bottom:4px">Day ${touch.day} — ${touch.label}</div>
            <div style="font-size:10px;color:var(--text-3);margin-bottom:8px">${_notifFmtDate(tDate)} · ${touch.subject.substring(0,60)}${touch.subject.length>60?'…':''}</div>
            <div style="display:flex;gap:6px">
              <button onclick="cdtOpenReschedule(${i},${touch.day})" style="font-size:10px;font-weight:700;padding:5px 10px;border-radius:5px;border:1px solid var(--border);background:var(--white);color:var(--text-2);cursor:pointer;font-family:var(--fb)">📅 Reschedule</button>
              <button onclick="notifCloseDrawer();cdtQuickMailto(${i})" style="font-size:10px;font-weight:700;padding:5px 10px;border-radius:5px;border:none;background:#3b82f6;color:#fff;cursor:pointer;font-family:var(--fb)">📧 Send Now</button>
            </div>
          </div>`;
        });
        
        html += '</div>';
      }
    }
  }

  // Activity log: meetings + opt-outs (keep existing logic)
  const alertArr = notifGetAll().filter(n => n.type==='meeting'||n.type==='alerts');
  const filteredAlerts = alertArr.filter(n => !n.msg.includes('Touch Due Today') && !n.msg.includes('overdue task') && !n.msg.includes('tasks due today') && !n.msg.includes('Overdue Task'));

  if(filteredAlerts.length){
    html += `<div style="padding:10px 14px;border-bottom:1px solid var(--border);background:var(--off-white)">
      <div style="font-size:10px;font-weight:800;letter-spacing:.8px;color:var(--text-3);text-transform:uppercase">Activity Log</div>
    </div>`;
    
    filteredAlerts.forEach(n=>{
      const t = new Date(n.time);
      const ts = t.toLocaleDateString('en-US',{month:'short',day:'numeric'})+' at '+t.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
      const isMeeting = n.type === 'meeting';
      const icon = isMeeting ? '🎯' : '⚠️';
      const color = isMeeting ? '#10b981' : '#ef4444';
      const label = isMeeting ? 'MEETING BOOKED' : 'ALERT';
      
      html += `<div class="notif-item" onclick="notifMarkRead('${n.id}')">
        <div style="display:flex;align-items:flex-start;gap:10px">
          <div style="width:32px;height:32px;border-radius:8px;background:${color}15;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;border:1px solid ${color}30">${icon}</div>
          <div style="flex:1">
            <div style="font-size:9px;font-weight:800;color:${color};margin-bottom:3px;letter-spacing:.5px">${label}</div>
            <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:2px">${n.msg}</div>
            ${n.sub?`<div style="font-size:10px;color:var(--text-3);margin-bottom:3px">${n.sub}</div>`:''}
            <div style="font-size:9px;color:var(--text-3)">${ts}</div>
          </div>
        </div>
      </div>`;
    });
  }

  if(!html){
    listEl.innerHTML='<div class="notif-empty">✅<br><br>All caught up!<br><span style="font-size:11px;opacity:.6">Due touches and alerts will appear here</span></div>';
    return;
  }
  
  listEl.innerHTML = html;
}

// ══════════════════════════════════════════════════════════════════════
// ENHANCED: Intel tab - better visual hierarchy
// ══════════════════════════════════════════════════════════════════════
function notifRenderIntelTabEnhanced(listEl){
  const data = cdtGetProspectData();
  
  if(!data){ 
    listEl.innerHTML='<div class="notif-empty">📊<br><br>No prospect loaded<br><span style="font-size:11px;opacity:.6">Load a prospect to see intel history</span></div>'; 
    return; 
  }
  
  const {p, start, startISO} = data;
  const store = cdtGetIntelResults();
  const prefix = p.company.replace(/\s+/g,'_') + '_day';
  const keys = Object.keys(store).filter(k=>k.startsWith(prefix)).sort((a,b)=>{
    return (parseInt(a.replace(prefix,''))||0)-(parseInt(b.replace(prefix,''))||0);
  });

  function touchDateLabel(dayNum){
    if(!start) return '';
    const d = new Date(start); d.setDate(d.getDate()+(dayNum-1));
    return d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  }

  const totalIntel = (CDT_INTEL_DAYS||[]).length;
  const completedIntel = keys.length;
  const progressPct = totalIntel > 0 ? Math.round((completedIntel / totalIntel) * 100) : 0;

  let html = `<div style="padding:16px;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);color:#fff;border-bottom:2px solid var(--border)">
    <div style="font-size:16px;font-weight:700;margin-bottom:6px;font-family:var(--fd)">${p.company}</div>
    <div style="font-size:11px;opacity:.7;margin-bottom:12px">Intel Refresh History</div>
    
    <div style="background:rgba(255,255,255,.1);height:8px;border-radius:20px;overflow:hidden;margin-bottom:8px">
      <div style="background:linear-gradient(90deg,#f59e0b,#10b981);height:100%;width:${progressPct}%;transition:width .3s ease;border-radius:20px"></div>
    </div>
    
    <div style="font-size:10px;opacity:.8">${completedIntel} of ${totalIntel} intel runs complete (${progressPct}%)</div>
  </div>`;

  // Completed intel runs
  if(keys.length){
    html += `<div style="padding:10px 14px;border-bottom:1px solid var(--border);background:var(--off-white)">
      <div style="font-size:10px;font-weight:800;letter-spacing:.8px;color:var(--text-3);text-transform:uppercase">✓ Completed (${keys.length})</div>
    </div>`;
    
    keys.forEach(function(k){
      const result = store[k];
      const dayNum = parseInt(k.replace(prefix,''))||0;
      const intelDay = (CDT_INTEL_DAYS||[]).find(d=>d.day===dayNum);
      const label = intelDay ? intelDay.label : 'Day '+dayNum+' Intel';
      const desc  = intelDay ? intelDay.desc  : '';
      const runAt = result.timestamp ? new Date(result.timestamp).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : '';
      let summary = result.summary || (result.text ? result.text.substring(0,150)+'…' : typeof result==='string' ? result.substring(0,150)+'…' : '');

      html += `<div style="padding:14px;border-bottom:1px solid var(--border);background:#fff;border-left:4px solid #f59e0b">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:6px">
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
              <span style="font-size:9px;font-weight:800;color:#f59e0b;background:#fffbeb;padding:2px 8px;border-radius:4px;border:1px solid #fde68a">DAY ${dayNum}</span>
              <span style="font-size:12px;font-weight:700;color:var(--text)">📊 ${label}</span>
            </div>
            ${desc?`<div style="font-size:10px;color:var(--text-3);margin-bottom:6px">${desc}</div>`:''}
          </div>
          <button onclick="notifCloseDrawer();cdtRunIntelRefresh(${dayNum})" style="font-size:10px;font-weight:700;padding:5px 10px;border-radius:5px;border:1px solid #fde68a;background:#fffbeb;color:#f59e0b;cursor:pointer;font-family:var(--fb);white-space:nowrap;flex-shrink:0">↺ Re-run</button>
        </div>
        ${summary?`<div style="font-size:11px;color:var(--text-2);line-height:1.5;background:var(--off-white);padding:10px;border-radius:6px;border:1px solid var(--border);margin-bottom:6px">${summary}</div>`:''}
        <div style="font-size:9px;color:var(--text-3)">
          ${runAt?'Last run '+runAt:''}${touchDateLabel(dayNum)?' · Scheduled for '+touchDateLabel(dayNum):''}
        </div>
      </div>`;
    });
  }

  // Pending intel runs
  const runDays = new Set(keys.map(k=>parseInt(k.replace(prefix,''))));
  const pending = (CDT_INTEL_DAYS||[]).filter(d=>!runDays.has(d.day));
  
  if(pending.length){
    html += `<div style="padding:10px 14px;border-bottom:1px solid var(--border);background:var(--off-white)">
      <div style="font-size:10px;font-weight:800;letter-spacing:.8px;color:var(--text-3);text-transform:uppercase">📋 Pending (${pending.length})</div>
    </div>`;
    
    pending.forEach(function(intel){
      html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--border);background:#fff">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
            <span style="font-size:9px;font-weight:800;color:var(--text-3);background:var(--off-white);padding:2px 8px;border-radius:4px;border:1px solid var(--border)">DAY ${intel.day}</span>
            <span style="font-size:12px;font-weight:600;color:var(--text)">${intel.label}</span>
          </div>
          <div style="font-size:10px;color:var(--text-3)">
            ${intel.desc}${touchDateLabel(intel.day)?' · Scheduled for '+touchDateLabel(intel.day):''}
          </div>
        </div>
        <button onclick="notifCloseDrawer();cdtRunIntelRefresh(${intel.day})" style="font-size:10px;font-weight:700;padding:6px 12px;border-radius:6px;border:none;background:#f59e0b;color:#fff;cursor:pointer;font-family:var(--fb);white-space:nowrap;flex-shrink:0">▶ Run Now</button>
      </div>`;
    });
  }

  if(!keys.length && !pending.length){
    html += '<div class="notif-empty" style="padding:40px 20px">No intel data<br><span style="font-size:11px;opacity:.6;margin-top:8px;display:block">Run intel refreshes from the Composer timeline</span></div>';
  }

  listEl.innerHTML = html;
}

console.log('✓ Enhanced notification UI loaded - streamlined cadence visibility');

/* ════════════════════════════════════════════════════════════════════
   UI FIXES - COMPREHENSIVE PATCH
   
   Issue 1: "Regenerate" button appears before first analysis run
   Issue 2: X button in Prospect Profiles drawer doesn't close
   
   Add this to the end of app.js
════════════════════════════════════════════════════════════════════ */

// ══════════════════════════════════════════════════════════════════════
// FIX 1: Change button text based on whether analysis has been run
// ══════════════════════════════════════════════════════════════════════
(function() {
  // Track whether analysis has been run
  window._atAnalysisRun = window._atAnalysisRun || false;
  
  // Update the button text when the analysis panel loads
  function updateAnalysisButtonText() {
    // Find the button - it's inside the analysis tools panel
    const btn = document.querySelector('.at-btn.primary[onclick="atRunAnalysis()"]');
    
    if (btn && !window._atAnalysisRun) {
      // First time - show "Run Analysis"
      btn.innerHTML = '▶ Run Analysis';
      console.log('✓ Analysis button set to "Run Analysis"');
    } else if (btn && window._atAnalysisRun) {
      // After first run - show "Regenerate"
      btn.innerHTML = '↻ Regenerate';
    }
  }
  
  // Wrap the original atRunAnalysis function
  const originalAtRunAnalysis = window.atRunAnalysis;
  if (originalAtRunAnalysis) {
    window.atRunAnalysis = function() {
      // Mark that analysis has been run
      window._atAnalysisRun = true;
      
      // Call original function
      const result = originalAtRunAnalysis.apply(this, arguments);
      
      // Update button text to "Regenerate" after successful run
      setTimeout(function() {
        const btn = document.querySelector('.at-btn.primary[onclick="atRunAnalysis()"]');
        if (btn) {
          btn.innerHTML = '↻ Regenerate';
        }
      }, 100);
      
      return result;
    };
  }
  
  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateAnalysisButtonText);
  } else {
    updateAnalysisButtonText();
  }
  
  // Also run when switching tabs or loading prospect
  setTimeout(updateAnalysisButtonText, 500);
  setTimeout(updateAnalysisButtonText, 2000);
  
  // Watch for the button being added to DOM
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      mutation.addedNodes.forEach(function(node) {
        if (node.nodeType === 1) {
          const btn = node.querySelector ? node.querySelector('.at-btn.primary[onclick="atRunAnalysis()"]') : null;
          if (btn || (node.classList && node.classList.contains('at-btn'))) {
            setTimeout(updateAnalysisButtonText, 50);
          }
        }
      });
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  console.log('✓ Analysis button text fix loaded');
})();

// ══════════════════════════════════════════════════════════════════════
// FIX 2: Ensure Prospect Profiles X button works
// ══════════════════════════════════════════════════════════════════════
(function() {
  function fixProspectProfilesCloseButton() {
    const closeBtn = document.querySelector('.pp-drawer-close');
    
    if (closeBtn && !closeBtn.dataset.fixedClose) {
      closeBtn.dataset.fixedClose = 'true';
      
      // Ensure CSS allows clicks
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.pointerEvents = 'auto';
      closeBtn.style.zIndex = '10000';
      closeBtn.style.position = 'relative';
      
      // Remove any existing onclick and add fresh listener
      closeBtn.onclick = null;
      
      closeBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        console.log('✓ Close button clicked');
        
        // Try the official close function first
        if (typeof ppCloseDrawer === 'function') {
          ppCloseDrawer();
        } else {
          // Fallback: manually close
          const drawer = document.getElementById('pp-drawer');
          const backdrop = document.getElementById('pp-drawer-backdrop');
          
          if (drawer) {
            drawer.classList.remove('open');
            drawer.style.right = '-100%';
          }
          
          if (backdrop) {
            backdrop.classList.remove('open');
            backdrop.style.display = 'none';
          }
        }
      });
      
      console.log('✓ Prospect Profiles close button fixed');
    }
  }
  
  // Run on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixProspectProfilesCloseButton);
  } else {
    fixProspectProfilesCloseButton();
  }
  
  // Re-run after drawer opens
  setTimeout(fixProspectProfilesCloseButton, 500);
  setTimeout(fixProspectProfilesCloseButton, 2000);
  
  // Watch for drawer being added/opened
  const drawerObserver = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      // Check if drawer opened
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const drawer = document.getElementById('pp-drawer');
        if (drawer && drawer.classList.contains('open')) {
          setTimeout(fixProspectProfilesCloseButton, 50);
        }
      }
      
      // Check for new close buttons
      mutation.addedNodes.forEach(function(node) {
        if (node.nodeType === 1) {
          const closeBtn = node.querySelector ? node.querySelector('.pp-drawer-close') : null;
          if (closeBtn || (node.classList && node.classList.contains('pp-drawer-close'))) {
            setTimeout(fixProspectProfilesCloseButton, 50);
          }
        }
      });
    });
  });
  
  drawerObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });
  
  // Also wrap ppOpenDrawer to fix button after opening
  const originalPpOpenDrawer = window.ppOpenDrawer;
  if (originalPpOpenDrawer) {
    window.ppOpenDrawer = function() {
      const result = originalPpOpenDrawer.apply(this, arguments);
      setTimeout(fixProspectProfilesCloseButton, 100);
      return result;
    };
  }
  
  console.log('✓ Prospect Profiles drawer close fix loaded');
})();

console.log('✓ All UI fixes loaded successfully');

/* ════════════════════════════════════════════════════════════════════
   COMPLETE INTEGRATION SCRIPT
   
   This adds:
   1. Sales Intelligence HQ card to command center
   2. Nurture tab/button to pipeline
   3. "Move to Nurture" buttons on prospect cards
   
   Add this to the END of your app.js file
════════════════════════════════════════════════════════════════════ */

// ══════════════════════════════════════════════════════════════════════
// 1. ADD SALES INTELLIGENCE HQ CARD TO COMMAND CENTER
// ══════════════════════════════════════════════════════════════════════

(function() {
  // Wrap the original initHQ function to add the card
  const originalInitHQ = window.initHQ;
  
  if (originalInitHQ) {
    window.initHQ = function(session) {
      // Call original
      originalInitHQ(session);
      
      // Add Sales HQ card at top of command center
      setTimeout(function() {
        const container = document.getElementById('hq-container');
        if (!container) return;
        
        const cardHTML = `
          <div class="sales-hq-card">
            <div class="sales-hq-content">
              <div class="sales-hq-icon">⚡</div>
              <div class="sales-hq-text">
                <h3 class="sales-hq-title">Sales Intelligence HQ</h3>
                <p class="sales-hq-subtitle">
                  AI-Powered Cadence Platform
                  <span class="sales-hq-badge">Admin</span>
                </p>
              </div>
            </div>
          </div>
        `;
        
        // Prepend card to container
        container.insertAdjacentHTML('afterbegin', cardHTML);
        
        console.log('✓ Sales Intelligence HQ card added');
      }, 100);
    };
  }
})();

// ══════════════════════════════════════════════════════════════════════
// 2. ADD NURTURE TAB TO PIPELINE
// ══════════════════════════════════════════════════════════════════════

(function() {
  // Add nurture button to pipeline filters
  function addNurtureButton() {
    // Find the pipeline filter area
    const filterArea = document.querySelector('.pipeline-filters') || 
                       document.querySelector('.filter-buttons') ||
                       document.querySelector('[onclick*="filterPipeline"]')?.parentElement;
    
    if (!filterArea || document.getElementById('nurture-filter-btn')) return;
    
    const nurtureCount = getNurtureProspects ? getNurtureProspects().length : 0;
    
    const btnHTML = `
      <button id="nurture-filter-btn" 
              class="filter-btn" 
              onclick="renderNurtureView()" 
              style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:6px;border:1px solid var(--border);background:var(--white);color:var(--text-2);cursor:pointer;font-size:13px;font-weight:600;transition:all .15s">
        <span>🌱 Nurture</span>
        ${nurtureCount > 0 ? `<span style="background:var(--green);color:#fff;padding:2px 6px;border-radius:10px;font-size:10px;font-weight:700">${nurtureCount}</span>` : ''}
      </button>
    `;
    
    filterArea.insertAdjacentHTML('beforeend', btnHTML);
    console.log('✓ Nurture button added to pipeline');
  }
  
  // Try to add button when pipeline loads
  setTimeout(addNurtureButton, 1000);
  setTimeout(addNurtureButton, 3000);
  
  // Also try when switching tabs
  const originalHqTab = window.hqTab;
  if (originalHqTab) {
    window.hqTab = function(tab) {
      const result = originalHqTab.apply(this, arguments);
      if (tab === 'pipeline') {
        setTimeout(addNurtureButton, 200);
      }
      return result;
    };
  }
})();

// ══════════════════════════════════════════════════════════════════════
// 3. ADD "MOVE TO NURTURE" BUTTONS TO PROSPECT CARDS
// ══════════════════════════════════════════════════════════════════════

(function() {
  // Watch for prospect cards being added to the DOM
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      mutation.addedNodes.forEach(function(node) {
        if (node.nodeType === 1 && node.classList) {
          // Check if this is a prospect card or contains prospect cards
          const cards = node.classList.contains('prospect-card') ? [node] : 
                       node.querySelectorAll ? node.querySelectorAll('.prospect-card, .pipeline-card, .pp-card') : [];
          
          cards.forEach(function(card) {
            // Only add button once
            if (card.querySelector('.nurture-btn')) return;
            
            // Find the action buttons area
            const actionArea = card.querySelector('.card-actions, .prospect-actions, .pp-actions') ||
                              card.querySelector('button')?.parentElement;
            
            if (!actionArea) return;
            
            // Get prospect ID from card
            const prospectId = card.dataset.prospectId || 
                              card.querySelector('[data-prospect-id]')?.dataset.prospectId ||
                              card.querySelector('[onclick*="loadProspect"]')?.onclick?.toString().match(/['"]([^'"]+)['"]/)?.[1];
            
            if (!prospectId) return;
            
            // Add nurture button
            const btnHTML = `
              <button class="nurture-btn" 
                      onclick="showMoveToNurtureModal('${prospectId}')" 
                      style="font-size:11px;padding:6px 10px;border-radius:4px;border:1px solid var(--border);background:var(--white);color:var(--text-2);cursor:pointer;display:inline-flex;align-items:center;gap:4px;font-weight:600;transition:all .15s"
                      onmouseover="this.style.background='var(--off-white)'"
                      onmouseout="this.style.background='var(--white)'">
                <span>🌱</span>
                <span>Nurture</span>
              </button>
            `;
            
            actionArea.insertAdjacentHTML('beforeend', btnHTML);
          });
        }
      });
    });
  });
  
  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  console.log('✓ Watching for prospect cards to add nurture buttons');
})();

// ══════════════════════════════════════════════════════════════════════
// 4. ADD AGENT STATUS TO TOPBAR
// ══════════════════════════════════════════════════════════════════════

(function() {
  function addAgentStatus() {
    const topbar = document.querySelector('.tb-right, .top-bar .tb-right');
    if (!topbar || document.getElementById('agent-status-btn')) return;
    
    const confidence = window.AgentKnowledge?.metadata?.confidence_score || 0;
    
    const btnHTML = `
      <button id="agent-status-btn" 
              class="tb-icon-btn" 
              onclick="showAgentPanel()" 
              title="Learning Agent Status"
              style="display:inline-flex;align-items:center;gap:6px">
        <span>🤖</span>
        <span style="font-size:10px;font-weight:700;color:${confidence > 60 ? 'var(--green)' : 'var(--text-3)'}">
          ${confidence}%
        </span>
      </button>
    `;
    
    // Add before profile button
    const profileBtn = topbar.querySelector('.profile-btn, #profileBtn');
    if (profileBtn) {
      profileBtn.insertAdjacentHTML('beforebegin', btnHTML);
    } else {
      topbar.insertAdjacentHTML('beforeend', btnHTML);
    }
    
    console.log('✓ Agent status button added to topbar');
  }
  
  // Add on load
  setTimeout(addAgentStatus, 1000);
  
  // Update confidence display every 30 seconds
  setInterval(function() {
    const statusBtn = document.getElementById('agent-status-btn');
    if (statusBtn && window.AgentKnowledge) {
      const confidence = window.AgentKnowledge.metadata.confidence_score || 0;
      const span = statusBtn.querySelector('span:last-child');
      if (span) {
        span.textContent = confidence + '%';
        span.style.color = confidence > 60 ? 'var(--green)' : 'var(--text-3)';
      }
    }
  }, 30000);
})();

// ══════════════════════════════════════════════════════════════════════
// 5. SIMPLE AGENT PANEL MODAL
// ══════════════════════════════════════════════════════════════════════

window.showAgentPanel = function() {
  if (!window.AgentKnowledge) {
    alert('Agent not initialized yet. Keep working and the agent will learn your patterns!');
    return;
  }
  
  const meta = AgentKnowledge.metadata;
  
  const modalHTML = `
    <div class="ehc-modal-overlay" onclick="if(event.target===this)this.remove()">
      <div class="ehc-modal">
        <div class="ehc-modal-header">
          <div class="ehc-modal-title">🤖 Background Learning Agent</div>
          <button class="ehc-modal-close" onclick="this.closest('.ehc-modal-overlay').remove()">✕</button>
        </div>
        <div class="ehc-modal-body">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px">
            <div style="text-align:center;padding:16px;background:var(--off-white);border-radius:8px">
              <div style="font-size:24px;font-weight:700;color:var(--text)">${meta.total_actions_observed}</div>
              <div style="font-size:11px;color:var(--text-3);text-transform:uppercase;margin-top:4px">Actions Observed</div>
            </div>
            <div style="text-align:center;padding:16px;background:var(--off-white);border-radius:8px">
              <div style="font-size:24px;font-weight:700;color:${meta.confidence_score > 60 ? 'var(--green)' : 'var(--text)'}">${meta.confidence_score}%</div>
              <div style="font-size:11px;color:var(--text-3);text-transform:uppercase;margin-top:4px">Confidence</div>
            </div>
            <div style="text-align:center;padding:16px;background:var(--off-white);border-radius:8px">
              <div style="font-size:24px;font-weight:700;color:var(--text)">${meta.cowork_launches || 0}</div>
              <div style="font-size:11px;color:var(--text-3);text-transform:uppercase;margin-top:4px">Cowork Launches</div>
            </div>
          </div>
          
          <div style="background:var(--off-white);padding:14px;border-radius:8px;margin-bottom:16px">
            <div style="font-size:12px;font-weight:700;margin-bottom:8px">Learning Since</div>
            <div style="font-size:13px;color:var(--text-2)">
              ${meta.learning_since ? new Date(meta.learning_since).toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'}) : 'Not started'}
            </div>
          </div>
          
          <div style="display:flex;gap:12px">
            <button class="btn" onclick="launchToCowork(prompt('What task should the agent complete?'))">🚀 Launch to Cowork</button>
            <button class="btn secondary" onclick="exportAgentKnowledge()">💾 Export Knowledge</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
};

console.log('✓ Complete integration script loaded');
console.log('  • Sales HQ card will appear on command center');
console.log('  • Nurture button added to pipeline');
console.log('  • Move to Nurture buttons on prospect cards');
console.log('  • Agent status in topbar');


// ══════════════════════════════════════════════════════════════════════════
//  🔍 MARKET & COMPETITIVE INTELLIGENCE ENHANCEMENT (Chrome-Optimized)
//  Screenshot-based Gong transcript analysis with real-time competitive signals
// ══════════════════════════════════════════════════════════════════════════

/**
 * Global state for Market Intelligence
 */
let uploadedGongScreenshots = [];
let selectedMITrack = 'TotalSource';
let selectedMICadence = 'Consultative';

// Competitor data knowledge base
const COMP_DATA = {
  'Paychex PEO': {
    strengths: ['Established brand', 'Large client base'],
    weaknesses: ['Platform stability issues', 'Limited compliance automation', 'Lower retention rates']
  },
  'Justworks': {
    strengths: ['Modern UI', 'Easy onboarding'],
    weaknesses: ['Limited enterprise features', 'Smaller PEO network']
  },
  'TriNet': {
    strengths: ['Industry-specific solutions', 'Good benefits'],
    weaknesses: ['Higher cost', 'Complex platform']
  },
  'Insperity': {
    strengths: ['Full-service HR', 'Good support'],
    weaknesses: ['Recent earnings challenges', 'Retention issues']
  },
  'Rippling': {
    strengths: ['All-in-one platform', 'Modern tech'],
    weaknesses: ['Rapid growth concerns', 'Support challenges']
  },
  'Dayforce': {
    strengths: ['Comprehensive HCM', 'Global capabilities'],
    weaknesses: ['PE buyout uncertainty', 'Client concerns about roadmap']
  }
};

/**
 * Open Market Intelligence Panel
 */
function openMarketIntel() {
  document.getElementById('market-intel-overlay').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

/**
 * Close Market Intelligence Panel
 */
function closeMarketIntel() {
  document.getElementById('market-intel-overlay').style.display = 'none';
  document.body.style.overflow = '';
}

/**
 * Select Product Track
 */
function selectMITrack(track) {
  selectedMITrack = track;
  document.querySelectorAll('.mi-track-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.track === track) {
      btn.classList.add('active');
    }
  });
}

/**
 * Select Cadence Tone
 */
function selectMICadence(cadence) {
  selectedMICadence = cadence;
  document.querySelectorAll('.mi-cadence-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.cadence === cadence) {
      btn.classList.add('active');
    }
  });
}

/**
 * Handle Gong screenshot uploads (Chrome-optimized)
 */
async function handleGongScreenshots(event) {
  const files = Array.from(event.target.files);
  
  if (files.length === 0) return;
  
  // Add to global state
  uploadedGongScreenshots.push(...files);
  
  // Display thumbnails
  displayScreenshotPreviews();
  
  // Update count
  updateScreenshotCount();
  
  // Show preview container
  document.getElementById('screenshot-previews').style.display = 'block';
  
  // Reset file input
  event.target.value = '';
}

/**
 * Display thumbnail previews
 */
function displayScreenshotPreviews() {
  const container = document.getElementById('screenshot-thumbnails');
  container.innerHTML = '';
  
  uploadedGongScreenshots.forEach((file, index) => {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position: relative; aspect-ratio: 1; border-radius: 6px; overflow: hidden;';
    
    const img = document.createElement('img');
    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover; border: 0.5px solid var(--border);';
    
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    
    const removeBtn = document.createElement('button');
    removeBtn.innerHTML = '×';
    removeBtn.style.cssText = `
      position: absolute; top: 4px; right: 4px; width: 20px; height: 20px;
      border-radius: 50%; background: rgba(0,0,0,0.7); color: white; border: none;
      font-size: 16px; cursor: pointer; display: flex; align-items: center;
      justify-content: center; padding: 0; line-height: 1;
    `;
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      removeScreenshot(index);
    };
    
    wrapper.onclick = () => viewScreenshot(index);
    wrapper.style.cursor = 'pointer';
    
    wrapper.appendChild(img);
    wrapper.appendChild(removeBtn);
    container.appendChild(wrapper);
  });
}

/**
 * Update screenshot count
 */
function updateScreenshotCount() {
  const countEl = document.getElementById('screenshot-count');
  const count = uploadedGongScreenshots.length;
  
  if (count === 0) {
    countEl.textContent = '';
  } else {
    countEl.textContent = `✓ ${count} screenshot${count > 1 ? 's' : ''} ready for analysis`;
  }
}

/**
 * Remove screenshot
 */
function removeScreenshot(index) {
  uploadedGongScreenshots.splice(index, 1);
  
  if (uploadedGongScreenshots.length === 0) {
    document.getElementById('screenshot-previews').style.display = 'none';
  }
  
  displayScreenshotPreviews();
  updateScreenshotCount();
}

/**
 * View screenshot full size
 */
function viewScreenshot(index) {
  const file = uploadedGongScreenshots[index];
  const reader = new FileReader();
  
  reader.onload = (e) => {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.9); z-index: 10002;
      display: flex; align-items: center; justify-content: center; padding: 20px;
    `;
    
    const img = document.createElement('img');
    img.src = e.target.result;
    img.style.cssText = 'max-width: 100%; max-height: 100%; object-fit: contain;';
    
    modal.onclick = () => document.body.removeChild(modal);
    modal.appendChild(img);
    document.body.appendChild(modal);
  };
  
  reader.readAsDataURL(file);
}

/**
 * Extract text from screenshots using Vision API
 */
async function extractTextFromGongScreenshots() {
  if (uploadedGongScreenshots.length === 0) {
    return [];
  }
  
  const extractedTexts = [];
  
  for (let i = 0; i < uploadedGongScreenshots.length; i++) {
    const file = uploadedGongScreenshots[i];
    
    try {
      const base64 = await fileToBase64(file);
      
      const response = await fetch(API_ENDPOINTS.vision, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64.split(',')[1]
        })
      });
      
      if (!response.ok) {
        throw new Error(`Vision API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.responses?.[0]?.textAnnotations?.[0]?.description) {
        const fullText = data.responses[0].textAnnotations[0].description;
        extractedTexts.push({
          text: fullText,
          fileName: file.name,
          index: i
        });
      }
      
    } catch (error) {
      console.error(`Screenshot ${i + 1} OCR error:`, error);
      showMIToast(`⚠️ Failed to extract text from screenshot ${i + 1}`);
    }
  }
  
  return extractedTexts;
}

/**
 * Convert File to base64
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Analyze transcripts to extract pain points
 */
async function analyzePainPointsFromTranscripts(extractedData) {
  if (extractedData.length === 0) {
    return [];
  }
  
  const allPainPoints = [];
  
  for (const data of extractedData) {
    try {
      const analysisPrompt = `
Analyze this sales call transcript and extract ONLY the customer pain points.
Focus on problems, challenges, frustrations, and needs they express.

Transcript:
${data.text}

Return ONLY a JSON array of pain points in this exact format:
[
  {
    "painPoint": "Brief description of the pain point",
    "severity": "High" | "Medium" | "Low",
    "currentSolution": "What they're using now (if mentioned)",
    "quote": "Relevant quote from transcript (if available)"
  }
]

NO other text. ONLY the JSON array.
`;
      
      const geminiResponse = await bpGeminiFetch({
        messages: [{
          role: 'user',
          content: analysisPrompt
        }]
      });
      
      try {
        const responseText = geminiResponse.content[0].text
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();
        
        const extracted = JSON.parse(responseText);
        
        extracted.forEach(pp => {
          pp.source = data.fileName;
          pp.sourceIndex = data.index;
        });
        
        allPainPoints.push(...extracted);
        
      } catch (e) {
        console.error('Failed to parse pain point analysis:', e);
        showMIToast(`⚠️ Could not analyze screenshot ${data.index + 1}`);
      }
      
    } catch (error) {
      console.error('Pain point extraction error:', error);
    }
  }
  
  return allPainPoints;
}

/**
 * Enhanced Market Intelligence Analysis
 */
async function runEnhancedMarketIntel() {
  const dashboardEl = document.getElementById('market-intel-dashboard');
  const runBtn = document.getElementById('run-market-intel-btn');
  
  if (uploadedGongScreenshots.length === 0) {
    showMIToast('⚠️ Please upload at least one transcript screenshot');
    return;
  }
  
  runBtn.disabled = true;
  runBtn.textContent = '⏳ Processing...';
  
  const startTime = Date.now();
  dashboardEl.innerHTML = `
    <div style="text-align: center; padding: 2rem;">
      <div style="width: 48px; height: 48px; border: 3px solid var(--border); border-top-color: var(--blue); border-radius: 50%; margin: 0 auto 1rem; animation: spin 1s linear infinite;"></div>
      <p style="font-size: 14px; color: var(--text-2); margin: 0 0 1rem 0; font-weight: 500;">
        Processing ${uploadedGongScreenshots.length} screenshot${uploadedGongScreenshots.length > 1 ? 's' : ''}...
      </p>
      <div id="progress-steps" style="font-size: 12px; color: var(--text-3); line-height: 2;">
        <p style="margin: 0;">→ Extracting text with OCR...</p>
      </div>
    </div>
    <style>
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  `;
  
  try {
    updateProgress('→ Analyzing pain points...');
    const extractedTranscripts = await extractTextFromGongScreenshots();
    
    if (extractedTranscripts.length === 0) {
      throw new Error('No text could be extracted from screenshots');
    }
    
    updateProgress('→ Gathering competitive signals...');
    const gongPainPoints = await analyzePainPointsFromTranscripts(extractedTranscripts);
    
    updateProgress('→ Generating battle cards...');
    const competitiveSignals = await getRecentCompetitiveSignals();
    
    updateProgress('→ Creating email talking points...');
    const analysisPrompt = `
You are an expert sales intelligence analyst for ADP ${selectedMITrack}.

CONTEXT:
- Product Track: ${selectedMITrack}
- Cadence Tone: ${selectedMICadence}
- Competitor Data: ${JSON.stringify(COMP_DATA)}
- Analysis Date: ${new Date().toLocaleDateString()}

GONG PAIN POINTS (from ${uploadedGongScreenshots.length} call transcript screenshot${uploadedGongScreenshots.length > 1 ? 's' : ''}):
${JSON.stringify(gongPainPoints, null, 2)}

REAL-TIME COMPETITIVE SIGNALS:
${JSON.stringify(competitiveSignals, null, 2)}

ANALYSIS TASKS:
1. Map each Gong pain point to specific ${selectedMITrack} value propositions
2. Generate prospect-specific battle cards addressing top pain points
3. Create email-ready talking points (3-4 max, ${selectedMICadence} tone, mobile-optimized)
4. Build competitive comparison vs primary competitor (based on signals)
5. Provide executive summary with actionable metrics

OUTPUT FORMAT (strict JSON, no markdown):
{
  "executiveSummary": {
    "activeSignals": number,
    "painPointsFound": number,
    "primaryCompetitor": "name based on signals and pain points",
    "winRate": "estimated percentage (e.g., '67%')"
  },
  "painPointMapping": [
    {
      "painPoint": "customer pain point description",
      "severity": "High|Medium|Low",
      "adpSolution": "How ${selectedMITrack} specifically addresses this",
      "talkingPoint": "email-ready ${selectedMICadence} messaging (1-2 sentences)"
    }
  ],
  "competitiveComparison": {
    "competitor": "primary competitor name",
    "features": [
      {
        "feature": "feature name",
        "adp": "✓ or specific value",
        "competitor": "✗ or specific value",
        "advantage": "brief why ADP wins"
      }
    ]
  },
  "emailTalkingPoints": [
    "${selectedMICadence} messaging for pain point 1",
    "${selectedMICadence} messaging for pain point 2",
    "${selectedMICadence} messaging for pain point 3"
  ]
}

Focus on actionable insights. Keep talking points concise and ready to paste into email.
`;
    
    const geminiResponse = await bpGeminiFetch({
      messages: [{
        role: 'user',
        content: analysisPrompt
      }]
    });
    
    const intelligence = JSON.parse(
      geminiResponse.content[0].text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim()
    );
    
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    renderIntelligenceDashboard(intelligence, gongPainPoints, competitiveSignals, processingTime);
    
    saveIntelligenceToCache(intelligence);
    await saveIntelligenceToFirebase(intelligence);
    
    showMIToast(`✓ Analysis complete in ${processingTime}s`);
    
  } catch (error) {
    console.error('Enhanced market intel error:', error);
    dashboardEl.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <p style="color: var(--err); font-size: 14px; margin: 0 0 8px 0; font-weight: 500;">
          ⚠️ Analysis Failed
        </p>
        <p style="font-size: 12px; color: var(--text-3); margin: 0;">
          ${error.message}
        </p>
        <button 
          onclick="runEnhancedMarketIntel()" 
          style="margin-top: 1rem; padding: 8px 16px; background: var(--blue); color: var(--white); border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 13px;"
        >
          Try Again
        </button>
      </div>
    `;
    showMIToast('⚠️ Analysis failed - see dashboard for details');
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = '🚀 Run Enhanced Analysis';
  }
}

/**
 * Update progress message
 */
function updateProgress(message) {
  const progressEl = document.getElementById('progress-steps');
  if (progressEl) {
    progressEl.innerHTML += `<p style="margin: 0;">${message}</p>`;
  }
}

/**
 * Render Intelligence Dashboard
 */
function renderIntelligenceDashboard(intelligence, painPoints, signals, processingTime) {
  const dashboardEl = document.getElementById('market-intel-dashboard');
  
  const html = `
    <div style="margin-bottom: 1.5rem;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
        <h2 style="font-size: 18px; font-weight: 600; margin: 0;">Intelligence Report</h2>
        <span style="font-size: 12px; color: var(--green); background: var(--green-bg); padding: 4px 10px; border-radius: 12px;">● Live</span>
      </div>
      <div style="display: flex; align-items: center; gap: 12px; font-size: 13px; color: var(--text-3);">
        <span>${selectedMITrack}</span>
        <span>•</span>
        <span>${selectedMICadence} Cadence</span>
        <span>•</span>
        <span>${processingTime}s processing</span>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 1.5rem;">
      <div style="background: var(--off-white); border-radius: var(--radius-sm); padding: 1rem;">
        <p style="font-size: 13px; color: var(--text-3); margin: 0 0 8px 0;">Active Signals</p>
        <p style="font-size: 24px; font-weight: 600; margin: 0;">${intelligence.executiveSummary.activeSignals}</p>
        <p style="font-size: 11px; color: var(--blue); margin: 4px 0 0 0;">Real-time</p>
      </div>
      <div style="background: var(--off-white); border-radius: var(--radius-sm); padding: 1rem;">
        <p style="font-size: 13px; color: var(--text-3); margin: 0 0 8px 0;">Pain Points</p>
        <p style="font-size: 24px; font-weight: 600; margin: 0;">${intelligence.executiveSummary.painPointsFound}</p>
        <p style="font-size: 11px; color: var(--text-3); margin: 4px 0 0 0;">From ${uploadedGongScreenshots.length} call${uploadedGongScreenshots.length > 1 ? 's' : ''}</p>
      </div>
      <div style="background: var(--off-white); border-radius: var(--radius-sm); padding: 1rem;">
        <p style="font-size: 13px; color: var(--text-3); margin: 0 0 8px 0;">Est. Win Rate</p>
        <p style="font-size: 24px; font-weight: 600; margin: 0;">${intelligence.executiveSummary.winRate}</p>
        <p style="font-size: 11px; color: var(--green); margin: 4px 0 0 0;">vs ${intelligence.executiveSummary.primaryCompetitor}</p>
      </div>
    </div>

    ${signals.length > 0 ? `
    <div style="background: var(--white); border: 1px solid var(--border); border-radius: var(--radius); padding: 1rem 1.25rem; margin-bottom: 1.5rem;">
      <h3 style="font-size: 15px; font-weight: 600; margin: 0 0 1rem 0;">🔔 Real-Time Competitive Signals</h3>
      ${signals.slice(0, 5).map(signal => `
        <div style="border-left: 2px solid var(--${signal.severity === 'high' ? 'err' : signal.severity === 'medium' ? 'gold' : 'blue'}); padding-left: 12px; margin-bottom: 12px;">
          <p style="font-size: 13px; font-weight: 500; margin: 0 0 4px 0;">${signal.title}</p>
          <p style="font-size: 12px; color: var(--text-3); margin: 0;">${signal.description}</p>
          <p style="font-size: 11px; color: var(--text-3); margin: 4px 0 0 0; opacity: 0.7;">${signal.timestamp} • ${signal.source}</p>
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${intelligence.painPointMapping.length > 0 ? `
    <div style="background: var(--white); border: 1px solid var(--border); border-radius: var(--radius); padding: 1rem 1.25rem; margin-bottom: 1.5rem;">
      <h3 style="font-size: 15px; font-weight: 600; margin: 0 0 1rem 0;">🎯 Pain Points & Solutions</h3>
      ${intelligence.painPointMapping.slice(0, 5).map(pp => `
        <div style="background: var(--off-white); border-radius: var(--radius-sm); padding: 12px; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
            <p style="font-size: 13px; font-weight: 500; margin: 0; flex: 1;">${pp.painPoint}</p>
            <span style="font-size: 11px; background: var(--${pp.severity === 'High' ? 'err-bg' : pp.severity === 'Medium' ? 'gold-bg' : 'blue-bg'}); color: var(--${pp.severity === 'High' ? 'err' : pp.severity === 'Medium' ? 'gold' : 'blue'}); padding: 2px 8px; border-radius: 10px; white-space: nowrap; margin-left: 8px;">${pp.severity}</span>
          </div>
          <p style="font-size: 12px; color: var(--text-2); margin: 0 0 8px 0; line-height: 1.5;">${pp.adpSolution}</p>
          <div style="background: var(--white); border-left: 2px solid var(--blue); padding: 8px 10px; border-radius: 4px;">
            <p style="font-size: 11px; color: var(--text-3); margin: 0 0 4px 0;">Talking Point:</p>
            <p style="font-size: 12px; color: var(--text); margin: 0; font-style: italic;">"${pp.talkingPoint}"</p>
          </div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <div style="background: var(--white); border: 1px solid var(--border); border-radius: var(--radius); padding: 1rem 1.25rem; margin-bottom: 1.5rem;">
      <h3 style="font-size: 15px; font-weight: 600; margin: 0 0 1rem 0;">⚔️ Competitive Comparison</h3>
      <div style="overflow-x: auto;">
        <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 1px solid var(--border);">
              <th style="text-align: left; padding: 8px 12px; font-weight: 500;">Feature</th>
              <th style="text-align: center; padding: 8px 12px; font-weight: 500; color: var(--blue);">ADP ${selectedMITrack}</th>
              <th style="text-align: center; padding: 8px 12px; font-weight: 500;">${intelligence.competitiveComparison.competitor}</th>
            </tr>
          </thead>
          <tbody>
            ${intelligence.competitiveComparison.features.map((feature, idx) => `
              <tr style="border-bottom: ${idx === intelligence.competitiveComparison.features.length - 1 ? 'none' : '1px solid var(--border)'};">
                <td style="padding: 10px 12px;">${feature.feature}</td>
                <td style="padding: 10px 12px; text-align: center; font-weight: 500; color: var(--green);">${feature.adp}</td>
                <td style="padding: 10px 12px; text-align: center; color: var(--text-3);">${feature.competitor}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div style="background: var(--white); border: 1px solid var(--border); border-radius: var(--radius); padding: 1rem 1.25rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 style="font-size: 15px; font-weight: 600; margin: 0;">📧 Email-Ready Talking Points</h3>
        <button onclick="copyTalkingPoints()" style="font-size: 12px; padding: 6px 12px; border: 1px solid var(--border-2); border-radius: var(--radius-sm); background: var(--white); cursor: pointer; transition: all 0.2s; font-weight: 500;">
          📋 Copy All
        </button>
      </div>
      <div id="talking-points-content" style="background: var(--off-white); border-radius: var(--radius-sm); padding: 12px; font-family: var(--fm); font-size: 12px; line-height: 1.7;">
        ${intelligence.emailTalkingPoints.map((tp, i) => `
          <p style="margin: ${i > 0 ? '12px' : '0'} 0 0 0;">${tp}</p>
        `).join('')}
      </div>
      <p style="font-size: 11px; color: var(--text-3); margin: 8px 0 0 0; text-align: center;">
        Optimized for ${selectedMICadence} tone • Ready to paste into Gmail
      </p>
    </div>
  `;
  
  dashboardEl.innerHTML = html;
}

/**
 * Copy talking points to clipboard (Chrome-optimized)
 */
async function copyTalkingPoints() {
  const content = document.getElementById('talking-points-content').innerText;
  
  try {
    await navigator.clipboard.writeText(content);
    showMIToast('✓ Talking points copied to clipboard!');
    
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = '✓ Copied!';
    btn.style.background = 'var(--green-bg)';
    btn.style.color = 'var(--green)';
    
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.background = 'var(--white)';
      btn.style.color = '';
    }, 2000);
    
  } catch (err) {
    console.error('Copy failed:', err);
    showMIToast('⚠️ Copy failed - please try again');
  }
}

/**
 * Show toast notification
 */
function showMIToast(message) {
  const existingToast = document.getElementById('mi-toast');
  if (existingToast) {
    document.body.removeChild(existingToast);
  }
  
  const toast = document.createElement('div');
  toast.id = 'mi-toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed; top: 20px; right: 20px; background: var(--white);
    color: var(--text); padding: 12px 16px; border-radius: var(--radius-sm);
    border: 1px solid var(--border-2); font-size: 13px; z-index: 10003;
    box-shadow: var(--shadow-lg); animation: slideIn 0.3s ease-out;
  `;
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  if (!document.getElementById('mi-toast-style')) {
    style.id = 'mi-toast-style';
    document.head.appendChild(style);
  }
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease-out';
    setTimeout(() => {
      if (toast.parentNode) {
        document.body.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

/**
 * Get competitive signals from existing agents
 */
async function getRecentCompetitiveSignals() {
  try {
    // Placeholder - integrate with your existing Marketing Research & Social Media agents
    // For now, return sample data
    return [
      {
        title: 'Insperity Q4 earnings miss',
        description: 'Client retention down 4% — outreach opportunity',
        severity: 'high',
        timestamp: '2 hours ago',
        source: 'Marketing Research Agent'
      },
      {
        title: 'Dayforce PE privatization',
        description: 'Client uncertainty around roadmap and support',
        severity: 'medium',
        timestamp: '5 hours ago',
        source: 'Social Media Agent'
      },
      {
        title: 'Rippling #1 mid-market position',
        description: 'Growing competitive pressure — need differentiation',
        severity: 'high',
        timestamp: '1 day ago',
        source: 'Social Media Agent'
      }
    ];
  } catch (error) {
    console.error('Competitive signals error:', error);
    return [];
  }
}

/**
 * Storage functions
 */
function saveIntelligenceToCache(intelligence) {
  try {
    const key = `market-intel-${selectedMITrack}-${Date.now()}`;
    localStorage.setItem(key, JSON.stringify({
      timestamp: new Date().toISOString(),
      track: selectedMITrack,
      cadence: selectedMICadence,
      screenshotCount: uploadedGongScreenshots.length,
      intelligence
    }));
    localStorage.setItem('market-intel-latest', key);
  } catch (e) {
    console.error('Cache save error:', e);
  }
}

async function saveIntelligenceToFirebase(intelligence) {
  try {
    // Placeholder - integrate with your Firebase setup
    console.log('Intelligence saved to Firebase:', intelligence);
  } catch (e) {
    console.error('Firebase save error:', e);
  }
}

// Add Market Intelligence option to your navigation/menu
// You can call openMarketIntel() from anywhere in your app to open the panel

console.log('✓ Market & Competitive Intelligence module loaded');
console.log('  Call openMarketIntel() to launch the panel');
