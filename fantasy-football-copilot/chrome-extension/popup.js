// Popup script for Yahoo Draft Companion
document.addEventListener('DOMContentLoaded', async () => {
  // Load saved settings
  await loadSettings();
  
  // Set up event listeners
  document.getElementById('save-settings').addEventListener('click', saveSettings);
  document.getElementById('test-connection').addEventListener('click', testConnection);
  document.getElementById('add-team-mapping').addEventListener('click', addTeamMapping);
  
  // Test connection on load
  testConnection();
});

async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get(['apiUrl', 'teamMapping']);
    
    document.getElementById('api-url').value = result.apiUrl || 'http://localhost:3001';
    
    const teamMapping = result.teamMapping || {};
    const container = document.getElementById('team-mapping-container');
    container.innerHTML = '';
    
    Object.entries(teamMapping).forEach(([yahoo, copilot]) => {
      addTeamMappingRow(yahoo, copilot);
    });
    
    // Add one empty row if no mappings exist
    if (Object.keys(teamMapping).length === 0) {
      addTeamMappingRow('', '');
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

async function saveSettings() {
  try {
    const apiUrl = document.getElementById('api-url').value.trim();
    
    // Collect team mappings
    const teamMapping = {};
    const mappingRows = document.querySelectorAll('.team-mapping-row');
    
    mappingRows.forEach(row => {
      const yahooInput = row.querySelector('.yahoo-team');
      const copilotInput = row.querySelector('.copilot-team');
      
      if (yahooInput.value.trim() && copilotInput.value.trim()) {
        teamMapping[yahooInput.value.trim()] = copilotInput.value.trim();
      }
    });
    
    await chrome.storage.sync.set({
      apiUrl,
      teamMapping
    });
    
    // Show success feedback
    const button = document.getElementById('save-settings');
    const originalText = button.textContent;
    button.textContent = 'Saved!';
    button.style.background = '#10b981';
    
    setTimeout(() => {
      button.textContent = originalText;
      button.style.background = '#3b82f6';
    }, 1500);
    
  } catch (error) {
    console.error('Error saving settings:', error);
    
    // Show error feedback
    const button = document.getElementById('save-settings');
    const originalText = button.textContent;
    button.textContent = 'Error!';
    button.style.background = '#ef4444';
    
    setTimeout(() => {
      button.textContent = originalText;
      button.style.background = '#3b82f6';
    }, 1500);
  }
}

async function testConnection() {
  const statusElement = document.getElementById('status');
  const statusText = document.getElementById('status-text');
  const button = document.getElementById('test-connection');
  
  statusText.textContent = 'Testing connection...';
  statusElement.className = 'status disconnected';
  button.disabled = true;
  
  try {
    const apiUrl = document.getElementById('api-url').value.trim() || 'http://localhost:3001';
    
    const response = await fetch(`${apiUrl}/api/status`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      statusText.textContent = `Connected - ${data.clients} client(s) connected`;
      statusElement.className = 'status connected';
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    statusText.textContent = `Connection failed: ${error.message}`;
    statusElement.className = 'status disconnected';
  } finally {
    button.disabled = false;
  }
}

function addTeamMapping() {
  addTeamMappingRow('', '');
}

function addTeamMappingRow(yahooTeam = '', copilotTeam = '') {
  const container = document.getElementById('team-mapping-container');
  
  const row = document.createElement('div');
  row.className = 'team-mapping-row';
  row.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px; align-items: center;';
  
  row.innerHTML = `
    <input 
      type="text" 
      class="yahoo-team" 
      placeholder="Yahoo team name" 
      value="${yahooTeam}"
      style="flex: 1; margin-bottom: 0;"
    />
    <span style="color: #6b7280;">→</span>
    <input 
      type="text" 
      class="copilot-team" 
      placeholder="Copilot team name" 
      value="${copilotTeam}"
      style="flex: 1; margin-bottom: 0;"
    />
    <button 
      type="button" 
      class="remove-mapping"
      style="width: auto; padding: 6px 10px; background: #ef4444; margin-bottom: 0; font-size: 12px;"
    >×</button>
  `;
  
  // Add remove functionality
  row.querySelector('.remove-mapping').addEventListener('click', () => {
    row.remove();
  });
  
  container.appendChild(row);
}