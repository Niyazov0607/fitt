# FitPulse — Move with purpose (v2.1)

For Vercel hosting, follow [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md). The included `vercel.json` deploys the static `dist/` build with the Other framework preset.

## Tracker update

The landing hero now uses a male athlete photo by [Samuel Girven on Unsplash](https://unsplash.com/photos/a-man-working-out-with-dumbs-in-a-gym-uYi2jyRpXDI), bundled as `assets/hero-man.jpg` (original image ID `photo-1704223523518-e3ce27879f99`).

Healthy foods now live directly inside the tracker's **Nutrition** section. Click a food image, name or View details to open its dedicated in-app recipe page. Adjust servings to scale ingredients and estimated macros, save favorites, plan by date, and review a recipe in the meal form before saving it. The daily food log has a date selector, search and meal filters.

The menu now collapses/restores the sidebar on desktop and opens a drawer on mobile, with a closing backdrop and Escape support. The sidebar's visible scrollbar is hidden while scrolling remains available. All tracker screens share a new animated atmosphere with aurora ribbons, a traveling grid, orbit trails and particles, with motion controls and reduced-motion support.

Recipe favorites and plans are now included in JSON backups. Import validates the data before replacing records. Navigation, modal reset behavior, local-date analytics, calendar month changes, and favorite-workout refreshes have also been corrected. Deep links such as `index.html#nutrition/recipe/berry-oats` survive reload and sign-in.

Modern animated redesign with a dedicated nutrition hub. Plain HTML, CSS and JavaScript; no dependencies to install.

## Quick start

With Node.js 18 or newer, run `npm start` and open **http://127.0.0.1:8000**. You can also use the Python server described below. Use a local server so the recipe handoff and tracker share the same browser origin.

- `npm run check` checks JavaScript syntax.
- `npm run build` copies the static site into `dist/` for hosting.

## Added in v2

- Charcoal/lime visual design, animated ambient backgrounds, athlete hero, orbit accents, pulse graphic, floating elements and scroll reveals.
- Redesigned landing, account dialogs, tracker cards and dark mode.
- `nutrition.html`: eight searchable recipes with breakfast/lunch/dinner, plant-based, high-protein and saved filters.
- Recipe dialogs with ingredients, cooking steps, allergen notes and estimated nutrition per serving.
- Date-based meal planner with add/remove controls and kcal/protein totals. Plans and recipe favorites are scoped to the current local account, or to guests.
- **Log this meal** opens editable details in the existing tracker meal form, including after sign-in or registration. Planning does not mark a meal as eaten.
- Persistent motion toggle, device reduced-motion support, keyboard navigation and dialog focus management.
- Fixed today's nutrition totals and added a bundled default avatar.

All athlete/food images are bundled. Google Fonts, Font Awesome and Chart.js still load from public CDNs. Recipe favorites and plans are browser-local records included in the updated tracker JSON export/import.

Recipe photos are illustrative and nutrition values are estimates, not personalized intake targets. General variety guidance links to the [WHO healthy diet guide](https://www.who.int/news-room/fact-sheets/detail/healthy-diet). Recipe temperatures follow [FoodSafety.gov](https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures).

Photos: Unsplash (`images.unsplash.com`), bundled under their original image IDs in assets: `photo-1538805060514-97d9cc17730c` (athlete), `photo-1517673400267-0251440c45dc`, `photo-1512621776951-a57141f2eefd`, `photo-1467003909585-2f8a72700288`, `photo-1547592180-85f173990554`, `photo-1488477181946-6428a0291777`, `photo-1547592166-23ac45744acd`, `photo-1525351484163-7529414344d8`, `photo-1511690743698-d9d85f2fbf38`.

## Original project features and storage

A responsive fitness website and tracker built with plain HTML, CSS, and JavaScript: a public marketing site (hero, features, programs, calorie/BMI calculator, trainers, pricing, FAQ, contact) in front of a full tracking app. It runs as a static app and stores each local account's data in that browser.

## Run it

1. Extract the folder.
2. Open a terminal in `FitPulse`.
3. Start a local web server:

   ```bash
   python -m http.server 8000
   ```

4. Open `http://localhost:8000` in your browser.
5. Create an account to get started.

Chart.js, Font Awesome and Google Fonts (Barlow) load from public CDNs. The tracking screens work without Chart.js; analytics charts need an internet connection.

## Included

- Public landing website with sign-up/login overlay, and a calculator whose result becomes your starting calorie goal
- Exercise Library (24 exercises, filters, one-tap "Log workout")
- Editable daily calorie goal in Profile

- Local sign up, sign in, change password, and logout
- Separate workouts, meals, goals, favorites, settings, and progress per local account
- Workout and meal tracking with search, filters, sorting, editing, and deletion
- Water and activity tracking, daily dashboard, BMI history, calendar, reminders, and analytics
- Dark mode, profile photo, notifications, and JSON data backup/restore
- Responsive layout, keyboard focus indicators, and reduced-motion support

## Data and authentication

FitPulse is a complete static portfolio demo, not a hosted service. Account records and fitness data live in the current browser's `localStorage`; they do not sync across browsers or devices. Passwords are derived with PBKDF2 in the browser, but there is no server, account recovery, cloud backup, or server-side authorization. Use the export/import controls to move a backup manually. Do not use this version for sensitive health data or production accounts. A production release needs a backend, secure sessions, database, and deployment configuration.
