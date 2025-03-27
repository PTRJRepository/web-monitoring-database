/**
 * dynamic-summary.js
 * Script untuk menampilkan ringkasan data dan grafik yang dinamis berdasarkan tab yang aktif
 */

document.addEventListener('DOMContentLoaded', function() {
    // Referensi ke elemen-elemen UI
    const dynamicSummaryTitle = document.getElementById('dynamic-summary-title');
    const dynamicSummaryChart = document.getElementById('dynamic-summary-chart');
    const dynamicSummaryStats = document.getElementById('dynamic-summary-stats');
    const dynamicChartBar = document.getElementById('dynamic-chart-bar');
    const dynamicChartPie = document.getElementById('dynamic-chart-pie');
    
    // Variabel untuk menyimpan instance chart
    let summaryChart = null;
    let currentChartType = 'bar';
    let currentTabId = null;
    
    // Data tabs yang didukung
    const supportedTabs = [
        {
            id: 'tunjangan-tab',
            targetId: 'tunjangan-data',
            title: 'Ringkasan Data Tunjangan Beras',
            statsCardId: 'tunjangan-stats',
            fieldForChart: 'Status Tunjangan', // Field untuk digunakan dalam grafik
            icon: 'fas fa-money-bill-wave',
            chartTitle: 'Jumlah Berdasarkan Status Tunjangan',
            filename: 'tunjangan_beras_temp.json'
        },
        {
            id: 'bpjs-tab',
            targetId: 'bpjs-data',
            title: 'Ringkasan Data BPJS',
            statsCardId: 'bpjs-stats',
            fieldForChart: 'StatusKeseluruhan',
            icon: 'fas fa-heartbeat',
            chartTitle: 'Jumlah Berdasarkan Status',
            filename: 'bpjs_temp.json'
        },
        {
            id: 'gwscanner-tab',
            targetId: 'gwscanner-data',
            title: 'Ringkasan Data GWScanner',
            statsCardId: 'gwscanner-stats',
            fieldForChart: 'TOOCCODE',
            icon: 'fas fa-qrcode',
            chartTitle: 'Jumlah Berdasarkan TOOCCODE',
            filename: 'gwscanner_temp.json'
        },
        {
            id: 'ffbworker-tab',
            targetId: 'ffbworker-data',
            title: 'Ringkasan Data FFB Worker',
            statsCardId: 'ffbworker-stats',
            fieldForChart: 'Status Karyawan',
            icon: 'fas fa-users',
            chartTitle: 'Jumlah Berdasarkan Status Karyawan',
            filename: 'ffbworker_temp.json'
        },
        {
            id: 'gwscanner-overtime-tab',
            targetId: 'gwscanner-overtime-data',
            title: 'Ringkasan Data GWScanner-Overtime',
            statsCardId: 'gwscanner-overtime-stats',
            fieldForChart: 'Status GWScanner',
            icon: 'fas fa-sync-alt',
            chartTitle: 'Jumlah Berdasarkan Status',
            filename: 'gwscanner_overtime_not_sync_temp.json'
        }
    ];
    
    // Function untuk mencari info tab berdasarkan ID
    function getTabInfo(tabId) {
        return supportedTabs.find(tab => tab.id === tabId);
    }
    
    // Function untuk mengupdate chart
    function updateChart(data, fieldForChart, title, chartType = 'bar') {
        // Kita akan menampilkan jumlah data per kategori, bukan per field
        // Ambil data dari semua kategori dan hitung totalnya
        const allCategoryData = {};
        
        // Coba ambil data dari semua kategori yang ada
        const categories = {};
        supportedTabs.forEach(tab => {
            categories[tab.filename] = { 
                label: tab.title.replace('Ringkasan Data ', ''), 
                color: getColorForTab(tab.id) 
            };
        });
        
        // Cek window.loadedData untuk data yang tersedia
        if (window.loadedData) {
            Object.keys(categories).forEach(key => {
                if (window.loadedData[key]) {
                    allCategoryData[categories[key].label] = window.loadedData[key].length;
                } else {
                    allCategoryData[categories[key].label] = 0;
                }
            });
        } else {
            // Jika data belum dimuat, gunakan data kosong
            Object.keys(categories).forEach(key => {
                allCategoryData[categories[key].label] = 0;
            });
        }
        
        // Konversi ke format yang dibutuhkan untuk chart
        const labels = Object.keys(allCategoryData);
        const values = Object.values(allCategoryData);
        
        // Siapkan warna untuk chart
        const backgroundColors = [];
        labels.forEach(label => {
            const category = Object.values(categories).find(cat => cat.label === label);
            backgroundColors.push(category ? category.color : 'rgba(128, 128, 128, 0.6)');
        });
        
        // Jika chart sudah ada, destroy dulu
        if (summaryChart) {
            summaryChart.destroy();
        }
        
        // Buat chart baru
        const ctx = dynamicSummaryChart.getContext('2d');
        summaryChart = new Chart(ctx, {
            type: chartType,
            data: {
                labels: labels,
                datasets: [{
                    label: 'Jumlah Data',
                    data: values,
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors.map(color => color.replace('0.6', '1')),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                scales: {
                    y: {
                        beginAtZero: true,
                        display: chartType === 'bar',
                        title: {
                            display: chartType === 'bar',
                            text: 'Jumlah Data'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: chartType === 'pie',
                        position: 'right'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                label += context.raw;
                                return label;
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Jumlah Data Per Kategori'
                    }
                }
            }
        });
    }
    
    // Function untuk mendapatkan warna berdasarkan tab ID
    function getColorForTab(tabId) {
        switch (tabId) {
            case 'tunjangan-tab':
                return 'rgba(54, 162, 235, 0.6)'; // Biru
            case 'bpjs-tab':
                return 'rgba(255, 99, 132, 0.6)'; // Merah
            case 'gwscanner-tab':
                return 'rgba(255, 206, 86, 0.6)'; // Kuning
            case 'ffbworker-tab':
                return 'rgba(75, 192, 192, 0.6)'; // Teal
            case 'gwscanner-overtime-tab':
                return 'rgba(153, 102, 255, 0.6)'; // Ungu
            default:
                return 'rgba(128, 128, 128, 0.6)'; // Abu-abu
        }
    }
    
    // Function untuk mengupdate stats
    function updateStats(data, tabInfo) {
        let statsHTML = '';
        
        // Ambil jumlah total data dari tiap kategori
        const countData = {};
        
        supportedTabs.forEach(tab => {
            const filename = tab.filename;
            countData[filename] = window.loadedData && window.loadedData[filename] ? 
                window.loadedData[filename].length : 0;
        });
        
        // Jumlah GWScanner duplikat jika data tersedia
        let duplicateCount = 0;
        if (window.loadedData && window.loadedData['gwscanner_temp.json']) {
            duplicateCount = countDuplicatesInGWScanner(window.loadedData['gwscanner_temp.json']);
        }
        
        // Total data secara keseluruhan
        const totalAllData = Object.values(countData).reduce((sum, count) => sum + count, 0);
        
        statsHTML = `
            <div class="col-md-3">
                <div class="summary-stat">
                    <i class="fas fa-database text-info"></i>
                    <div>
                        <h5>Total Semua Data</h5>
                        <p>${totalAllData}</p>
                        ${totalAllData === 0 ? '<small class="text-muted">Tidak ada data yang tersedia</small>' : ''}
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="summary-stat">
                    <i class="fas fa-money-bill-wave text-success"></i>
                    <div>
                        <h5>Tunjangan Beras</h5>
                        <p>${countData['tunjangan_beras_temp.json']}</p>
                        ${countData['tunjangan_beras_temp.json'] === 0 ? '<small class="text-muted">Tidak ada data</small>' : ''}
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="summary-stat">
                    <i class="fas fa-heartbeat text-primary"></i>
                    <div>
                        <h5>BPJS</h5>
                        <p>${countData['bpjs_temp.json']}</p>
                        ${countData['bpjs_temp.json'] === 0 ? '<small class="text-muted">Tidak ada data</small>' : ''}
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="summary-stat">
                    <i class="fas fa-qrcode text-warning"></i>
                    <div>
                        <h5>GWScanner Duplikat</h5>
                        <p>${duplicateCount}</p>
                        ${window.loadedData && window.loadedData['gwscanner_temp.json'] && window.loadedData['gwscanner_temp.json'].length === 0 ? '<small class="text-muted">Tidak ada data</small>' : ''}
                    </div>
                </div>
            </div>
        `;
        
        dynamicSummaryStats.innerHTML = statsHTML;
    }
    
    // Function untuk mengupdate dynamic summary
    function updateDynamicSummary(tabId) {
        // Cari info tab
        const tabInfo = getTabInfo(tabId);
        
        // Jika tab tidak didukung, sembunyikan dynamic summary
        if (!tabInfo) {
            console.log(`Tab ${tabId} tidak didukung untuk dynamic summary`);
            // Sembunyikan card ringkasan
            document.getElementById('dynamic-summary-card').style.display = 'none';
            // Tampilkan kembali chart sebelumnya jika ada
            const oldChartContainer = document.getElementById('old-chart-container');
            if (oldChartContainer) {
                oldChartContainer.style.display = 'block';
            }
            return;
        }
        
        // Sembunyikan chart lama
        const oldChartContainer = document.getElementById('old-chart-container');
        if (oldChartContainer) {
            oldChartContainer.style.display = 'none';
        }
        
        // Tampilkan card ringkasan
        document.getElementById('dynamic-summary-card').style.display = 'block';
        
        // Update judul
        dynamicSummaryTitle.innerHTML = `<i class="${tabInfo.icon} mr-2"></i> ${tabInfo.title}`;
        
        // Periksa apakah ada cache yang valid
        const useCache = window.dataCache && 
                       window.dataCache.timestamp && 
                       (Date.now() - window.dataCache.timestamp) < (window.dataCache.expiresIn || 600000); // Default 10 menit
        
        // Periksa apakah data ringkasan sudah dimuat
        if (!window.dataSummaryLoaded || !useCache) {
            // Tampilkan indikator loading
            dynamicSummaryStats.innerHTML = '<div class="col-12 text-center"><i class="fas fa-spinner fa-spin"></i> Memuat ringkasan data...</div>';
            
            // Muat hanya ringkasan data
            loadSummaryData().then(() => {
                updateChart(window.loadedData, tabInfo.fieldForChart, tabInfo.chartTitle, currentChartType);
                updateStats(window.loadedData, tabInfo);
                
                // Trigger loading tab data untuk tab yang aktif
                loadTabData(tabId).catch(error => {
                    console.error("Gagal memuat data tab:", error);
                });
            }).catch(error => {
                console.error("Gagal memuat ringkasan data:", error);
                dynamicSummaryStats.innerHTML = `
                    <div class="col-12 text-center text-danger">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        Gagal memuat ringkasan data: ${error.message}
                        <div class="mt-2">
                            <button class="btn btn-sm btn-outline-danger" onclick="location.reload()">
                                <i class="fas fa-sync-alt me-1"></i>Refresh Halaman
                            </button>
                        </div>
                    </div>
                `;
            });
        } else {
            // Data ringkasan sudah tersedia, update langsung
            updateChart(window.loadedData, tabInfo.fieldForChart, tabInfo.chartTitle, currentChartType);
            updateStats(window.loadedData, tabInfo);
            
            // Trigger loading tab data untuk tab yang aktif jika belum dimuat
            const isTabLoaded = window.dataCache && 
                              window.dataCache.loadedTables && 
                              window.dataCache.loadedTables[tabId];
                              
            if (!isTabLoaded) {
                loadTabData(tabId).catch(error => {
                    console.error("Gagal memuat data tab:", error);
                });
            }
        }
        
        // Simpan tab aktif
        currentTabId = tabId;
        
        // Simpan tab aktif ke local storage
        localStorage.setItem('activeTab', tabId);
    }
    
    // Function untuk memuat ringkasan data
    function loadSummaryData() {
        console.log("Pemeriksaan data summary sebelum load...");
        
        // Jika sudah dimuat, gunakan saja
        if (window.dataSummaryLoaded && window.loadedData) {
            console.log("Data summary sudah dimuat sebelumnya, menggunakan cache");
            return Promise.resolve(window.loadedData);
        }
        
        // Coba load summary data jika fungsi tersedia
        if (typeof window.loadDataSummaryOnly === 'function') {
            console.log("Memanggil window.loadDataSummaryOnly()");
            return window.loadDataSummaryOnly()
                .then(() => {
                    window.dataSummaryLoaded = true;
                    return window.loadedData;
                })
                .catch(error => {
                    // Handle known errors dari mekanisme debouncing
                    if (error.message === "Request already in progress" || 
                        error.message === "Request too frequent") {
                        console.log(`loadSummaryData: ${error.message}, retrying later...`);
                        
                        // Return existing data jika sudah ada
                        if (window.loadedData) {
                            return window.loadedData;
                        }
                        
                        // Jika belum ada data, tunggu sebentar dan coba lagi
                        return new Promise(resolve => {
                            setTimeout(() => {
                                if (window.loadedData) {
                                    resolve(window.loadedData);
                                } else {
                                    resolve({});
                                }
                            }, 2000);
                        });
                    }
                    
                    // Re-throw error lainnya
                    throw error;
                });
        } else {
            // Fallback jika fungsi tidak tersedia
            console.error('Fungsi loadDataSummaryOnly tidak tersedia. Pastikan init.js dimuat dengan benar.');
            
            // Buat fungsi lokal sebagai fallback
            return new Promise((resolve, reject) => {
                console.log("Menggunakan fallback untuk memuat data summary...");
                
                const files = [
                    'tunjangan_beras_temp.json',
                    'bpjs_temp.json',
                    'gwscanner_temp.json',
                    'ffbworker_temp.json',
                    'gwscanner_overtime_not_sync_temp.json'
                ];
                
                // Inisialisasi atau gunakan loadedData yang ada
                window.loadedData = window.loadedData || {};
                
                // Coba muat data dari server
                Promise.allSettled(files.map(file => {
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
                        
                        // Simpan data ke loadedData
                        window.loadedData[file] = data;
                        console.log(`Berhasil memuat data fallback dari ${file}: ${data.length} records`);
                        return { file, count: data.length };
                    });
                }))
                .then(() => {
                    console.log("Ringkasan data selesai dimuat (fallback)");
                    window.dataSummaryLoaded = true;
                    
                    // Trigger event dataSummaryLoaded
                    document.dispatchEvent(new CustomEvent('dataSummaryLoaded', { 
                        detail: { loadedData: window.loadedData } 
                    }));
                    
                    resolve(window.loadedData);
                })
                .catch(error => {
                    console.error("Gagal memuat data summary menggunakan fallback:", error);
                    reject(error);
                });
            });
        }
    }
    
    // Function untuk memuat data tab
    function loadTabData(tabId) {
        // Jika fungsi untuk memuat data tab tersedia, gunakan
        if (typeof window.loadAndDisplayActiveTabData === 'function') {
            return window.loadAndDisplayActiveTabData(tabId);
        } else {
            // Fallback - jika fungsi tidak tersedia, gunakan fungsi lama
            console.warn('Fungsi loadAndDisplayActiveTabData tidak tersedia, menggunakan fallback');
            
            // Cari info tab
            const tabInfo = getTabInfo(tabId);
            if (!tabInfo) return Promise.reject(new Error('Tab info tidak ditemukan'));
            
            // Siapkan container
            prepareContainer(tabInfo);
            
            // Load data via fetch jika tidak tersedia
            return new Promise((resolve, reject) => {
                const filename = tabInfo.filename;
                
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
                    } else if (!Array.isArray(data)) {
                        data = [];
                    }
                    
                    // Simpan data ke loadedData
                    if (!window.loadedData) window.loadedData = {};
                    window.loadedData[filename] = data;
                    
                    // Tampilkan data
                    displayData(data, tabInfo);
                    
                    resolve(data);
                })
                .catch(error => {
                    console.error(`Error saat memuat data untuk tab ${tabId}:`, error);
                    const container = document.getElementById(tabInfo.targetId);
                    if (container) {
                        container.innerHTML = `
                            <div class="alert alert-danger">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                <strong>Error:</strong> Gagal memuat data. ${error.message}
                            </div>
                        `;
                    }
                    reject(error);
                });
            });
        }
    }
    
    // Fungsi untuk persiapan container
    function prepareContainer(tabInfo) {
        // Siapkan container untuk data
        const container = document.getElementById(tabInfo.targetId);
        
        // Jika container tidak ada, buat pesan error
        if (!container) {
            console.error(`Container dengan ID ${tabInfo.targetId} tidak ditemukan`);
            return;
        }
        
        // Pastikan container memiliki attribut data-container
        container.setAttribute('data-container', tabInfo.targetId);
        
        // Periksa apakah container sudah memiliki elemen table
        if (!container.querySelector('table')) {
            console.log(`Membuat elemen table untuk ${tabInfo.targetId}`);
            container.innerHTML = `
                <div class="loading-container">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Memuat data...</p>
                </div>
                <div class="data-container" style="display: none;"></div>
            `;
        }
    }
    
    // Fungsi helper untuk menghitung duplikat di data GWScanner
    function countDuplicatesInGWScanner(data) {
        if (!data || !Array.isArray(data)) return 0;
        
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
    
    // Function untuk mengaktifkan event listeners pada tab
    function setupTabListeners() {
        // Aktifkan event listener untuk semua tab
        supportedTabs.forEach(tabInfo => {
            const tabElement = document.getElementById(tabInfo.id);
            if (tabElement) {
                tabElement.addEventListener('click', function(e) {
                    // Ambil tab ID
                    const tabId = this.id;
                    
                    // Update dynamic summary
                    updateDynamicSummary(tabId);
                });
            }
        });
        
        // Event listener untuk tombol switch chart
        if (dynamicChartBar) {
            dynamicChartBar.addEventListener('click', function() {
                currentChartType = 'bar';
                
                // Tambahkan class active pada tombol
                dynamicChartBar.classList.add('active');
                dynamicChartPie.classList.remove('active');
                
                // Update chart
                if (currentTabId) {
                    const tabInfo = getTabInfo(currentTabId);
                    if (tabInfo) {
                        updateChart(window.loadedData, tabInfo.fieldForChart, tabInfo.chartTitle, currentChartType);
                    }
                }
            });
        }
        
        if (dynamicChartPie) {
            dynamicChartPie.addEventListener('click', function() {
                currentChartType = 'pie';
                
                // Tambahkan class active pada tombol
                dynamicChartPie.classList.add('active');
                dynamicChartBar.classList.remove('active');
                
                // Update chart
                if (currentTabId) {
                    const tabInfo = getTabInfo(currentTabId);
                    if (tabInfo) {
                        updateChart(window.loadedData, tabInfo.fieldForChart, tabInfo.chartTitle, currentChartType);
                    }
                }
            });
        }
        
        // Listener untuk event dataSummaryLoaded
        document.addEventListener('dataSummaryLoaded', function(event) {
            console.log('Event dataSummaryLoaded ditangkap, memperbarui chart dan stats');
            
            if (currentTabId) {
                const tabInfo = getTabInfo(currentTabId);
                if (tabInfo) {
                    updateChart(window.loadedData, tabInfo.fieldForChart, tabInfo.chartTitle, currentChartType);
                    updateStats(window.loadedData, tabInfo);
                }
            }
        });
    }
    
    // Function untuk inisialisasi
    function init() {
        // Set chart type 'bar' sebagai default
        if (dynamicChartBar) dynamicChartBar.classList.add('active');
        
        // Setup event listeners
        setupTabListeners();
        
        // Cek tab aktif dari local storage atau gunakan default (tab pertama)
        const activeTab = localStorage.getItem('activeTab') || supportedTabs[0].id;
        
        // Buka tab yang aktif
        const activeTabElement = document.getElementById(activeTab);
        if (activeTabElement) {
            console.log(`Membuka tab ${activeTab} dari local storage`);
            
            // Aktifkan tab menggunakan Bootstrap tab API jika tersedia
            if (typeof bootstrap !== 'undefined' && bootstrap.Tab) {
                const tabInstance = new bootstrap.Tab(activeTabElement);
                tabInstance.show();
            } else if (typeof $ !== 'undefined') {
                // Fallback untuk jQuery jika tersedia
                $(activeTabElement).tab('show');
            }
            
            // Update dynamic summary
            setTimeout(() => {
                updateDynamicSummary(activeTab);
            }, 300);
        } else {
            console.log('Tab dari local storage tidak ditemukan, menggunakan default tab');
            
            // Gunakan tab pertama
            const firstTabElement = document.getElementById(supportedTabs[0].id);
            if (firstTabElement) {
                if (typeof bootstrap !== 'undefined' && bootstrap.Tab) {
                    const tabInstance = new bootstrap.Tab(firstTabElement);
                    tabInstance.show();
                } else if (typeof $ !== 'undefined') {
                    $(firstTabElement).tab('show');
                }
                
                // Update dynamic summary
                setTimeout(() => {
                    updateDynamicSummary(supportedTabs[0].id);
                }, 300);
            }
        }
    }
    
    // Helper function untuk display data (fallback)
    function displayData(data, tabInfo) {
        const container = document.getElementById(tabInfo.targetId);
        if (!container) return;
        
        // Jika tidak ada data
        if (!data || !Array.isArray(data) || data.length === 0) {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-info-circle me-2"></i>
                    <strong>Tidak ada data</strong> - Data ${tabInfo.title.replace('Ringkasan Data ', '')} tidak tersedia atau kosong.
                </div>
            `;
            return;
        }
        
        // Format judul kolom
        function formatColumnTitle(key) {
            return key
                .replace(/([A-Z])/g, ' $1') // Insert space before capital letters
                .replace(/_/g, ' ') // Replace underscores with spaces
                .replace(/^./, str => str.toUpperCase()); // Capitalize first letter
        }
        
        // Persiapkan tabel
        let tableHTML = `
            <div class="table-responsive">
                <table id="${tabInfo.id.replace('-tab', '-table')}" class="table table-striped table-bordered" style="width:100%">
                    <thead>
                        <tr>
        `;
        
        // Tambahkan header
        Object.keys(data[0]).forEach(key => {
            tableHTML += `<th>${formatColumnTitle(key)}</th>`;
        });
        
        tableHTML += `
                        </tr>
                    </thead>
                </table>
            </div>
        `;
        
        container.innerHTML = tableHTML;
        
        // Inisialisasi DataTable jika tersedia
        if (typeof $ !== 'undefined' && $.fn.DataTable) {
            try {
                $(`#${tabInfo.id.replace('-tab', '-table')}`).DataTable({
                    data: data,
                    columns: Object.keys(data[0]).map(key => {
                        return {
                            data: key,
                            title: formatColumnTitle(key)
                        };
                    }),
                    processing: true,
                    deferRender: true,
                    scroller: true,
                    scrollY: '50vh',
                    paging: true,
                    pageLength: 25,
                    dom: 'Bfrtip',
                    buttons: [
                        'copy', 'excel', 'pdf', 'print'
                    ],
                    language: {
                        "emptyTable": "Tidak ada data yang tersedia",
                        "info": "Menampilkan _START_ sampai _END_ dari _TOTAL_ entri",
                        "search": "Cari:",
                        "paginate": {
                            "first": "Pertama",
                            "last": "Terakhir",
                            "next": "Selanjutnya",
                            "previous": "Sebelumnya"
                        }
                    }
                });
            } catch (error) {
                console.error(`Error saat inisialisasi DataTable:`, error);
                container.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        <strong>Error:</strong> ${error.message}
                    </div>
                `;
            }
        } else {
            console.warn('DataTables tidak tersedia, menampilkan tabel statis');
            
            // Tambahkan data ke tabel secara manual (hanya 100 baris pertama)
            let tbodyHTML = '<tbody>';
            
            const maxRows = Math.min(data.length, 100);
            for (let i = 0; i < maxRows; i++) {
                tbodyHTML += '<tr>';
                Object.keys(data[0]).forEach(key => {
                    tbodyHTML += `<td>${data[i][key] || ''}</td>`;
                });
                tbodyHTML += '</tr>';
            }
            
            tbodyHTML += '</tbody>';
            
            // Sisipkan tbody ke table
            const table = container.querySelector('table');
            if (table) {
                table.innerHTML += tbodyHTML;
                
                if (data.length > 100) {
                    container.innerHTML += `
                        <div class="alert alert-info mt-3">
                            <i class="fas fa-info-circle me-2"></i>
                            Menampilkan 100 dari ${data.length} baris data.
                        </div>
                    `;
                }
            }
        }
    }
    
    // Init pada saat document ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}); 