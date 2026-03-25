import { MessagePort, workerData } from "node:worker_threads";
import { parseOpenAiStreamBlock } from "./AiRuntime";

type StreamWorkerData = {
  baseUrl: string;
  payload: Record<string, unknown>;
  port: MessagePort;
};

type StreamChunkMessage = { kind: "chunk"; text: string };
type StreamDoneMessage = { kind: "done"; text: string };
type StreamErrorMessage = { kind: "error"; error: string };

const data = workerData as StreamWorkerData;
const port = data.port;

function post(message: StreamChunkMessage | StreamDoneMessage | StreamErrorMessage) {
  port?.postMessage(message);
}

async function run() {
  try {
    const response = await fetch(`${data.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data.payload,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI backend error: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("AI backend returned no stream body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let aggregate = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      while (true) {
        const boundary = buffer.indexOf("\n\n");
        if (boundary === -1) {
          break;
        }
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        for (const text of parseOpenAiStreamBlock(block)) {
          if (text.length > 0) {
            aggregate += text;
            post({ kind: "chunk", text });
          }
        }
      }
    }

    if (buffer.trim().length > 0) {
      for (const text of parseOpenAiStreamBlock(buffer)) {
        if (text.length > 0) {
          aggregate += text;
          post({ kind: "chunk", text });
        }
      }
    }

    post({ kind: "done", text: aggregate });
  } catch (error) {
    post({ kind: "error", error: error instanceof Error ? error.message : "AI stream failed" });
  }
}

void run();
