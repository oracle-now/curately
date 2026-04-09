import { FastifyInstance } from 'fastify';
import { authenticate } from '../plugins/authenticate';

const META_AUTH_URL = 'https://www.facebook.com/dialog/oauth';
const META_TOKEN_URL = 'https://graph.facebook.com/oauth/access_token';
const IG_API_VERSION = process.env.META_GRAPH_API_VERSION ?? 'v19.0';
const IG_API_BASE = `https://graph.facebook.com/${IG_API_VERSION}`;

export async function instagramRoutes(server: FastifyInstance) {
  // GET /api/v1/instagram/connect
  // Redirects user to Meta OAuth consent screen
  server.get('/instagram/connect', { preHandler: authenticate }, async (request, reply) => {
    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID ?? '',
      redirect_uri: process.env.META_REDIRECT_URI ?? '',
      scope: 'instagram_basic,instagram_content_publish,pages_show_list',
      response_type: 'code',
      state: request.user.id, // user ID as CSRF state token
    });
    return reply.redirect(`${META_AUTH_URL}?${params.toString()}`);
  });

  // GET /api/v1/instagram/callback
  // Meta redirects here with ?code=...&state=<userId> after user approves
  server.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    '/instagram/callback',
    async (request, reply) => {
      const { code, state, error } = request.query;
      const webUrl = process.env.WEB_URL ?? 'http://localhost:3000';

      if (error || !code || !state) {
        return reply.redirect(`${webUrl}/app/settings?ig_error=true`);
      }

      // CSRF fix: verify state maps to a real user before doing anything
      const stateUser = await server.prisma.user.findUnique({
        where: { id: state },
        select: { id: true },
      });
      if (!stateUser) {
        server.log.warn(`OAuth callback: state param '${state}' does not match any user`);
        return reply.redirect(`${webUrl}/app/settings?ig_error=true`);
      }

      // Exchange code for short-lived token
      const tokenRes = await fetch(
        `${META_TOKEN_URL}?${new URLSearchParams({
          client_id: process.env.META_APP_ID ?? '',
          client_secret: process.env.META_APP_SECRET ?? '',
          redirect_uri: process.env.META_REDIRECT_URI ?? '',
          code,
        })}`
      );
      const tokenData = (await tokenRes.json()) as {
        access_token?: string;
        error?: { message: string };
      };

      if (!tokenData.access_token) {
        server.log.error('Meta token exchange failed:', tokenData.error);
        return reply.redirect(`${webUrl}/app/settings?ig_error=true`);
      }

      // Exchange for long-lived token (~60 day expiry)
      const longTokenRes = await fetch(
        `${IG_API_BASE}/oauth/access_token?${new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: process.env.META_APP_ID ?? '',
          client_secret: process.env.META_APP_SECRET ?? '',
          fb_exchange_token: tokenData.access_token,
        })}`
      );
      const longTokenData = (await longTokenRes.json()) as {
        access_token?: string;
        expires_in?: number;
        error?: { message: string };
      };

      if (!longTokenData.access_token) {
        server.log.error('Long-lived token exchange failed:', longTokenData.error);
        return reply.redirect(`${webUrl}/app/settings?ig_error=true`);
      }

      // Fetch IG user ID
      const meRes = await fetch(`${IG_API_BASE}/me?fields=id,username`, {
        headers: { Authorization: `Bearer ${longTokenData.access_token}` },
      });
      const meData = (await meRes.json()) as { id?: string; username?: string };

      if (!meData.id) {
        server.log.error('Failed to fetch IG user ID from /me endpoint');
        return reply.redirect(`${webUrl}/app/settings?ig_error=true`);
      }

      const expiresAt = new Date(
        Date.now() + (longTokenData.expires_in ?? 5183944) * 1000
      );

      // Upsert IG account — userId sourced from verified state param
      await server.prisma.instagramAccount.upsert({
        where: { igUserId: meData.id },
        update: {
          accessToken: longTokenData.access_token,
          tokenExpiresAt: expiresAt,
          userId: stateUser.id,
        },
        create: {
          userId: stateUser.id,
          igUserId: meData.id,
          accessToken: longTokenData.access_token,
          tokenExpiresAt: expiresAt,
        },
      });

      return reply.redirect(`${webUrl}/app/settings?ig_connected=true`);
    }
  );

  // GET /api/v1/instagram/account
  server.get('/instagram/account', { preHandler: authenticate }, async (request, reply) => {
    const account = await server.prisma.instagramAccount.findFirst({
      where: { userId: request.user.id },
      select: { igUserId: true, tokenExpiresAt: true },
    });
    return reply.send({
      connected: !!account,
      ig_user_id: account?.igUserId ?? null,
      token_expires_at: account?.tokenExpiresAt ?? null,
    });
  });
}
