import { LinkCheckerProcessor } from "./link-checker.processor";

describe("LinkCheckerProcessor", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("archives a published video when YouTube reports it removed", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response("", { status: 404 }));
    const prisma = {
      exerciseVideo: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "video-1",
            youtubeVideoId: "dQw4w9WgXcQ",
            status: "published",
          },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const processor = new LinkCheckerProcessor(prisma as any);

    await processor.process({ data: { videoId: "video-1" } } as any);

    expect(prisma.exerciseVideo.update).toHaveBeenCalledWith({
      where: { id: "video-1" },
      data: expect.objectContaining({
        linkStatus: "removed",
        status: "archived",
      }),
    });
  });
});
