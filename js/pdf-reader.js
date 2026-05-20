'use strict';

// ============================================================
// LECTOR DE PDF — AsesorFiscal
// Extracción de datos fiscales de nóminas y Modelo 100 AEAT
// PDF.js se carga de forma diferida solo cuando se necesita
// ============================================================

const PDF_CDN    = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDF_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ---- Carga diferida de PDF.js ----
function cargarPDFJS() {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
    const script = document.createElement('script');
    script.src = PDF_CDN;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER;
        resolve(window.pdfjsLib);
      } else {
        reject(new Error('PDF.js no se inicializó correctamente'));
      }
    };
    script.onerror = () => reject(new Error('No se pudo cargar PDF.js. Comprueba tu conexión a internet.'));
    document.head.appendChild(script);
  });
}

// ---- Extraer texto de todas las páginas del PDF ----
async function extraerTextoPDF(file) {
  const pdfjs = await cargarPDFJS();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;

  let texto = '';
  const maxPags = Math.min(pdf.numPages, 15);
  for (let i = 1; i <= maxPags; i++) {
    const pagina = await pdf.getPage(i);
    const contenido = await pagina.getTextContent();
    // Unir ítems preservando separación entre columnas
    texto += contenido.items.map(item => item.str).join(' ') + '\n';
  }
  return texto;
}

// ---- Parsear número en formato español: "1.234,56" → 1234.56 ----
function parsearImporte(str) {
  if (!str) return null;
  // Eliminar puntos de miles y convertir coma decimal
  const limpio = str.trim().replace(/\./g, '').replace(',', '.');
  const num = parseFloat(limpio);
  return isNaN(num) ? null : num;
}

// ---- Detectar tipo de documento ----
function detectarTipo(texto) {
  const t = texto.toLowerCase();
  const esDeclaracion = /modelo\s*100|declaraci[oó]n\s+(anual\s+)?de\s+(la\s+)?renta|renta\s*20\d\d|agencia\s+tributaria|irpf\s+20\d\d/.test(t);
  const esNomina = /n[oó]mina|recibo\s+de\s+salario|total\s+devengos|l[ií]quido\s+a\s+percibir|n[uú]mero\s+de\s+trabajador|datos\s+del\s+trabajador/.test(t);
  if (esDeclaracion) return 'declaracion';
  if (esNomina) return 'nomina';
  return 'nomina'; // Asumir nómina si no se detecta
}

// ---- Extraer datos de una nómina española ----
function extraerDeNomina(texto) {
  const datos = {};

  // Bruto mensual — patrones ordenados por confianza
  const patronesBruto = [
    /total\s+devengos?\s*[:\-]?\s*([\d.,]+)/i,
    /total\s+bruto\s*[:\-]?\s*([\d.,]+)/i,
    /importe\s+bruto\s*[:\-]?\s*([\d.,]+)/i,
    /retribuci[oó]n\s+bruta\s*[:\-]?\s*([\d.,]+)/i,
    /salario\s+bruto\s*[:\-]?\s*([\d.,]+)/i,
  ];
  for (const p of patronesBruto) {
    const m = texto.match(p);
    if (m) {
      const importe = parsearImporte(m[1]);
      if (importe && importe > 100 && importe < 100000) {
        datos._brutoMensual = importe;
        // Heurística: si < 8.000 casi seguro es mensual
        const esMensual = importe < 8000;
        datos._esMensual = esMensual;
        // Estimar anual × 14 pagas (valor por defecto más común en España)
        datos.salarioBruto = esMensual ? Math.round(importe * 14 * 100) / 100 : importe;
        datos.numPagas = 14;
        break;
      }
    }
  }

  // IRPF % — varias formas en que aparece en nóminas
  const mIRPF = texto.match(/i\.?r\.?p\.?f\.?\s*[\(:\-]?\s*([\d]+(?:[,.][\d]{1,2})?)\s*%/i)
    || texto.match(/retenci[oó]n\s+(?:irpf|fiscal)\s*[:\-]?\s*([\d]+(?:[,.][\d]{1,2})?)\s*%/i);
  if (mIRPF) {
    const pct = parsearImporte(mIRPF[1]);
    if (pct !== null && pct >= 0 && pct <= 50) datos.retencionActual = pct;
  }

  // Número de pagas (si se menciona explícitamente)
  if (/14\s+pagas|catorce\s+pagas/i.test(texto)) datos.numPagas = 14;
  else if (/12\s+pagas|doce\s+pagas/i.test(texto)) datos.numPagas = 12;

  // Estado civil (a veces en los datos del trabajador)
  if (/casado/i.test(texto) && !/soltero/i.test(texto)) datos.estadoCivil = 'casado_conjunto';
  else if (/soltero|viudo|divorciado|separado/i.test(texto)) datos.estadoCivil = 'soltero';

  datos._tipo = 'nomina';
  if (datos._esMensual && datos._brutoMensual) {
    datos._advertencia = `Detectado salario mensual de ${datos._brutoMensual.toLocaleString('es-ES')} €. Se ha estimado el anual × 14 pagas = ${datos.salarioBruto?.toLocaleString('es-ES')} €. Ajusta el valor si tu convenio es diferente.`;
  }

  return datos;
}

// ---- Extraer datos del Modelo 100 AEAT (declaración de la renta) ----
function extraerDeDeclaracion(texto) {
  const datos = {};

  // Rendimientos íntegros del trabajo (≈ salario bruto)
  const patronesBruto = [
    /rendimientos\s+[ií]ntegros\s+del\s+trabajo[^0-9]*([\d.,]+)/i,
    /rendimientos\s+del\s+trabajo[^0-9]*([\d.,]+)/i,
    /ingresos\s+[ií]ntegros\s+del\s+trabajo[^0-9]*([\d.,]+)/i,
  ];
  for (const p of patronesBruto) {
    const m = texto.match(p);
    if (m) {
      const importe = parsearImporte(m[1]);
      if (importe && importe > 1000) { datos.salarioBruto = importe; break; }
    }
  }

  // Retenciones totales (€) del trabajo
  const patronesRet = [
    /retenciones\s+e\s+ingresos\s+a\s+cuenta\s+del\s+trabajo[^0-9]*([\d.,]+)/i,
    /retenciones\s+e\s+ingresos\s+a\s+cuenta[^0-9]*([\d.,]+)/i,
    /total\s+retenciones[^0-9]*([\d.,]+)/i,
  ];
  for (const p of patronesRet) {
    const m = texto.match(p);
    if (m) {
      const importe = parsearImporte(m[1]);
      if (importe && importe > 0) { datos._retencionesEuros = importe; break; }
    }
  }

  // Calcular % de retención a partir de los importes
  if (datos.salarioBruto && datos._retencionesEuros) {
    const pct = (datos._retencionesEuros / datos.salarioBruto) * 100;
    datos.retencionActual = Math.round(pct * 10) / 10;
  }

  // Estado civil
  if (/casado|c[oó]nyuge/i.test(texto)) datos.estadoCivil = 'casado_conjunto';
  else if (/soltero|viudo|divorciado|separado/i.test(texto)) datos.estadoCivil = 'soltero';

  // CCAA — mapa de nombre → clave interna
  const ccaaMap = [
    [/andaluc[ií]/i,           'andalucia'],
    [/arag[oó]n/i,             'aragon'],
    [/asturias/i,              'asturias'],
    [/baleares|illes balears/i,'baleares'],
    [/canarias/i,              'canarias'],
    [/cantabria/i,             'cantabria'],
    [/castilla.la mancha/i,    'castillaLaMancha'],
    [/castilla y le[oó]n/i,    'castillaYLeon'],
    [/catalu[nñ]/i,            'cataluna'],
    [/extremadura/i,           'extremadura'],
    [/galicia/i,               'galicia'],
    [/la rioja/i,              'laRioja'],
    [/madrid/i,                'madrid'],
    [/murcia/i,                'murcia'],
    [/navarra/i,               'navarra'],
    [/pa[ií]s vasco|euskadi|bizkaia|gipuzkoa|[aá]lava/i, 'paisVasco'],
    [/comunitat valenciana|pa[ií]s valenci[aà]/i,        'valencia'],
  ];
  for (const [patron, clave] of ccaaMap) {
    if (patron.test(texto)) { datos.ccaa = clave; break; }
  }

  // Año de la renta (para posible validación)
  const mAnio = texto.match(/renta\s+(20\d\d)/i);
  if (mAnio) datos._anioRenta = parseInt(mAnio[1]);

  datos._tipo = 'declaracion';
  return datos;
}

// ============================================================
// FUNCIÓN PRINCIPAL EXPORTADA
// ============================================================
async function procesarPDF(file) {
  if (!file || file.type !== 'application/pdf') {
    return { _error: 'El archivo seleccionado no es un PDF válido.' };
  }
  if (file.size > 20 * 1024 * 1024) {
    return { _error: 'El PDF supera los 20 MB. Usa un archivo más pequeño.' };
  }

  try {
    const texto = await extraerTextoPDF(file);

    // Detectar si el PDF está vacío (escaneado / imagen)
    const palabras = texto.trim().split(/\s+/).filter(w => w.length > 1).length;
    if (palabras < 15) {
      return {
        _tipo: 'escaneado',
        _error: 'El PDF parece contener solo imágenes (escaneado). Solo se pueden leer PDFs digitales con texto seleccionable.',
      };
    }

    const tipo = detectarTipo(texto);
    const datos = tipo === 'declaracion'
      ? extraerDeDeclaracion(texto)
      : extraerDeNomina(texto);

    datos._palabrasDetectadas = palabras;
    return datos;

  } catch (err) {
    return { _error: `Error al procesar el PDF: ${err.message}` };
  }
}

// ---- Generar resumen de campos detectados / faltantes ----
function generarResumenCampos(datos) {
  const campos = [
    { key: 'salarioBruto',    label: 'Salario bruto anual',    unidad: '€' },
    { key: 'retencionActual', label: 'Retención IRPF',         unidad: '%' },
    { key: 'numPagas',        label: 'Número de pagas',        unidad: '' },
    { key: 'estadoCivil',     label: 'Estado civil',           unidad: '' },
    { key: 'ccaa',            label: 'Comunidad autónoma',     unidad: '' },
  ];

  const detectados = [];
  const faltantes = [];

  for (const campo of campos) {
    const valor = datos[campo.key];
    if (valor !== undefined && valor !== null && valor !== '') {
      let mostrar = valor;
      if (campo.key === 'salarioBruto') mostrar = `${Number(valor).toLocaleString('es-ES')} €`;
      else if (campo.key === 'retencionActual') mostrar = `${valor} %`;
      else if (campo.key === 'estadoCivil') mostrar = valor === 'casado_conjunto' ? 'Casado/a (conjunta)' : 'Soltero/a o individual';
      else if (campo.key === 'ccaa') mostrar = (typeof IRPF_2024 !== 'undefined' && IRPF_2024.tramosCCAA[valor]?.nombre) || valor;
      detectados.push({ label: campo.label, valor: mostrar });
    } else {
      faltantes.push(campo.label);
    }
  }

  return { detectados, faltantes };
}
