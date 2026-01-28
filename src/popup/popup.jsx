import React, { useEffect, useState } from "react";

const statusText = {
  loading: "Checking current tab…",
  on: "You are on bambicloud.com",
  off: "You are not on bambicloud.com"
};

export default function Popup() {
  const [status, setStatus] = useState("loading");

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

  return (
    <div className={`popup ${status}`}>
      <h1>Randomiser</h1>
      <div className="status">{statusText[status]}</div>
    </div>
  );
}
