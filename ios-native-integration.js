/**
 * SalesHQ iOS Native Integration
 * Handles all native iOS features through Capacitor
 */

// Import Capacitor plugins
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard } from '@capacitor/keyboard';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';
import { PushNotifications } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Network } from '@capacitor/network';
import { Toast } from '@capacitor/toast';

class SalesHQiOS {
  constructor() {
    this.isNative = window.Capacitor?.isNativePlatform() || false;
    this.platform = window.Capacitor?.getPlatform() || 'web';
    this.initialized = false;
  }

  /**
   * Initialize iOS app on launch
   */
  async init() {
    if (!this.isNative || this.initialized) return;
    
    console.log('🍎 Initializing SalesHQ iOS Native Features...');
    
    try {
      // Configure status bar
      await this.setupStatusBar();
      
      // Hide splash screen after app loads
      await this.hideSplash();
      
      // Setup keyboard handling
      await this.setupKeyboard();
      
      // Register for push notifications
      await this.setupPushNotifications();
      
      // Setup app lifecycle listeners
      this.setupAppListeners();
      
      // Setup network monitoring
      this.setupNetworkMonitoring();
      
      this.initialized = true;
      console.log('✅ iOS Native Features Initialized');
      
      // Show welcome toast
      await this.showToast('Welcome to SalesHQ!');
      
    } catch (error) {
      console.error('❌ iOS Init Error:', error);
    }
  }

  /**
   * Status Bar Configuration
   */
  async setupStatusBar() {
    try {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#0d1535' });
    } catch (error) {
      console.warn('Status bar config failed:', error);
    }
  }

  /**
   * Hide Splash Screen
   */
  async hideSplash() {
    try {
      await SplashScreen.hide();
    } catch (error) {
      console.warn('Splash hide failed:', error);
    }
  }

  /**
   * Keyboard Setup
   */
  async setupKeyboard() {
    try {
      // Listen for keyboard events
      Keyboard.addListener('keyboardWillShow', info => {
        document.body.classList.add('keyboard-open');
        const activeElement = document.activeElement;
        if (activeElement) {
          setTimeout(() => {
            activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }
      });

      Keyboard.addListener('keyboardWillHide', () => {
        document.body.classList.remove('keyboard-open');
      });
    } catch (error) {
      console.warn('Keyboard setup failed:', error);
    }
  }

  /**
   * Push Notifications Setup
   */
  async setupPushNotifications() {
    try {
      // Request permission
      let permStatus = await PushNotifications.checkPermissions();
      
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }
      
      if (permStatus.receive !== 'granted') {
        console.warn('Push notification permission denied');
        return;
      }
      
      // Register for push notifications
      await PushNotifications.register();
      
      // Setup listeners
      PushNotifications.addListener('registration', (token) => {
        console.log('Push registration token:', token.value);
        // Send token to your backend
        this.sendPushTokenToServer(token.value);
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error:', error);
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('Push received:', notification);
        this.handlePushNotification(notification);
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('Push action:', notification);
        this.handlePushAction(notification);
      });
      
    } catch (error) {
      console.warn('Push setup failed:', error);
    }
  }

  /**
   * App Lifecycle Listeners
   */
  setupAppListeners() {
    // App state changes
    App.addListener('appStateChange', ({ isActive }) => {
      console.log('App state changed. Active:', isActive);
      if (isActive) {
        // App came to foreground - refresh data
        window.dispatchEvent(new CustomEvent('app-resumed'));
      }
    });

    // URL Open (deep links)
    App.addListener('appUrlOpen', (data) => {
      console.log('App opened with URL:', data.url);
      this.handleDeepLink(data.url);
    });

    // Back button
    App.addListener('backButton', () => {
      console.log('Back button pressed');
      // Handle back navigation
      if (window.history.length > 1) {
        window.history.back();
      }
    });
  }

  /**
   * Network Monitoring
   */
  async setupNetworkMonitoring() {
    // Get current status
    const status = await Network.getStatus();
    this.updateNetworkStatus(status.connected);

    // Listen for changes
    Network.addListener('networkStatusChange', status => {
      console.log('Network status changed:', status);
      this.updateNetworkStatus(status.connected);
    });
  }

  updateNetworkStatus(isConnected) {
    if (isConnected) {
      document.body.classList.remove('offline');
      document.body.classList.add('online');
    } else {
      document.body.classList.add('offline');
      document.body.classList.remove('online');
      this.showToast('No internet connection', 'warning');
    }
  }

  /**
   * Haptic Feedback
   */
  async haptic(style = 'medium') {
    if (!this.isNative) return;
    
    try {
      const impactStyle = {
        'light': ImpactStyle.Light,
        'medium': ImpactStyle.Medium,
        'heavy': ImpactStyle.Heavy
      }[style] || ImpactStyle.Medium;
      
      await Haptics.impact({ style: impactStyle });
    } catch (error) {
      console.warn('Haptic failed:', error);
    }
  }

  /**
   * Share Content
   */
  async share(title, text, url) {
    if (!this.isNative) {
      // Fallback to Web Share API
      if (navigator.share) {
        return navigator.share({ title, text, url });
      }
      return;
    }

    try {
      await Share.share({
        title,
        text,
        url,
        dialogTitle: 'Share with'
      });
    } catch (error) {
      console.warn('Share failed:', error);
    }
  }

  /**
   * Take Photo
   */
  async takePhoto() {
    if (!this.isNative) return null;

    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });

      return image.dataUrl;
    } catch (error) {
      console.warn('Camera failed:', error);
      return null;
    }
  }

  /**
   * Choose Photo from Library
   */
  async choosePhoto() {
    if (!this.isNative) return null;

    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos
      });

      return image.dataUrl;
    } catch (error) {
      console.warn('Photo picker failed:', error);
      return null;
    }
  }

  /**
   * Local Storage (Preferences)
   */
  async setPreference(key, value) {
    try {
      await Preferences.set({ key, value: JSON.stringify(value) });
    } catch (error) {
      console.warn('Set preference failed:', error);
    }
  }

  async getPreference(key) {
    try {
      const { value } = await Preferences.get({ key });
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.warn('Get preference failed:', error);
      return null;
    }
  }

  async removePreference(key) {
    try {
      await Preferences.remove({ key });
    } catch (error) {
      console.warn('Remove preference failed:', error);
    }
  }

  /**
   * Show Toast Message
   */
  async showToast(text, type = 'info') {
    try {
      const duration = type === 'error' ? 'long' : 'short';
      await Toast.show({ text, duration, position: 'bottom' });
    } catch (error) {
      console.warn('Toast failed:', error);
    }
  }

  /**
   * Local Notifications
   */
  async scheduleNotification(title, body, schedule) {
    if (!this.isNative) return;

    try {
      await LocalNotifications.schedule({
        notifications: [{
          title,
          body,
          id: Date.now(),
          schedule: schedule || { at: new Date(Date.now() + 1000 * 5) },
          sound: 'default',
          actionTypeId: '',
          extra: null
        }]
      });
    } catch (error) {
      console.warn('Local notification failed:', error);
    }
  }

  /**
   * Helper Methods
   */
  async sendPushTokenToServer(token) {
    try {
      // Send to your backend API
      await fetch('https://sales-hq-api.ajbb705.workers.dev/api/push-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token,
          platform: 'ios',
          userId: window.currentUser?.id 
        })
      });
    } catch (error) {
      console.warn('Failed to send push token:', error);
    }
  }

  handlePushNotification(notification) {
    // Show notification badge or alert
    console.log('Received push:', notification);
  }

  handlePushAction(notification) {
    // Handle when user taps notification
    console.log('User tapped notification:', notification);
  }

  handleDeepLink(url) {
    // Parse and handle deep links
    console.log('Deep link:', url);
    // Example: saleshq://prospect/12345
  }
}

// Initialize iOS integration
const iOSApp = new SalesHQiOS();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => iOSApp.init());
} else {
  iOSApp.init();
}

// Export for global access
window.iOSApp = iOSApp;

// Export for module usage
export default iOSApp;
