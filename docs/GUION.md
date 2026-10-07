# Guion · IA rápida, UI fluida (40 min)

**Hilo narrativo**: Lucía quiere planear una escapada con IA. La v1 de *Rumbo* la desespera: el botón salta, la pantalla queda en blanco y la IA genérica la manda a un lugar peligroso. En cada bloque arreglamos un problema hasta llegar a la **v4: una web agéntica rápida, fluida, accesible y responsable**. Las 3 preguntas evalúan el término técnico de cada bloque.

**Antes de empezar**
- Deck de presentadora: `https://fluid-generative-ui-slides.web.app/?presenter=1` → menú → **Presentar en vivo (GitHub)**. Aparece el badge rojo "EN VIVO".
- Pestaña 2: `https://fluid-generative-ui-demo.web.app/compare.html`. Pestaña 3: la demo con el laboratorio abierto (`?lab`).
- DevTools abierto en la pestaña de la demo (Performance y AI assistance).
- Plan B sin red: la demo con `?engine=mock` y los clips de los slides 9 y 32 (se reproducen solos).
- Ensayo: `?session=ensayo1` en el deck (y el QR lo incluye). El día de la charla, sin parámetro.
- **Antes de empezar**: menú → *Vaciar sesión en vivo…* (escribe VACIAR). Borra jugadores, votos, likes, cards, preguntas, apodos y reacciones de pruebas; conserva las respuestas cargadas.
- **Al terminar**: tecla **Q** → *Descargar .md* para quedarte con las preguntas y respuestas.
- El celular del público muestra un **espejo del slide** (título, puntos clave y código) y 4 reacciones: Fuego, Like (cuenta como like), Risa y **Pregunta**. Las preguntas llegan a tu panel (tecla **Q** o menú → *Preguntas del público*) y Gemini Nano las va respondiendo en tu Chrome; las apropiadas aparecen en el slide *Sus preguntas*. Si el equipo no tiene Nano: menú → *Key de Gemini para Q&A* (se guarda solo en ese navegador).
- Si ves el aviso amarillo **"Los celulares NO siguen el deck"**, tócalo para iniciar sesión con GitHub: sin eso, el deck no transmite.

| # | Slide | Min | Qué decir / hacer |
|---|---|---|---|
| 1 | Portada | 0:00 | Los tokens forman el logo `< >`: "esto es lo que hace la IA, tokens que se convierten en UI". |
| 2 | Únete | 0:45 | Que escaneen el QR mientras te presentas: apodo, like, ⭐. "Hay 3 preguntas con puntos y un podio: pongan atención a los términos técnicos". |
| 3 | Quién soy | 2:00 | Breve. |
| 4 | Viñeta 1 · Lucía | 2:45 | Cuéntala como historia: 9:00 → 9:00:08 → "¡¿dónde se fue mi botón?!". Presenta al Gremlin. |
| 5 | La IA responde interfaces | 4:00 | La tesis de la charla. |
| 6 | Espectro | 4:40 | Del chat al componente; hoy, nivel 3. |
| 7 | Web agéntica | 5:30 | Persona ↔ UI generativa ↔ agentes ↔ WebMCP y APIs integradas. |
| 8 | 4 villanos | 6:30 | CLS, hilo bloqueado (INP), DOM desechable, ruido a11y. |
| 9 | **Demo 1** · ingenuo vs fluido | 7:30 | `/compare.html` → "Mismo stream a los dos". Señala el contador de nodos y el CLS. Si falla la red, usa el clip del slide. |
| 10 | 01 Renderizado | 10:00 | — |
| 11 | Contrato primero | 10:15 | Schema + catálogo cerrado = **grounding**. Orden pensado para streaming. |
| 12 | Reserva el espacio | 11:30 | **CLS**: qué mide, cómo se llega a ≈ 0. Ojo con `content-visibility` mientras generas. |
| 13 | **Pregunta 1 · CLS** | 12:45 | Deja ~25 s y presiona **V**. Comenta la explicación. |
| 14 | 02 Streaming | 14:00 | — |
| 15 | Parser incremental | 14:15 | O(n) vs. re-parsear todo en cada token. |
| 16 | Un render por frame | 15:30 | rAF + respaldo. Anécdota: "startTransition en cada token y no pintaba nada" (Nano sudando). |
| 17 | Gemini Nano | 16:45 | Estable desde Chrome 148: `responseConstraint`, `clone()`. Latencia, privacidad, $0. |
| 18 | 03 Reutilizar el DOM | 18:00 | — |
| 19 | 17.913 vs 156 | 18:15 | "¿Qué cambió? Lo vemos ahora… y te lo pregunto". |
| 20 | Claves y View Transitions | 19:00 | **key** = id, no posición. El mapa no se recrea. |
| 21 | **Pregunta 2 · key** | 20:15 | **V** al terminar. |
| 22 | 04 Estado | 21:30 | — |
| 23 | Store por agente | 21:45 | Borrador vs. confirmado y `previous`. La IA decide, el código suma. |
| 24 | Workflow agéntico | 23:00 | Secuencial → paralelo → verificador ↺ → síntesis. Truco: la intención da los días antes del itinerario. |
| 25 | Viñeta 2 · IA genérica | 24:15 | "Lo más barato" → La Ganga → Nano con escudo. **Grounding** + reglas + bucle + humano. |
| 26 | **Pregunta 3 · grounding** | 25:15 | **V**. Última oportunidad de sumar puntos. |
| 27 | Accesible mientras genera | 26:30 | v1: cada token es un anuncio. v2: anuncios con intención. |
| 28 | WebMCP | 27:30 | La web se ofrece a otros agentes; confirmación humana. |
| 29 | APIs integradas | 28:30 | Panel contextual: Prompt, Summarizer, Translator, Rewriter. |
| 30 | 05 Debug con IA | 29:30 | — |
| 31 | DevTools con IA | 29:45 | Graba un trace en vivo (o abre `docs/traces/rumbo-naive.json`). Muestra la pista *Rumbo · agentes* y pregúntale a AI assistance: "¿qué causa estos layout shifts?". |
| 32 | **Demo 2** · Rumbo completo | 31:30 | 1) "Lo más barato en Santo Domingo" → el verificador atrapa La Ganga. 2) Toca un día → sugerencias. 3) "Agrega un día de playa". 4) Consola WebMCP → `plan_trip()` y `select_lodging()` (confirmación). |
| 33 | Local primero | 35:00 | Nano → Gemini API → simulado. |
| 34 | Muro de cards | 35:45 | Muestra las cards. Clic en una card para ocultarla (moderación). |
| 35 | Checklist | 36:30 | Las 10 reglas (también en el README). |
| 36 | Podio | 37:30 | El ganador muestra su código en el celular y lo comparas con la pantalla. |
| 37 | Sus preguntas | 38:15 | Las preguntas del público respondidas por **Gemini Nano** (grounding en los slides, cita el slide). Revisa antes con **Q**: *Ocultar del slide*, *Regenerar* o *Borrar*. También llegan a los celulares. |
| 38 | Gracias / Q&A | 39:15 | Logo animado + QR del repo. |

## Si algo falla

- **Sin red**: la demo cae sola al modo simulado. El deck y la app del público siguen en modo local (cada dispositivo por separado). Usa los clips.
- **Sin Gemini Nano en el equipo**: Auto usa la Gemini API (si hay key) o el simulado. El laboratorio (tecla **D**) muestra qué motor corrió.
- **El público no puede entrar**: revisa que **Anónimo** esté habilitado en Firebase Auth.
- **Contenido inapropiado en el muro**: clic en la card para ocultarla. Los apodos ya son generados, sin texto libre.
