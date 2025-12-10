# 🚀 INSTALLATION & SETUP GUIDE

## Quick Start (30 seconds)

1. **Navigate to the folder:**
   ```
   C:\worldbox-clone\
   ```

2. **Double-click one of these files:**
   - `launcher.html` (Start here - Shows all options)
   - `index.html` (Jump straight to the game)
   - `quickstart.html` (Learn how to play)

3. **Enjoy!** 🎮

That's it! No installation, no setup, no dependencies. Just open and play!

---

## How to Open Files

### Option 1: Double-Click (Easiest)
Simply double-click any `.html` file in the folder. Your default browser will open the game.

### Option 2: Right-Click Menu
1. Right-click the HTML file
2. Select "Open with"
3. Choose your browser
4. Click "OK"

### Option 3: Browser Address Bar
1. Open your web browser
2. Press `Ctrl + L` to focus the address bar
3. Type: `file:///C:/worldbox-clone/index.html`
4. Press Enter

### Option 4: Terminal/PowerShell
```powershell
# Navigate to folder
cd C:\worldbox-clone

# Open launcher (shows all options)
.\launcher.html

# Or open game directly
.\index.html

# Or open guide
.\quickstart.html
```

---

## File Purposes

### 🎮 Game Files
- **`launcher.html`** - Welcome screen with all options
- **`index.html`** - Main game interface (the actual game)
- **`game.js`** - Game logic and mechanics
- **`spriteGenerator.js`** - Creates pixel art graphics
- **`styles.css`** - Beautiful UI styling

### 📖 Documentation Files
- **`quickstart.html`** - Interactive tutorial (5 minutes)
- **`README.md`** - Complete documentation
- **`FEATURES.md`** - Detailed feature list
- **`CUSTOMIZATION.md`** - How to modify the game

### 📋 This File
- **`SETUP.md`** - Installation instructions

---

## Recommended First Steps

### For New Players:
1. Open `launcher.html` first
2. Click "Quick Start" to learn the controls
3. Click "Play Game" to launch `index.html`
4. Click "Generate Terrain" to create a world
5. Spawn some creatures and watch them live!

### For Experienced Players:
1. Open `index.html` directly
2. Skip to "Generate Terrain"
3. Start playing immediately

### For Developers/Modders:
1. Open `CUSTOMIZATION.md`
2. Learn how to modify game behavior
3. Edit `game.js` with your changes
4. Test in the browser

---

## Supported Browsers

✓ **Chrome/Chromium** (Recommended - Best performance)
✓ **Firefox** (Great performance)
✓ **Edge** (Good performance)
✓ **Safari** (Works fine)
✓ **Any modern browser** with Canvas 2D support

> Recommended: Chrome for best performance and visuals

---

## Troubleshooting

### Game Won't Load?
**Solution:** Make sure all 4 files are in the same folder:
- `index.html`
- `game.js`
- `spriteGenerator.js`
- `styles.css`

### Slow/Choppy Performance?
**Solution:**
1. Close other browser tabs
2. Use Chrome instead of other browsers
3. Reduce number of creatures (Clear World, then spawn less)
4. Reduce brush size
5. Lower game speed temporarily

### Graphics Look Blurry?
**Solution:** This is normal pixel art! It's supposed to look pixelated.
If you want less blur:
- Full-screen the game window
- Use Chrome browser
- Zoom in with Ctrl + Plus

### Creatures Not Moving?
**Solution:** Check if the game is paused!
- Click the ⏸️ Pause button to resume

### Where's the Sound?
**Solution:** This version focuses on visuals. Sound can be added later as an enhancement.

---

## System Requirements

✓ Windows, Mac, or Linux
✓ Any modern web browser
✓ JavaScript enabled (always is by default)
✓ Display resolution: 1280x720 or higher
✓ RAM: 512MB minimum (typical usage <50MB)
✓ No internet connection required (fully offline)

---

## Optional: Creating Desktop Shortcut

### Windows Shortcut:
1. Right-click on `index.html`
2. Select "Create shortcut"
3. Move to Desktop
4. Double-click anytime to play!

### Or Create Batch File:
Create a file named `play.bat` in the folder with this content:
```batch
@echo off
start index.html
```
Then double-click `play.bat` to launch the game!

---

## Multiple Game Windows

You can open multiple instances:
- Each window has its own separate game world
- Pause one window without affecting others
- Useful for comparing different simulations
- Great for testing different strategies

---

## Backing Up Your Game

### Before Modifying:
1. Copy the entire `worldbox-clone` folder
2. Name it `worldbox-clone-backup`
3. Safe to experiment with the original now

### Reverting Changes:
1. Delete your modified folder
2. Copy files from the backup
3. Back to original working version!

---

## File Size & Download

Total Project Size: **~85 KB** (All files combined)
- Tiny enough to email to a friend
- Fast to download
- Easy to backup
- Portable to any computer

---

## Next Steps

1. **Run the game:** Open `launcher.html`
2. **Learn the controls:** Read `quickstart.html`
3. **Explore features:** Play `index.html`
4. **Customize:** Edit files as described in `CUSTOMIZATION.md`
5. **Have fun!** 🎮

---

## Tips for Best Experience

1. **Full Screen:** Press F11 in browser for immersive experience
2. **Zoom Out:** Ctrl + Minus to see more of the world
3. **Zoom In:** Ctrl + Plus for larger sprites
4. **Theme:** Use dark mode browser theme for better visuals
5. **Focus:** Minimize distractions for best experience

---

## Getting Help

### If Something Doesn't Work:
1. Check the browser console (F12 key)
2. Look for red error messages
3. Try a different browser
4. Make sure all files are in the same folder
5. Check file names (they must be exact)

### Browser Console:
Press `F12` during gameplay to see:
- Any error messages
- Game statistics
- Performance data
- Debug information

---

## Advanced Setup (Optional)

### Using a Local Web Server:
If you want to serve the game locally:

```bash
# Python 3
python -m http.server 8000

# Then visit: http://localhost:8000
```

**Why:** Slightly better performance, more professional feel.

---

## Sharing With Others

To share the game:
1. Zip the entire `worldbox-clone` folder
2. Send to your friend
3. They extract and open `index.html`
4. That's it! They can play immediately

---

## Performance Optimization Tips

For Smooth Gameplay:
- Close Chrome extensions (they can slow it down)
- Don't run other intensive programs
- Use a modern browser (Chrome recommended)
- Full-screen for better performance
- Reduce number of creatures if needed

---

## Privacy & Security

✓ **100% Local** - No data sent anywhere
✓ **No Tracking** - We don't track anything
✓ **No Ads** - Completely ad-free
✓ **No Internet** - Works fully offline
✓ **Safe to Modify** - Edit the code as you wish

---

## License & Distribution

✓ **Free to Use** - No payment required
✓ **Free to Modify** - Change anything you want
✓ **Free to Share** - Give to friends
✓ **No Attribution Required** - But appreciated!
✓ **Commercial Use** - You can use it commercially

---

## Version Information

- **Version:** 1.0
- **Release Date:** 2025
- **Status:** Complete & Stable
- **Last Updated:** 2025
- **Support:** Self-documenting code with comments

---

## Quick Reference Commands

```powershell
# Navigate to folder
cd C:\worldbox-clone

# Open launcher (shows all options)
explorer.exe launcher.html

# Open game directly
explorer.exe index.html

# List all files
Get-ChildItem

# Get file sizes
Get-ChildItem | Format-Table Name, @{Label="Size (KB)";Expression={[math]::round($_.Length/1KB, 2)}}
```

---

## Still Have Questions?

1. Read `quickstart.html` - Interactive tutorial
2. Check `README.md` - Complete documentation
3. Look at `FEATURES.md` - Full feature list
4. See `CUSTOMIZATION.md` - Modification guide
5. Examine code comments - Well documented

---

**Ready to Play?** 🚀

Open `launcher.html` now and start creating worlds!

Enjoy your Worldbox experience! 🌍✨

---

Last Updated: 2025
Made with ❤️ using vanilla JavaScript
