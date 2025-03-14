// Fungsi untuk menampilkan loading
function showLoading(message = 'Loading...') {
    // Buat elemen loading jika belum ada
    if ($('#loadingOverlay').length === 0) {
        const loadingHtml = `
            <div id="loadingOverlay" class="position-fixed d-flex justify-content-center align-items-center" 
                 style="top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0,0,0,0.5); z-index: 9999; display: none;">
                <div class="bg-white p-4 rounded shadow-lg text-center">
                    <div class="spinner-border text-primary mb-2" role="status">
                        <span class="sr-only">Loading...</span>
                    </div>
                    <div id="loadingMessage" class="text-dark"></div>
                </div>
            </div>
        `;
        $('body').append(loadingHtml);
    }

    // Update pesan dan tampilkan loading
    $('#loadingMessage').text(message);
    $('#loadingOverlay').fadeIn(200);
}

// Fungsi untuk menyembunyikan loading
function hideLoading() {
    $('#loadingOverlay').fadeOut(200);
}

// Fungsi untuk menampilkan toast notification
function showToast(title, message, type = 'info') {
    // Buat container toast jika belum ada
    if ($('.toast-container').length === 0) {
        $('body').append('<div class="toast-container position-fixed top-0 end-0 p-3" style="z-index: 9999;"></div>');
    }

    // Tentukan warna berdasarkan tipe
    let bgClass = 'bg-info';
    switch (type) {
    case 'success':
        bgClass = 'bg-success';
        break;
    case 'warning':
        bgClass = 'bg-warning';
        break;
    case 'danger':
    case 'error':
        bgClass = 'bg-danger';
        break;
    default:
        bgClass = 'bg-info';
    }

    // Buat toast
    const toastId = 'toast-' + Date.now();
    const toastHtml = `
        <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true" data-bs-delay="5000">
            <div class="toast-header ${bgClass} text-white">
                <strong class="me-auto">${title}</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;

    // Tambahkan toast ke container dan tampilkan
    $('.toast-container').append(toastHtml);
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement);
    toast.show();

    // Hapus toast setelah ditutup
    $(toastElement).on('hidden.bs.toast', function() {
        $(this).remove();
    });
}

// Fungsi untuk format tanggal
function formatDate(dateString) {
    if (!dateString) return '';

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// Fungsi untuk format angka
function formatNumber(number) {
    if (number === null || number === undefined) return '';

    return new Intl.NumberFormat('id-ID').format(number);
}

// Fungsi untuk format uang
function formatCurrency(number) {
    if (number === null || number === undefined) return '';

    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(number);
}

// Fungsi untuk copy ke clipboard
function copyToClipboard(text) {
    // Buat elemen textarea sementara
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);

    // Pilih teks dan copy
    textarea.select();
    document.execCommand('copy');

    // Hapus elemen textarea
    document.body.removeChild(textarea);

    // Tampilkan notifikasi
    showToast('Info', 'Teks berhasil disalin ke clipboard', 'info');
}

// Fungsi untuk validasi input
function validateInput(input, rules) {
    // Reset pesan error
    $(input).removeClass('is-invalid');
    $(input).siblings('.invalid-feedback').remove();

    let isValid = true;
    let errorMessage = '';

    const value = $(input).val();

    // Cek aturan validasi
    if (rules.required && !value) {
        isValid = false;
        errorMessage = 'Field ini wajib diisi';
    } else if (rules.email && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        isValid = false;
        errorMessage = 'Format email tidak valid';
    } else if (rules.number && value && !/^\d+$/.test(value)) {
        isValid = false;
        errorMessage = 'Hanya boleh berisi angka';
    } else if (rules.min && value && value.length < rules.min) {
        isValid = false;
        errorMessage = `Minimal ${rules.min} karakter`;
    } else if (rules.max && value && value.length > rules.max) {
        isValid = false;
        errorMessage = `Maksimal ${rules.max} karakter`;
    }

    // Tampilkan pesan error jika tidak valid
    if (!isValid) {
        $(input).addClass('is-invalid');
        $(input).after(`<div class="invalid-feedback">${errorMessage}</div>`);
    }

    return isValid;
}

// Fungsi untuk validasi form
function validateForm(formSelector, rules) {
    let isValid = true;

    // Validasi setiap input
    for (const fieldName in rules) {
        const input = $(`${formSelector} [name="${fieldName}"]`);
        if (input.length && !validateInput(input, rules[fieldName])) {
            isValid = false;
        }
    }

    return isValid;
}

// Fungsi untuk mengambil data form sebagai objek
function getFormData(formSelector) {
    const formData = {};

    // Ambil semua input, select, dan textarea
    $(`${formSelector} input, ${formSelector} select, ${formSelector} textarea`).each(function() {
        const input = $(this);
        const name = input.attr('name');

        if (name) {
            if (input.attr('type') === 'checkbox') {
                formData[name] = input.prop('checked');
            } else if (input.attr('type') === 'radio') {
                if (input.prop('checked')) {
                    formData[name] = input.val();
                }
            } else {
                formData[name] = input.val();
            }
        }
    });

    return formData;
}

// Fungsi untuk mengisi form dari objek
function fillFormData(formSelector, data) {
    // Isi semua input, select, dan textarea
    for (const fieldName in data) {
        const input = $(`${formSelector} [name="${fieldName}"]`);

        if (input.length) {
            if (input.attr('type') === 'checkbox') {
                input.prop('checked', Boolean(data[fieldName]));
            } else if (input.attr('type') === 'radio') {
                $(`${formSelector} [name="${fieldName}"][value="${data[fieldName]}"]`).prop('checked', true);
            } else {
                input.val(data[fieldName]);
            }
        }
    }
}

// Fungsi untuk reset form
function resetForm(formSelector) {
    $(formSelector)[0].reset();
    $(`${formSelector} .is-invalid`).removeClass('is-invalid');
    $(`${formSelector} .invalid-feedback`).remove();
}

// Fungsi untuk konfirmasi
function confirmAction(title, message, callback) {
    // Buat modal konfirmasi jika belum ada
    if ($('#confirmModal').length === 0) {
        const modalHtml = `
            <div class="modal fade" id="confirmModal" tabindex="-1" aria-labelledby="confirmModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="confirmModalLabel">Konfirmasi</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body" id="confirmModalBody">
                            Apakah Anda yakin?
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Batal</button>
                            <button type="button" class="btn btn-primary" id="confirmModalYesBtn">Ya</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        $('body').append(modalHtml);
    }

    // Update judul dan pesan
    $('#confirmModalLabel').text(title);
    $('#confirmModalBody').text(message);

    // Tampilkan modal
    const confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
    confirmModal.show();

    // Event handler untuk tombol Ya
    $('#confirmModalYesBtn').off('click').on('click', function() {
        confirmModal.hide();
        if (typeof callback === 'function') {
            callback();
        }
    });
}

// Fungsi untuk deteksi koneksi internet
function checkInternetConnection() {
    return navigator.onLine;
}

// Event listener untuk perubahan status koneksi
window.addEventListener('online', function() {
    showToast('Info', 'Koneksi internet tersedia kembali', 'success');
});

window.addEventListener('offline', function() {
    showToast('Warning', 'Koneksi internet terputus', 'warning');
});