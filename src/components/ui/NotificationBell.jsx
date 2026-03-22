import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Notification } from '@/entities/all';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TYPE_STYLES = {
  info: 'bg-blue-50 text-blue-600',
  success: 'bg-green-50 text-green-600',
  warning: 'bg-amber-50 text-amber-600',
  alert: 'bg-red-50 text-red-600',
};

export default function NotificationBell({ size = 20 }) {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const loadNotifications = useCallback(async () => {
    try {
      const data = await Notification.list('-created_at', 20);
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
    } catch (e) {
      // silently fail
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClick = async (notification) => {
    if (!notification.read) {
      try {
        await Notification.update(notification.id, { read: true });
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (e) {}
    }
    if (notification.link) {
      setIsOpen(false);
      navigate(notification.link);
    }
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    try {
      await Promise.all(unread.map(n => Notification.update(n.id, { read: true })));
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {}
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-[#4a3d3d] hover:text-[#9c4143] transition-colors rounded-lg hover:bg-white/50 relative"
      >
        <MaterialIcon icon="notifications" size={size} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-[#b91c1c] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 bg-white rounded-2xl shadow-xl border border-[#291715]/10 overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#291715]/5">
            <h3 className="font-semibold text-sm text-[#1b1c1d]">Notificações</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-[#b91c1c] font-medium hover:underline"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="overflow-y-auto max-h-80">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-[#4a3d3d]/60">
                <MaterialIcon icon="notifications_none" size={32} />
                <p className="text-sm mt-2">Nenhuma notificação</p>
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 flex gap-3 items-start hover:bg-[#fbf9fa] transition-colors border-b border-[#291715]/5 last:border-b-0 ${!n.read ? 'bg-[#fdf3f2]' : ''}`}
                >
                  <div className={`p-1.5 rounded-lg shrink-0 ${TYPE_STYLES[n.type] || TYPE_STYLES.info}`}>
                    <MaterialIcon icon={n.icon || 'notifications'} size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.read ? 'font-semibold text-[#1b1c1d]' : 'text-[#4a3d3d]'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-[#4a3d3d]/70 mt-0.5 truncate">{n.message}</p>
                    <p className="text-[10px] text-[#4a3d3d]/50 mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  {!n.read && (
                    <div className="w-2 h-2 rounded-full bg-[#b91c1c] shrink-0 mt-2" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
