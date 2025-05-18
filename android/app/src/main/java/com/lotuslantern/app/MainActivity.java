package com.lotuslantern.app;

import android.content.Context;
import android.content.res.Configuration;
import android.content.res.Resources;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** ───────── 시스템 글꼴 배율 완전 차단 ───────── */
    @Override
    public Resources getResources() {
        Resources res = super.getResources();
        Configuration cfg = res.getConfiguration();

        if (cfg.fontScale != 1f) {          // 접근성 글꼴 크기를 1.0으로 고정
            cfg = new Configuration(cfg);   // copy
            cfg.fontScale = 1f;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N_MR1) {
                Context ctx = createConfigurationContext(cfg);
                res = ctx.getResources();
            } else {
                // API < 25
                res.updateConfiguration(cfg, res.getDisplayMetrics());
            }
        }
        return res;
    }

    /** ───────── WebView textZoom 100% 강제 ───────── */
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getBridge().getWebView().post(() -> {
            WebView  wv  = getBridge().getWebView();
            WebSettings ws = wv.getSettings();
            ws.setTextZoom(100);            // 시스템 Font-size → 무시
        });
    }
}
