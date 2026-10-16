# 08 · Abschluss: Fehlersuche und Entwurf

<a class="md-button" href="../../pdf/08-abschluss.pdf">:material-file-pdf-box: Als PDF herunterladen</a>

--8<-- "konventionen.md"

Bisher habt ihr einzelne Mechanismen untersucht und bewusst kaputtgemacht. Hier
kommt ihr ohne Anleitung zurecht: Fünf Dienste sind **bereits defekt**, und ihr
müsst herausfinden, warum. Danach entwerft ihr selbst eine kleine
Drei-Schichten-Anwendung mit Regeln zwischen den Schichten.

## Lernziele

Nach dem Versuch könnt ihr …

- ein Fehlerbild systematisch **von unten nach oben** eingrenzen (Namen, Adresse,
  Endpoints, Port, Regeln, Anwendung),
- aus Code, Zeit und Absender eines Fehlers auf die Ursache schließen,
- eine Anwendung in **Schichten** zerlegen und den erlaubten Verkehr zwischen
  ihnen begründet festlegen,
- euren Entwurf gegen die Fehlerbilder der früheren Versuche prüfen.

## Aufbau

Die Kursleitung stellt die Datei `lab08.yaml` bereit. Sie enthält die defekten
Dienste. **Lest sie nicht**, sonst überspringt ihr die Diagnose, und genau die
ist die Übung.

=== "Bash"

    ```bash
    export NS=wab123
    kubectl create ns $NS-lab08
    until kubectl auth can-i create pods -n $NS-lab08 | grep -q yes \
       && kubectl auth can-i get pods -n $NS-lab08 | grep -q yes; do sleep 1; done
    kubectl -n $NS-lab08 apply -f lab08.yaml
    sleep 40
    kubectl -n $NS-lab08 get pods
    T() { kubectl -n $NS-lab08 exec t -- "$@"; }
    ```

=== "PowerShell"

    ```powershell
    $NS = "wab123"
    kubectl create ns "$NS-lab08"
    do { Start-Sleep 1 } until ((kubectl auth can-i create pods -n "$NS-lab08") -eq "yes" -and (kubectl auth can-i get pods -n "$NS-lab08") -eq "yes")
    kubectl -n "$NS-lab08" apply -f lab08.yaml
    Start-Sleep 40
    kubectl -n "$NS-lab08" get pods
    function T { kubectl -n "$NS-lab08" exec t -- @args }
    ```

!!! tip "Wenn `apply` einen Conflict meldet"
    Ein **`Conflict` auf `resourcequotas`** ist harmlos. Führt denselben Befehl
    noch einmal aus und prüft mit `get all`, ob alles da ist.

Euer Werkzeugkasten: `get pods -o wide`, `get endpoints <name>`, `describe`,
`logs`, `T curl -v …`, `T getent hosts …`, `get networkpolicy`.

## Fehlersuche

Pro Fall gilt dasselbe Vorgehen: **Symptom messen, Vermutung aufschreiben,
prüfen, beheben, erneut messen.** Notiert für jeden Fall drei Zeilen: Symptom,
Ursache, Beweis.

### Fall 1 · Die Kasse antwortet nicht

!!! abstract "Warum das zählt"
    „Es geht nicht, und es kommt auch keine Fehlermeldung" ist das häufigste
    Fehlerbild bei Firewalls und Security Groups. Wer aus Stille die richtige
    Schicht ableiten kann, spart Stunden.

```bash
T curl -s -m3 -o /dev/null -w "code=%{http_code} t=%{time_total}\n" http://kasse/
```

Ziel: `http://kasse/` liefert **200** vom Pod `t` aus. Ihr dürft **das Label von
`t`** ändern, aber nicht die Regeln der Kasse.

??? tip "Prüfstein 1"
    Sofortige Absage oder Stille? Was sagt das über die Schicht? Dann: Welche
    NetworkPolicy wählt die Kasse aus, und was verlangt sie vom Client?

### Fall 2 · Der Shop hat keine Ziele

!!! abstract "Warum das zählt"
    Pods laufen, aber der Service hat keine Ziele: Das passiert bei jedem
    falsch gesetzten Health Check. Von außen sieht man nur „Connection
    refused", und die Pods sehen gesund aus.

=== "Bash"

    ```bash
    kubectl -n $NS-lab08 get pods -l app=shop
    kubectl -n $NS-lab08 get endpoints shop --no-headers 2>/dev/null
    T curl -s -m3 -o /dev/null -w "code=%{http_code}\n" http://shop/
    ```

=== "PowerShell"

    ```powershell
    kubectl -n "$NS-lab08" get pods -l app=shop
    kubectl -n "$NS-lab08" get endpoints shop --no-headers 2>$null
    T curl -s -m3 -o /dev/null -w "code=%{http_code}\n" http://shop/
    ```

Ziel: `http://shop/` liefert **200**. Ihr dürft den `shop` ändern.

??? tip "Prüfstein 2"
    Die Spalte `READY` zeigt `0/1`, obwohl der Pod `Running` ist. Wer entscheidet
    darüber, und woran? `describe pod` zeigt die Ereignisse.

### Fall 3 · Die Abrechnung findet das Konto nicht

!!! abstract "Warum das zählt"
    Nach dem Umzug einer Anwendung in eine andere Umgebung (anderer
    Namespace, anderes Konto) bleibt eine Adresse in der Konfiguration stehen.
    Das Programm startet, läuft und tut nichts Sinnvolles.

```bash
kubectl -n $NS-lab08 logs deploy/abrechnung --tail=5
kubectl -n $NS-lab08 get svc
```

Ihr sollt **nicht** den Dienst `konto` bauen. Ermittelt zuerst, was die
Abrechnung aufruft und warum das scheitert (Fehlercode von `curl`: 6 oder 7?),
und beschreibt, wie ihr den Fehler im echten Betrieb beheben würdet.

??? tip "Prüfstein 3"
    `T getent hosts konto` und `T curl -sv http://konto/ 2>&1 | head`. Aus
    Versuch 04: Hat die Suchliste eine Chance, einen Dienst zu finden, den es
    nicht gibt?

### Fall 4 · Das Portal liefert Fehler

!!! abstract "Warum das zählt"
    Ein 504 am Balancer wird oft dem Balancer zur Last gelegt. Wer mit zwei
    Messungen (davor und dahinter) nachweist, dass die Anwendung langsam ist,
    schickt das Ticket an das richtige Team.

```bash
T curl -s -m6 -o /dev/null -w "Portal: code=%{http_code} t=%{time_total}\n" http://portal/
T curl -s -m6 -o /dev/null -w "Bericht: code=%{http_code} t=%{time_total}\n" http://bericht/
```

Ziel: Stellt fest, **wer** den Fehler erzeugt, und beweist es mit **zwei Zahlen**.
Dann beseitigt ihr ihn, indem ihr eine Einstellung am Portal ändert (ihr müsst
dafür die ConfigMap `portal-conf` ändern und das Portal neu starten:
`kubectl -n $NS-lab08 rollout restart deploy/portal`).

??? tip "Prüfstein 4"
    Vergleicht die Zeiten. Welcher Wert in der Konfiguration ist kleiner als die
    Antwortzeit des Servers?

### Fall 5 · Das Lager ist gehärtet, aber taub

!!! abstract "Warum das zählt"
    „Wir haben die ausgehenden Regeln verschärft, und jetzt geht nichts mehr":
    Das ist ein klassischer Vorfall nach einem Sicherheitsaudit. Er hat fast
    immer dieselbe Ursache.

=== "Bash"

    ```bash
    kubectl -n $NS-lab08 exec lager-client -- curl -s -m4 -o /dev/null -w "code=%{http_code} t=%{time_total}\n" http://lager/
    kubectl -n $NS-lab08 exec lager-client -- getent hosts lager
    ```

=== "PowerShell"

    ```powershell
    kubectl -n "$NS-lab08" exec lager-client -- curl -s -m4 -o /dev/null -w "code=%{http_code} t=%{time_total}\n" http://lager/
    kubectl -n "$NS-lab08" exec lager-client -- getent hosts lager
    ```

Ziel: `lager-client` erreicht `http://lager/` **per Name**, und **nur** das Lager,
sonst nichts. Erweitert die vorhandene Regel `lager-aus` minimal.

??? tip "Prüfstein 5"
    Versuch 05, Aufgabe 4. Gelingt die Namensauflösung? Was braucht jeder Aufruf
    **vor** dem eigentlichen Verbindungsaufbau?

!!! question "Frage 1 · Muster"
    Ordnet jeden der fünf Fälle einer **Schicht** zu (Name, Endpoints, Regel,
    Zeitlimit …). Welches Werkzeug hat bei jedem Fall die Ursache zuerst
    gezeigt? Welche Reihenfolge der Prüfungen würdet ihr als Checkliste für
    künftige Fehler festhalten?

## Entwurf: Drei Schichten

!!! abstract "Warum das zählt"
    Fast jede Webanwendung besteht aus Frontend, Dienst und Datenbank, und
    fast jeder Sicherheitsvorfall nutzt aus, dass das Frontend die Datenbank
    **direkt** erreichen darf. Die Regeln zwischen den Schichten sind eure
    Architektur, nicht ein Nachtrag.

Entwerft und baut in einem neuen Namespace `$NS-lab08b` diese Anwendung. Alles
mit denselben Bausteinen wie in den früheren Versuchen:

| Schicht  | Baustein                                  | Darf erreichen          |
|----------|-------------------------------------------|-------------------------|
| Frontend | nginx als Balancer (Versuch 07), 1 Pod    | nur `api`               |
| `api`    | Webserver (`labsrv.py`), 2 Replikate      | nur `db`                |
| `db`     | Webserver (`labsrv.py`), 1 Replikat       | nichts (keine Egress)   |

Anforderungen:

1. Ein Client-Pod mit dem Label `rolle=kunde` erreicht das **Frontend** über
   dessen Service-Namen, jeder andere nicht.
2. Das Frontend erreicht **nur** `api`, `api` erreicht **nur** `db`, `db`
   erreicht niemanden. Ein direkter Zugriff vom Frontend auf `db` muss
   scheitern.
3. Namensauflösung funktioniert in allen Schichten, aber nur dort, wo nötig.
4. Alle Pods haben die Ressourcenangaben aus den früheren Versuchen.

**Vorhersage:** Bevor ihr eine Zeile schreibt: Zeichnet die erlaubten Pfeile auf
Papier. Wie viele NetworkPolicies braucht ihr, wenn ihr Ein- und Ausgang trennt?

Prüft euren Entwurf mit diesen Messungen und schreibt für jede hin, was ihr
erwartet **und** was ihr bekommt:

=== "Bash"

    ```bash
    kubectl -n $NS-lab08b exec <client> -- curl -s -m3 -o /dev/null -w "kunde -> frontend: %{http_code}\n" http://frontend/
    kubectl -n $NS-lab08b exec <frontend-pod> -- wget -q -T3 -O /dev/null http://db/; echo "frontend -> db: Exit $?"
    kubectl -n $NS-lab08b exec <api-pod> -- curl -s -m3 -o /dev/null -w "api -> db: %{http_code}\n" http://db/
    ```

=== "PowerShell"

    ```powershell
    kubectl -n "$NS-lab08b" exec <client> -- curl -s -m3 -o /dev/null -w "kunde -> frontend: %{http_code}\n" http://frontend/
    kubectl -n "$NS-lab08b" exec <frontend-pod> -- wget -q -T3 -O /dev/null http://db/; "frontend -> db: Exit $LASTEXITCODE"
    kubectl -n "$NS-lab08b" exec <api-pod> -- curl -s -m3 -o /dev/null -w "api -> db: %{http_code}\n" http://db/
    ```

Das nginx-Image hat kein `curl`, deshalb `wget`: Exit `0` heißt „Antwort
bekommen", alles andere „nicht erreicht".

!!! question "Frage 2 · Bewertung"
    Wo ist euer Entwurf noch schwach (zum Beispiel: Wer darf `api` direkt
    erreichen? Was passiert, wenn ein Pod ein Label bekommt, das er nicht haben
    sollte?) Welche zwei zusätzlichen Maßnahmen würdet ihr in AWS dafür
    einplanen (Subnetze, eigene Security Groups, getrennte Konten)?

!!! question "Frage 3 · Abwägung"
    Eine NetworkPolicy ist eine Liste von Erlaubnissen. Welche Fehler im
    Entwurf werden **sofort** bemerkt, und welche bleiben **unbemerkt**, bis
    jemand sie ausnutzt?

## Aufräumen

=== "Bash"

    ```bash
    kubectl delete ns $NS-lab08 $NS-lab08b
    ```

=== "PowerShell"

    ```powershell
    kubectl delete ns "$NS-lab08" "$NS-lab08b"
    ```

## Selbsttest

- [ ] Ich grenze ein Fehlerbild in einer festen Reihenfolge ein und belege jeden Schritt mit einer Messung.
- [ ] Ich erkenne aus Code, Zeit und Absender, welche Schicht schuld ist.
- [ ] Ich kann eine Anwendung in Schichten zerlegen und die Regeln dazwischen begründen.
- [ ] Ich prüfe einen Entwurf so, dass auch das **Verbotene** gemessen wird.

--8<-- "issue-feedback.md"
