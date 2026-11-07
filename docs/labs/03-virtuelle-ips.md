# 03 · Virtuelle IPs

<a class="md-button" href="../../pdf/03-virtuelle-ips.pdf">:material-file-pdf-box: Als PDF herunterladen</a>

--8<-- "konventionen.md"

Pods kommen und gehen, und mit ihnen ihre Adressen. Damit ein Client trotzdem
ein festes Ziel hat, setzt Kubernetes eine **virtuelle IP** davor: den
**Service**. Das ist die Plattform-Variante des Load Balancers, den ihr aus der
Cloud kennt. Eine virtuelle IP gehört keiner Schnittstelle, sie existiert nur
als Regel im Knoten. Das hat Folgen, die ihr in diesem Versuch messt.

## Lernziele

Nach dem Versuch könnt ihr …

- erklären, warum eine **ClusterIP** auf `ping` nicht antwortet, aber TCP
  funktioniert,
- die **Endpoints** eines Service lesen und daraus Fehler ableiten,
- an einem Mitschnitt zeigen, **wo** die Adressumsetzung (DNAT) stattfindet,
- zwei Fehlerbilder voneinander unterscheiden, die beide „Connection refused"
  liefern.

## Aufbau

Drei identische Webserver hinter einem Service, dazu ein Client-Pod.

=== "Bash"

    ```bash
    export NS=wab123
    kubectl create ns $NS-lab03
    until kubectl auth can-i create pods -n $NS-lab03 | grep -q yes \
       && kubectl auth can-i get pods -n $NS-lab03 | grep -q yes; do sleep 1; done

    kubectl -n $NS-lab03 apply -f - <<'EOF'
    apiVersion: apps/v1
    kind: Deployment
    metadata: {name: web}
    spec:
      replicas: 3
      selector: {matchLabels: {app: web}}
      template:
        metadata: {labels: {app: web}}
        spec:
          containers:
          - name: s
            image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
            command: ["python3", "/opt/lab/labsrv.py"]
            env: [{name: NAME, valueFrom: {fieldRef: {fieldPath: metadata.name}}}]
            resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 100m, memory: 64Mi}}
    ---
    apiVersion: v1
    kind: Service
    metadata: {name: web}
    spec:
      selector: {app: web}
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
    kubectl -n $NS-lab03 rollout status deploy/web --timeout=180s
    kubectl -n $NS-lab03 wait --for=condition=Ready pod/a --timeout=120s
    export CIP=$(kubectl -n $NS-lab03 get svc web -o jsonpath='{.spec.clusterIP}')
    A() { kubectl -n $NS-lab03 exec a -- "$@"; }
    ```

=== "PowerShell"

    ```powershell
    $NS = "wab123"
    kubectl create ns "$NS-lab03"
    do { Start-Sleep 1 } until ((kubectl auth can-i create pods -n "$NS-lab03") -eq "yes" -and (kubectl auth can-i get pods -n "$NS-lab03") -eq "yes")

    @'
    apiVersion: apps/v1
    kind: Deployment
    metadata: {name: web}
    spec:
      replicas: 3
      selector: {matchLabels: {app: web}}
      template:
        metadata: {labels: {app: web}}
        spec:
          containers:
          - name: s
            image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
            command: ["python3", "/opt/lab/labsrv.py"]
            env: [{name: NAME, valueFrom: {fieldRef: {fieldPath: metadata.name}}}]
            resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 100m, memory: 64Mi}}
    ---
    apiVersion: v1
    kind: Service
    metadata: {name: web}
    spec:
      selector: {app: web}
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
    '@ | kubectl -n "$NS-lab03" apply -f -
    kubectl -n $NS-lab03 rollout status deploy/web --timeout=180s
    kubectl -n $NS-lab03 wait --for=condition=Ready pod/a --timeout=120s
    $CIP = kubectl -n $NS-lab03 get svc web -o jsonpath='{.spec.clusterIP}'
    function A { kubectl -n "$NS-lab03" exec a -- @args }
    ```

## Aufgabe 1 · Die Adresse, die es nicht gibt

!!! abstract "Warum das zählt"
    Ein Health Check, der die Load-Balancer-Adresse anpingt, meldet „tot",
    obwohl der Dienst läuft. Virtuelle IPs verhalten sich anders als Hosts, und
    Überwachung muss das berücksichtigen.

**Vorhersage:** Der Service hat die Adresse `$CIP`. Antwortet sie auf `ping`? Auf
HTTP? Begründet vorher.

```bash
echo $CIP
A ping -c2 -W2 $CIP
A curl -s -m3 http://$CIP/
kubectl -n $NS-lab03 get pods -o wide
```

!!! question "Frage 1"
    Welche Antwort liefert der Service auf `ping`, welche auf HTTP? Welche der
    Pod-Adressen aus `get pods -o wide` ist mit `$CIP` identisch?

??? tip "Prüfstein"
    Der Knoten kennt eine Regel „TCP-Pakete an `$CIP:80` gehen an einen der
    Endpoints auf Port 8080". Für ICMP gibt es keine Regel, und es gibt auch
    keinen Pod, der die Adresse als seine eigene trägt. Deshalb antwortet euer
    **Knoten** selbst mit `Destination Port Unreachable`: Er kennt die Adresse,
    hat für ICMP aber kein Ziel.

## Aufgabe 2 · Verteilung

!!! abstract "Warum das zählt"
    Die Verteilung pro **Verbindung** statt pro Anfrage erklärt, warum ein
    Backend heiß läuft, während die anderen leer stehen, etwa bei langlebigen
    Verbindungen wie gRPC oder WebSockets.

Ruft den Service achtmal auf und zählt, welcher Pod antwortet:

=== "Bash"

    ```bash
    for i in 1 2 3 4 5 6 7 8; do A curl -s -m3 http://$CIP/ | head -1; done | sort | uniq -c
    ```

=== "PowerShell"

    ```powershell
    1..8 | ForEach-Object { A curl -s -m3 http://$CIP/ | Select-Object -First 1 } | Sort-Object | Group-Object | ForEach-Object { "{0,7} {1}" -f $_.Count, $_.Name }
    ```

Zum Vergleich holt **ein** `curl` die Seite viermal über **eine** Verbindung.
Achtet auf die Zeilen `hello from …`:

```bash
A curl -s -m3 http://$CIP/ http://$CIP/ http://$CIP/ http://$CIP/
```

**Vorhersage:** Gleichmäßig? Der Reihe nach (Round Robin)? Zufällig? Und bei
der einen Verbindung?

!!! question "Frage 2"
    Wie verteilen sich die Antworten? Ändert sich die Verteilung bei einer
    neuen Verbindung gegenüber einer bestehenden? Welche Konsequenz hat das
    für einen Client, der **eine** TCP-Verbindung lange offen hält?

## Aufgabe 3 · Wo wird umgeschrieben?

!!! abstract "Warum das zählt"
    Welche Quelladresse euer Server sieht, entscheidet über Zugriffsprotokolle,
    Rate Limits und IP-Freigaben. Hinter manchen Load Balancern sieht der Server
    nur noch die Adresse des Balancers.

**Vorhersage:** Ein Client schickt an `$CIP:80`. Welche Zieladresse steht im
Paket, wenn es den **Client** verlässt, und welche, wenn es im **Server-Pod**
ankommt? Schreibt beide auf, bevor ihr misst.

`$CIP` und `A` gelten nur in dem Terminal, in dem ihr den Vorbereitungsblock
ausgeführt habt. Zeigt die erste Zeile `CIP=` ohne Adresse, führt ihn in diesem
Terminal erneut aus, sonst schneidet `tcpdump` nichts mit.

Mitschnitt im **Client**:

=== "Bash"

    ```bash
    echo "CIP=$CIP"
    kubectl -n $NS-lab03 exec a -- sh -c "timeout 6 tcpdump -ni eth0 -c4 'tcp port 80 or tcp port 8080' 2>&1" &
    sleep 2
    A curl -s -m3 -o /dev/null http://$CIP/
    wait
    ```

=== "PowerShell"

    ```powershell
    "CIP=$CIP"
    $job = Start-Job { param($ns) kubectl -n $ns exec a -- sh -c "timeout 8 tcpdump -ni eth0 -c4 'tcp port 80 or tcp port 8080' 2>&1" } -ArgumentList "$NS-lab03"
    Start-Sleep 3
    A curl -s -m3 -o /dev/null http://$CIP/
    Receive-Job $job -Wait -AutoRemoveJob
    ```

Mitschnitt in einem **Server-Pod** (der erste der Liste). Weil nicht jede Anfrage
bei ihm landet, schickt ihr zwölf:

=== "Bash"

    ```bash
    POD=$(kubectl -n $NS-lab03 get pod -l app=web -o jsonpath='{.items[0].metadata.name}')
    kubectl -n $NS-lab03 exec $POD -- sh -c "timeout 8 tcpdump -ni eth0 -c4 'tcp port 8080' 2>&1" &
    sleep 2
    for i in 1 2 3 4 5 6 7 8 9 10 11 12; do A curl -s -m3 -o /dev/null http://$CIP/; done
    wait
    ```

=== "PowerShell"

    ```powershell
    $POD = kubectl -n $NS-lab03 get pod -l app=web -o jsonpath='{.items[0].metadata.name}'
    $job = Start-Job { param($ns, $pod) kubectl -n $ns exec $pod -- sh -c "timeout 10 tcpdump -ni eth0 -c4 'tcp port 8080' 2>&1" } -ArgumentList "$NS-lab03", $POD
    Start-Sleep 3
    1..12 | ForEach-Object { A curl -s -m3 -o /dev/null http://$CIP/ }
    Receive-Job $job -Wait -AutoRemoveJob
    ```

Der Block braucht etwa 15 s. Seht ihr nur `listening on eth0` und
`0 packets captured`, hat zufällig kein Aufruf diesen Pod getroffen:
Wiederholt ihn.

`tcpdump` schreibt seine Hinweise (`listening on eth0 …`) auf den Fehlerkanal.
Das angehängte `2>&1` leitet sie in die normale Ausgabe um, damit PowerShell
sie nicht als roten Fehler meldet. Die Pakete folgen darunter.

!!! question "Frage 3"
    Welche Adresse und welcher Port stehen im Client-Mitschnitt, welche im
    Server-Mitschnitt? Wo sitzt die Umsetzung? Welche **Quelladresse** sieht der
    Server, die des Clients oder die eines Knotens? Warum ist das für
    Zugriffsprotokolle wichtig?

## Aufgabe 4 · Zwei Fehler, ein Symptom

!!! abstract "Warum das zählt"
    Ein Service ohne Ziele ist einer der häufigsten Fehler nach einem Deployment:
    Der Tippfehler im Label fällt erst auf, wenn Verkehr ankommt. Der Blick auf
    die Endpoints entscheidet, ob ihr in Minuten oder in Stunden fertig seid.

Beide Fehler führen zu „Connection refused": `curl` zeigt `code=000` (keine
HTTP-Antwort), und `kubectl` meldet darunter `command terminated with exit
code 7` (curl-Code 7). Ihr erkennt die Fehler nur an den **Endpoints**. Die
Warnung `v1 Endpoints is deprecated` könnt ihr ignorieren.

**Fehler A, falscher Selector:**

```bash
kubectl -n $NS-lab03 patch svc web -p 'spec: {selector: {app: wbe}}'
kubectl -n $NS-lab03 get endpoints web
A curl -s -m4 -o /dev/null -w "code=%{http_code} time=%{time_total}\n" http://$CIP/
kubectl -n $NS-lab03 patch svc web -p 'spec: {selector: {app: web}}'
```

**Fehler B, falscher Zielport:**

=== "Bash"

    ```bash
    kubectl -n $NS-lab03 patch svc web --type=json \
      -p '[{op: replace, path: /spec/ports/0/targetPort, value: 8081}]'
    kubectl -n $NS-lab03 get endpoints web
    A curl -s -m4 -o /dev/null -w "code=%{http_code} time=%{time_total}\n" http://$CIP/
    kubectl -n $NS-lab03 patch svc web --type=json \
      -p '[{op: replace, path: /spec/ports/0/targetPort, value: 8080}]'
    ```

=== "PowerShell"

    ```powershell
    kubectl -n $NS-lab03 patch svc web --type=json -p '[{op: replace, path: /spec/ports/0/targetPort, value: 8081}]'
    kubectl -n $NS-lab03 get endpoints web
    A curl -s -m4 -o /dev/null -w "code=%{http_code} time=%{time_total}\n" http://$CIP/
    kubectl -n $NS-lab03 patch svc web --type=json -p '[{op: replace, path: /spec/ports/0/targetPort, value: 8080}]'
    ```

Die Patches stehen in YAML-Schreibweise, weil Windows PowerShell 5.1 die
Anführungszeichen in JSON entfernt. Zeigt `curl` direkt nach dem Patch noch
`code=200`, wiederholt es nach zwei Sekunden: Die Regeln auf den Knoten folgen
der Änderung mit kurzer Verzögerung.

**Vorhersage:** Was zeigt `get endpoints` jeweils? Wie schnell kommt der Fehler?

!!! question "Frage 4"
    Wie unterscheiden sich beide Fehler in der Endpoints-Liste? Wer sendet die
    Zurückweisung bei A, wer bei B? (Tipp: Gibt es bei A überhaupt einen Pod, der
    antworten könnte?)

## Aufgabe 5 · Der Name statt der Adresse

!!! abstract "Warum das zählt"
    Feste Adressen in Konfigurationen brechen beim ersten Neustart. Namen sind
    der Vertrag zwischen Diensten, und DNS ist deshalb eine Abhängigkeit
    jeder Anwendung.

```bash
A curl -s -m3 http://web/
```

**Vorhersage:** Wie findet `curl` die Adresse zu `web`? Die Antwort liefert
Versuch 04.

## Aufräumen

```bash
kubectl delete ns $NS-lab03
```

## Selbsttest

- [ ] Ich weiß, warum `ping` auf eine ClusterIP scheitert, TCP aber geht.
- [ ] Ich erkenne an den Endpoints, ob ein Service Ziele hat.
- [ ] Ich weiß, auf welcher Seite die Adressumsetzung sichtbar wird.

--8<-- "issue-feedback.md"
