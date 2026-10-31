/* global API_URL, CONTROL_TOKEN, FAULTS, http */
if (API_URL !== "http://127.0.0.1:4400/api/v1") throw new Error("Fault injection requires the isolated local fixture proxy.");
const response = http.post("http://127.0.0.1:4400/__maestro/control", {
  headers: { "Content-Type": "application/json", "x-maestro-control": CONTROL_TOKEN },
  body: JSON.stringify({ rules: JSON.parse(FAULTS) }),
});
if (!response.ok) throw new Error("Fixture fault configuration failed: " + response.status);
