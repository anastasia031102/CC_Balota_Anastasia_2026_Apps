const { BlobServiceClient } = require("@azure/storage-blob");
const {
  authenticate,
  jsonResponseWithCorrelation,
  normalizeError,
  preflightResponse,
} = require("../shared/auth");
const { emit, finishRequest, maskDeviceId, startRequest } = require("../shared/logging");

async function getEnergyData() {
  const connectionString = process.env.AzureWebJobsStorage;

  if (!connectionString) {
    throw new Error("AzureWebJobsStorage application setting is missing or empty.");
  }

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

  // Curățăm antetul de caractere ascunse (BOM)
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^\uFEFF/, ""));

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const rawObject = Object.fromEntries(headers.map((h, i) => [h, values[i]]));

    return {
      device_id: rawObject.device_id || rawObject.deviceId || rawObject.Device_ID || "N/A",
      // 🚀 MODIFICAT: Convertim direct valorile din coloana 'kwh' în numere reale
      consumption: Number(rawObject.kwh) || 0,
      timestamp: rawObject.timestamp || rawObject.Time || "N/A",
      location: rawObject.location || "Default Location",
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

    // 🚀 MODIFICAT: Împachetăm răspunsul în structura exactă de obiect pe care o cere interfața
    context.res = jsonResponseWithCorrelation(
      200,
      {
        role: role,
        device_id: device_id,
        data: visibleData,
      },
      request.correlationId
    );
    finishRequest(context, request, 200);
  } catch (error) {
    context.log.error("Backend execution error:", error);
    const normalized = normalizeError(error);
    context.res = jsonResponseWithCorrelation(
      normalized.status,
      { error: normalized.clientMessage, debugMessage: error.message },
      request.correlationId
    );
    finishRequest(context, request, normalized.status);
  }
};
