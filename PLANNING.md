# Langua — Plan de construcción

## 1. Concepto

App de idiomas **multiusuario y self-hosted**, pensada para que la despliegue una
familia en su propio servidor. Cada miembro tiene su propia cuenta, su propio
idioma objetivo y su propio progreso. Una instalación = una familia (no hay
multi-tenant: el límite de "familia" lo pone el propio despliegue, no una fila
en la base de datos).

Tres módulos funcionales sobre una base común de cuentas:

- **Chat con IA** — conversación de práctica en el idioma objetivo.
- **Escuchar** — comprensión auditiva (audio + preguntas).
- **Hablar** — el usuario graba, se transcribe (STT) y se compara/da feedback
  contra una frase objetivo.

Regla transversal: **toda capacidad de IA (chat, STT, TTS) es local por
defecto** (corre en un contenedor propio, sin coste ni dependencia externa) y
**se vuelve cloud automáticamente si se configura una API key** en Ajustes.
Esto es un patrón de arquitectura, no solo una feature del chat.

## 2. Patrón "local por defecto, cloud si hay key"

OpenRouter y Ollama exponen ambos una API compatible con OpenAI
(`/v1/chat/completions`), así que el chat usa un único cliente cuyo `baseURL`
y `apiKey` cambian según haya o no key guardada:

```
ai/chat.ts
  si settings.openrouterApiKey → baseURL: openrouter.ai/api/v1, key: la guardada
  si no                        → baseURL: http://ollama:11434/v1, key: "ollama" (dummy)
```

Para voz: **OpenRouter no hace STT/TTS**, solo LLMs de texto. Por eso:

- El chat usa la key de OpenRouter tal cual.
- STT/TTS locales corren detrás de servidores con **API compatible OpenAI**
  (faster-whisper-server para STT, Piper detrás de un wrapper HTTP simple para
  TTS). Si se quiere voz cloud, se configura **una key adicional e
  independiente** (p. ej. OpenAI o Groq para STT, ElevenLabs/OpenAI para TTS),
  con el mismo fallback a local si no está.

Las API keys se guardan **cifradas en la base de datos** (no en `.env`), para
que cualquier adulto de la familia pueda configurarlas desde Ajustes sin tocar
el servidor.

## 3. Stack y servicios (docker compose)

Ya existe el scaffold (`sv create`): SvelteKit + Bun + Tailwind 4 + Drizzle +
Vitest + Playwright + mdsvex. Se añade:

| Servicio   | Imagen/base                               | Rol                                                               |
| ---------- | ----------------------------------------- | ----------------------------------------------------------------- |
| `app`      | build propio (Bun)                        | SvelteKit                                                         |
| `postgres` | `postgres:16`                             | datos                                                             |
| `ollama`   | `ollama/ollama`                           | LLM local (fallback chat), modelo pequeño multilingüe por defecto |
| `stt`      | faster-whisper-server (API OpenAI-compat) | transcripción local                                               |
| `tts`      | Piper + wrapper HTTP                      | síntesis de voz local, multi-idioma, ligero                       |

Redis/cola de trabajos queda **fuera del MVP**: si la síntesis local resulta
lenta, se añade después para no bloquear la UI. Tampoco hace falta MinIO/S3 a
esta escala — el audio generado y las grabaciones se cachean en un volumen
local (`./data/audio`), indexado por hash de `(texto, voz, idioma)`.

## 4. Modelo de datos (Drizzle, resumen)

- `users` — gestionados con **better-auth** + campos propios: `role`
  (admin/miembro), `nativeLanguage`, `targetLanguage`, tema. Sin `familyId`:
  no hace falta, solo hay una familia por instancia. Los perfiles infantiles
  no necesitan email real: el admin los crea directamente desde la app.
- `app_settings` — fila única (o tabla clave-valor) a nivel de instancia:
  `openrouterApiKeyEnc`, `voiceApiKeyEnc`, modelo preferido.
- `chat_conversations` / `chat_messages`
- `listening_exercises` / `listening_attempts`
- `speaking_prompts` / `speaking_attempts` (transcript, score, feedback)
- `progress_daily` — minutos practicados, racha, xp por usuario/día
- (fase posterior) `vocab_items` para repaso espaciado (SRS)

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

Patrón inspirado en Scholio: **selector de paletas con swatch claro/oscuro
por tema** (`data-theme` + clase `dark`, persistido en `localStorage` y
sincronizado a la cuenta) más un **toggle de alto contraste** independiente
del tema, pensado para accesibilidad WCAG. Cada miembro elige su propio tema
— se guarda por usuario.

## 7. Fases de construcción

0. **Fundaciones** — schema `users` + `app_settings`, better-auth + Drizzle
   adapter, layout base, selector de tema + alto contraste, `postgres` en
   compose.
1. **Multiusuario familiar** — alta del admin, gestión de miembros, idioma
   objetivo por usuario.
2. **Chat IA (texto)** — abstracción de provider, servicio `ollama` en
   compose, pantalla de chat, ajuste de API key de OpenRouter en Settings.
3. **Voz de salida (TTS)** — servicio `tts`, botón "escuchar" en mensajes del
   chat, caché de audio.
4. **Voz de entrada (STT) + módulo Hablar** — servicio `stt`, grabación en el
   navegador, comparación con frase objetivo, feedback.
5. **Módulo Escuchar** — audios + preguntas de comprensión, registro de
   intentos.
6. **Progreso** — dashboard por miembro, rachas, historial.
7. _(futuro)_ vocabulario con repetición espaciada, backups automáticos,
   proxy con TLS para acceso remoto seguro.

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
- `docker-compose.prod.yml` — stack completo (`postgres`, `ollama`, `tts`,
  `stt`, `migrate` uno-shot, `app`) en una red interna; solo el puerto de
  `app` llega al host. Nombre de proyecto propio (`langua-prod`) y volúmenes
  separados de `compose.yaml`, para no pisar los datos de desarrollo.
  Variables en `.env.prod` (plantilla en `.env.prod.example`, sin defaults
  para secretos — a diferencia de `.env.example`).

Detalle importante de SvelteKit: los secretos (`DATABASE_URL`,
`BETTER_AUTH_SECRET`, `ENCRYPTION_KEY`...) usan `$env/dynamic/private`, no
`$env/static/private`. El static se **inlinea en el bundle durante el
build**, lo que forzaría a hornear los secretos de cada familia dentro de la
imagen (o a reconstruirla por despliegue). Con dynamic se leen de
`process.env` en el arranque del contenedor — la misma imagen sirve para
cualquier familia, solo cambia el `docker-compose.prod.yml`/`.env.prod`.
