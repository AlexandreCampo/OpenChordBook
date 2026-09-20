// Copyright (C) 2026 Alexandre Campo
// SPDX-License-Identifier: GPL-3.0-or-later
package com.jazz4all.android;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.window.OnBackInvokedDispatcher;
import android.os.Message;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.WebChromeClient;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;

import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.ServiceWorkerClientCompat;
import androidx.webkit.ServiceWorkerControllerCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/**
 * Thin wrapper around the bundled jazz4all web app. The static site ships
 * inside the APK (assets/web) and is served through WebViewAssetLoader on
 * https://appassets.androidplatform.net — a secure origin, so ES modules,
 * IndexedDB and the service worker behave like on the web.
 *
 * An origin- and main-frame-bound message channel downloads only entries
 * from the bundled catalog, asynchronously, with a total deadline.
 * The app itself ships no chart data; the fetch happens only when the user
 * taps an Add button, and the result is cached in the page's IndexedDB.
 */
public class MainActivity extends Activity {

    private static final String ASSET_ORIGIN = "https://appassets.androidplatform.net";
    private static final String START_URL = ASSET_ORIGIN + NetworkPolicy.ASSET_PATH + "index.html";
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private final ExecutorService downloads = Executors.newSingleThreadExecutor();
    private final ExecutorService fileWrites = Executors.newSingleThreadExecutor();
    private final ScheduledExecutorService deadlines = Executors.newSingleThreadScheduledExecutor();
    private final Map<String, JSONObject> sources = new HashMap<>();
    private PlaylistDownloader.Job activeJob;
    private String activeId;
    private boolean destroyed;

    private static final int PICK_PLAYLIST = 41;
    private static final int SAVE_PLAYLIST = 42;
    private PendingExport activeExport;

    private static final class PendingExport {
        final String id;
        final byte[] bytes;
        final JavaScriptReplyProxy reply;
        volatile boolean cancelled;

        PendingExport(String id, byte[] bytes, JavaScriptReplyProxy reply) {
            this.id = id; this.bytes = bytes; this.reply = reply;
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBackNavigation);
        }

        // Android 15+ enforces edge-to-edge: the WebView would draw under
        // the status/navigation bars and the top controls become
        // untappable. WebView ignores setPadding for web content, so
        // translate the system bar insets into layout margins instead.
        // Insets were already dispatched when setContentView attached the
        // view, so force a redispatch to reach this listener.
        ViewCompat.setOnApplyWindowInsetsListener(webView, (View v, WindowInsetsCompat insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            ViewGroup.MarginLayoutParams lp = (ViewGroup.MarginLayoutParams) v.getLayoutParams();
            lp.topMargin = bars.top;
            lp.bottomMargin = bars.bottom;
            lp.leftMargin = bars.left;
            lp.rightMargin = bars.right;
            v.setLayoutParams(lp);
            return WindowInsetsCompat.CONSUMED;
        });
        webView.requestApplyInsets();

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/v13/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);   // IndexedDB: the song library
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " jazz4all/1.12");
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);

        webView.setBackgroundColor(Color.parseColor("#f4f1e9"));
        installMessageChannel();
        // Service-worker fetches must obey the same asset-only boundary.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE)
                && WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_SHOULD_INTERCEPT_REQUEST)) {
            ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(new ServiceWorkerClientCompat() {
                @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                    return assetResponse(assetLoader, request);
                }
            });
        }
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetResponse(assetLoader, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (request.isForMainFrame() && NetworkPolicy.appDocument(url)) return false;
                if (request.isForMainFrame() && request.hasGesture()) openExternal(request.getUrl());
                return true; // Includes data:, javascript:, intent:, file:, content: and subframes.
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), PICK_PLAYLIST);
                } catch (android.content.ActivityNotFoundException e) {
                    fileCallback.onReceiveValue(null);
                    fileCallback = null;
                }
                return true;
            }

            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                if (!isUserGesture) return false;
                // This WebView never loads content or exposes a bridge.
                WebView proxy = new WebView(MainActivity.this);
                proxy.getSettings().setAllowFileAccess(false);
                proxy.getSettings().setAllowContentAccess(false);
                Runnable dispose = proxy::destroy;
                proxy.setWebViewClient(new WebViewClient() {
                    @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                        return blockedResponse();
                    }
                    @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                        if (request.isForMainFrame()) openExternal(request.getUrl());
                        v.removeCallbacks(dispose);
                        v.post(dispose);
                        return true;
                    }
                });
                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(proxy);
                resultMsg.sendToTarget();
                proxy.postDelayed(dispose, 5000);
                return true;
            }

            // A bare WebView never shows JS dialogs: prompt()/confirm()/
            // alert() silently return "cancelled" and features built on
            // them appear broken. Show native dialogs instead.
            @Override
            public boolean onJsConfirm(WebView view, String url, String message, final JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setPositiveButton(android.R.string.ok, (d, w) -> result.confirm())
                        .setNegativeButton(android.R.string.cancel, (d, w) -> result.cancel())
                        .setOnCancelListener(d -> result.cancel())
                        .show();
                return true;
            }

            @Override
            public boolean onJsPrompt(WebView view, String url, String message, String defaultValue,
                                       final JsPromptResult result) {
                final EditText input = new EditText(MainActivity.this);
                input.setText(defaultValue);
                new AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setView(input)
                        .setPositiveButton(android.R.string.ok, (d, w) -> result.confirm(input.getText().toString()))
                        .setNegativeButton(android.R.string.cancel, (d, w) -> result.cancel())
                        .setOnCancelListener(d -> result.cancel())
                        .show();
                return true;
            }

            @Override
            public boolean onJsAlert(WebView view, String url, String message, final JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                        .setMessage(message)
                        .setPositiveButton(android.R.string.ok, (d, w) -> result.confirm())
                        .setOnCancelListener(d -> result.cancel())
                        .show();
                return true;
            }
        });

        // Reopen only our entry document. Library and preferences live in IndexedDB.
        webView.loadUrl(START_URL);
    }

    private static WebResourceResponse blockedResponse() {
        return new WebResourceResponse("text/plain", "UTF-8", 403, "Blocked",
                Collections.singletonMap("Cache-Control", "no-store"), new ByteArrayInputStream(new byte[0]));
    }

    private static WebResourceResponse assetResponse(WebViewAssetLoader loader, WebResourceRequest request) {
        String url = request.getUrl().toString();
        if (!"GET".equals(request.getMethod()) || !NetworkPolicy.localAsset(url)) return blockedResponse();
        WebResourceResponse response = loader.shouldInterceptRequest(Uri.parse(url.endsWith(NetworkPolicy.ASSET_PATH) ? START_URL : url));
        if (response == null) return blockedResponse();
        Map<String, String> headers = new HashMap<>();
        headers.put("X-Content-Type-Options", "nosniff");
        headers.put("Content-Security-Policy", "frame-ancestors 'none'; frame-src 'none'; connect-src 'self'");
        response.setResponseHeaders(headers);
        return response;
    }

    private void openExternal(Uri uri) {
        if (!NetworkPolicy.externalLink(uri.toString())) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (Exception e) {
            // No handler for this scheme; ignore.
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PICK_PLAYLIST && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
        }
        if (requestCode == SAVE_PLAYLIST && activeExport != null) {
            PendingExport export = activeExport;
            Uri destination = data == null ? null : data.getData();
            if (resultCode != RESULT_OK || destination == null || export.cancelled) {
                finishExport(export, "cancelled", null);
                return;
            }
            if (!"content".equals(destination.getScheme())) {
                finishExport(export, null, "Choose a location in the file picker.");
                return;
            }
            fileWrites.execute(() -> {
                String error = null;
                try (OutputStream output = getContentResolver().openOutputStream(destination, "wt")) {
                    if (output == null) throw new java.io.IOException("No output stream");
                    output.write(export.bytes);
                } catch (Exception e) { error = "Could not save this file. Choose another location and try again."; }
                final String failure = error;
                runOnUiThread(() -> finishExport(export, "saved", failure));
            });
        }
    }

    // API 33+ uses the OnBackInvokedCallback registered in onCreate. This
    // override remains exclusively for Android 7–12 and hardware Back.
    @SuppressLint("GestureBackNavigation")
    @Override
    public void onBackPressed() {
        handleBackNavigation();
    }

    private void handleBackNavigation() {
        // Dismiss the current web surface before leaving the music stand.
        webView.evaluateJavascript("window.jazz4allBack ? window.jazz4allBack() : false", handled -> {
            if (!"true".equals(handled)) {
                if (webView.canGoBack()) webView.goBack();
                else finish();
            }
        });
    }

    @Override
    protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        fileCallback = null;
        destroyed = true;
        if (activeExport != null) activeExport.cancelled = true;
        activeExport = null;
        if (activeJob != null) {
            PlaylistDownloader.Job job = activeJob;
            job.cancelled = true;
            deadlines.execute(job::cancel);
        }
        downloads.shutdownNow();
        fileWrites.shutdown();
        deadlines.shutdown();
        webView.destroy();
        super.onDestroy();
    }

    private void installMessageChannel() {
        // Fail closed on outdated WebViews: manual file/link import remains available.
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        try (InputStream in = getAssets().open("web/data/catalog.json")) {
            java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) != -1) bytes.write(buf, 0, n);
            JSONArray categories = new JSONObject(bytes.toString("UTF-8")).getJSONArray("categories");
            for (int c = 0; c < categories.length(); c++) {
                JSONArray items = categories.getJSONObject(c).getJSONArray("items");
                for (int i = 0; i < items.length(); i++) {
                    JSONObject item = items.getJSONObject(i);
                    if (item.has("scrape")) sources.put(item.getString("id"), item.getJSONObject("scrape"));
                }
            }
        } catch (Exception ignored) { sources.clear(); }
        WebViewCompat.addWebMessageListener(webView, "jazz4allHost", Collections.singleton(ASSET_ORIGIN),
                (view, message, origin, mainFrame, reply) -> {
                    if (destroyed || !mainFrame || !NetworkPolicy.localOrigin(origin.toString())) return;
                    try {
                        String data = message.getData(); // Non-text messages can throw; reject them too.
                        if (data == null || data.length() > PlaylistExport.MAX_BYTES * 2) return;
                        JSONObject request = new JSONObject(data);
                        String type = request.optString("type");
                        if (!"savePlaylist".equals(type) && data.length() > 512) return;
                        if ("appearance".equals(type)) { setAppearance(request.optString("value")); return; }
                        if ("reading".equals(type)) { setReadingMode(request.optBoolean("value")); return; }
                        String id = request.optString("id");
                        if (!id.matches("[a-zA-Z0-9_-]{1,64}")) return;
                        if ("cancel".equals(type)) {
                            if (activeExport != null && id.equals(activeExport.id)) activeExport.cancelled = true;
                            if (activeJob != null && !activeJob.cancelled && id.equals(activeId)) {
                                PlaylistDownloader.Job job = activeJob;
                                job.cancelled = true;
                                deadlines.execute(job::cancel);
                            }
                        } else if ("savePlaylist".equals(type)) {
                            if (activeExport != null) { reply(reply, id, null, "An export is already in progress."); return; }
                            try {
                                byte[] bytes = PlaylistExport.content(request.getString("text"));
                                activeExport = new PendingExport(id, bytes, reply);
                                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                                        .addCategory(Intent.CATEGORY_OPENABLE).setType("text/html")
                                        .putExtra(Intent.EXTRA_TITLE, PlaylistExport.filename(request.optString("filename")));
                                startActivityForResult(intent, SAVE_PLAYLIST);
                            } catch (Exception e) {
                                activeExport = null;
                                reply(reply, id, null, "Could not open the save window. Check the file size and try again.");
                            }
                        } else if ("download".equals(type)) {
                            JSONObject source = sources.get(request.optString("source"));
                            if (source == null) { reply(reply, id, null, "Unknown catalog entry."); return; }
                            if (activeJob != null) { reply(reply, id, null, "Another download is still stopping. Try again shortly."); return; }
                            startDownload(source, id, reply);
                        }
                    } catch (Exception ignored) { /* Malformed messages grant no capabilities. */ }
                });
    }

    private void finishExport(PendingExport export, String value, String error) {
        if (activeExport == export) activeExport = null;
        reply(export.reply, export.id, value, error);
    }

    private void startDownload(JSONObject source, String id, JavaScriptReplyProxy reply) {
        PlaylistDownloader.Job job = new PlaylistDownloader.Job();
        activeJob = job;
        activeId = id;
        ScheduledFuture<?> timeout = deadlines.schedule(() -> {
            runOnUiThread(() -> reply(reply, id, null, "Download timed out. Try again or open the source."));
            job.cancel();
        }, PlaylistDownloader.TIMEOUT_MS, TimeUnit.MILLISECONDS);
        downloads.execute(() -> {
            String result = null, error = null;
            try {
                result = PlaylistDownloader.fetch(source.getString("url"), source.isNull("name") ? null : source.getString("name"), job);
            } catch (Exception e) { error = e.getMessage() == null ? "Download failed." : e.getMessage(); }
            finally { timeout.cancel(false); }
            final String value = result, failure = error;
            runOnUiThread(() -> {
                if (activeJob == job) { activeJob = null; activeId = null; }
                reply(reply, id, value, failure);
            });
        });
    }

    private void reply(JavaScriptReplyProxy reply, String id, String value, String error) {
        if (destroyed || !WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        try {
            JSONObject message = new JSONObject().put("id", id);
            if (error == null) message.put("value", value == null ? "" : value);
            else message.put("error", error);
            reply.postMessage(message.toString());
        } catch (Exception ignored) { /* The requesting document may have closed. */ }
    }

    private void setReadingMode(boolean reading) {
        WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(getWindow(), webView);
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        if (reading) controller.hide(WindowInsetsCompat.Type.systemBars());
        else controller.show(WindowInsetsCompat.Type.systemBars());
    }

    private void setAppearance(String theme) {
        boolean dark = "dark".equals(theme);
        int color = Color.parseColor(dark ? "#20241f" : "#f4f1e9");
        webView.setBackgroundColor(color);
        getWindow().getDecorView().setBackgroundColor(color);
        getWindow().setStatusBarColor(color);
        getWindow().setNavigationBarColor(color);
        WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(getWindow(), webView);
        controller.setAppearanceLightStatusBars(!dark);
        controller.setAppearanceLightNavigationBars(!dark);
    }
}
