import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('register')
  register(@Body() data: any) {
    return this.appService.register(data);
  }

  @Post('login')
  login(@Body() data: any) {
    return this.appService.login(data);
  }

  @Get('locations')
  getAllLocations() {
    return this.appService.getAllLocalizations();
  }

  @Get('user/:id/location')
getUserLocation(@Param('id') userId: string) {
  return this.appService.getUserLocation(userId);
}
}
