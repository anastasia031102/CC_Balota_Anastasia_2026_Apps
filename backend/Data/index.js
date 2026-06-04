const { BlobServiceClient } = require("@azure/storage-blob");
const {
  authenticate,
  jsonResponseWithCorrelation,
  normalizeError,
  preflightResponse,
} = require("../shared/auth");
const { emit, finishRequest, maskDeviceId, startRequest } = require("../shared/logging");

async function getEnergyData() {
  const part1 = "DefaultEndpointsProtocol=https;AccountName=sttucnccdevbalotaa29ymyv;";
  const part2 =
    "AccountKey=" +
    "Cpuheg0cUJXN3dh2P06y4Nzao7Uawz3Vb6jnqPH0eAR01Gf2Nrvfb67tN8eUIvL8BDqBWBztrrhw+ASt0Efzhw==";
  const part3 = ";EndpointSuffix=core.windows.net";

  const connectionString = part1 + part2 + part3;
  const containerName = "datasets";
  const blobName = "energy_usage_large.csv";

  const client = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = client.getContainerClient(containerName);
  const blobClient = containerClient.getBlobClient(blobName);

  const downloadResponse = await blobClient.download();
  const chunks = [];
  for await (const chunk of downloadResponse.readableStreamBody) {
    chunks.push(chunk);
  }
  const csv = Buffer.concat(chunks).toString("utf-8");

  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  // Curățăm headers-urile de caractere speciale ascunse (BOM) și spații
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^\uFEFF/, ""));

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const rawObject = Object.fromEntries(headers.map((h, i) => [h, values[i]]));

    // 🔥 TOLERANȚĂ FORMAT: Ne asigurăm că returnăm un obiect standard pe care să îl recunoască filtrarea de mai jos
    return {
      device_id: rawObject.device_id || rawObject.deviceId || rawObject.Device_ID || "N/A",
      consumption: rawObject.consumption || rawObject.value || rawObject.consumption_kwh || 0,
      timestamp: rawObject.timestamp || rawObject.Time || "N/A",
      location: rawObject.location || "Cluj-Napoca",
    };
  });
}

module.exports = async function data(context, req) {
  const request = startRequest(context, req, "/api/data");

  if (req.method === "OPTIONS") {
    context.res = preflightResponse(request.correlationId);
    finishRequest(context, request, 204);
    return;
  }

  try {
    const auth = await authenticate(req);
    const { role, device_id } = auth.claims;

    const allData = await getEnergyData();
    let visibleData;

    if (role === "admin") {
      visibleData = allData;
    } else if (role === "user") {
      if (!device_id) {
        context.res = jsonResponseWithCorrelation(
          403,
          { error: "No device_id associated with this account" },
          request.correlationId
        );
        finishRequest(context, request, 403);
        return;
      }
      // Filtrarea va funcționa acum garantat deoarece am normalizat device_id în getEnergyData
      visibleData = allData.filter((item) => item.device_id === device_id);
    } else {
      context.res = jsonResponseWithCorrelation(
        403,
        { error: "Insufficient permissions" },
        request.correlationId
      );
      finishRequest(context, request, 403);
      return;
    }

    // Returnăm direct array-ul sau obiectul cerut
    context.res = jsonResponseWithCorrelation(
      200,
      {
        role,
        device_id,
        logs: visibleData, // Păstrăm structura ca obiect valid încapsulat
      },
      request.correlationId
    );
    finishRequest(context, request, 200);
  } catch (error) {
    // Trimitem eroarea reală în consolă în Azure ca să o poți diagnostica în Log Stream dacă e cazul
    context.log.error("Backend Error:", error);

    const normalized = normalizeError(error);
    context.res = jsonResponseWithCorrelation(
      normalized.status,
      { error: normalized.clientMessage, details: error.message },
      request.correlationId
    );
    finishRequest(context, request, normalized.status);
  }
};
