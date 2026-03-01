/**
 * WillowDuster Site Configuration
 * Edit these values to point to your actual stream/channel endpoints.
 */
export const CONFIG = {
  // Owncast server URL (base, HLS, and WebSocket)
  owncastUrl:    'https://stream.willowduster.com',
  owncastHlsUrl: 'https://stream.willowduster.com/hls/stream.m3u8',
  owncastWsUrl:  'wss://stream.willowduster.com/ws',

  // YouTube — replace UCxxxxxxxx with your channel ID and YOUR_VIDEO_ID for live chat
  youtubeLiveUrl: 'https://www.youtube.com/embed/live_stream?channel=UCxxxxxxxx',
  youtubeChatUrl: 'https://www.youtube.com/live_chat?v=YOUR_VIDEO_ID',

  // Twitch — replace with your Twitch channel name
  twitchChannel: 'willowduster',

  // Site branding
  siteTitle:    'WILLOWDUSTER',
  siteSubtitle: 'LIVE DJ SET // CYBERPUNK FREQUENCIES',
}
