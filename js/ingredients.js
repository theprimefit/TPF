/*
 * Ingredient table: nutrition per 100 g (raw unless stated), with a Hindi name,
 * allergen / diet tags and a category. Recipes (recipes.js) are built from these,
 * so every dish's kcal, protein, carbs and fat is calculated from its ingredients.
 * Values follow the Indian Food Composition Tables (IFCT 2017) and USDA
 * FoodData Central, rounded.
 *
 * I(key, name, hindi, kcal, protein, carbs, fat, category, tags)
 *   category  grain pulse dairy egg meat fish veg leafy fruit nut fat sweet spice drink other
 *   tags      dairy egg chicken mutton fish gluten nuts soy · staple (not listed as a "main" ingredient)
 */
(function (root) {
  const ING = {};
  function I(key, name, hi, kcal, p, c, f, cat, tags) {
    ING[key] = { key, name, hi, kcal, p, c, f, cat, tags: tags ? tags.split(' ') : [] };
  }

  // Grains, flours & breads
  I('atta', 'Whole-wheat flour (atta)', 'गेहूं का आटा', 341, 12.1, 69.4, 1.7, 'grain', 'gluten');
  I('mgatta', 'Multigrain atta', 'मल्टीग्रेन आटा', 350, 12.5, 66, 3, 'grain', 'gluten');
  I('maida', 'Refined flour (maida)', 'मैदा', 348, 10, 74, 0.9, 'grain', 'gluten');
  I('rice', 'Rice (raw)', 'चावल', 356, 7, 78, 0.5, 'grain');
  I('brice', 'Brown rice (raw)', 'ब्राउन राइस', 360, 7.5, 76, 2.7, 'grain');
  I('rrice', 'Red / matta rice (raw)', 'लाल चावल', 350, 7.5, 76, 2, 'grain');
  I('poha', 'Poha (flattened rice)', 'पोहा', 346, 6.6, 77, 1.2, 'grain');
  I('rava', 'Rava / suji (semolina)', 'रवा / सूजी', 348, 10.4, 72, 0.8, 'grain', 'gluten');
  I('dalia', 'Dalia (broken wheat)', 'दलिया', 342, 11.8, 69, 1.5, 'grain', 'gluten');
  I('oats', 'Rolled oats', 'ओट्स', 389, 13, 67, 7, 'grain');
  I('ragi', 'Ragi (finger millet) flour', 'रागी आटा', 328, 7.3, 72, 1.3, 'grain');
  I('jowar', 'Jowar (sorghum) flour', 'ज्वार आटा', 349, 10.4, 72.6, 1.9, 'grain');
  I('bajra', 'Bajra (pearl millet) flour', 'बाजरा आटा', 361, 11.6, 67, 5, 'grain');
  I('makki', 'Makki (maize) flour', 'मक्के का आटा', 362, 9, 73, 3.8, 'grain');
  I('besan', 'Besan (gram flour)', 'बेसन', 387, 22, 58, 6.7, 'pulse');
  I('cornflour', 'Cornflour', 'कॉर्नफ्लोर', 381, 0.3, 91, 0.1, 'grain', 'staple');
  I('quinoa', 'Quinoa (raw)', 'क्विनोआ', 368, 14, 64, 6, 'grain');
  I('foxtail', 'Foxtail millet (kangni)', 'कंगनी', 351, 12.3, 60, 4.3, 'grain');
  I('kodo', 'Kodo millet', 'कोदो', 353, 8.3, 66, 1.4, 'grain');
  I('sama', 'Barnyard millet (sama)', 'सामा', 342, 6.2, 65, 2.2, 'grain');
  I('kutki', 'Little millet (kutki)', 'कुटकी', 341, 7.7, 67, 4.7, 'grain');
  I('sabudana', 'Sabudana (sago)', 'साबूदाना', 351, 0.2, 87, 0.2, 'grain');
  I('semiya', 'Vermicelli (semiya)', 'सेवई', 350, 10, 75, 1, 'grain', 'gluten');
  I('pasta', 'Whole-wheat pasta (dry)', 'गेहूं का पास्ता', 348, 14, 70, 2.5, 'grain', 'gluten');
  I('wheatnoodle', 'Wheat noodles (dry)', 'नूडल्स', 350, 12, 72, 1.5, 'grain', 'gluten');
  I('ricenoodle', 'Rice noodles (dry)', 'राइस नूडल्स', 364, 6, 80, 0.6, 'grain');
  I('brnoodle', 'Brown rice noodles (dry)', 'ब्राउन राइस नूडल्स', 360, 8, 78, 2.5, 'grain');
  I('soba', 'Soba noodles (dry)', 'सोबा नूडल्स', 336, 14, 75, 0.7, 'grain', 'gluten');
  I('couscous', 'Whole-wheat couscous (dry)', 'कूसकूस', 376, 12.8, 77, 0.6, 'grain', 'gluten');
  I('bulgur', 'Bulgur wheat (dry)', 'बुलगर', 342, 12.3, 76, 1.3, 'grain', 'gluten');
  I('barley', 'Pearl barley (dry)', 'जौ', 352, 9.9, 78, 1.2, 'grain', 'gluten');
  I('farro', 'Farro (dry)', 'फ़ारो', 340, 14, 68, 2.5, 'grain', 'gluten');
  I('wildrice', 'Wild rice (dry)', 'वाइल्ड राइस', 357, 14.7, 75, 1.1, 'grain');
  I('cornmeal', 'Cornmeal / polenta (dry)', 'मक्का दलिया', 370, 8, 79, 1.8, 'grain');
  I('ctortilla', 'Corn tortilla', 'मक्का टॉर्टिला', 218, 5.7, 45, 2.9, 'grain');
  I('wtortilla', 'Whole-wheat tortilla', 'गेहूं टॉर्टिला', 300, 9, 50, 7.5, 'grain', 'gluten');
  I('mgbread', 'Multigrain bread', 'मल्टीग्रेन ब्रेड', 265, 13, 43, 4.2, 'grain', 'gluten');
  I('wwbread', 'Whole-wheat bread', 'ब्राउन ब्रेड', 250, 12, 43, 3.5, 'grain', 'gluten');
  I('sourdough', 'Sourdough bread', 'सावरडो ब्रेड', 270, 10.8, 51, 1.8, 'grain', 'gluten');
  I('pita', 'Whole-wheat pita', 'पीटा ब्रेड', 266, 9.8, 55, 2.6, 'grain', 'gluten');
  I('ricepaper', 'Rice paper', 'राइस पेपर', 340, 6, 80, 0.5, 'grain');
  I('muesli', 'Muesli (no sugar)', 'म्यूसली', 370, 10, 66, 6, 'grain', 'gluten nuts');
  I('sattu', 'Sattu (roasted gram flour)', 'सत्तू', 406, 22, 65, 5, 'pulse');
  I('murmura', 'Murmura (puffed rice)', 'मुरमुरे', 402, 6.3, 90, 0.5, 'grain');
  I('makhana', 'Makhana (fox nuts)', 'मखाना', 347, 9.7, 77, 0.1, 'grain');
  I('popcorn', 'Popcorn kernels', 'पॉपकॉर्न', 375, 11, 74, 4.5, 'grain');
  I('ricecake', 'Rice cakes', 'राइस केक', 387, 8, 81, 3, 'grain');
  I('khakhra', 'Multigrain khakhra', 'खाखरा', 400, 12, 60, 12, 'grain', 'gluten');
  I('papad', 'Papad (urad)', 'पापड़', 371, 25, 59, 3, 'pulse');
  I('ragichips', 'Baked ragi chips', 'रागी चिप्स', 430, 8, 70, 12, 'grain');
  I('jowarpuff', 'Jowar puffs', 'ज्वार पफ्स', 370, 10, 75, 3, 'grain');

  // Pulses, soy & legumes (dry unless stated)
  I('toor', 'Toor / arhar dal', 'अरहर दाल', 343, 22, 58, 1.5, 'pulse');
  I('moong', 'Moong dal (split)', 'मूंग दाल', 348, 24.5, 59.9, 1.2, 'pulse');
  I('wmoong', 'Whole green moong', 'साबुत मूंग', 334, 23.9, 56.7, 1.3, 'pulse');
  I('masoor', 'Masoor dal', 'मसूर दाल', 343, 25, 59, 1, 'pulse');
  I('chanadal', 'Chana dal', 'चना दाल', 360, 20.8, 60, 5.6, 'pulse');
  I('urad', 'Urad dal', 'उड़द दाल', 341, 24, 59.6, 1.4, 'pulse');
  I('rajma', 'Rajma (kidney beans)', 'राजमा', 333, 22.5, 60.6, 0.8, 'pulse');
  I('kchana', 'Kabuli chana (chickpeas)', 'काबुली चना', 364, 19.3, 61, 6, 'pulse');
  I('kalachana', 'Kala chana (black gram)', 'काला चना', 360, 17.1, 60.9, 5.3, 'pulse');
  I('roastchana', 'Roasted chana', 'भुने चने', 369, 22, 58, 5, 'pulse');
  I('lobia', 'Lobia (black-eyed peas)', 'लोबिया', 336, 23.5, 60, 1.3, 'pulse');
  I('moth', 'Moth / matki beans', 'मोठ', 343, 23, 61.5, 1.6, 'pulse');
  I('kulthi', 'Kulthi (horse gram)', 'कुलथी', 321, 22, 57, 0.5, 'pulse');
  I('soya', 'Soya chunks', 'सोया चंक्स', 345, 52, 33, 0.5, 'pulse', 'soy');
  I('soybean', 'Roasted soybeans', 'भुनी सोयाबीन', 471, 35, 34, 25, 'pulse', 'soy');
  I('chaap', 'Soya chaap', 'सोया चाप', 180, 20, 12, 6, 'pulse', 'soy gluten');
  I('sprouts', 'Moong sprouts', 'मूंग स्प्राउट्स', 105, 7.5, 18, 0.5, 'pulse');
  I('msprouts', 'Mixed sprouts', 'मिक्स स्प्राउट्स', 110, 8, 19, 0.8, 'pulse');
  I('peas', 'Green peas', 'हरी मटर', 81, 5.4, 14.5, 0.4, 'veg');
  I('bbeans', 'Beans, cooked (black / kidney)', 'पकी बीन्स', 132, 8.9, 23.7, 0.5, 'pulse');
  I('chickpea', 'Chickpeas, cooked', 'उबले छोले', 164, 8.9, 27, 2.6, 'pulse');
  I('favabeans', 'Fava beans, cooked', 'बाकला (पका)', 110, 7.6, 19.6, 0.4, 'pulse');
  I('edamame', 'Edamame', 'एडामामे', 121, 11.9, 8.9, 5.2, 'pulse', 'soy');
  I('peanut', 'Peanuts', 'मूंगफली', 567, 25.8, 16.1, 49, 'nut', 'nuts');
  I('tofu', 'Tofu (firm)', 'टोफू', 144, 15.6, 3.5, 8.7, 'pulse', 'soy');
  I('tempeh', 'Tempeh', 'टेम्पे', 192, 20, 7.6, 10.8, 'pulse', 'soy');
  I('soymilk', 'Soy milk (unsweetened)', 'सोया दूध', 45, 3.3, 3, 2, 'drink', 'soy');
  I('hummus', 'Hummus', 'हम्मस', 166, 7.9, 14.3, 9.6, 'pulse');
  I('miso', 'Miso paste', 'मिसो', 199, 12, 26, 6, 'pulse', 'soy');

  // Dairy
  I('milk', 'Toned milk', 'टोंड दूध', 60, 3.1, 4.7, 3, 'dairy', 'dairy');
  I('skim', 'Skimmed milk', 'स्किम्ड दूध', 34, 3.4, 5, 0.1, 'dairy', 'dairy');
  I('curd', 'Curd (dahi)', 'दही', 60, 3.1, 4.7, 3, 'dairy', 'dairy');
  I('lfcurd', 'Low-fat curd', 'कम वसा दही', 63, 5.3, 7, 1.6, 'dairy', 'dairy');
  I('greek', 'Greek yogurt (low-fat)', 'ग्रीक योगर्ट', 95, 10, 4.5, 4, 'dairy', 'dairy');
  I('labneh', 'Labneh (strained yogurt)', 'लबनेह', 150, 8, 5, 11, 'dairy', 'dairy');
  I('paneer', 'Paneer', 'पनीर', 265, 18.3, 1.2, 20.8, 'dairy', 'dairy');
  I('cottage', 'Cottage cheese', 'कॉटेज चीज़', 98, 11, 3.4, 4.3, 'dairy', 'dairy');
  I('cheese', 'Cheese (cheddar-type)', 'चीज़', 400, 25, 1.3, 33, 'dairy', 'dairy');
  I('mozz', 'Mozzarella', 'मोज़रेला', 280, 28, 3, 17, 'dairy', 'dairy');
  I('feta', 'Feta cheese', 'फ़ेटा चीज़', 264, 14, 4, 21, 'dairy', 'dairy');
  I('halloumi', 'Halloumi', 'हालूमी', 321, 21, 2, 25, 'dairy', 'dairy');
  I('ghee', 'Ghee', 'घी', 900, 0, 0, 100, 'fat', 'dairy');
  I('butter', 'Butter', 'मक्खन', 717, 0.9, 0.1, 81, 'fat', 'dairy');
  I('cream', 'Fresh cream', 'क्रीम', 340, 2, 3, 36, 'dairy', 'dairy');
  I('whey', 'Whey protein powder', 'व्हे प्रोटीन', 400, 80, 8, 5, 'dairy', 'dairy');
  I('plantp', 'Plant (pea) protein powder', 'प्लांट प्रोटीन', 380, 73, 13, 6.5, 'pulse');
  I('proteinbar', 'Protein bar', 'प्रोटीन बार', 380, 33, 40, 11, 'other', 'dairy nuts');

  // Eggs, meat & fish (raw, edible portion)
  I('egg', 'Egg (whole)', 'अंडा', 143, 12.6, 0.7, 9.5, 'egg', 'egg');
  I('eggw', 'Egg white', 'अंडे की सफेदी', 52, 10.9, 0.7, 0.2, 'egg', 'egg');
  I('chicken', 'Chicken breast (boneless)', 'चिकन ब्रेस्ट', 120, 22.5, 0, 2.6, 'meat', 'chicken');
  I('chickenc', 'Chicken curry cut (boneless thigh)', 'चिकन', 150, 19, 0, 8, 'meat', 'chicken');
  I('ckeema', 'Chicken mince', 'चिकन कीमा', 143, 17.4, 0, 8.1, 'meat', 'chicken');
  I('mutton', 'Mutton (lean)', 'मटन', 143, 20.5, 0, 6.5, 'meat', 'mutton');
  I('keema', 'Mutton mince', 'मटन कीमा', 250, 17, 0, 20, 'meat', 'mutton');
  I('fish', 'Fish (rohu / basa / pomfret)', 'मछली', 100, 19, 0, 2.5, 'fish', 'fish');
  I('salmon', 'Salmon', 'सैल्मन', 208, 20, 0, 13, 'fish', 'fish');
  I('prawn', 'Prawns', 'झींगा', 85, 20, 0.2, 0.5, 'fish', 'fish');
  I('tuna', 'Tuna (in water)', 'टूना', 116, 25.5, 0, 0.8, 'fish', 'fish');

  // Vegetables
  I('onion', 'Onion', 'प्याज़', 40, 1.1, 9.3, 0.1, 'veg', 'staple');
  I('tomato', 'Tomato', 'टमाटर', 18, 0.9, 3.9, 0.2, 'veg', 'staple');
  I('ginger', 'Ginger', 'अदरक', 80, 1.8, 18, 0.8, 'veg', 'staple');
  I('garlic', 'Garlic', 'लहसुन', 149, 6.4, 33, 0.5, 'veg', 'staple');
  I('chilli', 'Green chilli', 'हरी मिर्च', 40, 2, 9.5, 0.2, 'veg', 'staple');
  I('coriander', 'Coriander leaves', 'हरा धनिया', 23, 2.1, 3.7, 0.5, 'leafy');
  I('mint', 'Mint leaves', 'पुदीना', 44, 3.3, 8.4, 0.7, 'leafy');
  I('potato', 'Potato', 'आलू', 77, 2, 17, 0.1, 'veg');
  I('spotato', 'Sweet potato', 'शकरकंद', 86, 1.6, 20, 0.1, 'veg');
  I('spinach', 'Spinach (palak)', 'पालक', 23, 2.9, 3.6, 0.4, 'leafy');
  I('methi', 'Fenugreek leaves (methi)', 'मेथी', 49, 4.4, 6, 0.9, 'leafy');
  I('sarson', 'Mustard greens (sarson)', 'सरसों का साग', 27, 2.9, 4.7, 0.4, 'leafy');
  I('bathua', 'Bathua leaves', 'बथुआ', 43, 4.2, 7.3, 0.8, 'leafy');
  I('amaranth', 'Amaranth leaves (chaulai)', 'चौलाई', 23, 2.5, 4, 0.3, 'leafy');
  I('greens', 'Lettuce & salad greens', 'सलाद पत्ते', 15, 1.4, 2.9, 0.2, 'leafy');
  I('kale', 'Kale', 'केल', 49, 4.3, 8.8, 0.9, 'leafy');
  I('bokchoy', 'Bok choy', 'बोक चॉय', 13, 1.5, 2.2, 0.2, 'leafy');
  I('cauli', 'Cauliflower', 'फूलगोभी', 25, 1.9, 5, 0.3, 'veg');
  I('cabbage', 'Cabbage', 'पत्ता गोभी', 25, 1.3, 5.8, 0.1, 'veg');
  I('broccoli', 'Broccoli', 'ब्रोकली', 34, 2.8, 6.6, 0.4, 'veg');
  I('okra', 'Okra (bhindi)', 'भिंडी', 33, 1.9, 7.5, 0.2, 'veg');
  I('lauki', 'Bottle gourd (lauki)', 'लौकी', 15, 0.6, 3.4, 0, 'veg');
  I('tinda', 'Tinda', 'टिंडा', 21, 1.4, 3.4, 0.2, 'veg');
  I('turai', 'Ridge gourd (turai)', 'तोरई', 20, 1.2, 4.4, 0.2, 'veg');
  I('karela', 'Bitter gourd (karela)', 'करेला', 17, 1, 3.7, 0.2, 'veg');
  I('parwal', 'Pointed gourd (parwal)', 'परवल', 20, 2, 2.2, 0.3, 'veg');
  I('tindora', 'Ivy gourd (tindora)', 'टिंडोरा', 18, 1.2, 3.1, 0.1, 'veg');
  I('gawar', 'Cluster beans (gawar)', 'ग्वार फली', 35, 3.2, 6, 0.4, 'veg');
  I('beans', 'French beans', 'फ्रेंच बीन्स', 31, 1.8, 7, 0.2, 'veg');
  I('carrot', 'Carrot', 'गाजर', 41, 0.9, 9.6, 0.2, 'veg');
  I('beet', 'Beetroot', 'चुकंदर', 43, 1.6, 9.6, 0.2, 'veg');
  I('radish', 'Radish (mooli)', 'मूली', 16, 0.7, 3.4, 0.1, 'veg');
  I('brinjal', 'Brinjal (baingan)', 'बैंगन', 25, 1, 5.9, 0.2, 'veg');
  I('capsicum', 'Capsicum', 'शिमला मिर्च', 20, 0.9, 4.6, 0.2, 'veg');
  I('pumpkin', 'Pumpkin (kaddu)', 'कद्दू', 26, 1, 6.5, 0.1, 'veg');
  I('ashgourd', 'Ash gourd', 'पेठा', 13, 0.4, 3, 0.2, 'veg');
  I('snakegourd', 'Snake gourd', 'चिचिंडा', 18, 0.5, 3.3, 0.3, 'veg');
  I('drumstick', 'Drumstick (moringa pods)', 'सहजन', 37, 2.1, 8.5, 0.2, 'veg');
  I('mushroom', 'Mushroom', 'मशरूम', 22, 3.1, 3.3, 0.3, 'veg');
  I('babycorn', 'Baby corn', 'बेबी कॉर्न', 26, 2.5, 5, 0.2, 'veg');
  I('corn', 'Sweet corn', 'स्वीट कॉर्न', 86, 3.3, 19, 1.4, 'veg');
  I('rawbanana', 'Raw banana', 'कच्चा केला', 122, 1.3, 32, 0.4, 'veg');
  I('jackfruitraw', 'Raw jackfruit', 'कच्चा कटहल', 50, 2, 9, 0.3, 'veg');
  I('arbi', 'Colocasia (arbi)', 'अरबी', 112, 1.5, 26, 0.2, 'veg');
  I('suran', 'Elephant yam (suran)', 'सूरन', 118, 1.5, 28, 0.2, 'veg');
  I('rawpapaya', 'Raw papaya', 'कच्चा पपीता', 39, 0.6, 9.8, 0.1, 'veg');
  I('rawmango', 'Raw mango', 'कच्चा आम', 44, 0.5, 11, 0.2, 'veg');
  I('cucumber', 'Cucumber', 'खीरा', 15, 0.7, 3.6, 0.1, 'veg');
  I('zucchini', 'Zucchini', 'ज़ुकीनी', 17, 1.2, 3.1, 0.3, 'veg');
  I('mixveg', 'Mixed vegetables', 'मिक्स सब्ज़ियां', 35, 2, 7, 0.3, 'veg');
  I('kersangri', 'Ker sangri (dried)', 'केर सांगरी', 200, 10, 40, 2, 'veg');
  I('kimchi', 'Kimchi (vegan)', 'किमची', 15, 1.1, 2.4, 0.5, 'veg');
  I('tomatopuree', 'Tomato puree', 'टमाटर प्यूरी', 38, 1.6, 9, 0.2, 'veg', 'staple');

  // Fruits
  I('apple', 'Apple', 'सेब', 52, 0.3, 14, 0.2, 'fruit');
  I('pear', 'Pear', 'नाशपाती', 57, 0.4, 15, 0.1, 'fruit');
  I('banana', 'Banana', 'केला', 89, 1.1, 23, 0.3, 'fruit');
  I('orange', 'Orange', 'संतरा', 47, 0.9, 12, 0.1, 'fruit');
  I('mosambi', 'Sweet lime (mosambi)', 'मौसमी', 43, 0.8, 9.3, 0.3, 'fruit');
  I('kinnow', 'Kinnow', 'किन्नू', 53, 0.8, 13, 0.3, 'fruit');
  I('guava', 'Guava', 'अमरूद', 68, 2.6, 14, 1, 'fruit');
  I('papaya', 'Papaya', 'पपीता', 43, 0.5, 11, 0.3, 'fruit');
  I('watermelon', 'Watermelon', 'तरबूज', 30, 0.6, 7.6, 0.2, 'fruit');
  I('muskmelon', 'Muskmelon', 'खरबूजा', 34, 0.8, 8.2, 0.2, 'fruit');
  I('pomegranate', 'Pomegranate', 'अनार', 83, 1.7, 19, 1.2, 'fruit');
  I('pineapple', 'Pineapple', 'अनानास', 50, 0.5, 13, 0.1, 'fruit');
  I('mango', 'Mango', 'आम', 60, 0.8, 15, 0.4, 'fruit');
  I('grapes', 'Grapes', 'अंगूर', 69, 0.7, 18, 0.2, 'fruit');
  I('chikoo', 'Chikoo (sapota)', 'चीकू', 83, 0.4, 20, 1.1, 'fruit');
  I('kiwi', 'Kiwi', 'कीवी', 61, 1.1, 15, 0.5, 'fruit');
  I('strawberry', 'Strawberries', 'स्ट्रॉबेरी', 32, 0.7, 7.7, 0.3, 'fruit');
  I('blueberry', 'Blueberries', 'ब्लूबेरी', 57, 0.7, 14, 0.3, 'fruit');
  I('raspberry', 'Raspberries', 'रास्पबेरी', 52, 1.2, 12, 0.7, 'fruit');
  I('berries', 'Mixed berries', 'मिक्स बेरी', 50, 0.9, 12, 0.4, 'fruit');
  I('jamun', 'Jamun', 'जामुन', 60, 0.7, 14, 0.2, 'fruit');
  I('plum', 'Plum', 'आलूबुखारा', 46, 0.7, 11.4, 0.3, 'fruit');
  I('peach', 'Peach', 'आड़ू', 39, 0.9, 9.5, 0.3, 'fruit');
  I('apricot', 'Apricot', 'खुबानी', 48, 1.4, 11, 0.4, 'fruit');
  I('custardapple', 'Custard apple', 'सीताफल', 94, 2.1, 24, 0.3, 'fruit');
  I('fig', 'Fresh fig', 'अंजीर', 74, 0.8, 19, 0.3, 'fruit');
  I('litchi', 'Litchi', 'लीची', 66, 0.8, 16.5, 0.4, 'fruit');
  I('cherry', 'Cherries', 'चेरी', 63, 1.1, 16, 0.2, 'fruit');
  I('dragonfruit', 'Dragon fruit', 'ड्रैगन फ्रूट', 60, 1.2, 13, 0, 'fruit');
  I('amla', 'Amla', 'आंवला', 44, 0.9, 10, 0.6, 'fruit');
  I('jackfruitr', 'Ripe jackfruit', 'पका कटहल', 95, 1.7, 23, 0.6, 'fruit');
  I('bael', 'Bael', 'बेल', 137, 1.8, 32, 0.3, 'fruit');
  I('starfruit', 'Star fruit', 'कमरख', 31, 1, 6.7, 0.3, 'fruit');
  I('mulberry', 'Mulberries', 'शहतूत', 43, 1.4, 9.8, 0.4, 'fruit');
  I('coconut', 'Fresh coconut', 'नारियल', 354, 3.3, 15, 33, 'nut');
  I('avocado', 'Avocado', 'एवोकाडो', 160, 2, 8.5, 14.7, 'fruit');
  I('dates', 'Dates', 'खजूर', 282, 2.5, 75, 0.4, 'fruit');
  I('dfig', 'Dried figs', 'सूखे अंजीर', 249, 3.3, 64, 0.9, 'fruit');
  I('prune', 'Prunes', 'सूखा आलूबुखारा', 240, 2.2, 64, 0.4, 'fruit');
  I('raisin', 'Raisins / munakka', 'किशमिश', 299, 3, 79, 0.5, 'fruit');
  I('lemon', 'Lemon juice', 'नींबू रस', 22, 0.4, 6.9, 0.2, 'fruit', 'staple');

  // Nuts & seeds
  I('almond', 'Almonds', 'बादाम', 579, 21, 22, 50, 'nut', 'nuts');
  I('walnut', 'Walnuts', 'अखरोट', 654, 15, 14, 65, 'nut', 'nuts');
  I('cashew', 'Cashews', 'काजू', 553, 18, 30, 44, 'nut', 'nuts');
  I('mixednuts', 'Mixed nuts', 'मिक्स मेवे', 607, 20, 21, 54, 'nut', 'nuts');
  I('trailmix', 'Trail mix', 'ट्रेल मिक्स', 470, 13, 40, 30, 'nut', 'nuts');
  I('pbutter', 'Peanut butter', 'पीनट बटर', 588, 25, 20, 50, 'nut', 'nuts');
  I('pumpkinseed', 'Pumpkin seeds', 'कद्दू के बीज', 559, 30, 11, 49, 'nut');
  I('sunflower', 'Sunflower seeds', 'सूरजमुखी के बीज', 584, 21, 20, 51, 'nut');
  I('chia', 'Chia seeds', 'चिया बीज', 486, 17, 42, 31, 'nut');
  I('flax', 'Flaxseed (alsi)', 'अलसी', 534, 18, 29, 42, 'nut');
  I('sesame', 'Sesame seeds / tahini', 'तिल', 573, 18, 23, 50, 'nut');
  I('seeds', 'Mixed seeds', 'मिक्स बीज', 560, 25, 20, 45, 'nut');
  I('poppy', 'Poppy seeds (posto)', 'खसखस', 525, 18, 28, 42, 'nut');
  I('methiseed', 'Fenugreek seeds', 'मेथी दाना', 323, 23, 58, 6.4, 'spice');

  // Fats, sweeteners, sauces & flavourings
  I('oil', 'Cooking oil', 'तेल', 884, 0, 0, 100, 'fat', 'staple');
  I('olive', 'Olive oil', 'जैतून का तेल', 884, 0, 0, 100, 'fat', 'staple');
  I('sugar', 'Sugar', 'चीनी', 387, 0, 100, 0, 'sweet', 'staple');
  I('jaggery', 'Jaggery (gur)', 'गुड़', 383, 0.4, 98, 0.1, 'sweet', 'staple');
  I('honey', 'Honey', 'शहद', 304, 0.3, 82, 0, 'sweet', 'staple');
  I('coconutmilk', 'Coconut milk', 'नारियल का दूध', 197, 2, 2.8, 21.3, 'fat');
  I('tamarind', 'Tamarind pulp', 'इमली', 239, 2.8, 62, 0.6, 'spice', 'staple');
  I('kokum', 'Kokum', 'कोकम', 60, 1, 14, 0.5, 'fruit');
  I('soysauce', 'Soy sauce', 'सोया सॉस', 53, 8, 4.9, 0.6, 'spice', 'soy staple');
  I('spice', 'Spices (mixed)', 'मसाले', 300, 12, 50, 10, 'spice', 'staple');

  // Drinks
  I('tea', 'Tea (brewed)', 'चाय', 1, 0, 0.3, 0, 'drink', 'staple');
  I('greentea', 'Green tea (brewed)', 'ग्रीन टी', 1, 0.2, 0, 0, 'drink');
  I('herbal', 'Herbal tea (brewed)', 'हर्बल चाय', 1, 0, 0.2, 0, 'drink');
  I('coffee', 'Coffee (brewed)', 'कॉफी', 2, 0.1, 0, 0, 'drink');
  I('coconutwater', 'Tender coconut water', 'नारियल पानी', 19, 0.7, 3.7, 0.2, 'drink');
  I('almondmilk', 'Almond milk (unsweetened)', 'बादाम दूध', 15, 0.6, 0.6, 1.2, 'drink', 'nuts');
  I('oatmilk', 'Oat milk', 'ओट मिल्क', 48, 1.2, 6.5, 2, 'drink');
  I('amlajuice', 'Amla juice', 'आंवला रस', 50, 0.5, 11, 0.2, 'drink');
  I('aloe', 'Aloe vera juice', 'एलोवेरा रस', 4, 0, 1, 0, 'drink');
  I('wheatgrass', 'Wheatgrass juice', 'व्हीटग्रास रस', 50, 4, 6, 0.5, 'drink');
  I('moongnamkeen', 'Roasted moong dal namkeen', 'मूंग दाल नमकीन', 430, 24, 50, 14, 'pulse');

  if (typeof module !== 'undefined' && module.exports) module.exports = ING;
  else root.INGREDIENTS = ING;
})(typeof window !== 'undefined' ? window : globalThis);
