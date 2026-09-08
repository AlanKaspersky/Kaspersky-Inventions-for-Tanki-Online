# Kaspersky's Inventions - Tanki Online Extension
## Complete Documentation
## Table of Contents
1. [Overview](#overview)
2. [Key Features](#key-features)
3. [Module Documentation](#module-documentation)
   - [Core Settings Module](#core-settings-module)
   - [Custom Play Button Module](#custom-play-button-module)
   - [Augment Specifications Module](#augment-specifications-module)
   - [Smart Paint Search Module](#smart-paint-search-module)
   - [Friend Tags & Categories Module](#friend-tags--categories-module)
   - [Trophy Favorites Module](#trophy-favorites-module)
   - [Auto-Upgrade Module](#auto-upgrade-module)
   - [Hide Nickname & XP Module](#hide-nickname--xp-module)
   - [Hide Currency Module](#hide-currency-module)
   - [Custom Garage Skins Module](#custom-garage-skins-module)
   - [Weapon Augment Tracker Module](#weapon-augment-tracker-module)
   - [Change Counter Module](#change-counter-module)
   - [Zero Resists Module](#zero-resists-module)
   - [Garage Buttons Module](#garage-buttons-module)
4. [CSS Customizations](#css-customizations)
5. [Technical Requirements](#technical-requirements)
6. [Installation](#installation)
7. [Configuration](#configuration)
## Overview
Kaspersky's Inventions is a comprehensive browser extension designed to enhance the Tanki Online gaming experience. This extension introduces a wide array of quality-of-life improvements, visual customizations, and advanced gameplay features that streamline various aspects of the game interface and mechanics.

The extension operates through a modular architecture, allowing users to enable or disable specific features according to their preferences. Each module is self-contained and integrates seamlessly with the game's native interface.
## Key Features
- **Enhanced Play Button** - Quick access to battle modes with visual feedback
- **Augment Specifications** - Display detailed stats and modifiers for equipment
- **Smart Paint Search** - Search and filter paint items by name
- **Friend Management** - Color-coded friend categories and filtering
- **Trophy Tracking** - Monitor progress on favorite equipment
- **Auto-Upgrade System** - Rapid equipment upgrades with confirmation
- **Privacy Controls** - Hide sensitive information like nickname, XP, and currency
- **Visual Customization** - Skin override system and interface enhancements
- **Gameplay Analysis** - Reload tracking, resistance visualization, and change detection
## Module Documentation
### Core Settings Module
**Purpose**: Provides the main configuration interface for all extension features.

The Core Settings module establishes the extension's settings panel within the game's native settings interface. Users can access a dedicated "KASPERSKY" tab in the settings menu, where all configurable features are presented as toggle switches.

**Functionality**:

| Setting | Description | Default |
|---------|-------------|---------|
| Enhanced "Play" Button | Replaces the standard play button with a comprehensive battle mode selection interface | Disabled |
| Augment Specifications | Displays detailed statistics and modifiers for equipment augments | Disabled |
| Quick Weapon Upgrades | Enables rapid weapon upgrade functionality (experimental) | Disabled |
| Friend Tags & Categories | Adds color-coded categorization and filtering for friends list | Disabled |
| Smart Paint Search | Adds search functionality to the paint collection interface | Disabled |
| Hide Currency | Conceals currency amounts with hover-to-reveal tooltips | Disabled |
| Hide Nickname and Score | Conceals player nickname and experience points with tooltips | Disabled |

**Technical Implementation**:
- Settings are stored in `localStorage` with the format `k_{setting_name}`
- A warning dialog is displayed when enabling the "Hide Nickname and Score" feature
- The module injects CSS styles dynamically for the settings interface
- Configuration changes require a page reload to take full effect


### Custom Play Button Module

**Purpose**: Replaces the standard Play button with a comprehensive battle mode selection interface.

This module overhauls the main menu's play button, providing direct access to multiple battle modes through an organized grid layout. The interface uses a sprite-based background image for visual consistency.

**Battle Modes**:

| Mode Type | Modes Available |
|-----------|-----------------|
| Quick Battle | Standard quick battle matchmaking |
| Wide Modes | PRO-Battles, Festive Mode |
| Standard Modes | Team Deathmatch, Control Points, Capture the Flag, Siege, Juggernaut, Rugby, Assault |

**Features**:
- Visual feedback through hover effects and animations
- Auto-queue functionality that navigates mode selection automatically
- Lock icon overlay when searching for matches
- Metal shine animation effect on hover
- Responsive layout with consistent button sizing

**Visual Design**:
- Button grid dimensions: 3.5em × 8.5em (main) with 0.5em gaps
- Sprite-based background for consistent styling
- Custom CSS animations for hover effects
- Tooltip system for mode identification

**Technical Notes**:
- Uses `chrome.runtime.getURL()` to load custom background assets
- Implements a queue system for automated mode selection
- Auto-queue state management with timeout fail-safes

### Augment Specifications Module

**Purpose**: Displays comprehensive statistics and modifiers for equipment augments.

When enabled, this module adds a specifications button to equipment cards and displays live stat adjustments in real-time based on equipped augments.

**Displayed Information**:

| Category | Content |
|----------|---------|
| Advantages | Positive modifiers and effects |
| Disadvantages | Negative modifiers and drawbacks |
| Stat Modifiers | Numerical adjustments to weapon parameters |

**Supported Stats**:
- Damage
- Damage per Second (DPS)
- Charge Rate
- Reload Time
- Turning Speed
- Range
- Critical Damage
- Healing per Second
- Impact Force
- Armor
- Weight
- Top Speed
- Power

**Modifier Types**:
- Direct percentage increases/decreases
- Status effect applications (Burning, Freezing, EMP, Stun, Armor-Piercing, Jammer)
- Conditional bonuses (health thresholds, status effects)
- Special mechanics (chain effects, splash damage, ricochet)

**Technical Implementation**:
- Database of augment specifications with multilingual support (RU/EN)
- Real-time stat parsing and value recalculation
- Color-coded indicators (green for buffs, red for debuffs)
- Modal window for detailed specification display

### Smart Paint Search Module

**Purpose**: Adds search functionality to the paint collection interface.

This module enhances the paint selection interface by providing a real-time search filter that allows users to find specific paints by name in either Russian or English.

**Features**:
- Real-time filtering as you type
- Dual-language search support (RU/EN)
- Visual feedback showing/hiding non-matching items
- Preserves original layout and functionality
- Works with the existing paint collection UI

**Search Behavior**:
- Matches against both Russian and English names
- Multiple word searches supported
- Case-insensitive matching
- Updates results dynamically as text is entered

**Technical Implementation**:
- Injects search input interface into existing DOM structure
- Uses custom CSS for seamless integration
- Maintains compatibility with the original paint grid layout
- Applies filters at both item and column levels

### Friend Tags & Categories Module

**Purpose**: Enhances the friends list with color-coded categories and filtering capabilities.

This module transforms the standard friends list interface by adding visual categorization and advanced filtering options.

**Filter Categories**:

| Filter | Description |
|--------|-------------|
| All | Shows all friends |
| Online | Displays only currently online friends |
| Offline | Shows only offline friends |
| Clan | Filters to clan members |
| Custom Categories | User-defined color categories (Purple, Yellow, Red) |

**Customization Options**:
- Right-click context menu integration
- Individual friend categorization
- Category persistence through localStorage
- Visual badges on friend cards

**Technical Implementation**:
- Injects filter sidebar with icon-based buttons
- Adds category management to context menus
- Uses CSS filters for color application
- JSON-based storage for category assignments

### Trophy Favorites Module

**Purpose**: Tracks and displays progress for favorite turrets and hulls.

This module allows users to select up to two turrets and two hulls as favorites, displaying their progress bars in the lobby interface.

**Features**:
- Star-based favorite system with visual indicators
- Progress bar display for each favorite item
- Two-item limit per category (turret/hull)
- Automatic progress updates
- Integration with both garage and battle result interfaces

**Display Details**:
- Current points / Maximum points
- Visual progress bar with percentage
- Item icon display
- Category grouping (turret/hull)

**Technical Implementation**:
- localStorage-based persistence
- Card parsing to detect item types and progress
- Dynamic panel creation in the lobby
- Progress tracking through DOM observation

### Auto-Upgrade Module

**Purpose**: Enables rapid equipment upgrades with configurable step counts.

This module automates the upgrade process for equipment items, providing quick upgrade options with a confirmation dialog.

**Upgrade Options**:

| Button | Function |
|--------|----------|
| X5 | Performs 5 consecutive upgrades |
| X10 | Performs 10 consecutive upgrades |
| X15 | Performs 15 consecutive upgrades |
| MAX | Upgrades to maximum level |

**Safety Features**:
- Confirmation dialog before execution
- Detection of Ruby (premium currency) requirements
- Automatic cancellation for premium currency prompts
- Dialog closing when switching items

**Technical Implementation**:
- Monitors the upgrade interface for available options
- Triggers Enter key events for upgrade actions
- Detects completion status and maximum levels
- Handles dialog states and error conditions

### Hide Nickname & XP Module

**Purpose**: Conceals player nickname and experience points with tooltip reveal.

This module provides privacy functionality by masking sensitive personal information while retaining the ability to view it on hover.

**Hidden Elements**:
- Player nickname in header
- Player nickname in battle results
- Experience points in header
- Player nickname in battle statistics (self)

**Tooltip Behavior**:
- Hover over masked text to reveal original value
- Smooth opacity transition
- Custom styling matching game theme
- Language-appropriate masking text (Скрыто/Hidden)

**Technical Implementation**:
- Replaces text content with masked versions
- Stores original values in data attributes
- Applies to both static and dynamic content
- Handles nickname duplication in tables and results

### Hide Currency Module

**Purpose**: Conceals currency amounts with hover-to-reveal tooltips.

This module masks all currency values in the interface, displaying only "Скрыто" or "Hidden" with tooltips showing the actual amounts.

**Affected Currencies**:
- Rubies (premium currency)
- Crystals (in-game currency)
- Tankoins (event currency)

**Security Features**:
- Values are hidden by default
- Hover reveals the actual amount
- Styled tooltips match game aesthetics
- Color-coded to match currency types

**Technical Implementation**:
- Observes DOM for currency elements
- Replaces numeric values with masked text
- Stores original values in data attributes
- Updates dynamically as values change

### Custom Garage Skins Module

**Purpose**: Allows users to override equipment skins with alternative visual designs.

This module enables the application of custom skins to turrets and hulls by replacing the default image URLs with specified alternatives.

**Supported Equipment**:
- All turrets (Firebird, Freeze, Isida, Tesla, etc.)
- All hulls (Wasp, Hopper, Hornet, Viking, etc.)

**Skin Categories**:
- XT Series
- XT OLD Series
- Legacy Series
- GT Series
- Prime Series
- Ultra Series
- RT Series
- SP Series
- Demonic Series
- Demoniс OLD Series
- IC Series
- DK Series

**Skin Database**:
- Pre-filled with known skin URLs
- Automatically detects and stores default images
- Maintains mappings for all equipment types

**Technical Implementation**:
- CSS-based image replacement using content property
- Persistent storage for skin selections
- Dynamic detection of equipped skins
- Automatic default image collection

### Weapon Augment Tracker Module

**Purpose**: Displays a visual reload indicator when using weapon augments.

This module provides a real-time reload progress bar for augmented weapons, helping players time their shots more effectively.

**Features**:
- Progress bar overlay during reload
- Support for all turret types
- Accurate reload timing based on augment modifiers
- Visual feedback for shot release timing

**Technical Implementation**:
- Reload time calculations from data tables
- Augment modifier detection
- Pointer and keyboard event monitoring
- Continuous render loop with requestAnimationFrame

**Reload Tables**:
- Base reload times for each turret
- MK level and step progression
- Augment modifier multipliers

### Change Counter Module

**Purpose**: Tracks equipment changes during battles and highlights players who have modified their loadout.

This module monitors equipment changes in the current battle session and visually marks players who have changed their equipment.

**Features**:
- Real-time equipment change detection
- Visual highlighting (yellow rows) for changed players
- Session-based change tracking
- Automatic reset between battles

**Technical Implementation**:
- Intercepts `TankUserActionLog` events
- Tracks `CHANGE_EQUIPMENT` actions
- Stores changes in sessionStorage
- Updates battle statistics interface

### Zero Resists Module

**Purpose**: Displays zero-value resistances in the battle statistics interface.

This module adds indicators for resistances that are not present in the current battle, providing a complete picture of the resistance landscape.

**Features**:
- Shows all resistance types that are at zero
- Visual iconography for each resistance type
- Integration with battle statistics
- Dynamic updates as resistances appear

**Technical Implementation**:
- Parses resistance data from the statistics panel
- Injects zero-resistance indicators
- Removes indicators when resistance appears
- Uses CSS mask images for consistent styling

### Garage Buttons Module

**Purpose**: Enhances garage interface buttons with improved icons and visual effects.

This module modifies the action buttons in the garage to provide more intuitive visual cues.

**Button Types**:
- Upgrade (progress arrow icon)
- Mount/Equip (gear icon)
- Buy (shopping cart icon)

**Visual Enhancements**:
- Metal shine animation on hover
- Consistent iconography
- Color-coded states (active/disabled)
- Hover animations (upward/downward)

**Technical Implementation**:
- Uses CSS mask-image for icon replacement
- Detects button context and applies appropriate icon
- Maintains text labels while replacing icons
- Animates hover effects

## CSS Customizations

The extension applies a comprehensive set of CSS overrides to enhance the user interface:

### Visual Enhancements
- Radially gradient backgrounds for various containers
- Custom animations for button effects
- Metal shine effects on interactive elements
- Consistent shadow and border styling

### Layout Modifications
- Grid-based friend list layout
- Adjusted header element positioning
- Custom scrollbar styling
- Responsive component sizing

### Interactive Elements
- Button hover effects and transitions
- Tooltip implementations
- Loading screen customizations
- Menu item animations


## Technical Requirements

### Browser Compatibility
- Google Chrome (primary target)
- Chromium-based browsers

### Required Permissions
- Access to game domain (tankionline.com)
- Storage access for settings persistence
- Script injection capabilities

### Dependencies
- None (vanilla JavaScript)



## Installation

1. Clone or download the extension repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the extension directory
6. The extension will automatically activate on Tanki Online


## Configuration

### Accessing Settings
1. Open the Tanki Online game client
2. Navigate to the settings menu
3. Click on the "KASPERSKY" tab
4. Toggle features as desired
5. Reload the page for changes to take effect

### Data Storage
- Settings: `localStorage` with format `k_{setting_name}`
- Categories: `localStorage` with key `tankiCustomCategories_{nickname}`
- Skins: `localStorage` with key `kasp_equipped_skins`
- Favorites: `localStorage` with key `kasp_trophies_favorites`
- Augment Tracker: `localStorage` with key `kasp_weapon_augment_tracker`



## Acknowledgements

This extension was developed with the assistance of various AI models including ChatGPT, DeepSeek, Claude Sonnet 5, Claude Haiku 4.5, Gemini 3.5 Flash-Lite, Gemini 3.8 Flash, Gemini 3.1 Pro, and Grok 4.6. Quality assessment was performed by Claude Fable 5.1 and Claude Opus 5.


*Documentation Version 2.2*