/* ═══════════════════════════════════════════
   MATRIX TODO — app.js
════════════════════════════════════════════ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDB_KH5ocr9IpUG3zo7h4UAUiePvlqXG54",
    authDomain: "eok-eok-eok.firebaseapp.com",
    projectId: "eok-eok-eok",
    storageBucket: "eok-eok-eok.firebasestorage.app",
    messagingSenderId: "1074375686114",
    appId: "1:1074375686114:web:0be6221509907ddf26ebbb",
    measurementId: "G-LYGTDV4L7M"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ── CONSTANTS ──────────────────────────────
const COLORS = ['#2D4A52','#7B6B5E','#8B5E52','#C4A882','#8B8B8B','#2C3E80','#E8305A','#4A90D9'];
const MATRIX = {
  do:       { label:'Do',       kr:'실행', color:'var(--do)',   cls:'do' },
  plan:     { label:'Plan',     kr:'계획', color:'var(--plan)', cls:'plan' },
  delegate: { label:'Delegate', kr:'위임', color:'var(--del)',  cls:'delegate' },
  eliminate:{ label:'Eliminate',kr:'제거', color:'var(--elim)', cls:'eliminate' },
};
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DAY_KR = { Mon:'월',Tue:'화',Wed:'수',Thu:'목',Fri:'금',Sat:'토',Sun:'일' };

// ── DATA LAYER ─────────────────────────────
const DB = {
  save(t) { setDoc(doc(db, "assets", "todo_tasks"), { items: t }); },
  saveMemos(m) { setDoc(doc(db, "assets", "todo_memos"), { items: m }); }
};

// ── STATE ──────────────────────────────────
let tasks = [];
let memos = [];
let currentTab = 'matrix';
let dbStatusFilter = 'incomplete';
let calDate = new Date();
let calSelected = new Date();
let editingId = null;
let quickDefaultMatrix = 'do';
let quickDefaultDate = null;
let quickSelectedMatrix = 'do';
let quickSelectedColor = COLORS[0];
let fullSelectedMatrix = 'do';
let fullSelectedColor = COLORS[0];
let fullTaskType = 'once';
let fullChecklist = [];
let fullRepeatDays = [];
let matrixStatusFilter = 'incomplete';

// ── UTILS ──────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function today() { return fmtDate(new Date()); }
function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}
function fmtDisplay(dateStr) {
  if (!dateStr) return '';
  const [y,m,d] = dateStr.split('-');
  return `${parseInt(m)}/${parseInt(d)}`;
}
function fmtMonthLabel(d) {
  return `${d.getFullYear()}년 ${d.getMonth()+1}월`;
}

// Check if a task is active on a given date
function isTaskOnDate(task, dateStr) {
  if (task.type === 'once') return task.date === dateStr;
  // repeat
  const start = task.startDate || task.date;
  const end   = task.endDate;
  if (dateStr < start) return false;
  if (end && dateStr > end) return false;
  if (!task.repeatDays || task.repeatDays.length === 0) return true;
  const dayMap = { 0:'Sun',1:'Mon',2:'Tue',3:'Wed',4:'Thu',5:'Fri',6:'Sat' };
  const d = new Date(dateStr + 'T00:00:00');
  return task.repeatDays.includes(dayMap[d.getDay()]);
}

// Check if a repeating routine is fully completed (all dates are checked)
function isRoutineFullyDone(task) {
  if (task.type !== 'repeat') return task.done;
  if (!task.endDate) return false; // Infinite routines are never fully "done"

  const start = task.startDate || task.date || today();
  const rawEnd = task.endDate;
  const completedDates = task.completedDates || [];
  const dayMap = {0:'Sun',1:'Mon',2:'Tue',3:'Wed',4:'Thu',5:'Fri',6:'Sat'};
  
  let cur = new Date(start+'T00:00:00');
  const endD = new Date(rawEnd+'T00:00:00');
  let requiredDates = 0;
  let finishedDates = 0;

  while (cur <= endD) {
    const ds = fmtDate(cur);
    const dow = dayMap[cur.getDay()];
    if (!task.repeatDays || task.repeatDays.length === 0 || task.repeatDays.includes(dow)) {
      requiredDates++;
      if (completedDates.includes(ds)) finishedDates++;
    }
    cur.setDate(cur.getDate()+1);
  }

  return requiredDates > 0 && finishedDates >= requiredDates;
}

// ── MINI MATRIX BUILDER ────────────────────
function buildMiniMx(type, size = 22) {
  const cells = ['do','plan','delegate','eliminate'];
  const colors = { do:'#FF4B6E', plan:'#3B6FE8', delegate:'#F5A623', eliminate:'#9BA3AF' };
  const spans = cells.map(c => {
    const active = (type === 'all') || (type === c);
    const color = active ? colors[c] : '#E5E7EB';
    return `<span style="background:${color};border-radius:${size > 24 ? 3 : 2}px;display:block"></span>`;
  }).join('');
  return `<div style="width:${size}px;height:${size}px;display:grid;grid-template-columns:1fr 1fr;gap:${size > 24 ? 3 : 2.5}px">${spans}</div>`;
}

function buildTaskMatrix(q, size = 20) {
  return buildMiniMx(q, size);
}

// ── NAVIGATION ─────────────────────────────
function navigate(tab) {
  currentTab = tab;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(`screen-${tab}`);
  if (el) el.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navEl = document.querySelector(`.nav-item[data-tab="${tab}"]`);
  if (navEl) navEl.classList.add('active');
  render(tab);
}

function render(tab) {
  if (tab === 'matrix')    renderMatrix();
  if (tab === 'dashboard') renderDashboard();
  if (tab === 'calendar')  renderCalendar();
  if (tab === 'stats')     renderStats();
  if (tab === 'memo')      renderMemos();
}

// ── MATRIX SCREEN ──────────────────────────
function renderMatrix() {
  const td = today();
  ['do','plan','delegate','eliminate'].forEach(q => {
    const container = document.getElementById(`q-${q}`);
    if (!container) return;
    
    // Base filter by quadrant & sort by date ascending
    let qTasks = tasks.filter(t => t.matrix === q)
                      .sort((a,b) => (a.date||'9999').localeCompare(b.date||'9999'));
                      
    // Status filter
    if (matrixStatusFilter === 'incomplete') {
      qTasks = qTasks.filter(t => !t.done);
    } else if (matrixStatusFilter === 'complete') {
      qTasks = qTasks.filter(t => t.done);
    }

    if (qTasks.length === 0) {
      container.innerHTML = `<p class="q-empty">${matrixStatusFilter === 'complete' ? '완료된 할 일이 없어요' : '모두 완료했어요! 🎉'}</p>`;
      return;
    }
    container.innerHTML = qTasks.map(t => {
      const isDone = t.done;
      const dateText = t.type === 'repeat' && t.endDate ? `${fmtDisplay(t.startDate||t.date)} ~ ${fmtDisplay(t.endDate)}` : fmtDisplay(t.date);
      return `
        <div class="q-task" data-q="${q}" data-id="${t.id}">
          <div class="q-cb ${isDone?'checked':''}" data-check="${t.id}"></div>
          <div class="q-task-info">
            <div class="q-task-title ${isDone?'done':''}">
              ${t.type==='repeat'?'<span style="font-size:9px;margin-right:2px">🔄</span>':''}
              ${esc(t.title)}
            </div>
            ${dateText?`<div class="q-task-date">${dateText}</div>`:''}
          </div>
        </div>`;
    }).join('');
  });
}

// ── DASHBOARD SCREEN ───────────────────────────
function renderDashboard() {
  document.querySelectorAll('#status-tabs .stab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.status === dbStatusFilter);
  });
  const list = document.getElementById('dashboard-list');
  if (!list) return;
  const td = today();
  let filtered = [...tasks].sort((a,b) => (a.date||'9999').localeCompare(b.date||'9999'));
  if (dbStatusFilter === 'incomplete') {
    filtered = filtered.filter(t => !t.done);
  } else if (dbStatusFilter === 'complete') {
    filtered = filtered.filter(t => t.done);
  }
  if (filtered.length === 0) {
    const icons = {complete:'🎉',incomplete:'✅',all:'📋'};
    const msgs  = {complete:'완료된 할 일이 없어요',incomplete:'모두 완료했어요! 🎉',all:'할 일을 추가해보세요'};
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">${icons[dbStatusFilter]}</div><p>${msgs[dbStatusFilter]}</p></div>`;
    return;
  }
  list.innerHTML = filtered.map(t => {
    const isDone = t.done;
    const dateText = t.type === 'repeat' && t.endDate ? `${fmtDisplay(t.startDate||t.date)} ~ ${fmtDisplay(t.endDate)}` : fmtDisplay(t.date);
    return `<div class="task-card-wrapper" data-id="${t.id}"><div class="task-card" data-q="${t.matrix}" data-id="${t.id}"><div class="tc-check ${isDone?'checked':''}" data-check="${t.id}">${isDone?'✓':''}</div><div class="tc-body"><div class="tc-title ${isDone?'done':''}">${t.type==='repeat'?'🔄 ':''}${esc(t.title)}</div><div class="tc-meta"><span class="tc-badge">${t.type==='repeat'?'반복':'한 번'}</span>${dateText?`<span class="tc-date">${dateText}</span>`:''}</div></div><div class="tc-matrix">${buildTaskMatrix(t.matrix,20)}</div></div><div class="delete-btn" data-delete-id="${t.id}"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>삭제</div></div>`;
  }).join('');
}


// ── CALENDAR SCREEN ────────────────────────
function renderCalendar() {
  document.getElementById('cal-month-label').textContent = fmtMonthLabel(calDate);

  const y = calDate.getFullYear();
  const m = calDate.getMonth();
  const firstDay = new Date(y, m, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const todayStr = today();
  const selStr   = fmtDate(calSelected);

  let html = '';
  // Leading blanks
  for (let i = 0; i < firstDay; i++) {
    const prevDate = new Date(y, m, -firstDay + i + 1);
    html += `<div class="cal-day other-month"><span class="cal-day-num">${prevDate.getDate()}</span></div>`;
  }
  // Days of month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayTasks = tasks.filter(t => isTaskOnDate(t, dateStr));
    const isToday   = dateStr === todayStr;
    const isSel     = dateStr === selStr;
    const dow       = new Date(y, m, d).getDay();
    const isSun     = dow === 0;
    const isSat     = dow === 6;
    const dots = dayTasks.slice(0,4).map(t => {
      const colors = { do:'#FF4B6E', plan:'#3B6FE8', delegate:'#F5A623', eliminate:'#9BA3AF' };
      return `<span class="cal-dot" style="background:${colors[t.matrix]}"></span>`;
    }).join('');
    html += `
      <div class="cal-day ${isToday?'today':''} ${isSel?'selected':''} ${isSun?'sunday':''} ${isSat?'saturday':''}"
           data-date="${dateStr}">
        <span class="cal-day-num">${d}</span>
        <div class="cal-dots">${dots}</div>
      </div>`;
  }

  document.getElementById('cal-grid').innerHTML = html;
  renderCalDayTasks(selStr);
}

function renderCalDayTasks(dateStr) {
  const [y,m,d] = dateStr.split('-');
  document.getElementById('cal-day-label').textContent = `${parseInt(m)}월 ${parseInt(d)}일 할 일`;
  const dayTasks = tasks.filter(t => isTaskOnDate(t, dateStr));
  const list = document.getElementById('cal-day-list');
  if (!list) return;
  if (dayTasks.length === 0) {
    list.innerHTML = `<div class="empty-state" style="padding:20px 0"><p>이 날은 할 일이 없어요</p></div>`;
    return;
  }
  list.innerHTML = dayTasks.map(t => `
    <div class="task-card" data-q="${t.matrix}" data-id="${t.id}">
      <div class="tc-check ${t.done?'checked':''}" data-check="${t.id}">${t.done ? '✓' : ''}</div>
      <div class="tc-body">
        <div class="tc-title ${t.done?'done':''}">${esc(t.title)}</div>
        <div class="tc-meta">
          <span class="tc-badge">${t.type === 'repeat' ? '반복' : '한 번'}</span>
          <span class="tc-date">${MATRIX[t.matrix].kr}</span>
        </div>
      </div>
      <div class="tc-matrix">${buildTaskMatrix(t.matrix, 20)}</div>
    </div>
  `).join('');
}

// ── STATS SCREEN ───────────────────────────
function isDoneOn(t, ds) {
  if (t.type === 'repeat') return (t.completedDates||[]).includes(ds);
  return t.done && (t.doneDate === ds || t.date === ds);
}
function renderStats() {
  const container = document.getElementById('stats-container');
  if (!container) return;
  const td = today();
  const total = tasks.length;
  const done  = tasks.filter(t => t.type==='repeat' ? (t.completedDates||[]).includes(td) : t.done).length;
  const pct   = total > 0 ? Math.round(done / total * 100) : 0;
  const qkeys = ['do','plan','delegate','eliminate'];
  const qColors = { do:'#FF4B6E', plan:'#3B6FE8', delegate:'#F5A623', eliminate:'#9BA3AF' };
  const donutData = qkeys.map(q => ({ q, count: tasks.filter(t => t.matrix===q).length, color: qColors[q] }));
  const qCompletion = qkeys.map(q => {
    const qt = tasks.filter(t => t.matrix===q);
    const qd = qt.filter(t => t.type==='repeat'?(t.completedDates||[]).includes(td):t.done).length;
    return { q, total:qt.length, done:qd, pct: qt.length>0?Math.round(qd/qt.length*100):0 };
  });
  const trendDays = [];
  for (let i=6;i>=0;i--) {
    const d=new Date(); d.setDate(d.getDate()-i);
    const ds=fmtDate(d);
    trendDays.push({ label:`${d.getMonth()+1}/${d.getDate()}`, count: tasks.filter(t=>isDoneOn(t,ds)).length });
  }
  container.innerHTML = `
    <div class="stats-card">
      <p class="stats-card-title">완료율</p>
      <div class="completion-rate">
        <span class="cr-pct">${pct}%</span>
        <div class="cr-counts">
          <div class="cr-count"><div class="val">${total}</div><div class="lbl">전체 할 일</div></div>
          <div class="cr-count"><div class="val">${done}</div><div class="lbl">완료</div></div>
        </div>
      </div>
      <div class="cr-bar-track"><div class="cr-bar" id="cr-bar" style="width:0%"></div></div>
    </div>
    <div class="stats-card">
      <p class="stats-card-title">사분면별 할 일 분포</p>
      <div class="donut-wrap">
        <svg class="donut-svg" viewBox="0 0 140 140">${buildDonut(donutData)}</svg>
        <div class="donut-legend">
          ${donutData.map(d=>`<div class="legend-item"><span class="legend-dot" style="background:${d.color}"></span><span class="legend-name">${MATRIX[d.q].kr}</span><span class="legend-val">${d.count}</span></div>`).join('')}
        </div>
      </div>
    </div>
    <div class="stats-card">
      <p class="stats-card-title">사분면별 완료율</p>
      <div class="quad-bar-row">
        ${qCompletion.map(qc=>`<div class="qb-item"><div class="qb-header"><span class="qb-label" style="color:${qColors[qc.q]}">${MATRIX[qc.q].kr}</span><span class="qb-pct" style="color:${qColors[qc.q]}">${qc.pct}%</span></div><div class="qb-track"><div class="qb-bar" data-w="${qc.pct}" style="width:0%;background:${qColors[qc.q]}"></div></div><span class="qb-sub">${qc.done}/${qc.total} 완료</span></div>`).join('')}
      </div>
    </div>
    <div class="stats-card">
      <p class="stats-card-title">최근 7일 완료 트렌드</p>
      <div class="line-chart-wrap">${buildLineChart(trendDays)}</div>
    </div>`;
  requestAnimationFrame(() => {
    const crBar = document.getElementById('cr-bar');
    if (crBar) crBar.style.width = pct + '%';
    document.querySelectorAll('.qb-bar').forEach(bar => { bar.style.width = bar.dataset.w + '%'; });
  });
}

function buildDonut(data) {
  const cx = 70, cy = 70, r = 54, stroke = 22;
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#E5E7EB" stroke-width="${stroke}"/>
            <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="14" font-weight="700" fill="#1C1C1E">0</text>
            <text x="${cx}" y="${cy+16}" text-anchor="middle" font-size="9" fill="#9BA3AF">할 일</text>`;
  }
  let paths = '';
  let startAngle = -90;
  const gap = total > 1 ? 3 : 0;
  data.forEach(d => {
    if (d.count === 0) return;
    const angle = (d.count / total) * 360;
    const endAngle = startAngle + angle - gap;
    paths += `<path d="${arcPath(cx,cy,r,startAngle,endAngle)}" fill="none" stroke="${d.color}" stroke-width="${stroke}" stroke-linecap="round"/>`;
    startAngle += angle;
  });
  return paths + `
    <text x="${cx}" y="${cy-4}" text-anchor="middle" dominant-baseline="middle" font-size="20" font-weight="800" fill="#1C1C1E">${total}</text>
    <text x="${cx}" y="${cy+14}" text-anchor="middle" font-size="9" fill="#9BA3AF">전체 할 일</text>`;
}

function arcPath(cx, cy, r, startDeg, endDeg) {
  const s = toRad(startDeg), e = toRad(endDeg);
  const sx = cx + r * Math.cos(s), sy = cy + r * Math.sin(s);
  const ex = cx + r * Math.cos(e), ey = cy + r * Math.sin(e);
  const large = (endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${ex} ${ey}`;
}
function toRad(deg) { return deg * Math.PI / 180; }

function buildLineChart(days) {
  const max = Math.max(...days.map(d => d.count), 1);
  const w = 280, h = 80, pad = 10;
  const pts = days.map((d, i) => ({
    x: pad + (i / (days.length - 1)) * (w - pad * 2),
    y: h - pad - (d.count / max) * (h - pad * 2),
    count: d.count, label: d.label,
  }));
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const fill = `${path} L ${pts[pts.length-1].x} ${h} L ${pts[0].x} ${h} Z`;

  return `
    <svg class="line-svg" viewBox="0 0 280 80">
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3B6FE8" stop-opacity=".3"/>
          <stop offset="100%" stop-color="#3B6FE8" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${fill}" fill="url(#lineGrad)"/>
      <path d="${path}" fill="none" stroke="#3B6FE8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${pts.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#3B6FE8" stroke="#fff" stroke-width="1.5"/>
        <text x="${p.x}" y="${p.y - 8}" text-anchor="middle" font-size="9" fill="#6B7280">${p.count || ''}</text>`).join('')}
    </svg>
    <div class="line-chart-labels">
      ${days.map(d => `<span>${d.label}</span>`).join('')}
    </div>`;
}

// ── QUICK ADD ──────────────────────────────
function openQuickAdd(defaultMatrix = 'do', defaultDate = null) {
  quickDefaultMatrix = defaultMatrix;
  quickSelectedMatrix = defaultMatrix;
  quickSelectedColor = COLORS[0];
  quickDefaultDate = defaultDate;

  // Set matrix selector
  document.querySelectorAll('#quick-matrix-sel .m-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.m === defaultMatrix);
    btn.innerHTML = `${buildMiniMx(btn.dataset.m, 28)}<span>${MATRIX[btn.dataset.m].kr}</span>`;
  });

  // Build color swatches
  renderColorSel('quick-color-sel', COLORS[0], (c) => { quickSelectedColor = c; });

  document.getElementById('quick-title').value = '';
  document.getElementById('quick-add-sheet').classList.add('open');
  document.getElementById('overlay').classList.add('show');
  setTimeout(() => document.getElementById('quick-title').focus(), 350);
}

function closeQuickAdd() {
  document.getElementById('quick-add-sheet').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}

function saveQuickTask() {
  const title = document.getElementById('quick-title').value.trim();
  if (!title) { document.getElementById('quick-title').focus(); return; }

  const t = {
    id: uid(), title, matrix: quickSelectedMatrix,
    color: quickSelectedColor, type: 'once',
    date: quickDefaultDate || today(), done: false, createdAt: Date.now(),
    checklist: [], repeatDays: [],
  };
  tasks.unshift(t);
  DB.save(tasks);
  closeQuickAdd();
  render(currentTab);
}

// ── FULL ADD ───────────────────────────────
function openFullAdd(defaultMatrix = 'do', defaultDate = null, defaultTitle = '') {
  editingId = null;
  fullSelectedMatrix = defaultMatrix;
  fullSelectedColor = COLORS[0];
  fullTaskType = 'once';
  fullChecklist = [];
  fullRepeatDays = [];

  const dateVal = defaultDate || today();
  document.getElementById('full-title').value = defaultTitle;
  document.getElementById('task-date').value = dateVal;
  document.getElementById('modal-date-label').textContent = formatDateLabel(dateVal);
  document.getElementById('repeat-start').value = defaultDate || today();
  document.getElementById('repeat-end').value = '';
  document.getElementById('notif-toggle').checked = false;
  document.getElementById('notif-time-row').style.display = 'none';

  // Matrix sel
  document.querySelectorAll('#full-matrix-sel .m-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.m === defaultMatrix);
    btn.innerHTML = `${buildMiniMx(btn.dataset.m, 28)}<span>${MATRIX[btn.dataset.m].kr}</span>`;
  });

  // Color sel
  renderColorSel('full-color-sel', COLORS[0], (c) => { fullSelectedColor = c; });

  // Checklist
  renderChecklist();

  // Type
  setTaskType('once');

  // Day buttons
  document.querySelectorAll('#day-sel .day-btn').forEach(b => b.classList.remove('active'));

  document.getElementById('full-add-modal').classList.add('open');
  setTimeout(() => document.getElementById('full-title').focus(), 350);
}

function openEditTask(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  editingId = id;

  fullSelectedMatrix = t.matrix;
  fullSelectedColor  = t.color || COLORS[0];
  fullTaskType       = t.type || 'once';
  fullChecklist      = (t.checklist || []).map(c => ({...c}));
  fullRepeatDays     = [...(t.repeatDays || [])];

  document.getElementById('full-title').value = t.title;
  const dateVal = t.date || today();
  document.getElementById('task-date').value = dateVal;
  document.getElementById('modal-date-label').textContent = formatDateLabel(dateVal);
  document.getElementById('repeat-start').value = t.startDate || today();
  document.getElementById('repeat-end').value   = t.endDate   || '';
  
  document.getElementById('notif-toggle').checked = !!t.notificationTime;
  document.getElementById('notif-time-row').style.display = t.notificationTime ? '' : 'none';
  document.getElementById('notif-time').value = t.notificationTime || '';

  document.querySelectorAll('#full-matrix-sel .m-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.m === t.matrix);
    btn.innerHTML = `${buildMiniMx(btn.dataset.m, 28)}<span>${MATRIX[btn.dataset.m].kr}</span>`;
  });

  renderColorSel('full-color-sel', fullSelectedColor, (c) => { fullSelectedColor = c; });
  renderChecklist();
  setTaskType(fullTaskType);

  document.querySelectorAll('#day-sel .day-btn').forEach(b => {
    b.classList.toggle('active', fullRepeatDays.includes(b.dataset.day));
  });

  document.getElementById('full-add-modal').classList.add('open');
}

function closeFullAdd() {
  document.getElementById('full-add-modal').classList.remove('open');
}

function saveFullTask() {
  const title = document.getElementById('full-title').value.trim();
  if (!title) { document.getElementById('full-title').focus(); return; }

  const dateVal   = document.getElementById('task-date').value || today();
  const startDate = document.getElementById('repeat-start').value || today();
  const endDate   = document.getElementById('repeat-end').value || '';
  const notifOn   = document.getElementById('notif-toggle').checked;
  const notifTime = notifOn ? document.getElementById('notif-time').value : null;

  const data = {
    title, matrix: fullSelectedMatrix, color: fullSelectedColor,
    type: fullTaskType, checklist: fullChecklist, repeatDays: fullRepeatDays,
    date: fullTaskType === 'once' ? dateVal : startDate,
    startDate, endDate, notificationTime: notifTime,
  };

  if (editingId) {
    const idx = tasks.findIndex(t => t.id === editingId);
    if (idx >= 0) tasks[idx] = { ...tasks[idx], ...data };
  } else {
    tasks.unshift({ id: uid(), done: false, createdAt: Date.now(), doneDate: null, ...data });
  }

  DB.save(tasks);
  closeFullAdd();
  render(currentTab);
}

function formatDateLabel(dateStr) {
  if (!dateStr) return '날짜 선택';
  const [y,m,d] = dateStr.split('-');
  return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`;
}

// ── HELPERS ────────────────────────────────
function renderColorSel(containerId, selected, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = COLORS.map(c => `
    <div class="color-swatch ${c === selected ? 'selected':''}" data-color="${c}"
         style="background:${c}" role="button" tabindex="0" aria-label="색상 ${c}"></div>
  `).join('');
  container.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      container.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      onChange(sw.dataset.color);
    });
  });
}

function renderChecklist() {
  const el = document.getElementById('checklist-items');
  if (!el) return;
  el.innerHTML = fullChecklist.map((item, i) => `
    <div class="checklist-item" data-ci="${i}">
      <div class="cl-cb ${item.done?'checked':''}" data-ci="${i}">${item.done?'✓':''}</div>
      <span class="cl-text ${item.done?'checked':''}">${esc(item.text)}</span>
      <button class="cl-del" data-del="${i}" aria-label="삭제">×</button>
    </div>
  `).join('');
}

function setTaskType(type) {
  fullTaskType = type;
  document.querySelectorAll('#full-add-modal .type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === type);
  });
  document.getElementById('once-settings').style.display   = type === 'once'   ? '' : 'none';
  document.getElementById('repeat-settings').style.display = type === 'repeat' ? '' : 'none';
}

function toggleDone(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  
  t.done = !t.done;
  t.doneDate = t.done ? today() : null;
  DB.save(tasks);
  render(currentTab);
}

// ── ROUTINE DETAIL ─────────────────────────
function openRoutineDetail(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  document.getElementById('routine-title-lbl').textContent = t.title;
  document.getElementById('routine-body').innerHTML = buildRoutineContent(t);
  document.getElementById('routine-edit-btn').dataset.id = id;
  document.getElementById('routine-modal').classList.add('open');
}
function closeRoutineDetail() {
  document.getElementById('routine-modal').classList.remove('open');
  render(currentTab);
}
function toggleRoutineDate(taskId, dateStr) {
  const t = tasks.find(x => x.id === taskId);
  if (!t) return;
  t.completedDates = t.completedDates || [];
  if (t.completedDates.includes(dateStr)) {
    t.completedDates = t.completedDates.filter(d => d !== dateStr);
  } else {
    t.completedDates.push(dateStr);
  }
  t.done = isRoutineFullyDone(t);
  DB.save(tasks);
  document.getElementById('routine-body').innerHTML = buildRoutineContent(t);
}
function buildRoutineContent(task) {
  const start = task.startDate || task.date || today();
  const rawEnd = task.endDate || today();
  const limitDate = rawEnd;
  const completedDates = task.completedDates || [];
  const dayMap = {0:'Sun',1:'Mon',2:'Tue',3:'Wed',4:'Thu',5:'Fri',6:'Sat'};
  const allDates = [];
  let cur = new Date(start+'T00:00:00');
  const endD = new Date(limitDate+'T00:00:00');
  while (cur <= endD) {
    const ds = fmtDate(cur);
    const dow = dayMap[cur.getDay()];
    if (!task.repeatDays||task.repeatDays.length===0||task.repeatDays.includes(dow)) allDates.push(ds);
    cur.setDate(cur.getDate()+1);
  }
  const total = allDates.length;
  const completed = allDates.filter(d=>completedDates.includes(d)).length;
  const incomplete = total - completed;
  const pct = total>0?Math.round(completed/total*100):0;
  const r=46,cx=60,cy=60,circum=2*Math.PI*r;
  const dash=(pct/100)*circum;
  const repeatInfo=task.repeatDays&&task.repeatDays.length>0?task.repeatDays.map(d=>DAY_KR[d]).join(', '):'매일';

  // Group by month
  const months = {};
  allDates.forEach(d => {
    const [,m] = d.split('-');
    const mLabel = `${parseInt(m)}월`;
    if (!months[mLabel]) months[mLabel] = [];
    months[mLabel].push(d);
  });

  const curMonthLabel = `${new Date().getMonth()+1}월`;
  const grid = Object.keys(months).map(mLabel => {
    const cells = months[mLabel].map(d => {
      const done=completedDates.includes(d);
      const [,m,day]=d.split('-');
      return `<div class="habit-cell" data-routine-date="${d}" data-task-id="${task.id}">
        <div class="habit-circ ${done?'done':''}">${done?'<svg viewBox="0 0 20 20"><polyline points="16 5 8 14 4 10" stroke="white" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>':''}</div>
        <span class="habit-date-lbl">${parseInt(m)}.${parseInt(day)}</span>
      </div>`;
    }).join('');
    const isOpen = (mLabel === curMonthLabel) ? 'open' : '';
    return `<details class="month-group" ${isOpen}>
      <summary class="month-group-label">${mLabel}</summary>
      <div class="habit-grid">${cells}</div>
    </details>`;
  }).join('');
  return `
    <div class="routine-meta">
      <span>📅 ${fmtDisplay(start)} ~ ${fmtDisplay(rawEnd)}</span>
      <span>🔄 ${repeatInfo}</span>
    </div>
    <div class="routine-progress-row">
      <div class="progress-ring-wrap">
        <svg viewBox="0 0 120 120" class="progress-ring-svg">
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#F0F0F0" stroke-width="14"/>
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#3B6FE8" stroke-width="14"
            stroke-dasharray="${dash.toFixed(1)} ${circum.toFixed(1)}"
            stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>
        </svg>
        <div class="progress-center">
          <span class="progress-pct-label">${pct}%</span>
          <span class="progress-sub-label">달성률</span>
        </div>
      </div>
      <div class="routine-stat-col">
        <div class="rs-item"><span class="rs-k">전체</span><span class="rs-v">${total}일</span></div>
        <div class="rs-item"><span class="rs-k">완료</span><span class="rs-v" style="color:var(--plan)">${completed}일</span></div>
        <div class="rs-item"><span class="rs-k">미완료</span><span class="rs-v" style="color:var(--text3);font-weight:500">${incomplete}일</span></div>
      </div>
    </div>
    <div class="routine-grid-section">
      <div class="rg-header"><span>완료 기록</span><span>${total}일간</span></div>
      <div class="routine-months">${total>0?grid:'<p style="color:#9BA3AF;font-size:13px;padding:12px 0">아직 기록이 없어요</p>'}</div>
    </div>`;
}

// ── FILTER ───────────────────────────────────
function setMatrixFilter(val) {
  matrixStatusFilter = val;
  document.querySelectorAll('.sort-opt').forEach(btn => btn.classList.toggle('active', btn.dataset.filter===val));
  renderMatrix();
  const menu = document.getElementById('sort-menu');
  if (menu) menu.classList.remove('open');
}

// ── NOTIFICATIONS ──────────────────────────
function requestNotifPermission() {
  if ('Notification' in window && Notification.permission==='default') Notification.requestPermission();
}

let lastNotifTime = {};
function showLocalNotification(title) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  // Prevent duplicate notifications in same minute
  if (lastNotifTime[title] && (Date.now() - lastNotifTime[title] < 60000)) return;
  lastNotifTime[title] = Date.now();

  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification('Matrix TODO', {
        body: title,
        vibrate: [200, 100, 200]
      });
    });
  } else {
    new Notification('Matrix TODO', { body: title });
  }
}

function checkNotifications() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date();
  const timeStr = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  const dStr = fmtDate(now);
  
  tasks.forEach(t => {
    if (!t.done && t.notificationTime === timeStr) {
      if (t.type === 'once' && t.date === dStr) {
        showLocalNotification(t.title);
      } else if (t.type === 'repeat' && isTaskOnDate(t, dStr)) {
        if (!(t.completedDates||[]).includes(dStr)) {
          showLocalNotification(t.title);
        }
      }
    }
  });
}

function deleteTask(id) {
  if (!confirm('이 할 일을 삭제할까요?')) return;
  tasks = tasks.filter(t => t.id !== id);
  DB.save(tasks);
  render(currentTab);
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── EVENT BINDING ──────────────────────────
function bindEvents() {

  // NAV
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.tab));
  });

  // OPEN QUICK ADD (all + buttons)
  document.addEventListener('click', e => {
    const btn = e.target.closest('.open-quick-add');
    if (btn) {
      const date = currentTab === 'calendar' ? fmtDate(calSelected) : null;
      openQuickAdd(btn.dataset.defaultMatrix || 'do', date);
    }
  });

  // QUICK SAVE / CLOSE
  document.getElementById('quick-save').addEventListener('click', saveQuickTask);
  document.getElementById('quick-close').addEventListener('click', closeQuickAdd);
  document.getElementById('quick-title').addEventListener('keydown', e => { if (e.key === 'Enter') saveQuickTask(); });

  // QUICK MATRIX SEL
  document.querySelectorAll('#quick-matrix-sel .m-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      quickSelectedMatrix = btn.dataset.m;
      document.querySelectorAll('#quick-matrix-sel .m-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // OPEN FULL ADD from quick sheet
  document.getElementById('open-full-add').addEventListener('click', () => {
    const date = quickDefaultDate;
    const title = document.getElementById('quick-title').value;
    closeQuickAdd();
    setTimeout(() => openFullAdd(quickSelectedMatrix, date, title), 200);
  });

  // FULL ADD SAVE/CLOSE
  document.getElementById('full-save').addEventListener('click', saveFullTask);
  document.getElementById('full-close').addEventListener('click', closeFullAdd);

  // FULL MATRIX SEL
  document.querySelectorAll('#full-matrix-sel .m-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      fullSelectedMatrix = btn.dataset.m;
      document.querySelectorAll('#full-matrix-sel .m-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      btn.innerHTML = `${buildMiniMx(btn.dataset.m, 28)}<span>${MATRIX[btn.dataset.m].kr}</span>`;
    });
  });

  // TASK TYPE
  document.getElementById('type-once').addEventListener('click', () => setTaskType('once'));
  document.getElementById('type-repeat').addEventListener('click', () => setTaskType('repeat'));

  // CHECKLIST ADD
  document.getElementById('checklist-add').addEventListener('click', addChecklistItem);
  document.getElementById('checklist-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') addChecklistItem();
  });

  // CHECKLIST ITEMS (delegated)
  document.getElementById('checklist-items').addEventListener('click', e => {
    const cb  = e.target.closest('[data-ci]');
    const del = e.target.closest('[data-del]');
    if (del) {
      fullChecklist.splice(parseInt(del.dataset.del), 1);
      renderChecklist();
    } else if (cb) {
      const i = parseInt(cb.dataset.ci);
      if (fullChecklist[i]) { fullChecklist[i].done = !fullChecklist[i].done; renderChecklist(); }
    }
  });

  // DAY SEL
  document.getElementById('day-sel').addEventListener('click', e => {
    const btn = e.target.closest('.day-btn');
    if (!btn) return;
    btn.classList.toggle('active');
    const day = btn.dataset.day;
    if (btn.classList.contains('active')) { if (!fullRepeatDays.includes(day)) fullRepeatDays.push(day); }
    else { fullRepeatDays = fullRepeatDays.filter(d => d !== day); }
  });

  // NOTIFICATION TOGGLE
  document.getElementById('notif-toggle').addEventListener('change', e => {
    document.getElementById('notif-time-row').style.display = e.target.checked ? '' : 'none';
    if (e.target.checked) requestNotifPermission();
  });

  // DATE LABEL CLICK → open date picker
  document.getElementById('modal-date-label').addEventListener('click', () => {
    document.getElementById('task-date').showPicker?.();
    document.getElementById('task-date').click();
  });
  document.getElementById('task-date').addEventListener('change', e => {
    document.getElementById('modal-date-label').textContent = formatDateLabel(e.target.value);
  });

  // OVERLAY CLICK → close sheets
  document.getElementById('overlay').addEventListener('click', () => {
    closeQuickAdd();
  });

  // STATUS FILTER TABS (dashboard)
  document.getElementById('status-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.stab');
    if (!btn) return;
    dbStatusFilter = btn.dataset.status;
    document.querySelectorAll('#status-tabs .stab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderDashboard();
  });

  // SWIPE TO DELETE LOGIC
  let swipeStartX = 0;
  let swipeStartY = 0;
  let swipeTarget = null;
  let isDown = false;

  function onSwipeStart(e) {
    const wrapper = e.target.closest('.task-card-wrapper');
    if (!wrapper && !e.target.closest('.delete-btn')) {
      document.querySelectorAll('.task-card-wrapper.swiped').forEach(w => w.classList.remove('swiped'));
    }
    if (wrapper) {
      swipeTarget = wrapper;
      isDown = true;
      swipeStartX = e.touches ? e.touches[0].clientX : e.clientX;
      swipeStartY = e.touches ? e.touches[0].clientY : e.clientY;
    }
  }

  function onSwipeEnd(e) {
    if (!isDown || !swipeTarget) return;
    const endX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const endY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    const deltaX = endX - swipeStartX;
    const deltaY = endY - swipeStartY;
    
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
      if (deltaX < 0) { // Swipe left
        document.querySelectorAll('.task-card-wrapper.swiped').forEach(w => w.classList.remove('swiped'));
        swipeTarget.classList.add('swiped');
      } else { // Swipe right
        swipeTarget.classList.remove('swiped');
      }
    }
    isDown = false;
    swipeTarget = null;
  }

  document.addEventListener('touchstart', onSwipeStart, {passive: true});
  document.addEventListener('touchend', onSwipeEnd);
  document.addEventListener('mousedown', onSwipeStart);
  document.addEventListener('mouseup', onSwipeEnd);

  // TASK CARD CLICK
  document.addEventListener('click', e => {
    const delBtn = e.target.closest('.delete-btn[data-delete-id]');
    if (delBtn) { e.stopPropagation(); deleteTask(delBtn.dataset.deleteId); return; }
    
    const delMemoBtn = e.target.closest('.delete-btn[data-delete-memo-id]');
    if (delMemoBtn) { e.stopPropagation(); deleteMemo(delMemoBtn.dataset.deleteMemoId); return; }
    
    // Auto-close swipe state if clicking somewhere else
    const swiped = document.querySelector('.task-card-wrapper.swiped');
    if (swiped && !e.target.closest('.task-card-wrapper.swiped')) { swiped.classList.remove('swiped'); }

    const chk = e.target.closest('[data-check]');
    if (chk) { e.stopPropagation(); toggleDone(chk.dataset.check); return; }
    const habitCell = e.target.closest('[data-routine-date]');
    if (habitCell) { toggleRoutineDate(habitCell.dataset.taskId, habitCell.dataset.routineDate); return; }
    const card = e.target.closest('.task-card, .q-task');
    if (card && card.dataset.id) {
      const t = tasks.find(x => x.id === card.dataset.id);
      if (t && t.type==='repeat') openRoutineDetail(card.dataset.id);
      else openEditTask(card.dataset.id);
    }
  });

  // MATRIX QUADRANT TASKS — checkbox & open edit
  document.getElementById('matrix-grid').addEventListener('click', e => {
    const chk = e.target.closest('.q-cb[data-check]');
    if (chk) { e.stopPropagation(); toggleDone(chk.dataset.check); return; }
    const task = e.target.closest('.q-task[data-id]');
    if (task) openEditTask(task.dataset.id);
  });

  // CALENDAR nav
  document.getElementById('cal-prev').addEventListener('click', () => {
    calDate = new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1);
    renderCalendar();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    calDate = new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1);
    renderCalendar();
  });

  // CALENDAR day click
  document.getElementById('cal-grid').addEventListener('click', e => {
    const day = e.target.closest('.cal-day[data-date]');
    if (!day) return;
    const dateStr = day.dataset.date;
    calSelected = new Date(dateStr + 'T00:00:00');
    document.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
    day.classList.add('selected');
    renderCalDayTasks(dateStr);
  });

  // DETAIL MODAL save/close
  document.getElementById('detail-close').addEventListener('click', () => {
    document.getElementById('task-detail-modal').classList.remove('open');
  });
  document.getElementById('detail-save').addEventListener('click', saveFullTask);

  // SORT MENU TOGGLE
  document.getElementById('matrix-filter-btn').addEventListener('click', e => {
    e.stopPropagation();
    const menu = document.getElementById('sort-menu');
    if (menu) menu.classList.toggle('open');
  });
  document.getElementById('sort-menu').addEventListener('click', e => {
    const btn = e.target.closest('.sort-opt');
    if (btn) setMatrixFilter(btn.dataset.filter);
  });
  document.addEventListener('click', e => {
    const menu = document.getElementById('sort-menu');
    if (menu && !e.target.closest('#sort-menu') && !e.target.closest('#matrix-filter-btn')) menu.classList.remove('open');
  }, true);
  // ROUTINE MODAL CLOSE/EDIT
  document.getElementById('routine-close').addEventListener('click', e => {
    e.stopPropagation(); e.preventDefault();
    closeRoutineDetail();
  });
  document.getElementById('routine-edit-btn').addEventListener('click', e => {
    const id = e.currentTarget.dataset.id;
    e.stopPropagation(); e.preventDefault();
    closeRoutineDetail();
    setTimeout(() => openEditTask(id), 300);
  });
  // SETTINGS BTN
  document.getElementById('settings-btn').addEventListener('click', () => {
    requestNotifPermission();
    alert('알림 권한이 허용되었어요!');
  });

  // KEYBOARD: Escape closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeQuickAdd();
      closeFullAdd();
    }
  });
}

function addChecklistItem() {
  const input = document.getElementById('checklist-input');
  const text = input.value.trim();
  if (!text) return;
  fullChecklist.push({ id: uid(), text, done: false });
  renderChecklist();
  input.value = '';
  input.focus();
}

// ── INIT ───────────────────────────────────
function init() {
  // Build initial mini-mx in tabs
  document.querySelectorAll('#matrix-tabs .tab-btn').forEach(btn => {
    btn.innerHTML = buildMiniMx(btn.dataset.filter, 22);
  });

  // Build mini-mx in quick add matrix buttons
  document.querySelectorAll('#quick-matrix-sel .m-btn').forEach(btn => {
    btn.innerHTML = `${buildMiniMx(btn.dataset.m, 28)}<span>${MATRIX[btn.dataset.m].kr}</span>`;
  });

  // Build mini-mx in full add matrix buttons
  document.querySelectorAll('#full-matrix-sel .m-btn').forEach(btn => {
    btn.innerHTML = `${buildMiniMx(btn.dataset.m, 28)}<span>${MATRIX[btn.dataset.m].kr}</span>`;
  });

  bindEvents();
  render('matrix');

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  
  // Notification Loop
  setInterval(checkNotifications, 60000);
  setTimeout(checkNotifications, 2000);

  startDatabaseSync();
}

function startDatabaseSync() {
  onSnapshot(doc(db, "assets", "todo_tasks"), (docSnap) => {
    if (docSnap.exists()) {
      tasks = docSnap.data().items || [];
      render(currentTab);
    } else {
      if (tasks.length === 0) seedSampleData();
    }
  });

  onSnapshot(doc(db, "assets", "todo_memos"), (docSnap) => {
    if (docSnap.exists()) {
      memos = docSnap.data().items || [];
      if (currentTab === 'memo') renderMemos();
    }
  });
}

function seedSampleData() {
  const samples = [
    { title: '프로젝트 발표 준비', matrix: 'do',       date: today(), color: COLORS[6], type: 'once' },
    { title: '운동 계획 세우기',   matrix: 'plan',     date: today(), color: COLORS[7], type: 'once' },
    { title: '이메일 답장',        matrix: 'delegate', date: today(), color: COLORS[0], type: 'once' },
    { title: 'SNS 피드 확인',      matrix: 'eliminate',date: today(), color: COLORS[4], type: 'once' },
    { title: '일일 할 일 기록',    matrix: 'do',       date: today(), color: COLORS[6], type: 'repeat',
      repeatDays: ['Mon','Tue','Wed','Thu','Fri'], startDate: today() },
  ];
  samples.forEach(s => {
    tasks.push({ id: uid(), done: false, createdAt: Date.now(), doneDate: null, checklist: [], repeatDays: [], ...s });
  });
  DB.save(tasks);
  render('matrix');
}

// ── MEMO SCREEN ─────────────────────────────
let editingMemoId = null;

function renderMemos() {
  const container = document.getElementById('memo-list-container');
  if (!container) return;
  memos.sort((a,b) => b.updatedAt - a.updatedAt);
  
  if (memos.length === 0) {
    container.innerHTML = `<div class="empty-state" style="padding:40px 0"><p>작성된 메모가 없습니다</p></div>`;
    return;
  }
  
  container.innerHTML = memos.map(m => {
    const temp = document.createElement('div');
    temp.innerHTML = m.content;
    const lines = temp.innerText.split('\n').map(l => l.trim()).filter(l => l);
    const title = lines.length > 0 ? lines[0] : '새로운 메모';
    const preview = lines.length > 1 ? lines[1] : '추가 텍스트 없음';
    const d = new Date(m.updatedAt);
    const dtStr = `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
    return `
      <div class="task-card-wrapper" data-memo-wrapper="${m.id}">
        <div class="memo-card" data-memo-id="${m.id}" style="width:100%;flex-shrink:0;margin-bottom:0px">
          <div class="memo-title">${esc(title)}</div>
          <div class="memo-preview"><span class="memo-date">${dtStr}</span> ${esc(preview)}</div>
        </div>
        <div class="delete-btn" data-delete-memo-id="${m.id}" style="border-radius:12px;margin-bottom:0px">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          삭제
        </div>
      </div>
    `;
  }).join('');
}

function deleteMemo(id) {
  memos = memos.filter(m => m.id !== id);
  DB.saveMemos(memos);
  renderMemos();
}

function openMemoDetail(id) {
  editingMemoId = id;
  const area = document.getElementById('memo-content-area');
  if (id) {
    const m = memos.find(x => x.id === id);
    area.innerHTML = m ? m.content : '';
  } else {
    area.innerHTML = '';
  }
  document.getElementById('screen-memo-list').style.display = 'none';
  document.getElementById('screen-memo-detail').style.display = 'flex';
  setTimeout(() => { area.focus(); }, 100);
}

function closeMemoDetail() {
  saveCurrentMemo();
  document.getElementById('screen-memo-list').style.display = 'flex';
  document.getElementById('screen-memo-detail').style.display = 'none';
  render('memo');
}

function saveCurrentMemo() {
  const area = document.getElementById('memo-content-area');
  const content = area.innerHTML.trim();
  const temp = document.createElement('div');
  temp.innerHTML = content;
  const textContent = temp.innerText.trim();
  
  if (!textContent && !content.includes('<img')) {
    if (editingMemoId) {
      memos = memos.filter(m => m.id !== editingMemoId); // delete if empty
      DB.saveMemos(memos);
    }
    editingMemoId = null;
    return;
  }
  
  if (editingMemoId) {
    const m = memos.find(x => x.id === editingMemoId);
    if (m && m.content !== content) {
      m.content = content;
      m.updatedAt = Date.now();
    }
  } else {
    memos.push({ id: uid(), content, createdAt: Date.now(), updatedAt: Date.now() });
  }
  DB.saveMemos(memos);
  editingMemoId = null;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('memo-add-btn')?.addEventListener('click', () => openMemoDetail(null));
  document.getElementById('memo-back-btn')?.addEventListener('click', closeMemoDetail);
  document.getElementById('memo-save-btn')?.addEventListener('click', closeMemoDetail);
  document.getElementById('memo-list-container')?.addEventListener('click', e => {
    const card = e.target.closest('.memo-card');
    if (card) openMemoDetail(card.dataset.memoId);
  });
  
  document.querySelectorAll('.memo-toolbar button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const cmd = btn.dataset.cmd;
      if (cmd) document.execCommand(cmd, false, null);
      document.getElementById('memo-content-area').focus();
    });
  });
});

document.addEventListener('DOMContentLoaded', init);

