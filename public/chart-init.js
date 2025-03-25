// File ini berisi fungsi untuk menginisialisasi Chart.js dan grafik timeline

// Fungsi untuk memuat Chart.js dan dependensinya
function loadChartJS(callback) {
    console.log('Loading Chart.js dynamically...');

    // Cek apakah Chart.js sudah dimuat
    if (typeof Chart !== 'undefined') {
        console.log('Chart.js already loaded');
        if (callback) callback();
        return;
    }

    // Muat Chart.js
    const chartScript = document.createElement('script');
    chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    chartScript.onload = function() {
        console.log('Chart.js loaded successfully');

        // Muat adapter date-fns untuk Chart.js
        const timeChartScript = document.createElement('script');
        timeChartScript.src = 'https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns';
        timeChartScript.onload = function() {
            console.log('Chart.js date adapter loaded successfully');
            if (callback) callback();
        };
        document.head.appendChild(timeChartScript);
    };
    document.head.appendChild(chartScript);
}

// Fungsi untuk menginisialisasi grafik
function initializeCharts() {
    try {
        if (typeof updateDataChart === 'function') {
            updateDataChart();
        }

        if (typeof loadHistoryDataAndUpdateTimeline === 'function') {
            loadHistoryDataAndUpdateTimeline();
        }
    } catch (e) {
        console.error('Error initializing charts:', e);
        if (typeof showToast === 'function') {
            showToast('Error', 'Gagal menginisialisasi grafik: ' + e.message, 'danger');
        }

        // Coba lagi setelah 3 detik
        setTimeout(initializeCharts, 3000);
    }
}

// Ekspor fungsi ke window
window.loadChartJS = loadChartJS;
window.initializeCharts = initializeCharts;