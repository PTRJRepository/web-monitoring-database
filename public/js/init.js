/**
 * init.js
 * File inisialisasi aplikasi Monitoring Database
 */

// Data cache settings
window.dataCache = {
  timestamp: Date.now(),
  expiresIn: 10 * 60 * 1000, // 10 menit
  loadedTables: {}
};

// Variabel untuk menyimpan data
window.loadedData = window.loadedData || {};

// Tracking untuk mencegah multiple request bersamaan
window.loadingSummaryInProgress = window.loadingSummaryInProgress || false;
window.lastSummaryLoadTime = window.lastSummaryLoadTime || 0;
window.DEBOUNCE_INTERVAL = window.DEBOUNCE_INTERVAL || 5000; // 5 detik minimum antara request

// Fungsi untuk memuat data summary
window.loadDataSummaryOnly = function() {
  console.log("Memuat ringkasan data...");
  
  // Cek jika sudah ada request yang sedang berjalan
  if (window.loadingSummaryInProgress) {
    console.log("Ada request loadDataSummaryOnly yang sedang berjalan, request diabaikan");
    return Promise.reject(new Error("Request already in progress"));
  }
  
  // Cek debounce interval
  const now = Date.now();
  if (now - window.lastSummaryLoadTime < window.DEBOUNCE_INTERVAL) {
    console.log(`Request load summary terlalu cepat, minimal interval: ${window.DEBOUNCE_INTERVAL}ms. Menggunakan cache.`);
    if (window.dataSummaryLoaded) {
      return Promise.resolve(window.loadedData);
    }
    return Promise.reject(new Error("Request too frequent"));
  }
  
  // Periksa apakah data cache masih valid
  if (window.dataSummaryLoaded && 
      window.dataCache.timestamp && 
      (now - window.dataCache.timestamp) < window.dataCache.expiresIn) {
    
    console.log("Data cache masih valid, menggunakan data dari cache");
    return Promise.resolve(window.loadedData);
  }
  
  // Set flag sedang loading
  window.loadingSummaryInProgress = true;
  window.lastSummaryLoadTime = now;
  
  const files = [
    'tunjangan_beras_temp.json',
    'bpjs_temp.json',
    'gwscanner_temp.json',
    'ffbworker_temp.json',
    'gwscanner_overtime_not_sync_temp.json'
  ];
  
  return Promise.allSettled(files.map(file => {
    console.log(`Memuat summary data untuk file: ${file}`);
    return fetch(`/temp/${file}`, {
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
      } else if (!Array.isArray(data)) {
        data = [];
      }
      
      // Simpan data ke cache
      window.loadedData[file] = data;
      return { file, count: data.length };
    });
  }))
  .then((results) => {
    console.log("Ringkasan data selesai dimuat");
    
    // Reset loading flag
    window.loadingSummaryInProgress = false;
    
    // Set status dan timestamp
    window.dataSummaryLoaded = true;
    window.dataCache.timestamp = Date.now();
    
    // Log success/failure for each file
    results.forEach(result => {
      if (result.status === 'fulfilled') {
        console.log(`  - ${result.value.file}: ${result.value.count} records`);
      } else {
        console.error(`  - ${result.reason}`);
      }
    });
    
    // Trigger event
    document.dispatchEvent(new CustomEvent('dataSummaryLoaded', { 
      detail: { loadedData: window.loadedData } 
    }));
    
    return window.loadedData;
  })
  .catch(error => {
    console.error("Error loading summary data:", error);
    
    // Reset loading flag
    window.loadingSummaryInProgress = false;
    
    throw error;
  });
};

// Fungsi untuk memuat semua data
window.loadAndDisplayAllTempData = function() {
  if (window.dataPreloaded && 
      window.dataCache.timestamp && 
      (Date.now() - window.dataCache.timestamp) < window.dataCache.expiresIn) {
    console.log('Semua data sudah dimuat sebelumnya dan masih valid');
    return Promise.resolve(window.loadedData);
  }
  
  return window.loadDataSummaryOnly().then(() => {
    console.log("Summary data loaded");
    window.dataPreloaded = true;
    return window.loadedData;
  });
};

// Fungsi untuk memuat data tab yang aktif
window.loadAndDisplayActiveTabData = function(tabId) {
  console.log(`loadAndDisplayActiveTabData: Memuat data untuk tab ${tabId}`);
  const filename = getFilenameFromTabId(tabId);
  
  // Tab monitoring hanya memerlukan data summary, tidak perlu load spesifik
  if (tabId === 'monitoring-tab') {
    console.log('Tab monitoring tidak memerlukan loading data khusus');
    return Promise.resolve([]);
  }
  
  if (!filename) {
    console.warn(`Filename tidak ditemukan untuk tab ${tabId}, loading dibatalkan`);
    return Promise.reject(new Error('Filename tidak ditemukan untuk tab ini'));
  }
  
  // Jika data sudah dimuat, gunakan cache
  if (window.dataCache.loadedTables[tabId] && 
      window.loadedData[filename] && 
      (Date.now() - window.dataCache.timestamp) < window.dataCache.expiresIn) {
    
    console.log(`Tabel ${tabId} sudah dimuat sebelumnya dan masih valid, menggunakan cache`);
    return Promise.resolve(window.loadedData[filename]);
  }
  
  // Tampilkan loading di container tab
  const containerId = tabId.replace('-tab', '-data');
  const container = document.getElementById(containerId);
  if (container) {
    console.log(`Menampilkan loading indicator di container ${containerId}`);
    container.innerHTML = '<div class="text-center p-5"><div class="spinner-border" role="status"></div><p class="mt-2">Memuat data...</p></div>';
  } else {
    console.warn(`Container ${containerId} tidak ditemukan`);
  }
  
  console.log(`Memulai fetch data dari ${filename}`);
  return fetch(`/temp/${filename}`, {
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
      console.log(`Data ${filename} dalam format { timestamp, data }, menggunakan jsonData.data`);
      data = jsonData.data;
    } else if (!Array.isArray(data)) {
      console.error(`Format data tidak sesuai: ${filename}`);
      data = [];
    }
    
    // Simpan data ke cache
    console.log(`Menyimpan data ${filename} ke cache: ${data.length} records`);
    window.loadedData[filename] = data;
    window.dataCache.loadedTables[tabId] = true;
    window.dataCache.timestamp = Date.now(); // Refresh timestamp
    
    console.log(`Data untuk tab ${tabId} berhasil dimuat: ${data.length} records`);
    
    // Tampilkan data di tabel
    displayDataInTable(data, tabId);
    
    return data;
  })
  .catch(error => {
    console.error(`Error memuat data untuk tab ${tabId}:`, error);
    const containerId = tabId.replace('-tab', '-data');
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = `
        <div class="alert alert-danger">
          <i class="fas fa-exclamation-triangle me-2"></i>
          <strong>Error:</strong> ${error.message}
          <div class="mt-2">
            <button class="btn btn-sm btn-outline-danger" onclick="window.loadAndDisplayActiveTabData('${tabId}')">
              <i class="fas fa-sync-alt me-1"></i> Coba Lagi
            </button>
          </div>
        </div>
      `;
    }
    throw error;
  });
};

// Helper function untuk mendapatkan filename dari tabId
function getFilenameFromTabId(tabId) {
  console.log(`getFilenameFromTabId: Mencari filename untuk tab ${tabId}`);
  
  switch (tabId) {
    case 'tunjangan-tab': return 'tunjangan_beras_temp.json';
    case 'bpjs-tab': return 'bpjs_temp.json';
    case 'gwscanner-tab': return 'gwscanner_temp.json';
    case 'ffbworker-tab': return 'ffbworker_temp.json';
    case 'gwscanner-overtime-tab': return 'gwscanner_overtime_not_sync_temp.json';
    case 'monitoring-tab': 
      // Tab monitoring mungkin tidak perlu file data khusus, gunakan file default
      console.log('Tab monitoring terdeteksi, menggunakan summary data');
      return null;
    default: 
      console.warn(`Tab tidak dikenali: ${tabId}`);
      return null;
  }
}

// Fungsi untuk menampilkan data dalam tabel
function displayDataInTable(data, tabId) {
  const containerId = tabId.replace('-tab', '-data');
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
  const tableId = tabId.replace('-tab', '-table');
  
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
    // Inisialisasi DataTable dengan opsi yang diperbaiki
    dataTable = $('#' + tableId).DataTable({
      data: data,
      columns: columns,
      processing: true,
      deferRender: true,
      scroller: true,
      scrollY: '50vh',
      paging: true,
      pageLength: 25,
      // Penting: Aktifkan pencarian per kolom
      columnDefs: [
        {
          targets: '_all',
          searchable: true
        }
      ],
      // Tambahkan order default (yang dapat diubah pengguna)
      order: [[0, 'asc']],
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
      },
      // Tambahkan initComplete untuk memastikan kolom diindeks dengan benar
      initComplete: function() {
        // Debug: cek apakah kolom telah diindeks dengan benar
        console.log('DataTable initialized with columns:', columns.map(c => c.name));
        
        // Verifikasi bahwa semua kolom dapat difilter
        const api = this.api();
        columns.forEach((col, index) => {
          if (col.name) {
            try {
              const colIndex = api.column(col.name + ':name').index();
              console.log(`Column ${col.name} is indexed at position ${colIndex}`);
            } catch (err) {
              console.warn(`Column ${col.name} is not properly indexed:`, err);
            }
          }
        });
      }
    });
    
    console.log(`DataTable untuk ${tableId} berhasil diinisialisasi`);
    
    // Tambahkan filter bubbles di atas tabel
    const filterContainer = document.createElement('div');
    filterContainer.className = 'filter-container mb-3';
    container.insertBefore(filterContainer, container.firstChild);
    
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
        
        // Tambahkan fungsi addFilterBubbles dari load-temp-data.js jika tersedia
        if (typeof window.addFilterBubbles === 'function') {
          window.addFilterBubbles(filterContainer, data, filters, dataTable);
        } else {
          // Implementasi sederhana jika fungsi asli tidak tersedia
          const bubbleContainer = document.createElement('div');
          bubbleContainer.className = 'filter-bubbles p-2 bg-light border rounded mb-3';
          bubbleContainer.innerHTML = `<h6 class="mb-2">Filter ${formatColumnTitle(filterField)}:</h6><div class="d-flex flex-wrap gap-1" id="bubbles-${tableId}"></div>`;
          filterContainer.appendChild(bubbleContainer);
          
          const bubblesWrapper = document.getElementById(`bubbles-${tableId}`);
          uniqueValues.forEach(value => {
            if (!value) return;
            const bubble = document.createElement('span');
            bubble.className = 'badge rounded-pill bg-primary me-1 mb-1 filter-pill';
            bubble.style.cursor = 'pointer';
            bubble.textContent = value;
            bubble.setAttribute('data-value', value);
            bubble.setAttribute('data-field', filterField);
            
            bubble.addEventListener('click', function() {
              this.classList.toggle('active');
              
              // Handle filter logic
              const activeBubbles = Array.from(bubblesWrapper.querySelectorAll('.filter-pill.active'))
                .map(b => b.getAttribute('data-value'));
              
              if (activeBubbles.length > 0) {
                const regex = activeBubbles.map(v => `^${v}$`).join('|');
                dataTable.column(filterField + ':name').search(regex, true, false).draw();
              } else {
                dataTable.column(filterField + ':name').search('').draw();
              }
            });
            
            bubblesWrapper.appendChild(bubble);
          });
          
          // Tambahkan reset button
          const resetBtn = document.createElement('button');
          resetBtn.className = 'btn btn-sm btn-outline-secondary ms-2';
          resetBtn.innerHTML = '<i class="fas fa-times me-1"></i>Reset';
          resetBtn.addEventListener('click', function() {
            bubblesWrapper.querySelectorAll('.filter-pill.active').forEach(pill => {
              pill.classList.remove('active');
            });
            dataTable.search('').columns().search('').draw();
          });
          bubbleContainer.appendChild(resetBtn);
        }
      }
    }
  } catch (error) {
    console.error(`Error saat inisialisasi DataTable:`, error);
    container.innerHTML = '<div class="alert alert-danger"><i class="fas fa-exclamation-triangle me-2"></i><strong>Error:</strong> ' + error.message + '</div>';
  }
}

// Format judul kolom
function formatColumnTitle(key) {
  return key
    .replace(/([A-Z])/g, ' $1') // Insert space before capital letters
    .replace(/_/g, ' ') // Replace underscores with spaces
    .replace(/^./, str => str.toUpperCase()); // Capitalize first letter
}

// Inisialisasi aplikasi dengan lazy loading
document.addEventListener('DOMContentLoaded', function() {
  console.log("init.js: DOM Content Loaded, initializing lazy loading...");
  
  // Hide loading overlay jika ada
  hideLoadingOverlayIfNeeded();
  
  // Muat data summary untuk chart hanya sekali
  let summaryInitialized = false;
  setTimeout(function() {
    // Cek apakah data sudah dimuat oleh proses lain
    if (window.dataSummaryLoaded || summaryInitialized) {
      console.log("Summary data sudah dimuat oleh proses lain, tidak perlu memuat ulang");
      hideLoadingOverlayIfNeeded();
      return;
    }
    
    // Tandai sebagai diinisialisasi
    summaryInitialized = true;
    
    window.loadDataSummaryOnly()
      .then(function() {
        console.log("Summary data loaded successfully");
        hideLoadingOverlayIfNeeded();
      })
      .catch(function(error) {
        // Ignore expected errors
        if (error.message === "Request already in progress" || 
            error.message === "Request too frequent") {
          console.log("Debounced summary data request:", error.message);
        } else {
          console.error("Error loading summary data:", error);
        }
        
        // Attempt to hide loading for better UX
        setTimeout(hideLoadingOverlayIfNeeded, 2000);
      });
  }, 500);
  
  // Setup event listeners untuk tab clicks
  const tabLinks = document.querySelectorAll('.nav-link[id$="-tab"]');
  tabLinks.forEach(function(tab) {
    tab.addEventListener('click', function() {
      const tabId = this.id;
      console.log('Tab clicked:', tabId);
      
      // Muat data hanya untuk tab yang aktif
      window.loadAndDisplayActiveTabData(tabId)
        .then(function() {
          // Hide loading indicator after data is loaded
          hideLoadingOverlayIfNeeded();
        })
        .catch(function(error) {
          console.error('Error loading data for tab:', error);
          
          // Still try to hide loading overlay
          setTimeout(hideLoadingOverlayIfNeeded, 2000);
        });
    });
  });
  
  // Check active tab
  const activeTab = document.querySelector('.nav-link.active[id$="-tab"]');
  if (activeTab) {
    console.log('Active tab found:', activeTab.id);
    
    // Delay untuk menghindari konflik dengan preload
    setTimeout(function() {
      window.loadAndDisplayActiveTabData(activeTab.id)
        .then(function() {
          // Hide loading indicator after data is loaded
          hideLoadingOverlayIfNeeded();
        })
        .catch(function(error) {
          console.error('Error loading data for active tab:', error);
          
          // Still try to hide loading overlay
          setTimeout(hideLoadingOverlayIfNeeded, 2000);
        });
    }, 1000);
  }
});

// Helper untuk menyembunyikan overlay loading
function hideLoadingOverlayIfNeeded() {
  // Check if dataSummaryLoaded is true
  if (window.dataSummaryLoaded) {
    console.log("Data summary loaded, hiding loading overlay");
    
    // Update status
    updateDbConnectionStatus();
    
    // Try to use the function from index.ejs if available
    if (typeof hideLoadingOverlay === 'function') {
      hideLoadingOverlay();
    } else {
      // Fallback implementation
      const loadingOverlay = document.getElementById('loadingOverlay');
      if (loadingOverlay) {
        loadingOverlay.style.opacity = '0';
        setTimeout(() => {
          loadingOverlay.style.display = 'none';
          loadingOverlay.style.opacity = '1';
        }, 500);
      }
    }
  }
}

// Helper untuk update status koneksi DB
function updateDbConnectionStatus() {
  // Try to use the function from index.ejs if available
  if (typeof updateDbStatusIndicator === 'function') {
    // Check cache age
    if (window.dataCache && window.dataCache.timestamp) {
      const cacheAge = Date.now() - window.dataCache.timestamp;
      console.log(`Cache age when updating DB status: ${Math.round(cacheAge/1000)} detik`);
      
      if (cacheAge < 10000) { // Kurang dari 10 detik = baru terhubung
        updateDbStatusIndicator('connected');
      } else {
        updateDbStatusIndicator('cached');
      }
    } else {
      updateDbStatusIndicator('connected');
    }
  }
}

// Expose fungsi getFilenameFromTabId ke global scope
window.getFilenameFromTabId = getFilenameFromTabId; 