// ===============================
// 🚀 LifePlate App — script.js (Beta Fixes)
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

// Migrate legacy tasks (stored at localStorage["tasks"]) into whatever the current app reads,
// so your existing demo data shows up in the chart.
(function migrateLegacyTasksOnce(){
  try {
    // If your app already reads from "tasks", this is a no-op.
    const legacy = JSON.parse(localStorage.getItem('tasks') || '[]');

    // If a newer store exists (e.g., lp_data_*), only migrate if the new store is empty.
    const activeId = localStorage.getItem('lp_activeProfileId') || 'default';
    const newKey = 'lp_data_' + activeId;
    const newStore = JSON.parse(localStorage.getItem(newKey) || 'null');

    // Case A: app uses lp_data_* (profiles)
    if (newStore && Array.isArray(newStore.tasks)) {
      if (legacy.length && newStore.tasks.length === 0) {
        const categories = JSON.parse(localStorage.getItem('categories') || '[]');
        localStorage.setItem(newKey, JSON.stringify({ tasks: legacy, categories }));
      }
      return;
    }

    // Case B: app uses plain "tasks" (legacy) -> nothing to do, just ensure it's an array
    if (!Array.isArray(legacy)) localStorage.setItem('tasks', '[]');
  } catch(e) {
    // fail safe: never block the app
  }
})();

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

// Load quiz + prompts
fetch("lifeplate_onboarding_quiz.json")
  .then(r => r.ok ? r.json() : { questions: [] })
  .then(data => { quizData = data.questions || []; })
  .catch(() => { quizData = []; });

fetch("promptLibrary.json")
  .then(r => r.ok ? r.json() : [])
  .then(data => { promptLibrary = data || []; })
  .catch(() => { promptLibrary = []; });

// Helpers for prompts
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

  // Restore button if backup exists
  const hasBackup = !!getLS('backup_plate', null) || !!getLS('backup_persona', null);

  root.insertAdjacentHTML('beforeend', `
    <h1>Welcome to LifePlate 🍽️</h1>
    <div style="margin:8px 0;">
      <button onclick="startOnboarding()">Start</button>
      <button onclick="showPromptScreen()">Go to App</button>
      <button onclick="showMyLocationsManager()">My Locations</button>
      <button onclick="showGoals()">Goals</button>
      ${hasBackup ? `<button id="restoreBtn">Restore Plate + Persona</button>` : ``}
    </div>
  `);
  if (hasBackup) {
    $("restoreBtn").onclick = () => {
      const bp = getLS('backup_plate', []);
      const bper = getLS('backup_persona', null);
      setLS('tasks', bp);
      setLS('persona', bper);
      alert("Restored your Plate and persona.");
      showHomeScreen();
    };
  }
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

  root.appendChild(renderTopBar({ title:"Prompt Hub" }));
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
  // backup first
  setLS('backup_plate', getTasks());
  setLS('backup_persona', localStorage.getItem('persona') || null);
  const ok = confirm("Retaking the onboarding quiz will wipe your current Plate and persona. You can restore them from Home. Continue?");
  if(!ok) return;
  // wipe
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
  const wrap = document.createElement('div'); wrap.style.marginTop='6px';
  (TAGS_BY_CATEGORY[cat]||[]).forEach(tag=>{
    const btn = document.createElement('button'); btn.className='chip'; btn.textContent = tag; btn.style.marginRight='6px';
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
    <input type="text" id="taskTitle" placeholder="What is the task?"/><br><br>

    <label>Category</label><br>
    <select id="taskCategory">
      ${categoryOptions}
      <option value="__OTHER__">Other…</option>
    </select>
    <div id="otherCategoryRow" style="display:none; margin-top:6px;">
      <input id="taskCategoryOther" placeholder="Type a category"/>
    </div>
    <br>

    <label>Estimate (min, optional)</label><br>
    <input type="number" id="taskDuration" placeholder="e.g., 15"/><br><br>

    <label>Energy (optional)</label><br>
    <select id="taskEnergy">
      <option value="">Any</option>
      <option value="Low">Low</option>
      <option value="Medium">Medium</option>
      <option value="High">High</option>
    </select><br><br>

    <label>Location (optional)</label><br>
    <input type="text" id="taskLocation" placeholder="Home, Library, Gym"/><br>
    <div id="myLocChips" style="margin:6px 0;"></div>

    <label>Tags (optional)</label><br>
    <input type="text" id="taskTags" placeholder="comma separated"/><br>
    <div id="autoTags" style="margin:6px 0;"></div>

    <label>Notes (optional)</label><br>
    <textarea id="taskNotes" placeholder="Notes or links..."></textarea><br><br>

    <button id="saveTask">➕ Save Task</button>
  `;
  root.appendChild(form);

  // wire up dynamic bits
  const catSel = form.querySelector('#taskCategory');
  const otherRow = form.querySelector('#otherCategoryRow');
  const refreshAuto = ()=>{
    const holder = form.querySelector('#autoTags');
    holder.innerHTML = `<div>Suggestions:</div>`;
    holder.appendChild(renderTagsForCategory(catSel.value));
  };
  catSel.onchange = ()=>{
    otherRow.style.display = (catSel.value === "__OTHER__") ? 'block' : 'none';
    refreshAuto();
  };
  refreshAuto();

  // My Locations chips
  form.querySelector('#myLocChips').appendChild(renderLocationChips());

  form.querySelector('#saveTask').onclick = addTask;
}

function addTask() {
  const title = $("taskTitle").value.trim();
  if (!title){ alert("Please add a title"); return; }

  // category
  let category = $("taskCategory").value;
  if (category === "__OTHER__") {
    category = ($("taskCategoryOther").value || "").trim() || "Other";
    const cats = getCategories();
    if (!cats.includes(category)) {
      try { localStorage.setItem("categories", JSON.stringify([...cats, category])); } catch {}
    }
  }

  const duration = parseInt($("taskDuration").value, 10); // optional
  const energy = $("taskEnergy").value || null;
  const location = ($("taskLocation").value || "").trim() || null;
  const tags = ($("taskTags").value || "").split(",").map(t => t.trim()).filter(Boolean);
  const notes = ($("taskNotes").value || "").trim() || null;

  const tasks = getTasks();
  tasks.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    title, category,
    duration: isNaN(duration) ? null : duration,
    energy, location, tags, notes,
    createdAt: Date.now()
  });
  saveTasks(tasks);
  alert("Task added.");
  showPromptScreen();
}

// ---------- VIEW PLATE (DEFAULT PIE) ----------
function viewTasksChart() {
  currentScreen = "view_chart";
  const root = mountRoot();
  root.appendChild(renderTopBar({ title:"My Plate", onBack: showPromptScreen }));

  const tasks = getTasks();

  // counts by category
  const baseCats = getCategories();
  const counts = {};
  baseCats.forEach(cat => counts[cat] = 0);
  tasks.forEach(t => {
    const cat = (t.category || "Uncategorized");
    if (!(cat in counts)) counts[cat] = 0;
    counts[cat]++;
  });
  const labels = Object.keys(counts).filter(cat => counts[cat] > 0);
  const data = labels.map(cat => counts[cat]);

  // Clear My Plate button
  // instead of wiping, send users to the Clear-My-Plate flow
const clearBtn = document.createElement('button');
clearBtn.textContent = "Clear My Plate";
clearBtn.onclick = () => {
  // go to the same screen as the Home button “Clear My Plate”
  if (typeof showTaskSuggestions === 'function') {
    showTaskSuggestions();
  } else {
    // fallback: if your function name differs
    alert("Clear My Plate is under the Suggestions screen.");
  }
};
root.appendChild(clearBtn);


  root.insertAdjacentHTML('beforeend', `
    <canvas id="taskChart" width="340" height="340"></canvas>
    <div style="margin-top:12px;"></div>
  `);
  root.appendChild(clearBtn);

  const ctx = document.getElementById("taskChart").getContext("2d");
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
    card.innerHTML = `
      <strong>${t.title}</strong><br>
      ${(t.duration ?? "-")} min • ${(t.energy || "-")} • ${(t.category || "-")}<br>
      ${t.location ? `@ ${t.location}<br>`:``}
      ${t.tags && t.tags.length ? `Tags: ${t.tags.join(', ')}` : ``}
    `;
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

  // Prompt suggestion
  const quizScores = JSON.parse(localStorage.getItem("quizScores") || "{}");
  const topTags = getTopPromptTags(quizScores);
  const promptSuggestions = getPromptsByTags(topTags);
  const randomPrompt = promptSuggestions.length
    ? promptSuggestions[Math.floor(Math.random() * promptSuggestions.length)].text
    : "Take a breath — even one small step is progress.";

  // Filter across the WHOLE plate (≤ energy, ≤ time if provided)
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
  const root = $("app");
  const picks = pickThree(_lastCandidates);

  const container = document.createElement('div');
  container.innerHTML = `
    <h2>Your Plate Picks</h2>
    <p><em>${randomPrompt}</em></p>
    <p>Mood: <strong>${mood}</strong> → Energy: <strong>${inferredEnergy}</strong></p>
  `;

  if (picks.length === 0) {
    // Low energy mindful moment or tiny step toward goal
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
      card.innerHTML = `
        <strong>${t.title}</strong><br>
        ${(t.duration ?? 0)} min • ${(t.energy || "Medium")} • ${(t.category || "-")}<br>
        ${t.location ? `@ ${t.location}<br>` : ``}
      `;
      const actions = document.createElement('div'); actions.style.marginTop='8px';

      // Motivate
      const btnMot = document.createElement('button'); btnMot.textContent="Motivate";
      btnMot.onclick = ()=>{ const q = getQuoteForPersona(); alert(`“${q.text}” — ${q.author}`); };

      // Cleared
      const btnDone = document.createElement('button'); btnDone.textContent="Cleared";
      btnDone.onclick = ()=>{
        const remaining = getTasks().filter(x => x.id !== t.id);
        saveTasks(remaining);
        launchConfetti();
        alert("Nice! Task cleared.");
        suggestTasks(); // refresh list
      };

      actions.appendChild(btnMot); actions.appendChild(btnDone);
      card.appendChild(actions);
      container.appendChild(card);
    });
  }

  // Reshuffle
  const reshuffle = document.createElement('button');
  reshuffle.textContent = "Reshuffle";
  reshuffle.onclick = ()=> renderSuggestionPicks({ mood, inferredEnergy, randomPrompt });

  // Nav
  const back = document.createElement('button'); back.textContent="Back"; back.onclick = showTaskSuggestions;
  const home = document.createElement('button'); home.textContent="Main"; home.onclick = showPromptScreen;

  container.appendChild(reshuffle);
  container.appendChild(back);
  container.appendChild(home);

  mountRoot(); // clear then reattach
  const top = renderTopBar({ title:"Clear My Plate", onBack: showPromptScreen });
  $("app").appendChild(top);
  $("app").appendChild(container);

  // Save mood history
  const history = loadFromLocal("moodHistory");
  history.push({ mood, timestamp: new Date().toISOString() });
  saveToLocal("moodHistory", history);
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

// ---------- GOALS (lightweight) ----------
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
