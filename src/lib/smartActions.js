import { differenceInDays } from "date-fns";

const ACTION_RULES = [
  {
    type: "responder",
    label: "Responder",
    icon: "chat_bubble",
    color: "#b91c1c",
    bgColor: "#fef2f2",
    test: (contact) =>
      contact.status === "novo_lead" &&
      contact.created_at &&
      differenceInDays(new Date(), new Date(contact.created_at)) >= 1,
    message: (contact) => {
      const days = differenceInDays(new Date(), new Date(contact.created_at));
      return `${contact.nome || contact.telefone} entrou em contato h\u00e1 ${days} dia${days > 1 ? "s" : ""} \u2014 responda!`;
    },
    priority: 1,
  },
  {
    type: "reativar",
    label: "Reativar",
    icon: "refresh",
    color: "#d97706",
    bgColor: "#fffbeb",
    test: (contact) =>
      ["cliente", "recorrente"].includes(contact.status) &&
      contact.last_purchase_at &&
      differenceInDays(new Date(), new Date(contact.last_purchase_at)) >= 14,
    message: (contact) => {
      const days = differenceInDays(
        new Date(),
        new Date(contact.last_purchase_at)
      );
      return `${contact.nome || contact.telefone} n\u00e3o compra h\u00e1 ${days} dias \u2014 mande um oi!`;
    },
    priority: 2,
  },
  {
    type: "converter",
    label: "Converter",
    icon: "handshake",
    color: "#ea580c",
    bgColor: "#fff7ed",
    test: (contact) =>
      contact.status === "em_negociacao" &&
      contact.updated_at &&
      differenceInDays(new Date(), new Date(contact.updated_at)) >= 7,
    message: (contact) => {
      const days = differenceInDays(
        new Date(),
        new Date(contact.updated_at)
      );
      return `${contact.nome || contact.telefone} t\u00e1 negociando h\u00e1 ${days} dias \u2014 feche!`;
    },
    priority: 3,
  },
  {
    type: "fidelizar",
    label: "Fidelizar",
    icon: "favorite",
    color: "#16a34a",
    bgColor: "#f0fdf4",
    test: (contact) =>
      (contact.purchase_count || 0) >= 5 &&
      ["cliente", "recorrente"].includes(contact.status),
    message: (contact) =>
      `${contact.nome || contact.telefone} j\u00e1 comprou ${contact.purchase_count}x \u2014 agrade\u00e7a!`,
    priority: 4,
  },
  {
    type: "remarketing",
    label: "Remarketing",
    icon: "campaign",
    color: "#7c3aed",
    bgColor: "#f5f3ff",
    test: (contact) =>
      contact.status === "perdido" &&
      contact.updated_at &&
      differenceInDays(new Date(), new Date(contact.updated_at)) >= 30,
    message: (contact) => {
      const days = differenceInDays(
        new Date(),
        new Date(contact.updated_at)
      );
      return `${contact.nome || contact.telefone} sumiu h\u00e1 ${days} dias \u2014 tente novamente!`;
    },
    priority: 5,
  },
];

export function generateSmartActions(contacts, limit = 5) {
  const actions = [];
  for (const contact of contacts) {
    for (const rule of ACTION_RULES) {
      if (rule.test(contact)) {
        actions.push({
          ...rule,
          contact,
          message: rule.message(contact),
        });
        break;
      }
    }
  }
  actions.sort((a, b) => a.priority - b.priority);
  return limit ? actions.slice(0, limit) : actions;
}

export { ACTION_RULES };
