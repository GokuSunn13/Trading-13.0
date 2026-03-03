# 🚀 AI Trading Analyzer

Nowoczesna, jednostronicowa aplikacja (SPA) do analizy rynków finansowych z wykorzystaniem sztucznej inteligencji. Zbudowana w React.js z Tailwind CSS, oferująca elegancki dark mode z efektem glassmorphism.

![AI Trading Analyzer](https://via.placeholder.com/800x400/0d1321/3b82f6?text=AI+Trading+Analyzer)

## ✨ Funkcje

- 📊 **Interaktywne wykresy** - Powered by TradingView Lightweight Charts
- 🤖 **Analiza AI** - Symulowana analiza oparta na danych historycznych
- 📈 **Wskaźniki techniczne** - RSI, SMA, MACD, Bollinger Bands
- 🕯️ **Wykrywanie formacji** - Bullish/Bearish Engulfing, Doji, Hammer i więcej
- 🎯 **Confidence Score** - Ocena pewności analizy (0-100%)
- 📚 **Sekcja edukacyjna** - Wyjaśnienia wykrytych formacji
- 🌙 **Dark Mode** - Elegancki ciemny motyw z efektem glassmorphism
- 📱 **Responsywność** - Dostosowany do urządzeń mobilnych

## 🛠️ Technologie

- **React 18** - Biblioteka UI
- **Tailwind CSS 3** - Stylowanie
- **Lightweight Charts** - Wykresy TradingView
- **Lucide React** - Ikony

## 📦 Struktura projektu

```
ai-trading-analyzer/
├── public/
│   ├── index.html
│   └── manifest.json
├── src/
│   ├── components/
│   │   ├── ChartContainer.js    # Komponent wykresu
│   │   ├── Watchlist.js         # Lista obserwowanych instrumentów
│   │   ├── AISummary.js         # Panel AI Insights
│   │   ├── ControlPanel.js      # Panel sterowania
│   │   └── index.js             # Eksport komponentów
│   ├── utils/
│   │   └── analyzeMarketData.js # Logika analizy AI
│   ├── App.js                   # Główny komponent aplikacji
│   ├── index.js                 # Entry point
│   └── index.css                # Style globalne + Tailwind
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── README.md
```

---

## 🚀 Instrukcja instalacji lokalnej

### Wymagania wstępne
- Node.js 16+ (zalecane 18+)
- npm lub yarn

### Krok 1: Zainstaluj zależności

```bash
cd "g:\Programowanie\Projekty robione przez AI\Trading 13.v2"
npm install
```

### Krok 2: Uruchom aplikację w trybie deweloperskim

```bash
npm start
```

Aplikacja uruchomi się pod adresem: `http://localhost:3000`

### Krok 3: Zbuduj wersję produkcyjną

```bash
npm run build
```

Pliki produkcyjne znajdziesz w folderze `build/`

---

## 🌐 Wdrożenie na Vercel

### Metoda 1: Przez GitHub (Zalecana)

#### Krok 1: Utwórz repozytorium na GitHub

```bash
# Inicjalizacja Git
git init

# Dodaj wszystkie pliki
git add .

# Pierwszy commit
git commit -m "Initial commit: AI Trading Analyzer"

# Utwórz repozytorium na GitHub (przez stronę github.com)
# Następnie połącz lokalne repo z GitHub:
git remote add origin https://github.com/TWOJA_NAZWA/ai-trading-analyzer.git

# Wypchnij kod
git branch -M main
git push -u origin main
```

#### Krok 2: Połącz z Vercel

1. Przejdź na [vercel.com](https://vercel.com) i zaloguj się kontem GitHub
2. Kliknij **"New Project"**
3. Wybierz repozytorium `ai-trading-analyzer`
4. Vercel automatycznie wykryje React - kliknij **"Deploy"**
5. Po ~1-2 minutach Twoja aplikacja będzie dostępna pod publicznym URL!

### Metoda 2: Przez Vercel CLI

```bash
# Zainstaluj Vercel CLI globalnie
npm install -g vercel

# Zaloguj się
vercel login

# Wdróż projekt
vercel

# Dla wdrożenia produkcyjnego
vercel --prod
```

---

## 🌐 Wdrożenie na Netlify

### Przez GitHub

1. Przejdź na [netlify.com](https://netlify.com) i zaloguj się
2. Kliknij **"Add new site"** → **"Import an existing project"**
3. Wybierz GitHub i autoryzuj dostęp
4. Wybierz repozytorium `ai-trading-analyzer`
5. Ustaw:
   - **Build command:** `npm run build`
   - **Publish directory:** `build`
6. Kliknij **"Deploy site"**

### Przez Netlify CLI

```bash
# Zainstaluj Netlify CLI
npm install -g netlify-cli

# Zaloguj się
netlify login

# Zbuduj projekt
npm run build

# Wdróż
netlify deploy --prod --dir=build
```

---

## ⚙️ Konfiguracja środowiska

Utwórz plik `.env` dla zmiennych środowiskowych (opcjonalne):

```env
REACT_APP_API_URL=https://api.example.com
REACT_APP_REFRESH_INTERVAL=30000
```

---

## 📋 Dostępne skrypty

| Komenda | Opis |
|---------|------|
| `npm start` | Uruchamia serwer deweloperski |
| `npm run build` | Buduje wersję produkcyjną |
| `npm test` | Uruchamia testy |
| `npm run eject` | Wyrzuca konfigurację CRA |

---

## 🎨 Customizacja

### Zmiana kolorów

Edytuj `tailwind.config.js`:

```javascript
theme: {
  extend: {
    colors: {
      primary: {
        500: '#twoj-kolor',
      }
    }
  }
}
```

### Dodanie nowych instrumentów

Edytuj `src/App.js`:

```javascript
const SYMBOLS = ['BTC/USD', 'ETH/USD', 'TWOJ/SYMBOL'];
```

---

## ⚠️ Disclaimer

**To jest aplikacja demonstracyjna!**

- Dane rynkowe są **symulowane** i nie reprezentują rzeczywistych cen
- Analiza AI jest **mock'iem** - nie opiera się na prawdziwych modelach ML
- **Nie stanowi porady inwestycyjnej**
- Przed podjęciem decyzji inwestycyjnych skonsultuj się z licencjonowanym doradcą

---

## 📄 Licencja

MIT License - używaj dowolnie w swoich projektach.

---

## 🤝 Wsparcie

W przypadku pytań lub problemów, utwórz Issue na GitHubie.

---

Stworzono z ❤️ przez AI Trading Team
