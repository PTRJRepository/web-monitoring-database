/**
 * Aplikasi Monitoring Database
 * File utama yang menginisialisasi semua modul
 */

// Variabel global untuk tracking status preloading
window.dataPreloaded = false;

// Variabel global untuk mencegah loading berulang
let preloadDataCompleted = false;
let preloadInProgress = false;
const MAX_PRELOAD_ATTEMPTS = 2;
let preloadAttempts = 0;

// Jalankan saat dokumen dimuat
document.addEventListener("DOMContentLoaded", function() {
    console.log("app.js: DOMContentLoaded - Initializing features");
    
    // Setup toast notification system
    setupToastSystem();
    
    // Setup refresh handler
    setupRefreshHandler();
    
    // Preload data saat halaman pertama kali dibuka
    preloadData();
    
    // Setup auto refresh data dengan jitter
    setupAutoRefreshData();
    
    console.log("Application initialization completed");
});

// Jalankan saat window dimuat
window.addEventListener("load", function() {
    console.log("app.js: Window loaded event");
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

/**
 * Setup auto refresh data dengan jitter
 */
function setupAutoRefreshData() {
    // Default refresh interval: 5 menit
    const defaultInterval = 5;
    // Jitter: random between 0-60 seconds to prevent all clients refreshing at exactly the same time
    const jitterRange = 60 * 1000;
    
    let isRefreshing = false;
    
    function scheduleNextRefresh() {
        const intervalMs = defaultInterval * 60 * 1000;
        const jitter = Math.floor(Math.random() * jitterRange);
        const totalInterval = intervalMs + jitter;
        
        console.log(`Scheduling next auto-refresh in ${Math.round(totalInterval/1000)} seconds (${defaultInterval} minutes + ${Math.round(jitter/1000)}s jitter)`);
        
        setTimeout(performRefresh, totalInterval);
    }
    
    function performRefresh() {
        // Skip if already refreshing or page not active
        if (isRefreshing || document.hidden) {
            console.log("Skipping auto-refresh: " + (isRefreshing ? "refresh in progress" : "page not active"));
            scheduleNextRefresh();
            return;
        }
        
        // Skip refresh if cached data is still valid
        if (window.dataCache && 
            window.dataCache.timestamp && 
            (Date.now() - window.dataCache.timestamp) < window.dataCache.expiresIn) {
            
            console.log("Skipping auto-refresh: cached data still valid");
            scheduleNextRefresh();
            return;
        }
        
        console.log("Performing auto-refresh of data");
        isRefreshing = true;
        
        // Update UI to show loading state
        if (typeof updateDbStatusIndicator === 'function') {
            updateDbStatusIndicator('loading');
        }
        
        // Try the specific function if available
        if (typeof window.loadDataSummaryOnly === 'function') {
            window.loadDataSummaryOnly()
                .then(function() {
                    console.log("Auto-refresh completed successfully");
                    updateLastUpdated();
                    
                    // Update UI to show connection status
                    if (typeof updateDbStatusIndicator === 'function') {
                        updateDbStatusIndicator('connected');
                    }
                })
                .catch(function(error) {
                    console.error("Error during auto-refresh:", error);
                    
                    // Update UI to show there was an error
                    if (typeof updateDbStatusIndicator === 'function') {
                        updateDbStatusIndicator('disconnected');
                    }
                })
                .finally(function() {
                    isRefreshing = false;
                    scheduleNextRefresh();
                });
        } else {
            console.warn("No suitable function found for auto-refresh");
            isRefreshing = false;
            scheduleNextRefresh();
        }
    }
    
    // Start the first refresh cycle
    scheduleNextRefresh();
    
    // Also refresh when tab becomes visible
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden && !isRefreshing) {
            console.log("Tab became visible, checking if refresh needed");
            
            // Check if cache is expired when tab becomes visible
            if (window.dataCache && 
                window.dataCache.timestamp && 
                (Date.now() - window.dataCache.timestamp) >= window.dataCache.expiresIn) {
                
                console.log("Cache expired, performing refresh on tab visibility change");
                performRefresh();
            }
        }
    });
}

/**
 * Preload data saat halaman pertama kali dibuka
 */
function preloadData() {
    // Cek jika sudah berhasil preload atau jika masih dalam proses
    if (preloadDataCompleted) {
        console.log("Data sudah di-preload sebelumnya, tidak perlu preload ulang");
        return Promise.resolve();
    }
    
    // Cek jika sudah mencapai batas percobaan
    if (preloadAttempts >= MAX_PRELOAD_ATTEMPTS) {
        console.log(`Sudah mencoba preload ${MAX_PRELOAD_ATTEMPTS} kali, tidak mencoba lagi`);
        return Promise.resolve();
    }
    
    // Tambah counter preload
    preloadAttempts++;
    
    // Cek jika sudah ada proses preload yang berjalan
    if (preloadInProgress) {
        console.log("Preload data sedang berlangsung, tidak perlu memulai preload baru");
        return Promise.resolve();
    }
    
    // Set flag preload sedang berjalan
    preloadInProgress = true;
    
    console.log("Preloading data...");
    
    // Cek dulu apakah data cache masih valid
    if (window.dataCache && window.dataCache.timestamp) {
        const now = Date.now();
        const cacheAge = now - window.dataCache.timestamp;
        
        if (cacheAge < window.dataCache.expiresIn) {
            console.log("Using valid cached data for preload");
            preloadDataCompleted = true;
            preloadInProgress = false;
            return Promise.resolve();
        }
    }
    
    // Tentukan pendekatan preload
    let loadFunction = null;
    if (typeof window.loadDataSummaryOnly === 'function') {
        loadFunction = window.loadDataSummaryOnly;
    } else if (typeof window.loadAndDisplayAllTempData === 'function') {
        loadFunction = window.loadAndDisplayAllTempData;
    } else {
        console.error("Tidak ada fungsi untuk preload data");
        preloadInProgress = false;
        return Promise.reject(new Error("No preload function available"));
    }
    
    // Jalankan fungsi preload dan tangani hasilnya
    return loadFunction()
        .then(data => {
            console.log("Preload data sukses");
            preloadDataCompleted = true;
            document.dispatchEvent(new CustomEvent('preloadComplete', { detail: { success: true } }));
            return data;
        })
        .catch(error => {
            console.error("Error saat preload data:", error);
            document.dispatchEvent(new CustomEvent('preloadComplete', { detail: { success: false, error } }));
            throw error;
        })
        .finally(() => {
            preloadInProgress = false;
        });
}

// Function for setting up toast notifications
function setupToastSystem() {
    // Create toast container if it doesn't exist
    if (!document.querySelector('.toast-container')) {
        const toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        toastContainer.style.zIndex = '9999';
        document.body.appendChild(toastContainer);
    }
}

// Function for setting up refresh handler
function setupRefreshHandler() {
    // Auto-refresh every 5 minutes
    const refreshInterval = 5 * 60 * 1000; // 5 minutes in milliseconds
    console.log("Configured check interval:", refreshInterval / 60000, "minutes");
    
    // Setup refresh button
    const refreshButton = document.getElementById('refresh-button');
    if (refreshButton) {
        refreshButton.addEventListener('click', function() {
            refreshData();
        });
    }
    
    // Auto-refresh dengan jitter (acak antara 4.5 - 5.5 menit) untuk menghindari request bersamaan
    setTimeout(function scheduleRefresh() {
        console.log("Auto-refresh triggered");
        refreshData();
        
        // Tambahkan sedikit variasi pada interval berikutnya (±10%)
        const jitter = Math.random() * 0.2 - 0.1; // -10% sampai +10%
        const nextInterval = refreshInterval * (1 + jitter);
        console.log(`Next refresh in ${(nextInterval/60000).toFixed(1)} minutes`);
        
        setTimeout(scheduleRefresh, nextInterval);
    }, refreshInterval);
    
    console.log("Global auto-refresh set: approximately every", refreshInterval / 60000, "minutes");
}

// Function for refreshing data
function refreshData() {
    // Jika sedang dalam proses loading, skip refresh
    if (document.getElementById('light-loading-indicator') || 
        (document.getElementById('loadingOverlay') && 
         document.getElementById('loadingOverlay').style.display === 'flex')) {
        console.log("Skipping refresh: already loading data");
        showToast("Sedang memuat data, refresh diabaikan", "info");
        return;
    }
    
    const lastCheckElem = document.getElementById('lastCheckTime');
    if (lastCheckElem) {
        lastCheckElem.textContent = new Date().toLocaleString('id-ID');
    }
    
    // Trigger reload if LoadAndDisplayAllTempData exists
    if (typeof window.loadAndDisplayAllTempData === 'function') {
        // Tampilkan indikator loading ringan
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'refresh-indicator';
        loadingIndicator.innerHTML = '<i class="fas fa-sync-alt fa-spin"></i> Refresh data...';
        loadingIndicator.style.position = 'fixed';
        loadingIndicator.style.bottom = '20px';
        loadingIndicator.style.right = '80px';
        loadingIndicator.style.background = 'rgba(25, 135, 84, 0.9)';
        loadingIndicator.style.color = 'white';
        loadingIndicator.style.padding = '8px 15px';
        loadingIndicator.style.borderRadius = '5px';
        loadingIndicator.style.zIndex = '9998';
        document.body.appendChild(loadingIndicator);
        
        window.loadAndDisplayAllTempData()
            .then(() => {
                console.log("Data refreshed successfully");
                // Hapus indikator loading
                if (document.getElementById('refresh-indicator')) {
                    document.getElementById('refresh-indicator').remove();
                }
                showToast("Data refreshed successfully", "success");
                window.dataPreloaded = true;
            })
            .catch(error => {
                console.error("Error refreshing data:", error);
                // Hapus indikator loading
                if (document.getElementById('refresh-indicator')) {
                    document.getElementById('refresh-indicator').remove();
                }
                showToast("Error refreshing data: " + error.message, "error");
            });
    } else {
        console.log("loadAndDisplayAllTempData function not found");
        showToast("Refresh function not found", "error");
    }
}

// Helper function to show a toast notification
function showToast(message, type = 'info') {
    const toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) return;
    
    const toastId = 'toast-' + Date.now();
    const toastHtml = `
        <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-header ${type === 'error' ? 'bg-danger text-white' : type === 'success' ? 'bg-success text-white' : 'bg-info text-white'}">
                <strong class="me-auto">${type === 'error' ? 'Error' : type === 'success' ? 'Success' : 'Info'}</strong>
                <small>${new Date().toLocaleTimeString()}</small>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, {
        autohide: true,
        delay: 5000
    });
    
    toast.show();
    
    // Remove toast after it's hidden
    toastElement.addEventListener('hidden.bs.toast', function() {
        toastElement.remove();
    });
} 