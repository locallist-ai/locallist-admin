/**
 * Recursos en español (España, tú/vosotros) del admin. Paridad de claves
 * obligatoria con `en.ts` (test en `src/__tests__/i18nParity.test.ts`).
 */
export default {
  common: {
    close: 'Cerrar',
  },
  language: {
    label: 'Idioma',
    english: 'Inglés',
    spanish: 'Español',
    a11y: 'Cambiar idioma',
  },
  nav: {
    curationQueue: 'Cola de curación',
    analytics: 'Analíticas',
    editPlace: 'Editar lugar',
    createPlace: 'Crear lugar',
    createPlan: 'Crear plan',
    editPlan: 'Editar plan',
    importGoogle: 'Importar de Google',
  },
  analytics: {
    ranges: {
      '7d': '7d',
      '30d': '30d',
      '90d': '90d',
      '1y': '1a',
      all: 'Todo',
    },
    error: {
      failed: 'No se pudieron cargar las analíticas: {{error}}',
      retry: 'Reintentar',
    },
    truncated:
      'Rango grande: las tarjetas de resumen siguen siendo exactas, pero las series, percentiles y mezclas usan las {{rows}} filas más recientes. Para Todo y rangos muy grandes la gráfica empieza en la más antigua de esas filas, así que puede faltar historial anterior.',
    chat: {
      title: 'Chat',
      turns: 'Turnos',
      cost: 'Coste (rango)',
      latencyP50: 'Latencia p50',
      latencyP95Hint: 'p95 {{value}}',
      errorRate: 'Tasa de error',
      slotCompleteness: 'Completitud de slots (media)',
      turnsPerPeriod: 'Turnos / periodo',
      providerModel: 'Proveedor · modelo',
      finishReasons: 'Motivos de fin',
      errorCodes: 'Códigos de error',
      empty: 'Sin turnos en este rango.',
    },
    plans: {
      title: 'Planes',
      generated: 'Planes generados',
      avgCost: 'Coste medio / plan',
      opened: 'Abiertos',
      followed: 'Seguidos',
      plansBySource: 'Planes / periodo por origen',
      byCity: 'Por ciudad',
      empty: 'Sin planes generados en este rango.',
    },
    cityTable: {
      city: 'Ciudad',
      count: 'Planes',
      opened: 'Abiertos',
      followed: 'Seguidos',
      empty: 'Sin planes en este rango.',
    },
    legend: {
      a11y: 'Qué mide {{metric}}',
      turns: 'Mensajes procesados por el chat IA. Mide el volumen del flujo conversacional.',
      cost: 'Gasto en tokens de IA. Es el coste variable del chat.',
      latency: 'La mitad de los turnos responde por debajo de p50; p95 es la cola lenta. Refleja la experiencia y la degradación del proveedor.',
      errorRate: 'Porcentaje de turnos fallidos. Mide la salud del pipeline de IA.',
      slotCompleteness: 'Cuántas de las 9 preferencias extrae de media la conversación. Indica si llega a tener datos para generar un plan.',
      turnsPerPeriod: 'Evolución del volumen de turnos a lo largo del periodo.',
      providerModel: 'Reparto por el LLM que respondió cada turno. Muestra cuánto entra el fallback.',
      finishReasons: 'Motivo con el que terminó cada turno del modelo. Ayuda a detectar truncados o respuestas filtradas.',
      errorCodes: 'Reparto de los turnos fallidos por código de error. Localiza la causa de los fallos.',
      plansGenerated: 'Itinerarios generados por la IA.',
      avgCost: 'Coste de IA por plan generado. El coste unitario.',
      opened: 'Porcentaje de planes generados que se abrieron. Indica si el plan interesó.',
      followed: 'Porcentaje de planes que pasaron a Follow Mode. Señal fuerte de valor.',
      plansBySource: 'Planes por periodo según su origen (wizard vs chat).',
      byCity: 'Volumen y calidad (abiertos, seguidos) por ciudad.',
    },
  },
} as const;
