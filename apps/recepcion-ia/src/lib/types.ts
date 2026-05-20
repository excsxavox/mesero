export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  /** URL de imagen del plato (https o ruta absoluta en el mismo sitio). Opcional. */
  imageUrl?: string;
  /** Si es `false`, el plato está agotado: la IA no debe ofrecerlo y no entra en pedidos nuevos. Por defecto `true`. */
  available?: boolean;
};

export type OrderLine = {
  menuItemId: string;
  name: string;
  qty: number;
  notes?: string;
};

export type Order = {
  id: string;
  table?: string;
  items: OrderLine[];
  status: string;
  createdAt: string;
  statusChangedAt?: string;
  notes?: string;
  source?: string;
};

export type FlowState = {
  nodes: unknown[];
  edges: unknown[];
};

export type Settings = {
  restaurantName: string;
  assistantExtraInstructions: string;
  /** Palabra de activación del micrófono (minúsculas en API). */
  wakeWord: string;
  /** Cantidad de mesas numeradas del local (1–99). */
  tableCount: number;
  /** Mesa asignada a este quiosco (admin); fallback si no hay selección en el dispositivo. */
  kioskTable?: number | null;
  /** Solo lectura (GET): indica si ya hay contraseña del candado guardada en el servidor. */
  adminExitPasswordConfigured?: boolean;
};

/** Campos extra permitidos en PUT /api/settings (no forman parte del estado GET salvo el flag). */
export type SettingsWrite = Partial<Settings> & {
  /** Si se envía no vacío, el servidor guarda un hash y descarta el texto plano. */
  adminExitPassword?: string;
  /** Si es true, elimina la contraseña del candado. */
  adminExitPasswordClear?: boolean;
};
