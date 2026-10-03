// Hyperfocus web push (P5-11): shows a notification the app sent, even when no Hyperfocus tab is open, and opens the
// app when it is clicked.
self.addEventListener("push", (event) => {
  let data = { title: "Hyperfocus", body: "", url: "/" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: "/icon.svg", badge: "/icon.svg", data: { url: data.url } }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
      const open = tabs.find((t) => t.url.startsWith(self.location.origin));
      return open ? open.focus().then((t) => t.navigate(url)) : self.clients.openWindow(url);
    }),
  );
});
