import { supabase } from '../supabaseClient';
import { User, QRCodeData, Product, Transaction, DailyBonusRule, NewsItem } from '../types';

// Интерфейс для Telegram WebApp
interface TelegramUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
}

// Получение данных из Telegram
const getTelegramUser = (): TelegramUser | null => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
        return tg.initDataUnsafe.user;
    }
    return null;
};

// Получение ID текущего пользователя
const getMyUserId = () => {
    const tgUser = getTelegramUser();
    if (tgUser) {
        return String(tgUser.id);
    }
    let id = localStorage.getItem('my_user_id');
    // const mainAdminId = '207940967'; 
    if (!id) {
        id = 'user_' + crypto.randomUUID().slice(0, 8);
        localStorage.setItem('my_user_id', id);
    }
    return id!;
};

const DEFAULT_BONUS_RULES: DailyBonusRule[] = [
  { day: 1, reward: 1 },
  { day: 2, reward: 2 },
  { day: 3, reward: 2 },
  { day: 4, reward: 3 },
  { day: 5, reward: 3 },
];

export const db = {
  // Получить текущего пользователя
  getUser: async (): Promise<User> => {
    const userId = getMyUserId();
    const tgUser = getTelegramUser();
    
    let realName = `User ${userId.slice(0, 5)}`;
    if (tgUser) {
        realName = tgUser.first_name;
        if (tgUser.last_name) realName += ` ${tgUser.last_name}`;
    } else if (userId === '207940967') {
        realName = 'Главный Админ';
    }

    try {
        // 1. Попытка загрузить из Supabase
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        if (error) throw error;

        // 2. Если пользователь найден - возвращаем его + обновляем фоном
        if (data) {
             // Запускаем обновление в фоне, не блокируя UI
             (async () => {
                 try {
                     const updates: any = {};
                     if (data.name !== realName) updates.name = realName;
                     if (tgUser?.username && data.username !== tgUser.username) updates.username = tgUser.username;
                     // Если это хардкодный админ, форсируем роль
                     if (userId === '207940967' && data.role !== 'admin') {
                        updates.role = 'admin';
                     }
                     if (Object.keys(updates).length > 0) {
                        await supabase.from('users').update(updates).eq('id', userId);
                     }
                 } catch(e) {
                     console.error("Background update failed", e);
                 }
             })();

             return {
                ...data,
                // Если мы хардкодный админ, переопределяем роль на клиенте сразу
                role: userId === '207940967' ? 'admin' : data.role, 
                lastLoginDate: data.last_login_date,
                loginStreak: data.login_streak
             } as User;
        }

        // 3. Если пользователя нет в базе - создаем
        const newUser = {
            id: userId,
            name: realName,
            username: tgUser?.username || null,
            balance: 0,
            role: userId === '207940967' ? 'admin' : 'user',
            last_login_date: new Date(Date.now() - 86400000 * 2).toISOString(),
            login_streak: 0
        };

        const { data: createdUser, error: createError } = await supabase
            .from('users')
            .insert([newUser])
            .select()
            .single();
        
        if (createError) throw createError;
        
        return {
            ...createdUser,
            lastLoginDate: createdUser.last_login_date,
            loginStreak: createdUser.login_streak
        } as User;

    } catch (e) {
        console.warn("Database connection failed, loading offline/fallback user:", e);
        
        // ВОЗВРАЩАЕМ ЛОКАЛЬНОГО ПОЛЬЗОВАТЕЛЯ, ЧТОБЫ ПРИЛОЖЕНИЕ НЕ ПАДАЛО
        // Важно: если БД недоступна, мы не можем знать реальную роль, 
        // поэтому даем 'admin' только хардкодному ID.
        return {
            id: userId,
            name: realName,
            username: tgUser?.username,
            balance: 0,
            role: userId === '207940967' ? 'admin' : 'user',
            lastLoginDate: new Date().toISOString(),
            loginStreak: 0
        };
    }
  },

  getAllUsers: async (): Promise<User[]> => {
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    return (data || []).map(u => ({ ...u, lastLoginDate: u.last_login_date, loginStreak: u.login_streak }));
  },

  adminAddCubes: async (userId: string, amount: number): Promise<void> => {
    const { data: user } = await supabase.from('users').select('balance').eq('id', userId).single();
    if (!user) return;
    const newBalance = (user.balance || 0) + amount;
    await supabase.from('users').update({ balance: newBalance }).eq('id', userId);
    await supabase.from('transactions').insert([{
        user_id: userId, amount, type: 'admin_add', description: 'Начисление администратором', date: new Date().toISOString()
    }]);
  },
  
  promoteToAdmin: async (userId: string): Promise<boolean> => {
      const { error } = await supabase.from('users').update({ role: 'admin' }).eq('id', userId);
      return !error;
  },

  checkDailyBonus: async (userId: string): Promise<{ collected: boolean, reward: number, newStreak: number } | null> => {
    try {
        const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
        if (!user) return null;

        const lastLogin = new Date(user.last_login_date);
        const now = new Date();
        if (lastLogin.toDateString() === now.toDateString()) return null;

        let newStreak = user.login_streak;
        const isConsecutive = (now.getTime() - lastLogin.getTime() < 86400000 * 2);
        newStreak = isConsecutive ? newStreak + 1 : 1;

        const rules = DEFAULT_BONUS_RULES;
        const rule = rules.find(r => r.day === newStreak) || rules[rules.length - 1];
        const reward = rule ? rule.reward : 1;

        await supabase.from('users').update({
            balance: user.balance + reward, last_login_date: now.toISOString(), login_streak: newStreak
        }).eq('id', userId);

        await supabase.from('transactions').insert([{
            user_id: userId, amount: reward, type: 'daily_bonus', description: `Ежедневный бонус (День ${newStreak})`, date: now.toISOString()
        }]);

        return { collected: true, reward, newStreak };
    } catch (e) {
        return null;
    }
  },

  generateBulkQRCodes: async (amount: number, count: number): Promise<QRCodeData[]> => {
    const currentUserId = getMyUserId();
    const rows = [];
    for(let i=0; i < count; i++) {
        rows.push({
            code: crypto.randomUUID().slice(0, 8).toUpperCase(),
            value: amount,
            status: 'active',
            generated_by: currentUserId
        });
    }
    const { data } = await supabase.from('qr_codes').insert(rows).select();
    return (data || []).map(q => ({ ...q, generatedBy: q.generated_by, usedBy: q.used_by, createdAt: q.created_at }));
  },

  activateQRCode: async (code: string): Promise<{ success: boolean, amount: number, message: string }> => {
    const currentUserId = getMyUserId();
    const { data: qr } = await supabase.from('qr_codes').select('*').eq('code', code).single();

    if (!qr) return { success: false, amount: 0, message: 'Неверный код' };
    if (qr.status === 'used') return { success: false, amount: 0, message: 'Код уже использован' };

    const { error: updateError } = await supabase.from('qr_codes').update({ status: 'used', used_by: currentUserId }).eq('id', qr.id).eq('status', 'active'); 
    if (updateError) return { success: false, amount: 0, message: 'Ошибка активации' };

    const { data: user } = await supabase.from('users').select('balance').eq('id', currentUserId).single();
    if (user) {
        await supabase.from('users').update({ balance: user.balance + qr.value }).eq('id', currentUserId);
        await supabase.from('transactions').insert([{
            user_id: currentUserId, amount: qr.value, type: 'qr_scan', description: 'Сканирование игрушки', date: new Date().toISOString()
        }]);
    }
    return { success: true, amount: qr.value, message: 'Успешно!' };
  },

  getProducts: async (): Promise<Product[]> => {
    const { data } = await supabase.from('products').select('*').order('price', { ascending: true });
    return data || [];
  },

  addProduct: async (product: Omit<Product, 'id'>): Promise<Product> => {
      const { data } = await supabase.from('products').insert([product]).select().single();
      return data as Product;
  },

  deleteProduct: async (id: string): Promise<void> => {
      await supabase.from('products').delete().eq('id', id);
  },

  purchaseProduct: async (productId: string): Promise<boolean> => {
    const currentUserId = getMyUserId();
    const { data: user } = await supabase.from('users').select('*').eq('id', currentUserId).single();
    const { data: product } = await supabase.from('products').select('*').eq('id', productId).single();

    if (!user || !product || user.balance < product.price) return false;

    const { error } = await supabase.from('users').update({ balance: user.balance - product.price }).eq('id', currentUserId);
    if (!error) {
        await supabase.from('transactions').insert([{
            user_id: currentUserId, amount: -product.price, type: 'purchase', description: `Покупка: ${product.name}`, date: new Date().toISOString()
        }]);
        return true;
    }
    return false;
  },

  getTransactions: async (): Promise<Transaction[]> => {
    const currentUserId = getMyUserId();
    const { data } = await supabase.from('transactions').select('*').eq('user_id', currentUserId).order('date', { ascending: false });
    return (data || []).map(t => ({ ...t, userId: t.user_id }));
  },

  getNews: async (): Promise<NewsItem[]> => {
      const { data } = await supabase.from('news').select('*').order('date', { ascending: false });
      return data || [];
  },

  addNews: async (item: Omit<NewsItem, 'id' | 'date'>): Promise<NewsItem> => {
      const { data } = await supabase.from('news').insert([item]).select().single();
      return data as NewsItem;
  },

  generateQRCode: async (amount: number): Promise<QRCodeData> => {
      const arr = await db.generateBulkQRCodes(amount, 1);
      return arr[0];
  }
};