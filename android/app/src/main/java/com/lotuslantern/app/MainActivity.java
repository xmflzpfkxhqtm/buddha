package com.lotuslantern.app;

import android.content.Context;
import android.content.res.Configuration;
import android.os.Bundle;
import android.os.Handler; // 원래 코드를 위해 남겨둡니다.
import android.os.Looper;  // 원래 코드를 위해 남겨둡니다.
import android.util.Log;   // Log 사용을 위해 추가
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "MainActivityLotus"; // 로그 태그

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.d(TAG, "onCreate called");

        // 원래의 Handler + postDelayed 방식 (로그 추가)
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            Log.d(TAG, "Handler postDelayed - attempting to get WebView");
            WebView webView = this.bridge.getWebView();
            if (webView != null) {
                Log.d(TAG, "Handler postDelayed - WebView found. Current textZoom: " + webView.getSettings().getTextZoom());
                WebSettings settings = webView.getSettings();
                settings.setTextZoom(100);
                Log.d(TAG, "Handler postDelayed - WebView textZoom set to 100. New textZoom: " + settings.getTextZoom());
            } else {
                Log.e(TAG, "Handler postDelayed - WebView is NULL");
            }
        }, 1000); // 지연 시간을 조금 늘려봅니다. (테스트 목적)
    }

    @Override
    protected void attachBaseContext(Context newBase) {
        Log.d(TAG, "attachBaseContext called");
        Configuration configuration = new Configuration(newBase.getResources().getConfiguration());
        Log.d(TAG, "attachBaseContext - Original fontScale: " + configuration.fontScale);

        // 시스템 글꼴 크기 설정에 영향을 받지 않도록 fontScale을 1.0f (100%)로 고정
        configuration.fontScale = 1.0f;
        Context contextWithFixedFontScale = newBase.createConfigurationContext(configuration);

        Log.d(TAG, "attachBaseContext - New fontScale set to: " + contextWithFixedFontScale.getResources().getConfiguration().fontScale);
        super.attachBaseContext(contextWithFixedFontScale);
    }

    @Override
    public void load() {
        Log.d(TAG, "load() called - before super.load()");
        super.load(); // 반드시 super.load()를 먼저 호출해야 합니다.
        Log.d(TAG, "load() called - after super.load()");

        WebView webView = this.bridge.getWebView();
        if (webView != null) {
            Log.d(TAG, "load() - WebView found. Current textZoom: " + webView.getSettings().getTextZoom());
            WebSettings settings = webView.getSettings();
            settings.setTextZoom(100);
            Log.d(TAG, "load() - WebView textZoom set to 100. New textZoom: " + settings.getTextZoom());
        } else {
            Log.e(TAG, "load() - WebView instance is NULL");
        }
    }
}