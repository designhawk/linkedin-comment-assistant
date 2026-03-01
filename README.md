# LinkedIn Comment Assistant

A Chrome extension that uses AI to suggest personalized LinkedIn comments based on post context.

## Features

- 🤖 **AI-Powered Suggestions**: Generates contextual comment suggestions
- 📝 **Multiple Comment Types**: Appreciation, Questions, Insights, Support, Value-Add, Networking
- 👤 **Personalized**: Uses your profile info to customize comments to your style
- 🆓 **Free Models**: Uses OpenRouter's free AI models
- 🔒 **Privacy First**: No data stored on servers, everything stays in your browser

## Installation

### From Source (Developer Mode)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked" button
5. Select the `linkedin-comment-assistant` folder
6. The extension icon should appear in your Chrome toolbar

### Setup

1. Click the extension icon and select "Open Settings"
2. Get a free API key from [OpenRouter](https://openrouter.ai/keys)
3. Enter your API key in the settings page
4. Select a free AI model (e.g., `meta-llama/llama-3.1-8b-instruct`)
5. Optionally add a brief profile description for personalization
6. Click "Save Settings"

## Usage

1. Go to LinkedIn and browse your feed
2. Click on any comment box ("Add a comment...")
3. You'll see a "💡 Suggest Types" button appear
4. Click it to see recommended comment types based on the post
5. Select a type (e.g., Appreciation, Question, Insightful)
6. The AI will generate 2-3 comments of that type
7. Click "Use This" to insert the comment, or "Copy" to copy it

## How It Works

### Post Analysis
The extension analyzes the post content to detect:
- **Appreciation**: Achievements, milestones, announcements
- **Questions**: Discussion posts seeking input
- **Insightful**: Thought leadership, industry insights
- **Supportive**: Challenges, vulnerable posts
- **Value-Add**: Educational posts, tips, resources
- **Networking**: Collaboration opportunities

### AI Generation
- Uses OpenRouter's free models (Meta Llama, Google Gemma, etc.)
- Incorporates your profile description for personalization
- Generates context-specific, engaging comments
- Comments are 2-4 sentences, professional yet conversational

## Privacy & Security

- **API Key**: Stored securely in Chrome's local storage
- **No Tracking**: No analytics, no data collection
- **Local Processing**: All AI calls go directly from your browser to OpenRouter
- **No History**: Comment suggestions are not stored

## Troubleshooting

### "API key not configured" error
- Go to extension settings and add your OpenRouter API key
- Make sure the key starts with `sk-or-v1-`

### No models loading
- Check your internet connection
- Verify your API key is valid by clicking "Test Connection"
- Try refreshing the model list

### Comments not generating
- Ensure you're on LinkedIn (linkedin.com)
- Check that you've selected a model in settings
- Try refreshing the page and clicking the comment box again

### Extension not working on LinkedIn
- Make sure the extension is enabled in `chrome://extensions/`
- Try reloading the extension
- Check that LinkedIn is in the extension's permissions

## Configuration

### Settings

- **API Key**: Your OpenRouter API key (required)
- **AI Model**: Select from available free models (required)
- **Profile**: 2-3 sentences about yourself (optional, helps with personalization)

### Default Model

The extension defaults to `meta-llama/llama-3.1-8b-instruct` which is:
- Free on OpenRouter
- Good quality for comment generation
- Fast response times

You can switch to other free models like:
- `google/gemma-2-9b-it`
- `mistralai/mistral-7b-instruct`

## File Structure

```
linkedin-comment-assistant/
├── manifest.json          # Extension configuration
├── background.js          # API calls and storage
├── content.js            # LinkedIn DOM manipulation
├── popup/                # Extension popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/              # Settings page
│   ├── options.html
│   ├── options.css
│   └── options.js
└── icons/                # Extension icons
```

## Development

### Modifying the Extension

1. Make changes to the files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the LinkedIn Comment Assistant card
4. Reload LinkedIn page to see changes

### Console Debugging

- **Background script**: Go to `chrome://extensions/` → click "service worker" link
- **Content script**: Open DevTools on LinkedIn page → Console tab
- **Popup**: Right-click extension icon → "Inspect popup"

## License

MIT License - Feel free to modify and distribute!

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Open Chrome DevTools (F12) and check the Console for errors
3. Verify your OpenRouter API key is valid at https://openrouter.ai/keys

---

**Note**: This extension is not affiliated with LinkedIn or OpenRouter. Use responsibly and in accordance with LinkedIn's Terms of Service.
