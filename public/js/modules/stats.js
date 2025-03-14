/**
 * Modul Stats
 * Menangani semua operasi terkait statistik data
 */

const StatsModule = (function() {
    // Private variables
    let statsData = {
        tunjangan_beras: { total: 0, new: 0, error: 0 },
        bpjs: { total: 0, new: 0, error: 0 },
        gwscanner: { total: 0, new: 0, error: 0 },
        ffbworker: { total: 0, new: 0, error: 0 },
        gwscanner_overtime_not_sync: { total: 0, new: 0, error: 0 }
    };
    
    /**
     * Inisialisasi modul
     */
    function init() {
        // Inisialisasi event listeners
        initEventListeners();
        
        // Load data awal
        updateAllStats();
    }
    
    /**
     * Inisialisasi event listeners
     */
    function initEventListeners() {
        // Event listener untuk tab changes
        const tabs = document.querySelectorAll('#dataTypeTabs .nav-link');
        tabs.forEach(tab => {
            tab.addEventListener('shown.bs.tab', function(event) {
                const targetId = event.target.getAttribute('id');
                const dataType = targetId.replace('-tab', '');
                
                // Tampilkan stats yang sesuai
                showStatsForType(dataType);
            });
        });
    }
    
    /**
     * Update semua statistik
     */
    function updateAllStats() {
        fetch('/api/data')
            .then(response => response.json())
            .then(result => {
                if (result.success && result.data) {
                    // Update stats data
                    updateStatsData(result.data);
                    
                    // Update tampilan stats
                    updateStatsDisplay();
                    
                    // Tampilkan stats yang sesuai dengan tab aktif
                    const activeTab = document.querySelector('#dataTypeTabs .nav-link.active');
                    if (activeTab) {
                        const dataType = activeTab.getAttribute('id').replace('-tab', '');
                        showStatsForType(dataType);
                    }
                }
            })
            .catch(error => {
                console.error('Error fetching stats data:', error);
            });
    }
    
    /**
     * Update data statistik
     */
    function updateStatsData(data) {
        // Tunjangan Beras
        if (data.tunjangan_beras) {
            statsData.tunjangan_beras.total = data.tunjangan_beras.length;
            statsData.tunjangan_beras.error = data.tunjangan_beras.filter(item => 
                item.Perbandingan_RiceRation === 'Beda' || 
                item.Status_Validasi1 === 'Salah' || 
                item.Status_Validasi2 === 'Salah' || 
                item.Status_Validasi3 === 'Salah'
            ).length;
        }
        
        // BPJS
        if (data.bpjs) {
            statsData.bpjs.total = data.bpjs.length;
            statsData.bpjs.error = data.bpjs.filter(item => 
                item.StatusKeseluruhan === 'Tidak Lengkap'
            ).length;
        }
        
        // GWScanner
        if (data.gwscanner) {
            statsData.gwscanner.total = data.gwscanner.length;
            statsData.gwscanner.error = data.gwscanner.filter(item => 
                item.ItechUpdateStatus === 'Duplicate'
            ).length;
        }
        
        // FFB Worker
        if (data.ffbworker) {
            statsData.ffbworker.total = data.ffbworker.length;
            statsData.ffbworker.error = data.ffbworker.filter(item => 
                item.Status_Karyawan !== 'Pemanen'
            ).length;
        }
        
        // GWScanner-Overtime Not Sync
        if (data.gwscanner_overtime_not_sync) {
            statsData.gwscanner_overtime_not_sync.total = data.gwscanner_overtime_not_sync.length;
            statsData.gwscanner_overtime_not_sync.error = data.gwscanner_overtime_not_sync.filter(item => 
                item.Status && item.Status.includes('tidak sinkron')
            ).length;
        }
    }
    
    /**
     * Update tampilan statistik
     */
    function updateStatsDisplay() {
        // Update elemen DOM untuk setiap jenis data
        updateStatsDisplayForType('tunjangan');
        updateStatsDisplayForType('bpjs');
        updateStatsDisplayForType('gwscanner');
        updateStatsDisplayForType('ffbworker');
        updateStatsDisplayForType('gwscanner-overtime');
    }
    
    /**
     * Update tampilan statistik untuk tipe tertentu
     */
    function updateStatsDisplayForType(type) {
        const dataType = type.replace('-', '_');
        const stats = statsData[dataType] || { total: 0, new: 0, error: 0 };
        
        // Update elemen total
        const totalEl = document.getElementById(`total${capitalizeFirstLetter(type)}Data`);
        if (totalEl) totalEl.textContent = stats.total;
        
        // Update elemen new
        const newEl = document.getElementById(`new${capitalizeFirstLetter(type)}Data`);
        if (newEl) newEl.textContent = stats.new;
        
        // Update elemen error
        const errorEl = document.getElementById(`error${capitalizeFirstLetter(type)}Data`);
        if (errorEl) errorEl.textContent = stats.error;
    }
    
    /**
     * Tampilkan statistik untuk tipe tertentu
     */
    function showStatsForType(type) {
        // Sembunyikan semua stats
        const allStats = document.querySelectorAll('[id$="-stats"]');
        allStats.forEach(el => {
            el.style.display = 'none';
        });
        
        // Tampilkan stats yang sesuai
        const statsEl = document.getElementById(`${type}-stats`);
        if (statsEl) {
            statsEl.style.display = 'flex';
        }
    }
    
    /**
     * Kapitalisasi huruf pertama
     */
    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    
    // Public API
    return {
        init: init,
        updateAllStats: updateAllStats
    };
})();

// Export modul
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StatsModule;
} else {
    window.StatsModule = StatsModule;
} 