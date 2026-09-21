package io.github.openchordbook;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ApplicationInfo;
import android.net.Uri;
import android.os.Bundle;
import android.security.NetworkSecurityPolicy;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import org.json.JSONObject;
import java.lang.reflect.Field;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/** Run only against the separate .securitytest package; never reads the real library. */
public final class SecurityInstrumentation extends Instrumentation {
    private WebView web;
    private int checks;
    private static final String START = "https://appassets.androidplatform.net/assets/v18/web/index.html";
    @Override public void onCreate(Bundle args) { super.onCreate(args); start(); }
    @Override public void onStart() {
        Bundle result = new Bundle();
        try {
            check(getTargetContext().getPackageName().endsWith(".securitytest"), "Isolated test package required");
            check((getTargetContext().getApplicationInfo().flags & ApplicationInfo.FLAG_ALLOW_BACKUP) == 0, "Backup disabled");
            check(!NetworkSecurityPolicy.getInstance().isCleartextTrafficPermitted(), "HTTP disabled");
            Activity activity = startActivitySync(new Intent(getTargetContext(), MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            Field field = MainActivity.class.getDeclaredField("webView"); field.setAccessible(true);
            web = (WebView) field.get(activity);
            await("typeof window.openchordbookNative?.fetchPlaylist === 'function' && !!window.openchordbookBack");
            check("\"object\"".equals(js("typeof window.openchordbookHost")), "Origin-bound transport available");
            check("false".equals(js("'getClass' in window.openchordbookNative")), "No Java reflection interface");
            js("window.nativeResult = ''; window.openchordbookNative.fetchPlaylist('https://127.0.0.1/secret').then(()=>window.nativeResult='BAD',e=>window.nativeResult=e.message); true");
            await("window.nativeResult.includes('Unknown catalog entry')");
            checks++;

            js("openchordbookHost.postMessage('{'); openchordbookHost.postMessage('x'.repeat(513)); try { openchordbookHost.postMessage(new ArrayBuffer(8)); } catch {} true");
            check("2".equals(js("1+1")), "Malformed, oversized and binary messages do not crash the app");

            // Verify production WebViewClient decisions, including gestures and subframes.
            runOnMainSync(() -> {
                WebViewClient client = web.getWebViewClient();
                for (String url : new String[] { "https://appassets.androidplatform.net:444/assets/v18/web/index.html", "https://appassets.androidplatform.net/assets/v18/web/data/catalog.json", "data:text/html,hi", "javascript:alert(1)", "intent://scan/#Intent;scheme=zxing;end", "file:///etc/hosts", "content://contacts/people", "http://example.com/" }) {
                    check(client.shouldOverrideUrlLoading(web, request(url, true, true)), "Block navigation " + url);
                }
                check(!client.shouldOverrideUrlLoading(web, request(START, true, true)), "Allow entry document");
                check(client.shouldOverrideUrlLoading(web, request(START, false, true)), "Block frame navigation");
                for (String url : new String[] { "https://example.com/", "https://appassets.androidplatform.net:444/assets/v18/web/index.html", "https://appassets.androidplatform.net/assets/v18/web/%2e%2e/catalog.json", "https://appassets.androidplatform.net/anything" }) {
                    WebResourceResponse response = client.shouldInterceptRequest(web, request(url, false, false));
                    check(response != null && response.getStatusCode() == 403, "Block resource fallback " + url);
                }
                check(!web.getWebChromeClient().onCreateWindow(web, false, false, null), "Block unprompted popups");
                check(!web.getSettings().getAllowFileAccess() && !web.getSettings().getAllowContentAccess(), "Block direct file/content access");
            });

            // Temporarily bypass the already-tested navigation denial to probe injection
            // on foreign documents that production navigation cannot reach.
            AtomicReference<WebViewClient> productionClient = new AtomicReference<>();
            runOnMainSync(() -> { productionClient.set(web.getWebViewClient()); web.setWebViewClient(new WebViewClient()); });
            runOnMainSync(() -> web.loadDataWithBaseURL("https://untrusted.invalid/", "<html><body>foreign</body></html>", "text/html", "UTF-8", null));
            await("document.body?.textContent === 'foreign'");
            check("\"undefined\"".equals(js("typeof window.openchordbookHost")), "No bridge on foreign origin");

            // Same-origin frames may see the transport, but their messages must be rejected.
            String child = "<script>openchordbookHost.onmessage=()=>parent.postMessage('BAD_REPLY','*'); openchordbookHost.postMessage(JSON.stringify({type:'download',id:'frame',source:'unknown'})); parent.postMessage('FRAME_SENT','*');</script>";
            String html = "<html><body><script>window.frameState='';onmessage=e=>window.frameState=e.data;</script><iframe srcdoc=\"" + child.replace("&", "&amp;").replace("\"", "&quot;") + "\"></iframe></body></html>";
            runOnMainSync(() -> web.loadDataWithBaseURL(START, html, "text/html", "UTF-8", null));
            await("window.frameState === 'FRAME_SENT' || window.frameState === 'BAD_REPLY'");
            Thread.sleep(400);
            check("\"FRAME_SENT\"".equals(js("window.frameState")), "Reject messages from same-origin subframes");

            // Reopen the real app: rendering, saving and offline assets must still work.
            runOnMainSync(() -> { web.setWebViewClient(productionClient.get()); web.loadUrl(START); });
            await("typeof window.openchordbookNative?.fetchPlaylist === 'function' && !!window.openchordbookBack");
            js("window.offlineReady=false; navigator.serviceWorker.ready.then(()=>window.offlineReady=true); true");
            await("window.offlineReady === true");
            checks++;
            js("window.chartResult=''; (async()=>{const {parsePlaylist,savePlaylist}=await import('https://appassets.androidplatform.net/assets/v18/web/src/import.js'); const s=await import('https://appassets.androidplatform.net/assets/v18/web/src/storage.js'); const {renderSong}=await import('https://appassets.androidplatform.net/assets/v18/web/src/viewer.js'); const p=parsePlaylist('irealb://'+encodeURIComponent('Isolated test=Tester==Swing=C==[C |G7 Z==120=3')); const saved=await savePlaylist(p,null); const record=await s.getSong(saved.songIds[0]); const container=document.createElement('div'); renderSong(record,container,{transpose:2}); window.chartResult=container.querySelectorAll('irr-chord').length > 0 ? 'PASS':'FAIL';})().catch(e=>window.chartResult=e.message); true");
            await("window.chartResult.length > 0");
            check("\"PASS\"".equals(js("window.chartResult")), "Chart import/render: " + js("window.chartResult"));
            // Exercise the real message channel, activity result and file writer.
            // Only the chooser result is substituted; the test provider writes
            // actual UTF-8 bytes inside the separate debug package.
            Uri exportUri = Uri.parse("content://io.github.openchordbook.securitytest.export-test/playlist");
            ActivityMonitor cancelledPicker = exportPicker(new ActivityResult(Activity.RESULT_CANCELED, null));
            js("window.exportResult=''; window.openchordbookNative.savePlaylist('Practice.html','<html>étude ♭</html>').then(v=>window.exportResult=v,e=>window.exportResult=e.message); true");
            await("window.exportResult.length > 0");
            check("\"cancelled\"".equals(js("window.exportResult")) && cancelledPicker.getHits() == 1, "Save picker cancellation");
            removeMonitor(cancelledPicker);
            ActivityMonitor savePicker = exportPicker(new ActivityResult(Activity.RESULT_OK, new Intent().setData(exportUri)));
            js("window.exportResult=''; (async()=>{const s=await import('https://appassets.androidplatform.net/assets/v18/web/src/storage.js'); const {createPlaylistFile}=await import('https://appassets.androidplatform.net/assets/v18/web/src/playlist-export.js'); window.exportText=createPlaylistFile(await s.listSongs(),'Études ♭').text; window.exportResult=await window.openchordbookNative.savePlaylist('Études.html',window.exportText);})().catch(e=>window.exportResult=e.message); true");
            await("window.exportResult.length > 0");
            check("\"saved\"".equals(js("window.exportResult")) && savePicker.getHits() == 1, "Export reports success after writing: " + js("window.exportResult") + " (picker hits " + savePicker.getHits() + ")");
            try (java.io.InputStream input = getTargetContext().getContentResolver().openInputStream(exportUri)) {
                java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
                byte[] buffer = new byte[8192]; int count;
                while ((count = input.read(buffer)) != -1) bytes.write(buffer, 0, count);
                check(bytes.toString("UTF-8").equals(new org.json.JSONArray("[" + js("window.exportText") + "]").getString(0)), "Exported UTF-8 file exactly matches the generated playlist");
            }
            removeMonitor(savePicker);
            Uri badUri = Uri.parse("content://io.github.openchordbook.securitytest.export-test/missing");
            ActivityMonitor failedPicker = exportPicker(new ActivityResult(Activity.RESULT_OK, new Intent().setData(badUri)));
            js("window.exportResult=''; window.openchordbookNative.savePlaylist('Practice.html',window.exportText).then(v=>window.exportResult=v,e=>window.exportResult=e.message); true");
            await("window.exportResult.length > 0");
            check(js("window.exportResult").contains("Could not save"), "Provider write error reaches the UI");
            removeMonitor(failedPicker);
            js("window.cancelResult=''; const cancelTest=new AbortController(); window.openchordbookNative.fetchPlaylist('gypsy-jazz-denis-chang-early-recordings',cancelTest.signal).catch(e=>window.cancelResult=e.message); cancelTest.abort(); true");
            await("window.cancelResult.includes('cancelled')");
            check("2".equals(js("1+1")), "UI remains responsive after cancelling a native download");
            Thread.sleep(500); // Give the cancelled native worker time to unwind.
            // Live previews cover every allowed host, forum redirects and the largest catalog book.
            String[][] collections = {
                {"gypsy-jazz-denis-chang-early-recordings", "72"},
                {"gypsy-jazz-denis-chang-fakebook", "239"},
                {"gypsy-jazz-robin-nolan-style-gypsy-jazz", "63"},
                {"gypsy-jazz-the-transcribed-gypsy-jazz-chordbook-martin-gioani", "209"},
                {"jazz-standards-jazz-1460-standards", "1460"}
            };
            for (String[] collection : collections) {
                js("window.downloadResult=''; window.openchordbookNative.fetchPlaylist(" + JSONObject.quote(collection[0]) + ").then(async text=>{const {parsePlaylist}=await import('https://appassets.androidplatform.net/assets/v18/web/src/import.js'); window.downloadResult='songs:'+parsePlaylist(text).songs.length;}).catch(e=>window.downloadResult=e.message); true");
                await("window.downloadResult.length > 0", 35000);
                check(JSONObject.quote("songs:" + collection[1]).equals(js("window.downloadResult")), collection[0] + ": " + js("window.downloadResult"));
            }
            runOnMainSync(activity::finish);
            result.putString("stream", "\nPASS: " + checks + " Android security/integration checks in isolated package.\n");
            finish(Activity.RESULT_OK, result);
        } catch (Throwable e) {
            result.putString("stream", "\nFAIL after " + checks + " checks: " + android.util.Log.getStackTraceString(e));
            finish(Activity.RESULT_CANCELED, result);
        }
    }
    private ActivityMonitor exportPicker(ActivityResult result) {
        IntentFilter filter = new IntentFilter(Intent.ACTION_CREATE_DOCUMENT);
        filter.addCategory(Intent.CATEGORY_OPENABLE);
        try { filter.addDataType("text/html"); } catch (IntentFilter.MalformedMimeTypeException e) { throw new AssertionError(e); }
        return addMonitor(filter, result, true);
    }
    private void check(boolean condition, String message) {
        if (!condition) throw new AssertionError(message);
        checks++;
    }
    private String js(String source) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> value = new AtomicReference<>();
        runOnMainSync(() -> web.evaluateJavascript(source, v -> { value.set(v); done.countDown(); }));
        if (!done.await(5, TimeUnit.SECONDS)) throw new AssertionError("JavaScript did not respond");
        return value.get();
    }
    private void await(String expression) throws Exception { await(expression, 15000); }
    private void await(String expression, long ms) throws Exception {
        long end = System.currentTimeMillis() + ms;
        while (System.currentTimeMillis() < end) {
            if ("true".equals(js(expression))) return;
            Thread.sleep(100);
        }
        throw new AssertionError("Timed out: " + expression);
    }
    private WebResourceRequest request(String url, boolean main, boolean gesture) {
        return new WebResourceRequest() {
            public Uri getUrl() { return Uri.parse(url); }
            public boolean isForMainFrame() { return main; }
            public boolean isRedirect() { return false; }
            public boolean hasGesture() { return gesture; }
            public String getMethod() { return "GET"; }
            public Map<String, String> getRequestHeaders() { return Collections.emptyMap(); }
        };
    }
}
