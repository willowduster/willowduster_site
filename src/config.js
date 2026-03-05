/**
 * WillowDuster Site Configuration
 *
 * All credentials and endpoints are loaded from environment variables (.env file).
 * Vite exposes any variable prefixed with VITE_ via import.meta.env.
 * Copy .env.example → .env and fill in your values.
 */

const env = import.meta.env

const isDev = import.meta.env.DEV

export const CONFIG = {
  // Owncast server URL (base, HLS, and WebSocket)
  // In dev mode, use relative URLs so Vite's proxy handles CORS
  owncastUrl:    env.VITE_OWNCAST_URL     || (isDev ? '/willowduster_site' : 'https://stream.willowduster.com'),
  owncastHlsUrl: env.VITE_OWNCAST_HLS_URL || (isDev ? '/willowduster_site/hls/stream.m3u8' : 'https://stream.willowduster.com/hls/stream.m3u8'),
  owncastWsUrl:  env.VITE_OWNCAST_WS_URL  || (isDev ? `ws://${location.host}/willowduster_site/ws` : 'wss://stream.willowduster.com/ws'),

  // YouTube
  youtubeLiveUrl: env.VITE_YOUTUBE_LIVE_URL || '',
  youtubeChatUrl: env.VITE_YOUTUBE_CHAT_URL || '',

  // Twitch
  twitchChannel: env.VITE_TWITCH_CHANNEL || 'willowduster',

  // ── OAuth Client IDs ────────────────────────────────────────────────
  oauth: {
    twitch: {
      clientId: env.VITE_OAUTH_TWITCH_CLIENT_ID || '',
      scopes:   'user:read:email',
    },
    google: {
      clientId: env.VITE_OAUTH_GOOGLE_CLIENT_ID || '',
      scopes:   'openid profile email',
    },
  },

  // Redirect URI (auto-detected if empty)
  oauthRedirectUri: env.VITE_OAUTH_REDIRECT_URI || '',

  // HLS player tuning
  hlsBackBufferLength: 30,
  hlsLowLatencyMode:   true,

  // Chat history limit
  chatMaxMessages: 200,

  // Site branding
  siteTitle: 'willowduster',

}
