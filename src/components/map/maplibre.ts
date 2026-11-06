import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import 'maplibre-gl/dist/maplibre-gl.css'

// El worker de MapLibre se sirve como archivo propio: el bundle no lo puede resolver solo.
setWorkerUrl(workerUrl)

/** Mapa base Liberty de OpenFreeMap (sin clave). */
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'

export function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}
