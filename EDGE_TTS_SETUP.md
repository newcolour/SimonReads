# Edge-TTS Setup for SimonReads

SimonReads now supports **Microsoft Edge TTS** for high-quality, natural-sounding text-to-speech with multiple distinct voices!

## What is Edge-TTS?

Edge-TTS provides access to Microsoft Edge's neural text-to-speech voices for **free**. These are the same high-quality voices used in Microsoft Edge's "Read Aloud" feature.

## Installation

### macOS (Recommended Method)

On macOS, use **pipx** to install edge-tts (this avoids Python environment conflicts):

```bash
# Install pipx if you don't have it
brew install pipx

# Install edge-tts
pipx install edge-tts

# Add pipx to your PATH
pipx ensurepath
```

Then **restart your terminal** or run:
```bash
source ~/.zshrc
```

### Linux / Other Systems

If you have pip available:

```bash
pip install edge-tts
```

Or with Python 3:

```bash
pip3 install edge-tts
```

### Verify Installation

Test that edge-tts is installed correctly:

```bash
edge-tts --list-voices
```

This should display a list of available voices.

## How It Works in SimonReads

### For AI Podcast Discussion Style

When you generate a **Discussion** style podcast with Alex and Jordan:

- **Alex** uses `en-US-GuyNeural` (male voice)
- **Jordan** uses `en-US-JennyNeural` (female voice)
- **Narrator** uses `en-US-AriaNeural` (neutral voice)

These are completely different neural voices, so Alex and Jordan will sound like two distinct people having a conversation!

### Automatic Detection

- **On Electron (Desktop)**: Edge-TTS is automatically used if installed
- **On Web/Mobile**: Falls back to browser TTS with playback rate differences

## Available Voices

Edge-TTS provides hundreds of voices in many languages. Some popular English voices:

### US English
- `en-US-AriaNeural` - Female, neutral
- `en-US-GuyNeural` - Male, professional
- `en-US-JennyNeural` - Female, friendly
- `en-US-DavisNeural` - Male, warm
- `en-US-AmberNeural` - Female, energetic

### British English
- `en-GB-SoniaNeural` - Female, professional
- `en-GB-RyanNeural` - Male, clear
- `en-GB-LibbyNeural` - Female, friendly

### Australian English
- `en-AU-NatashaNeural` - Female
- `en-AU-WilliamNeural` - Male

To see all available voices:
```bash
edge-tts --list-voices | grep "en-"
```

## Troubleshooting

### "edge-tts is not installed" Error

If you see this error:
1. Make sure Python is installed: `python --version` or `python3 --version`
2. Install edge-tts: `pip install edge-tts` or `pip3 install edge-tts`
3. Restart SimonReads

### Command Not Found

If `edge-tts` command is not found:
1. Check if it's in your PATH: `which edge-tts`
2. Try using the full path: `python -m edge_tts --list-voices`
3. On macOS, you might need to add Python's bin directory to PATH

### Slow Generation

Edge-TTS generates audio on-demand, which may take a few seconds per dialogue line. This is normal and provides the best quality.

## Benefits Over Other TTS Options

| Feature | Edge-TTS | Google TTS (Free) | OpenAI TTS |
|---------|----------|-------------------|------------|
| Cost | **Free** | Free | Paid |
| Voice Quality | **Excellent** | Good | Excellent |
| Multiple Voices | **Yes** | No | Yes |
| API Key Required | **No** | No | Yes |
| Offline Support | No | No | No |

## More Information

- Edge-TTS GitHub: https://github.com/rany2/edge-tts
- Microsoft Azure TTS Documentation: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support

Enjoy natural-sounding podcasts with distinct voices! 🎙️
