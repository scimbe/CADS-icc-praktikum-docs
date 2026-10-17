# 02 · ICMP, TTL & MTU

<a class="md-button" href="../../pdf/02-icmp-ttl-mtu.pdf">:material-file-pdf-box: Als PDF herunterladen</a>

--8<-- "konventionen.md"

IP liefert Pakete aus, ohne zu garantieren, dass sie ankommen. Wenn etwas
schiefgeht, meldet **ICMP** den Fehler. In diesem Versuch benutzt ihr ICMP als
Messgerät: Ihr lasst Pakete absichtlich sterben (TTL), absichtlich zu groß
werden (MTU) und beobachtet, wer euch antwortet.

## Lernziele

Nach dem Versuch könnt ihr …

- mit der **TTL** den Weg eines Pakets Hop für Hop sichtbar machen,
- die **MTU** eures Pfads bestimmen und die größte Nutzlast ausrechnen,
- **Fragmentierung** erkennen und erklären, warum man sie vermeiden will,
- erklären, warum TCP trotz MTU-Grenze funktioniert (**MSS**).

## Aufbau

=== "Bash"

    ```bash
    export NS=wab123
    kubectl create ns $NS-lab02
    until kubectl auth can-i create pods -n $NS-lab02 | grep -q yes \
       && kubectl auth can-i get pods -n $NS-lab02 | grep -q yes; do sleep 1; done

    kubectl -n $NS-lab02 apply -f - <<'EOF'
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
    metadata: {name: srv, labels: {app: srv}}
    spec:
      containers:
      - name: s
        image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
        command: ["python3", "/opt/lab/labsrv.py"]
        resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 100m, memory: 64Mi}}
    EOF
    kubectl -n $NS-lab02 wait --for=condition=Ready pod --all --timeout=180s
    export SRV=$(kubectl -n $NS-lab02 get pod srv -o jsonpath='{.status.podIP}')
    A() { kubectl -n $NS-lab02 exec a -- "$@"; }
    ```

=== "PowerShell"

    ```powershell
    $NS = "wab123"
    kubectl create ns "$NS-lab02"
    do { Start-Sleep 1 } until ((kubectl auth can-i create pods -n "$NS-lab02") -eq "yes" -and (kubectl auth can-i get pods -n "$NS-lab02") -eq "yes")

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
    metadata: {name: srv, labels: {app: srv}}
    spec:
      containers:
      - name: s
        image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
        command: ["python3", "/opt/lab/labsrv.py"]
        resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 100m, memory: 64Mi}}
    '@ | kubectl -n "$NS-lab02" apply -f -
    kubectl -n $NS-lab02 wait --for=condition=Ready pod --all --timeout=180s
    $SRV = kubectl -n $NS-lab02 get pod srv -o jsonpath='{.status.podIP}'
    function A { kubectl -n "$NS-lab02" exec a -- @args }
    ```

`A` führt einen Befehl im Pod `a` aus: `A ping …` bedeutet
`kubectl -n $NS-lab02 exec a -- ping …`.

!!! warning "Anführungszeichen"
    Die Shell auf dem Mac (zsh) deutet ein `?` in einer URL als Platzhalter und
    bricht ab. Setzt URLs mit `?` deshalb immer in Anführungszeichen.

## Aufgabe 1 · Pakete sterben lassen

!!! abstract "Warum das zählt"
    `traceroute` und `ping -t` sind die Standardwerkzeuge, um bei einem
    Verbindungsproblem herauszufinden, **an welchem Hop** es endet, ob in
    eurem Netz, beim Provider oder beim Ziel.

Jeder Router zieht von der TTL eins ab. Wird sie null, verwirft er das Paket und
schickt eine ICMP-Meldung „Time to live exceeded" an den Absender, mit **seiner
eigenen Adresse**.

**Vorhersage:** Ihr schickt Pings mit TTL 1, 2 und 3. Wer antwortet jeweils?

=== "Bash"

    ```bash
    for t in 1 2 3; do A ping -c1 -W2 -t $t $SRV; done
    ```

=== "PowerShell"

    ```powershell
    1..3 | ForEach-Object { A ping -c1 -W2 -t $_ $SRV }
    ```

!!! question "Frage 1"
    Bei welcher TTL erreicht der Ping den Zielpod? Welche Adressen sind die
    Absender der Fehlermeldungen? Vergleicht mit dem Ergebnis von `traceroute`
    aus Versuch 01, und erklärt, wie `traceroute` die TTL benutzt.

## Aufgabe 2 · Die größte Nutzlast

!!! abstract "Warum das zählt"
    Tunnel, VPN und Overlay-Netze kosten Kopfbytes. Eine falsch angenommene MTU
    ist eine der häufigsten Ursachen für Verbindungen, die „fast" funktionieren.

Ein Ethernet-Rahmen trägt normalerweise 1500 Byte. Hier ist die Schnittstelle
kleiner:

```bash
A cat /sys/class/net/eth0/mtu
```

**Vorhersage:** Ein ICMP-Echo trägt 8 Byte ICMP-Kopf und 20 Byte IP-Kopf. Wie groß
darf die Nutzlast bei `ping -s` höchstens sein, damit das Paket noch **ohne
Fragmentierung** durchgeht? Probiert eure Zahl und ihre Nachbarn aus. Das Flag
`-M do` setzt „Don't Fragment":

```bash
A ping -c1 -W2 -M do -s 1422 $SRV
A ping -c1 -W2 -M do -s 1423 $SRV
```

!!! question "Frage 2"
    Wie lautet die Fehlermeldung bei zu großer Nutzlast, und **wer** meldet sie:
    ein Router unterwegs oder euer eigener Pod? Welche MTU nennt sie?

??? tip "Prüfstein"
    Eine MTU von 1450 statt 1500 deutet auf ein **Overlay** hin: Das Pod-Netz
    wird zwischen den Knoten in einen Tunnel gepackt, und der Tunnelkopf kostet
    50 Byte. Genau das macht auch ein VPC-Peering oder ein VPN in der Cloud.

## Aufgabe 3 · Fragmentierung sehen

!!! abstract "Warum das zählt"
    Fragmentierung kostet Durchsatz, und viele Firewalls verwerfen Fragmente.
    Wer sie im Mitschnitt erkennt, findet die Ursache für Leistungseinbrüche
    schnell.

Ohne DF-Flag dürfen Pakete zerlegt werden. Schickt ein großes Echo und beobachtet
die Pakete auf der Leitung:

=== "Bash"

    ```bash
    kubectl -n $NS-lab02 exec a -- sh -c "timeout 4 tcpdump -ni eth0 -c6 \
      'icmp or ip[6:2] & 0x1fff != 0' & sleep 1; ping -c1 -W2 -s 3000 $SRV; wait"
    ```

=== "PowerShell"

    ```powershell
    kubectl -n $NS-lab02 exec a -- sh -c "timeout 4 tcpdump -ni eth0 -c6 'icmp or ip[6:2] & 0x1fff != 0' & sleep 1; ping -c1 -W2 -s 3000 $SRV; wait"
    ```

**Vorhersage:** In wie viele Stücke wird das 3000-Byte-Echo zerlegt, wenn jedes
Stück höchstens die MTU lang ist?

!!! question "Frage 3"
    Wie viele Pakete seht ihr in jede Richtung? Warum ist nur das erste Stück als
    „ICMP echo" erkennbar? Was passiert, wenn **ein** Fragment verloren geht?

## Aufgabe 4 · Warum TCP das nie merkt

!!! abstract "Warum das zählt"
    MSS-Clamping ist das Standardmittel an VPN-Gateways und Load Balancern.
    Wer versteht, wie TCP die Segmentgröße aushandelt, behebt MTU-Probleme,
    ohne zu raten.

Eine HTTP-Antwort von einem Megabyte kommt durch, obwohl sie viel größer als
die MTU ist. Seht nach, welche Segmentgröße TCP wählt:

=== "Bash"

    ```bash
    A curl -s -m10 -o /dev/null -w "code=%{http_code} bytes=%{size_download}\n" "http://$SRV:8080/big?kb=1024"
    A sh -c "curl -s -o /dev/null 'http://$SRV:8080/big?kb=20000' & sleep 0.05; ss -ti dst $SRV; wait"
    ```

=== "PowerShell"

    ```powershell
    A curl -s -m10 -o /dev/null -w "code=%{http_code} bytes=%{size_download}\n" "http://${SRV}:8080/big?kb=1024"
    A sh -c "curl -s -o /dev/null 'http://${SRV}:8080/big?kb=20000' & sleep 0.05; ss -ti dst $SRV; wait"
    ```

!!! tip "Kommt nur die Kopfzeile?"
    Der Messbefehl startet `curl` und fragt nach 50 ms `ss` ab. Ist die
    Verbindung noch nicht da, erscheint nur die Kopfzeile. Wiederholt den Befehl.

**Vorhersage:** Welche **MSS** erwartet ihr bei einer MTU von 1450 und je 20 Byte IP-
und TCP-Kopf? In der Ausgabe stehen `mss` und `pmtu`.

!!! question "Frage 4"
    Der gemessene Wert liegt 12 Byte unter eurer Rechnung. Das sind die
    TCP-Optionen, vor allem der Zeitstempel. Warum zählen sie zur
    Kopfgröße?

## Aufgabe 5 · Brechen und reparieren

!!! abstract "Warum das zählt"
    „Kleine Anfragen gehen, große hängen" ist ein echtes Fehlerbild aus
    Betriebsteams. Es kostet ohne Vorwissen oft Tage der Suche.

Eine Kollegin meldet: „Kleine Anfragen gehen, große hängen." Das ist das
klassische Zeichen für ein MTU-Problem hinter einer Firewall, die ICMP „Fragmentation
needed" verwirft. Überlegt:

1. Warum hängt dann gerade die **große** Antwort und nicht die kleine?
2. Welche Gegenmaßnahmen kennt ihr (MSS-Clamping, ICMP erlauben, kleinere MTU)?
3. Warum fällt das in der ICC selten auf, in einer VPN-Strecke zwischen zwei
   Clouds aber oft?

## Aufräumen

```bash
kubectl delete ns $NS-lab02
```

## Selbsttest

- [ ] Ich kann aus einer MTU die größte `ping -s`-Nutzlast ohne Fragmentierung
      ausrechnen und habe sie gemessen.
- [ ] Ich weiß, wer bei „Time to live exceeded" der Absender ist.
- [ ] Ich kann erklären, warum TCP die MTU nicht überschreitet.

--8<-- "issue-feedback.md"
