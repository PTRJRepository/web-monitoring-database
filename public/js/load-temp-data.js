/**
 * load-temp-data.js
 * Script untuk memuat dan menampilkan data dari file-file temp JSON
 */

// Mapping nama file temp ke tab dan container di UI
const dataMapping = {
  'tunjangan_beras_temp.json': {
    tabSelector: '[data-bs-target="#tunjangan-data"], #tunjangan-tab',
    containerId: 'tunjangan-beras-container',
    tableId: 'tunjangan-beras-table',
    title: 'Data Tunjangan Beras'
  },
  'bpjs_temp.json': {
    tabSelector: '[data-bs-target="#bpjs-data"], #bpjs-tab',
    containerId: 'bpjs-container',
    tableId: 'bpjs-table',
    title: 'Data BPJS'
  },
  'gwscanner_temp.json': {
    tabSelector: '[data-bs-target="#gwscanner-data"], #gwscanner-tab',
    containerId: 'gwscanner-container',
    tableId: 'gwscanner-table',
    title: 'Data GWScanner Duplicate'
  },
  'ffbworker_temp.json': {
    tabSelector: '[data-bs-target="#ffbworker-data"], #ffb-worker-tab',
    containerId: 'ffb-worker-container',
    tableId: 'ffb-worker-table',
    title: 'Data FFB Worker'
  },
  'gwscanner_overtime_not_sync_temp.json': {
    tabSelector: '[data-bs-target="#gwscanner-overtime-data"], #gwscanner-overtime-tab',
    containerId: 'gwscanner-overtime-container',
    tableId: 'gwscanner-overtime-table',
    title: 'Data GWScanner Overtime Not Sync'
  },
  'gwscanner_taskreg_temp.json': {
    tabSelector: '[data-bs-target="#gwscanner-taskreg-data"], #gwscanner-taskreg-tab',
    containerId: 'gwscanner-taskreg-container',
    tableId: 'gwscanner-taskreg-table',
    title: 'Data GWScanner Task Registration'
  }
};

// Variabel untuk menyimpan cache data
const loadedData = {};
const dataCache = {
  timestamp: Date.now(),
  expiresIn: 10 * 60 * 1000, // Cache berlaku selama 10 menit
  loadedTables: {} // Track tabel yang sudah di-load
};

// Expose loadedData ke global scope
window.loadedData = loadedData;
window.dataCache = dataCache;

// Add this at the beginning of the file, after any existing declarations
let loadingInProgress = {};

// Fungsi untuk memuat data dari temp file
function loadDataFromTemp(filename, forceRefresh = false) {
  // Tambahkan loading indicator ke UI
  const loadingStatus = document.getElementById('dataLoadingStatus');
  if (loadingStatus) {
    loadingStatus.innerHTML = `<i class="fas fa-sync fa-spin"></i> Memuat data ${filename}...`;
    loadingStatus.style.display = 'inline-block';
  }
  
  // Debug untuk tracking performa
  console.log(`Loading data from temp file: ${filename}, forceRefresh: ${forceRefresh}`);
  
  // Cek apakah file sedang dalam proses loading
  if (loadingInProgress[filename]) {
    console.log(`File ${filename} sedang dalam proses loading, tunggu hingga selesai`);
    
    // Kembalikan promise yang existing
    return loadingInProgress[filename];
  }
  
  // Cek cache
  if (!forceRefresh && window.dataCache && window.dataCache.loadedTables[filename]) {
    const cacheEntry = window.dataCache.loadedTables[filename];
    const now = Date.now();
    
    // Periksa apakah cache masih valid
    if (now - cacheEntry.timestamp < window.dataCache.expiresIn) {
      console.log(`Menggunakan data cache untuk ${filename}, umur: ${(now - cacheEntry.timestamp) / 1000} detik`);
      
      if (loadingStatus) {
        loadingStatus.innerHTML = `<i class="fas fa-check text-success"></i> Menggunakan data cache`;
        setTimeout(() => {
          loadingStatus.style.display = 'none';
        }, 2000);
      }
      
      return Promise.resolve(cacheEntry.data);
    } else {
      console.log(`Cache untuk ${filename} sudah expired, memuat ulang`);
    }
  }
  
  // Buat promise baru dan simpan referensinya
  const loadPromise = new Promise((resolve, reject) => {
    fetch(`/temp/${filename}`, {
      cache: 'no-store',
      headers: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache'
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
      }
      
      // Periksa Content-Type untuk memastikan ini JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Expected JSON response, got ${contentType || 'unknown'}`);
      }
      
      return response.json();
    })
    .then(jsonData => {
      // Periksa struktur data
      let data = jsonData;
      
      // Jika data dalam format { timestamp, data: [...] }
      if (jsonData && typeof jsonData === 'object' && jsonData.data && Array.isArray(jsonData.data)) {
        data = jsonData.data;
      } else if (jsonData && typeof jsonData === 'object' && jsonData.error) {
        // Ada error dari server
        throw new Error(`Server error: ${jsonData.error}`);
      }
      
      // Validasi data adalah array
      if (!Array.isArray(data)) {
        console.error(`Data dalam ${filename} bukan array:`, data);
        data = [];
      }
      
      // Simpan ke cache
      if (window.dataCache) {
        window.dataCache.loadedTables[filename] = {
          data: data,
          timestamp: Date.now()
        };
        
        // Update window.loadedData juga
        if (window.loadedData) {
          window.loadedData[filename] = data;
        }
      }
      
      // Update loading status
      if (loadingStatus) {
        loadingStatus.innerHTML = `<i class="fas fa-check text-success"></i> Data ${filename} berhasil dimuat`;
        setTimeout(() => {
          loadingStatus.style.display = 'none';
        }, 2000);
      }
      
      // Update status koneksi DB
      if (typeof updateDbStatusIndicator === 'function') {
        updateDbStatusIndicator('connected');
      }
      
      resolve(data);
    })
    .catch(error => {
      console.error(`Error loading ${filename}:`, error);
      
      // Update loading status dengan error
      if (loadingStatus) {
        loadingStatus.innerHTML = `<i class="fas fa-exclamation-triangle text-danger"></i> Gagal memuat ${filename}: ${error.message}`;
        setTimeout(() => {
          loadingStatus.style.display = 'none';
        }, 3000);
      }
      
      // Update status koneksi DB jika error
      if (typeof updateDbStatusIndicator === 'function') {
        const errorMessage = error.message || 'Unknown error';
        if (errorMessage.includes('Failed to fetch') || 
            errorMessage.includes('NetworkError')) {
          updateDbStatusIndicator('disconnected');
        } else {
          updateDbStatusIndicator('error');
        }
      }
      
      // Cek apakah ada data cache yang bisa digunakan
      if (window.dataCache && window.dataCache.loadedTables[filename]) {
        console.log(`Menggunakan data cache untuk ${filename} karena error:`, error.message);
        resolve(window.dataCache.loadedTables[filename].data);
      } else {
        // Jika tidak ada cache, kembalikan array kosong
        console.log(`Tidak ada cache untuk ${filename}, mengembalikan array kosong`);
        
        // Simpan array kosong ke cache untuk mencegah error berkelanjutan
        if (window.dataCache) {
          window.dataCache.loadedTables[filename] = {
            data: [],
            timestamp: Date.now()
          };
        }
        
        resolve([]);
      }
    })
    .finally(() => {
      // Hapus referensi promise
      delete loadingInProgress[filename];
    });
  });
  
  // Simpan promise di tracking object
  loadingInProgress[filename] = loadPromise;
  
  return loadPromise;
}

// Expose fungsi ke global scope
window.loadDataFromTemp = loadDataFromTemp;

// Fungsi untuk memuat data hanya untuk summary (metadata saja)
function loadDataSummaryOnly() {
  // Daftar file yang akan dimuat
  const files = [
    'tunjangan_beras_temp.json',
    'bpjs_temp.json',
    'gwscanner_temp.json',
    'ffbworker_temp.json',
    'gwscanner_overtime_not_sync_temp.json',
    'gwscanner_taskreg_temp.json'
  ];
  
  // Tampilkan loading global
  showLoading(true, 'Memuat ringkasan data...');
  
  // Muat data secara paralel dengan Promise.allSettled
  return Promise.allSettled(files.map(file => {
    return loadDataFromTemp(file)
      .then(data => {
        // Hanya simpan metadata tanpa menampilkan tabel
        return { file, count: data.length };
      });
  }))
  .then(results => {
    // Sembunyikan loading
    showLoading(false);
    
    // Emit event bahwa data telah dimuat
    const event = new CustomEvent('dataSummaryLoaded', { detail: { loadedData } });
    document.dispatchEvent(event);
    
    return loadedData;
  });
}

// Fungsi untuk memuat semua data sekaligus secara paralel
function loadAndDisplayAllTempData() {
  // Jika semua data sudah di-cache dan masih valid, gunakan cache
  if (window.dataPreloaded && 
      dataCache.timestamp && 
      (Date.now() - dataCache.timestamp) < dataCache.expiresIn) {
    
    console.log('Semua data sudah dimuat sebelumnya dan masih valid');
    return Promise.resolve(loadedData);
  }
  
  // Pertama, muat hanya summary data untuk tampilan chart
  return loadDataSummaryOnly().then(() => {
    console.log("Summary data loaded, delaying full data load");
    
    // Set flag bahwa data ringkasan sudah dimuat
    window.dataSummaryLoaded = true;
    
    // Return loadedData yang berisi summary data
    return loadedData;
  });
}

// Fungsi untuk memuat dan menampilkan data tab yang aktif saja
function loadAndDisplayActiveTabData(tabId) {
  // Jika tabId tidak valid, batalkan
  if (!tabId) {
    console.warn('TabID tidak valid saat mencoba memuat data');
    return Promise.reject(new Error('TabID tidak valid'));
  }
  
  // Dapatkan filename berdasarkan tabId
  const filename = getFilenameFromTabId(tabId);
  // Karena getFilenameFromTabId sudah mengembalikan fallback, tidak perlu cek null
  
  // Jika data sudah dimuat dan valid, gunakan saja
  if (dataCache.loadedTables[tabId] && 
      loadedData[filename] && 
      (Date.now() - dataCache.timestamp) < dataCache.expiresIn) {
    
    console.log(`Tabel ${tabId} sudah dimuat sebelumnya dan masih valid`);
    return Promise.resolve(loadedData[filename]);
  }
  
  // Muat data untuk tab aktif
  console.log(`Memuat data untuk tab aktif: ${tabId} dengan file ${filename}`);
  
  // Tampilkan loading di container tab
  const tabPane = document.getElementById(getContainerIdFromTabId(tabId));
  if (tabPane) {
    tabPane.innerHTML = `
      <div class="loading-container">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p>Memuat data untuk ${getDisplayNameFromTabId(tabId)}...</p>
      </div>
    `;
  }
  
  // Set timer untuk menghentikan loading jika terlalu lama
  const loadingTimeout = setTimeout(() => {
    const container = document.getElementById(getContainerIdFromTabId(tabId));
    if (container) {
      console.log(`Timeout loading untuk tab ${tabId}, menampilkan pesan data kosong`);
      container.innerHTML = '<div class="alert alert-warning"><i class="fas fa-info-circle me-2"></i><strong>Tidak ada data</strong> - Data tidak tersedia atau kosong setelah menunggu beberapa detik.</div>';
    }
  }, 10000); // 10 detik timeout
  
  return loadDataFromTemp(filename)
    .then(data => {
      // Clear timeout karena data berhasil dimuat
      clearTimeout(loadingTimeout);
      
      // Tandai bahwa tabel untuk tab ini sudah dimuat
      dataCache.loadedTables[tabId] = true;
      
      // Tampilkan data di UI
      try {
        const container = document.getElementById(getContainerIdFromTabId(tabId));
        if (container && typeof displayDataInTable === 'function') {
          // Tampilkan data di tabel
          displayDataInTable(data, tabId);
        }
      } catch (displayError) {
        console.error(`Error saat menampilkan data di tab ${tabId}:`, displayError);
      }
      
      return data;
    })
    .catch(error => {
      // Clear timeout karena sudah ada error
      clearTimeout(loadingTimeout);
      
      console.error(`Error loading data for tab ${tabId}:`, error);
      const container = document.getElementById(getContainerIdFromTabId(tabId));
      if (container) {
        container.innerHTML = `
          <div class="alert alert-danger">
            <i class="fas fa-exclamation-triangle me-2"></i>
            <strong>Error:</strong> ${error.message || 'Terjadi kesalahan saat memuat data.'}
            <div class="mt-2">
              <button class="btn btn-sm btn-outline-danger" onclick="window.location.reload()">
                <i class="fas fa-sync-alt me-1"></i> Refresh Halaman
              </button>
            </div>
          </div>
        `;
      }
      
      // Dapatkan data dari cache jika ada
      if (window.dataCache && window.dataCache.loadedTables[tabId]) {
        console.log(`Menggunakan data cache untuk tab ${tabId} setelah error`);
        // Kembalikan data cache meskipun ada error
        return window.dataCache.loadedTables[tabId].data || [];
      }
      
      return Promise.reject(error);
    });
}

// Fungsi untuk mendapatkan filename berdasarkan tabId
function getFilenameFromTabId(tabId) {
  if (!tabId) {
    console.warn('TabID tidak valid, menggunakan default tab');
    return 'tunjangan_beras_temp.json'; // Default fallback
  }
  
  // Map TabID ke filename
  const tabToFilenameMap = {
    'tunjangan-tab': 'tunjangan_beras_temp.json',
    'bpjs-tab': 'bpjs_temp.json',
    'gwscanner-tab': 'gwscanner_temp.json',
    'ffbworker-tab': 'ffbworker_temp.json',
    'gwscanner-overtime-tab': 'gwscanner_overtime_not_sync_temp.json',
    'gwscanner-taskreg-tab': 'gwscanner_taskreg_temp.json'
  };
  
  // Cek apakah tabId ada dalam mapping
  if (tabToFilenameMap[tabId]) {
    return tabToFilenameMap[tabId];
  }
  
  // Jika tabId tidak dikenali, coba dapatkan default tab
  console.warn(`TabID '${tabId}' tidak dikenali, menggunakan default tab`);
  
  // Cek apakah ada tab aktif yang bisa digunakan
  const activeTab = document.querySelector('.nav-link.active[id$="-tab"]');
  if (activeTab && tabToFilenameMap[activeTab.id]) {
    console.log(`Menggunakan tab aktif ${activeTab.id} sebagai alternatif`);
    return tabToFilenameMap[activeTab.id];
  }
  
  // Default fallback
  return 'tunjangan_beras_temp.json';
}

// Fungsi untuk mendapatkan container ID berdasarkan tabId
function getContainerIdFromTabId(tabId) {
  switch (tabId) {
    case 'tunjangan-tab':
      return 'tunjangan-data';
    case 'bpjs-tab':
      return 'bpjs-data';
    case 'gwscanner-tab':
      return 'gwscanner-data';
    case 'ffbworker-tab':
      return 'ffbworker-data';
    case 'gwscanner-overtime-tab':
      return 'gwscanner-overtime-data';
    case 'gwscanner-taskreg-tab':
      return 'gwscanner-taskreg-data';
    default:
      return null;
  }
}

// Fungsi untuk mendapatkan nama display berdasarkan tabId
function getDisplayNameFromTabId(tabId) {
  switch (tabId) {
    case 'tunjangan-tab':
      return 'Tunjangan Beras';
    case 'bpjs-tab':
      return 'BPJS';
    case 'gwscanner-tab':
      return 'GWScanner';
    case 'ffbworker-tab':
      return 'FFB Worker';
    case 'gwscanner-overtime-tab':
      return 'GWScanner Overtime';
    case 'gwscanner-taskreg-tab':
      return 'GWScanner Task Registration';
    default:
      return 'Data';
  }
}

// Fungsi untuk mendapatkan tabId berdasarkan filename
function getTabIdForFilename(filename) {
  switch (filename) {
    case 'tunjangan_beras_temp.json':
      return 'tunjangan-tab';
    case 'bpjs_temp.json':
      return 'bpjs-tab';
    case 'gwscanner_temp.json':
      return 'gwscanner-tab';
    case 'ffbworker_temp.json':
      return 'ffbworker-tab';
    case 'gwscanner_overtime_not_sync_temp.json':
      return 'gwscanner-overtime-tab';
    case 'gwscanner_taskreg_temp.json':
      return 'gwscanner-taskreg-tab';
    default:
      return null;
  }
}

// Expose getTabIdForFilename ke global scope
window.getTabIdForFilename = getTabIdForFilename;

// Jalankan setelah DOM dimuat
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM Content Loaded, memuat data dari temp...");
  
  // Setup listener untuk tab clicks untuk lazy loading
  setupTabClickListeners();
  
  // Preload hanya summary data saat aplikasi dimuat
  loadDataSummaryOnly().then(() => {
    console.log("Summary data loaded successfully");
    
    // Tandai bahwa data ringkasan sudah dimuat
    window.dataSummaryLoaded = true;
    
    // Emit event bahwa data ringkasan telah dimuat
    const event = new CustomEvent('dataSummaryLoaded', { detail: { loadedData } });
    document.dispatchEvent(event);
  });
});

// Setup event listener untuk tab clicks untuk lazy loading
function setupTabClickListeners() {
  const tabLinks = document.querySelectorAll('.nav-link[id$="-tab"]');
  
  tabLinks.forEach(tab => {
    tab.addEventListener('click', function() {
      const tabId = this.id;
      console.log(`Tab clicked: ${tabId}`);
      
      // Muat dan tampilkan data hanya untuk tab yang aktif
      loadAndDisplayActiveTabData(tabId).then(data => {
        console.log(`Data untuk tab ${tabId} berhasil dimuat:`, data.length);
      }).catch(error => {
        console.error(`Error saat memuat data untuk tab ${tabId}:`, error);
      });
    });
  });
}

// Fungsi untuk menampilkan data dalam tabel dengan pagination dan optimasi
function displayDataInTable(data, tabId) {
  // Dapatkan container ID berdasarkan tabId
  const containerId = getContainerIdFromTabId(tabId);
  const container = document.getElementById(containerId);
  
  if (!container) {
    console.error(`Container untuk tab ${tabId} tidak ditemukan`);
    return;
  }
  
  // Jika data kosong, tampilkan pesan
  if (!data || !Array.isArray(data) || data.length === 0) {
    container.innerHTML = '<div class="alert alert-warning"><i class="fas fa-info-circle me-2"></i><strong>Tidak ada data</strong> - Data tidak tersedia atau kosong.</div>';
    return;
  }
  
  // Dapatkan filename dari tabId
  const filename = getFilenameFromTabId(tabId);
  
  // Dapatkan mapping berdasarkan filename
  const mapping = dataMapping[filename];
  
  // Tentukan tableId
  const tableId = mapping ? mapping.tableId : tabId.replace('-tab', '-table');
  
  // Buat header tabel
  let headerHtml = '';
  Object.keys(data[0]).forEach(key => {
    // Tambahkan data-name attribute untuk setiap kolom, untuk digunakan oleh filter
    headerHtml += `<th data-name="${key}">${formatColumnTitle(key)}</th>`;
  });
  
  // Siapkan HTML untuk tabel
  container.innerHTML = '<div class="table-responsive"><table id="' + tableId + '" class="table table-striped table-bordered" style="width:100%"><thead><tr>' + headerHtml + '</tr></thead></table></div>';
  
  // Siapkan kolom untuk DataTable
  const columns = Object.keys(data[0]).map(key => {
    return {
      data: key,
      title: formatColumnTitle(key),
      name: key // Tambahkan name attribute untuk setiap kolom
    };
  });
  
  let dataTable;
  
  try {
    // Inisialisasi DataTable
    dataTable = $('#' + tableId).DataTable({
      data: data,
      columns: columns,
      processing: true,
      paging: true,
      pageLength: 10, // Default page length
      language: {
        "processing": "Memproses...",
        "search": "Cari:",
        "lengthMenu": "Tampilkan _MENU_ data",
        "info": "Menampilkan _START_ sampai _END_ dari _TOTAL_ data",
        "infoEmpty": "Tidak ada data yang tersedia",
        "infoFiltered": "(difilter dari _MAX_ total data)",
        "paginate": {
          "first": "Pertama",
          "last": "Terakhir",
          "next": "Selanjutnya",
          "previous": "Sebelumnya"
        }
      }
    });
    
    console.log(`DataTable untuk ${tableId} berhasil diinisialisasi`);
    
    // Tambahkan info dan grafik jika mapping tersedia
    if (mapping) {
      try {
        // Hapus table-responsive div, simpan untuk diposisikan setelah info cards
        const tableResponsive = container.querySelector('.table-responsive');
        if (tableResponsive) {
          const parent = tableResponsive.parentNode;
          tableResponsive.remove();
          
          // Buat info cards dan tampilkan di atas tabel
          createInfoCards(data, mapping, parent);
          
          // Tambahkan kembali tabel setelah info cards
          parent.appendChild(tableResponsive);
        }
      } catch (infoError) {
        console.error(`Error saat membuat info cards:`, infoError);
      }
    }
  } catch (error) {
    console.error(`Error saat inisialisasi DataTable:`, error);
    container.innerHTML = '<div class="alert alert-danger"><i class="fas fa-exclamation-triangle me-2"></i><strong>Error:</strong> ' + error.message + '</div>';
  }
}

// Helper function untuk mendapatkan header tabel
function getTableHeaders(data, mapping) {
  if (!data) return '';
  
  let headers = '';
  const fields = mapping.fields || Object.keys(data);
  
  fields.forEach(field => {
    const title = formatColumnTitle(field);
    headers += `<th>${title}</th>`;
  });
  
  return headers;
}

// Helper function untuk mendapatkan konfigurasi kolom DataTable
function getDataTableColumns(data, mapping) {
  if (!data) return [];
  
  const columns = [];
  const fields = mapping.fields || Object.keys(data);
  
  fields.forEach(field => {
    columns.push({
      data: field,
      render: function(data, type, row) {
        if (data === null || data === undefined) return '-';
        if (type === 'display' && typeof data === 'string' && data.length > 100) {
          return data.substr(0, 100) + '...';
        }
        return data;
      }
    });
  });
  
  return columns;
}

// Fungsi untuk mendapatkan filter yang relevan berdasarkan data - DISABLED
function getRelevantFilters(data, targetFields) {
  // Fungsi dinonaktifkan - mengembalikan array kosong
  return [];
}

// Helper untuk mendapatkan filename dari mapping
function getFilenameForMapping(mapping) {
  const lookup = {
    'tunjangan-beras-container': 'tunjangan_beras_temp.json',
    'bpjs-container': 'bpjs_temp.json',
    'gwscanner-container': 'gwscanner_temp.json',
    'ffb-worker-container': 'ffbworker_temp.json', 
    'gwscanner-overtime-container': 'gwscanner_overtime_not_sync_temp.json',
    'gwscanner-taskreg-container': 'gwscanner_taskreg_temp.json'
  };
  
  return lookup[mapping.containerId] || '';
}

// Helper untuk mendapatkan nilai unik dari array objek
function getUniqueValues(data, field) {
  const values = data.map(item => item[field]);
  return [...new Set(values)].filter(Boolean);
}

// Helper untuk memformat judul kolom
function formatColumnTitle(key) {
  // Jika sudah uppercase (seperti TRANSNO), biarkan seperti itu
  if (key === key.toUpperCase()) {
    return key;
  }
  
  // Ubah camelCase atau snake_case menjadi Title Case dengan spasi
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

// Fungsi untuk menambahkan filter bubbles ke container - DISABLED
function addFilterBubbles(container, data, filters, dataTable) {
  // Fungsi dinonaktifkan - tidak menambahkan filter bubbles
  console.log('Filter functionality has been disabled');
  return null;
}

// Helper function untuk mengubah warna hex/hsl ke rgb
function hexToRgb(color) {
  // Jika format hsl
  if (color.startsWith('hsl')) {
    // Buat elemen sementara untuk mengkonversi hsl ke rgb
    const temp = document.createElement('div');
    temp.style.color = color;
    document.body.appendChild(temp);
    const rgbStr = getComputedStyle(temp).color;
    document.body.removeChild(temp);
    
    // Ekstrak nilai rgb
    const match = rgbStr.match(/rgb\((\d+), (\d+), (\d+)\)/);
    if (match) {
      return {
        r: parseInt(match[1], 10),
        g: parseInt(match[2], 10),
        b: parseInt(match[3], 10)
      };
    }
    return { r: 0, g: 0, b: 0 };
  }
  
  // Jika format hex
  let hex = color.replace('#', '');
  
  // Convert 3-character hex to 6-character hex
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  
  // Parse the hex values
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  return { r, g, b };
}

// Event listener untuk filter table
document.addEventListener('filterTable', function(event) {
  const detail = event.detail;
  
  // Cari semua DataTables yang ada
  $('.table').each(function() {
    const table = $(this).DataTable();
    if (!table) return;
    
    // Tambahkan atau hapus filter
    if (detail.active) {
      // Tambahkan filter baru
      table.column(`${detail.field}:name`).search(detail.value, true, false).draw();
    } else {
      // Hapus filter
      table.column(`${detail.field}:name`).search('').draw();
    }
  });
});

// Fungsi untuk membuat info cards dan grafik di atas tabel
function createInfoCards(data, mapping, container) {
  // Buat informasi yang sesuai dengan jenis data
  let stats = {};
  let chartData = [];
  
  if (mapping.tableId === 'gwscanner-table') {
    // Stats untuk GWScanner
    stats = {
      totalData: data.length,
      duplikat: countDuplicatesInGWScanner(data),
      verifikasi: countVerificationNeeded(data),
      interval: '5 menit'
    };
    
    // Chart data untuk GWScanner - kelompokkan berdasarkan TOOCCODE
    chartData = groupDataForChart(data, 'TOOCCODE');
  } else if (mapping.tableId === 'ffb-worker-table') {
    // Stats untuk FFB Worker
    stats = {
      totalData: data.length,
      nonPemanen: countByCondition(data, 'WORKERCODE', (code) => code && !code.startsWith('P')),
      pemanen: countByCondition(data, 'WORKERCODE', (code) => code && code.startsWith('P')), 
      interval: '10 menit'
    };
    
    // Chart data untuk FFB Worker - kelompokkan berdasarkan FROMOCCODE
    chartData = groupDataForChart(data, 'FROMOCCODE');
  } else if (mapping.tableId === 'gwscanner-overtime-table') {
    // Stats untuk GWScanner-Overtime
    stats = {
      totalData: data.length,
      tidakSinkron: data.length,
      perluDiverifikasi: countByCondition(data, 'Status GWScanner', status => status !== 'OK'),
      interval: '15 menit'
    };
    
    // Chart data berdasarkan Status GWScanner
    chartData = groupDataForChart(data, 'Status GWScanner');
  } else {
    // Untuk jenis data lainnya
    stats = {
      totalData: data.length,
      dataError: 0,
      dataPending: 0,
      interval: '30 menit'
    };
    
    // Default chart data
    chartData = [{ label: mapping.title, value: data.length }];
  }

  // Buat container untuk stats cards
  const statsContainer = document.createElement('div');
  statsContainer.className = 'row mb-4';
  
  // Card 1 - Total Data
  let cardsHTML = `
    <div class="col-md-3">
      <div class="stats-card bg-info">
        <h5 class="card-title"><i class="fas fa-database me-2"></i>Total Data</h5>
        <p class="card-text">${stats.totalData}</p>
      </div>
    </div>
  `;
  
  // Card 2 - Spesifik per jenis data
  if (mapping.tableId === 'gwscanner-table') {
    cardsHTML += `
      <div class="col-md-3">
        <div class="stats-card bg-warning text-dark">
          <h5 class="card-title"><i class="fas fa-clone me-2"></i>Data Duplikat</h5>
          <p class="card-text">${stats.duplikat}</p>
        </div>
      </div>
    `;
  } else if (mapping.tableId === 'ffb-worker-table') {
    cardsHTML += `
      <div class="col-md-3">
        <div class="stats-card bg-warning text-dark">
          <h5 class="card-title"><i class="fas fa-user-hard-hat me-2"></i>Non-Pemanen</h5>
          <p class="card-text">${stats.nonPemanen}</p>
        </div>
      </div>
    `;
  } else if (mapping.tableId === 'gwscanner-overtime-table') {
    cardsHTML += `
      <div class="col-md-3">
        <div class="stats-card bg-warning text-dark">
          <h5 class="card-title"><i class="fas fa-sync-alt me-2"></i>Tidak Sinkron</h5>
          <p class="card-text">${stats.tidakSinkron}</p>
        </div>
      </div>
    `;
  } else {
    cardsHTML += `
      <div class="col-md-3">
        <div class="stats-card bg-warning text-dark">
          <h5 class="card-title"><i class="fas fa-exclamation-circle me-2"></i>Data Error</h5>
          <p class="card-text">${stats.dataError}</p>
        </div>
      </div>
    `;
  }
  
  // Card 3 - Perlu diverifikasi
  cardsHTML += `
    <div class="col-md-3">
      <div class="stats-card bg-danger">
        <h5 class="card-title"><i class="fas fa-exclamation-triangle me-2"></i>Perlu Diverifikasi</h5>
        <p class="card-text">${stats.verifikasi || stats.perluDiverifikasi || 0}</p>
      </div>
    </div>
  `;
  
  // Card 4 - Interval Update
  cardsHTML += `
    <div class="col-md-3">
      <div class="stats-card bg-success">
        <h5 class="card-title"><i class="fas fa-clock me-2"></i>Interval Check</h5>
        <p class="card-text">${stats.interval}</p>
      </div>
    </div>
  `;
  
  statsContainer.innerHTML = cardsHTML;
  container.appendChild(statsContainer);
  
  // Tambahkan grafik
  createChartForData(chartData, mapping.title, container);
  
  // Tambahkan timestamp
  const timestampDiv = document.createElement('div');
  timestampDiv.className = 'd-flex align-items-center mb-3';
  timestampDiv.innerHTML = `
    <i class="fas fa-history me-2"></i>
    <span>Last Check: ${new Date().toLocaleString('id-ID')}</span>
    <button class="btn btn-sm btn-primary ms-auto" id="refreshButton-${mapping.tableId}">
      <i class="fas fa-sync-alt me-1"></i>Refresh Data
    </button>
  `;
  container.appendChild(timestampDiv);
  
  // Tambahkan event listener untuk tombol refresh
  setTimeout(() => {
    const refreshButton = document.getElementById(`refreshButton-${mapping.tableId}`);
    if (refreshButton) {
      refreshButton.addEventListener('click', function() {
        // Dapatkan tabId yang sesuai dengan mapping ini
        const tabId = getTabIdForMappingTable(mapping.tableId);
        
        if (tabId) {
          // Cari filename dari mapping
          const filename = getFilenameFromTabId(tabId);
          
          if (filename) {
            // Hapus data dari cache agar dimuat ulang
            delete loadedData[filename];
            showInfoToast(`Memuat ulang data ${mapping.title}...`);
            
            // Muat ulang data
            loadDataFromTemp(filename, true)
              .then(freshData => {
                // Update tampilan dengan fungsi baru
                displayDataInTable(freshData, tabId);
              })
              .catch(error => {
                showErrorToast(`Error saat refresh data: ${error.message}`);
              });
          }
        }
      });
    }
  }, 100);
}

// Fungsi helper untuk mendapatkan tabId dari tableId mapping
function getTabIdForMappingTable(tableId) {
  switch(tableId) {
    case 'tunjangan-beras-table':
      return 'tunjangan-tab';
    case 'bpjs-table':
      return 'bpjs-tab';
    case 'gwscanner-table':
      return 'gwscanner-tab';
    case 'ffb-worker-table':
      return 'ffbworker-tab';
    case 'gwscanner-overtime-table':
      return 'gwscanner-overtime-tab';
    case 'gwscanner-taskreg-table':
      return 'gwscanner-taskreg-tab';
    default:
      return null;
  }
}

// Fungsi untuk membuat grafik
function createChartForData(chartData, title, container) {
  const chartContainer = document.createElement('div');
  chartContainer.className = 'mb-4';
  chartContainer.innerHTML = `
    <h5 class="mb-3">Grafik Jumlah Data</h5>
    <div class="chart-container" style="position: relative; height:300px;">
      <canvas id="chart-${Date.now()}"></canvas>
    </div>
  `;
  container.appendChild(chartContainer);
  
  // Temukan canvas yang baru dibuat
  const canvas = chartContainer.querySelector('canvas');
  
  // Tunggu sampai Chart.js dimuat
  setTimeout(() => {
    if (typeof Chart !== 'undefined') {
      // Siapkan data untuk grafik
      const labels = chartData.map(item => item.label);
      const values = chartData.map(item => item.value);
      
      // Buat warna acak untuk grafik
      const backgroundColors = generateChartColors(chartData.length);
      
      // Buat grafik
      new Chart(canvas, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: title,
            data: values,
            backgroundColor: backgroundColors,
            borderColor: backgroundColors.map(color => color.replace('0.6', '1')),
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Jumlah Data'
              }
            }
          },
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return `${context.dataset.label}: ${context.raw}`;
                }
              }
            }
          }
        }
      });
    } else {
      console.warn("Chart.js belum dimuat, tidak dapat membuat grafik");
      // Tambahkan pesan jika Chart.js tidak tersedia
      chartContainer.innerHTML += `
        <div class="alert alert-warning">
          Tidak dapat membuat grafik: library Chart.js tidak tersedia
        </div>
      `;
    }
  }, 100);
}

// Helper functions

// Menghasilkan warna acak untuk grafik
function generateChartColors(count) {
  const baseColors = [
    'rgba(54, 162, 235, 0.6)', // Biru
    'rgba(255, 99, 132, 0.6)',  // Merah
    'rgba(255, 206, 86, 0.6)',  // Kuning
    'rgba(75, 192, 192, 0.6)',  // Teal
    'rgba(153, 102, 255, 0.6)', // Ungu
    'rgba(255, 159, 64, 0.6)',  // Oranye
    'rgba(199, 199, 199, 0.6)'  // Abu-abu
  ];
  
  // Jika perlu lebih banyak warna dari yang tersedia, ulangi warna yang ada
  const colors = [];
  for (let i = 0; i < count; i++) {
    colors.push(baseColors[i % baseColors.length]);
  }
  
  return colors;
}

// Mengelompokkan data untuk grafik berdasarkan field tertentu
function groupDataForChart(data, field) {
  // Hitung frekuensi untuk setiap nilai field
  const groups = {};
  data.forEach(item => {
    const value = item[field] || 'Undefined';
    if (!groups[value]) {
      groups[value] = 0;
    }
    groups[value]++;
  });
  
  // Konversi ke format yang dibutuhkan untuk grafik
  return Object.entries(groups).map(([label, value]) => ({ label, value }));
}

// Menghitung duplikat di data GWScanner berdasarkan TRANSNO
function countDuplicatesInGWScanner(data) {
  const transnoCount = {};
  
  // Hitung frekuensi setiap TRANSNO
  data.forEach(item => {
    const transno = item.TRANSNO;
    if (transno) {
      if (!transnoCount[transno]) {
        transnoCount[transno] = 0;
      }
      transnoCount[transno]++;
    }
  });
  
  // Hitung berapa banyak TRANSNO yang muncul lebih dari sekali
  let duplicateCount = 0;
  Object.values(transnoCount).forEach(count => {
    if (count > 1) {
      duplicateCount += count - 1; // Hitung sebagai duplikat jika muncul lebih dari sekali
    }
  });
  
  return duplicateCount;
}

// Menghitung data yang perlu diverifikasi
function countVerificationNeeded(data) {
  // Kriteria verifikasi: item dengan TRANSSTATUS selain "OK"
  return data.filter(item => 
    item.TRANSSTATUS && !item.TRANSSTATUS.trim().startsWith('OK')
  ).length;
}

// Menghitung data berdasarkan kondisi tertentu
function countByCondition(data, field, conditionFn) {
  return data.filter(item => conditionFn(item[field])).length;
}

// Jalankan setelah DOM dimuat
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadAndDisplayAllTempData);
} else {
  loadAndDisplayAllTempData();
}

// Ekspor ke global scope
window.loadAndDisplayAllTempData = loadAndDisplayAllTempData;
window.loadDataSummaryOnly = loadDataSummaryOnly;
window.loadAndDisplayActiveTabData = loadAndDisplayActiveTabData;

// Add or update the updateContainerWithErrorMessage function
function updateContainerWithErrorMessage(filename, error) {
  try {
    const tabId = getTabIdForFilename(filename);
    if (!tabId) return;
    
    const containerId = getContainerIdFromTabId(tabId);
    const container = document.getElementById(containerId);
    
    if (!container) return;
    
    container.innerHTML = `
      <div class="alert alert-danger">
        <i class="fas fa-exclamation-triangle me-2"></i>
        <strong>Error memuat data:</strong> ${error.message}
        <div class="mt-2">
          <button class="btn btn-sm btn-danger refresh-error-btn" data-filename="${filename}" data-tabid="${tabId}">
            <i class="fas fa-sync-alt me-1"></i> Coba Lagi
          </button>
        </div>
      </div>
    `;
    
    // Add event listener to the refresh button
    const refreshBtn = container.querySelector('.refresh-error-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function() {
        // Get the filename and tabId from the button's data attribute
        const filename = this.getAttribute('data-filename');
        const tabId = this.getAttribute('data-tabid');
        
        // Show loading indicator again
        container.innerHTML = `
          <div class="alert alert-info loading-indicator">
            <div class="d-flex align-items-center">
              <div class="spinner-border spinner-border-sm me-2" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
              <div>
                <strong>Memuat ulang data...</strong>
              </div>
            </div>
          </div>
        `;
        
        // Try to reload
        loadDataFromTemp(filename, true)
          .then(data => {
            // Tampilkan data dengan parameter yang baru
            displayDataInTable(data, tabId);
          })
          .catch(err => {
            console.error("Error reloading data:", err);
            // Tampilkan pesan error lagi
            container.innerHTML = `
              <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>Error memuat data:</strong> ${err.message}
                <div class="mt-2">
                  <button class="btn btn-sm btn-outline-danger" onclick="window.location.reload()">
                    <i class="fas fa-sync-alt me-1"></i> Refresh Halaman
                  </button>
                </div>
              </div>
            `;
          });
      });
    }
  } catch (e) {
    console.error("Error updating container with error message:", e);
  }
}

// Fungsi filter telah dihapus
console.log('Filter functionality has been removed');

// Placeholder untuk fungsi yang telah dihapus agar tidak menyebabkan error
window.createValueFilters = function() {
  console.log('Filter functionality has been removed');
};

window.applyValueFilters = function() {
  console.log('Filter functionality has been removed');
};

window.saveFilterState = function() {
  console.log('Filter functionality has been removed');
};

window.addFilterBubbles = function() {
  console.log('Filter functionality has been removed');
};

// Helper function for escaping regex characters - kept for compatibility
function escapeRegExp(string) {
  if (!string) return '';
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
