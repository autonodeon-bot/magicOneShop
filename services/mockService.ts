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
    const mainAdminId = '207940967'; 
    if (!id) {
        // Используем числовой ID даже для заглушки, чтобы избежать ошибки типов в БД (если колонка bigint)
        id = Math.floor(Math.random() * 1000000000).toString();
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
    
    // Формируем актуальное имя на основе данных ТГ или дефолтное
    let realName = `User ${userId.slice(0, 5)}`;
    if (tgUser) {
        realName = tgUser.first_name;
        if (tgUser.last_name) realName += ` ${tgUser.last_name}`;
    } else if (userId === '207940967') {
        realName = 'Главный Админ';
    }

    console.log(`[DB] Connecting as user: ${userId} (${realName})`);

    try {
        // 1. Попытка найти пользователя в базе
        const { data: existingUser, error: selectError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .maybeSingle();

        // Если ошибка доступа или соединения (не просто "не найдено")
        if (selectError) {
            console.error("[DB] Select Error:", JSON.stringify(selectError, null, 2));
            throw selectError;
        }

        // 2. Если пользователя НЕТ -> Создаем (INSERT)
        if (!existingUser) {
            console.log("[DB] User not found, creating new...");
            // Убираем username из INSERT, так как колонки нет в базе
            const newUser = {
                id: userId,
                name: realName,
                // username: tgUser?.username || null, // REMOVED to fix PGRST204
                balance: 0,
                role: userId === '207940967' ? 'admin' : 'user',
                last_login_date: new Date(Date.now() - 86400000 * 2).toISOString(),
                login_streak: 0,
                created_at: new Date().toISOString()
            };

            const { data: createdUser, error: insertError } = await supabase
                .from('users')
                .insert([newUser])
                .select()
                .single();

            if (insertError) {
                console.error("[DB] Insert Error:", JSON.stringify(insertError, null, 2));
                // Если ошибка RLS (Policy), даем подсказку в консоль
                if (insertError.code === '42501') {
                    console.error("[DB] RLS VIOLATION. Please disable RLS or add policies in Supabase SQL Editor:\nALTER TABLE users DISABLE ROW LEVEL SECURITY;");
                }
                throw insertError;
            }

            console.log("[DB] User created successfully:", createdUser);
            
            return {
                ...createdUser,
                username: tgUser?.username, // Добавляем локально для отображения
                lastLoginDate: createdUser.last_login_date,
                loginStreak: createdUser.login_streak
            } as User;
        }

        // 3. Если пользователь найден - обновляем данные
        console.log("[DB] User found:", existingUser);
        
        // Если данные устарели (имя поменялось или роль админа не проставлена), обновляем
        const updates: any = {};
        if (existingUser.name !== realName) updates.name = realName;
        // Убираем обновление username, так как колонки нет в базе
        // if (tgUser?.username && existingUser.username !== tgUser.username) updates.username = tgUser.username; 
        
        // Хардкод админа: если ID совпадает, а в базе роль не admin -> чиним базу и объект
        if (userId === '207940967' && existingUser.role !== 'admin') {
            updates.role = 'admin';
            existingUser.role = 'admin'; // Обновляем локальный объект сразу
        }

        if (Object.keys(updates).length > 0) {
            await supabase.from('users').update(updates).eq('id', userId);
            // Применяем обновления локально для быстрого рендера
            Object.assign(existingUser, updates);
        }

        return {
            ...existingUser,
            username: tgUser?.username || existingUser.username, // Используем локальный из ТГ если есть
            lastLoginDate: existingUser.last_login_date,
            loginStreak: existingUser.login_streak
        } as User;

    } catch (e: any) {
        console.error("CRITICAL DB ERROR. Falling back to offline mode.", JSON.stringify(e, null, 2));
        
        // ВАЖНО: Если мы здесь, значит база данных недоступна, ключ неверен, или RLS блокирует доступ.
        // Мы возвращаем "фейкового" пользователя, чтобы приложение не зависло на белом экране.
        return {
            id: userId,
            name: realName + " (Offline)",
            username: tgUser?.username,
            balance: 0,
            role: userId === '207940967' ? 'admin' : 'user',
            lastLoginDate: new Date().toISOString(),
            loginStreak: 0
        };
    }
  },

  getAllUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (error) {
        console.error("getAllUsers error:", JSON.stringify(error, null, 2));
        return [];
    }
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
        // Сброс времени для корректного сравнения дат
        const lastLoginDate = new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate());
        const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (lastLoginDate.getTime() === nowDate.getTime()) return null;

        let newStreak = user.login_streak;
        // Разница в днях
        const diffTime = Math.abs(nowDate.getTime() - lastLoginDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

        if (diffDays === 1) {
            newStreak += 1;
        } else {
            newStreak = 1;
        }

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
        console.error("Bonus error:", JSON.stringify(e, null, 2));
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
    const { data, error } = await supabase.from('qr_codes').insert(rows).select();
    if(error) console.error("QR Generation Error:", JSON.stringify(error, null, 2));
    return (data || []).map(q => ({ ...q, generatedBy: q.generated_by, usedBy: q.used_by, createdAt: q.created_at }));
  },

  activateQRCode: async (code: string): Promise<{ success: boolean, amount: number, message: string }> => {
    const currentUserId = getMyUserId();
    const { data: qr, error: qrError } = await supabase.from('qr_codes').select('*').eq('code', code).single();

    if (qrError) console.error("QR Fetch Error:", JSON.stringify(qrError, null, 2));
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