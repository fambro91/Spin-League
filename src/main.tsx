import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { Home } from "./pages/Home";
import { Admin } from "./pages/Admin";
import { Player } from "./pages/Player";
import { Solo } from "./pages/Solo";
import { Pro } from "./pages/Pro";
import { setSolo } from "./api";

function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const on = () => setHash(location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return hash;
}

function App() {
  const hash = useHash();
  const parts = hash.replace(/^#\/?/, "").split("/");
  setSolo(parts[0] === "solo");
  if (parts[0] === "solo") return <Solo />;
  if (parts[0] === "pro") return <Pro />;
  if (parts[0] === "admin" && parts[1]) return <Admin token={parts[1]} />;
  if (parts[0] === "p" && parts[1]) return <Player token={parts[1]} />;
  return <Home />;
}

// app installabile e giocabile offline (carriera contro i bot)
if ("serviceWorker" in navigator && location.hostname !== "localhost") {
  window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); });
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
