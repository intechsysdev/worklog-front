// Genera src/lib/api-schema.ts desde docs/openapi.v1.json con openapi-typescript.
//
// El OpenAPI de .NET 10 describe el contrato con dos rarezas que se normalizan antes de generar:
// - Los números aceptan también texto (type: ["integer","string"] + pattern): en las respuestas
//   siempre llegan como número, así que se dejan como number.
// - Los campos que admiten null van en `required`, pero el API omite los null al serializar: se
//   generan como opcionales (`campo?: T`), que es lo que realmente llega.
// Además, los enums traen "" (valor por defecto) y WeekDays (banderas) no tiene esquema.
//
// openapi-typescript pide TypeScript 5 como peer y el proyecto usa TS 6: se ejecuta con npx, sin
// entrar en package.json. Uso: npm run gen:api
import { execSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const spec = JSON.parse(readFileSync(join(root, 'docs/openapi.v1.json'), 'utf8'))

function normalize(schema, keepNull = false) {
  if (!schema || typeof schema !== 'object') return schema
  if (Array.isArray(schema)) return schema.map((item) => normalize(item, keepNull))

  const out = {}
  for (const [key, value] of Object.entries(schema)) out[key] = normalize(value, keepNull)

  if (Array.isArray(out.type)) {
    const types = out.type.filter((type) => keepNull || type !== 'null')
    const numeric = types.find((type) => type === 'integer' || type === 'number')
    out.type = numeric ? numeric : types.length === 1 ? types[0] : types
    if (numeric) {
      delete out.pattern
      if (keepNull && types.includes('null')) out.type = [numeric, 'null']
    }
  }
  if (Array.isArray(out.enum)) out.enum = out.enum.filter((value) => value !== '' && value !== null)
  if (Array.isArray(out.oneOf)) {
    if (!keepNull) out.oneOf = out.oneOf.filter((item) => !(item.type === 'null' || (Array.isArray(item.type) && item.type.length === 1 && item.type[0] === 'null')))
    if (out.oneOf.length === 1) {
      const [single] = out.oneOf
      delete out.oneOf
      Object.assign(out, single)
    }
  }
  return out
}

function isNullable(schema) {
  if (!schema) return false
  if (Array.isArray(schema.type) && schema.type.includes('null')) return true
  if (Array.isArray(schema.oneOf) && schema.oneOf.some((item) => item.type === 'null')) return true
  return schema.nullable === true
}

// Los nullables dejan de ser requeridos (se leen del esquema original, antes de normalizar).
for (const schema of Object.values(spec.components.schemas)) {
  if (!schema.properties || !Array.isArray(schema.required)) continue
  schema.required = schema.required.filter((name) => !isNullable(schema.properties[name]))
}

// En los cuerpos de petición el null sí significa algo ("quitar el supervisor"): se conserva.
const isRequestBody = (name) => /(Command|Request)$/.test(name)
spec.components.schemas = Object.fromEntries(
  Object.entries(spec.components.schemas).map(([name, schema]) => [name, normalize(schema, isRequestBody(name))]),
)
spec.paths = normalize(spec.paths)
spec.components.schemas.WeekDays = { type: 'string', description: 'Banderas de días: "MondayToFriday", "Monday, Saturday"…' }

const dir = mkdtempSync(join(tmpdir(), 'worklog-openapi-'))
const input = join(dir, 'openapi.normalized.json')
writeFileSync(input, JSON.stringify(spec))

const output = join(root, 'src/lib/api-schema.ts')
execSync(`npx -y openapi-typescript@7.13.0 "${input}" -o "${output}" --default-non-nullable false`, { stdio: 'inherit' })

const generated = readFileSync(output, 'utf8')
writeFileSync(
  output,
  '/* eslint-disable */\n// Archivo generado por scripts/generate-api-types.mjs desde docs/openapi.v1.json. No editar a mano.\n' + generated,
)
console.log('Tipos generados en src/lib/api-schema.ts')
