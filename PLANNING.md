# Langua — Plan de construcción

## 1. Concepto

App de idiomas **multiusuario y self-hosted** para las familias de Seilide
(la nube de JellyCartoon). Cada miembro entra con su cuenta de Seilide y
tiene su propio idioma nativo, idioma objetivo, voz y progreso. Una
instalación sirve a todas las familias; los datos de cada persona quedan
aislados por Row-Level Security (§5).

Módulos:

- **Chat con IA** — conversación de práctica por idioma, nivel y tema, con
  corrección de lo que escribes, traducción, sugerencias de respuesta, panel
  de palabra y extracción de vocabulario.
- **Clips** — audios que manda JellyCartoon (`/api/v1/clips`), transcritos en
  local, con texto sincronizado, bucle de frase y «escuchar primero».
- **Escuchar** — pasaje generado + 3 preguntas de comprensión, con nota.
- **Hablar** — grabas, se transcribe (STT) y se corrige el texto.
- **Corregir** y **Traducir** — texto libre.
- **Libro de estudio** — el vocabulario guardado, con ejemplos generados.
- **Progreso** — racha, actividad de 14 días y totales.

## 2. IA: Seilide para el texto y la voz, STT en local

- **Chat y generación** (`src/lib/server/ai/*`): todas las llamadas van al
  endpoint OpenAI-compatible de Seilide (`${SEILIDE_URL}/api/ia/v1`) con el
  token de acceso de la propia persona. Seilide llama a OpenRouter con la key
  de su familia y apunta el gasto; Langua nunca ve una key de OpenRouter.
- **TTS**: el endpoint `audio/speech` de Seilide (modelo
  `google/gemini-3.8-flash-tts`), con caché en disco compartida por hash de
  (modelo, voz, instrucciones, texto), limitada por `AUDIO_CACHE_MAX_MB`.
  Piper se quitó (oct. 2026): con las 6 voces ocupaba ~950 MiB de RAM y sonaba
  peor.
- **STT**: faster-whisper-server en local (servicio `stt`), para el dictado y
  para transcribir los clips.

Ya no hay Ollama ni claves guardadas en Ajustes: la idea inicial de «local
por defecto, cloud si hay key» se sustituyó por Seilide.

## 3. Stack y servicios (docker compose)

SvelteKit 2 + Svelte 5 + Bun + Tailwind 4 + Drizzle + better-auth (OIDC con
Seilide) + Vitest + Playwright.

| Servicio   | Imagen/base                               | Rol                                |
| ---------- | ----------------------------------------- | ---------------------------------- |
| `app`      | imagen propia (GHCR)                      | SvelteKit                          |
| `postgres` | `postgres:16`                             | datos                              |
| `stt`      | faster-whisper-server (API OpenAI-compat) | transcripción local                |
| `migrate`  | la misma imagen que `app`, una vez        | migraciones como superusuario (§5) |

El audio generado se cachea en un volumen (`/data/audio`); el de los clips
(`/data/clips`) no se puede regenerar y hay que respaldarlo con `pgdata`.

## 4. Modelo de datos (Drizzle, resumen)

- `user`, `session`, `account`, `verification` — better-auth, más los campos
  propios del perfil: `nativeLanguage`, `targetLanguage`, tema/oscuro/alto
  contraste, `voice`, `accent` (solo los cambian las acciones de Mi cuenta).
- `chat_conversation` / `chat_message` (con análisis y traducción).
- `listening_exercise` (pendiente, con las respuestas solo en el servidor) /
  `listening_attempt` (corregido, con nota).
- `clip` — audio, transcripción por frases y subtítulos traducidos.
- `vocab_item` — libro de estudio, con ejemplos extra y etiquetas.
- `integration_token` — tokens para la API (`/api/v1`), guardados como hash.

## 5. Seguridad de datos: Row-Level Security

Convención para toda tabla con datos propios de un miembro (conversaciones de
chat, intentos de listening/speaking, progreso, vocabulario...), inspirada en
cómo lo resuelve Scholio:

- La app se conecta a Postgres con un rol **sin privilegios de superusuario
  ni de owner de las tablas** (`APP_DB_USER`/`langua_app`, creado en
  `scripts/init.sh`). Esto importa porque RLS se ignora silenciosamente para
  superusers y para el owner de la tabla — sin este rol separado, las
  políticas no harían nada.
- Las migraciones (que crean tablas y políticas) siguen corriendo con el
  superusuario, vía `MIGRATION_DATABASE_URL` — separado de `DATABASE_URL`
  (el que usa la app en marcha).
- Cada tabla de contenido por-usuario se define con `.enableRLS()` +
  `pgPolicy(...)` en el schema de Drizzle (no a mano en SQL), usando
  `current_setting('app.current_user_id', true)` como condición.
- `hooks.server.ts` expone `event.locals.withRLS(fn)`: abre una transacción,
  hace `SELECT set_config('app.current_user_id', userId, true)` (scoped a esa
  transacción) y ejecuta `fn` dentro. Cualquier query sobre una tabla con RLS
  debe pasar por `locals.withRLS(...)`, no por el `db` importado directo.

Así, aunque el código de la app se olvide un `WHERE userId = ...`, Postgres
bloquea las filas ajenas — defensa en profundidad, no solo disciplina en el
código. Las tablas propias de better-auth (`user`, `session`, `account`,
`verification`) quedan **sin RLS**: la app necesita verlas completas para que
la autenticación funcione, y no pasan por `withRLS`.

## 6. UI/UX — temas y accesibilidad

Selector de paletas con versión clara y oscura (`data-theme` + clase `dark`,
en `localStorage` y en la cuenta) y un **alto contraste** independiente. Los
colores son tokens en `src/routes/layout.css` (`accent`, `on-accent`,
`danger`, `warning`, `success`…) y los controles comunes están en
`src/lib/components/ui` (`Button`, `Chip`, `Switch`), así que cada tema y el
alto contraste se aplican en toda la app.

Accesibilidad (WCAG 2.2 AA) — convenciones a mantener:

- Todo texto en el idioma que se aprende lleva su `lang`.
- Cada ruta tiene `<title>`; hay enlace «Saltar al contenido».
- Resultados y errores se anuncian con `announcer` (`src/lib/announcer.svelte.ts`).
- Los paneles laterales en móvil son diálogos con trampa de foco (`drawer`).
- Las palabras clicables son una sola parada de Tab por mensaje (`rovingFocus`).
- Nada se distingue solo por el color; se respeta `prefers-reduced-motion`.

## 7. Estado y siguientes pasos

Hecho: cuentas con Seilide, chat, TTS, STT + Hablar (sin frase objetivo),
Escuchar, Clips, Corregir, Traducir, libro de estudio, progreso básico, RLS
con tests contra Postgres y un e2e del chat (`bun run test`).

Pendiente:

- **Hablar** con frase objetivo, comparación y puntuación guardada.
- **Progreso** que cuente también clips, vocabulario, corregir y hablar.
- **Vocabulario** con repetición espaciada; poder borrar y editar palabras.
- Revisar intentos antiguos de Escuchar.
- Backups automáticos de `pgdata` y `clips_data`.

## 8. Despliegue en producción

`compose.yaml` es solo para desarrollo (`bun run dev` + servicios de IA con
puertos publicados al host). El despliegue real usa dos piezas nuevas:

- `Dockerfile` — build multi-stage con Bun. El stage `build` instala todo
  (deps + devDeps) y corre `vite build`; el stage `runtime` reinstala solo
  `dependencies` (`--production --ignore-scripts`) y copia `build/`. Importa:
  el output de `adapter-node` **no** empaqueta `node_modules` — cualquier
  paquete que el servidor importe en runtime (`svelte`, `@sveltejs/kit`,
  `drizzle-orm`, `postgres`...) tiene que estar en `dependencies`, no en
  `devDependencies`, o el contenedor de producción revienta al arrancar.
- `docker-compose.prod.yml` — stack completo (`postgres`, `stt`, `migrate` uno-shot, `app`) en una red interna; solo el puerto de
  `app` llega al host. Nombre de proyecto propio (`langua-prod`) y volúmenes
  separados de `compose.yaml`, para no pisar los datos de desarrollo.
  Variables en `.env.prod` (plantilla en `.env.prod.example`, sin defaults
  para secretos — a diferencia de `.env.example`).

Detalle importante de SvelteKit: los secretos (`DATABASE_URL`,
`BETTER_AUTH_SECRET`, `SEILIDE_CLIENT_SECRET`...) usan `$env/dynamic/private`, no
`$env/static/private`. El static se **inlinea en el bundle durante el
build**, lo que forzaría a hornear los secretos de cada familia dentro de la
imagen (o a reconstruirla por despliegue). Con dynamic se leen de
`process.env` en el arranque del contenedor — la misma imagen sirve para
cualquier familia, solo cambia el `docker-compose.prod.yml`/`.env.prod`.
