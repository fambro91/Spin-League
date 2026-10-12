import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { Home } from "./pages/Home";
import { Admin } from "./pages/Admin";
import { Player } from "./pages/Player";

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
  if (parts[0] === "admin" && parts[1]) return <Admin token={parts[1]} />;
  if (parts[0] === "p" && parts[1]) return <Player token={parts[1]} />;
  return <Home />;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
