/**
 * DEPRECATED: File ini tidak digunakan lagi. 
 * Filter bubble sudah digantikan dengan implementasi filter dinamis di load-temp-data.js
 * yang lebih fleksibel dan otomatis menyesuaikan dengan data yang ada.
 */
 
// Filter Bubble Hard-Coded - Independent Script - DEPRECATED
/*
// Semua kode asli di-comment out
(function() {
  // Kode asli telah di-comment out untuk mencegah konflik dengan implementasi baru
});
*/

// Filter Bubble Hard-Coded - Independent Script

// Variabel untuk mengontrol GWScanner duplicate
window.enableGWScannerDuplicate = false; // Set ke false untuk mematikan fitur yang error

// Jalankan setelah DOMContentLoaded
(function() {
  // Definisikan bahasa Indonesia secara lokal untuk mengatasi masalah CORS
  if (typeof $ !== 'undefined' && typeof $.fn.dataTable !== 'undefined') {
    $.extend($.fn.dataTable.defaults, {
      language: {
        "emptyTable": "Tidak ada data yang tersedia",
        "info": "Menampilkan _START_ sampai _END_ dari _TOTAL_ entri",
        "infoEmpty": "Menampilkan 0 sampai 0 dari 0 entri",
        "infoFiltered": "(disaring dari _MAX_ entri keseluruhan)",
        "lengthMenu": "Tampilkan _MENU_ entri",
        "loadingRecords": "Memuat...",
        "processing": "Memproses...",
        "search": "Cari:",
        "zeroRecords": "Tidak ditemukan data yang sesuai",
        "paginate": {
          "first": "Pertama",
          "last": "Terakhir",
          "next": "Selanjutnya",
          "previous": "Sebelumnya"
        }
      }
    });
    console.log("DataTables bahasa Indonesia diinisialisasi secara lokal dari filter-bubbles.js");
  }

  // Nilai hard-coded untuk filter
  const tooccodeValues = ['P2A', 'ARC', 'DME'];
  const scannerValues = ['C0485', 'J0474', 'J0180'];

  // Fungsi untuk menambahkan filter bubble
  /* DISABLED: Removing the top filter bubbles as requested
  function addFilterBubbles() {
    console.log("Menambahkan filter bubble dari filter-bubbles.js");

    // Hapus filter yang sudah ada untuk menghindari duplikasi
    const existingFilters = document.querySelectorAll('.standalone-filter-bar');
    existingFilters.forEach(filter => filter.remove());

    // Buat container filter
    const filterBar = document.createElement('div');
    filterBar.className = 'standalone-filter-bar';
    filterBar.style.cssText = 'display: flex; flex-wrap: wrap; gap: 10px; margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 5px; border: 1px solid #dee2e6; align-items: center; z-index: 1000;';

    // Tambahkan label
    const filterLabel = document.createElement('div');
    filterLabel.textContent = 'Filter:';
    filterLabel.style.cssText = 'font-weight: 600; margin-right: 10px;';
    filterBar.appendChild(filterLabel);

    // Container TOOCCODE
    const tooccodeContainer = document.createElement('div');
    tooccodeContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 5px; margin-right: 15px; align-items: center;';
    
    // Label untuk TOOCCODE
    const tooccodeLabel = document.createElement('div');
    tooccodeLabel.textContent = 'TOOCCODE:';
    tooccodeLabel.style.cssText = 'margin-right: 5px; font-weight: 500; white-space: nowrap;';
    tooccodeContainer.appendChild(tooccodeLabel);
    
    // Bubbles untuk TOOCCODE
    tooccodeValues.forEach(value => {
      const bubble = document.createElement('div');
      bubble.className = 'standalone-filter-bubble tooccode';
      bubble.dataset.value = value;
      bubble.textContent = value;
      bubble.style.cssText = 'padding: 5px 10px; background: #4a6cf7; color: white; border-radius: 20px; font-size: 12px; cursor: pointer; user-select: none; margin: 2px; transition: all 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.1);';
      tooccodeContainer.appendChild(bubble);
      
      bubble.addEventListener('click', function() {
        this.classList.toggle('active');
        if (this.classList.contains('active')) {
          this.style.background = '#e0e0e0';
          this.style.color = '#333';
        } else {
          this.style.background = '#4a6cf7';
          this.style.color = 'white';
        }
        filterTableRows();
      });
    });
    
    filterBar.appendChild(tooccodeContainer);
    
    // Container SCANNERUSERCODE
    const scannerContainer = document.createElement('div');
    scannerContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 5px; align-items: center;';
    
    // Label untuk SCANNERUSERCODE
    const scannerLabel = document.createElement('div');
    scannerLabel.textContent = 'SCANNERUSERCODE:';
    scannerLabel.style.cssText = 'margin-right: 5px; font-weight: 500; white-space: nowrap;';
    scannerContainer.appendChild(scannerLabel);
    
    // Bubbles untuk SCANNERUSERCODE
    scannerValues.forEach(value => {
      const bubble = document.createElement('div');
      bubble.className = 'standalone-filter-bubble scanner';
      bubble.dataset.value = value;
      bubble.textContent = value;
      bubble.style.cssText = 'padding: 5px 10px; background: #ff9800; color: white; border-radius: 20px; font-size: 12px; cursor: pointer; user-select: none; margin: 2px; transition: all 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.1);';
      scannerContainer.appendChild(bubble);
      
      bubble.addEventListener('click', function() {
        this.classList.toggle('active');
        if (this.classList.contains('active')) {
          this.style.background = '#e0e0e0';
          this.style.color = '#333';
        } else {
          this.style.background = '#ff9800';
          this.style.color = 'white';
        }
        filterTableRows();
      });
    });
    
    filterBar.appendChild(scannerContainer);

    // Temukan semua tombol yang mungkin ekspor atau kolom
    const buttons = Array.from(document.querySelectorAll('button')).filter(btn => {
      const text = btn.textContent.toLowerCase();
      return text.includes('ekspor') || text.includes('kolom');
    });

    // Temukan tempat untuk menambahkan filter
    let targetElement = null;
    
    // Coba dengan tombol ekspor/kolom
    if (buttons.length > 0) {
      console.log("Tombol ditemukan:", buttons.length);
      targetElement = buttons[buttons.length - 1];
      // Tambahkan setelah tombol terakhir
      if (targetElement.parentNode) {
        targetElement.parentNode.appendChild(filterBar);
      }
    } else {
      // Coba dengan toolbar DataTables
      const dtButtons = document.querySelector('.dt-buttons');
      if (dtButtons) {
        console.log("Toolbar DataTables ditemukan");
        dtButtons.parentNode.insertBefore(filterBar, dtButtons.nextSibling);
      } else {
        // Coba dengan wrapper DataTables
        const dtWrapper = document.querySelector('.dataTables_wrapper');
        if (dtWrapper) {
          console.log("Wrapper DataTables ditemukan");
          dtWrapper.insertBefore(filterBar, dtWrapper.firstChild);
        } else {
          // Coba dengan tabel
          const table = document.querySelector('table');
          if (table) {
            console.log("Tabel ditemukan");
            table.parentNode.insertBefore(filterBar, table);
          } else {
            // Fallback ke body
            console.log("Tidak ada target spesifik ditemukan, menambahkan ke body");
            document.body.insertBefore(filterBar, document.body.firstChild);
          }
        }
      }
    }

    // Tambahkan style untuk hover
    const style = document.createElement('style');
    style.textContent = `
      .standalone-filter-bubble:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 3px 5px rgba(0,0,0,0.2) !important;
      }
    `;
    document.head.appendChild(style);

    console.log("Filter bubbles berhasil ditambahkan");
  }
  */

  // Fungsi untuk memfilter baris tabel
  function filterTableRows() {
    // Ambil semua filter yang aktif
    const activeTooccodeFilters = Array.from(document.querySelectorAll('.standalone-filter-bubble.tooccode.active'))
      .map(el => el.dataset.value);
    
    const activeScannerFilters = Array.from(document.querySelectorAll('.standalone-filter-bubble.scanner.active'))
      .map(el => el.dataset.value);
    
    console.log("Filter aktif:", { tooccode: activeTooccodeFilters, scanner: activeScannerFilters });
    
    // Cek jika tidak ada filter yang aktif
    if (activeTooccodeFilters.length === 0 && activeScannerFilters.length === 0) {
      // Kembalikan semua baris ke tampilan semula
      document.querySelectorAll('table tbody tr').forEach(row => {
        row.style.display = '';
      });
      return;
    }
    
    // Temukan semua tabel
    const tables = document.querySelectorAll('table');
    tables.forEach((table, tableIndex) => {
      // Untuk setiap tabel, cari header dan tentukan indeks kolom
      const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
      
      const tooccodeIndex = headers.indexOf('TOOCCODE');
      const scannerIndex = headers.indexOf('SCANNERUSERCODE');
      
      // Gunakan default jika tidak ditemukan
      const finalTooccodeIndex = tooccodeIndex !== -1 ? tooccodeIndex : 4;
      const finalScannerIndex = scannerIndex !== -1 ? scannerIndex : 5;
      
      // Filter baris
      const rows = table.querySelectorAll('tbody tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        
        // Skip jika baris tidak memiliki cukup sel
        if (cells.length <= Math.max(finalTooccodeIndex, finalScannerIndex)) return;
        
        const tooccode = cells[finalTooccodeIndex].textContent.trim();
        const scanner = cells[finalScannerIndex].textContent.trim();
        
        // Logika filter:
        // Jika ada filter TOOCCODE aktif, baris harus match dengan salah satu filter
        // Jika ada filter SCANNER aktif, baris harus match dengan salah satu filter
        const tooccodeMatch = activeTooccodeFilters.length === 0 || activeTooccodeFilters.includes(tooccode);
        const scannerMatch = activeScannerFilters.length === 0 || activeScannerFilters.includes(scanner);
        
        // Tampilkan baris jika match dengan semua kriteria
        if (tooccodeMatch && scannerMatch) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    });
    
    console.log("Filtering selesai");
  }

  // Panggil fungsi saat document ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      // Disabled to remove top filter
      // setTimeout(addFilterBubbles, 1000);
    });
  } else {
    // Document sudah ready
    // Disabled to remove top filter
    // setTimeout(addFilterBubbles, 1000);
  }

  // Tambahkan juga untuk window load dan event lainnya
  window.addEventListener('load', function() {
    // Disabled to remove top filter
    // setTimeout(addFilterBubbles, 1500);
  });

  // Jalankan lagi secara berkala untuk memastikan filter muncul
  // Disabled to remove top filter
  // setTimeout(addFilterBubbles, 3000);
  // setTimeout(addFilterBubbles, 5000);
})();

// Filter Bubble Hard-Coded - Force Display

// Jalankan segera saat script dimuat
(function() {
  // Skip seluruh operasi jika fitur dimatikan
  if (!window.enableGWScannerDuplicate) {
    console.log("Fitur GWScanner duplicate dimatikan untuk mencegah error");
    return;
  }
  
  // Nilai hard-coded untuk filter
  const tooccodeValues = ['DME', 'ARC', 'P2A'];
  const scannerValues = ['C0485', 'J0474', 'J0180'];

  // Fungsi untuk menambahkan filter bubble
  function forceAddFilterBubbles() {
    console.log("Menambahkan filter bubble khusus untuk GWScanner duplicate di samping tombol export/kolom");

    // Hapus filter yang sudah ada untuk menghindari duplikasi
    const existingFilters = document.querySelectorAll('.forced-filter-bar');
    existingFilters.forEach(filter => filter.remove());

    // Buat container filter
    const filterBar = document.createElement('div');
    filterBar.className = 'forced-filter-bar';
    filterBar.style.cssText = 'display: flex; flex-wrap: wrap; gap: 10px; margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 5px; border: 1px solid #dee2e6; align-items: center; z-index: 100;';

    // Indikator khusus - lebih minimal
    const filterIndicator = document.createElement('div');
    filterIndicator.textContent = 'Filter:';
    filterIndicator.style.cssText = 'font-weight: 600; margin-right: 10px;';
    filterBar.appendChild(filterIndicator);

    // Container TOOCCODE
    const tooccodeContainer = document.createElement('div');
    tooccodeContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 5px; margin-right: 15px; align-items: center;';
    
    // Label untuk TOOCCODE
    const tooccodeLabel = document.createElement('div');
    tooccodeLabel.textContent = 'TOOCCODE:';
    tooccodeLabel.style.cssText = 'margin-right: 5px; font-weight: 500; white-space: nowrap;';
    tooccodeContainer.appendChild(tooccodeLabel);
    
    // Bubbles untuk TOOCCODE
    tooccodeValues.forEach(value => {
      const bubble = document.createElement('div');
      bubble.className = 'forced-filter-bubble tooccode';
      bubble.dataset.value = value;
      bubble.textContent = value;
      bubble.style.cssText = 'padding: 5px 10px; background: #4a6cf7; color: white; border-radius: 20px; font-size: 12px; cursor: pointer; user-select: none; margin: 2px; transition: all 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.1);';
      tooccodeContainer.appendChild(bubble);
      
      bubble.addEventListener('click', function() {
        this.classList.toggle('active');
        if (this.classList.contains('active')) {
          this.style.background = '#e0e0e0';
          this.style.color = '#333';
        } else {
          this.style.background = '#4a6cf7';
          this.style.color = 'white';
        }
        forceFilterTableRows();
      });
    });
    
    filterBar.appendChild(tooccodeContainer);
    
    // Container SCANNERUSERCODE
    const scannerContainer = document.createElement('div');
    scannerContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 5px; align-items: center;';
    
    // Label untuk SCANNERUSERCODE
    const scannerLabel = document.createElement('div');
    scannerLabel.textContent = 'SCANNERUSERCODE:';
    scannerLabel.style.cssText = 'margin-right: 5px; font-weight: 500; white-space: nowrap;';
    scannerContainer.appendChild(scannerLabel);
    
    // Bubbles untuk SCANNERUSERCODE
    scannerValues.forEach(value => {
      const bubble = document.createElement('div');
      bubble.className = 'forced-filter-bubble scanner';
      bubble.dataset.value = value;
      bubble.textContent = value;
      bubble.style.cssText = 'padding: 5px 10px; background: #ff9800; color: white; border-radius: 20px; font-size: 12px; cursor: pointer; user-select: none; margin: 2px; transition: all 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.1);';
      scannerContainer.appendChild(bubble);
      
      bubble.addEventListener('click', function() {
        this.classList.toggle('active');
        if (this.classList.contains('active')) {
          this.style.background = '#e0e0e0';
          this.style.color = '#333';
        } else {
          this.style.background = '#ff9800';
          this.style.color = 'white';
        }
        forceFilterTableRows();
      });
    });
    
    filterBar.appendChild(scannerContainer);

    // CARI TABEL GWSCANNER DUPLICATE TERLEBIH DAHULU
    let gwscannerDuplicateTable = null;
    
    // Coba temukan heading yang sesuai
    const headings = Array.from(document.querySelectorAll('h2, h3, h4, h5, h6'))
      .filter(h => h.textContent.includes('GWScanner') && 
                h.textContent.includes('Duplicate') && 
                !h.textContent.includes('Overtime') && 
                !h.textContent.includes('Not Sync'));
    
    if (headings.length > 0) {
      console.log("Menemukan heading GWScanner Duplicate:", headings[0].textContent);
      
      // Cari tabel atau container yang berhubungan dengan heading ini
      let element = headings[0];
      let maxDepth = 5; // Batasi pencarian hingga 5 elemen berikutnya
      
      while (element && maxDepth > 0) {
        element = element.nextElementSibling;
        maxDepth--;
        
        if (!element) break;
        
        if (element.tagName === 'TABLE') {
          gwscannerDuplicateTable = element;
          break;
        }
        
        // Cek jika ini container
        const containerTable = element.querySelector('table');
        if (containerTable) {
          gwscannerDuplicateTable = containerTable;
          break;
        }
        
        // Cek untuk DataTables container
        const dtContainer = element.querySelector('.dataTables_wrapper');
        if (dtContainer) {
          const dtTable = dtContainer.querySelector('table');
          if (dtTable) {
            gwscannerDuplicateTable = dtTable;
            break;
          }
        }
      }
    }
    
    // Jika masih tidak menemukan tabel, cari berdasarkan isi header tabel
    if (!gwscannerDuplicateTable) {
      const allTables = document.querySelectorAll('table');
      allTables.forEach(table => {
        // Cek apakah ini tabel GWScanner dengan memeriksa header
        const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
        if (headers.includes('TOOCCODE') && headers.includes('SCANNERUSERCODE')) {
          // Cek apakah ini bukan tabel overtime
          const parentHeadings = Array.from(findParentHeadings(table, 3));
          const isOvertime = parentHeadings.some(h => 
            h.textContent.includes('Overtime') || h.textContent.includes('Not Sync'));
          
          if (!isOvertime && !gwscannerDuplicateTable) {
            gwscannerDuplicateTable = table;
          }
        }
      });
    }
    
    if (!gwscannerDuplicateTable) {
      console.log("Tidak dapat menemukan tabel GWScanner Duplicate");
      return;
    }
    
    // CARI TOMBOL EXPORT DAN KOLOM DI SEKITAR TABEL
    let targetArea = null;
    
    // Cari container DataTables
    const dtWrapper = gwscannerDuplicateTable.closest('.dataTables_wrapper');
    if (dtWrapper) {
      // Cari tombol Export/Kolom
      const buttons = dtWrapper.querySelectorAll('.dt-buttons .dt-button, button');
      const exportButtons = Array.from(buttons).filter(btn => {
        const text = btn.textContent.toLowerCase();
        return text.includes('export') || text.includes('ekspor') || text.includes('kolom') || 
               text.includes('column') || text.includes('excel') || text.includes('pdf');
      });
      
      if (exportButtons.length > 0) {
        console.log("Menemukan tombol export di DataTables");
        const lastExportButton = exportButtons[exportButtons.length - 1];
        
        // Cari container parent dari tombol export
        const btnContainer = lastExportButton.closest('.dt-buttons') || lastExportButton.parentNode;
        
        if (btnContainer) {
          // Tambahkan filter setelah container tombol
          btnContainer.parentNode.insertBefore(filterBar, btnContainer.nextSibling);
          targetArea = btnContainer;
        }
      } else {
        // Jika tidak ada tombol export, cari tempat lain di wrapper
        const dtHeader = dtWrapper.querySelector('.dataTables_length, .dataTables_filter');
        if (dtHeader) {
          dtHeader.parentNode.insertBefore(filterBar, dtHeader.nextSibling);
          targetArea = dtHeader;
        } else {
          // Fallback: tambahkan di atas tabel
          dtWrapper.insertBefore(filterBar, gwscannerDuplicateTable);
          targetArea = dtWrapper;
        }
      }
    } else {
      // Jika bukan DataTables, cari parent container tabel
      const tableParent = gwscannerDuplicateTable.parentNode;
      if (tableParent) {
        // Cari tombol/elemen di sekitar tabel
        const buttons = tableParent.querySelectorAll('button');
        const exportButtons = Array.from(buttons).filter(btn => {
          const text = btn.textContent.toLowerCase();
          return text.includes('export') || text.includes('ekspor') || text.includes('kolom');
        });
        
        if (exportButtons.length > 0) {
          const lastExportButton = exportButtons[exportButtons.length - 1];
          lastExportButton.parentNode.insertBefore(filterBar, lastExportButton.nextSibling);
          targetArea = lastExportButton;
        } else {
          // Tambahkan sebelum tabel
          tableParent.insertBefore(filterBar, gwscannerDuplicateTable);
          targetArea = tableParent;
        }
      } else {
        console.log("Tidak dapat menemukan area yang tepat untuk filter");
        return;
      }
    }
    
    if (targetArea) {
      console.log("Berhasil menambahkan filter di samping tombol export/kolom");
      
      // Tambahkan style untuk hover ke document
      const style = document.createElement('style');
      style.textContent = `
        .forced-filter-bubble:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 3px 5px rgba(0,0,0,0.2) !important;
        }
      `;
      document.head.appendChild(style);
      
      // Periksa dan muat data GWScanner duplicate
      loadAndShowGWScannerData(gwscannerDuplicateTable);
    }
  }

  // Fungsi pembantu untuk mencari heading parent
  function findParentHeadings(element, maxDepth) {
    const headings = [];
    let current = element;
    let depth = 0;
    
    while (current && depth < maxDepth) {
      current = current.parentElement;
      depth++;
      
      if (!current) break;
      
      const heading = current.querySelector('h2, h3, h4, h5, h6');
      if (heading) {
        headings.push(heading);
      }
    }
    
    return headings;
  }

  // Fungsi untuk memuat dan menampilkan data GWScanner
  function loadAndShowGWScannerData(table) {
    // Periksa apakah tabel kosong
    const rows = table.querySelectorAll('tbody tr');
    const isEmpty = rows.length === 0 || 
                   (rows.length === 1 && (rows[0].textContent.trim().includes('No data') || 
                                        rows[0].textContent.trim().includes('Tidak ada data')));
    
    console.log("Status tabel GWScanner Duplicate:", isEmpty ? "KOSONG" : rows.length + " baris data");
    
    // Selalu coba muat data dari JSON untuk memastikan
    try {
      console.log("Mencoba memuat data langsung dari file JSON...");
      fetch('/data/gwscanner_results.json')
        .then(response => {
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          return response.json();
        })
        .then(data => {
          console.log("Berhasil memuat data dari JSON:", data.length, "records");
          
          if (isEmpty && data && data.length > 0) {
            console.log("Mencoba menampilkan data dalam tabel...");
            displayGWScannerDataInTable(table, data);
          } else {
            console.log("Tabel sudah berisi data atau data JSON kosong");
            // Tetap jalankan filter untuk data yang sudah ada
            setTimeout(() => { forceFilterTableRows(); }, 500);
          }
        })
        .catch(error => {
          console.error("Gagal memuat JSON:", error);
          
          // Cari tombol refresh jika gagal memuat JSON
          const refreshButtons = Array.from(document.querySelectorAll('button'))
            .filter(btn => {
              const text = btn.textContent.toLowerCase();
              return text.includes('refresh') || text.includes('reload') || 
                     text.includes('muat ulang') || text.includes('load');
            });
          
          if (refreshButtons.length > 0) {
            console.log("Mengklik tombol refresh untuk memuat data...");
            refreshButtons[0].click();
            
            // Tunggu data dimuat
            setTimeout(() => { forceFilterTableRows(); }, 2000);
          }
        });
    } catch (e) {
      console.error("Error saat memproses data:", e);
    }
  }

  // Fungsi untuk menampilkan data dalam tabel
  function displayGWScannerDataInTable(table, data) {
    if (!table || !data || data.length === 0) {
      console.log("Tidak ada tabel atau data untuk ditampilkan");
      return;
    }
    
    console.log("Menampilkan", data.length, "baris data ke dalam tabel");
    
    try {
      // Dapatkan header tabel
      const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
      console.log("Header tabel:", headers);
      
      // Dapatkan tbody untuk menambahkan baris
      const tbody = table.querySelector('tbody');
      if (!tbody) {
        console.error("Tidak menemukan tbody dalam tabel");
        return;
      }
      
      // Kosongkan tbody jika memiliki pesan "No data"
      if (tbody.children.length === 1 && 
          (tbody.children[0].textContent.includes('No data') || 
           tbody.children[0].textContent.includes('Tidak ada data'))) {
        tbody.innerHTML = '';
      }
      
      // Batasi jumlah baris yang ditampilkan untuk performa
      const maxRows = 100;
      const dataToShow = data.slice(0, maxRows);
      
      // Buat baris untuk setiap data
      dataToShow.forEach(rowData => {
        const tr = document.createElement('tr');
        
        // Loop melalui properti yang sesuai dengan header
        headers.forEach(header => {
          const td = document.createElement('td');
          
          // Coba dapatkan nilai yang sesuai
          const value = rowData[header] || '';
          td.textContent = value;
          
          tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
      });
      
      console.log(`Berhasil menampilkan ${dataToShow.length} dari ${data.length} baris data`);
      
      // Inisialisasi ulang DataTable jika ada
      if ($.fn.DataTable && $.fn.DataTable.isDataTable(table)) {
        $(table).DataTable().draw();
      }
      
      // Jalankan filter bubble
      setTimeout(() => { forceFilterTableRows(); }, 500);
    } catch (e) {
      console.error("Error saat menampilkan data:", e);
    }
  }

  // Fungsi untuk memfilter baris tabel
  function forceFilterTableRows() {
    // Ambil semua filter yang aktif
    const activeTooccodeFilters = Array.from(document.querySelectorAll('.forced-filter-bubble.tooccode.active'))
      .map(el => el.dataset.value);
    
    const activeScannerFilters = Array.from(document.querySelectorAll('.forced-filter-bubble.scanner.active'))
      .map(el => el.dataset.value);
    
    console.log("Filter aktif:", { tooccode: activeTooccodeFilters, scanner: activeScannerFilters });
    
    // Temukan tabel yang benar, khusus untuk GWScanner duplicate
    let targetTable = null;
    
    // Cari tabel berdasarkan judul/header di sekitar tabel
    const allHeadings = document.querySelectorAll('h2, h3, h4, h5');
    console.log(`Ditemukan ${allHeadings.length} headings untuk dicek`);
    
    allHeadings.forEach(heading => {
      if (heading.textContent.includes('GWScanner') && 
          heading.textContent.includes('Duplicate') && 
          !heading.textContent.includes('Not Sync') && 
          !heading.textContent.includes('Overtime')) {
        console.log("Menemukan heading GWScanner Duplicate:", heading.textContent);
        
        // Cari tabel terdekat setelah heading ini
        let element = heading.nextElementSibling;
        while (element && !targetTable) {
          if (element.tagName === 'TABLE' || element.querySelector('table')) {
            targetTable = element.tagName === 'TABLE' ? element : element.querySelector('table');
            console.log("Menemukan tabel GWScanner Duplicate!");
          } else if (element.classList.contains('card-body') || element.classList.contains('table-responsive')) {
            // Cek di dalam elemen container
            const tableInside = element.querySelector('table');
            if (tableInside) {
              targetTable = tableInside;
              console.log("Menemukan tabel GWScanner Duplicate di dalam container!");
            }
          }
          element = element.nextElementSibling;
        }
      }
    });

    // Jika tidak ditemukan dengan heading, coba cari berdasarkan ID atau class yang mungkin terkait
    if (!targetTable) {
      const possibleContainers = document.querySelectorAll('#gwscannerDuplicateTable, .gwscanner-duplicate-table, #gwscanner-table, .gwscanner-table');
      if (possibleContainers.length > 0) {
        console.log("Menemukan container berdasarkan ID/class");
        targetTable = possibleContainers[0].tagName === 'TABLE' 
          ? possibleContainers[0] 
          : possibleContainers[0].querySelector('table');
      }
    }

    // Jika masih belum menemukan, coba cari semua tabel dan periksa header
    if (!targetTable) {
      const allTables = document.querySelectorAll('table');
      console.log(`Mencoba mencari di ${allTables.length} tabel berdasarkan header`);
      
      for (const table of allTables) {
        const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
        console.log("Header tabel:", headers.join(', '));
        
        // Jika mengandung kolom TOOCCODE dan SCANNERUSERCODE, dan jumlah baris > 0, ini mungkin tabel yang dicari
        if (headers.includes('TOOCCODE') && 
            headers.includes('SCANNERUSERCODE') && 
            table.querySelectorAll('tbody tr').length > 0) {
          console.log("Menemukan tabel dengan kolom TOOCCODE & SCANNERUSERCODE");
          targetTable = table;
          
          // Cek judul section di atas tabel
          let parent = table.parentElement;
          let foundHeading = false;
          for (let i = 0; i < 5 && parent; i++) { // Cek maksimal 5 level ke atas
            const heading = parent.querySelector('h2, h3, h4, h5');
            if (heading) {
              console.log("Judul section: ", heading.textContent);
              if (heading.textContent.includes('Overtime') || heading.textContent.includes('Not Sync')) {
                console.log("Ini tabel Not Sync Overtime, bukan Duplicate. Lewati.");
                targetTable = null; // Ini bukan tabel yang kita cari
              }
              foundHeading = true;
              break;
            }
            parent = parent.parentElement;
          }
          
          if (foundHeading && targetTable) {
            break;
          }
        }
      }
    }

    if (!targetTable) {
      console.log("TIDAK MENEMUKAN tabel GWScanner Duplicate yang sesuai!");
      return;
    }

    console.log("Mulai memfilter tabel GWScanner duplicate...");
    
    // Untuk tabel yang ditemukan, tentukan indeks kolom
    const headers = Array.from(targetTable.querySelectorAll('thead th')).map(th => th.textContent.trim());
    
    let tooccodeIndex = headers.indexOf('TOOCCODE');
    let scannerIndex = headers.indexOf('SCANNERUSERCODE');
    
    // Gunakan default jika tidak ditemukan
    if (tooccodeIndex === -1) tooccodeIndex = 4;
    if (scannerIndex === -1) scannerIndex = 5;
    
    console.log(`Menggunakan indeks: TOOCCODE=${tooccodeIndex}, SCANNER=${scannerIndex}`);
    
    // Filter baris hanya pada tabel ini
    const rows = targetTable.querySelectorAll('tbody tr');
    console.log(`Tabel memiliki ${rows.length} baris untuk difilter`);
    
    // Jika tidak ada filter yang aktif, tampilkan semua baris
    if (activeTooccodeFilters.length === 0 && activeScannerFilters.length === 0) {
      rows.forEach(row => {
        row.style.display = '';
      });
      console.log("Tidak ada filter aktif, menampilkan semua baris");
      return;
    }
    
    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      
      // Skip jika baris tidak memiliki cukup sel
      if (cells.length <= Math.max(tooccodeIndex, scannerIndex)) {
        return;
      }
      
      const tooccode = cells[tooccodeIndex].textContent.trim();
      const scanner = cells[scannerIndex].textContent.trim();
      
      // Debug info
      if (row.rowIndex < 3) {
        console.log(`Row ${row.rowIndex}: TOOCCODE=${tooccode}, SCANNER=${scanner}`);
      }
      
      // Logika filter
      const tooccodeMatch = activeTooccodeFilters.length === 0 || activeTooccodeFilters.includes(tooccode);
      const scannerMatch = activeScannerFilters.length === 0 || activeScannerFilters.includes(scanner);
      
      if (tooccodeMatch && scannerMatch) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
    
    console.log("Filtering GWScanner duplicate selesai");
  }

  // Panggil fungsi dalam interval pendek sampai berhasil
  let forceIntervalRunCount = 0;
  const MAX_FORCE_INTERVAL_ATTEMPTS = 5; // Batas maksimal percobaan
  const forceInterval = setInterval(function() {
    // Tambah counter percobaan
    forceIntervalRunCount++;
    
    // Jika sudah mencapai batas maksimal percobaan, hentikan
    if (forceIntervalRunCount > MAX_FORCE_INTERVAL_ATTEMPTS) {
      console.log(`Sudah mencoba ${MAX_FORCE_INTERVAL_ATTEMPTS} kali, berhenti mencoba menambahkan filter bubble`);
      clearInterval(forceInterval);
      return;
    }
    
    if (document.querySelector('.forced-filter-bar')) {
      console.log("Filter bubble sudah ada, tidak perlu tambahkan lagi");
      clearInterval(forceInterval);
      return;
    }
    
    console.log(`Percobaan ke-${forceIntervalRunCount} untuk menambahkan filter bubble`);
    forceAddFilterBubbles();
    
    // Setelah menambahkan filter, periksa dan pastikan data tampil hanya sekali
    if (forceIntervalRunCount === 1) {
      setTimeout(checkAndEnsureGWScannerDuplicateData, 1000);
    }
  }, 3000); // Coba setiap 3 detik (diperpanjang dari 1 detik)

  // Panggil fungsi saat document ready (untuk jQuery)
  if (typeof $ !== 'undefined') {
    $(document).ready(function() {
      forceAddFilterBubbles();
    });
  }

  // Panggil fungsi saat document ready (untuk vanilla JS)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      forceAddFilterBubbles();
    });
  } else {
    // Document sudah ready
    forceAddFilterBubbles();
  }

  // Panggil saat window load
  window.addEventListener('load', function() {
    forceAddFilterBubbles();
  });
  
  // Panggil sekarang juga
  forceAddFilterBubbles();
  
  // Definisikan global function
  window.forceAddFilterBubbles = forceAddFilterBubbles;
})();

// Tambahkan fungsi baru di dekat bagian atas script untuk membuat dan menampilkan tabel dengan data GWScanner
function createAndShowGWScannerTable() {
  // Skip jika fitur dimatikan
  if (!window.enableGWScannerDuplicate) {
    console.log("Fitur GWScanner duplicate dimatikan, tidak memuat data");
    return;
  }
  
  console.log("Mencoba memuat dan menampilkan data GWScanner duplicate secara langsung...");
  
  // Langkah 1: Cari container untuk menampung tabel
  let container = document.querySelector('#gwscannerContainer, #gwscanner-container, #gwscannerDuplicateContainer');
  if (!container) {
    // Cari berdasarkan heading
    const headings = Array.from(document.querySelectorAll('h2, h3, h4, h5'))
      .filter(h => h.textContent.includes('GWScanner') && 
              h.textContent.includes('Duplicate') && 
              !h.textContent.includes('Overtime') && 
              !h.textContent.includes('Not Sync'));
    
    if (headings.length > 0) {
      // Cari elemen container setelah heading
      let element = headings[0];
      let next = element.nextElementSibling;
      
      while (next && !container) {
        if (next.classList.contains('card') || 
            next.classList.contains('table-responsive') || 
            next.classList.contains('content-wrapper')) {
          container = next;
        }
        next = next.nextElementSibling;
      }
      
      // Jika masih tidak ditemukan, buat container baru
      if (!container) {
        container = document.createElement('div');
        container.id = 'gwscannerDuplicateContainer';
        container.className = 'table-responsive';
        headings[0].parentNode.insertBefore(container, headings[0].nextSibling);
      }
    } else {
      // Tidak menemukan heading, cari bagian konten utama
      container = document.querySelector('.main-content, .content, main, #content');
      
      if (!container) {
        console.error("Tidak dapat menemukan container untuk menampilkan tabel");
        return;
      }
    }
  }
  
  // Langkah 2: Muat data GWScanner duplicate dari JSON
  fetch('/data/gwscanner_results.json')
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(jsonData => {
      // Periksa format data yang diterima
      console.log("Berhasil memuat data dari JSON:", jsonData ? (jsonData.length || 'undefined') : 'null', "records");
      
      // Periksa dan perbaiki struktur data
      let data = [];
      
      if (jsonData === null || jsonData === undefined) {
        console.error("Data JSON kosong atau undefined");
        // Tampilkan pesan error yang informatif
        container.innerHTML = '<div class="alert alert-warning">Data GWScanner duplicate tidak tersedia.</div>';
        return;
      }
      
      // Validasi struktur data
      if (Array.isArray(jsonData)) {
        // Data langsung dalam bentuk array
        data = jsonData;
      } else if (typeof jsonData === 'object' && jsonData.data && Array.isArray(jsonData.data)) {
        // Data dalam format { data: [...] }
        data = jsonData.data;
      } else if (typeof jsonData === 'object') {
        // Data mungkin dalam format objek, coba konversi
        try {
          // Jika data adalah objek tunggal, ubah ke array dengan satu item
          data = [jsonData];
        } catch (e) {
          console.error("Format data tidak valid:", e);
        }
      }
      
      if (data.length === 0) {
        console.error("Data GWScanner duplicate kosong");
        container.innerHTML = '<div class="alert alert-warning">Data GWScanner duplicate kosong.</div>';
        return;
      }
      
      console.log("Data yang akan ditampilkan:", data.length, "records");
      
      // Langkah 3: Buat tabel baru dan isi dengan data
      let existingTable = container.querySelector('table');
      
      if (existingTable) {
        console.log("Menemukan tabel yang sudah ada, cek apakah sudah memiliki data");
        const rows = existingTable.querySelectorAll('tbody tr');
        
        // Jika tabel kosong atau hanya berisi 1 baris 'No data', hapus dan buat baru
        if (rows.length === 0 || (rows.length === 1 && rows[0].textContent.includes('No data'))) {
          console.log("Tabel kosong, membuat ulang");
          existingTable.remove();
          existingTable = null;
        } else {
          console.log("Tabel sudah memiliki data:", rows.length, "baris");
        }
      }
      
      if (!existingTable) {
        console.log("Membuat tabel baru");
        // Membuat tabel baru dari awal
        const table = document.createElement('table');
        table.id = 'gwscannerDuplicateTable';
        table.className = 'table table-striped table-bordered';
        
        // Buat header berdasarkan key dari data pertama
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        // Ambil semua key unik dari data
        const keys = new Set();
        // Gunakan data[0] sebagai sample, hanya jika ada
        if (data && data.length > 0 && typeof data[0] === 'object') {
          Object.keys(data[0]).forEach(key => keys.add(key));
        } else {
          console.warn("Tidak dapat menemukan properti data untuk header tabel");
          keys.add("Data");  // Default jika tidak ada properti
        }
        
        // Pastikan kolom TOOCCODE dan SCANNERUSERCODE ada di awal jika ada
        const priorityKeys = ['TOOCCODE', 'SCANNERUSERCODE'];
        const otherKeys = Array.from(keys).filter(key => !priorityKeys.includes(key));
        
        // Gabungkan prioritas + key lainnya
        const allKeys = [...priorityKeys.filter(key => keys.has(key)), ...otherKeys];
        
        if (allKeys.length === 0) {
          console.error("Tidak ada properti dalam data untuk header tabel");
          container.innerHTML = '<div class="alert alert-danger">Format data tidak valid untuk ditampilkan dalam tabel.</div>';
          return;
        }
        
        allKeys.forEach(key => {
          const th = document.createElement('th');
          th.textContent = key;
          headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Buat body tabel
        const tbody = document.createElement('tbody');
        
        // Batasi data untuk performa (maksimal 100 baris)
        const rowLimit = 100;
        const dataToShow = data.slice(0, Math.min(rowLimit, data.length));
        
        dataToShow.forEach(item => {
          if (typeof item !== 'object') {
            console.warn(`Melewati item yang bukan objek: ${item}`);
            return;
          }
          
          const row = document.createElement('tr');
          
          allKeys.forEach(key => {
            const td = document.createElement('td');
            td.textContent = item[key] !== undefined ? item[key] : '';
            row.appendChild(td);
          });
          
          tbody.appendChild(row);
        });
        
        table.appendChild(tbody);
        container.innerHTML = ''; // Kosongkan container
        container.appendChild(table);
        
        console.log("Berhasil menampilkan", dataToShow.length, "baris dari", data.length, "total records");
        
        // Inisialisasi DataTable jika jQuery dan DataTables tersedia
        if (typeof $ !== 'undefined' && $.fn.DataTable) {
          try {
            const dataTable = $(table).DataTable({
              paging: true,
              searching: true,
              ordering: true,
              info: true,
              pageLength: 25,
              language: {
                "emptyTable": "Tidak ada data yang tersedia",
                "info": "Menampilkan _START_ sampai _END_ dari _TOTAL_ entri",
                "infoEmpty": "Menampilkan 0 sampai 0 dari 0 entri",
                "infoFiltered": "(disaring dari _MAX_ entri keseluruhan)",
                "lengthMenu": "Tampilkan _MENU_ entri",
                "search": "Cari:",
                "zeroRecords": "Tidak ditemukan data yang sesuai",
                "paginate": {
                  "first": "Pertama",
                  "last": "Terakhir",
                  "next": "Selanjutnya",
                  "previous": "Sebelumnya"
                }
              },
              dom: 'Bfrtip',
              buttons: [
                'copy', 'excel', 'pdf'
              ]
            });
            
            console.log("DataTable berhasil diinisialisasi");
            
            // Tambahkan filter bubble setelah DataTable diinisialisasi
            setTimeout(() => {
              forceAddFilterBubbles();
            }, 1000);
          } catch (error) {
            console.error("Gagal menginisialisasi DataTable:", error);
          }
        } else {
          console.log("DataTable tidak tersedia, hanya menampilkan tabel HTML biasa");
          // Tetap tambahkan filter
          setTimeout(() => {
            forceAddFilterBubbles();
          }, 1000);
        }
      } else {
        console.log("Menggunakan tabel yang sudah ada, menambahkan filter");
        // Tambahkan filter ke tabel yang sudah ada
        setTimeout(() => {
          forceAddFilterBubbles();
        }, 500);
      }
    })
    .catch(error => {
      console.error("Error saat memuat data GWScanner duplicate:", error);
      
      // Tampilkan pesan error ke pengguna
      const errorMsg = document.createElement('div');
      errorMsg.className = 'alert alert-danger';
      errorMsg.textContent = 'Gagal memuat data GWScanner duplicate. Coba refresh halaman.';
      container.appendChild(errorMsg);
    });
}

// Definisikan sebagai fungsi global
window.createAndShowGWScannerTable = createAndShowGWScannerTable;

// Skip auto-run jika fitur dimatikan
if (window.enableGWScannerDuplicate) {
  // Jalankan pada awal load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(createAndShowGWScannerTable, 1500);
    });
  } else {
    setTimeout(createAndShowGWScannerTable, 1500);
  }

  // Tambahkan ke window load juga
  window.addEventListener('load', function() {
    setTimeout(createAndShowGWScannerTable, 2000);
  });
}

// Tambahkan definisi fungsi yang hilang
let gwScannerDataAttempts = 0;
const MAX_GWSCANNER_ATTEMPTS = 2;

function checkAndEnsureGWScannerDuplicateData() {
  // Skip jika fitur dimatikan
  if (!window.enableGWScannerDuplicate) {
    console.log("Fitur GWScanner duplicate dimatikan, tidak memeriksa data");
    return;
  }
  
  console.log("Memeriksa ketersediaan data GWScanner duplicate...");
  
  // Jika sudah mencapai batas maksimal percobaan, hentikan
  if (gwScannerDataAttempts >= MAX_GWSCANNER_ATTEMPTS) {
    console.log(`Sudah mencoba memuat data GWScanner duplicate ${MAX_GWSCANNER_ATTEMPTS} kali, berhenti mencoba`);
    return;
  }
  
  gwScannerDataAttempts++;
  
  // Cek apakah tabel sudah ada dan memiliki data
  const table = document.querySelector('#gwscannerDuplicateTable, #gwscanner-table');
  
  if (!table || table.querySelectorAll('tbody tr').length === 0) {
    console.log(`Percobaan ke-${gwScannerDataAttempts}: Data GWScanner duplicate belum ditampilkan, mencoba memuat ulang...`);
    
    // Coba panggil fungsi untuk memuat dan menampilkan data
    if (typeof createAndShowGWScannerTable === 'function') {
      createAndShowGWScannerTable();
    } else {
      console.error("Fungsi createAndShowGWScannerTable tidak tersedia");
    }
  } else {
    console.log("Data GWScanner duplicate sudah ditampilkan, tidak perlu memuat ulang");
    gwScannerDataAttempts = MAX_GWSCANNER_ATTEMPTS; // Set ke batas maksimal supaya tidak mencoba lagi
  }
}

// Expose fungsi ke global scope
window.checkAndEnsureGWScannerDuplicateData = checkAndEnsureGWScannerDuplicateData; 