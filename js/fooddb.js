/*
 * Hindivine Diet food database.
 *
 * Every entry is one food with its own nutrition per serving, so meals can be
 * generated, scaled and edited item by item. The planner combines items by role
 * (grain + dal + sabzi + side, bowl = protein + carb + veg, …) into meals.
 *
 * F(name, roles, diet, region, qty, unit, kcal, protein, carbs, fat, allergens, flags)
 *   roles      space-separated: early earlyadd bf bfside drink fruit snack soup grain dal
 *              protein sabzi side wbf wprotein wcarb wveg wmain tmain bed
 *   diet       vegan | veg | egg | nonveg
 *   region     IN (pan-Indian) N S W E  |  CON MED ASIA MEX (worldwide)
 *   allergens  gluten dairy nuts soy egg fish
 *   flags      wl weight-loss friendly · tr travel friendly · op one-pot meal · fx fixed portion
 *              hgi high glycaemic · hna high sodium · hk high potassium · fried · hsf high sat. fat
 *              sweet · caf caffeine
 * Values are approximate, based on typical home recipes with moderate oil.
 */
(function (root) {
  const FOODS = [];
  function F(name, roles, diet, region, qty, unit, kcal, p, c, f, allergens, flags) {
    FOODS.push({
      id: FOODS.length,
      name, roles: roles.split(' '), diet, region, qty, unit, kcal, p, c, f,
      allergens: allergens ? allergens.split(' ') : [],
      flags: flags ? flags.split(' ') : [],
    });
  }

  // ── Early morning drinks & add-ons ─────────────────────────────
  F('Warm lemon water', 'early', 'vegan', 'IN', 1, 'glass', 5, 0, 1, 0, '', 'wl tr fx');
  F('Jeera (cumin) water', 'early', 'vegan', 'IN', 1, 'glass', 5, 0, 1, 0, '', 'wl fx');
  F('Methi (fenugreek) seed water', 'early', 'vegan', 'IN', 1, 'glass', 10, 0.5, 1.5, 0.2, '', 'wl fx');
  F('Ajwain (carom) water', 'early', 'vegan', 'IN', 1, 'glass', 5, 0, 1, 0, '', 'wl fx');
  F('Dhaniya (coriander seed) water', 'early', 'vegan', 'IN', 1, 'glass', 5, 0, 1, 0, '', 'wl fx');
  F('Saunf (fennel) water', 'early', 'vegan', 'IN', 1, 'glass', 8, 0.2, 1.5, 0.1, '', 'wl fx');
  F('Dalchini (cinnamon) water', 'early', 'vegan', 'IN', 1, 'glass', 5, 0, 1, 0, '', 'wl fx');
  F('Amla juice in warm water', 'early', 'vegan', 'IN', 1, 'glass', 20, 0.3, 4, 0, '', 'wl fx');
  F('Aloe vera juice in water', 'early', 'vegan', 'IN', 1, 'glass', 10, 0, 2, 0, '', 'wl fx');
  F('Tulsi–ginger herbal tea', 'early bed', 'vegan', 'IN', 1, 'cup', 10, 0.2, 2, 0, '', 'wl tr fx');
  F('Green tea (no sugar)', 'early drink', 'vegan', 'IN', 1, 'cup', 2, 0, 0.5, 0, '', 'wl tr fx caf');
  F('Wheatgrass juice', 'early', 'vegan', 'IN', 1, 'glass', 15, 1, 2, 0, '', 'wl fx');
  F('Lemon–honey water', 'early', 'veg', 'IN', 1, 'glass', 45, 0, 12, 0, '', 'hgi sweet fx');
  F('Soaked almonds', 'earlyadd', 'vegan', 'IN', 5, 'pc', 35, 1.3, 1.2, 3, 'nuts', 'tr fx');
  F('Walnut halves', 'earlyadd bed', 'vegan', 'IN', 4, 'pc', 50, 1.2, 1, 5, 'nuts', 'tr fx');
  F('Soaked kishmish (raisins)', 'earlyadd', 'vegan', 'IN', 6, 'pc', 25, 0.2, 6.5, 0, '', 'hgi hk sweet fx');
  F('Soaked chia seeds', 'earlyadd', 'vegan', 'IN', 1, 'tsp', 20, 0.7, 1.7, 1.3, '', 'wl fx');
  F('Roasted flaxseed', 'earlyadd', 'vegan', 'IN', 1, 'tsp', 18, 0.6, 1, 1.4, '', 'wl fx');
  F('Pumpkin seeds', 'earlyadd', 'vegan', 'IN', 1, 'tsp', 15, 0.8, 0.5, 1.3, '', 'wl tr fx');
  F('Sunflower seeds', 'earlyadd', 'vegan', 'IN', 1, 'tsp', 17, 0.6, 0.6, 1.5, '', 'wl tr fx');
  F('Soaked methi seeds', 'earlyadd', 'vegan', 'IN', 1, 'tsp', 12, 0.9, 2, 0.2, '', 'wl fx');

  // ── Bedtime ─────────────────────────────────────────────────────
  F('Haldi doodh (low-fat turmeric milk)', 'bed', 'veg', 'IN', 1, 'cup', 110, 6, 10, 5, 'dairy', 'fx');
  F('Warm toned milk with elaichi', 'bed', 'veg', 'IN', 1, 'cup', 100, 6, 9, 4, 'dairy', 'fx');
  F('Warm skimmed milk', 'bed', 'veg', 'IN', 1, 'cup', 70, 7, 10, 0.3, 'dairy', 'wl fx');
  F('Unsweetened almond milk', 'bed', 'vegan', 'CON', 1, 'cup', 35, 1.2, 1.5, 2.8, 'nuts', 'wl fx');
  F('Warm soy milk with cinnamon', 'bed', 'vegan', 'ASIA', 1, 'cup', 90, 7, 6, 4, 'soy', 'fx');
  F('Chamomile tea', 'bed', 'vegan', 'CON', 1, 'cup', 2, 0, 0.5, 0, '', 'wl fx');
  F('Dalchini (cinnamon) tea', 'bed', 'vegan', 'IN', 1, 'cup', 5, 0, 1, 0, '', 'wl fx');

  // ── Fruits ──────────────────────────────────────────────────────
  F('Apple', 'fruit bfside', 'vegan', 'IN', 1, 'pc', 80, 0.4, 21, 0.3, '', 'wl tr');
  F('Pear', 'fruit bfside', 'vegan', 'IN', 1, 'pc', 85, 0.5, 22, 0.2, '', 'wl tr');
  F('Guava', 'fruit bfside', 'vegan', 'IN', 1, 'pc', 70, 2.6, 14, 1, '', 'wl tr');
  F('Orange', 'fruit bfside', 'vegan', 'IN', 1, 'pc', 65, 1.3, 15, 0.2, '', 'wl tr hk');
  F('Mosambi (sweet lime)', 'fruit', 'vegan', 'IN', 1, 'pc', 45, 0.8, 10, 0.2, '', 'wl tr');
  F('Banana (small)', 'fruit bfside', 'vegan', 'IN', 1, 'pc', 90, 1.1, 23, 0.3, '', 'hgi hk tr');
  F('Papaya', 'fruit bfside', 'vegan', 'IN', 1, 'bowl', 60, 0.7, 15, 0.4, '', 'wl');
  F('Watermelon', 'fruit', 'vegan', 'IN', 1.5, 'cup', 70, 1.4, 17, 0.3, '', 'hgi wl');
  F('Muskmelon', 'fruit', 'vegan', 'IN', 1, 'bowl', 55, 1.3, 13, 0.3, '', 'wl hk');
  F('Pomegranate seeds', 'fruit bfside', 'vegan', 'IN', 0.5, 'cup', 72, 1.5, 16, 1, '', 'wl');
  F('Pineapple', 'fruit', 'vegan', 'IN', 1, 'bowl', 80, 0.9, 21, 0.2, '', '');
  F('Mango slices', 'fruit', 'vegan', 'IN', 0.5, 'cup', 50, 0.7, 12, 0.3, '', 'hgi sweet');
  F('Grapes', 'fruit', 'vegan', 'IN', 1, 'cup', 100, 1, 27, 0.2, '', 'hgi');
  F('Chikoo (sapota)', 'fruit', 'vegan', 'IN', 1, 'pc', 80, 0.4, 20, 1, '', 'hgi');
  F('Kiwi', 'fruit', 'vegan', 'CON', 2, 'pc', 85, 1.6, 20, 0.7, '', 'wl hk tr');
  F('Strawberries', 'fruit', 'vegan', 'CON', 1, 'cup', 50, 1, 12, 0.5, '', 'wl');
  F('Blueberries', 'fruit', 'vegan', 'CON', 0.5, 'cup', 42, 0.5, 11, 0.2, '', 'wl');
  F('Jamun', 'fruit', 'vegan', 'IN', 1, 'cup', 60, 0.7, 14, 0.2, '', 'wl');
  F('Plums', 'fruit', 'vegan', 'IN', 2, 'pc', 60, 0.9, 15, 0.4, '', 'wl tr');
  F('Peach', 'fruit', 'vegan', 'IN', 1, 'pc', 60, 1.4, 15, 0.4, '', 'wl tr');
  F('Custard apple (sitaphal)', 'fruit', 'vegan', 'IN', 0.5, 'pc', 100, 2, 24, 0.5, '', 'hgi');
  F('Fresh figs', 'fruit', 'vegan', 'IN', 2, 'pc', 75, 0.8, 19, 0.3, '', '');
  F('Litchi', 'fruit', 'vegan', 'IN', 10, 'pc', 65, 0.8, 16, 0.4, '', 'hgi');
  F('Cherries', 'fruit', 'vegan', 'CON', 1, 'cup', 90, 1.5, 22, 0.3, '', '');
  F('Dragon fruit', 'fruit', 'vegan', 'ASIA', 1, 'cup', 60, 1.2, 13, 0, '', 'wl');
  F('Mixed fruit bowl', 'fruit bfside', 'vegan', 'IN', 1, 'bowl', 90, 1.2, 22, 0.4, '', 'wl');
  F('Amla (Indian gooseberry)', 'fruit', 'vegan', 'IN', 2, 'pc', 40, 0.8, 9, 0.5, '', 'wl tr');

  // ── Drinks ──────────────────────────────────────────────────────
  F('Chaas (buttermilk)', 'drink side bfside', 'veg', 'IN', 1, 'glass', 45, 2.5, 4, 2, 'dairy', 'wl tr');
  F('Salted lassi', 'drink', 'veg', 'N', 1, 'glass', 110, 6, 9, 5, 'dairy', '');
  F('Nimbu pani (no sugar)', 'drink', 'vegan', 'IN', 1, 'glass', 10, 0, 3, 0, '', 'wl tr fx');
  F('Tender coconut water', 'drink', 'vegan', 'S', 1, 'glass', 45, 0.5, 9, 0.5, '', 'hk tr wl');
  F('Sattu drink', 'drink', 'vegan', 'E', 1, 'glass', 110, 6, 18, 1.5, '', 'wl tr');
  F('Masala tea (less sugar)', 'drink bfside', 'veg', 'IN', 1, 'cup', 70, 2.5, 9, 2.5, 'dairy', 'tr caf fx');
  F('Black coffee', 'drink bfside', 'vegan', 'CON', 1, 'cup', 5, 0.3, 0, 0, '', 'wl caf fx');
  F('Filter coffee (less sugar)', 'drink bfside', 'veg', 'S', 1, 'cup', 80, 3, 10, 3, 'dairy', 'caf fx');
  F('Toned milk', 'drink bfside', 'veg', 'IN', 1, 'glass', 120, 6, 10, 6, 'dairy', 'tr');
  F('Soy milk', 'drink bfside', 'vegan', 'ASIA', 1, 'glass', 100, 7, 7, 4, 'soy', 'tr');
  F('Jaljeera', 'drink', 'vegan', 'N', 1, 'glass', 20, 0.3, 4, 0.2, '', 'hna');
  F('Kokum sharbat (no sugar)', 'drink', 'vegan', 'W', 1, 'glass', 20, 0.2, 5, 0, '', 'wl');
  F('Aam panna (less sugar)', 'drink', 'vegan', 'N', 1, 'glass', 60, 0.3, 15, 0, '', 'sweet');
  F('Fresh vegetable juice', 'drink', 'vegan', 'IN', 1, 'glass', 50, 2, 10, 0.3, '', 'wl');
  F('Whey protein shake (in water)', 'drink bfside', 'veg', 'CON', 1, 'scoop', 120, 24, 3, 1.5, 'dairy', 'tr');
  F('Plant protein shake', 'drink bfside', 'vegan', 'CON', 1, 'scoop', 120, 22, 4, 2, '', 'tr');
  F('Banana–milk smoothie (no sugar)', 'drink', 'veg', 'CON', 1, 'glass', 180, 7, 30, 4, 'dairy', 'hgi');
  F('Spinach–apple green smoothie', 'drink', 'vegan', 'CON', 1, 'glass', 110, 2, 25, 0.5, '', 'wl hk');

  // ── Snacks ──────────────────────────────────────────────────────
  F('Roasted chana', 'snack', 'vegan', 'IN', 30, 'g', 110, 6, 18, 2, '', 'wl tr');
  F('Roasted makhana (fox nuts)', 'snack', 'vegan', 'IN', 1, 'cup', 90, 3, 17, 0.5, '', 'wl tr');
  F('Moong sprouts chaat', 'snack', 'vegan', 'IN', 1, 'cup', 120, 8, 20, 1, '', 'wl');
  F('Mixed sprouts salad', 'snack side', 'vegan', 'IN', 1, 'cup', 110, 8, 18, 1, '', 'wl');
  F('Kala chana chaat', 'snack', 'vegan', 'IN', 1, 'cup', 160, 8, 26, 3, '', 'wl');
  F('Roasted peanuts', 'snack', 'vegan', 'IN', 20, 'g', 115, 5, 3, 10, 'nuts', 'tr');
  F('Almonds', 'snack bfside', 'vegan', 'IN', 8, 'pc', 55, 2, 2, 5, 'nuts', 'tr');
  F('Mixed nuts', 'snack', 'vegan', 'IN', 20, 'g', 120, 4, 4, 10, 'nuts', 'tr');
  F('Roasted pumpkin seeds', 'snack', 'vegan', 'IN', 1, 'tbsp', 45, 2.5, 1, 4, '', 'wl tr');
  F('Trail mix (nuts & seeds)', 'snack', 'vegan', 'CON', 25, 'g', 130, 4, 9, 9, 'nuts', 'tr');
  F('Roasted murmura chivda', 'snack', 'vegan', 'W', 1, 'cup', 120, 3, 21, 3, 'nuts', 'hgi tr');
  F('Sprouts bhel (no sev)', 'snack', 'vegan', 'W', 1, 'cup', 150, 6, 26, 3, '', '');
  F('Multigrain khakhra', 'snack', 'vegan', 'W', 2, 'pc', 110, 3.5, 17, 3, 'gluten', 'tr');
  F('Khaman dhokla', 'snack bf', 'vegan', 'W', 2, 'pc', 140, 6, 21, 3.5, '', 'hna');
  F('Moong dal dhokla', 'snack bf', 'vegan', 'W', 3, 'pc', 150, 9, 20, 3, '', 'wl');
  F('Idli', 'snack bf', 'vegan', 'S', 2, 'pc', 130, 4, 27, 0.5, '', 'hgi tr');
  F('Paneer tikka', 'snack', 'veg', 'N', 80, 'g', 200, 14, 6, 13, 'dairy', 'hsf');
  F('Paneer cubes with chaat masala', 'snack', 'veg', 'IN', 50, 'g', 135, 9, 2, 10, 'dairy', 'hsf');
  F('Tofu tikka', 'snack', 'vegan', 'IN', 100, 'g', 130, 12, 4, 8, 'soy', 'wl');
  F('Soya chunks chaat', 'snack', 'vegan', 'IN', 0.5, 'cup', 130, 14, 12, 2, 'soy', 'wl');
  F('Sweet corn chaat', 'snack', 'vegan', 'IN', 0.5, 'cup', 110, 3.5, 22, 1.5, '', 'hgi');
  F('Fruit chaat', 'snack', 'vegan', 'N', 1, 'bowl', 100, 1.5, 24, 0.5, '', 'wl');
  F('Vegetable sandwich (multigrain)', 'snack', 'veg', 'IN', 1, 'pc', 180, 7, 28, 5, 'gluten dairy', 'tr');
  F('Paneer sandwich (multigrain)', 'snack', 'veg', 'IN', 1, 'pc', 250, 13, 28, 9, 'gluten dairy', 'tr');
  F('Egg sandwich (multigrain)', 'snack', 'egg', 'IN', 1, 'pc', 230, 12, 26, 8, 'egg gluten', 'tr');
  F('Chicken sandwich (multigrain)', 'snack', 'nonveg', 'CON', 1, 'pc', 260, 20, 28, 7, 'gluten', 'tr');
  F('Boiled eggs', 'snack bfside', 'egg', 'IN', 2, 'pc', 140, 12, 1, 10, 'egg', 'wl tr');
  F('Boiled egg whites', 'snack', 'egg', 'IN', 3, 'pc', 50, 11, 0.7, 0.2, 'egg', 'wl tr');
  F('Egg chaat', 'snack', 'egg', 'IN', 2, 'pc', 160, 12, 6, 10, 'egg', '');
  F('Chicken tikka (snack)', 'snack', 'nonveg', 'N', 100, 'g', 170, 26, 4, 6, '', 'wl');
  F('Fish tikka (snack)', 'snack', 'nonveg', 'IN', 100, 'g', 160, 23, 3, 6, 'fish', 'wl');
  F('Grilled chicken strips', 'snack', 'nonveg', 'CON', 80, 'g', 130, 24, 0, 3, '', 'wl tr');
  F('Greek yogurt', 'snack bfside', 'veg', 'CON', 100, 'g', 100, 10, 6, 3, 'dairy', 'wl');
  F('Hung curd dip with veg sticks', 'snack', 'veg', 'IN', 1, 'bowl', 110, 7, 9, 5, 'dairy', 'wl');
  F('Hummus with veggie sticks', 'snack', 'vegan', 'MED', 1, 'bowl', 130, 5, 13, 7, '', 'wl');
  F('Baked sweet potato chaat', 'snack', 'vegan', 'IN', 0.5, 'cup', 110, 2, 25, 0.3, '', 'hk');
  F('Vegetable poha (small)', 'snack', 'vegan', 'W', 0.75, 'cup', 150, 3, 26, 4, '', 'tr');
  F('Protein bar', 'snack', 'veg', 'CON', 1, 'pc', 200, 20, 20, 7, 'dairy nuts', 'tr');
  F('Peanut chikki', 'snack', 'vegan', 'W', 1, 'pc', 120, 3, 14, 6, 'nuts', 'sweet hgi tr');
  F('Dry fruit laddoo (no sugar)', 'snack', 'vegan', 'IN', 1, 'pc', 110, 2, 15, 5, 'nuts', 'sweet tr');
  F('Sattu laddoo', 'snack', 'veg', 'E', 1, 'pc', 120, 4, 16, 5, '', 'sweet tr');
  F('Rice cakes', 'snack', 'vegan', 'CON', 2, 'pc', 70, 1.5, 15, 0.5, '', 'hgi tr');
  F('Air-popped popcorn', 'snack', 'vegan', 'CON', 2, 'cup', 60, 2, 12, 0.7, '', 'wl tr');
  F('Cucumber & carrot sticks', 'snack', 'vegan', 'IN', 1, 'bowl', 40, 1, 9, 0.2, '', 'wl tr');
  F('Sprouts tikki (baked)', 'snack', 'vegan', 'IN', 2, 'pc', 160, 8, 22, 4, '', '');
  F('Oats tikki (baked)', 'snack', 'vegan', 'IN', 2, 'pc', 150, 6, 20, 5, '', '');
  F('Moong dal chilla (small)', 'snack', 'vegan', 'IN', 1, 'pc', 120, 7, 16, 3, '', 'wl');
  F('Besan chilla (small)', 'snack', 'vegan', 'N', 1, 'pc', 130, 6, 14, 5, '', '');
  F('Edamame (steamed)', 'snack wprotein', 'vegan', 'ASIA', 1, 'cup', 190, 17, 14, 8, 'soy', 'wl');
  F('Cottage cheese with pepper', 'snack', 'veg', 'CON', 100, 'g', 100, 11, 3.5, 4.5, 'dairy', 'wl');

  // ── Soups ───────────────────────────────────────────────────────
  F('Clear vegetable soup', 'soup', 'vegan', 'IN', 1, 'bowl', 60, 2, 10, 1, '', 'wl');
  F('Tomato soup (no cream)', 'soup', 'vegan', 'IN', 1, 'bowl', 80, 2, 12, 2.5, '', 'wl hk');
  F('Moong dal soup', 'soup', 'vegan', 'IN', 1, 'bowl', 120, 7, 18, 2, '', 'wl');
  F('Lauki soup', 'soup', 'vegan', 'N', 1, 'bowl', 50, 1.5, 9, 1, '', 'wl');
  F('Palak soup', 'soup', 'vegan', 'N', 1, 'bowl', 70, 3, 8, 3, '', 'wl hk');
  F('Sweet corn vegetable soup', 'soup', 'vegan', 'ASIA', 1, 'bowl', 100, 3, 18, 2, '', '');
  F('Mushroom soup (no cream)', 'soup', 'vegan', 'CON', 1, 'bowl', 70, 3, 9, 2.5, '', 'wl');
  F('Chicken clear soup', 'soup', 'nonveg', 'IN', 1, 'bowl', 90, 12, 4, 3, '', 'wl');
  F('Rasam', 'soup', 'vegan', 'S', 1, 'bowl', 50, 1.5, 8, 1.5, '', 'wl');
  F('Veg manchow soup (less oil)', 'soup', 'vegan', 'ASIA', 1, 'bowl', 90, 3, 14, 2.5, 'soy', 'hna');
  F('Minestrone soup', 'soup', 'vegan', 'CON', 1, 'bowl', 110, 4, 18, 2.5, 'gluten', '');
  F('Lentil soup', 'soup', 'vegan', 'MED', 1, 'bowl', 150, 9, 24, 2, '', 'wl');
  F('Miso soup', 'soup', 'vegan', 'ASIA', 1, 'bowl', 50, 3.5, 5, 2, 'soy', 'hna');
  F('Tom yum soup (veg)', 'soup', 'vegan', 'ASIA', 1, 'bowl', 60, 2, 8, 2, '', 'hna');
  F('Chicken tom yum', 'soup', 'nonveg', 'ASIA', 1, 'bowl', 110, 14, 6, 3, 'fish', 'hna');
  F('Pumpkin soup', 'soup', 'vegan', 'CON', 1, 'bowl', 90, 2, 15, 2.5, '', 'wl');
  F('Broccoli–almond soup', 'soup', 'vegan', 'CON', 1, 'bowl', 100, 4, 10, 5, 'nuts', '');
  F('Chicken sweet corn soup', 'soup', 'nonveg', 'ASIA', 1, 'bowl', 130, 11, 14, 3, '', '');

  // ── Indian breakfast mains ──────────────────────────────────────
  F('Idli (breakfast)', 'bf', 'vegan', 'S', 3, 'pc', 195, 6, 40, 0.8, '', 'hgi tr');
  F('Rava idli', 'bf', 'veg', 'S', 3, 'pc', 240, 7, 36, 7, 'gluten dairy', '');
  F('Ragi idli', 'bf', 'vegan', 'S', 3, 'pc', 180, 5, 36, 1.5, '', 'wl');
  F('Oats idli', 'bf', 'vegan', 'S', 3, 'pc', 190, 7, 32, 3, '', 'wl');
  F('Plain dosa (less oil)', 'bf', 'vegan', 'S', 2, 'pc', 250, 5, 38, 8, '', 'hgi');
  F('Masala dosa (less oil)', 'bf', 'vegan', 'S', 1, 'pc', 290, 6, 42, 11, '', 'hgi hk');
  F('Ragi dosa', 'bf', 'vegan', 'S', 2, 'pc', 220, 6, 38, 5, '', 'wl');
  F('Oats dosa', 'bf', 'vegan', 'S', 2, 'pc', 210, 7, 32, 6, '', 'wl');
  F('Neer dosa', 'bf', 'vegan', 'S', 2, 'pc', 180, 3, 34, 3, '', 'hgi');
  F('Pesarattu (green moong dosa)', 'bf', 'vegan', 'S', 2, 'pc', 230, 13, 32, 6, '', 'wl');
  F('Adai (mixed dal dosa)', 'bf', 'vegan', 'S', 2, 'pc', 280, 13, 40, 8, '', 'wl');
  F('Onion–tomato uttapam', 'bf', 'vegan', 'S', 2, 'pc', 280, 7, 46, 7, '', 'hgi');
  F('Appam', 'bf', 'vegan', 'S', 2, 'pc', 200, 3, 40, 3, '', 'hgi');
  F('Idiyappam', 'bf', 'vegan', 'S', 2, 'pc', 180, 3, 40, 0.5, '', 'hgi');
  F('Puttu', 'bf', 'vegan', 'S', 1, 'cup', 220, 4, 46, 2, '', 'hgi');
  F('Ven pongal', 'bf', 'veg', 'S', 1, 'cup', 280, 8, 40, 10, 'dairy', '');
  F('Rava upma', 'bf', 'vegan', 'S', 1, 'cup', 200, 5, 30, 7, 'gluten', '');
  F('Vegetable oats upma', 'bf', 'vegan', 'IN', 1, 'cup', 180, 6, 28, 5, '', 'wl');
  F('Semiya (vermicelli) upma', 'bf', 'vegan', 'S', 1, 'cup', 210, 5, 36, 5, 'gluten', '');
  F('Vegetable poha', 'bf', 'vegan', 'W', 1, 'cup', 200, 4, 34, 6, 'nuts', 'tr');
  F('Sprouts poha', 'bf', 'vegan', 'W', 1, 'cup', 210, 8, 32, 5, '', 'wl');
  F('Sabudana khichdi', 'bf', 'vegan', 'W', 1, 'cup', 330, 4, 56, 10, 'nuts', 'hgi hk');
  F('Multigrain thalipeeth', 'bf', 'vegan', 'W', 2, 'pc', 250, 9, 36, 8, 'gluten', '');
  F('Misal (no farsan)', 'bf', 'vegan', 'W', 1, 'katori', 220, 12, 30, 6, '', 'wl');
  F('Khaman dhokla (breakfast)', 'bf', 'vegan', 'W', 4, 'pc', 280, 12, 42, 7, '', 'hna');
  F('Methi thepla (breakfast)', 'bf', 'vegan', 'W', 2, 'pc', 240, 7, 32, 9, 'gluten', 'tr');
  F('Handvo', 'bf', 'veg', 'W', 2, 'pc', 260, 10, 34, 9, 'dairy', '');
  F('Moong dal chilla', 'bf', 'vegan', 'IN', 2, 'pc', 240, 14, 32, 6, '', 'wl');
  F('Besan chilla', 'bf', 'vegan', 'N', 2, 'pc', 260, 12, 28, 10, '', '');
  F('Oats chilla', 'bf', 'vegan', 'IN', 2, 'pc', 230, 9, 32, 7, '', 'wl');
  F('Paneer-stuffed besan chilla', 'bf', 'veg', 'N', 2, 'pc', 320, 20, 30, 13, 'dairy', '');
  F('Aloo paratha (less ghee)', 'bf', 'vegan', 'N', 1, 'pc', 290, 6, 42, 11, 'gluten', 'hgi hk');
  F('Gobhi paratha', 'bf', 'vegan', 'N', 1, 'pc', 240, 7, 36, 8, 'gluten', '');
  F('Paneer paratha', 'bf', 'veg', 'N', 1, 'pc', 300, 13, 36, 12, 'gluten dairy', '');
  F('Methi paratha', 'bf', 'vegan', 'N', 1, 'pc', 220, 6, 32, 8, 'gluten', 'tr');
  F('Mooli paratha', 'bf', 'vegan', 'N', 1, 'pc', 230, 6, 34, 8, 'gluten', '');
  F('Missi roti (breakfast)', 'bf', 'vegan', 'N', 2, 'pc', 260, 11, 40, 6, 'gluten', '');
  F('Savoury vegetable dalia', 'bf', 'vegan', 'N', 1, 'cup', 180, 6, 32, 3, 'gluten', 'wl');
  F('Dalia porridge with milk', 'bf', 'veg', 'N', 1, 'cup', 220, 9, 34, 5, 'gluten dairy', '');
  F('Ragi porridge with milk', 'bf', 'veg', 'S', 1, 'bowl', 190, 7, 32, 4, 'dairy', '');
  F('Ghugni', 'bf', 'vegan', 'E', 1, 'katori', 200, 10, 30, 4, '', 'wl');
  F('Sattu paratha', 'bf', 'vegan', 'E', 1, 'pc', 260, 10, 38, 8, 'gluten', 'tr');
  F('Chuda–dahi (poha with curd)', 'bf', 'veg', 'E', 1, 'bowl', 250, 8, 42, 5, 'dairy', '');
  F('Baked litti', 'bf', 'vegan', 'E', 2, 'pc', 300, 11, 46, 8, 'gluten', 'tr');
  F('Masala omelette', 'bf', 'egg', 'IN', 2, 'egg', 190, 13, 3, 14, 'egg', 'tr');
  F('Egg bhurji', 'bf protein', 'egg', 'IN', 1, 'katori', 200, 13, 4, 15, 'egg', 'tr');
  F('Egg white omelette', 'bf', 'egg', 'IN', 3, 'egg', 70, 11, 2, 1.5, 'egg', 'wl');
  F('Anda paratha', 'bf', 'egg', 'N', 1, 'pc', 320, 13, 34, 15, 'egg gluten', '');
  F('Egg dosa', 'bf', 'egg', 'S', 2, 'pc', 340, 16, 42, 12, 'egg', 'hgi');
  F('Chicken keema', 'bf', 'nonveg', 'N', 1, 'katori', 220, 24, 6, 11, '', '');
  F('Tofu bhurji', 'bf protein', 'vegan', 'IN', 1, 'katori', 180, 15, 6, 11, 'soy', 'wl');
  F('Paneer bhurji', 'bf protein', 'veg', 'N', 1, 'katori', 250, 15, 6, 19, 'dairy', 'hsf tr');
  F('Instant oats cup', 'bf', 'vegan', 'IN', 1, 'cup', 190, 6, 32, 4, '', 'tr');
  F('Instant poha cup', 'bf', 'vegan', 'W', 1, 'cup', 200, 4, 36, 5, 'nuts', 'tr');
  F('Instant upma cup', 'bf', 'vegan', 'S', 1, 'cup', 210, 5, 34, 6, 'gluten', 'tr');

  // ── Breakfast sides ─────────────────────────────────────────────
  F('Sambar', 'bfside dal', 'vegan', 'S', 1, 'katori', 110, 5, 15, 3, '', 'wl tr');
  F('Coconut chutney', 'bfside', 'vegan', 'S', 2, 'tbsp', 70, 1, 3, 6, '', 'fx');
  F('Mint–coriander chutney', 'bfside side', 'vegan', 'IN', 2, 'tbsp', 15, 0.5, 3, 0.2, '', 'wl fx');
  F('Tomato chutney', 'bfside', 'vegan', 'S', 2, 'tbsp', 30, 0.5, 4, 1.5, '', 'fx');
  F('Peanut chutney', 'bfside', 'vegan', 'S', 2, 'tbsp', 80, 3, 3, 6, 'nuts', 'fx');
  F('Ginger chutney', 'bfside', 'vegan', 'S', 2, 'tbsp', 35, 0.5, 5, 1.5, '', 'fx');
  F('Curd', 'bfside side', 'veg', 'IN', 0.5, 'katori', 45, 2.5, 3.5, 2.5, 'dairy', 'wl tr');
  F('Multigrain toast', 'bfside', 'vegan', 'CON', 1, 'slice', 70, 3, 12, 1, 'gluten', 'tr');
  F('Boiled egg', 'bfside', 'egg', 'IN', 1, 'pc', 70, 6, 0.5, 5, 'egg', 'wl tr');

  // ── Grains, rotis & rice ────────────────────────────────────────
  F('Phulka', 'grain', 'vegan', 'N', 2, 'pc', 140, 5, 30, 0.8, 'gluten', 'wl tr');
  F('Chapati (light ghee)', 'grain', 'veg', 'N', 2, 'pc', 200, 6, 32, 5, 'gluten dairy', 'tr');
  F('Multigrain roti', 'grain', 'vegan', 'N', 2, 'pc', 180, 7, 32, 3, 'gluten', 'wl');
  F('Jowar roti', 'grain', 'vegan', 'IN', 2, 'pc', 200, 6, 42, 2, '', 'wl');
  F('Bajra roti', 'grain', 'vegan', 'W', 2, 'pc', 230, 7, 40, 5, '', '');
  F('Ragi roti', 'grain', 'vegan', 'S', 2, 'pc', 200, 5, 40, 2, '', 'wl');
  F('Makki roti', 'grain', 'vegan', 'N', 2, 'pc', 240, 5, 44, 5, '', '');
  F('Besan missi roti', 'grain', 'vegan', 'N', 2, 'pc', 260, 11, 40, 6, 'gluten', '');
  F('Methi thepla', 'grain', 'vegan', 'W', 2, 'pc', 240, 7, 32, 9, 'gluten', 'tr');
  F('Gujarati rotli', 'grain', 'vegan', 'W', 2, 'pc', 150, 5, 30, 1.5, 'gluten', 'wl');
  F('Jowar bhakri', 'grain', 'vegan', 'W', 2, 'pc', 220, 6, 46, 1.5, '', 'wl');
  F('Tandoori roti', 'grain', 'vegan', 'N', 1, 'pc', 150, 5, 30, 1, 'gluten', 'tr');
  F('Naan', 'grain', 'veg', 'N', 1, 'pc', 260, 8, 45, 5, 'gluten dairy', 'hgi');
  F('Plain paratha', 'grain', 'vegan', 'N', 1, 'pc', 200, 5, 28, 8, 'gluten', 'tr');
  F('Steamed rice', 'grain', 'vegan', 'IN', 1, 'cup', 200, 4, 44, 0.4, '', 'hgi tr');
  F('Brown rice', 'grain wcarb', 'vegan', 'IN', 1, 'cup', 215, 5, 45, 1.8, '', '');
  F('Jeera rice', 'grain', 'vegan', 'N', 1, 'cup', 240, 4, 44, 5, '', 'hgi');
  F('Kerala matta rice', 'grain', 'vegan', 'S', 1, 'cup', 210, 5, 44, 1.5, '', '');
  F('Foxtail millet rice', 'grain', 'vegan', 'S', 1, 'cup', 200, 5, 40, 2, '', 'wl');
  F('Kodo millet rice', 'grain', 'vegan', 'S', 1, 'cup', 190, 5, 38, 2, '', 'wl');
  F('Cooked quinoa', 'grain wcarb', 'vegan', 'CON', 1, 'cup', 220, 8, 39, 3.5, '', 'wl');
  F('Vegetable pulao', 'grain', 'vegan', 'N', 1, 'cup', 250, 5, 42, 7, '', 'hgi');
  F('Lemon rice', 'grain', 'vegan', 'S', 1, 'cup', 260, 5, 44, 7, 'nuts', 'hgi tr');
  F('Curd rice', 'grain', 'veg', 'S', 1, 'cup', 230, 7, 36, 6, 'dairy', 'hgi tr op');
  F('Tamarind rice (puliyogare)', 'grain', 'vegan', 'S', 1, 'cup', 280, 5, 46, 8, 'nuts', 'hgi tr');
  F('Moong dal khichdi', 'grain', 'vegan', 'IN', 1.5, 'cup', 300, 12, 50, 6, '', 'wl tr op');
  F('Vegetable dalia khichdi', 'grain', 'vegan', 'N', 1.5, 'cup', 260, 10, 46, 4, 'gluten', 'wl op');
  F('Bajra–moong khichdi', 'grain', 'vegan', 'W', 1.5, 'cup', 280, 10, 46, 6, '', 'op');
  F('Oats–moong khichdi', 'grain', 'vegan', 'IN', 1.5, 'cup', 260, 11, 40, 6, '', 'wl op');
  F('Vegetable quinoa khichdi', 'grain', 'vegan', 'IN', 1.5, 'cup', 280, 11, 44, 6, '', 'wl op');
  F('Bisi bele bath', 'grain', 'vegan', 'S', 1.5, 'cup', 320, 10, 52, 8, '', 'hgi op');
  F('Vegetable biryani', 'grain', 'vegan', 'N', 1.5, 'cup', 380, 9, 62, 10, '', 'hgi op');
  F('Chicken biryani', 'grain', 'nonveg', 'N', 1.5, 'cup', 450, 24, 56, 14, '', 'hgi op');
  F('Egg biryani', 'grain', 'egg', 'N', 1.5, 'cup', 420, 16, 58, 13, 'egg', 'hgi op');
  F('Soya pulao', 'grain', 'vegan', 'N', 1.5, 'cup', 330, 16, 50, 7, 'soy', 'op');
  F('Instant khichdi cup', 'grain', 'vegan', 'IN', 1, 'cup', 250, 9, 42, 5, '', 'tr op hna');

  // ── Dals & legumes ──────────────────────────────────────────────
  F('Dal tadka (toor)', 'dal', 'vegan', 'N', 1, 'katori', 150, 8, 20, 4, '', 'wl tr');
  F('Moong dal', 'dal', 'vegan', 'IN', 1, 'katori', 120, 8, 18, 2, '', 'wl tr');
  F('Masoor dal', 'dal', 'vegan', 'E', 1, 'katori', 130, 9, 19, 2.5, '', 'wl');
  F('Chana dal', 'dal', 'vegan', 'N', 1, 'katori', 160, 9, 22, 4, '', '');
  F('Panchmel (mixed) dal', 'dal', 'vegan', 'W', 1, 'katori', 150, 9, 20, 4, '', 'wl');
  F('Dal palak', 'dal', 'vegan', 'N', 1, 'katori', 140, 9, 18, 4, '', 'wl hk');
  F('Chana dal with lauki', 'dal', 'vegan', 'N', 1, 'katori', 140, 8, 18, 4, '', 'wl');
  F('Gujarati dal', 'dal', 'vegan', 'W', 1, 'katori', 130, 6, 20, 3, '', '');
  F('Dal makhani', 'dal', 'veg', 'N', 1, 'katori', 230, 9, 22, 12, 'dairy', 'hsf');
  F('Rajma', 'dal', 'vegan', 'N', 1, 'katori', 180, 9, 26, 4, '', 'tr');
  F('Chole', 'dal', 'vegan', 'N', 1, 'katori', 200, 9, 28, 6, '', 'tr');
  F('Kala chana curry', 'dal', 'vegan', 'N', 1, 'katori', 180, 9, 26, 4, '', 'wl');
  F('Lobia curry', 'dal', 'vegan', 'N', 1, 'katori', 160, 9, 24, 3, '', 'wl');
  F('Kadhi (no pakoda)', 'dal', 'veg', 'N', 1, 'katori', 120, 5, 10, 6, 'dairy', '');
  F('Pithla', 'dal', 'vegan', 'W', 1, 'katori', 170, 8, 18, 7, '', '');
  F('Moong usal', 'dal', 'vegan', 'W', 1, 'katori', 160, 10, 22, 3, '', 'wl');
  F('Matki usal', 'dal', 'vegan', 'W', 1, 'katori', 170, 10, 24, 3.5, '', 'wl');
  F('Kadala curry', 'dal', 'vegan', 'S', 1, 'katori', 190, 9, 26, 5, '', '');
  F('Cholar dal', 'dal', 'vegan', 'E', 1, 'katori', 180, 8, 24, 5, '', '');
  F('Dalma (dal with vegetables)', 'dal', 'vegan', 'E', 1, 'katori', 150, 8, 22, 3, '', 'wl');
  F('Moong sprouts curry', 'dal', 'vegan', 'IN', 1, 'katori', 140, 9, 20, 3, '', 'wl');
  F('Horse gram (kulthi) dal', 'dal', 'vegan', 'S', 1, 'katori', 150, 9, 22, 2, '', 'wl');
  F('Dhuli urad dal', 'dal', 'vegan', 'N', 1, 'katori', 150, 9, 20, 3.5, '', '');
  F('Dal fry', 'dal', 'vegan', 'N', 1, 'katori', 170, 8, 20, 6, '', 'tr');
  F('Sai bhaji', 'dal', 'vegan', 'W', 1, 'katori', 150, 7, 18, 5, '', 'hk');
  F('Mysore rasam with dal', 'dal', 'vegan', 'S', 1, 'katori', 90, 4, 12, 2.5, '', 'wl');
  F('Kootu (dal & vegetable)', 'dal', 'vegan', 'S', 1, 'katori', 150, 6, 16, 7, '', 'wl');

  // ── Protein mains ───────────────────────────────────────────────
  F('Palak paneer', 'protein', 'veg', 'N', 1, 'katori', 260, 13, 9, 19, 'dairy', 'hsf hk');
  F('Matar paneer', 'protein', 'veg', 'N', 1, 'katori', 260, 13, 14, 17, 'dairy', 'hsf');
  F('Kadai paneer', 'protein', 'veg', 'N', 1, 'katori', 280, 14, 10, 20, 'dairy', 'hsf');
  F('Paneer tikka masala (light)', 'protein', 'veg', 'N', 1, 'katori', 290, 15, 11, 21, 'dairy', 'hsf');
  F('Grilled paneer', 'protein wprotein', 'veg', 'IN', 100, 'g', 280, 18, 4, 21, 'dairy', 'hsf');
  F('Soya chunk curry', 'protein', 'vegan', 'IN', 1, 'katori', 180, 17, 14, 6, 'soy', 'wl');
  F('Soya keema with peas', 'protein', 'vegan', 'N', 1, 'katori', 190, 18, 14, 7, 'soy', 'wl');
  F('Tofu curry', 'protein', 'vegan', 'IN', 1, 'katori', 200, 14, 10, 12, 'soy', '');
  F('Mushroom matar', 'protein sabzi', 'vegan', 'N', 1, 'katori', 150, 7, 16, 6, '', 'wl');
  F('Egg curry (2 eggs)', 'protein', 'egg', 'IN', 1, 'katori', 240, 14, 8, 17, 'egg', 'tr');
  F('Chicken curry (home-style)', 'protein', 'nonveg', 'N', 1, 'katori', 250, 24, 6, 14, '', 'tr');
  F('Butter chicken (light)', 'protein', 'nonveg', 'N', 1, 'katori', 320, 25, 10, 20, 'dairy', 'hsf');
  F('Chicken tikka', 'protein', 'nonveg', 'N', 120, 'g', 200, 30, 4, 7, 'dairy', 'wl tr');
  F('Tandoori chicken (skinless)', 'protein', 'nonveg', 'N', 150, 'g', 230, 34, 4, 8, 'dairy', 'wl tr');
  F('Chicken keema with peas', 'protein', 'nonveg', 'N', 1, 'katori', 230, 24, 8, 11, '', '');
  F('Chettinad chicken', 'protein', 'nonveg', 'S', 1, 'katori', 260, 24, 6, 15, '', '');
  F('Kerala chicken stew', 'protein', 'nonveg', 'S', 1, 'katori', 240, 20, 10, 13, '', '');
  F('Fish curry', 'protein', 'nonveg', 'IN', 1, 'katori', 220, 22, 6, 12, 'fish', '');
  F('Maacher jhol (Bengali fish curry)', 'protein', 'nonveg', 'E', 1, 'katori', 200, 21, 6, 10, 'fish', '');
  F('Fish tikka', 'protein', 'nonveg', 'IN', 120, 'g', 180, 26, 3, 7, 'fish', 'wl');
  F('Tawa fish', 'protein', 'nonveg', 'S', 120, 'g', 210, 25, 3, 11, 'fish', '');
  F('Goan fish curry', 'protein', 'nonveg', 'W', 1, 'katori', 260, 22, 6, 16, 'fish', 'hsf');
  F('Prawn masala', 'protein', 'nonveg', 'W', 1, 'katori', 200, 22, 6, 9, 'fish', '');
  F('Mutton curry (lean)', 'protein', 'nonveg', 'N', 1, 'katori', 300, 24, 6, 20, '', 'hsf');
  F('Chicken & vegetable stew', 'protein', 'nonveg', 'IN', 1, 'bowl', 240, 24, 14, 9, '', 'wl');

  // ── Sabzis (vegetables) ─────────────────────────────────────────
  F('Bhindi masala', 'sabzi', 'vegan', 'N', 1, 'katori', 110, 2.5, 10, 7, '', 'wl tr');
  F('Lauki sabzi', 'sabzi', 'vegan', 'N', 1, 'katori', 80, 1.5, 10, 4, '', 'wl');
  F('Tinda sabzi', 'sabzi', 'vegan', 'N', 1, 'katori', 80, 1.5, 9, 4, '', 'wl');
  F('Turai sabzi', 'sabzi', 'vegan', 'N', 1, 'katori', 80, 1.5, 9, 4, '', 'wl');
  F('Karela sabzi', 'sabzi', 'vegan', 'N', 1, 'katori', 100, 2, 10, 6, '', 'wl');
  F('Parwal sabzi', 'sabzi', 'vegan', 'E', 1, 'katori', 90, 2, 9, 5, '', 'wl');
  F('Patta gobhi (cabbage) sabzi', 'sabzi', 'vegan', 'IN', 1, 'katori', 90, 2, 10, 5, '', 'wl tr');
  F('Cabbage poriyal', 'sabzi', 'vegan', 'S', 1, 'katori', 100, 2.5, 10, 6, '', 'wl');
  F('Beans poriyal', 'sabzi', 'vegan', 'S', 1, 'katori', 100, 2.5, 10, 6, '', 'wl');
  F('Beetroot poriyal', 'sabzi', 'vegan', 'S', 1, 'katori', 100, 2, 14, 4.5, '', 'hk');
  F('Carrot–beans poriyal', 'sabzi', 'vegan', 'S', 1, 'katori', 100, 2, 12, 5, '', 'wl');
  F('Cabbage thoran', 'sabzi', 'vegan', 'S', 1, 'katori', 120, 2.5, 10, 8, '', 'wl');
  F('Beans thoran', 'sabzi', 'vegan', 'S', 1, 'katori', 120, 3, 10, 8, '', '');
  F('Avial', 'sabzi', 'veg', 'S', 1, 'katori', 170, 3, 12, 12, 'dairy', '');
  F('Aloo gobhi', 'sabzi', 'vegan', 'N', 1, 'katori', 150, 3, 18, 7, '', 'hk tr');
  F('Gobhi matar', 'sabzi', 'vegan', 'N', 1, 'katori', 120, 4, 12, 6, '', 'wl');
  F('Aloo matar', 'sabzi', 'vegan', 'N', 1, 'katori', 160, 4, 22, 6, '', 'hk hgi');
  F('Jeera aloo', 'sabzi', 'vegan', 'N', 1, 'katori', 170, 2.5, 24, 7, '', 'hk hgi tr');
  F('Mixed vegetable sabzi', 'sabzi', 'vegan', 'IN', 1, 'katori', 120, 3, 13, 6, '', 'wl tr');
  F('Palak bhaji', 'sabzi', 'vegan', 'IN', 1, 'katori', 90, 3.5, 7, 5.5, '', 'hk wl');
  F('Methi sabzi', 'sabzi', 'vegan', 'N', 1, 'katori', 90, 3, 7, 6, '', 'wl');
  F('Sarson ka saag', 'sabzi', 'veg', 'N', 1, 'katori', 150, 5, 12, 9, 'dairy', 'hk');
  F('Baingan bharta', 'sabzi', 'vegan', 'N', 1, 'katori', 120, 2.5, 12, 7, '', 'wl');
  F('Bharwa baingan', 'sabzi', 'vegan', 'W', 1, 'katori', 150, 3, 12, 10, 'nuts', '');
  F('Kaddu (pumpkin) sabzi', 'sabzi', 'vegan', 'N', 1, 'katori', 110, 1.5, 16, 4.5, '', '');
  F('Capsicum besan sabzi', 'sabzi', 'vegan', 'W', 1, 'katori', 120, 4, 11, 7, '', '');
  F('Mushroom sabzi', 'sabzi', 'vegan', 'N', 1, 'katori', 100, 4, 8, 6, '', 'wl');
  F('Kathal (jackfruit) sabzi', 'sabzi', 'vegan', 'E', 1, 'katori', 150, 3, 20, 7, '', '');
  F('Arbi sabzi', 'sabzi', 'vegan', 'N', 1, 'katori', 160, 2.5, 22, 7, '', 'hk');
  F('Shukto', 'sabzi', 'veg', 'E', 1, 'katori', 130, 3, 14, 7, 'dairy', '');
  F('Chorchori (mixed veg)', 'sabzi', 'vegan', 'E', 1, 'katori', 120, 3, 14, 6, '', 'wl');
  F('Undhiyu (light)', 'sabzi', 'vegan', 'W', 1, 'katori', 190, 5, 20, 10, '', 'hk');
  F('Tindora (kovakkai) sabzi', 'sabzi', 'vegan', 'W', 1, 'katori', 110, 2, 9, 7, '', 'wl');
  F('Gawar (cluster beans) sabzi', 'sabzi', 'vegan', 'W', 1, 'katori', 100, 3, 10, 5, '', 'wl');
  F('Drumstick curry', 'sabzi', 'vegan', 'S', 1, 'katori', 110, 3, 11, 6, '', 'wl');
  F('Raw banana poriyal', 'sabzi', 'vegan', 'S', 1, 'katori', 150, 2, 24, 6, '', 'hk');
  F('Stir-fried vegetables (Indian)', 'sabzi', 'vegan', 'IN', 1, 'katori', 90, 2.5, 10, 4.5, '', 'wl');
  F('Ker sangri', 'sabzi', 'vegan', 'N', 1, 'katori', 150, 4, 14, 9, '', 'hna');
  F('Vegetable kurma', 'sabzi', 'vegan', 'S', 1, 'katori', 170, 4, 14, 11, 'nuts', '');
  F('Lauki kofta curry (baked kofta)', 'sabzi', 'vegan', 'N', 1, 'katori', 170, 5, 14, 10, '', '');
  F('Beans–carrot stir fry', 'sabzi', 'vegan', 'IN', 1, 'katori', 90, 2.5, 11, 4, '', 'wl');
  F('Cauliflower–peas dry sabzi', 'sabzi', 'vegan', 'IN', 1, 'katori', 110, 4, 11, 6, '', 'wl');

  // ── Sides ───────────────────────────────────────────────────────
  F('Cucumber raita', 'side', 'veg', 'IN', 0.5, 'katori', 50, 2.5, 4, 2.5, 'dairy', 'wl');
  F('Mint raita', 'side', 'veg', 'N', 0.5, 'katori', 50, 2.5, 4, 2.5, 'dairy', 'wl');
  F('Lauki raita', 'side', 'veg', 'N', 0.5, 'katori', 50, 2.5, 4.5, 2.5, 'dairy', 'wl');
  F('Green salad', 'side', 'vegan', 'IN', 1, 'bowl', 30, 1, 6, 0.2, '', 'wl tr fx');
  F('Kachumber salad', 'side', 'vegan', 'IN', 1, 'bowl', 40, 1.5, 8, 0.3, '', 'wl fx');
  F('Beetroot–carrot salad', 'side', 'vegan', 'IN', 1, 'bowl', 50, 1.5, 10, 0.3, '', 'wl hk');
  F('Onion–cucumber salad', 'side', 'vegan', 'IN', 1, 'bowl', 35, 1, 8, 0.1, '', 'wl fx');
  F('Roasted papad', 'side', 'vegan', 'IN', 1, 'pc', 35, 2.5, 6, 0.2, '', 'hna');

  // ── Worldwide breakfast ─────────────────────────────────────────
  F('Overnight oats with milk & chia', 'wbf', 'veg', 'CON', 1, 'cup', 300, 12, 44, 9, 'dairy', '');
  F('Oatmeal with fruit', 'wbf', 'veg', 'CON', 1, 'bowl', 250, 8, 44, 5, 'dairy', 'wl');
  F('Greek yogurt parfait', 'wbf', 'veg', 'CON', 1, 'bowl', 250, 17, 32, 7, 'dairy', 'wl');
  F('Avocado toast', 'wbf', 'vegan', 'CON', 2, 'slice', 300, 8, 32, 16, 'gluten', 'hk');
  F('Scrambled eggs on toast', 'wbf', 'egg', 'CON', 1, 'plate', 320, 18, 26, 16, 'egg gluten', '');
  F('Vegetable omelette', 'wbf', 'egg', 'CON', 2, 'egg', 200, 14, 4, 14, 'egg', 'wl');
  F('Shakshuka', 'wbf', 'egg', 'MED', 1, 'plate', 250, 14, 14, 16, 'egg', '');
  F('Tofu scramble', 'wbf', 'vegan', 'CON', 1, 'cup', 200, 17, 6, 12, 'soy', 'wl');
  F('Peanut butter toast', 'wbf', 'vegan', 'CON', 2, 'slice', 300, 12, 30, 14, 'nuts gluten', '');
  F('Smoothie bowl', 'wbf', 'vegan', 'CON', 1, 'bowl', 280, 9, 50, 6, '', '');
  F('Whole-wheat pancakes', 'wbf', 'egg', 'CON', 2, 'pc', 260, 8, 40, 7, 'gluten egg dairy', 'hgi');
  F('Muesli with milk (no sugar)', 'wbf', 'veg', 'CON', 1, 'bowl', 280, 10, 46, 7, 'dairy nuts gluten', '');
  F('Cottage cheese & fruit bowl', 'wbf', 'veg', 'CON', 1, 'bowl', 200, 18, 18, 5, 'dairy', 'wl');
  F('Breakfast burrito (beans & egg)', 'wbf', 'egg', 'MEX', 1, 'pc', 350, 18, 40, 13, 'egg gluten', 'tr');
  F('Huevos rancheros', 'wbf', 'egg', 'MEX', 1, 'plate', 330, 17, 30, 15, 'egg', '');
  F('Congee (rice porridge)', 'wbf', 'vegan', 'ASIA', 1, 'bowl', 180, 5, 36, 1.5, '', 'hgi');
  F('Chia pudding (almond milk)', 'wbf', 'vegan', 'CON', 1, 'cup', 230, 7, 20, 13, 'nuts', '');
  F('Egg muffins', 'wbf', 'egg', 'CON', 3, 'pc', 210, 15, 4, 15, 'egg', 'tr');
  F('Ful medames', 'wbf', 'vegan', 'MED', 1, 'bowl', 250, 14, 34, 6, '', 'wl');
  F('Labneh, veggies & pita', 'wbf', 'veg', 'MED', 1, 'plate', 300, 12, 34, 12, 'dairy gluten', '');
  F('Quinoa porridge', 'wbf', 'vegan', 'CON', 1, 'bowl', 240, 8, 38, 6, 'nuts', '');
  F('Tamagoyaki & miso soup', 'wbf', 'egg', 'ASIA', 1, 'plate', 220, 15, 8, 13, 'egg soy', 'hna');

  // ── Worldwide proteins ──────────────────────────────────────────
  F('Grilled chicken breast', 'wprotein', 'nonveg', 'CON', 100, 'g', 165, 31, 0, 3.6, '', 'wl tr');
  F('Lemon herb chicken', 'wprotein', 'nonveg', 'CON', 120, 'g', 200, 32, 2, 7, '', 'wl');
  F('Chicken shawarma (no mayo)', 'wprotein', 'nonveg', 'MED', 120, 'g', 230, 28, 4, 11, '', '');
  F('Chicken teriyaki', 'wprotein', 'nonveg', 'ASIA', 120, 'g', 230, 28, 10, 8, 'soy', 'hna');
  F('Thai basil chicken', 'wprotein', 'nonveg', 'ASIA', 1, 'cup', 250, 26, 8, 12, 'fish', 'hna');
  F('Kung pao chicken (less oil)', 'wprotein', 'nonveg', 'ASIA', 1, 'cup', 290, 26, 12, 15, 'nuts soy', 'hna');
  F('Chicken fajita strips', 'wprotein', 'nonveg', 'MEX', 120, 'g', 210, 28, 6, 8, '', '');
  F('Baked herb fish', 'wprotein', 'nonveg', 'CON', 150, 'g', 190, 33, 0, 6, 'fish', 'wl');
  F('Grilled salmon', 'wprotein', 'nonveg', 'CON', 120, 'g', 250, 25, 0, 16, 'fish', '');
  F('Steamed fish with ginger & soy', 'wprotein', 'nonveg', 'ASIA', 150, 'g', 180, 30, 3, 5, 'fish soy', 'hna wl');
  F('Garlic prawns', 'wprotein', 'nonveg', 'MED', 120, 'g', 170, 26, 2, 6, 'fish', 'wl');
  F('Tuna salad (no mayo)', 'wprotein', 'nonveg', 'CON', 1, 'cup', 180, 25, 5, 6, 'fish', 'wl tr');
  F('Vegetable frittata', 'wprotein', 'egg', 'MED', 1, 'slice', 200, 14, 4, 14, 'egg', '');
  F('Grilled tofu', 'wprotein', 'vegan', 'ASIA', 120, 'g', 170, 17, 4, 10, 'soy', 'wl');
  F('Mapo tofu (light)', 'wprotein', 'vegan', 'ASIA', 1, 'cup', 220, 15, 8, 14, 'soy', 'hna');
  F('Tempeh stir-fry', 'wprotein', 'vegan', 'ASIA', 100, 'g', 200, 19, 9, 11, 'soy', '');
  F('Baked falafel', 'wprotein', 'vegan', 'MED', 4, 'pc', 220, 9, 26, 9, '', '');
  F('Black bean chili', 'wprotein', 'vegan', 'MEX', 1, 'cup', 230, 14, 36, 3, '', 'wl');
  F('Refried beans (no lard)', 'wprotein', 'vegan', 'MEX', 0.5, 'cup', 120, 7, 18, 2, '', 'hna');
  F('Lentil stew', 'wprotein', 'vegan', 'MED', 1, 'cup', 230, 15, 36, 3, '', 'wl');
  F('Chickpea stew', 'wprotein', 'vegan', 'MED', 1, 'cup', 250, 12, 36, 7, '', '');
  F('Grilled halloumi', 'wprotein', 'veg', 'MED', 60, 'g', 190, 13, 1, 15, 'dairy', 'hsf hna');
  F('Chicken souvlaki', 'wprotein', 'nonveg', 'MED', 120, 'g', 220, 30, 3, 9, '', 'wl');
  F('Paneer steak', 'wprotein', 'veg', 'CON', 100, 'g', 280, 18, 4, 21, 'dairy', 'hsf');
  F('Hummus', 'wprotein', 'vegan', 'MED', 3, 'tbsp', 120, 4, 9, 8, '', '');

  // ── Worldwide carbs ─────────────────────────────────────────────
  F('Whole-wheat pasta', 'wcarb', 'vegan', 'CON', 1, 'cup', 175, 7, 37, 1, 'gluten', '');
  F('Whole-wheat couscous', 'wcarb', 'vegan', 'MED', 1, 'cup', 175, 6, 36, 0.3, 'gluten', '');
  F('Bulgur wheat', 'wcarb', 'vegan', 'MED', 1, 'cup', 150, 6, 34, 0.4, 'gluten', 'wl');
  F('Whole-wheat pita', 'wcarb', 'vegan', 'MED', 1, 'pc', 170, 6, 35, 1.7, 'gluten', 'tr');
  F('Whole-wheat tortilla wrap', 'wcarb', 'vegan', 'MEX', 1, 'pc', 130, 4, 22, 3, 'gluten', 'tr');
  F('Corn tortillas', 'wcarb', 'vegan', 'MEX', 2, 'pc', 110, 3, 23, 1.4, '', '');
  F('Soba noodles', 'wcarb', 'vegan', 'ASIA', 1, 'cup', 115, 6, 24, 0.1, 'gluten', '');
  F('Rice noodles', 'wcarb', 'vegan', 'ASIA', 1, 'cup', 190, 1.6, 42, 0.4, '', 'hgi');
  F('Jasmine rice', 'wcarb', 'vegan', 'ASIA', 1, 'cup', 200, 4, 44, 0.4, '', 'hgi');
  F('Baked potato', 'wcarb', 'vegan', 'CON', 1, 'pc', 160, 4, 37, 0.2, '', 'hgi hk');
  F('Baked sweet potato', 'wcarb', 'vegan', 'CON', 1, 'pc', 115, 2, 27, 0.1, '', 'hk');
  F('Sourdough bread', 'wcarb', 'vegan', 'CON', 2, 'slice', 180, 7, 34, 1.5, 'gluten', '');
  F('Multigrain bread', 'wcarb', 'vegan', 'CON', 2, 'slice', 140, 6, 24, 2, 'gluten', 'tr');
  F('Mexican rice', 'wcarb', 'vegan', 'MEX', 1, 'cup', 230, 4, 42, 5, '', 'hgi');
  F('Pearl barley', 'wcarb', 'vegan', 'CON', 1, 'cup', 190, 3.5, 44, 0.7, 'gluten', 'wl');
  F('Polenta', 'wcarb', 'vegan', 'MED', 1, 'cup', 145, 3, 31, 0.7, '', '');
  F('Cauliflower rice', 'wcarb', 'vegan', 'CON', 1, 'cup', 40, 3, 8, 0.5, '', 'wl');
  F('Zucchini noodles', 'wcarb', 'vegan', 'CON', 1, 'cup', 30, 2, 6, 0.5, '', 'wl');

  // ── Worldwide vegetables & salads ───────────────────────────────
  F('Roasted vegetables', 'wveg', 'vegan', 'CON', 1, 'cup', 90, 2, 12, 4, '', 'wl');
  F('Steamed broccoli', 'wveg', 'vegan', 'CON', 1, 'cup', 55, 4, 11, 0.6, '', 'wl hk');
  F('Sautéed spinach', 'wveg', 'vegan', 'CON', 1, 'cup', 70, 5, 7, 4, '', 'wl hk');
  F('Greek salad (light feta)', 'wveg', 'veg', 'MED', 1, 'bowl', 150, 5, 9, 11, 'dairy', '');
  F('Garden salad with vinaigrette', 'wveg', 'vegan', 'CON', 1, 'bowl', 70, 1.5, 8, 4, '', 'wl');
  F('Tabbouleh', 'wveg', 'vegan', 'MED', 1, 'cup', 120, 3, 16, 6, 'gluten', '');
  F('Fattoush (baked pita)', 'wveg', 'vegan', 'MED', 1, 'bowl', 140, 3, 18, 7, 'gluten', '');
  F('Stir-fried bok choy', 'wveg', 'vegan', 'ASIA', 1, 'cup', 60, 2.5, 5, 4, 'soy', 'wl hna');
  F('Asian stir-fry vegetables', 'wveg', 'vegan', 'ASIA', 1, 'cup', 90, 3, 11, 4.5, 'soy', 'wl hna');
  F('Kimchi', 'wveg', 'vegan', 'ASIA', 0.5, 'cup', 15, 1, 2, 0.2, 'fish', 'hna fx');
  F('Cucumber sesame salad', 'wveg', 'vegan', 'ASIA', 1, 'bowl', 60, 1.5, 6, 3.5, '', 'wl');
  F('Pico de gallo', 'wveg', 'vegan', 'MEX', 0.5, 'cup', 25, 1, 5, 0.2, '', 'wl');
  F('Guacamole', 'wveg', 'vegan', 'MEX', 3, 'tbsp', 80, 1, 4, 7, '', 'hk');
  F('Grilled zucchini & peppers', 'wveg', 'vegan', 'MED', 1, 'cup', 70, 2, 8, 4, '', 'wl');
  F('Ratatouille', 'wveg', 'vegan', 'CON', 1, 'cup', 110, 2.5, 13, 6, '', 'wl');
  F('Light coleslaw', 'wveg', 'veg', 'CON', 0.5, 'cup', 70, 1, 7, 4.5, 'dairy', '');
  F('Green beans with almonds', 'wveg', 'vegan', 'CON', 1, 'cup', 110, 3, 10, 7, 'nuts', '');
  F('Caprese salad (light)', 'wveg', 'veg', 'MED', 1, 'plate', 170, 10, 5, 12, 'dairy', 'hsf');
  F('Baba ganoush', 'wveg', 'vegan', 'MED', 3, 'tbsp', 70, 1.5, 5, 5, '', 'wl');

  // ── Worldwide complete dishes ───────────────────────────────────
  F('Chicken burrito bowl', 'wmain', 'nonveg', 'MEX', 1, 'bowl', 520, 34, 58, 15, '', '');
  F('Bean burrito bowl', 'wmain', 'vegan', 'MEX', 1, 'bowl', 470, 18, 72, 12, '', '');
  F('Chicken shawarma bowl', 'wmain', 'nonveg', 'MED', 1, 'bowl', 500, 34, 48, 18, '', '');
  F('Falafel wrap', 'wmain', 'vegan', 'MED', 1, 'pc', 450, 15, 55, 18, 'gluten', 'tr');
  F('Mediterranean chickpea salad', 'wmain', 'vegan', 'MED', 1, 'bowl', 380, 14, 44, 16, '', 'wl');
  F('Greek chicken salad', 'wmain', 'nonveg', 'MED', 1, 'bowl', 360, 32, 12, 20, 'dairy', 'wl');
  F('Grilled chicken Caesar (light)', 'wmain', 'nonveg', 'CON', 1, 'bowl', 380, 34, 16, 19, 'dairy egg gluten', '');
  F('Tuna Niçoise salad', 'wmain', 'nonveg', 'CON', 1, 'bowl', 400, 30, 24, 20, 'fish egg', '');
  F('Salmon quinoa bowl', 'wmain', 'nonveg', 'CON', 1, 'bowl', 520, 32, 42, 22, 'fish', '');
  F('Tuna poke bowl', 'wmain', 'nonveg', 'ASIA', 1, 'bowl', 480, 30, 58, 12, 'fish soy', 'hna');
  F('Tofu poke bowl', 'wmain', 'vegan', 'ASIA', 1, 'bowl', 450, 20, 58, 15, 'soy', 'hna');
  F('Vegetable sushi rolls', 'wmain', 'vegan', 'ASIA', 8, 'pc', 300, 7, 60, 3, 'soy', 'hgi hna');
  F('Salmon sushi rolls', 'wmain', 'nonveg', 'ASIA', 8, 'pc', 340, 14, 56, 6, 'fish soy', 'hgi hna');
  F('Chicken pho', 'wmain', 'nonveg', 'ASIA', 1, 'bowl', 420, 30, 50, 8, 'fish', 'hna');
  F('Vegetable ramen (light)', 'wmain', 'vegan', 'ASIA', 1, 'bowl', 430, 14, 64, 12, 'gluten soy', 'hna');
  F('Pad thai (light)', 'wmain', 'egg', 'ASIA', 1, 'plate', 480, 18, 62, 17, 'nuts egg fish soy', 'hgi hna');
  F('Thai green curry (chicken) & rice', 'wmain', 'nonveg', 'ASIA', 1, 'plate', 550, 28, 56, 23, 'fish', 'hsf');
  F('Thai green curry (tofu) & rice', 'wmain', 'vegan', 'ASIA', 1, 'plate', 520, 16, 60, 23, 'soy', 'hsf');
  F('Chicken stir-fry with brown rice', 'wmain', 'nonveg', 'ASIA', 1, 'plate', 470, 32, 54, 12, 'soy', 'hna');
  F('Egg fried rice (less oil)', 'wmain', 'egg', 'ASIA', 1, 'plate', 420, 12, 62, 13, 'egg soy', 'hgi hna');
  F('Veg hakka noodles (less oil)', 'wmain', 'vegan', 'ASIA', 1, 'plate', 400, 10, 62, 12, 'gluten soy', 'hna');
  F('Bibimbap', 'wmain', 'egg', 'ASIA', 1, 'bowl', 500, 22, 70, 14, 'egg soy', 'hna');
  F('Japanese chicken curry & rice', 'wmain', 'nonveg', 'ASIA', 1, 'plate', 560, 26, 78, 15, 'gluten', 'hgi');
  F('Whole-wheat pasta primavera', 'wmain', 'veg', 'CON', 1, 'plate', 420, 15, 66, 11, 'gluten dairy', '');
  F('Whole-wheat pasta arrabbiata', 'wmain', 'vegan', 'CON', 1, 'plate', 400, 13, 68, 9, 'gluten', '');
  F('Chicken tomato pasta (whole-wheat)', 'wmain', 'nonveg', 'CON', 1, 'plate', 480, 32, 58, 12, 'gluten', '');
  F('Grilled fish with mash & greens', 'wmain', 'nonveg', 'CON', 1, 'plate', 450, 34, 38, 17, 'fish dairy', '');
  F('Chicken stew with bread', 'wmain', 'nonveg', 'CON', 1, 'plate', 420, 30, 40, 14, 'gluten', '');
  F('Lentil shepherd\'s pie', 'wmain', 'veg', 'CON', 1, 'plate', 400, 17, 58, 11, 'dairy', '');
  F('Stuffed bell peppers (quinoa & paneer)', 'wmain', 'veg', 'CON', 2, 'pc', 380, 18, 44, 14, 'dairy', '');
  F('Chicken tacos (corn)', 'wmain', 'nonveg', 'MEX', 3, 'pc', 420, 28, 40, 16, '', '');
  F('Bean enchiladas (light)', 'wmain', 'veg', 'MEX', 2, 'pc', 450, 18, 58, 15, 'dairy gluten', '');
  F('Vegetable quesadilla (whole-wheat)', 'wmain', 'veg', 'MEX', 1, 'pc', 380, 15, 42, 16, 'dairy gluten', 'hsf');
  F('Moroccan chickpea tagine & couscous', 'wmain', 'vegan', 'MED', 1, 'plate', 480, 16, 76, 12, 'gluten', '');
  F('Mujadara (lentils & rice)', 'wmain', 'vegan', 'MED', 1, 'plate', 430, 16, 70, 9, '', '');
  F('Chicken souvlaki plate', 'wmain', 'nonveg', 'MED', 1, 'plate', 500, 36, 44, 19, 'dairy gluten', '');
  F('Buddha bowl', 'wmain', 'vegan', 'CON', 1, 'bowl', 480, 18, 62, 18, '', '');
  F('Grilled chicken wrap', 'wmain', 'nonveg', 'CON', 1, 'pc', 420, 30, 40, 14, 'gluten', 'tr');
  F('Paneer kathi roll (whole-wheat)', 'wmain', 'veg', 'E', 1, 'pc', 420, 18, 40, 20, 'gluten dairy', 'tr');
  F('Egg roll (whole-wheat, less oil)', 'wmain', 'egg', 'E', 1, 'pc', 350, 14, 36, 16, 'egg gluten', 'tr');

  // ── Travel meals (railway, dhaba, airport, hotel) ───────────────
  F('Veg thali (railway / dhaba)', 'tmain', 'veg', 'IN', 1, 'plate', 620, 18, 96, 17, 'gluten dairy', 'hgi hna tr');
  F('Dal, 2 tandoori roti & salad (dhaba)', 'tmain', 'vegan', 'N', 1, 'plate', 520, 18, 78, 13, 'gluten', 'tr');
  F('Rajma chawal (dhaba)', 'tmain', 'vegan', 'N', 1, 'plate', 520, 16, 88, 9, '', 'hgi tr');
  F('Idli–sambar plate (station)', 'tmain', 'vegan', 'S', 1, 'plate', 330, 11, 58, 6, '', 'hgi tr');
  F('Grilled sandwich (airport)', 'tmain', 'veg', 'CON', 1, 'pc', 350, 14, 40, 14, 'gluten dairy', 'tr');
  F('Hotel salad bar plate with grilled chicken', 'tmain', 'nonveg', 'CON', 1, 'plate', 380, 34, 20, 17, 'dairy', 'wl tr');
  F('Hotel salad bar plate with paneer', 'tmain', 'veg', 'CON', 1, 'plate', 380, 18, 20, 24, 'dairy', 'tr');
  F('Non-veg thali (railway / dhaba)', 'tmain', 'nonveg', 'IN', 1, 'plate', 680, 32, 88, 20, 'gluten dairy', 'hgi hna tr');

  // ── More regional & worldwide foods ─────────────────────────────
  F('Jeera–ajwain–saunf water', 'early', 'vegan', 'IN', 1, 'glass', 8, 0.2, 1.5, 0.1, '', 'wl fx');
  F('Kadha (herbal decoction)', 'early drink', 'vegan', 'IN', 1, 'cup', 15, 0.3, 3, 0, '', 'wl fx');
  F('Lemongrass tea', 'early bed', 'vegan', 'IN', 1, 'cup', 5, 0, 1, 0, '', 'wl fx');
  F('Soaked peanuts', 'earlyadd', 'vegan', 'IN', 10, 'pc', 40, 1.8, 1.1, 3.3, 'nuts', 'fx');
  F('Soaked munakka', 'earlyadd', 'vegan', 'IN', 4, 'pc', 30, 0.3, 7.5, 0, '', 'hgi hk sweet fx');

  F('Ripe jackfruit', 'fruit', 'vegan', 'S', 1, 'cup', 150, 2.8, 38, 1, '', 'hgi');
  F('Bael fruit', 'fruit', 'vegan', 'N', 0.5, 'cup', 70, 1.2, 17, 0.2, '', '');
  F('Star fruit (kamrakh)', 'fruit', 'vegan', 'IN', 1, 'pc', 30, 1, 7, 0.3, '', 'wl hk');
  F('Mulberries (shahtoot)', 'fruit', 'vegan', 'N', 1, 'cup', 60, 2, 14, 0.5, '', 'wl');
  F('Fresh apricots', 'fruit', 'vegan', 'N', 3, 'pc', 50, 1.4, 12, 0.4, '', 'wl tr');
  F('Kinnow (tangerine)', 'fruit', 'vegan', 'N', 1, 'pc', 50, 0.8, 13, 0.3, '', 'wl tr');
  F('Fresh coconut pieces', 'fruit', 'vegan', 'S', 30, 'g', 105, 1, 4.5, 10, '', 'hsf');
  F('Dates (khajur)', 'fruit snack', 'vegan', 'IN', 2, 'pc', 45, 0.4, 12, 0, '', 'hgi sweet tr');
  F('Dried figs (anjeer)', 'fruit snack', 'vegan', 'IN', 2, 'pc', 60, 0.8, 15, 0.2, '', 'sweet tr');
  F('Prunes', 'fruit', 'vegan', 'CON', 3, 'pc', 60, 0.6, 16, 0.1, '', 'sweet');
  F('Raspberries', 'fruit', 'vegan', 'CON', 1, 'cup', 64, 1.5, 15, 0.8, '', 'wl');
  F('Green apple', 'fruit', 'vegan', 'IN', 1, 'pc', 80, 0.4, 21, 0.3, '', 'wl tr');
  F('Avocado (half)', 'fruit', 'vegan', 'CON', 0.5, 'pc', 120, 1.5, 6, 11, '', 'hk');

  F('Mint chaas', 'drink side', 'veg', 'N', 1, 'glass', 45, 2.5, 4, 2, 'dairy', 'wl tr');
  F('Sol kadhi', 'drink', 'vegan', 'W', 1, 'glass', 70, 1, 4, 6, '', 'hsf');
  F('Neer mor (spiced buttermilk)', 'drink', 'veg', 'S', 1, 'glass', 40, 2.5, 3.5, 2, 'dairy', 'wl tr');
  F('Ragi malt (no sugar)', 'drink bfside', 'veg', 'S', 1, 'glass', 120, 4, 20, 2.5, 'dairy', '');
  F('Badam milk (no sugar)', 'drink bed', 'veg', 'IN', 1, 'glass', 160, 8, 12, 9, 'dairy nuts', '');
  F('Sweet lassi (less sugar)', 'drink', 'veg', 'N', 1, 'glass', 180, 7, 26, 5, 'dairy', 'sweet hgi');
  F('Cold coffee (no sugar)', 'drink', 'veg', 'CON', 1, 'glass', 120, 6, 10, 6, 'dairy', 'caf');
  F('Beetroot–carrot juice', 'drink', 'vegan', 'IN', 1, 'glass', 70, 1.5, 16, 0.2, '', 'hk');
  F('Lauki (bottle gourd) juice', 'drink', 'vegan', 'IN', 1, 'glass', 25, 0.8, 5, 0.1, '', 'wl');
  F('Oat milk', 'drink', 'vegan', 'CON', 1, 'glass', 120, 3, 16, 5, '', '');

  F('Chana jor garam', 'snack', 'vegan', 'N', 30, 'g', 120, 6, 16, 3.5, '', 'tr');
  F('Roasted soybeans', 'snack', 'vegan', 'IN', 30, 'g', 130, 11, 9, 6, 'soy', 'wl tr');
  F('Baked ragi chips', 'snack', 'vegan', 'S', 30, 'g', 130, 3, 22, 3.5, '', 'tr');
  F('Jowar puffs', 'snack', 'vegan', 'IN', 1, 'cup', 80, 2, 17, 0.5, '', 'wl tr');
  F('Roasted moong dal namkeen', 'snack', 'vegan', 'N', 30, 'g', 130, 7, 15, 4.5, '', 'hna tr');
  F('Steamed corn on the cob', 'snack', 'vegan', 'IN', 1, 'pc', 90, 3, 19, 1.3, '', 'tr');
  F('Boiled chana salad', 'snack', 'vegan', 'IN', 1, 'cup', 170, 9, 28, 3, '', 'wl');
  F('Kothimbir vadi (steamed)', 'snack', 'vegan', 'W', 3, 'pc', 150, 6, 20, 5, '', '');
  F('Patra (steamed)', 'snack', 'vegan', 'W', 3, 'pc', 140, 4, 20, 5, '', '');
  F('Khandvi', 'snack', 'veg', 'W', 6, 'pc', 130, 6, 12, 6, 'dairy', '');
  F('Chana sundal', 'snack', 'vegan', 'S', 1, 'cup', 150, 8, 24, 3, '', 'wl');
  F('Kuzhi paniyaram (less oil)', 'snack bf', 'vegan', 'S', 4, 'pc', 170, 4, 28, 5, '', '');
  F('Jhal muri (less oil)', 'snack', 'vegan', 'E', 1, 'cup', 150, 4, 26, 4, 'nuts', '');
  F('Date & nut energy bar', 'snack', 'vegan', 'IN', 1, 'pc', 150, 4, 18, 7, 'nuts', 'sweet tr');
  F('Greek yogurt with berries', 'snack', 'veg', 'CON', 1, 'cup', 150, 12, 16, 4, 'dairy', 'wl');
  F('Chicken salad cup', 'snack', 'nonveg', 'CON', 1, 'cup', 160, 22, 5, 6, '', 'wl');
  F('Tuna cucumber bites', 'snack', 'nonveg', 'CON', 1, 'plate', 120, 18, 3, 4, 'fish', 'wl');
  F('Veg rice-paper rolls', 'snack', 'vegan', 'ASIA', 2, 'pc', 140, 3, 28, 1.5, '', '');
  F('Chicken satay (grilled)', 'snack', 'nonveg', 'ASIA', 3, 'pc', 180, 24, 4, 8, 'nuts', '');
  F('Salsa with baked tortilla chips', 'snack', 'vegan', 'MEX', 1, 'bowl', 130, 3, 22, 3.5, '', '');
  F('Bean dip with veg sticks', 'snack', 'vegan', 'MEX', 1, 'bowl', 120, 6, 18, 2.5, '', 'wl');
  F('Small vegetable upma', 'snack', 'vegan', 'S', 0.75, 'cup', 150, 4, 23, 5, 'gluten', '');

  F('Dal shorba', 'soup', 'vegan', 'N', 1, 'bowl', 110, 6, 16, 2.5, '', 'wl');
  F('Mulligatawny soup', 'soup', 'vegan', 'S', 1, 'bowl', 140, 6, 18, 5, '', '');
  F('Carrot–ginger soup', 'soup', 'vegan', 'IN', 1, 'bowl', 80, 1.5, 13, 2.5, '', 'wl');
  F('Beetroot soup', 'soup', 'vegan', 'IN', 1, 'bowl', 80, 2, 14, 2, '', 'wl hk');
  F('Cabbage soup', 'soup', 'vegan', 'CON', 1, 'bowl', 50, 1.5, 8, 1.2, '', 'wl');
  F('Chicken & vegetable soup', 'soup', 'nonveg', 'CON', 1, 'bowl', 120, 14, 8, 3.5, '', 'wl');
  F('Egg drop soup', 'soup', 'egg', 'ASIA', 1, 'bowl', 70, 5, 4, 4, 'egg', 'wl');
  F('Hot & sour soup (veg)', 'soup', 'vegan', 'ASIA', 1, 'bowl', 80, 3, 12, 2, 'soy', 'hna');
  F('Gazpacho', 'soup', 'vegan', 'MED', 1, 'bowl', 80, 2, 10, 4, '', 'wl');

  F('Rava dosa (less oil)', 'bf', 'vegan', 'S', 2, 'pc', 260, 5, 40, 9, 'gluten', 'hgi');
  F('Set dosa', 'bf', 'vegan', 'S', 3, 'pc', 270, 6, 48, 6, '', 'hgi');
  F('Akki roti', 'bf', 'vegan', 'S', 2, 'pc', 260, 5, 48, 5, '', 'hgi');
  F('Jowar upma', 'bf', 'vegan', 'W', 1, 'cup', 190, 6, 34, 4, '', 'wl');
  F('Palak paratha', 'bf', 'vegan', 'N', 1, 'pc', 220, 6, 32, 8, 'gluten', 'tr');
  F('Dal paratha', 'bf', 'vegan', 'N', 1, 'pc', 250, 9, 34, 9, 'gluten', 'tr');
  F('Methi muthia (steamed)', 'bf snack', 'vegan', 'W', 4, 'pc', 220, 7, 32, 7, 'gluten', 'tr');
  F('Kanchipuram idli', 'bf', 'veg', 'S', 3, 'pc', 230, 7, 38, 6, 'dairy', '');
  F('Masala egg toast', 'bf', 'egg', 'IN', 2, 'slice', 300, 15, 28, 14, 'egg gluten', '');
  F('Keema paratha (lean)', 'bf', 'nonveg', 'N', 1, 'pc', 330, 20, 32, 13, 'gluten', '');
  F('Akuri (Parsi scrambled eggs)', 'bf', 'egg', 'W', 1, 'katori', 210, 13, 4, 16, 'egg', '');
  F('Aval upma (Kerala poha)', 'bf', 'vegan', 'S', 1, 'cup', 200, 4, 34, 5.5, '', '');
  F('Oats porridge with milk', 'bf', 'veg', 'IN', 1, 'bowl', 230, 9, 34, 6, 'dairy', '');
  F('Quinoa upma', 'bf', 'vegan', 'IN', 1, 'cup', 210, 7, 32, 6, '', 'wl');
  F('Foxtail millet pongal', 'bf', 'veg', 'S', 1, 'cup', 250, 8, 38, 7, 'dairy', 'wl');
  F('Protein pancakes', 'wbf', 'egg', 'CON', 2, 'pc', 280, 22, 30, 7, 'egg dairy', '');
  F('Berry yogurt smoothie', 'wbf', 'veg', 'CON', 1, 'glass', 200, 10, 32, 3.5, 'dairy', '');
  F('Whole-wheat French toast (light)', 'wbf', 'egg', 'CON', 2, 'slice', 300, 13, 34, 12, 'egg gluten dairy', '');
  F('Baked chilaquiles', 'wbf', 'egg', 'MEX', 1, 'plate', 350, 15, 40, 14, 'egg', '');
  F('Menemen (Turkish eggs)', 'wbf', 'egg', 'MED', 1, 'plate', 240, 13, 10, 16, 'egg', '');
  F('Hummus & veggie toast', 'wbf', 'vegan', 'MED', 2, 'slice', 280, 10, 36, 10, 'gluten', '');
  F('Hotel breakfast plate (eggs, toast, fruit)', 'wbf', 'egg', 'CON', 1, 'plate', 380, 18, 40, 16, 'egg gluten', 'tr');

  F('Ragi mudde', 'grain', 'vegan', 'S', 2, 'pc', 220, 5, 46, 1.5, '', 'wl');
  F('Barnyard (sama) millet rice', 'grain', 'vegan', 'IN', 1, 'cup', 180, 4, 38, 1.5, '', 'wl');
  F('Little millet rice', 'grain', 'vegan', 'S', 1, 'cup', 190, 4, 38, 2, '', 'wl');
  F('Red rice', 'grain', 'vegan', 'E', 1, 'cup', 210, 5, 44, 1.5, '', '');
  F('Coconut rice', 'grain', 'vegan', 'S', 1, 'cup', 300, 5, 44, 11, '', 'hsf');
  F('Tomato rice', 'grain', 'vegan', 'S', 1, 'cup', 250, 5, 44, 6, '', 'hgi');
  F('Matar pulao', 'grain', 'vegan', 'N', 1, 'cup', 260, 6, 44, 6, '', 'hgi');
  F('Mutton biryani', 'grain', 'nonveg', 'N', 1.5, 'cup', 500, 26, 56, 18, '', 'hgi op hsf');
  F('Fish biryani', 'grain', 'nonveg', 'S', 1.5, 'cup', 440, 24, 56, 12, 'fish', 'hgi op');
  F('Prawn pulao', 'grain', 'nonveg', 'W', 1.5, 'cup', 400, 22, 56, 9, 'fish', 'hgi op');
  F('Brown rice khichdi', 'grain', 'vegan', 'IN', 1.5, 'cup', 290, 11, 50, 5, '', 'wl op');
  F('Gujarati masala khichdi', 'grain', 'vegan', 'W', 1.5, 'cup', 320, 11, 52, 7, '', 'op');
  F('Lemon quinoa', 'grain', 'vegan', 'IN', 1, 'cup', 240, 8, 38, 6, '', 'wl');
  F('Nachni (ragi) bhakri', 'grain', 'vegan', 'W', 2, 'pc', 210, 5, 42, 2, '', 'wl');
  F('Dal dhokli', 'grain', 'vegan', 'W', 1.5, 'cup', 330, 12, 50, 8, 'gluten', 'op');
  F('Rumali roti', 'grain', 'vegan', 'N', 2, 'pc', 250, 8, 48, 2, 'gluten', 'hgi');
  F('Palak roti', 'grain', 'vegan', 'N', 2, 'pc', 170, 6, 32, 2, 'gluten', 'wl');
  F('Methi roti', 'grain', 'vegan', 'N', 2, 'pc', 180, 6, 32, 3, 'gluten', 'wl');
  F('Oats roti', 'grain', 'vegan', 'IN', 2, 'pc', 170, 6, 30, 3, 'gluten', 'wl');
  F('Luchi', 'grain', 'vegan', 'E', 2, 'pc', 250, 4, 28, 13, 'gluten', 'fried');

  F('Toor dal (plain)', 'dal', 'vegan', 'IN', 1, 'katori', 130, 8, 19, 2.5, '', 'wl');
  F('Andhra pappu', 'dal', 'vegan', 'S', 1, 'katori', 140, 8, 20, 3, '', 'wl');
  F('Tomato pappu', 'dal', 'vegan', 'S', 1, 'katori', 140, 8, 20, 3.5, '', 'hk');
  F('Mor kuzhambu', 'dal', 'veg', 'S', 1, 'katori', 110, 4, 8, 7, 'dairy', '');
  F('Vatha kuzhambu', 'dal', 'vegan', 'S', 1, 'katori', 120, 2, 10, 8, '', 'hna');
  F('Moth dal', 'dal', 'vegan', 'W', 1, 'katori', 150, 9, 22, 3, '', 'wl');
  F('Varan (Maharashtrian dal)', 'dal', 'vegan', 'W', 1, 'katori', 120, 7, 18, 2.5, '', 'wl');
  F('Aamti', 'dal', 'vegan', 'W', 1, 'katori', 140, 7, 19, 4, '', '');
  F('Sabut masoor dal', 'dal', 'vegan', 'N', 1, 'katori', 140, 9, 20, 2.5, '', 'wl');
  F('Dry chana masala', 'dal', 'vegan', 'N', 1, 'katori', 200, 9, 28, 6, '', 'tr');
  F('Mixed sprouts curry', 'dal', 'vegan', 'IN', 1, 'katori', 150, 9, 22, 3, '', 'wl');

  F('Paneer do pyaza', 'protein', 'veg', 'N', 1, 'katori', 270, 14, 10, 19, 'dairy', 'hsf');
  F('Shahi paneer (light)', 'protein', 'veg', 'N', 1, 'katori', 300, 14, 12, 22, 'dairy nuts', 'hsf');
  F('Tofu tikka masala', 'protein', 'vegan', 'IN', 1, 'katori', 210, 15, 10, 12, 'soy', '');
  F('Grilled soya chaap', 'protein', 'vegan', 'N', 2, 'pc', 200, 20, 12, 8, 'soy gluten', '');
  F('Egg white bhurji', 'protein', 'egg', 'IN', 1, 'katori', 120, 15, 4, 5, 'egg', 'wl');
  F('Chicken saagwala', 'protein', 'nonveg', 'N', 1, 'katori', 240, 24, 7, 13, '', 'hk');
  F('Chicken do pyaza', 'protein', 'nonveg', 'N', 1, 'katori', 250, 24, 8, 13, '', '');
  F('Air-fried chicken 65', 'protein', 'nonveg', 'S', 120, 'g', 230, 26, 8, 10, '', '');
  F('Kadai chicken', 'protein', 'nonveg', 'N', 1, 'katori', 260, 24, 8, 14, '', '');
  F('Pepper chicken (dry)', 'protein', 'nonveg', 'S', 1, 'katori', 230, 26, 4, 12, '', '');
  F('Andhra chicken curry', 'protein', 'nonveg', 'S', 1, 'katori', 260, 24, 6, 15, '', '');
  F('Chicken seekh kebab (grilled)', 'protein', 'nonveg', 'N', 3, 'pc', 220, 24, 4, 12, '', 'wl tr');
  F('Mutton keema (lean)', 'protein', 'nonveg', 'N', 1, 'katori', 280, 22, 6, 18, '', 'hsf');
  F('Rogan josh (lean)', 'protein', 'nonveg', 'N', 1, 'katori', 310, 24, 6, 21, '', 'hsf');
  F('Meen moilee', 'protein', 'nonveg', 'S', 1, 'katori', 250, 21, 6, 16, 'fish', 'hsf');
  F('Air-fried Amritsari fish', 'protein', 'nonveg', 'N', 120, 'g', 220, 24, 10, 9, 'fish', '');
  F('Doi maach', 'protein', 'nonveg', 'E', 1, 'katori', 230, 21, 6, 13, 'fish dairy', '');
  F('Kerala prawn curry', 'protein', 'nonveg', 'S', 1, 'katori', 220, 21, 6, 12, 'fish', '');
  F('Chicken tikka masala (light)', 'protein', 'nonveg', 'N', 1, 'katori', 290, 26, 10, 16, 'dairy', '');

  F('Aloo baingan', 'sabzi', 'vegan', 'N', 1, 'katori', 150, 3, 18, 8, '', 'hk');
  F('Aloo methi', 'sabzi', 'vegan', 'N', 1, 'katori', 150, 3, 18, 8, '', 'hk');
  F('Gatte ki sabzi (steamed gatte)', 'sabzi', 'veg', 'N', 1, 'katori', 200, 8, 20, 10, 'dairy', '');
  F('Snake gourd kootu', 'sabzi', 'vegan', 'S', 1, 'katori', 130, 5, 14, 6, '', 'wl');
  F('Ash gourd curry', 'sabzi', 'vegan', 'S', 1, 'katori', 90, 2, 10, 5, '', 'wl');
  F('Vendakkai poriyal', 'sabzi', 'vegan', 'S', 1, 'katori', 110, 2.5, 10, 7, '', 'wl');
  F('Gutti vankaya (light)', 'sabzi', 'vegan', 'S', 1, 'katori', 160, 3, 12, 11, 'nuts', '');
  F('Mushroom pepper fry', 'sabzi', 'vegan', 'S', 1, 'katori', 110, 4, 8, 7, '', 'wl');
  F('Baby corn capsicum', 'sabzi', 'vegan', 'IN', 1, 'katori', 110, 3, 12, 6, '', 'wl');
  F('Broccoli stir-fry (Indian)', 'sabzi', 'vegan', 'IN', 1, 'katori', 90, 4, 9, 5, '', 'wl');
  F('French beans foogath', 'sabzi', 'vegan', 'W', 1, 'katori', 110, 3, 10, 7, '', 'wl');
  F('Lau ghonto', 'sabzi', 'vegan', 'E', 1, 'katori', 110, 3, 12, 6, '', 'wl');
  F('Air-fried begun bhaja', 'sabzi', 'vegan', 'E', 1, 'katori', 110, 1.5, 10, 7, '', '');
  F('Aloo posto (light)', 'sabzi', 'vegan', 'E', 1, 'katori', 190, 4, 22, 10, '', 'hk');
  F('Dum aloo (light)', 'sabzi', 'vegan', 'N', 1, 'katori', 190, 3, 24, 9, '', 'hk hgi');
  F('Chawli leaves bhaji', 'sabzi', 'vegan', 'W', 1, 'katori', 90, 3.5, 8, 5, '', 'hk wl');
  F('Bathua sabzi', 'sabzi', 'vegan', 'N', 1, 'katori', 90, 3.5, 8, 5, '', 'wl');
  F('Suran (yam) sabzi', 'sabzi', 'vegan', 'W', 1, 'katori', 150, 2, 24, 5, '', 'hk');
  F('Raw papaya sabzi', 'sabzi', 'vegan', 'IN', 1, 'katori', 80, 1.2, 11, 3.5, '', 'wl');

  F('Pineapple raita', 'side', 'veg', 'N', 0.5, 'katori', 70, 2.5, 9, 2.5, 'dairy', 'sweet');
  F('Beetroot raita', 'side', 'veg', 'IN', 0.5, 'katori', 55, 2.5, 6, 2.5, 'dairy', '');
  F('Carrot–cabbage salad', 'side', 'vegan', 'IN', 1, 'bowl', 45, 1.5, 9, 0.3, '', 'wl');
  F('Koshimbir', 'side', 'vegan', 'W', 1, 'bowl', 60, 2, 6, 3, 'nuts', 'wl');
  F('Sprouts kosambari', 'side', 'vegan', 'S', 1, 'bowl', 90, 6, 14, 1, '', 'wl');
  F('Low-fat curd', 'side bfside', 'veg', 'IN', 1, 'katori', 70, 6, 8, 1.5, 'dairy', 'wl tr');

  F('Grilled prawns', 'wprotein', 'nonveg', 'CON', 120, 'g', 140, 26, 1, 3, 'fish', 'wl');
  F('Chickpea patties', 'wprotein', 'vegan', 'MED', 2, 'pc', 200, 9, 26, 7, '', '');
  F('Tofu teriyaki', 'wprotein', 'vegan', 'ASIA', 120, 'g', 190, 16, 10, 9, 'soy', 'hna');
  F('Moroccan spiced chicken', 'wprotein', 'nonveg', 'MED', 120, 'g', 230, 30, 6, 9, '', 'wl');
  F('Lentil patties', 'wprotein', 'vegan', 'CON', 2, 'pc', 200, 11, 28, 5, '', '');

  F('Brown rice noodles', 'wcarb', 'vegan', 'ASIA', 1, 'cup', 190, 4, 40, 1.5, '', '');
  F('Wild rice', 'wcarb', 'vegan', 'CON', 1, 'cup', 165, 6.5, 35, 0.6, '', 'wl');
  F('Farro', 'wcarb', 'vegan', 'MED', 1, 'cup', 200, 7, 40, 1.5, 'gluten', '');
  F('Herb roasted potatoes', 'wcarb', 'vegan', 'CON', 1, 'cup', 180, 3, 30, 6, '', 'hk hgi');
  F('Whole-wheat garlic bread (light)', 'wcarb', 'veg', 'CON', 2, 'slice', 200, 6, 30, 6, 'gluten dairy', '');

  F('Roasted cauliflower', 'wveg', 'vegan', 'CON', 1, 'cup', 90, 3, 9, 5, '', 'wl');
  F('Roasted beetroot salad', 'wveg', 'vegan', 'CON', 1, 'bowl', 110, 3, 16, 4, '', 'hk');
  F('Kale salad', 'wveg', 'vegan', 'CON', 1, 'bowl', 100, 3, 10, 6, '', 'hk wl');
  F('Mushroom stir-fry', 'wveg', 'vegan', 'ASIA', 1, 'cup', 70, 3, 6, 4, 'soy', 'hna wl');
  F('Sautéed green beans', 'wveg', 'vegan', 'CON', 1, 'cup', 70, 2, 8, 4, '', 'wl');
  F('Quinoa salad', 'wveg', 'vegan', 'MED', 1, 'cup', 180, 6, 26, 6, '', 'wl');
  F('Corn & bean salad', 'wveg', 'vegan', 'MEX', 1, 'cup', 160, 7, 26, 3.5, '', '');
  F('Tzatziki', 'wveg', 'veg', 'MED', 3, 'tbsp', 45, 2, 2, 3, 'dairy', 'wl');

  F('Light vegetable lasagna', 'wmain', 'veg', 'CON', 1, 'plate', 420, 20, 48, 16, 'gluten dairy', 'hsf');
  F('Chicken fried rice (less oil)', 'wmain', 'nonveg', 'ASIA', 1, 'plate', 450, 24, 58, 13, 'egg soy', 'hgi hna');
  F('Teriyaki salmon bowl', 'wmain', 'nonveg', 'ASIA', 1, 'bowl', 520, 32, 58, 16, 'fish soy', 'hna');
  F('Korean tofu stew', 'wmain', 'egg', 'ASIA', 1, 'bowl', 300, 18, 14, 18, 'soy egg', 'hna');
  F('Vietnamese chicken salad', 'wmain', 'nonveg', 'ASIA', 1, 'bowl', 320, 28, 20, 13, 'fish', 'wl');
  F('Green papaya salad (som tam)', 'wmain', 'nonveg', 'ASIA', 1, 'bowl', 150, 5, 24, 4, 'fish nuts', 'hna wl');
  F('Pasta e fagioli', 'wmain', 'vegan', 'MED', 1, 'bowl', 380, 16, 60, 8, 'gluten', '');
  F('Chicken quinoa salad', 'wmain', 'nonveg', 'CON', 1, 'bowl', 420, 32, 36, 15, '', 'wl');
  F('Mexican quinoa bowl', 'wmain', 'vegan', 'MEX', 1, 'bowl', 450, 17, 64, 13, '', '');
  F('Hummus chicken wrap', 'wmain', 'nonveg', 'MED', 1, 'pc', 440, 30, 42, 16, 'gluten', 'tr');
  F('Thai red curry (tofu, light) & rice', 'wmain', 'vegan', 'ASIA', 1, 'plate', 480, 16, 58, 20, 'soy', 'hsf');
  F('Light mushroom risotto', 'wmain', 'veg', 'CON', 1, 'plate', 420, 11, 64, 12, 'dairy', 'hgi');
  F('Grilled chicken with sweet potato', 'wmain', 'nonveg', 'CON', 1, 'plate', 420, 36, 38, 12, '', 'wl hk');
  F('Baked fish tacos', 'wmain', 'nonveg', 'MEX', 3, 'pc', 400, 26, 40, 14, 'fish', '');
  F('Lentil bolognese pasta', 'wmain', 'vegan', 'CON', 1, 'plate', 430, 20, 68, 8, 'gluten', '');

  F('Thepla & curd (packed)', 'tmain', 'veg', 'W', 1, 'plate', 330, 10, 38, 14, 'gluten dairy', 'tr');
  F('Airport salad bowl', 'tmain', 'veg', 'CON', 1, 'bowl', 300, 10, 30, 15, 'dairy', 'tr wl');
  F('Veg sub (6-inch, whole-wheat)', 'tmain', 'veg', 'CON', 1, 'pc', 330, 14, 50, 8, 'gluten dairy', 'tr');
  F('Chicken sub (6-inch, whole-wheat)', 'tmain', 'nonveg', 'CON', 1, 'pc', 380, 26, 46, 9, 'gluten', 'tr');
  F('Dhaba paneer & roti', 'tmain', 'veg', 'N', 1, 'plate', 600, 24, 60, 28, 'dairy gluten', 'hsf tr');
  F('Dhaba chicken & roti', 'tmain', 'nonveg', 'N', 1, 'plate', 620, 40, 58, 24, 'gluten', 'tr');
  F('Khichdi & curd (dhaba)', 'tmain', 'veg', 'IN', 1, 'plate', 420, 14, 64, 11, 'dairy', 'tr');

  // Classic pairings (by name) used alongside random combinations.
  const PRESETS = [
    ['breakfast', ['Idli (breakfast)', 'Sambar', 'Coconut chutney']],
    ['breakfast', ['Plain dosa (less oil)', 'Sambar', 'Tomato chutney']],
    ['breakfast', ['Masala dosa (less oil)', 'Sambar', 'Coconut chutney']],
    ['breakfast', ['Pesarattu (green moong dosa)', 'Ginger chutney']],
    ['breakfast', ['Moong dal chilla', 'Mint–coriander chutney']],
    ['breakfast', ['Methi thepla (breakfast)', 'Curd']],
    ['breakfast', ['Paneer paratha', 'Curd']],
    ['breakfast', ['Appam', 'Kerala chicken stew']],
    ['breakfast', ['Puttu', 'Kadala curry']],
    ['breakfast', ['Masala omelette', 'Multigrain toast']],
    ['lunch', ['Rajma', 'Steamed rice', 'Onion–cucumber salad']],
    ['lunch', ['Chole', 'Phulka', 'Onion–cucumber salad']],
    ['lunch', ['Sarson ka saag', 'Makki roti', 'Chaas (buttermilk)']],
    ['lunch', ['Maacher jhol (Bengali fish curry)', 'Steamed rice', 'Masoor dal']],
    ['lunch', ['Sambar', 'Steamed rice', 'Beans poriyal', 'Chaas (buttermilk)']],
    ['lunch', ['Avial', 'Kerala matta rice', 'Sambar']],
    ['lunch', ['Pithla', 'Jowar bhakri', 'Green salad']],
    ['lunch', ['Gujarati dal', 'Gujarati rotli', 'Undhiyu (light)', 'Chaas (buttermilk)']],
    ['dinner', ['Moong dal khichdi', 'Kadhi (no pakoda)']],
    ['dinner', ['Lauki sabzi', 'Moong dal', 'Phulka']],
  ];

  // Hindi names (foodnames.js) make search and non-English charts work.
  const HI = typeof module !== 'undefined' && module.exports ? require('./foodnames.js') : root.FOOD_HI || {};
  FOODS.forEach((f) => { f.hi = HI[f.name] || ''; });

  // Every dish has a recipe (recipes.js): kcal, protein, carbs and fat are recalculated
  // from its ingredients (ingredients.js), and the diet type is checked against them.
  const node = typeof module !== 'undefined' && module.exports;
  const RC = node ? require('./recipes.js') : root.RECIPES;
  const ING = node ? require('./ingredients.js') : root.INGREDIENTS;
  if (RC && ING) {
    RC.applyRecipes(FOODS, ING);
    // Ingredients are searchable foods too (per 100 g / 100 ml), for manual editing.
    const names = new Set(FOODS.map((f) => f.name));
    Object.values(ING).forEach((x) => {
      if (names.has(x.name)) return;
      const t = x.tags;
      const diet = t.some((m) => m === 'chicken' || m === 'mutton' || m === 'fish') ? 'nonveg' : t.includes('egg') ? 'egg' : t.includes('dairy') || x.key === 'honey' ? 'veg' : 'vegan';
      const liquid = x.cat === 'drink' || /milk|juice|water/i.test(x.name);
      FOODS.push({
        id: FOODS.length, name: x.name, hi: x.hi, roles: ['ingredient'], diet, region: 'IN',
        qty: 100, unit: liquid ? 'ml' : 'g', kcal: x.kcal, p: x.p, c: x.c, f: x.f,
        allergens: ['gluten', 'dairy', 'nuts', 'soy', 'egg', 'fish'].filter((a) => t.includes(a)),
        flags: [], ingKey: x.key, cat: x.cat,
        meats: diet === 'nonveg' ? t.filter((m) => m === 'chicken' || m === 'mutton' || m === 'fish') : undefined,
      });
    });
  }

  const api = { FOODS, PRESETS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FOODDB = api;
})(typeof window !== 'undefined' ? window : globalThis);
