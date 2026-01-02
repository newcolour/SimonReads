# Settings Export/Import Feature

## Overview
Export and import all your SimonReads settings including API keys, themes, preferences, and personality configurations. This makes it easy to transfer your configuration between devices (desktop to Android, etc.).

## How to Use

### Exporting Settings

1. Open **Settings** in the app
2. Go to the **General** tab
3. Scroll down to **App Settings Import / Export**
4. Click **Export Settings**
5. A JSON file will be downloaded with name like `simonreads_settings_2026-01-02.json`

The exported file contains:
- All API keys (Gemini, OpenAI, Claude, Ollama)
- AI provider preferences and model selections
- Theme and appearance settings
- Reading personality configuration
- Auto-refresh and retention settings
- Email settings (if configured)
- All other app preferences

### Importing Settings

1. Open **Settings** in the app
2. Go to the **General** tab  
3. Scroll down to **App Settings Import / Export**
4. Click **Import Settings**
5. Select your previously exported `.json` file
6. Review the confirmation message showing the export date
7. Confirm the import
8. Click **Save** in the settings modal to apply the imported settings

## Use Cases

### Transfer Desktop Settings to Android

1. **On Desktop**: Export your settings
2. Transfer the JSON file to your Android device (via email, cloud storage, or ADB)
3. **On Android**: Import the settings file
4. All your API keys and preferences are now configured!

### Backup Your Configuration

- Export your settings periodically as a backup
- Store the JSON file securely (it contains API keys!)
- Restore anytime by importing

### Share Configuration with Team

- Export settings with API keys configured
- Team members can import to get the same AI setup
- **Security Note**: Be careful sharing files with API keys!

## Implementation Details

The exported JSON structure:
```json
{
  "version": "3.0.11",
  "exportDate": "2026-01-02T16:00:00.000Z",
  "settings": {
    "theme": "sorcerer",
    "geminiApiKey": "...",
    "openaiApiKey": "...",
    "readingPersonality": "conversational-curator",
    // ... all other settings
  }
}
```

## Security Considerations

⚠️ **Important**: The exported JSON file contains your API keys in plaintext!

- **Do not** commit settings files to public git repositories
- **Do not** share settings exports publicly
- Store backups securely
- Consider encrypting the file if sharing via insecure channels
- Rotate API keys if a settings file is compromised

## Troubleshooting

**Import fails with "Invalid settings file"**
- Ensure the file is a valid SimonReads settings export
- Check that the JSON is not corrupted

**Settings don't apply after import**
- Make sure you clicked "Save" in the settings modal after importing
- Try restarting the app if settings don't seem to take effect

**File picker doesn't open on Android**
- Ensure the app has file access permissions
- Try from a different location (Downloads vs internal storage)
