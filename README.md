# LinkedIn Comment Assistant

[![Version](https://img.shields.io/badge/version-1.0.1-blue.svg)](manifest.json)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

> AI-powered Chrome extension for generating contextual LinkedIn comments and message replies

## Features

### Comment Assistance
- 🤖 **Smart Comment Suggestions** – AI-generated comments tailored to post context
- 🎯 **6 Comment Types**:
  - **Expert Take** – Share knowledge that positions you as an authority
  - **Relatable Story** – Connect with personal experiences
  - **Thought Provoker** – Spark deeper discussions with questions
  - **Pro Tip** – Share actionable advice and shortcuts
  - **Bridge Builder** – Connect posts to broader trends
  - **Real Talk** – Genuine reactions with personality

### Messaging/DM Support
- 💬 **Message Reply Assistance** – AI-powered responses for LinkedIn DMs
- 💼 **6 Message Tones**:
  - **Professional** – Polished, industry-appropriate responses
  - **Casual** – Friendly and approachable
  - **Follow Up** – Keep conversations moving forward
  - **Outreach** – Warm but professional cold approaches
  - **Collaborate** – Open to working together
  - **Gratitude** – Thankful and appreciative responses

### Customization
- 🎨 **Dark Theme Sidepanel** – Modern, non-intrusive UI
- ✏️ **Custom Prompts Editor** – Tailor AI prompts to your style
- 🧠 **Profile Personalization** – Comments adapt to your background
- 🤖 **Model Selection** – Choose from multiple free AI models
- 🆓 **Free AI Models** – Powered by OpenRouter's free tier

### Privacy & Security
- 🔒 **Local Storage Only** – API key stays in your browser
- 🚫 **No Tracking** – Zero analytics or data collection
- 🔐 **Direct API Calls** – Browser → OpenRouter, no middleman
- 📝 **No History Stored** – Suggestions aren't saved anywhere

---

## Installation

### From Chrome Web Store
*(Coming soon – currently in review)*

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle top-right)
4. Click **Load unpacked**
5. Select the `linkedin-comment-assistant` folder
6. The extension icon will appear in your toolbar

---

## Setup

1. Click the extension icon → **Open Sidepanel**
2. Get a free API key from [OpenRouter](https://openrouter.ai/keys)
3. Enter your API key in the settings (starts with `sk-or-v1-`)
4. Select an AI model (default: `meta-llama/llama-3.1-8b-instruct`)
5. Add a brief profile description (optional, for personalization)
6. Click **Save Settings**

---

## Usage

### For LinkedIn Posts

1. Browse LinkedIn and click any **Add a comment...** box
2. Click the **💡 Suggest** button that appears
3. Select a comment type (Expert Take, Pro Tip, etc.)
4. AI generates 2–3 contextual suggestions
5. Click **Use This** to insert, or **Copy** to clipboard

### For LinkedIn Messages

1. Open any LinkedIn conversation (`/messaging`)
2. Click in the message input field
3. The **💡 Suggest** button appears
4. Select a tone (Professional, Casual, etc.)
5. AI generates appropriate reply suggestions

### Sidepanel Features

- **Settings Tab** – Configure API key, model, and profile
- **Custom Prompts Tab** – Edit system prompts for comments/messages
- **Test Connection** – Verify your API key works
- **Refresh Models** – Load latest available models from OpenRouter

---

## Configuration

### Settings

| Option | Description | Required |
|--------|-------------|----------|
| OpenRouter API Key | Your API key from openrouter.ai | ✅ Yes |
| AI Model | Select from available free models | ✅ Yes |
| Profile Description | 2–3 sentences about yourself | ❌ No |

### Default Model

**`meta-llama/llama-3.1-8b-instruct`**
- Free on OpenRouter
- Fast response times
- Good quality for professional writing

### Alternative Free Models

- `google/gemma-2-9b-it` – Google's lightweight model
- `mistralai/mistral-7b-instruct` – Balanced performance
- `qwen/qwen-2.5-7b-instruct` – Strong instruction following

---

## Development

### Project Structure

```
linkedin-comment-assistant/
├── manifest.json          # Extension manifest (v3)
├── background.js          # Service worker for API calls
├── content.js             # LinkedIn DOM integration
├── sidepanel/             # Sidepanel UI
│   ├── sidepanel.html
│   ├── sidepanel.css
│   └── sidepanel.js
└── icons/                 # Extension icons (SVG)
    ├── icon16.svg
    ├── icon48.svg
    └── icon128.svg
```

### Making Changes

1. Edit files in your code editor
2. Go to `chrome://extensions/`
3. Click the **refresh icon** on the extension card
4. Reload LinkedIn to see changes

### Debugging

| Component | How to Access |
|-----------|---------------|
| Background Script | `chrome://extensions/` → **service worker** link |
| Content Script | DevTools on LinkedIn → **Console** tab |
| Sidepanel | Right-click sidepanel → **Inspect** |

---

## Troubleshooting

### "API key not configured"
- Open the sidepanel and add your OpenRouter API key
- Ensure it starts with `sk-or-v1-`

### No suggestions appearing
- Check you're on LinkedIn (`linkedin.com`)
- Verify your API key with **Test Connection**
- Ensure a model is selected in settings

### Models not loading
- Check internet connection
- Click **Refresh Models** in settings
- Verify API key is valid at [openrouter.ai/keys](https://openrouter.ai/keys)

### Extension stopped working
- Extension may have updated – reload the LinkedIn page
- Check `chrome://extensions/` for any errors
- Try disabling and re-enabling the extension

---

## Tech Stack

- **Manifest V3** – Latest Chrome extension format
- **OpenRouter API** – Unified access to free AI models
- **Chrome Sidepanel API** – Native sidebar integration
- **Vanilla JavaScript** – No build step required

---

## License

MIT License – see [LICENSE](LICENSE) for details.

---

## Disclaimer

This extension is **not affiliated with LinkedIn** or OpenRouter. Use responsibly and in accordance with LinkedIn's Terms of Service. The AI-generated content should be reviewed before posting.

---

<p align="center">Made with ❤️ for the LinkedIn community</p>
