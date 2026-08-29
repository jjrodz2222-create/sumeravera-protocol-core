plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

android {
    namespace = "com.sumeravera.pawsconnect"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.sumeravera.pawsconnect"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    buildTypes {
        release {
            // Minification disabled for this minimal widget-only build.
            // Enable and configure ProGuard/R8 rules when shipping a production release.
            isMinifyEnabled = false
        }
    }
}

dependencies {
    // No external dependencies required for this widget-only module
}
