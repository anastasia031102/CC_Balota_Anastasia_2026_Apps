import React, { useEffect, useState } from "react";
import { COGNITO_DOMAIN, OIDC_CONFIG, API_BASE } from "./config";

function App() {
  const [token, setToken] = useState(localStorage.getItem("user_token") || null);
  const [energyData, setEnergyData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  // 2. Încărcăm datele din Azure Function imediat ce avem token-ul valid
  useEffect(() => {
    if (token) {
      setLoading(true);
      setError(null);

      // Apelăm ruta /api/data trimisă către backend-ul din Azure, adăugând Token-ul în Header pentru securitate
      fetch(`${API_BASE}/api/data`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error(`Serverul a răspuns cu status: ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          // Asigură-te că stochezi array-ul corect de date trimis de Azure Function
          setEnergyData(Array.isArray(data) ? data : data.logs || []);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching data:", err);
          setError("Nu s-au putut încărca datele din Azure Blob Storage.");
          setLoading(false);
        });
    }
  }, [token]);

  const handleLogin = () => {
    const loginUrl = `${COGNITO_DOMAIN}/login?client_id=${OIDC_CONFIG.client_id}&response_type=token&scope=openid+email+profile&redirect_uri=${encodeURIComponent(OIDC_CONFIG.redirect_uri)}`;
    window.location.href = loginUrl;
  };

  const handleLogout = () => {
    localStorage.removeItem("user_token");
    setToken(null);
    window.location.href = OIDC_CONFIG.redirect_uri;
  };

  // Ecranul securizat pentru ADMIN (Când utilizatorul este logat)
  if (token) {
    return (
      <div
        style={{
          padding: "30px",
          fontFamily: "Arial, sans-serif",
          backgroundColor: "#f8f9fa",
          minHeight: "100vh",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "between",
            alignItems: "center",
            marginBottom: "20px",
            borderBottom: "2px solid #dee2e6",
            paddingBottom: "15px",
          }}
        >
          <div>
            <h2 style={{ color: "#28a745", margin: 0 }}>ROLE: ADMIN (Autentificat cu succes)</h2>
            <p style={{ color: "#6c757d", margin: "5px 0 0 0" }}>
              Sistem conectat securizat prin AWS Cognito
            </p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              padding: "10px 20px",
              backgroundColor: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Sign Out
          </button>
        </div>

        <div
          style={{
            background: "white",
            padding: "20px",
            borderRadius: "8px",
            boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          }}
        >
          <h3 style={{ marginTop: 0, color: "#495057" }}>
            ⚡ Date Energetice (Azure Blob Storage)
          </h3>

          {loading && (
            <p style={{ color: "#007bff", fontWeight: "bold" }}>
              🔄 Se încarcă datele din cloud...
            </p>
          )}

          {error && (
            <div
              style={{
                background: "#f8d7da",
                color: "#721c24",
                padding: "15px",
                borderRadius: "5px",
                marginBottom: "15px",
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {!loading && !error && energyData.length === 0 && (
            <p style={{ color: "#6c757d", italic: "true" }}>
              Nu există loguri energetice disponibile în containerul de stocare.
            </p>
          )}

          {!loading && energyData.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "15px" }}>
                <thead>
                  <tr style={{ backgroundColor: "#343a40", color: "white", textAlign: "left" }}>
                    <th style={{ padding: "12px", border: "1px solid #dee2e6" }}>ID Dispozitiv</th>
                    <th style={{ padding: "12px", border: "1px solid #dee2e6" }}>Consum (kWh)</th>
                    <th style={{ padding: "12px", border: "1px solid #dee2e6" }}>Timestamp</th>
                    <th style={{ padding: "12px", border: "1px solid #dee2e6" }}>Locație</th>
                  </tr>
                </thead>
                <tbody>
                  {energyData.map((log, index) => (
                    <tr
                      key={index}
                      style={{ backgroundColor: index % 2 === 0 ? "#ffffff" : "#f1f3f5" }}
                    >
                      <td
                        style={{ padding: "12px", border: "1px solid #dee2e6", fontWeight: "bold" }}
                      >
                        {log.deviceId || log.device_id || "N/A"}
                      </td>
                      <td
                        style={{
                          padding: "12px",
                          border: "1px solid #dee2e6",
                          color: "#007bff",
                          fontWeight: "bold",
                        }}
                      >
                        {log.consumption || log.value || 0} kWh
                      </td>
                      <td style={{ padding: "12px", border: "1px solid #dee2e6" }}>
                        {log.timestamp || "N/A"}
                      </td>
                      <td style={{ padding: "12px", border: "1px solid #dee2e6" }}>
                        {log.location || "Cluj-Napoca"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Ecranul inițial de pornire (Vizibil când vizitatorul NU este logat)
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "Arial, sans-serif",
        backgroundColor: "#343a40",
        color: "white",
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.1)",
          padding: "40px",
          borderRadius: "10px",
          backdropFilter: "blur(5px)",
          textAlign: "center",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        <h1 style={{ marginBottom: "10px", fontSize: "2.5rem" }}>⚡ Monitorizare Energie cloud</h1>
        <p style={{ color: "#adb5bd", marginBottom: "30px" }}>
          Proiect Cloud Computing - Universitatea Tehnică din Cluj-Napoca
        </p>
        <button
          onClick={handleLogin}
          style={{
            padding: "15px 30px",
            fontSize: "18px",
            color: "white",
            backgroundColor: "#28a745",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            fontWeight: "bold",
            boxShadow: "0 4px 15px rgba(40,167,69,0.4)",
            transition: "0.2s",
          }}
        >
          🔒 Sign In securizat cu AWS Cognito
        </button>
      </div>
    </div>
  );
}

export default App;
