# WorkLog · panel web

Panel de **WorkLog (Bitácora de actividades)** para supervisores, RR. HH., nómina y administradores.
Es una app satélite de INTECHSYS ONE: no tiene usuarios propios; entra con la cuenta de ONE (SSO
PKCE) y habla con el API de WorkLog (`work_log_api`).

React 19 · Vite 8 · TypeScript 6 (estricto) · Tailwind v4 · TanStack Query · react-hook-form + zod ·
MapLibre GL (estilo Liberty de OpenFreeMap) · lucide-react · motion · sonner · oxlint.

## Requisitos

- Node 22 o superior y npm.
- El API de WorkLog corriendo. En local:

  ```bash
  dotnet run --project ../work_log_api/src/WorkLog.Api --launch-profile http
  # http://localhost:5290 · documentación en http://localhost:5290/scalar/v1
  ```

## Modo desarrollo (sin ONE)

`.env.development` ya trae `VITE_AUTH_MODE=development` y `VITE_API_URL=http://localhost:5290`.

```bash
npm install
npm run dev        # http://localhost:5174 (el API solo admite este origen en CORS)
```

La pantalla de entrada pide un correo y usa el token literal `dev:<correo>`; no hay contraseña ni
refresco. El administrador de pruebas es **admin@intechsys.dev** y la empresa de desarrollo se
resuelve sola. Solo funciona contra un API en modo Development.

## Modo SSO (con INTECHSYS ONE)

Crea `.env.development.local` (o exporta las variables) con:

```dotenv
VITE_API_URL=http://localhost:5290
VITE_ONE_URL=http://localhost:5180          # API de ONE
VITE_ONE_PORTAL_URL=http://localhost:5173   # portal de ONE (ahí vive /autorizar)
VITE_ONE_CLIENT_ID=worklog
VITE_AUTH_MODE=sso
```

Flujo: `/login` (o `/sso?tenant=…` desde el lanzador de ONE) genera verifier, state y challenge S256
y redirige a `{VITE_ONE_PORTAL_URL}/autorizar`. ONE vuelve a `/sso/callback`, que valida el state y
canjea el código en `POST {VITE_ONE_URL}/api/v1/sso/token`. El refresco usa
`POST /api/v1/auth/refresh` (un solo refresco en vuelo para todas las peticiones) y salir llama a
`POST /api/v1/auth/logout`. La URL `{origen}/sso/callback` debe estar registrada en ONE para el
cliente `worklog`.

Cada llamada al API lleva `Authorization: Bearer <token>` y `X-Tenant-Id`. Si la persona pertenece a
varias empresas (`GET /api/v1/me/tenants`) se le pide elegir una, y puede cambiarla desde su menú.

## Variables

| Variable | Uso |
|---|---|
| `VITE_API_URL` | API de WorkLog, sin barra final |
| `VITE_ONE_URL` | API de ONE (token SSO, refresco, logout) |
| `VITE_ONE_PORTAL_URL` | Portal de ONE (`/autorizar`) |
| `VITE_ONE_CLIENT_ID` | `worklog` |
| `VITE_AUTH_MODE` | `sso` (por defecto) o `development` |

## Scripts

```bash
npm run dev       # servidor de desarrollo en el puerto 5174
npm run build     # tsc -b + vite build → dist/
npm run lint      # oxlint (react, typescript, jsx-a11y)
npm run preview   # sirve dist/ para probar el build
npm run gen:api   # regenera src/lib/api-schema.ts desde docs/openapi.v1.json
```

### Tipos del API

`src/lib/api-schema.ts` se genera con openapi-typescript desde `docs/openapi.v1.json` y se versiona;
`src/lib/types.ts` solo les da nombres cortos. El script (`scripts/generate-api-types.mjs`) normaliza
el contrato de .NET antes de generar: los números que admiten texto quedan como `number`, los campos
que admiten null quedan opcionales en las respuestas (el API omite los null) y conservan `| null` en
los comandos (ahí null significa "quitar"). openapi-typescript pide TypeScript 5 y el proyecto usa
TS 6, por eso se ejecuta con `npx` y no está en `package.json`. Tras actualizar el OpenAPI:
`npm run gen:api` y `npm run build`; si un DTO cambió, el compilador señala dónde.

Las devtools de TanStack Query no se muestran por defecto. Para verlas en desarrollo:
`localStorage.setItem('worklog.devtools', '1')` y recarga.

## Estructura

```
src/
  lib/            api.ts (fetch + refresco compartido + ApiError desde ProblemDetails + descargas
                  autenticadas), api-schema.ts (generado), sso.ts,
                  session.ts, queries.ts (claves de caché), types.ts (DTO del API), forms.ts
                  (errores por campo → react-hook-form), labels.ts, geo.ts, utils.ts
  providers/      AuthProvider (sesión, empresa, perfil y permisos), ThemeProvider (claro/oscuro)
  components/ui/  Button, Field (Input/Select/Textarea/Switch), Modal/Drawer/ConfirmDialog,
                  DataTable/Pagination, Controls (Segmented, ChipGroup, Stepper, SearchInput,
                  DropdownMenu), Primitives (StatusChip, KpiCard, EmptyState, skeletons…)
  components/layout/  AppShell (sidebar 288 px → barra superior en ≤900 px), menú de usuario
  features/<módulo>/  api.ts (hooks de TanStack Query), pages/, components/
```

Los menús y las acciones se ocultan según los permisos de `GET /api/v1/me`.

## Pantallas

| Ruta | Pantalla | Permiso |
|---|---|---|
| `/equipo` | Equipo hoy (refresco cada 60 s, batería y en línea, "Ver ubicación" con `view_locations`) | `view_team` |
| `/aprobaciones` | Lista + detalle con efecto en las horas; badge de pendientes cada 60 s | `approve_requests` |
| `/horas` | Horas del equipo frente al tope, por semana; exporta CSV | `view_team` |
| `/cierre` | Cierre de periodo por sede, checklist, export Excel/CSV, reabrir (admin) | `close_periods` o `export_payroll` |
| `/ordenes` | Órdenes de trabajo (crear, editar, cancelar, importar CSV) | `manage_settings` o `view_team` (solo lectura) |
| `/organizacion` | Sedes y grupos | `manage_settings` |
| `/plantillas` | Plantillas de horario con validación en vivo | `manage_schedules` |
| `/asignaciones` | Asignaciones y calendario mensual | `manage_schedules` |
| `/actividades` | Actividades, resultados de cierre y categorías | `manage_settings` |
| `/sitios` | Sitios y geocercas (MapLibre) | `manage_settings` |
| `/usuarios` | Usuarios, invitaciones (con dispositivo) y matriz de permisos | `manage_users` |
| `/parametros` | Parámetros por nivel | `manage_settings` |
| `/novedades` | Novedades con cálculo en vivo de días hábiles y soportes | `manage_absences` |
| `/auditoria` | Registro de solo lectura con filtros, detalle antes/después y export | `view_audit` |
| `/dispositivos` | Control de dispositivos con MobiControl (reglas, apps, verificación) | `manage_settings` |

## Despliegue

`.github/workflows/azure-static-web-apps.yml` sigue el patrón de one-front: lint y build en Actions y
subida de `dist/` con `skip_app_build`. Necesita el secreto `AZURE_STATIC_WEB_APPS_API_TOKEN_WORKLOG`;
las URLs salen de `.env.production`, que viaja al repositorio. `public/staticwebapp.config.json` resuelve las rutas del SPA
(incluida `/sso/callback`).
