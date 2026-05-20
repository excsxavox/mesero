/** Textos de UI — recepción para hotel o complejo privado. */

export const DEFAULT_ORGANIZATION_NAME = "Recepción";

export const COPY = {
  loginSubtitle: "Recepcionista virtual para hotel o complejo privado",
  stationTitle: "Tu mostrador",
  stationAdminTitle: "Mostrador de recepción",
  stationHint: "Identifica esta pantalla en el lobby",
  stationAdminHint: "Sin asignar",
  stationAssigned: (n: number) => `Mostrador ${n}`,
  infoQrTitle: "Información del lugar",
  infoQrHint: "Escanea para ver servicios, mapa y contactos en tu móvil",
  infoQrCompact: "Escanear información en el móvil",
  catalogTitle: "Tours y productos",
  catalogSearch: "Buscar tours o productos…",
  offersTitle: "Tours y productos del hotel",
  offersViewAll: "Ver catálogo completo →",
  bookingTitle: "Tu reserva",
  bookingQueue: "Solicitudes en curso",
  bookingEmpty: "Explora tours y productos o pídelos por voz.",
  bookingConfirmed: "Solicitud registrada en recepción.",
  adminEstablishment: "Nombre del hotel o complejo",
  adminStations: "Mostradores de recepción",
  adminStationsHelp:
    "Cuántas pantallas de recepción hay en lobby o accesos (1–99). Cada dispositivo puede fijar su mostrador aquí o con ?puesto=N en la URL.",
  serverError:
    "No se pudo conectar con el servidor local. Ejecuta en la raíz del proyecto: npm run dev",
} as const;

export function formatStationLabel(stationNumber: number): string {
  return `Mostrador ${stationNumber}`;
}
