/* Decorative tracker effects; intentionally no changes to account or fitness data. */
(() => {
  const app = document.querySelector('#app');
  if (!app || document.querySelector('#trackerAtmosphere')) return;

  const atmosphere = document.createElement('div');
  atmosphere.id = 'trackerAtmosphere';
  atmosphere.setAttribute('aria-hidden', 'true');
  atmosphere.setAttribute('inert', '');
  atmosphere.innerHTML = `
    <div class="tracker-ribbon tracker-ribbon-one"></div>
    <div class="tracker-ribbon tracker-ribbon-two"></div>
    <div class="tracker-ribbon tracker-ribbon-three"></div>
    <div class="tracker-grid"></div>
    <svg class="tracker-orbits" viewBox="0 0 1000 800" preserveAspectRatio="none" focusable="false" aria-hidden="true">
      <ellipse cx="620" cy="325" rx="385" ry="230" transform="rotate(-24 620 325)"/>
      <ellipse cx="560" cy="400" rx="510" ry="310" transform="rotate(-24 560 400)"/>
      <ellipse cx="620" cy="325" rx="385" ry="230" transform="rotate(-24 620 325)" class="tracker-orbit-glow"/>
      <ellipse cx="560" cy="400" rx="510" ry="310" transform="rotate(-24 560 400)" class="tracker-orbit-peach"/>
      <path d="M-100 580C80 220 410 720 750 350S1190 210 1270 50"/>
    </svg>`;

  // Deterministic positions avoid layout jumps and keep the effect inexpensive.
  const particlePositions = [[7,24],[19,73],[27,13],[33,48],[44,88],[49,29],[57,64],[65,10],[69,81],[76,39],[83,60],[91,18],[94,88],[13,95]];
  particlePositions.forEach(([x,y], index) => {
    const particle = document.createElement('span');
    particle.className = 'tracker-particle';
    particle.style.setProperty('--particle-x', `${x}%`);
    particle.style.setProperty('--particle-y', `${y}%`);
    particle.style.setProperty('--particle-size', `${index % 4 === 0 ? 5 : 3}px`);
    particle.style.setProperty('--particle-duration', `${13 + index % 7 * 2}s`);
    particle.style.setProperty('--particle-delay', `${-index * 1.7}s`);
    atmosphere.append(particle);
  });
  app.prepend(atmosphere);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function refreshActivity() {
    const appHidden = app.classList.contains('hidden') || document.body.classList.contains('on-landing');
    const motionOff = document.documentElement.dataset.motion === 'off' || document.body.classList.contains('motion-paused') || reducedMotion.matches;
    atmosphere.dataset.paused = String(document.visibilityState === 'hidden' || appHidden || motionOff);
  }
  const observer = new MutationObserver(refreshActivity);
  observer.observe(app, {attributes:true,attributeFilter:['class']});
  observer.observe(document.body, {attributes:true,attributeFilter:['class']});
  observer.observe(document.documentElement, {attributes:true,attributeFilter:['data-motion']});
  document.addEventListener('visibilitychange', refreshActivity);
  reducedMotion.addEventListener('change', refreshActivity);
  refreshActivity();
})();
