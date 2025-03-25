// File ini berisi fungsi untuk menangani grafik timeline

// Fungsi untuk update grafik timeline
function updateTimelineChart(historyData) {
    // Ambil range waktu yang dipilih
    const timeRange = $('#historyTimeRange').val();

    // Filter data berdasarkan range waktu
    let filteredData = {};
    const now = new Date();
    const timeRangeHours = timeRange === 'all' ? Number.MAX_SAFE_INTEGER : parseInt(timeRange);

    // Proses data untuk setiap jenis query
    for (let queryType in historyData) {
        filteredData[queryType] = historyData[queryType].filter(entry => {
            if (timeRange === 'all') return true;

            const entryDate = new Date(entry.timestamp);
            const hoursDiff = (now - entryDate) / (1000 * 60 * 60);
            return hoursDiff <= timeRangeHours;
        });
    }

    // Siapkan data untuk chart
    const datasets = [];
    const colors = {
        'tunjangan_beras': {
            borderColor: 'rgba(33, 150, 243, 1)',
            backgroundColor: 'rgba(33, 150, 243, 0.1)'
        },
        'bpjs': {
            borderColor: 'rgba(255, 167, 38, 1)',
            backgroundColor: 'rgba(255, 167, 38, 0.1)'
        },
        'gwscanner': {
            borderColor: 'rgba(239, 83, 80, 1)',
            backgroundColor: 'rgba(239, 83, 80, 0.1)'
        },
        'ffbworker': {
            borderColor: 'rgba(102, 187, 106, 1)',
            backgroundColor: 'rgba(102, 187, 106, 0.1)'
        }
    };

    const labels = {
        'tunjangan_beras': 'Tunjangan Beras',
        'bpjs': 'BPJS Belum Lengkap',
        'gwscanner': 'Duplikat GWScanner',
        'ffbworker': 'Non-Pemanen dengan Ripe'
    };

    // Buat dataset untuk setiap jenis query
    for (let queryType in filteredData) {
        if (filteredData[queryType].length === 0) continue;

        const data = filteredData[queryType].map(entry => ({
            x: new Date(entry.timestamp),
            y: entry.recordCount
        })).sort((a, b) => a.x - b.x);

        datasets.push({
            label: labels[queryType] || queryType,
            data: data,
            borderColor: colors[queryType]?.borderColor || 'rgba(100, 100, 100, 1)',
            backgroundColor: colors[queryType]?.backgroundColor || 'rgba(100, 100, 100, 0.1)',
            borderWidth: 2,
            pointRadius: 3,
            fill: true,
            tension: 0.2
        });
    }

    // Hancurkan grafik yang ada jika sudah ada
    try {
        if (window.timelineChart && typeof window.timelineChart.destroy === 'function') {
            window.timelineChart.destroy();
        }
    } catch (e) {
        console.log('Error destroying timeline chart:', e);
        // Jika terjadi error, pastikan elemen canvas bersih
        $('#timelineChart').remove();
        $('.timeline-chart-container').append('<canvas id="timelineChart"></canvas>');
    }

    // Pastikan Chart.js sudah dimuat
    if (typeof Chart === 'undefined') {
        console.error('Chart.js belum dimuat');
        return;
    }

    // Buat grafik baru
    try {
        const canvas = document.getElementById('timelineChart');
        if (!canvas) {
            console.error('Elemen canvas #timelineChart tidak ditemukan');
            return;
        }

        const ctx = canvas.getContext('2d');
        window.timelineChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: datasets
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: timeRange === '24' ? 'hour' : 'day',
                            displayFormats: {
                                hour: 'HH:mm',
                                day: 'dd/MM'
                            },
                            tooltipFormat: 'dd/MM/yyyy HH:mm'
                        },
                        title: {
                            display: true,
                            text: 'Waktu'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Jumlah Data'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: function(tooltipItems) {
                                return new Date(tooltipItems[0].raw.x).toLocaleString();
                            }
                        }
                    },
                    legend: {
                        position: 'top'
                    }
                }
            }
        });
    } catch (e) {
        console.error('Error creating timeline chart:', e);
    }
}

// Fungsi untuk memuat data history dan menampilkan grafik timeline
async function loadHistoryDataAndUpdateTimeline() {
    try {
        if (typeof showLoading === 'function') {
            showLoading('Memuat data history...');
        }

        const response = await fetch('/api/history-data');

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            // Simpan data history ke variabel global untuk digunakan di seluruh aplikasi
            window.historyData = result.history;

            try {
                // Update grafik timeline
                updateTimelineChart(result.history);

                // Periksa perubahan data dan tampilkan notifikasi jika ada perubahan
                if (typeof checkDataChangesAndNotify === 'function') {
                    checkDataChangesAndNotify(result.history);
                }

                if (typeof showToast === 'function') {
                    showToast('Sukses', 'Data history berhasil dimuat', 'success');
                }
            } catch (chartError) {
                console.error('Error updating timeline chart:', chartError);
                if (typeof showToast === 'function') {
                    showToast('Peringatan', 'Data history berhasil dimuat tetapi gagal menampilkan grafik: ' + chartError.message, 'warning');
                }
            }
        } else {
            throw new Error(result.error || 'Gagal memuat data history');
        }

        if (typeof hideLoading === 'function') {
            hideLoading();
        }
    } catch (error) {
        console.error('Error loading history data:', error);
        if (typeof showToast === 'function') {
            showToast('Error', 'Gagal memuat data history: ' + error.message, 'danger');
        }
        if (typeof hideLoading === 'function') {
            hideLoading();
        }

        // Coba buat container untuk chart jika belum ada
        if (!document.getElementById('timelineChart')) {
            $('.timeline-chart-container').html('<canvas id="timelineChart"></canvas>');
        }
    }
}

// Ekspor fungsi ke window
window.updateTimelineChart = updateTimelineChart;
window.loadHistoryDataAndUpdateTimeline = loadHistoryDataAndUpdateTimeline;