export const API_BASE = "https://func-tucn-cc-dev-balotaa.azurewebsites.net";
export const COGNITO_DOMAIN = "https://tucn-cc-dev-balotaa.auth.eu-north-1.amazoncognito.com";
export const LOGOUT_URI = "https://app-tucn-cc-dev-balotaa.azurewebsites.net/";

export const OIDC_CONFIG = {
  authority: "https://cognito-idp.eu-north-1.amazonaws.com/eu-north-1_jyLIY5S7E",
  client_id: "react-frontend",
  redirect_uri: "https://app-tucn-cc-dev-balotaa.azurewebsites.net/",
  response_type: "code", // ⬅️ Asigură-te că scrie "code" aici, nu "token"!
  scope: "openid email profile",
  loadUserInfo: false,
  // Această linie oprește loop-ul prin eliminarea automată a codului din URL după procesare
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  },
};
