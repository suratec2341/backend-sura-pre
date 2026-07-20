import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService, QUEUES } from '@blansole/shared';

@Processor(QUEUES.SESSION_PROCESS)
export class SessionProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<void> {
    const sessionId = String(job.data.sessionId ?? '');
    if (!sessionId) throw new Error('sessionId is required');
    console.log(`Processing session: ${sessionId}`);

    const session = await this.prisma.activitySession.findUnique({
      where: { id: sessionId },
      include: {
        metrics: true,
        sensorSamples: { orderBy: { recordedAt: 'asc' } },
      },
    });
    if (!session) throw new Error(`Activity session ${sessionId} not found`);
    if (session.status === 'completed') return;

    const derived = session.sensorSamples.reduce(
      (current, sample) => ({
        steps: this.maximum(current.steps, this.numberFromPayload(sample.payload, ['steps'])),
        distanceKm: this.maximum(current.distanceKm, this.numberFromPayload(sample.payload, ['distanceKm', 'distance'])),
        calories: this.maximum(current.calories, this.numberFromPayload(sample.payload, ['calories'])),
      }),
      { steps: undefined, distanceKm: undefined, calories: undefined } as {
        steps?: number;
        distanceKm?: number;
        calories?: number;
      },
    );
    const metricData = {
      steps: session.metrics?.steps ?? (derived.steps === undefined ? undefined : Math.round(derived.steps)),
      distanceKm: session.metrics?.distanceKm ?? derived.distanceKm,
      calories: session.metrics?.calories ?? derived.calories,
    };
    const hasMetrics = Object.values(metricData).some((value) => value !== undefined && value !== null);
    const lastRecordedAt = session.sensorSamples.at(-1)?.recordedAt;
    const endedAt = session.endedAt ?? lastRecordedAt ?? new Date();
    const durationSec = session.durationSec
      ?? Math.max(0, Math.round((endedAt.getTime() - session.startedAt.getTime()) / 1000));

    await this.prisma.$transaction(async (tx) => {
      if (hasMetrics) {
        await tx.sessionMetric.upsert({
          where: { sessionId },
          create: { sessionId, ...metricData, algorithmVersion: 'raw-counter-v1' },
          update: metricData,
        });
      }
      await tx.activitySession.update({
        where: { id: sessionId },
        data: { endedAt, durationSec, status: 'completed', syncStatus: 'synced' },
      });
    });
  }

  private numberFromPayload(payload: Prisma.JsonValue, keys: string[]): number | undefined {
    if (!payload || Array.isArray(payload) || typeof payload !== 'object') return undefined;
    const root = payload as Prisma.JsonObject;
    const containers: Prisma.JsonObject[] = [root];
    for (const name of ['data', 'liveData', 'metrics']) {
      const nested = root[name];
      if (nested && !Array.isArray(nested) && typeof nested === 'object') {
        containers.push(nested as Prisma.JsonObject);
      }
    }
    for (const container of containers) {
      for (const key of keys) {
        const value = container[key];
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
        if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value)) && Number(value) >= 0) {
          return Number(value);
        }
      }
    }
    return undefined;
  }

  private maximum(current?: number, incoming?: number) {
    if (incoming === undefined) return current;
    return current === undefined ? incoming : Math.max(current, incoming);
  }
}
