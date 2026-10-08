package com.hindivine.diet;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.view.Window;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayDeque;

/** Hosts the Hindivine Diet or Hindivine Admin web app (bundled in assets/www) in a full-screen WebView. */
public class MainActivity extends Activity {
    private static final int REQUEST_SAVE = 1;
    private static final int REQUEST_OPEN = 2;

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;

    /** A file waiting for its "Save as" screen. Files are saved one after another. */
    private static class PendingSave {
        final String name; final String mime; final byte[] bytes;
        PendingSave(String name, String mime, byte[] bytes) { this.name = name; this.mime = mime; this.bytes = bytes; }
    }
    private final ArrayDeque<PendingSave> saveQueue = new ArrayDeque<>();
    private PendingSave saving;

    private void enqueueSave(PendingSave p) {
        saveQueue.add(p);
        if (saving == null) startNextSave();
    }

    private void startNextSave() {
        saving = saveQueue.poll();
        if (saving == null) return;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(saving.mime);
        intent.putExtra(Intent.EXTRA_TITLE, saving.name);
        try {
            startActivityForResult(intent, REQUEST_SAVE);
        } catch (Exception e) {
            saving = null;
            saveQueue.clear();
            Toast.makeText(this, "No app available to save files", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        // Android 13+: ask once so follow-up reminders can show as notifications.
        if (android.os.Build.VERSION.SDK_INT >= 33
                && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[] { "android.permission.POST_NOTIFICATIONS" }, 7);
        }

        webView = new WebView(this);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // remembers the last profile via localStorage
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);
        // Smoother scrolling: draw the parts of the page just off screen ahead of time, keep the page's
        // renderer at high priority, and paint the app colour (not white) while the page loads.
        if (android.os.Build.VERSION.SDK_INT >= 23) s.setOffscreenPreRaster(true);
        if (android.os.Build.VERSION.SDK_INT >= 26) webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, true);
        webView.setBackgroundColor(0xFF0A2F55);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if ("file".equals(url.getScheme())) return false;
                // Open any external link in the browser rather than inside the app.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (Exception ignored) {
                }
                return true;
            }

            // The page's renderer crashed or was stopped to free memory: reload instead of closing the app.
            @Override
            public boolean onRenderProcessGone(WebView view, android.webkit.RenderProcessGoneDetail detail) {
                // A dead renderer must not be used again: drop this WebView and start the screen afresh.
                try {
                    android.view.ViewGroup parent = (android.view.ViewGroup) view.getParent();
                    if (parent != null) parent.removeView(view);
                    view.destroy();
                } catch (Exception ignored) {
                }
                webView = null;
                recreate();
                return true;
            }
        });
        // <input type="file">: upload last week's chart PDF, import a backup.
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                // accept="image/*,application/pdf" may arrive as one string or as several entries.
                java.util.List<String> mimes = new java.util.ArrayList<>();
                String[] types = params.getAcceptTypes();
                if (types != null) for (String t : types) {
                    if (t == null) continue;
                    for (String m : t.split(",")) if (m.trim().contains("/")) mimes.add(m.trim());
                }
                if (mimes.size() == 1) intent.setType(mimes.get(0));
                else {
                    intent.setType("*/*");
                    if (!mimes.isEmpty()) intent.putExtra(Intent.EXTRA_MIME_TYPES, mimes.toArray(new String[0]));
                }
                try {
                    startActivityForResult(intent, REQUEST_OPEN);
                } catch (Exception e) {
                    fileCallback = null;
                    Toast.makeText(MainActivity.this, "No app available to open files", Toast.LENGTH_LONG).show();
                    return false;
                }
                return true;
            }
        });
        webView.addJavascriptInterface(new Bridge(), "AndroidBridge");
        // The page sits in a frame; on Android 15+ (edge to edge) the frame keeps it clear of the
        // status bar, navigation bar, camera cut-out and keyboard.
        android.widget.FrameLayout root = new android.widget.FrameLayout(this);
        root.setBackgroundColor(0xFF0A2F55);
        root.addView(webView, new android.widget.FrameLayout.LayoutParams(
                android.view.ViewGroup.LayoutParams.MATCH_PARENT, android.view.ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        if (android.os.Build.VERSION.SDK_INT >= 35) {
            root.setOnApplyWindowInsetsListener(new android.view.View.OnApplyWindowInsetsListener() {
                @Override
                public android.view.WindowInsets onApplyWindowInsets(android.view.View v, android.view.WindowInsets insets) {
                    android.graphics.Insets i = insets.getInsets(android.view.WindowInsets.Type.systemBars()
                            | android.view.WindowInsets.Type.displayCutout() | android.view.WindowInsets.Type.ime());
                    v.setPadding(i.left, i.top, i.right, i.bottom);
                    return android.view.WindowInsets.CONSUMED;
                }
            });
        }

        // All app data lives in the page's local storage, so the page simply starts again after a restart.
        {
            // Each app build names its start page in res/values/strings.xml (Diet or Admin).
            int id = getResources().getIdentifier("start_page", "string", getPackageName());
            webView.loadUrl("file:///android_asset/" + (id != 0 ? getString(id) : "www/index.html"));
        }
    }


    private long lastBack;

    // Back: the page handles it first (close a dialog, go to the previous screen). Only on the
    // home screen does back leave the app, and only when pressed twice.
    @Override
    public void onBackPressed() {
        if (webView == null) { super.onBackPressed(); return; }
        webView.evaluateJavascript("(window.hdvBack ? String(window.hdvBack()) : 'none')", new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String handled) {
                if ("\"true\"".equals(handled)) return;
                if ("\"none\"".equals(handled) && webView != null && webView.canGoBack()) { webView.goBack(); return; }
                long now = System.currentTimeMillis();
                if (now - lastBack < 2000) { finish(); return; }
                lastBack = now;
                Toast.makeText(MainActivity.this, "Press back again to exit", Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            try {
                android.view.ViewGroup parent = (android.view.ViewGroup) webView.getParent();
                if (parent != null) parent.removeView(webView);
                webView.destroy();
            } catch (Exception ignored) {
            }
            webView = null;
        }
        super.onDestroy();
    }

    private void shareNow(String fileName, String mimeType, byte[] bytes, String phone, String text) {
        try {
            java.io.File dir = new java.io.File(getCacheDir(), "share");
            if (!dir.exists()) dir.mkdirs();
            java.io.File[] old = dir.listFiles();
            if (old != null) for (java.io.File f : old) if (System.currentTimeMillis() - f.lastModified() > 3600000L) f.delete();
            String safe = fileName.replaceAll("[^A-Za-z0-9._-]+", "-");
            java.io.File file = new java.io.File(dir, safe);
            try (java.io.FileOutputStream out = new java.io.FileOutputStream(file)) { out.write(bytes); }
            Uri uri = Uri.parse("content://" + getPackageName() + ".files/" + Uri.encode(safe));
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(mimeType);
            send.putExtra(Intent.EXTRA_STREAM, uri);
            if (text != null && !text.isEmpty()) send.putExtra(Intent.EXTRA_TEXT, text);
            send.setClipData(android.content.ClipData.newRawUri(safe, uri));
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            String digits = phone == null ? "" : phone.replaceAll("[^0-9]", "");
            if (digits.length() == 10) digits = "91" + digits;
            for (String pkg : new String[] { "com.whatsapp", "com.whatsapp.w4b" }) {
                try {
                    Intent w = new Intent(send);
                    w.setPackage(pkg);
                    if (digits.length() >= 11) w.putExtra("jid", digits + "@s.whatsapp.net"); // opens this patient's chat
                    startActivity(w);
                    return;
                } catch (Exception ignored) {
                }
            }
            startActivity(Intent.createChooser(send, "Share " + safe));
        } catch (Exception e) {
            Toast.makeText(this, "Could not share the file", Toast.LENGTH_LONG).show();
        }
    }

    /** Called from JavaScript; WebView has no window.print() or blob downloads. */
    private class Bridge {
        @JavascriptInterface
        public void print(final String title) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (webView == null || isFinishing()) return;
                    PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                    String job = title == null || title.isEmpty() ? "Hindivine-Diet-Chart" : title;
                    pm.print(job, webView.createPrintDocumentAdapter(job), new PrintAttributes.Builder()
                            .setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
                }
            });
        }

        @JavascriptInterface
        public void saveFile(final String fileName, final String mimeType, final String content) {
            final byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
            runOnUiThread(new Runnable() {
                @Override
                public void run() { enqueueSave(new PendingSave(fileName, mimeType, bytes)); }
            });
        }

        /** Binary files (PDF, Excel, JPEG) arrive base64-encoded from JavaScript. */
        @JavascriptInterface
        /** Share a PDF straight to WhatsApp (the patient's chat when the number is known), else the share menu. */
        public void shareFile(final String fileName, final String mimeType, final String base64, final String phone, final String text) {
            final byte[] bytes;
            try {
                bytes = android.util.Base64.decode(base64, android.util.Base64.DEFAULT);
            } catch (Exception e) {
                return;
            }
            runOnUiThread(new Runnable() {
                @Override
                public void run() { shareNow(fileName, mimeType, bytes, phone, text); }
            });
        }

        @JavascriptInterface
        public void saveBase64(final String fileName, final String mimeType, final String base64) {
            final byte[] bytes;
            try {
                bytes = android.util.Base64.decode(base64, android.util.Base64.DEFAULT);
            } catch (Exception e) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() { Toast.makeText(MainActivity.this, "Could not prepare the file", Toast.LENGTH_LONG).show(); }
                });
                return;
            }
            runOnUiThread(new Runnable() {
                @Override
                public void run() { enqueueSave(new PendingSave(fileName, mimeType, bytes)); }
            });
        }

        /** Follow-up reminders: JSON [{id, at (ms), title, text}] replaces every reminder scheduled before. */
        @JavascriptInterface
        public void scheduleReminders(String json) {
            ReminderReceiver.schedule(MainActivity.this, json);
        }

        /** Shows a notification right away (reminder due while the app is open). */
        @JavascriptInterface
        public void notifyNow(String title, String text) {
            ReminderReceiver.show(MainActivity.this, title, text, (int) (System.currentTimeMillis() % 100000));
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_OPEN) {
            if (fileCallback == null) return;
            Uri uri = resultCode == RESULT_OK && data != null ? data.getData() : null;
            fileCallback.onReceiveValue(uri != null ? new Uri[] { uri } : null);
            fileCallback = null;
            return;
        }
        if (requestCode != REQUEST_SAVE) return;
        PendingSave p = saving;
        saving = null;
        if (p != null && resultCode == RESULT_OK && data != null && data.getData() != null) {
            Uri uri = data.getData();
            try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                out.write(p.bytes);
                Toast.makeText(this, "Saved " + p.name, Toast.LENGTH_SHORT).show();
                // Open the saved PDF / image / sheet so it can be checked or shared straight away.
                if (saveQueue.isEmpty()) {
                    try {
                        Intent view = new Intent(Intent.ACTION_VIEW);
                        view.setDataAndType(uri, p.mime);
                        view.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(view);
                    } catch (Exception ignored) {
                    }
                }
            } catch (Exception e) {
                Toast.makeText(this, "Could not save file", Toast.LENGTH_LONG).show();
            }
        }
        startNextSave();
    }
}
