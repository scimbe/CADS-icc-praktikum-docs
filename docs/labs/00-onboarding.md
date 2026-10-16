# 00 · Onboarding

<a class="md-button" href="../../pdf/00-onboarding.pdf">:material-file-pdf-box: Als PDF herunterladen</a>

--8<-- "konventionen.md"

In diesem Termin richtet ihr den Zugang zur ICC ein und startet euren ersten
Pod. Alles Weitere baut darauf auf. Ihr lernt außerdem, wie viel ihr verbrauchen
dürft, denn die Experimente laufen auf einem gemeinsam genutzten Cluster.

## Lernziele

Nach dem Versuch könnt ihr …

- mit `kubectl` auf die ICC zugreifen und euren Namespace benennen,
- einen **Sub-Namespace** anlegen und warten, bis eure Rechte dort greifen,
- einen Pod mit **Ressourcengrenzen** starten und das Werkzeug-Image benutzen,
- eure **Quote** lesen und sagen, wie viele Pods ihr euch leisten könnt.

## Vorbereitung

Die ICC-Anleitung zum Einrichten von `kubectl` und zum Herunterladen der
`kubeconfig`-Datei gibt euch eure Kursleitung. Dort steht auch, wie ihr einen
Token erzeugt (er gilt sieben Tage). Legt die Datei ab und sagt `kubectl`, wo sie
liegt:

=== "Bash"

    ```bash
    export KUBECONFIG=~/Downloads/kubeconfig
    kubectl config get-contexts
    ```

=== "PowerShell"

    ```powershell
    $env:KUBECONFIG = "$HOME\Downloads\kubeconfig"
    kubectl config get-contexts
    ```

!!! info "Euer Namespace"
    In dieser Anleitung heißt euer Namespace **`wab123`**. Bei euch steht an
    dieser Stelle euer eigenes Kürzel. Am einfachsten tragt ihr es oben im Feld
    „Euer Namespace" ein, dann stehen alle Befehle schon richtig da. Wer die
    Befehle lieber von Hand anpasst, nutzt eine Variable:

=== "Bash"

    ```bash
    export NS=wab123        # euer Namespace
    ```

=== "PowerShell"

    ```powershell
    $NS = "wab123"          # euer Namespace
    ```

## Aufgabe 1 · Wo seid ihr?

!!! abstract "Warum das zählt"
    Quoten sind die erste Grenze, an die ihr in jeder Cloud stoßt (Service
    Limits). Wer sie nicht kennt, scheitert beim Ausrollen und nicht beim
    Entwickeln, oft erst am Abgabetag.

**Erwartung notieren:** Wie viele Pods laufen vermutlich schon in eurem Namespace?

```bash
kubectl get pods -n $NS
kubectl describe quota -n $NS
```

Lest in der Quota-Ausgabe ab, wie viele **Pods**, **CPU** und **Arbeitsspeicher**
ihr belegen dürft. Typische Werte für Studierende: 8 CPU-Kerne, 4 GB RAM,
50 Pods, 10 Services, 5 Volumes.

!!! question "Frage 1"
    Ihr braucht pro Experiment zwei bis drei Pods mit je höchstens 200 m CPU und
    128 MiB Speicher. Wie viele Experimente passen gleichzeitig in die Quote?
    Welche Grenze erreicht ihr zuerst?

## Aufgabe 2 · Ein Sub-Namespace

!!! abstract "Warum das zählt"
    Eine eigene Umgebung pro Experiment (Projekt, Account, Stage) ist in der
    Praxis Standard: Fehler bleiben begrenzt, und Aufräumen heißt, die Umgebung zu
    löschen. Dass Rechte erst verzögert greifen, erlebt ihr in jeder Cloud.

Für jedes Praktikum legt ihr einen eigenen Namespace an. So räumt ihr am Ende mit
einem Befehl alles weg. Der Name **muss mit eurem Namespace beginnen**.

```bash
kubectl create ns $NS-lab00
```

Direkt nach dem Anlegen kann es kurz dauern, bis eure Rechte im neuen Namespace
greifen. Wartet darauf, statt zu raten:

=== "Bash"

    ```bash
    until kubectl auth can-i create pods -n $NS-lab00 | grep -q yes \
       && kubectl auth can-i get pods -n $NS-lab00 | grep -q yes; do sleep 1; done
    echo "bereit"
    ```

=== "PowerShell"

    ```powershell
    do { Start-Sleep 1 } until ((kubectl auth can-i create pods -n "$NS-lab00") -eq "yes" -and (kubectl auth can-i get pods -n "$NS-lab00") -eq "yes")
    "bereit"
    ```

!!! tip "Merke"
    Ein „forbidden"-Fehler direkt nach `create ns` ist kein Fehler in eurem
    Manifest. Die Rechte werden asynchron verteilt. Das gleiche Muster kennt ihr
    aus jeder Cloud: Eine neue Ressource ist nicht sofort überall sichtbar.

## Aufgabe 3 · Der erste Pod

!!! abstract "Warum das zählt"
    Pflichtgrenzen für CPU und Speicher sind die Leitplanken, die Kostenexplosion
    und „laute Nachbarn" verhindern. Ein Dienst ohne Grenzen kann auf einer
    gemeinsam genutzten Plattform alle anderen mitreißen.

Die Quote verlangt für jeden Container ausdrückliche **Grenzen**. Ohne sie lehnt
die Plattform den Pod ab. Probiert beides aus.

```bash
kubectl -n $NS-lab00 run ohne --image=ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0 -- sleep infinity
```

**Erwartung notieren:** Was passiert? Lest die Fehlermeldung genau.

??? tip "Prüfstein"
    Die Meldung beginnt mit `Forbidden` und `failed quota` und nennt, was fehlt:
    `limits.cpu`, `limits.memory`, `requests.cpu` und `requests.memory`. Es ist
    die Quote, die den Pod ablehnt, nicht euer Manifest. `kubectl get pods`
    zeigt danach keinen Pod `ohne`.

Jetzt mit Grenzen:

=== "Bash"

    ```bash
    kubectl -n $NS-lab00 apply -f - <<'EOF'
    apiVersion: v1
    kind: Pod
    metadata:
      name: tools
    spec:
      containers:
      - name: t
        image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
        resources:
          requests: {cpu: 10m, memory: 32Mi}
          limits:   {cpu: 200m, memory: 128Mi}
    EOF
    kubectl -n $NS-lab00 wait --for=condition=Ready pod/tools --timeout=120s
    kubectl -n $NS-lab00 exec -it tools -- sh -c 'id; ip -br a; ip r'
    ```

=== "PowerShell"

    ```powershell
    @'
    apiVersion: v1
    kind: Pod
    metadata:
      name: tools
    spec:
      containers:
      - name: t
        image: ghcr.io/scimbe/cads-icc-praktikum-tools:0.1.0
        resources:
          requests: {cpu: 10m, memory: 32Mi}
          limits:   {cpu: 200m, memory: 128Mi}
    '@ | kubectl -n "$NS-lab00" apply -f -
    kubectl -n "$NS-lab00" wait --for=condition=Ready pod/tools --timeout=120s
    kubectl -n "$NS-lab00" exec -it tools -- sh -c 'id; ip -br a; ip r'
    ```

!!! question "Frage 2"
    Welche IP hat euer Pod? Welche Maske? Notiert beides, in Versuch 01
    erklärt ihr, warum die Maske so aussieht.

## Aufgabe 4 · Aufräumen

!!! abstract "Warum das zählt"
    Vergessene Testumgebungen sind in der Cloud ein klassischer Kostenposten und
    ein Sicherheitsrisiko. Konsequentes Aufräumen ist Teil des Handwerks.

```bash
kubectl delete ns $NS-lab00
```

Das Löschen eines Namespace räumt alles darin mit weg. Nach jedem Versuch
macht ihr das. Gespeichert wird in diesem Praktikum nichts, und die ICC sichert
eure Daten nicht.

## Selbsttest

- [ ] Ich kann `kubectl get pods -n <mein-namespace>` ausführen.
- [ ] Ich weiß, warum ein Pod ohne Grenzen abgelehnt wird.
- [ ] Ich habe gewartet, statt nach `create ns` sofort den Pod anzulegen.
- [ ] Ich habe meinen Namespace am Ende gelöscht.

--8<-- "issue-feedback.md"
