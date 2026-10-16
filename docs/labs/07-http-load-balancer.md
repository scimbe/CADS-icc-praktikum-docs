# 07 · HTTP hinter einem Load Balancer

<a class="md-button" href="../../pdf/07-http-load-balancer.pdf">:material-file-pdf-box: Als PDF herunterladen</a>

--8<-- "konventionen.md"

In der Cloud sitzt vor fast jeder Anwendung ein **Load Balancer** (in AWS: ALB
mit Target Group und Health Check). Er verteilt Anfragen, wirft kranke Ziele aus
der Rotation und erzeugt **eigene Fehlercodes**. Ihr baut euch dieses Muster mit
einem nginx-Pod als Reverse-Proxy vor drei Webservern und untersucht, was ihr
von den Fehlern 502, 503 und 504 zu sehen bekommt, und wer sie erzeugt.

## Lernziele

Nach dem Versuch könnt ihr …

- erklären, welche **Client-Adresse** ein Server hinter einem Proxy sieht und wo
  die echte steht (`X-Forwarded-For`),
- **504** (Zeitlimit) von **502** (keine gültige Antwort) unterscheiden und
  erkennen, ob Proxy oder Anwendung den Fehler erzeugt hat,
- zeigen, wie eine **Readiness-Probe** Verkehr von noch nicht bereiten Zielen fernhält,
- beschreiben, was beim **Entfernen** von Zielen mit laufenden Anfragen passiert
  (Draining),
- mit `kubectl port-forward` einen Dienst von eurem Rechner aus erreichen.

## Aufbau

Drei Webserver (`web`), ein nginx als Balancer (`lb`) und ein Client (`a`).

```bash
export NS=wab123
kubectl create ns $NS-lab07
until kubectl auth can-i create pods -n $NS-lab07 | grep -q yes \
   && kubectl auth can-i get pods -n $NS-lab07 | grep -q yes; do sleep 1; done

kubectl -n $NS-lab07 apply -f - <<'EOF'
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
        readinessProbe: {httpGet: {path: /ready, port: 8080}, periodSeconds: 2}
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
kind: ConfigMap
metadata: {name: lb-conf}
data:
  default.conf: |
    server {
      listen 80;
      location / {
        proxy_pass http://web;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_connect_timeout 1s;
        proxy_read_timeout 2s;
      }
    }
---
apiVersion: v1
kind: Pod
metadata: {name: lb, labels: {app: lb}}
spec:
  containers:
  - name: nginx
    image: nginx:1.27-alpine
    volumeMounts: [{name: conf, mountPath: /etc/nginx/conf.d}]
    resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 100m, memory: 64Mi}}
  volumes: [{name: conf, configMap: {name: lb-conf}}]
---
apiVersion: v1
kind: Service
metadata: {name: lb}
spec:
  selector: {app: lb}
  ports: [{port: 80, targetPort: 80}]
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
kubectl -n $NS-lab07 rollout status deploy/web --timeout=180s
kubectl -n $NS-lab07 wait --for=condition=Ready pod/lb pod/a --timeout=180s
A() { kubectl -n $NS-lab07 exec a -- "$@"; }
```

!!! tip "Zwei Stolperfallen"
    - Erscheint beim `apply` ein **`Conflict` auf `resourcequotas`**, hat die
      Plattform gerade die Quote gleichzeitig angepasst. Führt **denselben**
      Befehl noch einmal aus. Prüft mit `kubectl -n $NS-lab07 get all`, ob
      alles da ist.
    - Container-Namen wie `n`, `y` oder `no` liest YAML als Wahrheitswert und
      lehnt den Pod ab. Der Container heißt hier deshalb `nginx`.

Der nginx-Pod ist das Modell eines Load Balancers: `proxy_pass http://web`
leitet an den Service weiter, und die beiden Zeitlimits entsprechen den
Timeouts eines ALB.

## Aufgabe 1 · Wer ist der Client?

!!! abstract "Warum das zählt"
    Zugriffsprotokolle, Rate Limits und IP-Freigaben beruhen auf der
    Client-Adresse. Hinter einem Load Balancer sieht der Server sonst nur
    dessen Adresse. Das ist die Ursache, warum ein Ratelimit plötzlich **alle**
    Nutzer auf einmal sperrt.

```bash
A curl -s http://lb/
for i in 1 2 3 4 5 6 7 8 9; do A curl -s http://lb/ | head -1; done | sort | uniq -c
kubectl -n $NS-lab07 get pod a lb -o wide
```

**Vorhersage:** Welche Adresse steht bei `client=`, welche bei `x-forwarded-for=`?
Gehören sie zum Client `a` oder zum Balancer `lb`?

!!! question "Frage 1"
    Welche Adresse hat `client=`, welche `x-forwarded-for=`? Wie verteilen sich
    die neun Antworten auf die drei Webserver? Wer hat die Verteilung vorgenommen,
    nginx, der Service oder beide?

??? tip "Prüfstein"
    Der Server sieht die TCP-Verbindung des **Balancers**, also dessen Adresse.
    Die ursprüngliche Adresse hat der Balancer als HTTP-Header angehängt.
    Das funktioniert nur, wenn der Server diesem Header vertraut, und das
    sollte er nur, wenn er ihn von einem bekannten Proxy bekommt.

## Aufgabe 2 · Zeitlimit

!!! abstract "Warum das zählt"
    Ein 504 sieht für Nutzer aus wie „die Seite ist kaputt", ist aber meist eine
    **langsame Anwendung** hinter einem ungeduldigen Balancer. Die Ursache liegt
    dann nicht im Netz, und es hilft nicht, es neu zu starten.

Der Server hat einen Pfad `/slow`, der fünf Sekunden schläft. Der Balancer wartet
höchstens zwei:

```bash
A curl -s -m8 -o /dev/null -w "ueber lb:  code=%{http_code} Zeit=%{time_total}\n" "http://lb/slow?s=5"
A curl -s -m8 -o /dev/null -w "direkt:    code=%{http_code} Zeit=%{time_total}\n" "http://web/slow?s=5"
```

**Vorhersage:** Welche Codes und welche Zeiten erwartet ihr? Was passiert mit der
Anfrage **im Server**, wenn der Balancer schon aufgegeben hat?

!!! question "Frage 2"
    Welcher Code kommt über den Balancer, und nach wie vielen Sekunden? Das
    Zeitlimit steht an welcher Stelle der Konfiguration? Wo würdet ihr es in AWS
    einstellen (Idle Timeout)?

## Aufgabe 3 · Wer spricht?

!!! abstract "Warum das zählt"
    „Wir haben ein 502" heißt nichts, solange nicht klar ist, **wer** es
    gesendet hat: die Anwendung oder der Proxy davor. Das entscheidet, in
    welchem Protokoll ihr sucht, und häufig auch, welches Team zuständig ist.

Vergleicht eine Fehlerantwort der Anwendung mit einer des Balancers. Die
Anwendung kann jeden Statuscode senden, auch einen irreführenden:

```bash
A curl -si http://lb/status/502
echo; echo ------
A curl -si -m5 "http://lb/slow?s=5"
```

**Vorhersage:** Nginx setzt in jede Antwort einen `Server`-Header. Reicht er aus,
um zu erkennen, wer geantwortet hat?

!!! question "Frage 3"
    Woran erkennt ihr beim ersten Aufruf, dass die Anwendung den Code gesendet
    hat? Warum steht in beiden Antworten `Server: nginx`? Welches Merkmal
    verrät stattdessen den Absender (denkt an den Körper der Antwort)?

## Aufgabe 4 · Bereitschaft

!!! abstract "Warum das zählt"
    Eine Anwendung, die noch lädt (Cache aufwärmen, Datenbankverbindung), darf
    keinen Verkehr bekommen. Sonst sehen Nutzer bei **jedem Rollout** Fehler.
    Die Readiness-Probe ist der Health Check der Target Group.

Ihr startet einen vierten Webserver, der erst **25 Sekunden** nach dem Start
bereit meldet, und beobachtet zehn Mal, wer antwortet:

```bash
kubectl -n $NS-lab07 apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata: {name: spaet, labels: {app: web}}
spec:
  containers:
  - name: s
    image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
    command: ["python3", "/opt/lab/labsrv.py"]
    env: [{name: NAME, value: spaet}, {name: READY_AFTER, value: "25"}]
    readinessProbe: {httpGet: {path: /ready, port: 8080}, periodSeconds: 2}
    resources: {requests: {cpu: 10m, memory: 32Mi}, limits: {cpu: 100m, memory: 64Mi}}
EOF
for s in 1 2 3 4 5 6 7 8 9 10; do
  echo "--- $(kubectl -n $NS-lab07 get pod spaet --no-headers | awk '{print $2}') bereit"
  kubectl -n $NS-lab07 get endpoints web --no-headers 2>/dev/null
  for i in $(seq 1 12); do A curl -s http://web/ | head -1; done | grep -c spaet
  sleep 3
done
```

**Vorhersage:** Wann taucht `spaet` in der Endpoints-Liste auf, und ab wann
bekommt er Anfragen?

!!! question "Frage 4"
    Wie viele Anfragen hat `spaet` bekommen, solange `0/1 bereit` stand,
    obwohl sein Pod schon `Running` war? Welche Zeile der Ausgabe zeigt den Moment,
    in dem er in die Verteilung aufgenommen wird? Was würde ein Nutzer ohne
    Readiness-Probe sehen?

## Aufgabe 5 · Alle Ziele weg

!!! abstract "Warum das zählt"
    Beim Abschalten und Austauschen von Instanzen sollen laufende Anfragen
    zu Ende laufen („Connection Draining", in AWS „Deregistration Delay"). Wer
    das nicht kennt, interpretiert 30 Sekunden Weiterbetrieb als Fehler der
    Messung, oder verliert Anfragen bei jedem Deployment.

Skaliert alle Webserver auf null und fragt alle fünf Sekunden den Balancer:

```bash
kubectl -n $NS-lab07 delete pod spaet
kubectl -n $NS-lab07 scale deploy/web --replicas=0
for s in 1 2 3 4 5 6 7 8 9 10; do
  echo "--- $(kubectl -n $NS-lab07 get pods -l app=web --no-headers | awk '{print $3}' | tr '\n' ' ') | Endpoints: $(kubectl -n $NS-lab07 get endpoints web --no-headers 2>/dev/null | awk '{print $2}')"
  A curl -si -m4 http://lb/ | sed -n '1p;/<h1>/p'
  sleep 5
done
```

**Vorhersage:** Die Endpoints sind sofort leer. Antwortet der Balancer trotzdem noch?
Wie lange, und womit?

Danach wieder hochfahren:

```bash
kubectl -n $NS-lab07 scale deploy/web --replicas=3
kubectl -n $NS-lab07 rollout status deploy/web --timeout=120s
```

!!! question "Frage 5"
    Wie lange kommen noch Antworten `200`, obwohl die Endpoints leer sind, und
    in welchem Pod-Zustand sind die Server in dieser Zeit? Welcher Code und
    welcher Körper folgt danach, und wer sendet ihn jetzt? Warum ist das Verhalten
    bei Deployments **gewollt**?

## Aufgabe 6 · Von außen hinein

!!! abstract "Warum das zählt"
    Zum Testen und Debuggen von Diensten, die nicht öffentlich sein sollen
    (Datenbanken, Admin-Oberflächen), ist ein Tunnel aus Entwicklersicht Alltag.
    Er spart Freigaben und öffnet keinen Port nach außen.

In der ICC gibt es keinen öffentlichen Zugang (Ingress) für Studierende. Euer Weg
von außen ist `port-forward`: `kubectl` baut einen Tunnel von eurem Rechner in den
Cluster. **Auf eurem Rechner** (nicht im Pod):

```bash
kubectl -n $NS-lab07 port-forward svc/lb 18080:80 > /dev/null &
sleep 3
curl -s http://127.0.0.1:18080/
kill %1
```

**Vorhersage:** Welche Adresse sieht der Server jetzt bei `x-forwarded-for=`?

!!! question "Frage 6"
    Welche Adresse steht bei `x-forwarded-for=`, und warum ist es nicht eure
    Rechneradresse? Warum eignet sich `port-forward` zum Testen, aber nicht
    als Zugang für Nutzer?

## Aufräumen

```bash
kubectl delete ns $NS-lab07
```

## Selbsttest

- [ ] Ich weiß, wo die echte Client-Adresse hinter einem Proxy steht.
- [ ] Ich unterscheide 504 und 502 und erkenne, wer den Fehler gesendet hat.
- [ ] Ich kann erklären, warum eine Readiness-Probe Fehler bei Rollouts verhindert.
- [ ] Ich kenne Draining und weiß, dass Abschalten nicht schlagartig geschieht.
- [ ] Ich kann einen Dienst per `port-forward` erreichen.

--8<-- "issue-feedback.md"
