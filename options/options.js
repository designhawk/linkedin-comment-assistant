/**
 * LinkedIn Comment Assistant - Options Page Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const apiKeyInput = document.getElementById('apiKey');
  const toggleApiKeyBtn = document.getElementById('toggleApiKey');
  const testApiKeyBtn = document.getElementById('testApiKeyBtn');
  const apiKeyValidation = document.getElementById('apiKeyValidation');
  const modelSelect = document.getElementById('modelSelect');
  const modelInfo = document.getElementById('modelInfo');
  const refreshModelsBtn = document.getElementById('refreshModelsBtn');
  const userProfileInput = document.getElementById('userProfile');
  const saveBtn = document.getElementById('saveBtn');
  const saveMessage = document.getElementById('saveMessage');

  // Load saved settings
  async function loadSettings() {
    const settings = await chrome.storage.local.get([
      'apiKey',
      'selectedModel',
      'userProfile',
      'availableModels'
    ]);

    if (settings.apiKey) {
      apiKeyInput.value = settings.apiKey;
    }

    if (settings.userProfile) {
      userProfileInput.value = settings.userProfile;
    }

    // Load models
    if (settings.availableModels && settings.availableModels.length > 0) {
      populateModelSelect(settings.availableModels, settings.selectedModel);
    } else {
      // Fetch models if not cached
      await fetchAndPopulateModels(settings.selectedModel);
    }
  }

  // Populate model dropdown
  function populateModelSelect(models, selectedModelId) {
    modelSelect.innerHTML = '';
    
    if (models.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No free models available';
      modelSelect.appendChild(option);
      modelSelect.disabled = true;
      return;
    }

    // Add default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a model...';
    modelSelect.appendChild(defaultOption);

    // Group by provider
    const grouped = models.reduce((acc, model) => {
      const provider = model.provider;
      if (!acc[provider]) acc[provider] = [];
      acc[provider].push(model);
      return acc;
    }, {});

    // Create option groups
    Object.keys(grouped).sort().forEach(provider => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = provider.charAt(0).toUpperCase() + provider.slice(1);
      
      grouped[provider].forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = `${model.name} (${model.contextLength.toLocaleString()} tokens)`;
        if (model.id === selectedModelId) {
          option.selected = true;
        }
        optgroup.appendChild(option);
      });

      modelSelect.appendChild(optgroup);
    });

    modelSelect.disabled = false;

    // Show model info if one is selected
    if (selectedModelId) {
      const selectedModel = models.find(m => m.id === selectedModelId);
      if (selectedModel) {
        showModelInfo(selectedModel);
      }
    }
  }

  // Show model information
  function showModelInfo(model) {
    modelInfo.innerHTML = `
      <p><strong>${model.name}</strong></p>
      <p>Provider: ${model.provider}</p>
      <p>Context Length: ${model.contextLength.toLocaleString()} tokens</p>
      ${model.description ? `<p>${model.description}</p>` : ''}
    `;
    modelInfo.classList.add('visible');
  }

  // Fetch models from API
  async function fetchAndPopulateModels(selectedModelId) {
    modelSelect.disabled = true;
    modelSelect.innerHTML = '<option>Loading models...</option>';
    refreshModelsBtn.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({ action: 'fetchModels' });
      
      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message);
      }
      
      if (response.error) {
        throw new Error(response.error);
      }

      populateModelSelect(response.models, selectedModelId);
      
      // Show success feedback
      saveMessage.textContent = `Loaded ${response.models.length} free models`;
      saveMessage.className = 'save-message success';
      setTimeout(() => {
        saveMessage.style.display = 'none';
      }, 3000);
    } catch (error) {
      console.error('Failed to fetch models:', error);
      modelSelect.innerHTML = '<option>Error loading models</option>';
      
      // Show error with fallback option
      saveMessage.innerHTML = `
        Error loading models: ${error.message}<br>
        <small>You can still save your settings with the default model.</small>
      `;
      saveMessage.className = 'save-message error';
    } finally {
      refreshModelsBtn.disabled = false;
    }
  }

  // Toggle API key visibility
  toggleApiKeyBtn.addEventListener('click', () => {
    const type = apiKeyInput.type === 'password' ? 'text' : 'password';
    apiKeyInput.type = type;
    toggleApiKeyBtn.textContent = type === 'password' ? '👁️' : '🙈';
  });

  // Test API key
  testApiKeyBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      apiKeyValidation.textContent = 'Please enter an API key';
      apiKeyValidation.className = 'validation-message error';
      return;
    }

    testApiKeyBtn.disabled = true;
    testApiKeyBtn.textContent = 'Testing...';
    apiKeyValidation.style.display = 'none';

    try {
      const result = await chrome.runtime.sendMessage({
        action: 'testApiKey',
        apiKey: apiKey
      });

      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message);
      }

      if (result.valid) {
        apiKeyValidation.textContent = '✓ API key is valid!';
        apiKeyValidation.className = 'validation-message success';
      } else {
        apiKeyValidation.textContent = `✗ ${result.error || 'Invalid API key'}`;
        apiKeyValidation.className = 'validation-message error';
      }
    } catch (error) {
      apiKeyValidation.textContent = `✗ Error: ${error.message}`;
      apiKeyValidation.className = 'validation-message error';
    } finally {
      testApiKeyBtn.disabled = false;
      testApiKeyBtn.textContent = 'Test Connection';
    }
  });

  // Handle model selection change
  modelSelect.addEventListener('change', () => {
    const selectedId = modelSelect.value;
    if (selectedId) {
      chrome.storage.local.get(['availableModels']).then(result => {
        const model = result.availableModels?.find(m => m.id === selectedId);
        if (model) {
          showModelInfo(model);
        }
      });
    } else {
      modelInfo.classList.remove('visible');
    }
  });

  // Refresh models
  refreshModelsBtn.addEventListener('click', () => {
    fetchAndPopulateModels(modelSelect.value);
  });

  // Save settings
  saveBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const selectedModel = modelSelect.value;
    const userProfile = userProfileInput.value.trim();

    // Validation
    if (!apiKey) {
      saveMessage.textContent = 'Please enter your OpenRouter API key';
      saveMessage.className = 'save-message error';
      return;
    }

    if (!selectedModel) {
      saveMessage.textContent = 'Please select an AI model';
      saveMessage.className = 'save-message error';
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    saveMessage.style.display = 'none';

    try {
      // Save to storage
      await chrome.storage.local.set({
        apiKey: apiKey,
        selectedModel: selectedModel,
        userProfile: userProfile
      });

      saveMessage.textContent = '✓ Settings saved successfully!';
      saveMessage.className = 'save-message success';
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        saveMessage.style.display = 'none';
      }, 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      saveMessage.textContent = `✗ Error saving settings: ${error.message}`;
      saveMessage.className = 'save-message error';
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save Settings';
    }
  });

  // Load settings on page load
  loadSettings();
});
