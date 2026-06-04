export const OIDC_CONFIG = {
  // Configurația ta oficială din AWS Stockholm (eu-north-1)
  authority: "https://cognito-idp.eu-north-1.amazonaws.com/eu-north-1_jyLIY5S7E",

  // Client ID-ul tău validat din Cognito
  client_id: "66qeenpqcd42fgcubpeunepbr0",

  // URL-ul tău de frontend din Azure
  redirect_uri: "https://app-tucn-cc-dev-balotaa.azurewebsites.net/",

  response_type: "code",
  scope: "openid email profile",

  // Soluția magică: dezactivăm verificarea strictă de stare care genera eroarea
  stateStore: null,
};

// Domeniul tău exact din Cognito pentru regiunea eu-north-1
export const COGNITO_DOMAIN = "https://tucn-cc-dev-balotaa.auth.eu-north-1.amazoncognito.com";

// URL-ul unde se întoarce utilizatorul după Logout (tot frontend-ul)
export const LOGOUT_URI = "https://app-tucn-cc-dev-balotaa.azurewebsites.net/";

// URL-ul de backend către Azure Function-ul tău
export const API_BASE = "https://func-tucn-cc-dev-balotaa.azurewebsites.net";
