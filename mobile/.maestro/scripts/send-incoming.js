/* global API_URL, RECEIVER_USERNAME, PASSWORD, CONVERSATION_ID, RUN_ID, http, output */
// Runs only when explicitly called by the live-receive flow, never during static checks.
// This script executes on the Maestro host. Its API is the isolated localhost server.
if (API_URL !== "http://127.0.0.1:4400/api/v1") throw new Error("Incoming fixture requires the local Maestro API.");
const loginResponse = http.post(API_URL + "/auth/login", {
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ identifier: RECEIVER_USERNAME, password: PASSWORD }),
});
if (!loginResponse.ok) throw new Error("Fixture sender could not sign in: " + loginResponse.status);
const token = JSON.parse(loginResponse.body).accessToken;
output.incomingText = "Maestro live incoming " + RUN_ID;
const response = http.post(API_URL + "/frontend/messages/" + CONVERSATION_ID, {
  headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
  body: JSON.stringify({ content: output.incomingText }),
});
if (!response.ok) throw new Error("Fixture message failed: " + response.status);
