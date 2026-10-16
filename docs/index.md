# IP-Netze auf der ICC

Ein Praktikum zu den zentralen Eigenschaften von IP-Netzen, durchgeführt auf
einem Kubernetes-Cluster, der **ICC**. Ihr untersucht Adressen, ICMP, virtuelle
IPs, DNS, Filterregeln, TCP und HTTP hinter einem Load Balancer. Dabei erlebt
ihr Probleme, die in Cloud-Umgebungen wie AWS jeden Tag auftreten: virtuelles
Routing, Timeouts, MTU, Health Checks und Fehlercodes von Balancern.

## So ist das Praktikum aufgebaut

Jeder Versuch folgt dem gleichen Muster:

1. **Vorhersagen**: Ihr schreibt auf, was ihr erwartet.
2. **Beobachten**: Ihr messt mit `ping`, `curl`, `tcpdump`, `dig` und `ss`.
3. **Brechen und Reparieren**: Ihr stört das System gezielt und stellt es wieder her.

Die Hilfen nehmen von Versuch zu Versuch ab. Am Ende steht eine Fehlersuche ohne
Anleitung und ein kleiner Entwurf (Versuch 08). Jede Aufgabe beginnt mit einem
kurzen Kasten **„Warum das zählt"**, der den Praxisbezug zeigt.

## Die Versuche

| Nr. | Thema | Ihr lernt |
|-----|-------|-----------|
| [00](labs/00-onboarding.md) | Onboarding | Zugang, Namespaces, Ressourcengrenzen |
| [01](labs/01-adressierung.md) | Adressierung | Pod-Adressen, Maske, Standardroute |
| [02](labs/02-icmp-ttl-mtu.md) | ICMP, TTL, MTU | Ping, Traceroute, Pfad-MTU |
| [03](labs/03-virtuelle-ips.md) | Virtuelle IPs | Service, Endpoints, Adressumsetzung |
| [04](labs/04-dns.md) | DNS | Namensauflösung, Suchliste, `ndots` |
| [05](labs/05-filtern.md) | Filtern | NetworkPolicy, Timeout oder Absage, Egress-NAT |
| [06](labs/06-tcp.md) | TCP | Handshake, Verzögerung, Reset, Durchsatz |
| [07](labs/07-http-load-balancer.md) | HTTP und Load Balancer | 502/504, Readiness, Draining |
| [08](labs/08-abschluss.md) | Abschluss | Fehlersuche und Drei-Schichten-Entwurf |

Zum Nachschlagen: der [Vergleich mit AWS](reference/aws-vergleich.md), die
[Werkzeuge](reference/werkzeuge.md) und die [Ressourcen](reference/ressourcen.md).

## Voraussetzungen

- ein Konto auf der ICC und die Anleitung zur Nutzung (von der Kursleitung),
- `kubectl` mit eurer Zugangsdatei,
- Grundkenntnisse in der Kommandozeile.

Ersetzt in allen Beispielen den Namespace `wab123` durch **euren eigenen**.
Alle Versuche laufen in Unter-Namespaces der Form `<euer-namespace>-labNN` und
brauchen sehr wenig Ressourcen. Räumt am Ende jedes Versuchs auf.

!!! warning "Fasst nichts an, was nicht euch gehört"
    Arbeitet nur in euren eigenen Namespaces. Löscht keine Objekte, die ihr
    nicht selbst angelegt habt.

--8<-- "issue-feedback.md"
