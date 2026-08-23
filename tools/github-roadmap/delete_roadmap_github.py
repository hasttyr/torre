#!/usr/bin/env python3
"""
Borra TODOS los issues y milestones creados por el roadmap de Torre Central Hub
(las 12 Fases/Incrementos "padre" + las 38 actividades "hijas"), usando GitHub CLI.

Es un script SEPARADO e independiente de bulk_upload_github.py -- no toca nada
mas del repo. Identifica que borrar por patron de titulo:
  - Los 12 issues padre (coinciden exactamente con los nombres de Fase/Incremento)
  - Las actividades hijas (titulos que empiezan con "[S" seguido de un numero,
    ej. "[S5] HU01. Registro de usuario")
  - Los milestones semanales (titulos que empiezan con "S1 (", "S2 (", etc.)

NO borra: labels, el Project en si, ni ningun otro issue que no calce con estos
patrones exactos.

Requisitos:
  1. gh auth status                      (ya autenticado)
  2. Ser administrador del repo -- borrar issues (a diferencia de cerrarlos)
     requiere permisos de administrador en GitHub.

Uso:
  python3 delete_roadmap_github.py <owner>/<repo>

Ejemplo:
  python3 delete_roadmap_github.py hasttyr/torre

El script SIEMPRE muestra la lista completa de lo que va a borrar y pide
confirmacion escrita antes de borrar nada. No hay modo "silencioso".
"""

import subprocess
import sys
import re
import json

PARENT_TITLES = {
    "Fase 1: Levantamiento y priorizacion",
    "Fase 2: Diseno",
    "Incremento 1: Usuarios, autenticacion y permisos",
    "Incremento 2: Creacion de torneo e inscripcion",
    "Incremento 3: Emparejamiento suizo adaptado",
    "Incremento 4: Registro de resultados y clasificacion",
    "Incremento 5: Publicacion y consultas competitivas",
    "Incremento 6: Cuenta de usuario y cumplimiento normativo",
    "Incremento 7: Clubes, entrenadores y torneos",
    "Incremento 8: Reglas operativas avanzadas",
    "Incremento 9: Exportacion y auditoria",
    "Fase 4: Validacion",
}

CHILD_PATTERN = re.compile(r"^\[S\d+\]")
MILESTONE_PATTERN = re.compile(r"^S\d+\s*\(")


def run(cmd, check=True):
    print(f"$ {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.stdout.strip():
        print(result.stdout.strip())
    if result.returncode != 0:
        print(f"[ERROR] codigo de salida {result.returncode}")
        if result.stderr.strip():
            print(result.stderr.strip())
        if check:
            sys.exit(1)
    return result


def main():
    if len(sys.argv) != 2:
        print("Uso: python3 delete_roadmap_github.py <owner>/<repo>")
        sys.exit(1)

    repo = sys.argv[1]

    print("== Verificando autenticacion ==")
    run(["gh", "auth", "status"])

    # 1. Traer TODOS los issues (abiertos y cerrados) del repo
    print("\n== Buscando issues del roadmap ==")
    result = run(["gh", "issue", "list", "--repo", repo, "--state", "all",
                  "--limit", "300", "--json", "number,title"])
    try:
        all_issues = json.loads(result.stdout)
    except json.JSONDecodeError:
        print("[ERROR] no se pudo leer la lista de issues")
        sys.exit(1)

    to_delete = []
    for issue in all_issues:
        title = issue["title"]
        if title in PARENT_TITLES or CHILD_PATTERN.match(title):
            to_delete.append(issue)

    # 2. Traer milestones del roadmap
    print("\n== Buscando milestones del roadmap ==")
    ms_result = run(["gh", "api", f"repos/{repo}/milestones", "--paginate",
                      "-X", "GET", "-f", "state=all"], check=False)
    milestones_to_delete = []
    try:
        for m in json.loads(ms_result.stdout):
            if MILESTONE_PATTERN.match(m["title"]):
                milestones_to_delete.append(m)
    except (json.JSONDecodeError, TypeError):
        pass

    # 3. Mostrar todo lo que se va a borrar y pedir confirmacion
    print(f"\n{'='*60}")
    print(f"Se encontraron {len(to_delete)} issues y {len(milestones_to_delete)} "
          f"milestones del roadmap para BORRAR PERMANENTEMENTE:\n")
    for issue in to_delete:
        print(f"  issue #{issue['number']}: {issue['title']}")
    for m in milestones_to_delete:
        print(f"  milestone: {m['title']}")
    print(f"\n{'='*60}")

    if not to_delete and not milestones_to_delete:
        print("No hay nada que borrar.")
        return

    respuesta = input(
        "\nEsto NO se puede deshacer. Escribe BORRAR (en mayusculas) para "
        "confirmar, o cualquier otra cosa para cancelar: "
    )
    if respuesta.strip() != "BORRAR":
        print("Cancelado. No se borro nada.")
        return

    # 4. Borrar issues
    print("\n== Borrando issues ==")
    failed = []
    for issue in to_delete:
        result = run(["gh", "issue", "delete", str(issue["number"]),
                      "--repo", repo, "--yes"], check=False)
        if result.returncode != 0:
            failed.append(issue["title"])

    # 5. Borrar milestones
    print("\n== Borrando milestones ==")
    for m in milestones_to_delete:
        run(["gh", "api", f"repos/{repo}/milestones/{m['number']}",
             "-X", "DELETE"], check=False)

    print(f"\nListo: {len(to_delete) - len(failed)} issues y "
          f"{len(milestones_to_delete)} milestones borrados.")
    if failed:
        print(f"\n[ATENCION] {len(failed)} issues no se pudieron borrar "
              f"(probablemente falta permiso de administrador en el repo):")
        for t in failed:
            print(f"  - {t}")


if __name__ == "__main__":
    main()
