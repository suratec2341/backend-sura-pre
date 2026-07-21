import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { adminRequest as request } from "./authenticated-request";

jest.mock("sanitize-html", () => jest.fn((input) => input));

import { AppModule } from "../src/app.module";
import { AdminContentService } from "../src/modules/admin/admin-content.service";
import { API_PREFIX, PrismaService } from "@blansole/shared";

describe("Admin Content Controller (e2e)", () => {
  let app: INestApplication;
  const service = {
    listPrograms: jest.fn().mockResolvedValue([]),
    createProgram: jest
      .fn()
      .mockResolvedValue({ id: "program-1", status: "draft" }),
    updateProgram: jest
      .fn()
      .mockResolvedValue({ id: "program-1", title: "Updated" }),
    submitReview: jest
      .fn()
      .mockResolvedValue({ id: "program-1", status: "in_review" }),
    publish: jest
      .fn()
      .mockResolvedValue({ id: "program-1", status: "published" }),
    unpublish: jest
      .fn()
      .mockResolvedValue({ id: "program-1", status: "archived" }),
    listVideos: jest.fn().mockResolvedValue([]),
    createVideo: jest.fn().mockResolvedValue({ id: "video-1" }),
    updateVideo: jest.fn().mockResolvedValue({ id: "video-1" }),
    recheckLink: jest
      .fn()
      .mockResolvedValue({ id: "video-1", linkStatus: "active" }),
    listTags: jest.fn().mockResolvedValue([]),
    createTag: jest.fn().mockResolvedValue({ id: "tag-1", tagName: "heel" }),
    listRules: jest.fn().mockResolvedValue([]),
    createRule: jest.fn().mockResolvedValue({ id: "rule-1" }),
    reviewLogs: jest.fn().mockResolvedValue([]),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
      .overrideProvider(AdminContentService)
      .useValue(service)
      .compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX);
    await app.init();
  });

  afterAll(() => app.close());

  it("supports the program review and publish workflow", async () => {
    await request(app.getHttpServer())
      .get(`/${API_PREFIX}/admin/content/programs`)
      .expect(200)
      .expect([]);
    await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/content/programs`)
      .send({ title: "Heel load basics", difficulty: "beginner" })
      .expect(201)
      .expect({ id: "program-1", status: "draft" });
    await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/content/programs/program-1/submit-review`)
      .expect(201)
      .expect({ id: "program-1", status: "in_review" });
    await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/content/programs/program-1/publish`)
      .expect(201)
      .expect({ id: "program-1", status: "published" });
  });

  it("validates and creates grounded YouTube content", () =>
    request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/content/videos`)
      .send({
        youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        aiDescription: "Reviewed movement instructions",
      })
      .expect(201)
      .expect({ id: "video-1" }));

  it("manages content tags and deterministic rules", async () => {
    await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/content/tags`)
      .send({ tagName: "heel", category: "body_part" })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/${API_PREFIX}/admin/content/rules`)
      .send({
        conditionTag: "heel",
        targetProgramId: "program-1",
        priority: 10,
      })
      .expect(201)
      .expect({ id: "rule-1" });
    await request(app.getHttpServer())
      .get(`/${API_PREFIX}/admin/content/review-logs`)
      .expect(200)
      .expect([]);
  });
});
