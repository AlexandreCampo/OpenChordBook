// Copyright (C) 2026 Alexandre Campo
// SPDX-License-Identifier: GPL-3.0-or-later
package com.jazz4all.android;

import java.nio.charset.StandardCharsets;

/** The one file type the app can write through Android's document picker. */
final class PlaylistExport {
    static final int MAX_BYTES = 10 * 1024 * 1024;

    static byte[] content(String text) {
        if (text == null || text.isEmpty() || text.length() > MAX_BYTES) {
            throw new IllegalArgumentException("Choose a playlist smaller than 10 MB.");
        }
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_BYTES) throw new IllegalArgumentException("Choose a playlist smaller than 10 MB.");
        return bytes;
    }

    static String filename(String value) {
        String name = value == null ? "jazz4all" : value.replaceAll("[\\p{Cntrl}/\\\\:*?\"<>|]", "-")
                .replaceAll("^[. ]+|[. ]+$", "");
        if (name.endsWith(".html")) name = name.substring(0, name.length() - 5);
        if (name.length() > 100) name = name.substring(0, 100);
        return (name.isEmpty() ? "jazz4all" : name) + ".html";
    }
}
