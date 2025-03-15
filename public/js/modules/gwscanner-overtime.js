/**
 * Modul GWScanner-Overtime
 * Menangani semua operasi terkait data sinkronisasi GWScanner dan Overtime
 */

const GWScannerOvertimeModule = (function() {
    // Private variables
    let dataTable = null;
    let data = [];
    let refreshInterval = null;
    let configuredInterval = 60; // Default 60 menit (1 jam)
    
    // DOM elements
    const tableId = 'gwscannerOvertimeTable';
    const updateBtnId = 'updateGwscannerOvertimeBtn';
    const refreshBtnId = 'refreshBtn';
    const refreshAllBtnId = 'refreshAllBtn';
    
    /**
     * Inisialisasi modul
     */
    function init() {
        console.log('Initializing GWScanner-Overtime module...');
        
        // Inisialisasi event listeners
        initEventListeners();
        
        // Load data awal
        loadData();
        
        // Ambil konfigurasi interval dari server
        getConfiguredInterval();
        
        // Setup interval refresh
        setupAutoRefresh();
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
        
        // Event listener untuk tombol refresh global
        const refreshBtn = document.getElementById(refreshBtnId);
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function() {
                refreshData();
            });
        }
        
        // Event listener untuk tombol refresh all
        const refreshAllBtn = document.getElementById(refreshAllBtnId);
        if (refreshAllBtn) {
            refreshAllBtn.addEventListener('click', function() {
                refreshData();
            });
        }
        
        // Event listener untuk tab
        const tab = document.getElementById('gwscanner-overtime-tab');
        if (tab) {
            tab.addEventListener('shown.bs.tab', function() {
                if (dataTable) {
                    dataTable.columns.adjust().draw();
                }
                
                // Tampilkan stats yang sesuai
                const statsEl = document.getElementById('gwscanner-overtime-stats');
                if (statsEl) {
                    // Sembunyikan semua stats
                    const allStats = document.querySelectorAll('[id$="-stats"]');
                    allStats.forEach(el => {
                        el.style.display = 'none';
                    });
                    
                    // Tampilkan stats GWScanner-Overtime
                    statsEl.style.display = 'flex';
                }
            });
        }
    }
    
    /**
     * Ambil konfigurasi interval dari server
     */
    function getConfiguredInterval() {
        fetch('/api/config')
            .then(response => response.json())
            .then(config => {
                if (config && config.interval && config.interval.checkData) {
                    // Konversi dari menit ke milidetik
                    configuredInterval = parseInt(config.interval.checkData) * 60;
                    console.log(`Configured interval for GWScanner-Overtime: ${configuredInterval} minutes`);
                    
                    // Reset interval dengan nilai baru
                    setupAutoRefresh();
                }
            })
            .catch(error => {
                console.error('Error fetching configuration:', error);
            });
    }
    
    /**
     * Setup interval untuk refresh otomatis
     */
    function setupAutoRefresh() {
        // Clear existing interval if any
        if (refreshInterval) {
            clearInterval(refreshInterval);
        }
        
        // Setup new interval (convert minutes to milliseconds)
        refreshInterval = setInterval(function() {
            console.log(`Auto-refreshing GWScanner-Overtime data (interval: ${configuredInterval} minutes)`);
            refreshData();
        }, configuredInterval * 60 * 1000);
        
        console.log(`Auto-refresh set for GWScanner-Overtime: every ${configuredInterval} minutes`);
    }
    
    /**
     * Load data dari server
     */
    function loadData() {
        showLoading();
        
        fetch('/api/data')
            .then(response => response.json())
            .then(result => {
                if (result.success && result.data && result.data.gwscanner_overtime_not_sync) {
                    data = result.data.gwscanner_overtime_not_sync;
                    initDataTable();
                    hideLoading();
                    console.log(`Loaded ${data.length} GWScanner-Overtime records that are not synced`);
                } else {
                    console.error('Error loading GWScanner-Overtime data:', result.error || 'Unknown error');
                    showNotification('error', 'Error', 'Gagal memuat data GWScanner-Overtime yang tidak sinkron');
                    hideLoading();
                }
            })
            .catch(error => {
                console.error('Error fetching GWScanner-Overtime data:', error);
                showNotification('error', 'Error', 'Gagal memuat data GWScanner-Overtime yang tidak sinkron');
                hideLoading();
            });
    }
    
    /**
     * Refresh data dari server
     */
    function refreshData() {
        showLoading();
        
        fetch('/api/refresh-data?type=gwscanner_overtime_not_sync')
            .then(response => response.json())
            .then(result => {
                if (result.success) {
                    showNotification('success', 'Sukses', `Data GWScanner-Overtime yang tidak sinkron berhasil diperbarui. ${result.recordCount} record ditemukan.`);
                    loadData();
                    
                    // Update waktu terakhir diperbarui
                    updateLastRefreshTime();
                } else {
                    console.error('Error refreshing GWScanner-Overtime data:', result.error || 'Unknown error');
                    showNotification('error', 'Error', 'Gagal memperbarui data GWScanner-Overtime yang tidak sinkron');
                    hideLoading();
                }
            })
            .catch(error => {
                console.error('Error refreshing GWScanner-Overtime data:', error);
                showNotification('error', 'Error', 'Gagal memperbarui data GWScanner-Overtime yang tidak sinkron');
                hideLoading();
            });
    }
    
    /**
     * Inisialisasi DataTable
     */
    function initDataTable() {
        const table = document.getElementById(tableId);
        if (!table) {
            console.error('Table element not found:', tableId);
            return;
        }
        
        // Destroy existing DataTable instance if exists
        if (dataTable) {
            dataTable.destroy();
        }
        
        // Clear table body
        const tbody = table.querySelector('tbody');
        tbody.innerHTML = '';
        
        // Populate table with data
        data.forEach(item => {
            const row = document.createElement('tr');
            
            // Add status class based on status
            if (item.Status_GWScanner !== 'OK' || item.Status_Overtime !== 'OK') {
                row.classList.add('error-row');
            } else if (item.RecordTag_GWScanner && !['GJ', 'GV', 'GZ'].includes(item.RecordTag_GWScanner)) {
                row.classList.add('warning-row');
            }
            
            // Add cells
            row.innerHTML = `
                <td>${item.Status_GWScanner || ''}</td>
                <td>${item.Status_Overtime || ''}</td>
                <td>${item.EmpCode || ''}</td>
                <td>${item.EmpName || ''}</td>
                <td>${formatDate(item.TanggalTransaksi) || ''}</td>
                <td>${item.RecordTag_GWScanner || ''}</td>
                <td>${item.RecordTag_Overtime || ''}</td>
                <td>${item.TransNo_GWScanner || ''}</td>
                <td>${item.TransNo_Overtime || ''}</td>
                <td>${item.FromCode_GWScanner || ''}</td>
            `;
            
            tbody.appendChild(row);
        });
        
        // Initialize DataTable
        dataTable = $(table).DataTable({
            responsive: true,
            dom: 'Bfrtip',
            buttons: [
                'copy', 'excel', 'pdf', 'print', 'colvis'
            ],
            pageLength: 10,
            lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, "Semua"]],
            language: {
                url: '//cdn.datatables.net/plug-ins/1.13.7/i18n/id.json'
            }
        });
        
        // Update stats
        updateStats();
    }
    
    /**
     * Update statistik data
     */
    function updateStats() {
        // Hitung jumlah data berdasarkan status
        const totalData = data.length;
        const errorData = data.filter(item => item.Status_GWScanner !== 'OK' || item.Status_Overtime !== 'OK').length;
        const warningData = data.filter(item => item.RecordTag_GWScanner && !['GJ', 'GV', 'GZ'].includes(item.RecordTag_GWScanner)).length;
        
        // Update elemen DOM jika ada
        const totalDataEl = document.getElementById('totalGwscannerOvertimeData');
        const errorDataEl = document.getElementById('errorGwscannerOvertimeData');
        const actionNeededEl = document.getElementById('actionNeededGwscannerOvertimeData');
        const lastUpdatedEl = document.getElementById('lastUpdatedGwscannerOvertime');
        
        if (totalDataEl) totalDataEl.textContent = totalData;
        if (errorDataEl) errorDataEl.textContent = errorData;
        if (actionNeededEl) actionNeededEl.textContent = warningData;
        
        // Update waktu terakhir diperbarui
        updateLastRefreshTime();
    }
    
    /**
     * Update waktu terakhir diperbarui
     */
    function updateLastRefreshTime() {
        const lastUpdatedEl = document.getElementById('lastUpdatedGwscannerOvertime');
        if (lastUpdatedEl) {
            const now = new Date();
            lastUpdatedEl.textContent = now.toLocaleString('id-ID', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }
        
        // Update juga waktu terakhir global jika ada
        const lastUpdatedGlobal = document.getElementById('lastUpdated');
        if (lastUpdatedGlobal) {
            const now = new Date();
            lastUpdatedGlobal.textContent = now.toLocaleString('id-ID', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }
        
        // Update waktu terakhir check di footer
        const lastCheckTimeFooter = document.getElementById('lastCheckTimeFooter');
        if (lastCheckTimeFooter) {
            const now = new Date();
            lastCheckTimeFooter.textContent = now.toLocaleString('id-ID', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        }
    }
    
    /**
     * Format tanggal untuk tampilan
     */
    function formatDate(dateString) {
        if (!dateString) return '';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleString('id-ID', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch (error) {
            return dateString;
        }
    }
    
    /**
     * Tampilkan loading overlay
     */
    function showLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }
    }
    
    /**
     * Sembunyikan loading overlay
     */
    function hideLoading() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }
    
    /**
     * Tampilkan notifikasi
     */
    function showNotification(type, title, message) {
        if (typeof createToast === 'function') {
            createToast(type, title, message);
        } else {
            alert(`${title}: ${message}`);
        }
    }
    
    // Public API
    return {
        init: init,
        refreshData: refreshData,
        setInterval: function(minutes) {
            configuredInterval = minutes;
            setupAutoRefresh();
        }
    };
})();

// Export modul
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GWScannerOvertimeModule;
} else {
    window.GWScannerOvertimeModule = GWScannerOvertimeModule;
} 