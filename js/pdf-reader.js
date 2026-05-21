'use strict';

// ============================================================
// LECTOR DE PDF — AsesorFiscal
// Usa PDF.js 2.16.105 (build UMD, expone window.pdfjsLib)
// Las versiones 3.x en cdnjs son ES Modules y NO funcionan
// con <script src> clásico.
// ============================================================

const PDF_CDN    = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
const PDF_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// ---- Carga diferida de PDF.js (solo cuando el usuario sube un archivo) ----
function cargarPDFJS() {
  return new Promise((resolve, reject) => {
    // Ya cargado previamente
    if (window.pdfjsLib) {
      resolve(window.pdfjsLib);
      return;
    }

    const script = document.createElement('script');
    script.src = PDF_CDN;

    script.onload = () => {
      if (window.pdfjsLib) {
        // Indicar el worker (mismo CDN, versión UMD compatible)
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER;
        resolve(window.pdfjsLib);
      } else {
        reject(new Error(
          'PDF.js cargó pero no expuso window.pdfjsLib. ' +
          'Comprueba tu conexión a internet.'
        ));
      }
    };

    script.onerror = () => reject(new Error(
      'No se pudo descargar PDF.js desde la CDN. ' +
      'Comprueba tu conexión a internet e inténtalo de nuevo.'
    ));

    document.head.appendChild(script);
  });
}

// ---- Extraer texto de todas las páginas del PDF (máx. 15) ----
async function extraerTextoPDF(file) {
  const pdfjs  = await cargarPDFJS();
  const buffer = await file.arrayBuffer();

  const loadTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const pdf      = await loadTask.promise;

  let texto = '';
  const maxPags = Math.min(pdf.numPages, 15);

  for (let i = 1; i <= maxPags; i++) {
    const pagina   = await pdf.getPage(i);
    const contenido = await pagina.getTextContent();
    // Unir ítems; añadir espacio entre columnas y salto entre páginas
    texto += contenido.items.map(item => item.str).join(' ') + '\n';
  }

  return texto;
}

// ---- Parsear importe en formato español: "1.234,56" → 1234.56 ----
function parsearImporte(str) {
  if (!str) return null;
  const limpio = str.trim().replace(/\./g, '').replace(',', '.');
  const num = parseFloat(limpio);
  return isNaN(num) ? null : num;
}

// ---- Detectar tipo de documento ----
function detectarTipo(texto) {
  const t = texto.toLowerCase();
  if (/modelo\s*100|declaraci[oó]n\s+(anual\s+)?de\s+(la\s+)?renta|renta\s*20\d\d|agencia\s+tributaria|irpf\s+20\d\d/.test(t)) {
    return 'declaracion';
  }
  if (/n[oó]mina|recibo\s+de\s+salario|total\s+devengos|l[ií]quido\s+a\s+percibir|n[uú]mero\s+de\s+trabajador|datos\s+del\s+trabajador/.test(t)) {
    return 'nomina';
  }
  // Si no se detecta tipo claro, asumir nómina
  return 'nomina';
}

// ---- Extraer datos de una nómina española ----
function extraerDeNomina(texto) {
  const datos = {};

  // Salario bruto mensual — varios formatos posibles
  const patronesBruto = [
    /total\s+devengos?\s*[:\-]?\s*([\d.,]+)/i,
    /total\s+bruto\s*[:\-]?\s*([\d.,]+)/i,
    /importe\s+bruto\s*[:\-]?\s*([\d.,]+)/i,
    /retribuci[oó]n\s+bruta\s*[:\-]?\s*([\d.,]+)/i,
    /salario\s+bruto\s*[:\-]?\s*([\d.,]+)/i,
    /total\s+percepciones\s*[:\-]?\s*([\d.,]+)/i,
  ];
  for (const p of patronesBruto) {
    const m = texto.match(p);
    if (m) {
      const importe = parsearImporte(m[1]);
      if (importe && importe > 100 && importe < 200000) {
        datos._brutoMensual = importe;
        const esMensual = importe < 8000; // heurística
        datos._esMensual = esMensual;
        datos.salarioBruto = esMensual ? Math.round(importe * 14 * 100) / 100 : importe;
        datos.numPagas = 14;
        break;
      }
    }
  }

  // IRPF % — varias representaciones habituales en nóminas
  const mIRPF =
    texto.match(/i\.?r\.?p\.?f\.?\s*[\(:\-]?\s*([\d]+(?:[,.][\d]{1,2})?)\s*%/i) ||
    texto.match(/retenci[oó]n\s+(?:irpf|fiscal)\s*[:\-]?\s*([\d]+(?:[,.][\d]{1,2})?)\s*%/i) ||
    texto.match(/(?:retenci[oó]n|irpf)\D{0,20}([\d]+[,.][\d]{1,2})\s*%/i);
  if (mIRPF) {
    const pct = parsearImporte(mIRPF[1]);
    if (pct !== null && pct >= 0 && pct <= 50) datos.retencionActual = pct;
  }

  // Número de pagas
  if (/14\s+pagas|catorce\s+pagas/i.test(texto)) datos.numPagas = 14;
  else if (/12\s+pagas|doce\s+pagas/i.test(texto)) datos.numPagas = 12;

  // Estado civil (cuando aparece en los datos del trabajador)
  if (/casado/i.test(texto) && !/soltero/i.test(texto)) datos.estadoCivil = 'casado_conjunto';
  else if (/soltero|viudo|divorciado|separado/i.test(texto)) datos.estadoCivil = 'soltero';

  datos._tipo = 'nomina';
  if (datos._esMensual && datos._brutoMensual) {
    datos._advertencia =
      `Salario mensual detectado: ${datos._brutoMensual.toLocaleString('es-ES')} €. ` +
      `Estimado anual ×14 pagas = ${datos.salarioBruto?.toLocaleString('es-ES')} €. ` +
      `Ajusta si tu convenio es diferente.`;
  }

  return datos;
}

// ---- Extraer datos del Modelo 100 AEAT (declaración de la renta) ----
function extraerDeDeclaracion(texto) {
  const datos = {};

  // Rendimientos íntegros del trabajo
  const patronesBruto = [
    /rendimientos\s+[ií]ntegros\s+del\s+trabajo[^0-9]*([\d.,]+)/i,
    /rendimientos\s+del\s+trabajo[^0-9]*([\d.,]+)/i,
    /ingresos\s+[ií]ntegros\s+del\s+trabajo[^0-9]*([\d.,]+)/i,
    /0011\D+([\d.,]+)/,   // casilla 0011
    /0015\D+([\d.,]+)/,   // casilla alternativa
  ];
  for (const p of patronesBruto) {
    const m = texto.match(p);
    if (m) {
      const importe = parsearImporte(m[1]);
      if (importe && importe > 1000) { datos.salarioBruto = importe; break; }
    }
  }

  // Retenciones del trabajo (€)
  const patronesRet = [
    /retenciones\s+e\s+ingresos\s+a\s+cuenta\s+del\s+trabajo[^0-9]*([\d.,]+)/i,
    /retenciones\s+e\s+ingresos\s+a\s+cuenta[^0-9]*([\d.,]+)/i,
    /total\s+retenciones[^0-9]*([\d.,]+)/i,
    /0596\D+([\d.,]+)/,
    /0593\D+([\d.,]+)/,
  ];
  for (const p of patronesRet) {
    const m = texto.match(p);
    if (m) {
      const importe = parsearImporte(m[1]);
      if (importe && importe > 0) { datos._retencionesEuros = importe; break; }
    }
  }

  // Calcular % de retención
  if (datos.salarioBruto && datos._retencionesEuros) {
    const pct = (datos._retencionesEuros / datos.salarioBruto) * 100;
    datos.retencionActual = Math.round(pct * 10) / 10;
  }

  // Estado civil
  if (/casado|c[oó]nyuge/i.test(texto)) datos.estadoCivil = 'casado_conjunto';
  else if (/soltero|viudo|divorciado|separado/i.test(texto)) datos.estadoCivil = 'soltero';

  // Comunidad Autónoma
  const ccaaMap = [
    [/andaluc[ií]/i,                                'andalucia'],
    [/arag[oó]n/i,                                  'aragon'],
    [/asturias/i,                                   'asturias'],
    [/baleares|illes balears/i,                     'baleares'],
    [/canarias/i,                                   'canarias'],
    [/cantabria/i,                                  'cantabria'],
    [/castilla.la mancha/i,                         'castillaLaMancha'],
    [/castilla y le[oó]n/i,                         'castillaYLeon'],
    [/catalu[nñ]/i,                                 'cataluna'],
    [/extremadura/i,                                'extremadura'],
    [/galicia/i,                                    'galicia'],
    [/la rioja/i,                                   'laRioja'],
    [/madrid/i,                                     'madrid'],
    [/murcia/i,                                     'murcia'],
    [/navarra/i,                                    'navarra'],
    [/pa[ií]s vasco|euskadi|bizkaia|gipuzkoa|[aá]lava/i, 'paisVasco'],
    [/comunitat valenciana|pa[ií]s valenci[aà]/i,   'valencia'],
  ];
  for (const [patron, clave] of ccaaMap) {
    if (patron.test(texto)) { datos.ccaa = clave; break; }
  }

  datos._tipo = 'declaracion';
  return datos;
}

// ============================================================
// FUNCIÓN PRINCIPAL
// ============================================================
async function procesarPDF(file) {
  // Validaciones básicas antes de intentar cargar PDF.js
  if (!file) {
    return { _error: 'No se recibió ningún archivo.' };
  }
  if (file.type !== 'application/pdf' && !file.name?.toLowerCase().endsWith('.pdf')) {
    return { _error: 'El archivo no parece ser un PDF. Selecciona un archivo con extensión .pdf.' };
  }
  if (file.size > 25 * 1024 * 1024) {
    return { _error: 'El PDF supera los 25 MB. Usa un archivo más pequeño.' };
  }
  if (file.size === 0) {
    return { _error: 'El archivo PDF está vacío.' };
  }

  try {
    const texto = await extraerTextoPDF(file);

    // Verificar que el PDF contenía texto real (no escaneado)
    const palabrasUtiles = texto.trim().split(/\s+/).filter(w => w.length > 1).length;

    if (palabrasUtiles < 15) {
      return {
        _tipo: 'escaneado',
        _error:
          'El PDF parece contener solo imágenes (escaneado o fotografiado). ' +
          'La app solo puede leer PDFs digitales con texto seleccionable, ' +
          'como los generados por programas de nóminas o la web de la AEAT.',
      };
    }

    const tipo  = detectarTipo(texto);
    const datos = tipo === 'declaracion'
      ? extraerDeDeclaracion(texto)
      : extraerDeNomina(texto);

    datos._palabrasDetectadas = palabrasUtiles;
    return datos;

  } catch (err) {
    // Mensaje de error legible para el usuario
    let msg = 'Error al procesar el PDF.';
    if (err.message?.includes('CDN') || err.message?.includes('descargar')) {
      msg = err.message;
    } else if (err.message?.includes('password') || err.message?.includes('encrypted')) {
      msg = 'El PDF está protegido con contraseña. Quítale la contraseña e inténtalo de nuevo.';
    } else if (err.message?.includes('Invalid PDF')) {
      msg = 'El archivo no es un PDF válido o está dañado.';
    }
    return { _error: msg };
  }
}

// ---- Generar resumen de campos detectados / faltantes ----
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
      if (campo.key === 'salarioBruto')    mostrar = `${Number(valor).toLocaleString('es-ES')} €`;
      if (campo.key === 'retencionActual') mostrar = `${valor} %`;
      if (campo.key === 'estadoCivil')     mostrar = valor === 'casado_conjunto' ? 'Casado/a (conjunta)' : 'Soltero/a o individual';
      if (campo.key === 'ccaa' && typeof IRPF_2024 !== 'undefined') {
        mostrar = IRPF_2024.tramosCCAA[valor]?.nombre || valor;
      }
      detectados.push({ label: campo.label, valor: mostrar });
    } else {
      faltantes.push(campo.label);
    }
  }

  return { detectados, faltantes };
}
