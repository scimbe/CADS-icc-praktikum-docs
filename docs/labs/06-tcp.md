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

## Aufgabe 1 · Handshake und Abbau

!!! abstract "Warum das zählt"
    „Verbindung hängt" kann an drei Stellen liegen: Aufbau, Datentransfer oder
    Abbau. Wer die Paketfolge kennt, sieht im Mitschnitt, an welcher Stelle es
    stockt. Das spart in der Fehlersuche Stunden.

**Vorhersage:** Ihr ruft eine Seite per HTTP ab. Wie viele Pakete gehen über die
Leitung, bevor das erste Byte der Anfrage fließt? Welche TCP-Flags (`S`, `.`, `P`,
`F`) erwartet ihr in welcher Reihenfolge?

```bash
A sh -c "timeout 5 tcpdump -ni eth0 -c12 'tcp port 8080' & sleep 1; curl -s -o /dev/null http://$SRV:8080/; wait"
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

Eine Verbindung braucht Zeit, um ihr Fenster zu öffnen. Schaut in eine laufende
Übertragung hinein:

```bash
A sh -c "curl -s -o /dev/null 'http://$SRV:8080/big?kb=20000' & sleep 0.05; ss -ti dst $SRV; wait"
```

**Vorhersage:** Welche **RTT** erwartet ihr zwischen zwei Pods im selben Cluster
(Millisekunden, Mikrosekunden)? Mit welchem **Congestion Window** (`cwnd`) beginnt
eine neue Verbindung?

!!! question "Frage 2"
    Wie lauten `rtt`, `mss`, `cwnd` und das Verfahren zur Überlastkontrolle? Wie
    viele Bytes darf der Server ohne Bestätigung maximal senden (`cwnd` mal
    `mss`)? Warum startet TCP mit so wenig, obwohl das Netz schnell ist?

## Aufgabe 3 · Latenz

!!! abstract "Warum das zählt"
    Zwischen zwei Regionen oder zwischen Cloud und Rechenzentrum kommen schnell
    100 ms zusammen. Jede Anfrage, die mehrere Runden braucht, vervielfacht das.
    Latenz ist die Eigenschaft, die ihr nicht wegoptimieren könnt, nur
    umgehen.

Ihr legt einen Proxy `web` an, der auf Port 9000 lauscht und an den Server
weiterreicht, und messt die Zeit zunächst ohne Störung:

```bash
A curl -s -XPOST http://$GIFT:8474/proxies -d "{\"name\":\"web\",\"listen\":\"0.0.0.0:9000\",\"upstream\":\"$SRV:8080\"}"; echo
A curl -s -o /dev/null -w "ohne Stoerung: code=%{http_code} connect=%{time_connect} gesamt=%{time_total}\n" http://$GIFT:9000/
```

Jetzt 300 ms Verzögerung auf der Antwort:

```bash
A curl -s -XPOST http://$GIFT:8474/proxies/web/toxics -d '{"name":"lat","type":"latency","attributes":{"latency":300}}'; echo
A curl -s -o /dev/null -w "mit 300 ms: code=%{http_code} connect=%{time_connect} gesamt=%{time_total}\n" http://$GIFT:9000/
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

```bash
A curl -s -XDELETE http://$GIFT:8474/proxies/web/toxics/lat

# 1) Reset: die Gegenseite bricht die Verbindung ab
A curl -s -XPOST http://$GIFT:8474/proxies/web/toxics -d '{"name":"rst","type":"reset_peer","attributes":{"timeout":0}}'; echo
A curl -s -m5 -o /dev/null -w "Reset: code=%{http_code} gesamt=%{time_total}\n" http://$GIFT:9000/
A curl -s -XDELETE http://$GIFT:8474/proxies/web/toxics/rst

# 2) Bandbreite: 100 KB/s
A curl -s -XPOST http://$GIFT:8474/proxies/web/toxics -d '{"name":"bw","type":"bandwidth","attributes":{"rate":100}}'; echo
A curl -s -m15 -o /dev/null -w "Langsam: code=%{http_code} gesamt=%{time_total} Rate=%{speed_download}\n" "http://$GIFT:9000/big?kb=1024"
A curl -s -XDELETE http://$GIFT:8474/proxies/web/toxics/bw

# 3) Timeout: nichts kommt zurueck
A curl -s -XPOST http://$GIFT:8474/proxies/web/toxics -d '{"name":"to","type":"timeout","attributes":{"timeout":0}}'; echo
A curl -s -m4 -o /dev/null -w "Timeout: code=%{http_code} gesamt=%{time_total}\n" http://$GIFT:9000/
A curl -s -XDELETE http://$GIFT:8474/proxies/web/toxics/to
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

**Vorhersage:** Welcher Weg ist schneller, und um welchen Faktor (grob)? In welcher
Spalte erwartet ihr Probleme (`Retr`)?

!!! question "Frage 5"
    Welche Durchsätze und wie viele Wiederholungen (`Retr`) zeigen beide Läufe?
    Warum treten Wiederholungen **nur** über die Knotengrenze auf? Was folgt
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
