(() => {
  "use strict";

  const dashboardHosts = new Set([
    "192.168.1.29",
    "100.76.107.23",
    "shito-diginnos-pc",
    "shito-diginnos-pc.tail81aab6.ts.net",
  ]);

  // Keep browser-facing links on the same LAN or Tailscale route as Homepage.
  function rewriteServiceLinks() {
    const currentHost = window.location.hostname;
    if (!dashboardHosts.has(currentHost)) {
      return;
    }

    document.querySelectorAll("a[href]").forEach((link) => {
      const destination = new URL(link.href);
      if (destination.protocol !== "http:" || !dashboardHosts.has(destination.hostname)) {
        return;
      }

      destination.hostname = currentHost;
      link.href = destination.toString();
    });
  }

  function initialize() {
    rewriteServiceLinks();

    new MutationObserver(rewriteServiceLinks).observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  } else {
    initialize();
  }
})();
