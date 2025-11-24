# SimonReads 2.0 - Podcast Support

## 🎉 Major Feature: Audio & Video Podcast Support

Version 2.0 introduces comprehensive podcast support, transforming SimonReads from an RSS reader into a complete media consumption platform.

---

## What's New

### 📻 Podcast Player
- **Audio Podcasts**: Full-featured audio player with controls
- **Video Podcasts**: Embedded video player with the same controls
- **Playback Controls**:
  - Play/Pause
  - Seek bar with time display
  - Skip forward/backward 15 seconds
  - Playback speed control (0.5x to 2x)
  - Volume control with mute
  - Current time / Total duration display

### 🎨 Visual Indicators
- **Media Type Badges**: 
  - 🎧 Green badge for audio podcasts
  - 📹 Red badge for video podcasts
- **Episode Duration**: Displayed in article list
- **Episode Artwork**: Shows podcast cover art when available

### 🔍 Automatic Detection
- Automatically detects podcast feeds with audio/video enclosures
- Parses iTunes podcast metadata (duration, artwork)
- Supports standard RSS podcast formats
- Works with both audio (MP3, AAC, etc.) and video (MP4, etc.) formats

---

## How It Works

### Feed Parsing
The RSS parser now extracts:
1. **Enclosure tags** - Audio/video file URLs
2. **iTunes duration** - Episode length
3. **iTunes image** - Episode artwork
4. **MIME types** - Automatically determines if content is audio or video

### Article Types
Articles are now categorized as:
- **Article** - Regular text content
- **Audio** - Podcast episode with audio file
- **Video** - Podcast episode with video file

### Player Integration
When viewing a podcast episode:
1. The podcast player appears at the top of the reader view
2. Shows episode artwork (or placeholder for audio)
3. Displays full video player for video content
4. All playback controls are immediately accessible

---

## User Interface

### Article List
```
🎧 [Episode Title]
   By Creator • 1:23:45 • 2 hours ago
   Episode description preview...
```

### Podcast Player (Audio)
```
┌─────────────────────────────┐
│   [Episode Artwork]         │
│                             │
│   Episode Title             │
│   12:34 / 1:23:45          │
│                             │
│   [Progress Bar]            │
│                             │
│   ⏮ -15  ▶️  +15 ⏭  1.0x  🔊│
└─────────────────────────────┘
```

### Podcast Player (Video)
```
┌─────────────────────────────┐
│                             │
│   [Video Player]            │
│                             │
├─────────────────────────────┤
│   Episode Title             │
│   12:34 / 1:23:45          │
│   [Progress Bar]            │
│   ⏮ -15  ▶️  +15 ⏭  1.0x  🔊│
└─────────────────────────────┘
```

---

## Technical Implementation

### New Types
```typescript
export interface MediaEnclosure {
    url: string;
    type: string; // MIME type
    length?: number; // File size in bytes
}

export type MediaType = 'article' | 'audio' | 'video';

// Extended Article interface
interface Article {
    // ... existing fields
    mediaType?: MediaType;
    enclosure?: MediaEnclosure;
    duration?: string;
    image?: string;
}
```

### New Components
1. **PodcastPlayer.tsx** - Full-featured media player
2. **PodcastPlayer.css** - Player styling

### Updated Components
1. **ArticleView.tsx** - Integrates podcast player
2. **ArticleList.tsx** - Shows media badges and duration
3. **rssService.ts** - Parses podcast metadata

---

## Supported Podcast Formats

### Audio Formats
- MP3 (audio/mpeg)
- AAC (audio/aac, audio/x-m4a)
- OGG (audio/ogg)
- WAV (audio/wav)

### Video Formats
- MP4 (video/mp4)
- WebM (video/webm)
- OGG (video/ogg)

### Podcast Standards
- RSS 2.0 with enclosures
- iTunes podcast namespace
- Standard podcast RSS feeds

---

## Popular Podcast Feeds to Try

### News
- NPR News Now: `https://feeds.npr.org/500005/podcast.xml`
- BBC Global News: `https://podcasts.files.bbci.co.uk/p02nq0gn.rss`
- The Daily (NYT): `https://feeds.simplecast.com/54nAGcIl`

### Technology
- Reply All: `https://feeds.gimletmedia.com/hearreplyall`
- Syntax: `https://feed.syntax.fm/rss`
- The Vergecast: `https://feeds.megaphone.fm/vergecast`

### Education
- TED Talks Daily: `https://feeds.feedburner.com/TEDTalks_audio`
- Stuff You Should Know: `https://feeds.megaphone.fm/stuffyoushouldknow`
- Radiolab: `https://feeds.wnyc.org/radiolab`

---

## Keyboard Shortcuts (Player)

| Key | Action |
|-----|--------|
| Space | Play/Pause |
| ← | Rewind 15s |
| → | Forward 15s |
| ↑ | Volume up |
| ↓ | Volume down |
| M | Mute/Unmute |

*(Note: Keyboard shortcuts require player focus)*

---

## Features Comparison

### Version 1.0 (RSS Reader)
- ✅ RSS feed management
- ✅ Article reading
- ✅ AI summaries
- ✅ PDF export
- ✅ Daily newsreel
- ❌ Podcast support

### Version 2.0 (Media Reader)
- ✅ RSS feed management
- ✅ Article reading
- ✅ AI summaries
- ✅ PDF export
- ✅ Daily newsreel
- ✅ **Audio podcast playback**
- ✅ **Video podcast playback**
- ✅ **Media type indicators**
- ✅ **Episode duration display**
- ✅ **Playback speed control**

---

## Migration from 1.0

### Automatic Migration
- All existing feeds continue to work
- Articles without media remain unchanged
- Podcast episodes are automatically detected
- No user action required

### Data Compatibility
- Existing article data is fully compatible
- New fields (mediaType, enclosure, etc.) are optional
- Old articles display as before
- New podcast episodes show player automatically

---

## Performance Considerations

### Media Loading
- Audio/video files are streamed, not downloaded
- Player loads media on-demand
- Seeking is instant (no buffering for most formats)
- Minimal memory footprint

### Storage
- No media files are stored locally
- Only metadata (duration, artwork URL) is cached
- Same storage requirements as version 1.0

---

## Future Enhancements

### Planned for 2.1
- [ ] Download episodes for offline playback
- [ ] Playback queue management
- [ ] Sleep timer
- [ ] Chapter markers support
- [ ] Playlist creation
- [ ] Playback history
- [ ] Resume playback from last position

### Planned for 2.2
- [ ] Background audio playback
- [ ] Media keys support (keyboard media buttons)
- [ ] AirPlay/Chromecast support
- [ ] Podcast search and discovery
- [ ] Subscription recommendations
- [ ] Episode transcripts (AI-generated)

---

## Known Limitations

1. **No Offline Playback**: Episodes must be streamed (planned for 2.1)
2. **No Background Audio**: Player pauses when window is closed
3. **No Resume**: Playback doesn't resume from last position
4. **Browser Compatibility**: Some video formats may not work in all browsers

---

## Troubleshooting

### Podcast Not Playing
1. Check internet connection
2. Verify feed URL is accessible
3. Try refreshing the feed
4. Check browser console for errors

### No Media Badge Showing
1. Feed may not have enclosure tags
2. Try refreshing the feed
3. Check if feed is a valid podcast feed

### Video Not Displaying
1. Check video format compatibility
2. Try different browser
3. Verify video URL is accessible
4. Check browser console for codec errors

---

## Branch Information

- **Main Branch**: Version 1.0.19 (stable RSS reader)
- **2.0 Branch**: Version 2.0.0 (with podcast support)

To switch between versions:
```bash
# Use version 1.0 (RSS reader only)
git checkout main

# Use version 2.0 (with podcasts)
git checkout 2.0
```

---

## Credits

**Version 2.0 Features**:
- Podcast player component
- Media type detection
- iTunes metadata parsing
- UI enhancements for media content

**Built with**:
- React 18
- TypeScript
- Lucide React (icons)
- HTML5 Audio/Video APIs

---

## Feedback

We'd love to hear your thoughts on the podcast feature! Please report any issues or suggestions.

**Enjoy your podcasts! 🎧📹**
