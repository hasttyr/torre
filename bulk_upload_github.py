#!/usr/bin/env python3
"""
Bulk-crea issues en un repo de GitHub a partir de roadmap_github.csv
y los agrega a un GitHub Project (v2), usando GitHub CLI (gh).

Requisitos previos (revisar ANTES de correr el script):
  1. Instalar GitHub CLI:      https://cli.github.com/
  2. Verificar instalacion:    gh --version
  3. Autenticarte:             gh auth login
  4. Ampliar permisos:         gh auth refresh -s project,read:project
  5. Verificar autenticacion:  gh auth status
  6. Tener el repo YA CREADO en GitHub (con al menos un commit).
  7. Tener el Project (v2) YA CREADO en GitHub (puede estar vacio).

Fechas (para la vista Roadmap del Project):
  El script crea automaticamente, si no existen, dos campos de tipo
  fecha en tu Project llamados "Start date" y "Target date", y los
  llena con la semana real de cada actividad. No hay que crear nada
  a mano en la UI -- con correr el comando ya queda listo para activar
  la vista Roadmap (Project > vista > Layout > Roadmap).

  Ademas, el script SIEMPRE crea un Milestone de GitHub por semana con
  su fecha limite real (due date), y asigna cada issue a su milestone.
  Eso da una segunda linea de tiempo nativa en
  github.com/<owner>/<repo>/milestones, independiente del Project.

Uso:
  python3 bulk_upload_github.py <owner>/<repo> <numero-del-project>

Ejemplo:
  python3 bulk_upload_github.py nilsonaldair/torre-central-hub 3

El script imprime cada paso en pantalla. Si algo fallara, el mensaje
de error de gh se muestra completo -- no se oculta nada.
"""

import csv
import subprocess
import sys
import os

def run(cmd, check=True):
    """Corre un comando y muestra su salida en vivo."""
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
    if len(sys.argv) != 3:
        print("Uso: python3 bulk_upload_github.py <owner>/<repo> <numero-del-project>")
        sys.exit(1)

    repo = sys.argv[1]
    project_number = sys.argv[2]
    owner = repo.split("/")[0]
    csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "roadmap_github.csv")

    if not os.path.exists(csv_path):
        print(f"[ERROR] No encuentro {csv_path}. Asegurate de que roadmap_github.csv "
              f"este en la MISMA carpeta que este script.")
        sys.exit(1)

    import json

    # 0. Verificaciones previas
    print("== Verificando GitHub CLI ==")
    run(["gh", "--version"])
    print("\n== Verificando autenticacion ==")
    run(["gh", "auth", "status"])

    # 1. Crear labels
    labels = ["fase-1", "fase-2", "incremento-1", "incremento-2",
              "incremento-3", "incremento-4", "incremento-5", "fase-4"]
    print("\n== Creando labels ==")
    for label in labels:
        run(["gh", "label", "create", label, "--repo", repo,
             "--color", "5319e7", "--force"], check=False)

    # 1.5 Traer los issues que ya existen, para no duplicar en un reintento
    print("\n== Revisando issues existentes (para no duplicar) ==")
    existing = run(["gh", "issue", "list", "--repo", repo, "--state", "all",
                    "--limit", "200", "--json", "title,url"])
    existing_titles = {}
    try:
        for item in json.loads(existing.stdout):
            existing_titles[item["title"]] = item["url"]
    except (json.JSONDecodeError, KeyError):
        pass

    # 1.6 Traer milestones existentes, para no duplicarlos tampoco
    print("\n== Revisando milestones existentes ==")
    existing_ms = run(["gh", "api", f"repos/{repo}/milestones", "--paginate",
                        "-X", "GET", "-f", "state=all"], check=False)
    milestone_titles = set()
    try:
        for m in json.loads(existing_ms.stdout):
            milestone_titles.add(m["title"])
    except (json.JSONDecodeError, KeyError, TypeError):
        pass

    # 1.7 Detectar campos "Start date" / "Target date" del Project (opcional)
    print("\n== Buscando campos de fecha en el Project (opcional, para Roadmap) ==")
    project_id = None
    start_field_id = None
    target_field_id = None
    proj_view = run(["gh", "project", "view", project_number, "--owner", owner,
                      "--format", "json"], check=False)
    if proj_view.returncode == 0:
        try:
            project_id = json.loads(proj_view.stdout)["id"]
        except (json.JSONDecodeError, KeyError):
            pass
    fields = run(["gh", "project", "field-list", project_number, "--owner", owner,
                  "--format", "json"], check=False)
    if fields.returncode == 0:
        try:
            for field in json.loads(fields.stdout).get("fields", []):
                name = field.get("name", "").strip().lower()
                if name == "start date":
                    start_field_id = field.get("id")
                if name == "target date":
                    target_field_id = field.get("id")
        except (json.JSONDecodeError, KeyError):
            pass

    if start_field_id and target_field_id:
        print("  encontrados 'Start date' y 'Target date' -> se llenaran automaticamente")
    else:
        print("  no existen todavia -> los creo automaticamente")
        if not start_field_id:
            create_start = run(["gh", "project", "field-create", project_number,
                                 "--owner", owner, "--name", "Start date",
                                 "--data-type", "DATE", "--format", "json"], check=False)
            if create_start.returncode == 0:
                try:
                    start_field_id = json.loads(create_start.stdout)["id"]
                    print("  creado 'Start date'")
                except (json.JSONDecodeError, KeyError):
                    pass
        if not target_field_id:
            create_target = run(["gh", "project", "field-create", project_number,
                                  "--owner", owner, "--name", "Target date",
                                  "--data-type", "DATE", "--format", "json"], check=False)
            if create_target.returncode == 0:
                try:
                    target_field_id = json.loads(create_target.stdout)["id"]
                    print("  creado 'Target date'")
                except (json.JSONDecodeError, KeyError):
                    pass
        if not (start_field_id and target_field_id):
            print("  [ATENCION] no se pudieron crear los campos de fecha; revisa que el "
                  "token tenga el scope 'project' (gh auth refresh -s project,read:project)")

    # 2. Leer CSV y crear issues + milestones
    print("\n== Creando issues ==")
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        count = 0
        failed = []
        for row in reader:
            title = row["title"]
            body = row["body"].replace("\\n", "\n")
            label = row["labels"]
            milestone_title = row["milestone"]
            start_date = row["start_date"]
            due_date = row["due_date"]

            print(f"\n--- Issue: {title} ---")

            # Asegurar que el milestone exista, con su fecha limite real
            if milestone_title not in milestone_titles:
                due_on = f"{due_date}T23:59:59Z"
                ms_result = run(["gh", "api", f"repos/{repo}/milestones", "-X", "POST",
                                  "-f", f"title={milestone_title}",
                                  "-f", f"due_on={due_on}"], check=False)
                if ms_result.returncode == 0:
                    milestone_titles.add(milestone_title)

            if title in existing_titles:
                issue_url = existing_titles[title]
                print(f"  ya existe, se omite creacion -> {issue_url}")
            else:
                result = run(["gh", "issue", "create", "--repo", repo,
                              "--title", title, "--body", body, "--label", label,
                              "--milestone", milestone_title], check=False)
                if result.returncode != 0:
                    failed.append(title)
                    continue
                issue_url = result.stdout.strip().splitlines()[-1]
                print(f"  -> {issue_url}")

            add_result = run(["gh", "project", "item-add", project_number,
                               "--owner", owner, "--url", issue_url,
                               "--format", "json"], check=False)
            if add_result.returncode != 0:
                failed.append(title)
                continue
            count += 1

            # Llenar Start date / Target date del Project, si existen esos campos
            if project_id and start_field_id and target_field_id:
                try:
                    item_id = json.loads(add_result.stdout)["id"]
                    run(["gh", "project", "item-edit", "--id", item_id,
                         "--project-id", project_id, "--field-id", start_field_id,
                         "--date", start_date], check=False)
                    run(["gh", "project", "item-edit", "--id", item_id,
                         "--project-id", project_id, "--field-id", target_field_id,
                         "--date", due_date], check=False)
                except (json.JSONDecodeError, KeyError):
                    pass

    print(f"\nListo: {count} issues creados/agregados al Project #{project_number}")
    print(f"Milestones con fecha limite: github.com/{repo}/milestones")
    if failed:
        print(f"\n[ATENCION] {len(failed)} fallaron y hay que revisarlos manualmente:")
        for t in failed:
            print(f"  - {t}")

if __name__ == "__main__":
    main()
