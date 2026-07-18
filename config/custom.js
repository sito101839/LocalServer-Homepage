(() => {
  "use strict";

  const dashboardHosts = new Set([
    "192.168.1.29",
    "100.76.107.23",
    "shito-diginnos-pc",
    "shito-diginnos-pc.tail81aab6.ts.net",
  ]);
  const serviceRouteHosts = new Map([
    ["homepage.tail81aab6.ts.net", "shito-diginnos-pc.tail81aab6.ts.net"],
  ]);
  const serviceRouteUrls = new Map([
    ["http://192.168.1.29/", "http://100.76.107.23/"],
  ]);
  const homepageServiceUrl = "https://homepage.tail81aab6.ts.net/";

  // Keep browser-facing links on the same LAN or Tailscale route as Homepage.
  function rewriteServiceLinks() {
    const currentHost = window.location.hostname;
    const linkHost = serviceRouteHosts.get(currentHost) || currentHost;
    if (!dashboardHosts.has(currentHost) && !serviceRouteHosts.has(currentHost)) {
      return;
    }

    document.querySelectorAll("a[href]").forEach((link) => {
      const destination = new URL(link.href);
      if (destination.protocol !== "http:" || !dashboardHosts.has(destination.hostname)) {
        return;
      }

      if (serviceRouteHosts.has(currentHost) && destination.port === "3000") {
        link.href = homepageServiceUrl;
        return;
      }

      const serviceRouteUrl = serviceRouteUrls.get(destination.toString());
      if (serviceRouteHosts.has(currentHost) && serviceRouteUrl) {
        link.href = serviceRouteUrl;
        return;
      }

      destination.hostname = linkHost;
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
