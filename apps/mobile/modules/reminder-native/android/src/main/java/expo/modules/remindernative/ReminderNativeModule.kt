package expo.modules.remindernative

import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.IBinder
import org.json.JSONArray
import org.json.JSONObject
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ReminderNativeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ReminderNative")

    Function("createUUID") { java.util.UUID.randomUUID().toString() }

    AsyncFunction("setOwner") { owner: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("Application context unavailable")
      val previous = context.getSharedPreferences(ReminderStore.PREFS, Context.MODE_PRIVATE)
        .getString(ReminderStore.OWNER_KEY, "") ?: ""
      if (previous != owner) ReminderAlarmScheduler.cancelAll(context)
      context.getSharedPreferences(ReminderStore.PREFS, Context.MODE_PRIVATE)
        .edit().putString(ReminderStore.OWNER_KEY, owner).apply()
    }

    AsyncFunction("getActions") {
      val context = appContext.reactContext ?: throw IllegalStateException("Application context unavailable")
      ReminderStore.readActions(context)
    }

    AsyncFunction("setAction") { id: String, action: Map<String, Any?> ->
      val context = appContext.reactContext ?: throw IllegalStateException("Application context unavailable")
      ReminderStore.writeAction(context, id, action)
    }

    AsyncFunction("removeAction") { id: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("Application context unavailable")
      ReminderStore.removeAction(context, id)
    }

    AsyncFunction("scheduleReminder") { options: Map<String, Any?> ->
      val context = appContext.reactContext ?: throw IllegalStateException("Application context unavailable")
      ReminderAlarmScheduler.schedule(
        context,
        options["reminderId"] as? String ?: throw IllegalArgumentException("Reminder id is required"),
        (options["triggerAtMillis"] as? Number)?.toLong() ?: throw IllegalArgumentException("Reminder time is required"),
        options["title"] as? String ?: "Reminder",
        options["body"] as? String ?: "",
        options["soundFile"] as? String ?: "",
        options["soundEnabled"] as? Boolean ?: false,
        options["vibrationEnabled"] as? Boolean ?: true,
        (options["snoozeMinutes"] as? Number)?.toInt()?.coerceIn(1, 1440) ?: 5,
        options["ownerId"] as? String ?: "",
        options["taskId"] as? String,
      )
    }

    AsyncFunction("cancelReminder") { reminderId: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("Application context unavailable")
      ReminderAlarmScheduler.cancel(context, reminderId)
      ReminderAlarmService.cancelActive(reminderId)
    }

    AsyncFunction("cancelAllReminders") {
      val context = appContext.reactContext ?: throw IllegalStateException("Application context unavailable")
      ReminderAlarmScheduler.cancelAll(context)
    }

    AsyncFunction("canScheduleExactAlarms") {
      val context = appContext.reactContext ?: throw IllegalStateException("Application context unavailable")
      Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
        (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).canScheduleExactAlarms()
    }
  }
}

private object ReminderStore {
  const val PREFS = "brandly.reminder-native"
  const val OWNER_KEY = "owner"
  private const val ACTIONS_KEY = "actions"

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun readActions(context: Context): Map<String, Map<String, Any?>> {
    val result = linkedMapOf<String, Map<String, Any?>>()
    val root = JSONObject(prefs(context).getString(ACTIONS_KEY, "{}") ?: "{}")
    val keys = root.keys()
    while (keys.hasNext()) {
      val id = keys.next()
      val action = root.optJSONObject(id) ?: continue
      val values = linkedMapOf<String, Any?>()
      val actionKeys = action.keys()
      while (actionKeys.hasNext()) {
        val key = actionKeys.next()
        val value = action.opt(key)
        values[key] = if (value == JSONObject.NULL) null else value
      }
      result[id] = values
    }
    return result
  }

  fun writeAction(context: Context, id: String, action: Map<String, Any?>) {
    val root = JSONObject(prefs(context).getString(ACTIONS_KEY, "{}") ?: "{}")
    root.put(id, JSONObject(action))
    prefs(context).edit().putString(ACTIONS_KEY, root.toString()).apply()
  }

  fun removeAction(context: Context, id: String) {
    val root = JSONObject(prefs(context).getString(ACTIONS_KEY, "{}") ?: "{}")
    root.remove(id)
    prefs(context).edit().putString(ACTIONS_KEY, root.toString()).apply()
  }
}

private object ReminderAlarmScheduler {
  const val ACTION_START = "com.brandly.marketplace.REMINDER_ALARM"
  const val ACTION_SNOOZE = "com.brandly.marketplace.REMINDER_SNOOZE"
  const val ACTION_STOP = "com.brandly.marketplace.REMINDER_STOP"
  const val ACTION_CANCEL = "com.brandly.marketplace.REMINDER_CANCEL"
  const val ACTION_CANCEL_ALL = "com.brandly.marketplace.REMINDER_CANCEL_ALL"

  const val REMINDER_ID = "reminderId"
  const val DUE_AT = "dueAt"
  const val TITLE = "title"
  const val BODY = "body"
  const val SOUND_FILE = "soundFile"
  const val SOUND_ENABLED = "soundEnabled"
  const val VIBRATION_ENABLED = "vibrationEnabled"
  const val SNOOZE_MINUTES = "snoozeMinutes"
  const val OWNER_ID = "ownerId"
  const val TASK_ID = "taskId"

  private const val IDS_KEY = "scheduled-ids"

  private fun alarmManager(context: Context) =
    context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  private fun requestCode(reminderId: String, suffix: String = "") =
    ("brandly:$reminderId:$suffix").hashCode()

  private fun pendingIntent(context: Context, reminderId: String, intent: Intent): PendingIntent =
    PendingIntent.getBroadcast(
      context,
      requestCode(reminderId, intent.action ?: "start"),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  private fun baseIntent(context: Context, reminderId: String) =
    Intent(context, ReminderAlarmReceiver::class.java)
      .setAction(ACTION_START)
      .putExtra(REMINDER_ID, reminderId)

  fun schedule(
    context: Context,
    reminderId: String,
    triggerAtMillis: Long,
    title: String,
    body: String,
    soundFile: String,
    soundEnabled: Boolean,
    vibrationEnabled: Boolean,
    snoozeMinutes: Int,
    ownerId: String,
    taskId: String?,
  ): String {
    if (triggerAtMillis <= System.currentTimeMillis()) throw IllegalArgumentException("Choose a future reminder time")
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager(context).canScheduleExactAlarms()) {
      throw SecurityException("Allow Alarms & reminders for Brandly in device settings, then retry.")
    }
    val intent = baseIntent(context, reminderId).apply {
      putExtra(DUE_AT, triggerAtMillis)
      putExtra(TITLE, title)
      putExtra(BODY, body)
      putExtra(SOUND_FILE, soundFile)
      putExtra(SOUND_ENABLED, soundEnabled)
      putExtra(VIBRATION_ENABLED, vibrationEnabled)
      putExtra(SNOOZE_MINUTES, snoozeMinutes)
      putExtra(OWNER_ID, ownerId)
      putExtra(TASK_ID, taskId)
    }
    val pendingIntent = pendingIntent(context, reminderId, intent)
    val alarms = alarmManager(context)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
    } else {
      alarms.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent)
    }
    val ids = readIds(context).apply { add(reminderId) }
    writeIds(context, ids)
    return "brandly:$reminderId:$triggerAtMillis"
  }

  fun cancel(context: Context, reminderId: String) {
    alarmManager(context).cancel(pendingIntent(context, reminderId, baseIntent(context, reminderId)))
    val ids = readIds(context).apply { remove(reminderId) }
    writeIds(context, ids)
  }

  fun cancelAll(context: Context) {
    readIds(context).toList().forEach { id ->
      alarmManager(context).cancel(pendingIntent(context, id, baseIntent(context, id)))
    }
    writeIds(context, mutableSetOf())
    ReminderAlarmService.cancelAllActive()
  }

  private fun readIds(context: Context): MutableSet<String> {
    val value = context.getSharedPreferences(ReminderStore.PREFS, Context.MODE_PRIVATE)
      .getString(IDS_KEY, "[]") ?: "[]"
    val array = JSONArray(value)
    val ids = linkedSetOf<String>()
    for (index in 0 until array.length()) ids.add(array.optString(index))
    return ids
  }

  private fun writeIds(context: Context, ids: Set<String>) {
    val array = JSONArray()
    ids.filter { it.isNotBlank() }.forEach(array::put)
    context.getSharedPreferences(ReminderStore.PREFS, Context.MODE_PRIVATE)
      .edit().putString(IDS_KEY, array.toString()).apply()
  }
}

class ReminderAlarmReceiver : android.content.BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val serviceIntent = Intent(context, ReminderAlarmService::class.java).apply {
      action = intent.action
      putExtras(intent)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(serviceIntent)
    else context.startService(serviceIntent)
  }
}

class ReminderAlarmService : Service() {
  private data class ActiveReminder(val intent: Intent, val notificationId: Int)

  private val players = linkedMapOf<String, MediaPlayer>()
  private val active = linkedMapOf<String, ActiveReminder>()
  private var foregroundNotificationId: Int? = null
  private val notificationManager by lazy { getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager }

  override fun onCreate() {
    super.onCreate()
    instance = this
    createChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent == null) return START_NOT_STICKY
    when (intent.action) {
      ReminderAlarmScheduler.ACTION_START -> startReminder(intent)
      ReminderAlarmScheduler.ACTION_SNOOZE -> handleAction(intent, stopped = false)
      ReminderAlarmScheduler.ACTION_STOP -> handleAction(intent, stopped = true)
      ReminderAlarmScheduler.ACTION_CANCEL -> cancelReminder(intent.getStringExtra(ReminderAlarmScheduler.REMINDER_ID).orEmpty())
      ReminderAlarmScheduler.ACTION_CANCEL_ALL -> stopAll()
    }
    return START_NOT_STICKY
  }

  private fun startReminder(intent: Intent) {
    val id = intent.getStringExtra(ReminderAlarmScheduler.REMINDER_ID).orEmpty()
    if (id.isBlank()) return
    stopReminderSound(id)
    val notificationId = notificationId(id)
    active[id] = ActiveReminder(intent, notificationId)
    if (intent.getBooleanExtra(ReminderAlarmScheduler.SOUND_ENABLED, false)) startReminderSound(id, intent)
    val notification = buildNotification(intent, notificationId)
    if (foregroundNotificationId == null) {
      startForeground(notificationId, notification)
      foregroundNotificationId = notificationId
    } else {
      notificationManager.notify(notificationId, notification)
    }
  }

  private fun notificationId(reminderId: String) = (reminderId.hashCode() and 0x7fffffff) % 100_000 + 10_000

  private fun startReminderSound(id: String, intent: Intent) {
    val file = intent.getStringExtra(ReminderAlarmScheduler.SOUND_FILE).orEmpty()
    val resourceName = file.substringBeforeLast('.').replace('-', '_')
    val resourceId = resources.getIdentifier(resourceName, "raw", packageName)
    if (resourceId == 0) return
    try {
      val player = MediaPlayer().apply {
        setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build(),
        )
        setDataSource(this@ReminderAlarmService, Uri.parse("android.resource://$packageName/$resourceId"))
        isLooping = true
        prepare()
        start()
      }
      players[id] = player
    } catch (_: Exception) {
      players.remove(id)?.release()
    }
  }

  private fun handleAction(intent: Intent, stopped: Boolean) {
    val id = intent.getStringExtra(ReminderAlarmScheduler.REMINDER_ID).orEmpty()
    if (id.isBlank()) return
    val currentDueAt = intent.getLongExtra(ReminderAlarmScheduler.DUE_AT, 0L)
    val handledNotificationId = "brandly:$id:$currentDueAt"
    val previous = ReminderStore.readActions(this)[id]
    if (previous?.get("handledNotificationId") == handledNotificationId) return
    val ownerId = intent.getStringExtra(ReminderAlarmScheduler.OWNER_ID).orEmpty()
    val taskId = intent.getStringExtra(ReminderAlarmScheduler.TASK_ID)
    val minutes = intent.getIntExtra(ReminderAlarmScheduler.SNOOZE_MINUTES, 5).coerceIn(1, 1440)
    val nextDueAt = if (stopped) currentDueAt else ((System.currentTimeMillis() + minutes * 60_000L + 999L) / 1000L) * 1000L
    val action = linkedMapOf<String, Any?>(
      "reminderId" to id,
      "ownerId" to ownerId,
      "sourceDueAt" to currentDueAt,
      "handledNotificationId" to handledNotificationId,
      "stopped" to stopped,
      "dueAt" to nextDueAt,
      "changedAt" to System.currentTimeMillis(),
    )
    if (!taskId.isNullOrBlank()) action["taskId"] = taskId
    if (!stopped) {
      ReminderAlarmScheduler.schedule(
        this, id, nextDueAt,
        intent.getStringExtra(ReminderAlarmScheduler.TITLE).orEmpty(),
        intent.getStringExtra(ReminderAlarmScheduler.BODY).orEmpty(),
        intent.getStringExtra(ReminderAlarmScheduler.SOUND_FILE).orEmpty(),
        intent.getBooleanExtra(ReminderAlarmScheduler.SOUND_ENABLED, false),
        intent.getBooleanExtra(ReminderAlarmScheduler.VIBRATION_ENABLED, true),
        minutes, ownerId, taskId,
      )
      action["notificationId"] = "brandly:$id:$nextDueAt"
    } else {
      ReminderAlarmScheduler.cancel(this, id)
    }
    ReminderStore.writeAction(this, id, action)
    cancelReminder(id)
  }

  private fun buildNotification(intent: Intent, notificationId: Int): Notification {
    val id = intent.getStringExtra(ReminderAlarmScheduler.REMINDER_ID).orEmpty()
    val title = intent.getStringExtra(ReminderAlarmScheduler.TITLE).takeUnless { it.isNullOrBlank() } ?: "Reminder"
    val body = intent.getStringExtra(ReminderAlarmScheduler.BODY).orEmpty()
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    val snoozeIntent = Intent(this, ReminderAlarmReceiver::class.java).apply {
      action = ReminderAlarmScheduler.ACTION_SNOOZE
      putExtras(intent)
    }
    val stopIntent = Intent(this, ReminderAlarmReceiver::class.java).apply {
      action = ReminderAlarmScheduler.ACTION_STOP
      putExtras(intent)
    }
    val snooze = PendingIntent.getBroadcast(this, notificationId + 1, snoozeIntent, flags)
    val stop = PendingIntent.getBroadcast(this, notificationId + 2, stopIntent, flags)
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      putExtra("brandly.reminder.reminderId", id)
      putExtra("brandly.reminder.taskId", intent.getStringExtra(ReminderAlarmScheduler.TASK_ID))
    }
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, ALARM_CHANNEL_ID)
    else Notification.Builder(this)
    builder
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(Notification.BigTextStyle().bigText(body))
      .setCategory(Notification.CATEGORY_ALARM)
      .setOngoing(true)
      .setAutoCancel(false)
      .setOnlyAlertOnce(true)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .addAction(Notification.Action.Builder(null, "Snooze", snooze).build())
      .addAction(Notification.Action.Builder(null, "Stop", stop).build())
    if (launchIntent != null) builder.setContentIntent(PendingIntent.getActivity(this, notificationId, launchIntent, flags))
    if (intent.getBooleanExtra(ReminderAlarmScheduler.VIBRATION_ENABLED, true)) builder.setVibrate(longArrayOf(0, 250, 250, 250))
    return builder.build()
  }

  private fun cancelReminder(id: String) {
    stopReminderSound(id)
    val entry = active.remove(id) ?: return
    notificationManager.cancel(entry.notificationId)
    if (foregroundNotificationId == entry.notificationId) {
      val next = active.values.firstOrNull()
      if (next == null) {
        stopForeground(STOP_FOREGROUND_REMOVE)
        foregroundNotificationId = null
        stopSelf()
      } else {
        val notification = buildNotification(next.intent, next.notificationId)
        startForeground(next.notificationId, notification)
        foregroundNotificationId = next.notificationId
      }
    }
  }

  private fun stopReminderSound(id: String) {
    players.remove(id)?.let { player ->
      try { if (player.isPlaying) player.stop() } catch (_: Exception) { }
      player.release()
    }
  }

  private fun stopAll() {
    players.values.forEach { player ->
      try { if (player.isPlaying) player.stop() } catch (_: Exception) { }
      player.release()
    }
    players.clear()
    active.clear()
    notificationManager.cancelAll()
    if (foregroundNotificationId != null) stopForeground(STOP_FOREGROUND_REMOVE)
    foregroundNotificationId = null
    stopSelf()
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    if (notificationManager.getNotificationChannel(ALARM_CHANNEL_ID) != null) return
    val channel = NotificationChannel(ALARM_CHANNEL_ID, "Reminder alarms", NotificationManager.IMPORTANCE_HIGH)
    channel.setSound(null, null)
    channel.enableVibration(false)
    notificationManager.createNotificationChannel(channel)
  }

  override fun onDestroy() {
    stopAll()
    instance = null
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  companion object {
    private const val ALARM_CHANNEL_ID = "brandly_reminder_alarm_v1"
    @Volatile private var instance: ReminderAlarmService? = null

    fun cancelActive(id: String) { instance?.cancelReminder(id) }
    fun cancelAllActive() { instance?.stopAll() }
  }
}
