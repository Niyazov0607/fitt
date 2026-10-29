/* In-app nutrition discovery, recipe pages, meal planning and tracker form integration. */
(() => {
  "use strict";
  const hub = document.querySelector("#trackerFoodHub");
  if (!hub || !Array.isArray(window.FitPulseRecipes)) return;
  const recipes = window.FitPulseRecipes;
  const slots = ["Breakfast", "Lunch", "Dinner", "Snacks"];
  const categories = ["All foods", "Breakfast", "Lunch", "Dinner", "Plant-based", "High protein", "Saved"];
  const $ = (selector) => hub.querySelector(selector);
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { announce("Your browser could not save this change. Check available storage."); return false; }
  };
  const escape = (value) => String(value).replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
  const localDate = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  };
  const find = id => recipes.find(recipe => recipe.id === id);
  const view = {
    scope: null, saved: new Set(), plans: {}, filter: "All foods", query: "",
    date: localDate(), recipeId: null, servings: 1, meal: "Lunch", section: "nutrition"
  };
  let toastTimer;
  let previousVisible = false;
  function syncAccount() {
    const current = read("fp_current", null);
    const users = read("fp_users", []);
    const scope = current && Array.isArray(users) && users.some(user => user.id === current) ? current : "guest";
    const changed = view.scope !== scope;
    view.scope = scope;
    const storedSaved = read(`fp_recipe_saves_${scope}`, []);
    view.saved = new Set(Array.isArray(storedSaved) ? storedSaved.filter(id => find(id)) : []);
    const storedPlans = read(`fp_recipe_plans_${scope}`, {});
    view.plans = storedPlans && typeof storedPlans === "object" && !Array.isArray(storedPlans) ? storedPlans : {};
    if (changed) { view.filter = "All foods"; view.query = ""; view.date = localDate(); }
  }
  function announce(message) {
    let status = $(".tn-status");
    if (!status) {
      status = document.createElement("p"); status.className = "tn-status";
      status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
      hub.append(status);
    }
    status.textContent = message;
    status.classList.add("tn-status-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => status.classList.remove("tn-status-visible"), 4500);
  }
  function imageFallbacks() {
    hub.querySelectorAll("img").forEach(img => img.addEventListener("error", () => {
      img.style.visibility = "hidden";
      img.parentElement.classList.add("tn-photo-fallback");
    }, { once:true }));
  }
  function focusHeading() {
    if (document.querySelector("#app")?.classList.contains("hidden")) return;
    requestAnimationFrame(() => {
      const heading = $("[data-tn-heading]");
      heading?.focus({ preventScroll:true });
      document.querySelector("#sec-nutrition").scrollIntoView({ behavior:"auto", block:"start" });
    });
  }
  function saveButton(recipe, className="tn-save") {
    const selected = view.saved.has(recipe.id);
    return `<button class="${className}" type="button" data-tn-save="${recipe.id}" aria-label="${selected ? "Unsave" : "Save"} ${escape(recipe.name)}" aria-pressed="${selected}">${selected ? "♥" : "♡"}<span>${selected ? "Saved" : "Save recipe"}</span></button>`;
  }
  function card(recipe, index) {
    return `<article class="tn-food-card" style="--tn-order:${index}">
      <div class="tn-card-photo"><a href="#nutrition/recipe/${recipe.id}" aria-label="View details for ${escape(recipe.name)}"><img src="${recipe.image}" alt="${escape(recipe.name)}" loading="lazy" width="480" height="360" /></a>${saveButton(recipe)}<span class="tn-badge">${recipe.tags[0] || "Everyday favorite"}</span></div>
      <div class="tn-card-copy"><p class="tn-card-meta"><span>${recipe.type}</span><span>◷ ${recipe.minutes} min${recipe.rest ? " + chill" : ""}</span></p><h3><a href="#nutrition/recipe/${recipe.id}">${escape(recipe.name)}</a></h3><p>${escape(recipe.description)}</p>
        <div class="tn-card-macros"><span><b>${recipe.calories}</b> kcal</span><span><b>${recipe.protein}g</b> protein</span><span><b>${recipe.carbs}g</b> carbs</span></div>
        <div class="tn-card-actions"><a class="tn-details" href="#nutrition/recipe/${recipe.id}">View details <span aria-hidden="true">↗</span></a><button type="button" class="tn-quick-plan" data-tn-plan="${recipe.id}" aria-label="Add ${escape(recipe.name)} to ${recipe.type.toLowerCase()} plan">+ Plan meal</button></div>
      </div></article>`;
  }
  function filteredRecipes() {
    const query = view.query.trim().toLowerCase();
    return recipes.filter(recipe => {
      const category = view.filter === "All foods" || view.filter === "Saved" && view.saved.has(recipe.id) || recipe.type === view.filter || recipe.tags.includes(view.filter);
      return category && `${recipe.name} ${recipe.description} ${recipe.ingredients.join(" ")}`.toLowerCase().includes(query);
    });
  }
  function renderCards() {
    const filtered = filteredRecipes();
    $(".tn-card-grid").innerHTML = filtered.length ? filtered.map(card).join("") : `<div class="tn-empty"><span aria-hidden="true">⌕</span><h3>${view.filter === "Saved" ? "Your favorites start here." : "No recipes found."}</h3><p>${view.filter === "Saved" ? "Save a recipe with the heart button to keep it here." : "Try another ingredient or clear the filters."}</p><button class="tn-button tn-button-dark" type="button" data-tn-clear>Explore all foods</button></div>`;
    $(".tn-results").textContent = `${filtered.length} ${filtered.length === 1 ? "recipe" : "recipes"} ${view.filter === "Saved" ? "saved" : "to explore"}`;
    const savedCount = $("[data-tn-saved-count]");
    if (savedCount) savedCount.textContent = view.saved.size;
    imageFallbacks();
  }
  function planItems() {
    const items = view.plans[view.date];
    return Array.isArray(items) ? items.filter(item => find(item.recipe) && slots.includes(item.type)) : [];
  }
  function portion(item) { const servings = Number(item.servings); return servings > 0 && servings <= 4 ? servings : 1; }
  function macro(recipe, key, servings=1) { return Math.round(recipe[key] * servings); }
  function displayDate(value) { return new Date(value + "T12:00:00").toLocaleDateString(undefined, { month:"short", day:"numeric" }); }
  function renderPlanner() {
    const planner = $(".tn-planner");
    if (!planner) return;
    const items = planItems();
    const calories = items.reduce((sum,item) => sum + macro(find(item.recipe),"calories",portion(item)),0);
    const protein = items.reduce((sum,item) => sum + macro(find(item.recipe),"protein",portion(item)),0);
    planner.innerHTML = `<div class="tn-planner-heading"><div><p class="tn-eyebrow">Make room for good food</p><h3>Your meal plan<span>.</span></h3></div><label>Date<input class="tn-date" data-tn-plan-date type="date" value="${view.date}" required /></label></div>
      <div class="tn-plan-totals"><span><b>${calories.toLocaleString()}</b> estimated kcal</span><span><b>${protein}g</b> protein</span><span><b>${items.length}</b> planned meals</span></div>
      <div class="tn-plan-slots">${slots.map(type => {
        const selected = items.filter(item => item.type === type);
        return `<section class="tn-plan-slot"><h4>${type}</h4>${selected.length ? selected.map(item => {
          const recipe = find(item.recipe); const servings = portion(item);
          return `<div class="tn-plan-item"><a class="tn-plan-thumb" href="#nutrition/recipe/${recipe.id}" tabindex="-1" aria-hidden="true"><img src="${recipe.image}" alt="" width="48" height="48" loading="lazy" /></a><div><a href="#nutrition/recipe/${recipe.id}">${escape(recipe.name)}</a><small>${servings} ${servings === 1 ? "serving" : "servings"} · ${macro(recipe,"calories",servings)} kcal</small></div><button class="tn-plan-log" type="button" data-tn-log-plan="${escape(item.uid)}" aria-label="Log ${escape(recipe.name)}">Log</button><button class="tn-remove" type="button" data-tn-remove="${escape(item.uid)}" aria-label="Remove ${escape(recipe.name)} from ${type.toLowerCase()} plan">×</button></div>`;
        }).join("") : `<button class="tn-slot-add" data-tn-slot="${type}" type="button">+ Find a recipe for ${type.toLowerCase()}</button>`}</section>`;
      }).join("")}</div><p class="tn-plan-note">Your selected meals, not an intake target. Plans are saved in this browser. Use Log to review and save a meal in your tracker.</p>`;
    imageFallbacks();
  }
  function renderBrowse(focus=false) {
    hub.innerHTML = `<div class="tn-hub">
      <div class="tn-intro"><div><p class="tn-eyebrow"><span aria-hidden="true">✳</span> Healthy food, everyday</p><h2 tabindex="-1" data-tn-heading>Find your kind of fuel<span>.</span></h2><p>Fresh ideas for your plate. Pick a recipe, make a plan, and track what you eat.</p></div><div class="tn-intro-note"><span aria-hidden="true">↗</span><b>Good food.<br />Great energy.</b></div></div>
      <div class="tn-toolbar"><div class="tn-filters" role="group" aria-label="Food categories">${categories.map(category => `<button class="tn-filter${view.filter === category ? " tn-active" : ""}" type="button" data-tn-filter="${category}" aria-pressed="${view.filter === category}">${category}${category === "Saved" ? ` <span data-tn-saved-count>${view.saved.size}</span>` : ""}</button>`).join("")}</div><label class="tn-search"><span aria-hidden="true">⌕</span><span class="tn-sr-only">Search foods or ingredients</span><input data-tn-search type="search" value="${escape(view.query)}" placeholder="Search foods or ingredients" /></label></div>
      <div class="tn-results-line"><p class="tn-results" role="status"></p><p>Estimated nutrition per serving · Photos are illustrative</p></div><div class="tn-card-grid"></div><div class="tn-planner"></div><p class="tn-hub-footnote">Keep it varied with vegetables, fruits, whole grains and different protein sources. <a href="https://www.who.int/news-room/fact-sheets/detail/healthy-diet" target="_blank" rel="noopener noreferrer">Explore WHO food guidance ↗</a></p>
      </div><p class="tn-status" role="status" aria-live="polite"></p>`;
    renderCards(); renderPlanner();
    if (focus) focusHeading();
  }
  function scaleIngredient(text, servings) {
    if (servings === 1) return text;
    const format = number => String(Math.round(number * servings * 100) / 100);
    return text.replace(/^(\d+(?:\.\d+)?|½)/, amount => format(amount === "½" ? .5 : Number(amount))).replace(/\((\d+(?:\.\d+)?) g\)/, (_,number) => `(${format(Number(number))} g)`);
  }
  function renderRecipe(focus=false) {
    const recipe = find(view.recipeId);
    if (!recipe) {
      hub.innerHTML = `<div class="tn-detail tn-not-found"><a class="tn-back" href="#nutrition">← Back to healthy foods</a><h2 data-tn-heading tabindex="-1">This recipe is not on the menu.</h2><p>Explore the food library to find your next meal.</p></div><p class="tn-status" role="status" aria-live="polite"></p>`;
      if (focus) focusHeading();
      return;
    }
    hub.innerHTML = `<article class="tn-detail"><a class="tn-back" href="#nutrition">← Back to healthy foods</a>
      <div class="tn-detail-hero"><div class="tn-detail-photo"><img src="${recipe.image}" alt="${escape(recipe.name)}" width="900" height="700" /></div><div class="tn-detail-copy"><p class="tn-eyebrow">${recipe.type} <span aria-hidden="true">/</span> ${recipe.tags.join(" · ") || "Everyday favorite"}</p><h2 data-tn-heading tabindex="-1">${escape(recipe.name)}<span>.</span></h2><p>${escape(recipe.description)}</p><div class="tn-detail-meta"><span>◷ ${recipe.minutes} minutes${recipe.rest ? " + " + recipe.rest.toLowerCase() : ""}</span><span>Easy everyday cooking</span></div>
        <div class="tn-detail-macros">${[ ["calories","kcal"],["protein","protein"],["carbs","carbs"],["fat","fat"] ].map(([key,label]) => `<div><strong data-tn-macro="${key}">${macro(recipe,key,view.servings)}${key === "calories" ? "" : "g"}</strong><span>${label}</span></div>`).join("")}</div><p class="tn-estimate">Estimated nutrition for <span data-tn-serving-copy>${view.servings} ${view.servings === 1 ? "serving" : "servings"}</span>. Ingredients and brands change the totals.</p>
        <div class="tn-detail-options"><label>Servings<select data-tn-servings>${[.5,1,1.5,2,3,4].map(value => `<option value="${value}"${view.servings === value ? " selected" : ""}>${value}</option>`).join("")}</select></label><label>Meal<select data-tn-meal>${slots.map(type => `<option${view.meal === type ? " selected" : ""}>${type}</option>`).join("")}</select></label><label>Date<input data-tn-detail-date type="date" value="${view.date}" required /></label></div>
        <div class="tn-detail-actions"><button class="tn-button tn-button-lime" type="button" data-tn-log="${recipe.id}">Log meal <span aria-hidden="true">↗</span></button><button class="tn-button tn-button-soft" type="button" data-tn-plan-detail="${recipe.id}">+ Add to plan</button>${saveButton(recipe,"tn-detail-save")}</div><p class="tn-detail-helper">Log meal opens an editable meal form. Save it to add the meal to your daily totals.</p>
      </div></div><div class="tn-recipe-method"><section><p class="tn-eyebrow">The good stuff</p><h3>What you'll need</h3><p class="tn-method-portions" data-tn-ingredient-count>For ${view.servings} ${view.servings === 1 ? "serving" : "servings"}</p><ul class="tn-ingredients">${recipe.ingredients.map(ingredient => `<li>${escape(scaleIngredient(ingredient,view.servings))}</li>`).join("")}</ul></section><section><p class="tn-eyebrow">Let's make it</p><h3>A little prep. A lot of flavor.</h3><ol class="tn-method">${recipe.steps.map(step => `<li>${escape(step)}</li>`).join("")}</ol></section></div><div class="tn-allergens"><strong>Ingredient & allergen notes</strong><p>${escape(recipe.allergens)}</p><span>Check product labels and choose ingredients that suit your needs.</span></div><div class="tn-detail-next"><div><p class="tn-eyebrow">Keep it fresh</p><h3>A little more variety.</h3></div><a class="tn-button tn-button-dark" href="#nutrition">Explore more foods <span aria-hidden="true">→</span></a></div></article><p class="tn-status" role="status" aria-live="polite"></p>`;
    imageFallbacks();
    if (focus) focusHeading();
  }
  function updatePortions() {
    const recipe = find(view.recipeId);
    if (!recipe) return;
    hub.querySelectorAll("[data-tn-macro]").forEach(el => {
      const key = el.dataset.tnMacro;
      el.textContent = macro(recipe,key,view.servings) + (key === "calories" ? "" : "g");
    });
    const copy = `${view.servings} ${view.servings === 1 ? "serving" : "servings"}`;
    $("[data-tn-serving-copy]").textContent = copy;
    $("[data-tn-ingredient-count]").textContent = `For ${copy}`;
    $(".tn-ingredients").innerHTML = recipe.ingredients.map(ingredient => `<li>${escape(scaleIngredient(ingredient,view.servings))}</li>`).join("");
  }
  function render(focus=false) { if (view.recipeId) renderRecipe(focus); else renderBrowse(focus); }
  function toggleSave(id) {
    const next = new Set(view.saved);
    if (next.has(id)) next.delete(id); else next.add(id);
    if (!write(`fp_recipe_saves_${view.scope}`,[...next])) return;
    view.saved = next;
    if (view.recipeId) {
      const button = $("[data-tn-save]");
      button.setAttribute("aria-pressed",String(next.has(id)));
      button.setAttribute("aria-label",`${next.has(id) ? "Unsave" : "Save"} ${find(id).name}`);
      button.innerHTML = `${next.has(id) ? "♥" : "♡"}<span>${next.has(id) ? "Saved" : "Save recipe"}</span>`;
    } else {
      renderCards();
      ($(`[data-tn-save="${id}"]`) || $(".tn-filter.tn-active"))?.focus({ preventScroll:true });
    }
    announce(next.has(id) ? "Recipe saved to your favorites." : "Recipe removed from saved favorites.");
  }
  function addPlan(id, type, servings=1) {
    if (!find(id) || !slots.includes(type)) return;
    const item = { uid: `${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`, recipe:id, type, servings };
    const next = { ...view.plans, [view.date]: [...planItems(),item] };
    if (!write(`fp_recipe_plans_${view.scope}`,next)) return;
    view.plans = next; renderPlanner();
    announce(`Added ${servings} ${servings === 1 ? "serving" : "servings"} to ${type.toLowerCase()} on ${displayDate(view.date)}.`);
  }
  function openMealForm(id, servings, type, date) {
    const recipe = find(id);
    const trigger = document.querySelector('#sec-nutrition .section-head [data-modal="mealModal"]') || document.querySelector('#sec-nutrition [data-modal="mealModal"]');
    if (!recipe || !trigger) { announce("The meal form is unavailable. Refresh FitPulse and try again."); return; }
    const form = document.querySelector("#mealForm");
    form.reset();
    document.querySelector("#mealId").value = "";
    trigger.click();
    const fields = { mName: `${recipe.name}${servings === 1 ? "" : ` (${servings} servings)`}`, mType:type, mCal:macro(recipe,"calories",servings), mPro:macro(recipe,"protein",servings), mCarb:macro(recipe,"carbs",servings), mFat:macro(recipe,"fat",servings), mDate:date };
    Object.entries(fields).forEach(([field,value]) => { document.querySelector(`#${field}`).value = value; });
    document.querySelector("#mealModalTitle").textContent = "Log recipe meal";
    requestAnimationFrame(() => document.querySelector("#mName").focus());
  }
  hub.addEventListener("input", event => {
    if (event.target.matches("[data-tn-search]")) { view.query = event.target.value; renderCards(); }
  });
  hub.addEventListener("change", event => {
    const target = event.target;
    if (target.matches("[data-tn-servings]")) { view.servings = Number(target.value); updatePortions(); }
    if (target.matches("[data-tn-meal]")) view.meal = target.value;
    if (target.matches("[data-tn-plan-date],[data-tn-detail-date]")) {
      if (!target.value) { target.value = view.date; return; }
      const keepFocus = target.matches("[data-tn-plan-date]") && document.activeElement === target;
      view.date = target.value; renderPlanner();
      if (keepFocus) $("[data-tn-plan-date]")?.focus({ preventScroll:true });
    }
  });
  hub.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.hasAttribute("data-tn-save")) toggleSave(button.dataset.tnSave);
    else if (button.hasAttribute("data-tn-filter")) {
      view.filter = button.dataset.tnFilter;
      hub.querySelectorAll("[data-tn-filter]").forEach(item => { const active = item === button; item.classList.toggle("tn-active",active); item.setAttribute("aria-pressed",String(active)); });
      renderCards();
    } else if (button.hasAttribute("data-tn-clear")) {
      view.filter = "All foods"; view.query = ""; renderBrowse(); $("[data-tn-search]").focus();
    } else if (button.hasAttribute("data-tn-plan")) addPlan(button.dataset.tnPlan,find(button.dataset.tnPlan).type);
    else if (button.hasAttribute("data-tn-plan-detail")) addPlan(button.dataset.tnPlanDetail,view.meal,view.servings);
    else if (button.hasAttribute("data-tn-slot")) {
      view.filter = button.dataset.tnSlot; view.query = ""; renderBrowse();
      const filter = $(`[data-tn-filter="${view.filter}"]`); filter?.focus({preventScroll:true}); hub.scrollIntoView({behavior:"auto",block:"start"});
    } else if (button.hasAttribute("data-tn-remove")) {
      const next = { ...view.plans, [view.date]:planItems().filter(item => item.uid !== button.dataset.tnRemove) };
      if (write(`fp_recipe_plans_${view.scope}`,next)) { view.plans = next; renderPlanner(); $("[data-tn-plan-date]")?.focus({preventScroll:true}); announce("Meal removed from your plan. Logged meals stay in the tracker."); }
    } else if (button.hasAttribute("data-tn-log")) openMealForm(button.dataset.tnLog,view.servings,view.meal,view.date);
    else if (button.hasAttribute("data-tn-log-plan")) {
      const item = planItems().find(plan => plan.uid === button.dataset.tnLogPlan);
      if (item) openMealForm(item.recipe,portion(item),item.type,view.date);
    }
  });
  function navigate(detail, focus=true) {
    if (detail?.section !== "nutrition") { view.section = detail?.section || view.section; return; }
    syncAccount(); view.section = "nutrition";
    const id = detail.recipeId || null;
    if (id !== view.recipeId) { view.servings = 1; view.meal = find(id)?.type || "Lunch"; }
    view.recipeId = id;
    render(focus);
  }
  window.addEventListener("fitpulse:navigate", event => navigate(event.detail));
  window.addEventListener("fitpulse:refresh", () => { syncAccount(); render(); });
  window.addEventListener("storage", event => {
    if (event.key === "fp_current" || event.key === `fp_recipe_saves_${view.scope}` || event.key === `fp_recipe_plans_${view.scope}`) { syncAccount(); render(); }
  });
  const app = document.querySelector("#app");
  if (app) new MutationObserver(() => {
    const visible = !app.classList.contains("hidden");
    if (visible && !previousVisible) { syncAccount(); render(); }
    previousVisible = visible;
  }).observe(app,{attributes:true,attributeFilter:["class"]});
  syncAccount();
  const initial = location.hash.match(/^#nutrition\/recipe\/([^/?#]+)/);
  if (initial) {
    try { view.recipeId = decodeURIComponent(initial[1]); }
    catch { view.recipeId = initial[1]; }
    view.meal = find(view.recipeId)?.type || "Lunch";
  }
  render();
})();
