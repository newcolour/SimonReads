package com.simonbianco.simonreads;

import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Disable edge-to-edge mode on Android 15+ (API 35+) to allow
        // StatusBar plugin to control the status bar background color
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            Window window = getWindow();
            // Tell the system that we want to handle system bar insets ourselves
            // This allows us to set a solid status bar background color
            WindowCompat.setDecorFitsSystemWindows(window, true);
        }
    }
}
