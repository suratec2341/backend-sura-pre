import { BadRequestException } from "@nestjs/common";
import { AdminContentService } from "./admin-content.service";

describe("AdminContentService", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("accepts only verified YouTube links and stores canonical metadata", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          title: "Safe movement guide",
          thumbnail_url: "https://i.ytimg.com/example.jpg",
        }),
        { status: 200 },
      ),
    );
    const prisma = {
      exerciseVideo: { create: jest.fn().mockResolvedValue({ id: "video-1" }) },
    };
    const service = new AdminContentService(prisma as any);

    await service.createVideo("admin-1", {
      youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
      aiDescription: "Reviewed grounding description",
    });

    expect(prisma.exerciseVideo.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        youtubeVideoId: "dQw4w9WgXcQ",
        youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        title: "Safe movement guide",
        linkStatus: "active",
      }),
    });
  });

  it("rejects non-YouTube hosts before making a network request", async () => {
    const service = new AdminContentService({} as any);
    await expect(
      service.createVideo("admin-1", {
        youtubeUrl: "https://example.com/watch?v=dQw4w9WgXcQ",
        aiDescription: "Description",
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
