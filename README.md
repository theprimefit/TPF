# Hindivine Diet

**Hindivine Healthcare Private Limited** · www.hindivine.com

Hindivine Diet builds personalised **1–7 day Indian and worldwide diet charts** with a **recipe for every dish**, and prints them as branded **A4 PDFs**. It runs as a web page, an Android app or an iOS app, works offline, and keeps all data on the device.

## Features

- **Dashboard and menu:**
  - The dashboard shows patients, saved charts, recipes and foods, quick actions (New chart, Next week, Upload PDF, Patients, Saved charts, Recipes, Food library, Settings), the last chart and recent charts.
  - A side menu and a bottom tab bar reach every screen.
- **Step-by-step chart wizard:** 1 Patient → 2 Diet plan & targets → 3 Food preferences → 4 Days & language → 5 Dietitian & create.
  - **Patient data is optional:** age, sex, height and weight can be left blank; standard targets are used instead.
  - **Days:** 1 to 7 days, by day name (no dates).
  - **Two languages:** a second chart language can be added.
  - **Water:** set the daily water target, or leave it on auto.
- **Recipes:** all 671 dishes have a recipe (ingredients in grams, method, nutrition), built from 238 ingredients.
  - Each dish's **kcal, protein, carbs and fat are calculated from its ingredients** (IFCT 2017 / USDA values).
  - Recipes scale by servings and print on A4. Tap a dish in a chart to see its recipe, and add recipes to the chart PDF as extra A4 pages.
- **Foods:** 865 searchable foods: the 671 dishes plus 194 ingredients per 100 g. All have icons and Hindi names.
  - Meals are combined from them, giving 44 lakh+ (4.4 million+) combinations.
- **Diet types:**
  - Weight loss and gain, balanced, and high protein.
  - Medical: diabetic, PCOS, thyroid, BP, heart, fatty liver, kidney.
  - Pregnancy and lactation, and travel diets.
- **Food type:** veg, Jain, egg, non-veg or vegan.
  - **Diet combinations:** Veg + Egg, Egg + Non-veg, Veg + Chicken, Veg + Fish, Egg + Chicken, Egg + Fish, Chicken + Fish. Only the chosen animal foods appear.
- **Health conditions:** with any condition, the chart never includes foods from its own "avoid" list. Recipes are checked for sugar, maida, jaggery/honey (diabetes/PCOS), papad and soy sauce (BP/kidney), butter and cream (cholesterol), and fried or sweet dishes.
- **Preferences:** calorie-wise and protein-wise targets, liked foods and foods to avoid (typed), quick exclusions, allergies and cuisines.
- **Manual control:** edit any meal (including ingredients), add your own foods, copy meals to other days, lock and swap meals.
- **Patients & saved charts:**
  - Every chart is saved automatically, with its patient.
  - Each patient page shows the chart history (Week 1, 2, 3…).
  - Any chart can be opened, edited, reprinted or deleted.
- **Next week:** one tap makes next week's chart with the same patient and settings but **fully changed foods**. About 95–100% of the main foods change.
- **Upload previous PDF:** choose last week's PDF to read it back.
  - **Charts made with Hindivine Diet** carry hidden chart data, so they are read exactly (patient, targets, every meal). You can then edit the chart or generate next week.
  - **Other PDFs:** the foods in them are found by name, in any of the 10 languages, and avoided in the new chart.
- **A4 PDF:**
  - **Pages:** 1 page for short charts (1–3 days, when they fit), otherwise 2 pages. Text scales automatically to fit.
  - **Versions:** with or without the patient name.
  - **Extras:** meal icons, optional recipe pages, and a "Download the Hindivine Patient App from Play Store or App Store" band on the last page.
  - **Signature:** none needed.
- **Languages:** English, हिन्दी, मराठी, ગુજરાતી, বাংলা, ਪੰਜਾਬੀ, தமிழ், తెలుగు, ಕನ್ನಡ, മലയാളം. Any two can be combined.
- **Backup:** export or import all patients and charts as a file (Settings). CSV export is also available.

## Apps

| Platform | How |
| --- | --- |
| **Android** | Install [`dist/HindivineDiet.apk`](dist/HindivineDiet.apk) (Android 7.0+). |
| **iPhone / iPad** | **Now:** host this folder on HTTPS (e.g. hindivine.com/diet) and open it in Safari, then *Share → Add to Home Screen*. It installs as an offline app (`manifest.webmanifest`, `sw.js`). **App Store:** the Xcode project is in `ios-app/`, see below. |
| **Web** | Open `index.html`, or run `npm start`. |

### Building the iOS app (needs a Mac)

```sh
cd ios-app
npm install
npm run sync      # copies the web app into the Xcode project
npm run open      # opens Xcode
```

In Xcode, choose your Apple Developer team under *Signing & Capabilities*, then *Product → Archive* to upload to App Store Connect or TestFlight. The native `MainViewController` (in `AppDelegate.swift`) connects **PDF** to the iOS print sheet (PDF upload uses the standard iOS file picker) (share → Save to Files) and **CSV** to the share sheet.

## Rebuilding the Android app

```sh
VERSION_CODE=5 VERSION_NAME=5.0 ./android/build.sh    # needs Java 11+, curl, zip/unzip
```

The script doesn't use the Android SDK or Gradle. It downloads `aapt2` (bundled in apktool), `dx`, `apksig` and the Android API jar from Maven Central into `android/.tools/`, then compiles, dexes and signs the app.

**Signing key:** the build signs with `android/release.p12` (password `dietchart`; override with `KEYSTORE` and `STOREPASS`), and creates it if it's missing. It's git-ignored. Keep a copy, because Android only installs an update over an existing install when both are signed with the same key.

## Test

```sh
npm test             # Node 18+, no dependencies
```

## Structure

| Path | Purpose |
| --- | --- |
| `index.html` | Form, results and the A4 print sheet container |
| `css/styles.css` | Brand styles, dark mode, A4 print layout |
| `js/fooddb.js` | Dishes (671) with roles, regions, allergens and flags; nutrition is recalculated from recipes |
| `js/ingredients.js` | 238 ingredients with nutrition per 100 g and Hindi names |
| `js/recipes.js` | Recipe (ingredients in grams + method) for every dish, nutrition calculation |
| `js/icons.js` | Food and meal icons |
| `js/store.js` | Saved patients and charts, backup, and chart data inside PDFs |
| `vendor/pdfjs/` | PDF.js 3.11 (Apache-2.0), to read uploaded charts |
| `js/foodnames.js` | Hindi name for every food (used for search and translated charts) |
| `js/i18n.js` | Chart translations for 10 languages and script conversion |
| `js/planner.js` | Diet plans, targets, filtering, portioning, weekly plan, guidelines |
| `js/app.js` | Dashboard, wizard, chart view, meal editor, patients, recipes, upload, A4 PDF and CSV export |
| `manifest.webmanifest`, `sw.js` | Installable offline web app (iPhone / Android) |
| `ios-app/` | Capacitor iOS project (Xcode) |
| `img/` | Hindivine logo and icons |
| `android/` | Android WebView wrapper and build script |
| `dist/HindivineDiet.apk` | Built Android app |
| `tests/` | Unit tests (planner, recipes, storage, PDF read-back) |

## Disclaimer

Nutrition values are approximate. This tool supports, and does not replace, the judgement of a doctor or registered dietitian.
