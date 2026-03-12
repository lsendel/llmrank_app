interface GA4Event {
  name: string;
  params?: Record<string, string | number | boolean>;
}

export async function trackGA4Server(
  measurementId: string,
  apiSecret: string,
  clientId: string,
  events: GA4Event[],
): Promise<void> {
  if (!measurementId || !apiSecret) return;

  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`;

  await fetch(url, {
    method: "POST",
    body: JSON.stringify({
      client_id: clientId,
      events,
    }),
  }).catch((err) => console.error("GA4 server-side tracking failed:", err));
}
