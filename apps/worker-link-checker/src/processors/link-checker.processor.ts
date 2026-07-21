import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PrismaService, QUEUES } from "@blansole/shared";

@Processor(QUEUES.LINK_CHECK)
export class LinkCheckerProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<{ videoId?: string }>): Promise<void> {
    const videos = await this.prisma.exerciseVideo.findMany({
      where: job.data?.videoId
        ? { id: job.data.videoId }
        : { status: "published" },
      select: { id: true, youtubeVideoId: true, status: true },
    });

    for (const video of videos) {
      const linkStatus = await this.checkVideo(video.youtubeVideoId);
      if (!linkStatus) {
        await this.prisma.exerciseVideo.update({
          where: { id: video.id },
          data: { lastLinkCheckedAt: new Date() },
        });
        continue;
      }
      await this.prisma.exerciseVideo.update({
        where: { id: video.id },
        data: {
          linkStatus,
          lastLinkCheckedAt: new Date(),
          ...(linkStatus === "active" ? {} : { status: "archived" }),
        },
      });
      if (linkStatus !== "active" && video.status === "published") {
        const staff = await this.prisma.user.findMany({
          where: {
            role: { in: ["admin", "content_editor"] },
            status: "active",
          },
          select: { id: true },
        });
        if (staff.length) {
          await this.prisma.notificationEvent.createMany({
            data: staff.map((user) => ({
              userId: user.id,
              eventType: "content_link_broken",
              payloadJson: { videoId: video.id, linkStatus },
            })),
          });
        }
      }
    }
  }

  private async checkVideo(videoId: string) {
    const url = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    let response: Response;
    try {
      response = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
        { signal: AbortSignal.timeout(8_000) },
      );
    } catch {
      return null;
    }
    if (response.ok) return "active";
    if (response.status === 401 || response.status === 403) return "private";
    if (response.status === 404) return "removed";
    return response.status >= 500 ? null : "broken";
  }
}
