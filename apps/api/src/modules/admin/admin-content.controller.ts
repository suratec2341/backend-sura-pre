import { Body, Controller, Get, Param, Post, Put, Query } from "@nestjs/common";
import { Role } from "@blansole/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { AdminContentService } from "./admin-content.service";
import {
  CreateProgramDto,
  CreateRecommendationRuleDto,
  CreateTagDto,
  CreateVideoDto,
  ProgramListQueryDto,
  UpdateProgramDto,
  UpdateVideoDto,
} from "./dto/admin-content.dto";

interface StaffUser {
  userId: string;
}

@Controller("admin/content")
@Roles(Role.ADMIN, Role.CONTENT_EDITOR)
export class AdminContentController {
  constructor(private readonly contentService: AdminContentService) {}

  @Get("programs")
  listPrograms(@Query() query: ProgramListQueryDto) {
    return this.contentService.listPrograms(query);
  }

  @Post("programs")
  createProgram(
    @CurrentUser() user: StaffUser,
    @Body() body: CreateProgramDto,
  ) {
    return this.contentService.createProgram(user.userId, body);
  }

  @Put("programs/:id")
  updateProgram(
    @CurrentUser() user: StaffUser,
    @Param("id") id: string,
    @Body() body: UpdateProgramDto,
  ) {
    return this.contentService.updateProgram(user.userId, id, body);
  }

  @Post("programs/:id/submit-review")
  submitReview(@CurrentUser() user: StaffUser, @Param("id") id: string) {
    return this.contentService.submitReview(user.userId, id);
  }

  @Post("programs/:id/publish")
  @Roles(Role.ADMIN)
  publish(@CurrentUser() user: StaffUser, @Param("id") id: string) {
    return this.contentService.publish(user.userId, id);
  }

  @Post("programs/:id/unpublish")
  @Roles(Role.ADMIN)
  unpublish(@CurrentUser() user: StaffUser, @Param("id") id: string) {
    return this.contentService.unpublish(user.userId, id);
  }

  @Get("videos")
  listVideos() {
    return this.contentService.listVideos();
  }

  @Post("videos")
  createVideo(@CurrentUser() user: StaffUser, @Body() body: CreateVideoDto) {
    return this.contentService.createVideo(user.userId, body);
  }

  @Put("videos/:id")
  updateVideo(
    @CurrentUser() user: StaffUser,
    @Param("id") id: string,
    @Body() body: UpdateVideoDto,
  ) {
    return this.contentService.updateVideo(user.userId, id, body);
  }

  @Post("videos/:id/recheck-link")
  recheckLink(@Param("id") id: string) {
    return this.contentService.recheckLink(id);
  }

  @Get("tags")
  listTags() {
    return this.contentService.listTags();
  }

  @Post("tags")
  createTag(@Body() body: CreateTagDto) {
    return this.contentService.createTag(body);
  }

  @Get("rules")
  listRules() {
    return this.contentService.listRules();
  }

  @Post("rules")
  createRule(@Body() body: CreateRecommendationRuleDto) {
    return this.contentService.createRule(body);
  }

  @Get("review-logs")
  reviewLogs() {
    return this.contentService.reviewLogs();
  }
}
