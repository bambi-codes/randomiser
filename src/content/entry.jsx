import React from "react";
import { createRoot } from "react-dom/client";
import MainPage from "../components/main-page.jsx";

const MODAL_ID = "randomiser-extension-modal";
let reactRoot = null;

function ensureModal() {
  let host = document.getElementById(MODAL_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = MODAL_ID;
    host.style.position = "fixed";
    host.style.inset = "0";
    host.style.zIndex = "999999";
    host.style.background = "rgba(0, 0, 0, 0.5)";
    host.style.display = "flex";
    host.style.alignItems = "center";
    host.style.justifyContent = "center";
    document.body.appendChild(host);

    const panel = document.createElement("div");
    panel.style.background = "#ffffff";
    panel.style.width = "min(1100px, 94vw)";
    panel.style.height = "min(760px, 90vh)";
    panel.style.borderRadius = "12px";
    panel.style.boxShadow = "0 20px 60px rgba(0, 0, 0, 0.35)";
    panel.style.overflow = "auto";
    panel.style.position = "relative";
    host.appendChild(panel);

    reactRoot = createRoot(panel);
    reactRoot.render(<MainPage />);
  }
}

function removeModal() {
  if (reactRoot) {
    reactRoot.unmount();
    reactRoot = null;
  }

  const host = document.getElementById(MODAL_ID);
  if (host) {
    host.remove();
  }
}

function toggleModal() {
  if (document.getElementById(MODAL_ID)) {
    removeModal();
  } else {
    ensureModal();
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "randomiser:toggle") {
    toggleModal();
    sendResponse({ ok: true });
    return true;
  }

  return false;
});
