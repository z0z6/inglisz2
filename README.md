# Mnemo – słówka, które zostają w głowie

Aplikacja na Androida do nauki słówek oparta na badaniach nad pamięcią. Interfejs w stylu macOS (szkło, tapeta, dock, światła okna), domyślnie angielski z talią **600 słówek** z Twojej listy (z polskimi tłumaczeniami), z możliwością tworzenia talii w ~25 innych językach.

## Kompilacja na GitHub Actions

1. Utwórz repozytorium na GitHubie i wypchnij do niego zawartość tego folderu (gałąź `main`).
2. Workflow `.github/workflows/android.yml` uruchomi się sam (albo: **Actions → Build APK → Run workflow**).
3. Po ok. 5–8 minutach pobierz APK z sekcji **Artifacts** danego przebiegu (`Mnemo-apk-N`).
4. Tag `v1.0`, `v1.1`… dodatkowo tworzy **Release** z APK.

Instalacja: otwórz APK na telefonie i zezwól na instalację z nieznanych źródeł (Android 8+).

**Aktualizacje bez utraty postępów:** APK jest podpisywany stałym kluczem z repo (`app/mnemo-dev.keystore`), więc każda nowa wersja instaluje się na poprzednią. Jeśli repo jest **publiczne**, ustaw własny klucz w sekretach (`MNEMO_KEYSTORE_BASE64`, `MNEMO_KEYSTORE_PASSWORD`, `MNEMO_KEY_ALIAS`, `MNEMO_KEY_PASSWORD`) – workflow użyje go automatycznie. Zmiana klucza wymaga jednorazowej reinstalacji (zrób wcześniej eksport kopii w Ustawieniach).

## Co wykorzystuje z nauki o pamięci

| Technika | Jak działa w aplikacji | Źródło |
|---|---|---|
| Powtórki w odstępach | Algorytm **FSRS-5** (model trudność–stabilność–przypominalność); powtórka w chwili, gdy szansa przypomnienia spada do docelowej retencji (domyślnie 90%, regulowana 80–95%) | Ebbinghaus; Cepeda i in. 2006; Ye (FSRS) |
| Krótkie kroki w obrębie dnia | Nowe słowo wraca po 1 min i 10 min; po sesji powiadomienie o „drugim kroku” | efekt rozłożenia w czasie |
| Aktywne przypominanie | Każda karta wymaga wydobycia odpowiedzi z pamięci | Roediger i Karpicke 2006 |
| Pretest | Przy nowym słowie najpierw zgadujesz znaczenie | Richland, Kornell i Kao 2009 |
| Pewność + hiperkorekta | Deklaracja pewności przed odsłonięciem; błędy „na pewno” dostają osobną informację; statystyki kalibracji | Butterfield i Metcalfe 2001 |
| Pożądane trudności | Tryb rośnie ze stabilnością: wybór → przypomnienie → pisanie/dyktando → mówienie/zdanie z luką; dystraktory z tą samą końcówką | Bjork 1994 |
| Przeplatanie | Mieszanie nowych i powtórek oraz rodzajów zadań | Rohrer i Taylor 2007 |
| Wielozmysłowość | Tekst + lektor (TTS) + nagranie lektora + IPA + przykłady | Paivio (podwójne kodowanie) |
| Efekt produkcji | Mówienie na głos z rozpoznawaniem mowy | MacLeod i in. 2010 |
| Generowanie / odniesienie do siebie | Własne skojarzenia (metoda słów-kluczy) i zdania; podpowiedź przy „pijawkach” | Slamecka i Graf 1978; Atkinson i Raugh 1975 |
| Natychmiastowa informacja zwrotna | Kolor, porównanie liter, wymowa poprawnej odpowiedzi, wibracja | Metcalfe 2017 |
| Szybkość odpowiedzi | Czas odpowiedzi wpływa na ocenę (płynność przypominania) | – |
| Sen | Przypomnienia rano i wieczorem („przed snem”) | Mazza i in. 2016 |
| Przerwy | Sugestia przerwy po 20 min | – |
| Nawyk | Intencje implementacyjne (pora + kotwica „po porannej kawie”), pierścienie celu, seria z „zamrożeniem” 1 dnia/tydzień | Gollwitzer 1999; Lally i in. 2010 |

## Co wykorzystuje z telefonu

- **Lektor (TTS)** z wyborem akcentu UK/US i tempa; **nagrania lektora** (dictionaryapi.dev) gdy jest internet
- **Rozpoznawanie mowy**: tryb „Powiedz na głos” i **tryb bez rąk** (spacer, auto: słyszysz polskie słowo → mówisz angielskie → ocena)
- **Wibracje** jako informacja zwrotna
- **Powiadomienia** o stałych porach + jednorazowe o krótkim kroku nauki
- **Widżet** ekranu głównego z rotującymi słówkami
- **Aparat + OCR** (ML Kit, offline): zeskanuj kartkę z listą słówek
- **Tłumacz offline** (ML Kit): automatyczne tłumaczenia dodawanych słów (model ~30 MB pobierany raz na język)
- **Zaznacz słowo w dowolnej aplikacji → „Dodaj do Mnemo”** (oraz „Udostępnij”)
- Import list (CSV/TXT, wklejanie), eksport/import kopii (JSON), Auto Backup Androida
- Tryb ciemny, ekran nie gaśnie w trakcie sesji

## Inne języki

Ustawienia → **Talia i język** → nowa talia (niemiecki, hiszpański, francuski, włoski, …). Język talii ustawia głos lektora, rozpoznawanie mowy i tłumacza. Słowa dodasz ręcznie, z listy (`słowo - tłumaczenie`, `słowo;tłumaczenie`, tabulator), z pliku lub skanując kartkę.
Jeśli lektor nie mówi w danym języku: Ustawienia Androida → Zamiana tekstu na mowę → zainstaluj dane głosu.

## Struktura

```
app/src/main/assets/www/   interfejs i logika (HTML/CSS/JS)
  fsrs.js                  algorytm FSRS-5
  study.js                 sesja, tryby ćwiczeń, tryb bez rąk
  views.js                 ekrany: Dziś, Słówka, Statystyki, Ustawienia, dodawanie
  core.js                  stan, most do Androida, wzbogacanie słownikowe
  words.js                 talia 600 słówek
app/src/main/java/pl/mnemo/app/
  MainActivity.kt          WebView, wcięcia systemowe, intencje, uprawnienia, pliki
  NativeBridge.kt          interfejs JS ↔ Android
  Speech.kt                TTS + rozpoznawanie mowy
  Reminders.kt             powiadomienia (AlarmManager)
  WordWidgetProvider.kt    widżet
  MlKit.kt                 OCR i tłumaczenie offline
```

Prywatność: dane są tylko na telefonie. Internet służy do pobierania definicji/nagrań (dictionaryapi.dev) i jednorazowo modeli tłumacza.
Czcionka Inter – SIL Open Font License. Definicje: Wiktionary (CC BY-SA) przez dictionaryapi.dev.
