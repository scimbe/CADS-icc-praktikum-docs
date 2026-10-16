/**
 * Ersetzt in allen Code-Stellen den Beispiel-Namespace "wab123" und die
 * Variable "$NS" durch den Namespace, den die Studierenden in das Feld
 * "Euer Namespace" (docs/.snippets/konventionen.md, Klasse .cads-ns-input)
 * eintragen. Die Kopier-Schaltflaeche von Material liest den aktuellen Text
 * des Codeblocks, daher landet der eigene Namespace direkt in der Zwischenablage.
 * Weil auch "$NS" ersetzt wird, laufen die Befehle ohne gesetzte Variable und
 * damit auch in PowerShell und cmd.
 *
 * Der Wert wird nur im Browser gespeichert (localStorage), nie uebertragen.
 * Ist localStorage gesperrt, funktioniert das Feld trotzdem auf der Seite.
 *
 * navigation.instant ersetzt bei Seitenwechseln nur den Inhalt; deshalb ueber
 * das "document$"-Observable von Material neu ausfuehren (siehe issue-feedback.js).
 */
(function () {
  "use strict";

  var BEISPIEL = "wab123";
  var VARIABLE = "$NS";
  var SCHLUESSEL = "cads-icc-ns";
  /* Kubernetes-Namensregel (DNS-Label), Obergrenze 30, damit "-lab08b" passt. */
  var GUELTIG = /^[a-z0-9]([-a-z0-9]{0,28}[a-z0-9])?$/;
  var original = new WeakMap();

  function laden() {
    try { return localStorage.getItem(SCHLUESSEL) || ""; } catch (fehler) { return ""; }
  }

  function speichern(wert) {
    try {
      if (wert) { localStorage.setItem(SCHLUESSEL, wert); }
      else { localStorage.removeItem(SCHLUESSEL); }
    } catch (fehler) { /* nur nicht gemerkt */ }
  }

  function ersetzen(wert) {
    document.querySelectorAll(".md-content code").forEach(function (code) {
      var gang = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
      var knoten;
      while ((knoten = gang.nextNode())) {
        var text = original.has(knoten) ? original.get(knoten) : knoten.nodeValue;
        if (text.indexOf(BEISPIEL) === -1 && text.indexOf(VARIABLE) === -1) { continue; }
        original.set(knoten, text);
        knoten.nodeValue = wert
          ? text.split(BEISPIEL).join(wert).split(VARIABLE).join(wert)
          : text;
      }
    });
  }

  function melden(text, warnung) {
    document.querySelectorAll(".cads-ns-status").forEach(function (feld) {
      feld.textContent = text;
      feld.classList.toggle("cads-ns-warn", !!warnung);
    });
  }

  function eingabe(feld) {
    var wert = feld.value.trim().toLowerCase();
    document.querySelectorAll(".cads-ns-input").forEach(function (f) {
      if (f !== feld) { f.value = feld.value; }
    });
    if (wert === "") {
      speichern("");
      ersetzen("");
      melden("Die Befehle zeigen den Beispielwert.", false);
    } else if (GUELTIG.test(wert)) {
      speichern(wert);
      ersetzen(wert);
      melden("Alle Befehle auf dieser Seite nutzen jetzt " + wert + ".", false);
    } else {
      melden("Ungültig: nur a-z, 0-9 und Bindestrich, höchstens 30 Zeichen.", true);
    }
  }

  function start() {
    var gemerkt = laden();
    document.querySelectorAll(".cads-ns-input").forEach(function (feld) {
      feld.value = gemerkt;
      feld.addEventListener("input", function () { eingabe(feld); });
    });
    if (gemerkt) {
      ersetzen(gemerkt);
      melden("Alle Befehle auf dieser Seite nutzen jetzt " + gemerkt + ".", false);
    }
  }

  if (window.document$ && typeof window.document$.subscribe === "function") {
    window.document$.subscribe(start);
  } else {
    document.addEventListener("DOMContentLoaded", start);
  }
})();
