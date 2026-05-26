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

    auth.removeUser();

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

  // Helper pentru a calcula totalul de kWh din datele primite
  const calculateTotalKwh = (items) => {
    if (!items || !Array.isArray(items)) return 0;
    return items.reduce((sum, item) => sum + (Number(item.kwh) || 0), 0);
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
                <span className="badge" style={{ marginLeft: "10px", textTransform: "uppercase" }}>
                  Role: {dataResponse?.role || "fetching..."}
                </span>
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

            {/* SECȚIUNEA NOUĂ PENTRU DATELE DIN BLOB STORAGE CSV */}
            <section className="card card-wide">
              <div className="section-head">
                <h2>Energy Data Logs (from Azure Blob Storage)</h2>
                {dataResponse?.data && (
                  <div className="stats-badges">
                    <span className="badge">Total Records: {dataResponse.data.length}</span>
                    <span className="badge badge-success">
                      Total Consumption: {calculateTotalKwh(dataResponse.data).toFixed(2)} kWh
                    </span>
                  </div>
                )}
              </div>

              {loadingData ? (
                <p className="muted">Loading energy data from CSV...</p>
              ) : dataResponse?.data && Array.isArray(dataResponse.data) ? (
                dataResponse.data.length > 0 ? (
                  <div className="table-container" style={{ overflowX: "auto", marginTop: "15px" }}>
                    <table
                      className="data-table"
                      style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}
                    >
                      <thead>
                        <tr style={{ borderBottom: "2px solid #444", paddingBottom: "8px" }}>
                          <th style={{ padding: "10px" }}>Device ID</th>
                          <th style={{ padding: "10px" }}>Timestamp</th>
                          <th style={{ padding: "10px" }}>Consumption (kWh)</th>
                          <th style={{ padding: "10px" }}>Location</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dataResponse.data.slice(0, 50).map((row, index) => (
                          <tr key={index} style={{ borderBottom: "1px solid #333" }}>
                            <td style={{ padding: "10px", fontFamily: "monospace" }}>
                              {row.device_id}
                            </td>
                            <td style={{ padding: "10px" }}>{row.timestamp}</td>
                            <td style={{ padding: "10px", fontWeight: "bold", color: "#4ade80" }}>
                              {row.kwh} kWh
                            </td>
                            <td style={{ padding: "10px" }}>{row.location}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {dataResponse.data.length > 50 && (
                      <p
                        className="muted"
                        style={{ fontSize: "12px", marginTop: "10px", textAlign: "center" }}
                      >
                        * Showing first 50 records for performance.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="muted">No data rows found matching your Device ID permissions.</p>
                )
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
