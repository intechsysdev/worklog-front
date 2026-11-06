/** Nombre legible de un paquete Android del catálogo de MobiControl (§1, Control de dispositivos). */
const known: Record<string, string> = {
  'com.intechsys.worklog': 'WorkLog',
  'com.android.dialer': 'Teléfono',
  'com.android.camera': 'Cámara',
  'com.google.android.apps.maps': 'Mapas',
  'com.android.chrome': 'Chrome',
}

const bySuffix: Record<string, string> = {
  mail: 'Correo corporativo',
  ot: 'Órdenes de trabajo',
  inventario: 'Inventario',
  chat: 'Chat del equipo',
}

export function appName(pkg: string) {
  if (known[pkg]) return known[pkg]
  const suffix = pkg.split('.').pop() ?? pkg
  return bySuffix[suffix] ?? suffix.charAt(0).toUpperCase() + suffix.slice(1)
}
