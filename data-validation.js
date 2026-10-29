/* Validate portable data before it can replace the active local account's records. */
(() => {
  'use strict';

  const DATA_KEYS = ['workouts', 'meals', 'water', 'activity', 'goals', 'favorites', 'profile', 'settings', 'analytics', 'notifications'];
  const MAX_RECORDS = 25000;
  const fail = (path, message) => { throw new Error(`Invalid backup: ${path} ${message}.`); };
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  function object(value, path, allowed, required = allowed) {
    if (!isObject(value)) fail(path, 'must be an object');
    if (Object.keys(value).some(key => !allowed.includes(key))) fail(path, 'contains unsupported fields');
    if (required.some(key => !Object.hasOwn(value, key))) fail(path, 'is missing required fields');
    return value;
  }
  function text(value, path, max = 5000, allowEmpty = true) {
    if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim())) fail(path, 'must be valid text');
    return value;
  }
  function number(value, path, min = 0) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > Number.MAX_SAFE_INTEGER) fail(path, 'must be a finite nonnegative number');
    return value;
  }
  function boolean(value, path) {
    if (typeof value !== 'boolean') fail(path, 'must be true or false');
    return value;
  }
  function id(value, path) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) fail(path, 'has an invalid record ID');
    return value;
  }
  function date(value, path, allowEmpty = false) {
    if (allowEmpty && value === '') return value;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(path, 'has an invalid date');
    const parsed = new Date(`${value}T12:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail(path, 'has an invalid date');
    return value;
  }
  function timestamp(value, path) {
    if (typeof value !== 'string' || value.length > 64 || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) fail(path, 'has an invalid timestamp');
    date(value.slice(0, 10), path);
    return value;
  }
  function array(value, path, validate, uniqueIds = false) {
    if (!Array.isArray(value) || value.length > MAX_RECORDS) fail(path, 'must be a supported list');
    const result = value.map((item, index) => validate(item, `${path}[${index}]`));
    if (uniqueIds && new Set(result.map(item => item.id)).size !== result.length) fail(path, 'contains duplicate record IDs');
    return result;
  }
  function enumText(value, path, options) {
    if (!options.includes(value)) fail(path, 'has an unsupported value');
    return value;
  }
  function datedRecords(value, path, fields) {
    if (!isObject(value) || Object.keys(value).length > MAX_RECORDS) fail(path, 'must be a supported date map');
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
      date(key, `${path} date`);
      object(entry, `${path}.${key}`, Object.keys(fields));
      return [key, Object.fromEntries(Object.entries(fields).map(([field, minimum]) => [field, number(entry[field], `${path}.${key}.${field}`, minimum)]))];
    }));
  }
  function profile(value) {
    const allowed = ['name', 'email', 'age', 'gender', 'height', 'weight', 'level', 'calGoal', 'avatar'];
    object(value, 'profile', allowed, []);
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      const path = `profile.${key}`;
      if (['age', 'height', 'weight', 'calGoal'].includes(key)) {
        if (item === '') result[key] = '';
        else {
          if ((typeof item !== 'number' && typeof item !== 'string') || (typeof item === 'string' && !/^\d+(\.\d+)?$/.test(item))) fail(path, 'must be a number');
          number(Number(item), path);
          result[key] = item;
        }
      } else if (key === 'gender') result[key] = enumText(item, path, ['', 'Male', 'Female', 'Other']);
      else if (key === 'level') result[key] = enumText(item, path, ['', 'Beginner', 'Intermediate', 'Advanced']);
      else if (key === 'avatar') {
        text(item, path, 3000000);
        if (item && item !== 'assets/avatar.svg' && !/^data:image\/(png|apng|jpeg|pjpeg|jpg|gif|webp|bmp|x-ms-bmp|avif|x-icon|vnd\.microsoft\.icon);base64,[A-Za-z0-9+/]+={0,2}$/i.test(item)) fail(path, 'must be an embedded raster image');
        result[key] = item;
      } else result[key] = text(item, path);
    }
    return result;
  }

  window.validateFitPulseRecipeBackup = value => {
    if (value === undefined || value === null) return null;
    object(value, 'recipeData', ['saved', 'plans']);
    const available = Array.isArray(window.FitPulseRecipes) ? new Set(window.FitPulseRecipes.map(recipe => recipe.id)) : null;
    const recipeId = (value, path) => {
      id(value, path);
      if (available && !available.has(value)) fail(path, 'references an unknown recipe');
      return value;
    };
    if (!Array.isArray(value.saved) || value.saved.length > 10000) fail('recipeData.saved', 'must be a supported list');
    const saved = [...new Set(value.saved.map((entry, index) => recipeId(entry, `recipeData.saved[${index}]`)))];
    if (!isObject(value.plans) || Object.keys(value.plans).length > 10000) fail('recipeData.plans', 'must be a supported date map');
    let count = 0;
    const seen = new Set();
    const plans = Object.fromEntries(Object.entries(value.plans).map(([key, items]) => {
      const path = `recipeData.plans.${key}`;
      date(key, 'recipeData plan date');
      if (!Array.isArray(items) || (count += items.length) > 10000) fail(path, 'contains too many planned meals');
      return [key, items.map((item, index) => {
        const itemPath = `${path}[${index}]`;
        object(item, itemPath, ['uid', 'recipe', 'type', 'servings'], ['uid', 'recipe', 'type']);
        const uid = id(item.uid, `${itemPath}.uid`);
        if (seen.has(uid)) fail(itemPath, 'contains a duplicate planned meal ID');
        seen.add(uid);
        const clean = {uid, recipe:recipeId(item.recipe, `${itemPath}.recipe`), type:enumText(item.type, `${itemPath}.type`, ['Breakfast', 'Lunch', 'Dinner', 'Snacks'])};
        if (Object.hasOwn(item, 'servings')) {
          number(item.servings, `${itemPath}.servings`, 0.5);
          if (item.servings > 4) fail(`${itemPath}.servings`, 'must be between 0.5 and 4');
          clean.servings = item.servings;
        }
        return clean;
      })];
    }));
    return {saved, plans};
  };

  window.validateFitPulseBackup = parsed => {
    if (!isObject(parsed) || parsed.app !== 'FitPulse' || parsed.schemaVersion !== 1) throw new Error('This file is not a supported FitPulse backup (version 1).');
    const data = object(parsed.data, 'data', DATA_KEYS);
    const result = {};
    result.workouts = array(data.workouts, 'workouts', (item, path) => {
      object(item, path, ['id', 'name', 'category', 'duration', 'calories', 'date', 'notes']);
      return {id:id(item.id, path), name:text(item.name, `${path}.name`, 5000, false), category:enumText(item.category, `${path}.category`, ['Chest', 'Back', 'Legs', 'Cardio', 'Arms', 'Shoulders', 'Core']), duration:number(item.duration, `${path}.duration`, 1), calories:number(item.calories, `${path}.calories`), date:date(item.date, `${path}.date`), notes:text(item.notes, `${path}.notes`, 20000)};
    }, true);
    result.meals = array(data.meals, 'meals', (item, path) => {
      object(item, path, ['id', 'name', 'type', 'calories', 'protein', 'carbs', 'fat', 'date']);
      return {id:id(item.id, path), name:text(item.name, `${path}.name`, 5000, false), type:enumText(item.type, `${path}.type`, ['Breakfast', 'Lunch', 'Dinner', 'Snacks']), calories:number(item.calories, `${path}.calories`), protein:number(item.protein, `${path}.protein`), carbs:number(item.carbs, `${path}.carbs`), fat:number(item.fat, `${path}.fat`), date:date(item.date, `${path}.date`)};
    }, true);
    result.goals = array(data.goals, 'goals', (item, path) => {
      object(item, path, ['id', 'title', 'target', 'current', 'unit', 'deadline', 'completed']);
      return {id:id(item.id, path), title:text(item.title, `${path}.title`, 5000, false), target:number(item.target, `${path}.target`, 1), current:number(item.current, `${path}.current`), unit:text(item.unit, `${path}.unit`), deadline:date(item.deadline, `${path}.deadline`, true), completed:boolean(item.completed, `${path}.completed`)};
    }, true);
    result.water = datedRecords(data.water, 'water', {amount:0, goal:1});
    result.activity = datedRecords(data.activity, 'activity', {steps:0, distance:0, minutes:0});
    result.favorites = array(data.favorites, 'favorites', id);
    result.profile = profile(data.profile);
    object(data.settings, 'settings', ['dark', 'notif', 'waterRem', 'workoutRem']);
    result.settings = Object.fromEntries(Object.entries(data.settings).map(([key, value]) => [key, boolean(value, `settings.${key}`)]));
    object(data.analytics, 'analytics', ['bmi']);
    result.analytics = {bmi:array(data.analytics.bmi, 'analytics.bmi', (item, path) => {
      object(item, path, ['date', 'bmi']);
      return {date:date(item.date, `${path}.date`), bmi:number(item.bmi, `${path}.bmi`, 0.01)};
    })};
    result.notifications = array(data.notifications, 'notifications', (item, path) => {
      object(item, path, ['id', 'msg', 'time']);
      return {id:id(item.id, path), msg:text(item.msg, `${path}.msg`, 10000), time:timestamp(item.time, `${path}.time`)};
    }, true);
    return result;
  };
})();
