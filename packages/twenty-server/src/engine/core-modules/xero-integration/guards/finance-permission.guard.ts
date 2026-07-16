import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { PermissionFlagType } from 'twenty-shared/constants';

import { PermissionsService } from 'src/engine/metadata-modules/permissions/permissions.service';
import { getRequest } from 'src/utils/extract-request';

// Gates the finance module behind the FINANCE permission flag. FINANCE is a
// bypass-free flag (see PermissionsService.NO_BASE_BYPASS_FLAGS), so only roles
// explicitly granted it pass — canUpdateAllSettings does NOT grant access.
@Injectable()
export class FinancePermissionGuard implements CanActivate {
  constructor(private readonly permissionsService: PermissionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = getRequest(context);
    const workspaceId = request.workspace?.id;
    const userWorkspaceId = request.userWorkspaceId;

    if (!workspaceId || !userWorkspaceId) {
      throw new ForbiddenException(
        'A user context is required to access finance.',
      );
    }

    const hasPermission =
      await this.permissionsService.userHasWorkspaceSettingPermission({
        setting: PermissionFlagType.FINANCE,
        workspaceId,
        userWorkspaceId,
      });

    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have permission to access the finance module.',
      );
    }

    return true;
  }
}
