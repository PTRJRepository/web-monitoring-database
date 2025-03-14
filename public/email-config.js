// Konfigurasi Email
$(document).ready(function() {
    console.log('Email config script loaded');

    // Inisialisasi toggle email
    initEmailToggle();

    // Load konfigurasi email
    window.globalLoadEmailConfig = function() {
        showLoading('Memuat konfigurasi email...');
        $.ajax({
            url: '/api/config/email',
            method: 'GET',
            dataType: 'json',
            success: function(result) {
                hideLoading();
                if (result.success) {
                    const config = result.config || {};

                    // Aktifkan/nonaktifkan email
                    $('#emailEnabled').prop('checked', config.isEnabled || false);

                    // Update toggle email di halaman utama
                    updateEmailToggle(config.isEnabled || false);

                    // Pengaturan pengirim
                    $('#senderEmail').val(config.sender?.email || '');

                    // Interval
                    $('#scheduleInterval').val(config.interval?.checkData || 5);
                    $('#emailInterval').val(config.interval?.sendEmail || 180);

                    // Penerima
                    $('#firstTimeEmail').val(config.recipients?.firstTime || '');
                    $('#defaultEmail').val(config.recipients?.interval || '');
                    $('#tunjanganBerasEmail').val(config.recipients?.tunjangan_beras || '');
                    $('#bpjsEmail').val(config.recipients?.bpjs || '');
                    $('#gwscannerEmail').val(config.recipients?.gwscanner || '');
                    $('#ffbworkerEmail').val(config.recipients?.ffbworker || '');

                    // CC
                    $('#ccEmail').val(config.cc?.join(', ') || '');

                    // Template
                    $('#tunjanganBerasTemplate').val(config.templates?.tunjangan_beras || '');
                    $('#bpjsTemplate').val(config.templates?.bpjs || '');
                    $('#gwscannerTemplate').val(config.templates?.gwscanner || '');
                    $('#ffbworkerTemplate').val(config.templates?.ffbworker || '');

                    showToast('Sukses', 'Konfigurasi email berhasil dimuat', 'success');
                } else {
                    showToast('Error', 'Gagal memuat konfigurasi email', 'danger');
                }
            },
            error: function(xhr) {
                hideLoading();
                const errorMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Terjadi kesalahan saat memuat konfigurasi';
                showToast('Error', errorMsg, 'danger');
            }
        });
    };

    // Panggil fungsi untuk memuat konfigurasi email
    window.globalLoadEmailConfig();

    // Load konfigurasi ketika tab konfigurasi aktif
    $('#config-tab').on('shown.bs.tab', function(e) {
        window.globalLoadEmailConfig();
    });

    // Event handler untuk form konfigurasi email
    $('#emailConfigForm').submit(function(e) {
        e.preventDefault();

        // Validasi form
        if (!validateForm('#emailConfigForm', {
            'senderEmail': { required: true, email: true },
            'scheduleInterval': { required: true, number: true },
            'emailInterval': { required: true, number: true },
            'firstTimeEmail': { required: true, email: true },
            'defaultEmail': { required: true, email: true }
        })) {
            return;
        }

        // Ambil data form
        const formData = {
            isEnabled: $('#emailEnabled').prop('checked'),
            sender: {
                email: $('#senderEmail').val(),
                password: $('#senderPassword').val()
            },
            interval: {
                checkData: parseInt($('#scheduleInterval').val()),
                sendEmail: parseInt($('#emailInterval').val())
            },
            recipients: {
                firstTime: $('#firstTimeEmail').val(),
                interval: $('#defaultEmail').val(),
                tunjangan_beras: $('#tunjanganBerasEmail').val(),
                bpjs: $('#bpjsEmail').val(),
                gwscanner: $('#gwscannerEmail').val(),
                ffbworker: $('#ffbworkerEmail').val()
            },
            cc: $('#ccEmail').val().split(',').map(email => email.trim()).filter(email => email),
            templates: {
                tunjangan_beras: $('#tunjanganBerasTemplate').val(),
                bpjs: $('#bpjsTemplate').val(),
                gwscanner: $('#gwscannerTemplate').val(),
                ffbworker: $('#ffbworkerTemplate').val()
            }
        };

        // Kirim data ke server
        showLoading('Menyimpan konfigurasi email...');
        $.ajax({
            url: '/api/config/email',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(formData),
            success: function(result) {
                hideLoading();

                if (result.success) {
                    // Reset password field
                    $('#senderPassword').val('');

                    // Update toggle email di halaman utama
                    updateEmailToggle(formData.isEnabled);

                    showToast('Sukses', 'Konfigurasi email berhasil disimpan', 'success');
                } else {
                    showToast('Error', result.error || 'Gagal menyimpan konfigurasi email', 'danger');
                }
            },
            error: function(xhr) {
                hideLoading();
                const errorMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Terjadi kesalahan saat menyimpan konfigurasi';
                showToast('Error', errorMsg, 'danger');
            }
        });
    });

    // Event handler untuk tombol test email
    $('#testEmailBtn').click(function() {
        showLoading('Mengirim email test...');

        $.ajax({
            url: '/api/config/email/test',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                recipient: $('#testEmailRecipient').val()
            }),
            success: function(result) {
                hideLoading();

                if (result.success) {
                    showToast('Sukses', 'Email test berhasil dikirim', 'success');
                } else {
                    showToast('Error', result.error || 'Gagal mengirim email test', 'danger');
                }
            },
            error: function(xhr) {
                hideLoading();
                const errorMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Terjadi kesalahan saat mengirim email test';
                showToast('Error', errorMsg, 'danger');
            }
        });
    });

    // Tambahkan tombol logout
    $('body').append('<button id="logoutBtn" class="btn btn-danger position-fixed" style="bottom: 20px; right: 20px;"><i class="fas fa-sign-out-alt"></i> Logout</button>');

    // Event handler untuk tombol logout
    $('#logoutBtn').click(function() {
        showLoading('Logging out...');

        $.ajax({
            url: '/api/logout',
            method: 'GET',
            success: function() {
                window.location.href = '/login';
            },
            error: function() {
                hideLoading();
                showToast('Error', 'Gagal logout', 'danger');
            }
        });
    });

    // Inisialisasi toggle email di halaman utama
    function initEmailToggle() {
        // Event handler untuk toggle email di halaman utama
        $('#emailToggle').on('change', function() {
            const isEnabled = $(this).prop('checked');
            updateEmailToggle(isEnabled);

            // Simpan konfigurasi email
            saveEmailToggleState(isEnabled);
        });
    }

    // Update tampilan toggle email
    function updateEmailToggle(isEnabled) {
        $('#emailToggle').prop('checked', isEnabled);
        $('#emailToggleStatus').text(isEnabled ? 'Aktif' : 'Nonaktif');
        $('#emailToggleStatus').removeClass(isEnabled ? 'text-danger' : 'text-success').addClass(isEnabled ? 'text-success' : 'text-danger');

        // Update juga checkbox di form konfigurasi
        $('#emailEnabled').prop('checked', isEnabled);
    }

    // Simpan status toggle email
    function saveEmailToggleState(isEnabled) {
        showLoading('Menyimpan konfigurasi email...');

        $.ajax({
            url: '/api/config/email/toggle',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ isEnabled: isEnabled }),
            success: function(result) {
                hideLoading();

                if (result.success) {
                    showToast('Sukses', 'Notifikasi email ' + (isEnabled ? 'diaktifkan' : 'dinonaktifkan'), 'success');
                } else {
                    showToast('Error', result.error || 'Gagal menyimpan konfigurasi email', 'danger');
                    // Kembalikan toggle ke status sebelumnya
                    updateEmailToggle(!isEnabled);
                }
            },
            error: function(xhr) {
                hideLoading();
                const errorMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Terjadi kesalahan saat menyimpan konfigurasi';
                showToast('Error', errorMsg, 'danger');
                // Kembalikan toggle ke status sebelumnya
                updateEmailToggle(!isEnabled);
            }
        });
    }

    // Toggle email status
    $('#emailToggle').change(function() {
        const isChecked = $(this).is(':checked');
        
        $.ajax({
            url: '/api/config/email/toggle',
            method: 'POST',
            success: function(result) {
                if (result.success) {
                    $('#emailToggleStatus').text(result.isEnabled ? 'Aktif' : 'Nonaktif');
                    showToast('Sukses', result.message, 'success');
                } else {
                    // Kembalikan toggle ke status sebelumnya
                    $('#emailToggle').prop('checked', !isChecked);
                    showToast('Error', result.error || 'Gagal mengubah status email', 'danger');
                }
            },
            error: function(xhr) {
                // Kembalikan toggle ke status sebelumnya
                $('#emailToggle').prop('checked', !isChecked);
                const errorMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Terjadi kesalahan saat mengubah status email';
                showToast('Error', errorMsg, 'danger');
            }
        });
    });

    // Load email config
    function loadEmailConfig() {
        $.ajax({
            url: '/api/config/email',
            method: 'GET',
            success: function(result) {
                if (result.success && result.config) {
                    const config = result.config;
                    
                    // Update form fields
                    if (config.email) {
                        $('#senderEmail').val(config.email.sender.email);
                        $('#firstTimeEmail').val(config.email.recipients.firstTime);
                        $('#defaultEmail').val(config.email.recipients.interval);
                        $('#scheduleInterval').val(config.email.interval.checkData);
                        $('#emailInterval').val(config.email.interval.sendEmail);
                        $('#emailEnabled').prop('checked', config.email.isEnabled);
                        $('#emailToggle').prop('checked', config.email.isEnabled);
                        $('#emailToggleStatus').text(config.email.isEnabled ? 'Aktif' : 'Nonaktif');
                        
                        // CC emails
                        if (config.email.cc && config.email.cc.length > 0) {
                            $('#ccEmail').val(config.email.cc.join(', '));
                        }
                        
                        // Query-specific emails
                        if (config.email.recipients) {
                            $('#tunjanganBerasEmail').val(config.email.recipients.tunjangan_beras || '');
                            $('#bpjsEmail').val(config.email.recipients.bpjs || '');
                            $('#gwscannerEmail').val(config.email.recipients.gwscanner || '');
                            $('#ffbworkerEmail').val(config.email.recipients.ffbworker || '');
                        }
                        
                        // Templates
                        if (config.templates) {
                            $('#tunjanganBerasTemplate').val(config.templates.tunjangan_beras || '');
                            $('#bpjsTemplate').val(config.templates.bpjs || '');
                            $('#gwscannerTemplate').val(config.templates.gwscanner || '');
                            $('#ffbworkerTemplate').val(config.templates.ffbworker || '');
                        }
                    }
                } else {
                    showToast('Error', result.error || 'Gagal memuat konfigurasi email', 'danger');
                }
            },
            error: function(xhr) {
                const errorMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Terjadi kesalahan saat memuat konfigurasi email';
                showToast('Error', errorMsg, 'danger');
            }
        });
    }

    // Load email config on page load
    loadEmailConfig();

    // Reset email config
    $('#resetEmailConfig').click(function() {
        if (confirm('Apakah Anda yakin ingin mereset konfigurasi email ke default?')) {
            $.ajax({
                url: '/api/reset-email-config',
                method: 'POST',
                success: function(result) {
                    if (result.success) {
                        showToast('Sukses', result.message, 'success');
                        // Reload config
                        loadEmailConfig();
                    } else {
                        showToast('Error', result.error || 'Gagal mereset konfigurasi email', 'danger');
                    }
                },
                error: function(xhr) {
                    const errorMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Terjadi kesalahan saat mereset konfigurasi email';
                    showToast('Error', errorMsg, 'danger');
                }
            });
        }
    });

    // Send test email
    $('#sendTestEmail').click(function() {
        $.ajax({
            url: '/api/send-test-email',
            method: 'POST',
            success: function(result) {
                if (result.success) {
                    showToast('Sukses', 'Email test berhasil dikirim', 'success');
                } else {
                    showToast('Error', result.error || 'Gagal mengirim email test', 'danger');
                }
            },
            error: function(xhr) {
                const errorMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Terjadi kesalahan saat mengirim email test';
                showToast('Error', errorMsg, 'danger');
            }
        });
    });

    // Send current data
    $('#sendCurrentData').click(function() {
        $.ajax({
            url: '/api/send-current-data',
            method: 'POST',
            success: function(result) {
                if (result.success) {
                    showToast('Sukses', 'Data berhasil dikirim', 'success');
                } else {
                    showToast('Error', result.error || 'Gagal mengirim data', 'danger');
                }
            },
            error: function(xhr) {
                const errorMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Terjadi kesalahan saat mengirim data';
                showToast('Error', errorMsg, 'danger');
            }
        });
    });

    // Save config password
    $('#securityForm').submit(function(e) {
        e.preventDefault();
        
        const formData = $(this).serialize();
        
        $.ajax({
            url: '/api/update-config-password',
            method: 'POST',
            data: formData,
            success: function(result) {
                if (result.success) {
                    showToast('Sukses', 'Kata sandi berhasil diperbarui', 'success');
                    $('#configPassword').val('');
                } else {
                    showToast('Error', result.error || 'Gagal memperbarui kata sandi', 'danger');
                }
            },
            error: function(xhr) {
                const errorMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Terjadi kesalahan saat memperbarui kata sandi';
                showToast('Error', errorMsg, 'danger');
            }
        });
    });

    // Fungsi untuk menangani update query database
    $('#updateTunjanganBerasBtn').on('click', function() {
        updateQueryData('tunjangan_beras');
    });
    
    // Event handler untuk tombol update BPJS
    $('#updateBpjsBtn').on('click', function() {
        updateQueryData('bpjs');
    });
    
    // Event handler untuk tombol update GWScanner
    $('#updateGwscannerBtn').on('click', function() {
        updateQueryData('gwscanner');
    });
    
    // Event handler untuk tombol update FFB Worker
    $('#updateFfbworkerBtn').on('click', function() {
        updateQueryData('ffbworker');
    });
    
    // Fungsi untuk mengirim permintaan update query
    function updateQueryData(queryType) {
        // Tampilkan loading
        showLoading(`Memperbarui data ${queryType}...`);
        
        // Kirim permintaan ke server
        $.ajax({
            url: '/run-query',
            method: 'POST',
            data: { queryType: queryType },
            dataType: 'json',
            success: function(result) {
                hideLoading();
                
                if (result.success) {
                    showToast('Sukses', `Data ${queryType} berhasil diperbarui`, 'success');
                    
                    // Refresh data setelah berhasil
                    if (typeof refreshData === 'function') {
                        refreshData();
                    }
                } else {
                    showToast('Error', result.error || `Gagal memperbarui data ${queryType}`, 'danger');
                }
            },
            error: function(xhr) {
                hideLoading();
                
                // Cek jika error karena belum login
                if (xhr.status === 401) {
                    showToast('Error', 'Anda harus login terlebih dahulu', 'danger');
                    setTimeout(function() {
                        window.location.href = '/login';
                    }, 2000);
                } else {
                    const errorMsg = xhr.responseJSON ? xhr.responseJSON.error : 'Terjadi kesalahan saat memperbarui data';
                    showToast('Error', errorMsg, 'danger');
                }
            }
        });
    }
});