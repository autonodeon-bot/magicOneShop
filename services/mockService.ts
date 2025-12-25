import { User, QRCodeData, Product, Transaction, DailyBonusRule, NewsItem } from '../types';

// В реальном проекте используйте Supabase Client
// import { createClient } from '@supabase/supabase-js'

const CURRENT_USER_ID = 'user_001'; // Хардкод текущего пользователя для демо

// Начальные данные
const INITIAL_PRODUCTS: Product[] = [
  { id: '1', name: 'Премиум стикеры', price: 10, image: 'https://picsum.photos/200/200?random=1', description: 'Набор уникальных стикеров для Telegram' },
  { id: '2', name: 'Скидка 15%', price: 25, image: 'https://picsum.photos/200/200?random=2', description: 'Скидка на следующую покупку игрушки' },
  { id: '3', name: 'Секретная игрушка', price: 100, image: 'https://picsum.photos/200/200?random=3', description: 'Лимитированная фигурка' },
  { id: '4', name: 'VIP Статус', price: 500, image: 'https://picsum.photos/200/200?random=4', description: 'Золотая рамка в приложении' },
];

const INITIAL_NEWS: NewsItem[] = [
    { id: '1', title: 'Добро пожаловать!', content: 'Мы запустили приложение Golden Cubes. Собирайте кубики и получайте призы!', date: new Date().toISOString(), image: 'https://picsum.photos/400/200?random=10' }
];

const DEFAULT_BONUS_RULES: DailyBonusRule[] = [
  { day: 1, reward: 1 },
  { day: 2, reward: 2 },
  { day: 3, reward: 2 },
  { day: 4, reward: 3 },
  { day: 5, reward: 3 },
  // Далее можно настроить логику цикличности
];

// Хелперы для LocalStorage
const getStorage = <T>(key: string, initial: T): T => {
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : initial;
};

const setStorage = (key: string, value: any) => {
  localStorage.setItem(key, JSON.stringify(value));
};

// --- API Service ---

export const db = {
  // Получить текущего пользователя
  getUser: async (): Promise<User> => {
    // Имитация задержки сети
    await new Promise(r => setTimeout(r, 300));
    
    let users = getStorage<User[]>('users', []);
    let user = users.find(u => u.id === CURRENT_USER_ID);

    if (!user) {
      user = {
        id: CURRENT_USER_ID,
        name: 'Алексей',
        balance: 0,
        role: 'admin', // Для демо даем админа сразу. В реальном app это должно быть 'user' по умолчанию
        lastLoginDate: new Date(Date.now() - 86400000 * 2).toISOString(), // Симулируем, что заходил 2 дня назад
        loginStreak: 0
      };
      users.push(user);
      setStorage('users', users);
    }
    return user;
  },

  // Получить всех пользователей (для админки)
  getAllUsers: async (): Promise<User[]> => {
    return getStorage<User[]>('users', []);
  },

  // Обновить баланс пользователя (админка)
  adminAddCubes: async (userId: string, amount: number): Promise<void> => {
    const users = getStorage<User[]>('users', []);
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) throw new Error('User not found');

    users[userIndex].balance += amount;
    setStorage('users', users);

    // Записать транзакцию
    const tx: Transaction = {
      id: crypto.randomUUID(),
      userId,
      amount,
      type: 'admin_add',
      description: 'Начисление администратором',
      date: new Date().toISOString()
    };
    const txs = getStorage<Transaction[]>('transactions', []);
    txs.push(tx);
    setStorage('transactions', txs);
  },
  
  // Назначить админа по ID
  promoteToAdmin: async (userId: string): Promise<boolean> => {
      const users = getStorage<User[]>('users', []);
      const userIndex = users.findIndex(u => u.id === userId);
      
      // В реальной базе вы бы просто создали запись, даже если юзер еще не заходил
      // Но здесь мы эмулируем: если пользователя нет в базе (не заходил), мы создаем "заготовку"
      if (userIndex === -1) {
          const newUser: User = {
              id: userId,
              name: `User ${userId.slice(0, 4)}`,
              balance: 0,
              role: 'admin',
              lastLoginDate: new Date().toISOString(),
              loginStreak: 0
          };
          users.push(newUser);
          setStorage('users', users);
          return true;
      }

      users[userIndex].role = 'admin';
      setStorage('users', users);
      return true;
  },

  // Проверка ежедневного бонуса
  checkDailyBonus: async (userId: string): Promise<{ collected: boolean, reward: number, newStreak: number } | null> => {
    const users = getStorage<User[]>('users', []);
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) return null;

    const user = users[userIndex];
    const lastLogin = new Date(user.lastLoginDate);
    const now = new Date();
    
    // Сброс времени для сравнения только дат
    const isSameDay = lastLogin.toDateString() === now.toDateString();
    
    if (isSameDay) return null; // Уже получал сегодня

    const diffTime = Math.abs(now.getTime() - lastLogin.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

    let newStreak = user.loginStreak;
    const isConsecutive = (now.getDate() - lastLogin.getDate() === 1) || (now.getTime() - lastLogin.getTime() < 86400000 * 2);

    if (isConsecutive) {
        newStreak += 1;
    } else {
        newStreak = 1;
    }

    // Найти награду
    const rules = getStorage<DailyBonusRule[]>('bonusRules', DEFAULT_BONUS_RULES);
    const rule = rules.find(r => r.day === newStreak) || rules[rules.length - 1];
    const reward = rule ? rule.reward : 1;

    // Обновляем юзера
    user.balance += reward;
    user.lastLoginDate = now.toISOString();
    user.loginStreak = newStreak;
    users[userIndex] = user;
    setStorage('users', users);

    // Транзакция
    const tx: Transaction = {
        id: crypto.randomUUID(),
        userId,
        amount: reward,
        type: 'daily_bonus',
        description: `Ежедневный бонус (День ${newStreak})`,
        date: new Date().toISOString()
    };
    const txs = getStorage<Transaction[]>('transactions', []);
    txs.push(tx);
    setStorage('transactions', txs);

    return { collected: true, reward, newStreak };
  },

  // Создать QR (Админка) - Одиночный
  generateQRCode: async (amount: number): Promise<QRCodeData> => {
    const code = crypto.randomUUID().slice(0, 8).toUpperCase();
    const qr: QRCodeData = {
      id: crypto.randomUUID(),
      code,
      value: amount,
      status: 'active',
      generatedBy: CURRENT_USER_ID,
      createdAt: new Date().toISOString()
    };
    
    const qrs = getStorage<QRCodeData[]>('qrcodes', []);
    qrs.push(qr);
    setStorage('qrcodes', qrs);
    return qr;
  },

  // Создать QR (Админка) - Массово
  generateBulkQRCodes: async (amount: number, count: number): Promise<QRCodeData[]> => {
    const newQrs: QRCodeData[] = [];
    const qrs = getStorage<QRCodeData[]>('qrcodes', []);
    
    for(let i=0; i < count; i++) {
        const code = crypto.randomUUID().slice(0, 8).toUpperCase();
        const qr: QRCodeData = {
            id: crypto.randomUUID(),
            code,
            value: amount,
            status: 'active',
            generatedBy: CURRENT_USER_ID,
            createdAt: new Date().toISOString()
        };
        newQrs.push(qr);
        qrs.push(qr);
    }
    
    setStorage('qrcodes', qrs);
    return newQrs;
  },

  // Активировать QR (Пользователь)
  activateQRCode: async (code: string): Promise<{ success: boolean, amount: number, message: string }> => {
    const qrs = getStorage<QRCodeData[]>('qrcodes', []);
    const qrIndex = qrs.findIndex(q => q.code === code);

    if (qrIndex === -1) return { success: false, amount: 0, message: 'Неверный код' };
    if (qrs[qrIndex].status === 'used') return { success: false, amount: 0, message: 'Код уже использован' };

    // Активация
    qrs[qrIndex].status = 'used';
    qrs[qrIndex].usedBy = CURRENT_USER_ID;
    setStorage('qrcodes', qrs);

    // Начисление
    const amount = qrs[qrIndex].value;
    const users = getStorage<User[]>('users', []);
    const userIndex = users.findIndex(u => u.id === CURRENT_USER_ID);
    if (userIndex !== -1) {
        users[userIndex].balance += amount;
        setStorage('users', users);
        
        // Транзакция
        const tx: Transaction = {
            id: crypto.randomUUID(),
            userId: CURRENT_USER_ID,
            amount: amount,
            type: 'qr_scan',
            description: 'Сканирование игрушки',
            date: new Date().toISOString()
        };
        const txs = getStorage<Transaction[]>('transactions', []);
        txs.push(tx);
        setStorage('transactions', txs);
    }

    return { success: true, amount, message: 'Успешно!' };
  },

  // --- Товары ---
  getProducts: async (): Promise<Product[]> => {
    return getStorage<Product[]>('products', INITIAL_PRODUCTS);
  },

  addProduct: async (product: Omit<Product, 'id'>): Promise<Product> => {
      const products = getStorage<Product[]>('products', INITIAL_PRODUCTS);
      const newProduct = { ...product, id: crypto.randomUUID() };
      products.push(newProduct);
      setStorage('products', products);
      return newProduct;
  },

  deleteProduct: async (id: string): Promise<void> => {
      let products = getStorage<Product[]>('products', INITIAL_PRODUCTS);
      products = products.filter(p => p.id !== id);
      setStorage('products', products);
  },

  purchaseProduct: async (productId: string): Promise<boolean> => {
    const users = getStorage<User[]>('users', []);
    const userIndex = users.findIndex(u => u.id === CURRENT_USER_ID);
    const products = getStorage<Product[]>('products', INITIAL_PRODUCTS);
    const product = products.find(p => p.id === productId);

    if (userIndex === -1 || !product) return false;
    
    if (users[userIndex].balance < product.price) return false;

    users[userIndex].balance -= product.price;
    setStorage('users', users);

    const tx: Transaction = {
        id: crypto.randomUUID(),
        userId: CURRENT_USER_ID,
        amount: -product.price,
        type: 'purchase',
        description: `Покупка: ${product.name}`,
        date: new Date().toISOString()
    };
    const txs = getStorage<Transaction[]>('transactions', []);
    txs.push(tx);
    setStorage('transactions', txs);

    return true;
  },

  getTransactions: async (): Promise<Transaction[]> => {
    const txs = getStorage<Transaction[]>('transactions', []);
    return txs.filter(t => t.userId === CURRENT_USER_ID).reverse();
  },

  // --- Новости ---
  getNews: async (): Promise<NewsItem[]> => {
      return getStorage<NewsItem[]>('news', INITIAL_NEWS).reverse();
  },

  addNews: async (item: Omit<NewsItem, 'id' | 'date'>): Promise<NewsItem> => {
      const news = getStorage<NewsItem[]>('news', INITIAL_NEWS);
      const newItem: NewsItem = {
          ...item,
          id: crypto.randomUUID(),
          date: new Date().toISOString()
      };
      news.push(newItem);
      setStorage('news', news);
      return newItem;
  }
};