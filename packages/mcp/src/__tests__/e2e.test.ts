import { describe, it, expect } from "vitest";
import { spawn } from "child_process";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { describeWithApi, TEST_CONFIG } from "./helpers";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const CLI_PATH = resolve(__dirname, "../../dist/cli.js");

function spawnCli(
  env: Record<string, string> = {},
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((res) => {
    const proc = spawn("node", [CLI_PATH], {
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));

    // Close stdin immediately — the server has no input to read
    proc.stdin.end();

    const timer = setTimeout(() => {
      proc.kill();
      res({ code: null, stdout, stderr });
    }, 5000);

    proc.on("close", (code) => {
      clearTimeout(timer);
      res({ code, stdout, stderr });
    });
  });
}

describe("CLI", () => {
  it("exits with code 1 when LLM_BOOST_API_TOKEN is missing", async () => {
    const result = await spawnCli({
      LLM_BOOST_API_TOKEN: "",
      PATH: process.env.PATH ?? "",
    });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("LLM_BOOST_API_TOKEN");
  });

  it("exits with code 1 when token has invalid format", async () => {
    const result = await spawnCli({
      LLM_BOOST_API_TOKEN: "bad_token_without_prefix",
      PATH: process.env.PATH ?? "",
    });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("Invalid token format");
    expect(result.stderr).toContain('llmb_"');
  });

  describeWithApi("with real token", () => {
    it("starts without token error", async () => {
      const result = await spawnCli({
        LLM_BOOST_API_TOKEN: TEST_CONFIG.apiToken,
        LLM_BOOST_API_URL: TEST_CONFIG.apiBaseUrl,
        PATH: process.env.PATH ?? "",
      });
      // Server starts and waits for stdio input.
      // Since we close stdin immediately, it should exit cleanly or be killed by timeout.
      // The key assertion: it did NOT exit with code 1 due to a token error.
      expect(result.stderr).not.toContain("LLM_BOOST_API_TOKEN");
      expect(result.stderr).not.toContain("Invalid token format");
    });
  });
});
