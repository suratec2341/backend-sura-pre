import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  RiskQueryDto,
  UpdateConsentDto,
  UpdateGoalDto,
  UpdateProfileDto,
  UpdateSettingsDto,
} from './dto/user.dto';
import { UserService } from './user.service';

interface AuthenticatedUser {
  userId: string;
}

@Controller('me')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // GET /api/v1/me
  @Get()
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.userService.getMe(user.userId);
  }

  // PUT /api/v1/me/profile
  @Put('profile')
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(user.userId, body);
  }

  // GET /api/v1/me/goals
  @Get('goals')
  getGoals(@CurrentUser() user: AuthenticatedUser) {
    return this.userService.getGoals(user.userId);
  }

  // PUT /api/v1/me/goals
  @Put('goals')
  updateGoals(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateGoalDto,
  ) {
    return this.userService.updateGoal(user.userId, body);
  }

  // GET /api/v1/me/settings
  @Get('settings')
  getSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.userService.getSettings(user.userId);
  }

  // PUT /api/v1/me/settings
  @Put('settings')
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateSettingsDto,
  ) {
    return this.userService.updateSettings(user.userId, body);
  }

  // GET /api/v1/me/consents
  @Get('consents')
  getConsents(@CurrentUser() user: AuthenticatedUser) {
    return this.userService.getConsents(user.userId);
  }

  // PUT /api/v1/me/consents/:type
  @Put('consents/:type')
  updateConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('type') type: string,
    @Body() body: UpdateConsentDto,
  ) {
    return this.userService.updateConsent(user.userId, type, body);
  }

  @Get('health')
  getHealth(@CurrentUser() user: AuthenticatedUser) {
    return this.userService.getHealth(user.userId);
  }

  @Put('health')
  updateHealth(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateProfileDto,
  ) {
    return this.userService.updateHealth(user.userId, body);
  }

  @Get('risks')
  getRisks(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: RiskQueryDto,
  ) {
    return this.userService.getRisks(user.userId, query.scope);
  }
}
