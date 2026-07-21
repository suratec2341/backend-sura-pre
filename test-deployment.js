const http = require("node:http");
const https = require("node:https");
const net = require("node:net");

const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

function report(ok, message, optional = false) {
  const color = ok ? COLORS.green : optional ? COLORS.yellow : COLORS.red;
  const marker = ok ? "✔" : optional ? "!" : "✖";
  console.log(`${color}${marker} ${message}${COLORS.reset}`);
  return ok || optional;
}

function checkPort(host, port, serviceName, optional = true) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let connected = false;
    socket.setTimeout(2_000);
    socket.on("connect", () => {
      connected = true;
      socket.destroy();
    });
    socket.on("timeout", () => socket.destroy());
    socket.on("error", () => socket.destroy());
    socket.on("close", () =>
      resolve(
        report(
          connected,
          `${serviceName} ${connected ? "is reachable" : "is not reachable"} at ${host}:${port}`,
          optional,
        ),
      ),
    );
    socket.connect(port, host);
  });
}

function checkHttp(url, serviceName, expectedStatuses = [200]) {
  return new Promise((resolve) => {
    const client = url.startsWith("https:") ? https : http;
    const req = client.request(
      url,
      { method: "GET", timeout: 5_000 },
      (res) => {
        res.resume();
        res.on("end", () =>
          resolve(
            report(
              expectedStatuses.includes(res.statusCode),
              `${serviceName}: HTTP ${res.statusCode} (${url})`,
            ),
          ),
        );
      },
    );
    req.on("timeout", () => req.destroy(new Error("request timed out")));
    req.on("error", (error) =>
      resolve(report(false, `${serviceName}: ${error.message} (${url})`)),
    );
    req.end();
  });
}

async function runTests() {
  const apiBase = (
    process.env.API_PUBLIC_URL || "http://localhost:8081/api/v1"
  ).replace(/\/$/, "");
  const apiOrigin = new URL(apiBase).origin;
  const healthUrl = process.env.HEALTH_URL || `${apiOrigin}/healthz`;
  const requireLocalInfra = process.env.REQUIRE_LOCAL_INFRA === "true";

  console.log(`${COLORS.cyan}Blansole deployment smoke test${COLORS.reset}`);
  const checks = await Promise.all([
    checkPort(
      process.env.POSTGRES_HOST || "localhost",
      Number(process.env.POSTGRES_HOST_PORT || 5432),
      "PostgreSQL",
      !requireLocalInfra,
    ),
    checkPort(
      process.env.REDIS_HOST || "localhost",
      Number(process.env.REDIS_HOST_PORT || 6379),
      "Redis",
      !requireLocalInfra,
    ),
    checkHttp(healthUrl, "API health"),
    checkHttp(`${apiOrigin}/api/docs`, "Swagger UI"),
    checkHttp(`${apiBase}/me`, "JWT guard rejects anonymous access", [401]),
  ]);

  if (checks.every(Boolean)) {
    console.log(`${COLORS.green}Deployment smoke test passed.${COLORS.reset}`);
    return;
  }
  console.error(`${COLORS.red}Deployment smoke test failed.${COLORS.reset}`);
  process.exitCode = 1;
}

runTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
