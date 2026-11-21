plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "pl.mnemo.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "pl.mnemo.app"
        minSdk = 26
        targetSdk = 35
        versionCode = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()
        versionName = "1.0." + (System.getenv("GITHUB_RUN_NUMBER") ?: "0")
        ndk {
            // telefony (ARM) + emulatory x86_64 – mniejszy APK
            abiFilters += listOf("arm64-v8a", "armeabi-v7a", "x86_64")
        }
    }

    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }

    signingConfigs {
        // Stały klucz w repo => każda kolejna wersja z GH Actions instaluje się
        // "na" poprzednią bez utraty postępów. Można go podmienić sekretami (patrz README).
        create("stable") {
            val ksFile = System.getenv("MNEMO_KEYSTORE_FILE")
            if (ksFile != null && file(ksFile).exists()) {
                storeFile = file(ksFile)
                storePassword = System.getenv("MNEMO_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("MNEMO_KEY_ALIAS")
                keyPassword = System.getenv("MNEMO_KEY_PASSWORD")
            } else {
                storeFile = file("mnemo-dev.keystore")
                storePassword = "mnemo-dev"
                keyAlias = "mnemo"
                keyPassword = "mnemo-dev"
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("stable")
        }
        debug {
            signingConfig = signingConfigs.getByName("stable")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    androidResources {
        // nie kompresuj czcionek/zasobów www
        noCompress += listOf("woff2")
    }
}

dependencies {
    implementation("androidx.core:core:1.13.1")
    // OCR (skanowanie list słówek aparatem) – model w aplikacji, działa offline
    implementation("com.google.mlkit:text-recognition:16.0.1")
    // Tłumaczenie na urządzeniu (modele pobierane raz, potem offline)
    implementation("com.google.mlkit:translate:17.0.3")
}
