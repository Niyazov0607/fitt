/* Motion preferences, accessible dialogs, and recipe-to-tracker handoff. */
(() => {
  const motionButton = document.querySelector('#motionToggle');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function refreshMotion() {
    let value = 'on';
    try { value = localStorage.getItem('fp_motion') || 'on'; } catch {}
    document.documentElement.dataset.motion = value;
    const paused = value === 'off' || reducedMotion.matches;
    document.body.classList.toggle('motion-paused', paused);
    if (motionButton) {
      motionButton.setAttribute('aria-pressed', String(paused));
      motionButton.setAttribute('aria-label', reducedMotion.matches ? 'Reduced motion enabled by your device' : paused ? 'Resume animations' : 'Pause animations');
      motionButton.innerHTML = `<i class="fa-solid ${paused ? 'fa-play' : 'fa-pause'}" aria-hidden="true"></i><span>${reducedMotion.matches ? 'Reduced motion' : paused ? 'Motion off' : 'Motion on'}</span>`;
      motionButton.disabled = reducedMotion.matches;
    }
  }
  motionButton?.addEventListener('click', () => {
    try { localStorage.setItem('fp_motion', document.documentElement.dataset.motion === 'off' ? 'on' : 'off'); } catch {}
    refreshMotion();
  });
  reducedMotion.addEventListener('change', refreshMotion);
  window.addEventListener('storage', (event) => { if (event.key === 'fp_motion') refreshMotion(); });
  refreshMotion();

  // Native buttons and links remain keyboard operable; keep the existing app handlers.
  document.querySelectorAll('.nav-link[data-section]').forEach(link => {
    link.addEventListener('click', (event) => { event.preventDefault(); });
  });
  const menuButton = document.querySelector('#menuToggle');
  const sidebar = document.querySelector('#sidebar');
  const sidebarBackdrop = document.querySelector('#sidebarBackdrop');
  const mobileMenu = matchMedia('(max-width: 992px)');
  try { document.body.classList.toggle('sidebar-collapsed',JSON.parse(localStorage.getItem('fp_sidebar_collapsed')) === true); } catch {}
  function syncSidebar() {
    const expanded = mobileMenu.matches ? sidebar.classList.contains('open') : !document.body.classList.contains('sidebar-collapsed');
    menuButton.setAttribute('aria-expanded',String(expanded));
    menuButton.title = expanded ? 'Close navigation' : 'Open navigation';
    sidebar.inert = !expanded;
    document.querySelector('#app .main').inert = mobileMenu.matches && expanded;
    if (sidebarBackdrop) sidebarBackdrop.hidden = !mobileMenu.matches || !expanded || document.querySelector('#app').classList.contains('hidden');
  }
  new MutationObserver(syncSidebar).observe(sidebar, {attributes:true,attributeFilter:['class']});
  new MutationObserver(syncSidebar).observe(document.body, {attributes:true,attributeFilter:['class']});
  new MutationObserver(syncSidebar).observe(document.querySelector('#app'), {attributes:true,attributeFilter:['class']});
  mobileMenu.addEventListener('change',() => { sidebar.classList.remove('open'); syncSidebar(); });
  sidebarBackdrop?.addEventListener('click',() => { sidebar.classList.remove('open'); menuButton.focus(); });
  syncSidebar();

  const auth = document.querySelector('#authScreen');
  const overlay = document.querySelector('#modalOverlay');
  let dialogOpener = null;
  let activeDialog = null;
  const tabbables = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]';
  function syncDialogs() {
    const visible = !auth.classList.contains('hidden') ? auth : !overlay.classList.contains('hidden') ? overlay.querySelector('.modal:not(.hidden)') : null;
    if (visible && visible !== activeDialog) {
      dialogOpener = document.activeElement;
      activeDialog = visible;
      visible.setAttribute('role','dialog');
      visible.setAttribute('aria-modal','true');
      const title = visible.querySelector('h2,h3');
      if (title) visible.setAttribute('aria-label', title.textContent.trim());
      setTimeout(() => visible.querySelector(tabbables)?.focus(), 0);
    } else if (!visible && activeDialog) {
      activeDialog = null;
      setTimeout(() => { if (dialogOpener?.isConnected) dialogOpener.focus(); }, 0);
    }
    document.body.classList.toggle('dialog-open', Boolean(visible));
    document.querySelector('#landing').inert = Boolean(visible);
    document.querySelector('#app').inert = Boolean(visible);
    if (motionButton) motionButton.inert = Boolean(visible);
  }
  [auth,overlay].forEach(el => new MutationObserver(syncDialogs).observe(el, {attributes:true,attributeFilter:['class'],subtree:true}));
  document.addEventListener('keydown', event => {
    if (!activeDialog && event.key === 'Escape' && sidebar.classList.contains('open')) { sidebar.classList.remove('open'); menuButton.focus(); return; }
    if (!activeDialog) return;
    if (event.key === 'Escape') {
      if (activeDialog === auth) closeAuth();
      else activeDialog.querySelector('.modal-close')?.click();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(activeDialog.querySelectorAll(tabbables)).filter(el => el.getClientRects().length);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !activeDialog.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !activeDialog.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
  });

  // A recipe is reviewed in the original meal form and saved by its existing handler.
  let recipeWasOpened = false;
  function openPendingRecipe() {
    if (recipeWasOpened || document.querySelector('#app').classList.contains('hidden')) return;
    let recipe;
    try { recipe = JSON.parse(sessionStorage.getItem('fp_pending_recipe')); } catch { return; }
    if (!recipe || typeof recipe.name !== 'string') return;
    const values = {mName:recipe.name,mType:recipe.type,mCal:recipe.calories,mPro:recipe.protein,mCarb:recipe.carbs,mFat:recipe.fat};
    for (const key of ['mCal','mPro','mCarb','mFat']) { if (!Number.isFinite(Number(values[key])) || Number(values[key]) < 0) return; }
    if (!['Breakfast','Lunch','Dinner','Snacks'].includes(values.mType)) values.mType = 'Lunch';
    recipeWasOpened = true;
    document.querySelector('.nav-link[data-section="nutrition"]').click();
    document.querySelector('[data-modal="mealModal"]').click();
    document.querySelector('#mealId').value = '';
    for (const [id,value] of Object.entries(values)) document.getElementById(id).value = value;
    sessionStorage.removeItem('fp_pending_recipe');
    history.replaceState(null,'',`${location.pathname}#nutrition`);
  }
  new MutationObserver(openPendingRecipe).observe(document.querySelector('#app'), {attributes:true,attributeFilter:['class']});
  window.addEventListener('load', () => {
    let hasPending = false;
    try { hasPending = Boolean(sessionStorage.getItem('fp_pending_recipe')); } catch {}
    if (hasPending) setTimeout(() => {
      if (document.querySelector('#app').classList.contains('hidden')) openAuth('login');
      else openPendingRecipe();
    }, 750);
  });
})();
