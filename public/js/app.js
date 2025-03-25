/**
 * Aplikasi Monitoring Database
 * File utama yang menginisialisasi semua modul
 */

// Inisialisasi aplikasi saat dokumen siap
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing application...');
    
    // Inisialisasi modul notifikasi
    if (window.NotificationModule) {
        NotificationModule.init();
        console.log('Notification module initialized');
    }
    
    // Inisialisasi modul statistik
    if (window.StatsModule) {
        StatsModule.init();
        console.log('Stats module initialized');
    }
    
    // Inisialisasi modul GWScanner-Overtime
    if (window.GWScannerOvertimeModule) {
        GWScannerOvertimeModule.init();
        console.log('GWScanner-Overtime module initialized');
    }
    
    // Inisialisasi event listeners global
    initGlobalEventListeners();
    
    // Ambil konfigurasi interval dari server
    getConfiguredInterval();
    
    console.log('Application initialization completed');
});

/**
 * Inisialisasi event listeners global
 */
function initGlobalEventListeners() {
    // Event listener untuk tombol refresh semua data
    const refreshAllBtn = document.getElementById('refreshAllBtn');
    if (refreshAllBtn) {
        refreshAllBtn.addEventListener('click', function() {
            refreshAllData();
        });
    }
    
    // Event listener untuk tombol refresh
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            refreshAllData();
        });
    }
    
    // Event listener untuk perubahan interval di form konfigurasi
    const scheduleIntervalInput = document.getElementById('scheduleInterval');
    if (scheduleIntervalInput) {
        scheduleIntervalInput.addEventListener('change', function() {
            const newInterval = parseInt(this.value);
            if (!isNaN(newInterval) && newInterval > 0) {
                // Update interval di modul GWScanner-Overtime
                if (window.GWScannerOvertimeModule) {
                    GWScannerOvertimeModule.setInterval(newInterval);
                }
                
                // Update konfigurasi di server
                updateConfigInterval(newInterval);
                
                console.log(`Interval updated to ${newInterval} minutes`);
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
                const checkInterval = parseInt(config.interval.checkData);
                console.log(`Configured check interval: ${checkInterval} minutes`);
                
                // Set interval untuk refresh otomatis global
                setupAutoRefresh(checkInterval);
            }
        })
        .catch(error => {
            console.error('Error fetching configuration:', error);
        });
}

/**
 * Setup interval untuk refresh otomatis global
 */
let globalRefreshInterval = null;
function setupAutoRefresh(minutes) {
    // Default interval: 60 menit (1 jam)
    const intervalMinutes = minutes || 60;
    
    // Clear existing interval if any
    if (globalRefreshInterval) {
        clearInterval(globalRefreshInterval);
    }
    
    // Setup new interval (convert minutes to milliseconds)
    globalRefreshInterval = setInterval(function() {
        console.log(`Auto-refreshing all data (interval: ${intervalMinutes} minutes)`);
        refreshAllData();
    }, intervalMinutes * 60 * 1000);
    
    console.log(`Global auto-refresh set: every ${intervalMinutes} minutes`);
}

/**
 * Refresh semua data
 */
function refreshAllData() {
    // Tampilkan loading
    showLoading();
    
    // Panggil API untuk refresh semua data
    fetch('/api/refresh-data?type=all')
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                // Tampilkan notifikasi sukses
                createToast('success', 'Sukses', 'Semua data berhasil diperbarui');
                
                // Update waktu terakhir diperbarui
                updateLastUpdated(result.timestamp);
                
                // Update statistik
                if (window.StatsModule) {
                    StatsModule.updateAllStats();
                }
                
                // Refresh data GWScanner-Overtime
                if (window.GWScannerOvertimeModule) {
                    GWScannerOvertimeModule.refreshData();
                }
                
                // Sembunyikan loading
                hideLoading();
            } else {
                console.error('Error refreshing all data:', result.error || 'Unknown error');
                createToast('error', 'Error', 'Gagal memperbarui data');
                hideLoading();
            }
        })
        .catch(error => {
            console.error('Error refreshing all data:', error);
            createToast('error', 'Error', 'Gagal memperbarui data');
            hideLoading();
        });
}

/**
 * Update waktu terakhir diperbarui
 */
function updateLastUpdated(timestamp) {
    const lastUpdatedEl = document.getElementById('lastUpdated');
    if (lastUpdatedEl) {
        lastUpdatedEl.textContent = timestamp || new Date().toLocaleString('id-ID');
    }
    
    const lastCheckTimeEl = document.getElementById('lastCheckTime');
    if (lastCheckTimeEl) {
        lastCheckTimeEl.textContent = timestamp || new Date().toLocaleString('id-ID');
    }
    
    const lastCheckTimeFooterEl = document.getElementById('lastCheckTimeFooter');
    if (lastCheckTimeFooterEl) {
        lastCheckTimeFooterEl.textContent = timestamp || new Date().toLocaleString('id-ID');
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
 * Update konfigurasi interval di server
 */
function updateConfigInterval(minutes) {
    fetch('/api/config', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            interval: {
                checkData: minutes
            }
        })
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            createToast('success', 'Sukses', `Interval pembaruan data diubah menjadi ${minutes} menit`);
            
            // Reset interval global
            setupAutoRefresh(minutes);
        } else {
            console.error('Error updating configuration:', result.error || 'Unknown error');
            createToast('error', 'Error', 'Gagal memperbarui konfigurasi interval');
        }
    })
    .catch(error => {
        console.error('Error updating configuration:', error);
        createToast('error', 'Error', 'Gagal memperbarui konfigurasi interval');
    });
} 