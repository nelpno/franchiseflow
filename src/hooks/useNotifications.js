import { useEffect, useState } from "react";
import {
  assinarNotificacoes,
  marcarComoLida,
  marcarTodasComoLidas,
} from "@/lib/notificationsStore";

/**
 * Liga o componente à busca ÚNICA de notificações (src/lib/notificationsStore.js).
 * Quantos sinos montarem, uma requisição só.
 */
export function useNotifications() {
  const [estado, setEstado] = useState(() => ({
    notificacoes: [],
    naoLidas: 0,
    carregando: true,
  }));

  useEffect(() => assinarNotificacoes(setEstado), []);

  return {
    notifications: estado.notificacoes,
    unreadCount: estado.naoLidas,
    loading: estado.carregando,
    marcarComoLida,
    marcarTodasComoLidas,
  };
}
