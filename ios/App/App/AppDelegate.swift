import UIKit
import Capacitor
import WebKit
import FirebaseCore
import FirebaseMessaging         // FCM 토큰 전달용

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

  var window: UIWindow?

  // 앱 시작 시
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {

    // 1️⃣ Firebase 초기화
    FirebaseApp.configure()

    // 2️⃣ iOS 엣지-스와이프 뒤로가기 활성화
    if let vc = window?.rootViewController as? CAPBridgeViewController,
       let webView = vc.webView as? WKWebView {
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

  // ─────(아래 기존 코드 그대로)─────
  func applicationWillResignActive(_ application: UIApplication) { }
  func applicationDidEnterBackground(_ application: UIApplication) { }
  func applicationWillEnterForeground(_ application: UIApplication) { }
  func applicationDidBecomeActive(_ application: UIApplication) { }
  func applicationWillTerminate(_ application: UIApplication) { }

  func application(_ app: UIApplication, open url: URL,
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
