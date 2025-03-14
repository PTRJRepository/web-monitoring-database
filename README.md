# Aplikasi Monitoring Database

Aplikasi web untuk monitoring database dengan struktur modular.

## Struktur Aplikasi

Aplikasi ini menggunakan struktur modular untuk memudahkan pemeliharaan dan pengembangan:

```
/
├── public/
│   ├── css/
│   │   └── modules/
│   │       └── gwscanner-overtime.css
│   ├── js/
│   │   ├── modules/
│   │   │   ├── notification.js
│   │   │   ├── stats.js
│   │   │   └── gwscanner-overtime.js
│   │   └── app.js
│   └── data/
├── query/
│   ├── gwscanner-overtime/
│   │   ├── dataOperations.js
│   │   ├── index.js
│   │   └── queries.js
│   ├── dataOperations.js
│   ├── dbConnection.js
│   └── index.js
├── views/
│   └── index.ejs
└── server.js
```

## Modul JavaScript

Aplikasi ini menggunakan pola modul JavaScript untuk memisahkan fungsionalitas:

1. **app.js** - File utama yang menginisialisasi semua modul
2. **modules/notification.js** - Modul untuk menangani notifikasi
3. **modules/stats.js** - Modul untuk menangani statistik data
4. **modules/gwscanner-overtime.js** - Modul untuk menangani data GWScanner-Overtime

## Modul CSS

Setiap modul memiliki file CSS terpisah untuk memudahkan pemeliharaan:

1. **modules/gwscanner-overtime.css** - Styles untuk modul GWScanner-Overtime

## Modul Query

Query database diorganisir dalam direktori terpisah:

1. **query/gwscanner-overtime/** - Query dan operasi data untuk GWScanner-Overtime

## Cara Menambahkan Modul Baru

Untuk menambahkan modul baru, ikuti langkah-langkah berikut:

1. Buat file JavaScript di `public/js/modules/[nama-modul].js`
2. Buat file CSS di `public/css/modules/[nama-modul].css`
3. Buat direktori query di `query/[nama-modul]/`
4. Tambahkan link ke file CSS dan JavaScript di `views/index.ejs`
5. Inisialisasi modul di `public/js/app.js`

## Pengembangan

Untuk mengembangkan aplikasi ini:

1. Clone repository
2. Install dependencies: `npm install`
3. Jalankan server: `node server.js`
4. Akses aplikasi di `http://localhost:3000` 