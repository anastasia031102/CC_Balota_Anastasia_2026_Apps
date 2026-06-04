const { BlobServiceClient } = require("@azure/storage-blob");
const {
  authenticate,
  jsonResponseWithCorrelation,
  normalizeError,
  preflightResponse,
} = require("../shared/auth");
const { emit, finishRequest, maskDeviceId, startRequest } = require("../shared/logging");

async function getEnergyData() {
  // 🔥 REPARAT: În loc de cheia veche (key1) hardcoded care a expirat acum 10 zile,
  // citim din variabila de sistem AzureWebJobsStorage unde ai configurat corect cheia nouă (key2)!
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

  // Curățăm antetul de caractere ascunse (BOM) care apar des pe Windows/Excel
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^\uFEFF/, ""));

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const rawObject = Object.fromEntries(headers.map((h, i) => [h, values[i]]));

    // 🔥 SIGURANȚĂ FORMAT: Chiar dacă în CSV scrie deviceId sau device_id, standardizăm totul pe device_id
    return {
      device_id: rawObject.device_id || rawObject.deviceId || rawObject.Device_ID || "N/A",
      consumption: rawObject.consumption || rawObject.value || rawObject.consumption_kwh || 0,
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
      // Filtrarea va funcționa garantat datorită standardizării de mai sus
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

    context.res = jsonResponseWithCorrelation(
      200,
      visibleData, // 🔥 REPARAT: Trimitem direct array-ul de date curat pe care frontend-ul profesorului vrea să îl citească
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
