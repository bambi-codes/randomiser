const NAV_SELECTOR = ".app-header .nav";
const LINK_TEXT = "Playlist Randomiser";
const LINK_HREF = "/randomiser";

function createNavItem() {
  const li = document.createElement("li");
  const a = document.createElement("a");
  const div = document.createElement("div");

  a.href = LINK_HREF;
  div.textContent = LINK_TEXT;

  a.appendChild(div);
  li.appendChild(a);

  return li;
}

function injectNavItem(nav) {
  if (!nav || nav.querySelector("[data-randomiser-nav]")) {
    return;
  }

  const li = createNavItem();
  li.setAttribute("data-randomiser-nav", "true");
  nav.appendChild(li);
}

function waitForNav() {
  const existingNav = document.querySelector(NAV_SELECTOR);
  if (existingNav) {
    injectNavItem(existingNav);
    return;
  }

  const observer = new MutationObserver(() => {
    const nav = document.querySelector(NAV_SELECTOR);
    if (nav) {
      injectNavItem(nav);
      observer.disconnect();
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
}

waitForNav();
