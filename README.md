# Radar SECOP

Dashboard estático que lista procesos de contratación abiertos en SECOP II
(Colombia), filtrable por departamento, municipio, modalidad y precio base.

- `index.html` / `app.js` — el sitio (sin build step, HTML+JS plano).
- `data.json` — los datos, regenerados por `scripts/generate-data.js`.
- `.github/workflows/refresh.yml` — corre ese script cada hora en GitHub
  Actions y hace commit del `data.json` actualizado.

## Publicar en GitHub Pages

Settings → Pages → Source: Deploy from a branch → Branch: `main` / `(root)`.

## Actualizar manualmente

```bash
node scripts/generate-data.js
```
