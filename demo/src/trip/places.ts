// Catálogo de Rumbo (grounding). Los agentes solo pueden referenciar ids de aquí:
// no inventan lugares, coordenadas, hoteles ni precios.
// Coordenadas aproximadas (suficiente para un mapa a escala regional). Hospedajes ficticios.

export type RegionId = 'santo-domingo' | 'samana' | 'jarabacoa' | 'norte' | 'este' | 'sur';
export type PlaceKind = 'playa' | 'naturaleza' | 'cultura' | 'aventura' | 'gastronomía';

export interface Region {
  id: RegionId;
  name: string;
  center: [number, number];
  zoom: number;
  /** transporte ida y vuelta desde Santo Domingo, por persona (USD) */
  transfer: number;
  /** horas de carretera desde Santo Domingo */
  driveHours: number;
  /** precio mínimo razonable por noche en la zona (para detectar anomalías) */
  priceFloor: number;
  color: string;
}

export interface Place {
  id: string;
  name: string;
  region: RegionId;
  kind: PlaceKind;
  lat: number;
  lng: number;
  /** costo por persona (USD) */
  cost: number;
  blurb: string;
  /** meses (1-12) en que tiene sentido; sin valor = todo el año */
  season?: number[];
  /** horas que toma la actividad (incluye traslado local) */
  hours: number;
  /** aviso que el verificador debe mostrar */
  caution?: string;
}

export interface Lodging {
  id: string;
  name: string;
  region: RegionId;
  pricePerNight: number;
  style: 'económico' | 'boutique' | 'eco-lodge' | 'resort';
  rating: number;
  reviews: number;
  /** verificado por Rumbo (visita, licencia de turismo, reseñas reales) */
  verified: boolean;
  /** 1–5: iluminación, acceso, reportes de la zona */
  safety: number;
  perks: string[];
  note?: string;
}

export const REGIONS: Record<RegionId, Region> = {
  'santo-domingo': { id: 'santo-domingo', name: 'Santo Domingo', center: [18.47, -69.88], zoom: 12, transfer: 0, driveHours: 0, priceFloor: 40, color: '#4285f4' },
  samana: { id: 'samana', name: 'Península de Samaná', center: [19.2, -69.42], zoom: 10, transfer: 30, driveHours: 2.5, priceFloor: 45, color: '#34a853' },
  jarabacoa: { id: 'jarabacoa', name: 'Jarabacoa y Constanza', center: [19.0, -70.72], zoom: 10, transfer: 25, driveHours: 2.5, priceFloor: 35, color: '#0f9d58' },
  norte: { id: 'norte', name: 'Puerto Plata y Cabarete', center: [19.75, -70.62], zoom: 10, transfer: 30, driveHours: 3.5, priceFloor: 35, color: '#f9ab00' },
  este: { id: 'este', name: 'Punta Cana y Bayahibe', center: [18.45, -68.65], zoom: 9, transfer: 25, driveHours: 2.5, priceFloor: 40, color: '#ea4335' },
  sur: { id: 'sur', name: 'Barahona y Pedernales', center: [18.1, -71.3], zoom: 9, transfer: 35, driveHours: 5, priceFloor: 30, color: '#a142f4' },
};

export const PLACES: Place[] = [
  // Santo Domingo
  { id: 'zona-colonial', name: 'Zona Colonial', region: 'santo-domingo', kind: 'cultura', lat: 18.4733, lng: -69.8836, cost: 0, blurb: 'Calles de piedra y la primera catedral de América', hours: 3 },
  { id: 'alcazar', name: 'Alcázar de Colón', region: 'santo-domingo', kind: 'cultura', lat: 18.4772, lng: -69.8822, cost: 3, blurb: 'Museo virreinal frente al río Ozama', hours: 1.5 },
  { id: 'tres-ojos', name: 'Los Tres Ojos', region: 'santo-domingo', kind: 'naturaleza', lat: 18.4777, lng: -69.8452, cost: 3, blurb: 'Cuevas con lagos de agua cristalina', hours: 1.5 },
  { id: 'malecon', name: 'Malecón y Guibia', region: 'santo-domingo', kind: 'gastronomía', lat: 18.4565, lng: -69.9105, cost: 15, blurb: 'Atardecer frente al Caribe y comida local', hours: 2 },
  { id: 'boca-chica', name: 'Playa Boca Chica', region: 'santo-domingo', kind: 'playa', lat: 18.4497, lng: -69.6075, cost: 10, blurb: 'Laguna de aguas tranquilas cerca de la ciudad', hours: 4 },
  // Samaná
  { id: 'cayo-levantado', name: 'Cayo Levantado', region: 'samana', kind: 'playa', lat: 19.17, lng: -69.2725, cost: 40, blurb: 'Isla de arena blanca en la bahía', hours: 5 },
  { id: 'salto-limon', name: 'Salto El Limón', region: 'samana', kind: 'aventura', lat: 19.2783, lng: -69.4436, cost: 15, blurb: 'Cascada de 40 m, a pie o a caballo', hours: 4 },
  { id: 'las-terrenas', name: 'Las Terrenas', region: 'samana', kind: 'playa', lat: 19.3117, lng: -69.5428, cost: 0, blurb: 'Pueblo playero con ambiente bohemio', hours: 4 },
  { id: 'ballenas', name: 'Avistamiento de ballenas', region: 'samana', kind: 'naturaleza', lat: 19.2, lng: -69.3, cost: 60, blurb: 'Ballenas jorobadas en la bahía', hours: 4, season: [1, 2, 3], caution: 'Las ballenas solo visitan Samaná de enero a marzo' },
  { id: 'los-haitises', name: 'Parque Los Haitises', region: 'samana', kind: 'naturaleza', lat: 19.05, lng: -69.6, cost: 55, blurb: 'Manglares, cuevas taínas y mogotes', hours: 5 },
  // Jarabacoa y Constanza
  { id: 'salto-baiguate', name: 'Salto de Baiguate', region: 'jarabacoa', kind: 'aventura', lat: 19.0961, lng: -70.6083, cost: 5, blurb: 'Cascada entre pinos, caminata corta', hours: 2 },
  { id: 'rafting-yaque', name: 'Rafting en el Yaque', region: 'jarabacoa', kind: 'aventura', lat: 19.1239, lng: -70.6372, cost: 55, blurb: 'Rápidos en el río más largo del Caribe', hours: 4, caution: 'Se suspende si el río crece por lluvias' },
  { id: 'pico-duarte', name: 'Ruta al Pico Duarte', region: 'jarabacoa', kind: 'aventura', lat: 19.023, lng: -70.998, cost: 120, blurb: 'El punto más alto del Caribe', hours: 10, caution: 'Requiere guía certificado y 2–3 días: no cabe en un día' },
  { id: 'valle-nuevo', name: 'Parque Valle Nuevo', region: 'jarabacoa', kind: 'naturaleza', lat: 18.8, lng: -70.65, cost: 10, blurb: 'Páramo frío y la pirámide de Valle Nuevo', hours: 5 },
  { id: 'constanza', name: 'Valle de Constanza', region: 'jarabacoa', kind: 'gastronomía', lat: 18.9094, lng: -70.745, cost: 12, blurb: 'Fresas, flores y clima de montaña', hours: 3 },
  // Norte
  { id: 'teleferico', name: 'Teleférico de Puerto Plata', region: 'norte', kind: 'aventura', lat: 19.7785, lng: -70.7045, cost: 15, blurb: 'Subida a la Loma Isabel de Torres', hours: 2.5 },
  { id: 'damajagua', name: '27 Charcos de Damajagua', region: 'norte', kind: 'aventura', lat: 19.69, lng: -70.8, cost: 40, blurb: 'Saltos y toboganes naturales', hours: 4 },
  { id: 'cabarete', name: 'Kitesurf en Cabarete', region: 'norte', kind: 'aventura', lat: 19.7489, lng: -70.4125, cost: 70, blurb: 'La capital del kite en el Caribe', hours: 3 },
  { id: 'san-felipe', name: 'Fortaleza San Felipe', region: 'norte', kind: 'cultura', lat: 19.8017, lng: -70.6942, cost: 5, blurb: 'Fortaleza del siglo XVI en el malecón', hours: 1.5 },
  { id: 'sosua', name: 'Playa Sosúa', region: 'norte', kind: 'playa', lat: 19.7547, lng: -70.5197, cost: 0, blurb: 'Bahía ideal para snorkel', hours: 3 },
  // Este
  { id: 'saona', name: 'Isla Saona', region: 'este', kind: 'playa', lat: 18.155, lng: -68.75, cost: 90, blurb: 'Piscina natural y palmeras de postal', hours: 8 },
  { id: 'bayahibe', name: 'Bayahibe', region: 'este', kind: 'playa', lat: 18.3708, lng: -68.8375, cost: 0, blurb: 'Pueblo pesquero con arrecifes', hours: 3 },
  { id: 'altos-chavon', name: 'Altos de Chavón', region: 'este', kind: 'cultura', lat: 18.42, lng: -68.92, cost: 25, blurb: 'Villa mediterránea sobre el río Chavón', hours: 2.5 },
  { id: 'hoyo-azul', name: 'Hoyo Azul', region: 'este', kind: 'aventura', lat: 18.53, lng: -68.38, cost: 95, blurb: 'Cenote turquesa y tirolesas', hours: 4 },
  { id: 'macao', name: 'Playa Macao', region: 'este', kind: 'playa', lat: 18.77, lng: -68.55, cost: 0, blurb: 'Playa virgen de olas para surf', hours: 3, caution: 'Corrientes fuertes: nadar solo con bandera verde' },
  // Sur
  { id: 'bahia-aguilas', name: 'Bahía de las Águilas', region: 'sur', kind: 'playa', lat: 17.832, lng: -71.645, cost: 25, blurb: 'La playa más remota y virgen del país', hours: 6, caution: 'Sin servicios: llegar de día y con transporte reservado' },
  { id: 'lago-enriquillo', name: 'Lago Enriquillo', region: 'sur', kind: 'naturaleza', lat: 18.49, lng: -71.69, cost: 15, blurb: 'Lago bajo el nivel del mar con iguanas', hours: 4 },
  { id: 'hoyo-pelempito', name: 'Hoyo de Pelempito', region: 'sur', kind: 'naturaleza', lat: 17.93, lng: -71.47, cost: 10, blurb: 'Mirador sobre una depresión gigante', hours: 3 },
  { id: 'san-rafael', name: 'Balneario San Rafael', region: 'sur', kind: 'playa', lat: 18.03, lng: -71.14, cost: 0, blurb: 'Río de montaña que llega al mar', hours: 3 },
  { id: 'larimar', name: 'Minas de Larimar', region: 'sur', kind: 'cultura', lat: 18.08, lng: -71.17, cost: 5, blurb: 'La piedra azul que solo existe aquí', hours: 2 },
];

export const LODGINGS: Lodging[] = [
  { id: 'sd-hostal', name: 'Hostal Las Damas', region: 'santo-domingo', pricePerNight: 45, style: 'económico', rating: 4.4, reviews: 812, verified: true, safety: 4.5, perks: ['Zona Colonial', 'Desayuno'] },
  { id: 'sd-boutique', name: 'Casa Ozama Boutique', region: 'santo-domingo', pricePerNight: 120, style: 'boutique', rating: 4.8, reviews: 1290, verified: true, safety: 4.8, perks: ['Terraza', 'Piscina'] },
  // ⚠ Trampa para el verificador: barato, mal calificado y sin verificar.
  { id: 'sd-ganga', name: 'Habitaciones La Ganga', region: 'santo-domingo', pricePerNight: 12, style: 'económico', rating: 2.1, reviews: 9, verified: false, safety: 1.8, perks: ['Precio más bajo'], note: 'Sin licencia de turismo; reportes de robos en la calle' },
  { id: 'sm-eco', name: 'Casa Ballena Eco-lodge', region: 'samana', pricePerNight: 85, style: 'eco-lodge', rating: 4.7, reviews: 534, verified: true, safety: 4.7, perks: ['Vista a la bahía', 'Solar'] },
  { id: 'sm-hostal', name: 'Posada Las Terrenas', region: 'samana', pricePerNight: 50, style: 'económico', rating: 4.3, reviews: 640, verified: true, safety: 4.4, perks: ['A 2 min de la playa'] },
  { id: 'sm-resort', name: 'Bahía Azul Resort', region: 'samana', pricePerNight: 190, style: 'resort', rating: 4.6, reviews: 2210, verified: true, safety: 4.9, perks: ['Todo incluido', 'Spa'] },
  { id: 'sm-ganga', name: 'Cuartos Playa Fácil', region: 'samana', pricePerNight: 15, style: 'económico', rating: 2.4, reviews: 14, verified: false, safety: 2.0, perks: ['Precio más bajo'], note: 'Camino sin iluminación; anuncio sin verificar' },
  { id: 'jb-cabana', name: 'Cabañas Pino Alto', region: 'jarabacoa', pricePerNight: 70, style: 'eco-lodge', rating: 4.8, reviews: 702, verified: true, safety: 4.8, perks: ['Chimenea', 'Río privado'] },
  { id: 'jb-hostal', name: 'Hostal El Yaque', region: 'jarabacoa', pricePerNight: 38, style: 'económico', rating: 4.2, reviews: 455, verified: true, safety: 4.3, perks: ['Tours incluidos'] },
  { id: 'nt-boutique', name: 'Cabarete Wind House', region: 'norte', pricePerNight: 110, style: 'boutique', rating: 4.6, reviews: 980, verified: true, safety: 4.6, perks: ['Frente al mar', 'Clases de kite'] },
  { id: 'nt-hostal', name: 'Sosúa Backpackers', region: 'norte', pricePerNight: 40, style: 'económico', rating: 4.1, reviews: 388, verified: true, safety: 4.1, perks: ['Cocina compartida'] },
  { id: 'es-resort', name: 'Coral Bávaro Resort', region: 'este', pricePerNight: 210, style: 'resort', rating: 4.5, reviews: 4120, verified: true, safety: 4.9, perks: ['Todo incluido', 'Kids club'] },
  { id: 'es-boutique', name: 'Bayahibe Reef Inn', region: 'este', pricePerNight: 95, style: 'boutique', rating: 4.7, reviews: 860, verified: true, safety: 4.7, perks: ['Buceo', 'Desayuno'] },
  { id: 'es-hostal', name: 'Hostal Pescador', region: 'este', pricePerNight: 42, style: 'económico', rating: 4.2, reviews: 512, verified: true, safety: 4.3, perks: ['Kayaks gratis'] },
  { id: 'su-eco', name: 'Ecolodge Bahoruco', region: 'sur', pricePerNight: 80, style: 'eco-lodge', rating: 4.6, reviews: 301, verified: true, safety: 4.5, perks: ['Montaña y mar', 'Cena criolla'] },
  { id: 'su-hostal', name: 'Posada Barahona', region: 'sur', pricePerNight: 35, style: 'económico', rating: 4.0, reviews: 210, verified: true, safety: 4.0, perks: ['Parqueo'] },
];

export const PLACE_BY_ID = new Map(PLACES.map((p) => [p.id, p]));
export const LODGING_BY_ID = new Map(LODGINGS.map((l) => [l.id, l]));
export const REGION_IDS = Object.keys(REGIONS) as RegionId[];

export const KIND_EMOJI: Record<PlaceKind, string> = {
  playa: '🏖️',
  naturaleza: '🌿',
  cultura: '🏛️',
  aventura: '🧗',
  gastronomía: '🍽️',
};

/** Comida por persona por día (USD): lo calcula el código, no el modelo. */
export const FOOD_PER_DAY = 35;
