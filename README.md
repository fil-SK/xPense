# 💸 Tracker Troškova

Personalna web aplikacija za praćenje i planiranje ličnih finansija. Izgrađena u Reactu, podaci se čuvaju lokalno u browseru (localStorage) — bez servera, bez naloga, bez oblaka.

Aplikacija je razvijena za lične potrebe, radi planiranja budžeta i praćenja mesečnih troškova.

Realizovana uz pomoć Claude AI-ja.

---

## Funkcionalnosti

### Praćenje troškova
- Unos troškova sa nazivom, datumom, iznosom (RSD), kategorijom i opcionalnom napomenom
- Pregled troškova za **tekući mesec** sa statistikama (ukupno, broj transakcija, prosek, top kategorija)
- Pregled **prethodnih meseci i godina** — navigacija po godini, sve 12 meseci vidljivo odjednom
- Pretraga i sortiranje unutar svakog meseca (po datumu, iznosu, kategoriji)
- Brisanje troškova sa dvostrukom potvrdom
- Inline izmena svakog troška

### Kategorije
- Potpuno prilagodljive kategorije troškova
- Svaka kategorija ima svoju boju (pill dugmad u formi i na listi)
- Dodavanje, preimenovanje i brisanje kategorija
- Brisanje kategorije prebacuje njene troškove u "Ostalo"

### Grafici i analiza
- **Pita grafik** — raspodela troškova po kategorijama za izabrani mesec
- **Bar grafik (poređenje)** — poređenje do 11 prethodnih meseci sa tekućim; meseci su selektabilni

### Budžet
- Godišnji plan prihoda i rashoda u formatu tabele (12 meseci × N stavki)
- Fiksni redovi: **Plata** i **Bonus / Ostalo** (prihodi)
- Dinamički redovi: korisnik dodaje/uklanja fondove po želji; dvoklikom na naziv — preimenovanje; prevlačenjem ⠿ ikone — promena redosleda
- Inline uređivanje svake ćelije — klik za unos, Enter ili klik van ćelije za čuvanje
- Auto-računanje **bilansa** po mesecu i za celu godinu (zeleno = plus, crveno = minus)
- Tekući mesec je vizuelno istaknut kolonom
- Uvoz i izvoz budžeta kao poseban JSON fajl (`budget-YYYY.json`)

### Praćenje budžeta uživo
- Na tabu **Praćenje** svaki budžetski fond se povezuje sa jednom ili više kategorija troškova (pill dugmad, automatsko čuvanje)
- U pregledu svakog meseca (iznad pretrage) prikazuje se panel sa statusom svakog fonda:
  - **Zeleno** — potrošeno < 90% od budžeta
  - **Narandžasto** — potrošeno između 90% i 100%
  - **Crveno** — prekoračen budžet, prikazuje se minus iznos
  - **Sivo** — iznos za taj mesec nije unet u budžetu (`nije postavljeno`)
- Tanka progress traka vizualno prikazuje iskorišćenost budžeta
- Panel se ne prikazuje ako nije podešeno nijedno praćenje

### Tamna tema
- Dugme 🌙 / ☀️ u navigaciji trenutno menja temu
- Podešavanje se čuva u browseru odvojeno od podataka o troškovima — ne briše se uvozom JSON fajla i preživljava osvežavanje stranice

### Ponavljajući troškovi

- Checkbox "Ponavljajući trošak" u formi za dodavanje troška
- Kada je označen, trošak se čuva kao **šablon** u posebnoj listi, a ne kao jednokratni unos
- Aplikacija automatski generiše po jedan unos **za svaki mesec** od datuma početka do tekućeg meseca, preskačući mesece u kojima unos već postoji
- Ponavljajući troškovi su označeni ikonom 🔄 u listi
- Upravljanje šablonima (brisanje) dostupno na početnoj strani — brisanje šablona ne uklanja prošle unesene troškove

### Globalna pretraga

- Dugme 🔍 u navigaciji otvara pretragu svih troškova
- Pretraga po **nazivu**, **kategoriji** i **napomeni**, bez obzira na mesec
- Rezultati sortirani od najnovijeg; klik na rezultat vodi direktno u prikaz tog meseca

### Autosave u fajl

- Opcija čuvanja svih podataka u JSON fajl na disku (File System Access API)
- Nakon jednokratnog podešavanja, svaka izmena se automatski upisuje u fajl
- Fajl se čita samo ako je localStorage obrisan (režim oporavka) — localStorage je uvek primarni izvor
- Status autosave-a vidljiv je u navigaciji: **Podesi** → **Aktiviraj** → 💾 (aktivno) / ! (greška)

### Napomena za mesec

- Slobodan tekst koji se dodaje svakom mesecu — polje za unos je na vrhu pregleda meseca, iznad budget panela
- Čuva se automatski na gubitak fokusa
- Skraćeni prikaz napomene (do 55 znakova) vidljiv je na kartici meseca u pregledu prethodnih potrošnji — korisno za razumevanje skokova na grafikonu bez otvaranja meseca

### Ciljevi štednje

- Definisanje cilja sa **nazivom** i **ciljnom sumom (RSD)**
- Opciono povezivanje sa **budžetskim fondom** za određenu godinu — napredak se automatski izračunava kao zbir svih mesečnih alokacija u tom fondu
- Progress bar sa bojama: sivo (0%) → narandžasto (1–59%) → indigo (60–99%) → zeleno (100%)
- Ciljevi bez fonda prikazuju 0 / cilj kao ručni podsetnik
- Brisanje cilja zahteva dvostruki klik (potvrda)
- Prikazano na početnoj strani ispod ponavljajućih troškova

### Uvoz i izvoz

- **Izvezi JSON** — preuzimanje kompletnih podataka (troškovi + kategorije + budžet + praćenje + napomene + ciljevi) u jedan JSON fajl, pogodno za analizu u Claude AI
- **Izvezi CSV (Excel)** — isti podaci u CSV formatu sa UTF-8 BOM, otvara se direktno u Excelu bez čarobnjaka za uvoz; kolone: Datum, Naziv, Iznos, Kategorija, Napomena, Ponavljajuci
- **Uvezi JSON** — učitavanje prethodno izvezenih podataka; obnavlja sve — dovoljan je jedan fajl nakon brisanja browsera
- **Izvezi budžet** — izvoz samo budžet podataka u poseban fajl (`budget-YYYY.json`)
- **Uvezi budžet** — učitavanje budžeta iz fajla; spaja po godini, ne briše postojeće podatke

---

## Tehnologije

| Tehnologija | Uloga |
|---|---|
| React 18 | UI framework |
| Vite 5 | Build alat |
| Recharts | Grafici |
| @dnd-kit | Drag-to-reorder fondova u budžetu |
| Vitest + @testing-library/react | Test suite (97 testova, 7 fajlova) |
| localStorage + File System Access API | Čuvanje podataka |

---

## Pokretanje lokalno

```bash
npm install
npm run dev        # dev server na http://localhost:5173
npm run build      # produkcijski build → dist/
npm test           # pokreni sve testove jednom
npm run test:watch # watch mode
```

---

## Struktura projekta

```
src/
├── components/
│   ├── BudgetPanel.jsx       # Panel za praćenje budžeta unutar prikaza meseca
│   ├── BudgetView.jsx        # Godišnji budžet — tabela prihoda i rashoda
│   ├── CategoryManager.jsx   # Upravljanje kategorijama
│   ├── Charts.jsx            # Pita i bar grafici
│   ├── ExpenseItem.jsx       # Jedan red troška
│   ├── ExpenseModal.jsx      # Modal za dodavanje/izmenu troška (+ ponavljajući)
│   ├── GlobalSearch.jsx      # Pretraga svih troškova
│   ├── Header.jsx            # Navigacija
│   ├── Home.jsx              # Početna strana
│   ├── MonthView.jsx         # Pregled troškova za mesec (+ napomena)
│   ├── PreviousSpendings.jsx # Navigacija po prethodnim mesecima
│   ├── SavingsGoals.jsx      # Ciljevi štednje sa progress barovima
│   └── TrackingSetup.jsx     # Podešavanje praćenja budžeta po fondovima
├── __tests__/                # 97 testova u 7 fajlova (Vitest)
├── test/
│   └── setup.js              # jest-dom matchers, localStorage reset
├── utils/
│   ├── dataTransforms.js     # Čiste funkcije: generisanje ponavljajućih, kopija budžeta
│   ├── fileStorage.js        # IndexedDB + File System Access API
│   ├── helpers.js            # Formatiranje, filtriranje, konstante
│   └── storage.js            # localStorage, uvoz/izvoz JSON i CSV
├── App.jsx                   # Globalni state, Context, sve akcije
└── index.css                 # Svi stilovi (BEM, CSS varijable, dark mode)
```

---

## Napomene

- Svi podaci ostaju **isključivo na uređaju korisnika** — nema slanja podataka na server.
- Aplikacija je na srpskom jeziku.
- Iznosi su u **RSD (srpski dinar)**.
