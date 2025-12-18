package com.simonbianco.simonreads;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();

        // Ensure system bars can be colored and are not translucent
        window.addFlags(android.view.WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);

        // Set initial dark color to status bar and navigation bar
        window.setStatusBarColor(android.graphics.Color.parseColor("#2c2c2e"));
        window.setNavigationBarColor(android.graphics.Color.parseColor("#2c2c2e"));

        // Use WindowInsetsControllerCompat to force white icons (dark theme mode)
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        if (controller != null) {
            // isAppearanceLightStatusBars = false means white icons
            controller.setAppearanceLightStatusBars(false);
            controller.setAppearanceLightNavigationBars(false);
        }

        // Disable edge-to-edge mode on Android 15+ (API 35+) to allow
        // StatusBar plugin to control the status bar background color
        // Using numerical value 35 for compatibility
        if (Build.VERSION.SDK_INT >= 35) {
            WindowCompat.setDecorFitsSystemWindows(window, true);
        }
    }
}
