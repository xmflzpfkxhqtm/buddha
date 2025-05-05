import UIKit
import Capacitor
import FirebaseCore              // ← ✅ 이미 추가하셨음
import FirebaseMessaging         // ← ✅ 토큰 전달용 (추가)

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

  var window: UIWindow?

  // 1) 앱 시작 시 Firebase 초기화
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    FirebaseApp.configure()      // ← ✅ 이 한 줄만 추가하면 끝
    return true
  }

  // 2) (선택) APNs 토큰을 FCM에 연결 — 푸시 수신용
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
    return ApplicationDelegateProxy.shared.application(application,
            continue: userActivity, restorationHandler: restorationHandler)
  }
}
