# Roadmap de GitHub — Torre Central Hub

Herramientas para sincronizar el roadmap de 14 semanas del proyecto con Issues, Milestones y el Project de GitHub. No son parte de la aplicación (backend/frontend); son scripts de gestión que se corren una sola vez por cambio en el plan.

## Archivos

| Archivo | Qué hace |
|---|---|
| `roadmap_github.csv` | Fuente de verdad: una fila por actividad (Fase/Incremento, título, entregable, semana, fechas). Editar aquí si cambia el plan. |
| `bulk_upload_github.py` | Lee el CSV y crea/actualiza en GitHub: labels, milestones semanales, issues "padre" por Fase/Incremento, e issues "hijos" (sub-issues) por actividad. Es idempotente — se puede correr varias veces sin duplicar nada. |
| `delete_roadmap_github.py` | Borra permanentemente todos los issues y milestones generados por el roadmap (identificados por patrón de título). Pide confirmación explícita antes de borrar. |

## Requisitos previos

1. Instalar GitHub CLI: <https://cli.github.com/>
2. Autenticarte: `gh auth login`
3. Ampliar permisos (necesario para el Project): `gh auth refresh -s project,read:project`
4. Tener el repo y el Project (v2) ya creados en GitHub.

## Uso

Actualizar/crear el roadmap completo:

```bash
cd tools/github-roadmap
python3 bulk_upload_github.py <owner>/<repo> <numero-del-project>
```

Ejemplo:

```bash
python3 bulk_upload_github.py hasttyr/torre 1
```

Borrar todo el roadmap (irreversible, pide confirmación escrita):

```bash
python3 delete_roadmap_github.py <owner>/<repo>
```

## Si cambia el plan

1. Edita `roadmap_github.csv` (agrega, quita o modifica filas).
2. Vuelve a correr `bulk_upload_github.py` con los mismos argumentos de siempre — las actividades que ya existen (por título exacto) no se duplican, solo se agregan las nuevas.

## Qué activa la vista Roadmap del Project

`bulk_upload_github.py` crea automáticamente, si no existen, dos campos de fecha en el Project llamados **Start date** y **Target date**, y los llena con la semana real de cada actividad. Una vez corrido, solo falta ir a la vista del Project → engranaje/Layout → elegir **Roadmap** para ver las barras distribuidas en el tiempo.
