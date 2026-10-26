# Hindivine Admin app

Android and iOS app for the admin dashboard at **https://admin.hindivine.tech/dashboard**.
The app opens the live dashboard, so changes to the website appear in the app without an update.

- **Login stays signed in:** cookies are kept between launches.
- **Links:** pages on `hindivine.tech` open in the app; other sites, email, phone and WhatsApp links open in their own apps.
- **Files:** file uploads use the phone's file picker; downloads (reports, exports) go to *Downloads*.
- **Offline:** shows a "Can't reach the dashboard" screen with a Retry button.
- **Back button / swipe back** goes to the previous dashboard page.

## Android

Install [`dist/HindivineAdmin.apk`](../dist/HindivineAdmin.apk) (Android 7.0+). Rebuild with:

```sh
VERSION_CODE=2 VERSION_NAME=1.1 ./admin-app/android/build.sh    # needs Java 11+, curl, zip/unzip
```

It signs with `admin-app/android/release.p12` (password `hindivineadmin`; override with `KEYSTORE` and `STOREPASS`) and creates it if missing. The key is git-ignored; keep a copy, because updates only install over an existing install when signed with the same key.

To change the dashboard address, edit `HOME_URL` in `android/src/com/hindivine/admin/MainActivity.java`.

## iOS (needs a Mac)

```sh
cd admin-app/ios
npm install
npm run sync
npm run open      # opens Xcode
```

In Xcode, choose your Apple Developer team under *Signing & Capabilities*, then *Product → Archive*. The dashboard address is `server.url` in `capacitor.config.json`.

> App Store review often rejects apps that only wrap a website (guideline 4.2). For internal staff use, distribute through TestFlight, Ad Hoc or Apple Business Manager instead.
