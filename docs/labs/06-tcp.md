# 06 · TCP

<a class="md-button" href="../../pdf/06-tcp.pdf">:material-file-pdf-box: Als PDF herunterladen</a>

--8<-- "konventionen.md"

IP liefert Pakete aus und mehr nicht. **TCP** macht daraus eine zuverlässige
Verbindung: mit Handshake, Bestätigungen, Wiederholungen und Flusskontrolle. Das
meiste, was Anwendungen als „das Netz ist kaputt" melden, ist ein
TCP-Verhalten. Ihr schaut euch den Verbindungsaufbau an, lest den Zustand einer
laufenden Verbindung aus und **erzeugt gezielt Störungen**, um zu sehen, wie sie
sich in der Anwendung anfühlen.

## Lernziele

Nach dem Versuch könnt ihr …

- den **Drei-Wege-Handshake** und den Abbau im Mitschnitt benennen,
- den Zustand einer Verbindung mit `ss -ti` lesen (MSS, RTT, Congestion Window),
- drei Fehlerbilder anhand des curl-Codes und der Zeit unterscheiden:
  **Reset**, **Timeout**, **langsam**,
- erklären, warum der Weg über einen Knotenrand **Durchsatz kostet**.

## Aufbau

Ein Server (`srv`), ein Client (`a`) und ein Störer (`gift`). Der Störer ist ein
**TCP-Proxy** (toxiproxy), in den ihr per HTTP-Aufruf Fehler einbaut. Er
braucht keine Sonderrechte, anders als `tc`, das hier gesperrt ist.

=== "Bash"

    ```bash
    export NS=wab123
    kubectl create ns $NS-lab06
    until kubectl auth can-i create pods -n $NS-lab06 | grep -q yes \
       && kubectl auth can-i get pods -n $NS-lab06 | grep -q yes; do sleep 1; done

    kubectl -n $NS-lab06 apply -f - <<'EOF'
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
    kind: Pod
    metadata: {name: gift, labels: {app: gift}}
    spec:
      containers:
      - name: t
        image: ghcr.io/shopify/toxiproxy:2.9.0
        args: ["-host", "0.0.0.0"]
        resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 100m, memory: 64Mi}}
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
    kubectl -n $NS-lab06 wait --for=condition=Ready pod --all --timeout=180s
    export SRV=$(kubectl -n $NS-lab06 get pod srv -o jsonpath='{.status.podIP}')
    export GIFT=$(kubectl -n $NS-lab06 get pod gift -o jsonpath='{.status.podIP}')
    A() { kubectl -n $NS-lab06 exec a -- "$@"; }
    ```

=== "PowerShell"

    ```powershell
    $NS = "wab123"
    kubectl create ns "$NS-lab06"
    do { Start-Sleep 1 } until ((kubectl auth can-i create pods -n "$NS-lab06") -eq "yes" -and (kubectl auth can-i get pods -n "$NS-lab06") -eq "yes")

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
    kind: Pod
    metadata: {name: gift, labels: {app: gift}}
    spec:
      containers:
      - name: t
        image: ghcr.io/shopify/toxiproxy:2.9.0
        args: ["-host", "0.0.0.0"]
        resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 100m, memory: 64Mi}}
    ---
    apiVersion: v1
    kind: Pod
    metadata: {name: a}
    spec:
      containers:
      - name: t
        image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
        resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 200m, memory: 128Mi}}
    '@ | kubectl -n "$NS-lab06" apply -f -
    kubectl -n "$NS-lab06" wait --for=condition=Ready pod --all --timeout=180s
    $SRV = kubectl -n "$NS-lab06" get pod srv -o jsonpath='{.status.podIP}'
    $GIFT = kubectl -n "$NS-lab06" get pod gift -o jsonpath='{.status.podIP}'
    function A { kubectl -n "$NS-lab06" exec a -- @args }
    ```

??? info "Deep Dive in die Aufgabe: Was hier Kubernetes ist und was Rechnernetze"

    **Kubernetes-Anwendungswissen:** Pods für Server, Client und Störer, `kubectl exec`
    und Affinitätsregeln, die Pods auf denselben oder verschiedene Knoten legen.

    **Rechnernetze-Wissen:** TCP selbst: Drei-Wege-Handshake und Verbindungsabbau,
    Bestätigungen, RTT, MSS, Congestion Window und Empfangsfenster, die
    Unterscheidung von Reset, Timeout und langsamer Verbindung sowie der
    Durchsatz einer Strecke.

    Der Pod-Aufbau ist nur der Prüfstand. Die Begriffe und Messgrößen, die ihr mit `tcpdump`,
    `ss` und `iperf3` lest, sind in jedem TCP-Netz dieselben. Passende Grundlagen findet ihr in
    [Blatt 04 · TCP/UDP & Congestion Control](https://scimbe.github.io/CADS-praktikum-docs/labs/04-tcp-udp-congestion/).

??? info "Deep Dive in die Aufgabe: Warum gibt es die Hilfsfunktion A, und was sind SRV und GIFT?"

    `A` führt einen Befehl im Client-Pod `a` aus (`kubectl -n $NS-lab06 exec a -- …`).
    `SRV` und `GIFT` sind die Pod-Adressen von Server und Störer, die der Aufbau per
    `kubectl get pod … -o jsonpath` ausliest. Ihr spart euch das Abschreiben von
    Adressen, die sich bei jedem Aufbau ändern.

    Im Pod ausgeführt heißt: Alle Messungen zeigen die Sicht des Clients. Den Zustand
    der Verbindung auf der Serverseite lest ihr dagegen mit `kubectl exec srv`
    direkt dort, wie Aufgabe 2 es zeigt. Auf welcher Seite man misst, ist eine
    fachliche Entscheidung, keine Bequemlichkeit.

## Aufgabe 1 · Handshake und Abbau

!!! abstract "Warum das zählt"
    „Verbindung hängt" kann an drei Stellen liegen: Aufbau, Datentransfer oder
    Abbau. Wer die Paketfolge kennt, sieht im Mitschnitt, an welcher Stelle es
    stockt. Das spart in der Fehlersuche Stunden.

**Vorhersage:** Ihr ruft eine Seite per HTTP ab. Wie viele Pakete gehen über die
Leitung, bevor das erste Byte der Anfrage fließt? Welche TCP-Flags (`S`, `.`, `P`,
`F`) erwartet ihr in welcher Reihenfolge?

=== "Bash"

    ```bash
    A sh -c "timeout 5 tcpdump -ni eth0 -c12 'tcp port 8080' & sleep 1; curl -s -o /dev/null http://$SRV:8080/; wait"
    ```

=== "PowerShell"

    ```powershell
    A sh -c "timeout 5 tcpdump -ni eth0 -c12 'tcp port 8080' & sleep 1; curl -s -o /dev/null http://${SRV}:8080/; wait"
    ```

!!! question "Frage 1"
    Welche drei Pakete bilden den Handshake? Welche **Option** bietet jede Seite
    im ersten Paket an (Stichwort `mss`)? Wer beendet die Verbindung zuerst
    (`F`), und warum beendet sie nicht der Server?

??? tip "Prüfstein"
    `[S]` Anfrage, `[S.]` Antwort mit Bestätigung, `[.]` Bestätigung des
    Clients: Erst danach gibt es Nutzdaten (`[P.]`). Der Abbau besteht aus zwei
    `F`, die jeweils bestätigt werden.

## Aufgabe 2 · Eine Verbindung ablesen

!!! abstract "Warum das zählt"
    `ss -ti` zeigt, ob eine Verbindung langsam ist, weil das Netz langsam ist
    (RTT) oder weil TCP vorsichtig ist (Congestion Window). Das entscheidet, ob
    ihr am Netz oder an der Anwendung sucht.

Eine Verbindung braucht Zeit, um ihr Fenster zu öffnen. Die Daten fließen vom
Server zum Client, also zählt das Fenster des **Servers**. Schaut euch zuerst
eine frische Verbindung beim Server an. Der Aufruf `/slow?s=3` hält die
Verbindung drei Sekunden offen, bevor der Server antwortet.

**Vorhersage:** Welche **RTT** erwartet ihr zwischen zwei Pods im selben Cluster
(Millisekunden, Mikrosekunden)? Mit welchem **Congestion Window** (`cwnd`) beginnt
eine neue Verbindung, und wie groß ist es nach etwa einer Sekunde Übertragung? (Der Wert
schwankt von Lauf zu Lauf stark.)

=== "Bash"

    ```bash
    A sh -c "curl -s -o /dev/null 'http://$SRV:8080/slow?s=3' >/dev/null 2>&1 &"
    kubectl -n $NS-lab06 exec srv -- ss -ti sport = :8080
    ```

=== "PowerShell"

    ```powershell
    A sh -c "curl -s -o /dev/null 'http://${SRV}:8080/slow?s=3' >/dev/null 2>&1 &"
    kubectl -n "$NS-lab06" exec srv -- ss -ti sport = :8080
    ```

Wartet drei Sekunden. Jetzt dieselbe Ansicht **während** einer gebremsten
Übertragung (20 MB mit 4 MB/s, also etwa 5 s):

=== "Bash"

    ```bash
    A sh -c "curl -s --limit-rate 4M -o /dev/null 'http://$SRV:8080/big?kb=20000' >/dev/null 2>&1 &"
    kubectl -n $NS-lab06 exec srv -- ss -ti sport = :8080
    ```

=== "PowerShell"

    ```powershell
    A sh -c "curl -s --limit-rate 4M -o /dev/null 'http://${SRV}:8080/big?kb=20000' >/dev/null 2>&1 &"
    kubectl -n "$NS-lab06" exec srv -- ss -ti sport = :8080
    ```

!!! tip "Was ihr lest"
    `rtt` ist ein gleitender Mittelwert. Während der gebremsten Übertragung
    steigt er auf rund 20 ms, weil `curl` absichtlich langsam liest; die
    Laufzeit der Leitung steht in `minrtt`. `rwnd_limited` zeigt, wie lange
    das Empfangsfenster des Clients bremste und nicht `cwnd`. Stehen zwei
    `ESTAB`-Zeilen da, gehört die mit großem `bytes_sent` zur Übertragung.

!!! question "Frage 2"
    Wie lauten `rtt`, `mss`, `cwnd` und das Verfahren zur Überlastkontrolle bei
    der frischen Verbindung? Wie viele Bytes darf der Server anfangs ohne
    Bestätigung senden (`cwnd` mal `mss`)? Wie groß ist `cwnd` während der
    Übertragung, und warum bremst trotzdem das Empfangsfenster
    (`rwnd_limited`)? Warum startet TCP mit so wenig, obwohl das Netz schnell
    ist?

!!! warning "Nur PowerShell 7"
    Die folgenden Aufrufe schicken JSON an toxiproxy. Windows PowerShell 5.1
    entfernt dabei die Anführungszeichen. toxiproxy antwortet dann mit
    `bad request body: invalid character …` oder `proxy not found`, und die
    Messungen zeigen `code=000 exit=7` (oder, falls der Proxy vorher in `pwsh`
    angelegt wurde, ohne Störung `code=200`). Das sind
    **keine** Messergebnisse. Prüft mit `$PSVersionTable.PSVersion`, dass ihr
    in `pwsh` 7.4+ arbeitet. Habt ihr in 5.1 angefangen, öffnet `pwsh`, setzt
    `KUBECONFIG` und führt den Aufbaublock erneut aus (`AlreadyExists` und
    `unchanged` sind harmlos). Beginnt dann Aufgabe 3 von vorn.

??? info "Deep Dive in die Aufgabe: Warum ist der Störer ein Proxy und kein tc?"

    Mit dem Linux-Werkzeug `tc` könnte man Verzögerung oder Verluste direkt an
    einer Schnittstelle einstellen. Das braucht Netzwerkrechte im Container, und die
    sind in der ICC gesperrt (Versuch 01, Aufgabe 4). Deshalb steht im Aufbau ein
    eigener Pod `gift` mit **toxiproxy**: ein TCP-Proxy, den ihr über seine
    HTTP-Schnittstelle (Port 8474) konfiguriert.

    Euer Client spricht dann nicht mehr mit `srv:8080`, sondern mit `gift:9000`; der
    Proxy reicht die Daten weiter und baut die gewählte Störung ein. Das ist ein
    Plattformwerkzeug, das ein fehlendes Recht umgeht, ohne dass ihr es braucht.
    Die Frage, was ein Proxy für eure Messung bedeutet (Frage 3), bleibt fachlich
    eure.

## Aufgabe 3 · Latenz

!!! abstract "Warum das zählt"
    Zwischen zwei Regionen oder zwischen Cloud und Rechenzentrum kommen schnell
    100 ms zusammen. Jede Anfrage, die mehrere Runden braucht, vervielfacht das.
    Latenz ist die Eigenschaft, die ihr nicht wegoptimieren könnt, nur
    umgehen.

Ihr legt einen Proxy `web` an, der auf Port 9000 lauscht und an den Server
weiterreicht, und messt die Zeit zunächst ohne Störung:

=== "Bash"

    ```bash
    A curl -s -XPOST http://$GIFT:8474/proxies -d "{\"name\":\"web\",\"listen\":\"0.0.0.0:9000\",\"upstream\":\"$SRV:8080\"}"; echo
    A curl -s -o /dev/null -w "ohne Stoerung: code=%{http_code} exit=%{exitcode} connect=%{time_connect} gesamt=%{time_total}\n" http://$GIFT:9000/
    ```

=== "PowerShell"

    ```powershell
    $body = @{name="web"; listen="0.0.0.0:9000"; upstream="${SRV}:8080"} | ConvertTo-Json -Compress
    A curl -s -XPOST "http://${GIFT}:8474/proxies" -d $body; ""
    A curl -s -o /dev/null -w "ohne Stoerung: code=%{http_code} exit=%{exitcode} connect=%{time_connect} gesamt=%{time_total}\n" "http://${GIFT}:9000/"
    ```

Jetzt 300 ms Verzögerung auf der Antwort:

=== "Bash"

    ```bash
    A curl -s -XPOST http://$GIFT:8474/proxies/web/toxics -d '{"name":"lat","type":"latency","attributes":{"latency":300}}'; echo
    A curl -s -o /dev/null -w "mit 300 ms: code=%{http_code} exit=%{exitcode} connect=%{time_connect} gesamt=%{time_total}\n" http://$GIFT:9000/
    ```

=== "PowerShell"

    ```powershell
    A curl -s -XPOST "http://${GIFT}:8474/proxies/web/toxics" -d '{"name":"lat","type":"latency","attributes":{"latency":300}}'; ""
    A curl -s -o /dev/null -w "mit 300 ms: code=%{http_code} exit=%{exitcode} connect=%{time_connect} gesamt=%{time_total}\n" "http://${GIFT}:9000/"
    ```

**Vorhersage:** Wie viel länger dauert die Anfrage? Wird auch der **Verbindungsaufbau**
(`connect`) langsamer?

!!! question "Frage 3"
    Warum bleibt `connect` klein, obwohl die Verzögerung eingebaut ist? Wer
    hat den Handshake abgeschlossen, der Server oder der Proxy? Was bedeutet das
    für Messungen hinter einem **Load Balancer**, der TCP selbst beendet?

## Aufgabe 4 · Drei Fehlerbilder

!!! abstract "Warum das zählt"
    Die drei Symptome Reset, Timeout und „langsam" haben verschiedene Ursachen
    und verschiedene Reparaturen. Wer sie an Code und Zeit unterscheidet, schickt
    die Meldung an die richtige Stelle, statt alles „Netzwerkproblem" zu nennen.

Räumt die Verzögerung weg und baut nacheinander drei andere Störungen ein. Notiert
jeweils **curl-Code** und **Zeit**.

=== "Bash"

    ```bash
    A curl -s -XDELETE http://$GIFT:8474/proxies/web/toxics/lat

    # 1) Reset: die Gegenseite bricht die Verbindung ab
    A curl -s -XPOST http://$GIFT:8474/proxies/web/toxics -d '{"name":"rst","type":"reset_peer","attributes":{"timeout":0}}'; echo
    A curl -s -m5 -o /dev/null -w "Reset: code=%{http_code} exit=%{exitcode} gesamt=%{time_total}\n" http://$GIFT:9000/
    A curl -s -XDELETE http://$GIFT:8474/proxies/web/toxics/rst

    # 2) Bandbreite: 100 KB/s
    A curl -s -XPOST http://$GIFT:8474/proxies/web/toxics -d '{"name":"bw","type":"bandwidth","attributes":{"rate":100}}'; echo
    A curl -s -m15 -o /dev/null -w "Langsam: code=%{http_code} exit=%{exitcode} gesamt=%{time_total} Rate=%{speed_download}\n" "http://$GIFT:9000/big?kb=1024"
    A curl -s -XDELETE http://$GIFT:8474/proxies/web/toxics/bw

    # 3) Timeout: nichts kommt zurueck
    A curl -s -XPOST http://$GIFT:8474/proxies/web/toxics -d '{"name":"to","type":"timeout","attributes":{"timeout":0}}'; echo
    A curl -s -m4 -o /dev/null -w "Timeout: code=%{http_code} exit=%{exitcode} gesamt=%{time_total}\n" http://$GIFT:9000/
    A curl -s -XDELETE http://$GIFT:8474/proxies/web/toxics/to
    ```

=== "PowerShell"

    ```powershell
    A curl -s -XDELETE "http://${GIFT}:8474/proxies/web/toxics/lat"

    # 1) Reset: die Gegenseite bricht die Verbindung ab
    A curl -s -XPOST "http://${GIFT}:8474/proxies/web/toxics" -d '{"name":"rst","type":"reset_peer","attributes":{"timeout":0}}'; ""
    A curl -s -m5 -o /dev/null -w "Reset: code=%{http_code} exit=%{exitcode} gesamt=%{time_total}\n" "http://${GIFT}:9000/"
    A curl -s -XDELETE "http://${GIFT}:8474/proxies/web/toxics/rst"

    # 2) Bandbreite: 100 KB/s
    A curl -s -XPOST "http://${GIFT}:8474/proxies/web/toxics" -d '{"name":"bw","type":"bandwidth","attributes":{"rate":100}}'; ""
    A curl -s -m15 -o /dev/null -w "Langsam: code=%{http_code} exit=%{exitcode} gesamt=%{time_total} Rate=%{speed_download}\n" "http://${GIFT}:9000/big?kb=1024"
    A curl -s -XDELETE "http://${GIFT}:8474/proxies/web/toxics/bw"

    # 3) Timeout: nichts kommt zurueck
    A curl -s -XPOST "http://${GIFT}:8474/proxies/web/toxics" -d '{"name":"to","type":"timeout","attributes":{"timeout":0}}'; ""
    A curl -s -m4 -o /dev/null -w "Timeout: code=%{http_code} exit=%{exitcode} gesamt=%{time_total}\n" "http://${GIFT}:9000/"
    A curl -s -XDELETE "http://${GIFT}:8474/proxies/web/toxics/to"
    ```

**Vorhersage:** Welcher Fehler endet **sofort**, welcher erst nach dem eigenen
Zeitlimit (`-m`), welcher gar nicht, sondern dauert einfach? Welcher curl-Code
gehört zu welchem (7, 28, 56 oder 0)?

!!! question "Frage 4"
    Tragt die Beobachtung in eine Tabelle ein: Symptom, curl-Code, Zeit. Welche
    Störung würde ein Gesundheits-Check mit kurzem Zeitlimit als „tot" melden, und
    welche würde er übersehen?

## Aufgabe 5 · Der Preis der Knotengrenze

!!! abstract "Warum das zählt"
    Verkehr zwischen Zonen oder Rechenzentren kostet in der Cloud Geld und
    Durchsatz. Wie viel langsamer ein Weg über Knotengrenzen ist, könnt ihr
    selbst messen, statt es zu glauben.

Zwei Messungen mit `iperf3`: dieselbe Strecke einmal innerhalb eines Knotens, einmal
über die Knotengrenze. Beide Pods, der Server und der Client, laufen immer mit
den gleichen Grenzen.

=== "Bash"

    ```bash
    kubectl -n $NS-lab06 apply -f - <<'EOF'
    apiVersion: v1
    kind: Pod
    metadata: {name: ip-srv, labels: {app: ip-srv}}
    spec:
      containers:
      - name: t
        image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
        command: ["iperf3", "-s"]
        resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 200m, memory: 128Mi}}
    ---
    apiVersion: v1
    kind: Pod
    metadata: {name: ip-nah}
    spec:
      affinity:
        podAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector: {matchLabels: {app: ip-srv}}
            topologyKey: kubernetes.io/hostname
      containers:
      - name: t
        image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
        resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 200m, memory: 128Mi}}
    ---
    apiVersion: v1
    kind: Pod
    metadata: {name: ip-fern}
    spec:
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector: {matchLabels: {app: ip-srv}}
            topologyKey: kubernetes.io/hostname
      containers:
      - name: t
        image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
        resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 200m, memory: 128Mi}}
    EOF
    kubectl -n $NS-lab06 wait --for=condition=Ready pod/ip-srv pod/ip-nah pod/ip-fern --timeout=180s
    export IPS=$(kubectl -n $NS-lab06 get pod ip-srv -o jsonpath='{.status.podIP}')
    kubectl -n $NS-lab06 exec ip-nah  -- iperf3 -c $IPS -t 5 | tail -4
    kubectl -n $NS-lab06 exec ip-fern -- iperf3 -c $IPS -t 5 | tail -4
    ```

=== "PowerShell"

    ```powershell
    @'
    apiVersion: v1
    kind: Pod
    metadata: {name: ip-srv, labels: {app: ip-srv}}
    spec:
      containers:
      - name: t
        image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
        command: ["iperf3", "-s"]
        resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 200m, memory: 128Mi}}
    ---
    apiVersion: v1
    kind: Pod
    metadata: {name: ip-nah}
    spec:
      affinity:
        podAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector: {matchLabels: {app: ip-srv}}
            topologyKey: kubernetes.io/hostname
      containers:
      - name: t
        image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
        resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 200m, memory: 128Mi}}
    ---
    apiVersion: v1
    kind: Pod
    metadata: {name: ip-fern}
    spec:
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector: {matchLabels: {app: ip-srv}}
            topologyKey: kubernetes.io/hostname
      containers:
      - name: t
        image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
        resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 200m, memory: 128Mi}}
    '@ | kubectl -n "$NS-lab06" apply -f -
    kubectl -n "$NS-lab06" wait --for=condition=Ready pod/ip-srv pod/ip-nah pod/ip-fern --timeout=180s
    $IPS = kubectl -n "$NS-lab06" get pod ip-srv -o jsonpath='{.status.podIP}'
    kubectl -n "$NS-lab06" exec ip-nah  -- iperf3 -c $IPS -t 5 | Select-Object -Last 4
    kubectl -n "$NS-lab06" exec ip-fern -- iperf3 -c $IPS -t 5 | Select-Object -Last 4
    ```

**Vorhersage:** Welcher Weg ist schneller, und um welchen Faktor (grob)? In welcher
Spalte erwartet ihr Probleme (`Retr`)?

!!! question "Frage 5"
    Welche Durchsätze und wie viele Wiederholungen (`Retr`) zeigen beide Läufe?
    Warum treten über die Knotengrenze **deutlich mehr** Wiederholungen auf? Was folgt
    daraus für die Platzierung zweier Dienste, die viel miteinander reden?

## Aufräumen

```bash
kubectl delete ns $NS-lab06
```

## Selbsttest

- [ ] Ich kann Handshake und Abbau im Mitschnitt zeigen.
- [ ] Ich lese `rtt`, `mss` und `cwnd` aus `ss -ti` und weiß, was sie bedeuten.
- [ ] Ich unterscheide Reset, Timeout und „langsam" an curl-Code und Zeit.
- [ ] Ich habe den Preis der Knotengrenze selbst gemessen.

--8<-- "issue-feedback.md"
