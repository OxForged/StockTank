import { OpenAPIRegistry, OpenApiGeneratorV31, zodToOpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  adminUserListResponseSchema,
  adminUserSchema,
  apiErrorSchema,
  authResponseSchema,
  currentUserSchema,
  healthResponseSchema,
  loginRequestSchema,
  paginationQuerySchema,
  readyResponseSchema,
  registerRequestSchema,
  updateUserRolesRequestSchema,
  versionResponseSchema,
} from '@stocktank/types';
import { SESSION_COOKIE } from '../lib/session.js';
import { userIdParamsSchema } from '../routes/admin.js';
import { registerGrowthPaths } from './growth-paths.js';

export interface OpenApiOptions {
  version: string;
}

const CSRF_HEADER_DESCRIPTION =
  'CSRF guard required on every state-changing request under /api. Any non-empty value (the official clients send "stocktank").';

export type OpenApiDocument = ReturnType<OpenApiGeneratorV31['generateDocument']>;

type ComponentMeta = { description?: string; example?: unknown };

/**
 * Names a shared contract schema as `#/components/schemas/<id>` and attaches documentation metadata.
 *
 * zod 4 copies `ZodType.prototype` methods onto each instance at construction, so the `.openapi()`
 * extension never reaches schemas that `@stocktank/types` built before it ran. Writing the same
 * metadata `.openapi(id)` would write straight into the library's registry tags the original
 * instance (nested references stay `$ref`s) and is idempotent across repeated builds.
 */
export function component<T extends z.ZodType>(id: string, schema: T, meta: ComponentMeta): T {
  zodToOpenAPIRegistry.add(schema, { _internal: { refId: id }, ...meta });
  return schema;
}

/** Builds the OpenAPI 3.1 description of every route the API serves. Pure: no I/O, no env. */
export function buildOpenApiDocument({ version }: OpenApiOptions): OpenApiDocument {
  const registry = new OpenAPIRegistry();

  registry.registerComponent('securitySchemes', 'apiKeyAuth', { type: 'http', scheme: 'bearer', description: 'Read-only StockTank API key (stk_…) created under Admin → System → API keys. GET requests only.' });
  registry.registerComponent('securitySchemes', 'cookieAuth', {
    type: 'apiKey',
    in: 'cookie',
    name: SESSION_COOKIE,
    description:
      'httpOnly session cookie set by /api/v1/auth/register and /api/v1/auth/login. ' +
      'The server stores only a SHA-256 hash of the token.',
  });
  const cookieAuth = [{ cookieAuth: [] }];

  const exampleUser = {
    id: 'cmfk1q2w30000v8l3d9e7a1b2',
    email: 'ada@example.com',
    displayName: 'Ada Lovelace',
    avatarUrl: null,
    roles: ['viewer'],
    permissions: [],
    createdAt: '2026-09-16T12:00:00.000Z',
  };

  const ApiError = component('ApiError', apiErrorSchema, {
    description: 'Envelope used by every non-2xx response.',
    example: {
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Invalid request body',
        requestId: '7f1c1b7e-2d1a-4a4d-9d2b-3b7b2a1f0c9e',
        details: { source: 'body', issues: [{ path: 'email', message: 'Invalid email address', code: 'invalid_format' }] },
      },
    },
  });
  component('CurrentUser', currentUserSchema, { example: exampleUser });
  const AuthResponse = component('AuthResponse', authResponseSchema, { example: { user: exampleUser } });
  const RegisterRequest = component('RegisterRequest', registerRequestSchema, {
    example: { email: 'ada@example.com', password: 'correct horse battery staple', displayName: 'Ada Lovelace' },
  });
  const LoginRequest = component('LoginRequest', loginRequestSchema, {
    example: { email: 'ada@example.com', password: 'correct horse battery staple' },
  });
  component('AdminUser', adminUserSchema, {
    example: {
      id: exampleUser.id,
      email: exampleUser.email,
      displayName: exampleUser.displayName,
      status: 'active',
      roles: ['viewer'],
      createdAt: exampleUser.createdAt,
      lastLoginAt: '2026-09-16T13:30:00.000Z',
    },
  });
  const AdminUserListResponse = component('AdminUserListResponse', adminUserListResponseSchema, {});
  const UpdateUserRolesRequest = component('UpdateUserRolesRequest', updateUserRolesRequestSchema, {
    example: { roles: ['viewer', 'editor'] },
  });
  const HealthResponse = component('HealthResponse', healthResponseSchema, { example: { status: 'ok' } });
  const ReadyResponse = component('ReadyResponse', readyResponseSchema, {
    example: { status: 'ready', checks: { postgres: { ok: true, latencyMs: 1.4 }, redis: { ok: true, latencyMs: 0.6 } } },
  });
  const VersionResponse = component('VersionResponse', versionResponseSchema, {
    example: { name: 'stocktank-api', version: '0.1.0', commit: '3f2a9c1', node: 'v24.0.0' },
  });

  const json = <T extends z.ZodType>(schema: T) => ({ 'application/json': { schema } });
  const errorResponse = (description: string) => ({ description, content: json(ApiError) });
  const csrfHeaders = z.object({
    'x-requested-with': z.string().min(1).meta({ description: CSRF_HEADER_DESCRIPTION, example: 'stocktank' }),
  });
  const commonErrors = {
    429: errorResponse('Rate limit exceeded (RATE_LIMITED)'),
    500: errorResponse('Unexpected server error (INTERNAL)'),
  };
  const authErrors = {
    401: errorResponse('No valid session cookie (UNAUTHENTICATED)'),
    403: errorResponse('Missing X-Requested-With / disallowed Origin, or insufficient permission (FORBIDDEN)'),
  };
  const validationError = { 400: errorResponse('Malformed or invalid input (BAD_REQUEST / VALIDATION_FAILED)') };

  // ---- System ----
  registry.registerPath({
    method: 'get',
    path: '/health',
    tags: ['System'],
    summary: 'Liveness probe',
    description: 'Always 200 while the process can serve requests. No dependencies are checked.',
    responses: { 200: { description: 'The API process is alive', content: json(HealthResponse) } },
  });
  registry.registerPath({
    method: 'get',
    path: '/ready',
    tags: ['System'],
    summary: 'Readiness probe',
    description: 'Checks Postgres (SELECT 1) and, when configured, Redis (PING), reporting per-check latency.',
    responses: {
      200: { description: 'All dependencies reachable', content: json(ReadyResponse) },
      503: { description: 'At least one dependency failed its check', content: json(ReadyResponse) },
    },
  });
  registry.registerPath({
    method: 'get',
    path: '/version',
    tags: ['System'],
    summary: 'Build information',
    responses: { 200: { description: 'Version, git commit (null when unknown) and Node runtime', content: json(VersionResponse) } },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/openapi.json',
    tags: ['System'],
    summary: 'This OpenAPI document',
    responses: { 200: { description: 'OpenAPI 3.1 document', content: { 'application/json': { schema: z.object({}).passthrough() } } } },
  });

  // ---- Auth ----
  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/register',
    tags: ['Auth'],
    summary: 'Create an account',
    description:
      'Creates a user with the `viewer` role, starts a session and sets the `st_session` cookie. Passwords are hashed with argon2id.',
    request: { headers: csrfHeaders, body: { required: true, content: json(RegisterRequest) } },
    responses: {
      201: { description: 'Account created; session cookie set', content: json(AuthResponse) },
      ...validationError,
      403: errorResponse('Missing X-Requested-With header or disallowed Origin (FORBIDDEN)'),
      409: errorResponse('An account with this email already exists (CONFLICT)'),
      ...commonErrors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/login',
    tags: ['Auth'],
    summary: 'Sign in',
    description:
      'Verifies credentials and starts a new session (any session cookie sent with the request is revoked). ' +
      'Failures are deliberately indistinguishable between unknown email and wrong password. ' +
      'Limited to 10 failed attempts per 15 minutes per IP and email.',
    request: { headers: csrfHeaders, body: { required: true, content: json(LoginRequest) } },
    responses: {
      200: { description: 'Signed in; session cookie set', content: json(AuthResponse) },
      ...validationError,
      401: errorResponse('Invalid email or password (UNAUTHENTICATED)'),
      403: errorResponse('Account suspended, missing X-Requested-With, or disallowed Origin (FORBIDDEN)'),
      ...commonErrors,
    },
  });
  registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/logout',
    tags: ['Auth'],
    summary: 'Sign out',
    description: 'Revokes the current session and clears the cookie.',
    security: cookieAuth,
    request: { headers: csrfHeaders },
    responses: { 204: { description: 'Session revoked; cookie cleared' }, ...authErrors, ...commonErrors },
  });
  registry.registerPath({
    method: 'get',
    path: '/api/v1/auth/me',
    tags: ['Auth'],
    summary: 'Current user',
    security: cookieAuth,
    responses: {
      200: { description: 'The signed-in user with resolved roles and permissions', content: json(AuthResponse) },
      401: authErrors[401],
      ...commonErrors,
    },
  });

  // ---- Admin ----
  registry.registerPath({
    method: 'get',
    path: '/api/v1/admin/users',
    tags: ['Admin'],
    summary: 'List users',
    description: 'Requires the `users.read` permission.',
    security: cookieAuth,
    request: { query: paginationQuerySchema },
    responses: {
      200: { description: 'A page of users, newest first', content: json(AdminUserListResponse) },
      ...validationError,
      ...authErrors,
      ...commonErrors,
    },
  });
  registry.registerPath({
    method: 'put',
    path: '/api/v1/admin/users/{id}/roles',
    tags: ['Admin'],
    summary: 'Replace a user’s roles',
    description:
      'Requires `users.manage`. Granting or revoking `super_admin` or `admin` additionally requires `roles.manage`. ' +
      'The last `super_admin` can never be removed. Every change is written to the audit log.',
    security: cookieAuth,
    request: {
      params: userIdParamsSchema,
      headers: csrfHeaders,
      body: { required: true, content: json(UpdateUserRolesRequest) },
    },
    responses: {
      204: { description: 'Roles replaced' },
      ...validationError,
      ...authErrors,
      404: errorResponse('User not found (NOT_FOUND)'),
      409: errorResponse('Would remove the last super_admin (CONFLICT)'),
      ...commonErrors,
    },
  });

  registerGrowthPaths(registry, { json, errorResponse, csrfHeaders, cookieAuth, commonErrors, authErrors, validationError });

  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'StockTank API',
      version,
      description:
        'Identity, RBAC, public content, advertising, marketing and system endpoints for StockTank. Sessions are cookie-based; state-changing requests must send `X-Requested-With`. ' +
        'Financial content served by this platform is informational only and never investment advice.',
    },
    servers: [{ url: '/', description: 'Same origin (dev proxy or deployed API host)' }],
    tags: [
      { name: 'System', description: 'Health, readiness and version' },
      { name: 'Auth', description: 'Registration, login and session' },
      { name: 'Admin', description: 'User administration (permission-gated)' },
      { name: 'Content', description: 'Public, published content for the web, mobile and TV apps' },
      { name: 'Advertising', description: 'Media kit, ad serving and impression/click tracking' },
      { name: 'Marketing', description: 'Advertising inquiries and newsletter double opt-in' },
      { name: 'Admin: Advertising', description: 'Advertisers, rate card, campaigns, creatives, review queue and reports' },
      { name: 'Admin: Growth', description: 'Sales leads, newsletter audience and feature flags' },
      { name: 'Admin: Content', description: 'Editorial CMS: shows, episodes, projects, companies, articles and the live schedule' },
      { name: 'Me', description: 'The signed-in viewer’s follows, bookmarks and library' },
    ],
  });
}
