'use strict';

// ============================================================
// LECTOR DE PDF — AsesorFiscal
// PDF.js 2.16.105 UMD — expone window.pdfjsLib
// Las versiones 3.x en cdnjs son ES Modules, no funcionan
// con <script src> clásico.
// ============================================================

const PDF_CDN    = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
const PDF_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// ---- Carga diferida de PDF.js ----
function cargarPDFJS() {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
    const script = document.createElement('script');
    script.src = PDF_CDN;
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER;
        resolve(window.pdfjsLib);
      } else {
        reject(new Error('PDF.js cargó pero no expuso window.pdfjsLib.'));
      }
    };
    script.onerror = () => reject(new Error(
      'No se pudo descargar PDF.js desde la CDN. Comprueba tu conexión.'
    ));
    document.head.appendChild(script);
  });
}

// ---- Extraer texto reconstruyendo líneas visuales por coordenada Y ----
// PDF.js devuelve ítems sueltos con posición (x, y). Los agrupamos por Y
// para reconstruir las filas del documento tal como se ven, luego los
// ordenamos de izquierda a derecha dentro de cada fila.
async function extraerTextoPDF(file) {
  const pdfjs  = await cargarPDFJS();
  const buffer = await file.arrayBuffer();
  const pdf    = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;

  const todasLineas = [];
  const maxPags = Math.min(pdf.numPages, 15);

  for (let p = 1; p <= maxPags; p++) {
    const pagina  = await pdf.getPage(p);
    const content = await pagina.getTextContent();

    // Agrupar ítems por Y redondeada (tolerancia 4 px para subpíxeles)
    const byY = new Map();
    for (const item of content.items) {
      if (!item.str) continue;
      const y = Math.round(item.transform[5] / 4) * 4;
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y).push({ x: item.transform[4], w: item.width || 0, str: item.str });
    }

    // Ordenar filas de arriba a abajo (Y mayor = más arriba en PDF.js)
    const ysOrdenados = [...byY.keys()].sort((a, b) => b - a);
    for (const y of ysOrdenados) {
      const fila = byY.get(y).sort((a, b) => a.x - b.x);

      // Unir ítems: espacio solo si hay hueco real entre ellos
      let linea = '';
      let prevRight = null;
      for (const item of fila) {
        if (prevRight !== null) {
          const gap = item.x - prevRight;
          linea += gap > 6 ? ' ' : '';
        }
        linea += item.str;
        prevRight = item.x + item.w;
      }

      // Normalizar artefactos tipográficos en números: "1 . 234 , 56" → "1.234,56"
      linea = linea
        .replace(/(\d)\s+\.\s+(\d)/g, '$1.$2')
        .replace(/(\d)\s+,\s+(\d)/g,  '$1,$2')
        .trim();

      if (linea) todasLineas.push(linea);
    }
    todasLineas.push(''); // separador de página
  }

  return todasLineas;
}

// ---- Parsear importe español: "1.234,56" → 1234.56 ----
function parsearImporte(str) {
  if (!str) return null;
  const limpio = str.trim()
    .replace(/\s*\.\s*/g, '.')
    .replace(/\s*,\s*/g,  ',')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = parseFloat(limpio);
  return isNaN(n) ? null : n;
}

// ---- Extraer todos los importes de una línea ----
function importesDeLinea(linea) {
  const norm = linea
    .replace(/(\d)\s*\.\s*(\d)/g, '$1.$2')
    .replace(/(\d)\s*,\s*(\d)/g,  '$1,$2');
  const matches = [...norm.matchAll(/\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+,\d{1,2}/g)];
  return matches.map(m => parsearImporte(m[0])).filter(n => n !== null);
}

function primerImporte(linea) {
  const lista = importesDeLinea(linea);
  return lista.length ? lista[0] : null;
}

function ultimoImporte(linea) {
  const lista = importesDeLinea(linea);
  return lista.length ? lista[lista.length - 1] : null;
}

// ---- Buscar un importe cerca de una etiqueta ----
// Devuelve el último importe de la línea que contiene la etiqueta,
// o el primero de las `ventana` líneas siguientes si la línea de la
// etiqueta no tiene número (caso columna separada).
function buscarImporteJunto(lineas, patronEtiqueta, ventana) {
  ventana = ventana || 3;
  for (let i = 0; i < lineas.length; i++) {
    if (!patronEtiqueta.test(lineas[i])) continue;

    const v = ultimoImporte(lineas[i]);
    if (v !== null) return v;

    for (let j = i + 1; j <= i + ventana && j < lineas.length; j++) {
      if (!lineas[j].trim()) continue;
      const vj = primerImporte(lineas[j]);
      if (vj !== null) return vj;
    }
  }
  return null;
}

// ---- Buscar porcentaje cerca de una etiqueta ----
function buscarPorcentajeJunto(lineas, patronEtiqueta, ventana) {
  ventana = ventana || 3;
  for (let i = 0; i < lineas.length; i++) {
    if (!patronEtiqueta.test(lineas[i])) continue;

    for (let j = i; j <= i + ventana && j < lineas.length; j++) {
      // "15,00 %" o "15%" o "15,00%" — admitir espacio antes de %
      const mPct = lineas[j].match(/(\d{1,2}(?:[,.]\d{1,2})?)\s*%/);
      if (mPct) {
        const pct = parsearImporte(mPct[1]);
        if (pct !== null && pct >= 0 && pct <= 50) return pct;
      }
    }
  }
  return null;
}

// ---- Detectar tipo de documento ----
function detectarTipo(lineas) {
  const texto = lineas.join('\n').toLowerCase();
  if (/modelo\s*100|agencia\s+tributaria|renta\s+20\d\d|declaraci[oó]n.*renta/.test(texto)) {
    return 'declaracion';
  }
  if (/n[oó]mina|recibo\s*de\s*salario|total\s+devengos?|l[ií]quido\s+a\s+percibir/.test(texto)) {
    return 'nomina';
  }
  // Por defecto asumir nómina
  return 'nomina';
}

// ---- Extraer datos de nómina española ----
function extraerDeNomina(lineas) {
  const datos = {};
  const texto = lineas.join('\n');

  // --- Salario bruto mensual ---
  const etiquetasBruto = [
    /total\s+devengos?/i,
    /total\s+bruto/i,
    /importe\s+bruto/i,
    /retribuci[oó]n\s+bruta/i,
    /salario\s+bruto/i,
    /total\s+percepciones?/i,
    /total\s+haberes/i,
    /total\s+remuneraci[oó]n/i,
  ];
  for (const e of etiquetasBruto) {
    const v = buscarImporteJunto(lineas, e);
    if (v !== null && v > 100 && v < 200000) {
      datos._brutoMensual = v;
      const esMensual = v < 10000;
      datos._esMensual = esMensual;
      datos.salarioBruto = esMensual ? Math.round(v * 14 * 100) / 100 : v;
      datos.numPagas = 14;
      break;
    }
  }

  // --- Retención IRPF % ---
  const etiquetasIRPF = [
    /i\.?\s*r\.?\s*p\.?\s*f\.?/i,
    /retenci[oó]n\s+fiscal/i,
    /retenci[oó]n\s+irpf/i,
    /retenci[oó]n\s+a\s+cuenta/i,
  ];
  for (const e of etiquetasIRPF) {
    const pct = buscarPorcentajeJunto(lineas, e);
    if (pct !== null) { datos.retencionActual = pct; break; }
  }

  // --- Número de pagas ---
  if (/14\s+pagas|catorce\s+pagas/i.test(texto)) datos.numPagas = 14;
  else if (/12\s+pagas|doce\s+pagas/i.test(texto)) datos.numPagas = 12;

  // --- Estado civil ---
  if (/casad[oa]/i.test(texto) && !/solter[oa]/i.test(texto)) {
    datos.estadoCivil = 'casado_conjunto';
  } else if (/solter[oa]|viud[oa]|divorciad[oa]|separad[oa]/i.test(texto)) {
    datos.estadoCivil = 'soltero';
  }

  datos._tipo = 'nomina';
  if (datos._esMensual && datos._brutoMensual) {
    datos._advertencia =
      'Salario mensual detectado: ' + datos._brutoMensual.toLocaleString('es-ES') + ' €. ' +
      'Estimado anual ×14 pagas = ' + (datos.salarioBruto ? datos.salarioBruto.toLocaleString('es-ES') : '?') + ' €. ' +
      'Ajusta si tu convenio usa menos pagas.';
  }

  return datos;
}

// ---- Extraer datos del Modelo 100 AEAT ----
function extraerDeDeclaracion(lineas) {
  const datos = {};
  const texto = lineas.join('\n');

  // --- Rendimientos íntegros del trabajo (casilla 0011) ---
  const etiquetasBruto = [
    /rendimientos?\s+[ií]ntegros?\s+del\s+trabajo/i,
    /rendimientos?\s+del\s+trabajo/i,
    /ingresos?\s+[ií]ntegros?\s+del\s+trabajo/i,
    /\b0011\b/,
    /\b011\b/,
  ];
  for (const e of etiquetasBruto) {
    const v = buscarImporteJunto(lineas, e, 4);
    if (v !== null && v > 500) { datos.salarioBruto = v; break; }
  }

  // --- Retenciones e ingresos a cuenta del trabajo (casilla 0596) ---
  const etiquetasRet = [
    /retenciones?\s+e\s+ingresos?\s+a\s+cuenta\s+del\s+trabajo/i,
    /retenciones?\s+e\s+ingresos?\s+a\s+cuenta/i,
    /total\s+retenciones?/i,
    /\b0596\b/,
    /\b0593\b/,
  ];
  for (const e of etiquetasRet) {
    const v = buscarImporteJunto(lineas, e, 4);
    if (v !== null && v > 0) { datos._retencionesEuros = v; break; }
  }

  // Calcular % retención a partir de importes
  if (datos.salarioBruto && datos._retencionesEuros) {
    const pct = (datos._retencionesEuros / datos.salarioBruto) * 100;
    if (pct > 0 && pct <= 50) datos.retencionActual = Math.round(pct * 10) / 10;
  }

  // --- Estado civil ---
  if (/tributaci[oó]n\s+conjunta|casad[oa]/i.test(texto)) {
    datos.estadoCivil = 'casado_conjunto';
  } else if (/tributaci[oó]n\s+individual|solter[oa]|viud[oa]|divorciad[oa]/i.test(texto)) {
    datos.estadoCivil = 'soltero';
  }

  // --- Comunidad Autónoma ---
  const ccaaMap = [
    [/andaluc[ií]/i,                                     'andalucia'],
    [/arag[oó]n/i,                                       'aragon'],
    [/asturias/i,                                        'asturias'],
    [/baleares|illes\s*balears/i,                        'baleares'],
    [/canarias/i,                                        'canarias'],
    [/cantabria/i,                                       'cantabria'],
    [/castilla[- ]+la\s+mancha/i,                        'castillaLaMancha'],
    [/castilla\s+y\s+le[oó]n/i,                          'castillaYLeon'],
    [/catalu[nñ]|catalunya/i,                            'cataluna'],
    [/extremadura/i,                                     'extremadura'],
    [/galicia/i,                                         'galicia'],
    [/la\s+rioja/i,                                      'laRioja'],
    [/madrid/i,                                          'madrid'],
    [/murcia/i,                                          'murcia'],
    [/navarra/i,                                         'navarra'],
    [/pa[ií]s\s+vasco|euskadi|bizkaia|gipuzkoa|[aá]lava/i, 'paisVasco'],
    [/comunitat\s+valenciana|pa[ií]s\s+valenci[aà]/i,    'valencia'],
  ];
  for (const [patron, clave] of ccaaMap) {
    if (patron.test(texto)) { datos.ccaa = clave; break; }
  }

  datos._tipo = 'declaracion';
  return datos;
}

// ============================================================
// FUNCIÓN PRINCIPAL (API pública)
// ============================================================
async function procesarPDF(file) {
  if (!file) {
    return { _error: 'No se recibió ningún archivo.' };
  }
  if (file.type !== 'application/pdf' && !file.name?.toLowerCase().endsWith('.pdf')) {
    return { _error: 'El archivo no es un PDF. Selecciona un archivo .pdf.' };
  }
  if (file.size > 25 * 1024 * 1024) {
    return { _error: 'El PDF supera los 25 MB.' };
  }
  if (file.size === 0) {
    return { _error: 'El archivo PDF está vacío.' };
  }

  try {
    const lineas = await extraerTextoPDF(file);
    const palabrasUtiles = lineas.join(' ').trim().split(/\s+/).filter(w => w.length > 1).length;

    if (palabrasUtiles < 15) {
      return {
        _tipo:  'escaneado',
        _error: 'El PDF parece ser una imagen escaneada. ' +
                'La app solo lee PDFs digitales con texto seleccionable ' +
                '(generados por programas de nóminas o descargados de la AEAT).',
      };
    }

    const tipo  = detectarTipo(lineas);
    const datos = tipo === 'declaracion'
      ? extraerDeDeclaracion(lineas)
      : extraerDeNomina(lineas);

    datos._palabrasDetectadas = palabrasUtiles;
    return datos;

  } catch (err) {
    let msg = 'Error al procesar el PDF.';
    if (err.message && (err.message.includes('CDN') || err.message.includes('descargar'))) {
      msg = err.message;
    } else if (err.message && (err.message.includes('password') || err.message.includes('encrypted'))) {
      msg = 'El PDF está protegido con contraseña. Quítale la contraseña e inténtalo de nuevo.';
    } else if (err.message && err.message.includes('Invalid PDF')) {
      msg = 'El archivo no es un PDF válido o está dañado.';
    }
    return { _error: msg };
  }
}

// ---- Generar resumen de campos detectados / faltantes (API pública) ----
function generarResumenCampos(datos) {
  const campos = [
    { key: 'salarioBruto',    label: 'Salario bruto anual' },
    { key: 'retencionActual', label: 'Retención IRPF (%)' },
    { key: 'numPagas',        label: 'Número de pagas' },
    { key: 'estadoCivil',     label: 'Estado civil' },
    { key: 'ccaa',            label: 'Comunidad autónoma' },
  ];

  const detectados = [];
  const faltantes  = [];

  for (const campo of campos) {
    const valor = datos[campo.key];
    if (valor !== undefined && valor !== null && valor !== '') {
      let mostrar = String(valor);
      if (campo.key === 'salarioBruto')    mostrar = Number(valor).toLocaleString('es-ES') + ' €';
      if (campo.key === 'retencionActual') mostrar = valor + ' %';
      if (campo.key === 'estadoCivil')     mostrar = valor === 'casado_conjunto' ? 'Casado/a (conjunta)' : 'Soltero/a o individual';
      if (campo.key === 'ccaa' && typeof IRPF_2024 !== 'undefined') {
        mostrar = IRPF_2024.tramosCCAA[valor] ? IRPF_2024.tramosCCAA[valor].nombre : valor;
      }
      detectados.push({ label: campo.label, valor: mostrar });
    } else {
      faltantes.push(campo.label);
    }
  }

  return { detectados, faltantes };
}
