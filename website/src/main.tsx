import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { legacyHashTarget } from "./legacyHash";
import "./styles/global.css";

// old /#/page links: move to the clean URL before the router reads it
function migrateLegacyHash(): boolean {
  const legacy = legacyHashTarget(window.location.href);
  if (legacy === null) return false;
  window.history.replaceState(window.history.state, "", legacy);
  return true;
}
migrateLegacyHash();
// an old link opened while already on that page is a same-document hash
// change, not a page load, so the router has to be told about the new URL
window.addEventListener("hashchange", () => {
  if (migrateLegacyHash()) window.dispatchEvent(new PopStateEvent("popstate"));
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
