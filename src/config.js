/**
 * WillowDuster Site Configuration
 *
 * All credentials and endpoints are loaded from environment variables (.env file).
 * Vite exposes any variable prefixed with VITE_ via import.meta.env.
 * Copy .env.example → .env and fill in your values.
 */

const env = import.meta.env

export const CONFIG = {
  // Owncast server URL (base, HLS, and WebSocket)
  owncastUrl:    env.VITE_OWNCAST_URL     || 'https://stream.willowduster.com',
  owncastHlsUrl: env.VITE_OWNCAST_HLS_URL || 'https://stream.willowduster.com/hls/stream.m3u8',
  owncastWsUrl:  env.VITE_OWNCAST_WS_URL  || 'wss://stream.willowduster.com/ws',

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
  siteTitle: 'WILLOWDUSTER',

}
