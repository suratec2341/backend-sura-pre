import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@blansole/shared";
import {
  FinishSessionDto,
  PushSessionDataDto,
  SensorSampleDto,
  SessionListQueryDto,
  StartSessionDto,
  SyncBatchDto,
} from "./dto/session.dto";
import { SessionProcessingQueueService } from "./session-processing-queue.service";

export interface UploadedSensorFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionQueue: SessionProcessingQueueService,
  ) {}

  async start(userId: string, body: StartSessionDto) {
    if (body.clientSessionUuid) {
      const existing = await this.prisma.activitySession.findFirst({
        where: { userId, clientSessionUuid: body.clientSessionUuid },
        include: { metrics: true },
      });
      if (existing) return existing;
    }
    if (body.deviceId) await this.assertOwnedDevice(userId, body.deviceId);

    return this.prisma.activitySession.create({
      data: {
        userId,
        deviceId: body.deviceId,
        activityType: body.activityType?.trim() || "walking",
        startedAt: body.startedAt ? new Date(body.startedAt) : new Date(),
        clientSessionUuid: body.clientSessionUuid,
      },
    });
  }

  async pushData(userId: string, id: string, body: PushSessionDataDto) {
    await this.assertOwnedSession(userId, id);
    const samples = body.samples?.length
      ? body.samples
      : body.data
        ? [
            {
              data: body.data,
              recordedAt: body.recordedAt,
              sequence: body.sequence,
            },
          ]
        : [];
    if (!samples.length)
      throw new BadRequestException("samples or data is required");
    const accepted = await this.storeSamples(
      id,
      samples,
      body.source ?? "realtime",
    );
    return { sessionId: id, accepted };
  }

  async syncBatch(
    userId: string,
    body: SyncBatchDto,
    file?: UploadedSensorFile,
  ) {
    const clientSessionId = (body.session_id ?? body.sessionId)?.trim();
    if (!clientSessionId)
      throw new BadRequestException("session_id or sessionId is required");
    if (
      file &&
      ![
        "application/x-ndjson",
        "application/json",
        "text/plain",
        "application/octet-stream",
      ].includes(file.mimetype)
    ) {
      throw new BadRequestException("file must contain JSON Lines (NDJSON)");
    }

    const samples = file ? this.parseNdjson(file.buffer) : (body.samples ?? []);
    if (!samples.length)
      throw new BadRequestException(
        "Uploaded batch contains no sensor samples",
      );
    if (samples.length > 20_000)
      throw new BadRequestException(
        "A batch can contain at most 20000 samples",
      );

    let session = await this.prisma.activitySession.findFirst({
      where: {
        userId,
        OR: [{ id: clientSessionId }, { clientSessionUuid: clientSessionId }],
      },
    });
    if (!session) {
      const firstTimestamp = this.sampleDate(samples[0]?.recordedAt);
      session = await this.prisma.activitySession.create({
        data: {
          userId,
          activityType: "walking",
          startedAt: firstTimestamp,
          clientSessionUuid: clientSessionId,
          syncStatus: "pending",
        },
      });
    }

    const source = (body.device_type ?? body.deviceType)?.trim() || "offline";
    const accepted = await this.storeSamples(session.id, samples, source);
    await this.prisma.activitySession.update({
      where: { id: session.id },
      data: { syncStatus: "synced" },
    });
    return {
      sessionId: session.id,
      clientSessionUuid: clientSessionId,
      accepted,
    };
  }

  async finish(userId: string, id: string, body: FinishSessionDto) {
    const session = await this.assertOwnedSession(userId, id);
    if (session.status === "completed") return this.get(userId, id);

    const endedAt = body.endedAt ? new Date(body.endedAt) : new Date();
    const durationSec =
      body.durationSec ??
      (body.duration !== undefined
        ? Math.round(body.duration * 60)
        : Math.max(
            0,
            Math.round(
              (endedAt.getTime() - session.startedAt.getTime()) / 1000,
            ),
          ));

    await this.prisma.$transaction(async (tx) => {
      await tx.activitySession.update({
        where: { id },
        data: {
          endedAt,
          durationSec,
          status: "processing",
          syncStatus: "synced",
        },
      });
      if (
        body.steps !== undefined ||
        body.distance !== undefined ||
        body.calories !== undefined
      ) {
        await tx.sessionMetric.upsert({
          where: { sessionId: id },
          create: {
            sessionId: id,
            steps: body.steps,
            distanceKm: body.distance,
            calories: body.calories,
            algorithmVersion: "client-v1",
          },
          update: {
            steps: body.steps,
            distanceKm: body.distance,
            calories: body.calories,
          },
        });
      }

      const zones = body.pressureZones?.length
        ? body.pressureZones
        : [
            body.peakLeft ? this.peakOnlyZone("left", body.peakLeft) : null,
            body.peakRight ? this.peakOnlyZone("right", body.peakRight) : null,
          ].filter((zone): zone is NonNullable<typeof zone> => zone !== null);
      if (zones.length) {
        await tx.sessionPressureZone.deleteMany({ where: { sessionId: id } });
        await tx.sessionPressureZone.createMany({
          data: zones.map((zone) => ({
            sessionId: id,
            footSide: zone.footSide,
            forefootPercent: zone.forefootPercent,
            midfootPercent: zone.midfootPercent,
            heelPercent: zone.heelPercent,
            maxPressure: zone.maxPressure,
            avgPressure: zone.avgPressure,
            hotspotArea: zone.hotspotArea,
            pressureLevel: zone.pressureLevel ?? "unknown",
            algorithmVersion: body.pressureZones?.length
              ? "client-v1"
              : "client-peak-v1",
          })),
        });
      }
    });

    await this.sessionQueue.enqueue(id);
    this.logger.log(`Queued processing for session ${id}`);
    return this.get(userId, id);
  }

  async list(userId: string, query: SessionListQueryDto) {
    const from = query.from
      ? new Date(query.from)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to) : new Date();
    if (from > to) throw new BadRequestException("from must be before to");

    const rows = await this.prisma.activitySession.findMany({
      where: { userId, startedAt: { gte: from, lte: to } },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      take: query.limit ?? 50,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      include: {
        metrics: true,
        pressureZones: true,
        gaitMetrics: true,
        aiInsights: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    return {
      items: rows.map((row) => this.mapSession(row)),
      nextCursor:
        rows.length === (query.limit ?? 50) ? (rows.at(-1)?.id ?? null) : null,
    };
  }

  async get(userId: string, id: string) {
    const row = await this.prisma.activitySession.findFirst({
      where: { id, userId },
      include: {
        metrics: true,
        pressureZones: true,
        pressureMaps: { orderBy: { capturedAt: "desc" } },
        gaitMetrics: true,
        gaitPhases: true,
        alerts: { orderBy: { createdAt: "desc" } },
        aiSummary: true,
        aiInsights: { orderBy: { createdAt: "desc" } },
        _count: { select: { sensorSamples: true } },
      },
    });
    if (!row) throw new NotFoundException("Activity session not found");
    const risks = await this.prisma.riskAssessment.findMany({
      where: { userId, sourceSessionId: id },
      orderBy: { computedAt: "desc" },
    });
    return { ...this.mapSession(row), risks };
  }

  async pressureMap(userId: string, id: string) {
    await this.assertOwnedSession(userId, id);
    const [maps, zones] = await Promise.all([
      this.prisma.sessionPressureMap.findMany({
        where: { sessionId: id },
        orderBy: { capturedAt: "desc" },
      }),
      this.prisma.sessionPressureZone.findMany({ where: { sessionId: id } }),
    ]);
    const left = zones.find((zone) => zone.footSide === "left");
    const right = zones.find((zone) => zone.footSide === "right");
    const total = (left?.avgPressure ?? 0) + (right?.avgPressure ?? 0);
    return {
      maps,
      zones,
      balance: {
        left: total
          ? Math.round(((left?.avgPressure ?? 0) / total) * 1000) / 10
          : 50,
        right: total
          ? Math.round(((right?.avgPressure ?? 0) / total) * 1000) / 10
          : 50,
      },
    };
  }

  async gaitAnalysis(userId: string, id: string) {
    await this.assertOwnedSession(userId, id);
    const [metrics, phases] = await Promise.all([
      this.prisma.sessionGaitMetric.findUnique({ where: { sessionId: id } }),
      this.prisma.sessionGaitPhase.findMany({
        where: { sessionId: id },
        orderBy: { startPct: "asc" },
      }),
    ]);
    return { metrics, phases };
  }

  async insight(userId: string, id: string) {
    await this.assertOwnedSession(userId, id);
    return this.prisma.aiInsight.findMany({
      where: { userId, sessionId: id },
      orderBy: { createdAt: "desc" },
    });
  }

  private async storeSamples(
    sessionId: string,
    samples: SensorSampleDto[],
    source: string,
  ) {
    let accepted = 0;
    for (let offset = 0; offset < samples.length; offset += 1000) {
      const chunk = samples.slice(offset, offset + 1000);
      const result = await this.prisma.sessionSensorSample.createMany({
        data: chunk.map((sample) => ({
          sessionId,
          sequence: sample.sequence,
          recordedAt: this.sampleDate(sample.recordedAt),
          source,
          payload: (sample.payload ??
            sample.data ??
            {}) as Prisma.InputJsonValue,
        })),
        skipDuplicates: true,
      });
      accepted += result.count;
    }
    return accepted;
  }

  private parseNdjson(buffer: Buffer): SensorSampleDto[] {
    const lines = buffer
      .toString("utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim());
    return lines.map((line, index) => {
      try {
        const payload = JSON.parse(line) as Record<string, unknown>;
        if (!payload || Array.isArray(payload) || typeof payload !== "object")
          throw new Error("not an object");
        const timestamp =
          payload.recordedAt ?? payload.timestamp ?? payload.time ?? payload.t;
        const sequence = payload.sequence ?? payload.index;
        return {
          recordedAt: this.timestampString(timestamp),
          sequence:
            typeof sequence === "number" &&
            Number.isInteger(sequence) &&
            sequence >= 0
              ? sequence
              : index,
          payload,
        };
      } catch {
        throw new BadRequestException(`Invalid JSON on line ${index + 1}`);
      }
    });
  }

  private sampleDate(value?: string) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime()))
      throw new BadRequestException("Invalid sensor sample timestamp");
    return date;
  }

  private timestampString(value: unknown) {
    if (typeof value === "string") return value;
    if (typeof value === "number" && Number.isFinite(value)) {
      const milliseconds = value < 10_000_000_000 ? value * 1_000 : value;
      const date = new Date(milliseconds);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
    return undefined;
  }

  private async assertOwnedSession(userId: string, id: string) {
    const session = await this.prisma.activitySession.findFirst({
      where: { id, userId },
    });
    if (!session) throw new NotFoundException("Activity session not found");
    return session;
  }

  private async assertOwnedDevice(userId: string, id: string) {
    const device = await this.prisma.userDevice.findFirst({
      where: { id, userId, unpairedAt: null },
      select: { id: true },
    });
    if (!device) throw new NotFoundException("Device not found");
  }

  private peakOnlyZone(footSide: "left" | "right", hotspotArea: string) {
    return {
      footSide,
      forefootPercent: 0,
      midfootPercent: 0,
      heelPercent: 0,
      maxPressure: 0,
      avgPressure: 0,
      hotspotArea,
      pressureLevel: "unknown",
    };
  }

  private mapSession(row: any) {
    const left = row.pressureZones?.find(
      (zone: any) => zone.footSide === "left",
    );
    const right = row.pressureZones?.find(
      (zone: any) => zone.footSide === "right",
    );
    return {
      ...row,
      date: row.startedAt.toISOString().slice(0, 10),
      steps: row.metrics?.steps ?? 0,
      duration: Math.round((row.durationSec ?? 0) / 60),
      distance: row.metrics?.distanceKm ?? 0,
      calories: row.metrics?.calories ?? 0,
      peakLeft: left?.hotspotArea ?? null,
      peakRight: right?.hotspotArea ?? null,
    };
  }
}
