import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Prisma } from "@prisma/client";
import { PrismaService, QUEUES } from "@blansole/shared";

interface FootPressure {
  forefoot: number;
  midfoot: number;
  heel: number;
  max: number;
  total: number;
}

interface PressureAggregate extends FootPressure {
  frames: number;
}

@Processor(QUEUES.SESSION_PROCESS)
export class SessionProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job): Promise<void> {
    const sessionId = String(job.data.sessionId ?? "");
    if (!sessionId) throw new Error("sessionId is required");

    const session = await this.prisma.activitySession.findUnique({
      where: { id: sessionId },
      include: {
        metrics: true,
        sensorSamples: { orderBy: { recordedAt: "asc" } },
      },
    });
    if (!session) throw new Error(`Activity session ${sessionId} not found`);
    if (session.status === "completed") return;

    const counters = session.sensorSamples.reduce(
      (current, sample) => ({
        steps: this.maximum(
          current.steps,
          this.numberFromPayload(sample.payload, ["steps"]),
        ),
        distanceKm: this.maximum(
          current.distanceKm,
          this.numberFromPayload(sample.payload, ["distanceKm", "distance"]),
        ),
        calories: this.maximum(
          current.calories,
          this.numberFromPayload(sample.payload, ["calories"]),
        ),
      }),
      { steps: undefined, distanceKm: undefined, calories: undefined } as {
        steps?: number;
        distanceKm?: number;
        calories?: number;
      },
    );
    const lastRecordedAt = session.sensorSamples.at(-1)?.recordedAt;
    const endedAt = session.endedAt ?? lastRecordedAt ?? new Date();
    const durationSec =
      session.durationSec ??
      Math.max(
        0,
        Math.round((endedAt.getTime() - session.startedAt.getTime()) / 1_000),
      );
    const steps = session.metrics?.steps ?? counters.steps;
    const distanceKm = session.metrics?.distanceKm ?? counters.distanceKm;
    const calories = session.metrics?.calories ?? counters.calories;
    const durationMinutes = durationSec > 0 ? durationSec / 60 : undefined;
    const cadence =
      this.lastMetric(session.sensorSamples, ["cadence"]) ??
      (steps !== undefined && durationMinutes
        ? steps / durationMinutes
        : undefined);
    const speedKmh =
      this.lastMetric(session.sensorSamples, ["speedKmh"]) ??
      (distanceKm !== undefined && durationSec > 0
        ? distanceKm / (durationSec / 3_600)
        : undefined);
    const stepLength =
      this.lastMetric(session.sensorSamples, ["stepLength"]) ??
      (distanceKm !== undefined && steps
        ? (distanceKm * 1_000) / steps
        : undefined);
    const pressure = this.aggregatePressure(
      session.sensorSamples.map((sample) => sample.payload),
    );
    const balanceScore = pressure
      ? this.balanceScore(pressure.left, pressure.right)
      : undefined;

    const metricData = {
      steps: steps === undefined ? undefined : Math.round(steps),
      distanceKm,
      calories,
      speedKmh,
      pace: speedKmh && speedKmh > 0 ? 60 / speedKmh : undefined,
      cadence,
      balanceScore,
    };
    const gaitData = {
      cadence,
      stepLength,
      stepTime: this.lastMetric(session.sensorSamples, ["stepTime"]),
      stanceTime: this.lastMetric(session.sensorSamples, ["stanceTime"]),
      swingTime: this.lastMetric(session.sensorSamples, ["swingTime"]),
      doubleSupportTime: this.lastMetric(session.sensorSamples, [
        "doubleSupportTime",
      ]),
      strideLength: this.lastMetric(session.sensorSamples, ["strideLength"]),
      gaitSpeed: speedKmh === undefined ? undefined : speedKmh / 3.6,
      variabilityCv: this.lastMetric(session.sensorSamples, ["variabilityCv"]),
      gaitScore: this.lastMetric(session.sensorSamples, ["gaitScore"]),
    };
    const hasMetrics = Object.values(metricData).some(
      (value) => value !== undefined && value !== null,
    );
    const hasGait = Object.values(gaitData).some(
      (value) => value !== undefined && value !== null,
    );

    await this.prisma.$transaction(async (tx) => {
      if (hasMetrics) {
        await tx.sessionMetric.upsert({
          where: { sessionId },
          create: {
            sessionId,
            ...metricData,
            algorithmVersion: "raw-summary-v2",
          },
          update: { ...metricData, algorithmVersion: "raw-summary-v2" },
        });
      }
      if (pressure) {
        await tx.sessionPressureZone.deleteMany({ where: { sessionId } });
        await tx.sessionPressureZone.createMany({
          data: [
            this.pressureZone(sessionId, "left", pressure.left),
            this.pressureZone(sessionId, "right", pressure.right),
          ],
        });
      }
      if (hasGait) {
        await tx.sessionGaitMetric.upsert({
          where: { sessionId },
          create: {
            sessionId,
            ...gaitData,
            algorithmVersion: "measured-summary-v1",
          },
          update: { ...gaitData, algorithmVersion: "measured-summary-v1" },
        });
      }
      await tx.notificationEvent.create({
        data: {
          userId: session.userId,
          eventType: "session_completed",
          payloadJson: {
            sessionId,
            steps: metricData.steps,
            distanceKm,
            durationSec,
          },
        },
      });
      await tx.activitySession.update({
        where: { id: sessionId },
        data: {
          endedAt,
          durationSec,
          status: "completed",
          syncStatus: "synced",
        },
      });
    });
  }

  private numberFromPayload(
    payload: Prisma.JsonValue,
    keys: string[],
  ): number | undefined {
    for (const container of this.payloadContainers(payload)) {
      for (const key of keys) {
        const value = container[key];
        const numeric = this.nonNegativeNumber(value);
        if (numeric !== undefined) return numeric;
      }
    }
    return undefined;
  }

  private lastMetric(
    samples: Array<{ payload: Prisma.JsonValue }>,
    keys: string[],
  ) {
    for (let index = samples.length - 1; index >= 0; index -= 1) {
      const value = this.numberFromPayload(samples[index].payload, keys);
      if (value !== undefined) return value;
    }
    return undefined;
  }

  private payloadContainers(payload: Prisma.JsonValue): Prisma.JsonObject[] {
    if (!payload || Array.isArray(payload) || typeof payload !== "object")
      return [];
    const root = payload as Prisma.JsonObject;
    const containers: Prisma.JsonObject[] = [root];
    for (const name of ["data", "liveData", "metrics", "gait"]) {
      const nested = root[name];
      if (nested && !Array.isArray(nested) && typeof nested === "object") {
        containers.push(nested as Prisma.JsonObject);
      }
    }
    return containers;
  }

  private aggregatePressure(payloads: Prisma.JsonValue[]) {
    const left = this.emptyPressure();
    const right = this.emptyPressure();
    for (const payload of payloads) {
      const frame = this.pressureFrame(payload);
      if (frame?.left) this.addPressure(left, frame.left);
      if (frame?.right) this.addPressure(right, frame.right);
    }
    if (!left.frames || !right.frames) return null;
    return { left, right };
  }

  private pressureFrame(payload: Prisma.JsonValue) {
    for (const container of this.payloadContainers(payload)) {
      const candidate =
        container.pressure ?? container.pressures ?? container.livePressures;
      if (
        !candidate ||
        Array.isArray(candidate) ||
        typeof candidate !== "object"
      )
        continue;
      const object = candidate as Prisma.JsonObject;
      return {
        left: this.footPressure(object.left),
        right: this.footPressure(object.right),
      };
    }
    return null;
  }

  private footPressure(
    value: Prisma.JsonValue | undefined,
  ): FootPressure | null {
    if (Array.isArray(value)) {
      const values = value.map((item) => this.nonNegativeNumber(item) ?? 0);
      if (values.length >= 5)
        return this.toFootPressure(
          values[0] + values[1],
          values[2] + values[3],
          values[4],
          values,
        );
      if (values.length >= 3)
        return this.toFootPressure(values[0], values[1], values[2], values);
      return null;
    }
    if (!value || typeof value !== "object") return null;
    const foot = value as Prisma.JsonObject;
    const toe = this.nonNegativeNumber(foot.toe) ?? 0;
    const forefoot = this.nonNegativeNumber(foot.forefoot ?? foot.fore) ?? 0;
    const midInner = this.nonNegativeNumber(foot.midInner) ?? 0;
    const midOuter = this.nonNegativeNumber(foot.midOuter) ?? 0;
    const midfoot =
      this.nonNegativeNumber(foot.midfoot ?? foot.mid) ?? midInner + midOuter;
    const heel = this.nonNegativeNumber(foot.heel) ?? 0;
    const values = [toe, forefoot, midInner, midOuter, midfoot, heel];
    if (!values.some((item) => item > 0)) return null;
    return this.toFootPressure(toe + forefoot, midfoot, heel, values);
  }

  private toFootPressure(
    forefoot: number,
    midfoot: number,
    heel: number,
    values: number[],
  ): FootPressure {
    return {
      forefoot,
      midfoot,
      heel,
      max: Math.max(...values),
      total: forefoot + midfoot + heel,
    };
  }

  private emptyPressure(): PressureAggregate {
    return { forefoot: 0, midfoot: 0, heel: 0, max: 0, total: 0, frames: 0 };
  }

  private addPressure(target: PressureAggregate, frame: FootPressure) {
    target.forefoot += frame.forefoot;
    target.midfoot += frame.midfoot;
    target.heel += frame.heel;
    target.max = Math.max(target.max, frame.max);
    target.total += frame.total;
    target.frames += 1;
  }

  private pressureZone(
    sessionId: string,
    footSide: "left" | "right",
    value: PressureAggregate,
  ) {
    const total = value.forefoot + value.midfoot + value.heel;
    const percentage = (part: number) =>
      total ? Math.round((part / total) * 10_000) / 100 : 0;
    const hotspotArea = [
      ["forefoot", value.forefoot],
      ["midfoot", value.midfoot],
      ["heel", value.heel],
    ].sort((a, b) => Number(b[1]) - Number(a[1]))[0][0] as string;
    return {
      sessionId,
      footSide,
      forefootPercent: percentage(value.forefoot),
      midfootPercent: percentage(value.midfoot),
      heelPercent: percentage(value.heel),
      maxPressure: value.max,
      avgPressure: value.frames ? value.total / value.frames : 0,
      hotspotArea,
      pressureLevel: "unclassified",
      algorithmVersion: "relative-pressure-v1",
    };
  }

  private balanceScore(left: PressureAggregate, right: PressureAggregate) {
    const total = left.total + right.total;
    if (!total) return undefined;
    const imbalancePercent = (Math.abs(left.total - right.total) / total) * 100;
    return Math.max(0, Math.round((100 - imbalancePercent) * 100) / 100);
  }

  private nonNegativeNumber(value: Prisma.JsonValue | undefined) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0)
      return value;
    if (
      typeof value === "string" &&
      value.trim() &&
      Number.isFinite(Number(value)) &&
      Number(value) >= 0
    ) {
      return Number(value);
    }
    return undefined;
  }

  private maximum(current?: number, incoming?: number) {
    if (incoming === undefined) return current;
    return current === undefined ? incoming : Math.max(current, incoming);
  }
}
