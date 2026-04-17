import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Store API URL so redirect.html (served same origin) can access it for RC token proxy
localStorage.setItem('rc_api_url', import.meta.env.VITE_API_URL || 'http://localhost:4000/api');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
