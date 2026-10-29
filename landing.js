/* Public landing page behaviour */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const motionOff = () => document.documentElement.dataset.motion === "off" || matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* auth buttons */
  $$("[data-auth]").forEach((b) => b.addEventListener("click", () => {
    closeMenu();
    if (typeof openAuth === "function") openAuth(b.dataset.auth);
  }));

  /* mobile menu */
  const burger = $("#lpBurger"), links = $("#lpLinks");
  function closeMenu() { links.classList.remove("open"); burger.setAttribute("aria-expanded", "false"); }
  burger.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    burger.setAttribute("aria-expanded", String(open));
  });
  links.addEventListener("click", (e) => { if (e.target.tagName === "A") closeMenu(); });

  /* smooth scroll (offset for sticky nav) */
  $$('#landing a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    const target = id === "#top" ? document.body : $(id);
    if (!target) return;
    e.preventDefault();
    const y = id === "#top" ? 0 : target.getBoundingClientRect().top + window.scrollY - 64;
    window.scrollTo({ top: y, behavior: motionOff() ? "auto" : "smooth" });
  }));

  /* nav shadow + back to top */
  const nav = $("#lpNav"), topBtn = $("#lpTop");
  function onScroll() {
    nav.classList.toggle("scrolled", window.scrollY > 24);
    topBtn.classList.toggle("hidden", window.scrollY < 700);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  topBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: motionOff() ? "auto" : "smooth" }));
  onScroll();

  /* programs */
  const PROGRAMS = [
    { t: "Foundation 4-Week", lv: "Beginner", d: "4 weeks", w: "3 days/wk", i: "fa-seedling", c: "Full-body basics, form and a habit that sticks.", tag: "Strength" },
    { t: "Fat Burn Express", lv: "Beginner", d: "6 weeks", w: "4 days/wk", i: "fa-fire", c: "Cardio circuits and daily steps for steady fat loss.", tag: "Cardio" },
    { t: "Push Pull Legs", lv: "Intermediate", d: "8 weeks", w: "5 days/wk", i: "fa-dumbbell", c: "Classic split with progressive overload for size and strength.", tag: "Hypertrophy" },
    { t: "HIIT Shred", lv: "Intermediate", d: "6 weeks", w: "4 days/wk", i: "fa-bolt", c: "Short, brutal intervals that torch calories and build engine.", tag: "HIIT" },
    { t: "Power Builder", lv: "Advanced", d: "12 weeks", w: "5 days/wk", i: "fa-weight-hanging", c: "Heavy compounds plus accessory work to break plateaus.", tag: "Powerlifting" },
    { t: "Mobility & Recovery", lv: "Beginner", d: "Ongoing", w: "2–3 days/wk", i: "fa-spa", c: "Yoga flows and stretching to move better and recover faster.", tag: "Yoga" },
  ];
  const grid = $("#progGrid");
  function renderPrograms(f = "all") {
    grid.innerHTML = PROGRAMS.filter((p) => f === "all" || p.lv === f).map((p) => `
      <article class="lp-prog">
        <div class="lp-prog-ic"><i class="fa-solid ${p.i}"></i></div>
        <span class="lp-lv lv-${p.lv.toLowerCase()}">${p.lv}</span>
        <h3>${p.t}</h3><p>${p.c}</p>
        <ul><li><i class="fa-regular fa-calendar"></i>${p.d}</li><li><i class="fa-solid fa-repeat"></i>${p.w}</li><li><i class="fa-solid fa-tag"></i>${p.tag}</li></ul>
        <button class="lp-btn lp-btn-outline lp-btn-block" data-auth="register">Start program</button>
      </article>`).join("");
    $$("[data-auth]", grid).forEach((b) => b.addEventListener("click", () => openAuth("register")));
  }
  renderPrograms();
  $("#progFilter").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    $$("#progFilter button").forEach((x) => x.classList.toggle("active", x === b));
    renderPrograms(b.dataset.f);
  });

  /* calculator */
  $("#calcForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const sex = $('input[name="sex"]:checked').value;
    const age = +$("#cAge").value, h = +$("#cHeight").value, w = +$("#cWeight").value;
    if (!(age > 0 && h > 0 && w > 0)) return;
    const bmi = w / Math.pow(h / 100, 2);
    const cat = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Healthy range" : bmi < 30 ? "Overweight" : "Obese range";
    const bmr = 10 * w + 6.25 * h - 5 * age + (sex === "male" ? 5 : -161);
    const cal = Math.round((bmr * +$("#cActivity").value + +$("#cGoal").value) / 10) * 10;
    const p = Math.round((cal * 0.3) / 4), c = Math.round((cal * 0.45) / 4), f = Math.round((cal * 0.25) / 9);
    try { sessionStorage.setItem("fp_calc", JSON.stringify({ age, height: h, weight: w, gender: sex === "male" ? "Male" : "Female", cal })); } catch {}
    $("#rBmi").textContent = bmi.toFixed(1);
    $("#rBmiCat").textContent = cat;
    $("#rCal").textContent = cal.toLocaleString();
    $("#rP").textContent = p + "g"; $("#rC").textContent = c + "g"; $("#rF").textContent = f + "g";
  });


  /* recommended nutrition */
  const NUT = {
    loss: { intro: "Keep calories moderate and protein high. These foods are filling for the calories, so a deficit feels manageable.", foods: [
      { n: "Grilled chicken breast", s: "150 g", k: 248, p: 46, c: 0, f: 5, i: "fa-drumstick-bite" },
      { n: "Greek yogurt, 0% fat", s: "200 g", k: 118, p: 20, c: 7, f: 1, i: "fa-bowl-food" },
      { n: "Tuna in water", s: "120 g", k: 140, p: 30, c: 0, f: 1, i: "fa-fish" },
      { n: "Broccoli, cooked", s: "150 g", k: 52, p: 4, c: 10, f: 1, i: "fa-seedling" },
      { n: "Lentils, cooked", s: "200 g", k: 232, p: 18, c: 40, f: 1, i: "fa-leaf" },
      { n: "Eggs", s: "2 large", k: 143, p: 13, c: 1, f: 10, i: "fa-egg" } ] },
    muscle: { intro: "Eat in a small surplus with plenty of protein and carbs to recover and grow. Spread protein across 3–5 meals.", foods: [
      { n: "Grilled chicken breast", s: "150 g", k: 248, p: 46, c: 0, f: 5, i: "fa-drumstick-bite" },
      { n: "Salmon fillet", s: "150 g", k: 310, p: 30, c: 0, f: 19, i: "fa-fish" },
      { n: "Rolled oats", s: "50 g dry", k: 190, p: 7, c: 33, f: 4, i: "fa-wheat-awn" },
      { n: "Brown rice, cooked", s: "150 g", k: 168, p: 4, c: 35, f: 1, i: "fa-bowl-rice" },
      { n: "Cottage cheese, low fat", s: "200 g", k: 162, p: 22, c: 6, f: 4, i: "fa-cheese" },
      { n: "Sweet potato, baked", s: "200 g", k: 180, p: 4, c: 41, f: 0, i: "fa-carrot" } ] },
    balance: { intro: "A steady mix of lean protein, whole grains, healthy fats and fruit to keep energy even and support daily training.", foods: [
      { n: "Rolled oats", s: "50 g dry", k: 190, p: 7, c: 33, f: 4, i: "fa-wheat-awn" },
      { n: "Salmon fillet", s: "150 g", k: 310, p: 30, c: 0, f: 19, i: "fa-fish" },
      { n: "Lentils, cooked", s: "200 g", k: 232, p: 18, c: 40, f: 1, i: "fa-leaf" },
      { n: "Avocado", s: "½ fruit", k: 160, p: 2, c: 9, f: 15, i: "fa-seedling" },
      { n: "Almonds", s: "30 g", k: 174, p: 6, c: 6, f: 15, i: "fa-cookie" },
      { n: "Banana", s: "1 medium", k: 105, p: 1, c: 27, f: 0, i: "fa-lemon" } ] },
  };
  function renderNut(g = "loss") {
    $("#nutIntro").textContent = NUT[g].intro;
    $("#nutGrid").innerHTML = NUT[g].foods.map((x) => `
      <article class="lp-nut">
        <div class="lp-nut-top"><span class="lp-nut-ic"><i class="fa-solid ${x.i}"></i></span><div><h3>${x.n}</h3><small>${x.s}</small></div><b>${x.k}<em>kcal</em></b></div>
        <div class="lp-nut-macros"><span><i class="dot p"></i>P ${x.p}g</span><span><i class="dot c"></i>C ${x.c}g</span><span><i class="dot f"></i>F ${x.f}g</span></div>
      </article>`).join("");
  }
  renderNut();
  $("#nutFilter").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    $$("#nutFilter button").forEach((x) => x.classList.toggle("active", x === b));
    renderNut(b.dataset.g);
  });

  /* count-up stats */
  const counters = $$("[data-count]");
  const fmt = (n) => n.toLocaleString();
  const run = (el) => {
    if (motionOff()) { el.textContent = fmt(+el.dataset.count); return; }
    const end = +el.dataset.count, t0 = performance.now(), dur = 1400;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = fmt(Math.round(end * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((en) => {
      if (en.isIntersecting) { run(en.target); io.unobserve(en.target); }
    }), { threshold: 0.4 });
    counters.forEach((c) => io.observe(c));
    /* reveal on scroll */
    const rv = new IntersectionObserver((es) => es.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("in"); rv.unobserve(en.target); }
    }), { threshold: 0.12 });
    $$(".lp-feat,.lp-prog,.lp-trainer,.lp-quote,.lp-plan,.lp-steps li,.lp-head").forEach((el) => { el.classList.add("rv"); rv.observe(el); });
  } else counters.forEach((c) => (c.textContent = fmt(+c.dataset.count)));

  /* pricing toggle */
  const tog = $("#billToggle");
  tog.addEventListener("click", () => {
    const y = tog.getAttribute("aria-checked") !== "true";
    tog.setAttribute("aria-checked", String(y));
    $$(".lp-price b[data-m]").forEach((b) => (b.textContent = y ? b.dataset.y : b.dataset.m));
  });

  /* forms (demo) */
  $("#contactForm").addEventListener("submit", (e) => {
    e.preventDefault(); e.target.reset(); $("#contactOk").classList.remove("hidden");
  });
  $("#newsForm").addEventListener("submit", (e) => {
    e.preventDefault(); e.target.reset(); $("#newsOk").classList.remove("hidden");
  });
  $("#yr").textContent = new Date().getFullYear();
})();
