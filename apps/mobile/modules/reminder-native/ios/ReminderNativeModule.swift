import ExpoModulesCore
import ExpoNotifications
import UserNotifications
import UIKit

private let journalKey = "brandly.reminder-actions.v1"

// Native actions run before React/Redux exists. This journal is read by the
// same JS reconciler as Android's headless action journal on the next launch.
private enum ReminderJournal {
  static let lock = NSRecursiveLock()
  static func read() -> [String: [String: Any]] {
    lock.lock(); defer { lock.unlock() }
    return UserDefaults.standard.dictionary(forKey: journalKey) as? [String: [String: Any]] ?? [:]
  }
  static func write(_ id: String, _ action: [String: Any]?) {
    lock.lock(); defer { lock.unlock() }
    var journal = read()
    journal[id] = action
    UserDefaults.standard.set(journal, forKey: journalKey)
  }
}

public class ReminderNativeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ReminderNative")
    AsyncFunction("setOwner") { (owner: String) in UserDefaults.standard.set(owner, forKey: "brandly.reminder-owner.v1") }
    Function("createUUID") { UUID().uuidString.lowercased() }
    AsyncFunction("getActions") { ReminderJournal.read() }
    AsyncFunction("setAction") { (id: String, action: [String: Any]) in ReminderJournal.write(id, action) }
    AsyncFunction("removeAction") { (id: String) in ReminderJournal.write(id, nil) }
  }
}

// Keep Expo's delegate for presentation/push/navigation. Intercept only our
// two local actions so no JS runtime or network is needed to snooze or stop.
private class ReminderNotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
  static let shared = ReminderNotificationDelegate()
  let expo = NotificationCenterManager.shared

  func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
    expo.userNotificationCenter(center, willPresent: notification, withCompletionHandler: completionHandler)
  }

  func userNotificationCenter(_ center: UNUserNotificationCenter, openSettingsFor notification: UNNotification?) {
    expo.userNotificationCenter(center, openSettingsFor: notification)
  }

  func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void) {
    let request = response.notification.request
    let data = request.content.userInfo
    guard let id = data["reminderId"] as? String,
      let type = data["type"] as? String, ["task-reminder", "delivery-reminder"].contains(type),
      ["delivery-reminder-snooze", "delivery-reminder-stop"].contains(response.actionIdentifier) else {
      expo.userNotificationCenter(center, didReceive: response, withCompletionHandler: completionHandler)
      return
    }
    guard let owner = data["ownerId"] as? String, !owner.isEmpty,
      owner == UserDefaults.standard.string(forKey: "brandly.reminder-owner.v1") else {
      center.removeDeliveredNotifications(withIdentifiers: [request.identifier])
      completionHandler(); return
    }
    let previous = ReminderJournal.read()[id]
    if previous?["handledNotificationId"] as? String == request.identifier
      || (previous?["sourceDueAt"] as? Double ?? 0) > (data["dueAt"] as? Double ?? 0) {
      completionHandler(); return
    }
    let stop = response.actionIdentifier == "delivery-reminder-stop"
    let minutes = max(1, min(1440, data["snoozeMinutes"] as? Double ?? 5))
    let dueAt = stop ? (data["dueAt"] as? Double ?? Date().timeIntervalSince1970 * 1000)
      : ceil(Date().timeIntervalSince1970 + minutes * 60) * 1000
    let action: [String: Any] = [
      "reminderId": id, "taskId": data["taskId"] as? String ?? "",
      "ownerId": data["ownerId"] as? String ?? "",
      "sourceDueAt": data["dueAt"] as? Double ?? 0,
      "handledNotificationId": request.identifier, "stopped": stop,
      "dueAt": dueAt, "changedAt": Date().timeIntervalSince1970 * 1000
    ]
    ReminderJournal.write(id, action)
    center.getPendingNotificationRequests { requests in
      guard ReminderJournal.read()[id]?["handledNotificationId"] as? String == request.identifier else {
        completionHandler(); return
      }
      let ids = requests.filter { $0.content.userInfo["reminderId"] as? String == id }.map { $0.identifier }
      center.removePendingNotificationRequests(withIdentifiers: ids)
      center.removeDeliveredNotifications(withIdentifiers: [request.identifier] + ids)
      if stop {
        ReminderJournal.write(id, action); completionHandler(); return
      }
      let content = request.content.mutableCopy() as! UNMutableNotificationContent
      var nextData = data
      nextData["dueAt"] = dueAt
      content.userInfo = nextData
      let identifier = "brandly:\(id):\(Int64(dueAt))"
      var snoozedAction = action
      snoozedAction["notificationId"] = identifier
      // UTC calendar components preserve the chosen instant across timezone changes.
      var calendar = Calendar(identifier: .gregorian)
      calendar.timeZone = TimeZone(secondsFromGMT: 0)!
      var components = calendar.dateComponents([.year, .month, .day, .hour, .minute, .second],
        from: Date(timeIntervalSince1970: dueAt / 1000))
      components.timeZone = calendar.timeZone
      let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
      center.add(UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)) { error in
        if let error { snoozedAction["error"] = error.localizedDescription }
        if ReminderJournal.read()[id]?["handledNotificationId"] as? String == request.identifier {
          ReminderJournal.write(id, snoozedAction)
        }
        completionHandler()
      }
    }
  }
}

public class ReminderAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(_ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
    UNUserNotificationCenter.current().delegate = ReminderNotificationDelegate.shared
    return true
  }
}
