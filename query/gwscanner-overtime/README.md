# Modul GWScanner-Overtime

Modul ini menangani sinkronisasi data antara GWScanner dan Overtime.

## Struktur Modul

```
gwscanner-overtime/
├── dataOperations.js - Operasi data untuk GWScanner-Overtime
├── index.js - Export fungsi-fungsi utama
├── queries.js - Definisi query SQL
└── README.md - Dokumentasi modul
```

## Fungsi Utama

### `getNotSyncGWScannerOvertimeData()`

Mengambil data yang tidak sinkron antara GWScanner dan Overtime.

```javascript
const { getNotSyncGWScannerOvertimeData } = require('./query/gwscanner-overtime');

// Contoh penggunaan
async function checkNotSyncStatus() {
    try {
        const notSyncData = await getNotSyncGWScannerOvertimeData();
        console.log(`Ditemukan ${notSyncData.length} data yang tidak sinkron`);
    } catch (err) {
        console.error('Error:', err);
    }
}
```

## Query SQL

Modul ini menggunakan file SQL:

1. `Not_Sync_GwScanner_Overtime.sql` - Query untuk menemukan data yang ada di Overtime tapi tidak ada di GWScanner

## Frontend

Modul ini memiliki komponen frontend yang terdiri dari:

1. `public/js/modules/gwscanner-overtime.js` - Modul JavaScript untuk menangani data GWScanner-Overtime
2. `public/css/modules/gwscanner-overtime.css` - Styles untuk modul GWScanner-Overtime

## Cara Penggunaan

```javascript
// Di server.js
const { getNotSyncGWScannerOvertimeData } = require('./query/gwscanner-overtime');

// Contoh penggunaan dalam endpoint API
app.get('/api/gwscanner-overtime', async (req, res) => {
    try {
        const data = await getNotSyncGWScannerOvertimeData();
        res.json({ success: true, data });
    } catch (err) {
        console.error('Error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});
``` 