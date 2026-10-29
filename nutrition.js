/* FitPulse food inspiration. Static recipe estimates, browser-local saves and planner. */
(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const get = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const put = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { notify("Your browser could not save this change. Storage may be full."); return false; } };
  const account = get("fp_current", null);
  const validAccount = account && get("fp_users", []).some((user) => user.id === account);
  const scope = validAccount ? account : "guest";
  const savedKey = `fp_recipe_saves_${scope}`;
  const planKey = `fp_recipe_plans_${scope}`;
  const saved = new Set(get(savedKey, []));
  const plans = get(planKey, {});
  const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
  let selectedDate = localDate();
  let filter = "all";
  let query = "";
  let toastTimer;
  let lastDialogTrigger;
  const slots = ["Breakfast", "Lunch", "Dinner", "Snacks"];
  const recipes = window.FitPulseRecipes || [];
  const findRecipe = (id) => recipes.find((recipe) => recipe.id === id);
  const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  function notify(message) { const feedback=$("#dialogFeedback"); if(feedback)feedback.textContent=message; const el=$("#nutritionToast"); clearTimeout(toastTimer); el.textContent=message; el.classList.add("visible"); toastTimer=setTimeout(()=>el.classList.remove("visible"),3800); }
  function applyMotion() { let motion; try { motion=localStorage.getItem("fp_motion"); } catch {} const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches; const off=motion==="off"||reduced; document.documentElement.dataset.motion=off?"off":"on"; $("#motionToggle").setAttribute("aria-pressed",String(off)); $("#motionToggle .motion-label").textContent=off?"Motion off":"Motion on"; $("#motionToggle").title=off?"Enable decorative animations":"Pause decorative animations"; }
  $("#motionToggle").addEventListener("click",()=>{ try { localStorage.setItem("fp_motion",document.documentElement.dataset.motion==="off"?"on":"off"); } catch {} applyMotion(); if(matchMedia("(prefers-reduced-motion: reduce)").matches) notify("Your device's reduced-motion preference is active."); });
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change",applyMotion);
  applyMotion();
  function renderRecipes() {
    const filtered=recipes.filter((recipe)=>(filter==="all" || filter==="saved" && saved.has(recipe.id) || recipe.type===filter || recipe.tags.includes(filter)) && `${recipe.name} ${recipe.description} ${recipe.ingredients.join(" ")}`.toLowerCase().includes(query));
    $("#recipeGrid").innerHTML=filtered.map((recipe,index)=>`<article class="recipe-card" style="animation-delay:${Math.min(index*45,250)}ms"><div class="recipe-photo"><img src="${recipe.image}" alt="${recipe.name}" loading="lazy" width="400" height="300" /><span class="recipe-badge">${recipe.tags[0]||"Everyday favorite"}</span><button type="button" class="save-recipe" data-save="${recipe.id}" aria-label="${saved.has(recipe.id)?"Unsave":"Save"} ${recipe.name}" aria-pressed="${saved.has(recipe.id)}">${saved.has(recipe.id)?"♥":"♡"}</button></div><div class="recipe-body"><div class="recipe-meta"><span>${recipe.type}</span><span>◷ ${recipe.minutes} min${recipe.rest?" + chill":""}</span></div><button type="button" class="recipe-title" data-recipe="${recipe.id}">${recipe.name}</button><p class="recipe-description">${recipe.description}</p><div class="recipe-nutrients"><span><b>${recipe.calories}</b>kcal</span><span><b>${recipe.protein}g</b>protein</span><span><b>${recipe.carbs}g</b>carbs</span></div><div class="recipe-card-actions"><button type="button" class="view-recipe" data-recipe="${recipe.id}" aria-label="View ${recipe.name} recipe">View recipe ↗</button><button type="button" class="quick-add" data-add="${recipe.id}" aria-label="Add ${recipe.name} to ${recipe.type.toLowerCase()} plan">+ Plan meal</button></div></div></article>`).join("");
    $("#resultCount").textContent=`${filtered.length} ${filtered.length===1?"recipe":"recipes"} ${filter==="saved"?"saved":"to explore"}`;
    $("#savedCount").textContent=saved.size;
    $("#noResults").hidden=filtered.length>0;
    $("#recipeGrid").querySelectorAll("img").forEach(addPhotoFallback);
  }
  function addPhotoFallback(img) { img.addEventListener("error",()=>{ img.style.display="none"; img.parentElement.classList.add("photo-unavailable"); },{once:true}); }
  document.querySelectorAll("[data-filter]").forEach((button)=>button.addEventListener("click",()=>{filter=button.dataset.filter; document.querySelectorAll("[data-filter]").forEach((item)=>{const active=item===button;item.classList.toggle("active",active);item.setAttribute("aria-pressed",String(active));});renderRecipes();}));
  $("#recipeSearch").addEventListener("input",(event)=>{query=event.target.value.trim().toLowerCase();renderRecipes();});
  $("#clearFilters").addEventListener("click",()=>{query="";$("#recipeSearch").value="";document.querySelector('[data-filter="all"]').click();$("#recipeSearch").focus();});
  $("#recipeGrid").addEventListener("click",(event)=>{const save=event.target.closest("[data-save]");const open=event.target.closest("[data-recipe]");const add=event.target.closest("[data-add]");if(save){const id=save.dataset.save;if(saved.has(id))saved.delete(id);else saved.add(id);put(savedKey,[...saved]);renderRecipes();const next=document.querySelector(`[data-save="${id}"]`);if(next)next.focus();notify(saved.has(id)?"Recipe saved to your favorites.":"Recipe removed from saved favorites.");}else if(open)openRecipe(open.dataset.recipe,open);else if(add)addToPlan(add.dataset.add,findRecipe(add.dataset.add).type);});
  function currentPlan(){return Array.isArray(plans[selectedDate])?plans[selectedDate]:[];}
  function addToPlan(id,type){if(!findRecipe(id)||!slots.includes(type))return;const item={uid:`${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`,recipe:id,type};if(!Array.isArray(plans[selectedDate]))plans[selectedDate]=[];plans[selectedDate].push(item);put(planKey,plans);renderPlan();notify(`Added to ${type.toLowerCase()} on ${new Date(selectedDate+"T12:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric"})}.`);}
  function renderPlan(){
    const items=currentPlan().filter(item=>findRecipe(item.recipe));
    const portion=item=>Number(item.servings)>=.5&&Number(item.servings)<=4?Number(item.servings):1;
    const amount=(item,key)=>Math.round(findRecipe(item.recipe)[key]*portion(item));
    $("#planSlots").innerHTML=slots.map(type=>{const meals=items.filter(item=>item.type===type);return `<section class="plan-slot"><div class="slot-heading"><h4>${type}</h4><span>${meals.length?meals.reduce((total,item)=>total+amount(item,"calories"),0)+" kcal":"Make it yours"}</span></div>${meals.length?meals.map(item=>{const recipe=findRecipe(item.recipe);return `<div class="plan-item"><img src="${recipe.image}" alt="" width="40" height="40" loading="lazy" /><div><strong>${recipe.name}</strong><small>${portion(item)} ${portion(item)===1?"serving":"servings"} · ${amount(item,"calories")} kcal · ${amount(item,"protein")}g protein</small></div><button type="button" class="plan-remove" data-remove="${escape(item.uid)}" aria-label="Remove ${recipe.name} from ${type.toLowerCase()}">×</button></div>`;}).join(""):`<a class="slot-empty" href="#recipes">+ Find something for ${type.toLowerCase()}</a>`}</section>`;}).join("");
    $("#planCalories").textContent=items.reduce((sum,item)=>sum+amount(item,"calories"),0).toLocaleString();
    $("#planProtein").innerHTML=items.reduce((sum,item)=>sum+amount(item,"protein"),0)+"<span>g</span>";
    $("#planCount").textContent=items.length;
    $("#planHelp").textContent="Planning helps you choose ahead. Open a recipe and choose Log this meal when you are ready to track it.";
    $("#planSlots").querySelectorAll("img").forEach(addPhotoFallback);
  }
  $("#planSlots").addEventListener("click",event=>{const remove=event.target.closest("[data-remove]");if(!remove)return;plans[selectedDate]=currentPlan().filter(item=>item.uid!==remove.dataset.remove);put(planKey,plans);renderPlan();$("#planDate").focus();notify("Meal removed from this plan.");});
  $("#planDate").value=selectedDate;$("#planDate").addEventListener("change",event=>{if(!event.target.value){event.target.value=selectedDate;return;}selectedDate=event.target.value;renderPlan();});
  $("#logPlan").addEventListener("click",()=>{window.location.href="index.html";});
  function logRecipe(id,type){const recipe=findRecipe(id);if(!recipe)return;try{sessionStorage.setItem("fp_pending_recipe",JSON.stringify({name:recipe.name,type,calories:recipe.calories,protein:recipe.protein,carbs:recipe.carbs,fat:recipe.fat}));window.location.href="index.html?meal=1";}catch{notify("Your browser could not open the recipe in the tracker. Check storage settings.");}}
  function openRecipe(id,trigger){const recipe=findRecipe(id);if(!recipe)return;lastDialogTrigger=trigger;$("#dialogContent").innerHTML=`<img class="dialog-image" src="${recipe.image}" alt="${recipe.name}" /><div class="dialog-body"><div class="dialog-heading"><div><p class="eyebrow dark-eyebrow">${recipe.type} / ${recipe.minutes} minutes${recipe.rest?" + "+recipe.rest:""}</p><h2 id="dialogTitle">${recipe.name}</h2></div></div><p>${recipe.description} Makes 1 serving.</p><div class="dialog-macros"><div><strong>${recipe.calories}</strong><span>estimated kcal</span></div><div><strong>${recipe.protein}g</strong><span>protein</span></div><div><strong>${recipe.carbs}g</strong><span>carbs</span></div><div><strong>${recipe.fat}g</strong><span>fat</span></div></div><div class="recipe-method"><div><h3>What you'll need</h3><ul>${recipe.ingredients.map(ingredient=>`<li>${ingredient}</li>`).join("")}</ul></div><div><h3>Make it happen</h3><ol>${recipe.steps.map(step=>`<li>${step}</li>`).join("")}</ol></div></div><p class="recipe-allergens"><strong>Allergen notes:</strong> ${recipe.allergens}</p><div class="dialog-add"><label>Meal slot<select id="recipeMealSlot">${slots.map(type=>`<option${type===recipe.type?" selected":""}>${type}</option>`).join("")}</select></label><button type="button" class="button button-dark" id="dialogAdd">Add to my plan <span aria-hidden="true">+</span></button><button type="button" class="button button-lime" id="dialogLog">Log this meal <span aria-hidden="true">↗</span></button></div><p id="dialogFeedback" class="dialog-feedback" role="status" aria-live="polite"></p><p class="dialog-disclaimer">Plan date: ${new Date(selectedDate+"T12:00:00").toLocaleDateString(undefined,{month:"long",day:"numeric",year:"numeric"})}. Log this meal opens the tracker with editable meal details. All nutrition values are estimates per serving; brands and portions change the totals. Photo is illustrative.</p></div>`;$("#dialogAdd").addEventListener("click",()=>addToPlan(id,$("#recipeMealSlot").value));$("#dialogLog").addEventListener("click",()=>logRecipe(id,$("#recipeMealSlot").value));addPhotoFallback($("#dialogContent img"));$("#recipeDialog").showModal();document.body.style.overflow="hidden";$("#dialogClose").focus();}
  $("#dialogClose").addEventListener("click",()=>$("#recipeDialog").close());
  $("#recipeDialog").addEventListener("click",event=>{if(event.target!==$("#recipeDialog"))return;const rect=event.target.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)event.target.close();});
  $("#recipeDialog").addEventListener("close",()=>{document.body.style.overflow="";if(lastDialogTrigger?.isConnected)lastDialogTrigger.focus();});
  renderRecipes();renderPlan();
})();
