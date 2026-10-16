# Ressourcen und Grenzen

Eure Quote gilt für **alle** Namespaces zusammen, die ihr anlegt. Die Zahlen
stammen aus der ICC-Anleitung der Kursleitung. Gilt dort ein anderer Wert,
gilt der dort genannte.

| Ressource | Obergrenze |
|-----------|------------|
| CPU | 8 Kerne |
| Arbeitsspeicher | 4 GB |
| Speicher (Cloud-Speicher) | 100 GB |
| Pods | 50 |
| Services | 10 |
| PersistentVolumeClaims | 5 |
| zusätzliche Namespaces | 4 |

Die Versuche brauchen davon nur einen Bruchteil: Ein Pod fordert `10m` CPU und
`32Mi` RAM an und darf bis `100m` bis `200m` CPU und `64Mi` bis `128Mi` RAM
verbrauchen.

!!! warning "Pods ohne Ressourcenangaben werden abgelehnt"
    Der Cluster verlangt für jeden Container `requests` und `limits`. Alle
    Manifeste in dieser Anleitung enthalten sie. Wenn ihr eigene schreibt,
    vergesst sie nicht.

## Aufräumen

- Löscht jeden Namespace am Ende des Versuchs: `kubectl delete ns $NS-labNN`.
- Prüft mit `kubectl get ns`, was von euch noch übrig ist.
- Das Löschen eines Namespaces entfernt alle Objekte darin.

## Gut zu wissen

- **Keine Datensicherung.** Was ihr auf der ICC ablegt, ist nicht gesichert.
- **Löschung nach 90 Tagen.** Konten und Daten werden nach Ablauf der
  Frist entfernt (laut ICC-Anleitung). Sichert eure Notizen außerhalb.
- **Zugangsdatei.** Die Datei, mit der `kubectl` sich anmeldet, ist **persönlich**
  und nur befristet gültig. Gebt sie nicht weiter und legt sie nicht in ein
  Repository.
- **Kein Zugang von außen.** Es gibt für Studierende keinen öffentlichen
  Eingang (Ingress). Nutzt `kubectl port-forward` (Versuch 07).
- **Einschränkungen der Pods.** Kein privilegierter Modus, keine
  Änderung der Netzwerkkonfiguration, kein IPv6 und kein ICMP ins Internet.

!!! tip "Zwei häufige Hänger"
    - Wirkt ein frisch angelegter Namespace noch „verboten", wartet kurz. Die
      Berechtigungen kommen mit Verzögerung (Warteschleife in den Aufbau-Blöcken).
    - Meldet `apply` einen `Conflict` auf `resourcequotas`, führt denselben
      Befehl noch einmal aus.

--8<-- "issue-feedback.md"
