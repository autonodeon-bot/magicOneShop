export interface User {
  id: string;
  name: string;
  username?: string;
  balance: number;
  role: 'user' | 'admin';
  lastLoginDate: string; // ISO string
  loginStreak: number;
}

export interface QRCodeData {
  id: string;
  code: string; // Уникальный хеш
  value: number; // Сколько кубиков дает
  status: 'active' | 'used';
  generatedBy: string; // Admin ID
  usedBy?: string; // User ID
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: 'qr_scan' | 'daily_bonus' | 'purchase' | 'admin_add';
  description: string;
  date: string;
}

export interface DailyBonusRule {
  day: number;
  reward: number;
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  image?: string;
  date: string;
}