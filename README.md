# IA rápida, UI fluida

Charla técnica para **DevFest Santo Domingo 2026** (track Web) de [Vanessa Aristizabal](https://github.com/vanessamarely).

> Las interfaces generadas dinámicamente por IA permiten crear experiencias personalizadas, pero también pueden provocar cambios inesperados de layout, alta carga en el cliente y retrasos en el renderizado. En esta sesión exploramos cómo optimizar una UI generativa mediante estrategias de renderizado, streaming, reutilización del DOM y manejo eficiente del estado, manteniendo experiencias rápidas, fluidas y accesibles.

Este repo tiene **dos apps independientes**:

| Carpeta | Qué es | URL |
|---|---|---|
| [`slides/`](slides) | **Deck interactivo** (38 slides) + **app del público** en `/live/`: apodos, espejo del slide actual, 3 preguntas tipo Kahoot, likes, ⭐, reacciones, preguntas del público respondidas con Gemini Nano, cards con tu foto estilo cómic y podio con código de ganador. | https://fluid-generative-ui-slides.web.app |
| [`demo/`](demo) | **Rumbo**: planificador de escapadas por República Dominicana. Una web agéntica con UI generativa en streaming, en React. | https://fluid-generative-ui-demo.web.app |

## Rumbo: la demo

```
Intención (Gemini Nano)  →  Itinerario ∥ Hospedaje (streaming en paralelo)  →  Verificador ↺  →  Síntesis
      secuencial                         paralelo                         secuencial + bucle     presupuesto en código
```

- **Renderizado**: catálogo de componentes + JSON Schema (el modelo devuelve datos, no HTML) y slots con la altura final (CLS ≈ 0).
- **Streaming**: [parser JSON incremental](demo/src/genui/json-stream.ts) O(n), un render por frame ([`DocStore`](demo/src/genui/doc-store.ts)) y `scheduler.yield()`.
- **Reutilización del DOM**: claves estables por id, suscripción por ítem (`useSyncExternalStore`), View Transitions y un mapa de Leaflet que nunca se recrea.
- **Estado**: un store por agente (borrador vs. confirmado, lo anterior visible hasta su reemplazo) y presupuesto **derivado en código**.
- **Accesibilidad**: `aria-busy` por región, anuncios cortos y espaciados, el foco nunca se mueve solo y respeta `prefers-reduced-motion`.
- **Agentes responsables**: grounding (catálogo real), [verificador](demo/src/trip/verify.ts) con reglas en código (seguridad, precio anómalo, temporada, días imposibles) y bucle de corrección. Incluye una trampa: *"Habitaciones La Ganga"*, $12 y 2,1★.
- **WebMCP**: 6 tools con `document.modelContext.registerTool()` (con polyfill) y confirmación humana para acciones sensibles.
- **APIs de IA integradas**: Prompt API (Gemini Nano), Summarizer, Translator y Rewriter, en el [panel contextual](demo/src/ui/ContextPanel.tsx).
- **DevTools**: los agentes aparecen como pistas propias en el panel **Performance** ([`perf-tracks.ts`](demo/src/genui/perf-tracks.ts)).
- **`/compare.html`**: el mismo stream enviado a dos iframes, **v1 ingenua vs. v2 fluida**, con métricas reales (CLS, nodos creados, reutilizados, long tasks).

**Motor de IA**: local primero, nube de respaldo.
1. **Gemini Nano** (Prompt API, estable desde Chrome 148). Gratis, privado y sin red.
2. **Gemini API** (`gemini-3.5-flash-lite`) con una key de Google AI Studio, si el equipo no tiene Nano.
3. **Simulado** determinista: plan B sin wifi y base de `/compare`.

## Correr en local

```bash
npm install
```

```bash
npm run dev:demo
```

```bash
npm run dev:slides
```

- Demo: http://localhost:5174 · comparación: http://localhost:5174/compare.html · laboratorio de métricas: tecla **D**.
- Deck: http://localhost:5173 · app del público: http://localhost:5173/live/
- **Ensayo sin internet**: agrega `?local` al deck y a `/live/`. Cada pestaña es un asistente y se comunican por `BroadcastChannel`.
- **Ensayo con Firestore sin ensuciar la sesión real**: `?session=ensayo1` (el QR lo incluye).

Atajos del deck: `←/→` navegar · **V** revelar respuesta · **Q** preguntas del público · **L** claro/oscuro · **F** pantalla completa · **S** miniaturas · **M** menú.

### Variables de entorno

Copia [`.env.example`](.env.example) a `slides/.env.local` y `demo/.env.local`:

- `slides/.env.local`: config web de Firebase (ya generada con la CLI para el proyecto `fluid-generative-ui`).
- `demo/.env.local`: `VITE_GEMINI_API_KEY` de Google AI Studio. **Restríngela** en Google Cloud Console: solo *Generative Language API* y solo los referrers `http://localhost:5174/*` y `https://fluid-generative-ui-demo.web.app/*`.

## Firebase (plan Spark, $0)

Proyecto `fluid-generative-ui`: Hosting (2 sitios), Firestore y Auth. El público entra con **Auth anónima**. Solo el deck escucha las colecciones y publica agregados, así que cientos de celulares leen un único documento.

Pasos que se hacen una vez en la consola:

1. [Authentication → Comenzar](https://console.firebase.google.com/project/fluid-generative-ui/authentication) → habilitar **Anónimo**.
2. **GitHub** (para presentar en vivo y la ⭐ automática):
      1. En los ajustes de tu cuenta personal de GitHub, abre [Developer settings](https://github.com/settings/developers) → **OAuth Apps → New OAuth App**. También puedes llegar desde tu avatar → **Settings** → al final de la barra lateral → **Developer settings**.
            2. En **Redirect URI**, pega `https://fluid-generative-ui.firebaseapp.com/__/auth/handler` (GitHub ahora muestra este campo en vez de “Authorization callback URL”). Deja desmarcados **Allow wildcard matching** y **Enable Device Flow**.
   3. Pega el Client ID y el Secret en Authentication → **GitHub**.
3. En Authentication → Settings → **Authorized domains**, añade `fluid-generative-ui-slides.web.app` y `localhost` para ensayos locales. Esta lista de Firebase Auth es independiente de Hosting: agrega solo el hostname, sin `https://` ni rutas.
4. Para presentar: abre `https://fluid-generative-ui-slides.web.app/?presenter=1` → menú → **Presentar en vivo (GitHub)**. El acceso solo aparece con ese enlace y las [reglas](firestore.rules) solo aceptan el id de GitHub autorizado.

Comparte con el público `https://fluid-generative-ui-slides.web.app/live/`, no el enlace de presentadora. La app del público no muestra el menú del deck; las respuestas correctas solo se publican al revelar cada pregunta.

Desplegar:

```bash
npm run deploy
```

## Clips y traces para los slides

```bash
node scripts/record-clips.mjs
```

[`scripts/record-clips.mjs`](scripts/record-clips.mjs) usa Playwright con tu Chrome (sin descargar navegadores) para grabar clips `.webm` en `slides/public/clips/` (también son el plan B en el escenario). Además genera `docs/traces/rumbo-{naive,fluid}.json`: arrástralos a **DevTools → Performance** para ver las pistas *Rumbo · agentes*, los layout shifts y las long tasks.

En [`docs/recorder/`](docs/recorder) hay flujos para **DevTools → Recorder** (Import → Replay o *Measure performance*).

## Guion

El guion completo con tiempos está en [docs/GUION.md](docs/GUION.md).

## Créditos

- Diseño claro: guía [DevFest Santo Domingo 2026](https://design-systems.venture.do/devfest-santo-domingo/DESIGN.md). Estructura del deck y `deck-stage` de [webmcp-action](https://github.com/vanessamarely/webmcp-action).
- Íconos: [Lucide](https://lucide.dev) (ISC). Mapa: © [OpenStreetMap](https://www.openstreetmap.org/copyright) con [Leaflet](https://leafletjs.com).
- En Rumbo los **hospedajes son ficticios**; los lugares son reales y sus coordenadas, aproximadas.
