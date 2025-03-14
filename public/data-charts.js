// Tunggu dokumen siap
$(document).ready(function() {
    console.log('Document ready, initializing data-charts.js');

    // Fungsi untuk memeriksa ketersediaan data
    function checkDataAvailability() {
        console.log('Checking data availability...');
        return $.ajax({
            url: '/api/check-data-status',
            method: 'GET'
        });
    }

    // Fungsi untuk menunggu data siap
    function waitForData() {
        checkDataAvailability()
            .then(function(result) {
                if (result.allDataReady) {
                    console.log('All data is ready for display');
                    initDataTables();
                    refreshData();
                    updateDataChart();
                } else {
                    console.log('Waiting for data to be ready...');
                    setTimeout(waitForData, 2000); // Check again in 2 seconds
                }
            })
            .catch(function(error) {
                console.error('Error checking data availability:', error);
                setTimeout(waitForData, 5000); // Retry in 5 seconds if error
            });
    }

    // Start waiting for data
    waitForData();

    // Event handler untuk tab
    $('.nav-link').on('shown.bs.tab', function (e) {
        updateDataChart();
    });

    // Event handler untuk tombol refresh
    $('#refreshBtn').click(function() {
        showLoading('Memperbarui data...');
        refreshData();
    });

    // Event handler untuk tombol refresh tunjangan
    $('#refreshTunjanganBtn').click(function() {
        showLoading('Memuat data tunjangan beras...');

        $.ajax({
            url: '/api/refresh/tunjangan',
            method: 'GET',
            dataType: 'json',
            success: function(result) {
                hideLoading();

                if (result.success) {
                    updateTunjanganBerasTable(result.data);
                    $('#lastCheckTime').text(result.lastCheck || 'Never');

                    // Update chart data
                    updateDataChart();

                    showToast('Sukses', 'Data tunjangan beras berhasil diperbarui', 'success');
                } else {
                    showToast('Error', result.error || 'Gagal memuat data tunjangan beras', 'danger');
                }
            },
            error: function(xhr) {
                hideLoading();
                const errorMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Terjadi kesalahan saat memuat data';
                showToast('Error', errorMsg, 'danger');
            }
        });
    });

    // Event handler untuk tombol refresh BPJS
    $('#refreshBpjsBtn').click(function() {
        showLoading('Memuat data BPJS...');

        $.ajax({
            url: '/api/refresh/bpjs',
            method: 'GET',
            dataType: 'json',
            success: function(result) {
                hideLoading();

                if (result.success) {
                    updateBpjsTable(result.data);
                    $('#lastCheckTime').text(result.lastCheck || 'Never');

                    // Update chart data
                    updateDataChart();

                    showToast('Sukses', 'Data BPJS berhasil diperbarui', 'success');
                } else {
                    showToast('Error', result.error || 'Gagal memuat data BPJS', 'danger');
                }
            },
            error: function(xhr) {
                hideLoading();
                const errorMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Terjadi kesalahan saat memuat data';
                showToast('Error', errorMsg, 'danger');
            }
        });
    });

    // Event handler untuk tombol refresh GWScanner
    $('#refreshGwscannerBtn').click(function() {
        showLoading('Memuat data GWScanner...');

        $.ajax({
            url: '/api/refresh/gwscanner',
            method: 'GET',
            dataType: 'json',
            success: function(result) {
                hideLoading();

                if (result.success) {
                    updateGwScannerTable(result.data);
                    $('#lastCheckTime').text(result.lastCheck || 'Never');

                    // Update chart data
                    updateDataChart();

                    showToast('Sukses', 'Data GWScanner berhasil diperbarui', 'success');
                } else {
                    showToast('Error', result.error || 'Gagal memuat data GWScanner', 'danger');
                }
            },
            error: function(xhr) {
                hideLoading();
                const errorMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Terjadi kesalahan saat memuat data';
                showToast('Error', errorMsg, 'danger');
            }
        });
    });

    // Event handler untuk tombol refresh FFB Worker
    $('#refreshFfbworkerBtn').click(function() {
        showLoading('Memuat data FFB Worker...');

        $.ajax({
            url: '/api/refresh/ffbworker',
            method: 'GET',
            dataType: 'json',
            success: function(result) {
                hideLoading();

                if (result.success) {
                    updateFfbWorkerTable(result.data);
                    $('#lastCheckTime').text(result.lastCheck || 'Never');

                    // Update chart data
                    updateDataChart();

                    showToast('Sukses', 'Data FFB Worker berhasil diperbarui', 'success');
                } else {
                    showToast('Error', result.error || 'Gagal memuat data FFB Worker', 'danger');
                }
            },
            error: function(xhr) {
                hideLoading();
                const errorMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Terjadi kesalahan saat memuat data';
                showToast('Error', errorMsg, 'danger');
            }
        });
    });

    // Set interval untuk refresh data otomatis setiap 1 jam
    setInterval(refreshData, 60 * 60 * 1000);
});

// Fungsi untuk memperbarui grafik data
function updateDataChart() {
    // Pastikan Chart.js sudah dimuat
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js belum dimuat, menunggu...');
        setTimeout(updateDataChart, 1000);
        return;
    }

    try {
        // Ambil data dari elemen yang ada
        const tunjanganCount = parseInt($('#totalData').text()) || 0;
        const bpjsCount = parseInt($('#totalBpjsData').text()) || 0;
        const gwscannerCount = parseInt($('#totalGwscannerData').text()) || 0;
        const ffbworkerCount = parseInt($('#totalFfbworkerData').text()) || 0;

        // Ambil elemen canvas grafik
        const ctx = document.getElementById('dataChangeChart');
        if (!ctx) {
            console.error('Elemen canvas #dataChangeChart tidak ditemukan');
            return;
        }

        // Hancurkan grafik yang ada jika sudah ada
        if (window.dataChart instanceof Chart) {
            window.dataChart.destroy();
        }

        // Buat grafik baru
        window.dataChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Tunjangan Beras', 'BPJS', 'Duplikat GWScanner', 'Non-Pemanen dengan Ripe'],
                datasets: [{
                    label: 'Jumlah Data',
                    data: [tunjanganCount, bpjsCount, gwscannerCount, ffbworkerCount],
                    backgroundColor: [
                        'rgba(33, 150, 243, 0.7)',
                        'rgba(255, 167, 38, 0.7)',
                        'rgba(239, 83, 80, 0.7)',
                        'rgba(102, 187, 106, 0.7)'
                    ],
                    borderColor: [
                        'rgba(33, 150, 243, 1)',
                        'rgba(255, 167, 38, 1)',
                        'rgba(239, 83, 80, 1)',
                        'rgba(102, 187, 106, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Jumlah Data'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Jenis Data'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + context.parsed.y;
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error updating data chart:', error);
    }
}

// Fungsi untuk refresh data
function refreshData() {
    showLoading('Memuat data...');
    console.log('Refreshing data...');

    $.ajax({
        url: '/api/data',
        method: 'GET',
        dataType: 'json',
        success: function(result) {
            hideLoading();
            console.log('Data refresh response:', result);

            if (result && result.success) {
                if (result.dataReady) {
                    console.log('Data ready for display');
                    
                    // Update data tunjangan beras
                    if (result.data) {
                        console.log(`Updating tunjangan beras table with ${result.data.length} records`);
                        updateTunjanganBerasTable(result.data);
                    } else {
                        console.warn('No tunjangan beras data available');
                    }

                    // Update data BPJS
                    if (result.bpjsData) {
                        console.log(`Updating BPJS table with ${result.bpjsData.length} records`);
                        updateBpjsTable(result.bpjsData);
                    } else {
                        console.warn('No BPJS data available');
                    }

                    // Update data GWScanner
                    if (result.gwscannerData) {
                        console.log(`Updating GWScanner table with ${result.gwscannerData.length} records`);
                        updateGwScannerTable(result.gwscannerData);
                    } else {
                        console.warn('No GWScanner data available');
                    }

                    // Update data FFB Worker
                    if (result.ffbworkerData) {
                        console.log(`Updating FFB Worker table with ${result.ffbworkerData.length} records`);
                        updateFfbWorkerTable(result.ffbworkerData);
                    } else {
                        console.warn('No FFB Worker data available');
                    }

                    // Update status
                    $('#lastCheckTime').text(result.lastCheck || 'Never');
                    $('#lastEmailTime').text(result.lastEmail || 'Never');

                    // Update status monitoring
                    if (result.isActive) {
                        $('#monitoringStatus').removeClass('bg-danger').addClass('bg-success').text('Active');
                    } else {
                        $('#monitoringStatus').removeClass('bg-success').addClass('bg-danger').text('Inactive');
                    }

                    // Update chart data
                    updateDataChart();

                    // Tampilkan notifikasi jika data dari cache
                    if (result.fromCache) {
                        showToast('Info', 'Data diambil dari cache. Refresh data di background...', 'info');
                    }
                    
                    console.log('Data refresh completed successfully');
                } else {
                    console.log('Waiting for data to be ready...');
                    setTimeout(refreshData, 2000); // Try again in 2 seconds
                }
            } else {
                console.error('Error in data refresh response:', result);
                showToast('Error', result.error || 'Gagal memuat data', 'danger');
            }
        },
        error: function(xhr, status, error) {
            hideLoading();
            console.error('AJAX error in refreshData:', status, error);
            const errorMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Terjadi kesalahan saat memuat data';
            showToast('Error', errorMsg, 'danger');
        }
    });
}

// Fungsi untuk menampilkan notifikasi
function showNotification(message) {
    if ('Notification' in window) {
        Notification.requestPermission().then(function(permission) {
            if (permission === 'granted') {
                new Notification('Update Data', { body: message });
            }
        });
    }

    // Tampilkan juga di UI
    const toast = $('<div class="toast" role="alert" aria-live="assertive" aria-atomic="true">')
        .append($('<div class="toast-header">')
            .append('<strong class="mr-auto">Notifikasi</strong>')
            .append('<button type="button" class="ml-2 mb-1 close" data-dismiss="toast" aria-label="Close"><span aria-hidden="true">&times;</span></button>'))
        .append($('<div class="toast-body">').text(message));

    $('.toast-container').append(toast);
    toast.toast({ autohide: true, delay: 5000 }).toast('show');
}

// Inisialisasi DataTables
function initDataTables() {
    try {
        // Tunjangan Beras DataTable
        if ($.fn.DataTable.isDataTable('#dataTable')) {
            $('#dataTable').DataTable().destroy();
        }
        $('#dataTable').DataTable({
            responsive: true,
            dom: 'Bfrtip',
            buttons: [
                'copy', 'excel', 'pdf', 'print'
            ],
            columnDefs: [
                { 'defaultContent': '-', 'targets': '_all' }
            ],
            language: {
                search: 'Cari:',
                lengthMenu: 'Tampilkan _MENU_ data',
                info: 'Menampilkan _START_ sampai _END_ dari _TOTAL_ data',
                infoEmpty: 'Menampilkan 0 sampai 0 dari 0 data',
                infoFiltered: '(difilter dari _MAX_ total data)',
                zeroRecords: 'Tidak ada data yang ditemukan',
                paginate: {
                    first: 'Pertama',
                    last: 'Terakhir',
                    next: 'Selanjutnya',
                    previous: 'Sebelumnya'
                }
            }
        });

        // BPJS DataTable
        if ($.fn.DataTable.isDataTable('#bpjsTable')) {
            $('#bpjsTable').DataTable().destroy();
        }
        $('#bpjsTable').DataTable({
            responsive: true,
            dom: 'Bfrtip',
            buttons: [
                'copy', 'excel', 'pdf', 'print'
            ],
            columnDefs: [
                { 'defaultContent': '-', 'targets': '_all' }
            ],
            language: {
                search: 'Cari:',
                lengthMenu: 'Tampilkan _MENU_ data',
                info: 'Menampilkan _START_ sampai _END_ dari _TOTAL_ data',
                infoEmpty: 'Menampilkan 0 sampai 0 dari 0 data',
                infoFiltered: '(difilter dari _MAX_ total data)',
                zeroRecords: 'Tidak ada data yang ditemukan',
                paginate: {
                    first: 'Pertama',
                    last: 'Terakhir',
                    next: 'Selanjutnya',
                    previous: 'Sebelumnya'
                }
            }
        });

        // GWScanner DataTable
        if ($.fn.DataTable.isDataTable('#gwscannerTable')) {
            $('#gwscannerTable').DataTable().destroy();
        }
        $('#gwscannerTable').DataTable({
            responsive: true,
            dom: 'Bfrtip',
            buttons: [
                'copy', 'excel', 'pdf', 'print'
            ],
            columnDefs: [
                { 'defaultContent': '-', 'targets': '_all' }
            ],
            language: {
                search: 'Cari:',
                lengthMenu: 'Tampilkan _MENU_ data',
                info: 'Menampilkan _START_ sampai _END_ dari _TOTAL_ data',
                infoEmpty: 'Menampilkan 0 sampai 0 dari 0 data',
                infoFiltered: '(difilter dari _MAX_ total data)',
                zeroRecords: 'Tidak ada data yang ditemukan',
                paginate: {
                    first: 'Pertama',
                    last: 'Terakhir',
                    next: 'Selanjutnya',
                    previous: 'Sebelumnya'
                }
            }
        });

        // FFB Worker DataTable
        if ($.fn.DataTable.isDataTable('#ffbworkerTable')) {
            $('#ffbworkerTable').DataTable().destroy();
        }
        $('#ffbworkerTable').DataTable({
            responsive: true,
            dom: 'Bfrtip',
            buttons: [
                'copy', 'excel', 'pdf', 'print'
            ],
            columnDefs: [
                { 'defaultContent': '-', 'targets': '_all' }
            ],
            language: {
                search: 'Cari:',
                lengthMenu: 'Tampilkan _MENU_ data',
                info: 'Menampilkan _START_ sampai _END_ dari _TOTAL_ data',
                infoEmpty: 'Menampilkan 0 sampai 0 dari 0 data',
                infoFiltered: '(difilter dari _MAX_ total data)',
                zeroRecords: 'Tidak ada data yang ditemukan',
                paginate: {
                    first: 'Pertama',
                    last: 'Terakhir',
                    next: 'Selanjutnya',
                    previous: 'Sebelumnya'
                }
            }
        });

        console.log('DataTables initialized successfully');
    } catch (error) {
        console.error('Error initializing DataTables:', error);
    }
}

// Fungsi untuk memperbarui tabel tunjangan beras
function updateTunjanganBerasTable(data) {
    console.log('Updating tunjangan beras table with data:', data);
    
    // Hapus semua data yang ada
    const table = $('#dataTable').DataTable();
    table.clear();

    // Tambahkan data baru
    if (data && data.length > 0) {
        console.log(`Processing ${data.length} rows for tunjangan beras table`);
        
        data.forEach(function(item, index) {
            if (index < 5) {
                console.log('Sample data item:', item); // Log beberapa item untuk debugging
            }
            
            try {
                table.row.add([
                    item.EmpCode || '-',
                    item.EmpName || '-',
                    item.SalGradeCode || '',
                    item.RiceRationCode || '-',
                    item.Gender || '-',
                    item.Status_Pernikahan || '-',
                    item.Jumlah_Keluarga || item.JmlKeluarga || 0,
                    item.Keluarga1 || '-',
                    item.Usia1 || '-',
                    item.Status_Tunjangan_Beras1 || '-',
                    item.IsEmployee1 || '-',
                    item.Status_Validasi1 || '-',
                    item.Keluarga2 || '-',
                    item.Usia2 || '-',
                    item.Status_Tunjangan_Beras2 || '-',
                    item.IsEmployee2 || '-',
                    item.Status_Validasi2 || '-',
                    item.Keluarga3 || '-',
                    item.Usia3 || '-',
                    item.Status_Tunjangan_Beras3 || '-',
                    item.IsEmployee3 || '-',
                    item.Status_Validasi3 || '-',
                    item.Keluarga4 || '-',
                    item.Usia4 || '-',
                    item.Status_Tunjangan_Beras4 || '-',
                    item.IsEmployee4 || '-',
                    item.Status_Validasi4 || '-',
                    item.Keluarga5 || '-',
                    item.Usia5 || '-',
                    item.Status_Tunjangan_Beras5 || '-',
                    item.IsEmployee5 || '-',
                    item.Status_Validasi5 || '-',
                    item.PayRate || '-',
                    item.RiceRation_Aktual || '-',
                    item.Status_Tunjangan || '-',
                    item.RiceRation_Seharusnya || '-',
                    item.Selisih_RiceRation || '-',
                    item.Perbandingan_RiceRation || '-'
                ]);
            } catch (error) {
                console.error('Error adding row:', error, 'Item:', item);
            }
        });
    } else {
        console.warn('No data available for tunjangan beras table');
    }

    // Perbarui tampilan tabel
    try {
        table.draw();
        console.log('Table draw completed');
    } catch (error) {
        console.error('Error drawing table:', error);
    }

    // Update statistik
    $('#totalData').text(data ? data.length : 0);
    $('#errorData').text(data ? data.filter(item => item.Perbandingan_RiceRation === 'Beda').length : 0);
    
    console.log('Tunjangan beras table update completed');
}

// Fungsi untuk memperbarui tabel BPJS
function updateBpjsTable(data) {
    // Hapus semua data yang ada
    const table = $('#bpjsTable').DataTable();
    table.clear();

    // Tambahkan data baru
    if (data && data.length > 0) {
        data.forEach(function(item) {
            table.row.add([
                item.EmpCode,
                item.EmpName,
                item.SalGradeCode,
                item.JKKNo,
                item.Status_JKKScheme,
                item.Status_JHTScheme,
                item.Status_BPJSScheme,
                item.StatusKeseluruhan
            ]);
        });
    }

    // Perbarui tampilan tabel
    table.draw();

    // Update statistik
    $('#totalBpjsData').text(data.length);
}

// Fungsi untuk memperbarui tabel GWScanner
function updateGwScannerTable(data) {
    // Hapus semua data yang ada
    const table = $('#gwscannerTable').DataTable();
    table.clear();

    // Tambahkan data baru
    if (data && data.length > 0) {
        data.forEach(function(item) {
            table.row.add([
                item.ItechUpdateStatus || 'N/A', // Menampilkan ItechUpdateStatus di awal
                item.ID,
                item.TRANSNO,
                item.FROMOCCODE,
                item.TOOCCODE,
                item.SCANNERUSERCODE,
                item.WORKERCODE,
                item.FIELDNO,
                item.JOBCODE,
                item.VEHICLENO,
                item.TRANSDATE,
                item.RECORDTAG,
                item.TRANSSTATUS,
                item.ISCONTRACT,
                item.DATECREATED,
                item.SCANOUTDATETIME,
                item.INTEGRATETIME
            ]);
        });
    }

    // Perbarui tampilan tabel
    table.draw();

    // Update statistik
    $('#totalGwscannerData').text(data.length);
    $('#duplicateGwscannerData').text(data.length);
}

// Fungsi untuk memperbarui tabel FFB Worker
function updateFfbWorkerTable(data) {
    // Hapus semua data yang ada
    const table = $('#ffbworkerTable').DataTable();
    table.clear();

    // Tambahkan data baru
    if (data && data.length > 0) {
        data.forEach(function(item) {
            table.row.add([
                item.ID,
                item.TRANSNO,
                item.FROMOCCODE,
                item.TOOCCODE,
                item.WORKERCODE,
                item.FIELDNO,
                item.LOOSEFRUIT,
                item.RIPE,
                item.UNRIPE,
                item.OVERRIPE,
                item.TRANSDATE,
                item.TRANSSTATUS,
                item.EmployeeStatus, // Status Karyawan
                item.PosCode, // Posisi
                item.WorkerCount || item.JumlahKemunculan // Jumlah Kemunculan
            ]);
        });
    }

    // Perbarui tampilan tabel
    table.draw();

    // Update statistik
    $('#totalFfbworkerData').text(data.length);
    $('#ffbworkerDivisi').text(new Set(data.map(item => item.FROMOCCODE)).size);
    $('#actionNeededFfbworker').text(data.length);
}

// Fungsi untuk refresh data spesifik
function refreshSpecificData(dataType) {
    showLoading(`Memuat data ${dataType}...`);

    $.ajax({
        url: '/run-query',
        method: 'POST',
        data: { queryType: dataType },
        dataType: 'json',
        success: function(result) {
            hideLoading();

            if (result && result.success) {
                // Refresh data setelah query berhasil dijalankan
                refreshData();
                showToast('Sukses', `Data ${dataType} berhasil diperbarui`, 'success');
            } else {
                showToast('Error', result.error || `Gagal memuat data ${dataType}`, 'danger');
            }
        },
        error: function(xhr) {
            hideLoading();
            const errorMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Terjadi kesalahan saat memuat data';
            showToast('Error', errorMsg, 'danger');
        }
    });
}

// Event listener untuk tombol refresh data
$(document).ready(function() {
    // Inisialisasi DataTables
    initDataTables();
    
    // Perbarui grafik data
    updateDataChart();

    // Refresh data secara otomatis setiap 5 menit
    setInterval(refreshData, 300000);

    // Event listener untuk tombol refresh
    $('#refreshBtn').on('click', function() {
        refreshData();
    });

    // Event listener untuk tombol refresh tunjangan beras
    $('#refreshTunjanganBtn').on('click', function() {
        refreshSpecificData('tunjangan_beras');
    });

    // Event listener untuk tombol refresh BPJS
    $('#refreshBpjsBtn').on('click', function() {
        refreshSpecificData('bpjs');
    });

    // Event listener untuk tombol refresh GWScanner
    $('#refreshGwscannerBtn').on('click', function() {
        refreshSpecificData('gwscanner');
    });

    // Event listener untuk tombol refresh FFB Worker
    $('#refreshFfbworkerBtn').on('click', function() {
        refreshSpecificData('ffbworker');
    });

    // Event listener untuk tab
    $('button[data-bs-toggle="pill"]').on('shown.bs.tab', function (e) {
        const targetId = $(e.target).attr('data-bs-target');
        
        // Sembunyikan semua stats cards
        $('#tunjangan-stats, #bpjs-stats, #gwscanner-stats, #ffbworker-stats').hide();
        
        // Tampilkan stats card yang sesuai dengan tab yang aktif
        if (targetId === '#tunjangan-data') {
            $('#tunjangan-stats').show();
        } else if (targetId === '#bpjs-data') {
            $('#bpjs-stats').show();
        } else if (targetId === '#gwscanner-data') {
            $('#gwscanner-stats').show();
        } else if (targetId === '#ffbworker-data') {
            $('#ffbworker-stats').show();
        }
    });

    // Tampilkan stats card untuk tab yang aktif saat halaman dimuat
    const activeTab = $('.nav-link.active').attr('data-bs-target');
    if (activeTab === '#tunjangan-data') {
        $('#tunjangan-stats').show();
    } else if (activeTab === '#bpjs-data') {
        $('#bpjs-stats').show();
    } else if (activeTab === '#gwscanner-data') {
        $('#gwscanner-stats').show();
    } else if (activeTab === '#ffbworker-data') {
        $('#ffbworker-stats').show();
    }
});
