import React, { useEffect, useState } from "react";
import { COGNITO_DOMAIN, OIDC_CONFIG } from "./config";

function App() {
  const [token, setToken] = useState(localStorage.getItem("user_token") || null);

  useEffect(() => {
    // 1. Verificăm dacă ne-am întors de la Cognito cu token în URL (#access_token=...)
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.replace("#", "?"));
      const accessToken = params.get("access_token") || params.get("id_token");

      if (accessToken) {
        localStorage.setItem("user_token", accessToken);
        setToken(accessToken);
        // Curățăm URL-ul INSTANT ca să nu poată da loop niciodată!
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const handleLogin = () => {
    // Trimitem utilizatorul direct la pagina de login din AWS Cognito construită manual
    const loginUrl = `${COGNITO_DOMAIN}/login?client_id=${OIDC_CONFIG.client_id}&response_type=token&scope=openid+email+profile&redirect_uri=${encodeURIComponent(OIDC_CONFIG.redirect_uri)}`;
    window.location.href = loginUrl;
  };

  const handleLogout = () => {
    localStorage.removeItem("user_token");
    setToken(null);
    window.location.href = OIDC_CONFIG.redirect_uri;
  };

  // Dacă avem token, îi afișăm tabelul direct, fără să mai întrebăm biblioteca OIDC!
  if (token) {
    return (
      <div style={{ padding: "20px" }}>
        <h2>ROLE: ADMIN (Autentificat cu succes)</h2>
        <button onClick={handleLogout} style={{ marginBottom: "20px" }}>
          Sign Out
        </button>

        {/* LIPEȘTE AICI TABELUL TĂU ENERGETIC SAU COMPONENTA CARE ÎNCARCĂ DATELE */}
        <div style={{ background: "#e0ffe0", padding: "15px", borderRadius: "5px" }}>
          <h3>Date Energetice din Azure Blob Storage încărcate live!</h3>
          {/* Componenta ta de tabel vine aici */}
        </div>
      </div>
    );
  }

  // Ecranul de pornire dacă nu e logat
  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h1>Aplicație Monitorizare Energie</h1>
      <button
        onClick={handleLogin}
        style={{ padding: "10px 20px", fontSize: "16px", cursor: "pointer" }}
      >
        Sign In cu AWS Cognito
      </button>
    </div>
  );
}

export default App;
