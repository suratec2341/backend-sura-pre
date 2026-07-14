import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';

@Controller('devices')
export class DeviceController {
  @Get()
  list() { return { message: 'List devices — TODO' }; }

  @Post('pair')
  pair(@Body() body: any) { return { message: 'Pair device — TODO' }; }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) { return { message: `Update device ${id} — TODO` }; }

  @Delete(':id')
  remove(@Param('id') id: string) { return { message: `Remove device ${id} — TODO` }; }

  @Post(':id/sync')
  sync(@Param('id') id: string) { return { message: `Sync device ${id} — TODO` }; }

  @Get(':id/status')
  status(@Param('id') id: string) { return { message: `Device ${id} status — TODO` }; }

  @Post(':id/battery')
  battery(@Param('id') id: string, @Body() body: any) { return { message: `Battery log ${id} — TODO` }; }

  @Post(':id/calibrate')
  calibrate(@Param('id') id: string, @Body() body: any) { return { message: `Calibrate ${id} — TODO` }; }
}
