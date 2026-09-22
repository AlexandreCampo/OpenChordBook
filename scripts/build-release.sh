#!/usr/bin/env bash
# Copyright (C) 2026 Alexandre Campo
# SPDX-License-Identifier: GPL-3.0-or-later
# Build an unsigned release with the same JDK as CI and F-Droid.
set -euo pipefail

if (( $# > 1 )); then
    echo "Usage: $0 [source-checkout]" >&2
    exit 2
fi
if [[ -z "${JAVA_HOME:-}" || ! -x "$JAVA_HOME/bin/javac" ]]; then
    echo "Set JAVA_HOME to your OpenJDK 21 installation." >&2
    exit 1
fi
compiler_version=$("$JAVA_HOME/bin/javac" -version 2>&1)
if [[ ! "$compiler_version" =~ ^javac\ 21(\.|$) ]]; then
    echo "Release builds require OpenJDK 21; found $compiler_version." >&2
    exit 1
fi

source_checkout=${1:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)}
export PATH="$JAVA_HOME/bin:$PATH"
cd -- "$source_checkout/android"
exec ./gradlew --no-daemon --no-build-cache clean assembleRelease -PunsignedRelease=true lintRelease
