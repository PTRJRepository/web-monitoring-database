/**
 * Modul Notification
 * Menangani semua operasi terkait notifikasi
 */

const NotificationModule = (function() {
    // Private variables
    const toastContainer = '.toast-container';
    
    /**
     * Inisialisasi modul
     */
    function init() {
        // Pastikan container toast ada
        ensureToastContainer();
    }
    
    /**
     * Pastikan container toast ada
     */
    function ensureToastContainer() {
        if (!document.querySelector(toastContainer)) {
            const container = document.createElement('div');
            container.className = 'toast-container position-fixed top-0 end-0 p-3';
            document.body.appendChild(container);
        }
    }
    
    /**
     * Buat toast notification
     * @param {string} type - Tipe notifikasi (success, error, warning, info)
     * @param {string} title - Judul notifikasi
     * @param {string} message - Pesan notifikasi
     * @param {number} duration - Durasi tampil dalam milidetik (default: 5000)
     */
    function createToast(type, title, message, duration = 5000) {
        // Pastikan container toast ada
        ensureToastContainer();
        
        // Tentukan warna berdasarkan tipe
        let bgColor = 'bg-primary';
        let icon = 'info-circle';
        
        switch (type) {
            case 'success':
                bgColor = 'bg-success';
                icon = 'check-circle';
                break;
            case 'error':
                bgColor = 'bg-danger';
                icon = 'exclamation-circle';
                break;
            case 'warning':
                bgColor = 'bg-warning';
                icon = 'exclamation-triangle';
                break;
            case 'info':
                bgColor = 'bg-info';
                icon = 'info-circle';
                break;
        }
        
        // Buat elemen toast
        const toastId = 'toast-' + Date.now();
        const toastEl = document.createElement('div');
        toastEl.className = 'toast';
        toastEl.id = toastId;
        toastEl.setAttribute('role', 'alert');
        toastEl.setAttribute('aria-live', 'assertive');
        toastEl.setAttribute('aria-atomic', 'true');
        
        // Isi toast
        toastEl.innerHTML = `
            <div class="toast-header ${bgColor} text-white">
                <i class="fas fa-${icon} me-2"></i>
                <strong class="me-auto">${title}</strong>
                <small>${new Date().toLocaleTimeString()}</small>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        `;
        
        // Tambahkan ke container
        document.querySelector(toastContainer).appendChild(toastEl);
        
        // Inisialisasi toast
        const toast = new bootstrap.Toast(toastEl, {
            autohide: true,
            delay: duration
        });
        
        // Tampilkan toast
        toast.show();
        
        // Hapus toast dari DOM setelah disembunyikan
        toastEl.addEventListener('hidden.bs.toast', function() {
            toastEl.remove();
        });
    }
    
    // Public API
    return {
        init: init,
        createToast: createToast
    };
})();

// Export modul
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationModule;
} else {
    window.NotificationModule = NotificationModule;
    window.createToast = NotificationModule.createToast; // Untuk kompatibilitas
} 