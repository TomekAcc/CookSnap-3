# Cook AI

Production-grade React Native app built with Expo. Scan your fridge, set meal preferences, and get AI-suggested recipes.

## Tech Stack

- **Expo SDK 58** (Managed Workflow)
- **lucide-react-native** icons
- **expo-camera** for fridge photo capture
- **React Context** for state management

## Project Structure

```
cook-ai/
├── App.jsx                          # Root app with navigation & modals
├── proxy/                           # Cloudflare Worker that holds the Gemini key (see proxy/README.md)
├── src/
│   ├── components/
│   │   ├── Header.jsx               # Brand badge, menu & notifications
│   │   ├── FridgeScannerHero.jsx    # Fridge scanner: composes the pieces below
│   │   ├── PantryScannerHero.jsx    # Pantry scanner (shares capture + camera + sheet)
│   │   ├── scanner/                 # Scanner building blocks
│   │   │   ├── useScanCapture.js        # Camera permission, shutter, gallery, free-cap check
│   │   │   ├── ScanCameraModal.jsx      # The one full-screen camera
│   │   │   ├── ScanMoreSheet.jsx        # "Scan More" popover (fridge + pantry)
│   │   │   ├── useFridgeScanChoreography.js  # Scan stage + every animation value
│   │   │   ├── FridgeIdleCard / FridgePhotoCard / FridgeScanProgress
│   │   │   └── NoItemsFound / DetectedIngredientsCard / PhotoViewerModal
│   │   ├── MealPreferences.jsx      # Filters, servings, hunger level
│   │   ├── RecipeFeed.jsx           # 3 free recipes + PRO paywall
│   │   ├── RecipeDetailModal.jsx    # Full recipe with scaled ingredients
│   │   ├── PantryTab.jsx            # Spiżarnia staple management
│   │   ├── BottomNav.jsx            # Polish bottom navigation
│   │   ├── MenuDrawer.jsx           # Slide-out hamburger menu
│   │   ├── NotificationsDrawer.jsx  # Notification slide-over
│   │   ├── AddIngredientModal.jsx   # Quick-add pantry chips
│   │   └── ProSubscriptionModal.jsx # 7-day trial paywall
│   ├── context/
│   │   ├── AppProviders.jsx         # Composes the state providers below
│   │   ├── NavigationContext.jsx    # Tabs + scroll bookkeeping
│   │   ├── OnboardingContext.jsx    # Onboarding gate + one-time hints
│   │   ├── LanguageContext.jsx      # t() + recipe language
│   │   ├── EntitlementsContext.jsx  # PRO + free-tier limits
│   │   ├── PreferencesContext.jsx   # Meal prefs, diet, units
│   │   ├── LibraryContext.jsx       # Saved recipes + favorites
│   │   ├── InventoryContext.jsx     # Fridge ingredients + pantry
│   │   ├── RecipesContext.jsx       # Recipe generation
│   │   ├── ScanContext.jsx          # Fridge / pantry scan flows
│   │   ├── ModalContext.jsx         # Which modal is open
│   │   └── ThemeContext.jsx         # Light / dark
│   ├── theme/
│   │   ├── palette.js               # Raw colors (the only hex values)
│   │   ├── colors.js                # Light + dark theme roles
│   │   └── tokens.js                # Type, radius, spacing, icon scales
│   ├── data/
│   │   └── recipes.js               # Recipes, pantry data & helpers
│   └── screens/
│       ├── ScannerScreen.jsx
│       ├── SavedScreen.jsx
│       └── ProfileScreen.jsx
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo Go app on your phone (iOS/Android) or a simulator

### Install & Run

```bash
cd ~/Projects/cook-ai
npm install
npx expo start
```

Then:

- Press **`i`** for iOS Simulator
- Press **`a`** for Android Emulator
- Scan the QR code with **Expo Go** on your physical device

### Camera Permissions

The fridge scanner uses `expo-camera`. On first use, tap **Scan Fridge with Camera** and grant permission when prompted. Camera permissions are configured in `app.json`.

## Features

| Feature | Description |
|---------|-------------|
| Fridge Scanner | AR-style ingredient tags with dismiss, quick-add modal, camera capture |
| Meal Preferences | Meal type pills, servings counter, hunger level cards |
| Recipe Feed | 3 free AI recipes with prep/cook times, difficulty, category |
| PRO Paywall | Gradient banner + 7-day trial modal |
| Recipe Detail | Slide-up modal with dynamically scaled ingredients & 4 steps |
| Spiżarnia | Pantry staples auto-included in recipes |
| Bottom Nav | Scanner, Spiżarnia, Zapisane, Profil (Polish labels) |

## Design System

- Background: `#F8FAFC` / `#F1F5F9`
- Primary: `#0F172A` (charcoal CTAs)
- Accent: `#10B981` / `#22C55E` (emerald active states)
- PRO: `#F59E0B` (amber gold badges)
- Cards: `rounded-3xl` with generous padding
