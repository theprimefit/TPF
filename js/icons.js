/*
 * Food and meal icons (emoji, so they need no image files and print in the PDF).
 * foodIcon() matches the food name first, then its category / role.
 */
(function (root) {
  // Checked in order: the first keyword found in the name wins.
  const BY_NAME = [
    ['dalchini', '🍵'], ['herbal', '🍵'], ['prawn', '🦐'], ['shrimp', '🦐'], ['salmon', '🐟'], ['tuna', '🐟'], ['fish', '🐟'], ['maach', '🐟'], ['meen', '🐟'], ['sushi', '🍣'],
    ['chicken', '🍗'], ['mutton', '🍖'], ['lamb', '🍖'], ['keema', '🍖'], ['rogan', '🍖'],
    ['omelette', '🍳'], ['bhurji', '🍳'], ['scrambled', '🍳'], ['akuri', '🍳'], ['frittata', '🍳'], ['egg', '🥚'], ['anda', '🥚'], ['tamagoyaki', '🥚'],
    ['paneer', '🧀'], ['cheese', '🧀'], ['feta', '🧀'], ['halloumi', '🧀'], ['tofu', '🧊'], ['tempeh', '🧊'],
    ['biryani', '🍛'], ['pulao', '🍚'], ['khichdi', '🍲'], ['congee', '🍚'], ['rice', '🍚'], ['bath', '🍚'], ['pongal', '🍚'],
    ['dosa', '🥞'], ['uttapam', '🥞'], ['chilla', '🥞'], ['cheela', '🥞'], ['pancake', '🥞'], ['appam', '🥞'], ['adai', '🥞'], ['pesarattu', '🥞'],
    ['idli', '🍘'], ['dhokla', '🍘'], ['momo', '🥟'], ['dumpling', '🥟'], ['modak', '🥟'],
    ['paratha', '🫓'], ['roti', '🫓'], ['phulka', '🫓'], ['chapati', '🫓'], ['naan', '🫓'], ['thepla', '🫓'], ['bhakri', '🫓'], ['rotli', '🫓'], ['kulcha', '🫓'], ['luchi', '🫓'], ['puri', '🫓'], ['tortilla', '🫓'], ['pita', '🫓'], ['wrap', '🌯'], ['kathi roll', '🌯'], ['frankie roll', '🌯'], ['burrito', '🌯'], ['frankie', '🌯'], ['taco', '🌮'], ['quesadilla', '🌮'], ['enchilada', '🌮'],
    ['sandwich', '🥪'], ['toast', '🍞'], ['bread', '🍞'], ['sub ', '🥪'], ['burger', '🍔'],
    ['pasta', '🍝'], ['spaghetti', '🍝'], ['lasagna', '🍝'], ['noodle', '🍜'], ['ramen', '🍜'], ['pho', '🍜'], ['soba', '🍜'], ['pad thai', '🍜'], ['hakka', '🍜'],
    ['soup', '🍲'], ['shorba', '🍲'], ['rasam', '🍲'], ['stew', '🍲'], ['curry', '🍛'], ['sambar', '🍲'], ['kadhi', '🍲'],
    ['dal', '🥣'], ['rajma', '🫘'], ['chole', '🫘'], ['chana', '🫘'], ['lobia', '🫘'], ['beans', '🫘'], ['sprout', '🌱'], ['hummus', '🫘'], ['falafel', '🧆'],
    ['salad', '🥗'], ['raita', '🥣'], ['koshimbir', '🥗'], ['kachumber', '🥗'],
    ['oats', '🥣'], ['porridge', '🥣'], ['muesli', '🥣'], ['dalia', '🥣'], ['upma', '🥣'], ['poha', '🥣'], ['granola', '🥣'], ['smoothie', '🥤'], ['bowl', '🥣'],
    ['coffee', '☕'], ['tea', '🍵'], ['kahwa', '🍵'], ['lassi', '🥛'], ['chaas', '🥛'], ['buttermilk', '🥛'], ['milk', '🥛'], ['doodh', '🥛'], ['curd', '🥣'], ['yogurt', '🥣'], ['dahi', '🥣'],
    ['coconut water', '🥥'], ['juice', '🧃'], ['water', '💧'], ['nimbu', '🍋'], ['lemon', '🍋'], ['jaljeera', '🧃'], ['panna', '🧃'], ['sattu drink', '🥤'],
    ['apple', '🍎'], ['banana', '🍌'], ['orange', '🍊'], ['mosambi', '🍊'], ['kinnow', '🍊'], ['mango', '🥭'], ['grape', '🍇'], ['watermelon', '🍉'], ['melon', '🍈'],
    ['pineapple', '🍍'], ['pear', '🍐'], ['peach', '🍑'], ['cherry', '🍒'], ['strawberr', '🍓'], ['berries', '🫐'], ['kiwi', '🥝'], ['coconut', '🥥'], ['papaya', '🍈'], ['guava', '🍐'], ['pomegranate', '🍎'], ['anar', '🍎'], ['chikoo', '🥔'], ['fig', '🍑'], ['dates', '🌴'], ['amla', '🍏'], ['jamun', '🫐'], ['fruit', '🍓'],
    ['almond', '🌰'], ['walnut', '🌰'], ['nut', '🥜'], ['peanut', '🥜'], ['chikki', '🥜'], ['makhana', '🍿'], ['popcorn', '🍿'], ['murmura', '🍿'], ['bhel', '🍿'], ['chana chor', '🥜'], ['seed', '🌻'], ['chia', '🌱'], ['flax', '🌱'],
    ['laddoo', '🟤'], ['ladoo', '🟤'], ['kheer', '🍮'], ['halwa', '🍮'], ['dessert', '🍮'],
    ['corn', '🌽'], ['bhutta', '🌽'], ['potato', '🥔'], ['aloo', '🥔'], ['sweet potato', '🍠'], ['shakarkandi', '🍠'], ['carrot', '🥕'], ['gajar', '🥕'], ['mushroom', '🍄'],
    ['broccoli', '🥦'], ['palak', '🥬'], ['spinach', '🥬'], ['saag', '🥬'], ['methi', '🌿'], ['greens', '🥬'], ['cabbage', '🥬'], ['bok choy', '🥬'], ['cucumber', '🥒'], ['okra', '🫛'], ['bhindi', '🫛'], ['peas', '🫛'], ['matar', '🫛'], ['beetroot', '🫜'],
    ['brinjal', '🍆'], ['baingan', '🍆'], ['tomato', '🍅'], ['capsicum', '🫑'], ['pepper', '🫑'], ['pumpkin', '🎃'], ['kaddu', '🎃'], ['onion', '🧅'], ['garlic', '🧄'], ['ginger', '🫚'], ['chilli', '🌶️'],
    ['lauki', '🥒'], ['tinda', '🥒'], ['turai', '🥒'], ['karela', '🥒'], ['gourd', '🥒'], ['zucchini', '🥒'], ['cauliflower', '🥦'], ['gobi', '🥦'],
    ['tikka', '🍢'], ['kebab', '🍢'], ['skewer', '🍢'], ['grill', '🍢'], ['pakoda', '🥟'], ['samosa', '🥟'], ['vada', '🍩'], ['cutlet', '🥮'], ['tikki', '🥮'],
    ['chaat', '🥗'], ['sabzi', '🥘'], ['bhaji', '🥘'], ['poriyal', '🥘'], ['thoran', '🥘'], ['avial', '🥘'], ['undhiyu', '🥘'], ['thali', '🍱'], ['meal', '🍱'], ['plate', '🍱'],
    ['oil', '🫗'], ['ghee', '🧈'], ['butter', '🧈'], ['honey', '🍯'], ['jaggery', '🟫'], ['sugar', '🧂'], ['spice', '🧂'], ['flour', '🌾'], ['atta', '🌾'], ['wheat', '🌾'], ['millet', '🌾'], ['ragi', '🌾'], ['jowar', '🌾'], ['bajra', '🌾'], ['quinoa', '🌾'],
  ];
  const BY_ROLE = {
    early: '💧', earlyadd: '🌰', bed: '🥛', drink: '🥤', fruit: '🍎', snack: '🥜', soup: '🍲', bf: '🍳', bfside: '🥣', wbf: '🥞',
    grain: '🫓', dal: '🥣', protein: '🍢', sabzi: '🥘', side: '🥗', wprotein: '🍢', wcarb: '🍠', wveg: '🥦', wmain: '🍱', tmain: '🍱',
  };
  const BY_CAT = { grain: '🌾', pulse: '🫘', dairy: '🥛', egg: '🥚', meat: '🍗', fish: '🐟', veg: '🥕', leafy: '🥬', fruit: '🍎', nut: '🥜', fat: '🫗', sweet: '🍯', spice: '🧂', drink: '🥤', other: '🍽️' };
  const SLOT = { early: '🌅', breakfast: '🍳', midmorning: '🍎', lunch: '🍛', evening: '☕', dinner: '🍲', bedtime: '🌙' };

  // Keywords match at the start of a word ("tea" must not match "steamed").
  const RULES = BY_NAME.map(([w, icon]) => [new RegExp('(^|[^a-z])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), icon]);
  const cache = new Map();
  function foodIcon(food) {
    if (!food) return '🍽️';
    const key = food.name;
    if (cache.has(key)) return cache.get(key);
    const n = food.name.toLowerCase() + ' ';
    const hit = RULES.find(([re]) => re.test(n));
    const icon = hit ? hit[1] : (food.cat && BY_CAT[food.cat]) || BY_ROLE[food.roles && food.roles[0]] || '🍽️';
    cache.set(key, icon);
    return icon;
  }
  const slotIcon = (slot) => SLOT[slot] || '🍽️';

  const api = { foodIcon, slotIcon, SLOT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ICONS = api;
})(typeof window !== 'undefined' ? window : globalThis);
