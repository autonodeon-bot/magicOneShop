import React, { useEffect, useState } from 'react';
import { Home, ShoppingBag, ScanLine, User, Settings, Box, X, Info } from 'lucide-react';
import { motion, AnimatePresence, useSpring, useTransform, useMotionValue } from 'framer-motion';

// --- TabBar ---
export const TabBar = ({ activeTab, onTabChange, isAdmin }: { activeTab: string, onTabChange: (t: string) => void, isAdmin: boolean }) => {
  const tabs = [
    { id: 'home', icon: Home, label: 'Главная' },
    { id: 'shop', icon: ShoppingBag, label: 'Магазин' },
    { id: 'scan', icon: ScanLine, label: 'Скан', highlight: true },
    { id: 'profile', icon: User, label: 'Профиль' },
  ];

  if (isAdmin) {
    tabs.push({ id: 'admin', icon: Settings, label: 'Админ' });
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-dark-900/80 backdrop-blur-xl border-t border-white/5 pb-safe pt-2 px-4 z-50">
      <div className="flex justify-around items-end pb-4">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          
          if (tab.highlight) {
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="relative -top-6 group"
              >
                <div className="absolute inset-0 bg-gold-500 rounded-full blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />
                <div className="relative bg-gradient-to-br from-gold-400 to-gold-600 text-dark-900 p-4 rounded-full shadow-xl shadow-gold-500/20 transform transition-transform active:scale-95 border-4 border-dark-900">
                  <Icon size={28} strokeWidth={2.5} />
                </div>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="relative flex flex-col items-center gap-1 py-1 px-2"
            >
              <motion.div
                animate={{ 
                  color: isActive ? '#FACC15' : '#94A3B8',
                  scale: isActive ? 1.1 : 1
                }}
              >
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              </motion.div>
              <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-gold-400' : 'text-slate-400'}`}>
                {tab.label}
              </span>
              {isActive && (
                <motion.div 
                  layoutId="tab-indicator"
                  className="absolute -top-2 w-1 h-1 bg-gold-500 rounded-full shadow-[0_0_8px_#EAB308]"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// --- Animated Components ---

export const Cube = ({ size = 20, className = "" }: { size?: number, className?: string }) => (
  <motion.div 
    className={`inline-block text-gold-400 ${className}`}
    animate={{ 
      rotate: [0, 5, -5, 0],
      y: [0, -2, 0]
    }}
    transition={{ 
      duration: 4,
      repeat: Infinity,
      ease: "easeInOut"
    }}
  >
    <Box size={size} fill="#FACC15" fillOpacity={0.2} stroke="currentColor" strokeWidth={1.5} />
  </motion.div>
);

export const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false }: any) => {
  const baseStyle = "w-full py-3.5 rounded-2xl font-bold text-sm tracking-wide transition-all relative overflow-hidden flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-gradient-to-r from-gold-400 to-gold-500 text-dark-900 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_-5px_rgba(234,179,8,0.4)]",
    secondary: "bg-dark-800 text-white hover:bg-dark-700 border border-white/10",
    danger: "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20"
  };

  return (
    <motion.button 
      whileTap={{ scale: 0.97 }}
      onClick={onClick} 
      disabled={disabled} 
      className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${className}`}
    >
      {children}
    </motion.button>
  );
};

export const Card = ({ children, className = '', noPadding = false }: any) => (
  <div className={`bg-dark-800/50 backdrop-blur-md rounded-3xl border border-white/5 shadow-xl ${noPadding ? '' : 'p-5'} ${className}`}>
    {children}
  </div>
);

export const TiltCard = ({ children, className = "", onClick }: any) => {
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const rotateX = useTransform(y, [-100, 100], [5, -5]);
    const rotateY = useTransform(x, [-100, 100], [-5, 5]);

    return (
        <motion.div
            style={{ x, y, rotateX, rotateY, z: 100 }}
            drag
            dragConstraints={{ top: 0, left: 0, right: 0, bottom: 0 }}
            dragElastic={0.1}
            whileHover={{ cursor: "pointer", scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className={`transform-3d ${className}`}
        >
            <Card className="h-full bg-dark-800 border-white/5 hover:border-gold-500/30 transition-colors duration-300">
                {children}
            </Card>
        </motion.div>
    );
}

// --- Visual Effects ---

export const Particles = () => {
    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
            {[...Array(15)].map((_, i) => (
                <motion.div
                    key={i}
                    className="absolute bg-gold-500/10 rounded-full blur-sm"
                    initial={{
                        x: Math.random() * window.innerWidth,
                        y: Math.random() * window.innerHeight,
                        scale: Math.random() * 0.5 + 0.5,
                    }}
                    animate={{
                        y: [null, Math.random() * -100],
                        opacity: [0, 0.5, 0],
                    }}
                    transition={{
                        duration: Math.random() * 10 + 10,
                        repeat: Infinity,
                        ease: "linear",
                        delay: Math.random() * 5
                    }}
                    style={{
                        width: Math.random() * 20 + 5 + 'px',
                        height: Math.random() * 20 + 5 + 'px',
                    }}
                />
            ))}
        </div>
    )
}

export const AnimatedNumber = ({ value }: { value: number }) => {
    const spring = useSpring(value, { mass: 0.8, stiffness: 75, damping: 15 });
    const displayValue = useTransform(spring, (current) => Math.round(current));

    useEffect(() => {
        spring.set(value);
    }, [value, spring]);

    return <motion.span>{displayValue}</motion.span>;
};

// --- Feedback Components ---

export const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-4 left-4 right-4 z-[100] flex justify-center pointer-events-none"
        >
            <div className={`
                flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-xl border pointer-events-auto
                ${type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}
            `}>
                <div className={`p-1 rounded-full ${type === 'success' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                    {type === 'success' ? <ScanLine size={16} /> : <Info size={16} />}
                </div>
                <span className="font-medium text-sm">{message}</span>
            </div>
        </motion.div>
    );
};

export const Skeleton = ({ className = "" }: { className?: string }) => (
    <div className={`animate-pulse bg-white/5 rounded-xl ${className}`} />
);

export const Modal = ({ isOpen, onClose, children, title }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative bg-dark-900 border border-white/10 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
            >
                <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <h3 className="font-bold text-lg">{title}</h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>
                <div className="p-0">
                    {children}
                </div>
            </motion.div>
        </div>
    )
}