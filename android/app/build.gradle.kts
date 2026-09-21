// Copyright (C) 2026 Alexandre Campo
// SPDX-License-Identifier: GPL-3.0-or-later
import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
}

// Optional release signing: android/keystore.properties with
//   storeFile=<path>  storePassword=...  keyAlias=...  keyPassword=...
// The file and the keystore are gitignored; generate your own with keytool.
val keystorePropsFile = rootProject.file("keystore.properties")
val signRelease = !providers.gradleProperty("unsignedRelease").isPresent && keystorePropsFile.exists()
val keystoreProps = Properties().apply {
    if (signRelease) FileInputStream(keystorePropsFile).use { load(it) }
}

// Sync the web app (repo root) into the APK assets so the app is fully
// offline. Single source of truth: the web files in this repository.
val syncWebAssets by tasks.registering(Sync::class) {
    from(rootProject.projectDir.parentFile) {
        include("index.html", "manifest.webmanifest", "sw.js")
        include("LICENSE", "COPYRIGHT", "THIRD_PARTY_NOTICES.md", "PRIVACY.md", "licenses/**")
        include("src/**")
        include("data/**")
        include("vendor/**")
        exclude("vendor/package.json")
        include("icons/**")
    }
    into(layout.projectDirectory.dir("src/main/assets/web"))
}

android {
    namespace = "io.github.openchordbook"
    compileSdk = 36

    defaultConfig {
        applicationId = "io.github.openchordbook"
        minSdk = 24
        targetSdk = 36
        testInstrumentationRunner = "io.github.openchordbook.SecurityInstrumentation"
        versionCode = 18
        versionName = "1.17"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    if (signRelease) {
        signingConfigs {
            create("release") {
                storeFile = rootProject.file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            // Isolated app data for instrumentation; never touch the installed library.
            applicationIdSuffix = ".securitytest"
        }
        release {
            isMinifyEnabled = false
            if (signRelease) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }
}

tasks.named("preBuild") { dependsOn(syncWebAssets) }

dependencies {
    implementation("androidx.core:core:1.17.0")
    implementation("androidx.webkit:webkit:1.14.0")
}
