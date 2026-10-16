!!! info "Konventionen in diesem Praktikum"
    - **Euer Namespace** heißt in den Beispielen `wab123`. Setzt eure eigene
      Kennung ein und legt sie als Variable ab: `export NS=wab123`.
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
