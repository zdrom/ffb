# Fantasy Football Draft Copilot

A comprehensive, real-time fantasy football draft companion that helps you make informed decisions during your draft. Features intelligent recommendations, positional alerts, team roster tracking, and Chrome extension integration for Yahoo Fantasy Football.

## Features

- **League & Draft Setup**: Configure scoring type, team count, draft position, and roster requirements
- **CSV Player Import**: Import custom player rankings and projections
- **Smart Recommendations**: AI-powered player suggestions based on team needs, tiers, ADP, and value
- **Real-time Team Rosters**: Visual grid showing all team rosters and needs
- **Position Run & Tier Alerts**: Alerts for positional runs and tier collapses with browser notifications
- **Yahoo Draft Sync**: Chrome extension automatically syncs Yahoo Fantasy draft picks
- **Data Persistence**: Auto-save draft state with import/export functionality
- **Value Detection**: Identifies value picks based on ADP vs. personal rankings
- **Bye Week Management**: Highlights bye week conflicts and playoff schedules

## Quick Start

### Development

```bash
# Install dependencies and start both server and client
npm install
npm start
```

This will start:
- **Draft Copilot Web App**: http://localhost:5173
- **API Server**: http://localhost:3001

### Production Build

```bash
# Build the web app and install server dependencies
npm run build:all

# Start the production server
npm run preview

# Or start just the API server
npm run server
```

## Chrome Extension Setup

The Yahoo Draft Companion Chrome extension automatically syncs draft picks from Yahoo Fantasy Football to your local Draft Copilot app.

### Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder from this project
5. The extension should now appear in your extensions list

### Configuration

1. Click the extension icon in your browser toolbar
2. Configure the API URL (default: `http://localhost:3001`)
3. Set up team mappings if your Yahoo team names differ from Draft Copilot names
4. Test the connection to ensure everything is working

### Usage

1. Start the Draft Copilot app (`npm start`)
2. Navigate to your Yahoo Fantasy Football draft room
3. Draft picks will automatically sync to your Draft Copilot app
4. Monitor the connection status in the Draft Copilot app

## CSV Import Format

Import player rankings using a CSV file with the following columns:

| Column | Required | Description |
|--------|----------|-------------|
| Name | ✓ | Player's full name |
| Position | ✓ | QB, RB, WR, TE, K, DEF |
| Team | ✓ | NFL team abbreviation |
| ADP | | Average Draft Position |
| Tier | | Player tier (1-10) |
| Bye Week | | Bye week number (1-18) |
| Rank | | Personal ranking |
| Projected Points | | Season projection |
| Playoff Schedule | | "Good", "Avg", or "Tough" |

### Example CSV Row
```csv
Name,Position,Team,ADP,Tier,Bye Week,Rank,Projected Points,Playoff Schedule
Josh Allen,QB,BUF,15.2,1,7,3,285.4,Good
```

## Draft Workflow

1. **Setup**: Configure league settings (scoring, teams, draft position)
2. **Import**: Upload player rankings CSV or use default rankings
3. **Draft**: Use recommendations and alerts to make informed picks
   - Monitor position runs and tier collapses
   - Track team rosters and needs in real-time
   - Get AI-powered recommendations based on value and team fit
   - Auto-sync picks from Yahoo (with Chrome extension)
4. **Export**: Download draft results and team rosters as CSV

## API Endpoints

The local API server provides endpoints for the Chrome extension:

- `GET /api/status` - Server status and connected clients
- `POST /api/draft-pick` - Submit a draft pick
- `POST /api/draft-reset` - Reset the draft
- `GET /health` - Health check

## Troubleshooting

### Chrome Extension Not Connecting

1. Ensure Draft Copilot app is running on the correct port
2. Check the API URL in extension settings
3. Verify CORS is enabled (automatic in development)
4. Check browser console for connection errors

### Yahoo Picks Not Syncing

1. Confirm you're on the Yahoo draft results page
2. Check team name mappings in extension settings
3. Verify player names match between Yahoo and your rankings
4. Monitor extension popup for connection status

### Import Errors

1. Verify CSV format matches expected columns
2. Check for special characters in player names
3. Ensure Position column uses valid values (QB, RB, WR, TE, K, DEF)
4. Remove empty rows from CSV file

## Development

Built with:
- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Build Tool**: Vite
- **Backend**: Node.js + Express + WebSockets
- **Extension**: Chrome Extension Manifest V3

### Project Structure

```
fantasy-football-copilot/
├── src/                    # React app source
│   ├── components/         # React components
│   ├── contexts/          # React contexts
│   ├── hooks/             # Custom hooks
│   ├── types/             # TypeScript types
│   └── utils/             # Utility functions
├── server/                # API server
├── chrome-extension/      # Chrome extension
└── public/               # Static assets
```

## License

This project is for personal use in fantasy football leagues. Feel free to modify and distribute.
