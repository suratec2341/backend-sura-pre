import { NestFactory } from "@nestjs/core";
import { WorkerSessionModule } from "./worker-session.module";

async function bootstrap() {
  await NestFactory.createApplicationContext(WorkerSessionModule);
  console.log("🔧 Session Worker started — listening for jobs");
}

bootstrap().catch((error) => {
  console.error("Failed to start Session Worker", error);
  process.exit(1);
});
