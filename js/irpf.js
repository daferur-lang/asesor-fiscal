'use strict';

// ============================================================
// MOTOR DE CÁLCULO IRPF 2024
// Fuentes: LIRPF, RIRPF, AEAT
// ============================================================

const IRPF_2024 = {

  // --- Cotización SS del trabajador ---
  ss: {
    contingenciasComunes: 0.047,
    desempleo: 0.0155,
    formacionProfesional: 0.001,
    total: 0.0635,
    baseMinMensual: 1323.00,
    baseMaxMensual: 4720.50,
  },

  // --- Gasto genérico deducible (art. 19 LIRPF) ---
  gastoGenerico: 2000,
  gastoMovilidad: 2000,        // adicional por movilidad geográfica
  gastoDiscapacidad: 3500,     // adicional trabajadores con discapacidad ≥33%
  gastoDiscapacidadAsist: 7750, // adicional si necesita asistencia de terceros

  // --- Reducción por obtención de RNT (art. 20 LIRPF, 2023+) ---
  reduccionRNT: {
    limiteInf: 14047.5,
    limiteSup: 19747.5,
    maximo: 6498,
    coeficiente: 1.14,
  },

  // --- Reducción por declaración conjunta ---
  reduccionConjunta: 3400,

  // --- Mínimo personal y familiar ---
  minimos: {
    personal:        5550,
    personal65:      6700,  // +1150 si ≥65
    personal75:      8100,  // +1400 si ≥75 (sobre el de 65)
    hijo1:           2400,
    hijo2:           2700,
    hijo3:           4000,
    hijo4mas:        4500,
    hijoMenor3:      2800,  // adicional por hijo <3 años
    ascendiente65:   1150,
    ascendiente75:   2550,  // sustituye al de 65
    discap33propio:  3000,
    discap65propio:  9000,
    discapAsist:     3000,  // adicional si necesita asistencia
  },

  // --- Escala estatal 2024 (art. 63 LIRPF) ---
  tramosEstatales: [
    { hasta: 12450,    tipo: 9.50 },
    { hasta: 20200,    tipo: 12.00 },
    { hasta: 35200,    tipo: 15.00 },
    { hasta: 60000,    tipo: 18.50 },
    { hasta: 300000,   tipo: 22.50 },
    { hasta: Infinity, tipo: 24.50 },
  ],

  // --- Escalas autonómicas 2024 ---
  tramosCCAA: {
    andalucia: {
      nombre: 'Andalucía',
      tramos: [
        { hasta: 12450,    tipo: 9.50 },
        { hasta: 20200,    tipo: 12.00 },
        { hasta: 35200,    tipo: 15.00 },
        { hasta: 60000,    tipo: 18.50 },
        { hasta: Infinity, tipo: 22.50 },
      ],
    },
    aragon: {
      nombre: 'Aragón',
      tramos: [
        { hasta: 12450,    tipo: 10.00 },
        { hasta: 20200,    tipo: 12.50 },
        { hasta: 34000,    tipo: 17.50 },
        { hasta: 60000,    tipo: 19.50 },
        { hasta: Infinity, tipo: 25.00 },
      ],
    },
    asturias: {
      nombre: 'Asturias',
      tramos: [
        { hasta: 12450,    tipo: 10.00 },
        { hasta: 17707,    tipo: 12.00 },
        { hasta: 33007,    tipo: 14.00 },
        { hasta: 53407,    tipo: 18.50 },
        { hasta: 70000,    tipo: 21.50 },
        { hasta: 90000,    tipo: 22.50 },
        { hasta: Infinity, tipo: 25.00 },
      ],
    },
    baleares: {
      nombre: 'Illes Balears',
      tramos: [
        { hasta: 10000,    tipo: 8.50 },
        { hasta: 18000,    tipo: 10.00 },
        { hasta: 30000,    tipo: 15.50 },
        { hasta: 48000,    tipo: 19.50 },
        { hasta: 70000,    tipo: 23.50 },
        { hasta: Infinity, tipo: 25.00 },
      ],
    },
    canarias: {
      nombre: 'Canarias',
      tramos: [
        { hasta: 12450,    tipo: 9.00 },
        { hasta: 20200,    tipo: 11.50 },
        { hasta: 35200,    tipo: 14.00 },
        { hasta: 60000,    tipo: 18.50 },
        { hasta: Infinity, tipo: 23.50 },
      ],
    },
    cantabria: {
      nombre: 'Cantabria',
      tramos: [
        { hasta: 12450,    tipo: 9.50 },
        { hasta: 20200,    tipo: 11.50 },
        { hasta: 35200,    tipo: 15.00 },
        { hasta: 60000,    tipo: 18.50 },
        { hasta: 90000,    tipo: 22.00 },
        { hasta: Infinity, tipo: 24.00 },
      ],
    },
    castillaLaMancha: {
      nombre: 'Castilla-La Mancha',
      tramos: [
        { hasta: 12450,    tipo: 9.50 },
        { hasta: 20200,    tipo: 12.00 },
        { hasta: 35200,    tipo: 15.00 },
        { hasta: 60000,    tipo: 18.50 },
        { hasta: Infinity, tipo: 22.50 },
      ],
    },
    castillaYLeon: {
      nombre: 'Castilla y León',
      tramos: [
        { hasta: 12450,    tipo: 9.50 },
        { hasta: 20200,    tipo: 12.00 },
        { hasta: 35200,    tipo: 15.00 },
        { hasta: 60000,    tipo: 18.50 },
        { hasta: Infinity, tipo: 22.50 },
      ],
    },
    cataluna: {
      nombre: 'Cataluña',
      tramos: [
        { hasta: 12450,    tipo: 10.50 },
        { hasta: 17707,    tipo: 12.50 },
        { hasta: 33007,    tipo: 15.50 },
        { hasta: 53407,    tipo: 19.00 },
        { hasta: 120000,   tipo: 24.00 },
        { hasta: 175000,   tipo: 25.00 },
        { hasta: Infinity, tipo: 25.50 },
      ],
    },
    extremadura: {
      nombre: 'Extremadura',
      tramos: [
        { hasta: 12450,    tipo: 9.50 },
        { hasta: 20200,    tipo: 12.00 },
        { hasta: 24200,    tipo: 14.00 },
        { hasta: 35200,    tipo: 16.00 },
        { hasta: 60000,    tipo: 20.00 },
        { hasta: Infinity, tipo: 25.00 },
      ],
    },
    galicia: {
      nombre: 'Galicia',
      tramos: [
        { hasta: 12450,    tipo: 9.50 },
        { hasta: 20200,    tipo: 11.50 },
        { hasta: 35200,    tipo: 15.00 },
        { hasta: 60000,    tipo: 18.50 },
        { hasta: Infinity, tipo: 22.50 },
      ],
    },
    laRioja: {
      nombre: 'La Rioja',
      tramos: [
        { hasta: 12450,    tipo: 9.50 },
        { hasta: 20200,    tipo: 11.50 },
        { hasta: 35200,    tipo: 14.00 },
        { hasta: 60000,    tipo: 18.50 },
        { hasta: Infinity, tipo: 23.00 },
      ],
    },
    madrid: {
      nombre: 'Madrid',
      tramos: [
        { hasta: 12450,    tipo: 9.50 },
        { hasta: 17707,    tipo: 11.20 },
        { hasta: 33007,    tipo: 13.30 },
        { hasta: 53407,    tipo: 17.90 },
        { hasta: Infinity, tipo: 21.00 },
      ],
    },
    murcia: {
      nombre: 'Murcia',
      tramos: [
        { hasta: 12450,    tipo: 9.50 },
        { hasta: 20200,    tipo: 11.50 },
        { hasta: 35200,    tipo: 15.00 },
        { hasta: 60000,    tipo: 18.50 },
        { hasta: Infinity, tipo: 22.50 },
      ],
    },
    navarra: {
      nombre: 'Navarra',
      foral: true, // Régimen foral: solo esta escala, sin tramos estatales
      aviso: 'Navarra tiene régimen foral propio. Este cálculo es aproximado — consulta la Hacienda Foral de Navarra.',
      tramos: [
        { hasta: 8000,     tipo: 13.00 },
        { hasta: 16000,    tipo: 23.00 },
        { hasta: 32000,    tipo: 30.00 },
        { hasta: 64000,    tipo: 38.00 },
        { hasta: 80000,    tipo: 42.00 },
        { hasta: Infinity, tipo: 48.00 },
      ],
    },
    paisVasco: {
      nombre: 'País Vasco',
      foral: true, // Régimen foral: solo esta escala (escala Bizkaia como referencia)
      aviso: 'País Vasco tiene régimen foral propio. Este cálculo es aproximado — consulta tu Hacienda Foral.',
      tramos: [
        { hasta: 16030,    tipo: 23.00 },
        { hasta: 32060,    tipo: 28.00 },
        { hasta: 48090,    tipo: 35.00 },
        { hasta: 72135,    tipo: 40.00 },
        { hasta: 144270,   tipo: 45.00 },
        { hasta: Infinity, tipo: 49.00 },
      ],
    },
    valencia: {
      nombre: 'Comunitat Valenciana',
      tramos: [
        { hasta: 12450,    tipo: 9.00 },
        { hasta: 17707,    tipo: 12.00 },
        { hasta: 33007,    tipo: 14.00 },
        { hasta: 53407,    tipo: 18.50 },
        { hasta: 120000,   tipo: 22.50 },
        { hasta: Infinity, tipo: 25.00 },
      ],
    },
  },

  // --- Deducciones estatales ---
  deducciones: {
    maternidad:              1200,  // por hijo <3 años (mujeres trabajadoras)
    familiaNumerosaGeneral:  1200,  // 3+ hijos
    familiaNumerosaEspecial: 2400,  // 5+ hijos o 4 con alguna discapacidad
    discapacidadDesc33:      1200,  // descendiente 33-65%
    discapacidadDesc65:      2400,  // descendiente >65%
    discapacidadAsc33:       1200,  // ascendiente 33-65%
    discapacidadAsc65:       2400,  // ascendiente >65%
    viviendaHabitual:        0.15,  // 15% pagos hipoteca (contratos pre-2013)
    viviendaHabitualBase:    9040.40,
  },
};

// ============================================================
// FUNCIÓN PRINCIPAL: calcular cuota por tramos
// ============================================================
function calcularCuotaPorTramos(base, tramos) {
  if (base <= 0) return 0;
  let cuota = 0;
  let prev = 0;
  for (const tramo of tramos) {
    if (base <= prev) break;
    const top = Math.min(base, tramo.hasta);
    cuota += (top - prev) * (tramo.tipo / 100);
    prev = tramo.hasta;
    if (base <= tramo.hasta) break;
  }
  return cuota;
}

// ============================================================
// FUNCIÓN PRINCIPAL: calcularIRPF(datos)
// Devuelve un objeto con todos los valores intermedios y finales
// ============================================================
function calcularIRPF(d) {
  const resultado = { pasos: {} };
  const F = IRPF_2024;
  const ccaaConf = F.tramosCCAA[d.ccaa] || F.tramosCCAA.madrid;
  const esForal = !!ccaaConf.foral;

  // ---- 1. Edad y mínimo personal ----
  const anioActual = 2024;
  const edad = anioActual - (d.anoNacimiento || 1980);
  let minimoPersonal = F.minimos.personal;
  if (edad >= 75) minimoPersonal = F.minimos.personal75;
  else if (edad >= 65) minimoPersonal = F.minimos.personal65;

  // ---- 2. Cotización SS del trabajador ----
  const baseSsMensual = d.salarioBruto / (d.numPagas || 14);
  const baseSsMensualCap = Math.min(
    Math.max(baseSsMensual, F.ss.baseMinMensual),
    F.ss.baseMaxMensual
  );
  const cotizacionSS = baseSsMensualCap * 12 * F.ss.total;
  resultado.pasos.cotizacionSS = cotizacionSS;

  // ---- 3. Gastos deducibles ----
  let gastoTotal = F.gastoGenerico;
  if (d.movilidad) gastoTotal += F.gastoMovilidad;
  if (d.discapacidadPropia === 65) gastoTotal += F.gastoDiscapacidadAsist;
  else if (d.discapacidadPropia >= 33) gastoTotal += F.gastoDiscapacidad;
  const cuotasSindicales = d.cuotasSindicales || 0;
  const gastoDefensa = Math.min(d.gastoDefensa || 0, 300);
  const gastosDeducibles = cotizacionSS + gastoTotal + cuotasSindicales + gastoDefensa;
  resultado.pasos.gastosDeducibles = gastosDeducibles;

  // ---- 4. Rendimientos netos del trabajo (RNT) ----
  let rnt = d.salarioBruto - gastosDeducibles;
  resultado.pasos.rnt = rnt;

  // ---- 5. Reducción por obtención de RNT (art. 20 LIRPF) ----
  const R = F.reduccionRNT;
  let reduccionRNT = 0;
  if (rnt <= R.limiteInf) {
    reduccionRNT = R.maximo;
  } else if (rnt <= R.limiteSup) {
    reduccionRNT = R.maximo - R.coeficiente * (rnt - R.limiteInf);
  }
  reduccionRNT = Math.max(0, reduccionRNT);
  resultado.pasos.reduccionRNT = reduccionRNT;

  // ---- 6. Rendimientos netos reducidos ----
  let rntReducidos = Math.max(0, rnt - reduccionRNT);

  // ---- 7. Reducción declaración conjunta ----
  if (d.estadoCivil === 'casado_conjunto') {
    rntReducidos = Math.max(0, rntReducidos - F.reduccionConjunta);
  }
  resultado.pasos.rntReducidos = rntReducidos;

  // ---- 8. Plan de pensiones (reducción base imponible) ----
  const limitePP = Math.min(1500, rnt * 0.30); // límite individual 2024
  const deduccionPP = Math.min(d.planPensiones || 0, limitePP);
  resultado.pasos.deduccionPP = deduccionPP;

  // ---- 9. Base liquidable general ----
  const baseLiquidable = Math.max(0, rntReducidos - deduccionPP);
  resultado.pasos.baseLiquidable = baseLiquidable;

  // ---- 10. Mínimo por descendientes (hijos) ----
  const hijos = d.hijos || [];
  let minimoDescendientes = 0;
  const hijosOrdenados = [...hijos].sort((a, b) => a - b); // de menor a mayor edad
  hijosOrdenados.forEach((edad, i) => {
    if (edad >= 25 && d.discapacidadDescendientes?.[i] == null) return; // >25 solo si discapacitado
    const importeOrden = [F.minimos.hijo1, F.minimos.hijo2, F.minimos.hijo3, F.minimos.hijo4mas];
    minimoDescendientes += importeOrden[Math.min(i, 3)];
    if (edad < 3) minimoDescendientes += F.minimos.hijoMenor3;
  });

  // ---- 11. Mínimo por ascendientes ----
  let minimoAscendientes = 0;
  for (let j = 0; j < (d.ascendientes65 || 0); j++) minimoAscendientes += F.minimos.ascendiente65;
  for (let j = 0; j < (d.ascendientes75 || 0); j++) {
    minimoAscendientes -= F.minimos.ascendiente65; // resta el de 65 ya sumado
    minimoAscendientes += F.minimos.ascendiente75;
  }

  // ---- 12. Mínimo discapacidad propia ----
  let minimoDiscapacidadPropia = 0;
  if (d.discapacidadPropia >= 65) {
    minimoDiscapacidadPropia = F.minimos.discap65propio + F.minimos.discapAsist;
  } else if (d.discapacidadPropia >= 33) {
    minimoDiscapacidadPropia = F.minimos.discap33propio;
  }

  // ---- 13. Mínimo total ----
  const minimoTotal = minimoPersonal + minimoDescendientes + minimoAscendientes + minimoDiscapacidadPropia;
  resultado.pasos.minimoTotal = minimoTotal;

  // ---- 14. Cuota íntegra ----
  let cuotaIntegra = 0;
  if (esForal) {
    // Para PV y Navarra: solo escala foral (no escala estatal)
    cuotaIntegra = Math.max(0,
      calcularCuotaPorTramos(baseLiquidable, ccaaConf.tramos) -
      calcularCuotaPorTramos(minimoTotal, ccaaConf.tramos)
    );
  } else {
    const cuotaEstatal = Math.max(0,
      calcularCuotaPorTramos(baseLiquidable, F.tramosEstatales) -
      calcularCuotaPorTramos(minimoTotal, F.tramosEstatales)
    );
    const cuotaCCAA = Math.max(0,
      calcularCuotaPorTramos(baseLiquidable, ccaaConf.tramos) -
      calcularCuotaPorTramos(minimoTotal, ccaaConf.tramos)
    );
    cuotaIntegra = cuotaEstatal + cuotaCCAA;
    resultado.pasos.cuotaEstatal = cuotaEstatal;
    resultado.pasos.cuotaCCAA = cuotaCCAA;
  }
  resultado.pasos.cuotaIntegra = cuotaIntegra;

  // ---- 15. Deducciones de la cuota ----
  const D = F.deducciones;
  let deduccionesCuota = 0;

  // Maternidad
  const hijosMenores3 = hijos.filter(e => e < 3).length;
  if (d.esMadre && hijosMenores3 > 0) {
    deduccionesCuota += D.maternidad * hijosMenores3;
  }

  // Familia numerosa
  if (d.familiaNumerosaEspecial) deduccionesCuota += D.familiaNumerosaEspecial;
  else if (d.familiaNumerosa) deduccionesCuota += D.familiaNumerosaGeneral;

  // Discapacidad descendientes
  deduccionesCuota += (d.descDiscap33 || 0) * D.discapacidadDesc33;
  deduccionesCuota += (d.descDiscap65 || 0) * D.discapacidadDesc65;

  // Discapacidad ascendientes
  deduccionesCuota += (d.ascDiscap33 || 0) * D.discapacidadAsc33;
  deduccionesCuota += (d.ascDiscap65 || 0) * D.discapacidadAsc65;

  // Vivienda habitual (contratos hipoteca anteriores a 2013)
  if (d.viviendaAnterior2013 && d.pagosHipoteca > 0) {
    const baseViv = Math.min(d.pagosHipoteca, D.viviendaHabitualBase);
    deduccionesCuota += baseViv * D.viviendaHabitual;
  }

  resultado.pasos.deduccionesCuota = deduccionesCuota;

  // ---- 16. Cuota líquida ----
  const cuotaLiquida = Math.max(0, cuotaIntegra - deduccionesCuota);
  resultado.pasos.cuotaLiquida = cuotaLiquida;

  // ---- 17. Retención teórica y comparativa ----
  const retencionTeorica = cuotaLiquida;
  const tipoTeoricoPorc = (retencionTeorica / d.salarioBruto) * 100;
  const retencionPagada = d.salarioBruto * ((d.retencionActual || 0) / 100);
  const diferencia = retencionPagada - retencionTeorica;
  const tipoEfectivo = (cuotaLiquida / d.salarioBruto) * 100;

  resultado.retencionTeorica = retencionTeorica;
  resultado.tipoTeoricoPorc = tipoTeoricoPorc;
  resultado.retencionPagada = retencionPagada;
  resultado.diferencia = diferencia;   // >0 → pagando de más; <0 → pagando de menos
  resultado.tipoEfectivo = tipoEfectivo;
  resultado.salarioBruto = d.salarioBruto;
  resultado.avisoForal = ccaaConf.aviso || null;
  resultado.hijosTotal = hijos.length;
  resultado.edad = edad;

  return resultado;
}

// ============================================================
// FUNCIÓN: obtener consejos personalizados
// ============================================================
function obtenerConsejos(d, res) {
  const consejos = [];
  const F = IRPF_2024;

  // Plan de pensiones
  const limitePP = Math.min(1500, (d.salarioBruto - res.pasos.cotizacionSS) * 0.30);
  const aporteActual = d.planPensiones || 0;
  if (aporteActual < limitePP - 100) {
    const margen = Math.round(limitePP - aporteActual);
    const ahorro = Math.round(margen * (res.tipoTeoricoPorc / 100));
    consejos.push({
      tipo: 'ahorro',
      titulo: 'Plan de pensiones infrautilizado',
      texto: `Podrías aportar ${margen.toLocaleString('es')} € más al año a tu plan de pensiones y ahorrar aprox. ${ahorro.toLocaleString('es')} € de IRPF.`,
    });
  }

  // Solicitar comunicación de datos a AEAT
  if (Math.abs(res.diferencia) > 200) {
    consejos.push({
      tipo: 'gestion',
      titulo: 'Comunica tus datos personales a AEAT',
      texto: 'Puedes solicitar a AEAT (Modelo 145) que tu empresa aplique la retención exacta según tu situación familiar, evitando sorpresas en la declaración.',
    });
  }

  // Deducción por vivienda habitual
  if (!d.viviendaAnterior2013 && (2024 - (d.anoNacimiento || 1990)) < 45) {
    consejos.push({
      tipo: 'info',
      titulo: 'Hipoteca anterior a 2013',
      texto: 'Si tienes hipoteca de vivienda habitual firmada antes del 01/01/2013, puedes deducirte el 15% de los pagos (máx. 9.040,40 €/año). Revisa si aplica a tu caso.',
    });
  }

  // Familia numerosa
  if ((d.hijos || []).length >= 3 && !d.familiaNumerosa) {
    consejos.push({
      tipo: 'ahorro',
      titulo: '¿Eres familia numerosa?',
      texto: `Con ${(d.hijos || []).length} hijos podrías ser familia numerosa y beneficiarte de una deducción de 1.200 €/año. Consulta los requisitos en el IMSERSO.`,
    });
  }

  // Maternidad
  const hijosMenores3 = (d.hijos || []).filter(e => e < 3).length;
  if (hijosMenores3 > 0 && !d.esMadre) {
    consejos.push({
      tipo: 'info',
      titulo: 'Deducción por maternidad',
      texto: `Si eres mujer y tienes hijos menores de 3 años y trabajas, tienes derecho a 1.200 €/año por hijo. Puedes cobrarla anticipadamente (100 €/mes) en AEAT.`,
    });
  }

  // Discapacidad
  if (d.discapacidadPropia >= 33) {
    consejos.push({
      tipo: 'info',
      titulo: 'Gastos extra por discapacidad',
      texto: 'Como trabajador con discapacidad ≥33%, tienes un gasto deducible adicional de 3.500 €/año sobre tus rendimientos del trabajo.',
    });
  }

  // Si paga mucho de más
  if (res.diferencia > 500) {
    consejos.push({
      tipo: 'positivo',
      titulo: 'Posible devolución de la Renta',
      texto: `Al declarar la renta (normalmente abril-junio del año siguiente), Hacienda te devolvería aproximadamente ${Math.round(res.diferencia).toLocaleString('es')} €.`,
    });
  }

  // Si paga de menos
  if (res.diferencia < -300) {
    consejos.push({
      tipo: 'alerta',
      titulo: 'Posible pago a Hacienda',
      texto: 'Tu retención actual puede ser insuficiente. Habla con tu empresa para subirla y evitar pagar de golpe al hacer la declaración de la renta.',
    });
  }

  return consejos;
}
