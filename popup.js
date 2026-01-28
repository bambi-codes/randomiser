const statusEl = document.getElementById("status");

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const activeTab = tabs[0];
  const url = activeTab?.url || "";
  let isBambiCloud = false;

  try {
    isBambiCloud = /(^|\.)bambicloud\.com$/i.test(new URL(url).hostname);
  } catch {
    isBambiCloud = false;
  }

  if (isBambiCloud) {
    statusEl.textContent = "You are on bambicloud.com";
    statusEl.classList.remove("off");
    statusEl.classList.add("on");
  } else {
    statusEl.textContent = "You are not on bambicloud.com";
    statusEl.classList.remove("on");
    statusEl.classList.add("off");
  }
});
