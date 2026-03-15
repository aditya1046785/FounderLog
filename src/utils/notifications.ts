import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getAppStateValue, getDatabase, getStreakInfo, setAppStateValue } from '../database/database';
import { getTodayProblemsCount } from '../database/problemService';

type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

type MessageTemplate = {
  title: string;
  body: string;
};

const TARGET_COUNT = 10;
const CHANNEL_ID = 'daily-reminder';
const DAILY_REMINDER_KEY = 'notification_daily_reminder_id';
const TODAY_FOLLOWUP_IDS_KEY = 'notification_today_followup_ids';
const TODAY_FOLLOWUP_DATE_KEY = 'notification_today_followup_date';
const LAST_TEMPLATE_INDEX_KEY = 'notification_last_template_index';
const PERMISSION_STATUS_KEY = 'notification_permission_status';
const STREAK_BREAK_NOTIFIED_KEY = 'notification_streak_break_notified_for';

const MESSAGE_TEMPLATES: MessageTemplate[] = [
  { title: "Founder's Journal", body: "You've observed {count}/10 problems today. {remaining} more to go!" },
  { title: "Don't break the streak 🔥", body: 'Your {streak}-day streak is at risk. Quick, observe something!' },
  { title: 'The world needs founders', body: "Problems don't solve themselves. Open your journal." },
  { title: 'Observation time', body: 'What frustrated you today? Write it down.' },
  { title: 'Your idea muscle is waiting 💪', body: '{remaining} more problems to hit today\'s target.' },
  { title: 'Founders see what others ignore', body: 'Take 5 minutes. Observe {remaining} more problems.' },
  { title: 'Almost there! ⚡', body: 'Just {remaining} more problems to complete today\'s mission.' },
  { title: 'Night owl founder? 🦉', body: 'Perfect time to reflect on today\'s problems.' },
  { title: 'Your future self will thank you', body: 'Every problem you write is a potential startup.' },
  { title: '10 PM check-in', body: "Today's score: {count}/10. Let's close the gap." },
];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getLocalDateKey(baseDate: Date = new Date()): string {
  const year = baseDate.getFullYear();
  const month = `${baseDate.getMonth() + 1}`.padStart(2, '0');
  const day = `${baseDate.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYesterdayDateKey(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getLocalDateKey(yesterday);
}

function resolvePermissionStatus(
  permission: Notifications.NotificationPermissionsStatus | null | undefined
): NotificationPermissionStatus {
  if (!permission) {
    return 'undetermined';
  }

  if (permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return 'granted';
  }

  if (permission.canAskAgain) {
    return 'undetermined';
  }

  return 'denied';
}

async function savePermissionStatus(status: NotificationPermissionStatus): Promise<void> {
  await setAppStateValue(PERMISSION_STATUS_KEY, status);
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Daily Problem Reminder',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 300, 180, 300],
    enableVibrate: true,
    sound: 'default',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    lightColor: '#FFB800',
  });
}

async function getTodayReminderContext(): Promise<{ count: number; remaining: number; streak: number }> {
  const [count, streakInfo] = await Promise.all([getTodayProblemsCount(), getStreakInfo()]);
  return {
    count,
    remaining: Math.max(0, TARGET_COUNT - count),
    streak: streakInfo.currentStreak,
  };
}

function applyTemplate(template: MessageTemplate, count: number, remaining: number, streak: number): MessageTemplate {
  return {
    title: template.title,
    body: template.body
      .replace(/\{count\}/g, String(count))
      .replace(/\{remaining\}/g, String(remaining))
      .replace(/\{streak\}/g, String(streak)),
  };
}

async function pickMessage(count: number, remaining: number, streak: number): Promise<MessageTemplate> {
  const lastRaw = await getAppStateValue(LAST_TEMPLATE_INDEX_KEY);
  const lastIndex = Number.parseInt(lastRaw || '-1', 10);

  let nextIndex = Math.floor(Math.random() * MESSAGE_TEMPLATES.length);
  if (MESSAGE_TEMPLATES.length > 1 && nextIndex === lastIndex) {
    nextIndex = (nextIndex + 1) % MESSAGE_TEMPLATES.length;
  }

  await setAppStateValue(LAST_TEMPLATE_INDEX_KEY, String(nextIndex));
  return applyTemplate(MESSAGE_TEMPLATES[nextIndex], count, remaining, streak);
}

async function setBadgeFromRemaining(remaining: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, remaining));
  } catch (error) {
    console.error('Failed to set badge count:', error);
  }
}

async function getYesterdayProblemsCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COALESCE(problems_count, 0) AS count FROM daily_logs WHERE date = ?',
    [getYesterdayDateKey()]
  );
  return row?.count ?? 0;
}

async function clearStaleFollowUpTrackingIfNeeded(): Promise<void> {
  const trackedDate = await getAppStateValue(TODAY_FOLLOWUP_DATE_KEY);
  const today = getLocalDateKey();

  if (!trackedDate || trackedDate === today) {
    return;
  }

  await setAppStateValue(TODAY_FOLLOWUP_IDS_KEY, '[]');
  await setAppStateValue(TODAY_FOLLOWUP_DATE_KEY, today);
}

async function scheduleStreakBreakNotificationIfNeeded(): Promise<void> {
  const [lastActiveDate, currentStreakRaw, notifiedFor] = await Promise.all([
    getAppStateValue('last_active_date'),
    getAppStateValue('current_streak'),
    getAppStateValue(STREAK_BREAK_NOTIFIED_KEY),
  ]);

  const currentStreak = Number.parseInt(currentStreakRaw || '0', 10) || 0;
  const today = getLocalDateKey();
  const yesterday = getYesterdayDateKey();

  if (currentStreak <= 0 || lastActiveDate === today || lastActiveDate === yesterday || notifiedFor === yesterday) {
    return;
  }

  const yesterdayProblemsCount = await getYesterdayProblemsCount();
  if (yesterdayProblemsCount > 0) {
    return;
  }

  const content: Notifications.NotificationContentInput = {
    title: 'Streak update',
    body: `Your ${currentStreak}-day streak ended yesterday. 😔 Start a new one today!`,
    sound: 'default',
    badge: TARGET_COUNT,
    data: {
      kind: 'streak-break',
      route: '/problem/editor',
      date: today,
    },
    ...(Platform.OS === 'android'
      ? {
          color: '#FFB800',
          channelId: CHANNEL_ID,
        }
      : null),
  };

  const fireAt = new Date();
  fireAt.setHours(9, 0, 0, 0);

  if (new Date() >= fireAt) {
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: null,
    });
  } else {
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
      },
    });
  }

  await setAppStateValue(STREAK_BREAK_NOTIFIED_KEY, yesterday);
}

export async function requestNotificationPermissions(): Promise<NotificationPermissionStatus> {
  const current = await Notifications.getPermissionsAsync();
  let status = resolvePermissionStatus(current);

  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = resolvePermissionStatus(requested);
  }

  await savePermissionStatus(status);

  if (status === 'granted') {
    await ensureAndroidChannel();
  }

  return status;
}

export async function scheduleDailyReminder(): Promise<string | null> {
  const permissionStatus = await requestNotificationPermissions();
  if (permissionStatus !== 'granted') {
    return null;
  }

  await clearStaleFollowUpTrackingIfNeeded();

  const existingId = await getAppStateValue(DAILY_REMINDER_KEY);
  if (existingId) {
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    if (pending.some((item) => item.identifier === existingId)) {
      await scheduleStreakBreakNotificationIfNeeded();
      return existingId;
    }
  }

  const context = await getTodayReminderContext();
  const message = await pickMessage(context.count, context.remaining, context.streak);

  const scheduledId = await Notifications.scheduleNotificationAsync({
    content: {
      title: message.title,
      body: message.body,
      sound: 'default',
      badge: context.remaining,
      data: {
        kind: 'daily-check',
        route: '/problem/editor',
      },
      ...(Platform.OS === 'android'
        ? {
            color: '#FFB800',
            channelId: CHANNEL_ID,
          }
        : null),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 22,
      minute: 0,
    },
  });

  await setAppStateValue(DAILY_REMINDER_KEY, scheduledId);
  await scheduleStreakBreakNotificationIfNeeded();
  return scheduledId;
}

export async function scheduleFollowUpReminders(count: number): Promise<string[]> {
  const permissionStatus = await requestNotificationPermissions();
  if (permissionStatus !== 'granted') {
    return [];
  }

  const streakInfo = await getStreakInfo();
  const remaining = Math.max(0, TARGET_COUNT - count);
  if (remaining <= 0) {
    await cancelTodayReminders();
    await setBadgeFromRemaining(0);
    return [];
  }

  await cancelTodayReminders();

  const endTime = new Date();
  endTime.setHours(23, 0, 0, 0);

  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0, 0);
  const remainder = next.getMinutes() % 10;
  next.setMinutes(next.getMinutes() + (remainder === 0 ? 10 : 10 - remainder));

  const scheduledIds: string[] = [];
  let pointer = new Date(next);

  while (pointer <= endTime && scheduledIds.length < 7) {
    const message = await pickMessage(count, remaining, streakInfo.currentStreak);
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: message.title,
        body: message.body,
        sound: 'default',
        badge: remaining,
        data: {
          kind: 'follow-up',
          route: '/problem/editor',
          date: getLocalDateKey(),
        },
        ...(Platform.OS === 'android'
          ? {
              color: '#FFB800',
              channelId: CHANNEL_ID,
            }
          : null),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: pointer,
      },
    });

    scheduledIds.push(id);
    pointer = new Date(pointer.getTime() + 10 * 60 * 1000);
  }

  await setAppStateValue(TODAY_FOLLOWUP_IDS_KEY, JSON.stringify(scheduledIds));
  await setAppStateValue(TODAY_FOLLOWUP_DATE_KEY, getLocalDateKey());
  await setBadgeFromRemaining(remaining);
  return scheduledIds;
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await setAppStateValue(TODAY_FOLLOWUP_IDS_KEY, '[]');
  await setAppStateValue(TODAY_FOLLOWUP_DATE_KEY, getLocalDateKey());
  await setAppStateValue(DAILY_REMINDER_KEY, '');
  await setBadgeFromRemaining(0);
}

export async function cancelTodayReminders(): Promise<void> {
  await clearStaleFollowUpTrackingIfNeeded();

  const trackedDate = await getAppStateValue(TODAY_FOLLOWUP_DATE_KEY);
  if (trackedDate && trackedDate !== getLocalDateKey()) {
    return;
  }

  const rawIds = await getAppStateValue(TODAY_FOLLOWUP_IDS_KEY);
  const ids = safeParseIds(rawIds);

  if (ids.length === 0) {
    return;
  }

  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  await setAppStateValue(TODAY_FOLLOWUP_IDS_KEY, '[]');
}

export async function checkAndNotify(): Promise<boolean> {
  const context = await getTodayReminderContext();

  if (context.count >= TARGET_COUNT) {
    await cancelTodayReminders();
    await setBadgeFromRemaining(0);
    return false;
  }

  await scheduleFollowUpReminders(context.count);
  return true;
}

export async function onProblemSaved(): Promise<void> {
  const todayCount = await getTodayProblemsCount();
  const remaining = Math.max(0, TARGET_COUNT - todayCount);

  if (todayCount >= TARGET_COUNT) {
    await cancelTodayReminders();
    await setBadgeFromRemaining(0);
    return;
  }

  await setBadgeFromRemaining(remaining);
}

function safeParseIds(raw: string): string[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((value): value is string => typeof value === 'string' && value.length > 0);
  } catch (error) {
    console.error('Failed to parse follow-up reminder ids:', error);
    return [];
  }
}
