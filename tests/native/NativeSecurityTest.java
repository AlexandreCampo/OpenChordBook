package io.github.openchordbook;

import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

public final class NativeSecurityTest {
    static int checks;
    static void check(boolean b) { if (!b) throw new AssertionError("Check " + checks); checks++; }
    interface Throwing { void run() throws Exception; }
    static void rejects(Throwing f) throws Exception { try { f.run(); } catch (Exception expected) { checks++; return; } throw new AssertionError("Expected rejection " + checks); }
    static class Response extends HttpURLConnection {
        int code; String redirect; byte[] body; boolean disconnected;
        Response(int code, String redirect, String body) throws Exception { super(new URL("https://forums.irealpro.com/")); this.code=code; this.redirect=redirect; this.body=body.getBytes(StandardCharsets.UTF_8); }
        public void connect() {}
        public void disconnect() { disconnected=true; }
        public boolean usingProxy() { return false; }
        public int getResponseCode() { return code; }
        public String getHeaderField(String field) { return redirect; }
        public long getContentLengthLong() { return body.length; }
        public InputStream getInputStream() { return new ByteArrayInputStream(body); }
    }
    public static void main(String[] args) throws Exception {
        check(PlaylistExport.filename("../Study: 3/4.html").equals("-Study- 3-4.html"));
        check(PlaylistExport.filename("").equals("openchordbook.html"));
        check(new String(PlaylistExport.content("étude ♭"), StandardCharsets.UTF_8).equals("étude ♭"));
        rejects(() -> PlaylistExport.content(""));
        rejects(() -> PlaylistExport.content("a".repeat(PlaylistExport.MAX_BYTES + 1)));
        rejects(() -> PlaylistExport.content("é".repeat(PlaylistExport.MAX_BYTES / 2 + 1)));
        String source = "https://forums.irealpro.com/threads/fixture/";
        for (String url : Arrays.asList("http://forums.irealpro.com/", "https://forums.irealpro.com:444/", "https://evil.test/", "https://forums.irealpro.com@evil.test/", "https://evil@forums.irealpro.com/", "https://forums.irealpro.com.evil.test/", "https://127.0.0.1/", "https://[::1]/", "file:///etc/passwd", "content://provider/", "javascript:alert(1)", "data:text/html,hi", "https://forums.irealpro.com/\\evil", "https://forums.irealpro.com/#fragment")) {
            rejects(() -> NetworkPolicy.download(url, null));
        }
        check(NetworkPolicy.download(source, null).getHost().equals("forums.irealpro.com"));
        check(NetworkPolicy.download(source+"page-2", "forums.irealpro.com").toString().endsWith("page-2"));
        rejects(() -> NetworkPolicy.download("https://dl.dropboxusercontent.com/export", "forums.irealpro.com"));
        for (String ip : Arrays.asList("0.0.0.0", "10.0.0.1", "127.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "100.64.0.1", "198.18.0.1", "224.0.0.1", "255.255.255.255", "::", "::1", "fe80::1", "fc00::1", "fd00::1", "ff00::1", "::ffff:127.0.0.1")) check(!NetworkPolicy.publicAddress(InetAddress.getByName(ip)));
        for (String ip : Arrays.asList("8.8.8.8", "1.1.1.1", "2606:4700:4700::1111")) check(NetworkPolicy.publicAddress(InetAddress.getByName(ip)));
        String start="https://appassets.androidplatform.net/assets/v18/web/index.html";
        check(NetworkPolicy.appDocument(start)); check(NetworkPolicy.appDocument(start+"#chart"));
        for (String url : Arrays.asList(start+"?url=evil",start.replace(".net/", ".net:444/"),start.replace("/index.html", "/%2e%2e/secret"),start.replace("/index.html", "/../secret"),start.replace("https", "http"),"https://appassets.androidplatform.net.evil/assets/v18/web/index.html")) check(!NetworkPolicy.appDocument(url));
        check(!NetworkPolicy.externalLink("intent://open")); check(!NetworkPolicy.externalLink("http://example.com")); check(NetworkPolicy.externalLink("https://example.com/"));

        String uri="irealb://"+URLEncoder.encode("Fixture=Tester==Swing=C==1r34LbKcu7[C Z==120=3===Test book", "UTF-8").replace("+", "%20");
        String html="<a href=\""+uri+"\">Import</a>";
        List<String> opened=new ArrayList<>(); List<Response> replies=new ArrayList<>();
        String selected=PlaylistDownloader.fetch(source,"Test book",new PlaylistDownloader.Job(), url->{
            opened.add(url.toString()); Response r = new Response(opened.size()==1 ? 302:200,"page-2#post-123",html); replies.add(r); return r;
        });
        check(selected.equals(uri)); check(opened.size()==2); check(opened.get(1).equals(source+"page-2"));
        check(replies.stream().allMatch(r->r.disconnected && !r.getInstanceFollowRedirects()));
        check(PlaylistDownloader.pickPlaylist(PlaylistDownloader.extractUris(html), "Missing").isEmpty());
        check(PlaylistDownloader.percentDecode("A+B%20C").equals("A+B C"));
        for(String target:Arrays.asList("https://127.0.0.1/", "https://evil.test/", "http://forums.irealpro.com/", "https://dl.dropboxusercontent.com/", "//evil.test/path", "https://forums.irealpro.com:444/")) {
            opened.clear();
            rejects(()->PlaylistDownloader.fetch(source,null,new PlaylistDownloader.Job(),url->{ opened.add(url.toString()); return new Response(302,target,""); }));
            check(opened.size()==1); // Redirect destination was never connected.
        }
        opened.clear();
        rejects(()->PlaylistDownloader.fetch(source,null,new PlaylistDownloader.Job(),url->{ opened.add(url.toString()); return new Response(302,"/loop",""); }));
        check(opened.size()==5);
        rejects(()->PlaylistDownloader.fetch(source,null,new PlaylistDownloader.Job(),url->new Response(503,null,"")));
        rejects(()->PlaylistDownloader.fetch(source,null,new PlaylistDownloader.Job(),url->new Response(200,null,"") { public long getContentLengthLong(){return PlaylistDownloader.MAX_PAGE_BYTES+1;} }));
        rejects(()->PlaylistDownloader.readBounded(new ByteArrayInputStream(new byte[PlaylistDownloader.MAX_PAGE_BYTES+1]),new PlaylistDownloader.Job()));
        rejects(()->PlaylistDownloader.readBounded(new InputStream(){public int read(){return 65;} public int read(byte[] b,int off,int len){try{Thread.sleep(5);}catch(Exception ignored){} b[off]=65;return 1;}},new PlaylistDownloader.Job(20)));
        PlaylistDownloader.Job cancelled=new PlaylistDownloader.Job(); cancelled.cancel();
        rejects(()->PlaylistDownloader.fetch(source,null,cancelled,url->{throw new AssertionError("Cancelled download connected");}));
        System.out.println("PASS: "+checks+" native policy, redirect, extraction, size, deadline and cancellation checks.");
    }
}
