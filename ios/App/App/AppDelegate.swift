import UIKit
import Capacitor
import WebKit
import FirebaseCore
import FirebaseMessaging        // FCM 토큰 전달용

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

  var window: UIWindow?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {

    // 1️⃣ Firebase 초기화
    FirebaseApp.configure()

    // 2️⃣ 브리지 로드 완료 후 스와이프-백 켜기
    NotificationCenter.default.addObserver(
      forName: Notification.Name(rawValue: "CapacitorViewDidAppear"),  // ← 여기!
      object: nil,
      queue: .main
    ) { [weak self] _ in
      guard
        let rootVC  = self?.window?.rootViewController as? CAPBridgeViewController,
        let webView = rootVC.webView as? WKWebView
      else { return }

      webView.allowsBackForwardNavigationGestures = true
    }

    return true
  }

  // (선택) APNs 토큰을 FCM에 연결
  func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    Messaging.messaging().apnsToken = deviceToken
  }

  // ─────(아래 기본 코드 유지)─────
  func applicationWillResignActive(_ application: UIApplication) { }
  func applicationDidEnterBackground(_ application: UIApplication) { }
  func applicationWillEnterForeground(_ application: UIApplication) { }
  func applicationDidBecomeActive(_ application: UIApplication) { }
  func applicationWillTerminate(_ application: UIApplication) { }

  func application(_ app: UIApplication,
                   open url: URL,
                   options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
    return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
  }

  func application(_ application: UIApplication,
                   continue userActivity: NSUserActivity,
                   restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
    return ApplicationDelegateProxy.shared.application(
      application,
      continue: userActivity,
      restorationHandler: restorationHandler
    )
  }
}
