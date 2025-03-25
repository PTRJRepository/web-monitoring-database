// Tunggu dokumen siap
$(document).ready(function() {
    console.log('Document ready, initializing history-timeline.js');

    // Fungsi untuk memuat data historis dan memperbarui grafik timeline
    function loadHistoryDataAndUpdateTimeline() {
        console.log('Loading history data...');
        showLoading('Memuat data historis...');

        $.ajax({
            url: '/api/history',
            method: 'GET',
            dataType: 'json',
            success: function(result) {
                hideLoading();

                if (result && result.success) {
                    console.log('History data loaded successfully:', result.data ? result.data.length : 0, 'records');
                    // Update grafik timeline
                    if (result.data && result.data.length > 0) {
                        updateTimelineChart(result.data);
                    } else {
                        console.warn('No history data available');
                        $('#historyCount').text('0');
                        $('#historyStartDate').text('-');
                        $('#historyEndDate').text('-');
                    }

                    // Tampilkan notifikasi jika data dari cache
                    if (result.fromCache) {
                        showToast('Info', 'Data historis diambil dari cache', 'info');
                    }
                } else {
                    console.error('Failed to load history data:', result ? result.error : 'Unknown error');
                    showToast('Error', result && result.error ? result.error : 'Gagal memuat data historis', 'danger');
                }
            },
            error: function(xhr) {
                hideLoading();
                const errorMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Terjadi kesalahan saat memuat data historis';
                console.error('Error loading history data:', errorMsg);
                showToast('Error', errorMsg, 'danger');
            }
        });
    }

    // Fungsi untuk memperbarui grafik timeline
    function updateTimelineChart(historyData) {
        console.log('Updating timeline chart with', historyData.length, 'records');
        // Pastikan Chart.js sudah dimuat
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js belum dimuat, menunggu...');
            setTimeout(function() { updateTimelineChart(historyData); }, 1000);
            return;
        }

        try {
            if (!historyData || historyData.length === 0) {
                console.warn('Tidak ada data historis untuk ditampilkan');
                return;
            }

            // Ambil elemen canvas grafik
            const ctx = document.getElementById('timelineChart');
            if (!ctx) {
                console.error('Elemen canvas #timelineChart tidak ditemukan');
                return;
            }

            // Hancurkan grafik yang ada jika sudah ada
            if (window.timelineChart instanceof Chart) {
                window.timelineChart.destroy();
            }

            // Siapkan data untuk grafik
            const labels = [];
            const tunjanganData = [];
            const bpjsData = [];
            const gwscannerData = [];
            const ffbworkerData = [];

            // Urutkan data berdasarkan tanggal
            historyData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            // Ambil data untuk grafik
            historyData.forEach(item => {
                // Format tanggal untuk label
                const date = new Date(item.timestamp);
                const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;

                labels.push(formattedDate);
                tunjanganData.push(item.tunjanganCount || 0);
                bpjsData.push(item.bpjsCount || 0);
                gwscannerData.push(item.gwscannerCount || 0);
                ffbworkerData.push(item.ffbworkerCount || 0);
            });

            // Buat grafik baru
            window.timelineChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Tunjangan Beras',
                            data: tunjanganData,
                            borderColor: 'rgba(33, 150, 243, 1)',
                            backgroundColor: 'rgba(33, 150, 243, 0.1)',
                            borderWidth: 2,
                            tension: 0.4,
                            fill: true
                        },
                        {
                            label: 'BPJS',
                            data: bpjsData,
                            borderColor: 'rgba(255, 167, 38, 1)',
                            backgroundColor: 'rgba(255, 167, 38, 0.1)',
                            borderWidth: 2,
                            tension: 0.4,
                            fill: true
                        },
                        {
                            label: 'Duplikat GWScanner',
                            data: gwscannerData,
                            borderColor: 'rgba(239, 83, 80, 1)',
                            backgroundColor: 'rgba(239, 83, 80, 0.1)',
                            borderWidth: 2,
                            tension: 0.4,
                            fill: true
                        },
                        {
                            label: 'Non-Pemanen dengan Ripe',
                            data: ffbworkerData,
                            borderColor: 'rgba(102, 187, 106, 1)',
                            backgroundColor: 'rgba(102, 187, 106, 0.1)',
                            borderWidth: 2,
                            tension: 0.4,
                            fill: true
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: 'Waktu'
                            },
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45
                            },
                            time: {
                                unit: 'day',
                                displayFormats: {
                                    day: 'dd/MM'  // Menggunakan 'dd' bukan 'DD'
                                }
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
                        legend: {
                            position: 'top',
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                label: function(context) {
                                    return context.dataset.label + ': ' + context.parsed.y;
                                }
                            }
                        }
                    },
                    interaction: {
                        mode: 'nearest',
                        axis: 'x',
                        intersect: false
                    }
                }
            });

            // Tampilkan informasi tentang data historis
            $('#historyCount').text(historyData.length);
            $('#historyStartDate').text(new Date(historyData[0].timestamp).toLocaleString());
            $('#historyEndDate').text(new Date(historyData[historyData.length - 1].timestamp).toLocaleString());

            console.log('Timeline chart updated successfully');
        } catch (error) {
            console.error('Error updating timeline chart:', error);
        }
    }

    // Fungsi untuk menampilkan dialog ekspor data historis
    function showExportHistoryDialog() {
        // Tampilkan dialog
        $('#exportHistoryModal').modal('show');
    }

    // Fungsi untuk mengekspor data historis
    function exportHistoryData(format) {
        showLoading('Mengekspor data historis...');

        $.ajax({
            url: '/api/history/export',
            method: 'GET',
            data: { format: format },
            success: function(result) {
                hideLoading();

                if (result.success) {
                    // Buat link untuk download
                    const link = document.createElement('a');
                    link.href = result.fileUrl;
                    link.download = result.fileName || 'history-data.' + format;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    // Tutup dialog
                    $('#exportHistoryModal').modal('hide');

                    showToast('Sukses', 'Data historis berhasil diekspor', 'success');
                } else {
                    showToast('Error', result.error || 'Gagal mengekspor data historis', 'danger');
                }
            },
            error: function(xhr) {
                hideLoading();
                const errorMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Terjadi kesalahan saat mengekspor data historis';
                showToast('Error', errorMsg, 'danger');
            }
        });
    }

    // Load data history dan update grafik timeline
    loadHistoryDataAndUpdateTimeline();

    // Event handler untuk tombol load history
    $('#loadHistoryBtn').click(function() {
        loadHistoryDataAndUpdateTimeline();
    });

    // Event handler untuk tombol ekspor history
    $('#exportHistoryBtn').click(function() {
        showExportHistoryDialog();
    });

    // Event handler untuk tombol ekspor dalam dialog
    $('#exportCsvBtn').click(function() {
        exportHistoryData('csv');
    });

    $('#exportJsonBtn').click(function() {
        exportHistoryData('json');
    });

    $('#exportExcelBtn').click(function() {
        exportHistoryData('xlsx');
    });

    // Set interval untuk memuat data setiap 10 menit
    setInterval(loadHistoryDataAndUpdateTimeline, 10 * 60 * 1000);
});
