export const API_BASE = "https://func-tucn-cc-dev-balotaa.azurewebsites.net";
// 🤝 CORECTAT: Domeniul tău real de la Amazon
export const COGNITO_DOMAIN = "https://eu-north-1jyliy5s7e.auth.eu-north-1.amazoncognito.com";
export const LOGOUT_URI = "https://app-tucn-cc-dev-balotaa.azurewebsites.net/";

export const OIDC_CONFIG = {
  authority: "https://cognito-idp.eu-north-1.amazonaws.com/eu-north-1_jyLIY5S7E",
  client_id: "66qeenpqcd42fgcubpeunepbr0", // 🤝 CORECTAT: ID-ul tău real de client (șirul lung de cifre și litere)
  redirect_uri: "https://app-tucn-cc-dev-balotaa.azurewebsites.net/",
  response_type: "token", // ⬅️ Protocolul iertător care ne scapă de loop-uri!
  scope: "openid email profile",
  loadUserInfo: false,
};
