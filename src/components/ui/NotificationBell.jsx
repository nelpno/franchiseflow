import React, { useState, useEffect, useRef } from 'react';
import { useNotifications } from "@/hooks/useNotifications";
import MaterialIcon from '@/components/ui/MaterialIcon';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const TYPE_STYLES = {
  info: 'bg-blue-50 text-blue-600',
  success: 'bg-green-50 text-green-600',
  warning: 'bg-amber-50 text-amber-600',
  alert: 'bg-red-50 text-red-600',
};

export default function NotificationBell({ size = 20 }) {
  // A busca e o timer vivem no store, nao aqui: o Layout monta DOIS sinos ao mesmo tempo
  // (topo desktop + topo mobile) e o AdminDashboard monta um terceiro. Cada um tinha o seu
  // proprio fetch de 2 em 2 minutos — eram 2 requisicoes identicas por carregamento de pagina.
  const { notifications, unreadCount, marcarComoLida, marcarTodasComoLidas } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

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
        await marcarComoLida(notification.id);
      } catch (e) {
        console.warn('Falha ao marcar notificação como lida:', e);
        toast.error('Não foi possível marcar como lida');
      }
    }
    if (notification.link) {
      setIsOpen(false);
      navigate(notification.link);
    }
  };

  const markAllRead = async () => {
    try {
      await marcarTodasComoLidas();
    } catch (e) {
      console.warn('Falha ao marcar notificações como lidas:', e);
      toast.error('Não foi possível marcar como lida');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-ink-2 hover:text-[#9c4143] transition-colors rounded-lg hover:bg-white/50 relative"
      >
        <MaterialIcon icon="notifications" size={size} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-brand text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 bg-white rounded-2xl shadow-xl border border-ink-shadow/10 overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-ink-shadow/5">
            <h3 className="font-semibold text-sm text-ink">Notificações</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-brand font-medium hover:underline"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div className="overflow-y-auto max-h-80">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-ink-2/70">
                <MaterialIcon icon="notifications_none" size={32} />
                <p className="text-sm mt-2">Nenhuma notificação</p>
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 flex gap-3 items-start hover:bg-surface transition-colors border-b border-ink-shadow/5 last:border-b-0 ${!n.read ? 'bg-[#fdf3f2]' : ''}`}
                >
                  <div className={`p-1.5 rounded-lg shrink-0 ${TYPE_STYLES[n.type] || TYPE_STYLES.info}`}>
                    <MaterialIcon icon={n.icon || 'notifications'} size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.read ? 'font-semibold text-ink' : 'text-ink-2'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-ink-2/70 mt-0.5 truncate">{n.message}</p>
                    <p className="text-[10px] text-ink-2/70 mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  {!n.read && (
                    <div className="w-2 h-2 rounded-full bg-brand shrink-0 mt-2" />
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
