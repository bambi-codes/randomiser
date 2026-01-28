import React, { useEffect, useState } from "react";

const statusText = {
  loading: "Checking current tab…",
  on: "You are on bambicloud.com",
  off: "You are not on bambicloud.com"
};

export default function Popup() {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      const url = activeTab?.url || "";
      let isBambiCloud = false;

      try {
        isBambiCloud = /(^|\.)bambicloud\.com$/i.test(new URL(url).hostname);
      } catch {
        isBambiCloud = false;
      }

      setStatus(isBambiCloud ? "on" : "off");
    });
  }, []);

  const openModal = () => {
    setError("");
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab?.id) {
        setError("No active tab found.");
        return;
      }

      chrome.tabs.sendMessage(activeTab.id, { type: "randomiser:toggle" }, () => {
        if (chrome.runtime.lastError) {
          setError("Extension is not active on this site.");
        }
      });
    });
  };

  return (
    <div className={`popup ${status}`}>
      <h1>Randomiser</h1>
      <div className="status">{statusText[status]}</div>
      <button
        type="button"
        className="primary"
        onClick={openModal}
        disabled={status !== "on"}
      >
        Open Randomiser
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
