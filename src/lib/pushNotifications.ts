/**
 * Expo Push Notification Dispatcher
 * Sends push notifications to iOS and Android devices via Expo's HTTP/2 Push API.
 */
export async function sendExpoPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: Record<string, any>
) {
  if (!pushToken || typeof pushToken !== "string") {
    return;
  }

  // Basic validation for Expo push tokens
  if (!pushToken.startsWith("ExponentPushToken[") && !pushToken.startsWith("ExpoPushToken[")) {
    console.log(`[Push] Invalid Expo push token: ${pushToken}`);
    return;
  }

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: pushToken,
        sound: "default",
        title,
        body,
        data: data || {},
        priority: "high",
        channelId: "default",
      }),
    });

    const result = await response.json();
    console.log(`[Push] Dispatched notification to ${pushToken.slice(0, 24)}...:`, result?.data?.status || "sent");
    return result;
  } catch (err) {
    console.error("[Push] Error dispatching Expo push notification:", err);
  }
}

