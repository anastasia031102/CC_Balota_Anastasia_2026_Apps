import React, { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import { API_BASE, COGNITO_DOMAIN, LOGOUT_URI, OIDC_CONFIG } from "./config";
import "./App.css";

function App() {
  const auth = useAuth();

  const [profile, setProfile] = useState(null);
  const [dataResponse, setDataResponse] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState(null);
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);

  const idToken = auth.user?.id_token;

  // Call backend when we have an idToken
  useEffect(() => {
    if (!idToken) {
      setProfile(null);
      setDataResponse(null);
      return;
    }

    setError(null);

    // /api/profile
    setLoadingProfile(true);
    fetch(`${API_BASE}/api/profile`, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Error calling /api/profile");
        return res.json();
      })
      .then((data) => setProfile(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingProfile(false));

    // /api/data
    setLoadingData(true);
    fetch(`${API_BASE}/api/data`, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Error calling /api/data");
        return res.json();
      })
      .then((data) => setDataResponse(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingData(false));
  }, [idToken]);

  const signOutRedirect = () => {
    const clientId = OIDC_CONFIG.client_id;
    const logoutUri = LOGOUT_URI;
    const cognitoDomain = COGNITO_DOMAIN;

    // Clear local OIDC user (react-oidc-context)
    auth.removeUser();

    // Redirect to Cognito logout endpoint
    window.location.href =
      `${cognitoDomain}/logout?client_id=${clientId}` +
      `&logout_uri=${encodeURIComponent(logoutUri)}`;
  };

  const copyToken = async () => {
    if (!idToken) return;
    try {
      await navigator.clipboard.writeText(idToken);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (copyError) {
      setError("Unable to copy token to clipboard.");
    }
  };

  if (auth.isLoading) {
    return (
      <div className="app-shell">
        <div className="status-panel">Loading authentication...</div>
      </div>
    );
  }

  if (auth.error) {
    return (
      <div className="app-shell">
        <div className="status-panel status-panel-error">
          Encountering error... {auth.error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="bg-orb bg-orb-left" />
      <div className="bg-orb bg-orb-right" />
      <main className="app">
        <header className="hero">
          <p className="hero-kicker">Identity + Serverless</p>
          <h1>Cloud Computing App</h1>
          <p className="hero-subtitle">
            Secure frontend with Amazon Cognito authentication and Azure Functions APIs.
          </p>
        </header>

        {error && (
          <div className="alert">
            <strong>Error:</strong> {error}
          </div>
        )}

        <section className="card status-card">
          {auth.isAuthenticated ? (
            <>
              <p className="status-line">
                <span className="status-dot status-dot-online" />
                Logged in as <strong>{auth.user?.profile?.email || "(no email claim)"}</strong>
              </p>
              <button className="btn btn-secondary" onClick={signOutRedirect}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <p className="status-line">
                <span className="status-dot" />
                Not logged in
              </p>
              <button className="btn" onClick={() => auth.signinRedirect()}>
                Sign in
              </button>
            </>
          )}
        </section>

        {auth.isAuthenticated && (
          <div className="grid">
            <section className="card">
              <div className="section-head">
                <h2>Authentication Token</h2>
                <div className="actions">
                  <button
                    className="btn btn-small btn-ghost"
                    onClick={() => setShowToken((current) => !current)}
                  >
                    {showToken ? "Hide" : "Show"}
                  </button>
                  <button className="btn btn-small btn-ghost" onClick={copyToken}>
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              <pre className="code-block">
                ID Token: {showToken ? auth.user?.id_token : "••••••••••••••••••••"}
              </pre>
            </section>

            <section className="card">
              <h2>User Profile API Response</h2>
              {loadingProfile ? (
                <p className="muted">Loading profile...</p>
              ) : profile ? (
                <pre className="code-block">{JSON.stringify(profile, null, 2)}</pre>
              ) : (
                <p className="muted">No profile loaded yet.</p>
              )}
            </section>

            {/* 📊 SECȚIUNEA REPARATĂ: Transforma textul JSON brut într-un tabel HTML curat */}
            <section className="card card-wide">
              <h2>Data API Response (CSV Datasets)</h2>
              {loadingData ? (
                <p className="muted">Loading data...</p>
              ) : dataResponse && dataResponse.data && dataResponse.data.length > 0 ? (
                <div style={{ overflowX: "auto", marginTop: "15px" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      textAlign: "left",
                      fontSize: "14px",
                    }}
                  >
                    <thead>
                      <tr
                        style={{ borderBottom: "2px solid rgba(255,255,255,0.1)", color: "#aaa" }}
                      >
                        <th style={{ padding: "12px 8px" }}>Device ID</th>
                        <th style={{ padding: "12px 8px" }}>Timestamp</th>
                        <th style={{ padding: "12px 8px", textAlign: "right" }}>Consumption</th>
                        <th style={{ padding: "12px 8px" }}>Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataResponse.data.map((item, index) => (
                        <tr
                          key={index}
                          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
                        >
                          <td style={{ padding: "12px 8px", fontWeight: "600", color: "#61dafb" }}>
                            {item.device_id}
                          </td>
                          <td style={{ padding: "12px 8px", color: "#ddd" }}>{item.timestamp}</td>
                          <td
                            style={{
                              padding: "12px 8px",
                              textAlign: "right",
                              fontWeight: "700",
                              color: "#4caf50",
                            }}
                          >
                            {item.consumption} kWh
                          </td>
                          <td style={{ padding: "12px 8px", color: "#ccc" }}>{item.location}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : dataResponse ? (
                <pre className="code-block">{JSON.stringify(dataResponse, null, 2)}</pre>
              ) : (
                <p className="muted">No data loaded yet.</p>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
