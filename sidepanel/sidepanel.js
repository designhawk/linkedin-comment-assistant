/**
 * LinkedIn Comment Assistant - Sidepanel Script
 */

// Configuration Constants
const CONFIG = {
  TIMEOUTS: {
    COPY_FEEDBACK: 2000,      // 2 seconds
    SPEED_TEST_DELAY: 500,    // 0.5 seconds
    SAVE_MESSAGE: 3000        // 3 seconds
  },
  DEBUG: false
};

// Conditional logger
const log = CONFIG.DEBUG ? console.log : () => {};

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
      await populateModelSelect(settings.availableModels, settings.selectedModel);
    } else {
      await fetchAndPopulateModels(settings.selectedModel);
    }
  }

  // Populate model dropdown
  async function populateModelSelect(models, selectedModelId) {
    modelSelect.innerHTML = '';
    
    if (models.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No models available';
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
    
    // Load speed info if a model is selected
    if (selectedModelId) {
      await loadSpeedInfo();
    }
  }

  // Fetch models from API
  async function fetchAndPopulateModels(selectedModelId) {
    modelSelect.disabled = true;
    modelSelect.innerHTML = '<option>Loading...</option>';
    refreshModelsBtn.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({ action: 'fetchModels' });
      
      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message);
      }
      
      if (response.error) {
        throw new Error(response.error);
      }

      await populateModelSelect(response.models, selectedModelId);
      
      saveMessage.textContent = `Loaded ${response.models.length} models`;
      saveMessage.className = 'save-message success';
      setTimeout(() => {
        saveMessage.style.display = 'none';
      }, 3000);
    } catch (error) {
      console.error('Failed to fetch models:', error);
      modelSelect.innerHTML = '<option>Error loading</option>';
      
      saveMessage.textContent = `Error: ${error.message}`;
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
      apiKeyValidation.textContent = 'Enter an API key';
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
  modelSelect.addEventListener('change', async () => {
    const selectedId = modelSelect.value;
    if (selectedId) {
      await loadSpeedInfo();
    } else {
      testSpeedBtn.disabled = true;
      speedInfo.style.display = 'none';
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
      saveMessage.textContent = 'Please enter your API key';
      saveMessage.className = 'save-message error';
      return;
    }

    if (!selectedModel) {
      saveMessage.textContent = 'Please select a model';
      saveMessage.className = 'save-message error';
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    saveMessage.style.display = 'none';

    try {
      await chrome.storage.local.set({
        apiKey: apiKey,
        selectedModel: selectedModel,
        userProfile: userProfile
      });

      saveMessage.textContent = '✓ Settings saved!';
      saveMessage.className = 'save-message success';
      
      setTimeout(() => {
        saveMessage.style.display = 'none';
      }, 3000);
    } catch (error) {
      console.error('Failed to save:', error);
      saveMessage.textContent = `✗ Error: ${error.message}`;
      saveMessage.className = 'save-message error';
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save Settings';
    }
  });

  // Test speed button
  testSpeedBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const selectedModel = modelSelect.value;
    
    if (!apiKey) {
      apiKeyValidation.textContent = 'Enter an API key first';
      apiKeyValidation.className = 'validation-message error';
      apiKeyValidation.style.display = 'block';
      return;
    }
    
    if (!selectedModel) {
      saveMessage.textContent = 'Select a model first';
      saveMessage.className = 'save-message error';
      saveMessage.style.display = 'block';
      return;
    }
    
    testSpeedBtn.disabled = true;
    testSpeedBtn.textContent = 'Testing...';
    
    try {
      const result = await chrome.runtime.sendMessage({
        action: 'testApiKey',
        apiKey: apiKey,
        modelId: selectedModel
      });
      
      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message);
      }
      
      if (result.valid) {
        saveMessage.textContent = `⚡ Speed test: ${result.responseTime}ms`;
        saveMessage.className = 'save-message success';
        saveMessage.style.display = 'block';
        
        // Refresh speed info display
        await loadSpeedInfo();
        
        setTimeout(() => {
          saveMessage.style.display = 'none';
        }, 5000);
      } else {
        saveMessage.textContent = `✗ Test failed: ${result.error}`;
        saveMessage.className = 'save-message error';
        saveMessage.style.display = 'block';
      }
    } catch (error) {
      saveMessage.textContent = `✗ Error: ${error.message}`;
      saveMessage.className = 'save-message error';
      saveMessage.style.display = 'block';
    } finally {
      testSpeedBtn.disabled = false;
      testSpeedBtn.textContent = '⚡ Test Current';
    }
  });
  
  // Test all models button
  testAllSpeedsBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
      apiKeyValidation.textContent = 'Enter an API key first';
      apiKeyValidation.className = 'validation-message error';
      apiKeyValidation.style.display = 'block';
      return;
    }
    
    // Get all available models
    const result = await chrome.storage.local.get(['availableModels']);
    const models = result.availableModels || [];
    
    if (models.length === 0) {
      saveMessage.textContent = 'No models loaded. Click Refresh Models first.';
      saveMessage.className = 'save-message error';
      saveMessage.style.display = 'block';
      return;
    }
    
    // Disable buttons during testing
    testSpeedBtn.disabled = true;
    testAllSpeedsBtn.disabled = true;
    testAllSpeedsBtn.textContent = 'Testing...';
    
    // Show progress
    speedProgress.style.display = 'block';
    allSpeeds.style.display = 'none';
    speedInfo.style.display = 'none';
    
    const results = [];
    const totalModels = models.length;
    
    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      
      // Update progress
      progressCount.textContent = `${i + 1}/${totalModels}`;
      progressFill.style.width = `${((i + 1) / totalModels) * 100}%`;
      progressCurrent.textContent = `Testing: ${model.name}`;
      
      try {
        const startTime = performance.now();
        const result = await chrome.runtime.sendMessage({
          action: 'testApiKey',
          apiKey: apiKey,
          modelId: model.id
        });
        const endTime = performance.now();
        
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
      
      // Small delay between tests to avoid rate limiting
      if (i < models.length - 1) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.TIMEOUTS.SPEED_TEST_DELAY));
      }
    }
    
    // Hide progress
    speedProgress.style.display = 'none';
    
    // Sort by response time (fastest first)
    const sortedResults = results
      .filter(r => r.success)
      .sort((a, b) => a.responseTime - b.responseTime);
    
    // Display all results
    allSpeedsList.innerHTML = '';
    sortedResults.forEach((result, index) => {
      const item = document.createElement('div');
      item.className = 'all-speeds-item';
      if (index === 0) item.classList.add('fastest');
      
      const rank = document.createElement('span');
      rank.className = 'speed-rank';
      rank.textContent = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
      
      const name = document.createElement('span');
      name.className = 'speed-name';
      name.textContent = result.name;
      
      const time = document.createElement('span');
      time.className = 'speed-time';
      time.textContent = `${result.responseTime}ms`;
      
      item.appendChild(rank);
      item.appendChild(name);
      item.appendChild(time);
      allSpeedsList.appendChild(item);
    });
    
    // Show failed tests
    const failedResults = results.filter(r => !r.success);
    if (failedResults.length > 0) {
      const failedHeader = document.createElement('div');
      failedHeader.className = 'all-speeds-failed-header';
      failedHeader.textContent = `Failed (${failedResults.length})`;
      allSpeedsList.appendChild(failedHeader);
      
      failedResults.forEach(result => {
        const item = document.createElement('div');
        item.className = 'all-speeds-item failed';
        
        const name = document.createElement('span');
        name.className = 'speed-name';
        name.textContent = result.name;
        
        const error = document.createElement('span');
        error.className = 'speed-error';
        error.textContent = 'Failed';
        
        item.appendChild(name);
        item.appendChild(error);
        allSpeedsList.appendChild(item);
      });
    }
    
    allSpeeds.style.display = 'block';
    
    // Show completion message
    if (sortedResults.length > 0) {
      saveMessage.textContent = `✓ Tested ${sortedResults.length} models. Fastest: ${sortedResults[0].name} (${sortedResults[0].responseTime}ms)`;
      saveMessage.className = 'save-message success';
      saveMessage.style.display = 'block';
      
      // Refresh speed info for current model
      await loadSpeedInfo();
    } else {
      saveMessage.textContent = '✗ All tests failed';
      saveMessage.className = 'save-message error';
      saveMessage.style.display = 'block';
    }
    
    // Re-enable buttons
    testSpeedBtn.disabled = false;
    testAllSpeedsBtn.disabled = false;
    testAllSpeedsBtn.textContent = '⚡ Test All Models';
    
      setTimeout(() => {
        saveMessage.style.display = 'none';
      }, CONFIG.TIMEOUTS.SAVE_MESSAGE);
    } catch (error) {
      console.error('Failed to fetch models:', error);
      modelSelect.innerHTML = '<option>Error loading</option>';
      
      saveMessage.textContent = `Error: ${error.message}`;
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
      apiKeyValidation.textContent = 'Enter an API key';
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
  modelSelect.addEventListener('change', async () => {
    const selectedId = modelSelect.value;
    if (selectedId) {
      await loadSpeedInfo();
    } else {
      testSpeedBtn.disabled = true;
      testAllSpeedsBtn.disabled = true;
      speedInfo.style.display = 'none';
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
      saveMessage.textContent = 'Please enter your API key';
      saveMessage.className = 'save-message error';
      return;
    }

    if (!selectedModel) {
      saveMessage.textContent = 'Please select a model';
      saveMessage.className = 'save-message error';
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    saveMessage.style.display = 'none';

    try {
      await chrome.storage.local.set({
        apiKey: apiKey,
        selectedModel: selectedModel,
        userProfile: userProfile
      });

      saveMessage.textContent = '✓ Settings saved!';
      saveMessage.className = 'save-message success';
      
      setTimeout(() => {
        saveMessage.style.display = 'none';
      }, CONFIG.TIMEOUTS.SAVE_MESSAGE);
    } catch (error) {
      console.error('Failed to save:', error);
      saveMessage.textContent = `✗ Error: ${error.message}`;
      saveMessage.className = 'save-message error';
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save Settings';
    }
  });
  
  // Load and display speed info
  async function loadSpeedInfo() {
    const selectedModel = modelSelect.value;
    const apiKey = apiKeyInput.value.trim();
    
    if (!selectedModel || !apiKey) {
      testSpeedBtn.disabled = true;
      testAllSpeedsBtn.disabled = true;
      speedInfo.style.display = 'none';
      return;
    }
    
    testSpeedBtn.disabled = false;
    testAllSpeedsBtn.disabled = false;
    
    try {
      // Get stored response times
      const result = await chrome.storage.local.get(['modelResponseTimes']);
      const times = result.modelResponseTimes || {};
      
      // Get fastest model
      const fastestResult = await chrome.runtime.sendMessage({ action: 'getFastestModel' });
      
      // Show speed info
      speedInfo.style.display = 'block';
      
      // Display current model time
      if (times[selectedModel]) {
        currentModelTime.textContent = `${times[selectedModel].average}ms avg (${times[selectedModel].times.length} tests)`;
        currentModelTime.className = 'speed-value tested';
      } else {
        currentModelTime.textContent = 'Not tested yet';
        currentModelTime.className = 'speed-value';
      }
      
      // Display fastest model
      if (fastestResult) {
        const modelName = fastestResult.modelId.split('/').pop();
        fastestModelTime.innerHTML = `${modelName} <span class="speed-highlight">${fastestResult.averageTime}ms</span>`;
        fastestModelTime.className = 'speed-value fastest';
      } else {
        fastestModelTime.textContent = 'Run speed test';
        fastestModelTime.className = 'speed-value';
      }
    } catch (error) {
      console.error('Failed to load speed info:', error);
      speedInfo.style.display = 'none';
    }
  }

  // Initial load
  loadSettings();
  loadSpeedInfo();
});