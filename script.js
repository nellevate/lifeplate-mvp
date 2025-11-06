// ===============================
// 🚀 LifePlate App — script.js (Step 1 Updates)
// ===============================

// ---------- GLOBAL ----------
var currentScreen = ""; // keep var to avoid redeclarations

// ---------- UTILITIES ----------
function $(id) { return document.getElementById(id); }
function saveToLocal(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function loadFromLocal(key) {
  try { return JSON.parse(localStorage.getItem(key)) ?? []; } catch { return []; }
}
function getLS(key, fb=null){ try { return JSON.parse(localStorage.getItem(key)) ?? fb; } catch { return fb; } }
function setLS(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

// ---------- TOAST (auto-dismiss) ----------
(function ensureToastStyles(){
  if (document.getElementById('lp-toast-styles')) return;
  const s = document.createElement('style');
  s.id = 'lp-toast-styles';
  s.textContent = `
    .lp-toast {
      position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%) translateY(16px);
      background: #111; color: #fff; padding: 10px 14px; border-radius: 10px;
      opacity: 0; transition: opacity .18s ease, transform .18s ease; z-index: 9999;
      font-size: 14px; box-shadow: 0 6px 16px rgba(0,0,0,.15);
    }
    .lp-toast.in { opacity: 1; transform: translateX(-50%) translateY(0); }
  `;
  document.head.appendChild(s);
})();
function showToast(msg, ms=1800){
  const el = document.createElement('div');
  el.className = 'lp-toast';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(()=> el.classList.add('in'));
  setTimeout(()=>{
    el.classList.remove('in');
    el.addEventListener('transitionend', ()=> el.remove(), { once:true });
  }, ms);
}

// ---------- Legacy migration helpers (unchanged) ----------
(function migrateLegacyTasksOnce(){
  try {
    const legacy = JSON.parse(localStorage.getItem('tasks') || '[]');
    const activeId = localStorage.getItem('lp_activeProfileId') || 'default';
    const newKey = 'lp_data_' + activeId;
    const newStore = JSON.parse(localStorage.getItem(newKey) || 'null');
    if (newStore && Array.isArray(newStore.tasks)) {
      if (legacy.length && newStore.tasks.length === 0) {
        const categories = JSON.parse(localStorage.getItem('categories') || '[]');
        localStorage.setItem(newKey, JSON.stringify({ tasks: legacy, categories }));
      }
      return;
    }
    if (!Array.isArray(legacy)) localStorage.setItem('tasks', '[]');
  } catch(e) {}
})();
function safeParseJSON(str) { try { return JSON.parse(str); } catch { return null; } }
function looksLikeTaskArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  const sample = arr.find(x => x && typeof x === 'object');
  if (!sample) return false;
  const hasTitle = typeof sample.title === 'string' && sample.title.trim().length > 0;
  const hasName = typeof sample.name === 'string' && sample.name.trim().length > 0;
  return hasTitle || hasName;
}
function normalizeTask(t) {
  if (!t || typeof t !== 'object') return null;
  const title = (t.title || t.name || "").toString().trim();
  if (!title) return null;
  const category = (t.category || t.segment || t.type || "Personal").toString().trim();
  const energy = (t.energy || t.energyLevel || t.moodEnergy || "").toString().trim();
  const duration = (typeof t.duration === 'number') ? t.duration
                 : (typeof t.estimateMin === 'number') ? t.estimateMin
                 : (typeof t.time === 'number') ? t.time
                 : null;
  const location = (t.location || t.place || t.where || "").toString().trim() || null;
  const tags = Array.isArray(t.tags) ? t.tags
             : typeof t.tags === 'string' ? t.tags.split(',').map(s=>s.trim()).filter(Boolean)
             : [];
  const createdAt = t.createdAt || t.created || t.timestamp || Date.now();
  const id = t.id || t._id || `${title}-${createdAt}`;
  return {
    id: String(id),
    title,
    category,
    duration: (typeof duration === 'number' && duration > 0) ? duration : null,
    energy: energy || null,
    location,
    tags,
    notes: t.notes || null,
    createdAt: createdAt,
    dueDate: t.dueDate || null
  };
}
function findLegacyTaskArrays() {
  const results = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('lp_data_') || key === 'lp_profiles' || key === 'lp_activeProfileId')) continue;
    const parsed = safeParseJSON(localStorage.getItem(key));
    if (looksLikeTaskArray(parsed)) results.push({ key, tasks: parsed });
  }
  return results;
}
function mergeTasksIntoActive(legacyTasks) {
  const normalized = legacyTasks.map(normalizeTask).filter(Boolean);
  if (!normalized.length) return { added: 0, skipped: 0 };
  const activeId = localStorage.getItem('lp_activeProfileId') || 'default';
  const storeKey = 'lp_data_' + activeId;
  const current = safeParseJSON(localStorage.getItem(storeKey)) || { tasks: [], categories: [] };
  const currentTasks = Array.isArray(current.tasks) ? current.tasks : [];
  const sig = (t) => t.id ? `id:${t.id}` : `tc:${t.title}|${t.createdAt}`;
  const seen = new Set(currentTasks.map(sig));
  let added = 0, skipped = 0;
  normalized.forEach(t => {
    const s = sig(t);
    if (seen.has(s)) { skipped++; return; }
    currentTasks.push(t);
    seen.add(s); added++;
  });
  const catSet = new Set(Array.isArray(current.categories) ? current.categories : []);
  currentTasks.forEach(t => { if (t.category) catSet.add(t.category); });
  current.tasks = currentTasks;
  current.categories = Array.from(catSet);
  localStorage.setItem(storeKey, JSON.stringify(current));
  return { added, skipped };
}
function runDataRescue() {
  const packs = findLegacyTaskArrays();
  if (!packs.length) { alert("No legacy task arrays were found."); return; }
  const summary = packs.map(p => `• ${p.key}  (${Array.isArray(p.tasks) ? p.tasks.length : 0} items)`).join('\n');
  const ok = confirm(`Found potential legacy data:\n\n${summary}\n\nImport all into your current Plate?`);
  if (!ok) return;
  let totalAdded = 0, totalSkipped = 0;
  packs.forEach(p => {
    const { added, skipped } = mergeTasksIntoActive(Array.isArray(p.tasks) ? p.tasks : []);
    totalAdded += added; totalSkipped += skipped;
  });
  alert(`Data Rescue complete.\nAdded: ${totalAdded}\nSkipped (duplicates): ${totalSkipped}`);
}

// ----- My Locations -----
function getMyLocations(){ return getLS('my_locations', []); }
function saveMyLocations(arr){ setLS('my_locations', Array.from(new Set(arr))); }
function addMyLocation(loc){
  const v = (loc||"").trim(); if(!v) return;
  const next = getMyLocations();
  if (!next.includes(v)) saveMyLocations([...next, v]);
}

// ----- My Tags (global + per category) -----
function _getMyTagsStore(){ return getLS('my_tags_by_category', {}); }
function _saveMyTagsStore(obj){ setLS('my_tags_by_category', obj); }
function getMyTags(category){
  const store = _getMyTagsStore();
  const global = store.__global || [];
  const perCat = store[category] || [];
  return Array.from(new Set([...(global||[]), ...(perCat||[])]));
}
function addMyTag(category, tag){
  const t = (tag||"").trim(); if(!t) return;
  const store = _getMyTagsStore();
  store.__global = Array.from(new Set([...(store.__global||[]), t]));
  if (category){
    store[category] = Array.from(new Set([...(store[category]||[]), t]));
  }
  _saveMyTagsStore(store);
}

// ---------- CONSTANTS ----------
const ENERGY_RANK = { Low:1, Medium:2, High:3 };

// ---------- PRESET CATEGORIES BY PERSONA ----------
const CATEGORIES_BY_PERSONA = {
  Student: [
    "Academics", "Extracurriculars", "Social", "Self-Care",
    "Health & Wellness", "Family & Home", "Professional Development", "Finances"
  ],
  Caregiver: [
    "Family & Childcare", "Work", "Health & Wellness", "Self-Care",
    "Social", "Travel", "Finances", "Household"
  ],
  Professional: [
    "Career", "Professional Development", "Hobbies",
    "Health & Wellness", "Social", "Travel", "Finances", "Family & Relationships"
  ],
  Blank: ["Personal", "Work", "Health", "Errands", "Finances"]
};
function getCategories() {
  try {
    const cats = JSON.parse(localStorage.getItem("categories") || "[]");
    return Array.isArray(cats) && cats.length ? cats : CATEGORIES_BY_PERSONA.Blank;
  } catch { return CATEGORIES_BY_PERSONA.Blank; }
}

// ----- Onboarding data -----
let quizData = [];
let currentQuestionIndex = 0;
let promptScores = {};
let promptLibrary = [];
fetch("lifeplate_onboarding_quiz.json")
  .then(r => r.ok ? r.json() : { questions: [] })
  .then(data => { quizData = data.questions || []; })
  .catch(() => { quizData = []; });
fetch("promptLibrary.json")
  .then(r => r.ok ? r.json() : [])
  .then(data => { promptLibrary = data || []; })
  .catch(() => { promptLibrary = []; });

function getTopPromptTags(scores, topN = 3) {
  return Object.entries(scores || {})
    .sort((a,b) => b[1]-a[1])
    .slice(0, topN)
    .map(([tag]) => tag);
}
function getPromptsByTags(tags) {
  return (promptLibrary || []).filter(p => p.tags?.some(t => tags.includes(t)));
}

// ---------- QUOTES / MOTIVATE ----------
const QUOTES = {
  default: [
    { text:"Start where you are. Use what you have. Do what you can.", author:"Arthur Ashe" },
    { text:"Action is the antidote to fear.", author:"Joan Baez" },
    { text:"Little by little, one travels far.", author:"J.R.R. Tolkien" },
  ],
  Student: [{ text:"We are what we repeatedly do. Excellence, then, is a habit.", author:"Will Durant" }],
  Caregiver: [{ text:"You cannot pour from an empty cup.", author:"Unknown" }],
  Professional: [{ text:"Inspiration exists, but it has to find you working.", author:"Pablo Picasso" }],
};
function getQuoteForPersona() {
  const persona = localStorage.getItem("persona") || "default";
  const arr = QUOTES[persona] || QUOTES.default;
  return arr[Math.floor(Math.random()*arr.length)];
}

// ---------- EFFECTS ----------
function launchConfetti(durationMs=900){
  const cnt = document.createElement('div');
  cnt.style.position='fixed'; cnt.style.inset='0'; cnt.style.pointerEvents='none';
  document.body.appendChild(cnt);
  const pieces = 90;
  for(let i=0;i<pieces;i++){
    const s = document.createElement('span');
    s.style.position='absolute';
    s.style.left = Math.random()*100 + '%';
    s.style.top = '-10px';
    s.style.width='6px'; s.style.height='10px';
    s.style.background = `hsl(${Math.floor(Math.random()*360)},80%,60%)`;
    s.style.transform = `rotate(${Math.random()*360}deg)`;
    s.style.opacity='0.9';
    cnt.appendChild(s);
    const endY = window.innerHeight + 20;
    const time = 500 + Math.random()*900;
    s.animate(
      [{ transform:`translateY(0) rotate(0deg)`},
       { transform:`translateY(${endY}px) rotate(360deg)`}],
      { duration: time, easing: 'ease-out', fill:'forwards' }
    );
  }
  setTimeout(()=>cnt.remove(), durationMs);
}

// ---------- TOP BAR ----------
function renderTopBar({ title="", onBack=null, rightNodes=[] }={}){
  const bar = document.createElement('div');
  bar.className = 'top-bar';
  bar.style.cssText = "position:sticky;top:0;z-index:1000;display:flex;align-items:center;gap:8px;padding:10px 12px;background:#fff;border-bottom:1px solid #eee;";
  if(onBack){
    const back = document.createElement('button');
    back.textContent = "Back";
    back.onclick = onBack;
    bar.appendChild(back);
  }
  const h = document.createElement('div');
  h.style.fontWeight = '600'; h.textContent = title;
  bar.appendChild(h);
  const spacer = document.createElement('div'); spacer.style.flex='1';
  bar.appendChild(spacer);
  (rightNodes||[]).forEach(n=> n && bar.appendChild(n));
  return bar;
}
function mountRoot(){
  const root = $("app");
  root.innerHTML='';
  return root;
}

// ---------- HOME ----------
function showHomeScreen() {
  currentScreen = "home";
  const root = mountRoot();
  root.appendChild(renderTopBar({ title:"Home" }));

  const hasBackup = !!getLS('backup_plate', null) || !!getLS('backup_persona', null);

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <h1>Welcome to LifePlate 🍽️</h1>
    <div style="margin:8px 0; display:flex; flex-direction:column; gap:8px;">
      <button id="btnStart">Start</button>
      <button id="btnApp">Go to App</button>
      <button id="btnLocs">My Locations</button>
      <button id="btnGoals">Goals</button>
      ${hasBackup ? `<button id="restoreBtn">Restore Plate + Persona</button>` : ``}
      <button id="btnTrash">🗑️ Task Trash</button>
    </div>
  `;
  root.appendChild(wrap);

  $("btnStart").onclick = () => {
    if (localStorage.getItem("onboarded") === "true") showPromptScreen();
    else showPersonaOptions();
  };
  $("btnApp").onclick   = showPromptScreen;
  $("btnLocs").onclick  = showMyLocationsManager;
  $("btnGoals").onclick = showGoals;

  if (hasBackup) {
    $("restoreBtn").onclick = () => {
      const bp   = getLS('backup_plate', []);
      const bper = getLS('backup_persona', null);
      setLS('tasks', bp);
      setLS('persona', bper);
      alert("Restored your Plate and persona.");
      showHomeScreen();
    };
  }
  $("btnTrash").onclick = showTaskTrash;
}

function startOnboarding() {
  if (localStorage.getItem("onboarded") === "true") {
    showPromptScreen();
    return;
  }
  showPersonaOptions();
}

// ---------- PLATE PROFILES (local only) ----------
function listProfiles() { return JSON.parse(localStorage.getItem("lp_profiles") || "[]"); }
function setActiveProfileId(id) { localStorage.setItem("lp_activeProfileId", id); }
function getActiveProfileId() {
  let id = localStorage.getItem("lp_activeProfileId");
  if (!id) {
    id = "default";
    ensureProfile(id, "My Plate");
    setActiveProfileId(id);
  }
  return id;
}
function ensureProfile(id, name) {
  const profiles = listProfiles();
  if (!profiles.find(p => p.id === id)) {
    profiles.push({ id, name });
    localStorage.setItem("lp_profiles", JSON.stringify(profiles));
    localStorage.setItem("lp_data_" + id, JSON.stringify({ tasks: [], categories: [] }));
  }
}
function loadData() {
  const id = getActiveProfileId();
  return JSON.parse(localStorage.getItem("lp_data_" + id) || '{"tasks":[],"categories":[]}');
}
function saveData(data) {
  const id = getActiveProfileId();
  localStorage.setItem("lp_data_" + id, JSON.stringify(data));
}
function getTasks() { return (loadData().tasks || []); }
function saveTasks(tasks) { const d = loadData(); d.tasks = tasks; saveData(d); }
function createProfile(name) {
  const id = "p_" + Date.now().toString(36);
  ensureProfile(id, name || "New Plate");
  setActiveProfileId(id);
  showPromptScreen();
}
function switchProfile(id) { setActiveProfileId(id); showPromptScreen(); }

// ---------- PROMPT / HUB ----------
function showPromptScreen() {
  currentScreen = "prompt";
  const root = mountRoot();

  // Plate switcher
  const profiles = listProfiles();
  const activeId = getActiveProfileId();
  const active = profiles.find(p => p.id === activeId) || { name: "My Plate" };

  // NEW: Home button on the right
  const homeBtn = document.createElement('button');
  homeBtn.textContent = "Home";
  homeBtn.onclick = showHomeScreen;

  root.appendChild(renderTopBar({ title:"Prompt Hub", rightNodes:[homeBtn] }));
  root.insertAdjacentHTML('beforeend', `
    <div style="margin:8px 0; padding:8px; border:1px solid #ddd;">
      <strong>Plate:</strong> ${active.name}
      <details style="margin-top:6px;">
        <summary>Switch / Create</summary>
        ${profiles.map(p => `<div><button onclick="switchProfile('${p.id}')">${p.name}</button></div>`).join("")}
        <div style="margin-top:6px;">
          <button onclick="(function(){ const n = prompt('Name this plate (e.g., Work, Home)'); if(n) createProfile(n); })()">➕ New Plate</button>
        </div>
      </details>
    </div>

    <h2>Welcome back!</h2>
    <p>What would you like to do?</p>
    <button onclick="showAddTask()">➕ Add New Task</button>
    <button onclick="showTaskSuggestions()">⚡ Clear My Plate</button>
    <button onclick="viewTasksChart()">🍽️ View My Plate</button>
    <button onclick="startQuizWithWarning()">🎯 Retake Onboarding Quiz</button>
  `);
}

// ---------- RETAKE QUIZ WARNING + RESTORE ----------
function startQuizWithWarning(){
  setLS('backup_plate', getTasks());
  setLS('backup_persona', localStorage.getItem('persona') || null);
  const ok = confirm("Retaking the onboarding quiz will wipe your current Plate and persona. You can restore them from Home. Continue?");
  if(!ok) return;
  saveTasks([]);
  localStorage.removeItem('persona');
  localStorage.removeItem('categories');
  startQuiz();
}

// ---------- MY LOCATIONS ----------
function showMyLocationsManager(){
  currentScreen="locations";
  const root = mountRoot();
  root.appendChild(renderTopBar({ title:"My Locations", onBack: showPromptScreen }));
  const locs = getLS('my_locations', []);
  const list = document.createElement('div');
  locs.forEach((loc, idx)=>{
    const row = document.createElement('div');
    row.style.cssText="display:flex;align-items:center;gap:8px;margin:6px 0;";
    row.innerHTML = `<div style="flex:1">${loc}</div>`;
    const del = document.createElement('button'); del.textContent="Remove";
    del.onclick = ()=>{ const next = getLS('my_locations', []).filter((_,i)=>i!==idx); setLS('my_locations', next); showMyLocationsManager(); };
    row.appendChild(del);
    list.appendChild(row);
  });
  const inp = document.createElement('input'); inp.placeholder="Add a location…"; inp.style.marginRight="6px";
  const add = document.createElement('button'); add.textContent="Add";
  add.onclick = ()=>{ const v=inp.value.trim(); if(!v) return; const next=[...getLS('my_locations', []), v]; setLS('my_locations', next); showMyLocationsManager(); };
  root.append(list, inp, add);
}
function renderLocationChips(){
  const wrap = document.createElement('div');
  const locs = getLS('my_locations', []);
  locs.forEach(loc=>{
    const b = document.createElement('button');
    b.className='chip'; b.textContent = loc;
    b.style.marginRight='6px';
    b.onclick = ()=>{ const ip = document.querySelector('#taskLocation'); if(ip) ip.value = loc; };
    wrap.appendChild(b);
  });
  return wrap;
}

// ----- Completed (Trash) -----
function getCompletedTasks(){ return getLS('completed_tasks', []); }
function saveCompletedTasks(arr){ setLS('completed_tasks', arr); }
function archiveTask(task){
  const trash = getCompletedTasks();
  trash.unshift({ ...task, completedAt: Date.now() });
  saveCompletedTasks(trash);
}
  
// ---------- TAG SUGGESTIONS ----------
const TAGS_BY_CATEGORY = {
  "Academics": ["study","reading","research","paper","lab"],
  "Work": ["email","meeting","prep","deck","review"],
  "Health & Wellness": ["walk","hydrate","stretch","pilates","meditate"],
  "Self-Care": ["journal","bath","nap","mask","breathe"],
  "Household": ["dishes","laundry","groceries","tidy","trash"],
  "Personal": ["errand","text back","plan","budget","read"],
};
function renderTagsForCategory(cat){
  const wrap = document.createElement('div');
  wrap.style.marginTop = '6px';
  const suggested = Array.from(new Set([...(TAGS_BY_CATEGORY[cat]||[]), ...getMyTags(cat)]));
  if (!suggested.length){
    wrap.textContent = "(no suggestions yet)";
    return wrap;
  }
  suggested.forEach(tag=>{
    const btn = document.createElement('button');
    btn.className='chip';
    btn.textContent = tag;
    btn.style.marginRight='6px';
    btn.onclick=()=>{
      const sel = document.querySelector('#taskTags');
      const arr = sel.value ? sel.value.split(',').map(s=>s.trim()).filter(Boolean) : [];
      if(!arr.includes(tag)){ arr.push(tag); sel.value = arr.join(', '); }
    };
    wrap.appendChild(btn);
  });
  return wrap;
}

// ---------- ADD TASK ----------
function showAddTask() {
  currentScreen = "add";
  const root = mountRoot();
  root.appendChild(renderTopBar({ title:"Add Task", onBack: showPromptScreen }));

  const cats = getCategories();
  const categoryOptions = cats.map(c => `<option value="${c}">${c}</option>`).join("");

  const form = document.createElement('div');
  form.innerHTML = `
    <label>Title</label><br>
    <input type="text" id="taskTitle" placeholder="What is the task?" required/><br><br>

    <label>Category</label><br>
    <select id="taskCategory">
      ${categoryOptions}
      <option value="__OTHER__">Other…</option>
    </select>
    <div id="otherCategoryRow" style="display:none; margin-top:6px;">
      <input id="taskCategoryOther" placeholder="Type a category"/>
    </div>
    <br>

    <label>Time Needed</label><br>
    <div id="timeChips" style="margin:6px 0;"></div>
    <input type="number" id="taskDuration" min="1" placeholder="Minutes (e.g., 15)" required/><br><br>

    <label>Energy</label><br>
    <select id="taskEnergy" required>
      <option value="" disabled selected>Select energy</option>
      <option value="Low">Low</option>
      <option value="Medium">Medium</option>
      <option value="High">High</option>
    </select><br><br>

    <label>Location (optional)</label><br>
    <div id="myLocChips" style="margin:6px 0;"></div>
    <div style="display:flex;gap:6px;align-items:center;">
      <input type="text" id="taskLocation" placeholder="Home, Library, Gym" style="flex:1;"/>
      <button id="addLocBtn" type="button">Add</button>
    </div>
    <small style="color:#666;">Tip: typing a new location here will save it to My Locations.</small>
    <br><br>

    <label>Due date (optional)</label><br>
    <input type="date" id="taskDueDate"/><br><br>

    <label>Tags (optional)</label><br>
    <div id="autoTags" style="margin:6px 0;"></div>
    <input type="text" id="taskTags" placeholder="comma separated"/><br><br>

    <label>Notes (optional)</label><br>
    <textarea id="taskNotes" placeholder="Notes or links..."></textarea><br><br>

    <button id="saveTask">➕ Save Task</button>
  `;
  root.appendChild(form);

  // Category + tag suggestions
  const catSel = form.querySelector('#taskCategory');
  const otherRow = form.querySelector('#otherCategoryRow');
  const refreshAuto = ()=>{
    const holder = form.querySelector('#autoTags');
    holder.innerHTML = `<div>Suggestions:</div>`;
    holder.appendChild(renderTagsForCategory(catSel.value === "__OTHER__" ? "Personal" : catSel.value));
  };
  catSel.onchange = ()=>{
    otherRow.style.display = (catSel.value === "__OTHER__") ? 'block' : 'none';
    refreshAuto();
  };
  refreshAuto();

  // Time chips (quick selections)
  const chipValues = [5,10,15,25,30,45,60];
  const chipWrap = form.querySelector('#timeChips');
  chipValues.forEach(min=>{
    const b = document.createElement('button');
    b.textContent = `${min} min`;
    b.type = "button";
    b.onclick = ()=> { $("taskDuration").value = String(min); };
    chipWrap.appendChild(b);
  });

  // Locations chips
  form.querySelector('#myLocChips').appendChild(renderLocationChips());

  // NEW: Add location on blur or via Add button
  const locInput = form.querySelector('#taskLocation');
  locInput.addEventListener('blur', ()=> { const v = locInput.value.trim(); if (v) addMyLocation(v); });
  form.querySelector('#addLocBtn').onclick = ()=> {
    const v = locInput.value.trim(); if (!v) return;
    addMyLocation(v);
    showToast("Location saved");
    // re-render chips so it appears immediately
    form.querySelector('#myLocChips').innerHTML = "";
    form.querySelector('#myLocChips').appendChild(renderLocationChips());
  };

  // Save
  form.querySelector('#saveTask').onclick = addTask;
}

function addTask() {
  const title = $("taskTitle").value.trim();
  if (!title){ showToast("Please add a title"); $("taskTitle").focus(); return; }

  // category
  let category = $("taskCategory").value;
  if (category === "__OTHER__") {
    category = ($("taskCategoryOther").value || "").trim() || "Other";
    const cats = getCategories();
    if (!cats.includes(category)) {
      try { localStorage.setItem("categories", JSON.stringify([...cats, category])); } catch {}
    }
  }

  // REQUIRED: Estimate + Energy
  const durationVal = $("taskDuration").value;
  const duration = parseInt(durationVal, 10);
  if (!durationVal || isNaN(duration) || duration < 1){
    showToast("Add time in minutes");
    $("taskDuration").focus();
    return;
  }
  const energy = $("taskEnergy").value;
  if (!energy){
    showToast("Select an energy level");
    $("taskEnergy").focus();
    return;
  }

  // Location (optional) — auto-save new to My Locations
  const location = ($("taskLocation").value || "").trim() || null;
  if (location) addMyLocation(location);

  // Due date (optional)
  const dueDate = ($("taskDueDate").value || "").trim() || null;

  // Tags (optional) — auto-save each new tag
  const rawTags = ($("taskTags").value || "").split(",").map(t => t.trim()).filter(Boolean);
  rawTags.forEach(t => addMyTag(category, t));

  const notes = ($("taskNotes").value || "").trim() || null;

  const tasks = getTasks();
  tasks.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    title, category,
    duration, energy,
    location, tags: rawTags, notes,
    dueDate,
    createdAt: Date.now()
  });
  saveTasks(tasks);

  showToast("Task added");     // no extra click
  showPromptScreen();          // smooth return to hub
}

// ---------- EDIT TASK (adds due date support) ----------
function showEditTask(taskId){
  currentScreen = "edit";
  const tasks = getTasks();
  const t = tasks.find(x => x.id === taskId);
  if(!t){ showToast("Task not found."); showPromptScreen(); return; }

  const root = mountRoot();
  root.appendChild(renderTopBar({ title:"Edit Task", onBack: ()=>showTasksByCategory(t.category || "Personal") }));

  const cats = getCategories();
  const categoryOptions = cats.map(c => `<option value="${c}" ${t.category===c ? 'selected':''}>${c}</option>`).join("");

  const form = document.createElement('div');
  form.innerHTML = `
    <label>Title</label><br>
    <input type="text" id="eTitle" value="${t.title||''}" required/><br><br>

    <label>Category</label><br>
    <select id="eCategory">
      ${categoryOptions}
      <option value="__OTHER__">Other…</option>
    </select>
    <div id="eOtherCatRow" style="display:none; margin-top:6px;">
      <input id="eCategoryOther" placeholder="Type a category"/>
    </div>
    <br>

    <label>Time Needed (minutes)</label><br>
    <input type="number" id="eDuration" min="1" value="${t.duration ?? ''}" required/><br><br>

    <label>Energy</label><br>
    <select id="eEnergy" required>
      <option value="" disabled ${!t.energy ? 'selected':''}>Select energy</option>
      <option value="Low" ${t.energy==='Low' ? 'selected':''}>Low</option>
      <option value="Medium" ${t.energy==='Medium' ? 'selected':''}>Medium</option>
      <option value="High" ${t.energy==='High' ? 'selected':''}>High</option>
    </select><br><br>

    <label>Location (optional)</label><br>
    <div id="eLocChips" style="margin:6px 0;"></div>
    <div style="display:flex;gap:6px;align-items:center;">
      <input type="text" id="eLocation" value="${t.location || ''}" placeholder="Home, Library, Gym" style="flex:1;"/>
      <button id="eAddLocBtn" type="button">Add</button>
    </div>
    <br>

    <label>Due date (optional)</label><br>
    <input type="date" id="eDueDate" value="${t.dueDate ? String(t.dueDate) : ''}"/><br><br>

    <label>Tags (optional)</label><br>
    <div id="eAutoTags" style="margin:6px 0;"></div>
    <input type="text" id="eTags" value="${(t.tags||[]).join(', ')}" placeholder="comma separated"/><br><br>

    <label>Notes (optional)</label><br>
    <textarea id="eNotes" placeholder="Notes or links...">${t.notes || ''}</textarea><br><br>

    <div style="display:flex; gap:8px; flex-wrap:wrap;">
      <button id="eSave">💾 Save Changes</button>
      <button id="eCancel">Cancel</button>
    </div>
  `;
  root.appendChild(form);

  // Dynamic: categories + tag suggestions
  const sel = form.querySelector('#eCategory');
  const otherRow = form.querySelector('#eOtherCatRow');
  const refreshTags = ()=>{
    const cat = sel.value === "__OTHER__" ? "Personal" : sel.value;
    const holder = form.querySelector('#eAutoTags');
    holder.innerHTML = `<div>Suggestions:</div>`;
    holder.appendChild(renderTagsForCategory(cat));
  };
  sel.onchange = ()=>{
    otherRow.style.display = (sel.value === "__OTHER__") ? 'block' : 'none';
    refreshTags();
  };
  refreshTags();

  // locations
  form.querySelector('#eLocChips').appendChild(renderLocationChips());
  const locInput = form.querySelector('#eLocation');
  locInput.addEventListener('blur', ()=> { const v = locInput.value.trim(); if (v) addMyLocation(v); });
  form.querySelector('#eAddLocBtn').onclick = ()=> {
    const v = locInput.value.trim(); if (!v) return;
    addMyLocation(v);
    showToast("Location saved");
    form.querySelector('#eLocChips').innerHTML = "";
    form.querySelector('#eLocChips').appendChild(renderLocationChips());
  };

  // handlers
  form.querySelector('#eCancel').onclick = ()=>showTasksByCategory(t.category || "Personal");
  form.querySelector('#eSave').onclick = ()=>{
    const title = document.querySelector('#eTitle').value.trim();
    if(!title){ showToast("Please add a title"); return; }

    let category = sel.value;
    if (category === "__OTHER__") {
      category = (document.querySelector('#eCategoryOther').value || '').trim() || "Other";
      const cats = getCategories();
      if (!cats.includes(category)) {
        try { localStorage.setItem("categories", JSON.stringify([...cats, category])); } catch {}
      }
    }

    const durationVal = document.querySelector('#eDuration').value;
    const duration = parseInt(durationVal, 10);
    if(!durationVal || isNaN(duration) || duration < 1){
      showToast("Add time in minutes");
      document.querySelector('#eDuration').focus(); return;
    }

    const energy = document.querySelector('#eEnergy').value;
    if(!energy){ showToast("Select an energy level"); document.querySelector('#eEnergy').focus(); return; }

    const location = (document.querySelector('#eLocation').value || '').trim() || null;
    if (location) addMyLocation(location);

    const dueDate = (document.querySelector('#eDueDate').value || '').trim() || null;

    const rawTags = (document.querySelector('#eTags').value || '').split(',').map(s=>s.trim()).filter(Boolean);
    rawTags.forEach(tag => addMyTag(category, tag));

    const notes = (document.querySelector('#eNotes').value || '').trim() || null;

    const all = getTasks();
    const idx = all.findIndex(x => x.id === taskId);
    if (idx === -1){ showToast("Task not found."); showPromptScreen(); return; }

    all[idx] = { ...all[idx], title, category, duration, energy, location, tags: rawTags, notes, dueDate };
    saveTasks(all);
    showToast("Task updated");
    showTasksByCategory(category);
  };
}

// ---------- VIEW PLATE ----------
function viewTasksChart() {
  currentScreen = "view_chart";
  const root = mountRoot();
  root.appendChild(renderTopBar({ title:"My Plate", onBack: showPromptScreen }));

  const tasks = getTasks();
  if (!tasks || tasks.length === 0) {
    root.insertAdjacentHTML('beforeend', `
      <p>Your Plate is empty right now.</p>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button onclick="showAddTask()">Add a Task</button>
        <button onclick="showTaskSuggestions()">Clear My Plate</button>
      </div>
    `);
    return;
  }

  const baseCats = getCategories();
  const counts = {};
  baseCats.forEach(cat => counts[cat] = 0);
  tasks.forEach(t => {
    const cat = (t.category || "Uncategorized");
    if (!(cat in counts)) counts[cat] = 0;
    counts[cat]++;
  });
  const labels = Object.keys(counts).filter(c => counts[c] > 0);
  const data   = labels.map(c => counts[c]);

  root.insertAdjacentHTML('beforeend', `
    <canvas id="taskChart" width="340" height="340"></canvas>
    <div style="margin-top:12px;"></div>
  `);

  const clearBtn = document.createElement('button');
  clearBtn.textContent = "Clear My Plate";
  clearBtn.onclick = () => {
    if (typeof showTaskSuggestions === 'function') {
      showTaskSuggestions();
    } else {
      alert("Clear My Plate is under the Suggestions screen.");
    }
  };
  root.appendChild(clearBtn);

  const ctx = $("taskChart").getContext("2d");
  new Chart(ctx, {
    type: "pie",
    data: { labels, datasets: [{ data }] },
    options: {
      plugins: {
        legend: { position: "bottom" },
        title: { display: true, text: "Tasks by Category" }
      },
      onClick: (evt, elements) => {
        if (elements && elements.length) {
          const i = elements[0].index;
          const clickedCategory = labels[i];
          showTasksByCategory(clickedCategory);
        }
      }
    }
  });
}

function showTasksByCategory(category) {
  currentScreen = "category_list";
  const root = mountRoot();
  root.appendChild(renderTopBar({ title:`${category} Tasks`, onBack: viewTasksChart }));

  const tasks = getTasks().filter(t => (t.category || "Uncategorized") === category);

  if (!tasks.length) {
    root.insertAdjacentHTML('beforeend', `<p>No tasks found in this category.</p>`);
    return;
  }

  tasks.forEach(t=>{
    const card = document.createElement('div');
    card.style.cssText="border:1px solid #ccc;padding:10px;margin:8px 0;border-radius:8px;";
    const due = t.dueDate ? ` • due ${t.dueDate}` : ``;
    card.innerHTML = `
      <strong>${t.title}</strong><br>
      ${(t.duration ?? "-")} min • ${(t.energy || "-")} • ${(t.category || "-")}${due}<br>
      ${t.location ? `@ ${t.location}<br>`:``}
      ${t.tags && t.tags.length ? `Tags: ${t.tags.join(', ')}` : ``}
    `;

    const actions = document.createElement('div');
    actions.style.marginTop = '8px';

    const editBtn = document.createElement('button');
    editBtn.textContent = "Edit";
    editBtn.onclick = ()=> showEditTask(t.id);

    const doneBtn = document.createElement('button');
    doneBtn.textContent = "Cleared";
    doneBtn.style.marginLeft = '8px';
    doneBtn.onclick = ()=>{
      completeTask(t.id);
      launchConfetti();
      showTasksByCategory(category);
    };

    actions.appendChild(editBtn);
    actions.appendChild(doneBtn);
    card.appendChild(actions);
    root.appendChild(card);
  });
}

// ---------- TASK TRASH ----------
function showTaskTrash(){
  currentScreen = "trash";
  const root = mountRoot();
  root.appendChild(renderTopBar({ title:"Task Trash", onBack: showPromptScreen }));

  const trash = getCompletedTasks();
  if (!trash.length){
    root.insertAdjacentHTML('beforeend', `<p>No completed tasks yet.</p>`);
    return;
  }

  const actions = document.createElement('div');
  actions.style.margin = '8px 0';
  const clearAll = document.createElement('button');
  clearAll.textContent = "Empty Trash";
  clearAll.onclick = ()=>{
    const ok = confirm("Permanently delete all completed tasks?");
    if(!ok) return;
    saveCompletedTasks([]);
    showTaskTrash();
  };
  actions.appendChild(clearAll);
  root.appendChild(actions);

  trash.forEach((t, i)=>{
    const card = document.createElement('div');
    card.style.cssText="border:1px solid #ccc;padding:10px;margin:8px 0;border-radius:8px;";
    const when = new Date(t.completedAt || Date.now()).toLocaleString();
    const due = t.dueDate ? ` • due ${t.dueDate}` : ``;
    card.innerHTML = `
      <strong>${t.title}</strong><br>
      ${t.duration ?? 0} min • ${t.energy || "—"} • ${t.category || "—"}${due}<br>
      ${t.location ? `@ ${t.location}<br>` : ``}
      <small>Completed: ${when}</small>
    `;

    const row = document.createElement('div');
    row.style.marginTop = '8px';

    const restore = document.createElement('button');
    restore.textContent = "Restore";
    restore.onclick = ()=>{
      const active = getTasks();
      active.unshift({ ...t });
      saveTasks(active);
      const remaining = getCompletedTasks().filter((_, idx)=> idx!==i);
      saveCompletedTasks(remaining);
      showTaskTrash();
    };

    const del = document.createElement('button');
    del.textContent = "Delete";
    del.style.marginLeft = '8px';
    del.onclick = ()=>{
      const ok = confirm(`Delete "${t.title}" permanently?`);
      if(!ok) return;
      const remaining = getCompletedTasks().filter((_, idx)=> idx!==i);
      saveCompletedTasks(remaining);
      showTaskTrash();
    };

    row.appendChild(restore);
    row.appendChild(del);
    card.appendChild(row);
    root.appendChild(card);
  });
}

// ---------- SUGGESTIONS / CLEAR MY PLATE ----------
const moodAffirmations = {
  Overwhelmed: "Breathe. One step at a time.",
  Focused: "You’re in the zone — let’s use it.",
  Tired: "Gentle progress counts.",
  Energized: "Ride the wave — move one big thing.",
  Avoidant: "Start tiny. Momentum will follow."
};
function getEnergyFromMood(mood) {
  const map = { Overwhelmed:"Low", Tired:"Low", Avoidant:"Medium", Focused:"Medium", Energized:"High" };
  return map[mood] || "Medium";
}

let _lastCandidates = [];
function showTaskSuggestions() {
  currentScreen = "suggest";
  const root = mountRoot();
  root.appendChild(renderTopBar({ title:"Clear My Plate", onBack: showPromptScreen }));

  root.insertAdjacentHTML('beforeend', `
    <label>How are you feeling right now?</label><br>
    <select id="moodCheck">
      <option value="Overwhelmed">😩 Overwhelmed</option>
      <option value="Focused">🎯 Focused</option>
      <option value="Tired">😴 Tired</option>
      <option value="Energized">⚡ Energized</option>
      <option value="Avoidant">🫣 Avoidant</option>
    </select><br><br>

    <label>How much time do you have? (in minutes)</label><br>
    <input id="availableTime" type="number" placeholder="e.g., 20"/><br><br>

    <p style="font-size:0.9em;color:#666;margin:0 0 12px;">
      <strong>Energy matching:</strong> We’ll show options that match your energy (and easier).
    </p>

    <button id="showTasksBtn">Show Me Tasks</button>
  `);
  $("showTasksBtn").onclick = suggestTasks;
}

function suggestTasks() {
  const time = parseInt(document.getElementById("availableTime").value);
  const mood = document.getElementById("moodCheck").value;
  const inferredEnergy = getEnergyFromMood(mood);

  const tasks = getTasks();

  const quizScores = JSON.parse(localStorage.getItem("quizScores") || "{}");
  const topTags = getTopPromptTags(quizScores);
  const promptSuggestions = getPromptsByTags(topTags);
  const randomPrompt = promptSuggestions.length
    ? promptSuggestions[Math.floor(Math.random() * promptSuggestions.length)].text
    : "Take a breath — even one small step is progress.";

  _lastCandidates = tasks.filter(t => {
    const okEnergy = ENERGY_RANK[(t.energy || "Medium")] <= ENERGY_RANK[inferredEnergy];
    const okTime = isNaN(time) ? true : ((t.duration ?? 15) <= time);
    return okEnergy && okTime;
  });

  renderSuggestionPicks({ mood, inferredEnergy, randomPrompt });
}

function pickThree(arr){
  const pool = [...arr];
  for(let i=pool.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0,3);
}

function renderSuggestionPicks({ mood, inferredEnergy, randomPrompt }){
  const rootEl = $("app");
  const picks = pickThree(_lastCandidates);

  const container = document.createElement('div');
  container.innerHTML = `
    <h2>Your Plate Picks</h2>
    <p><em>${randomPrompt}</em></p>
    <p>Mood: <strong>${mood}</strong> → Energy: <strong>${inferredEnergy}</strong></p>
  `;

  if (picks.length === 0) {
    const low = inferredEnergy === 'Low';
    const mm = document.createElement('div');
    mm.style.cssText="border:1px dashed #bbb;padding:10px;border-radius:8px;margin:8px 0;";
    mm.innerHTML = `<h3>${low ? "Mindful Moment" : "No Matches Yet"}</h3>
      <p>${low ? "Try a 3-minute box breath, a 10-minute power nap, or step outside for fresh air." : "No tasks fit right now."}</p>`;
    container.appendChild(mm);

    const goals = getLS('goals', []);
    if(goals.length){
      const g = goals[0];
      const step = document.createElement('div');
      step.style.cssText="margin-top:8px;border:1px solid #eee;padding:10px;border-radius:8px;";
      step.innerHTML = `<h4>Small step toward: ${g.title}</h4><p>Spend 5 minutes listing 3 micro-steps you could take this week.</p>`;
      container.appendChild(step);
    }
  } else {
    picks.forEach(t=>{
      const card = document.createElement('div');
      card.style.cssText="border:1px solid #ccc;padding:10px;margin:10px 0;border-radius:10px;";
      const due = t.dueDate ? ` • due ${t.dueDate}` : ``;
      card.innerHTML = `
        <strong>${t.title}</strong><br>
        ${(t.duration ?? 0)} min • ${(t.energy || "Medium")} • ${(t.category || "-")}${due}<br>
        ${t.location ? `@ ${t.location}<br>` : ``}
      `;

      const actions = document.createElement('div');
      actions.style.marginTop='8px';

      const btnMot = document.createElement('button');
      btnMot.textContent = "Motivate";
      btnMot.onclick = ()=>{ const q = getQuoteForPersona(); alert(`“${q.text}” — ${q.author}`); };

      const btnEdit = document.createElement('button');
      btnEdit.textContent = "Edit";
      btnEdit.style.marginLeft = '8px';
      btnEdit.onclick = ()=> showEditTask(t.id);

      const btnDone = document.createElement('button');
      btnDone.textContent = "Cleared";
      btnDone.style.marginLeft = '8px';
      btnDone.onclick = ()=>{
        completeTask(t.id);
        launchConfetti();
        suggestTasks();
      };

      actions.appendChild(btnMot);
      actions.appendChild(btnEdit);
      actions.appendChild(btnDone);
      card.appendChild(actions);
      container.appendChild(card);
    });
  }

  const reshuffle = document.createElement('button');
  reshuffle.textContent = "Reshuffle";
  reshuffle.onclick = ()=> renderSuggestionPicks({ mood, inferredEnergy, randomPrompt });

  const back = document.createElement('button'); back.textContent="Back"; back.onclick = showTaskSuggestions;
  const home = document.createElement('button'); home.textContent="Main"; home.onclick = showPromptScreen;

  container.appendChild(reshuffle);
  container.appendChild(back);
  container.appendChild(home);

  mountRoot();
  const top = renderTopBar({ title:"Clear My Plate", onBack: showPromptScreen });
  $("app").appendChild(top);
  $("app").appendChild(container);

  const history = loadFromLocal("moodHistory");
  history.push({ mood, timestamp: new Date().toISOString() });
  saveToLocal("moodHistory", history);
}

// replaces any existing completeTask
function completeTask(taskId){
  const tasks = getTasks();
  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return;
  const [done] = tasks.splice(idx, 1);
  saveTasks(tasks);
  archiveTask(done);
}

// ---------- SUPPORT / REFLECT ----------
function showSupportScreen() {
  const root = mountRoot();
  root.appendChild(renderTopBar({ title:"Reflect & Support", onBack: showPromptScreen }));

  const moodHistory = loadFromLocal("moodHistory");
  const lastMood = moodHistory.length ? moodHistory[moodHistory.length-1].mood : null;
  const affirmation = lastMood ? moodAffirmations[lastMood] : "Reflect on what worked today.";

  const box = document.createElement('div');
  box.innerHTML = `
    <p><strong>Last Mood:</strong> ${lastMood || "N/A"}</p>
    <p><em>${affirmation}</em></p>
    <h3>📊 Mood History</h3>
    ${!moodHistory.length ? `<p>No moods logged yet.</p>` :
      `<ul>${moodHistory.slice(-10).reverse().map(e=>`<li>${new Date(e.timestamp).toLocaleString()}: <strong>${e.mood}</strong></li>`).join('')}</ul>`
    }
  `;
  $("app").appendChild(box);
}

// ---------- GOALS ----------
function showGoals(){
  currentScreen="goals";
  const root = mountRoot();
  root.appendChild(renderTopBar({ title:"Goals", onBack: showPromptScreen }));

  const goals = getLS('goals', []);
  if(!goals.length) root.insertAdjacentHTML('beforeend', `<p>No goals yet.</p>`);

  goals.forEach((g,i)=>{
    const row = document.createElement('div');
    row.style.cssText="border:1px solid #ddd;padding:10px;border-radius:8px;margin:6px 0;";
    row.innerHTML = `<strong>${g.title}</strong>${g.note?`<div>${g.note}</div>`:''}`;
    const del = document.createElement('button'); del.textContent="Remove";
    del.onclick=()=>{ const next = goals.filter((_,idx)=>idx!==i); setLS('goals', next); showGoals(); };
    row.appendChild(del);
    root.appendChild(row);
  });

  const t = document.createElement('input'); t.placeholder="New goal title"; t.style.marginRight='6px';
  const n = document.createElement('input'); n.placeholder="Optional note"; n.style.marginRight='6px';
  const add = document.createElement('button'); add.textContent="Add goal";
  add.onclick=()=>{ const title = t.value.trim(); if(!title) return; const next=[...getLS('goals', []), { title, note:n.value.trim() }]; setLS('goals', next); showGoals(); };
  root.append(t,n,add);
}

// ---------- ONBOARDING / QUIZ ----------
function showPersonaOptions() {
  const root = mountRoot();
  root.appendChild(renderTopBar({ title:"Select Persona", onBack: showHomeScreen }));
  root.insertAdjacentHTML('beforeend', `
    <p style="color:#666;margin-top:-6px;">This helps tailor suggestions. You can change it later.</p>
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
      <button onclick="selectPersona('Student')">Student</button>
      <button onclick="selectPersona('Caregiver')">Caregiver</button>
      <button onclick="selectPersona('Professional')">Professional</button>
      <button onclick="selectPersona('Blank')">Blank Plate</button>
    </div>
    <button onclick="startQuiz()">Skip</button>
  `);
}
function selectPersona(persona) {
  try {
    localStorage.setItem("persona", persona);
    const preset = CATEGORIES_BY_PERSONA[persona] || CATEGORIES_BY_PERSONA.Blank;
    localStorage.setItem("categories", JSON.stringify(preset));
  } catch {}
  startQuiz();
}
function startQuiz() {
  currentQuestionIndex = 0;
  promptScores = {};
  if (!quizData || quizData.length === 0) {
    fetch("lifeplate_onboarding_quiz.json")
      .then((res) => res.json())
      .then((data) => { quizData = data.questions || []; showNextQuizQuestion(); });
  } else { showNextQuizQuestion(); }
}
function showNextQuizQuestion() {
  if (currentQuestionIndex >= quizData.length) { showQuizResults(); return; }
  const q = quizData[currentQuestionIndex];
  const root = mountRoot();
  root.appendChild(renderTopBar({ title:`Quiz ${currentQuestionIndex+1}/${quizData.length}`, onBack: showHomeScreen }));
  const body = document.createElement('div');
  body.innerHTML = `<h2>${q.question}</h2>`;
  q.answers.forEach((a, i) => {
    const b = document.createElement('button'); b.textContent = a.text;
    b.onclick = ()=>selectAnswer(i);
    body.appendChild(b);
    body.appendChild(document.createElement('br')); body.appendChild(document.createElement('br'));
  });
  const skip = document.createElement('button'); skip.textContent="Skip →"; skip.onclick = skipQuestion; body.appendChild(skip);
  $("app").appendChild(body);
}
function selectAnswer(index) {
  const q = quizData[currentQuestionIndex];
  const answer = q.answers[index];
  for (const tag in answer.weights) {
    if (!promptScores[tag]) promptScores[tag] = 0;
    promptScores[tag] += answer.weights[tag];
  }
  currentQuestionIndex++; showNextQuizQuestion();
}
function skipQuestion() { currentQuestionIndex++; showNextQuizQuestion(); }
function showQuizResults() {
  const topTags = getTopPromptTags(promptScores);
  const matchedPrompts = getPromptsByTags(topTags);

  const root = mountRoot();
  root.appendChild(renderTopBar({ title:"Your Prompt Profile", onBack: showHomeScreen }));

  const persona = localStorage.getItem("persona");
  let html = ``;
  if (persona) html += `<p><strong>Persona:</strong> ${persona}</p>`;
  if (topTags.length) html += `<p><strong>Top needs:</strong> ${topTags.join(", ")}</p>`;
  if (matchedPrompts.length) {
    html += `<h3>Suggestions</h3><ul>`;
    matchedPrompts.slice(0,5).forEach(p => { html += `<li>${p.text}</li>`; });
    html += `</ul>`;
  } else {
    html += `<p style="color:#666;">We’ll learn your preferences as you use LifePlate.</p>`;
  }
  html += `<br><button onclick="finishOnboarding()">Continue to LifePlate →</button>
           <button onclick="restartQuiz()">🔁 Retake Quiz</button>`;
  localStorage.setItem("quizScores", JSON.stringify(promptScores));
  $("app").insertAdjacentHTML('beforeend', html);
}
function restartQuiz() {
  try { localStorage.removeItem("quizScores"); } catch {}
  currentQuestionIndex = 0; promptScores = {};
  if (!quizData || quizData.length === 0) {
    fetch("lifeplate_onboarding_quiz.json")
      .then(res => res.ok ? res.json() : { questions: [] })
      .then(data => { quizData = (data && data.questions) ? data.questions : []; showNextQuizQuestion(); })
      .catch(() => { quizData = []; showNextQuizQuestion(); });
  } else { showNextQuizQuestion(); }
}
function finishOnboarding() { localStorage.setItem("onboarded", "true"); showPromptScreen(); }

// ---------- INIT ----------
document.addEventListener("DOMContentLoaded", showHomeScreen);

// ---------- EXPOSE HANDLERS ----------
(function exposeHandlers() {
  // screens
  window.showHomeScreen = showHomeScreen;
  window.showPromptScreen = showPromptScreen;
  window.viewTasksChart = viewTasksChart;
  window.showTaskSuggestions = showTaskSuggestions;
  window.showSupportScreen = showSupportScreen;

  // onboarding / persona / quiz
  window.startOnboarding = startOnboarding;
  window.showPersonaOptions = showPersonaOptions;
  window.selectPersona = selectPersona;
  window.startQuiz = startQuiz;
  window.startQuizWithWarning = startQuizWithWarning;
  window.restartQuiz = restartQuiz;
  window.showNextQuizQuestion = showNextQuizQuestion;
  window.selectAnswer = selectAnswer;
  window.skipQuestion = skipQuestion;
  window.showQuizResults = showQuizResults;
  window.finishOnboarding = finishOnboarding;

  // tasks
  window.showAddTask = showAddTask;
  window.addTask = addTask;

  // plate
  window.showTasksByCategory = showTasksByCategory;

  // suggestions
  window.suggestTasks = suggestTasks;

  // profiles
  window.createProfile = createProfile;
  window.switchProfile = switchProfile;

  // locations / goals
  window.showMyLocationsManager = showMyLocationsManager;
  window.showGoals = showGoals;
})();
