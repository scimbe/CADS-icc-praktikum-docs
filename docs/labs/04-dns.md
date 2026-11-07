# 04 · DNS

<a class="md-button" href="../../pdf/04-dns.pdf">:material-file-pdf-box: Als PDF herunterladen</a>

--8<-- "konventionen.md"

Niemand tippt IP-Adressen. In der ICC gibt es dafür einen eigenen DNS-Dienst im
Cluster (CoreDNS), der Servicenamen in virtuelle IPs übersetzt, das Gegenstück zu
einer **privaten Zone** in der Cloud (z. B. Route 53). Ihr lest, wie ein Pod
seine Namen auflöst, zählt die Anfragen und lernt eine Eigenheit kennen, die
viele überrascht: die **Suchliste** mit `ndots:5`.

## Lernziele

Nach dem Versuch könnt ihr …

- die `resolv.conf` eines Pods lesen und erklären (Nameserver, Suchliste, `ndots`),
- einen Servicenamen **kurz** und **voll qualifiziert** auflösen,
- an einem Mitschnitt zählen, wie viele Anfragen ein einzelner Name auslöst,
- einen Namen aus einem **anderen Namespace** erreichen und erklären, wieso der
  Kurzname dort nicht geht.

## Aufbau

Ein Service `kasse` im Namespace `lab04`, ein Client im Nachbar-Namespace `lab04b`.

!!! warning "Zwei Namespaces"
    Dieser Versuch legt **zwei** Namespaces an (`$NS-lab04` und `$NS-lab04b`).
    Prüft vorher mit `kubectl get ns -l capsule.clastix.io/tenant=$NS`, dass
    höchstens drei Namespaces belegt sind (euer eigener zählt mit), und löscht
    alte Lab-Namespaces. Meldet der
    Aufbau `Namespace … fehlt`, war die Grenze erreicht: Räumt auf und startet
    ihn neu.

=== "Bash"

    ```bash
    export NS=wab123
    for n in lab04 lab04b; do
      kubectl create ns $NS-$n
      kubectl get ns $NS-$n >/dev/null || { echo "Namespace $NS-$n fehlt (Grenze?). Prüft kubectl get ns, löscht alte Lab-Namespaces und startet den Aufbau neu."; break; }
      until kubectl auth can-i create pods -n $NS-$n | grep -q yes \
         && kubectl auth can-i get pods -n $NS-$n | grep -q yes; do sleep 1; done
    done

    kubectl -n $NS-lab04 apply -f - <<'EOF'
    apiVersion: v1
    kind: Pod
    metadata: {name: srv, labels: {app: srv}}
    spec:
      containers:
      - name: s
        image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
        command: ["python3", "/opt/lab/labsrv.py"]
        resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 100m, memory: 64Mi}}
    ---
    apiVersion: v1
    kind: Service
    metadata: {name: kasse}
    spec:
      selector: {app: srv}
      ports: [{port: 80, targetPort: 8080}]
    ---
    apiVersion: v1
    kind: Pod
    metadata: {name: a}
    spec:
      containers:
      - name: t
        image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
        resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 200m, memory: 128Mi}}
    EOF
    kubectl -n $NS-lab04b apply -f - <<'EOF'
    apiVersion: v1
    kind: Pod
    metadata: {name: c}
    spec:
      containers:
      - name: t
        image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
        resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 100m, memory: 64Mi}}
    EOF
    kubectl -n $NS-lab04 wait --for=condition=Ready pod --all --timeout=180s
    kubectl -n $NS-lab04b wait --for=condition=Ready pod --all --timeout=180s
    A() { kubectl -n $NS-lab04 exec a -- "$@"; }
    C() { kubectl -n $NS-lab04b exec c -- "$@"; }
    kubectl get ns $NS-lab04b >/dev/null 2>&1 && echo "Aufbau vollständig." || echo "WARNUNG: Aufbau unvollständig: $NS-lab04b fehlt. Die Fehler oben sind Folgefehler. Räumt auf (kubectl delete ns $NS-lab04), löscht alte Lab-Namespaces und startet den Aufbau neu."
    ```

=== "PowerShell"

    ```powershell
    $NS = "wab123"
    foreach ($n in "lab04", "lab04b") {
      kubectl create ns "$NS-$n"
      if (-not (kubectl get ns "$NS-$n" -o name 2>$null)) { "Namespace $NS-$n fehlt (Grenze?). Prüft kubectl get ns, löscht alte Lab-Namespaces und startet den Aufbau neu."; break }
      do { Start-Sleep 1 } until ((kubectl auth can-i create pods -n "$NS-$n") -eq "yes" -and (kubectl auth can-i get pods -n "$NS-$n") -eq "yes")
    }

    @'
    apiVersion: v1
    kind: Pod
    metadata: {name: srv, labels: {app: srv}}
    spec:
      containers:
      - name: s
        image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
        command: ["python3", "/opt/lab/labsrv.py"]
        resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 100m, memory: 64Mi}}
    ---
    apiVersion: v1
    kind: Service
    metadata: {name: kasse}
    spec:
      selector: {app: srv}
      ports: [{port: 80, targetPort: 8080}]
    ---
    apiVersion: v1
    kind: Pod
    metadata: {name: a}
    spec:
      containers:
      - name: t
        image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
        resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 200m, memory: 128Mi}}
    '@ | kubectl -n "$NS-lab04" apply -f -
    @'
    apiVersion: v1
    kind: Pod
    metadata: {name: c}
    spec:
      containers:
      - name: t
        image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
        resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 100m, memory: 64Mi}}
    '@ | kubectl -n "$NS-lab04b" apply -f -
    kubectl -n "$NS-lab04" wait --for=condition=Ready pod --all --timeout=180s
    kubectl -n "$NS-lab04b" wait --for=condition=Ready pod --all --timeout=180s
    function A { kubectl -n "$NS-lab04" exec a -- @args }
    function C { kubectl -n "$NS-lab04b" exec c -- @args }
    if (-not (kubectl get ns "$NS-lab04b" -o name 2>$null)) { Write-Warning "Aufbau unvollständig: $NS-lab04b fehlt. Die Fehler oben sind Folgefehler. Räumt auf (kubectl delete ns $NS-lab04), löscht alte Lab-Namespaces und startet den Aufbau neu." } else { "Aufbau vollständig." }
    ```

## Aufgabe 1 · Die resolv.conf

!!! abstract "Warum das zählt"
    „Es liegt immer am DNS" ist ein Betriebsscherz mit wahrem Kern. Wer die
    Resolver-Konfiguration lesen kann, schließt die erste Fehlerquelle in
    Sekunden aus.

```bash
A cat /etc/resolv.conf
```

**Vorhersage:** Wie viele Suchdomänen stehen da? Wofür steht `ndots:5`, und ab
wie vielen Punkten im Namen wird er **zuerst** unverändert angefragt?

!!! info "Die Cluster-Domain"
    Der letzte Teil der Suchdomänen ist die **Domain eures Clusters**. Sie
    steht nicht in dieser Anleitung, ihr lest sie hier ab. Merkt sie euch als
    `<cluster-domain>`.

!!! question "Frage 1"
    Welche Adresse hat der Nameserver, und wo habt ihr einen Wert aus demselben
    Adressbereich schon gesehen? (Tipp: die ClusterIP aus Versuch 03.) Was
    folgt daraus für den Nameserver selbst?

## Aufgabe 2 · Kurz und lang

!!! abstract "Warum das zählt"
    Dasselbe Programm löst denselben Namen anders auf als `dig`. Dieser
    Unterschied ist die Ursache vieler „bei mir geht es"-Diskussionen.

=== "Bash"

    ```bash
    A dig +short kasse
    A dig +short kasse.$NS-lab04
    A dig +short kasse.$NS-lab04.svc
    A dig +search +short kasse
    ```

=== "PowerShell"

    ```powershell
    A dig +short kasse
    A dig +short "kasse.$NS-lab04"
    A dig +short "kasse.$NS-lab04.svc"
    A dig +search +short kasse
    ```

!!! tip "dig und die Suchliste"
    `dig` benutzt die Suchliste nur mit der Option **`+search`**. `curl`
    und `getent` benutzen sie immer.

**Vorhersage:** Welche Aufrufe liefern eine Adresse, welche nicht? Warum?

!!! question "Frage 2"
    Wie lautet der vollständige Name des Service (FQDN)? Setzt ihn aus
    Servicename, Namespace, `svc` und der Cluster-Domain zusammen und prüft ihn
    mit `dig +short`.

## Aufgabe 3 · Wie viele Anfragen kostet ein Name?

!!! abstract "Warum das zählt"
    Der `ndots`-Effekt vervielfacht die DNS-Last und ist eine bekannte Ursache
    für Latenzspitzen und für gedrosselte Resolver in der Cloud. Eine einzelne
    Zeichenänderung, der Punkt am Ende, kann das beheben.

Mitschnitt auf Port 53 beim Aufruf eines **externen** Namens:

=== "Bash"

    ```bash
    kubectl -n $NS-lab04 exec a -- sh -c "timeout 5 tcpdump -ni eth0 -l 'udp port 53' > /tmp/q.txt 2>/dev/null & \
      sleep 1; curl -s -m5 -o /dev/null https://example.com; sleep 1; wait; \
      grep -cE ' (A|AAAA)\? ' /tmp/q.txt; grep -oE ' (A|AAAA)\? [^ ]+' /tmp/q.txt | sort | uniq -c"
    ```

=== "PowerShell"

    ```powershell
    kubectl -n "$NS-lab04" exec a -- sh -c "timeout 5 tcpdump -ni eth0 -l 'udp port 53' > /tmp/q.txt 2>/dev/null & sleep 1; curl -s -m5 -o /dev/null https://example.com; sleep 1; wait; grep -cE ' (A|AAAA)\? ' /tmp/q.txt; grep -oE ' (A|AAAA)\? [^ ]+' /tmp/q.txt | sort | uniq -c"
    ```

**Vorhersage:** `example.com` hat einen Punkt, `ndots` ist 5. Wie viele
verschiedene Namen werden angefragt? Vergesst nicht, dass zu jedem Namen zwei
Anfragen gehören (IPv4 und IPv6).

Wiederholt den Mitschnitt mit einem **Punkt am Ende** des Namens:

=== "Bash"

    ```bash
    kubectl -n $NS-lab04 exec a -- sh -c "timeout 5 tcpdump -ni eth0 -l 'udp port 53' > /tmp/q.txt 2>/dev/null & \
      sleep 1; curl -s -m5 -o /dev/null https://example.com.; sleep 1; wait; \
      grep -cE ' (A|AAAA)\? ' /tmp/q.txt; grep -oE ' (A|AAAA)\? [^ ]+' /tmp/q.txt | sort | uniq -c"
    ```

=== "PowerShell"

    ```powershell
    kubectl -n "$NS-lab04" exec a -- sh -c "timeout 5 tcpdump -ni eth0 -l 'udp port 53' > /tmp/q.txt 2>/dev/null & sleep 1; curl -s -m5 -o /dev/null https://example.com.; sleep 1; wait; grep -cE ' (A|AAAA)\? ' /tmp/q.txt; grep -oE ' (A|AAAA)\? [^ ]+' /tmp/q.txt | sort | uniq -c"
    ```

!!! question "Frage 3"
    Wie viele Anfragen sind es mit und ohne Punkt am Ende? Wie groß wäre der
    Aufwand für 1000 Aufrufe pro Sekunde? Was spart ein vollständiger Name,
    und was kostet er an Lesbarkeit?

## Aufgabe 4 · Anderer Namespace

!!! abstract "Warum das zählt"
    Namensräume trennen Teams und Umgebungen (Entwicklung, Test, Produktion).
    Wer weiß, wie man sie gezielt überschreitet, kann Dienste verbinden und
    erkennt, wann eine Verbindung versehentlich in die falsche Umgebung geht.

Der Client in `lab04b` will den Service `kasse` in `lab04` erreichen.

=== "Bash"

    ```bash
    C curl -s -m3 -o /dev/null -w "kurz: code=%{http_code}\n" http://kasse/
    C curl -s -m3 -o /dev/null -w "qualifiziert: code=%{http_code}\n" http://kasse.$NS-lab04/
    ```

=== "PowerShell"

    ```powershell
    C curl -s -m3 -o /dev/null -w "kurz: code=%{http_code}\n" http://kasse/
    C curl -s -m3 -o /dev/null -w "qualifiziert: code=%{http_code}\n" "http://kasse.$NS-lab04/"
    ```

**Vorhersage:** Geht der Kurzname? Wenn nein, welcher Fehler, und was liefert
`C dig +search +showsearch kasse`?

!!! question "Frage 4"
    Warum findet die Suchliste den Service im anderen Namespace nicht, und wie
    sieht der Fehler aus (curl-Code 6 oder 7)? Was würde das für eine
    Mandantentrennung in der Cloud bedeuten, wenn jeder alles beim
    Kurznamen findet?

## Aufgabe 5 · Zusatz: Wenn die Suchliste ins Internet führt

!!! abstract "Warum das zählt"
    Interne Namen, die zufällig mit neuen öffentlichen Top-Level-Domains
    kollidieren, haben schon echte Ausfälle und Datenabflüsse verursacht. Das
    ist ein Beispiel dafür, wie ein Resolver-Detail zum Sicherheitsthema wird.

Löst im Client `lab04b` einen Namen auf, den es **nirgends** im Cluster gibt
(in `lab04b` gibt es keinen Service `web`). `+showsearch` zeigt jede Anfrage,
die die Suchliste erzeugt, mit ihrer Antwort:

=== "Bash"

    ```bash
    C sh -c "dig +search +showsearch web | grep -E 'status:|^;web|SOA'"
    ```

=== "PowerShell"

    ```powershell
    C sh -c "dig +search +showsearch web | grep -E 'status:|^;web|SOA'"
    ```

**Vorhersage:** Wie viele Anfragen erwartet ihr, und in welcher Reihenfolge?
Welche davon kann der Cluster-DNS nicht selbst beantworten?

Je probiertem Namen erscheinen drei Zeilen: zuerst der Status (`NXDOMAIN` = den
Namen gibt es nicht, `NOERROR` = es gibt ihn), dann der angefragte Name
(`;web.…`) und zuletzt die Zone, die geantwortet hat (`SOA`). `dig` fragt nur
nach IPv4 (`A`), deshalb ist es hier eine Anfrage pro Name und nicht zwei wie
bei `curl` in Aufgabe 3.

!!! question "Frage 5"
    Wie viele Namen probiert der Resolver, und in welcher Reihenfolge? Welche
    Anfrage verlässt den Cluster, und woran erkennt ihr das in der
    `SOA`-Zeile: Antwortet eure Cluster-Domain oder eine Zone im Internet?
    Warum ist `web` als interner Name riskant, seit es die öffentliche
    Top-Level-Domain `.web` gibt (Stichwort: *Name Collision*)? Wie vermeidet
    man das? (Tipp: vollständiger Name mit Punkt am Ende, eigene Domain wie
    `.internal` oder `home.arpa`, `ndots`.)

## Aufräumen

```bash
kubectl delete ns $NS-lab04
kubectl delete ns $NS-lab04b
```

Jede Zeile wartet etwa eine Minute, bis der Namespace weg ist. Meldet die zweite Zeile `Forbidden`, gab es
`$NS-lab04b` nicht (der Aufbau war abgebrochen). Das ist harmlos.

## Selbsttest

- [ ] Ich kann die `resolv.conf` Zeile für Zeile erklären.
- [ ] Ich kenne den vollen Namen eines Service und kann ihn auflösen.
- [ ] Ich habe die Zahl der Anfragen pro Name gemessen und kann sie begründen.
- [ ] Ich weiß, wie ich einen Service in einem anderen Namespace anspreche.

--8<-- "issue-feedback.md"
