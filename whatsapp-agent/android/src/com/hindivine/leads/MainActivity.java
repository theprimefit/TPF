package com.hindivine.leads;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Opens the WhatsApp lead agent's dashboard full screen. The agent runs on a
 * computer or server; the app only needs its address, asked for on first launch.
 */
public class MainActivity extends Activity {
    private static final String PREFS = "leads";
    private static final String KEY_SERVER = "server";
    private static final String CONNECT = "file:///android_asset/connect.html";
    private static final int REQUEST_OPEN = 1;
    private static final int REQUEST_SAVE = 2;

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingFileContent;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);

        webView = new WebView(this);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // keeps the dashboard password between launches
        s.setAllowFileAccess(true);   // only for the bundled connect screen
        s.setAllowContentAccess(false);
        s.setTextZoom(100);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if ("file".equals(url.getScheme()) || isOurServer(url)) return false;
                // WhatsApp, phone, UPI and other websites open in their own apps.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "No app can open this link", Toast.LENGTH_SHORT).show();
                }
                return true;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame() && !"file".equals(request.getUrl().getScheme())) {
                    showConnect("Could not reach " + server() + " (" + error.getDescription() + "). Is the agent running and the address correct?");
                }
            }
        });

        // <input type="file"> on the setup page: upload the UPI QR image.
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("image/*");
                try {
                    startActivityForResult(Intent.createChooser(intent, "Choose QR image"), REQUEST_OPEN);
                } catch (Exception e) {
                    fileCallback = null;
                    Toast.makeText(MainActivity.this, "No app available to pick images", Toast.LENGTH_LONG).show();
                    return false;
                }
                return true;
            }
        });

        webView.addJavascriptInterface(new Bridge(), "HindivineApp");
        setContentView(webView);

        if (savedInstanceState != null) webView.restoreState(savedInstanceState);
        else if (server().isEmpty()) showConnect("");
        else webView.loadUrl(server() + "/dashboard");
    }

    private String server() {
        return getSharedPreferences(PREFS, MODE_PRIVATE).getString(KEY_SERVER, "");
    }

    private boolean isOurServer(Uri url) {
        String s = server();
        if (s.isEmpty()) return false;
        Uri base = Uri.parse(s);
        return base.getHost() != null && base.getHost().equalsIgnoreCase(url.getHost()) && base.getPort() == url.getPort();
    }

    private void showConnect(String error) {
        String url = CONNECT + "?server=" + Uri.encode(server()) + (error.isEmpty() ? "" : "&error=" + Uri.encode(error));
        webView.loadUrl(url);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }

    /** Called from the connect screen and the dashboard. */
    private class Bridge {
        @JavascriptInterface
        public String getServer() {
            return server();
        }

        @JavascriptInterface
        public void setServer(String address) {
            String a = address == null ? "" : address.trim();
            while (a.endsWith("/")) a = a.substring(0, a.length() - 1);
            if (a.endsWith("/dashboard")) a = a.substring(0, a.length() - "/dashboard".length());
            if (!a.startsWith("http://") && !a.startsWith("https://")) a = "https://" + a;
            final String saved = a;
            getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(KEY_SERVER, saved).apply();
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    webView.clearHistory();
                    webView.loadUrl(saved + "/dashboard");
                }
            });
        }

        @JavascriptInterface
        public void changeServer() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    showConnect("");
                }
            });
        }

        /** WebView can't download blobs, so the dashboard's CSV export comes here. */
        @JavascriptInterface
        public void saveFile(final String fileName, final String mimeType, final String content) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    pendingFileContent = content;
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType(mimeType);
                    intent.putExtra(Intent.EXTRA_TITLE, fileName);
                    try {
                        startActivityForResult(intent, REQUEST_SAVE);
                    } catch (Exception e) {
                        pendingFileContent = null;
                        Toast.makeText(MainActivity.this, "No app available to save files", Toast.LENGTH_LONG).show();
                    }
                }
            });
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
        String content = pendingFileContent;
        pendingFileContent = null;
        if (resultCode != RESULT_OK || data == null || data.getData() == null || content == null) return;
        try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
            out.write(content.getBytes(StandardCharsets.UTF_8));
            Toast.makeText(this, "Saved", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Toast.makeText(this, "Could not save the file", Toast.LENGTH_LONG).show();
        }
    }
}
