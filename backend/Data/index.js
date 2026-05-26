=const {
  authenticate,
  jsonResponseWithCorrelation,
  normalizeError,
  preflightResponse,
} = require("../shared/auth");
const { emit, finishRequest, maskDeviceId, startRequest } = require("../shared/logging");
const { BlobServiceClient } = require("@azure/storage-blob");
const { DefaultAzureCredential } = require("@azure/identity");

// --- FUNCTIA DE CITIRE DIN BLOB ---
async function readDatasetCsv(blobName) {
  const accountName = process.env.STORAGE_ACCOUNT_NAME;
  const containerName = process.env.DATASETS_CONTAINER_NAME;

  const client = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    new DefaultAzureCredential()
  );

  const containerClient = client.getContainerClient(containerName);
  const blobClient = containerClient.getBlobClient(blobName);

  const downloadResponse = await blobClient.download();
  const chunks = [];
  for await (const chunk of downloadResponse.readableStreamBody) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

// --- PARSER CORECT PENTRU CSV-UL TĂU ---
function parseCsv(csvText) {
  // Despărțim textul pe linii și scoatem liniile goale
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== "");
  if (lines.length <= 1) return [];

  // Extragem headerele: device_id, timestamp, kwh, location
  const headers = lines[0].split(",").map(h => h.trim());

  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim());
    const obj = {};
    headers.forEach((header, index) => {
      const val = values[index];
      // Convertim automat consumul 'kwh' în număr, restul rămân text
      obj[header] = (header === "kwh" && !isNaN(val)) ? Number(val) : val;
    });
    return obj;
  });
}

// --- FUNCTIA PRINCIPALA DIN AZURE ---
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

    // 1. Descărcăm fișierul din Azure Blob Storage
    // Schimbă "dataset.csv" cu numele exact al fișierului tău din container, dacă e diferit!
    const csvContent = await readDatasetCsv("energy_large_usage.csv");
    
    // 2. Parsăm liniile (acum vor conține: device_id, timestamp, kwh, location)
    const allData = parseCsv(csvContent);

    let visibleData;

    if (role === "admin") {
      // Administratorul vede toate înregistrările din CSV
      visibleData = allData;
    } else if (role === "user") {
      if (!device_id) {
        emit(context, "warn", "authz.denied", {
          correlationId: request.correlationId,
          path: "/api/data",
          code: "missing_device_id",
          role,
        });
        context.res = jsonResponseWithCorrelation(
          403,
          {
            error: "No device_id associated with this account",
          },
          request.correlationId
        );
        finishRequest(context, request, 403);
        return;
      }

      // Utilizatorul normal vede doar rândurile din CSV unde device_id se potrivește cu al lui
      visibleData = allData.filter((item) => item.device_id === device_id);
    } else {
      emit(context, "warn", "authz.denied", {
        correlationId: request.correlationId,
        path: "/api/data",
        code: "unknown_role",
        role,
      });
      context.res = jsonResponseWithCorrelation(
        403,
        { error: "Insufficient permissions" },
        request.correlationId
      );
      finishRequest(context, request, 403);
      return;
    }

    emit(context, "info", "authz.allowed", {
      correlationId: request.correlationId,
      path: "/api/data",
      role,
      deviceIdMasked: maskDeviceId(device_id),
      returnedCount: visibleData.length,
    });

    // Trimitem înapoi datele structurate frumos (cu kwh, timestamp, location)
    context.res = jsonResponseWithCorrelation(
      200,
      {
        role,
        device_id,
        data: visibleData,
      },
      request.correlationId
    );
    finishRequest(context, request, 200);
  } catch (error) {
    const normalized = normalizeError(error);
    emit(context, normalized.status >= 500 ? "error" : "warn", "auth.failed", {
      correlationId: request.correlationId,
      path: "/api/data",
      code: normalized.code,
      reason: normalized.logMessage,
    });
    context.res = jsonResponseWithCorrelation(
      normalized.status,
      { error: normalized.clientMessage },
      request.correlationId
    );
    finishRequest(context, request, normalized.status);
  }
};