# 🧹 Quick Storage Cleanup Instructions

## The Issue
Your browser's localStorage has reached its quota limit due to auto-saving large VORP player databases repeatedly.

## Quick Fix
**Open your browser's developer console** and run this command:

```javascript
// Clear all draft copilot storage
Object.keys(localStorage).forEach(key => {
  if (key.includes('fantasy-draft-copilot')) {
    localStorage.removeItem(key);
  }
});
console.log('Storage cleaned!');
```

## Or Manual Cleanup
1. Open Chrome DevTools (F12)
2. Go to **Application** tab
3. Click **Local Storage** → **localhost:5175**
4. Delete all keys that start with `fantasy-draft-copilot`

## What I Fixed
- **Disabled auto-save** temporarily to prevent quota issues
- **Added automatic cleanup** that keeps only 5 recent drafts
- **Reduced storage size** by not saving huge player databases
- **Added better error handling** for storage issues

## The Real Issue
The main problem is that you need to **import your VORP rankings first** before syncing Yahoo picks. The error messages show:

```
Pick 1: Player not found in rankings: Tyreek Hill
Pick 2: Player not found in rankings: Jayden Daniels
...
```

This means the VORP rankings database is empty!

## Next Steps
1. **Clear the storage** using the command above
2. **Import your VORP rankings** using the paste interface
3. **Then sync your Yahoo draft picks**
4. The players should now match correctly!