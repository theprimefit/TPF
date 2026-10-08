/*
 * Built-in Google Sheet connection. Left empty in the public repository.
 * android/build.sh fills it from android/sheet.env (git-ignored) when building the clinic APK,
 * so the app connects by itself on first launch. Settings → Google Sheet can change or disconnect it.
 */
window.HDV_CONFIG = { sheetsUrl: '', sheetsSecret: '', sheetName: 'Hindivine' };
