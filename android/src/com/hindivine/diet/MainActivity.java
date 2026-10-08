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

/** Hosts the Hindivine Diet web app (bundled in assets/www) in a full-screen WebView. */
public class MainActivity extends Activity {
    private static final int REQUEST_SAVE = 1;
    private static final int REQUEST_OPEN = 2;

    private WebView webView;
    private String pendingFileContent;
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);

        webView = new WebView(this);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // remembers the last profile via localStorage
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);

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
        });
        // <input type="file">: upload last week's chart PDF, import a backup.
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                String[] types = params.getAcceptTypes();
                String type = types != null && types.length > 0 && types[0] != null && types[0].contains("/") ? types[0] : "*/*";
                intent.setType(type);
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
        setContentView(webView);

        if (savedInstanceState != null) webView.restoreState(savedInstanceState);
        else webView.loadUrl("file:///android_asset/www/index.html");
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

    /** Called from JavaScript; WebView has no window.print() or blob downloads. */
    private class Bridge {
        @JavascriptInterface
        public void print(final String title) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                    String job = title == null || title.isEmpty() ? "Hindivine-Diet-Chart" : title;
                    pm.print(job, webView.createPrintDocumentAdapter(job), new PrintAttributes.Builder()
                            .setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
                }
            });
        }

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
            Toast.makeText(this, "Could not save file", Toast.LENGTH_LONG).show();
        }
    }
}
