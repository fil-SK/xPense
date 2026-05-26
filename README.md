# 💸 Tracker Troškova

Personalna web aplikacija za praćenje i planiranje ličnih finansija. Izgrađena u Reactu, podaci se čuvaju lokalno u browseru (localStorage) — bez servera, bez naloga, bez oblaka.

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
- Dinamički redovi: korisnik dodaje/uklanja fondove po želji; dvoklikom na naziv — preimenovanje
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

### Uvoz i izvoz
- **Izvezi JSON** — preuzimanje kompletnih podataka (troškovi + kategorije + budžet + podešavanja praćenja) u jedan JSON fajl, pogodno za analizu u Claude AI
- **Uvezi JSON** — učitavanje prethodno izvezenih podataka; obnavlja sve uključujući podešavanja praćenja — dovoljan je jedan fajl nakon brisanja browsera
- **Izvezi budžet** — izvoz samo budžet podataka u poseban fajl (`budget-YYYY.json`)
- **Uvezi budžet** — učitavanje budžeta iz fajla; spaja po godini, ne briše postojeće podatke

---

## Tehnologije

| Tehnologija | Uloga |
|---|---|
| React 18 | UI framework |
| Vite 5 | Build alat |
| Recharts | Grafici |
| localStorage | Čuvanje podataka |

---

## Pokretanje lokalno

```bash
npm install
npm run dev
```

Aplikacija se otvara na `http://localhost:5173`.

```bash
npm run build
```

Generiše produkcijski build u `dist/` folderu.

---

## Struktura projekta

```
src/
├── components/
│   ├── BudgetPanel.jsx      # Panel za praćenje budžeta unutar prikaza meseca
│   ├── BudgetView.jsx       # Godišnji budžet — tabela prihoda i rashoda
│   ├── CategoryManager.jsx  # Upravljanje kategorijama
│   ├── Charts.jsx           # Pita i bar grafici
│   ├── ExpenseItem.jsx      # Jedan red troška
│   ├── ExpenseModal.jsx     # Modal za dodavanje/izmenu troška
│   ├── Header.jsx           # Navigacija
│   ├── Home.jsx             # Početna strana
│   ├── MonthView.jsx        # Pregled troškova za mesec
│   ├── PreviousSpendings.jsx# Navigacija po prethodnim mesecima
│   └── TrackingSetup.jsx    # Podešavanje praćenja budžeta po fondovima
├── utils/
│   ├── helpers.js           # Formatiranje, filtriranje, konstante
│   └── storage.js           # localStorage, uvoz/izvoz JSON
├── App.jsx                  # Globalni state i routing
└── index.css                # Svi stilovi
```

---

## Napomene

- Svi podaci ostaju **isključivo na uređaju korisnika** — nema slanja podataka na server.
- Aplikacija je na srpskom jeziku.
- Iznosi su u **RSD (srpski dinar)**.
