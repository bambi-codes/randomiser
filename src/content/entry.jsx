import React from "react";
import { createRoot } from "react-dom/client";
import MainPage from "../components/main-page.jsx";

const NAV_SELECTOR = ".app-header .nav";
const LINK_TEXT = "Playlist Randomiser";
const ROUTE_PATH = "/randomiser";
const MOUNT_ID = "randomiser-extension-root";

let reactRoot = null;

function findMountParent() {
  const nav = document.querySelector(NAV_SELECTOR);
  return nav?.closest("header")?.nextElementSibling || document.body;
}

function createMount() {
  if (document.getElementById(MOUNT_ID)) {
    return;
  }

  const mountParent = findMountParent();
  const mount = document.createElement("div");
  mount.id = MOUNT_ID;
  mount.setAttribute("data-randomiser-root", "true");
  mountParent.prepend(mount);

  reactRoot = createRoot(mount);
  reactRoot.render(<MainPage />);
}

function removeMount() {
  if (reactRoot) {
    reactRoot.unmount();
    reactRoot = null;
  }

  const mount = document.getElementById(MOUNT_ID);
  if (mount) {
    mount.remove();
  }
}

function syncRouteMount() {
  if (window.location.pathname === ROUTE_PATH) {
    createMount();
  } else {
    removeMount();
  }
}

function createNavItem() {
  const li = document.createElement("li");
  const a = document.createElement("a");
  const div = document.createElement("div");

  a.href = ROUTE_PATH;
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

function watchRouteChanges() {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function pushState(...args) {
    originalPushState.apply(this, args);
    window.dispatchEvent(new Event("randomiser:navigation"));
  };

  history.replaceState = function replaceState(...args) {
    originalReplaceState.apply(this, args);
    window.dispatchEvent(new Event("randomiser:navigation"));
  };

  window.addEventListener("popstate", syncRouteMount);
  window.addEventListener("randomiser:navigation", syncRouteMount);
}

waitForNav();
watchRouteChanges();
syncRouteMount();
