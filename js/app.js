'use strict';

// ============================================================
// CONTROLADOR PRINCIPAL DE LA APP
// ============================================================

const STORAGE_KEY = 'asesor-fiscal-datos';

const App = {
  paso: 0,
  totalPasos: 4,
  datos: {},
  datosPDFExtraidos: null,
  ultimoResultado: null,

  init() {
    this.datos = this.cargarDatos();
    this.registrarSW();
    this.configurarInstall();
    this.renderPasoActual();
    this.bindEvents();
  },

  // ---- Persistencia ----
  guardarDatos() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.datos));
  },
  cargarDatos() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  },

  // ---- Navegación ----
  irAPaso(n) {
    const anterior = document.getElementById(`screen-${this.paso}`);
    if (anterior) anterior.classList.remove('active', 'salida-izq', 'salida-der');

    const dir = n > this.paso ? 'izq' : 'der';
    this.paso = n;

    const actual = document.getElementById(`screen-${this.paso}`);
    if (actual) {
      actual.classList.remove('salida-izq', 'salida-der');
      actual.classList.add('active', `entrada-${dir}`);
      // Quitar clase de animación después
      setTimeout(() => actual.classList.remove(`entrada-${dir}`), 350);
    }

    this.actualizarProgreso();
    this.actualizarBotones();
    window.scrollTo(0, 0);
  },

  siguiente() {
    if (!this.validarPaso(this.paso)) return;
    this.recopilarPaso(this.paso);
    this.guardarDatos();

    if (this.paso === this.totalPasos) {
      this.calcularYMostrar();
      this.irAPaso(5); // pantalla resultado
    } else {
      this.irAPaso(this.paso + 1);
    }
  },

  anterior() {
    if (this.paso > 0) this.irAPaso(this.paso - 1);
  },

  // ---- Progreso ----
  actualizarProgreso() {
    const barra = document.getElementById('progress-bar');
    const fill = document.getElementById('progress-fill');
    const label = document.getElementById('step-label');
    const btnBack = document.getElementById('btn-back');

    if (this.paso === 0 || this.paso === 5) {
      if (barra) barra.style.display = 'none';
      if (btnBack) btnBack.style.display = 'none';
    } else {
      if (barra) barra.style.display = 'block';
      if (fill) fill.style.width = `${(this.paso / this.totalPasos) * 100}%`;
      if (label) label.textContent = `Paso ${this.paso} de ${this.totalPasos}`;
      if (btnBack) btnBack.style.display = 'flex';
    }
  },

  actualizarBotones() {
    // Nothing needed — buttons are per-screen in HTML
  },

  // ---- Validación ----
  validarPaso(n) {
    const errores = [];

    if (n === 1) {
      const ano = parseInt(document.getElementById('anoNacimiento')?.value);
      if (!ano || ano < 1924 || ano > 2006) errores.push('Introduce un año de nacimiento válido (entre 1924 y 2006).');
      if (!document.getElementById('ccaa')?.value) errores.push('Selecciona tu comunidad autónoma.');
    }

    if (n === 2) {
      const bruto = parseFloat(document.getElementById('salarioBruto')?.value);
      if (!bruto || bruto < 500 || bruto > 1000000) errores.push('Introduce un salario bruto anual válido.');
      const retencion = parseFloat(document.getElementById('retencionActual')?.value);
      if (isNaN(retencion) || retencion < 0 || retencion > 50) errores.push('La retención debe estar entre 0 y 50 %.');
    }

    if (errores.length > 0) {
      this.mostrarError(errores[0]);
      return false;
    }
    this.limpiarError();
    return true;
  },

  mostrarError(msg) {
    let el = document.getElementById('error-msg');
    if (!el) {
      el = document.createElement('div');
      el.id = 'error-msg';
      el.className = 'error-msg';
      document.getElementById(`screen-${this.paso}`)?.querySelector('.screen-container')?.prepend(el);
    }
    el.textContent = msg;
    el.style.display = 'block';
  },

  limpiarError() {
    const el = document.getElementById('error-msg');
    if (el) el.style.display = 'none';
  },

  // ---- Recopilar datos por paso ----
  recopilarPaso(n) {
    const get = id => document.getElementById(id);
    const val = id => get(id)?.value;
    const num = id => parseFloat(val(id)) || 0;
    const check = id => get(id)?.checked || false;
    const radio = name => document.querySelector(`input[name="${name}"]:checked`)?.value;

    if (n === 1) {
      this.datos.anoNacimiento = parseInt(val('anoNacimiento'));
      this.datos.estadoCivil = radio('estadoCivil') || 'soltero';
      this.datos.ccaa = val('ccaa') || 'madrid';
    }

    if (n === 2) {
      this.datos.salarioBruto = num('salarioBruto');
      this.datos.numPagas = parseInt(val('numPagas')) || 14;
      this.datos.retencionActual = num('retencionActual');
    }

    if (n === 3) {
      // Hijos
      const numHijos = parseInt(val('numHijos')) || 0;
      this.datos.hijos = [];
      for (let i = 0; i < numHijos; i++) {
        const edadHijo = parseInt(val(`hijo-edad-${i}`)) || 10;
        this.datos.hijos.push(edadHijo);
      }
      this.datos.ascendientes65 = parseInt(val('ascendientes65')) || 0;
      this.datos.ascendientes75 = parseInt(val('ascendientes75')) || 0;
      this.datos.discapacidadPropia = parseInt(radio('discapPropia') || '0');
      this.datos.esMadre = check('esMadre');
      this.datos.familiaNumerosa = check('familiaNumerosa');
      this.datos.familiaNumerosaEspecial = check('familiaNumerosaEspecial');
      this.datos.descDiscap33 = parseInt(val('descDiscap33')) || 0;
      this.datos.descDiscap65 = parseInt(val('descDiscap65')) || 0;
      this.datos.ascDiscap33 = parseInt(val('ascDiscap33')) || 0;
      this.datos.ascDiscap65 = parseInt(val('ascDiscap65')) || 0;
    }

    if (n === 4) {
      this.datos.planPensiones = num('planPensiones');
      this.datos.cuotasSindicales = num('cuotasSindicales');
      this.datos.movilidad = check('movilidad');
      this.datos.viviendaAnterior2013 = check('viviendaAnterior2013');
      this.datos.pagosHipoteca = num('pagosHipoteca');
      this.datos.gastoDefensa = num('gastoDefensa');
    }
  },

  // ---- Cálculo y resultado ----
  calcularYMostrar() {
    const res = calcularIRPF(this.datos);
    this.ultimoResultado = res;
    const consejos = obtenerConsejos(this.datos, res);
    this.renderResultado(res, consejos);
  },

  renderResultado(res, consejos) {
    const fmt = n => Math.abs(Math.round(n)).toLocaleString('es-ES');
    const fmtPorc = n => Math.abs(n).toFixed(1).replace('.', ',');

    const pagaMas = res.diferencia > 0;
    const diferencia = Math.round(Math.abs(res.diferencia));
    const umbralNeutro = res.salarioBruto * 0.003; // <0.3% diferencia = en orden

    // Banner principal
    const banner = document.getElementById('resultado-banner');
    if (banner) {
      if (Math.abs(res.diferencia) < umbralNeutro) {
        banner.className = 'resultado-banner neutro';
        banner.innerHTML = `
          <div class="banner-icon">✓</div>
          <div class="banner-texto">
            <div class="banner-titulo">Tu retención está en orden</div>
            <div class="banner-subtitulo">La diferencia es inferior a ${fmt(umbralNeutro)} €</div>
          </div>`;
      } else if (pagaMas) {
        banner.className = 'resultado-banner positivo';
        banner.innerHTML = `
          <div class="banner-icon">💰</div>
          <div class="banner-texto">
            <div class="banner-titulo">Estás pagando de más</div>
            <div class="banner-subtitulo">Posible devolución de <strong>${fmt(diferencia)} €</strong></div>
          </div>`;
      } else {
        banner.className = 'resultado-banner negativo';
        banner.innerHTML = `
          <div class="banner-icon">⚠️</div>
          <div class="banner-texto">
            <div class="banner-titulo">Atención: pagando de menos</div>
            <div class="banner-subtitulo">Posible deuda con Hacienda de <strong>${fmt(diferencia)} €</strong></div>
          </div>`;
      }
    }

    // Desglose
    const desglose = document.getElementById('resultado-desglose');
    if (desglose) {
      desglose.innerHTML = `
        <h3 class="card-titulo">Desglose del IRPF</h3>
        <div class="desglose-tabla">
          <div class="desglose-fila">
            <span>Salario bruto anual</span>
            <strong>${fmt(res.salarioBruto)} €</strong>
          </div>
          <div class="desglose-fila sub">
            <span>Base liquidable estimada</span>
            <span>${fmt(res.pasos.baseLiquidable)} €</span>
          </div>
          <div class="desglose-fila sub">
            <span>Mínimo personal y familiar</span>
            <span>${fmt(res.pasos.minimoTotal)} €</span>
          </div>
          <div class="desglose-separador"></div>
          <div class="desglose-fila">
            <span>IRPF que deberías pagar</span>
            <strong class="color-neutral">${fmt(res.retencionTeorica)} €
              <em>(${fmtPorc(res.tipoTeoricoPorc)} %)</em>
            </strong>
          </div>
          <div class="desglose-fila">
            <span>Retención actual en nómina</span>
            <strong>${fmt(res.retencionPagada)} €
              <em>(${fmtPorc(res.retencionPagada / res.salarioBruto * 100)} %)</em>
            </strong>
          </div>
          <div class="desglose-separador"></div>
          <div class="desglose-fila total ${pagaMas ? 'positivo' : (Math.abs(res.diferencia) < umbralNeutro ? 'neutro' : 'negativo')}">
            <span>${pagaMas ? 'Pagas de más (devolución estimada)' : (Math.abs(res.diferencia) < umbralNeutro ? 'Retención correcta' : 'Pagas de menos (deuda estimada)')}</span>
            <strong>${pagaMas ? '+' : (Math.abs(res.diferencia) < umbralNeutro ? '≈' : '-')}${fmt(diferencia)} €</strong>
          </div>
        </div>`;
    }

    // Tipo efectivo
    const tipoEl = document.getElementById('resultado-tipo');
    if (tipoEl) {
      tipoEl.innerHTML = `
        <h3 class="card-titulo">Tipo efectivo estimado</h3>
        <div class="tipo-ring-wrap">
          <div class="tipo-ring">
            <svg viewBox="0 0 100 100" class="ring-svg">
              <circle cx="50" cy="50" r="40" class="ring-bg"/>
              <circle cx="50" cy="50" r="40" class="ring-fill"
                stroke-dasharray="${Math.min(res.tipoEfectivo, 50) * 2.51} 251"
                stroke-dashoffset="62.8"/>
            </svg>
            <div class="tipo-valor">${fmtPorc(res.tipoEfectivo)}<span>%</span></div>
          </div>
          <div class="tipo-leyenda">Tipo efectivo IRPF sobre bruto</div>
        </div>`;
    }

    // Consejos
    const consejosEl = document.getElementById('resultado-consejos');
    if (consejosEl && consejos.length > 0) {
      const iconos = { ahorro: '💡', gestion: '📋', info: 'ℹ️', positivo: '✅', alerta: '⚠️' };
      consejosEl.innerHTML = `
        <h3 class="card-titulo">Recomendaciones para ti</h3>
        ${consejos.map(c => `
          <div class="consejo-item consejo-${c.tipo}">
            <span class="consejo-icono">${iconos[c.tipo] || '•'}</span>
            <div>
              <div class="consejo-titulo">${c.titulo}</div>
              <div class="consejo-texto">${c.texto}</div>
            </div>
          </div>`).join('')}`;
    } else if (consejosEl) {
      consejosEl.innerHTML = '';
    }

    // Aviso foral
    const avisoEl = document.getElementById('aviso-foral');
    if (avisoEl) {
      if (res.avisoForal) {
        avisoEl.textContent = `⚠️ ${res.avisoForal}`;
        avisoEl.style.display = 'block';
      } else {
        avisoEl.style.display = 'none';
      }
    }
  },

  // ---- Eventos ----
  bindEvents() {
    // Botón inicio
    document.getElementById('btn-start')?.addEventListener('click', () => this.irAPaso(1));

    // Botón volver
    document.getElementById('btn-back')?.addEventListener('click', () => this.anterior());

    // Botones "Continuar" de cada paso
    for (let i = 1; i <= this.totalPasos; i++) {
      document.getElementById(`btn-next-${i}`)?.addEventListener('click', () => this.siguiente());
    }

    // Nuevo análisis
    document.getElementById('btn-nuevo')?.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY);
      this.datos = {};
      this.irAPaso(0);
    });

    // Imprimir resultado
    document.getElementById('btn-imprimir')?.addEventListener('click', () => window.print());

    // Hijos: mostrar campos de edad dinámicamente
    document.getElementById('numHijos')?.addEventListener('change', e => {
      this.renderCamposHijos(parseInt(e.target.value) || 0);
    });

    // Vivienda: mostrar campo importe hipoteca
    document.getElementById('viviendaAnterior2013')?.addEventListener('change', e => {
      const campo = document.getElementById('campo-hipoteca');
      if (campo) campo.style.display = e.target.checked ? 'block' : 'none';
    });

    // Familia numerosa especial
    document.getElementById('familiaNumerosa')?.addEventListener('change', e => {
      const extra = document.getElementById('campo-fn-especial');
      if (extra) extra.style.display = e.target.checked ? 'block' : 'none';
    });

    // Poblar con datos guardados si existen
    this.poblarFormularios();

    // PDF: activar input al pulsar botón label
    document.getElementById('pdf-input')?.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (file) this.manejarArchivoPDF(file);
    });

    // PDF overlay: botones de acción
    document.getElementById('btn-pdf-aplicar')?.addEventListener('click', () => this.aplicarDatosPDF());
    document.getElementById('btn-pdf-cancelar')?.addEventListener('click', () => {
      this.cerrarOverlay();
      this.irAPaso(1);
    });
    document.getElementById('btn-pdf-cerrar-error')?.addEventListener('click', () => {
      this.cerrarOverlay();
      this.irAPaso(1);
    });

    // Comparativa CCAA
    document.getElementById('btn-comparativa')?.addEventListener('click', () => this.renderComparativaCCAA());
  },

  renderCamposHijos(n) {
    const contenedor = document.getElementById('hijos-edades');
    if (!contenedor) return;
    if (n === 0) { contenedor.innerHTML = ''; return; }

    let html = '<div class="hijos-edades-grid">';
    for (let i = 0; i < Math.min(n, 8); i++) {
      const edadGuardada = (this.datos.hijos || [])[i] || '';
      html += `
        <div class="form-group-small">
          <label>Hijo ${i + 1}: edad</label>
          <input type="number" id="hijo-edad-${i}" min="0" max="30"
            placeholder="años" value="${edadGuardada}" class="input-small">
        </div>`;
    }
    html += '</div>';
    contenedor.innerHTML = html;
  },

  poblarFormularios() {
    const d = this.datos;
    if (!d || !d.anoNacimiento) return;

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined) el.value = val;
    };
    const setCheck = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.checked = !!val;
    };
    const setRadio = (name, val) => {
      const el = document.querySelector(`input[name="${name}"][value="${val}"]`);
      if (el) el.checked = true;
    };

    set('anoNacimiento', d.anoNacimiento);
    set('ccaa', d.ccaa);
    if (d.estadoCivil) setRadio('estadoCivil', d.estadoCivil);
    set('salarioBruto', d.salarioBruto);
    set('numPagas', d.numPagas);
    set('retencionActual', d.retencionActual);
    set('numHijos', d.hijos?.length || 0);
    if (d.hijos?.length) this.renderCamposHijos(d.hijos.length);
    set('ascendientes65', d.ascendientes65);
    set('ascendientes75', d.ascendientes75);
    if (d.discapacidadPropia != null) setRadio('discapPropia', String(d.discapacidadPropia));
    setCheck('esMadre', d.esMadre);
    setCheck('familiaNumerosa', d.familiaNumerosa);
    setCheck('familiaNumerosaEspecial', d.familiaNumerosaEspecial);
    set('descDiscap33', d.descDiscap33);
    set('descDiscap65', d.descDiscap65);
    set('ascDiscap33', d.ascDiscap33);
    set('ascDiscap65', d.ascDiscap65);
    set('planPensiones', d.planPensiones);
    set('cuotasSindicales', d.cuotasSindicales);
    setCheck('movilidad', d.movilidad);
    setCheck('viviendaAnterior2013', d.viviendaAnterior2013);
    set('pagosHipoteca', d.pagosHipoteca);

    if (d.viviendaAnterior2013) {
      const campo = document.getElementById('campo-hipoteca');
      if (campo) campo.style.display = 'block';
    }
    if (d.familiaNumerosa) {
      const extra = document.getElementById('campo-fn-especial');
      if (extra) extra.style.display = 'block';
    }
  },

  // ============================================================
  // LECTOR DE PDF
  // ============================================================

  manejarArchivoPDF(file) {
    this.mostrarOverlay('cargando');
    procesarPDF(file)
      .then(datos => {
        if (datos._error) { this.mostrarOverlay('error', datos._error); return; }
        this.datosPDFExtraidos = datos;
        this.mostrarOverlay('resultado', datos);
      })
      .catch(err => this.mostrarOverlay('error', err.message || 'Error inesperado al procesar el PDF.'));
  },

  mostrarOverlay(estado, datos) {
    const overlay = document.getElementById('pdf-overlay');
    if (!overlay) return;
    ['cargando', 'error', 'resultado'].forEach(s => {
      const el = document.getElementById(`pdf-estado-${s}`);
      if (el) el.style.display = s === estado ? 'flex' : 'none';
    });
    if (estado === 'error') {
      const msg = document.getElementById('pdf-error-msg');
      if (msg) msg.textContent = typeof datos === 'string' ? datos : 'Error al leer el PDF.';
    }
    if (estado === 'resultado' && datos) {
      const { detectados, faltantes } = generarResumenCampos(datos);
      const tipoLabel = document.getElementById('pdf-tipo-label');
      if (tipoLabel) tipoLabel.textContent = datos._tipo === 'declaracion' ? '📄 Declaración de la Renta (Modelo 100)' : '📋 Nómina';
      const adv = document.getElementById('pdf-advertencia');
      if (adv) { adv.textContent = datos._advertencia || ''; adv.style.display = datos._advertencia ? 'block' : 'none'; }
      const listaEnc = document.getElementById('pdf-lista-encontrados');
      if (listaEnc) listaEnc.innerHTML = detectados.length > 0
        ? detectados.map(d => `<li><strong>${d.label}:</strong> ${d.valor}</li>`).join('')
        : '<li class="vacio">No se encontraron datos automáticamente</li>';
      const listaFal = document.getElementById('pdf-lista-faltantes');
      if (listaFal) listaFal.innerHTML = faltantes.length > 0
        ? faltantes.map(f => `<li>${f}</li>`).join('')
        : '<li class="ok">Todo detectado ✓</li>';
    }
    overlay.style.display = 'flex';
  },

  cerrarOverlay() {
    const overlay = document.getElementById('pdf-overlay');
    if (overlay) overlay.style.display = 'none';
    const input = document.getElementById('pdf-input');
    if (input) input.value = '';
  },

  aplicarDatosPDF() {
    const d = this.datosPDFExtraidos;
    if (!d) { this.cerrarOverlay(); this.irAPaso(1); return; }
    if (d.salarioBruto)      this.datos.salarioBruto    = d.salarioBruto;
    if (d.retencionActual != null) this.datos.retencionActual = d.retencionActual;
    if (d.numPagas)          this.datos.numPagas         = d.numPagas;
    if (d.estadoCivil)       this.datos.estadoCivil      = d.estadoCivil;
    if (d.ccaa)              this.datos.ccaa             = d.ccaa;
    if (d.anoNacimiento)     this.datos.anoNacimiento    = d.anoNacimiento;
    this.guardarDatos();
    this.cerrarOverlay();
    this.poblarFormularios();
    this.irAPaso(1);
  },

  // ============================================================
  // COMPARATIVA ENTRE CCAA
  // ============================================================

  renderComparativaCCAA() {
    if (!this.ultimoResultado || !this.datos?.salarioBruto) return;

    const ccaas       = Object.keys(IRPF_2024.tramosCCAA);
    const ccaaActual  = this.datos.ccaa || 'madrid';
    const cuotaActual = this.ultimoResultado.pasos.cuotaLiquida;

    const fmt     = n => Math.round(n).toLocaleString('es-ES');
    const fmtPct  = n => Math.abs(n).toFixed(1).replace('.', ',');
    const fmtDif  = (n, esActual) => {
      if (esActual) return '—';
      const r = Math.round(n);
      if (Math.abs(r) < 5) return '≈ igual';
      return (r > 0 ? '+' : '') + r.toLocaleString('es-ES') + ' €';
    };

    // Calcular todas las CCAA
    const filas = ccaas.map(key => {
      const res = calcularIRPF({ ...this.datos, ccaa: key });
      return {
        key,
        nombre: IRPF_2024.tramosCCAA[key].nombre,
        cuota:  res.pasos.cuotaLiquida,
        tipo:   res.tipoEfectivo,
        dif:    res.pasos.cuotaLiquida - cuotaActual,
        foral:  !!IRPF_2024.tramosCCAA[key].foral,
      };
    }).sort((a, b) => a.cuota - b.cuota);

    const minCuota = filas[0].cuota;
    const maxCuota = filas[filas.length - 1].cuota;

    const rows = filas.map(r => {
      const esActual = r.key === ccaaActual;
      const esMin    = !esActual && Math.abs(r.cuota - minCuota) < 1;
      const esMax    = !esActual && Math.abs(r.cuota - maxCuota) < 1;
      const claseFila = esActual ? 'comp-actual' : (esMin ? 'comp-min' : (esMax ? 'comp-max' : ''));
      const claseDif  = esActual ? '' : (r.dif < -50 ? 'dif-ahorro' : r.dif > 50 ? 'dif-mas' : 'dif-neutral');
      return `
        <tr class="comp-fila ${claseFila}">
          <td class="comp-nombre">
            ${r.nombre}
            ${esActual ? '<span class="comp-badge actual">Tu CCAA</span>' : ''}
            ${esMin    ? '<span class="comp-badge min">Más barata</span>' : ''}
            ${esMax    ? '<span class="comp-badge max">Más cara</span>' : ''}
            ${r.foral  ? '<span class="comp-foral">*</span>' : ''}
          </td>
          <td>${fmt(r.cuota)} €</td>
          <td>${fmtPct(r.tipo)} %</td>
          <td class="${claseDif}">${fmtDif(r.dif, esActual)}</td>
        </tr>`;
    }).join('');

    const html = `
      <div class="comp-tabla-wrap">
        <table class="comp-tabla">
          <thead>
            <tr><th>Comunidad</th><th>Cuota IRPF</th><th>Tipo ef.</th><th>vs tu CCAA</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="comp-nota">* Navarra y País Vasco tienen régimen foral propio; cálculo aproximado.</p>
      </div>`;

    const el  = document.getElementById('comparativa-resultado');
    const btn = document.getElementById('btn-comparativa');
    if (el)  { el.innerHTML = html; el.style.display = 'block'; }
    if (btn) btn.style.display = 'none';
  },

  // ---- PWA ----
  registrarSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  },

  configurarInstall() {
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredPrompt = e;
      const btn = document.getElementById('btn-instalar');
      if (btn) {
        btn.style.display = 'flex';
        btn.addEventListener('click', () => {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then(() => { btn.style.display = 'none'; });
        });
      }
    });
  },

  renderPasoActual() {
    const actual = document.getElementById(`screen-${this.paso}`);
    if (actual) actual.classList.add('active');
    this.actualizarProgreso();
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
