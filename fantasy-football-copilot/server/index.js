const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());

// Store connected clients and draft picks
const clients = new Set();
const draftPicks = [];

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected');
  clients.add(ws);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received message:', data);
      
      // Broadcast to all connected clients
      broadcast(data);
    } catch (error) {
      console.error('Invalid JSON received:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });

  // Send initial connection confirmation
  ws.send(JSON.stringify({
    type: 'connection',
    status: 'connected',
    timestamp: new Date().toISOString()
  }));
});

// Broadcast message to all connected clients
function broadcast(data) {
  const message = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// REST API endpoints
app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    clients: clients.size,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.post('/api/draft-pick', (req, res) => {
  try {
    const { player, team, round, pick, overall, position, nflTeam } = req.body;
    
    if (!player || !team) {
      return res.status(400).json({
        error: 'Missing required fields: player and team'
      });
    }

    const pickData = {
      player,
      team,
      round: round || Math.ceil(draftPicks.length / 12) + 1,
      pick: pick || (draftPicks.length % 12) + 1,
      overall: overall || draftPicks.length + 1,
      position: position || '',
      nflTeam: nflTeam || '',
      timestamp: new Date().toISOString(),
      id: Date.now() + Math.random() // Simple ID generation
    };

    // Store the pick
    draftPicks.push(pickData);

    const draftPick = {
      type: 'draft_pick',
      data: pickData
    };

    // Broadcast to all WebSocket clients
    broadcast(draftPick);

    console.log(`Draft pick recorded: ${pickData.player} (${pickData.position}) to ${pickData.team}`);

    res.json({
      success: true,
      message: 'Draft pick recorded and broadcasted',
      data: pickData
    });
  } catch (error) {
    console.error('Error processing draft pick:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// New endpoint for bulk sync - replaces all draft picks
app.post('/api/draft-sync', (req, res) => {
  try {
    const { picks } = req.body;
    
    if (!Array.isArray(picks)) {
      return res.status(400).json({
        error: 'picks must be an array'
      });
    }

    // Clear existing picks and replace with new ones
    draftPicks.length = 0;
    
    const processedPicks = picks.map((pick, index) => {
      if (!pick.player || !pick.team) {
        throw new Error(`Pick ${index + 1} missing required fields: player and team`);
      }
      
      return {
        player: pick.player,
        team: pick.team,
        round: pick.round || Math.ceil((index + 1) / 12),
        pick: pick.pick || ((index) % 12) + 1,
        overall: pick.overall || index + 1,
        position: pick.position || '',
        nflTeam: pick.nflTeam || '',
        timestamp: new Date().toISOString(),
        id: Date.now() + Math.random() + index
      };
    });

    // Store all picks
    draftPicks.push(...processedPicks);

    // Broadcast draft sync event
    const syncMessage = {
      type: 'draft_sync',
      data: {
        picks: processedPicks,
        total: processedPicks.length
      }
    };
    
    broadcast(syncMessage);

    console.log(`Draft sync completed: ${processedPicks.length} picks replaced`);

    res.json({
      success: true,
      message: `Draft synchronized with ${processedPicks.length} picks`,
      data: {
        picks: processedPicks,
        total: processedPicks.length
      }
    });
  } catch (error) {
    console.error('Error processing draft sync:', error);
    res.status(500).json({
      error: error.message || 'Internal server error'
    });
  }
});

app.post('/api/draft-reset', (req, res) => {
  try {
    // Clear stored picks
    draftPicks.length = 0;

    const resetMessage = {
      type: 'draft_reset',
      timestamp: new Date().toISOString()
    };

    broadcast(resetMessage);

    console.log('Draft reset - all picks cleared');

    res.json({
      success: true,
      message: 'Draft reset and picks cleared'
    });
  } catch (error) {
    console.error('Error processing draft reset:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// API endpoint to get all draft picks
app.get('/api/picks', (req, res) => {
  res.json({
    picks: draftPicks,
    total: draftPicks.length,
    timestamp: new Date().toISOString()
  });
});

// Main dashboard page
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Draft Copilot Server - Draft Monitor</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8fafc;
            color: #1f2937;
            line-height: 1.6;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        .header {
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            margin-bottom: 30px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5rem;
            color: #1f2937;
            margin-bottom: 10px;
        }
        
        .status {
            display: inline-flex;
            align-items: center;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 500;
            font-size: 0.9rem;
        }
        
        .status.connected {
            background: #ecfdf5;
            color: #065f46;
            border: 1px solid #d1fae5;
        }
        
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #10b981;
            margin-right: 8px;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            text-align: center;
        }
        
        .stat-number {
            font-size: 2rem;
            font-weight: 700;
            color: #3b82f6;
            margin-bottom: 5px;
        }
        
        .stat-label {
            color: #6b7280;
            font-size: 0.9rem;
        }
        
        .picks-container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        
        .picks-header {
            padding: 20px;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .picks-title {
            font-size: 1.25rem;
            font-weight: 600;
        }
        
        .refresh-btn {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: background 0.2s;
        }
        
        .refresh-btn:hover {
            background: #2563eb;
        }
        
        .picks-table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .picks-table th {
            background: #f9fafb;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: #374151;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .picks-table td {
            padding: 12px;
            border-bottom: 1px solid #f3f4f6;
        }
        
        .picks-table tbody tr:hover {
            background: #f9fafb;
        }
        
        .position-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .pos-qb { background: #fef2f2; color: #991b1b; }
        .pos-rb { background: #f0fdf4; color: #166534; }
        .pos-wr { background: #eff6ff; color: #1d4ed8; }
        .pos-te { background: #fefce8; color: #a16207; }
        .pos-k { background: #faf5ff; color: #7c3aed; }
        .pos-def { background: #f3f4f6; color: #374151; }
        
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #6b7280;
        }
        
        .empty-icon {
            font-size: 3rem;
            margin-bottom: 16px;
        }
        
        .footer {
            text-align: center;
            margin-top: 40px;
            padding: 20px;
            color: #6b7280;
            font-size: 0.9rem;
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }
            
            .header h1 {
                font-size: 2rem;
            }
            
            .picks-table {
                font-size: 0.9rem;
            }
            
            .picks-table th,
            .picks-table td {
                padding: 8px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏈 Draft Copilot Server</h1>
            <p>Real-time draft monitoring and synchronization</p>
            <div class="status connected" id="status">
                <div class="status-dot"></div>
                Server Active
            </div>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number" id="totalPicks">-</div>
                <div class="stat-label">Total Picks</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="connectedClients">-</div>
                <div class="stat-label">Connected Clients</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="currentRound">-</div>
                <div class="stat-label">Current Round</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="uptime">-</div>
                <div class="stat-label">Server Uptime</div>
            </div>
        </div>
        
        <div class="picks-container">
            <div class="picks-header">
                <div class="picks-title">Draft Picks</div>
                <div style="display: flex; gap: 12px;">
                    <button class="clear-btn" onclick="clearDraft()" style="
                        background: #ef4444;
                        color: white;
                        border: none;
                        padding: 8px 16px;
                        border-radius: 6px;
                        cursor: pointer;
                        font-size: 0.9rem;
                        transition: background 0.2s;
                    " onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='#ef4444'">Clear All</button>
                    <button class="refresh-btn" onclick="loadData()">Refresh</button>
                </div>
            </div>
            
            <div id="picksContent">
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <h3>Loading draft data...</h3>
                    <p>Draft picks from the Chrome extension will appear here</p>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p>Draft Copilot Server • Last updated: <span id="lastUpdate">-</span></p>
        </div>
    </div>

    <script>
        let ws = null;
        
        function formatUptime(seconds) {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            if (hours > 0) {
                return hours + 'h ' + minutes + 'm';
            }
            return minutes + 'm';
        }
        
        function formatTimestamp(timestamp) {
            return new Date(timestamp).toLocaleString();
        }
        
        function getPositionClass(position) {
            return 'pos-' + (position || 'unknown').toLowerCase();
        }
        
        async function loadData() {
            try {
                // Load picks
                const picksResponse = await fetch('/api/picks');
                const picksData = await picksResponse.json();
                
                // Load status
                const statusResponse = await fetch('/api/status');
                const statusData = await statusResponse.json();
                
                // Update stats
                document.getElementById('totalPicks').textContent = picksData.total;
                document.getElementById('connectedClients').textContent = statusData.clients;
                document.getElementById('currentRound').textContent = 
                    picksData.total > 0 ? Math.ceil(picksData.total / 12) : 1;
                document.getElementById('uptime').textContent = formatUptime(statusData.uptime);
                document.getElementById('lastUpdate').textContent = formatTimestamp(new Date());
                
                // Update picks table
                const picksContent = document.getElementById('picksContent');
                
                if (picksData.picks.length === 0) {
                    picksContent.innerHTML = \`
                        <div class="empty-state">
                            <div class="empty-icon">📋</div>
                            <h3>No draft picks yet</h3>
                            <p>Draft picks from the Chrome extension will appear here</p>
                        </div>
                    \`;
                } else {
                    const tableHTML = \`
                        <table class="picks-table">
                            <thead>
                                <tr>
                                    <th>Overall</th>
                                    <th>Round</th>
                                    <th>Pick</th>
                                    <th>Team</th>
                                    <th>Player</th>
                                    <th>Position</th>
                                    <th>NFL Team</th>
                                    <th>Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                \${picksData.picks.map(pick => \`
                                    <tr>
                                        <td><strong>\${pick.overall}</strong></td>
                                        <td>\${pick.round}</td>
                                        <td>\${pick.pick}</td>
                                        <td>\${pick.team}</td>
                                        <td><strong>\${pick.player}</strong></td>
                                        <td>
                                            \${pick.position ? \`<span class="position-badge \${getPositionClass(pick.position)}">\${pick.position}</span>\` : '-'}
                                        </td>
                                        <td>\${pick.nflTeam || '-'}</td>
                                        <td>\${formatTimestamp(pick.timestamp)}</td>
                                    </tr>
                                \`).join('')}
                            </tbody>
                        </table>
                    \`;
                    picksContent.innerHTML = tableHTML;
                }
            } catch (error) {
                console.error('Error loading data:', error);
                document.getElementById('picksContent').innerHTML = \`
                    <div class="empty-state">
                        <div class="empty-icon">⚠️</div>
                        <h3>Error loading data</h3>
                        <p>Failed to load draft picks. Please refresh the page.</p>
                    </div>
                \`;
            }
        }
        
        async function clearDraft() {
            if (!confirm('Are you sure you want to clear all draft picks? This action cannot be undone.')) {
                return;
            }
            
            try {
                const response = await fetch('/api/draft-reset', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });
                
                if (response.ok) {
                    console.log('Draft cleared successfully');
                    // Reload the data to show empty state
                    loadData();
                    
                    // Show success feedback
                    const clearBtn = document.querySelector('.clear-btn');
                    const originalText = clearBtn.textContent;
                    clearBtn.textContent = 'Cleared!';
                    clearBtn.style.background = '#10b981';
                    setTimeout(() => {
                        clearBtn.textContent = originalText;
                        clearBtn.style.background = '#ef4444';
                    }, 2000);
                } else {
                    const errorData = await response.json();
                    console.error('Failed to clear draft:', errorData);
                    alert('Failed to clear draft: ' + (errorData.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Error clearing draft:', error);
                alert('Error clearing draft: ' + error.message);
            }
        }
        
        function connectWebSocket() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = protocol + '//' + window.location.host;
            
            ws = new WebSocket(wsUrl);
            
            ws.onopen = function() {
                console.log('WebSocket connected');
            };
            
            ws.onmessage = function(event) {
                const data = JSON.parse(event.data);
                if (data.type === 'draft_pick' || data.type === 'draft_reset' || data.type === 'draft_sync') {
                    // Reload data when new picks arrive or draft is synced
                    setTimeout(loadData, 500);
                }
            };
            
            ws.onclose = function() {
                console.log('WebSocket disconnected, attempting to reconnect...');
                setTimeout(connectWebSocket, 3000);
            };
        }
        
        // Initialize
        loadData();
        connectWebSocket();
        
        // Auto-refresh every 30 seconds
        setInterval(loadData, 30000);
    </script>
</body>
</html>
  `);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Draft Copilot API server running on port ${PORT}`);
  console.log(`WebSocket server ready for connections`);
  console.log(`REST API available at http://localhost:${PORT}/api`);
});