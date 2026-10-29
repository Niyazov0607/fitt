/* =========================================================
   EXERCISE LIBRARY
   ========================================================= */
const EXERCISES = [
  { n: "Barbell Bench Press", m: "Chest", l: "Intermediate", e: "Barbell", k: 9, t: "Retract shoulder blades, feet planted, lower bar to mid-chest and press up in a slight arc." },
  { n: "Push-Up", m: "Chest", l: "Beginner", e: "Bodyweight", k: 7, t: "Hands under shoulders, body in a straight line, chest to just above the floor." },
  { n: "Incline Dumbbell Press", m: "Chest", l: "Intermediate", e: "Dumbbells", k: 8, t: "Bench at 30°, press dumbbells over upper chest and control the descent." },
  { n: "Cable Fly", m: "Chest", l: "Beginner", e: "Cable", k: 5, t: "Slight elbow bend, hug an imaginary tree and squeeze at the centre." },
  { n: "Deadlift", m: "Back", l: "Advanced", e: "Barbell", k: 11, t: "Neutral spine, bar over mid-foot, push the floor away and lock out hips and knees together." },
  { n: "Pull-Up", m: "Back", l: "Intermediate", e: "Bodyweight", k: 9, t: "Full hang to chin over bar, drive elbows down and avoid swinging." },
  { n: "Bent-Over Row", m: "Back", l: "Intermediate", e: "Barbell", k: 8, t: "Hinge to roughly 45°, pull bar to lower ribs, keep the back flat." },
  { n: "Lat Pulldown", m: "Back", l: "Beginner", e: "Machine", k: 6, t: "Chest tall, pull the bar to upper chest, elbows travel down and back." },
  { n: "Back Squat", m: "Legs", l: "Intermediate", e: "Barbell", k: 11, t: "Brace core, sit between the hips, knees track over toes, drive up through mid-foot." },
  { n: "Walking Lunges", m: "Legs", l: "Beginner", e: "Dumbbells", k: 8, t: "Long step, back knee near the floor, torso upright, push through the front heel." },
  { n: "Romanian Deadlift", m: "Legs", l: "Intermediate", e: "Barbell", k: 9, t: "Soft knees, push hips back, bar close to legs until hamstrings stretch." },
  { n: "Bodyweight Squat", m: "Legs", l: "Beginner", e: "Bodyweight", k: 6, t: "Feet shoulder-width, chest up, sit down and back, stand tall." },
  { n: "Overhead Press", m: "Shoulders", l: "Intermediate", e: "Barbell", k: 8, t: "Glutes tight, press straight up, move head through at the top." },
  { n: "Lateral Raise", m: "Shoulders", l: "Beginner", e: "Dumbbells", k: 4, t: "Lead with the elbows, raise to shoulder height, lower slowly." },
  { n: "Face Pull", m: "Shoulders", l: "Beginner", e: "Cable", k: 4, t: "Rope to eye level, pull apart and rotate thumbs back." },
  { n: "Barbell Curl", m: "Arms", l: "Beginner", e: "Barbell", k: 5, t: "Elbows pinned to ribs, curl without swinging, squeeze at the top." },
  { n: "Triceps Dips", m: "Arms", l: "Intermediate", e: "Bodyweight", k: 7, t: "Shoulders down, lower until upper arms are parallel, press to lockout." },
  { n: "Hammer Curl", m: "Arms", l: "Beginner", e: "Dumbbells", k: 5, t: "Neutral grip, curl up alternating or together, control the way down." },
  { n: "Plank", m: "Core", l: "Beginner", e: "Bodyweight", k: 4, t: "Forearms down, ribs tucked, squeeze glutes and hold a straight line." },
  { n: "Hanging Leg Raise", m: "Core", l: "Advanced", e: "Bodyweight", k: 6, t: "Hang tall, curl pelvis up as the legs rise, avoid momentum." },
  { n: "Russian Twist", m: "Core", l: "Beginner", e: "Bodyweight", k: 5, t: "Lean back slightly, rotate through the torso, not just the arms." },
  { n: "HIIT Sprint Intervals", m: "Cardio", l: "Advanced", e: "Treadmill", k: 14, t: "30 s hard / 60 s easy for 8–10 rounds after a thorough warm-up." },
  { n: "Jump Rope", m: "Cardio", l: "Beginner", e: "Rope", k: 12, t: "Small hops on the balls of the feet, wrists drive the rope." },
  { n: "Steady-State Run", m: "Cardio", l: "Beginner", e: "Outdoor", k: 10, t: "Conversational pace, relaxed shoulders, land softly under your hips." },
  { n: "Burpees", m: "Cardio", l: "Intermediate", e: "Bodyweight", k: 12, t: "Chest to floor, explosive jump, keep a steady rhythm." },
];
const MUSCLES = ["All", "Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Cardio"];
let libMuscle = "All";

function renderLibrary() {
  const chips = $("#libChips");
  if (!chips.children.length) {
    chips.innerHTML = MUSCLES.map((m) => `<button type="button" class="chip ${m === libMuscle ? "active" : ""}" data-m="${m}">${m}</button>`).join("");
    chips.onclick = (e) => {
      const b = e.target.closest("[data-m]");
      if (!b) return;
      libMuscle = b.dataset.m;
      chips.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === b));
      renderLibrary();
    };
  }
  const q = $("#libSearch").value.toLowerCase().trim();
  const lvl = $("#libLevel").value;
  const items = EXERCISES.filter((x) =>
    (libMuscle === "All" || x.m === libMuscle) &&
    (!lvl || x.l === lvl) &&
    (!q || (x.n + " " + x.m + " " + x.e).toLowerCase().includes(q)));
  const list = $("#libList");
  if (!items.length) { list.innerHTML = '<p class="muted">No exercises match your filters.</p>'; return; }
  list.innerHTML = items.map((x, i) => `
    <div class="card glass list-item lib-card">
      <h4>${escapeHTML(x.n)}<span class="tag">${x.m}</span></h4>
      <div class="meta">
        <span><i class="fa-solid fa-signal"></i>${x.l}</span>
        <span><i class="fa-solid fa-dumbbell"></i>${x.e}</span>
        <span><i class="fa-solid fa-fire"></i>~${x.k} kcal/min</span>
      </div>
      <p class="muted">${escapeHTML(x.t)}</p>
      <div class="actions"><button data-log="${EXERCISES.indexOf(x)}"><i class="fa-solid fa-plus"></i> Log workout</button></div>
    </div>`).join("");
  list.querySelectorAll("[data-log]").forEach((b) => (b.onclick = () => logExercise(EXERCISES[+b.dataset.log])));
}

function logExercise(x) {
  $("#workoutForm").reset();
  $("#workoutId").value = "";
  $("#workoutModalTitle").textContent = "Add Workout";
  $("#wName").value = x.n;
  $("#wCategory").value = x.m;
  $("#wDuration").value = 20;
  $("#wCalories").value = x.k * 20;
  $("#wDate").value = today();
  $("#wNotes").value = x.t;
  $("#modalOverlay").classList.remove("hidden");
  $$("#modalOverlay .modal").forEach((m) => m.classList.add("hidden"));
  $("#workoutModal").classList.remove("hidden");
}

$("#libSearch").oninput = renderLibrary;
$("#libLevel").onchange = renderLibrary;
renderLibrary();
