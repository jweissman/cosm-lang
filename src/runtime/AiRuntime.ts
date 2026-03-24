import { execFileSync } from "node:child_process";
import { Construct } from "../Construct";
import { CosmClassValue } from "../values/CosmClassValue";
import { CosmSchemaValue } from "../values/CosmSchemaValue";
import { CosmStringValue } from "../values/CosmStringValue";
import { ValueAdapter } from "../ValueAdapter";

type LmStudioConfig = {
  backend: string;
  baseUrl: string;
  model?: string;
  configured: boolean;
};

export class AiRuntime {
  static status(namespaceClassRef?: CosmClassValue) {
    const config = this.config();
    return Construct.namespace({
      backend: Construct.string(config.backend),
      baseUrl: Construct.string(config.baseUrl),
      model: config.model ? Construct.string(config.model) : Construct.bool(false),
      configured: Construct.bool(config.configured),
    }, namespaceClassRef);
  }

  static complete(prompt: string) {
    const content = this.chat([
      { role: "user", content: prompt },
    ]);
    return new CosmStringValue(content);
  }

  static cast(prompt: string, schema: CosmSchemaValue) {
    const schemaValue = schema.nativeMethod("jsonSchema")?.nativeCall?.([], schema);
    const schemaObject = schemaValue ? ValueAdapter.cosmToJS(schemaValue) : {};
    const content = this.chat([
      {
        role: "system",
        content: `Return only valid JSON matching this schema: ${JSON.stringify(schemaObject)}`,
      },
      { role: "user", content: prompt },
    ], { json: true });
    const parsed = JSON.parse(content);
    return schema.nativeMethod("cast")!.nativeCall!([ValueAdapter.jsToCosm(parsed)], schema);
  }

  static compare(left: string, right: string): boolean {
    const content = this.chat([
      {
        role: "system",
        content: 'Return only JSON like {"equal":true} or {"equal":false}.',
      },
      {
        role: "user",
        content: `Are these semantically equivalent?\nLeft: ${left}\nRight: ${right}`,
      },
    ], { json: true });
    const parsed = JSON.parse(content) as { equal?: boolean };
    if (typeof parsed.equal !== "boolean") {
      throw new Error("AI backend returned an invalid semantic comparison payload");
    }
    return parsed.equal;
  }

  private static chat(messages: Array<{ role: string; content: string }>, options?: { json?: boolean }): string {
    const config = this.config(true);
    const payload = {
      model: config.model,
      messages,
      temperature: 0,
      response_format: options?.json ? { type: "json_object" } : undefined,
    };
    const raw = execFileSync("curl", [
      "-sS",
      "-X",
      "POST",
      `${config.baseUrl}/chat/completions`,
      "-H",
      "Content-Type: application/json",
      "-d",
      JSON.stringify(payload),
    ], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    const parsed = JSON.parse(raw) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    };
    if (parsed.error?.message) {
      throw new Error(`AI backend error: ${parsed.error.message}`);
    }
    const content = parsed.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("AI backend returned no completion content");
    }
    return content;
  }

  private static config(requireModel = false): LmStudioConfig {
    const backend = process.env.COSM_AI_BACKEND ?? "lmstudio";
    const baseUrl = process.env.COSM_AI_BASE_URL ?? "http://127.0.0.1:1234/v1";
    const model = process.env.COSM_AI_MODEL;
    if (backend !== "lmstudio") {
      throw new Error(`AI backend '${backend}' is not supported in 0.3.5`);
    }
    if (requireModel && !model) {
      throw new Error("AI backend is not configured: set COSM_AI_MODEL for LM Studio");
    }
    return {
      backend,
      baseUrl,
      model,
      configured: Boolean(model),
    };
  }
}
