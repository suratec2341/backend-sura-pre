import { Controller, Get, Post, Put, Param, Body } from '@nestjs/common';

// ⭐ §7 Admin Panel — ต้อง auth role = admin/content_editor
@Controller('admin/content')
export class AdminContentController {
  // --- Programs ---
  @Get('programs')
  listPrograms() { return { message: 'List programs — TODO' }; }

  @Post('programs')
  createProgram(@Body() body: any) { return { message: 'Create program — TODO' }; }

  @Put('programs/:id')
  updateProgram(@Param('id') id: string, @Body() body: any) { return { message: `Update program ${id} — TODO` }; }

  @Post('programs/:id/submit-review')
  submitReview(@Param('id') id: string) { return { message: `Submit for review ${id} — TODO` }; }

  @Post('programs/:id/publish')
  publish(@Param('id') id: string) { return { message: `Publish ${id} — TODO` }; }

  @Post('programs/:id/unpublish')
  unpublish(@Param('id') id: string) { return { message: `Unpublish ${id} — TODO` }; }

  // --- Videos ---
  @Get('videos')
  listVideos() { return { message: 'List videos — TODO' }; }

  @Post('videos')
  createVideo(@Body() body: any) { return { message: 'Create video (youtube_url + ai_description) — TODO' }; }

  @Put('videos/:id')
  updateVideo(@Param('id') id: string, @Body() body: any) { return { message: `Update video ${id} — TODO` }; }

  @Post('videos/:id/recheck-link')
  recheckLink(@Param('id') id: string) { return { message: `Recheck YouTube link ${id} — TODO` }; }

  // --- Tags & Rules ---
  @Get('tags')
  listTags() { return { message: 'List tags — TODO' }; }

  @Post('rules')
  createRule(@Body() body: any) { return { message: 'Create recommendation rule — TODO' }; }

  @Get('review-logs')
  reviewLogs() { return { message: 'Review logs — TODO' }; }
}
