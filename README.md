# 🚀 Kaspersky's Inventions | Tanki Online

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Tampermonkey](https://img.shields.io/badge/Tampermonkey-00485B?style=for-the-badge&logo=tampermonkey&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)

**Kaspersky's Inventions for Tanki Online** is a comprehensive suite of client-side userscripts designed to heavily enhance the UI, UX, and overall quality of life in the browser game [Tanki Online](https://tankionline.com/). 

Originally written in JavaScript and completely refactored into strict **TypeScript**, this project provides seamless integration, high performance, and safe DOM manipulation without interfering with the game's core network mechanics.

## ✨ Features Breakdown

### ⚔️ Battle History (`kasp_battleHistory`)
A fully local, IndexedDB-powered battle tracking system.
* **Auto-Tracking:** Automatically records your battle results (K/D, score, crystals, stars, map, mode, and equipment).
* **Smart UI:** Injects a beautiful history table directly into the main menu with pagination.
* **Data Management:** Export your entire history to a `.json` file or import it back. Perfect for analyzing your long-term performance.

### ⚙️ Automatic Item Improvement (`kasp_autoUpgrade`)
Tired of clicking "Upgrade" hundreds of times? 
* Adds custom **x5, x10, x15, and MAX** upgrade buttons to the garage UI.
* **Ruby Protection:** Automatically detects if you run out of crystals and cancels the process instantly if the game prompts you to spend premium Rubies.

### 🔍 Augment Specs Revealer (`kasp_augments`)
Knowledge is power. This script injects hidden, mathematically accurate statistics into the augment description cards.
* See exact percentages, multipliers, and hidden effects for Turret and Hull augments.
* Displays detailed advantages and disadvantages directly in the garage.

### 🎨 Selected Friends & Clan Tags (`kasp_friends`)
Organize your friends list with custom color-coded rarity tags.
* Adds a sidebar to filter players (Online, Offline, Clan, Custom Categories).
* Right-click a player's context menu to assign them a specific rarity tier (Purple, Yellow, Red) saved locally.

### 🕹️ Extended Play Button (`kasp_playButton`)
Revamps the main menu "Play" button into a massive, interactive hub.
* Gives instant 1-click access to all matchmaking modes (PRO Battles, CTF, TDM, JGR, etc.).
* Syncs with the matchmaking state (locks buttons while searching).

### 💎 Minimalist Currency UI (`kasp_layout`)
Cleans up the top navigation bar by merging and restructuring the crystals, rubies, and stars display for a sleek, modern look.

## 🛠️ Installation Guide (For Users)

If you just want to use the mods, you don't need to compile anything!

1. Install a userscript manager extension for your browser (e.g., [Tampermonkey](https://www.tampermonkey.net/) for Chrome/Edge/Firefox).
2. Go to the `dist` folder in this repository.
3. Open any `.js` file (for example, `kasp_autoUpgrade.js`).
4. Click the **Raw** button in the top right corner of the code view.
5. Tampermonkey will automatically detect the script and prompt you to click **Install**.
6. Refresh the game and enjoy!

*(Note: All scripts can be toggled on/off in the game's native Settings menu thanks to the injected KASPERSKY control panel).*

## 💻 Building from Source (For Developers)

This project is built with **TypeScript (ES2020)**. To modify and compile the source code yourself:

**1. Clone the repository:**
```bash
git clone [https://github.com/AlanKaspersky/Kaspersky-Inventions-for-Tanki-Online.git](https://github.com/AlanKaspersky/Kaspersky-Inventions-for-Tanki-Online.git)
cd Kaspersky-Inventions-for-Tanki-Online