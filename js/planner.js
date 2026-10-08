/*
 * Diet planning logic for Hindivine Diet: energy targets, food filtering,
 * meal composition from the food database, weekly plans and manual edits.
 * Pure functions with no DOM access, so they run in the browser and under Node tests.
 */
(function (root) {
  const ACTIVITY = {
    sedentary: { factor: 1.2, label: 'Sedentary (desk job)' },
    light: { factor: 1.375, label: 'Lightly active (1–3 days/week)' },
    moderate: { factor: 1.55, label: 'Moderately active (3–5 days/week)' },
    active: { factor: 1.725, label: 'Very active (6–7 days/week)' },
    athlete: { factor: 1.9, label: 'Athlete / physical job' },
  };

  const GOALS = {
    lose: { delta: -500, proteinPerKg: 1.4, label: 'Weight loss' },
    maintain: { delta: 0, proteinPerKg: 1.0, label: 'Maintain weight' },
    gain: { delta: 350, proteinPerKg: 1.2, label: 'Weight gain' },
    muscle: { delta: 250, proteinPerKg: 1.8, label: 'Muscle gain' },
    pregnancy: { delta: 350, proteinPerKg: 1.2, label: 'Pregnancy' },
    lactation: { delta: 500, proteinPerKg: 1.3, label: 'Lactation' },
  };

  /*
   * Diet plan types. `goal: 'auto'` means weight loss when BMI is 23 or more
   * (Asian-Indian overweight cut-off), otherwise maintenance.
   */
  const PLANS = {
    weight_loss: { label: 'Weight loss diet', goal: 'lose' },
    weight_gain: { label: 'Weight gain diet', goal: 'gain' },
    balanced: { label: 'Balanced / healthy diet', goal: 'maintain' },
    high_protein: { label: 'High-protein / muscle gain diet', goal: 'muscle' },
    diabetic: { label: 'Diabetic diet', goal: 'auto', condition: 'diabetes' },
    pcos: { label: 'PCOS / PCOD diet', goal: 'auto', condition: 'pcos' },
    thyroid: { label: 'Thyroid diet', goal: 'auto', condition: 'thyroid' },
    bp: { label: 'High BP (DASH, low-salt) diet', goal: 'auto', condition: 'hypertension' },
    heart: { label: 'Heart-healthy / cholesterol diet', goal: 'auto', condition: 'cholesterol' },
    fatty_liver: { label: 'Fatty liver diet', goal: 'auto', condition: 'fattyliver' },
    kidney: { label: 'Kidney (renal) diet', goal: 'maintain', condition: 'kidney' },
    pregnancy: { label: 'Pregnancy diet (2nd–3rd trimester)', goal: 'pregnancy', femaleOnly: true },
    lactation: { label: 'Lactation (breastfeeding) diet', goal: 'lactation', femaleOnly: true },
  };

  const CONDITIONS = {
    diabetes: 'Diabetes',
    hypertension: 'High BP',
    pcos: 'PCOS / PCOD',
    thyroid: 'Thyroid',
    cholesterol: 'High cholesterol',
    fattyliver: 'Fatty liver',
    kidney: 'Kidney disease',
  };

  const DIETS = { veg: 'Vegetarian', jain: 'Jain', egg: 'Eggetarian', nonveg: 'Non-vegetarian', vegan: 'Vegan' };
  const DIET_RANK = { vegan: 0, veg: 1, jain: 1, egg: 2, nonveg: 3 };

  const REGIONS = {
    N: { label: 'North Indian', indian: true },
    S: { label: 'South Indian', indian: true },
    W: { label: 'Gujarati & Marathi', indian: true },
    E: { label: 'Bengali & East', indian: true },
    CON: { label: 'Continental', indian: false },
    MED: { label: 'Mediterranean', indian: false },
    ASIA: { label: 'Asian', indian: false },
    MEX: { label: 'Mexican', indian: false },
  };
  const INDIAN_REGIONS = ['N', 'S', 'W', 'E'];
  const WORLD_REGIONS = ['CON', 'MED', 'ASIA', 'MEX'];
  // Roles whose region follows the cuisine preference; others (fruit, drinks…) suit everyone.
  const REGIONAL_ROLES = ['bf', 'wbf', 'grain', 'dal', 'protein', 'sabzi', 'wprotein', 'wcarb', 'wveg', 'wmain', 'tmain'];

  /** Quick food exclusions, matched against food names (and allergens/flags where noted). */
  const EXCLUDES = {
    rice: { label: 'Rice', words: ['rice', 'pulao', 'biryani', 'khichdi', 'idli', 'dosa', 'appam', 'idiyappam', 'puttu', 'uttapam', 'bath', 'poha', 'chuda', 'congee', 'sushi', 'pongal', 'neer', 'adai', 'thali'] },
    wheat: { label: 'Wheat / roti', allergen: 'gluten' },
    dairy: { label: 'Milk & dairy', allergen: 'dairy' },
    paneer: { label: 'Paneer', words: ['paneer', 'halloumi', 'cottage cheese'] },
    sugar: { label: 'Sweet items', flag: 'sweet' },
    fried: { label: 'Fried / oily', flag: 'fried', words: ['paratha', 'pakoda', 'bhature', 'puri'] },
    potato: { label: 'Potato', words: ['potato', 'aloo'] },
    onion: { label: 'Onion & garlic', words: ['onion', 'garlic'] },
    brinjal: { label: 'Brinjal', words: ['baingan', 'brinjal', 'baba ganoush', 'ratatouille'] },
    mushroom: { label: 'Mushroom', words: ['mushroom'] },
    soy: { label: 'Soy / tofu', allergen: 'soy' },
    egg: { label: 'Egg', allergen: 'egg' },
    seafood: { label: 'Fish & seafood', allergen: 'fish' },
    redmeat: { label: 'Mutton / red meat', words: ['mutton', 'lamb', 'keema'] },
    caffeine: { label: 'Tea & coffee', flag: 'caf' },
    nuts: { label: 'Nuts & peanuts', allergen: 'nuts' },
  };

  /*
   * With any health condition the chart must not contain the foods its "avoid"
   * list names, so dishes are also checked against their recipe ingredients.
   */
  const CONDITION_BANS = {
    any: { flags: ['fried', 'sweet'], ing: ['maida', 'sugar'] },
    diabetes: { ing: ['jaggery', 'honey'] },
    pcos: { ing: ['jaggery', 'honey'] },
    fattyliver: { ing: ['jaggery', 'honey', 'butter', 'cream'] },
    hypertension: { ing: ['papad', 'soysauce', 'miso'] },
    kidney: { ing: ['papad', 'soysauce', 'miso'] },
    cholesterol: { ing: ['butter', 'cream'] },
  };

  /** Diet combinations: which of egg / chicken / fish / mutton a mixed diet includes. */
  const MIXES = {
    veg_egg: { label: 'Veg + Egg', mix: ['egg'] },
    egg_nonveg: { label: 'Egg + Non-veg', mix: ['egg', 'chicken', 'fish', 'mutton'] },
    veg_chicken: { label: 'Veg + Chicken', mix: ['chicken'] },
    veg_fish: { label: 'Veg + Fish', mix: ['fish'] },
    egg_chicken: { label: 'Egg + Chicken', mix: ['egg', 'chicken'] },
    egg_fish: { label: 'Egg + Fish', mix: ['egg', 'fish'] },
    chicken_fish: { label: 'Chicken + Fish', mix: ['chicken', 'fish'] },
  };
  const MIX_ITEMS = ['egg', 'chicken', 'fish', 'mutton'];

  /** The effective diet and allowed animal foods for a profile (`mix` narrows non-veg). */
  function dietOf(p) {
    const mix = (p.mix || []).filter((x) => MIX_ITEMS.includes(x));
    if (!mix.length) return { diet: p.diet || 'veg', mix: null };
    const diet = mix.some((x) => x !== 'egg') ? 'nonveg' : 'egg';
    return { diet, mix: new Set(mix) };
  }

  const JAIN_AVOID = ['potato', 'aloo', 'onion', 'garlic', 'ginger', 'carrot', 'beetroot', 'radish', 'mooli', 'sweet potato', 'arbi', 'yam', 'mushroom', 'sabudana'];
  const PREGNANCY_AVOID = ['papaya', 'sushi', 'tuna'];

  const TRAVEL = {
    mixed: 'Travel (mixed)',
    train: 'Train journey',
    flight: 'Flight / airport',
    road: 'Road trip / dhaba',
    hotel: 'Hotel stay',
  };

  const SLOTS = {
    early: { label: 'Early morning', time: '06:30', scalable: false },
    breakfast: { label: 'Breakfast', time: '08:00', scalable: true },
    midmorning: { label: 'Mid-morning', time: '11:00', scalable: true },
    lunch: { label: 'Lunch', time: '13:30', scalable: true },
    evening: { label: 'Evening snack', time: '17:00', scalable: true },
    dinner: { label: 'Dinner', time: '20:00', scalable: true },
    bedtime: { label: 'Bedtime', time: '22:00', scalable: false },
  };

  // Share of daily calories per slot, by number of main meals/snacks.
  const SPLITS = {
    3: { breakfast: 0.30, lunch: 0.40, dinner: 0.30 },
    4: { breakfast: 0.25, lunch: 0.35, evening: 0.12, dinner: 0.28 },
    5: { breakfast: 0.22, midmorning: 0.10, lunch: 0.33, evening: 0.10, dinner: 0.25 },
    6: { breakfast: 0.22, midmorning: 0.10, lunch: 0.30, evening: 0.10, dinner: 0.23, bedtime: 0.05 },
  };
  const EARLY_SHARE = 0.03;
  const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  /** Food-library categories used by search. */
  const CATEGORIES = {
    breakfast: { label: 'Breakfast', roles: ['bf', 'wbf', 'bfside'] },
    grains: { label: 'Roti, rice & grains', roles: ['grain', 'wcarb'] },
    dal: { label: 'Dal, curry & protein', roles: ['dal', 'protein', 'wprotein'] },
    sabzi: { label: 'Sabzi & salad', roles: ['sabzi', 'side', 'wveg'] },
    snacks: { label: 'Snacks & soups', roles: ['snack', 'soup'] },
    fruits: { label: 'Fruits', roles: ['fruit'] },
    drinks: { label: 'Drinks', roles: ['drink', 'early', 'earlyadd', 'bed'] },
    meals: { label: 'Complete meals', roles: ['wmain', 'tmain'] },
    ingredients: { label: 'Ingredients (per 100 g)', roles: ['ingredient'] },
  };

  const UNIT_STEP = { pc: 0.5, egg: 1, slice: 0.5, g: 10, ml: 25, cup: 0.25, katori: 0.25, bowl: 0.25, glass: 0.25, tbsp: 0.5, tsp: 0.5, plate: 0.25, scoop: 0.5 };
  const UNIT_PLURAL = { pc: 'pcs', egg: 'eggs', slice: 'slices', cup: 'cups', katori: 'katoris', bowl: 'bowls', glass: 'glasses', plate: 'plates', scoop: 'scoops' };

  function round(x, step) { return Math.round(x / step) * step; }
  const r1 = (x) => Math.round(x * 10) / 10;

  // ── Targets ──────────────────────────────────────────────────────
  function bmiCategory(bmi) {
    if (bmi < 18.5) return 'Underweight';
    if (bmi < 23) return 'Normal';
    if (bmi < 25) return 'Overweight';
    return 'Obese';
  }

  const num = (x) => (Number(x) > 0 ? Number(x) : null);

  /** BMI, or null when height or weight is not given. */
  function bmiOf(p) {
    const w = num(p.weightKg), h = num(p.heightCm);
    if (!w || !h) return null;
    return w / ((h / 100) * (h / 100));
  }

  // Used when weight / height / age are not given (they are optional).
  const DEFAULT_KCAL = { lose: 1400, maintain: 1700, gain: 2100, muscle: 2000, pregnancy: 2100, lactation: 2200 };
  const DEFAULT_PROTEIN = { lose: 60, maintain: 55, gain: 65, muscle: 90, pregnancy: 70, lactation: 75 };

  /** Fill in `goal` and `conditions` from the chosen diet plan and weight goal. */
  function resolveProfile(p) {
    const plan = PLANS[p.plan];
    const conditions = [...new Set([...(p.conditions || []), ...(plan && plan.condition ? [plan.condition] : [])])];
    let goal = p.goal;
    if (plan) {
      goal = plan.goal;
      const fixed = goal === 'pregnancy' || goal === 'lactation';
      if (!fixed && p.weightGoal && p.weightGoal !== 'plan') goal = p.weightGoal;
      if (goal === 'auto') goal = (bmiOf(p) || 0) >= 23 ? 'lose' : 'maintain';
    }
    if (!GOALS[goal]) goal = 'maintain';
    if (conditions.includes('kidney') && (goal === 'muscle' || goal === 'gain')) goal = 'maintain';
    return { ...p, goal, conditions };
  }

  /** Energy, macro and hydration targets. `kcalTarget` / `proteinTarget` override the calculation. */
  function computeTargets(input) {
    const p = resolveProfile(input);
    const w = num(p.weightKg), h = num(p.heightCm), age = num(p.age);
    const hM = h ? h / 100 : null;
    const bmi = bmiOf(p);
    const sexAdj = p.sex === 'male' ? 5 : p.sex === 'female' ? -161 : -78;
    const factor = ACTIVITY[p.activity || 'light'].factor;
    const goal = GOALS[p.goal];
    const warnings = [];
    // Mifflin–St Jeor needs weight, height and age; with weight only, a per-kg estimate.
    let bmr = null;
    if (w && h && age) bmr = 10 * w + 6.25 * h - 5 * age + sexAdj;
    else if (w) bmr = w * (p.sex === 'male' ? 24 : 22);
    const tdee = bmr ? bmr * factor : null;

    const floor = p.sex === 'male' ? 1500 : 1200;
    let calories;
    if (tdee) {
      calories = Math.max(floor, round(tdee + goal.delta, 50));
      if (p.goal === 'lose') calories = Math.min(calories, round(tdee, 50));
    } else {
      calories = DEFAULT_KCAL[p.goal] + (p.sex === 'male' ? 300 : 0) + round((factor - 1.375) * 1000, 50);
    }
    const customKcal = Number(p.kcalTarget) > 0;
    if (customKcal) {
      calories = Math.round(Number(p.kcalTarget));
      if (calories < floor) warnings.push(`${calories} kcal is below the usual safe minimum of ${floor} kcal — use only under supervision.`);
    }

    const refWeight = w ? (bmi && bmi > 30 ? 25 * hM * hM : w) : null;
    const c = p.conditions;
    const kidney = c.includes('kidney');
    let protein = refWeight ? refWeight * (kidney ? 0.8 : goal.proteinPerKg) : (kidney ? 45 : DEFAULT_PROTEIN[p.goal]);
    protein = Math.min(protein, (calories * 0.35) / 4);
    const customProtein = Number(p.proteinTarget) > 0;
    if (customProtein) {
      protein = Number(p.proteinTarget);
      const cap = (calories * 0.4) / 4;
      if (protein > cap) {
        warnings.push(`${Math.round(protein)} g protein is more than 40% of ${calories} kcal; capped at ${Math.round(cap)} g.`);
        protein = cap;
      }
      if (kidney && refWeight && protein > refWeight * 0.8) warnings.push('Kidney disease: protein above 0.8 g/kg needs your nephrologist\'s approval.');
    }

    const lowCarb = c.some((x) => x === 'diabetes' || x === 'pcos' || x === 'fattyliver');
    const lowFat = c.some((x) => x === 'cholesterol' || x === 'fattyliver');
    const fatPct = lowFat ? 0.25 : lowCarb ? 0.32 : 0.28;
    const fat = (calories * fatPct) / 9;
    const carbs = Math.max(0, (calories - protein * 4 - fat * 9) / 4);

    let waterL = w ? round((w * 35) / 1000, 0.25) : 2.5;
    if (p.activity === 'active' || p.activity === 'athlete') waterL += 0.5;
    if (p.goal === 'pregnancy') waterL += 0.25;
    if (p.goal === 'lactation') waterL += 0.75;
    waterL = Math.min(Math.max(waterL, 2), 4.5);
    const customWater = Number(p.waterL) > 0;
    if (customWater) waterL = r1(Number(p.waterL));

    return {
      goal: p.goal,
      bmi: bmi ? r1(bmi) : null,
      bmiCategory: bmi ? bmiCategory(bmi) : '',
      bmr: bmr ? Math.round(bmr) : null,
      tdee: tdee ? Math.round(tdee) : null,
      calories,
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fat: Math.round(fat),
      fibre: Math.round((calories / 1000) * 14),
      waterL,
      idealWeight: hM ? [Math.round(18.5 * hM * hM), Math.round(22.9 * hM * hM)] : null,
      customKcal,
      customProtein,
      customWater,
      estimated: !(w && h && age),
      warnings,
    };
  }

  /** Calorie target per meal slot, in serving order. */
  function slotTargets(calories, meals, earlyDrink) {
    const split = SPLITS[meals];
    const scale = earlyDrink ? 1 - EARLY_SHARE : 1;
    const out = [];
    if (earlyDrink) out.push({ slot: 'early', kcal: calories * EARLY_SHARE, share: EARLY_SHARE });
    Object.keys(SLOTS).forEach((slot) => {
      if (split[slot]) out.push({ slot, kcal: calories * split[slot] * scale, share: split[slot] * scale });
    });
    return out;
  }

  // ── Filtering ────────────────────────────────────────────────────
  function foodText(f) { return f.name.toLowerCase(); }

  /** Build a predicate that says whether a food suits this profile. */
  function foodFilter(input) {
    const p = resolveProfile(input);
    const { diet, mix } = dietOf(p);
    const rank = DIET_RANK[diet];
    const allergies = new Set(p.allergies || []);
    const c = p.conditions;
    const avoidFlags = new Set();
    if (c.some((x) => x === 'diabetes' || x === 'pcos' || x === 'fattyliver')) { avoidFlags.add('hgi'); avoidFlags.add('sweet'); }
    if (c.some((x) => x === 'hypertension' || x === 'kidney')) avoidFlags.add('hna');
    if (c.includes('kidney')) avoidFlags.add('hk');
    if (c.some((x) => x === 'cholesterol' || x === 'fattyliver')) { avoidFlags.add('fried'); avoidFlags.add('hsf'); }
    const banIng = new Set();
    if (c.length) {
      [CONDITION_BANS.any, ...c.map((x) => CONDITION_BANS[x])].forEach((b) => {
        if (!b) return;
        (b.flags || []).forEach((x) => avoidFlags.add(x));
        (b.ing || []).forEach((x) => banIng.add(x));
      });
    }
    const words = (p.dislikes || []).map((d) => d.toLowerCase().trim()).filter(Boolean);
    if (diet === 'jain') words.push(...JAIN_AVOID);
    if (p.goal === 'pregnancy') words.push(...PREGNANCY_AVOID);
    (p.excludes || []).forEach((key) => {
      const ex = EXCLUDES[key];
      if (!ex) return;
      if (ex.words) words.push(...ex.words);
      if (ex.allergen) allergies.add(ex.allergen);
      if (ex.flag) avoidFlags.add(ex.flag);
    });
    const travel = !!p.travel;

    return function (f) {
      if (DIET_RANK[f.diet] > rank) return false;
      if (mix) {
        if (f.diet === 'egg' && !mix.has('egg')) return false;
        if (f.diet === 'nonveg' && !(f.meats || ['chicken']).every((m) => mix.has(m))) return false;
      }
      if (banIng.size && f.recipe && f.recipe.ing.some(([k]) => banIng.has(k))) return false;
      if (banIng.size && f.ingKey && banIng.has(f.ingKey)) return false;
      if (f.allergens.some((a) => allergies.has(a))) return false;
      if (f.flags.some((x) => avoidFlags.has(x))) return false;
      if (travel && !f.flags.includes('tr') && !f.roles.some((r) => r === 'early' || r === 'bed' || r === 'side' || r === 'bfside')) return false;
      const text = foodText(f);
      if (words.some((w) => text.includes(w))) return false;
      return true;
    };
  }

  function selectedRegions(p) {
    const list = (p.regions || []).filter((r) => REGIONS[r]);
    if (list.length) return list;
    if (p.cuisine === 'world') return WORLD_REGIONS;
    if (p.cuisine === 'mix') return [...INDIAN_REGIONS, ...WORLD_REGIONS];
    return INDIAN_REGIONS;
  }

  /** Foods grouped by role after filtering. */
  function buildPools(foods, input) {
    const allowed = foodFilter(input);
    const regions = new Set(selectedRegions(input));
    const indianOn = INDIAN_REGIONS.some((r) => regions.has(r));
    const pools = {};
    foods.forEach((f) => {
      if (f.ingKey || !allowed(f)) return;
      f.roles.forEach((role) => {
        if (REGIONAL_ROLES.includes(role)) {
          const ok = regions.has(f.region) || (f.region === 'IN' && indianOn);
          if (!ok) return;
        }
        (pools[role] = pools[role] || []).push(f);
      });
    });
    return pools;
  }

  // ── Meals & items ───────────────────────────────────────────────
  function formatQty(q) {
    const whole = Math.floor(q);
    const frac = Math.round((q - whole) * 100) / 100;
    const map = { 0.25: '¼', 0.5: '½', 0.75: '¾' };
    if (!frac) return String(whole);
    if (map[frac]) return (whole ? whole : '') + map[frac];
    return String(r1(q));
  }

  function formatUnit(unit, qty) {
    if (unit === 'g' || unit === 'ml') return unit;
    return qty > 1 && UNIT_PLURAL[unit] ? UNIT_PLURAL[unit] : unit;
  }

  function unitStep(unit) { return UNIT_STEP[unit] || 0.25; }

  /** A meal item from a database food at a given quantity. */
  function makeItem(food, qty) {
    const q = qty == null ? food.qty : qty;
    const item = {
      fid: food.id,
      name: food.name,
      unit: food.unit,
      qty: q,
      per: { qty: food.qty, kcal: food.kcal, p: food.p, c: food.c, f: food.f },
      fixed: food.flags.includes('fx'),
      wl: food.flags.includes('wl'),
    };
    return refreshItem(item);
  }

  /** A free-text item typed by the dietitian. */
  function customItem(name, qty, unit, kcal, protein) {
    return refreshItem({
      fid: null, name, unit: unit || 'serving', qty: Number(qty) || 1,
      per: { qty: Number(qty) || 1, kcal: Number(kcal) || 0, p: Number(protein) || 0, c: 0, f: 0 },
      fixed: false, custom: true,
    });
  }

  function refreshItem(item) {
    const k = item.per.qty ? item.qty / item.per.qty : 0;
    item.kcal = Math.round(item.per.kcal * k);
    item.p = r1(item.per.p * k);
    item.c = r1(item.per.c * k);
    item.f = r1(item.per.f * k);
    item.text = formatQty(item.qty) + ' ' + formatUnit(item.unit, item.qty);
    return item;
  }

  function setItemQty(item, qty) {
    item.qty = Math.max(0, qty);
    return refreshItem(item);
  }

  function recalcMeal(meal) {
    meal.kcal = Math.round(meal.items.reduce((s, i) => s + i.kcal, 0));
    meal.p = Math.round(meal.items.reduce((s, i) => s + i.p, 0));
    meal.c = Math.round(meal.items.reduce((s, i) => s + i.c, 0));
    meal.f = Math.round(meal.items.reduce((s, i) => s + i.f, 0));
    return meal;
  }

  /** Scale a list of foods to a calorie target; portions round to kitchen measures. */
  function composeMeal(foods, targetKcal, scalable, title) {
    const base = foods.reduce((s, f) => s + f.kcal, 0);
    const fixedKcal = foods.filter((f) => f.flags.includes('fx')).reduce((s, f) => s + f.kcal, 0);
    let factor = 1;
    if (scalable && base - fixedKcal > 0) factor = Math.min(2.5, Math.max(0.5, round((targetKcal - fixedKcal) / (base - fixedKcal), 0.25)));
    const items = foods.map((f) => {
      const fixed = f.flags.includes('fx');
      const step = unitStep(f.unit);
      const q = fixed ? f.qty : Math.max(step, round(f.qty * factor, step));
      return makeItem(f, q);
    });
    return recalcMeal({ name: title || foods.map((f) => f.name).join(' + '), items, factor });
  }

  // ── Meal templates ──────────────────────────────────────────────
  const pickFrom = (arr, rand) => arr[Math.floor(rand() * arr.length)];
  const regionMatch = (list, region) => {
    if (region === 'IN') return list;
    const m = list.filter((f) => f.region === region || f.region === 'IN');
    return m.length ? m : list;
  };
  const worldMatch = (list, region) => {
    const m = list.filter((f) => f.region === region || f.region === 'CON');
    return m.length ? m : list;
  };
  const companionOk = (main) => (f) => f.region === 'IN' || f.region === main.region || f.roles.includes('drink') || f.roles.includes('fruit');

  /** Templates per slot: each has a weight, a generator and a combination counter. */
  function templates(slot, pools, presets, dinner) {
    const P = (r) => pools[r] || [];
    const T = [];
    const has = (...roles) => roles.every((r) => P(r).length);

    if (slot === 'early' && has('early')) {
      T.push({ w: 1, gen: (rand) => [pickFrom(P('early'), rand), ...(P('earlyadd').length && rand() < 0.7 ? [pickFrom(P('earlyadd'), rand)] : [])],
        count: () => P('early').length * (P('earlyadd').length + 1) });
    }
    if (slot === 'bedtime' && has('bed')) {
      T.push({ w: 1, gen: (rand) => [pickFrom(P('bed'), rand)], count: () => P('bed').length });
    }
    if (slot === 'breakfast') {
      if (has('bf')) {
        T.push({ w: 3, gen: (rand) => {
          const main = pickFrom(P('bf'), rand);
          const comp = P('bfside').filter(companionOk(main)).filter((f) => f.id !== main.id);
          return comp.length ? [main, pickFrom(comp, rand)] : [main];
        }, count: () => P('bf').reduce((s, m) => s + Math.max(1, P('bfside').filter(companionOk(m)).length), 0) });
      }
      if (has('wbf')) {
        const comp = () => P('bfside').filter((f) => f.roles.includes('fruit') || f.roles.includes('drink'));
        T.push({ w: 2, gen: (rand) => {
          const main = pickFrom(P('wbf'), rand);
          const c = comp();
          return c.length && rand() < 0.6 ? [main, pickFrom(c, rand)] : [main];
        }, count: () => P('wbf').length * (comp().length + 1) });
      }
    }
    if (slot === 'lunch' || slot === 'dinner') {
      const flat = P('grain').filter((g) => !g.flags.includes('op'));
      const onePot = P('grain').filter((g) => g.flags.includes('op'));
      const mains = [...P('dal'), ...P('protein')];
      const sideish = dinner ? [...P('side'), ...P('soup')] : P('side');
      if (flat.length && mains.length && P('sabzi').length) {
        T.push({ w: 5, gen: (rand) => {
          const g = pickFrom(flat, rand);
          const out = [g, pickFrom(regionMatch(mains, g.region), rand), pickFrom(regionMatch(P('sabzi'), g.region), rand)];
          if (sideish.length && (!dinner || rand() < 0.5)) out.push(pickFrom(sideish, rand));
          return out;
        }, count: () => flat.reduce((s, g) => s + regionMatch(mains, g.region).length * regionMatch(P('sabzi'), g.region).length * (sideish.length + (dinner ? 1 : 0) || 1), 0) });
      }
      if (onePot.length) {
        T.push({ w: 1.5, gen: (rand) => {
          const g = pickFrom(onePot, rand);
          return sideish.length ? [g, pickFrom(sideish, rand)] : [g];
        }, count: () => onePot.length * Math.max(1, sideish.length) });
      }
      if (has('wprotein', 'wcarb', 'wveg')) {
        T.push({ w: 3, gen: (rand) => {
          const pr = pickFrom(P('wprotein'), rand);
          return [pr, pickFrom(worldMatch(P('wcarb'), pr.region), rand), pickFrom(worldMatch(P('wveg'), pr.region), rand)];
        }, count: () => P('wprotein').reduce((s, pr) => s + worldMatch(P('wcarb'), pr.region).length * worldMatch(P('wveg'), pr.region).length, 0) });
      }
      if (has('wmain')) T.push({ w: 1.5, gen: (rand) => [pickFrom(P('wmain'), rand)], count: () => P('wmain').length });
      if (has('tmain')) T.push({ w: 1.5, gen: (rand) => [pickFrom(P('tmain'), rand)], count: () => P('tmain').length });
    }
    if (slot === 'midmorning') {
      if (has('fruit')) T.push({ w: 2, gen: (rand) => [pickFrom(P('fruit'), rand)], count: () => P('fruit').length });
      if (has('snack')) T.push({ w: 2, gen: (rand) => [pickFrom(P('snack'), rand)], count: () => P('snack').length });
      const drinks = () => P('drink').filter((d) => !d.flags.includes('caf'));
      if (drinks().length && has('fruit')) {
        T.push({ w: 1, gen: (rand) => [pickFrom(drinks(), rand), pickFrom(P('fruit'), rand)], count: () => drinks().length * P('fruit').length });
      }
    }
    if (slot === 'evening') {
      if (has('snack')) T.push({ w: 2, gen: (rand) => [pickFrom(P('snack'), rand)], count: () => P('snack').length });
      if (has('snack', 'drink')) T.push({ w: 2, gen: (rand) => [pickFrom(P('drink'), rand), pickFrom(P('snack'), rand)], count: () => P('drink').length * P('snack').length });
      if (has('soup')) T.push({ w: 1, gen: (rand) => [pickFrom(P('soup'), rand)], count: () => P('soup').length });
    }

    // Classic pairings, only when every item is allowed.
    const byName = {};
    Object.values(pools).forEach((list) => list.forEach((f) => { byName[f.name] = f; }));
    const ok = presets.filter(([s, names]) => s === slot && names.every((n) => byName[n])).map(([, names]) => names.map((n) => byName[n]));
    if (ok.length) T.push({ w: 1, gen: (rand) => pickFrom(ok, rand), count: () => ok.length });
    return T;
  }

  function pickTemplate(T, rand) {
    const total = T.reduce((s, t) => s + t.w, 0);
    let x = rand() * total;
    for (const t of T) { x -= t.w; if (x <= 0) return t; }
    return T[T.length - 1];
  }

  /** Number of distinct meals the planner can build for this profile, per slot and in total. */
  function countCombinations(db, profile) {
    const pools = buildPools(db.FOODS, profile);
    const perSlot = {};
    let total = 0;
    Object.keys(SLOTS).forEach((slot) => {
      const n = templates(slot, pools, db.PRESETS, slot === 'dinner').reduce((s, t) => s + t.count(), 0);
      perSlot[slot] = n;
      total += n;
    });
    return { perSlot, total };
  }

  // ── Plans ────────────────────────────────────────────────────────
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function sumDay(meals) {
    return meals.reduce(
      (t, m) => (m.meal ? { kcal: t.kcal + m.meal.kcal, p: t.p + m.meal.p, c: t.c + m.meal.c, f: t.f + m.meal.f } : t),
      { kcal: 0, p: 0, c: 0, f: 0 }
    );
  }

  /** The plan days (1–7, default 7), by name, starting from `startDay` (e.g. 'Monday'). */
  function planDays(startDay, count) {
    const first = Math.max(0, DAY_NAMES.indexOf(startDay));
    const n = Math.min(7, Math.max(1, Number(count) || 7));
    return Array.from({ length: n }, (_, i) => ({ day: DAY_NAMES[(first + i) % 7] }));
  }

  /**
   * Choose the best of several candidate meals for a slot: close to the calorie
   * target, meeting the protein share, varied, and (for weight loss) favouring
   * weight-loss foods.
   */
  function bestMeal(T, target, proteinTarget, scalable, used, lastIds, rand, opts) {
    let best = null;
    for (let k = 0; k < (opts.avoid ? 24 : 14); k++) {
      const t = pickTemplate(T, rand);
      const foods = t.gen(rand);
      if (!foods || !foods.length) continue;
      const meal = composeMeal(foods, target, scalable);
      let score = Math.abs(meal.kcal - target) / Math.max(target, 1);
      if (proteinTarget > 0 && scalable) {
        const short = Math.max(0, proteinTarget - meal.p) / proteinTarget;
        score += short * opts.proteinWeight + Math.max(0, meal.p - proteinTarget * 1.6) / proteinTarget * 0.2;
      }
      score += foods.reduce((s, f) => s + (used[f.id] || 0), 0) * 0.12;
      if (foods.some((f) => lastIds.has(f.id))) score += 0.35;
      if (opts.avoid) score += foods.filter((f) => opts.avoid.has(f.id)).length * 0.6;
      if (opts.preferWl) score -= (foods.filter((f) => f.flags.includes('wl')).length / foods.length) * 0.15;
      if (opts.likes.length) score -= foods.filter((f) => likedFood(f, opts.likes)).length * opts.likeWeight;
      if (opts.mix) score -= foods.filter((f) => f.diet === 'egg' || f.diet === 'nonveg').length * 0.12;
      score += rand() * 0.05;
      if (!best || score < best.score) best = { score, meal, foods };
    }
    return best;
  }

  /**
   * Build a 7-day plan. `previous` keeps locked meals; `blank` starts an empty manual chart.
   * Returns { targets, days: [{ day, meals: [{slot, label, time, target, targetP, meal, locked}], totals }], combos }.
   */
  function generatePlan(db, profile, seed, options) {
    const opt = options || {};
    const targets = computeTargets(profile);
    const rand = rng(seed);
    const slots = slotTargets(targets.calories, profile.meals || 5, profile.earlyDrink !== false);
    const pools = buildPools(db.FOODS, profile);
    const T = {};
    slots.forEach(({ slot }) => { T[slot] = templates(slot, pools, db.PRESETS, slot === 'dinner'); });
    const used = {};
    const last = {};
    const times = profile.times || {};
    const scoring = {
      proteinWeight: targets.customProtein ? 2.5 : 1.2,
      preferWl: targets.goal === 'lose' || !!profile.preferWl,
      likes: (profile.likes || []).map((w) => w.toLowerCase().trim()).filter(Boolean),
      likeWeight: 0.3,
      mix: !!dietOf(profile).mix,
      // "Next week": steer away from every food of the previous chart (fixed drinks excepted).
      avoid: opt.avoidPrevious ? previousFoodIds(opt.avoidPrevious, db) : null,
    };

    const days = planDays(profile.startDay, profile.days).map(({ day }, di) => {
      const meals = slots.map(({ slot, kcal, share }, si) => {
        const info = SLOTS[slot];
        const prev = opt.previous && opt.previous.days[di] && opt.previous.days[di].meals.find((m) => m.slot === slot);
        const entry = { slot, label: info.label, time: times[slot] || info.time, target: Math.round(kcal), targetP: Math.round(targets.protein * share), meal: null, locked: false };
        if (prev && prev.locked && prev.meal) {
          entry.meal = prev.meal;
          entry.locked = true;
        } else if (opt.blank) {
          entry.meal = recalcMeal({ name: '', items: [] });
        } else if (T[slot].length) {
          const lastIds = last[slot] || new Set();
          const best = bestMeal(T[slot], kcal, targets.protein * share, info.scalable, used, lastIds, rand, scoring);
          if (best) {
            entry.meal = best.meal;
            best.foods.forEach((f) => { used[f.id] = (used[f.id] || 0) + 1; });
            last[slot] = new Set(best.foods.map((f) => f.id));
          }
        }
        return entry;
      });
      return { day, meals, totals: sumDay(meals) };
    });

    return { targets, days, combos: countCombinations(db, profile) };
  }

  /** Food ids used in a plan (or a list of food names), except fixed-portion add-ons. */
  function previousFoodIds(prev, db) {
    const ids = new Set();
    const byName = {};
    db.FOODS.forEach((f) => { byName[f.name.toLowerCase()] = f; });
    const add = (f) => { if (f && !f.flags.includes('fx')) ids.add(f.id); };
    if (Array.isArray(prev)) prev.forEach((x) => add(typeof x === 'number' ? db.FOODS[x] : byName[String(x).toLowerCase()]));
    else (prev.days || []).forEach((d) => d.meals.forEach((m) => m.meal && m.meal.items.forEach((i) => add(i.fid != null ? db.FOODS[i.fid] : byName[i.name.toLowerCase()]))));
    return ids;
  }

  /** Share of a plan's foods that also appear in another plan (0–1). */
  function overlap(a, b, db) {
    const A = previousFoodIds(a, db), B = previousFoodIds(b, db);
    if (!A.size) return 0;
    let n = 0;
    A.forEach((id) => { if (B.has(id)) n++; });
    return n / A.size;
  }

  function refreshDay(day) {
    day.totals = sumDay(day.meals);
    return day;
  }

  /** Replace one meal with a different generated option. */
  function swapMeal(db, profile, plan, dayIndex, mealIndex, rand) {
    const entry = plan.days[dayIndex].meals[mealIndex];
    const pools = buildPools(db.FOODS, profile);
    const T = templates(entry.slot, pools, db.PRESETS, entry.slot === 'dinner');
    if (!T.length) return false;
    const r = rand || Math.random;
    const current = entry.meal ? entry.meal.items.map((i) => i.fid).join(',') : '';
    for (let k = 0; k < 20; k++) {
      const foods = pickTemplate(T, r).gen(r);
      if (!foods || !foods.length || foods.map((f) => f.id).join(',') === current) continue;
      entry.meal = composeMeal(foods, entry.target, SLOTS[entry.slot].scalable);
      entry.locked = false;
      refreshDay(plan.days[dayIndex]);
      return true;
    }
    return false;
  }

  /** Copy one meal to the same slot on other days (deep copy), locking them. */
  function copyMeal(plan, fromDay, mealIndex, toDays) {
    const src = plan.days[fromDay].meals[mealIndex];
    toDays.forEach((di) => {
      const target = plan.days[di].meals.find((m) => m.slot === src.slot);
      if (!target || di === fromDay) return;
      target.meal = JSON.parse(JSON.stringify(src.meal));
      target.locked = true;
      refreshDay(plan.days[di]);
    });
  }

  /**
   * Search the food database. Filters: profile (fits the patient), wl, hp, travel,
   * indian, world, diet, category (see CATEGORIES), region, maxKcal, sort
   * ('name' | 'kcal' | 'protein').
   */
  function searchFoods(foods, query, filters) {
    const q = (query || '').toLowerCase().trim();
    const fl = filters || {};
    const allowed = fl.profile ? foodFilter(fl.profile) : null;
    const words = q.split(/\s+/).filter(Boolean);
    const catRoles = fl.category && CATEGORIES[fl.category] ? CATEGORIES[fl.category].roles : null;
    const list = foods.filter((f) => {
      if (allowed && !allowed(f)) return false;
      if (fl.wl && !f.flags.includes('wl')) return false;
      if (fl.hp && !isHighProtein(f)) return false;
      if (fl.travel && !f.flags.includes('tr')) return false;
      if (fl.indian && !(f.region === 'IN' || INDIAN_REGIONS.includes(f.region))) return false;
      if (fl.world && !WORLD_REGIONS.includes(f.region)) return false;
      if (fl.region && f.region !== fl.region) return false;
      if (fl.diet && DIET_RANK[f.diet] > DIET_RANK[fl.diet]) return false;
      if (fl.dietExact && f.diet !== fl.dietExact) return false;
      if (catRoles && !f.roles.some((r) => catRoles.includes(r))) return false;
      if (fl.maxKcal && f.kcal > fl.maxKcal) return false;
      const text = searchText(f);
      return words.every((w) => text.includes(w));
    });
    if (fl.sort === 'kcal') list.sort((a, b) => a.kcal - b.kcal);
    else if (fl.sort === 'protein') list.sort((a, b) => b.p - a.p);
    else if (fl.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (words.length) {
      // Names that start with the search word come first.
      const starts = (f) => (searchText(f).startsWith(words[0]) ? 0 : 1);
      list.sort((a, b) => starts(a) - starts(b));
    }
    return list;
  }

  /** True when a food matches one of the patient's preferred foods (English or Hindi name). */
  function likedFood(f, likes) {
    const text = searchText(f);
    return likes.some((w) => text.includes(w));
  }

  function searchText(f) {
    return (f.name + ' ' + (f.hi || '')).toLowerCase();
  }

  function isHighProtein(f) { return f.p * 4 >= f.kcal * 0.25 && f.p >= 6; }

  // ── Guidance ─────────────────────────────────────────────────────
  /** Guideline keys ({k, v}) for this profile; i18n.js turns them into text. */
  function tips(input, targets) {
    const profile = resolveProfile(input);
    const c = profile.conditions;
    const t = [{ k: 'water', v: { water: targets.waterL } }, { k: 'plate' }, { k: 'oil' }];
    if (profile.travel) {
      t.push({ k: 'travel' });
      if (['flight', 'train', 'hotel', 'road'].includes(profile.travel)) t.push({ k: profile.travel });
    }
    if (profile.diet === 'jain') t.push({ k: 'jain' });
    if (profile.goal === 'lose') t.push({ k: 'lose' });
    if (profile.goal === 'gain' || profile.goal === 'muscle') t.push({ k: 'gain' });
    if (profile.goal === 'pregnancy') t.push({ k: 'pregnancy' });
    if (profile.goal === 'lactation') t.push({ k: 'lactation' });
    if (c.includes('diabetes')) t.push({ k: 'diabetes' });
    if (c.includes('hypertension')) t.push({ k: 'bp' });
    if (c.includes('pcos')) t.push({ k: 'pcos' });
    if (c.includes('thyroid')) t.push({ k: 'thyroid' });
    if (c.includes('cholesterol')) t.push({ k: 'cholesterol' });
    if (c.includes('fattyliver')) t.push({ k: 'fattyliver' });
    if (c.includes('kidney')) t.push({ k: 'kidney' });
    if (targets.bmi >= 23 && !['lose', 'pregnancy', 'lactation'].includes(profile.goal)) t.push({ k: 'bmiHigh' });
    if (targets.bmi && targets.bmi < 18.5 && profile.goal === 'lose') t.push({ k: 'bmiLow' });
    return t;
  }

  /** Keys ({k, v}) of foods to limit or avoid, printed on the chart. */
  function avoidList(input) {
    const p = resolveProfile(input);
    const c = p.conditions;
    const list = [{ k: 'sugar' }, { k: 'fried' }, { k: 'maida' }, { k: 'softdrinks' }];
    if (c.includes('diabetes') || c.includes('pcos')) list.push({ k: 'dCarb' }, { k: 'dFruit' });
    if (c.includes('hypertension') || c.includes('kidney')) list.push({ k: 'salt' });
    if (c.includes('kidney')) list.push({ k: 'potassium' });
    if (c.includes('cholesterol') || c.includes('fattyliver')) list.push({ k: 'fat' });
    if (c.includes('fattyliver')) list.push({ k: 'alcohol' });
    if (p.goal === 'pregnancy') list.push({ k: 'pregnancy' });
    (p.excludes || []).forEach((k) => { if (EXCLUDES[k]) list.push({ k: 'excl', v: k }); });
    return list;
  }

  /** Best weight-loss foods for this profile, for the chart's "smart choices" box. */
  function weightLossPicks(foods, input, n) {
    const allowed = foodFilter({ ...input, travel: false });
    const perRole = {};
    return foods
      .filter((f) => f.flags.includes('wl') && allowed(f) && !f.flags.includes('fx'))
      .sort((a, b) => (b.p / Math.max(b.kcal, 1)) - (a.p / Math.max(a.kcal, 1)))
      .filter((f) => { // at most two per role, so the list covers meals, snacks and drinks
        const k = f.roles[0];
        perRole[k] = (perRole[k] || 0) + 1;
        return perRole[k] <= 2;
      })
      .slice(0, n || 12);
  }

  const api = {
    ACTIVITY, GOALS, PLANS, CONDITIONS, DIETS, REGIONS, EXCLUDES, TRAVEL, SLOTS, SPLITS, DAY_NAMES, CATEGORIES,
    MIXES, MIX_ITEMS, CONDITION_BANS, dietOf, previousFoodIds, overlap, resolveProfile, computeTargets, slotTargets, foodFilter, buildPools, composeMeal, makeItem, customItem,
    setItemQty, recalcMeal, refreshDay, unitStep, generatePlan, swapMeal, copyMeal, countCombinations,
    searchFoods, isHighProtein, planDays, tips, avoidList, weightLossPicks, formatQty, rng,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Planner = api;
})(typeof window !== 'undefined' ? window : globalThis);
