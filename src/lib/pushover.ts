export async function sendPushoverNotification({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  const userKey = process.env.PUSHOVER_USER_KEY;
  const apiToken = process.env.PUSHOVER_API_TOKEN;

  if (!userKey || !apiToken) {
    console.warn("Pushover nicht konfiguriert (PUSHOVER_USER_KEY / PUSHOVER_API_TOKEN fehlen)");
    return false;
  }

  const res = await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: apiToken,
      user: userKey,
      title,
      message,
      sound: "pushover",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Pushover-Fehler:", err);
    return false;
  }

  return true;
}
