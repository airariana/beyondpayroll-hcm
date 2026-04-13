# SalesHQ iOS Native App Setup Guide

## 🎯 Overview
This guide walks you through converting SalesHQ into a native iOS app using Capacitor.

**What you'll get:**
- ✅ Native iOS app for App Store
- ✅ Access to iOS features (Camera, Face ID, Push Notifications, etc.)
- ✅ 100% reuse of existing web code
- ✅ Professional native app experience

---

## 📋 Prerequisites

### Required Software:
1. **macOS** (required for iOS development)
2. **Xcode 15+** (free from Mac App Store)
3. **Node.js 18+** (check: `node --version`)
4. **npm** or **yarn** (check: `npm --version`)
5. **CocoaPods** (check: `pod --version`)
   ```bash
   sudo gem install cocoapods
   ```

### Apple Developer Account:
- **Free account**: Testing on your own devices
- **Paid ($99/year)**: App Store distribution

---

## 🚀 Step-by-Step Setup

### Step 1: Install Dependencies

```bash
# Navigate to your project directory
cd /path/to/saleshq

# Install Node dependencies
npm install

# This installs all Capacitor iOS plugins
```

### Step 2: Prepare Web Files

```bash
# Create dist folder if it doesn't exist
mkdir -p dist

# Copy your web files to dist folder
cp index.html dist/
cp app.js dist/
cp *.css dist/
cp -r assets dist/ # if you have an assets folder

# Copy all your JavaScript files
cp nurture-campaign-system.js dist/
cp learning-agent-system.js dist/
cp nurture-ui-components.js dist/
cp saleshq-canva-integration.js dist/
cp saleshq-outlook-canva.js dist/
cp saleshq-canva-enriched-integration.js dist/
cp saleshq-outlook-integration-code.js dist/
cp signature-manager-with-images.js dist/
cp ios-native-integration.js dist/
```

### Step 3: Initialize iOS Project

```bash
# Add iOS platform
npx cap add ios

# This creates an ios/ folder with your Xcode project
```

### Step 4: Sync Web Code to iOS

```bash
# Copy web files and sync plugins
npx cap sync ios
```

### Step 5: Configure iOS Project

```bash
# Open Xcode project
npx cap open ios
```

**In Xcode:**

1. **Select "App" target** in the left sidebar
2. **General Tab:**
   - Display Name: `SalesHQ`
   - Bundle Identifier: `com.beyondpayroll.saleshq`
   - Version: `1.0.0`
   - Build: `1`
   - Deployment Target: `iOS 15.0`

3. **Signing & Capabilities:**
   - Team: Select your Apple Developer account
   - Signing Certificate: Automatic
   - Add Capabilities:
     - Push Notifications
     - Background Modes (Remote notifications, Background fetch)
     - Camera Usage
     - Photo Library Usage

4. **Info.plist Permissions:**
   - Click `Info.plist` in Xcode
   - Add these keys:
     - `NSCameraUsageDescription`: "Take photos for prospects"
     - `NSPhotoLibraryUsageDescription`: "Select photos from library"
     - `NSPhotoLibraryAddUsageDescription`: "Save photos to library"
     - `NSFaceIDUsageDescription`: "Secure app access with Face ID"

### Step 6: Update App Icons & Splash Screen

**App Icon:**
1. In Xcode, navigate to: `App/Assets.xcassets/AppIcon.appiconset`
2. Drag and drop your app icons (1024x1024 PNG)
3. Xcode will auto-generate all sizes

**Splash Screen:**
1. Navigate to: `App/Assets.xcassets/Splash.imageset`
2. Replace with your branded splash screen

### Step 7: Build & Test

**Run on Simulator:**
```bash
# Build and launch in iOS Simulator
npx cap run ios
```

**Run on Physical Device:**
1. Connect iPhone via USB
2. Select your device in Xcode (top bar)
3. Click ▶️ Play button
4. Trust developer certificate on iPhone (Settings > General > VPN & Device Management)

---

## 🔄 Development Workflow

### Making Changes to Web Code:

```bash
# 1. Edit your HTML/CSS/JS files
# 2. Copy to dist folder
cp index.html dist/
cp app.js dist/

# 3. Sync to iOS
npx cap sync ios

# 4. Rebuild in Xcode or run
npx cap run ios
```

### Quick Sync Command:
```bash
# Create a sync script (sync-ios.sh)
#!/bin/bash
cp *.html dist/
cp *.js dist/
cp *.css dist/
npx cap sync ios
echo "✅ iOS synced!"
```

Make it executable:
```bash
chmod +x sync-ios.sh
./sync-ios.sh
```

---

## 📱 iOS-Specific Features Integration

### In your app.js, add:

```javascript
// Check if running in native iOS app
const isNativeiOS = window.Capacitor?.isNativePlatform() && 
                    window.Capacitor?.getPlatform() === 'ios';

// Use iOS native features
if (isNativeiOS && window.iOSApp) {
  
  // Haptic feedback on button clicks
  document.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      window.iOSApp.haptic('light');
    });
  });
  
  // Native share
  async function shareProspect(prospectData) {
    await window.iOSApp.share(
      'Check out this prospect',
      `${prospectData.company} - ${prospectData.name}`,
      `https://beyondpayroll.net/prospect/${prospectData.id}`
    );
  }
  
  // Take photo for prospect
  async function captureProspectPhoto() {
    const photoData = await window.iOSApp.takePhoto();
    if (photoData) {
      // Use the photo data URL
      uploadProspectPhoto(photoData);
    }
  }
  
  // Save user preferences natively
  async function saveUserSettings(settings) {
    await window.iOSApp.setPreference('userSettings', settings);
  }
  
  // Show success toast
  async function showSuccess(message) {
    await window.iOSApp.showToast(message);
  }
}
```

---

## 🍏 App Store Submission

### Prepare for Release:

1. **Archive Build:**
   - Xcode → Product → Archive
   - Wait for archive to complete

2. **Upload to App Store Connect:**
   - Window → Organizer
   - Select your archive
   - Click "Distribute App"
   - Choose "App Store Connect"
   - Follow prompts

3. **App Store Connect Setup:**
   - Create app listing at [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
   - Add screenshots (required sizes)
   - Write app description
   - Set privacy policy URL
   - Submit for review

### Required Assets:
- App Icon (1024x1024)
- iPhone Screenshots:
  - 6.7" (iPhone 15 Pro Max)
  - 6.5" (iPhone 14 Plus)
  - 5.5" (iPhone 8 Plus)
- iPad Screenshots (if supporting iPad)
- App Preview Video (optional but recommended)

---

## 🐛 Troubleshooting

### Build Fails:
```bash
# Clean build
cd ios/App
rm -rf DerivedData
pod install
cd ../..
npx cap sync ios
```

### Plugins Not Working:
```bash
# Reinstall plugins
npm install --force
npx cap sync ios
```

### Code Not Updating:
```bash
# Clear Xcode cache
rm -rf ~/Library/Developer/Xcode/DerivedData/*

# Force sync
npx cap copy ios --inline
npx cap sync ios
```

### Simulator Issues:
```bash
# Reset simulator
xcrun simctl shutdown all
xcrun simctl erase all
```

---

## 📊 Performance Optimization

### Enable Production Mode:

In `capacitor.config.json`:
```json
{
  "server": {
    "hostname": "beyondpayrollportal.pages.dev",
    "androidScheme": "https",
    "iosScheme": "ionic"
  }
}
```

### Optimize Assets:
- Compress images
- Minify JavaScript
- Enable gzip compression
- Use lazy loading

---

## 🔐 Security Best Practices

1. **Enable App Transport Security (ATS)**
2. **Use HTTPS for all API calls**
3. **Implement biometric authentication**
4. **Encrypt sensitive data**
5. **Use Keychain for tokens**

---

## 📞 Support & Resources

- **Capacitor Docs:** https://capacitorjs.com/docs/ios
- **iOS Human Interface Guidelines:** https://developer.apple.com/design/human-interface-guidelines/ios
- **App Store Review Guidelines:** https://developer.apple.com/app-store/review/guidelines/

---

## 🎉 Next Steps

After setup:
1. ✅ Test all features on real iPhone
2. ✅ Add iOS-specific UI polish
3. ✅ Implement push notifications
4. ✅ Add Face ID authentication
5. ✅ Optimize performance
6. ✅ Prepare App Store assets
7. ✅ Submit to App Store

---

**Estimated Timeline:**
- **Setup & Testing:** 2-3 days
- **iOS Optimization:** 3-5 days
- **App Store Prep:** 2-3 days
- **Review Process:** 1-7 days

**Total:** ~2 weeks from start to App Store approval

---

Need help? Check the troubleshooting section or reach out!
