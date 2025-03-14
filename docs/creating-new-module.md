# Panduan Membuat Modul Baru

Dokumen ini menjelaskan langkah-langkah untuk membuat modul baru dalam aplikasi Monitoring Database.

## Struktur Modul

Setiap modul terdiri dari beberapa komponen:

1. **Backend**
   - Query SQL
   - Operasi data
   - API endpoints

2. **Frontend**
   - Modul JavaScript
   - Styles CSS
   - Komponen UI

## Langkah-langkah Membuat Modul Baru

### 1. Buat Direktori Query

```bash
mkdir -p query/nama-modul
```

### 2. Buat File SQL

Buat file SQL untuk query yang diperlukan:

```sql
-- query/Nama_Modul_Query.sql
DECLARE @TargetMonth INT = MONTH(GETDATE());
DECLARE @TargetYear INT = YEAR(GETDATE());

SELECT 
    column1,
    column2,
    column3
FROM 
    [database].[schema].[table]
WHERE 
    MONTH(date_column) = @TargetMonth
    AND YEAR(date_column) = @TargetYear;
```

### 3. Buat File JavaScript untuk Query

```javascript
// query/nama-modul/queries.js
const path = require('path');
const { getQueryFromFile } = require('../dbConnection');

// Path ke file SQL
const NAMA_MODUL_SQL = path.join(__dirname, '../Nama_Modul_Query.sql');

// Konstanta query
const NAMA_MODUL_QUERY = getQueryFromFile(NAMA_MODUL_SQL);

module.exports = {
    NAMA_MODUL_QUERY
};
```

### 4. Buat File JavaScript untuk Operasi Data

```javascript
// query/nama-modul/dataOperations.js
const { executeQuery } = require('../dbConnection');
const { NAMA_MODUL_QUERY } = require('./queries');
const { saveQueryResultsToJson, saveQueryHistory } = require('../dataOperations');

// Fungsi untuk mendapatkan data
async function getNamaModulData() {
    try {
        const data = await executeQuery(NAMA_MODUL_QUERY);
        
        // Simpan hasil query ke file JSON untuk tampilan
        saveQueryResultsToJson('nama_modul', data);
        
        // Simpan data ke history
        saveQueryHistory('nama_modul', data);
        
        return data;
    } catch (err) {
        console.error('Error getting nama modul data:', err);
        throw err;
    }
}

module.exports = {
    getNamaModulData
};
```

### 5. Buat File Index untuk Modul

```javascript
// query/nama-modul/index.js
const { getNamaModulData } = require('./dataOperations');

module.exports = {
    getNamaModulData
};
```

### 6. Update File Index Utama

```javascript
// query/index.js
const { NAMA_MODUL_QUERY } = require('./nama-modul/queries');

module.exports = {
    // Existing exports
    NAMA_MODUL_QUERY
};
```

### 7. Update File dataOperations.js Utama

```javascript
// query/dataOperations.js
const { NAMA_MODUL_QUERY } = require('./index');
const { getNamaModulData } = require('./nama-modul/dataOperations');

// Tambahkan ke historyData
function loadAllHistoryData() {
    try {
        const historyData = {
            // Existing data types
            nama_modul: []
        };
        
        // Existing code
    }
}

module.exports = {
    // Existing exports
    getNamaModulData
};
```

### 8. Buat Modul JavaScript Frontend

```javascript
// public/js/modules/nama-modul.js
const NamaModulModule = (function() {
    // Private variables
    let dataTable = null;
    let data = [];
    
    // DOM elements
    const tableId = 'namaModulTable';
    const updateBtnId = 'updateNamaModulBtn';
    
    /**
     * Inisialisasi modul
     */
    function init() {
        // Inisialisasi event listeners
        initEventListeners();
        
        // Load data awal
        loadData();
    }
    
    /**
     * Inisialisasi event listeners
     */
    function initEventListeners() {
        // Event listener untuk tombol update data
        const updateBtn = document.getElementById(updateBtnId);
        if (updateBtn) {
            updateBtn.addEventListener('click', function() {
                refreshData();
            });
        }
    }
    
    /**
     * Load data dari server
     */
    function loadData() {
        // Implementation
    }
    
    /**
     * Refresh data dari server
     */
    function refreshData() {
        // Implementation
    }
    
    // Public API
    return {
        init: init,
        refreshData: refreshData
    };
})();

// Export modul
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NamaModulModule;
} else {
    window.NamaModulModule = NamaModulModule;
}
```

### 9. Buat File CSS untuk Modul

```css
/* public/css/modules/nama-modul.css */
/**
 * Styles for Nama Modul
 */

/* Specific styles for this module */
```

### 10. Update File HTML

```html
<!-- views/index.ejs -->
<!-- CSS -->
<link href="/css/modules/nama-modul.css" rel="stylesheet">

<!-- Tab -->
<li class="nav-item" role="presentation">
    <button class="nav-link" id="nama-modul-tab" data-bs-toggle="pill" data-bs-target="#nama-modul-data" type="button" role="tab">
        <i class="fas fa-icon me-2"></i>Nama Modul
    </button>
</li>

<!-- Content -->
<div class="tab-pane fade" id="nama-modul-data" role="tabpanel">
    <div class="card">
        <div class="card-body">
            <div class="table-responsive">
                <table id="namaModulTable" class="table table-striped table-bordered">
                    <thead>
                        <tr>
                            <th>Column 1</th>
                            <th>Column 2</th>
                            <th>Column 3</th>
                        </tr>
                    </thead>
                    <tbody>
                        <!-- Data akan diisi melalui JavaScript -->
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<!-- JavaScript -->
<script src="/js/modules/nama-modul.js"></script>
```

### 11. Update File app.js

```javascript
// public/js/app.js
document.addEventListener('DOMContentLoaded', function() {
    // Existing code
    
    // Inisialisasi modul baru
    if (window.NamaModulModule) {
        NamaModulModule.init();
        console.log('Nama Modul module initialized');
    }
});
```

### 12. Update Server.js

```javascript
// server.js
const { getNamaModulData } = require('./query/nama-modul');

// Tambahkan ke initializeData
async function initializeData() {
    try {
        // Existing code
        
        // Tambahkan pengecekan data modul baru
        const namaModulData = await getNamaModulData();
        saveTempData('nama_modul', namaModulData);
        console.log('Nama Modul data saved to temporary file');
        
        // Existing code
    } catch (error) {
        console.error('Error initializing data:', error);
        return false;
    }
}

// Tambahkan ke route utama
app.get('/', async (req, res) => {
    try {
        // Existing code
        const namaModulData = loadTempData('nama_modul');
        
        // Existing code
        res.render('index', { 
            // Existing data
            namaModulData: namaModulData && namaModulData.data ? namaModulData.data : [],
            // Existing data
        });
    } catch (error) {
        // Error handling
    }
});
```

## Contoh Lengkap

Lihat modul GWScanner-Overtime sebagai contoh lengkap implementasi modul:

- [query/gwscanner-overtime/](../query/gwscanner-overtime/)
- [public/js/modules/gwscanner-overtime.js](../public/js/modules/gwscanner-overtime.js)
- [public/css/modules/gwscanner-overtime.css](../public/css/modules/gwscanner-overtime.css) 