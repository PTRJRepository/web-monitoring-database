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
        throw new Error(`Network response was not ok: ${response.status}`);
      }
      return response.json();
    })
    .then(jsonData => {
      // Periksa struktur data
      let data = jsonData;
      
      // Jika data dalam format { timestamp, data: [...] }
      if (jsonData && typeof jsonData === 'object' && jsonData.data && Array.isArray(jsonData.data)) {
        data = jsonData.data;
      }
      
      // Validasi data adalah array
      if (!Array.isArray(data)) {
        console.error(`Data dalam ${filename} bukan array:`);
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
      
      resolve(data);
    })
    .catch(error => {
      console.error(`Error loading ${filename}:`, error);
      
      // Update loading status dengan error
      if (loadingStatus) {
        loadingStatus.innerHTML = `<i class="fas fa-exclamation-triangle text-danger"></i> Gagal memuat ${filename}`;
        setTimeout(() => {
          loadingStatus.style.display = 'none';
        }, 3000);
      }
      
      reject(error);
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
    'gwscanner_overtime_not_sync_temp.json'
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
  if (!tabId) return Promise.reject(new Error('TabID tidak valid'));
  
  // Dapatkan filename berdasarkan tabId
  const filename = getFilenameFromTabId(tabId);
  if (!filename) return Promise.reject(new Error('Filename tidak ditemukan untuk tab ini'));
  
  // Jika data sudah dimuat dan valid, gunakan saja
  if (dataCache.loadedTables[tabId] && 
      loadedData[filename] && 
      (Date.now() - dataCache.timestamp) < dataCache.expiresIn) {
    
    console.log(`Tabel ${tabId} sudah dimuat sebelumnya dan masih valid`);
    return Promise.resolve(loadedData[filename]);
  }
  
  // Muat data untuk tab aktif
  console.log(`Memuat data untuk tab aktif: ${tabId}`);
  
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
  
  return loadDataFromTemp(filename)
    .then(data => {
      // Tandai bahwa tabel untuk tab ini sudah dimuat
      dataCache.loadedTables[tabId] = true;
      
      // Map file ke container yang sesuai
      const mapping = window.dataMapping ? window.dataMapping[filename] : null;
      
      if (mapping) {
        const tabElement = document.getElementById(tabId);
        
        if (tabElement && typeof displayDataInTable === 'function') {
          // Tampilkan data di tabel
          displayDataInTable(data, mapping, tabElement);
        }
      }
      
      return data;
    });
}

// Fungsi untuk mendapatkan filename berdasarkan tabId
function getFilenameFromTabId(tabId) {
  switch (tabId) {
    case 'tunjangan-tab':
      return 'tunjangan_beras_temp.json';
    case 'bpjs-tab':
      return 'bpjs_temp.json';
    case 'gwscanner-tab':
      return 'gwscanner_temp.json';
    case 'ffbworker-tab':
      return 'ffbworker_temp.json';
    case 'gwscanner-overtime-tab':
      return 'gwscanner_overtime_not_sync_temp.json';
    default:
      return null;
  }
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
function displayDataInTable(data, mapping, tabElement) {
  const containerId = mapping.containerId || getContainerIdFromTabId(tabElement.id);
  const container = document.getElementById(containerId);
  
  if (!container) {
    console.error(`Container ${containerId} tidak ditemukan`);
    return;
  }
  
  // Jika data kosong, tampilkan pesan
  if (!data || !Array.isArray(data) || data.length === 0) {
    container.innerHTML = '<div class="alert alert-warning"><i class="fas fa-info-circle me-2"></i><strong>Tidak ada data</strong> - Data tidak tersedia atau kosong.</div>';
    return;
  }
  
  // Tentukan tableId berdasarkan tabId
  const tableId = mapping.tableId;
  
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
      deferRender: true,
      scroller: true,
      scrollY: '50vh',
      paging: true,
      pageLength: 25,
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
    
    // Tambahkan filter bubbles di atas tabel
    const filterContainer = document.createElement('div');
    filterContainer.className = 'filter-container';
    container.prepend(filterContainer);
    
    // Tentukan kolom yang akan digunakan untuk filter
    const priorityFields = ['TOOCCODE', 'FROMOCCODE', 'TRANSSTATUS', 'SCANNERUSERCODE'];
    let filterField = '';
    
    // Cari kolom yang akan digunakan sebagai filter (gunakan kolom prioritas jika ada)
    for (const field of priorityFields) {
      if (Object.keys(data[0]).includes(field)) {
        filterField = field;
        break;
      }
    }
    
    // Jika tidak ada kolom prioritas, gunakan kolom pertama yang memiliki nilai berbeda
    if (!filterField) {
      const dataKeys = Object.keys(data[0]);
      for (const key of dataKeys) {
        const uniqueValues = new Set(data.map(item => item[key]));
        if (uniqueValues.size > 1 && uniqueValues.size <= 10) {
          filterField = key;
          break;
        }
      }
    }
    
    // Jika ada kolom untuk difilter, tambahkan filter bubbles
    if (filterField) {
      const uniqueValues = [...new Set(data.map(item => item[filterField]))].filter(Boolean);
      if (uniqueValues.length > 0 && uniqueValues.length <= 20) {
        // Buat objek filter
        const filters = [{
          field: filterField,
          values: uniqueValues
        }];
        
        // Tambahkan filter bubbles
        addFilterBubbles(filterContainer, data, filters, dataTable);
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

// Fungsi untuk mendapatkan filter yang relevan berdasarkan data
function getRelevantFilters(data, targetFields) {
  const filters = [];
  
  // Hanya gunakan field yang ada dalam data
  const availableFields = targetFields.filter(field => 
    data.length > 0 && data[0].hasOwnProperty(field)
  );
  
  // Batasi jumlah field untuk filter (maksimal 4)
  const limitedFields = availableFields.slice(0, 4);
  
  // Buat filter untuk setiap field
  limitedFields.forEach(field => {
    // Dapatkan nilai unik untuk field ini
    const uniqueValues = getUniqueValues(data, field);
    
    // Jika ada terlalu banyak nilai unik, batasi (misalnya user code bisa ratusan)
    const maxUniqueValues = 10;
    let limitedValues = uniqueValues;
    
    if (uniqueValues.length > maxUniqueValues) {
      console.log(`Terlalu banyak nilai unik untuk ${field} (${uniqueValues.length}), membatasi hingga ${maxUniqueValues}`);
      
      // Hitung frekuensi masing-masing nilai
      const valueCounts = {};
      data.forEach(item => {
        const value = item[field];
        if (value) {
          if (!valueCounts[value]) {
            valueCounts[value] = 0;
          }
          valueCounts[value]++;
        }
      });
      
      // Urutkan berdasarkan frekuensi (ambil yang paling sering muncul)
      const sortedValues = Object.entries(valueCounts)
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0])
        .slice(0, maxUniqueValues);
      
      limitedValues = sortedValues;
    }
    
    // Tambahkan filter jika ada nilai unik
    if (limitedValues.length > 0) {
      filters.push({
        field: field,
        values: limitedValues
      });
    }
  });
  
  return filters;
}

// Helper untuk mendapatkan filename dari mapping
function getFilenameForMapping(mapping) {
  const lookup = {
    'tunjangan-beras-container': 'tunjangan_beras_temp.json',
    'bpjs-container': 'bpjs_temp.json',
    'gwscanner-container': 'gwscanner_temp.json',
    'ffb-worker-container': 'ffbworker_temp.json', 
    'gwscanner-overtime-container': 'gwscanner_overtime_not_sync_temp.json'
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

// Fungsi untuk menambahkan filter bubbles ke container
function addFilterBubbles(container, data, filters, dataTable) {
  // Buat container filter yang lebih menarik
  const filterContainer = document.createElement('div');
  filterContainer.className = 'filter-container mb-4 p-3 bg-light rounded border';
  
  // Header filter
  const filterHeader = document.createElement('div');
  filterHeader.className = 'd-flex align-items-center mb-3';
  filterHeader.innerHTML = `
    <h5 class="m-0"><i class="fas fa-filter me-2 text-primary"></i>Filter Data:</h5>
  `;
  filterContainer.appendChild(filterHeader);
  
  // Container untuk semua kategori filter
  const filtersWrapper = document.createElement('div');
  filtersWrapper.className = 'row';
  
  // Terapkan hanya satu filter kategori (kolom pertama)
  if (filters.length > 0) {
    const filter = filters[0]; // Ambil hanya filter/kolom pertama
    
    // Buat kolom untuk kategori
    const filterCol = document.createElement('div');
    filterCol.className = 'col-12 mb-3';
    
    // Container untuk kategori
    const categoryContainer = document.createElement('div');
    categoryContainer.className = 'mb-1';
    
    // Label kategori
    const categoryLabel = document.createElement('div');
    categoryLabel.className = 'mb-2 fw-bold';
    categoryLabel.textContent = `${filter.field}:`;
    categoryContainer.appendChild(categoryLabel);
    
    // Container untuk bubbles
    const bubblesContainer = document.createElement('div');
    bubblesContainer.className = 'd-flex flex-wrap gap-1';
    
    // Tambahkan bubble untuk setiap nilai
    filter.values.forEach(value => {
      if (!value) return; // Skip nilai kosong
      
      const bubble = document.createElement('span');
      bubble.className = 'filter-bubble';
      bubble.setAttribute('data-field', filter.field);
      bubble.setAttribute('data-value', value);
      bubble.textContent = value;
      
      // Warna bubble berdasarkan kategori
      let bgColor;
      if (filter.field === 'TOOCCODE' || filter.field === 'FROMOCCODE') {
        if (value === 'DME') bgColor = '#4e73df';
        else if (value === 'ARC') bgColor = '#1cc88a';
        else if (value === 'P2A') bgColor = '#f6c23e';
        else bgColor = '#36b9cc';
      } else if (filter.field === 'TRANSSTATUS') {
        if (value === 'OK') bgColor = '#1cc88a';
        else bgColor = '#e74a3b';
      } else if (filter.field === 'SCANNERUSERCODE') {
        // Warna berdasarkan user code (gunakan hash sederhana untuk warna konsisten)
        const hash = Array.from(value).reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const hue = hash % 360;
        bgColor = `hsl(${hue}, 70%, 60%)`;
      } else {
        // Warna default dengan variasi berdasarkan teks
        const hash = Array.from(value).reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const hue = hash % 360;
        bgColor = `hsl(${hue}, 70%, 65%)`;
      }
      
      bubble.style.backgroundColor = bgColor;
      
      // Atur warna text (putih untuk warna gelap, hitam untuk warna terang)
      const colorSum = hexToRgb(bgColor);
      if (colorSum && (colorSum.r + colorSum.g + colorSum.b) < 500) {
        bubble.style.color = 'white';
      } else {
        bubble.style.color = 'black';
      }
      
      // Tambahkan event listener untuk toggle filter pada DataTable langsung
      bubble.addEventListener('click', function() {
        this.classList.toggle('active');
        const isActive = this.classList.contains('active');
        
        // Update counter
        const activeFilters = document.querySelectorAll('.filter-bubble.active').length;
        const activeFilterCount = document.getElementById('active-filter-count');
        if (activeFilterCount) {
          activeFilterCount.textContent = activeFilters;
        }
        
        // Debugging: log status filter
        console.log(`Filter ${filter.field}=${value} toggled to ${isActive ? 'active' : 'inactive'}`);
        
        // Ambil semua bubble yang aktif untuk field ini
        const activeBubbles = Array.from(document.querySelectorAll(`.filter-bubble[data-field="${filter.field}"].active`))
          .map(b => b.getAttribute('data-value'));
        
        console.log(`Active filters for ${filter.field}:`, activeBubbles);
        
        // Tampilkan notifikasi kecil bahwa filter sudah diterapkan
        showFilterNotification(
          isActive ? 'ditambahkan' : 'dihapus', 
          `${formatColumnTitle(filter.field)} = ${value}`,
          isActive ? 'success' : 'warning'
        );
        
        // Terapkan filter ke DataTable secara langsung
        if (dataTable) {
          try {
            if (activeBubbles.length > 0) {
              // Cara 1: Menggunakan pencarian regex (lebih disarankan jika kolom sudah terindeks dengan nama)
              const regex = activeBubbles.map(v => `^${escapeRegExp(v)}$`).join('|');
              console.log(`Menggunakan regex filter: "${regex}" pada kolom ${filter.field}`);
              
              try {
                // Coba dengan nama kolom
                dataTable.column(filter.field + ':name').search(regex, true, false).draw();
              } catch (columnError) {
                console.warn(`Error saat mencari kolom dengan nama, coba cara lain:`, columnError);
                
                // Cara 2: Tambahkan custom filter function
                // Hapus dahulu filter yang mungkin sudah ada
                $.fn.dataTable.ext.search = $.fn.dataTable.ext.search.filter(
                  fn => fn.name !== `filterFor_${tableId}_${filter.field}`
                );
                
                // Buat filter baru berdasarkan nilai yang dipilih
                const filterFunc = function(settings, data, dataIndex, rowData) {
                  // Nama fungsi untuk identifikasi
                  filterFunc.name = `filterFor_${tableId}_${filter.field}`;
                  
                  // Skip jika bukan tabel yang tepat
                  if (settings.nTable.id !== tableId) return true;
                  
                  // Cari posisi kolom secara manual
                  if (!filterFunc.columnIndex) {
                    try {
                      // Coba dapatkan dari API
                      filterFunc.columnIndex = dataTable.column(`${filter.field}:name`).index();
                    } catch (e) {
                      console.log(`Mencari kolom ${filter.field} secara manual`);
                      
                      // Cari dalam header berdasarkan teks
                      const headers = $(settings.nTHead).find('th').map(function() {
                        return $(this).text().trim();
                      }).get();
                      
                      // Periksa nama kolom yang diformat
                      const formattedName = formatColumnTitle(filter.field);
                      filterFunc.columnIndex = headers.indexOf(formattedName);
                      
                      if (filterFunc.columnIndex === -1) {
                        console.error(`Kolom ${filter.field} tidak ditemukan dalam header:`, headers);
                        return true; // Jangan filter jika kolom tidak ditemukan
                      }
                    }
                  }
                  
                  // Periksa nilai dalam kolom
                  if (filterFunc.columnIndex >= 0) {
                    const cellValue = rowData ? 
                      (rowData[filter.field] || '').toString() : 
                      data[filterFunc.columnIndex].toString();
                    
                    // Baris dipertahankan jika nilainya cocok dengan nilai yang dipilih
                    return activeBubbles.includes(cellValue);
                  }
                  
                  return true; // Default: tampilkan baris jika kolom tidak ditemukan
                };
                
                // Tambahkan filter ke DataTables dan redraw
                $.fn.dataTable.ext.search.push(filterFunc);
                dataTable.draw();
              }
            } else {
              // Reset semua filter kustom untuk field ini
              $.fn.dataTable.ext.search = $.fn.dataTable.ext.search.filter(
                fn => !fn.name || !fn.name.includes(`filterFor_${tableId}_${filter.field}`)
              );
              
              // Reset pencarian
              try {
                dataTable.column(filter.field + ':name').search('').draw();
              } catch (error) {
                // Fallback: redraw tanpa filter
                dataTable.draw();
              }
            }
          } catch (error) {
            console.error(`Error saat menerapkan filter untuk kolom ${filter.field}:`, error);
            showFilterNotification('gagal', `Tidak dapat memfilter kolom ${formatColumnTitle(filter.field)}`, 'danger');
          }
        }
      });
      
      bubblesContainer.appendChild(bubble);
    });
    
    categoryContainer.appendChild(bubblesContainer);
    filterCol.appendChild(categoryContainer);
    filtersWrapper.appendChild(filterCol);
  }
  
  filterContainer.appendChild(filtersWrapper);
  
  // Tambahkan status filter aktif dan tombol reset
  const filterFooter = document.createElement('div');
  filterFooter.className = 'd-flex justify-content-between align-items-center mt-2';
  filterFooter.innerHTML = `
    <div>
      <span class="badge bg-primary me-2"><span id="active-filter-count">0</span> filter aktif</span>
    </div>
    <button id="reset-all-filters" class="btn btn-sm btn-outline-secondary">
      <i class="fas fa-times me-1"></i>Reset Filter
    </button>
  `;
  filterContainer.appendChild(filterFooter);
  
  // Event listener untuk reset semua filter
  setTimeout(() => {
    const resetButton = document.getElementById('reset-all-filters');
    if (resetButton) {
      resetButton.addEventListener('click', function() {
        // Reset semua bubble aktif
        const activeFilters = document.querySelectorAll('.filter-bubble.active');
        console.log(`Resetting ${activeFilters.length} active filters`);
        
        activeFilters.forEach(bubble => {
          bubble.classList.remove('active');
        });
        
        // Reset counter
        const activeFilterCount = document.getElementById('active-filter-count');
        if (activeFilterCount) {
          activeFilterCount.textContent = '0';
        }
        
        // Reset DataTable filter langsung
        if (dataTable) {
          try {
            console.log(`Clearing all filters and resetting search for table`);
            dataTable.search('').columns().search('').draw();
            
            // Tampilkan notifikasi kecil bahwa filter sudah direset
            const notification = document.createElement('div');
            notification.className = 'alert alert-success filter-reset-notification';
            notification.innerHTML = '<i class="fas fa-check-circle me-2"></i>Filter berhasil direset';
            notification.style.cssText = `
              position: fixed;
              bottom: 20px;
              right: 20px;
              z-index: 1050;
              padding: 10px 15px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.2);
              animation: fadeInOut 3s forwards;
            `;
            
            // Tambahkan CSS untuk animasi jika belum ada
            if (!document.getElementById('filter-notification-style')) {
              const style = document.createElement('style');
              style.id = 'filter-notification-style';
              style.textContent = `
                @keyframes fadeInOut {
                  0% { opacity: 0; transform: translateY(20px); }
                  10% { opacity: 1; transform: translateY(0); }
                  90% { opacity: 1; transform: translateY(0); }
                  100% { opacity: 0; transform: translateY(-20px); }
                }
                .filter-reset-notification {
                  animation: fadeInOut 3s forwards;
                }
              `;
              document.head.appendChild(style);
            }
            
            document.body.appendChild(notification);
            
            // Hapus notifikasi setelah animasi selesai
            setTimeout(() => {
              notification.remove();
            }, 3000);
          } catch (error) {
            console.error('Error saat mereset filter:', error);
          }
        }
      });
    }
  }, 100);
  
  // Tambahkan container filter ke container utama
  container.prepend(filterContainer);
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
        // Cari filename dari mapping
        const filename = Object.entries(dataMapping).find(([_, m]) => m.tableId === mapping.tableId)?.[0];
        if (filename) {
          // Hapus data dari cache agar dimuat ulang
          delete loadedData[filename];
          showInfoToast(`Memuat ulang data ${mapping.title}...`);
          
          // Muat ulang data
          loadDataFromTemp(filename)
            .then(freshData => {
              // Update tampilan
              displayDataInTable(freshData, mapping, document.querySelector(mapping.tabSelector.split(', ')[0]));
            })
            .catch(error => {
              showErrorToast(`Error saat refresh data: ${error.message}`);
            });
        }
      });
    }
  }, 100);
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
          <button class="btn btn-sm btn-danger refresh-error-btn" data-filename="${filename}">
            <i class="fas fa-sync-alt me-1"></i> Coba Lagi
          </button>
        </div>
      </div>
    `;
    
    // Add event listener to the refresh button
    const refreshBtn = container.querySelector('.refresh-error-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function() {
        // Get the filename from the button's data attribute
        const filename = this.getAttribute('data-filename');
        
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
            const tabId = getTabIdForFilename(filename);
            const tabElement = document.getElementById(tabId);
            
            if (tabElement && window.dataMapping) {
              const mapping = window.dataMapping[filename];
              if (mapping) {
                displayDataInTable(data, mapping, tabElement);
              }
            }
          })
          .catch(err => {
            console.error("Error reloading data:", err);
          });
      });
    }
  } catch (e) {
    console.error("Error updating container with error message:", e);
  }
}

// Fungsi untuk membuat filter nilai kolom (dipindah ke global scope)
window.createValueFilters = function(data, mapping, containerId) {
  console.log(`Creating value filters for container: ${containerId}, table: ${mapping.tableId}`);
  
  const filterContainer = document.getElementById(`value-filter-${containerId}`);
  if (!filterContainer) {
    console.error(`Filter container not found: #value-filter-${containerId}`);
    return;
  }
  
  // Tentukan kolom-kolom yang ingin difilter (dapat dikonfigurasi)
  const columnsToFilter = mapping.valueFilters || ['FROMOCCODE', 'TOOCCODE', 'JOBCODE', 'SCANNERUSERCODE'];
  console.log(`Columns to filter for ${mapping.tableId}:`, columnsToFilter);
  
  // Tampilkan filter sebagai dropdown
  const filterHTML = `
    <div class="dropdown d-inline-block">
      <button class="btn btn-outline-primary dropdown-toggle" type="button" id="dropdownValueFilter-${containerId}" 
              data-bs-toggle="dropdown" aria-expanded="false">
        <i class="fas fa-filter me-1"></i>Filter Nilai
        <span class="badge bg-primary ms-1" id="active-filter-count-${containerId}">0</span>
      </button>
      <div class="dropdown-menu filter-dropdown-menu p-3" aria-labelledby="dropdownValueFilter-${containerId}" style="width: 600px;">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h6 class="mb-0">Filter berdasarkan nilai kolom</h6>
          <button class="btn btn-sm btn-outline-secondary" id="reset-value-filters-${containerId}">
            <i class="fas fa-sync-alt me-1"></i>Reset
          </button>
        </div>
        <div class="row filter-sections g-3"></div>
      </div>
    </div>
  `;
  
  filterContainer.innerHTML = filterHTML;
  console.log(`Filter dropdown added to container #value-filter-${containerId}`);
  
  // Ambil container untuk section filter
  const filterSections = filterContainer.querySelector('.filter-sections');
  if (!filterSections) {
    console.error(`Filter sections container not found in #value-filter-${containerId}`);
    return;
  }
  
  // Counter untuk filter dinonaktifkan
  let disabledCount = 0;
  
  // Cek struktur data
  if (data.length > 0) {
    console.log(`Sample data object keys for ${mapping.tableId}:`, Object.keys(data[0]));
  }
  
  // Loop melalui setiap kolom yang akan difilter
  columnsToFilter.forEach(column => {
    // Skip jika kolom tidak ada dalam data
    if (data.length > 0 && !data[0].hasOwnProperty(column)) {
      console.log(`Column ${column} not found in data, skipping`);
      return;
    }
    
    // Dapatkan nilai unik untuk kolom ini
    let uniqueValues = getUniqueValues(data, column);
    console.log(`Column ${column} has ${uniqueValues.length} unique values`);
    if (uniqueValues.length === 0) return;
    
    // Sortir nilai-nilai untuk tampilan yang lebih teratur
    uniqueValues.sort((a, b) => {
      // Konversi ke string untuk perbandingan
      const strA = String(a || '');
      const strB = String(b || '');
      return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
    });
    
    // Buat section filter untuk kolom ini
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'col-md-3 mb-2';
    filterSections.appendChild(sectionDiv);
    
    // Container untuk kategori filter
    const categoryContainer = document.createElement('div');
    categoryContainer.className = 'filter-column card h-100';
    sectionDiv.appendChild(categoryContainer);
    
    // Header untuk kategori
    const categoryHeader = document.createElement('div');
    categoryHeader.className = 'card-header filter-column-title py-2';
    categoryHeader.textContent = formatColumnTitle(column);
    categoryContainer.appendChild(categoryHeader);
    
    // Card body untuk nilai
    const cardBody = document.createElement('div');
    cardBody.className = 'card-body p-2';
    categoryContainer.appendChild(cardBody);
    
    // Container untuk nilai-nilai filter
    const valueListContainer = document.createElement('div');
    valueListContainer.className = 'filter-value-list';
    valueListContainer.id = `filter-${containerId}-${column}`;
    cardBody.appendChild(valueListContainer);
    
    // Load saved filter state from localStorage
    const savedFilters = localStorage.getItem(`valueFilters-${containerId}-${column}`);
    const disabledValues = savedFilters ? JSON.parse(savedFilters) : [];
    
    // Tambahkan filter toggle untuk setiap nilai unik
    uniqueValues.forEach(value => {
      if (value === null || value === undefined) return; // Skip nilai kosong
      
      // Format nilai untuk display
      const displayValue = String(value).trim();
      if (displayValue === '') return; // Skip nilai kosong setelah trim
      
      const isDisabled = disabledValues.includes(value);
      if (isDisabled) disabledCount++;
      
      // Buat ID unik untuk elemen
      const safeValue = String(value).replace(/[^a-zA-Z0-9]/g, '_');
      const valueId = `filter-${containerId}-${column}-${safeValue}`;
      
      // Container untuk item filter
      const valueItemDiv = document.createElement('div');
      valueItemDiv.className = 'form-check form-switch mb-1';
      valueListContainer.appendChild(valueItemDiv);
      
      // Input toggle
      const toggleInput = document.createElement('input');
      toggleInput.className = 'form-check-input value-filter-toggle';
      toggleInput.type = 'checkbox';
      toggleInput.id = valueId;
      toggleInput.checked = !isDisabled;
      toggleInput.setAttribute('data-column', column);
      toggleInput.setAttribute('data-value', value);
      toggleInput.setAttribute('data-table', mapping.tableId);
      valueItemDiv.appendChild(toggleInput);
      
      // Label untuk toggle
      const toggleLabel = document.createElement('label');
      toggleLabel.className = 'form-check-label small';
      toggleLabel.htmlFor = valueId;
      
      // Truncate label jika terlalu panjang
      const MAX_LABEL_LENGTH = 20;
      toggleLabel.title = displayValue; // Tooltip dengan nilai lengkap
      toggleLabel.textContent = displayValue.length > MAX_LABEL_LENGTH 
        ? displayValue.substring(0, MAX_LABEL_LENGTH) + '...' 
        : displayValue;
      
      valueItemDiv.appendChild(toggleLabel);
      
      // Tambahkan event listener untuk toggle
      toggleInput.addEventListener('change', function() {
        const isChecked = this.checked;
        console.log(`Toggle changed for ${column}=${value}: ${isChecked ? 'enabled' : 'disabled'}`);
        
        // Update counter
        if (isChecked) {
          disabledCount--;
        } else {
          disabledCount++;
        }
        document.getElementById(`active-filter-count-${containerId}`).textContent = disabledCount;
        
        // Ubah warna badge jika ada filter aktif
        const badge = document.getElementById(`active-filter-count-${containerId}`);
        if (disabledCount > 0) {
          badge.classList.remove('bg-primary');
          badge.classList.add('bg-danger');
        } else {
          badge.classList.remove('bg-danger');
          badge.classList.add('bg-primary');
        }
        
        // Update filter di DataTable
        applyValueFilters(mapping.tableId, containerId);
        
        // Simpan state filter ke localStorage
        saveFilterState(containerId, column);
      });
    });
  });
  
  // Tambahkan event listener untuk prevent dropdown dari closing saat klik di dalamnya
  const dropdownMenu = filterContainer.querySelector('.dropdown-menu');
  if (dropdownMenu) {
    dropdownMenu.addEventListener('click', function(e) {
      e.stopPropagation();
    });
  }
  
  // Update counter awal
  const countBadge = document.getElementById(`active-filter-count-${containerId}`);
  if (countBadge) {
    countBadge.textContent = disabledCount;
    
    // Ubah warna badge jika ada filter aktif
    if (disabledCount > 0) {
      countBadge.classList.remove('bg-primary');
      countBadge.classList.add('bg-danger');
    }
  }
  
  console.log(`Filter created with ${disabledCount} initially disabled values`);
  
  // Tambahkan event listener untuk tombol reset
  const resetButton = document.getElementById(`reset-value-filters-${containerId}`);
  if (resetButton) {
    resetButton.addEventListener('click', function(e) {
      e.stopPropagation(); // Jangan tutup dropdown
      
      console.log(`Reset filters for ${containerId}`);
      // Reset semua toggle ke checked
      const toggles = filterContainer.querySelectorAll('.value-filter-toggle');
      toggles.forEach(toggle => {
        toggle.checked = true;
      });
      
      // Reset counter
      disabledCount = 0;
      const countBadge = document.getElementById(`active-filter-count-${containerId}`);
      if (countBadge) {
        countBadge.textContent = disabledCount;
        countBadge.classList.remove('bg-danger');
        countBadge.classList.add('bg-primary');
      }
      
      // Clear localStorage untuk filter ini
      columnsToFilter.forEach(column => {
        localStorage.removeItem(`valueFilters-${containerId}-${column}`);
      });
      
      // Reset filter di DataTable
      const tableId = mapping.tableId;
      const dataTable = $(`#${tableId}`).DataTable();
      if (dataTable) {
        // Remove existing search filters
        dataTable.search('').columns().search('').draw();
      }
    });
  }
  
  // Apply filters on initial load
  applyValueFilters(mapping.tableId, containerId);
};

// Fungsi untuk menerapkan filter nilai (dipindah ke global scope)
window.applyValueFilters = function(tableId, containerId) {
  const dataTable = $(`#${tableId}`).DataTable();
  if (!dataTable) {
    console.error(`DataTable ${tableId} not found`);
    return;
  }
  
  console.log(`Applying value filters for table ${tableId}`);
  
  // Reset search terlebih dahulu
  dataTable.search('').columns().search('').draw();
  
  // Ambil semua filter yang dinonaktifkan (unchecked)
  const disabledFilters = {};
  
  document.querySelectorAll(`#value-filter-${containerId} .value-filter-toggle:not(:checked)`).forEach(toggle => {
    const column = toggle.getAttribute('data-column');
    const value = toggle.getAttribute('data-value');
    
    if (!disabledFilters[column]) {
      disabledFilters[column] = [];
    }
    
    disabledFilters[column].push(value);
  });
  
  // Log untuk debugging
  console.log('Disabled filters:', disabledFilters);
  
  // Jika tidak ada filter yang dinonaktifkan, reset filter dan return
  if (Object.keys(disabledFilters).length === 0) {
    console.log('No disabled filters, clearing all filters');
    dataTable.search('').columns().search('').draw();
    return;
  }
  
  // Hapus filter sebelumnya (jika ada)
  const existingFilterIndex = $.fn.dataTable.ext.search.findIndex(
    fn => fn.name === `valueFilter_${tableId}`
  );
  
  if (existingFilterIndex !== -1) {
    $.fn.dataTable.ext.search.splice(existingFilterIndex, 1);
  }
  
  // Buat fungsi filter baru dengan nama yang konsisten
  const filterFunction = function(settings, data, dataIndex, rowData) {
    // Nama fungsi untuk tracking
    filterFunction.name = `valueFilter_${tableId}`;
    
    // Skip jika bukan tabel yang sama
    if (settings.nTable.id !== tableId) return true;
    
    // Cek setiap kolom yang memiliki filter yang dinonaktifkan
    for (const column in disabledFilters) {
      // Pertama, coba dapatkan data dari rowData (data API)
      if (rowData && typeof rowData === 'object' && rowData[column] !== undefined) {
        const cellValue = String(rowData[column] || '');
        // Jika nilai ada dalam daftar yang dinonaktifkan, sembunyikan baris
        if (disabledFilters[column].includes(cellValue)) {
          return false;
        }
        // Lanjutkan ke kolom berikutnya jika sudah ketemu
        continue;
      }
      
      // Kedua, cari kolom berdasarkan nama jika tidak bisa pakai rowData
      let columnIndex = -1;
      
      try {
        // Coba dapatkan index kolom dari DataTables API
        columnIndex = dataTable.column(`${column}:name`).index();
      } catch (e) {
        console.log(`Column ${column} not found via API, searching manually...`);
        
        // Fallback: cari kolom berdasarkan nama/header secara manual
        const headers = $(`#${tableId} thead th`).map(function() {
          return $(this).text().trim();
        }).get();
        
        // Coba cari yang exact match dulu
        columnIndex = headers.findIndex(header => header === column);
        
        // Jika tidak ketemu, coba match dengan nama kolom yang diformat
        if (columnIndex === -1) {
          const formattedColumnName = formatColumnTitle(column);
          columnIndex = headers.findIndex(header => header === formattedColumnName);
        }
        
        // Jika masih belum ketemu, coba match dengan nama kolom dalam format berbeda
        if (columnIndex === -1) {
          columnIndex = headers.findIndex(header => 
            header.replace(/\s+/g, '_').toUpperCase() === column.toUpperCase()
          );
        }
      }
      
      // Jika kolom ditemukan, cek nilai
      if (columnIndex >= 0 && columnIndex < data.length) {
        const cellValue = String(data[columnIndex] || '');
        // Jika nilai ada dalam daftar yang dinonaktifkan, sembunyikan baris
        if (disabledFilters[column].includes(cellValue)) {
          return false;
        }
      } else {
        console.log(`Column ${column} (index ${columnIndex}) not found or invalid`);
      }
    }
    
    // Tampilkan baris jika lolos semua filter
    return true;
  };
  
  // Tambahkan fungsi filter ke DataTables
  $.fn.dataTable.ext.search.push(filterFunction);
  
  // Redraw table untuk menerapkan filter
  dataTable.draw();
  
  console.log(`Filters applied to table ${tableId}`);
};

// Fungsi untuk menyimpan state filter ke localStorage (dipindah ke global scope)
window.saveFilterState = function(containerId, column) {
  const disabledValues = [];
  
  document.querySelectorAll(`#value-filter-${containerId} .value-filter-toggle[data-column="${column}"]:not(:checked)`).forEach(toggle => {
    disabledValues.push(toggle.getAttribute('data-value'));
  });
  
  localStorage.setItem(`valueFilters-${containerId}-${column}`, JSON.stringify(disabledValues));
};

// Expose fungsi ke global scope
window.addFilterBubbles = addFilterBubbles;

// Helper function untuk menampilkan notifikasi
function showFilterNotification(action, message, type = 'success') {
  // Tambahkan CSS untuk animasi jika belum ada
  if (!document.getElementById('filter-notification-style')) {
    const style = document.createElement('style');
    style.id = 'filter-notification-style';
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translateY(20px); }
        10% { opacity: 1; transform: translateY(0); }
        90% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-20px); }
      }
      .filter-notification {
        animation: fadeInOut 3s forwards;
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 1050;
        padding: 10px 15px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      }
    `;
    document.head.appendChild(style);
  }
  
  // Hapus notifikasi sebelumnya
  const oldNotification = document.querySelector('.filter-notification');
  if (oldNotification) {
    oldNotification.remove();
  }
  
  // Buat notifikasi baru
  const notification = document.createElement('div');
  notification.className = `alert alert-${type} filter-notification`;
  
  let icon = 'check-circle';
  if (type === 'warning') icon = 'exclamation-circle';
  if (type === 'danger') icon = 'exclamation-triangle';
  
  notification.innerHTML = `<i class="fas fa-${icon} me-2"></i>Filter ${action}: ${message}`;
  document.body.appendChild(notification);
  
  // Hapus notifikasi setelah animasi selesai
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Helper function untuk escape karakter regex
function escapeRegExp(string) {
  if (!string) return '';
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
