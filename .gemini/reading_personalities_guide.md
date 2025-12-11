# Reading Personalities - Quick Start Guide

## For Users

### How to Change Your Personality

1. Click the **Settings** button (⚙️) in the top-right corner
2. Select the **Personality** tab
3. Click on any personality card to activate it:
   - 🎯 **Focused Minimalist** - Clean, distraction-free reading
   - 💬 **Conversational Curator** - Friendly, engaging tone (Default)
   - 🔬 **Deep Diver** - Comprehensive analysis
   - 📋 **Daily Brief** - Quick scan mode
   - 🎲 **Serendipity Explorer** - Random discovery mode

4. Click **Save Changes**

### How to Enable Auto-Switching

1. In the Personality tab, check **Enable Automatic Switching**
2. Choose your trigger:
   - **Time of Day** - Switch based on time (recommended)
   - **Device Type** - Different personality on mobile vs desktop
   - **Manual Only** - You control when to switch

3. If you chose Time of Day:
   - Click the **Time Schedule** tab
   - Enable the schedule
   - Customize which personality for Morning/Afternoon/Evening/Night

4. Click **Save Changes**

## For Developers

### Adding a New Personality

Edit `src/personalityConfig.ts`:

```typescript
export const personalityConfigs: Record<ReadingPersonality, PersonalityConfig> = {
    // ... existing personalities
    'your-new-personality': {
        id: 'your-new-personality',
        name: 'Your Personality Name',
        icon: '🌟',
        description: 'What makes this personality unique',
        summaryTone: 'neutral',       // or 'formal', 'witty', 'critical', 'eli5'
        summaryLength: 'medium',      // or 'short', 'long'
        summaryDepth: 'detailed',     // or 'brief', 'comprehensive'
        contentDensity: 'comfortable', // or 'compact', 'spacious'
        emphasizeUnread: false,
        sortPreference: 'recent',      // or 'unread-first', 'random', 'oldest-first'
        autoCollapseRead: false,
        showOnlyUnread: false,
        themeHint: 'dark',            // suggested theme
        accentColor: '#3b82f6'        // personality color
    }
};
```

Then add to the type definition in `src/types.ts`:

```typescript
export type ReadingPersonality = 
    | 'focused-minimalist'
    | 'conversational-curator' 
    | 'deep-diver'
    | 'daily-brief'
    | 'serendipity-explorer'
    | 'your-new-personality'; // Add here
```

### Using Personality Config in Components

```typescript
import { usePersonalityConfig } from '../hooks/usePersonality';

function MyComponent() {
    const personalityConfig = usePersonalityConfig(settings.readingPersonality);
    
    // Access personality settings
    const { summaryTone, contentDensity, sortPreference } = personalityConfig;
    
    // Apply to your component logic
    const className = `my-component ${contentDensity}`;
    
    return <div className={className}>...</div>;
}
```

### Applying Content Density

In your CSS:

```css
.article-list.compact {
    gap: 8px;
    padding: 12px;
}

.article-list.comfortable {
    gap: 12px;
    padding: 16px;
}

.article-list.spacious {
    gap: 20px;
    padding: 24px;
}
```

### Implementing Sort Preference

```typescript
const sortedArticles = useMemo(() => {
    const config = personalityConfigs[settings.readingPersonality];
    let sorted = [...articles];
    
    switch (config.sortPreference) {
        case 'recent':
            sorted.sort((a, b) => b.pubDate - a.pubDate);
            break;
        case 'oldest-first':
            sorted.sort((a, b) => a.pubDate - b.pubDate);
            break;
        case 'unread-first':
            sorted.sort((a, b) => (a.isRead ? 1 : 0) - (b.isRead ? 1 : 0));
            break;
        case 'random':
            sorted.sort(() => Math.random() - 0.5);
            break;
    }
    
    if (config.showOnlyUnread) {
        sorted = sorted.filter(a => !a.isRead);
    }
    
    return sorted;
}, [articles, settings.readingPersonality]);
```

## FAQ

**Q: Can I create my own custom personality?**
A: Not yet in the UI, but developers can add new personalities by editing the config file.

**Q: Does switching personalities affect my saved articles?**
A: No, your articles, read status, and saved items are always preserved.

**Q: How often does auto-switching check the time?**
A: Every minute when time-based auto-switching is enabled.

**Q: Can I have different personalities on different devices?**
A: The device-based switching framework is ready but not yet fully implemented.

**Q: Will this use more AI API quota?**
A: No, personality only changes how summaries are generated, not how many are created. You still control when to generate summaries.

## Troubleshooting

**Personality not changing:**
- Make sure you clicked "Save Changes"
- Check browser console for errors
- Try refreshing the app

**Auto-switch not working:**
- Verify "Enable Automatic Switching" is checked
- Ensure "Time Schedule" is enabled (for time-based)
- Check that a personality is assigned to the current time period

**UI looks the same after switch:**
- Visual styling implementation is in progress
- Currently affects AI summaries and article filtering
- Check the personality icon in settings to confirm it changed

## Related Files

- **Personality Logic:** `src/personalityConfig.ts`
- **UI Component:** `src/components/PersonalitySelector.tsx`
- **Auto-Switch Hook:** `src/hooks/usePersonality.ts`
- **Type Definitions:** `src/types.ts`
- **Settings Storage:** `src/storage.ts`
