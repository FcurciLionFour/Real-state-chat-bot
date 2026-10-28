# Python Scraper Service

Servicio Python de scraping y adquisicion de datos para el proyecto.

Estado actual:

- `FastAPI` listo
- healthchecks listos
- endpoint `POST /v1/search` operativo con discovery nativo por portal
- endpoint `POST /v1/extract-url` operativo
- contratos base ampliados para agrupacion tecnica de duplicados
- `Dockerfile` listo para integracion por `docker compose`

## Endpoints

- `GET /`
- `GET /health/live`
- `GET /health/ready`
- `GET /v1/capabilities`
- `POST /v1/search`
- `POST /v1/extract-url`

## Arranque esperado por Docker

Desde `backend/`:

```powershell
docker compose up -d --build python-scraper
```

## Tests

Desde la raiz del servicio:

```powershell
python -m unittest discover -s tests -v
```

## Estado tecnico actual

- `Argenprop` ya tiene discovery nativo + extraccion real
- el servicio ya devuelve `sourceEntries[]`, `duplicateGroupId` y `duplicateCount`
- el dedupe tecnico vive en Python, pero el merge final de negocio sigue quedando para Nest
