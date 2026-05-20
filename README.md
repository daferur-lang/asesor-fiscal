# AsesorFiscal — Revisa tu IRPF 2024

PWA instalable (Android/iOS) que analiza si un trabajador español por cuenta ajena está pagando más IRPF del que le corresponde.

## Características

- Calculadora IRPF 2024 con tramos estatales y autonómicos (17 comunidades + régimen foral)
- Detecta deducciones no aplicadas (plan de pensiones, maternidad, familia numerosa, vivienda, discapacidad)
- Comparativa retención actual vs. retención teórica óptima
- Consejos personalizados según el perfil del usuario
- 100% cliente (sin servidor), datos guardados localmente
- Instalable como app en Android e iOS

## Uso local

Abre `index.html` en el navegador. Para que el service worker funcione correctamente necesitas servirlo con un servidor HTTP:

```bash
npx serve .
# o
python -m http.server 8080
```

## Generar iconos PNG (necesario para iOS)

1. Abre `icons/generar-iconos.html` en el navegador
2. Pulsa "Descargar icon-192.png" y "Descargar icon-512.png"
3. Mueve los archivos descargados a la carpeta `icons/`

## Subir a GitHub Pages

```bash
git init
git add .
git commit -m "feat: AsesorFiscal PWA v1.0"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/asesor-fiscal.git
git push -u origin main
```

Luego en GitHub → Settings → Pages → Source: **Deploy from branch** → rama `main` → carpeta `/root`.

La app quedará disponible en: `https://TU_USUARIO.github.io/asesor-fiscal/`

## Aviso legal

Los cálculos son estimaciones orientativas basadas en la normativa IRPF 2024. No sustituyen el asesoramiento de un profesional fiscal habilitado.
