# Werkzeuge

Alle Versuche benutzen ein einziges Container-Image mit den gängigen
Netzwerkwerkzeugen: `ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0`. Es ist
öffentlich und wird beim ersten Start geladen.

## Im Image

| Werkzeug | Zweck | Versuch |
|----------|-------|---------|
| `ip` | Adressen, Routen, Schnittstellen | 01 |
| `ping` | Erreichbarkeit, Pfad-MTU (`-s`, `-M do`) | 02 |
| `traceroute` | Sprünge zum Ziel | 02 |
| `dig`, `getent` | Namensauflösung | 04 |
| `curl` | HTTP, Zeitmessung mit `-w` | 03 bis 08 |
| `tcpdump` | Mitschnitt auf einer Schnittstelle | 03, 04, 06 |
| `ss` | TCP-Zustand und Parameter (`-ti`) | 06 |
| `iperf3` | Durchsatz | 06 |
| `nc`, `socat` | einfache Verbindungen | 06 |
| `labsrv.py` | Testserver mit Pfaden `/healthz`, `/ready`, `/status/<code>`, `/slow`, `/big` | 03 bis 08 |

!!! note "Was nicht geht"
    Rohe Pakete aus eigener Software (zum Beispiel mit Scapy) und Änderungen an
    der Netzwerkkonfiguration des Pods sind aus Sicherheitsgründen gesperrt.
    Ihr braucht sie nicht.

## Der Testserver `labsrv.py`

Er wird mit `command: ["python3", "/opt/lab/labsrv.py"]` gestartet und über
Umgebungsvariablen gesteuert.

| Variable | Wirkung |
|----------|---------|
| `NAME` | Name in der Antwort (`hello from NAME`) |
| `PORT` | Port, Standard 8080 |
| `READY_AFTER` | `/ready` meldet 503, bis so viele Sekunden vergangen sind |
| `DELAY` | Antwortverzögerung auf `/` in Sekunden |

Pfade: `/healthz` (immer 200), `/ready`, `/status/<code>` (liefert genau diesen
Code), `/slow?s=<n>` (wartet n Sekunden), `/big?kb=<n>` (liefert n KB).

## Ein Wort zu Ressourcen

Jeder Pod muss **Ressourcenangaben** tragen, sonst lehnt die ICC ihn ab. Die
Versuche halten sich an kleine Werte (Anforderung `10m` CPU und `32Mi` RAM,
Grenzen `100m` bis `200m` und `64Mi` bis `128Mi`). Löscht Namespaces nach jedem
Versuch, damit eure Quote frei bleibt.

--8<-- "issue-feedback.md"
