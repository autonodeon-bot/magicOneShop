import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, Check, Gift, History, PlusCircle, Copy, ShoppingBag, Settings, Trash2, Newspaper, UserPlus, Tag, Type, Image as ImageIcon, Download, FileText, ChevronRight, Trophy } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react'; 
import { db } from './services/mockService';
import { User, Product, Transaction, QRCodeData, NewsItem } from './types';
import { TabBar, Cube, Button, Card, TiltCard, Particles, AnimatedNumber, Toast, Skeleton, Modal } from './components/ui';

// Imports for Docx
import FileSaver from 'file-saver';
import { Document, Packer, Paragraph, Table, TableRow, TableCell, ImageRun, TextRun, WidthType, AlignmentType, BorderStyle } from 'docx';
import QRCode from 'qrcode'; 

// --- Sub Components ---

const Confetti = () => {
    // Simple DOM confetti
    return (
        <div className="fixed inset-0 pointer-events-none z-[70] overflow-hidden flex justify-center">
            {[...Array(50)].map((_, i) => (
                <motion.div
                    key={i}
                    initial={{ y: -20, x: 0, opacity: 1, rotate: 0 }}
                    animate={{ 
                        y: window.innerHeight + 100, 
                        x: (Math.random() - 0.5) * 500,
                        rotate: 720,
                        opacity: 0
                    }}
                    transition={{ duration: 2 + Math.random(), ease: "easeOut" }}
                    className="absolute top-0 w-2 h-2"
                    style={{
                        backgroundColor: ['#FACC15', '#A855F7', '#3B82F6', '#EF4444'][Math.floor(Math.random() * 4)],
                        left: '50%'
                    }}
                />
            ))}
        </div>
    )
}

const DailyBonusModal = ({ onClose, rule, streak }: { onClose: () => void, rule: number, streak: number }) => {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <motion.div 
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        className="bg-dark-800 border border-gold-500/50 rounded-3xl p-8 w-full max-w-sm text-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-full bg-gold-500/10 radial-gradient pointer-events-none" />
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute -top-20 -right-20 w-64 h-64 bg-gold-500/20 rounded-full blur-3xl"
        />
        <h2 className="text-2xl font-bold text-white mb-2">Ежедневный бонус!</h2>
        <p className="text-gray-400 mb-6">Вы заходите {streak} день подряд</p>
        <div className="flex justify-center mb-8 relative">
            <motion.div 
                className="absolute inset-0 bg-gold-500/40 blur-2xl rounded-full"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 2, repeat: Infinity }} className="relative z-10">
                <Cube size={80} />
            </motion.div>
        </div>
        <div className="text-5xl font-black text-gold-400 mb-8 drop-shadow-lg">+{rule}</div>
        <Button onClick={onClose}>Забрать награду</Button>
      </motion.div>
    </div>
  );
};

const RankProgress = ({ balance }: { balance: number }) => {
    // Rank Logic
    const ranks = [
        { name: 'Новичок', min: 0 },
        { name: 'Искатель', min: 100 },
        { name: 'Коллекционер', min: 300 },
        { name: 'Магнат', min: 1000 },
        { name: 'Легенда', min: 5000 },
    ];
    
    const currentRankIndex = ranks.findIndex((r, i) => balance >= r.min && (ranks[i+1] ? balance < ranks[i+1].min : true));
    const currentRank = ranks[currentRankIndex];
    const nextRank = ranks[currentRankIndex + 1];
    
    let progress = 100;
    let nextTarget = 0;
    
    if (nextRank) {
        nextTarget = nextRank.min;
        const prevTarget = currentRank.min;
        progress = ((balance - prevTarget) / (nextTarget - prevTarget)) * 100;
    }

    return (
        <Card className="mx-4 mt-2 mb-6" noPadding>
            <div className="p-4 bg-gradient-to-r from-dark-800 to-dark-700/50">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                        <Trophy size={16} className="text-gold-500" />
                        <span className="font-bold text-sm text-gold-100">{currentRank.name}</span>
                    </div>
                    {nextRank && <span className="text-xs text-gray-500">{balance} / {nextRank.min}</span>}
                </div>
                <div className="h-2 bg-dark-900 rounded-full overflow-hidden border border-white/5">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(progress, 100)}%` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-gold-600 to-gold-400 rounded-full shadow-[0_0_10px_#EAB308]" 
                    />
                </div>
                {nextRank && (
                    <div className="mt-2 text-[10px] text-gray-500 text-center">
                        До ранга "{nextRank.name}" осталось {nextRank.min - balance} <Cube size={10} className="inline"/>
                    </div>
                )}
            </div>
        </Card>
    );
};

const HomePage = ({ user }: { user: User }) => {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        db.getNews().then(data => {
            setNews(data);
            setLoading(false);
        });
    }, []);

  return (
    <div className="space-y-6 pt-4 pb-24 relative z-10">
      {/* Header Balance */}
      <div className="flex flex-col items-center justify-center py-6 relative">
        <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="absolute inset-0 bg-gold-500/5 blur-3xl rounded-full"
        />
        <span className="text-gold-200/60 text-sm font-medium tracking-widest uppercase mb-2">Ваш баланс</span>
        <div className="flex items-center gap-4 relative z-10">
           <Cube size={52} />
           <span className="text-6xl font-black text-white tracking-tighter drop-shadow-xl">
                <AnimatedNumber value={user.balance} />
           </span>
        </div>
      </div>

      <RankProgress balance={user.balance} />

      {/* Bonus Tracker */}
      <Card className="mx-4 relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
        <div className="flex justify-between items-center mb-4 relative z-10">
          <h3 className="font-bold text-lg flex items-center gap-2 text-white">
            <Gift size={20} className="text-gold-400" /> 
            Стрик входа
          </h3>
          <span className="bg-gold-500/20 text-gold-400 px-3 py-1 rounded-full text-xs font-bold border border-gold-500/20">
            {user.loginStreak} дн.
          </span>
        </div>
        <div className="flex justify-between items-center gap-2 relative z-10">
            {[1, 2, 3, 4, 5].map((day) => {
                const isCompleted = user.loginStreak >= day;
                return (
                    <div key={day} className="flex flex-col items-center gap-2 flex-1">
                        <div className={`w-full h-1.5 rounded-full transition-colors duration-500 ${isCompleted ? 'bg-gold-500 shadow-[0_0_8px_#EAB308]' : 'bg-dark-600'}`} />
                        <span className={`text-[10px] font-bold ${isCompleted ? 'text-gold-400' : 'text-gray-600'}`}>{day}</span>
                    </div>
                )
            })}
        </div>
      </Card>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-4 px-4">
        <TiltCard className="h-36 relative overflow-hidden group bg-gradient-to-br from-indigo-900 to-indigo-950">
            <div className="absolute -right-4 -top-4 text-indigo-500/20 group-hover:text-indigo-500/30 transition-colors">
                <QrCode size={90}/>
            </div>
            <div className="relative z-10 h-full flex flex-col justify-between p-1">
                <span className="font-bold text-lg leading-tight">Сканировать<br/>игрушку</span>
                <div className="flex items-center gap-2 text-xs text-indigo-300 group-hover:text-white transition-colors">
                    Вперед <ChevronRight size={14} />
                </div>
            </div>
        </TiltCard>
        
        <TiltCard className="h-36 relative overflow-hidden group bg-gradient-to-br from-gold-900/50 to-amber-950/50">
             <div className="absolute -right-4 -bottom-4 text-gold-500/10 group-hover:text-gold-500/20 transition-colors">
                <Gift size={90}/>
            </div>
            <div className="relative z-10 h-full flex flex-col justify-between p-1">
                <span className="font-bold text-lg leading-tight text-white">Магазин<br/>подарков</span>
                 <div className="flex items-center gap-2 text-xs text-gold-300 group-hover:text-white transition-colors">
                    Потратить <ChevronRight size={14} />
                </div>
            </div>
        </TiltCard>
      </div>

      <div className="px-4">
        <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-white/90">
            <Newspaper size={20} className="text-gray-400"/> Новости
        </h3>
        <div className="space-y-4">
            {loading ? (
                <>
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-48 w-full" />
                </>
            ) : news.length === 0 ? (
                <div className="text-center py-10 opacity-50">
                    <Newspaper size={48} className="mx-auto mb-2 text-gray-600" />
                    <p>Новостей пока нет</p>
                </div>
            ) : (
                news.map(item => (
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={item.id} 
                        className="bg-dark-800 rounded-3xl overflow-hidden border border-white/5 shadow-lg group"
                    >
                        {item.image && (
                            <div className="h-40 overflow-hidden relative">
                                <img src={item.image} alt={item.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                <div className="absolute inset-0 bg-gradient-to-t from-dark-800 to-transparent opacity-80" />
                            </div>
                        )}
                        <div className="p-5 -mt-6 relative z-10">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] uppercase tracking-wider text-gold-500 font-bold bg-gold-500/10 px-2 py-1 rounded-lg">News</span>
                                <span className="text-xs text-gray-500">{new Date(item.date).toLocaleDateString()}</span>
                            </div>
                            <h4 className="font-bold text-lg mb-2 text-white">{item.title}</h4>
                            <p className="text-gray-400 text-sm leading-relaxed">{item.content}</p>
                        </div>
                    </motion.div>
                ))
            )}
        </div>
      </div>
    </div>
  );
};

const TransactionsList = ({ limit }: { limit?: number }) => {
    const [txs, setTxs] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    
    useEffect(() => {
        db.getTransactions().then(data => {
            setTxs(limit ? data.slice(0, limit) : data);
            setLoading(false);
        });
    }, [limit]);

    if (loading) return <div className="space-y-3"><Skeleton className="h-16"/><Skeleton className="h-16"/></div>;

    if (txs.length === 0) return (
        <div className="text-center py-8 border border-dashed border-white/10 rounded-2xl">
            <History className="mx-auto text-gray-600 mb-2" />
            <span className="text-sm text-gray-500">История пуста</span>
        </div>
    );

    return (
        <div className="space-y-3">
            {txs.map((tx, i) => (
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={tx.id} 
                    className="bg-dark-800/50 p-4 rounded-2xl flex items-center justify-between border border-white/5"
                >
                    <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.amount > 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            {tx.amount > 0 ? <PlusCircle size={20}/> : <ShoppingBag size={20}/>}
                        </div>
                        <div>
                            <div className="text-sm font-bold text-white">{tx.description}</div>
                            <div className="text-xs text-gray-500">{new Date(tx.date).toLocaleDateString()}</div>
                        </div>
                    </div>
                    <div className={`font-black text-lg ${tx.amount > 0 ? 'text-green-400' : 'text-white/80'}`}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </div>
                </motion.div>
            ))}
        </div>
    )
}

const ShopPage = ({ user, refreshUser, showToast }: { user: User, refreshUser: () => void, showToast: (m: string, t: 'success'|'error') => void }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [buying, setBuying] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    db.getProducts().then(data => {
        setProducts(data);
        setLoading(false);
    });
  }, []);

  const handleBuy = async () => {
    if (!selectedProduct) return;
    if (user.balance < selectedProduct.price) {
        showToast("Недостаточно кубиков!", "error");
        return;
    }
    
    setBuying(true);
    const success = await db.purchaseProduct(selectedProduct.id);
    if (success) {
        refreshUser();
        showToast("Успешно куплено!", "success");
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
        setSelectedProduct(null);
    } else {
        showToast("Ошибка покупки.", "error");
    }
    setBuying(false);
  };

  return (
    <div className="p-4 space-y-4 pb-24 relative z-10">
      {showConfetti && <Confetti />}
      <h2 className="text-2xl font-bold px-1">Магазин наград</h2>
      
      {/* Product Detail Modal */}
      <Modal 
        isOpen={!!selectedProduct} 
        onClose={() => setSelectedProduct(null)} 
        title="Подтверждение"
      >
        {selectedProduct && (
            <div className="space-y-4">
                 <div className="rounded-2xl overflow-hidden aspect-square relative">
                    <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2 bg-dark-900/80 backdrop-blur px-3 py-1 rounded-full text-gold-400 font-bold border border-gold-500/20">
                        {selectedProduct.price} <Cube size={14} className="inline -mt-1"/>
                    </div>
                 </div>
                 <div>
                    <h3 className="text-xl font-bold mb-2">{selectedProduct.name}</h3>
                    <p className="text-gray-400 text-sm">{selectedProduct.description}</p>
                 </div>
                 <div className="flex gap-3 pt-2">
                    <Button variant="secondary" onClick={() => setSelectedProduct(null)}>Отмена</Button>
                    <Button onClick={handleBuy} disabled={buying}>
                        {buying ? 'Обработка...' : `Купить за ${selectedProduct.price}`}
                    </Button>
                 </div>
            </div>
        )}
      </Modal>

      <div className="grid grid-cols-2 gap-4">
        {loading ? (
            <>
                <Skeleton className="h-64 rounded-3xl" />
                <Skeleton className="h-64 rounded-3xl" />
                <Skeleton className="h-64 rounded-3xl" />
                <Skeleton className="h-64 rounded-3xl" />
            </>
        ) : products.length === 0 ? (
            <div className="col-span-2 text-center py-10 text-gray-500">Товаров пока нет</div>
        ) : (
            products.map(p => (
                <TiltCard 
                    key={p.id} 
                    className="flex flex-col h-full"
                    onClick={() => setSelectedProduct(p)}
                >
                    <div className="aspect-square bg-dark-700 rounded-2xl mb-3 overflow-hidden relative">
                        <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-dark-900/80 to-transparent opacity-60" />
                        <div className="absolute bottom-2 left-2 right-2">
                             <div className="text-xs text-gold-400 font-bold bg-dark-900/90 w-fit px-2 py-1 rounded-lg backdrop-blur-sm border border-gold-500/20">
                                {p.price} <Cube size={12} className="inline"/>
                             </div>
                        </div>
                    </div>
                    <h3 className="font-bold text-sm mb-1 leading-tight">{p.name}</h3>
                    <p className="text-[11px] text-gray-500 line-clamp-2">{p.description}</p>
                </TiltCard>
            ))
        )}
      </div>
    </div>
  );
};

const ScannerPage = ({ refreshUser, showToast }: { refreshUser: () => void, showToast: (m: string, t: 'success'|'error') => void }) => {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [cameraActive, setCameraActive] = useState(false);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setCameraActive(true);
            }
        } catch (e) {
            console.error("Camera error", e);
            showToast("Не удалось запустить камеру", "error");
        }
    };

    const handleCodeSubmit = async () => {
        if (!code) return;
        setLoading(true);
        const res = await db.activateQRCode(code.toUpperCase().trim());
        
        if (res.success) {
            refreshUser();
            showToast(`+${res.amount} кубиков!`, "success");
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3000);
            setCode('');
        } else {
            showToast(res.message, "error");
        }
        setLoading(false);
    };

    return (
        <div className="flex flex-col h-screen pb-24 relative bg-black">
            {showConfetti && <Confetti />}
            <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-dark-900">
                {cameraActive ? (
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-80" />
                ) : (
                    <div className="text-center p-6 relative z-10">
                        <div className="w-20 h-20 bg-dark-800 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                            <QrCode size={40} className="text-gold-500" />
                        </div>
                        <p className="text-gray-400 mb-6 font-medium">Наведите камеру на QR код игрушки</p>
                        <Button onClick={startCamera} variant="secondary" className="w-auto px-8">Включить камеру</Button>
                    </div>
                )}
                
                {/* Scanner Overlay UI */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-64 h-64 relative">
                        <div className="absolute inset-0 border-2 border-gold-500/30 rounded-3xl animate-pulse"></div>
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-gold-500 rounded-tl-2xl -mt-1 -ml-1"></div>
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-gold-500 rounded-tr-2xl -mt-1 -mr-1"></div>
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-gold-500 rounded-bl-2xl -mb-1 -ml-1"></div>
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-gold-500 rounded-br-2xl -mb-1 -mr-1"></div>
                        
                        {/* Scanning Laser Line */}
                        <motion.div 
                            animate={{ top: ['0%', '100%', '0%'] }}
                            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                            className="absolute left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_15px_red] w-full"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-dark-900 p-6 rounded-t-3xl -mt-6 relative z-10 border-t border-white/10 shadow-2xl">
                <h3 className="font-bold text-center mb-4 text-sm text-gray-400 uppercase tracking-widest">Ручной ввод</h3>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="CODE-123"
                        className="flex-1 bg-dark-800 border border-dark-700 rounded-2xl px-5 py-4 text-white focus:border-gold-500 outline-none uppercase font-mono tracking-wider transition-colors placeholder:text-dark-600"
                    />
                    <Button className="w-auto px-6 rounded-2xl" onClick={handleCodeSubmit} disabled={loading}>
                        {loading ? '...' : <Check />}
                    </Button>
                </div>
            </div>
        </div>
    );
};

const ProfilePage = ({ user }: { user: User }) => {
    return (
        <div className="p-4 space-y-6 pb-24 relative z-10">
            <div className="flex items-center gap-5 p-2">
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-gold-400 to-purple-600 p-[2px] shadow-2xl">
                    <div className="w-full h-full rounded-full bg-dark-900 flex items-center justify-center text-4xl font-black text-white">
                        {user.name[0]}
                    </div>
                </div>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{user.name}</h2>
                    <p className="text-gray-400 text-sm font-mono opacity-60">ID: {user.id}</p>
                    <div className="flex gap-2 mt-2">
                        <span className="text-[10px] uppercase font-bold bg-dark-800 border border-white/10 px-2 py-1 rounded text-gray-300">
                            {user.role === 'admin' ? 'Администратор' : 'Участник'}
                        </span>
                    </div>
                </div>
            </div>

            <Card className="relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-10 bg-gold-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400 font-medium">Общий заработок</span>
                    <span className="font-bold text-xl text-white">{user.balance + 150} <Cube className="inline"/></span>
                </div>
                <div className="w-full bg-dark-900 h-3 rounded-full mt-3 overflow-hidden border border-white/5">
                    <div className="bg-gradient-to-r from-gold-600 to-gold-400 h-full w-[70%] shadow-[0_0_15px_rgba(234,179,8,0.5)]"></div>
                </div>
            </Card>

            <div>
                <h3 className="font-bold mb-4 flex items-center gap-2 text-lg"><History size={20} className="text-gold-500"/> История операций</h3>
                <TransactionsList />
            </div>
        </div>
    );
};

const AdminPage = ({ showToast }: { showToast: (m: string, t: 'success'|'error') => void }) => {
    const [subTab, setSubTab] = useState<'users' | 'qr' | 'shop' | 'news' | 'admins'>('qr');
    const [users, setUsers] = useState<User[]>([]);
    
    // QR State
    const [qrValue, setQrValue] = useState(10);
    const [qrCount, setQrCount] = useState(10);
    const [qrSize, setQrSize] = useState(150); 
    const [isGenerating, setIsGenerating] = useState(false);

    // Shop State
    const [products, setProducts] = useState<Product[]>([]);
    const [newProduct, setNewProduct] = useState({ name: '', price: 10, image: '', description: '' });

    // Admin Add State
    const [newAdminId, setNewAdminId] = useState('');

    // News State
    const [newsTitle, setNewsTitle] = useState('');
    const [newsContent, setNewsContent] = useState('');
    const [newsImage, setNewsImage] = useState('');

    const refreshData = () => {
        db.getAllUsers().then(setUsers);
        db.getProducts().then(setProducts);
    };

    useEffect(() => {
        refreshData();
    }, [subTab]);

    const handleGenerateBulk = async () => {
        setIsGenerating(true);
        try {
            const codes = await db.generateBulkQRCodes(qrValue, qrCount);
            
            const rows = [];
            let cells = [];

            for (let i = 0; i < codes.length; i++) {
                const qrData = codes[i];
                const dataUrl = await QRCode.toDataURL(qrData.code, { margin: 1, width: 300 });
                
                const cell = new TableCell({
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new ImageRun({
                                    data: dataUrl,
                                    transformation: {
                                        width: qrSize,
                                        height: qrSize,
                                    },
                                    type: "png"
                                }),
                            ],
                        }),
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [new TextRun({ text: qrData.code, bold: true, size: 24 })], 
                        }),
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [new TextRun({ text: `+${qrData.value} Cubes`, size: 20, color: "EAB308" })],
                        })
                    ],
                    borders: {
                        top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                        left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                        right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
                    },
                    width: { size: 33, type: WidthType.PERCENTAGE }, 
                });

                cells.push(cell);

                if (cells.length === 3 || i === codes.length - 1) {
                    rows.push(new TableRow({ children: cells }));
                    cells = [];
                }
            }

            const doc = new Document({
                sections: [{
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: `Партия QR кодов (${qrCount} шт.) - ${new Date().toLocaleDateString()}`, bold: true, size: 28 })],
                            alignment: AlignmentType.CENTER,
                            spacing: { after: 400 }
                        }),
                        new Table({
                            rows: rows,
                            width: { size: 100, type: WidthType.PERCENTAGE },
                        }),
                    ],
                }],
            });

            const blob = await Packer.toBlob(doc);
            FileSaver.saveAs(blob, `QR_Codes_${qrCount}_x_${qrValue}_cubes.docx`);
            
            showToast(`Сгенерировано ${qrCount} кодов!`, "success");
        } catch (error) {
            console.error(error);
            showToast("Ошибка генерации", "error");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleAddBalance = async (userId: string) => {
        const amount = Number(prompt("Сколько кубиков добавить?"));
        if (amount) {
            await db.adminAddCubes(userId, amount);
            refreshData();
            showToast("Баланс пополнен", "success");
        }
    };

    const handleAddProduct = async () => {
        if (!newProduct.name || !newProduct.image) return showToast("Заполните поля", "error");
        await db.addProduct(newProduct);
        setNewProduct({ name: '', price: 10, image: '', description: '' });
        refreshData();
        showToast("Товар добавлен", "success");
    };

    const handleDeleteProduct = async (id: string) => {
        if (confirm("Удалить товар?")) {
            await db.deleteProduct(id);
            refreshData();
            showToast("Товар удален", "success");
        }
    };

    const handleAddAdmin = async () => {
        if (!newAdminId) return;
        await db.promoteToAdmin(newAdminId);
        setNewAdminId('');
        refreshData();
        showToast("Администратор добавлен", "success");
    };

    const handleAddNews = async () => {
        if (!newsTitle || !newsContent) return showToast("Заголовок и текст обязательны", "error");
        await db.addNews({ title: newsTitle, content: newsContent, image: newsImage });
        setNewsTitle('');
        setNewsContent('');
        setNewsImage('');
        showToast("Новость опубликована", "success");
    };

    return (
        <div className="p-4 space-y-4 pb-24 relative z-10">
            <h2 className="text-2xl font-bold mb-4 pl-2 border-l-4 border-gold-500">Админ Панель</h2>
            
            <div className="flex bg-dark-800/50 p-1.5 rounded-2xl mb-4 overflow-x-auto scrollbar-hide border border-white/5">
                {(['qr', 'users', 'shop', 'news', 'admins'] as const).map(t => (
                    <button 
                        key={t}
                        onClick={() => setSubTab(t)}
                        className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${subTab === t ? 'bg-gold-500 text-dark-900 shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                        {t === 'qr' ? 'QR Коды' : t === 'users' ? 'Пользователи' : t === 'shop' ? 'Магазин' : t === 'news' ? 'Новости' : 'Админы'}
                    </button>
                ))}
            </div>

            <AnimatePresence mode="wait">
            <motion.div 
                key={subTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
            >
            {subTab === 'qr' && (
                <div className="space-y-6">
                    <Card>
                        <h3 className="font-bold mb-4 flex items-center gap-2">
                            <FileText size={20} className="text-gold-500"/> Генерация для печати (.docx)
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="text-xs text-gray-400 block mb-2 font-bold uppercase">Ценность</label>
                                <input 
                                    type="number" 
                                    value={qrValue} 
                                    onChange={(e) => setQrValue(Number(e.target.value))}
                                    className="input-std" 
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 block mb-2 font-bold uppercase">Количество</label>
                                <input 
                                    type="number" 
                                    value={qrCount} 
                                    onChange={(e) => setQrCount(Number(e.target.value))}
                                    className="input-std" 
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs text-gray-400 block mb-2 font-bold uppercase">Размер (px)</label>
                                <input 
                                    type="number" 
                                    value={qrSize} 
                                    onChange={(e) => setQrSize(Number(e.target.value))}
                                    className="input-std" 
                                    placeholder="По умолчанию 150"
                                />
                            </div>
                        </div>

                        <Button onClick={handleGenerateBulk} disabled={isGenerating}>
                            {isGenerating ? 'Создание документа...' : (
                                <span className="flex items-center gap-2">
                                    <Download size={18}/> Скачать Word файл
                                </span>
                            )}
                        </Button>
                    </Card>
                </div>
            )}

            {subTab === 'users' && (
                <div className="space-y-3">
                    {users.map(u => (
                        <div key={u.id} className="bg-dark-800 p-4 rounded-xl flex justify-between items-center border border-white/5">
                            <div>
                                <div className="font-bold flex items-center gap-2">
                                    {u.name}
                                    {u.role === 'admin' && <span className="text-[10px] bg-gold-500/20 text-gold-500 px-1 rounded font-bold uppercase tracking-wider">ADMIN</span>}
                                </div>
                                <div className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                                    ID: <span className="font-mono">{u.id}</span>
                                </div>
                                <div className="text-sm mt-1">Баланс: <span className="text-gold-400 font-bold">{u.balance}</span></div>
                            </div>
                            <button 
                                onClick={() => handleAddBalance(u.id)}
                                className="bg-dark-700 p-3 rounded-xl text-gold-400 hover:bg-gold-500 hover:text-dark-900 transition-colors"
                            >
                                <PlusCircle size={20} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {subTab === 'shop' && (
                <div className="space-y-6">
                    <Card>
                        <h3 className="font-bold mb-4 text-lg">Добавить товар</h3>
                        <div className="space-y-4">
                            <input type="text" placeholder="Название" className="input-std" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
                            <div className="flex gap-4">
                                <input type="number" placeholder="Цена" className="input-std" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: Number(e.target.value)})} />
                            </div>
                            <input type="text" placeholder="URL Картинки" className="input-std" value={newProduct.image} onChange={e => setNewProduct({...newProduct, image: e.target.value})} />
                            <input type="text" placeholder="Описание" className="input-std" value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} />
                            <Button onClick={handleAddProduct}>Добавить</Button>
                        </div>
                    </Card>
                    <div className="space-y-2">
                        {products.map(p => (
                             <div key={p.id} className="bg-dark-800 p-3 rounded-2xl flex gap-4 items-center border border-white/5">
                                <img src={p.image} className="w-16 h-16 rounded-xl object-cover bg-dark-700" alt="" />
                                <div className="flex-1">
                                    <div className="font-bold text-sm">{p.name}</div>
                                    <div className="text-xs text-gold-400 font-bold mt-1 bg-gold-500/10 w-fit px-2 py-0.5 rounded">{p.price} cubes</div>
                                </div>
                                <button onClick={() => handleDeleteProduct(p.id)} className="text-red-500 p-3 hover:bg-red-500/10 rounded-xl transition-colors"><Trash2 size={18}/></button>
                             </div>
                        ))}
                    </div>
                </div>
            )}

            {subTab === 'admins' && (
                <div className="space-y-6">
                    <Card>
                        <h3 className="font-bold mb-4 flex items-center gap-2"><UserPlus size={18}/> Добавить админа</h3>
                        <p className="text-xs text-gray-500 mb-4 leading-relaxed">Введите ID пользователя Telegram, чтобы дать ему доступ к этой панели. Убедитесь, что ID верный.</p>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="Telegram User ID" 
                                className="input-std"
                                value={newAdminId}
                                onChange={(e) => setNewAdminId(e.target.value)}
                            />
                            <Button className="w-auto" onClick={handleAddAdmin}><Check/></Button>
                        </div>
                    </Card>
                    <div className="space-y-2">
                         <h4 className="font-bold text-xs uppercase text-gray-500 tracking-wider mb-2">Текущие администраторы</h4>
                         {users.filter(u => u.role === 'admin').map(u => (
                             <div key={u.id} className="bg-dark-800 p-4 rounded-xl flex items-center justify-between border border-white/5">
                                 <div>
                                    <div className="font-bold">{u.name}</div>
                                    <div className="text-xs text-gray-500 font-mono">{u.id}</div>
                                 </div>
                                 <span className="text-[10px] bg-gold-500 text-black font-bold px-2 py-1 rounded">ADMIN</span>
                             </div>
                         ))}
                    </div>
                </div>
            )}

            {subTab === 'news' && (
                <div className="space-y-6">
                    <Card>
                        <h3 className="font-bold mb-4">Опубликовать новость</h3>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 bg-dark-900 rounded-xl px-4 border border-dark-600 focus-within:border-gold-500 transition-colors">
                                <Type size={16} className="text-gray-500"/>
                                <input type="text" placeholder="Заголовок" className="w-full bg-transparent py-4 outline-none" value={newsTitle} onChange={e => setNewsTitle(e.target.value)} />
                            </div>
                            <div className="flex items-center gap-2 bg-dark-900 rounded-xl px-4 border border-dark-600 focus-within:border-gold-500 transition-colors">
                                <ImageIcon size={16} className="text-gray-500"/>
                                <input type="text" placeholder="URL Картинки (необязательно)" className="w-full bg-transparent py-4 outline-none" value={newsImage} onChange={e => setNewsImage(e.target.value)} />
                            </div>
                             <textarea 
                                placeholder="Текст новости..." 
                                className="w-full bg-dark-900 rounded-xl p-4 border border-dark-600 outline-none min-h-[120px] focus:border-gold-500 transition-colors"
                                value={newsContent}
                                onChange={e => setNewsContent(e.target.value)}
                             />
                            <Button onClick={handleAddNews}>Опубликовать</Button>
                        </div>
                    </Card>
                </div>
            )}
            </motion.div>
            </AnimatePresence>
        </div>
    );
};

// --- Main App Component ---

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [user, setUser] = useState<User | null>(null);
  const [dailyBonus, setDailyBonus] = useState<{reward: number, streak: number} | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success'|'error'} | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const showToast = (message: string, type: 'success'|'error') => {
      setToast({ message, type });
  };

  const initData = async () => {
    const u = await db.getUser();
    setUser(u);

    const bonus = await db.checkDailyBonus(u.id);
    if (bonus) {
        setDailyBonus({ reward: bonus.reward, streak: bonus.newStreak });
        const updatedUser = await db.getUser();
        setUser(updatedUser);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
    }
  };

  useEffect(() => {
    initData();
  }, []);

  if (!user) return (
      <div className="flex flex-col items-center justify-center h-screen bg-dark-900 text-gold-500 gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold-500"></div>
          <div className="font-bold tracking-widest text-sm animate-pulse">LOADING...</div>
      </div>
  );

  return (
    <div className="min-h-screen bg-dark-900 text-white font-sans selection:bg-gold-500 selection:text-black overflow-hidden relative">
      <style>{`
        .input-std {
            width: 100%;
            background-color: #0F172A; 
            padding: 1rem;
            border-radius: 1rem;
            border: 1px solid #334155; 
            outline: none;
            color: white;
            transition: all 0.2s;
        }
        .input-std:focus {
            border-color: #EAB308;
            box-shadow: 0 0 0 2px rgba(234, 179, 8, 0.1);
        }
        .transform-3d {
            transform-style: preserve-3d;
        }
        .scrollbar-hide::-webkit-scrollbar {
            display: none;
        }
      `}</style>
      
      <Particles />
      {showConfetti && <Confetti />}

      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div
            key={activeTab}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
        >
            {activeTab === 'home' && <HomePage user={user} />}
            {activeTab === 'shop' && <ShopPage user={user} refreshUser={initData} showToast={showToast} />}
            {activeTab === 'scan' && <ScannerPage refreshUser={initData} showToast={showToast} />}
            {activeTab === 'profile' && <ProfilePage user={user} />}
            {activeTab === 'admin' && user.role === 'admin' && <AdminPage showToast={showToast} />}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {dailyBonus && (
            <DailyBonusModal 
                rule={dailyBonus.reward} 
                streak={dailyBonus.streak} 
                onClose={() => setDailyBonus(null)} 
            />
        )}
      </AnimatePresence>

      <TabBar 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        isAdmin={user.role === 'admin'} 
      />
    </div>
  );
}