const http = require('http');
const net = require('net');

const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m"
};

function checkPort(host, port, serviceName) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let status = false;

    socket.setTimeout(2000);
    socket.on('connect', () => {
      status = true;
      socket.destroy();
    });
    socket.on('timeout', () => {
      socket.destroy();
    });
    socket.on('error', () => {
      socket.destroy();
    });
    socket.on('close', () => {
      if (status) {
        console.log(`${COLORS.green}✔ ${serviceName} is UP (Port ${port})${COLORS.reset}`);
      } else {
        console.log(`${COLORS.red}✖ ${serviceName} is DOWN or unreachable on Port ${port}${COLORS.reset}`);
      }
      resolve(status);
    });

    socket.connect(port, host);
  });
}

function checkHttp(url, serviceName, method = 'GET', body = null) {
  return new Promise((resolve) => {
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          console.log(`${COLORS.green}✔ ${serviceName} is UP (${url}) - Status: ${res.statusCode}${COLORS.reset}`);
          resolve(true);
        } else {
          console.log(`${COLORS.red}✖ ${serviceName} returned error status: ${res.statusCode} (${url})${COLORS.reset}`);
          console.log(`  Response: ${data.substring(0, 200)}`);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.log(`${COLORS.red}✖ ${serviceName} is DOWN (${url}) - Error: ${err.message}${COLORS.reset}`);
      resolve(false);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log(`${COLORS.cyan}===========================================${COLORS.reset}`);
  console.log(`${COLORS.cyan}      Blansole Deployment Test Script      ${COLORS.reset}`);
  console.log(`${COLORS.cyan}===========================================${COLORS.reset}\n`);

  console.log(`\n--- 1. Testing Infrastructure Ports ---`);
  await checkPort('localhost', 5432, 'PostgreSQL Database');
  await checkPort('localhost', 6379, 'Redis Cache/Broker');
  await checkPort('localhost', 9000, 'MinIO Object Storage');

  console.log(`\n--- 2. Testing API Endpoints ---`);
  // Assuming port 3000 mapped in docker-compose.yml or 8081 via nginx
  await checkHttp('http://localhost:3000/api/v1/healthz', 'NestJS API Healthcheck');
  await checkHttp('http://localhost:3000/api/docs', 'NestJS API Swagger UI');

  console.log(`\n--- 3. Testing AI Worker Integration ---`);
  await checkHttp('http://localhost:3000/api/v1/ai/chat', 'AI Chat Endpoint', 'POST', {
    threadId: "test-thread-id",
    message: "Test message from automated deployment script"
  });

  console.log(`\n--- 4. Testing Monitoring Systems ---`);
  await checkHttp('http://localhost:3030/api/health', 'Grafana Dashboard');
  await checkHttp('http://localhost:9090/-/healthy', 'Prometheus Server');

  console.log(`\n${COLORS.cyan}===========================================${COLORS.reset}`);
  console.log(`${COLORS.cyan}              Tests Completed              ${COLORS.reset}`);
  console.log(`${COLORS.cyan}===========================================${COLORS.reset}\n`);
}

runTests();
