// Copyright (C) 2026 Alexandre Campo
// SPDX-License-Identifier: GPL-3.0-or-later
package com.jazz4all.android;

import java.net.InetAddress;
import java.net.URI;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/** No Android dependencies, so the same policy can be tested on the JVM. */
final class NetworkPolicy {
    // Same origin preserves IndexedDB; a versioned path bypasses older service workers.
    static final String ASSET_PATH = "/assets/v13/web/";
    static final String ASSET_HOST = "appassets.androidplatform.net";
    private static final Set<String> DOWNLOAD_HOSTS = new HashSet<>(Arrays.asList(
            "forums.irealpro.com", "www.martingioani.com", "dl.dropboxusercontent.com"));

    static URI https(String value) {
        try {
            URI uri = new URI(value);
            if (!"https".equals(uri.getScheme()) || uri.getHost() == null
                    || uri.getRawUserInfo() != null || (uri.getPort() != -1 && uri.getPort() != 443)
                    || value.indexOf('\\') >= 0) return null;
            return uri;
        } catch (Exception e) { return null; }
    }

    static boolean localOrigin(String value) {
        URI uri = https(value);
        return uri != null && ASSET_HOST.equals(uri.getHost());
    }

    static boolean localAsset(String value) {
        URI uri = https(value);
        return uri != null && ASSET_HOST.equals(uri.getHost()) && uri.getRawQuery() == null
                && uri.getRawPath().startsWith(ASSET_PATH)
                && !uri.getRawPath().contains("%") && !uri.getRawPath().contains("..")
                && !uri.getRawPath().contains("//");
    }

    static boolean appDocument(String value) {
        URI uri = https(value);
        return localAsset(value) && (ASSET_PATH + "index.html").equals(uri.getRawPath());
    }

    static boolean externalLink(String value) {
        URI uri = https(value);
        return uri != null && !ASSET_HOST.equals(uri.getHost());
    }

    static URI download(String value, String originalHost) {
        URI uri = https(value);
        if (uri == null || uri.getRawFragment() != null || !DOWNLOAD_HOSTS.contains(uri.getHost())
                || (originalHost != null && !originalHost.equals(uri.getHost()))) {
            throw new IllegalArgumentException("Download destination is not permitted.");
        }
        return uri;
    }

    static boolean publicAddress(InetAddress address) {
        if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
                || address.isSiteLocalAddress() || address.isMulticastAddress()) return false;
        byte[] b = address.getAddress();
        int first = b[0] & 255, second = b[1] & 255;
        if (b.length == 4) {
            return first != 0 && first != 127 && first < 224
                    && !(first == 100 && second >= 64 && second <= 127)
                    && !(first == 169 && second == 254)
                    && !(first == 192 && second == 0)
                    && !(first == 198 && (second == 18 || second == 19));
        }
        // Only global unicast IPv6; excludes ULA, mapped/local and multicast ranges.
        return b.length == 16 && (first & 0xe0) == 0x20;
    }
}
