/**
 * LinkedIn Comment Assistant - Popup Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  const statusSection = document.getElementById('statusSection');
  const statusIndicator = document.getElementById('statusIndicator');
  const statusDot = statusIndicator.querySelector('.status-dot');
  const statusText = statusIndicator.querySelector('.status-text');
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const refreshModelsBtn = document.getElementById('refreshModelsBtn');

  // Check configuration status
  async function checkStatus() {
    const settings = await chrome.storage.local.get(['apiKey', 'selectedModel']);
    
    if (!settings.apiKey) {
      statusDot.className = 'status-dot error';
      statusText.textContent = 'API key not configured';
      return;
    }

    if (!settings.selectedModel) {
      statusDot.className = 'status-dot error';
      statusText.textContent = 'Model not selected';
      return;
    }

    statusDot.className = 'status-dot ready';
    statusText.textContent = `Ready! Using: ${settings.selectedModel.split('/')[1]}`;
  }

  // Open sidepanel
  openSettingsBtn.addEventListener('click', async () => {
    try {
      // Try to open sidepanel
      await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
      window.close();
    } catch (error) {
      // Fallback: open in new tab if sidepanel fails
      chrome.tabs.create({
        url: chrome.runtime.getURL('sidepanel/sidepanel.html')
      });
      window.close();
    }
  });

  // Refresh models list
  refreshModelsBtn.addEventListener('click', async () => {
    refreshModelsBtn.classList.add('loading');
    refreshModelsBtn.disabled = true;
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'fetchModels' });
      
      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message);
      }
      
      if (response.error) {
        alert('Error refreshing models: ' + response.error);
      } else {
        alert(`Successfully refreshed! Found ${response.models.length} free models.`);
        checkStatus();
      }
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      refreshModelsBtn.classList.remove('loading');
      refreshModelsBtn.disabled = false;
    }
  });

  // Initial status check
  checkStatus();
});
