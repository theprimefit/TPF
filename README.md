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

## Hindivine Admin app (`admin/`) — version 4.0

A separate app for running the clinic. **Android:** install [`dist/HindivineAdmin.apk`](dist/HindivineAdmin.apk) (Android 7.0+, built for Android 15 so Play Protect accepts it; installs next to Hindivine Diet). **Web / iPhone:** open `admin/index.html`, or host the folder and *Add to Home Screen*.

**Logins.** Every person signs in with their own name and PIN (4–6 digits, a random 6-digit PIN is suggested). PINs are shared through the Google Sheet, so they work on every device. The Super Admin adds, edits, disables and deletes logins, and can see and reset staff PINs (the Super Admin PIN is never shown).

| Role | Default access (editable in Settings → Roles & permissions) |
| --- | --- |
| **Super Admin** | Everything, always |
| **Admin** | Everything except Settings; can delete records |
| **Manager** | Dashboard, Today, OPD, Leads, sales, patients, renewals, products, inventory, purchases, expenses, reports, activity log |
| **Front Desk** | OPD appointments and Leads (their own leads and unassigned ones) |

The app logs out after 15 minutes without use. On Android, back goes to the previous screen and exits only with a second press on the home screen. Bottom menu: **Dashboard · Today · Sale · OPD · Inventory**.

| Area | What it does |
| --- | --- |
| **Dashboard** | **Customize** which sections show (per login); tap almost any box to open that screen already filtered (e.g. Injection sales → Sales filtered to injections, Unpaid → unpaid appointments, Low stock → low items). Today's OPD, revenue, profit and renewals; *Order required* banner; sales, OPD, patients, leads, team and stock summaries (available stock first); revenue vs expenses by month. Periods: today, this month (updates automatically), any chosen month, last month, year, all time or custom dates. |
| **Today Summary** | Injection, protein and diet sales in separate boxes (protein has no New / Renewal), sales with the **reference (team member) on every sale**, sales by reference for the whole team, purchases, OPD, expenses, stock available and not available for any day. **Protein and Mounjaro 10mg / 15mg below 2 show “Order required”** (the limit is editable per item). Export as A4 **PDF**, one A4 **JPEG** image or **Excel**, with options: choose the parts to include and filter by sale type, reference and new / renewal patients. Patient details (mobile, age / gender, city) can be added. The default export is the sales list only: patient, product, amount, type (New / Renewal) and reference. |
| **OPD Appointments** | Clinic visit or online, fee ₹1000 (editable), optional **treatment / service**, patient age / gender and vitals (weight, height, BMI calculated, BP, pulse, sugar), day view and filtered list, complete / paid / no-show / cancel, WhatsApp confirmation, **doctor** and **clinic / branch** for every appointment (add, rename, delete in Settings → Doctors & clinics), **OPD slip PDF** (token and slip number, clinic address and phone, vitals with automatic **BMI**, patient details and visit number, doctor, clinic, treatment, payment, vitals, Rx space, next visit and signature). |
| **Leads (CRM)** | Name, mobiles, age, gender, city, source, interest, priority (hot / warm / cold), stage, assigned person, follow-up date and time, weight / target / height (BMI), budget, notes. Pipeline by stage, due-today and overdue follow-ups, call / WhatsApp, update history (who and when), book an OPD appointment from the lead (converts it), conversion rate, leads per person. |
| **Filters & exports** | Search and filters on almost every screen (Today, Sales, OPD, Leads, Patients by gender / age / city, Renewals, Products, Inventory, Purchases by vendor / product, Team, Incentives, Salary, Expenses, Activity) with one-tap Clear. Every PDF / image / Excel export opens options: format, a different period for that file, summary boxes on or off; the file follows the screen's filters. |
| **Invoices (non-GST)** | Purchase invoices name the item "Weight Loss Program" (or "Weight Loss Program (3 Months)"; months on the sale or in the invoice options; name editable) instead of the product. **Share on WhatsApp**: invoices and OPD slips open in the patient's WhatsApp chat with the PDF attached (Android), or the phone's share sheet / WhatsApp link (browser). Premium A4 invoice for every patient purchase (Sales list and Today) and every OPD consultation (appointment sheet): number per financial year (HV/INV/26-27/0001, HV/OPD/26-27/0001; prefix editable), clinic and patient details, items, total, amount in words, paid / due and payment method, terms & legal notes, "computer-generated, no signature required". Reports, images and OPD slips print the note set in Settings → Clinic & doctors. |
| **Sign-in records** | Every sign-in, sign-out, wrong PIN and auto-lock is saved in the activity log (and the Google Sheet) with the device; Activity → "Sign-ins & security" filter and last sign-in per person. |
| **WhatsApp leads (MyOperator / Heyo)** | Log in to MyOperator **inside the app** — no webhook, no export file. Settings → WhatsApp → **Open MyOperator & read chats** opens your panel (`in.app.myoperator.com/chat`) in a logged-in WebView; the app reads the chat names and numbers straight off the screen (and the panel's live fetch/XHR/WebSocket JSON), auto-scrolls to load more, and makes a lead for each number. **Every chat becomes a lead** by default (the old "Hello! Can I get more info on this?" filter is off; re-add a phrase in the box to filter). Even when the list shows only contact names, the app reads the number behind each name (from the chat's link or data attribute). Numbers already a lead or patient are skipped. Whoever a chat is assigned to on MyOperator becomes the lead's *Assigned to* after you match each MyOperator person to a staff login once (unknown people are listed for matching). Set your own WhatsApp number(s) so sent messages aren't counted as new leads. The app makes no request of its own and never sees the password — it reads only what the panel shows on screen. The WhatsApp screen lists these chats with unread counts, chat view and Reply on WhatsApp. |
| **Follow-up reminders** | Bell in the top bar with the number due; reminder list (overdue and today's follow-ups, OPD waiting, order required, renewals) shown once a day at sign-in; pop-up when a follow-up time arrives; on Android a phone notification at the follow-up time even when the app is closed; snooze (+1 h, 15 min, tomorrow). Front Desk get their own follow-ups; others choose all or only theirs (account menu). Leads have a **Follow-ups** tab (overdue / today / tomorrow / this week / later) and one-tap times (in 1 hour, today 6 PM, tomorrow 11 AM, in 3 days, next week). |
| **Look & feel** | Seven colour themes (Royal Blue, Black & Gold, Rose Gold, Emerald, Royal Purple, Sunset, dark Midnight) with the Plus Jakarta Sans font chosen per device from the side menu or account menu; side menu with profile, search and quick + Sale / + OPD / + Lead; animated menus and cards; screens behave like an app (text is not selectable, inputs still are). |
| **Sales** | Injection, protein and diet support, with the patient's age, gender and city (filled in automatically for known patients). Incentive per unit: person + product amount → product amount → person's own rate → default (₹1000 per injection, ₹500 per protein sale); set them all in Incentives → **Product-wise incentive**, split single / 50-50 / custom %. Every injection pen also takes its **kit** out of stock: travel bag 1, ice gel 1, alcohol swabs 16, needles 2 (editable, can be switched off). |
| **Patients** | Search, active / inactive, visits and spend; edit or delete a patient (with their sales and appointments). |
| **Stock** | Products, inventory with kit usage, per-item low-stock alert on/off (or all alerts off), “order required” limits, purchases, custom categories. |
| **Team & money** | Per-person incentive rates and **pay counts** (salary + incentive, salary only or incentive only), personal logins, salary sheet, incentives, expenses. |
| **Reports** | Overview, Today, OPD, Leads, Sales, Team, Financial, Stock, Purchases, Expenses, Renewals, Activity, each with its own filters; PDF / Excel for every report, or all reports in one file. |
| **Activity log** | Every change with who made it and when, per-person summary, export. **What's new** lists all versions. |
| **Choice lists** | Expense categories, services, lead sources and stages, payment methods, designations and inventory categories: “+ Add new…” in any drop-down, rename or remove in Settings. |

Developed by **Aamir Sk · Hindivine Digital Marketing Team**.

**Google Sheet data storage:** all data is stored in the [Hindivine Google Sheet](https://docs.google.com/spreadsheets/d/1_aKPoHJaJfQ6awuoG7ihufQzOBhw8I84yipErlWO1_Y/edit). Set-up once: open the sheet → Extensions → Apps Script → paste [`admin/google-apps-script/Code.gs`](admin/google-apps-script/Code.gs) → run `setup` (creates Dashboard, Appointments, Leads, Patients, Injection Sales, Protein Sales, Diet Support, Purchases, Inventory, Team, Incentives, Salary, Expenses, Renewals, Activity Log, plus a hidden `_AppData` sheet, and logs a secret) → Deploy → Web app (Execute as *Me*, access *Anyone*) → paste the URL and secret on the sign-in screen (*Connect Google Sheet*) or in Settings. The app saves each change within seconds without showing it, refreshes the data every 30 seconds and on pull-down or the refresh button, works offline, and, when two devices changed data at the same time, joins both automatically (newest version of each record wins, deletions stay deleted). Enter data in the app, not in the sheet: every save rewrites the tabs. **Current sheet or a new one:** by default the data stays in the current Hindivine sheet; run `useNewSpreadsheet` in Apps Script to copy all data into a brand-new spreadsheet and use it from now on, or `useCurrentSheet` to go back (missing tabs are created automatically, and Settings shows which spreadsheet is in use). After changing Code.gs: Deploy → Manage deployments → New version.

**Leads in a separate spreadsheet:** Settings → Google Sheet → *Leads spreadsheet* → **Create new leads sheet** (makes "Hindivine Leads"), **Connect this sheet** (paste the link of a sheet the Apps Script account can open) or **Use main sheet**. The Leads and WhatsApp tabs are then written there; the main sheet's Leads tab points to it. The app's shared data stays in the main sheet's hidden `_AppData`.

**Built-in sheet link (clinic APK):** to make the app connect by itself on first launch, put the web app link and secret in `android/sheet.env` (ignored by git) as `HDV_SHEET_URL=…` and `HDV_SHEET_SECRET=…`, then build with `SHEET_ENV=android/sheet.env OUT=/somewhere/HindivineAdmin-clinic.apk APP=admin ./android/build.sh`. Install that APK on clinic phones and **never commit it**: this repository is public and the secret gives full access to the data. The APK in `dist/` has no link; it asks for it on first launch. Settings → Google Sheet can test, sync, disconnect, reconnect or change the link.

**Excel / Google Sheets workbook:** [`admin/Hindivine_Admin_Sheets.xlsx`](admin/Hindivine_Admin_Sheets.xlsx) has the same 13 sheets plus Settings, with formulas, so it also works on its own: appointments (₹1000 fee, clinic visit/online), sales, purchases, expenses, patients and team; stock, incentives, salary + incentive, renewals (75/90 days) and the dashboard calculate themselves. Keep it separate from the Google Sheet the app stores its data in, because the app rewrites those tabs.

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
APP=admin VERSION_CODE=19 VERSION_NAME=4.0.1 ./android/build.sh   # Hindivine Admin → dist/HindivineAdmin.apk
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
| `dist/HindivineDiet.apk`, `dist/HindivineAdmin.apk` | Built Android apps |
| `admin/` | Hindivine Admin app: `js/core.js` (data and rules), `js/app.js` (screens), `js/export.js` (PDF / Excel), `vendor/` (jsPDF, AutoTable, SheetJS), `google-apps-script/Code.gs` (Sheets) |
| `tests/` | Unit tests (planner, recipes, storage, PDF read-back, admin app) |

## Disclaimer

Nutrition values are approximate. This tool supports, and does not replace, the judgement of a doctor or registered dietitian.
