/**
 * LinkedIn Comment Assistant - Sidepanel Script
 * Redesigned with dark interface and prompt editor
 */

// Configuration Constants
const CONFIG = {
  TIMEOUTS: {
    COPY_FEEDBACK: 2000,
    SPEED_TEST_DELAY: 500,
    SAVE_MESSAGE: 3000,
    TOAST_DURATION: 3000
  },
  DEBUG: false
};

// Default prompts - these match the background.js defaults
const DEFAULT_PROMPTS = {
  expert_take: `WRITE LIKE: Someone sharing a quick insight in the comments, not writing a blog post
STYLE: Drop one specific fact or counterintuitive take. Don't explain yourself fully.
GOOD EXAMPLES:
- "Opposite worked for us. Cut meeting time in half, productivity jumped 30%"
- "Hot take: Most KPIs measure busy work, not actual impact"
BAD EXAMPLES:
- "I completely agree with your assessment..."
- "In my professional opinion..."
RULES:
- One sentence max, maybe two if punchy
- Skip the setup, just say the thing
- Use numbers casually ("30%" not "thirty percent")`,

  relatable_story: `WRITE LIKE: Texting a friend who gets it
STYLE: Brief, messy, maybe trails off. Real humans don't write perfect LinkedIn comments.
GOOD EXAMPLES:
- "Oof yeah this happened to me last year. Was so focused on launch I ignored the data saying users were confused"
- "I used to think I needed all the answers as a manager lol"
BAD EXAMPLES:
- "I want to share my journey with..."
- "Your post really resonated with me..."
RULES:
- Write like you're rushing between meetings
- Imperfect grammar is GOOD (dropping words, starting with "And" or "But")
- Include one tiny specific detail, not a whole story`,

  thought_question: `WRITE LIKE: Actually curious, not trying to sound smart
STYLE: Casual question that invites stories, not debate.
GOOD EXAMPLES:
- "How did you handle pushback on this? Always struggle with that part"
- "Curious - has anyone tried the opposite approach?"
BAD EXAMPLES:
- "What are your thoughts on..."
- "Have you considered..."
RULES:
- Start with lowercase sometimes ("how do you...")
- Add "always wondered" or "struggle with" to sound genuine
- Don't make it sound like an interview`,

  practical_tip: `WRITE LIKE: Slack message to a coworker
STYLE: One specific shortcut, no context needed.
GOOD EXAMPLES:
- "Try scheduling all meetings Tue/Thu only. Mon/Wed/Fri for deep work changed everything"
- "We started doing async updates instead of standups. Game changer tbh"
BAD EXAMPLES:
- "Here are three strategies for..."
- "I recommend implementing..."
RULES:
- Lead with the action ("Try this:" or just say it)
- One tip only, no list
- Use "we" or "I" casually`,

  connection_bridge: `WRITE LIKE: Connecting dots in a group chat
STYLE: "This reminds me of..." but brief and casual.
GOOD EXAMPLES:
- "Reminds me of how everyone thought remote work would kill productivity. Same pattern here"
- "We're seeing this across our industry too. The shift is real"
BAD EXAMPLES:
- "This is indicative of a broader trend..."
- "From a macro perspective..."
RULES:
- Casual comparison, not analysis
- Use "reminds me" or "same thing happened"
- One sentence, drop the mic`,

  authentic_reaction: `WRITE LIKE: Reacting in real-time
STYLE: First thought, best thought. Raw and unfiltered.
GOOD EXAMPLES:
- "Same. Still recovering from my last job tbh"
- "Love this. Bookmarked for my team"
- "Wait this is genius. Why didn't I think of this"
BAD EXAMPLES:
- "Congratulations on your achievement"
- "Thank you for sharing this valuable insight"
RULES:
- React immediately, don't polish
- Use casual abbreviations (tbh, lol, wait)
- Comment on the feeling, not the facts`
};

// Comment type labels
const COMMENT_TYPE_LABELS = {
  expert_take: 'Expert Take',
  relatable_story: 'Relatable Story',
  thought_question: 'Thought Question',
  practical_tip: 'Practical Tip',
  connection_bridge: 'Connection Bridge',
  authentic_reaction: 'Authentic Reaction'
};

// Default message prompts - these match the background.js defaults
const DEFAULT_MESSAGE_PROMPTS = {
  professional_networking: `WRITE LIKE: Quick professional note between colleagues
STYLE: Polished but brief, gets to the point fast.
GOOD EXAMPLES:
- "Thanks for sharing this. Would love to connect and hear more about your work in AI."
- "This aligns with what we're building. Mind if I reach out about potential collaboration?"
BAD EXAMPLES:
- "I hope this message finds you well..."
- "I wanted to take a moment to introduce myself..."
RULES:
- 1-2 sentences max
- Skip formal greetings and closings
- Be direct about next steps or interest`,

  casual_friendly: `WRITE LIKE: Slack message to a coworker you like
STYLE: Relaxed, conversational, uses casual language.
GOOD EXAMPLES:
- "Haha same! This is exactly what I needed today"
- "Love this perspective. How long have you been working on this?"
BAD EXAMPLES:
- "I completely agree with your assessment..."
- "Thank you for your thoughtful message..."
RULES:
- Use contractions: I'm, don't, can't
- Short sentences are fine
- Show personality`,

  follow_up: `WRITE LIKE: Keeping the ball rolling
STYLE: Reference what they said, add something new.
GOOD EXAMPLES:
- "That makes sense. When you tried X, did you run into Y issue?"
- "Interesting point about scaling. Have you seen this work with smaller teams?"
BAD EXAMPLES:
- "Following up on our previous conversation..."
- "I wanted to circle back on..."
RULES:
- Acknowledge their last point briefly
- Ask a follow-up question or add insight
- Move conversation forward`,

  cold_outreach: `WRITE LIKE: Warm intro that respects their time
STYLE: Brief, clear value, easy to respond to.
GOOD EXAMPLES:
- "Saw your post on X. We're solving similar problems - mind if I share what we're seeing?"
- "Quick question: have you explored Y approach? We've had interesting results"
BAD EXAMPLES:
- "I came across your profile and..."
- "I wanted to reach out because..."
RULES:
- Lead with why you're reaching out
- Keep it under 2 sentences
- Make it easy to say yes or no`,

  collaborative: `WRITE LIKE: Exploring partnership opportunities
STYLE: Open, curious, not pushy.
GOOD EXAMPLES:
- "This is really interesting. Have you considered partnering with companies in X space?"
- "We're working on something similar. Would love to compare notes if you're open to it"
BAD EXAMPLES:
- "I think we should work together..."
- "Let me tell you about my company..."
RULES:
- Express interest without commitment
- Focus on mutual benefit
- Leave room for them to suggest next steps`,

  gratitude: `WRITE LIKE: Quick thank you that feels genuine
STYLE: Specific, warm, not over the top.
GOOD EXAMPLES:
- "Thanks for sharing this - exactly what I needed to hear today"
- "Appreciate you taking the time to explain. Really helpful perspective"
BAD EXAMPLES:
- "Thank you so much for your valuable insights..."
- "I am incredibly grateful for..."
RULES:
- Be specific about what you're thankful for
- One sentence is often enough
- Don't overdo it`
};

// Message type labels
const MESSAGE_TYPE_LABELS = {
  professional_networking: 'Professional Networking',
  casual_friendly: 'Casual Friendly',
  follow_up: 'Follow Up',
  cold_outreach: 'Cold Outreach',
  collaborative: 'Collaborative',
  gratitude: 'Gratitude'
};

// State
let availableModels = [];
let selectedModelId = null;
let customPrompts = {};
let customMessagePrompts = {};

// Conditional logger
const log = CONFIG.DEBUG ? console.log : () => {};

// Toast notification system
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  
  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>`;
  } else if (type === 'error') {
    iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="15" y1="9" x2="9" y2="15"></line>
      <line x1="9" y1="9" x2="15" y2="15"></line>
    </svg>`;
  }
  
  toast.innerHTML = iconSvg + message;
  toast.className = `toast ${type} visible`;
  
  setTimeout(() => {
    toast.classList.remove('visible');
  }, CONFIG.TIMEOUTS.TOAST_DURATION);
}

// Show validation message
function showValidation(element, message, type = 'error') {
  element.textContent = message;
  element.className = `validation-message ${type} visible`;
  
  setTimeout(() => {
    element.classList.remove('visible');
  }, 5000);
}

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const apiKeyInput = document.getElementById('apiKey');
  const toggleApiKeyBtn = document.getElementById('toggleApiKey');
  const testApiKeyBtn = document.getElementById('testApiKeyBtn');
  const apiKeyValidation = document.getElementById('apiKeyValidation');
  const modelSelect = document.getElementById('modelSelect');
  const refreshModelsBtn = document.getElementById('refreshModelsBtn');
  const testSpeedBtn = document.getElementById('testSpeedBtn');
  const testAllSpeedsBtn = document.getElementById('testAllSpeedsBtn');
  const speedInfo = document.getElementById('speedInfo');
  const currentModelTime = document.getElementById('currentModelTime');
  const fastestModelTime = document.getElementById('fastestModelTime');
  const speedProgress = document.getElementById('speedProgress');
  const progressCount = document.getElementById('progressCount');
  const progressFill = document.getElementById('progressFill');
  const progressCurrent = document.getElementById('progressCurrent');
  const allSpeeds = document.getElementById('allSpeeds');
  const allSpeedsList = document.getElementById('allSpeedsList');
  const promptsContainer = document.getElementById('promptsContainer');
  const saveBtn = document.getElementById('saveBtn');
  const eyeIcon = toggleApiKeyBtn?.querySelector('.eye-icon');
  const eyeOffIcon = toggleApiKeyBtn?.querySelector('.eye-off-icon');

  // Load saved settings
  async function loadSettings() {
    const settings = await chrome.storage.local.get([
      'apiKey',
      'selectedModel',
      'availableModels',
      'customPrompts',
      'customMessagePrompts'
    ]);

    if (settings.apiKey) {
      apiKeyInput.value = settings.apiKey;
    }

    // Load custom prompts or use defaults
    customPrompts = settings.customPrompts || {};
    renderPromptEditors();

    // Load custom message prompts or use defaults
    customMessagePrompts = settings.customMessagePrompts || {};
    renderMessagePromptEditors();

    selectedModelId = settings.selectedModel || null;

    // Load models
    if (settings.availableModels && settings.availableModels.length > 0) {
      availableModels = settings.availableModels;
      populateModelSelect(availableModels, selectedModelId);
      await loadSpeedInfo();
    } else {
      await fetchAndPopulateModels();
    }
  }

  // Render prompt editors
  function renderPromptEditors() {
    promptsContainer.innerHTML = '';
    
    Object.keys(DEFAULT_PROMPTS).forEach(type => {
      const promptItem = document.createElement('div');
      promptItem.className = 'prompt-item';
      
      const isCustom = customPrompts[type] && customPrompts[type] !== DEFAULT_PROMPTS[type];
      const currentPrompt = customPrompts[type] || DEFAULT_PROMPTS[type];
      
      promptItem.innerHTML = `
        <div class="prompt-header" data-type="${type}">
          <div class="prompt-title">
            <span class="prompt-label">${COMMENT_TYPE_LABELS[type]}</span>
            ${isCustom ? '<span class="prompt-badge">Custom</span>' : ''}
          </div>
          <svg class="prompt-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
        <div class="prompt-editor" style="display: none;">
          <textarea 
            class="prompt-textarea" 
            data-type="${type}"
            data-prompt-type="comment"
            placeholder="Enter custom prompt..."
            rows="8"
          >${currentPrompt}</textarea>
          <div class="prompt-actions">
            <button class="btn btn-secondary btn-sm prompt-reset" data-type="${type}">
              Reset to Default
            </button>
          </div>
        </div>
      `;
      
      promptsContainer.appendChild(promptItem);
    });
    
    // Add click handlers for expanding/collapsing
    promptsContainer.querySelectorAll('.prompt-header').forEach(header => {
      header.addEventListener('click', () => {
        const editor = header.nextElementSibling;
        const chevron = header.querySelector('.prompt-chevron');
        const isExpanded = editor.style.display !== 'none';
        
        // Close all others
        promptsContainer.querySelectorAll('.prompt-editor').forEach(ed => ed.style.display = 'none');
        promptsContainer.querySelectorAll('.prompt-chevron').forEach(ch => ch.style.transform = '');
        
        // Toggle current
        if (!isExpanded) {
          editor.style.display = 'block';
          chevron.style.transform = 'rotate(180deg)';
        }
      });
    });
    
    // Add reset handlers
    promptsContainer.querySelectorAll('.prompt-reset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = btn.dataset.type;
        const textarea = promptsContainer.querySelector(`textarea[data-type="${type}"]`);
        textarea.value = DEFAULT_PROMPTS[type];
        
        // Remove custom status
        delete customPrompts[type];
        
        // Update badge
        const header = btn.closest('.prompt-item').querySelector('.prompt-header');
        const badge = header.querySelector('.prompt-badge');
        if (badge) badge.remove();
        
        showToast(`${COMMENT_TYPE_LABELS[type]} reset to default`, 'success');
      });
    });
  }

  // Render message prompt editors
  function renderMessagePromptEditors() {
    const messagePromptsContainer = document.getElementById('messagePromptsContainer');
    if (!messagePromptsContainer) return;
    
    messagePromptsContainer.innerHTML = '';
    
    Object.keys(DEFAULT_MESSAGE_PROMPTS).forEach(type => {
      const promptItem = document.createElement('div');
      promptItem.className = 'prompt-item';
      
      const isCustom = customMessagePrompts[type] && customMessagePrompts[type] !== DEFAULT_MESSAGE_PROMPTS[type];
      const currentPrompt = customMessagePrompts[type] || DEFAULT_MESSAGE_PROMPTS[type];
      
      promptItem.innerHTML = `
        <div class="prompt-header" data-type="${type}">
          <div class="prompt-title">
            <span class="prompt-label">${MESSAGE_TYPE_LABELS[type]}</span>
            ${isCustom ? '<span class="prompt-badge">Custom</span>' : ''}
          </div>
          <svg class="prompt-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
        <div class="prompt-editor" style="display: none;">
          <textarea 
            class="prompt-textarea" 
            data-type="${type}"
            data-prompt-type="message"
            placeholder="Enter custom prompt..."
            rows="8"
          >${currentPrompt}</textarea>
          <div class="prompt-actions">
            <button class="btn btn-secondary btn-sm prompt-reset" data-type="${type}">
              Reset to Default
            </button>
          </div>
        </div>
      `;
      
      messagePromptsContainer.appendChild(promptItem);
    });
    
    // Add click handlers for expanding/collapsing
    messagePromptsContainer.querySelectorAll('.prompt-header').forEach(header => {
      header.addEventListener('click', () => {
        const editor = header.nextElementSibling;
        const chevron = header.querySelector('.prompt-chevron');
        const isExpanded = editor.style.display !== 'none';
        
        // Close all others
        messagePromptsContainer.querySelectorAll('.prompt-editor').forEach(ed => ed.style.display = 'none');
        messagePromptsContainer.querySelectorAll('.prompt-chevron').forEach(ch => ch.style.transform = '');
        
        // Toggle current
        if (!isExpanded) {
          editor.style.display = 'block';
          chevron.style.transform = 'rotate(180deg)';
        }
      });
    });
    
    // Add reset handlers
    messagePromptsContainer.querySelectorAll('.prompt-reset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = btn.dataset.type;
        const textarea = messagePromptsContainer.querySelector(`textarea[data-type="${type}"]`);
        textarea.value = DEFAULT_MESSAGE_PROMPTS[type];
        
        // Remove custom status
        delete customMessagePrompts[type];
        
        // Update badge
        const header = btn.closest('.prompt-item').querySelector('.prompt-header');
        const badge = header.querySelector('.prompt-badge');
        if (badge) badge.remove();
        
        showToast(`${MESSAGE_TYPE_LABELS[type]} reset to default`, 'success');
      });
    });
  }

  // Populate model dropdown
  function populateModelSelect(models, selectedId) {
    modelSelect.innerHTML = '';
    
    if (models.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No models available';
      modelSelect.appendChild(option);
      modelSelect.disabled = true;
      testSpeedBtn.disabled = true;
      testAllSpeedsBtn.disabled = true;
      return;
    }

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a model...';
    modelSelect.appendChild(defaultOption);

    const grouped = models.reduce((acc, model) => {
      const provider = model.provider || 'Other';
      if (!acc[provider]) acc[provider] = [];
      acc[provider].push(model);
      return acc;
    }, {});

    Object.keys(grouped).sort().forEach(provider => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = provider.charAt(0).toUpperCase() + provider.slice(1);
      
      grouped[provider].forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = `${model.name} (${model.contextLength?.toLocaleString() || '?'} tokens)`;
        if (model.id === selectedId) {
          option.selected = true;
        }
        optgroup.appendChild(option);
      });

      modelSelect.appendChild(optgroup);
    });

    modelSelect.disabled = false;
    
    if (selectedId) {
      testSpeedBtn.disabled = false;
      testAllSpeedsBtn.disabled = false;
    }
  }

  // Fetch models from API
  async function fetchAndPopulateModels() {
    modelSelect.innerHTML = '<option value="">Loading...</option>';
    modelSelect.disabled = true;
    refreshModelsBtn.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({ action: 'fetchModels' });
      
      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message);
      }
      
      if (response.error) {
        throw new Error(response.error);
      }

      availableModels = response.models;
      populateModelSelect(availableModels, selectedModelId);
      await loadSpeedInfo();
      
      showToast(`Loaded ${response.models.length} models`, 'success');
    } catch (error) {
      console.error('Failed to fetch models:', error);
      modelSelect.innerHTML = '<option value="">Error loading</option>';
      showToast(`Failed to load models: ${error.message}`, 'error');
    } finally {
      refreshModelsBtn.disabled = false;
    }
  }

  // Toggle API key visibility
  toggleApiKeyBtn.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    
    if (isPassword) {
      eyeIcon.style.display = 'none';
      eyeOffIcon.style.display = 'block';
    } else {
      eyeIcon.style.display = 'block';
      eyeOffIcon.style.display = 'none';
    }
  });

  // Test API key
  testApiKeyBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      showValidation(apiKeyValidation, 'Enter an API key', 'error');
      return;
    }

    testApiKeyBtn.disabled = true;
    const originalText = testApiKeyBtn.innerHTML;
    testApiKeyBtn.innerHTML = `<div class="loading-spinner"></div> Testing...`;

    try {
      const result = await chrome.runtime.sendMessage({
        action: 'testApiKey',
        apiKey: apiKey,
        modelId: selectedModelId || 'meta-llama/llama-3.1-8b-instruct'
      });

      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message);
      }

      if (result.valid) {
        showValidation(apiKeyValidation, '✓ API key is valid!', 'success');
        showToast(`Connection successful (${result.responseTime}ms)`, 'success');
      } else {
        showValidation(apiKeyValidation, result.error || 'Invalid API key', 'error');
        showToast(result.error || 'Invalid API key', 'error');
      }
    } catch (error) {
      showValidation(apiKeyValidation, `Error: ${error.message}`, 'error');
      showToast(`Error: ${error.message}`, 'error');
    } finally {
      testApiKeyBtn.disabled = false;
      testApiKeyBtn.innerHTML = originalText;
    }
  });

  // Handle model selection change
  modelSelect.addEventListener('change', async () => {
    selectedModelId = modelSelect.value;
    if (selectedModelId) {
      testSpeedBtn.disabled = false;
      testAllSpeedsBtn.disabled = false;
      await loadSpeedInfo();
    } else {
      testSpeedBtn.disabled = true;
      testAllSpeedsBtn.disabled = true;
      speedInfo.classList.remove('visible');
    }
  });

  // Refresh models
  refreshModelsBtn.addEventListener('click', () => {
    fetchAndPopulateModels();
  });

  // Collect custom prompts from editors
  function collectCustomPrompts() {
    const prompts = {};
    const textareas = promptsContainer.querySelectorAll('.prompt-textarea');
    
    textareas.forEach(textarea => {
      const type = textarea.dataset.type;
      const value = textarea.value.trim();
      
      // Only save if it's different from default
      if (value && value !== DEFAULT_PROMPTS[type]) {
        prompts[type] = value;
      }
    });
    
    return prompts;
  }

  // Collect custom message prompts from editors
  function collectCustomMessagePrompts() {
    const prompts = {};
    const messagePromptsContainer = document.getElementById('messagePromptsContainer');
    if (!messagePromptsContainer) return prompts;
    
    const textareas = messagePromptsContainer.querySelectorAll('.prompt-textarea');
    
    textareas.forEach(textarea => {
      const type = textarea.dataset.type;
      const value = textarea.value.trim();
      
      // Only save if it's different from default
      if (value && value !== DEFAULT_MESSAGE_PROMPTS[type]) {
        prompts[type] = value;
      }
    });
    
    return prompts;
  }

  // Save settings
  saveBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const newCustomPrompts = collectCustomPrompts();
    const newCustomMessagePrompts = collectCustomMessagePrompts();

    // Validation
    if (!apiKey) {
      showToast('Please enter your API key', 'error');
      apiKeyInput.focus();
      return;
    }

    if (!selectedModelId) {
      showToast('Please select a model', 'error');
      return;
    }

    saveBtn.disabled = true;
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = `<div class="loading-spinner"></div> Saving...`;

    try {
      await chrome.storage.local.set({
        apiKey: apiKey,
        selectedModel: selectedModelId,
        customPrompts: newCustomPrompts,
        customMessagePrompts: newCustomMessagePrompts
      });

      // Update local state
      customPrompts = newCustomPrompts;
      customMessagePrompts = newCustomMessagePrompts;
      
      // Update badges
      renderPromptEditors();
      renderMessagePromptEditors();

      showToast('Settings saved successfully', 'success');
    } catch (error) {
      console.error('Failed to save:', error);
      showToast(`Error: ${error.message}`, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
    }
  });

  // Test speed button
  testSpeedBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      showToast('Enter an API key first', 'error');
      return;
    }
    
    if (!selectedModelId) {
      showToast('Select a model first', 'error');
      return;
    }
    
    testSpeedBtn.disabled = true;
    const originalText = testSpeedBtn.innerHTML;
    testSpeedBtn.innerHTML = `<div class="loading-spinner"></div> Testing...`;
    
    try {
      const result = await chrome.runtime.sendMessage({
        action: 'testApiKey',
        apiKey: apiKey,
        modelId: selectedModelId
      });
      
      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message);
      }
      
      if (result.valid) {
        showToast(`Speed test: ${result.responseTime}ms`, 'success');
        await loadSpeedInfo();
      } else {
        showToast(`Test failed: ${result.error}`, 'error');
      }
    } catch (error) {
      showToast(`Error: ${error.message}`, 'error');
    } finally {
      testSpeedBtn.disabled = false;
      testSpeedBtn.innerHTML = originalText;
    }
  });
  
  // Test all models button
  testAllSpeedsBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      showToast('Enter an API key first', 'error');
      return;
    }
    
    if (availableModels.length === 0) {
      showToast('No models loaded. Click Refresh Models first.', 'error');
      return;
    }
    
    testSpeedBtn.disabled = true;
    testAllSpeedsBtn.disabled = true;
    const originalText = testAllSpeedsBtn.textContent;
    testAllSpeedsBtn.innerHTML = `<div class="loading-spinner"></div> Testing...`;
    
    speedProgress.classList.add('visible');
    allSpeeds.classList.remove('visible');
    speedInfo.classList.remove('visible');
    
    const results = [];
    const totalModels = availableModels.length;
    
    for (let i = 0; i < availableModels.length; i++) {
      const model = availableModels[i];
      
      progressCount.textContent = `${i + 1}/${totalModels}`;
      progressFill.style.width = `${((i + 1) / totalModels) * 100}%`;
      progressCurrent.textContent = `Testing: ${model.name}`;
      
      try {
        const result = await chrome.runtime.sendMessage({
          action: 'testApiKey',
          apiKey: apiKey,
          modelId: model.id
        });
        
        if (result.valid) {
          results.push({
            modelId: model.id,
            name: model.name,
            responseTime: result.responseTime,
            success: true
          });
        } else {
          results.push({
            modelId: model.id,
            name: model.name,
            error: result.error,
            success: false
          });
        }
      } catch (error) {
        results.push({
          modelId: model.id,
          name: model.name,
          error: error.message,
          success: false
        });
      }
      
      if (i < availableModels.length - 1) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.TIMEOUTS.SPEED_TEST_DELAY));
      }
    }
    
    speedProgress.classList.remove('visible');
    
    const sortedResults = results
      .filter(r => r.success)
      .sort((a, b) => a.responseTime - b.responseTime);
    
    allSpeedsList.innerHTML = '';
    sortedResults.forEach((result, index) => {
      const item = document.createElement('div');
      item.className = 'model-result-item';
      if (index === 0) item.classList.add('fastest');
      
      item.innerHTML = `
        <span class="model-result-rank">${index + 1}</span>
        <span class="model-result-name">${result.name}</span>
        <span class="model-result-time">${result.responseTime}ms</span>
      `;
      
      allSpeedsList.appendChild(item);
    });
    
    const failedResults = results.filter(r => !r.success);
    if (failedResults.length > 0) {
      const failedHeader = document.createElement('div');
      failedHeader.className = 'all-models-header';
      failedHeader.style.background = 'var(--error-subtle)';
      failedHeader.style.color = 'var(--error)';
      failedHeader.textContent = `Failed (${failedResults.length})`;
      allSpeedsList.appendChild(failedHeader);
      
      failedResults.forEach(result => {
        const item = document.createElement('div');
        item.className = 'model-result-item';
        
        item.innerHTML = `
          <span class="model-result-rank">-</span>
          <span class="model-result-name">${result.name}</span>
          <span class="model-result-error">Failed</span>
        `;
        
        allSpeedsList.appendChild(item);
      });
    }
    
    allSpeeds.classList.add('visible');
    
    if (sortedResults.length > 0) {
      showToast(`Fastest: ${sortedResults[0].name} (${sortedResults[0].responseTime}ms)`, 'success');
      await loadSpeedInfo();
    } else {
      showToast('All tests failed', 'error');
    }
    
    testSpeedBtn.disabled = false;
    testAllSpeedsBtn.disabled = false;
    testAllSpeedsBtn.textContent = originalText;
  });
  
  // Load and display speed info
  async function loadSpeedInfo() {
    if (!selectedModelId) {
      testSpeedBtn.disabled = true;
      testAllSpeedsBtn.disabled = true;
      speedInfo.classList.remove('visible');
      return;
    }
    
    testSpeedBtn.disabled = false;
    testAllSpeedsBtn.disabled = false;
    
    try {
      const result = await chrome.storage.local.get(['modelResponseTimes']);
      const times = result.modelResponseTimes || {};
      
      const fastestResult = await chrome.runtime.sendMessage({ action: 'getFastestModel' });
      
      if (times[selectedModelId]) {
        currentModelTime.textContent = `${times[selectedModelId].average}ms avg`;
        currentModelTime.classList.add('fast');
      } else {
        currentModelTime.textContent = 'Not tested';
        currentModelTime.classList.remove('fast');
      }
      
      if (fastestResult) {
        const modelName = fastestResult.modelId.split('/').pop();
        fastestModelTime.textContent = `${modelName} (${fastestResult.averageTime}ms)`;
        fastestModelTime.classList.add('fast');
      } else {
        fastestModelTime.textContent = 'Run speed test';
        fastestModelTime.classList.remove('fast');
      }
      
      speedInfo.classList.add('visible');
    } catch (error) {
      console.error('Failed to load speed info:', error);
      speedInfo.classList.remove('visible');
    }
  }

  // Initial load
  loadSettings();

  // Expose default prompts globally for debugging
  window.DEFAULT_PROMPTS = DEFAULT_PROMPTS;
  window.DEFAULT_MESSAGE_PROMPTS = DEFAULT_MESSAGE_PROMPTS;
});
