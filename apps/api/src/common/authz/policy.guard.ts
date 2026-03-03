import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsService } from '../../modules/permissions/permissions.service';
import { REQUIRES_POLICY_KEY, RequiresPolicyMetadata } from './requires-policy.decorator';
import { JwtAccessService } from '../auth/jwt-access.service';

@Injectable()
export class PolicyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
    private readonly jwtAccessService: JwtAccessService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      method?: string;
      route?: { path?: string };
      params?: Record<string, string>;
      body?: Record<string, string>;
      headers?: Record<string, string>;
      query?: Record<string, string>;
      path?: string;
    }>();

    const method = (request.method ?? 'GET').toUpperCase();
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return true;
    }

    const routePath = request.route?.path ?? request.path ?? '';
    if (routePath.startsWith('/permissions') || routePath.startsWith('permissions')) {
      return true;
    }

    const metadata = this.reflector.getAllAndOverride<RequiresPolicyMetadata>(REQUIRES_POLICY_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!metadata) {
      throw new InternalServerErrorException(
        'Mutating endpoint missing @RequiresPolicy metadata (fail-closed)'
      );
    }

    const actorWid = this.resolveActorWid(request, metadata);
    if (!actorWid) {
      throw new ForbiddenException('Missing actor_wid for policy evaluation');
    }

    const decision = await this.permissionsService.authorize({
      actor_wid: actorWid,
      action: metadata.action,
      context: {
        target_wid: this.resolveField(request, metadata.fields?.target, ['target_wid']),
        to_wid: this.resolveField(request, metadata.fields?.to, ['to_wid']),
        space_id: this.resolveField(request, metadata.fields?.space, ['space_id']),
        request_id: this.resolveField(request, metadata.fields?.request, ['request_id'])
      }
    });

    if (!decision.allowed) {
      throw new ForbiddenException(decision.deny_reason);
    }

    return true;
  }

  private resolveActorWid(
    request: {
      headers?: Record<string, string>;
      body?: Record<string, string>;
      params?: Record<string, string>;
      query?: Record<string, string>;
    },
    metadata: RequiresPolicyMetadata
  ): string | undefined {
    const authorizationHeader = request.headers?.authorization;
    if (authorizationHeader) {
      const token = this.jwtAccessService.extractBearerToken(authorizationHeader);
      const verified = this.jwtAccessService.verifyAccessToken(token);
      if (!verified.sub) {
        throw new UnauthorizedException('Access token missing subject');
      }
      return verified.sub;
    }

    return this.resolveField(request, metadata.fields?.actor, ['x-wid', 'wid', 'from_wid', 'sender_wid']);
  }

  private resolveField(
    request: {
      headers?: Record<string, string>;
      body?: Record<string, string>;
      params?: Record<string, string>;
      query?: Record<string, string>;
    },
    explicitField: string | undefined,
    fallbackFields: string[]
  ): string | undefined {
    const search = explicitField ? [explicitField] : fallbackFields;

    for (const key of search) {
      const fromHeaders = request.headers?.[key];
      if (fromHeaders) return fromHeaders;
      const fromBody = request.body?.[key];
      if (fromBody) return fromBody;
      const fromParams = request.params?.[key];
      if (fromParams) return fromParams;
      const fromQuery = request.query?.[key];
      if (fromQuery) return fromQuery;
    }

    return undefined;
  }
}
