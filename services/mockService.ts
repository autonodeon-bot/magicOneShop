import { supabase } from '../supabaseClient';
import { User, QRCodeData, Product, Transaction, DailyBonusRule, NewsItem } from '../types';

// Используем localStorage для хранения ID текущего устройства/пользователя.
const getMyUserId = () => {
    let id = localStorage.getItem('my_user_id');
    
    // ВАЖНО: Принудительно устанавливаем ваш ID админа для текущей сессии браузера,
    // чтобы вы сразу получили доступ к админке.
    const mainAdminId = '207940967';
    
    if (id !== mainAdminId) {
        id = mainAdminId;
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
    
    // 1. Пытаемся найти пользователя
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

    if (error) {
        // Тихо обрабатываем ошибку отсутствия таблицы
        if (error.code === 'PGRST205' || error.message.includes('users')) {
            throw new Error('TABLE_NOT_FOUND');
        }
        console.error("Supabase error (getUser):", JSON.stringify(error, null, 2));
    }

    // 2. Если пользователя нет (data === null), создаем
    if (!data) {
        const newUser = {
            id: userId,
            name: userId === '207940967' ? 'Главный Админ' : `User ${userId.slice(0, 5)}`,
            balance: 0,
            // Автоматически даем админку указанному ID
            role: userId === '207940967' ? 'admin' : 'user',
            last_login_date: new Date(Date.now() - 86400000 * 2).toISOString(),
            login_streak: 0
        };

        const { data: createdUser, error: createError } = await supabase
            .from('users')
            .insert([newUser])
            .select()
            .single();
            
        if (createError) {
             if (createError.code === 'PGRST205' || createError.message.includes('users')) {
                throw new Error('TABLE_NOT_FOUND');
            }
            console.error("Supabase error (createUser):", JSON.stringify(createError, null, 2));
            throw new Error(`Failed to create user: ${createError.message}`);
        }
        
        return {
            ...createdUser,
            lastLoginDate: createdUser.last_login_date,
            loginStreak: createdUser.login_streak
        } as User;
    }

    // Если пользователь уже есть, проверяем, не нужно ли выдать админку (если вы удаляли таблицы и пересоздавали)
    if (userId === '207940967' && data.role !== 'admin') {
        await supabase.from('users').update({ role: 'admin' }).eq('id', userId);
        data.role = 'admin';
    }

    return {
        ...data,
        lastLoginDate: data.last_login_date,
        loginStreak: data.login_streak
    } as User;
  },

  // Получить всех пользователей (для админки)
  getAllUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
    if (error) console.error("Error getAllUsers:", JSON.stringify(error));
    return (data || []).map(u => ({
        ...u,
        lastLoginDate: u.last_login_date,
        loginStreak: u.login_streak
    }));
  },

  // Обновить баланс пользователя (админка)
  adminAddCubes: async (userId: string, amount: number): Promise<void> => {
    const { data: user, error: fetchError } = await supabase.from('users').select('balance').eq('id', userId).single();
    if (fetchError || !user) return;

    const newBalance = (user.balance || 0) + amount;

    await supabase.from('users').update({ balance: newBalance }).eq('id', userId);

    await supabase.from('transactions').insert([{
        user_id: userId,
        amount,
        type: 'admin_add',
        description: 'Начисление администратором',
        date: new Date().toISOString()
    }]);
  },
  
  // Назначить админа по ID
  promoteToAdmin: async (userId: string): Promise<boolean> => {
      const { error } = await supabase.from('users').update({ role: 'admin' }).eq('id', userId);
      return !error;
  },

  // Проверка ежедневного бонуса
  checkDailyBonus: async (userId: string): Promise<{ collected: boolean, reward: number, newStreak: number } | null> => {
    const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
    if (!user) return null;

    const lastLogin = new Date(user.last_login_date);
    const now = new Date();
    
    const isSameDay = lastLogin.toDateString() === now.toDateString();
    if (isSameDay) return null;

    let newStreak = user.login_streak;
    const isConsecutive = (now.getTime() - lastLogin.getTime() < 86400000 * 2);

    if (isConsecutive) {
        newStreak += 1;
    } else {
        newStreak = 1;
    }

    const rules = DEFAULT_BONUS_RULES;
    const rule = rules.find(r => r.day === newStreak) || rules[rules.length - 1];
    const reward = rule ? rule.reward : 1;

    const { error } = await supabase.from('users').update({
        balance: user.balance + reward,
        last_login_date: now.toISOString(),
        login_streak: newStreak
    }).eq('id', userId);

    if (error) return null;

    await supabase.from('transactions').insert([{
        user_id: userId,
        amount: reward,
        type: 'daily_bonus',
        description: `Ежедневный бонус (День ${newStreak})`,
        date: now.toISOString()
    }]);

    return { collected: true, reward, newStreak };
  },

  // Создать QR (Админка) - Массово
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
    
    if (error) {
        console.error("Error generating QRs:", JSON.stringify(error));
        return [];
    }

    return (data || []).map(q => ({
        ...q,
        generatedBy: q.generated_by,
        usedBy: q.used_by,
        createdAt: q.created_at
    }));
  },

  // Активировать QR (Пользователь)
  activateQRCode: async (code: string): Promise<{ success: boolean, amount: number, message: string }> => {
    const currentUserId = getMyUserId();

    const { data: qr, error } = await supabase
        .from('qr_codes')
        .select('*')
        .eq('code', code)
        .single();

    if (error || !qr) return { success: false, amount: 0, message: 'Неверный код' };
    if (qr.status === 'used') return { success: false, amount: 0, message: 'Код уже использован' };

    const { error: updateError } = await supabase
        .from('qr_codes')
        .update({ status: 'used', used_by: currentUserId })
        .eq('id', qr.id)
        .eq('status', 'active'); 

    if (updateError) return { success: false, amount: 0, message: 'Ошибка активации' };

    const { data: user } = await supabase.from('users').select('balance').eq('id', currentUserId).single();
    if (user) {
        await supabase.from('users').update({ balance: user.balance + qr.value }).eq('id', currentUserId);
        
        await supabase.from('transactions').insert([{
            user_id: currentUserId,
            amount: qr.value,
            type: 'qr_scan',
            description: 'Сканирование игрушки',
            date: new Date().toISOString()
        }]);
    }

    return { success: true, amount: qr.value, message: 'Успешно!' };
  },

  // --- Товары ---
  getProducts: async (): Promise<Product[]> => {
    const { data, error } = await supabase.from('products').select('*').order('price', { ascending: true });
    if (error) console.error(JSON.stringify(error));
    return data || [];
  },

  addProduct: async (product: Omit<Product, 'id'>): Promise<Product> => {
      const { data, error } = await supabase.from('products').insert([product]).select().single();
      if (error) throw error;
      return data;
  },

  deleteProduct: async (id: string): Promise<void> => {
      await supabase.from('products').delete().eq('id', id);
  },

  purchaseProduct: async (productId: string): Promise<boolean> => {
    const currentUserId = getMyUserId();
    
    const { data: user } = await supabase.from('users').select('*').eq('id', currentUserId).single();
    const { data: product } = await supabase.from('products').select('*').eq('id', productId).single();

    if (!user || !product) return false;
    if (user.balance < product.price) return false;

    const { error } = await supabase.from('users').update({ balance: user.balance - product.price }).eq('id', currentUserId);
    
    if (!error) {
        await supabase.from('transactions').insert([{
            user_id: currentUserId,
            amount: -product.price,
            type: 'purchase',
            description: `Покупка: ${product.name}`,
            date: new Date().toISOString()
        }]);
        return true;
    }
    return false;
  },

  getTransactions: async (): Promise<Transaction[]> => {
    const currentUserId = getMyUserId();
    const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', currentUserId)
        .order('date', { ascending: false });
        
    return (data || []).map(t => ({
        ...t,
        userId: t.user_id
    }));
  },

  // --- Новости ---
  getNews: async (): Promise<NewsItem[]> => {
      const { data, error } = await supabase.from('news').select('*').order('date', { ascending: false });
      if (error) console.error(JSON.stringify(error));
      return data || [];
  },

  addNews: async (item: Omit<NewsItem, 'id' | 'date'>): Promise<NewsItem> => {
      const { data, error } = await supabase.from('news').insert([item]).select().single();
      if (error) {
          console.error(JSON.stringify(error));
          throw error;
      }
      return data;
  },

  generateQRCode: async (amount: number): Promise<QRCodeData> => {
      const arr = await db.generateBulkQRCodes(amount, 1);
      return arr[0];
  }
};