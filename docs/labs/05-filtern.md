# 05 · Filtern

<a class="md-button" href="../../pdf/05-filtern.pdf">:material-file-pdf-box: Als PDF herunterladen</a>

--8<-- "konventionen.md"

In der Cloud heißt es **Security Group**, in Kubernetes **NetworkPolicy**: eine
Regelmenge, die festlegt, wer mit wem sprechen darf. Standardmäßig darf in
einem Namespace jeder mit jedem sprechen. Sobald eine Regel einen Pod auswählt,
gilt für ihn „alles verboten, was nicht erlaubt ist". Ihr baut Regeln und
beobachtet, **wie sich ein Verbot von außen anfühlt**: als Stille oder als
Absage.

## Lernziele

Nach dem Versuch könnt ihr …

- eine NetworkPolicy für eingehenden Verkehr schreiben und prüfen,
- **Timeout** (Paket verworfen) von **Connection refused** (Port zu) unterscheiden
  und daraus auf die Ursache schließen,
- erklären, warum eine Egress-Sperre **auch DNS** trifft,
- die Adresse nennen, hinter der eure Pods das Internet sehen (**Egress-NAT**).

## Aufbau

Ein Server mit Service, ein erlaubter Client (`gut`) und ein unerwünschter (`boese`).

=== "Bash"

    ```bash
    export NS=wab123
    kubectl create ns $NS-lab05
    until kubectl auth can-i create pods -n $NS-lab05 | grep -q yes \
       && kubectl auth can-i get pods -n $NS-lab05 | grep -q yes; do sleep 1; done

    kubectl -n $NS-lab05 apply -f - <<'EOF'
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
    metadata: {name: srv}
    spec:
      selector: {app: srv}
      ports: [{port: 80, targetPort: 8080}]
    ---
    apiVersion: v1
    kind: Pod
    metadata: {name: gut, labels: {rolle: gut}}
    spec:
      containers:
      - name: t
        image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
        resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 100m, memory: 64Mi}}
    ---
    apiVersion: v1
    kind: Pod
    metadata: {name: boese, labels: {rolle: boese}}
    spec:
      containers:
      - name: t
        image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
        resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 100m, memory: 64Mi}}
    EOF
    kubectl -n $NS-lab05 wait --for=condition=Ready pod --all --timeout=180s
    export SRV=$(kubectl -n $NS-lab05 get pod srv -o jsonpath='{.status.podIP}')
    G() { kubectl -n $NS-lab05 exec gut -- "$@"; }
    B() { kubectl -n $NS-lab05 exec boese -- "$@"; }
    ```

=== "PowerShell"

    ```powershell
    $NS = "wab123"
    kubectl create ns "$NS-lab05"
    do { Start-Sleep 1 } until ((kubectl auth can-i create pods -n "$NS-lab05") -eq "yes" -and (kubectl auth can-i get pods -n "$NS-lab05") -eq "yes")

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
    metadata: {name: srv}
    spec:
      selector: {app: srv}
      ports: [{port: 80, targetPort: 8080}]
    ---
    apiVersion: v1
    kind: Pod
    metadata: {name: gut, labels: {rolle: gut}}
    spec:
      containers:
      - name: t
        image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
        resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 100m, memory: 64Mi}}
    ---
    apiVersion: v1
    kind: Pod
    metadata: {name: boese, labels: {rolle: boese}}
    spec:
      containers:
      - name: t
        image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
        resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 100m, memory: 64Mi}}
    '@ | kubectl -n "$NS-lab05" apply -f -
    kubectl -n "$NS-lab05" wait --for=condition=Ready pod --all --timeout=180s
    $SRV = kubectl -n "$NS-lab05" get pod srv -o jsonpath='{.status.podIP}'
    function G { kubectl -n "$NS-lab05" exec gut -- @args }
    function B { kubectl -n "$NS-lab05" exec boese -- @args }
    ```

## Aufgabe 1 · Ohne Regeln

!!! abstract "Warum das zählt"
    Ohne Messung vorher wisst ihr hinterher nicht, was die Regel verändert hat.
    Jede Firewall-Änderung beginnt mit einer Basislinie.

**Vorhersage:** Wer kommt an den Server heran, wer nicht? Was passiert beim Zugriff
auf einen Port, auf dem **nichts** lauscht (hier 9999)?

=== "Bash"

    ```bash
    G curl -s -m3 -o /dev/null -w "gut: %{http_code}\n" http://srv/
    B curl -s -m3 -o /dev/null -w "boese: %{http_code}\n" http://srv/
    G curl -s -m3 -o /dev/null -w "Port 9999: code=%{http_code} Zeit=%{time_total}\n" http://$SRV:9999/
    ```

=== "PowerShell"

    ```powershell
    G curl -s -m3 -o /dev/null -w "gut: %{http_code}\n" http://srv/
    B curl -s -m3 -o /dev/null -w "boese: %{http_code}\n" http://srv/
    G curl -s -m3 -o /dev/null -w "Port 9999: code=%{http_code} Zeit=%{time_total}\n" "http://${SRV}:9999/"
    ```

!!! question "Frage 1"
    Wie schnell kommt die Antwort auf den geschlossenen Port, und von wem
    stammt sie? Notiert die Zeit, ihr braucht sie in Aufgabe 3.

## Aufgabe 2 · Nur der gute Client

!!! abstract "Warum das zählt"
    „Nur das Frontend darf an die Datenbank" ist die Grundregel jeder
    mehrstufigen Anwendung. Eine Regel nach **Label** statt nach Adresse
    überlebt, dass Pods ihre IP wechseln.

=== "Bash"

    ```bash
    kubectl -n $NS-lab05 apply -f - <<'EOF'
    apiVersion: networking.k8s.io/v1
    kind: NetworkPolicy
    metadata: {name: nur-gut}
    spec:
      podSelector: {matchLabels: {app: srv}}
      policyTypes: [Ingress]
      ingress:
      - from: [{podSelector: {matchLabels: {rolle: gut}}}]
        ports: [{port: 8080}]
    EOF
    sleep 4
    G curl -s -m3 -o /dev/null -w "gut: %{http_code} Zeit=%{time_total}\n" http://srv/
    B curl -s -m3 -o /dev/null -w "boese: %{http_code} Zeit=%{time_total}\n" http://srv/
    ```

=== "PowerShell"

    ```powershell
    @'
    apiVersion: networking.k8s.io/v1
    kind: NetworkPolicy
    metadata: {name: nur-gut}
    spec:
      podSelector: {matchLabels: {app: srv}}
      policyTypes: [Ingress]
      ingress:
      - from: [{podSelector: {matchLabels: {rolle: gut}}}]
        ports: [{port: 8080}]
    '@ | kubectl -n "$NS-lab05" apply -f -
    Start-Sleep 4
    G curl -s -m3 -o /dev/null -w "gut: %{http_code} Zeit=%{time_total}\n" http://srv/
    B curl -s -m3 -o /dev/null -w "boese: %{http_code} Zeit=%{time_total}\n" http://srv/
    ```

**Vorhersage:** Was sieht `boese`, eine Absage oder Stille? Wie lang dauert es?

!!! question "Frage 2"
    Welchen curl-Code liefert `boese` (28 = Zeitüberschreitung, 7 = abgelehnt)?
    Was erfährt ein Angreifer aus dieser Stille, und was aus einer Absage?

## Aufgabe 3 · Stille oder Absage?

!!! abstract "Warum das zählt"
    Verworfene Pakete lassen Clients minutenlang warten und füllen
    Verbindungstabellen. Zurückgewiesene Pakete scheitern sofort. Beides ist
    eine bewusste Entscheidung bei Firewalls und beeinflusst die Fehlersuche.

Wiederholt die Messung auf dem geschlossenen Port, jetzt **mit** Regel:

=== "Bash"

    ```bash
    G curl -s -m3 -o /dev/null -w "gut, Port 9999: code=%{http_code} Zeit=%{time_total}\n" http://$SRV:9999/
    B curl -s -m3 -o /dev/null -w "boese, Port 9999: code=%{http_code} Zeit=%{time_total}\n" http://$SRV:9999/
    G ping -c1 -W2 $SRV
    ```

=== "PowerShell"

    ```powershell
    G curl -s -m3 -o /dev/null -w "gut, Port 9999: code=%{http_code} Zeit=%{time_total}\n" "http://${SRV}:9999/"
    B curl -s -m3 -o /dev/null -w "boese, Port 9999: code=%{http_code} Zeit=%{time_total}\n" "http://${SRV}:9999/"
    G ping -c1 -W2 $SRV
    ```

!!! question "Frage 3"
    Warum antwortet der Port 9999 jetzt nicht mehr sofort mit „abgelehnt", selbst
    für den erlaubten Client? Warum schlägt auch der **Ping** des guten Clients
    fehl, obwohl er HTTP darf? Was müsstet ihr erlauben, damit er klappt?

## Aufgabe 4 · Egress sperren, DNS vergessen

!!! abstract "Warum das zählt"
    „Nach dem Härten geht gar nichts mehr" ist ein Klassiker. Meist fehlt die
    DNS-Freigabe. Wer das Muster kennt, findet den Fehler, bevor die Anwendung
    mit unklaren Meldungen scheitert.

Der gute Client soll nur noch mit dem Server sprechen dürfen. Zuerst die
ungeschickte Variante: alles verbieten, außer DNS.

=== "Bash"

    ```bash
    kubectl -n $NS-lab05 apply -f - <<'EOF'
    apiVersion: networking.k8s.io/v1
    kind: NetworkPolicy
    metadata: {name: egress-zu}
    spec:
      podSelector: {matchLabels: {rolle: gut}}
      policyTypes: [Egress]
      egress:
      - to: [{namespaceSelector: {}}]
        ports:
        - {port: 53, protocol: UDP}
        - {port: 53, protocol: TCP}
    EOF
    sleep 4
    G getent hosts srv
    G curl -s -m4 -o /dev/null -w "per Name: code=%{http_code} Zeit=%{time_total}\n" http://srv/
    ```

=== "PowerShell"

    ```powershell
    @'
    apiVersion: networking.k8s.io/v1
    kind: NetworkPolicy
    metadata: {name: egress-zu}
    spec:
      podSelector: {matchLabels: {rolle: gut}}
      policyTypes: [Egress]
      egress:
      - to: [{namespaceSelector: {}}]
        ports:
        - {port: 53, protocol: UDP}
        - {port: 53, protocol: TCP}
    '@ | kubectl -n "$NS-lab05" apply -f -
    Start-Sleep 4
    G getent hosts srv
    G curl -s -m4 -o /dev/null -w "per Name: code=%{http_code} Zeit=%{time_total}\n" http://srv/
    ```

**Vorhersage:** Wird der Name aufgelöst? Kommt die HTTP-Anfrage durch?

Nun die Freigabe zum Server:

=== "Bash"

    ```bash
    kubectl -n $NS-lab05 apply -f - <<'EOF'
    apiVersion: networking.k8s.io/v1
    kind: NetworkPolicy
    metadata: {name: egress-srv}
    spec:
      podSelector: {matchLabels: {rolle: gut}}
      policyTypes: [Egress]
      egress:
      - to: [{podSelector: {matchLabels: {app: srv}}}]
        ports: [{port: 8080}]
    EOF
    sleep 4
    G curl -s -m4 -o /dev/null -w "Server: code=%{http_code} Zeit=%{time_total}\n" http://srv/
    G curl -s -m4 -o /dev/null -w "Internet: code=%{http_code} Zeit=%{time_total}\n" https://example.com
    ```

=== "PowerShell"

    ```powershell
    @'
    apiVersion: networking.k8s.io/v1
    kind: NetworkPolicy
    metadata: {name: egress-srv}
    spec:
      podSelector: {matchLabels: {rolle: gut}}
      policyTypes: [Egress]
      egress:
      - to: [{podSelector: {matchLabels: {app: srv}}}]
        ports: [{port: 8080}]
    '@ | kubectl -n "$NS-lab05" apply -f -
    Start-Sleep 4
    G curl -s -m4 -o /dev/null -w "Server: code=%{http_code} Zeit=%{time_total}\n" http://srv/
    G curl -s -m4 -o /dev/null -w "Internet: code=%{http_code} Zeit=%{time_total}\n" https://example.com
    ```

!!! question "Frage 4"
    Welche der beiden Anfragen ist bei der ersten Regel am DNS gescheitert, und
    welche an der fehlenden Freigabe des Ziels? Woran seht ihr den Unterschied?
    Warum steht im zweiten Aufruf der Port 8080 und nicht 80?

## Aufgabe 5 · Wer bin ich im Internet?

!!! abstract "Warum das zählt"
    Gegenstellen sehen nicht eure Pod-Adresse, sondern die eines NAT-Gateways.
    Freigaben bei Partnern („nur diese Quell-IP") hängen daran, und in
    der Cloud kostet ein NAT-Gateway Geld pro Stunde und pro Gigabyte.

Räumt die Egress-Regeln weg und fragt einen Echo-Dienst nach eurer Adresse:

=== "Bash"

    ```bash
    kubectl -n $NS-lab05 delete networkpolicy egress-zu egress-srv
    sleep 4
    G curl -s -m5 https://ifconfig.me; echo
    kubectl -n $NS-lab05 get pod gut -o jsonpath='{.status.podIP}'; echo
    G ping -c2 -W2 1.1.1.1
    ```

=== "PowerShell"

    ```powershell
    kubectl -n "$NS-lab05" delete networkpolicy egress-zu egress-srv
    Start-Sleep 4
    G curl -s -m5 https://ifconfig.me; ""
    kubectl -n "$NS-lab05" get pod gut -o jsonpath='{.status.podIP}'; ""
    G ping -c2 -W2 1.1.1.1
    ```

**Vorhersage:** Ist die Adresse, die der Echo-Dienst sieht, die Pod-Adresse?
Gehen Pings ins Internet durch?

!!! question "Frage 5"
    Wie lautet das Verhältnis zwischen der Pod-Adresse und der gesehenen
    Adresse (eins zu eins oder viele zu eins)? Welcher Verkehr aus dem
    Pod kommt durch (HTTP, ICMP) und welcher nicht? Wie würdet ihr das in
    AWS mit Security Group und NAT-Gateway nachbauen?

## Aufräumen

```bash
kubectl delete ns $NS-lab05
```

## Selbsttest

- [ ] Ich kann eine NetworkPolicy nach Label schreiben und ihre Wirkung messen.
- [ ] Ich unterscheide „Timeout" von „Connection refused" und weiß, was jeweils dahintersteckt.
- [ ] Ich erinnere mich an die DNS-Freigabe, wenn ich ausgehenden Verkehr sperre.

--8<-- "issue-feedback.md"
