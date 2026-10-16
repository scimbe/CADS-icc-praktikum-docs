# Vergleich mit AWS

Die ICC ist ein Kubernetes-Cluster, aber viele Probleme, die ihr hier erlebt,
treten in einer Cloud wie AWS in fast gleicher Form auf. Die Tabelle ordnet die
Bausteine zu. Sie ist eine Eselsbrücke, keine genaue Gleichung.

| AWS | ICC / Kubernetes | Versuch | Typisches Problem |
|-----|------------------|---------|-------------------|
| VPC, Subnet | Namespace und Pod-Netz | 01 | Adressbereiche überlappen, falsche Maske |
| Route Table, Standardroute | Standardroute des Pods | 01 | „Kein Weg ins Internet" |
| Security Group | NetworkPolicy | 05 | Stille statt Absage, DNS vergessen |
| NAT Gateway | Egress-NAT | 05 | Viele Pods, eine sichtbare Adresse |
| Load Balancer, Target Group | Service, Endpoints | 03, 07 | Keine gesunden Ziele |
| Health Check | Readiness-Probe | 07 | Pod läuft, bekommt aber keinen Verkehr |
| Deregistration Delay | Beenden des Pods (Grace Period) | 07 | Antworten nach dem Abschalten |
| ALB-Fehlercodes 502/504 | nginx-Balancer | 07 | Wer hat den Fehler erzeugt? |
| Route 53 (private Zone) | CoreDNS | 04 | `ndots`, Suchliste, Namenskollision |
| MTU (Jumbo Frames, Tunnel) | Overlay-MTU 1450 | 02 | Große Pakete verschwinden |
| Flow Logs, Packet Mirroring | `tcpdump` | 03, 06 | Wo wird umgeschrieben? |
| Bastion, SSM | `kubectl port-forward` | 07 | Zugriff auf interne Dienste |

!!! info "Wo die Analogie endet"
    Kubernetes legt die virtuelle IP eines Service als Regel in den Knoten ab,
    sie gehört keiner Schnittstelle. Deshalb antwortet eine ClusterIP nicht auf
    `ping` (Versuch 03). Ein Load Balancer in der Cloud ist ein eigener Dienst
    mit eigener Adresse. Prüft Unterschiede immer an der Messung, nicht an der
    Tabelle.

## Fehlerbilder in Kürze

| Beobachtung | Erste Vermutung | Versuch |
|-------------|-----------------|---------|
| Antwort sofort abgelehnt (curl 7) | Port zu, oder keine Endpoints | 03, 05 |
| Stille, dann Zeitüberschreitung (curl 28) | Paket verworfen (Regel, Route) | 05, 06 |
| Namen werden nicht aufgelöst (curl 6) | DNS, Suchliste, Namespace | 04 |
| 504 vom Balancer | Anwendung langsamer als das Zeitlimit | 07 |
| 502 vom Balancer | Keine Ziele oder keine gültige Antwort | 07 |
| Große Antworten hängen, kleine gehen | MTU, Fragmentierung | 02 |

--8<-- "issue-feedback.md"
