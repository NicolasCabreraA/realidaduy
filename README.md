# 🇺🇾 realidad.uy

**Entendé Uruguay, territorio por territorio.** Plataforma ciudadana e independiente que
convierte datos públicos de Uruguay en mapas, indicadores y comparaciones — siempre con
fuente, período y metodología a la vista.

> Estado: **MVP en desarrollo**. Cada observación registra internamente (campo `demo`)
> si ya fue cotejada a mano contra el boletín oficial. Una tarea programada revisa cada
> mes (día 5) si hay datos nuevos del INE/BCU y actualiza el repo. **Nunca se inventan datos.**

## Deploy y actualización automática

- **Deploy:** conectar este repo en [vercel.com/new](https://vercel.com/new) (framework: Next.js,
  sin configuración extra). Cada push a `main` redeploya solo.
- **Datos:** el workflow [`actualizar-datos.yml`](.github/workflows/actualizar-datos.yml)
  corre el día 5 de cada mes: ingesta INE (IPC, ECH e IMS, desde los informes
  técnicos; esperanza de vida y desempleo por departamento) + Banco Mundial + PBI anual de PRISMA (ANII) + PIB trimestral y cotizaciones
  (dólar, real, euro y peso argentino) del BCU + seguridad (M. Interior) + elecciones (Corte Electoral, con verificación automática contra
  el escrutinio), valida, compila y commitea — lo que dispara el redeploy. También se puede
  lanzar a mano desde la pestaña Actions ("Run workflow").
- **Lo que no tiene script** (pobreza, salario mínimo, datos departamentales): lo revisa la
  tarea programada local de Claude (día 5, 10:00).

## Comandos

```bash
npm run dev            # servidor de desarrollo
npm run build          # build de producción (41 páginas estáticas)
npm run start          # servir el build
npm run fetch:geo      # ingesta de geometrías (IDE + cartografía censal INE)
npm run fetch:mensual  # ingesta mensual: INE, Banco Mundial, PRISMA, BCU (PIB y cotizaciones), seguridad, elecciones y educación
npm run fetch:mec      # matrícula por carrera y departamento (Anuario Estadístico de Educación del MEC)
npm run fetch:udelar   # de dónde vienen y dónde cursan los estudiantes de la UdelaR (microdatos FormA)
npm run validate:data  # validación de datos (integridad, sumas, outliers)
```

## Stack

Next.js 15 (App Router, SSG) · TypeScript · Tailwind CSS v4 · Recharts · d3-geo (SVG
choropleth accesible). Sin backend: los datos viven tipados en `src/data/` con provenance
completo por observación (fuente, período, estado, URL, notas metodológicas).

## Documentación

La revisión de seguridad está en [`docs/security-review.md`](docs/security-review.md).
El paquete de planificación completo (arquitectura, data dictionary, fuentes, roadmap)
está publicado como artifact del proyecto.

## Principios no negociables

1. **Neutralidad política** — sin colores partidarios como identidad, sin lenguaje valorativo.
2. **Nunca inventar datos** — lo que no existe se declara ("No hay datos públicos disponibles
   para este nivel territorial").
3. **Provenance total** — cada observación conserva fuente, período, unidad, estado
   (OFFICIAL/CALCULATED/SECONDARY/…) y URL del dato original.
4. **Legibilidad y accesibilidad** — WCAG 2.2 AA como meta: mapa navegable por teclado,
   "Ver datos" en cada gráfico, nunca solo color para comunicar.

## Datos y licencias

- Indicadores: INE, BCU, MTSS, Corte Electoral (ver `/fuentes` en la app). El PIB trimestral
  sale de la planilla del BCU; el script trae los certificados intermedios que el servidor del
  BCU no manda (`scripts/ingest/certs/`). Las cotizaciones salen del servicio web público
  del BCU (dólar, real, euro y peso argentino del mercado interbancario, desde 2000); el script verifica el último
  dato contra la página de cotizaciones. La planilla de mortalidad del INE está en
  www5.ine.gub.uy, que manda un intermedio equivocado: el script usa el correcto
  (`scripts/ingest/certs/ine-intermedios.pem`).
- Series históricas comparables: Banco Mundial (fuente secundaria, siempre etiquetada).
- PBI anual oficial (BCU, a precios constantes de 2016), en el gráfico de evolución del PIB:
  hasta 2016 vía [PRISMA](https://prisma.uy), el portal de indicadores de la ANII (datos
  públicos; se usan citando el portal), y desde 2017 la suma de los trimestres del BCU, que
  trae sus últimas revisiones.
- Límites departamentales: IDE / Servicio Geográfico Militar vía catalogodatos.gub.uy
  (Licencia de Datos Abiertos Uruguay).
- Municipios de Montevideo: derivados de la cartografía censal INE 2023 (CCZ) según la
  correspondencia oficial de la Intendencia de Montevideo.
