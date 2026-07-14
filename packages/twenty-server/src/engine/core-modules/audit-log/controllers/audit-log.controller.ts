import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';

import { PermissionFlagType } from 'twenty-shared/constants';

import { AuditLogService } from 'src/engine/core-modules/audit-log/services/audit-log.service';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthUserWorkspaceId } from 'src/engine/decorators/auth/auth-user-workspace-id.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { PermissionsService } from 'src/engine/metadata-modules/permissions/permissions.service';

const guards = [JwtAuthGuard, WorkspaceAuthGuard];

// Read-only audit trail. Write path is the event pipeline / auth hooks, never here.
@Controller('audit-log')
@UseGuards(...guards)
export class AuditLogController {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get('logs')
  async logs(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUserWorkspaceId() userWorkspaceId: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('objectName') objectName?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    // Gated by the AUDIT_LOGS permission flag — admins (canUpdateAllSettings)
    // pass automatically; any other role must be granted it in Settings > Roles.
    const hasPermission =
      await this.permissionsService.userHasWorkspaceSettingPermission({
        userWorkspaceId,
        workspaceId: workspace.id,
        setting: PermissionFlagType.AUDIT_LOGS,
      });

    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have permission to view audit logs.',
      );
    }

    const { rows, total } = await this.auditLogService.find({
      workspaceId: workspace.id,
      userId: userId || undefined,
      action: action || undefined,
      objectName: objectName || undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });

    return { total, rows };
  }
}
