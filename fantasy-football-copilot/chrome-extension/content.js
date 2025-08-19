// Content script for Yahoo Fantasy Football draft room
console.log('Yahoo Draft Companion content script loaded');

// Configuration
let teamMapping = {};
let syncButton = null;
let autoSyncEnabled = true;
let lastSyncedPicks = new Set(); // Track which picks we've already synced
let draftResultsObserver = null;
let autoSyncInterval = null;
let autoSyncDebounceTimer = null;
let isCurrentlySyncing = false;
let verificationInterval = null;
let lastVerificationTime = 0;

// Helper function to check if extension context is still valid
function isExtensionContextValid() {
  try {
    // Try to access chrome.runtime - if it throws, the context is invalidated
    return !!(chrome && chrome.runtime && chrome.runtime.id);
  } catch (error) {
    return false;
  }
}

// Global error handler for extension context invalidation
window.addEventListener('error', (event) => {
  if (event.error && event.error.message && event.error.message.includes('Extension context invalidated')) {
    console.log('Extension context invalidated globally, stopping all operations');
    stopAutoSync();
  }
});

// Initialize the extension
init();

async function init() {
  console.log('Initializing Yahoo Draft Companion...');
  
  // Check if extension context is valid before proceeding
  if (!isExtensionContextValid()) {
    console.log('Extension context invalidated, skipping initialization');
    return;
  }
  
  // Get settings from background script
  try {
    const settings = await new Promise((resolve, reject) => {
      if (!isExtensionContextValid()) {
        reject(new Error('Extension context invalidated'));
        return;
      }
      
      chrome.runtime.sendMessage({ type: 'get_settings' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
    
    teamMapping = settings.teamMapping || {};
    console.log('Team mapping loaded:', teamMapping);
  } catch (error) {
    console.error('Failed to load settings:', error);
    // Continue without settings if extension context is invalidated
    if (error.message.includes('Extension context invalidated')) {
      return;
    }
  }

  // Check if we're on the draft page
  if (isDraftPage()) {
    addSyncButton();
    
    // Start auto-sync if we're on the draft results tab
    setTimeout(() => {
      if (isDraftResultsTabActive()) {
        startAutoSync();
      }
    }, 2000);
  }
}

function isDraftPage() {
  return window.location.href.includes('/draftresults') || 
         window.location.href.includes('/draftclient') ||
         document.querySelector('[data-testid="draft-results"]') !== null ||
         document.querySelector('[id="draft"]') !== null;
}

function isDraftResultsTabActive() {
  // Check if we're on the draft results tab using the specific selector mentioned by user
  const draftResultsTab = document.querySelector('button[role="heading"][data-id="results"][aria-selected="true"] div._ys_1dbz5fh');
  if (draftResultsTab && draftResultsTab.textContent.includes('Draft Results')) {
    console.log('Draft Results tab is active');
    return true;
  }
  
  // Fallback check for other possible selectors
  const fallbackSelectors = [
    'button[data-id="results"][aria-selected="true"]',
    '[aria-selected="true"]',
    '.draft-results-tab[aria-selected="true"]',
    'button[aria-selected="true"]'
  ];
  
  for (const selector of fallbackSelectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      if (element && element.textContent?.includes('Draft Results')) {
        console.log('Draft Results tab detected via fallback selector:', selector);
        return true;
      }
    }
  }
  
  return false;
}

function hasResultsByRoundTable() {
  const table = document.querySelector('#results-by-round');
  return table !== null;
}

function startAutoSync() {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
  }
  
  console.log('Starting auto-sync monitoring...');
  
  // Check every 5 seconds for new picks when on draft results tab (increased from 3s to reduce load)
  autoSyncInterval = setInterval(() => {
    if (isDraftResultsTabActive() && hasResultsByRoundTable() && !isCurrentlySyncing) {
      debouncedCheckForNewPicks();
    }
  }, 5000);
  
  // Also set up a mutation observer for more immediate detection
  setupDraftResultsObserver();
  
  // Set up periodic verification to check for gaps every 2 minutes
  startPeriodicVerification();
}

// Debounced version of checkForNewPicks to prevent excessive sync calls
function debouncedCheckForNewPicks() {
  if (autoSyncDebounceTimer) {
    clearTimeout(autoSyncDebounceTimer);
  }
  
  autoSyncDebounceTimer = setTimeout(() => {
    if (!isCurrentlySyncing) {
      checkForNewPicks();
    }
  }, 1000); // Wait 1 second after last trigger before actually checking
}

function stopAutoSync() {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
    console.log('Auto-sync stopped');
  }
  
  if (autoSyncDebounceTimer) {
    clearTimeout(autoSyncDebounceTimer);
    autoSyncDebounceTimer = null;
  }
  
  if (draftResultsObserver) {
    draftResultsObserver.disconnect();
    draftResultsObserver = null;
  }
  
  if (verificationInterval) {
    clearInterval(verificationInterval);
    verificationInterval = null;
  }
}

function startPeriodicVerification() {
  if (verificationInterval) {
    clearInterval(verificationInterval);
  }
  
  // Check for draft completeness every 2 minutes
  verificationInterval = setInterval(() => {
    if (isDraftResultsTabActive() && !isCurrentlySyncing) {
      const now = Date.now();
      const timeSinceLastVerification = now - lastVerificationTime;
      
      // Only verify if it's been at least 90 seconds since last verification
      if (timeSinceLastVerification > 90000) {
        performPeriodicVerification();
      }
    }
  }, 120000); // 2 minutes
}

function performPeriodicVerification() {
  try {
    const allPicks = parseDraftPicks();
    if (allPicks.length < 10) {
      // Don't verify if draft is just starting (less than 10 picks)
      return;
    }
    
    lastVerificationTime = Date.now();
    
    // Check if we have a reasonable number of picks for verification
    const syncedCount = lastSyncedPicks.size;
    const availableCount = allPicks.length;
    
    console.log(`Periodic verification: ${syncedCount} synced, ${availableCount} available`);
    
    // If there's a significant discrepancy, do verification sync
    if (availableCount > syncedCount + 5) {
      console.log('Significant discrepancy detected - performing verification sync');
      performFullSyncWithGapFilling(allPicks);
    }
  } catch (error) {
    console.error('Error in periodic verification:', error);
  }
}

function setupDraftResultsObserver() {
  if (draftResultsObserver) {
    draftResultsObserver.disconnect();
  }
  
  const resultsTable = document.querySelector('#results-by-round');
  if (!resultsTable) {
    console.log('Results table not found for observer setup');
    return;
  }
  
  draftResultsObserver = new MutationObserver((mutations) => {
    let hasNewRows = false;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE && 
              (node.tagName === 'TR' || node.querySelector('tr'))) {
            hasNewRows = true;
          }
        });
      }
    });
    
    if (hasNewRows && isDraftResultsTabActive() && !isCurrentlySyncing) {
      console.log('New table rows detected, checking for new picks...');
      debouncedCheckForNewPicks(); // Use debounced version
    }
  });
  
  // Observe changes to the table body
  const tbody = resultsTable.querySelector('tbody') || resultsTable;
  draftResultsObserver.observe(tbody, {
    childList: true,
    subtree: true
  });
  
  console.log('Draft results observer set up');
}

function checkForNewPicks() {
  if (!autoSyncEnabled || !isDraftResultsTabActive() || isCurrentlySyncing) {
    return;
  }
  
  try {
    // Check if extension context is still valid
    if (!isExtensionContextValid()) {
      console.log('Extension context invalidated, stopping auto-sync');
      stopAutoSync();
      return;
    }
    
    const allPicks = parseDraftPicks();
    if (allPicks.length === 0) {
      return;
    }
    
    // Sort picks by overall pick number to ensure proper sequence
    allPicks.sort((a, b) => a.overall - b.overall);
    
    // Find picks that we haven't synced yet
    const newPicks = allPicks.filter(pick => {
      const pickId = `${pick.overall}-${pick.player}-${pick.team}`;
      return !lastSyncedPicks.has(pickId);
    });
    
    if (newPicks.length > 0) {
      console.log(`Found ${newPicks.length} new picks to sync:`, newPicks);
      
      // Check for gaps in the sequence and handle accordingly
      const picksWithGaps = ensureSequentialIntegrity(allPicks, newPicks);
      
      if (picksWithGaps.needsFullSync) {
        console.log('Gap detected in draft sequence - performing full sync to ensure completeness');
        performFullSyncWithGapFilling(allPicks);
      } else {
        syncNewPicks(picksWithGaps.incrementalPicks);
      }
    }
  } catch (error) {
    if (error.message && error.message.includes('Extension context invalidated')) {
      console.log('Extension context invalidated during sync, stopping auto-sync');
      stopAutoSync();
    } else {
      console.error('Error checking for new picks:', error);
    }
    isCurrentlySyncing = false; // Reset flag on error
  }
}

function ensureSequentialIntegrity(allPicks, newPicks) {
  // Get the current highest overall pick we've synced
  const syncedOveralls = Array.from(lastSyncedPicks).map(pickId => {
    const overall = parseInt(pickId.split('-')[0]);
    return isNaN(overall) ? 0 : overall;
  });
  
  const maxSyncedOverall = syncedOveralls.length > 0 ? Math.max(...syncedOveralls) : 0;
  const maxAvailableOverall = Math.max(...allPicks.map(p => p.overall));
  
  console.log(`Sequence check: maxSynced=${maxSyncedOverall}, maxAvailable=${maxAvailableOverall}`);
  
  // Check if there are gaps in the sequence
  const expectedRange = Array.from({length: maxAvailableOverall}, (_, i) => i + 1);
  const availableOveralls = allPicks.map(p => p.overall);
  const missingPicks = expectedRange.filter(overall => !availableOveralls.includes(overall));
  
  // Check if we have new picks that come before our max synced pick (indicating gaps)
  const hasGapsInSequence = newPicks.some(pick => pick.overall <= maxSyncedOverall);
  const hasMissingPicks = missingPicks.length > 0 && maxAvailableOverall > 10; // Only worry about gaps if we have substantial draft data
  
  if (hasGapsInSequence || hasMissingPicks) {
    console.log(`Gaps detected: hasGapsInSequence=${hasGapsInSequence}, missingPicks=${missingPicks.length}`);
    return {
      needsFullSync: true,
      incrementalPicks: newPicks,
      missingPicks: missingPicks
    };
  }
  
  // Filter to only truly new picks (after our max synced)
  const trulyNewPicks = newPicks.filter(pick => pick.overall > maxSyncedOverall);
  
  return {
    needsFullSync: false,
    incrementalPicks: trulyNewPicks,
    missingPicks: []
  };
}

function performFullSyncWithGapFilling(allPicks) {
  console.log('Performing full sync with gap filling to ensure draft completeness');
  
  // Check if extension context is still valid
  if (!isExtensionContextValid()) {
    console.log('Extension context invalidated, cannot perform full sync');
    isCurrentlySyncing = false;
    stopAutoSync();
    return;
  }
  
  // Send all picks as a complete sync to ensure no gaps
  chrome.runtime.sendMessage({
    type: 'full_sync_with_verification',
    data: allPicks
  }, (response) => {
    isCurrentlySyncing = false;
    
    if (response && response.success) {
      console.log('Full sync with gap filling successful:', response);
      
      // Update our synced picks set with all picks
      lastSyncedPicks.clear();
      allPicks.forEach(pick => {
        const pickId = `${pick.overall}-${pick.player}-${pick.team}`;
        lastSyncedPicks.add(pickId);
      });
      
      showNotification(`Draft synchronized: ${allPicks.length} picks verified`, 'success');
    } else {
      console.error('Full sync with gap filling failed:', response?.error);
      showNotification(`Sync failed: ${response?.error || 'Unknown error'}`, 'error');
    }
  });
}

function syncNewPicks(newPicks) {
  if (isCurrentlySyncing) {
    console.log('Sync already in progress, skipping...');
    return;
  }
  
  // Check if extension context is still valid
  if (!isExtensionContextValid()) {
    console.log('Extension context invalidated, cannot sync new picks');
    isCurrentlySyncing = false;
    stopAutoSync();
    return;
  }
  
  isCurrentlySyncing = true;
  console.log('Syncing new picks:', newPicks);
  
  // Limit batch size to prevent UI freezing
  const maxBatchSize = 10;
  const picksToSync = newPicks.slice(0, maxBatchSize);
  
  if (newPicks.length > maxBatchSize) {
    console.log(`Limiting sync to ${maxBatchSize} picks to prevent UI freeze. ${newPicks.length - maxBatchSize} picks will be synced in next batch.`);
  }
  
  // Send incremental sync to background script
  chrome.runtime.sendMessage({
    type: 'incremental_sync',
    data: picksToSync
  }, (response) => {
    isCurrentlySyncing = false; // Reset flag when done
    
    if (response && response.success) {
      console.log('Incremental sync successful:', response);
      
      // Mark these picks as synced
      picksToSync.forEach(pick => {
        const pickId = `${pick.overall}-${pick.player}-${pick.team}`;
        lastSyncedPicks.add(pickId);
      });
      
      // Show subtle notification for new picks (limit frequency)
      if (picksToSync.length <= 3) {
        showNotification(`Synced ${picksToSync.length} new draft pick${picksToSync.length > 1 ? 's' : ''}`, 'success');
      }
      
      // If there were more picks, schedule next batch
      if (newPicks.length > maxBatchSize) {
        setTimeout(() => {
          const remainingPicks = newPicks.slice(maxBatchSize);
          syncNewPicks(remainingPicks);
        }, 2000); // Wait 2 seconds before next batch
      }
    } else {
      console.error('Incremental sync failed:', response?.error);
      showNotification(`Failed to sync picks: ${response?.error || 'Unknown error'}`, 'error');
    }
  });
}

function addSyncButton() {
  // Remove existing button if it exists
  if (syncButton) {
    syncButton.remove();
  }
  
  // Try to find a good place to add the button
  const targetSelectors = [
    '#draft', // Main draft container
    '.draft-results', // Draft results section
    'body' // Fallback to body
  ];
  
  let targetContainer = null;
  for (const selector of targetSelectors) {
    targetContainer = document.querySelector(selector);
    if (targetContainer) {
      console.log(`Found target container: ${selector}`);
      break;
    }
  }
  
  if (!targetContainer) {
    console.log('No suitable container found for sync button');
    return;
  }
  
  // Create the sync button
  syncButton = document.createElement('div');
  syncButton.id = 'yahoo-draft-sync-button';
  syncButton.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    color: white;
    border: none;
    border-radius: 12px;
    padding: 12px 20px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: all 0.2s ease;
    user-select: none;
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  
  updateSyncButtonContent();
  
  // Add hover effects
  syncButton.addEventListener('mouseenter', () => {
    syncButton.style.transform = 'translateY(-2px)';
    syncButton.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.2)';
  });
  
  syncButton.addEventListener('mouseleave', () => {
    syncButton.style.transform = 'translateY(0)';
    syncButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  });
  
  // Add click handler with right-click for auto-sync toggle
  syncButton.addEventListener('click', handleSyncButtonClick);
  syncButton.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    toggleAutoSync();
  });
  
  // Add the button to the page
  document.body.appendChild(syncButton);
  
  console.log('Sync button added to page');
  
  // Also try to add a sync button near the Draft Results tab if we can find it
  setTimeout(() => {
    addInlineButton();
  }, 2000);
}

function addInlineButton() {
  const draftContainer = document.querySelector('#draft');
  if (!draftContainer) return;
  
  // Look for Draft Results tab or similar
  const draftResultsTab = draftContainer.querySelector('div._ys_1dbz5fh');
  if (draftResultsTab && draftResultsTab.textContent?.includes('Draft Results')) {
    const inlineButton = document.createElement('button');
    inlineButton.style.cssText = `
      margin-left: 12px;
      background: #10b981;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s ease;
    `;
    inlineButton.textContent = '↗ Sync to Copilot';
    inlineButton.addEventListener('click', handleManualSync);
    inlineButton.addEventListener('mouseenter', () => {
      inlineButton.style.background = '#059669';
    });
    inlineButton.addEventListener('mouseleave', () => {
      inlineButton.style.background = '#10b981';
    });
    
    draftResultsTab.appendChild(inlineButton);
    console.log('Inline sync button added to Draft Results tab');
  }
}

function handleManualSync() {
  console.log('Manual sync triggered');
  
  // Check if extension context is still valid
  if (!isExtensionContextValid()) {
    console.log('Extension context invalidated, cannot perform manual sync');
    showNotification('Extension context invalidated. Please reload the page.', 'error');
    return;
  }
  
  // Update button state to show loading
  const originalContent = syncButton.innerHTML;
  syncButton.style.background = '#f59e0b';
  syncButton.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin">
      <path d="M21 2v6h-6"></path>
      <path d="m3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
      <path d="M3 22v-6h6"></path>
      <path d="m21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
    </svg>
    Syncing...
  `;
  
  try {
    const picks = parseDraftPicks();
    
    if (picks.length === 0) {
      showNotification('No draft picks found. Make sure you\'re on the Draft Results tab.', 'warning');
      resetSyncButton(originalContent);
      return;
    }
    
    console.log(`Found ${picks.length} draft picks to sync:`, picks);
    
    // Use bulk sync instead of individual picks
    chrome.runtime.sendMessage({
      type: 'draft_sync',
      data: picks
    }, (response) => {
      if (response && response.success) {
        console.log('Bulk sync successful:', response);
        showNotification(`Successfully synced ${picks.length} draft picks!`, 'success');
        syncButton.style.background = '#10b981';
        syncButton.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 6L9 17l-5-5"></path>
          </svg>
          Synced!
        `;
        setTimeout(() => resetSyncButton(originalContent), 2000);
      } else {
        console.error('Bulk sync failed:', response?.error);
        showNotification(`Sync failed: ${response?.error || 'Unknown error'}`, 'error');
        resetSyncButton(originalContent);
      }
    });
    
  } catch (error) {
    console.error('Error during manual sync:', error);
    showNotification('Error syncing draft picks. Check console for details.', 'error');
    resetSyncButton(originalContent);
  }
}

function updateSyncButtonContent() {
  if (!syncButton) return;
  
  const isAutoSyncActive = autoSyncEnabled && isDraftResultsTabActive();
  const autoSyncStatus = isAutoSyncActive ? 'ON' : 'OFF';
  const statusColor = isAutoSyncActive ? '#10b981' : '#6b7280';
  
  syncButton.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"></path>
      <path d="M6 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"></path>
      <path d="M13 12h3l-4 4-4-4h3"></path>
    </svg>
    <div style="display: flex; flex-direction: column; align-items: flex-start; line-height: 1.2;">
      <span>Sync Draft Picks</span>
      <span style="font-size: 10px; color: ${statusColor}; font-weight: 500;">Auto: ${autoSyncStatus}</span>
    </div>
  `;
}

function handleSyncButtonClick() {
  if (isDraftResultsTabActive()) {
    // If on draft results tab, perform verification sync to ensure completeness
    console.log('Performing verification sync from button click');
    const allPicks = parseDraftPicks();
    if (allPicks.length > 0) {
      performFullSyncWithGapFilling(allPicks);
    } else {
      showNotification('No draft picks found to sync', 'warning');
    }
  } else {
    // If not on draft results tab, do full manual sync
    handleManualSync();
  }
}

function toggleAutoSync() {
  autoSyncEnabled = !autoSyncEnabled;
  console.log('Auto-sync toggled:', autoSyncEnabled ? 'enabled' : 'disabled');
  
  if (autoSyncEnabled && isDraftResultsTabActive()) {
    startAutoSync();
  } else {
    stopAutoSync();
  }
  
  updateSyncButtonContent();
  showNotification(`Auto-sync ${autoSyncEnabled ? 'enabled' : 'disabled'}`, 'success');
}

function resetSyncButton(originalContent) {
  syncButton.style.background = 'linear-gradient(135deg, #4f46e5, #7c3aed)';
  updateSyncButtonContent();
}

function parseDraftPicks() {
  const picks = [];
  
  // Look for the specific table with id="results-by-round"
  const resultsTable = document.querySelector('#results-by-round');
  if (resultsTable) {
    console.log('Found results-by-round table');
    return parseResultsByRoundTable(resultsTable);
  }
  
  console.log('results-by-round table not found, trying other methods...');
  
  // Fallback: First, try to find the Draft Results tab content specifically
  const draftContainer = document.querySelector('#draft');
  if (!draftContainer) {
    console.log('No draft container found (#draft)');
    return picks;
  }

  // Look for the Draft Results tab content
  const draftResultsTab = draftContainer.querySelector('div._ys_1dbz5fh');
  if (draftResultsTab && draftResultsTab.textContent?.includes('Draft Results')) {
    console.log('Found Draft Results tab');
    
    // Look for any table within the draft results area
    const draftResultsContainer = draftResultsTab.closest('div').parentElement;
    const tablesInResults = draftResultsContainer?.querySelectorAll('table');
    
    if (tablesInResults && tablesInResults.length > 0) {
      for (const table of tablesInResults) {
        const tableId = table.id;
        console.log(`Found table with id: ${tableId}`);
        if (tableId === 'results-by-round') {
          return parseResultsByRoundTable(table);
        }
      }
      
      // If no results-by-round table, try the first table we found
      console.log('Using first table found in Draft Results area');
      return parseResultsByRoundTable(tablesInResults[0]);
    }
  }
  
  console.log('No suitable tables found, trying generic fallback...');
  
  // Final fallback to original selectors
  const selectors = [
    '#draft table tbody tr',
    '#draft [role="table"] tr',
    '#draft div[class*="table"] div[class*="row"]',
    '[data-testid="draft-results"] tbody tr',
    '.draft-results tbody tr'
  ];
  
  let rows = null;
  for (const selector of selectors) {
    rows = document.querySelectorAll(selector);
    if (rows.length > 1) {
      console.log(`Found ${rows.length} rows using fallback selector: ${selector}`);
      break;
    }
  }
  
  if (!rows || rows.length <= 1) {
    console.log('No draft rows found');
    return picks;
  }
  
  return parseGenericDraftTable(rows);
}

function parseResultsByRoundTable(table) {
  const picks = [];
  console.log('Parsing results-by-round table...');
  
  // Look for tbody and rows
  const tbody = table.querySelector('tbody');
  const rows = tbody ? tbody.querySelectorAll('tr') : table.querySelectorAll('tr');
  console.log(`Found ${rows.length} rows in results-by-round table`);
  
  // Try to detect number of teams from the draft structure
  // Look at first round picks to determine league size
  let detectedTeams = 12; // Default
  const firstRoundPicks = [];
  
  // First pass: collect pick numbers to detect league size
  rows.forEach((row) => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 3) return;
    
    const pickCell = row.querySelector('td.Ta-c') || cells[0];
    if (pickCell) {
      const pickText = pickCell.textContent?.trim();
      if (pickText && /^\d+$/.test(pickText)) {
        const pickNum = parseInt(pickText);
        if (pickNum >= 1 && pickNum <= 20) { // First round picks
          firstRoundPicks.push(pickNum);
        }
      }
    }
  });
  
  // Determine league size from first round picks
  if (firstRoundPicks.length > 0) {
    const maxFirstRound = Math.max(...firstRoundPicks);
    if (maxFirstRound === 8) detectedTeams = 8;
    else if (maxFirstRound === 10) detectedTeams = 10;
    else if (maxFirstRound === 12) detectedTeams = 12;
    else if (maxFirstRound === 14) detectedTeams = 14;
    else if (maxFirstRound === 16) detectedTeams = 16;
    else if (maxFirstRound === 18) detectedTeams = 18;
    else if (maxFirstRound === 20) detectedTeams = 20;
  }
  
  console.log(`Detected ${detectedTeams} teams from first round picks:`, firstRoundPicks);
  
  // Log table structure for debugging
  console.log('Table structure:');
  Array.from(rows).slice(0, 5).forEach((row, i) => {
    const cells = Array.from(row.querySelectorAll('td')).map(cell => cell.textContent?.trim()).filter(text => text && text.length > 0);
    console.log(`Row ${i}:`, cells);
  });
  
  rows.forEach((row, index) => {
    try {
      // Get all cells in the row
      const cells = row.querySelectorAll('td');
      
      if (cells.length < 3) {
        console.log(`Row ${index}: Not enough cells (${cells.length}), skipping`);
        return; // Skip if not enough cells
      }
      
      // Based on the HTML structure provided:
      // Pick number should be in first cell with class "Ta-c" (text-align center)
      // Player info should be in cell with class "ys-player" 
      // Team name should be in cell with class "ys-team"
      
      let pickNumber = null;
      let playerInfo = null;
      let teamName = null;
      let cleanPlayerName = null;
      let position = '';
      let nflTeam = '';
      
      // Look for pick number in cells with "Ta-c" class or first cell
      const pickCell = row.querySelector('td.Ta-c') || cells[0];
      if (pickCell) {
        const pickText = pickCell.textContent?.trim();
        if (pickText && /^\d+$/.test(pickText)) {
          pickNumber = parseInt(pickText);
        }
      }
      
      // Look for player info in cell with "ys-player" class
      const playerCell = row.querySelector('td.ys-player');
      if (playerCell) {
        // Extract player name, team, and position from the specific Yahoo structure
        // <td class="ys-player">Justin Tucker<span class="Dimmed..."><abbr title="Baltimore Ravens">Bal</abbr><abbr title="Kicker">- K</abbr></span></td>
        
        const span = playerCell.querySelector('span');
        if (span) {
          // Get player name by cloning the cell and removing the span to get clean text
          const tempCell = playerCell.cloneNode(true);
          const tempSpan = tempCell.querySelector('span');
          if (tempSpan) {
            tempSpan.remove();
          }
          const playerName = tempCell.textContent?.trim() || '';
          
          // Alternative method: get all text nodes before the span
          let playerNameAlt = '';
          for (const node of playerCell.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
              playerNameAlt += node.textContent;
            } else if (node.tagName === 'SPAN') {
              break; // Stop when we hit the span
            }
          }
          playerNameAlt = playerNameAlt.trim();
          
          // Use the method that gives us a longer name (more complete)
          const finalPlayerName = playerNameAlt.length > playerName.length ? playerNameAlt : playerName;
          
          // Get team from first abbr title
          const teamAbbr = span.querySelector('abbr');
          const teamTitle = teamAbbr?.getAttribute('title') || '';
          
          // Get position from second abbr (after dash)
          const posAbbrs = span.querySelectorAll('abbr');
          const positionAbbr = posAbbrs[1];
          const positionText = positionAbbr?.textContent?.trim() || '';
          const parsedPosition = positionText.replace(/^[-\s]*/, ''); // Remove leading dash and spaces
          
          console.log(`Parsed ys-player cell: name="${finalPlayerName}" (alt: "${playerNameAlt}"), team="${teamTitle}", pos="${parsedPosition}"`);
          
          // Store the parsed data
          cleanPlayerName = finalPlayerName;
          nflTeam = teamTitle;
          position = parsedPosition === 'D/ST' ? 'DEF' : parsedPosition;
          
          // Use the parsed data directly instead of the full text
          playerInfo = finalPlayerName;
        } else {
          // Fallback to full text if structure is different
          playerInfo = playerCell.textContent?.trim();
        }
      }
      
      // Look for team name in cell with "ys-team" class
      const teamCell = row.querySelector('td.ys-team');
      if (teamCell) {
        teamName = teamCell.textContent?.trim();
      }
      
      // Fallback: if no specific classes found, use cell positions
      if (!pickNumber || !playerInfo || !teamName) {
        console.log(`Row ${index}: Using fallback cell parsing`);
        const cellTexts = Array.from(cells).map(cell => cell.textContent?.trim());
        
        // Try to find pick number (should be a number <= 300)
        if (!pickNumber) {
          for (const text of cellTexts) {
            if (text && /^\d+$/.test(text)) {
              const num = parseInt(text);
              if (num > 0 && num <= 300) {
                pickNumber = num;
                break;
              }
            }
          }
        }
        
        // Try to find player info (longest text that's not a number and not short)
        if (!playerInfo) {
          for (const text of cellTexts) {
            if (text && text.length > 3 && !/^\d+$/.test(text) && !text.match(/^[A-Z]{2,4}$/)) {
              playerInfo = text;
              break;
            }
          }
        }
        
        // Try to find team name (short uppercase text)
        if (!teamName) {
          for (const text of cellTexts) {
            if (text && text.length >= 2 && text.length <= 10 && text !== playerInfo) {
              teamName = text;
              break;
            }
          }
        }
      }
      
      console.log(`Row ${index}: Pick=${pickNumber}, Player="${playerInfo}", Team="${teamName}"`);
      
      // Validate we have the required data
      if (!pickNumber || !playerInfo || !teamName) {
        console.log(`Row ${index}: Missing required data, skipping`);
        return;
      }
      
      // Calculate round and pick using detected team count
      const overall = pickNumber;
      const round = Math.ceil(overall / detectedTeams);
      const pick = ((overall - 1) % detectedTeams) + 1;
      
      // Use fallback if we didn't get clean data from ys-player cell parsing
      if (!cleanPlayerName) {
        cleanPlayerName = playerInfo || '';
      }
      
      console.log(`Current parsing state: name="${cleanPlayerName}", pos="${position}", team="${nflTeam}"`);
      
      // Only do fallback parsing if we didn't get data from ys-player cell structure
      if (!position && !nflTeam && playerInfo) {
        console.log(`Fallback parsing for: "${playerInfo}"`);
        
        // Handle various fallback formats:
        // "Dak PrescottDal-" -> "Dak Prescott" + team "Dal"
        // "Player Name QB - BUF" -> "Player Name" + position "QB" + team "BUF"
        
        // First, try to match standard format with position
        const positionMatch = playerInfo.match(/^(.+?)\s+(QB|RB|WR|TE|K|DEF|D\/ST)(?:\s*[-\s]\s*([A-Z]{2,4}))?/i);
        if (positionMatch) {
          cleanPlayerName = positionMatch[1].trim();
          position = positionMatch[2].toUpperCase() === 'D/ST' ? 'DEF' : positionMatch[2].toUpperCase();
          nflTeam = positionMatch[3] ? positionMatch[3].toUpperCase() : '';
          console.log(`Fallback position match: name="${cleanPlayerName}", pos="${position}", team="${nflTeam}"`);
        } else {
          // Try to match team abbreviation pattern: 2-3 letters starting with capital followed by dash
          const teamDashMatch = playerInfo.match(/^(.+?)([A-Z][a-z]{1,2})-\s*$/);
          if (teamDashMatch) {
            cleanPlayerName = teamDashMatch[1].trim();
            nflTeam = teamDashMatch[2].toUpperCase();
            console.log(`Fallback team dash pattern: name="${cleanPlayerName}", team="${nflTeam}"`);
          } else {
            // Try all uppercase team abbreviations with dash
            const upperTeamDashMatch = playerInfo.match(/^(.+?)([A-Z]{2,3})-\s*$/);
            if (upperTeamDashMatch) {
              cleanPlayerName = upperTeamDashMatch[1].trim();
              nflTeam = upperTeamDashMatch[2].toUpperCase();
              console.log(`Fallback uppercase team dash: name="${cleanPlayerName}", team="${nflTeam}"`);
            }
          }
        }
      }
      
      // Map team name using team mapping
      const mappedTeam = teamMapping[teamName] || teamName;
      
      const pickData = {
        round,
        pick,
        overall,
        team: mappedTeam,
        player: cleanPlayerName,
        position,
        nflTeam,
        originalTeam: teamName
      };
      
      console.log('Created pick data:', pickData);
      picks.push(pickData);
      
    } catch (error) {
      console.error('Error parsing results-by-round row:', error, row);
    }
  });
  
  console.log(`Parsed ${picks.length} picks from results-by-round table`);
  return picks;
}

// Keep the old function as a fallback for other table structures
function parseDraftResultsTable(draftTable) {
  console.log('Using fallback draft results parsing...');
  return parseResultsByRoundTable(draftTable);
}

function parseGenericDraftTable(rows) {
  const picks = [];
  console.log('Parsing generic draft table...');
  
  // Detect league size from first round picks
  let detectedTeams = 12; // Default
  const firstRoundPicks = [];
  
  rows.forEach((row) => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 3) return;
    
    const cellTexts = Array.from(cells).map(cell => cell.textContent?.trim() || '');
    const pickNumber = cellTexts.find(text => /^\d+$/.test(text) && parseInt(text) <= 400);
    
    if (pickNumber) {
      const pickNum = parseInt(pickNumber);
      if (pickNum >= 1 && pickNum <= 20) { // First round picks
        firstRoundPicks.push(pickNum);
      }
    }
  });
  
  if (firstRoundPicks.length > 0) {
    const maxFirstRound = Math.max(...firstRoundPicks);
    if (maxFirstRound === 8) detectedTeams = 8;
    else if (maxFirstRound === 10) detectedTeams = 10;
    else if (maxFirstRound === 12) detectedTeams = 12;
    else if (maxFirstRound === 14) detectedTeams = 14;
    else if (maxFirstRound === 16) detectedTeams = 16;
    else if (maxFirstRound === 18) detectedTeams = 18;
    else if (maxFirstRound === 20) detectedTeams = 20;
  }
  
  console.log(`Detected ${detectedTeams} teams from generic table first round picks:`, firstRoundPicks);
  
  // This is the fallback parsing logic (simplified version of original)
  rows.forEach((row, index) => {
    try {
      const cells = row.querySelectorAll('td');
      if (cells.length < 3) return;
      
      const cellTexts = Array.from(cells).map(cell => cell.textContent?.trim() || '');
      console.log(`Fallback parsing row ${index}:`, cellTexts);
      
      // Basic parsing - adjust based on what we see
      let pickNumber = cellTexts.find(text => /^\d+$/.test(text) && parseInt(text) <= 400);
      let playerText = cellTexts.find(text => text.length > 3 && !(/^\d+$/.test(text)));
      let teamText = cellTexts.find(text => text.length >= 2 && text.length <= 10 && text !== playerText);
      
      if (pickNumber && playerText && teamText) {
        const overall = parseInt(pickNumber);
        
        const round = Math.ceil(overall / detectedTeams);
        const pick = ((overall - 1) % detectedTeams) + 1;
        
        const mappedTeam = teamMapping[teamText] || teamText;
        
        const pickData = {
          round,
          pick,
          overall,
          team: mappedTeam,
          player: playerText,
          position: '',
          nflTeam: '',
          originalTeam: teamText
        };
        
        picks.push(pickData);
      }
    } catch (error) {
      console.error('Error in fallback parsing:', error);
    }
  });
  
  return picks;
}

function sendDraftPick(pickData, callback) {
  console.log('Sending draft pick:', pickData);
  
  // Check if extension context is still valid
  if (!isExtensionContextValid()) {
    console.log('Extension context invalidated, cannot send draft pick');
    if (callback) callback(false);
    return;
  }
  
  chrome.runtime.sendMessage({
    type: 'draft_pick',
    data: pickData
  }, (response) => {
    if (response && response.success) {
      console.log('Draft pick sent successfully');
      if (!callback) {
        showNotification(`Pick sent: ${pickData.player} to ${pickData.team}`);
      }
      if (callback) callback(true);
    } else {
      console.error('Failed to send draft pick:', response?.error);
      if (!callback) {
        showNotification(`Failed to send pick: ${response?.error || 'Unknown error'}`, 'error');
      }
      if (callback) callback(false);
    }
  });
}

function showNotification(message, type = 'success') {
  // Create a notification element
  const notification = document.createElement('div');
  
  let bgColor, borderColor, textColor;
  switch (type) {
    case 'error':
      bgColor = '#fee';
      borderColor = '#fcc';
      textColor = '#c00';
      break;
    case 'warning':
      bgColor = '#fffbeb';
      borderColor = '#fed7aa';
      textColor = '#a16207';
      break;
    default: // success
      bgColor = '#efe';
      borderColor = '#cfc';
      textColor = '#080';
  }
  
  notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: ${bgColor};
    border: 1px solid ${borderColor};
    border-radius: 8px;
    padding: 12px 16px;
    color: ${textColor};
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 9999;
    max-width: 320px;
    word-wrap: break-word;
    transform: translateX(400px);
    transition: transform 0.3s ease-in-out;
  `;
  
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Slide in animation
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 10);
  
  // Remove after 4 seconds
  setTimeout(() => {
    notification.style.transform = 'translateX(400px)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 4000);
}

// Listen for page navigation and tab changes
let currentUrl = window.location.href;
let lastDraftResultsState = isDraftResultsTabActive();

function handlePageOrTabChange() {
  const urlChanged = window.location.href !== currentUrl;
  const draftResultsStateChanged = isDraftResultsTabActive() !== lastDraftResultsState;
  
  if (urlChanged) {
    currentUrl = window.location.href;
    console.log('Page changed:', currentUrl);
  }
  
  if (draftResultsStateChanged) {
    lastDraftResultsState = isDraftResultsTabActive();
    console.log('Draft Results tab state changed:', lastDraftResultsState);
    
    // Update button content to reflect current state
    updateSyncButtonContent();
    
    if (lastDraftResultsState && autoSyncEnabled) {
      console.log('Switched to Draft Results tab - starting auto-sync');
      startAutoSync();
    } else {
      console.log('Left Draft Results tab - stopping auto-sync');
      stopAutoSync();
    }
  }
  
  if (urlChanged) {
    if (isDraftPage() && !syncButton) {
      setTimeout(() => {
        addSyncButton();
        if (isDraftResultsTabActive() && autoSyncEnabled) {
          startAutoSync();
        }
      }, 1000);
    } else if (!isDraftPage() && syncButton) {
      stopAutoSync();
      syncButton.remove();
      syncButton = null;
    }
  }
}

setInterval(handlePageOrTabChange, 1000);