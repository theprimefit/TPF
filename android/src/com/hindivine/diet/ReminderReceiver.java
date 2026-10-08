package com.hindivine.diet;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Lead follow-up reminders for Hindivine Admin: the page schedules them through the
 * JavaScript bridge, AlarmManager wakes this receiver at the follow-up time and it shows a
 * notification that opens the app. (Alarms are cleared by a phone restart; the app
 * schedules them again the next time it is opened.)
 */
public class ReminderReceiver extends BroadcastReceiver {
    private static final String CHANNEL = "followups";
    private static final String PREFS = "hindivine.reminders";
    private static final int FLAG_IMMUTABLE = 0x04000000; // PendingIntent.FLAG_IMMUTABLE (API 23+)

    @Override
    public void onReceive(Context context, Intent intent) {
        show(context, intent.getStringExtra("title"), intent.getStringExtra("text"), intent.getIntExtra("code", 1));
    }

    static void schedule(Context context, String json) {
        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String old = prefs.getString("codes", "");
            for (String c : old.split(",")) {
                if (c.isEmpty()) continue;
                am.cancel(pending(context, Integer.parseInt(c), null, null));
            }
            JSONArray list = new JSONArray(json);
            StringBuilder codes = new StringBuilder();
            long now = System.currentTimeMillis();
            for (int i = 0; i < list.length() && i < 60; i++) {
                JSONObject r = list.getJSONObject(i);
                long at = r.getLong("at");
                if (at <= now) continue;
                int code = 1000 + i;
                PendingIntent pi = pending(context, code, r.optString("title"), r.optString("text"));
                if (Build.VERSION.SDK_INT >= 23) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                else am.set(AlarmManager.RTC_WAKEUP, at, pi);
                codes.append(code).append(',');
            }
            prefs.edit().putString("codes", codes.toString()).apply();
        } catch (Exception ignored) {
            // A bad list must never crash the app.
        }
    }

    private static PendingIntent pending(Context context, int code, String title, String text) {
        Intent i = new Intent(context, ReminderReceiver.class);
        i.putExtra("code", code);
        if (title != null) i.putExtra("title", title);
        if (text != null) i.putExtra("text", text);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? FLAG_IMMUTABLE : 0);
        return PendingIntent.getBroadcast(context, code, i, flags);
    }

    static void show(Context context, String title, String text, int id) {
        try {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            Notification.Builder b;
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationChannel ch = new NotificationChannel(CHANNEL, "Follow-up reminders", NotificationManager.IMPORTANCE_HIGH);
                ch.setDescription("Lead follow-ups due in Hindivine Admin");
                nm.createNotificationChannel(ch);
                b = new Notification.Builder(context, CHANNEL);
            } else {
                b = new Notification.Builder(context);
                b.setPriority(Notification.PRIORITY_HIGH);
                b.setDefaults(Notification.DEFAULT_ALL);
            }
            Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
            int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? FLAG_IMMUTABLE : 0);
            b.setSmallIcon(context.getApplicationInfo().icon)
                    .setContentTitle(title == null ? "Follow-up reminder" : title)
                    .setContentText(text == null ? "" : text)
                    .setStyle(new Notification.BigTextStyle().bigText(text == null ? "" : text))
                    .setAutoCancel(true)
                    .setContentIntent(PendingIntent.getActivity(context, id, open, flags));
            nm.notify(id, b.build());
        } catch (Exception ignored) {
            // Notifications switched off or not allowed: nothing to show.
        }
    }
}
