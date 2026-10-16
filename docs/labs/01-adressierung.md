# 01 · Adressierung

<a class="md-button" href="../../pdf/01-adressierung.pdf">:material-file-pdf-box: Als PDF herunterladen</a>

--8<-- "konventionen.md"

Jeder Pod hat eine eigene IP-Adresse. Wie sieht das Netz aus, in dem er lebt? Ist
es ein Subnetz wie im Lehrbuch, mit Maske, Broadcast und Gateway? Ihr
untersucht das, bevor ihr irgendetwas konfiguriert, denn in der ICC
konfiguriert ihr nichts. Ihr beobachtet, was die Plattform für euch entschieden
hat.

## Lernziele

Nach dem Versuch könnt ihr …

- Adresse, Maske, Standardroute und Nachbartabelle eines Pods **ablesen**,
- erklären, warum die Maske `/32` nicht heißt, dass der Pod allein ist,
- mit `traceroute` und der **TTL** sehen, ob zwei Pods auf demselben Knoten
  laufen,
- die Rolle des **Knotens als Router** beschreiben.

## Aufbau

Zwei Pods, einmal auf demselben Knoten und einmal auf verschiedenen.

=== "Bash"

    ```bash
    export NS=wab123
    kubectl create ns $NS-lab01
    until kubectl auth can-i create pods -n $NS-lab01 | grep -q yes \
       && kubectl auth can-i get pods -n $NS-lab01 | grep -q yes; do sleep 1; done
    ```

=== "PowerShell"

    ```powershell
    $NS = "wab123"
    kubectl create ns "$NS-lab01"
    do { Start-Sleep 1 } until ((kubectl auth can-i create pods -n "$NS-lab01") -eq "yes" -and (kubectl auth can-i get pods -n "$NS-lab01") -eq "yes")
    ```

<!-- Trenner: sonst verschmelzen zwei Tab-Gruppen -->

=== "Bash"

    ```bash
    kubectl -n $NS-lab01 apply -f - <<'EOF'
    apiVersion: v1
    kind: Pod
    metadata: {name: a, labels: {app: a}}
    spec:
      containers:
      - name: t
        image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
        resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 200m, memory: 128Mi}}
    ---
    apiVersion: v1
    kind: Pod
    metadata: {name: nah, labels: {app: nah}}
    spec:
      affinity:
        podAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector: {matchLabels: {app: a}}
            topologyKey: kubernetes.io/hostname
      containers:
      - name: t
        image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
        resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 200m, memory: 128Mi}}
    ---
    apiVersion: v1
    kind: Pod
    metadata: {name: fern, labels: {app: fern}}
    spec:
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector: {matchLabels: {app: a}}
            topologyKey: kubernetes.io/hostname
      containers:
      - name: t
        image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
        resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 200m, memory: 128Mi}}
    EOF
    kubectl -n $NS-lab01 wait --for=condition=Ready pod --all --timeout=180s
    kubectl -n $NS-lab01 get pods -o wide
    ```

=== "PowerShell"

    ```powershell
    @'
    apiVersion: v1
    kind: Pod
    metadata: {name: a, labels: {app: a}}
    spec:
      containers:
      - name: t
        image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
        resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 200m, memory: 128Mi}}
    ---
    apiVersion: v1
    kind: Pod
    metadata: {name: nah, labels: {app: nah}}
    spec:
      affinity:
        podAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector: {matchLabels: {app: a}}
            topologyKey: kubernetes.io/hostname
      containers:
      - name: t
        image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
        resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 200m, memory: 128Mi}}
    ---
    apiVersion: v1
    kind: Pod
    metadata: {name: fern, labels: {app: fern}}
    spec:
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector: {matchLabels: {app: a}}
            topologyKey: kubernetes.io/hostname
      containers:
      - name: t
        image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
        resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 200m, memory: 128Mi}}
    '@ | kubectl -n $NS-lab01 apply -f -
    kubectl -n $NS-lab01 wait --for=condition=Ready pod --all --timeout=180s
    kubectl -n $NS-lab01 get pods -o wide
    ```

Die Spalte `NODE` zeigt, wo die Pods laufen. `nah` teilt sich den Knoten mit
`a`, `fern` liegt auf einem anderen.

## Aufgabe 1 · Das Netz eines Pods

!!! abstract "Warum das zählt"
    Überlappende oder zu knapp geplante Adressbereiche sind ein teurer Klassiker
    bei VPC-Peering und Hybrid-Anbindung. Wer weiß, wie die Plattform Adressen
    vergibt, plant Netze, die später noch wachsen können.

**Vorhersage:** Euer Pod hat die Adresse `10.233.x.y`. Welche Maske erwartet ihr?
Wo ist der Router? Schreibt es auf.

```bash
kubectl -n $NS-lab01 exec a -- ip -br addr show eth0
kubectl -n $NS-lab01 exec a -- ip route
```

!!! question "Frage 1"
    Welche Maske hat `eth0`? Liegt die Adresse von `nah` im selben Subnetz
    wie die von `a`, wenn ihr diese Maske anwendet? Wie kommt `a` dann überhaupt
    zu `nah`?

??? tip "Prüfstein"
    Bei `/32` besteht das Subnetz nur aus dem Pod selbst. Jeder andere
    Zielpunkt ist „nicht lokal" und geht über die Standardroute. Die Adresse
    `169.254.1.1` ist ein Platzhalter für den Router: Sie liegt in einem
    reservierten Bereich (Link-Local) und ist auf jedem Knoten gleich.

## Aufgabe 2 · Wer ist der Router?

!!! abstract "Warum das zählt"
    Das Standard-Gateway ist die erste Station jedes Pakets, das den eigenen
    Host verlässt, und damit der erste Verdächtige bei „ich komme nicht raus".

Die Standardroute zeigt auf `169.254.1.1`. Sie liegt im Link-Local-Bereich und
ist auf jedem Pod gleich. Findet heraus, wer dort antwortet.

```bash
kubectl -n $NS-lab01 exec a -- ip neigh
kubectl -n $NS-lab01 exec a -- ping -c2 -W2 $(kubectl -n $NS-lab01 get pod nah -o jsonpath='{.status.podIP}')
kubectl -n $NS-lab01 exec a -- ip neigh
```

**Vorhersage:** Welche Einträge habt ihr in der Nachbartabelle vor dem Ping, welche
danach? Welche MAC-Adresse hat der Router?

!!! question "Frage 2"
    Würde ein anderer Pod auf demselben Knoten dieselbe MAC-Adresse für
    `169.254.1.1` sehen? Begründet, warum ein Pod die MAC-Adresse seines
    **Nachbarpods** nie sieht.

## Aufgabe 3 · Hops zählen

!!! abstract "Warum das zählt"
    Ob zwei Dienste auf demselben Host oder in verschiedenen Zonen laufen, ändert
    Latenz und Ausfallverhalten. Mit TTL und `traceroute` seht ihr die Topologie,
    die euch die Plattform sonst verbirgt.

Der Knoten arbeitet als Router. Das erkennt ihr an der TTL: Jeder Router zieht
eins ab.

=== "Bash"

    ```bash
    A_IP=$(kubectl -n $NS-lab01 get pod a -o jsonpath='{.status.podIP}')
    kubectl -n $NS-lab01 exec nah  -- ping -c1 -W2 $A_IP | grep ttl
    kubectl -n $NS-lab01 exec fern -- ping -c1 -W2 $A_IP | grep ttl
    kubectl -n $NS-lab01 exec nah  -- traceroute -n -m6 -w1 $A_IP
    kubectl -n $NS-lab01 exec fern -- traceroute -n -m6 -w1 $A_IP
    ```

=== "PowerShell"

    ```powershell
    $A_IP = kubectl -n $NS-lab01 get pod a -o jsonpath='{.status.podIP}'
    kubectl -n $NS-lab01 exec nah  -- ping -c1 -W2 $A_IP | Select-String ttl
    kubectl -n $NS-lab01 exec fern -- ping -c1 -W2 $A_IP | Select-String ttl
    kubectl -n $NS-lab01 exec nah  -- traceroute -n -m6 -w1 $A_IP
    kubectl -n $NS-lab01 exec fern -- traceroute -n -m6 -w1 $A_IP
    ```

**Vorhersage:** Die Standard-TTL ist 64. Wie viele Hops erwartet ihr für `nah`
und wie viele für `fern`? Wie sieht die Antwort-TTL aus?

!!! question "Frage 3"
    Wie viele Router liegen zwischen `a` und `nah`, wie viele zwischen `a`
    und `fern`? Welche Zwischenadressen tauchen bei `fern` auf, und
    gehören sie zum Pod-Netz oder zu einem anderen Netz? Zeichnet den Weg.

## Aufgabe 4 · Brechen und reparieren

!!! abstract "Warum das zählt"
    Mandantenfähige Plattformen sperren Netzkonfiguration im Container bewusst.
    Sonst könnte ein Pod Adressen fälschen und fremden Verkehr an sich ziehen.

Ein Kollege behauptet: „Ich habe `ip addr add 10.233.0.5/24 dev eth0` im Pod
ausgeführt, und jetzt kann ich ins Pod-Netz routen." Probiert es aus:

```bash
kubectl -n $NS-lab01 exec a -- ip addr add 10.233.0.5/24 dev eth0
```

**Vorhersage:** Gelingt das? Warum nicht, und welche Rechte fehlen? Was sagt das
über den Unterschied zu einer virtuellen Maschine bei einem Cloud-Anbieter?

## Aufräumen

```bash
kubectl delete ns $NS-lab01
```

## Selbsttest

- [ ] Ich kann erklären, warum `/32` und die Link-Local-Adresse zusammenpassen.
- [ ] Ich erkenne an der TTL, ob zwei Pods auf demselben Knoten laufen.
- [ ] Ich weiß, dass ich in der ICC keine Netzkonfiguration im Pod ändern darf
      und warum das zur Sicherheit gehört.

--8<-- "issue-feedback.md"
