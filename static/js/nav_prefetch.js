(() => {
  const prefetched = new Set();
  const sameOrigin = window.location.origin;

  function isPrefetchable(href) {
    if (!href) return false;
    if (href.startsWith("#")) return false;
    if (href.startsWith("javascript:")) return false;
    if (href.includes("logout")) return false;
    try {
      const url = new URL(href, sameOrigin);
      return url.origin === sameOrigin;
    } catch (_) {
      return false;
    }
  }

  function prefetch(href) {
    const url = new URL(href, sameOrigin).href;
    if (prefetched.has(url)) return;
    prefetched.add(url);

    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "document";
    link.href = url;
    document.head.appendChild(link);
  }

  function bindLink(anchor) {
    const href = anchor.getAttribute("href");
    if (!isPrefetchable(href)) return;
    const trigger = () => prefetch(href);
    anchor.addEventListener("mouseenter", trigger, { passive: true });
    anchor.addEventListener("touchstart", trigger, { passive: true, once: true });
    anchor.addEventListener("focus", trigger, { passive: true });
  }

  function warmMainRoutes() {
    const links = Array.from(document.querySelectorAll(".crm-navbar a.nav-link[href]"));
    links.forEach(bindLink);

    if ("requestIdleCallback" in window && links.length) {
      requestIdleCallback(() => {
        links.slice(0, 2).forEach((link) => {
          const href = link.getAttribute("href");
          if (isPrefetchable(href)) prefetch(href);
        });
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", warmMainRoutes);
  } else {
    warmMainRoutes();
  }
})();
