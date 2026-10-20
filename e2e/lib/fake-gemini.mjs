// A stand-in for Google's Gemini API, used when the suite runs with E2E_AI_MOCK=1 (so the check-point
// questions of video lessons can be tested without a real key). Every question's right answer is the
// first option, which keeps the tests predictable.
import http from "node:http";

export const fakeGeminiPort = 4410;

function quiz(lecture) {
  const make = (checkpoint) => ({
    checkpoint,
    questions: [1, 2, 3].map((n) => ({
      question: `Checkpoint ${checkpoint} question ${n} about ${lecture}?`,
      options: ["Right answer", "Wrong answer A", "Wrong answer B", "Wrong answer C"],
      correct_index: 0,
      explanation: `Because ${lecture} says so.`,
    })),
  });
  return JSON.stringify({ checkpoints: [make(1), make(2), make(3)] });
}

export function startFakeGemini() {
  const requests = [];
  const server = http.createServer((request, response) => {
    let raw = "";
    request.on("data", (chunk) => (raw += chunk));
    request.on("end", () => {
      let body = {};
      try {
        body = JSON.parse(raw || "{}");
      } catch {}
      const system = body.systemInstruction?.parts?.[0]?.text || "";
      const prompt = (body.contents || []).map((item) => item.parts?.map((part) => part.text || "").join("")).join("\n");
      requests.push({ url: request.url, system, prompt });
      const isQuiz = system.includes("check-point questions");
      const lecture = /Lecture: "([^"]+)"/.exec(prompt)?.[1] || "the lecture";
      const text = isQuiz ? `\`\`\`json\n${quiz(lecture)}\n\`\`\`` : "This is a fake AI answer.";
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }] }));
    });
  });
  return new Promise((resolve) => server.listen(fakeGeminiPort, "127.0.0.1", () => resolve({ server, requests, stop: () => server.close() })));
}
