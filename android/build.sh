#!/usr/bin/env bash
# Builds dist/HindivineDiet.apk (or, with APP=admin, dist/HindivineAdmin.apk) from the web app
# without the Android SDK or Gradle.
# Needs: Java 11+, curl, zip/unzip, python3. Build tools are fetched from Maven Central.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AND="$ROOT/android"
TOOLS="${TOOLS_DIR:-$AND/.tools}"
BUILD="$AND/build"
APP="${APP:-diet}"
if [ "$APP" = admin ]; then
  OUT="${OUT:-$ROOT/dist/HindivineAdmin.apk}"
  MANIFEST="$AND/admin/AndroidManifest.xml"
  BUILD="$AND/build-admin"
else
  OUT="$ROOT/dist/HindivineDiet.apk"
  MANIFEST="$AND/AndroidManifest.xml"
fi
KEYSTORE="${KEYSTORE:-$AND/release.p12}"
STOREPASS="${STOREPASS:-dietchart}"
ALIAS="${KEY_ALIAS:-dietchart}"

VERSION_CODE="${VERSION_CODE:-1}"
VERSION_NAME="${VERSION_NAME:-1.0}"
MIN_SDK=24  # v2 signing only (apksig 2.3.0 cannot produce v1 signatures on modern JDKs)
TARGET_SDK=35  # Android 15: Play Protect warns about apps built for older Android versions

M=https://repo1.maven.org/maven2
fetch() { # url dest
  [ -s "$2" ] && return 0
  for d in 0 3 8 16 30; do
    sleep "$d"
    curl -sSfL -o "$2.tmp" "$1" && mv "$2.tmp" "$2" && return 0
  done
  echo "failed to download $1" >&2; exit 1
}

mkdir -p "$TOOLS"
fetch "$M/org/apktool/apktool-cli/3.0.3/apktool-cli-3.0.3.jar" "$TOOLS/apktool.jar"
fetch "$M/com/jakewharton/android/repackaged/dalvik-dx/16.0.1/dalvik-dx-16.0.1.jar" "$TOOLS/dx.jar"
fetch "$M/com/android/tools/build/apksig/2.3.0/apksig-2.3.0.jar" "$TOOLS/apksig.jar"
fetch "$M/org/robolectric/android-all/11-robolectric-6757853/android-all-11-robolectric-6757853.jar" "$TOOLS/android-all.jar"
if [ ! -x "$TOOLS/prebuilt/linux/aapt2" ]; then
  (cd "$TOOLS" && unzip -o -q apktool.jar 'prebuilt/linux/aapt2' 'prebuilt/android-framework.jar' && chmod +x prebuilt/linux/aapt2)
fi
AAPT2="$TOOLS/prebuilt/linux/aapt2"
FRAMEWORK="$TOOLS/prebuilt/android-framework.jar"

rm -rf "$BUILD"
mkdir -p "$BUILD"/{res,gen,classes,assets/www,dex} "$(dirname "$OUT")"

echo "• Copying web app into assets"
if [ "$APP" = admin ]; then
  # The admin app lives in www/admin and uses the shared logo and icons in www/img.
  mkdir -p "$BUILD/assets/www/admin"
  cp "$ROOT/admin/index.html" "$ROOT/admin/manifest.webmanifest" "$BUILD/assets/www/admin/"
  cp -r "$ROOT/admin/css" "$ROOT/admin/js" "$ROOT/admin/vendor" "$ROOT/admin/google-apps-script" "$BUILD/assets/www/admin/"
  cp -r "$ROOT/img" "$BUILD/assets/www/"
  # Clinic build only: SHEET_ENV=android/sheet.env (git-ignored file with HDV_SHEET_URL and HDV_SHEET_SECRET)
  # puts the Google Sheet link inside the APK so it connects by itself. Never commit such an APK to a public repo.
  if [ -n "${SHEET_ENV:-}" ]; then . "$SHEET_ENV"; fi
  if [ -n "${HDV_SHEET_URL:-}" ]; then
    echo "  (built-in Google Sheet connection included)"
    node -e 'const [u, k] = process.argv.slice(1); process.stdout.write(`window.HDV_CONFIG = ${JSON.stringify({ sheetsUrl: u, sheetsSecret: k, sheetName: "Hindivine" })};\n`);' "$HDV_SHEET_URL" "${HDV_SHEET_SECRET:-}" > "$BUILD/assets/www/admin/js/config.js"
  fi
else
  cp "$ROOT/index.html" "$BUILD/assets/www/"
  cp -r "$ROOT/css" "$ROOT/js" "$ROOT/img" "$ROOT/vendor" "$BUILD/assets/www/"
fi

echo "• Compiling resources"
"$AAPT2" compile --dir "$AND/res" -o "$BUILD/res/res.zip"
OVERLAY=()
if [ "$APP" = admin ]; then
  "$AAPT2" compile --dir "$AND/admin/res" -o "$BUILD/res/admin.zip"
  OVERLAY=(-R "$BUILD/res/admin.zip")
fi
"$AAPT2" link -o "$BUILD/unsigned.apk" \
  -I "$FRAMEWORK" \
  --manifest "$MANIFEST" \
  --min-sdk-version "$MIN_SDK" --target-sdk-version "$TARGET_SDK" \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" \
  -A "$BUILD/assets" \
  --java "$BUILD/gen" \
  "$BUILD/res/res.zip" "${OVERLAY[@]}"

echo "• Compiling Java"
find "$AND/src" "$BUILD/gen" -name '*.java' > "$BUILD/sources.txt"
javac -nowarn --release 8 -encoding UTF-8 -classpath "$TOOLS/android-all.jar" -d "$BUILD/classes" @"$BUILD/sources.txt" 2>&1 | grep -v "bootstrap classpath\|^1 warning\|^warning: \[options\]\|source value 8\|target value 8\|To suppress warnings" || true
[ -f "$BUILD/classes/com/hindivine/diet/MainActivity.class" ] || { echo "javac failed" >&2; exit 1; }

echo "• Converting to dex"
java -cp "$TOOLS/dx.jar" com.android.dx.command.Main --dex --min-sdk-version="$MIN_SDK" --output="$BUILD/dex/classes.dex" "$BUILD/classes"
(cd "$BUILD/dex" && zip -q "$BUILD/unsigned.apk" classes.dex)

echo "• Signing"
if [ ! -f "$KEYSTORE" ]; then
  echo "  (creating new signing key at $KEYSTORE — keep it safe; updates must use the same key)"
  keytool -genkeypair -storetype PKCS12 -keystore "$KEYSTORE" -storepass "$STOREPASS" -keypass "$STOREPASS" \
    -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Hindivine Diet, O=Hindivine Healthcare Private Limited, C=IN" 2>/dev/null
fi
javac -nowarn -d "$BUILD/signer" -classpath "$TOOLS/apksig.jar" "$AND/tools/SignApk.java"
java --add-exports java.base/sun.security.x509=ALL-UNNAMED --add-exports java.base/sun.security.pkcs=ALL-UNNAMED --add-exports java.base/sun.security.util=ALL-UNNAMED \
  -cp "$BUILD/signer:$TOOLS/apksig.jar" SignApk "$KEYSTORE" "$STOREPASS" "$ALIAS" "$MIN_SDK" "$BUILD/unsigned.apk" "$OUT"

echo "✓ Built $OUT ($(du -h "$OUT" | cut -f1))"
