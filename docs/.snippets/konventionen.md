<div class="cads-ns-box">
<label>Euer Namespace</label>
<input class="cads-ns-input" type="text" placeholder="wab123" autocomplete="off" spellcheck="false" aria-label="Euer Namespace">
<span class="cads-ns-status" role="status">Tragt eure Kennung ein, dann zeigen alle Befehle sie schon an.</span>
</div>

!!! info "Konventionen in diesem Praktikum"
    - **Euer Namespace** heißt in den Beispielen `wab123`. Tragt oben eure
      Kennung ein: Alle Befehle auf der Seite nutzen sie dann
      sofort (auch dort, wo die Variable NS steht), und ihr könnt sie direkt
      kopieren. Das Feld merkt sich den Wert
      nur in eurem Browser.
    - **Betriebssystem:** Die Befehle sind für eine Bash-Shell geschrieben
      (macOS-Terminal, Linux). Unter **Windows** nutzt ihr **WSL 2** (Ubuntu)
      oder **Git Bash**. In der PowerShell funktionieren Here-Documents
      (`<<'EOF'`), `until`-Schleifen und die Funktion `T` nicht.
    - **Jeder Versuch bekommt einen eigenen Sub-Namespace** (`$NS-labNN`).
      Aufgeräumt wird am Ende mit `kubectl delete ns $NS-labNN`.
    - **Werkzeug-Image:** `ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0`. Es
      enthält `ping`, `traceroute`, `tcpdump`, `ss`, `iperf3`, `dig`, `curl`
      und den Lehr-Webserver ([Details](/reference/werkzeuge.md)).
    - **Sparsam bleiben:** Jeder Pod bekommt kleine Grenzen
      (`cpu: 200m`, `memory: 128Mi`). Die Quote steht in
      [Ressourcen und Aufräumen](/reference/ressourcen.md).
    - **Vorgehen in jedem Versuch:** erst **vorhersagen**, dann
      **beobachten**, dann **erklären** oder **reparieren**.
