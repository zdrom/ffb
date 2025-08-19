// Background script for Yahoo Draft Companion
console.log('Yahoo Draft Companion background script loaded');

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);

  if (message.type === 'draft_pick') {
    // Send draft pick to local API server
    sendDraftPick(message.data)
      .then(response => {
        console.log('Draft pick sent successfully:', response);
        sendResponse({ success: true, response });
      })
      .catch(error => {
        console.error('Failed to send draft pick:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // Return true to indicate we'll send response asynchronously
    return true;
  }

  if (message.type === 'draft_sync') {
    // Send bulk draft sync to local API server
    sendDraftSync(message.data)
      .then(response => {
        console.log('Draft sync successful:', response);
        sendResponse({ success: true, response });
      })
      .catch(error => {
        console.error('Failed to sync draft:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // Return true to indicate we'll send response asynchronously
    return true;
  }

  if (message.type === 'incremental_sync') {
    // Send incremental draft sync to local API server
    sendIncrementalSync(message.data)
      .then(response => {
        console.log('Incremental sync successful:', response);
        sendResponse({ success: true, response });
      })
      .catch(error => {
        console.error('Failed to incremental sync:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // Return true to indicate we'll send response asynchronously
    return true;
  }

  if (message.type === 'full_sync_with_verification') {
    // Send full sync with gap verification to local API server
    sendFullSyncWithVerification(message.data)
      .then(response => {
        console.log('Full sync with verification successful:', response);
        sendResponse({ success: true, response });
      })
      .catch(error => {
        console.error('Failed to full sync with verification:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // Return true to indicate we'll send response asynchronously
    return true;
  }

  if (message.type === 'get_settings') {
    // Get settings from storage
    chrome.storage.sync.get(['apiUrl', 'teamMapping'], (result) => {
      sendResponse(result);
    });
    return true;
  }
});

async function sendDraftPick(pickData) {
  try {
    // Get API URL from settings (default to localhost:3001)
    const settings = await new Promise((resolve) => {
      chrome.storage.sync.get(['apiUrl'], (result) => {
        resolve(result);
      });
    });

    const apiUrl = settings.apiUrl || 'http://localhost:3001';
    
    const response = await fetch(`${apiUrl}/api/draft-pick`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pickData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Failed to connect to Draft Copilot API: ${error.message}`);
  }
}

async function sendDraftSync(picks) {
  try {
    // Get API URL from settings (default to localhost:3001)
    const settings = await new Promise((resolve) => {
      chrome.storage.sync.get(['apiUrl'], (result) => {
        resolve(result);
      });
    });

    const apiUrl = settings.apiUrl || 'http://localhost:3001';
    
    const response = await fetch(`${apiUrl}/api/draft-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ picks })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Failed to connect to Draft Copilot API: ${error.message}`);
  }
}

async function sendIncrementalSync(newPicks) {
  try {
    // Get API URL from settings (default to localhost:3001)
    const settings = await new Promise((resolve) => {
      chrome.storage.sync.get(['apiUrl'], (result) => {
        resolve(result);
      });
    });

    const apiUrl = settings.apiUrl || 'http://localhost:3001';
    
    const response = await fetch(`${apiUrl}/api/draft-incremental`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ picks: newPicks })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Failed to connect to Draft Copilot API: ${error.message}`);
  }
}

async function sendFullSyncWithVerification(allPicks) {
  try {
    // Get API URL from settings (default to localhost:3001)
    const settings = await new Promise((resolve) => {
      chrome.storage.sync.get(['apiUrl'], (result) => {
        resolve(result);
      });
    });

    const apiUrl = settings.apiUrl || 'http://localhost:3001';
    
    const response = await fetch(`${apiUrl}/api/draft-sync-verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ picks: allPicks })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Failed to connect to Draft Copilot API: ${error.message}`);
  }
}

// Show notification when extension is installed
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Yahoo Draft Companion installed');
    
    // Set default settings
    chrome.storage.sync.set({
      apiUrl: 'http://localhost:3001',
      teamMapping: {}
    });
  }
});