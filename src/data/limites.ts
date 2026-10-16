// Archivos de límites que dibuja el mapa. Son los mismos que baja
// scripts/ingest/fetch-geo.mjs: si cambia uno, cambiar los dos.

/** GeoJSON de IDE Uruguay / Servicio Geográfico Militar. El conjunto
 * "ide-limites-departamentales" ya no figura en el listado del Catálogo
 * Nacional (su página da 404), pero el archivo sigue publicado. */
export const LIMITES_DEPARTAMENTOS_URL =
  "https://catalogodatos.gub.uy/dataset/ide-limites-departamentales/resource/3c1b430a-c010-4db1-880d-bdc0f11e4ce9/download/departamentos.geojson";

/** Capa "Municipios" de DINOT (MVOT) en el geoserver del Ministerio de Ambiente (WFS). */
export const LIMITES_MUNICIPIOS_URL =
  "https://www.ambiente.gub.uy/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=u19600217:c101&outputFormat=application/json&srsName=EPSG:4326";
