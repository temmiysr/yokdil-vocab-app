export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  notificationTime: string; // "20:00" gibi
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  appUrl: string; // GitHub Pages veya özel domain URL'si
  cloudProvider: 'none' | 'firebase' | 'supabase';
  firebaseConfig?: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket?: string;
    appId?: string;
  };
  supabaseConfig?: {
    url: string;
    anonKey: string;
  };
  aiProvider: 'none' | 'gemini' | 'openai';
  aiApiKey?: string;
  webNotificationEnabled: boolean;
  audioAutoplay: boolean;
  dailyReviewGoal: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  isAnonymous?: boolean;
}
