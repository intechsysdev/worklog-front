/**
 * Lista local y pequeña de países y ciudades para las sedes. La especificación pide en el futuro
 * ISO 3166 + GeoNames; mientras tanto basta con Colombia y México. La zona horaria sale de la
 * ciudad y el API la valida.
 */

export interface City {
  name: string
  region: string
  timeZoneId: string
  /** Código DANE (Colombia) o INEGI (México), solo informativo. */
  code?: string
  latitude: number
  longitude: number
}

export interface Country {
  code: string
  name: string
  holidays: string
  laborRules: string
  cities: City[]
}

export const countries: Country[] = [
  {
    code: 'CO',
    name: 'Colombia',
    holidays: 'Festivos de Colombia',
    laborRules: 'Ley 2101 de 2021 y CST',
    cities: [
      { name: 'Bogotá', region: 'Bogotá D. C.', timeZoneId: 'America/Bogota', code: '11001', latitude: 4.711, longitude: -74.0721 },
      { name: 'Medellín', region: 'Antioquia', timeZoneId: 'America/Bogota', code: '05001', latitude: 6.2442, longitude: -75.5812 },
      { name: 'Cali', region: 'Valle del Cauca', timeZoneId: 'America/Bogota', code: '76001', latitude: 3.4516, longitude: -76.532 },
      { name: 'Barranquilla', region: 'Atlántico', timeZoneId: 'America/Bogota', code: '08001', latitude: 10.9685, longitude: -74.7813 },
      { name: 'Cartagena', region: 'Bolívar', timeZoneId: 'America/Bogota', code: '13001', latitude: 10.391, longitude: -75.4794 },
      { name: 'Bucaramanga', region: 'Santander', timeZoneId: 'America/Bogota', code: '68001', latitude: 7.1193, longitude: -73.1227 },
      { name: 'Cúcuta', region: 'Norte de Santander', timeZoneId: 'America/Bogota', code: '54001', latitude: 7.8939, longitude: -72.5078 },
      { name: 'Pereira', region: 'Risaralda', timeZoneId: 'America/Bogota', code: '66001', latitude: 4.8133, longitude: -75.6961 },
      { name: 'Manizales', region: 'Caldas', timeZoneId: 'America/Bogota', code: '17001', latitude: 5.0703, longitude: -75.5138 },
      { name: 'Armenia', region: 'Quindío', timeZoneId: 'America/Bogota', code: '63001', latitude: 4.5339, longitude: -75.6811 },
      { name: 'Ibagué', region: 'Tolima', timeZoneId: 'America/Bogota', code: '73001', latitude: 4.4389, longitude: -75.2322 },
      { name: 'Santa Marta', region: 'Magdalena', timeZoneId: 'America/Bogota', code: '47001', latitude: 11.2408, longitude: -74.199 },
      { name: 'Villavicencio', region: 'Meta', timeZoneId: 'America/Bogota', code: '50001', latitude: 4.142, longitude: -73.6266 },
      { name: 'Neiva', region: 'Huila', timeZoneId: 'America/Bogota', code: '41001', latitude: 2.9273, longitude: -75.2819 },
      { name: 'Pasto', region: 'Nariño', timeZoneId: 'America/Bogota', code: '52001', latitude: 1.2136, longitude: -77.2811 },
      { name: 'Montería', region: 'Córdoba', timeZoneId: 'America/Bogota', code: '23001', latitude: 8.7479, longitude: -75.8814 },
      { name: 'Valledupar', region: 'Cesar', timeZoneId: 'America/Bogota', code: '20001', latitude: 10.4631, longitude: -73.2532 },
      { name: 'Tunja', region: 'Boyacá', timeZoneId: 'America/Bogota', code: '15001', latitude: 5.5353, longitude: -73.3678 },
      { name: 'Popayán', region: 'Cauca', timeZoneId: 'America/Bogota', code: '19001', latitude: 2.4448, longitude: -76.6147 },
    ],
  },
  {
    code: 'MX',
    name: 'México',
    holidays: 'Días de descanso obligatorio de México',
    laborRules: 'Por configurar',
    cities: [
      { name: 'Ciudad de México', region: 'Ciudad de México', timeZoneId: 'America/Mexico_City', latitude: 19.4326, longitude: -99.1332 },
      { name: 'Guadalajara', region: 'Jalisco', timeZoneId: 'America/Mexico_City', latitude: 20.6597, longitude: -103.3496 },
      { name: 'Monterrey', region: 'Nuevo León', timeZoneId: 'America/Monterrey', latitude: 25.6866, longitude: -100.3161 },
      { name: 'Puebla', region: 'Puebla', timeZoneId: 'America/Mexico_City', latitude: 19.0414, longitude: -98.2063 },
      { name: 'Querétaro', region: 'Querétaro', timeZoneId: 'America/Mexico_City', latitude: 20.5888, longitude: -100.3899 },
      { name: 'León', region: 'Guanajuato', timeZoneId: 'America/Mexico_City', latitude: 21.1221, longitude: -101.6824 },
      { name: 'Tijuana', region: 'Baja California', timeZoneId: 'America/Tijuana', latitude: 32.5149, longitude: -117.0382 },
      { name: 'Mérida', region: 'Yucatán', timeZoneId: 'America/Merida', latitude: 20.9674, longitude: -89.5926 },
      { name: 'Cancún', region: 'Quintana Roo', timeZoneId: 'America/Cancun', latitude: 21.1619, longitude: -86.8515 },
      { name: 'Chihuahua', region: 'Chihuahua', timeZoneId: 'America/Chihuahua', latitude: 28.6353, longitude: -106.0889 },
      { name: 'Hermosillo', region: 'Sonora', timeZoneId: 'America/Hermosillo', latitude: 29.0729, longitude: -110.9559 },
    ],
  },
]

export const countryByCode = (code?: string | null) => countries.find((country) => country.code === code)

export const countryName = (code?: string | null) => countryByCode(code)?.name ?? code ?? '—'

export function findCity(countryCode?: string | null, cityName?: string | null) {
  return countryByCode(countryCode)?.cities.find((city) => city.name === cityName)
}

/** Centro por defecto del mapa (Bogotá). */
export const DEFAULT_CENTER = { latitude: 4.711, longitude: -74.0721 }
