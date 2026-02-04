import React from "react";
import { createRoot } from "react-dom/client";
import Box from "@mui/material/Box";
import Modal from "@mui/material/Modal";
import MainPage from "../components/main-page.jsx";

const MODAL_ID = "randomiser-extension-modal";
let reactRoot = null;

function ExtensionModal({ onClose }) {
  return (
    <Modal open onClose={onClose} disablePortal sx={{ zIndex: 999999 }}>
      <Box
        sx={{
          backgroundColor: "#ffffff",
          width: "min(1100px, 94vw)",
          height: "min(760px, 90vh)",
          borderRadius: "12px",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.35)",
          overflow: "auto",
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          outline: "none"
        }}
      >
        <MainPage />
      </Box>
    </Modal>
  );
}

function ensureModal() {
  let host = document.getElementById(MODAL_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = MODAL_ID;
    host.style.position = "fixed";
    host.style.inset = "0";
    host.style.zIndex = "999999";
    document.body.appendChild(host);

    reactRoot = createRoot(host);
    reactRoot.render(<ExtensionModal onClose={removeModal} />);
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
    try {
      toggleModal();
      sendResponse({ ok: true });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to toggle modal.";
      console.error("Randomiser modal error:", error);
      sendResponse({ ok: false, error: errorMessage });
    }
    return false;
  }

  return false;
});
