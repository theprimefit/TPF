const test = require('node:test');
const assert = require('node:assert/strict');
const DB = require('../js/fooddb.js');
const I = require('../js/i18n.js');
I.setHindiNames(require('../js/foodnames.js'));
const P = require('../js/planner.js');

const base = {
  age: 30, sex: 'female', heightCm: 165, weightKg: 70, activity: 'light', goal: 'lose',
  diet: 'veg', cuisine: 'in', meals: 5, earlyDrink: true, allergies: [], conditions: [], dislikes: [],
  startDay: 'Monday',
};
const textOf = (item) => item.name.toLowerCase();
const allItems = (plan) => plan.days.flatMap((d) => d.meals.flatMap((m) => (m.meal ? m.meal.items : [])));

test('food database is well formed', () => {
  assert.ok(DB.FOODS.length >= 450, `only ${DB.FOODS.length} foods`);
  const names = new Set();
  for (const f of DB.FOODS) {
    assert.ok(!names.has(f.name), `duplicate ${f.name}`);
    names.add(f.name);
    assert.ok(['vegan', 'veg', 'egg', 'nonveg'].includes(f.diet), f.name);
    assert.ok(f.kcal >= 0 && f.p >= 0 && f.c >= 0 && f.f >= 0, f.name);
    // Energy from macros should be in the same ballpark as the stated kcal.
    const macroKcal = f.p * 4 + f.c * 4 + f.f * 9;
    if (f.kcal >= 60) assert.ok(Math.abs(macroKcal - f.kcal) / f.kcal < 0.35, `${f.name}: ${macroKcal} vs ${f.kcal}`);
  }
  for (const [, list] of DB.PRESETS) for (const n of list) assert.ok(names.has(n), `preset food missing: ${n}`);
});

test('more than 50,000 meal combinations', () => {
  const c = P.countCombinations(DB, { ...base, diet: 'nonveg', cuisine: 'mix', meals: 6 });
  assert.ok(c.total > 50000, String(c.total));
});

test('Mifflin–St Jeor BMR and deficit', () => {
  const t = P.computeTargets(base);
  assert.equal(t.bmr, 1420);
  assert.equal(t.calories, 1450);
  assert.equal(t.bmi, 25.7);
  assert.equal(t.bmiCategory, 'Obese');
});

test('custom calorie and protein targets override the calculation', () => {
  const t = P.computeTargets({ ...base, kcalTarget: 1600, proteinTarget: 110 });
  assert.equal(t.calories, 1600);
  assert.equal(t.protein, 110);
  const kcal = t.protein * 4 + t.carbs * 4 + t.fat * 9;
  assert.ok(Math.abs(kcal - 1600) < 15);
  const low = P.computeTargets({ ...base, kcalTarget: 900 });
  assert.ok(low.warnings.length > 0);
  const capped = P.computeTargets({ ...base, kcalTarget: 1200, proteinTarget: 200 });
  assert.equal(capped.protein, 120);
});

test('diet plans resolve goal and conditions', () => {
  const heavy = { ...base, weightKg: 75 };
  const lean = { ...base, weightKg: 55 };
  assert.equal(P.resolveProfile({ ...heavy, plan: 'diabetic' }).goal, 'lose');
  assert.equal(P.resolveProfile({ ...lean, plan: 'diabetic' }).goal, 'maintain');
  assert.deepEqual(P.resolveProfile({ ...lean, plan: 'diabetic' }).conditions, ['diabetes']);
  assert.equal(P.resolveProfile({ ...heavy, plan: 'pregnancy', weightGoal: 'lose' }).goal, 'pregnancy');
  assert.equal(P.resolveProfile({ ...lean, plan: 'kidney', weightGoal: 'gain' }).goal, 'maintain');
});

test('plans hit calorie targets and are deterministic', () => {
  const a = P.generatePlan(DB, base, 42);
  const b = P.generatePlan(DB, base, 42);
  assert.deepEqual(a.days, b.days);
  assert.equal(a.days.length, 7);
  for (const d of a.days) {
    const diff = Math.abs(d.totals.kcal - a.targets.calories) / a.targets.calories;
    assert.ok(diff < 0.15, `${d.day}: ${d.totals.kcal} vs ${a.targets.calories}`);
  }
});

test('protein target steers meal choice', () => {
  const normal = P.generatePlan(DB, { ...base, diet: 'nonveg' }, 5);
  const high = P.generatePlan(DB, { ...base, diet: 'nonveg', proteinTarget: 120 }, 5);
  const avg = (pl) => pl.days.reduce((s, d) => s + d.totals.p, 0) / 7;
  assert.ok(avg(high) > avg(normal), `${avg(high)} <= ${avg(normal)}`);
  assert.ok(avg(high) >= 100, `high-protein plan averages ${avg(high)} g`);
});

test('days are named only (no dates) and follow the start day', () => {
  const plan = P.generatePlan(DB, { ...base, startDay: 'Friday' }, 1);
  assert.deepEqual(plan.days.map((d) => d.day), ['Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']);
  assert.ok(plan.days.every((d) => !('date' in d)));
});

test('preferred foods appear more often', () => {
  const count = (pl) => pl.days.flatMap((d) => d.meals.flatMap((m) => m.meal.items)).filter((i) => /paneer/i.test(i.name)).length;
  let normal = 0, liked = 0;
  for (const seed of [1, 2, 3]) {
    normal += count(P.generatePlan(DB, base, seed));
    liked += count(P.generatePlan(DB, { ...base, likes: ['paneer'] }, seed));
  }
  assert.ok(liked > normal * 1.5, `${liked} vs ${normal}`);
});

test('search: Hindi names, categories, calorie limit and sorting', () => {
  assert.ok(P.searchFoods(DB.FOODS, 'पनीर').some((f) => f.name === 'Palak paneer'));
  const fruits = P.searchFoods(DB.FOODS, '', { category: 'fruits', sort: 'kcal' });
  assert.ok(fruits.length >= 40 && fruits.every((f) => f.roles.includes('fruit')));
  for (let i = 1; i < fruits.length; i++) assert.ok(fruits[i].kcal >= fruits[i - 1].kcal);
  assert.ok(P.searchFoods(DB.FOODS, '', { maxKcal: 100 }).every((f) => f.kcal <= 100));
  const byProtein = P.searchFoods(DB.FOODS, 'chicken', { sort: 'protein' });
  assert.ok(byProtein[0].p >= byProtein[byProtein.length - 1].p);
});

test('filters: diet, allergies, conditions, exclusions, dislikes', () => {
  const p = { ...base, diet: 'vegan', allergies: ['nuts'], conditions: ['diabetes'], excludes: ['rice', 'wheat'], dislikes: ['rajma'] };
  const plan = P.generatePlan(DB, p, 9);
  for (const it of allItems(plan)) {
    const f = DB.FOODS[it.fid];
    assert.equal(f.diet, 'vegan', f.name);
    assert.ok(!f.allergens.includes('nuts') && !f.allergens.includes('gluten'), f.name);
    assert.ok(!f.flags.includes('hgi'), f.name);
    assert.ok(!/rice|rajma|idli|dosa/.test(textOf(f)), f.name);
  }
});

test('Jain, pregnancy and kidney rules', () => {
  const jain = P.generatePlan(DB, { ...base, diet: 'jain', cuisine: 'mix' }, 3);
  for (const it of allItems(jain)) assert.ok(!/potato|aloo|onion|garlic|ginger|carrot|mushroom/.test(textOf(it)), it.name);
  const preg = P.generatePlan(DB, { ...base, plan: 'pregnancy' }, 3);
  assert.ok(preg.targets.calories > preg.targets.tdee);
  for (const it of allItems(preg)) assert.ok(!/papaya|sushi/.test(textOf(it)), it.name);
  const kid = P.generatePlan(DB, { ...base, plan: 'kidney', cuisine: 'mix' }, 3);
  for (const it of allItems(kid)) {
    const f = DB.FOODS[it.fid];
    assert.ok(!f.flags.includes('hk') && !f.flags.includes('hna'), f.name);
  }
});

test('travel charts use travel-friendly foods', () => {
  const plan = P.generatePlan(DB, { ...base, travel: 'train', diet: 'nonveg' }, 4);
  for (const d of plan.days) for (const m of d.meals) assert.ok(m.meal && m.meal.items.length, `${d.day} ${m.slot}`);
  for (const it of allItems(plan)) {
    const f = DB.FOODS[it.fid];
    const ok = f.flags.includes('tr') || f.roles.some((r) => ['early', 'bed', 'side', 'bfside'].includes(r));
    assert.ok(ok, f.name);
  }
});

test('worldwide cuisine uses worldwide dishes for main meals', () => {
  const plan = P.generatePlan(DB, { ...base, regions: ['MED', 'ASIA'], diet: 'nonveg' }, 8);
  for (const d of plan.days) {
    const lunch = d.meals.find((m) => m.slot === 'lunch');
    const mains = lunch.meal.items.map((i) => DB.FOODS[i.fid]).filter((f) => f.roles.some((r) => ['grain', 'dal', 'protein', 'sabzi'].includes(r)) && !f.roles.some((r) => r.startsWith('w')));
    assert.equal(mains.length, 0, `${d.day}: ${lunch.meal.items.map((i) => i.name)}`);
  }
});

test('every plan and food type fills all meals', () => {
  for (const plan of Object.keys(P.PLANS)) {
    for (const diet of Object.keys(P.DIETS)) {
      const week = P.generatePlan(DB, { ...base, plan, diet, meals: 6 }, 3);
      for (const d of week.days) for (const e of d.meals) assert.ok(e.meal && e.meal.items.length, `${plan}/${diet}/${d.day}/${e.slot}`);
    }
  }
});

test('manual editing: quantities, custom foods, copy, lock and blank charts', () => {
  const plan = P.generatePlan(DB, base, 11);
  const entry = plan.days[0].meals[1];
  const item = entry.meal.items[0];
  const before = item.kcal;
  P.setItemQty(item, item.qty * 2);
  assert.ok(Math.abs(item.kcal - before * 2) <= 1);
  entry.meal.items.push(P.customItem('Homemade ladoo', 1, 'pc', 150, 3));
  P.recalcMeal(entry.meal);
  entry.locked = true;
  P.copyMeal(plan, 0, 1, [1, 2]);
  assert.deepEqual(plan.days[1].meals[1].meal, entry.meal);
  assert.ok(plan.days[2].meals[1].locked);

  const again = P.generatePlan(DB, base, 99, { previous: plan });
  assert.deepEqual(again.days[0].meals[1].meal, entry.meal);

  const blank = P.generatePlan(DB, base, 1, { blank: true });
  assert.equal(blank.days[0].totals.kcal, 0);
  assert.equal(blank.days[3].meals[2].meal.items.length, 0);
});

test('swap and search', () => {
  const plan = P.generatePlan(DB, base, 7);
  const before = plan.days[0].meals[3].meal.items.map((i) => i.fid).join();
  assert.ok(P.swapMeal(DB, base, plan, 0, 3, P.rng(2)));
  assert.notEqual(plan.days[0].meals[3].meal.items.map((i) => i.fid).join(), before);
  const dosa = P.searchFoods(DB.FOODS, 'dosa');
  assert.ok(dosa.length >= 5);
  const wl = P.searchFoods(DB.FOODS, '', { wl: true, world: true });
  assert.ok(wl.length > 10 && wl.every((f) => f.flags.includes('wl')));
});

test('portions round to kitchen-friendly quantities', () => {
  const poha = DB.FOODS.find((f) => f.name === 'Vegetable poha');
  const meal = P.composeMeal([poha], poha.kcal * 1.5, true);
  assert.equal(meal.factor, 1.5);
  assert.equal(meal.items[0].text, '1½ cups');
  assert.equal(P.formatQty(0.75), '¾');
});

test('every food has a Hindi name and every chart language renders', () => {
  for (const f of DB.FOODS) assert.ok(f.hi, `no Hindi name: ${f.name}`);
  const plan = P.generatePlan(DB, { ...base, plan: 'diabetic', conditions: ['thyroid'], excludes: ['rice'], diet: 'nonveg' }, 5);
  const scriptOf = { hi: /[\u0900-\u097f]/, mr: /[\u0900-\u097f]/, gu: /[\u0a80-\u0aff]/, bn: /[\u0980-\u09ff]/, pa: /[\u0a00-\u0a7f]/, ta: /[\u0b80-\u0bff]/, te: /[\u0c00-\u0c7f]/, kn: /[\u0c80-\u0cff]/, ml: /[\u0d00-\u0d7f]/ };
  for (const lang of I.CODES.filter((l) => l !== 'en')) {
    const texts = [
      I.t(lang, 'title'), I.dayName(lang, 'Monday'), I.label(lang, 'slots', 'lunch'), I.label(lang, 'plans', 'diabetic'),
      ...plan.days[0].meals.flatMap((m) => m.meal.items.map((i) => I.foodName(lang, i.name))),
      ...P.tips({ ...base, plan: 'diabetic' }, plan.targets).map((t) => I.tipText(lang, t)),
      ...P.avoidList({ ...base, excludes: ['rice'] }).map((a) => I.avoidText(lang, a)),
    ];
    for (const s of texts) {
      assert.ok(s && !/undefined|\{\w+\}/.test(s), `${lang}: ${s}`);
      assert.ok(scriptOf[lang].test(s), `${lang} not in its script: ${s}`);
    }
    // No stray Devanagari left after converting to another script.
    if (!['hi', 'mr'].includes(lang)) for (const s of texts) assert.ok(!/[\u0900-\u0963\u0966-\u097f]/.test(s), `${lang} has Devanagari: ${s}`);
  }
});

test('transliteration handles silent vowels and local words', () => {
  assert.equal(I.foodName('te', 'Rajma'), 'రాజ్మా');
  assert.equal(I.foodName('ta', 'Curd rice'), 'தயிர் சாதம்');
  assert.equal(I.foodName('gu', 'Moong dal'), 'મૂંગ દાળ');
  assert.equal(I.foodName('pa', 'Paneer tikka'), 'ਪਨੀਰ ਟਿੱਕਾ');
  assert.equal(I.foodName('en', 'Rajma'), 'Rajma');
  assert.equal(I.foodName('hi', 'My own food', true), 'My own food');
});

// ── v5 ──────────────────────────────────────────────────────────
const RC = require('../js/recipes.js');
const ING = require('../js/ingredients.js');

test('every dish has a recipe whose ingredients give its nutrition and diet', () => {
  const dishes = DB.FOODS.filter((f) => !f.ingKey);
  assert.ok(dishes.length >= 650);
  for (const f of dishes) {
    assert.ok(f.recipe && f.recipe.ing.length, `no recipe: ${f.name}`);
    const n = RC.analyse(f.recipe.ing, ING);
    assert.equal(f.kcal, n.kcal, f.name);
    assert.equal(f.p, n.p, f.name);
    const rank = { vegan: 0, veg: 1, egg: 2, nonveg: 3 };
    assert.ok(rank[n.diet] <= rank[f.diet], `${f.name} is ${f.diet} but its recipe is ${n.diet}`);
    assert.ok(RC.steps(f.recipe, ING).length >= 2, f.name);
  }
  assert.ok(DB.FOODS.filter((f) => f.ingKey).length >= 150, 'ingredients are searchable');
});

test('age, sex, height and weight are optional', () => {
  const t = P.computeTargets({ activity: 'light', plan: 'weight_loss', diet: 'veg' });
  assert.equal(t.bmi, null);
  assert.ok(t.calories >= 1200 && t.protein > 0 && t.waterL >= 2);
  const plan = P.generatePlan(DB, { plan: 'diabetic', diet: 'veg', meals: 5 }, 3);
  assert.equal(plan.days.length, 7);
  assert.ok(plan.days.every((d) => d.totals.kcal > 0));
});

test('number of days, water override', () => {
  const one = P.generatePlan(DB, { ...base, days: 1, startDay: 'Friday' }, 4);
  assert.deepEqual(one.days.map((d) => d.day), ['Friday']);
  assert.equal(P.generatePlan(DB, { ...base, days: 3 }, 4).days.length, 3);
  assert.equal(P.computeTargets({ ...base, waterL: 3.2 }).waterL, 3.2);
});

test('diet combinations include only the chosen animal foods', () => {
  const cases = [[['egg'], ['egg']], [['fish'], ['fish']], [['egg', 'chicken'], ['egg', 'chicken']]];
  for (const [mix, allowed] of cases) {
    const plan = P.generatePlan(DB, { ...base, diet: 'veg', mix, cuisine: 'mix' }, 11);
    const foods = allItems(plan).map((i) => DB.FOODS[i.fid]);
    for (const f of foods) {
      if (f.diet === 'egg') assert.ok(allowed.includes('egg'), `${mix}: ${f.name}`);
      if (f.diet === 'nonveg') assert.ok(f.meats.every((m) => allowed.includes(m)), `${mix}: ${f.name}`);
    }
    assert.ok(foods.some((f) => f.diet === 'egg' || f.diet === 'nonveg'), `${mix} has no egg/non-veg dish`);
  }
});

test('with a disease, no food from the avoid list is added', () => {
  for (const cond of Object.keys(P.CONDITIONS)) {
    const plan = P.generatePlan(DB, { ...base, diet: 'nonveg', cuisine: 'mix', conditions: [cond] }, 21);
    const bans = new Set([...P.CONDITION_BANS.any.ing, ...(P.CONDITION_BANS[cond] ? P.CONDITION_BANS[cond].ing : [])]);
    for (const i of allItems(plan)) {
      const f = DB.FOODS[i.fid];
      assert.ok(!f.flags.includes('fried') && !f.flags.includes('sweet'), `${cond}: ${f.name}`);
      assert.ok(!f.recipe.ing.some(([k]) => bans.has(k)), `${cond}: ${f.name}`);
    }
    assert.ok(plan.days.every((d) => d.meals.every((m) => m.meal && m.meal.items.length)), cond);
  }
});

test('next week changes the foods of the previous chart', () => {
  const week1 = P.generatePlan(DB, base, 5);
  const week2 = P.generatePlan(DB, base, 6, { avoidPrevious: week1 });
  assert.ok(P.overlap(week2, week1, DB) < 0.1, String(P.overlap(week2, week1, DB)));
  const byNames = P.generatePlan(DB, base, 6, { avoidPrevious: allItems(week1).map((i) => i.name) });
  assert.ok(P.overlap(byNames, week1, DB) < 0.1);
});

const S = require('../js/store.js');

test('patients and charts are saved, and a chart round-trips through storage', () => {
  const store = S.createStore(S.memoryStorage(), P, DB);
  const profile = { ...base, name: 'Asha Rao', phone: '98200', plan: 'weight_loss', days: 5 };
  const plan = P.generatePlan(DB, profile, 3);
  plan.days[0].meals[1].meal.items.push(P.customItem('Home-made ladoo', 1, 'pc', 120, 3));
  P.recalcMeal(plan.days[0].meals[1].meal);
  P.refreshDay(plan.days[0]);
  const rec = store.saveChart({ profile, plan, week: 1 });
  assert.ok(rec.patientRef);
  assert.equal(store.listPatients().length, 1);
  const again = store.saveChart({ profile: { ...profile }, plan, week: 2, parent: rec.id });
  assert.equal(store.listPatients().length, 1, 'same patient is not saved twice');
  assert.equal(store.listCharts(rec.patientRef).length, 2);
  const back = store.loadChart(rec.id);
  assert.equal(back.plan.days.length, 5);
  assert.deepEqual(back.plan.days.map((d) => d.totals.kcal), plan.days.map((d) => d.totals.kcal));
  assert.ok(back.plan.days[0].meals[1].meal.items.some((i) => i.custom && i.kcal === 120));
  const backup = store.exportAll();
  const other = S.createStore(S.memoryStorage(), P, DB);
  assert.deepEqual(other.importAll(backup), { patients: 1, charts: 2 });
  store.deletePatient(rec.patientRef, true);
  assert.equal(store.listCharts().length, 0);
  assert.ok(again.id);
});

test('a previous chart is read back from PDF text', () => {
  const store = S.createStore(S.memoryStorage(), P, DB);
  const profile = { ...base, name: 'रवि', diet: 'nonveg', chartLang: 'hi' };
  const plan = P.generatePlan(DB, profile, 8);
  const payload = store.pdfPayload(profile, plan, 2);
  // PDF text extraction breaks lines and adds spaces.
  const text = 'Diet chart … ' + payload.replace(/(.{70})/g, '$1\n ') + ' Page 2 / 2';
  const r = store.readPdfText(text, I);
  assert.equal(r.exact, true);
  assert.equal(r.week, 2);
  assert.equal(r.profile.name, 'रवि');
  assert.deepEqual(r.plan.days.map((d) => d.totals.kcal), plan.days.map((d) => d.totals.kcal));
  // Without hidden data, foods are found by name in any chart language.
  const names = allItems(plan).slice(0, 12).map((i) => i.name);
  const printed = names.map((n) => I.foodName('hi', n)).join(' · ');
  const f = store.readPdfText(printed, I);
  assert.equal(f.exact, false);
  for (const n of names) assert.ok(f.foods.includes(n), n);
});
