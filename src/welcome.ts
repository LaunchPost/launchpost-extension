/** Welcome page: the close link shuts this tab. Falls back to X if the browser won't close a tab it didn't open by script. */
document.getElementById("close")?.addEventListener("click", () => {
  if (typeof chrome !== "undefined" && chrome.tabs?.getCurrent) {
    chrome.tabs.getCurrent((tab) => {
      if (tab?.id !== undefined) chrome.tabs.remove(tab.id);
      else location.href = "https://x.com/home";
    });
    return;
  }
  window.close();
  setTimeout(() => (location.href = "https://x.com/home"), 150);
});
