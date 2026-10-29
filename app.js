/* =========================================================
   FitPulse — Vanilla JS App
   ========================================================= */

/* ---------- Storage helpers ---------- */
const LS = {
  get: (k, d = null) => {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? d;
    } catch {
      return d;
    }
  },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  del: (k) => localStorage.removeItem(k),
};

/* ---------- Browser-only password derivation for local demo accounts ---------- */
const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
async function hashPassword(password, saltHex = null) {
  if (!crypto.subtle) throw new Error("Secure password storage needs a modern browser on localhost or HTTPS.");
  const salt = saltHex
    ? Uint8Array.from(saltHex.match(/.{2}/g), (byte) => parseInt(byte, 16))
    : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" }, key, 256);
  return `${hex(salt)}:${hex(new Uint8Array(bits))}`;
}
async function verifyPassword(password, stored) {
  if (stored?.includes(":")) {
    const [salt, expected] = stored.split(":");
    const actual = (await hashPassword(password, salt)).split(":")[1];
    return actual === expected;
  }
  return stored === btoa(unescape(encodeURIComponent(password))).split("").reverse().join("");
}

/* ---------- State ---------- */
const state = {
  users: LS.get("fp_users", []),
  current: LS.get("fp_current", null),
  workouts: LS.get("fp_workouts", []),
  meals: LS.get("fp_meals", []),
  water: LS.get("fp_water", {}),
  activity: LS.get("fp_activity", {}),
  goals: LS.get("fp_goals", []),
  favorites: LS.get("fp_favorites", []),
  profile: LS.get("fp_profile", {}),
  settings: LS.get("fp_settings", {
    dark: false,
    notif: true,
    waterRem: true,
    workoutRem: true,
  }),
  analytics: LS.get("fp_analytics", { bmi: [] }),
  notifications: LS.get("fp_notifs", []),
  calDate: new Date(),
};

const save = () => {
  LS.set("fp_users", state.users);
  LS.set("fp_current", state.current);
  if (!state.current) return;
  try {
    LS.set(`fp_user_data_${state.current}`, userData());
  } catch (error) {
    console.error("Could not save FitPulse data", error);
    toast("Storage is full. Export a backup and remove large files.", "error");
  }
};

const emptyUserData = () => ({
  workouts: [], meals: [], water: {}, activity: {}, goals: [], favorites: [],
  profile: {}, settings: { dark: false, notif: true, waterRem: true, workoutRem: true },
  analytics: { bmi: [] }, notifications: [],
});
function userData() {
  return Object.fromEntries(Object.keys(emptyUserData()).map((key) => [key, state[key]]));
}
function loadUserData(userId) {
  const stored = LS.get(`fp_user_data_${userId}`);
  Object.assign(state, stored ? { ...emptyUserData(), ...stored } : emptyUserData());
  if (!stored) save();
}
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

/* ---------- Utils ---------- */
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fmtDate = (d) =>
  new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

function toast(msg, type = "info") {
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  const icon = document.createElement("i");
  icon.className = `fa-solid ${type === "success" ? "fa-circle-check" : type === "error" ? "fa-circle-xmark" : "fa-circle-info"}`;
  t.append(icon, document.createTextNode(` ${msg}`));
  $("#toastContainer").appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateX(120%)";
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

function pushNotif(msg) {
  if (!state.settings.notif) return;
  state.notifications.unshift({
    id: uid(),
    msg,
    time: new Date().toISOString(),
  });
  state.notifications = state.notifications.slice(0, 20);
  save();
  renderNotifs();
}

/* ---------- Loader & Auth init ---------- */
window.addEventListener("load", () => {
  setTimeout(() => {
    $("#loader").classList.add("hidden");
    if (state.current) {
      if (!state.users.some((u) => u.id === state.current)) state.current = null;
    }
    if (state.current) {
      showApp();
    } else {
      showLanding();
    }
  }, 600);
  applyTheme();
});

/* ---------- Public landing <-> auth overlay ---------- */
function showLanding() {
  document.body.classList.add("on-landing");
  $("#landing").classList.remove("hidden");
  $("#authScreen").classList.add("hidden");
  $("#app").classList.add("hidden");
  if (window.fitPulseClock) clearInterval(window.fitPulseClock);
  if (window.fitPulseReminders) clearInterval(window.fitPulseReminders);
}
function openAuth(tab = "login") {
  const t = document.querySelector(`.auth-tabs .tab[data-tab="${tab}"]`);
  if (t) t.click();
  $("#authScreen").classList.remove("hidden");
  const first = $(tab === "register" ? "#regName" : "#loginEmail");
  if (first) setTimeout(() => first.focus(), 50);
}
function closeAuth() {
  if (!state.current) $("#authScreen").classList.add("hidden");
}
$("#authBack").onclick = closeAuth;
$("#authScreen").addEventListener("click", (e) => {
  if (e.target.id === "authScreen") closeAuth();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("#authScreen").classList.contains("hidden")) closeAuth();
});

/* ---------- Auth Tabs ---------- */
$$(".auth-tabs .tab").forEach((t) => {
  t.onclick = () => {
    $$(".auth-tabs .tab").forEach((x) => x.classList.remove("active"));
    t.classList.add("active");
    const isLogin = t.dataset.tab === "login";
    $("#loginForm").classList.toggle("hidden", !isLogin);
    $("#registerForm").classList.toggle("hidden", isLogin);
  };
});

/* ---------- Password toggle ---------- */
$$(".toggle-pwd").forEach((i) => {
  i.onclick = () => {
    const inp = $("#" + i.dataset.target);
    inp.type = inp.type === "password" ? "text" : "password";
    i.classList.toggle("fa-eye");
    i.classList.toggle("fa-eye-slash");
  };
});

/* ---------- Register ---------- */
$("#registerForm").onsubmit = async (e) => {
  e.preventDefault();
  const name = $("#regName").value.trim();
  const email = $("#regEmail").value.trim().toLowerCase();
  const pwd = $("#regPassword").value;
  const conf = $("#regConfirm").value;
  if (pwd !== conf) {
    toast("Passwords do not match", "error");
    return;
  }
  if (state.users.some((u) => u.email === email)) {
    toast("Email already registered", "error");
    return;
  }
  let passwordHash;
  try {
    passwordHash = await hashPassword(pwd);
  } catch (error) {
    toast(error.message, "error");
    return;
  }
  const user = {
    id: uid(),
    name,
    email,
    password: passwordHash,
    createdAt: new Date().toISOString(),
  };
  state.users.push(user);
  state.current = user.id;
  Object.assign(state, emptyUserData());
  state.profile = { name, email, ...takeCalcResult() };
  save();
  toast("Account created!", "success");
  showApp();
};

/* ---------- Login ---------- */
$("#loginForm").onsubmit = async (e) => {
  e.preventDefault();
  const email = $("#loginEmail").value.trim().toLowerCase();
  const pwd = $("#loginPassword").value;
  const user = state.users.find((u) => u.email === email);
  let valid = false;
  if (user) {
    try { valid = await verifyPassword(pwd, user.password); }
    catch (error) { toast(error.message, "error"); return; }
  }
  if (!user || !valid) {
    toast("Invalid credentials", "error");
    return;
  }
  if (!user.password.includes(":")) user.password = await hashPassword(pwd);
  state.current = user.id;
  loadUserData(user.id);
  save();
  toast(`Welcome back, ${user.name}!`, "success");
  showApp();
};

/* ---------- Logout ---------- */
$("#logoutBtn").onclick = () => {
  state.current = null;
  save();
  showLanding();
  window.scrollTo(0, 0);
  toast("Logged out", "info");
};

/* ---------- Show App ---------- */
function showApp() {
  loadUserData(state.current);
  applyTheme();
  document.body.classList.remove("on-landing");
  $("#landing").classList.add("hidden");
  $("#authScreen").classList.add("hidden");
  $("#app").classList.remove("hidden");
  loadProfile();
  renderAll();
  startClock();
  scheduleReminders();
  routeTrackerFromHash();
  window.dispatchEvent(new CustomEvent("fitpulse:account", { detail: { id: state.current } }));
}

/* ---------- Navigation ---------- */
const TRACKER_SECTIONS = new Set(Array.from($$(".nav-link[data-section]")).map(link => link.dataset.section));
function navigateTracker(section, { recipeId = "", updateHistory = true } = {}) {
  if (!TRACKER_SECTIONS.has(section)) section = "dashboard";
  const route = section === "nutrition" && recipeId ? `nutrition/recipe/${encodeURIComponent(recipeId)}` : section;
  if (updateHistory && location.hash !== `#${route}`) history.pushState(null, "", `#${route}`);
  $$(".nav-link[data-section]").forEach(link => {
    const active = link.dataset.section === section;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
  });
  $$("#app .section").forEach(el => el.classList.toggle("active", el.id === `sec-${section}`));
  $("#sec-nutrition").classList.toggle("recipe-view", section === "nutrition" && Boolean(recipeId));
  if (window.innerWidth <= 992) $("#sidebar").classList.remove("open");
  if (section === "analytics") renderCharts();
  if (section === "calendar") renderCalendar();
  if (section === "nutrition") renderMeals();
  window.dispatchEvent(new CustomEvent("fitpulse:navigate", { detail: { section, recipeId } }));
}
function routeTrackerFromHash() {
  if (!state.current || $("#app").classList.contains("hidden")) return;
  let parts;
  try { parts = decodeURIComponent(location.hash.slice(1)).split("/"); } catch { parts = []; }
  navigateTracker(TRACKER_SECTIONS.has(parts[0]) ? parts[0] : "dashboard", {recipeId: parts[0] === "nutrition" && parts[1] === "recipe" ? parts[2] || "" : "", updateHistory:false});
}
window.addEventListener("hashchange", routeTrackerFromHash);
window.addEventListener("popstate", routeTrackerFromHash);
$$(".nav-link").forEach((l) => {
  l.onclick = (event) => {
    event.preventDefault();
    navigateTracker(l.dataset.section);
  };
});
$("#menuToggle").onclick = () => {
  if (window.innerWidth <= 992) {
    const opened = $("#sidebar").classList.toggle("open");
    if (opened) setTimeout(() => $("#sidebar .nav-link.active")?.focus(),0);
  }
  else {
    const collapsed = document.body.classList.toggle("sidebar-collapsed");
    LS.set("fp_sidebar_collapsed",collapsed);
  }
};

/* ---------- Modal system ---------- */
$$("[data-modal]").forEach((b) => {
  b.onclick = () => {
    const id = b.dataset.modal;
    const addForms = {workoutModal:["workoutForm","workoutId","workoutModalTitle","Add Workout"],mealModal:["mealForm","mealId","mealModalTitle","Add Meal"],goalModal:["goalForm","goalId","goalModalTitle","Add Goal"]};
    if (addForms[id]) {
      const [form, field, heading, title] = addForms[id];
      $("#" + form).reset();
      $("#" + field).value = "";
      $("#" + heading).textContent = title;
    }
    $("#modalOverlay").classList.remove("hidden");
    $$("#modalOverlay .modal").forEach((m) => m.classList.add("hidden"));
    $("#" + id).classList.remove("hidden");
    if (id === "workoutModal" && !$("#workoutId").value)
      $("#wDate").value = today();
    if (id === "mealModal") $("#mDate").value = $("#mealLogDate")?.value || today();
  };
});
$$(".modal-close").forEach(
  (b) =>
    (b.onclick = () => {
      $("#modalOverlay").classList.add("hidden");
      [
        "workoutForm",
        "mealForm",
        "goalForm",
        "waterGoalForm",
        "pwdForm",
      ].forEach((f) => $("#" + f).reset());
      ["workoutId", "mealId", "goalId"].forEach((f) => ($("#" + f).value = ""));
    }),
);
$("#modalOverlay").onclick = (e) => {
  if (e.target.id === "modalOverlay") $("#modalOverlay .modal:not(.hidden) .modal-close")?.click();
};

/* Values calculated on the public landing page become starting profile data */
function takeCalcResult() {
  try {
    const c = JSON.parse(sessionStorage.getItem("fp_calc") || "null");
    sessionStorage.removeItem("fp_calc");
    if (!c) return {};
    return { age: c.age, height: c.height, weight: c.weight, gender: c.gender, calGoal: c.cal };
  } catch { return {}; }
}
const calorieGoal = () => Math.max(1200, Number(state.profile?.calGoal) || 2000);

/* =========================================================
   PROFILE
   ========================================================= */
function loadProfile() {
  const p = state.profile || {};
  $("#pfName").value = p.name || "";
  $("#pfEmail").value = p.email || "";
  $("#pfAge").value = p.age || "";
  $("#pfGender").value = p.gender || "Male";
  $("#pfHeight").value = p.height || "";
  $("#pfWeight").value = p.weight || "";
  $("#pfLevel").value = p.level || "Beginner";
  $("#pfCalGoal").value = p.calGoal || "";
  updateBMI();
  const img = p.avatar || "assets/avatar.svg";
  $("#profileImg").src = img;
  $("#userAvatar").src = img;
  $("#userName").textContent = p.name || "User";
  $("#welcomeText").textContent = `Welcome back, ${(p.name || "User").split(" ")[0]}!`;
}
function updateBMI() {
  const h = parseFloat($("#pfHeight").value),
    w = parseFloat($("#pfWeight").value);
  if (h > 0 && w > 0) {
    const bmi = (w / (h / 100) ** 2).toFixed(1);
    $("#pfBMI").value = bmi;
    $("#sumBMI").textContent = bmi;
    // Save BMI history
    const entry = { date: today(), bmi: parseFloat(bmi) };
    const hist = state.analytics.bmi.filter((x) => x.date !== today());
    hist.push(entry);
    state.analytics.bmi = hist.slice(-30);
    save();
  } else { $("#pfBMI").value = "--"; $("#sumBMI").textContent = "--"; }
}
["pfHeight", "pfWeight"].forEach((id) =>
  $("#" + id).addEventListener("input", updateBMI),
);

$("#profileImgInput").onchange = (e) => {
  const f = e.target.files[0];
  if (!f) return;
  if (!f.type.startsWith("image/") || f.size > 2 * 1024 * 1024) {
    e.target.value = "";
    toast("Choose an image smaller than 2 MB", "error");
    return;
  }
  const r = new FileReader();
  r.onload = (ev) => {
    state.profile.avatar = ev.target.result;
    save();
    $("#profileImg").src = ev.target.result;
    $("#userAvatar").src = ev.target.result;
    toast("Profile image updated", "success");
  };
  r.readAsDataURL(f);
};

$("#profileForm").onsubmit = (e) => {
  e.preventDefault();
  const email = $("#pfEmail").value.trim().toLowerCase();
  if (state.users.some((x) => x.id !== state.current && x.email.toLowerCase() === email)) {
    toast("That email is already used by another local account", "error");
    return;
  }
  state.profile = {
    ...state.profile,
    name: $("#pfName").value.trim(),
    email,
    age: $("#pfAge").value,
    gender: $("#pfGender").value,
    height: $("#pfHeight").value,
    weight: $("#pfWeight").value,
    level: $("#pfLevel").value,
    calGoal: $("#pfCalGoal").value ? Number($("#pfCalGoal").value) : undefined,
  };
  // sync user name/email
  const u = state.users.find((x) => x.id === state.current);
  if (u) {
    u.name = state.profile.name;
    u.email = state.profile.email;
  }
  save();
  loadProfile();
  toast("Profile saved", "success");
  renderAll();
};

/* =========================================================
   WORKOUTS
   ========================================================= */
$("#workoutForm").onsubmit = (e) => {
  e.preventDefault();
  const id = $("#workoutId").value;
  const data = {
    id: id || uid(),
    name: $("#wName").value.trim(),
    category: $("#wCategory").value,
    duration: parseInt($("#wDuration").value),
    calories: parseInt($("#wCalories").value),
    date: $("#wDate").value,
    notes: $("#wNotes").value.trim(),
  };
  if (id) {
    const i = state.workouts.findIndex((w) => w.id === id);
    state.workouts[i] = data;
    toast("Workout updated", "success");
  } else {
    state.workouts.push(data);
    toast("Workout added", "success");
    pushNotif(`Logged workout: ${data.name}`);
  }
  save();
  renderWorkouts();
  renderDashboard();
  renderFavorites();
  renderCalendar();
  $("#modalOverlay").classList.add("hidden");
  $("#workoutForm").reset();
  $("#workoutId").value = "";
};

function renderWorkouts() {
  const list = $("#workoutList");
  list.innerHTML = "";
  const q = $("#workoutSearch").value.toLowerCase();
  const cat = $("#workoutCategoryFilter").value;
  const sort = $("#workoutSort").value;
  let items = [...state.workouts];
  if (q)
    items = items.filter(
      (w) =>
        w.name.toLowerCase().includes(q) || w.notes.toLowerCase().includes(q),
    );
  if (cat) items = items.filter((w) => w.category === cat);
  items.sort((a, b) => {
    if (sort === "date-desc") return new Date(b.date) - new Date(a.date);
    if (sort === "date-asc") return new Date(a.date) - new Date(b.date);
    if (sort === "cal-desc") return b.calories - a.calories;
    if (sort === "dur-desc") return b.duration - a.duration;
  });
  if (!items.length) {
    list.innerHTML =
      '<p class="muted">No workouts yet. Add your first one!</p>';
    return;
  }
  items.forEach((w) => {
    const fav = state.favorites.includes(w.id);
    list.insertAdjacentHTML(
      "beforeend",
      `
      <div class="card glass list-item">
        <button class="fav-btn ${fav ? "active" : ""}" data-fav="${w.id}"><i class="fa-${fav ? "solid" : "regular"} fa-heart"></i></button>
        <h4>${escapeHTML(w.name)}<span class="tag">${escapeHTML(w.category)}</span></h4>
        <div class="meta">
          <span><i class="fa-solid fa-clock"></i>${w.duration} min</span>
          <span><i class="fa-solid fa-fire"></i>${w.calories} kcal</span>
          <span><i class="fa-solid fa-calendar"></i>${fmtDate(w.date)}</span>
        </div>
        ${w.notes ? `<p class="muted">${escapeHTML(w.notes)}</p>` : ""}
        <div class="actions">
          <button data-edit-w="${w.id}"><i class="fa-solid fa-pen"></i> Edit</button>
          <button data-del-w="${w.id}"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>
      </div>`,
    );
  });
  list
    .querySelectorAll("[data-fav]")
    .forEach((b) => (b.onclick = () => toggleFav(b.dataset.fav)));
  list
    .querySelectorAll("[data-edit-w]")
    .forEach((b) => (b.onclick = () => editWorkout(b.dataset.editW)));
  list
    .querySelectorAll("[data-del-w]")
    .forEach((b) => (b.onclick = () => deleteWorkout(b.dataset.delW)));
}
function editWorkout(id) {
  const w = state.workouts.find((x) => x.id === id);
  if (!w) return;
  $("#workoutId").value = w.id;
  $("#wName").value = w.name;
  $("#wCategory").value = w.category;
  $("#wDuration").value = w.duration;
  $("#wCalories").value = w.calories;
  $("#wDate").value = w.date;
  $("#wNotes").value = w.notes;
  $("#workoutModalTitle").textContent = "Edit Workout";
  $("#modalOverlay").classList.remove("hidden");
  $$("#modalOverlay .modal").forEach((m) => m.classList.add("hidden"));
  $("#workoutModal").classList.remove("hidden");
}
function deleteWorkout(id) {
  if (!confirm("Delete this workout?")) return;
  state.workouts = state.workouts.filter((w) => w.id !== id);
  state.favorites = state.favorites.filter(favorite => favorite !== id);
  save();
  renderWorkouts();
  renderDashboard();
  renderFavorites();
  renderCalendar();
  toast("Workout deleted", "info");
}
["workoutSearch", "workoutCategoryFilter", "workoutSort"].forEach((id) =>
  $("#" + id).addEventListener("input", renderWorkouts),
);

/* =========================================================
   MEALS
   ========================================================= */
$("#mealForm").onsubmit = (e) => {
  e.preventDefault();
  const id = $("#mealId").value;
  const data = {
    id: id || uid(),
    name: $("#mName").value.trim(),
    type: $("#mType").value,
    calories: parseInt($("#mCal").value) || 0,
    protein: parseInt($("#mPro").value) || 0,
    carbs: parseInt($("#mCarb").value) || 0,
    fat: parseInt($("#mFat").value) || 0,
    date: $("#mDate").value,
  };
  if (id) {
    const i = state.meals.findIndex((m) => m.id === id);
    state.meals[i] = data;
    toast("Meal updated", "success");
  } else {
    state.meals.push(data);
    toast("Meal added", "success");
  }
  save();
  $("#mealLogDate").value = data.date;
  $("#mealDateScope").value = "day";
  renderMeals();
  renderDashboard();
  $("#modalOverlay").classList.add("hidden");
  $("#mealForm").reset();
  $("#mealId").value = "";
};
function renderMeals() {
  if (!$("#mealLogDate").value) $("#mealLogDate").value = today();
  const todaysMeals = state.meals.filter((m) => m.date === $("#mealLogDate").value);
  [["nutCal", "calories"], ["nutPro", "protein"], ["nutCarb", "carbs"], ["nutFat", "fat"]].forEach(([id, field]) => {
    const total = todaysMeals.reduce((sum, meal) => sum + (Number(meal[field]) || 0), 0);
    $("#" + id).textContent = total.toLocaleString(undefined, { maximumFractionDigits: 1 });
  });
  const list = $("#mealList");
  list.innerHTML = "";
  const q = $("#mealSearch").value.toLowerCase();
  const type = $("#mealTypeFilter").value;
  let items = [...state.meals];
  if ($("#mealDateScope").value !== "all") items = items.filter(meal => meal.date === $("#mealLogDate").value);
  if (q) items = items.filter((m) => m.name.toLowerCase().includes(q));
  if (type) items = items.filter((m) => m.type === type);
  items.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (!items.length) {
    list.innerHTML = '<p class="muted">No meals match this view. Choose another date or log a meal from the food library above.</p>';
    return;
  }
  items.forEach((m) => {
    list.insertAdjacentHTML(
      "beforeend",
      `
      <div class="card glass list-item">
        <h4>${escapeHTML(m.name)}<span class="tag">${escapeHTML(m.type)}</span></h4>
        <div class="meta">
          <span><i class="fa-solid fa-fire"></i>${m.calories} kcal</span>
          <span><i class="fa-solid fa-drumstick-bite"></i>P ${m.protein}g</span>
          <span><i class="fa-solid fa-bread-slice"></i>C ${m.carbs}g</span>
          <span><i class="fa-solid fa-cheese"></i>F ${m.fat}g</span>
          <span><i class="fa-solid fa-calendar"></i>${fmtDate(m.date)}</span>
        </div>
        <div class="actions">
          <button data-edit-m="${m.id}"><i class="fa-solid fa-pen"></i> Edit</button>
          <button data-del-m="${m.id}"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>
      </div>`,
    );
  });
  list
    .querySelectorAll("[data-edit-m]")
    .forEach((b) => (b.onclick = () => editMeal(b.dataset.editM)));
  list
    .querySelectorAll("[data-del-m]")
    .forEach((b) => (b.onclick = () => deleteMeal(b.dataset.delM)));
}
function editMeal(id) {
  const m = state.meals.find((x) => x.id === id);
  if (!m) return;
  $("#mealId").value = m.id;
  $("#mName").value = m.name;
  $("#mType").value = m.type;
  $("#mCal").value = m.calories;
  $("#mPro").value = m.protein;
  $("#mCarb").value = m.carbs;
  $("#mFat").value = m.fat;
  $("#mDate").value = m.date;
  $("#mealModalTitle").textContent = "Edit Meal";
  $("#modalOverlay").classList.remove("hidden");
  $$("#modalOverlay .modal").forEach((m) => m.classList.add("hidden"));
  $("#mealModal").classList.remove("hidden");
}
function deleteMeal(id) {
  if (!confirm("Delete this meal?")) return;
  state.meals = state.meals.filter((m) => m.id !== id);
  save();
  renderMeals();
  renderDashboard();
  toast("Meal deleted", "info");
}
["mealSearch", "mealTypeFilter", "mealLogDate", "mealDateScope"].forEach((id) =>
  $("#" + id).addEventListener("input", renderMeals),
);

/* =========================================================
   WATER
   ========================================================= */
function todayWater() {
  const d = today();
  if (!state.water[d]) state.water[d] = { amount: 0, goal: 2500 };
  return state.water[d];
}
function renderWater() {
  const w = todayWater();
  $("#waterCurrent").textContent = w.amount + " ml";
  $("#waterGoal").textContent = w.goal;
  $("#waterRemaining").textContent = Math.max(0, w.goal - w.amount);
  const pct = Math.min(100, (w.amount / w.goal) * 100);
  $("#waterBar").style.width = pct + "%";
  $("#waterFill").style.height = pct + "%";
}
$$("[data-water]").forEach(
  (b) =>
    (b.onclick = () => {
      const w = todayWater();
      w.amount += parseInt(b.dataset.water);
      save();
      renderWater();
      renderDashboard();
      toast(`+${b.dataset.water} ml added`, "success");
      if (w.amount >= w.goal) pushNotif("🎉 Water goal reached!");
    }),
);
$("#resetWater").onclick = () => {
  const w = todayWater();
  w.amount = 0;
  save();
  renderWater();
  renderDashboard();
};
$("#waterGoalForm").onsubmit = (e) => {
  e.preventDefault();
  const w = todayWater();
  w.goal = parseInt($("#wgGoal").value);
  save();
  renderWater();
  renderDashboard();
  $("#modalOverlay").classList.add("hidden");
  toast("Water goal set", "success");
};

/* =========================================================
   ACTIVITY
   ========================================================= */
function todayActivity() {
  const d = today();
  if (!state.activity[d])
    state.activity[d] = { steps: 0, distance: 0, minutes: 0 };
  return state.activity[d];
}
$("#activityForm").onsubmit = (e) => {
  e.preventDefault();
  const a = todayActivity();
  a.steps += parseInt($("#actStepsIn").value) || 0;
  a.distance += parseFloat($("#actDistIn").value) || 0;
  a.minutes += parseInt($("#actMinIn").value) || 0;
  save();
  renderActivity();
  renderDashboard();
  $("#activityForm").reset();
  toast("Activity saved", "success");
};
function renderActivity() {
  const a = todayActivity();
  $("#actSteps").textContent = a.steps;
  $("#actDist").textContent = a.distance.toFixed(1);
  $("#actMin").textContent = a.minutes;
  const goals = { steps: 10000, distance: 5, minutes: 60 };
  const set = (id, val, goal) => {
    const p = Math.min(100, (val / goal) * 100);
    $("#" + id + "Bar").style.width = p + "%";
    $("#" + id + "Pct").textContent = Math.round(p) + "%";
  };
  set("actSteps", a.steps, goals.steps);
  set("actDist", a.distance, goals.distance);
  set("actMin", a.minutes, goals.minutes);
}

/* =========================================================
   GOALS
   ========================================================= */
$("#goalForm").onsubmit = (e) => {
  e.preventDefault();
  const id = $("#goalId").value;
  const data = {
    id: id || uid(),
    title: $("#gTitle").value.trim(),
    target: parseInt($("#gTarget").value),
    current: parseInt($("#gCurrent").value) || 0,
    unit: $("#gUnit").value.trim(),
    deadline: $("#gDeadline").value,
    completed: false,
  };
  if (id) {
    const i = state.goals.findIndex((g) => g.id === id);
    data.completed = state.goals[i].completed;
    state.goals[i] = data;
    toast("Goal updated", "success");
  } else {
    state.goals.push(data);
    toast("Goal created", "success");
  }
  save();
  renderGoals();
  $("#modalOverlay").classList.add("hidden");
  $("#goalForm").reset();
  $("#goalId").value = "";
};
function renderGoals() {
  const list = $("#goalList");
  list.innerHTML = "";
  if (!state.goals.length) {
    list.innerHTML = '<p class="muted">No goals yet. Set your first one!</p>';
    return;
  }
  state.goals.forEach((g) => {
    const pct = Math.min(100, (g.current / g.target) * 100);
    list.insertAdjacentHTML(
      "beforeend",
      `
      <div class="card glass list-item goal-item ${g.completed ? "completed" : ""}">
        <div class="goal-head">
          <h4>${escapeHTML(g.title)}</h4>
          <span class="tag">${g.current}/${g.target} ${escapeHTML(g.unit || "")}</span>
        </div>
        <div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="goal-stats">
          <span><i class="fa-solid fa-bullseye"></i>${Math.round(pct)}%</span>
          ${g.deadline ? `<span><i class="fa-solid fa-calendar"></i>${fmtDate(g.deadline)}</span>` : ""}
        </div>
        <div class="actions">
          <button data-gcur="${g.id}"><i class="fa-solid fa-plus"></i> Progress</button>
          <button data-gdone="${g.id}"><i class="fa-solid fa-${g.completed ? "undo" : "check"}"></i> ${g.completed ? "Reopen" : "Complete"}</button>
          <button data-gedit="${g.id}"><i class="fa-solid fa-pen"></i></button>
          <button data-gdel="${g.id}"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`,
    );
  });
  list.querySelectorAll("[data-gcur]").forEach(
    (b) =>
      (b.onclick = () => {
        const g = state.goals.find((x) => x.id === b.dataset.gcur);
        const v = prompt(
          `Add progress for "${g.title}" (current: ${g.current}):`,
          1,
        );
        if (v === null) return;
        const increment = Number.parseInt(v, 10);
        if (!Number.isFinite(increment) || increment <= 0) return toast("Enter a positive amount", "error");
        g.current = Math.min(g.target, g.current + increment);
        if (g.current >= g.target) {
          g.completed = true;
          pushNotif(`🏆 Goal completed: ${g.title}`);
        }
        save();
        renderGoals();
      }),
  );
  list.querySelectorAll("[data-gdone]").forEach(
    (b) =>
      (b.onclick = () => {
        const g = state.goals.find((x) => x.id === b.dataset.gdone);
        g.completed = !g.completed;
        save();
        renderGoals();
        if (g.completed) pushNotif(`🏆 Goal completed: ${g.title}`);
      }),
  );
  list.querySelectorAll("[data-gedit]").forEach(
    (b) =>
      (b.onclick = () => {
        const g = state.goals.find((x) => x.id === b.dataset.gedit);
        $("#goalId").value = g.id;
        $("#gTitle").value = g.title;
        $("#gTarget").value = g.target;
        $("#gCurrent").value = g.current;
        $("#gUnit").value = g.unit;
        $("#gDeadline").value = g.deadline;
        $("#goalModalTitle").textContent = "Edit Goal";
        $("#modalOverlay").classList.remove("hidden");
        $$("#modalOverlay .modal").forEach((m) => m.classList.add("hidden"));
        $("#goalModal").classList.remove("hidden");
      }),
  );
  list.querySelectorAll("[data-gdel]").forEach(
    (b) =>
      (b.onclick = () => {
        if (!confirm("Delete goal?")) return;
        state.goals = state.goals.filter((g) => g.id !== b.dataset.gdel);
        save();
        renderGoals();
        toast("Goal deleted", "info");
      }),
  );
}

/* =========================================================
   FAVORITES
   ========================================================= */
function toggleFav(id) {
  const i = state.favorites.indexOf(id);
  if (i >= 0) {
    state.favorites.splice(i, 1);
    toast("Removed from favorites", "info");
  } else {
    state.favorites.push(id);
    toast("Added to favorites", "success");
  }
  save();
  renderWorkouts();
  renderFavorites();
}
function renderFavorites() {
  const list = $("#favoriteList");
  list.innerHTML = "";
  const favs = state.workouts.filter((w) => state.favorites.includes(w.id));
  if (!favs.length) {
    list.innerHTML =
      '<p class="muted">No favorites yet. Click the ❤️ on workouts to save them.</p>';
    return;
  }
  favs.forEach((w) => {
    list.insertAdjacentHTML(
      "beforeend",
      `
      <div class="card glass list-item">
        <button class="fav-btn active" data-fav="${w.id}"><i class="fa-solid fa-heart"></i></button>
        <h4>${escapeHTML(w.name)}<span class="tag">${escapeHTML(w.category)}</span></h4>
        <div class="meta">
          <span><i class="fa-solid fa-clock"></i>${w.duration} min</span>
          <span><i class="fa-solid fa-fire"></i>${w.calories} kcal</span>
          <span><i class="fa-solid fa-calendar"></i>${fmtDate(w.date)}</span>
        </div>
      </div>`,
    );
  });
  list
    .querySelectorAll("[data-fav]")
    .forEach((b) => (b.onclick = () => toggleFav(b.dataset.fav)));
}

/* =========================================================
   DASHBOARD
   ========================================================= */
function renderDashboard() {
  const t = today();
  const meals = state.meals.filter((m) => m.date === t);
  const workouts = state.workouts.filter((w) => w.date === t);
  const calIn = meals.reduce((s, m) => s + m.calories, 0);
  const calOut = workouts.reduce((s, w) => s + w.calories, 0);
  const dur = workouts.reduce((s, w) => s + w.duration, 0);
  const w = todayWater();
  const a = todayActivity();
  $("#sumCalIn").textContent = calIn;
  $("#sumCalOut").textContent = calOut;
  $("#sumWater").textContent = w.amount;
  $("#sumSteps").textContent = a.steps;
  $("#sumDuration").textContent = dur;
  $("#goalCal").textContent = calorieGoal();
  setCircle("circCal", Math.min(100, (calIn / calorieGoal()) * 100));
  setCircle("circWater", Math.min(100, (w.amount / w.goal) * 100));
  setCircle("circSteps", Math.min(100, (a.steps / 10000) * 100));
  setCircle("circDuration", Math.min(100, (dur / 60) * 100));
}
function setCircle(id, pct) {
  const el = $("#" + id);
  el.style.setProperty("--p", pct);
  el.querySelector("span").textContent = Math.round(pct) + "%";
}

/* =========================================================
   CLOCK & QUOTES
   ========================================================= */
const quotes = [
  "The only bad workout is the one that didn't happen.",
  "Your body can stand almost anything. It's your mind you have to convince.",
  "Success isn't always about greatness. It's about consistency.",
  "Don't limit your challenges, challenge your limits.",
  "Fitness is not about being better than someone else. It's about being better than you used to be.",
  "The pain you feel today will be the strength you feel tomorrow.",
  "Push yourself, because no one else is going to do it for you.",
];
function startClock() {
  const tick = () => {
    const d = new Date();
    $("#currentDateTime").textContent = d.toLocaleString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  tick();
  if (window.fitPulseClock) clearInterval(window.fitPulseClock);
  window.fitPulseClock = setInterval(tick, 30000);
  $("#quoteText").textContent =
    quotes[Math.floor(Math.random() * quotes.length)];
}

/* =========================================================
   ANALYTICS (Chart.js)
   ========================================================= */
let charts = {};
function renderCharts() {
  if (typeof Chart === "undefined") {
    document.querySelectorAll(".chart-card").forEach((card) => {
      const canvas = card.querySelector("canvas");
      if (canvas) canvas.replaceWith(Object.assign(document.createElement("p"), { className: "muted chart-fallback", textContent: "Charts need an internet connection to load." }));
    });
    return;
  }
  const range = $("#analyticsRange").value;
  const days = range === "week" ? 7 : 30;
  const labels = [],
    calIn = [],
    calOut = [],
    workouts = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    labels.push(
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    );
    calIn.push(
      state.meals
        .filter((m) => m.date === ds)
        .reduce((s, m) => s + m.calories, 0),
    );
    calOut.push(
      state.workouts
        .filter((w) => w.date === ds)
        .reduce((s, w) => s + w.calories, 0),
    );
    workouts.push(state.workouts.filter((w) => w.date === ds).length);
  }
  const common = {
    animation: document.documentElement.dataset.motion === "off" || matchMedia("(prefers-reduced-motion: reduce)").matches ? false : { duration:600 },
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: getComputedStyle(document.body).getPropertyValue("--text"),
        },
      },
    },
    scales: {
      x: { ticks: { color: "#9aa3b2" } },
      y: {
        ticks: { color: "#9aa3b2" },
        grid: { color: "rgba(255,255,255,.08)" },
      },
    },
  };
  Object.values(charts).forEach((c) => c.destroy());
  charts = {};
  charts.cal = new Chart($("#chartCalories"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Calories In",
          data: calIn,
          borderColor: "#f97316",
          backgroundColor: "rgba(249,115,22,.2)",
          tension: 0.4,
          fill: true,
        },
        {
          label: "Calories Out",
          data: calOut,
          borderColor: "#ef4444",
          backgroundColor: "rgba(239,68,68,.2)",
          tension: 0.4,
          fill: true,
        },
      ],
    },
    options: common,
  });
  charts.wk = new Chart($("#chartWorkouts"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Workouts",
          data: workouts,
          backgroundColor: "rgba(99,102,241,.7)",
          borderRadius: 6,
        },
      ],
    },
    options: common,
  });
  const rangeStart = new Date();
  rangeStart.setDate(rangeStart.getDate() - days + 1);
  const rangeStartDate = `${rangeStart.getFullYear()}-${String(rangeStart.getMonth()+1).padStart(2,"0")}-${String(rangeStart.getDate()).padStart(2,"0")}`;
  const m = state.meals.filter(meal => meal.date >= rangeStartDate && meal.date <= today());
  const macros = [
    m.reduce((s, x) => s + x.protein, 0),
    m.reduce((s, x) => s + x.carbs, 0),
    m.reduce((s, x) => s + x.fat, 0),
  ];
  charts.mac = new Chart($("#chartMacros"), {
    type: "doughnut",
    data: {
      labels: ["Protein", "Carbs", "Fat"],
      datasets: [
        { data: macros, backgroundColor: ["#ef4444", "#f59e0b", "#ec4899"] },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: getComputedStyle(document.body).getPropertyValue("--text"),
          },
        },
      },
    },
  });
  const bmiHist = state.analytics.bmi.filter(entry => entry.date >= rangeStartDate && entry.date <= today()).sort((a,b) => a.date.localeCompare(b.date));
  charts.bmi = new Chart($("#chartBMI"), {
    type: "line",
    data: {
      labels: bmiHist.map((x) => fmtDate(x.date)),
      datasets: [
        {
          label: "BMI",
          data: bmiHist.map((x) => x.bmi),
          borderColor: "#8b5cf6",
          backgroundColor: "rgba(139,92,246,.2)",
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: common,
  });
}
$("#analyticsRange").onchange = renderCharts;

/* =========================================================
   CALENDAR
   ========================================================= */
function renderCalendar() {
  const d = state.calDate;
  const y = d.getFullYear(),
    m = d.getMonth();
  $("#calTitle").textContent = d.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const grid = $("#calendarGrid");
  grid.innerHTML = "";
  ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((n) => {
    grid.insertAdjacentHTML(
      "beforeend",
      `<div class="cal-day-name">${n}</div>`,
    );
  });
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();
  const todayStr = today();
  const workoutDates = new Set(state.workouts.map((w) => w.date));
  for (let i = first - 1; i >= 0; i--) {
    grid.insertAdjacentHTML(
      "beforeend",
      `<div class="cal-day other">${prevDays - i}</div>`,
    );
  }
  for (let i = 1; i <= days; i++) {
    const ds = `${y}-${String(m + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
    const isToday = ds === todayStr;
    const hasW = workoutDates.has(ds);
    grid.insertAdjacentHTML(
      "beforeend",
      `<div class="cal-day ${isToday ? "today" : ""} ${hasW ? "has-workout" : ""}" data-date="${ds}">${i}</div>`,
    );
  }
  const total = first + days;
  const rem = (7 - (total % 7)) % 7;
  for (let i = 1; i <= rem; i++) {
    grid.insertAdjacentHTML(
      "beforeend",
      `<div class="cal-day other">${i}</div>`,
    );
  }
  grid.querySelectorAll(".cal-day[data-date]").forEach((el) => {
    el.onclick = () => {
      const ds = el.dataset.date;
      const ws = state.workouts.filter((w) => w.date === ds);
      alert(
        `Workouts on ${fmtDate(ds)}:\n\n` +
            (ws.length
            ? ws
                .map((w) => `• ${w.name} (${w.category}) - ${w.duration}min`)
                .join("\n")
            : "No workouts scheduled"),
      );
    };
  });
  // Upcoming
  const up = state.workouts
    .filter((w) => new Date(w.date) >= new Date(todayStr))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);
  $("#upcomingList").innerHTML = up.length
    ? up
        .map(
          (w) =>
            `<li><span><i class="fa-solid fa-dumbbell"></i> ${escapeHTML(w.name)}</span><span class="muted">${fmtDate(w.date)}</span></li>`,
        )
        .join("")
    : '<li class="muted">No upcoming workouts</li>';
}
$("#calPrev").onclick = () => {
  state.calDate.setDate(1);
  state.calDate.setMonth(state.calDate.getMonth() - 1);
  renderCalendar();
};
$("#calNext").onclick = () => {
  state.calDate.setDate(1);
  state.calDate.setMonth(state.calDate.getMonth() + 1);
  renderCalendar();
};

/* =========================================================
   SETTINGS
   ========================================================= */
function applyTheme() {
  document.body.classList.toggle("dark", state.settings.dark);
}
$("#darkToggle").onchange = (e) => {
  state.settings.dark = e.target.checked;
  save();
  applyTheme();
  if (charts.cal) renderCharts();
};
$("#notifToggle").onchange = (e) => {
  state.settings.notif = e.target.checked;
  save();
};
$("#waterReminder").onchange = (e) => {
  state.settings.waterRem = e.target.checked;
  save();
};
$("#workoutReminder").onchange = (e) => {
  state.settings.workoutRem = e.target.checked;
  save();
};

function loadSettings() {
  $("#darkToggle").checked = state.settings.dark;
  $("#notifToggle").checked = state.settings.notif;
  $("#waterReminder").checked = state.settings.waterRem;
  $("#workoutReminder").checked = state.settings.workoutRem;
}

$("#changePwdBtn").onclick = () => {
  $("#modalOverlay").classList.remove("hidden");
  $$("#modalOverlay .modal").forEach((m) => m.classList.add("hidden"));
  $("#pwdModal").classList.remove("hidden");
};
$("#pwdForm").onsubmit = async (e) => {
  e.preventDefault();
  const u = state.users.find((x) => x.id === state.current);
  if (!(await verifyPassword($("#cpOld").value, u.password))) {
    toast("Current password incorrect", "error");
    return;
  }
  if ($("#cpNew").value !== $("#cpConf").value) {
    toast("Passwords do not match", "error");
    return;
  }
  u.password = await hashPassword($("#cpNew").value);
  save();
  $("#modalOverlay").classList.add("hidden");
  $("#pwdForm").reset();
  toast("Password updated", "success");
};

$("#resetDataBtn").onclick = () => {
  if (!confirm("This will erase ALL your data. Continue?")) return;
  [
    "fp_workouts",
    "fp_meals",
    "fp_water",
    "fp_activity",
    "fp_goals",
    "fp_favorites",
    "fp_profile",
    "fp_analytics",
    "fp_notifs",
  ].forEach((k) => localStorage.removeItem(k));
  state.workouts = [];
  state.meals = [];
  state.water = {};
  state.activity = {};
  state.goals = [];
  state.favorites = [];
  const account = state.users.find(user => user.id === state.current);
  state.profile = {name:account?.name || "",email:account?.email || ""};
  state.analytics = { bmi: [] };
  state.notifications = [];
  LS.del(`fp_recipe_saves_${state.current}`);
  LS.del(`fp_recipe_plans_${state.current}`);
  save();
  renderAll();
  loadProfile();
  window.dispatchEvent(new CustomEvent("fitpulse:account", {detail:{id:state.current}}));
  routeTrackerFromHash();
  toast("All data reset", "info");
};

/* =========================================================
   NOTIFICATIONS
   ========================================================= */
$("#notifBtn").onclick = () => $("#notifPanel").classList.toggle("hidden");
$("#clearNotif").onclick = () => {
  state.notifications = [];
  save();
  renderNotifs();
};
function renderNotifs() {
  const list = $("#notifList");
  if (!state.notifications.length) {
    list.innerHTML = '<li class="muted">No notifications</li>';
  } else
    list.innerHTML = state.notifications
      .map(
        (n) =>
          `<li><i class="fa-solid fa-bell"></i> ${escapeHTML(n.msg)}<br><small class="muted">${new Date(n.time).toLocaleString()}</small></li>`,
      )
      .join("");
  const badge = $("#notifBadge");
  if (state.notifications.length) {
    badge.classList.remove("hidden");
    badge.textContent = state.notifications.length;
  } else badge.classList.add("hidden");
}

/* =========================================================
   GLOBAL SEARCH
   ========================================================= */
$("#globalSearch").oninput = (e) => {
  const q = e.target.value.toLowerCase();
  if (!q) {
    $("#workoutSearch").value = "";
    $("#mealSearch").value = "";
    renderWorkouts();
    renderMeals();
    return;
  }
  const workoutMatch = state.workouts.some((w) => w.name.toLowerCase().includes(q) || (w.notes || "").toLowerCase().includes(q));
  const mealMatch = state.meals.some((m) => m.name.toLowerCase().includes(q));
  const section = mealMatch && !workoutMatch ? "nutrition" : "workouts";
  navigateTracker(section);
  if (section === "nutrition") {
    $("#mealDateScope").value = "all";
    $("#mealSearch").value = q;
    renderMeals();
  } else {
    $("#workoutSearch").value = q;
    renderWorkouts();
  }
};

/* =========================================================
   REMINDERS
   ========================================================= */
function scheduleReminders() {
  if (window.fitPulseReminders) clearInterval(window.fitPulseReminders);
  window.fitPulseReminders = setInterval(
    () => {
      const h = new Date().getHours();
      if (h === 10 && state.settings.workoutRem) {
        if (!state.workouts.some((w) => w.date === today()))
          pushNotif("💪 Time for your daily workout!");
      }
      if (h % 2 === 0 && state.settings.waterRem) {
        const w = todayWater();
        if (w.amount < w.goal * 0.5) pushNotif("💧 Drink more water!");
      }
    },
    60 * 60 * 1000,
  );
}

/* ---------- Portable user backup ---------- */
$("#exportDataBtn").onclick = () => {
  const recipeData = {saved:LS.get(`fp_recipe_saves_${state.current}`,[]),plans:LS.get(`fp_recipe_plans_${state.current}`,{})};
  const payload = { app: "FitPulse", schemaVersion: 1, exportedAt: new Date().toISOString(), data: userData(), recipeData };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `fitpulse-backup-${today()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  toast("Backup downloaded", "success");
};
$("#importDataBtn").onclick = () => $("#importDataInput").click();
$("#importDataInput").onchange = async (event) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error("Choose a FitPulse backup smaller than 5 MB.");
    const parsed = JSON.parse(await file.text());
    const data = window.validateFitPulseBackup(parsed);
    const recipeData = window.validateFitPulseRecipeBackup(parsed.recipeData);
    if (!confirm("Importing this backup will replace the data for this account. Continue?")) return;
    Object.assign(state, { ...emptyUserData(), ...data });
    if (recipeData) { LS.set(`fp_recipe_saves_${state.current}`,recipeData.saved); LS.set(`fp_recipe_plans_${state.current}`,recipeData.plans); }
    save();
    applyTheme();
    loadProfile();
    renderAll();
    window.dispatchEvent(new CustomEvent("fitpulse:account", {detail:{id:state.current}}));
    routeTrackerFromHash();
    toast("Backup imported", "success");
  } catch (error) {
    toast(error.message || "Could not read this backup file", "error");
  }
};

/* =========================================================
   RENDER ALL
   ========================================================= */
function renderAll() {
  renderDashboard();
  renderWorkouts();
  renderMeals();
  renderWater();
  renderActivity();
  renderGoals();
  renderFavorites();
  renderCalendar();
  renderNotifs();
  loadSettings();
}
