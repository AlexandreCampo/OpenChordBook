// Copyright (C) 2026 Alexandre Campo
// SPDX-License-Identifier: GPL-3.0-or-later
package io.github.openchordbook;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class PlaylistDownloader {
    static final int MAX_PAGE_BYTES = 8 * 1024 * 1024;
    static final long TIMEOUT_MS = 30000;
    private static final Pattern HREF_URI = Pattern.compile("href=\"(irealb://[^\"]*)\"", Pattern.CASE_INSENSITIVE);
    private static final String MUSIC_PREFIX = "1r34LbKcu7";

    static final class Job {
        final long deadline;
        volatile boolean cancelled;
        volatile HttpURLConnection connection;
        Job() { this(TIMEOUT_MS); }
        Job(long timeoutMs) { deadline = System.nanoTime() + timeoutMs * 1000000L; }
        void check() throws IOException {
            if (cancelled || Thread.currentThread().isInterrupted()) throw new IOException("Download cancelled.");
            if (System.nanoTime() >= deadline) throw new java.net.SocketTimeoutException("Download timed out.");
        }
        int remainingMs() throws IOException {
            check();
            return (int) Math.max(1, Math.min(10000, (deadline - System.nanoTime()) / 1000000));
        }
        void cancel() {
            cancelled = true;
            HttpURLConnection active = connection;
            if (active != null) active.disconnect();
        }
    }

    interface Connector { HttpURLConnection open(URI uri) throws Exception; }

    static String fetch(String source, String name, Job job) throws Exception {
        return fetch(source, name, job, uri -> {
            for (InetAddress address : InetAddress.getAllByName(uri.getHost())) {
                if (!NetworkPolicy.publicAddress(address)) throw new IOException("Source resolved to a private network address.");
            }
            job.check();
            return (HttpURLConnection) uri.toURL().openConnection();
        });
    }

    static String fetch(String source, String name, Job job, Connector connector) throws Exception {
        URI current = NetworkPolicy.download(source, null);
        final String host = current.getHost();
        for (int redirects = 0; redirects <= 4; redirects++) {
            job.check();
            NetworkPolicy.download(current.toString(), host);
            HttpURLConnection conn = connector.open(current);
            job.connection = conn;
            try {
                conn.setInstanceFollowRedirects(false);
                conn.setConnectTimeout(job.remainingMs());
                conn.setReadTimeout(job.remainingMs());
                conn.setUseCaches(false);
                conn.setRequestProperty("User-Agent", "openchordbook-android/1.17 (user-initiated playlist download)");
                conn.setRequestProperty("Accept-Encoding", "identity");
                int code = conn.getResponseCode();
                job.check();
                if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                    String location = conn.getHeaderField("Location");
                    if (location == null || redirects == 4) throw new IOException("Too many or invalid source redirects.");
                    // Fragments identify posts inside forum pages and are never sent to a server.
                    String target = current.resolve(location).toString();
                    int fragment = target.indexOf('#');
                    if (fragment >= 0) target = target.substring(0, fragment);
                    current = NetworkPolicy.download(target, host);
                    continue;
                }
                if (code != 200) throw new IOException("Source returned HTTP " + code + ".");
                if (conn.getContentLengthLong() > MAX_PAGE_BYTES) throw new IOException("Source page too large (8 MB maximum).");
                String page;
                try (InputStream in = conn.getInputStream()) { page = readBounded(in, job); }
                job.check();
                String result = pickPlaylist(extractUris(page), name);
                job.check();
                return result;
            } finally {
                conn.disconnect();
                job.connection = null;
            }
        }
        throw new IOException("Too many source redirects.");
    }

    static String readBounded(InputStream in, Job job) throws Exception {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        byte[] chunk = new byte[16384];
        while (true) {
            job.check();
            int n = in.read(chunk);
            job.check();
            if (n < 0) break;
            if (buf.size() + n > MAX_PAGE_BYTES) throw new IOException("Source page too large (8 MB maximum).");
            buf.write(chunk, 0, n);
        }
        return new String(buf.toByteArray(), StandardCharsets.UTF_8);
    }
    /** All irealb:// URIs found in href attributes, HTML entities decoded. */
    static List<String> extractUris(String page) {
        List<String> uris = new ArrayList<>();
        Matcher m = HREF_URI.matcher(page);
        while (m.find()) {
            if (m.end(1) - m.start(1) > 6 * 1024 * 1024) throw new IllegalArgumentException("Playlist link too large.");
            String uri = unescapeEntities(m.group(1));
            // The TGJC export is PHP-addslashes-escaped; normalize.
            uri = uri.replace("\\'", "'");
            uris.add(uri);
        }
        return uris;
    }

    /**
     * Pick the requested playlist: the URI whose playlist name matches the
     * hint, or the one containing the most songs when no hint is given.
     */
    static String pickPlaylist(List<String> uris, String nameHint) {
        String bestNamed = null;
        String bestLargest = null;
        int bestCount = 0;
        for (String uri : uris) {
            String decoded = percentDecode(uri.substring("irealb://".length()));
            if (decoded.length() > 3 * 1024 * 1024) throw new IllegalArgumentException("Decoded playlist too large.");
            String[] parts = decoded.split("===", 2002);
            if (parts.length > 2001) throw new IllegalArgumentException("Playlist has too many tunes (2000 maximum).");
            int songs = 0;
            for (String p : parts) {
                if (p.contains(MUSIC_PREFIX)) songs++;
            }
            if (songs == 0) continue;
            String name = null;
            String last = parts[parts.length - 1];
            if (parts.length > 1 && !last.contains(MUSIC_PREFIX)) {
                name = last;
            }
            if (nameHint != null && name != null
                    && name.trim().equalsIgnoreCase(nameHint.trim())) {
                bestNamed = uri; // exact match wins regardless of size
            }
            if (songs > bestCount) {
                bestCount = songs;
                bestLargest = uri;
            }
        }
        if (nameHint != null) {
            return bestNamed != null ? bestNamed : "";
        }
        return bestLargest != null ? bestLargest : "";
    }

    /** decodeURIComponent equivalent: %XX bytes, UTF-8, '+' preserved. */
    static String percentDecode(String s) {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '%' && i + 2 < s.length()) {
                try {
                    bytes.write(Integer.parseInt(s.substring(i + 1, i + 3), 16));
                    i += 2;
                    continue;
                } catch (NumberFormatException ignored) {
                    // fall through: keep literal '%'
                }
            }
            byte[] cb = String.valueOf(c).getBytes(StandardCharsets.UTF_8);
            bytes.write(cb, 0, cb.length);
        }
        return new String(bytes.toByteArray(), StandardCharsets.UTF_8);
    }

    static String unescapeEntities(String s) {
        return s.replace("&amp;", "&")
                .replace("&#039;", "'")
                .replace("&#39;", "'")
                .replace("&#x27;", "'")
                .replace("&quot;", "\"");
    }
}
