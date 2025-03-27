/**
 * Filter Toggle Module
 * Modul reusable untuk mengimplementasikan filter toggle pada semua tab monitoring
 */

const FilterToggleModule = (function() {
    // Private variables
    let activeFilters = {};
    let tabFilters = {};
    let currentTab = null;
    let dataTablesInstances = {};
    let filterFunctions = {}; // Store custom filter functions for each table
    let lastFilterTime = {}; // Store last filter time to prevent multiple rapid filtering
    
    /**
     * Column name mappings to handle different naming conventions
     * This allows the filter to work with different column name variations
     */
    const columnNameMappings = {
        // FROMOCCODE variations
        'FROMOCCODE': ['Fromcode', 'FROMCODE', 'FromOcCode'],
        'Fromcode': ['FROMOCCODE', 'FROMCODE', 'FromOcCode'],
        'FROMCODE': ['FROMOCCODE', 'Fromcode', 'FromOcCode'],
        
        // TOOCCODE variations
        'TOOCCODE': ['TOOcode', 'TOOCODE'],
        'TOOcode': ['TOOCCODE', 'TOOCODE'],
        
        // SCANNERUSERCODE variations
        'SCANNERUSERCODE': ['ScannerUserCode', 'SCANNERCODE', 'Scanner'],
        
        // Other potential mappings
        'FIELDNO': ['FieldNo', 'FIELD_NO'],
        'JOBCODE': ['Jobcde', 'JOBCDE']
    };

    /**
     * Get all possible column names based on mappings
     * @param {string} columnName - Original column name
     * @returns {array} Array of possible column names
     */
    function getAllPossibleColumnNames(columnName) {
        const result = [columnName]; // Always include the original name
        
        // Add mapped names if they exist
        if (columnNameMappings[columnName]) {
            result.push(...columnNameMappings[columnName]);
        }
        
        // Check if this column appears as a value in other mappings
        Object.keys(columnNameMappings).forEach(key => {
            if (key !== columnName && columnNameMappings[key].includes(columnName)) {
                result.push(key);
            }
        });
        
        return result;
    }

    /**
     * Inisialisasi filter untuk tab tertentu
     * @param {string} tabId - ID tab yang akan diinisialisasi
     * @param {array} filterConfig - Konfigurasi filter (kategori dan nilai-nilainya)
     */
    function initializeTabFilter(tabId, filterConfig) {
        if (!tabFilters[tabId]) {
            tabFilters[tabId] = {};
        }
        
        // Setup filter untuk setiap kategori
        filterConfig.forEach(category => {
            if (!tabFilters[tabId][category.field]) {
                tabFilters[tabId][category.field] = {};
            }
            
            // Set nilai default (aktif) untuk setiap nilai filter
            category.values.forEach(value => {
                tabFilters[tabId][category.field][value] = true;
            });
        });
        
        console.log(`Filter untuk tab ${tabId} berhasil diinisialisasi:`, tabFilters[tabId]);
    }
    
    /**
     * Merender filter bubble pada container
     * @param {string} tabId - ID tab target
     * @param {string} containerId - ID container untuk menempatkan filter
     */
    function renderFilterBubbles(tabId, containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container dengan ID ${containerId} tidak ditemukan`);
            return;
        }
        
        // Kosongkan container
        container.innerHTML = '';
        
        // Filter header
        const filterHeader = document.createElement('div');
        filterHeader.className = 'filter-header';
        filterHeader.innerHTML = '<span class="filter-label">Filter Data:</span>';
        container.appendChild(filterHeader);
        
        // Tambahkan filter untuk setiap kategori
        const tabFilterData = tabFilters[tabId];
        if (!tabFilterData) {
            console.error(`Filter untuk tab ${tabId} belum diinisialisasi`);
            return;
        }
        
        // Counter untuk filter yang tidak aktif
        let inactiveFilterCount = 0;
        
        Object.keys(tabFilterData).forEach(category => {
            // Container untuk kategori
            const categoryContainer = document.createElement('div');
            categoryContainer.className = 'filter-category';
            
            // Label kategori
            const categoryLabel = document.createElement('div');
            categoryLabel.className = 'category-label';
            categoryLabel.textContent = category + ':';
            categoryContainer.appendChild(categoryLabel);
            
            // Nilai-nilai filter
            const valuesContainer = document.createElement('div');
            valuesContainer.className = 'filter-values';
            
            Object.keys(tabFilterData[category]).forEach(value => {
                const isActive = tabFilterData[category][value];
                
                // Count inactive filters
                if (!isActive) {
                    inactiveFilterCount++;
                }
                
                const bubble = document.createElement('div');
                bubble.className = `filter-bubble ${isActive ? 'active' : 'inactive'}`;
                bubble.dataset.category = category;
                bubble.dataset.value = value;
                bubble.dataset.tabId = tabId;
                bubble.textContent = value;
                
                // Set background color berdasarkan kategori
                if (category === 'TOOCCODE') {
                    if (isActive) {
                        bubble.style.backgroundColor = value === 'ARC' ? '#36b9cc' : 
                                                    value === 'P2A' ? '#f6c23e' : 
                                                    value === 'DME' ? '#6f42c1' : '#4a6cf7';
                    } else {
                        bubble.style.backgroundColor = '#e9ecef';
                    }
                } else if (category === 'SCANNERUSERCODE') {
                    if (isActive) {
                        bubble.style.backgroundColor = '#ff9800';
                    } else {
                        bubble.style.backgroundColor = '#e9ecef';
                    }
                } else if (tabId === 'gwscanner-duplicate') {
                    // Special color scheme for gwscanner-duplicate
                    if (isActive) {
                        // Different color for different categories
                        if (category === 'TOOcode') {
                            bubble.style.backgroundColor = '#28a745'; // Green
                        } else if (category === 'Fromcode') {
                            bubble.style.backgroundColor = '#dc3545'; // Red
                        } else if (category === 'FieldNo') {
                            bubble.style.backgroundColor = '#17a2b8'; // Teal
                        } else if (category === 'Jobcde') {
                            bubble.style.backgroundColor = '#6610f2'; // Purple
                        } else {
                            bubble.style.backgroundColor = '#007bff'; // Blue (default)
                        }
                    } else {
                        bubble.style.backgroundColor = '#e9ecef';
                    }
                }
                
                // Event listener untuk toggle filter
                bubble.addEventListener('click', function(event) {
                    // Prevent default behavior
                    event.preventDefault();
                    event.stopPropagation();
                    
                    // Force immediate visual update before toggle to ensure user feedback
                    const currentIsActive = tabFilters[tabId][category][value];
                    if (currentIsActive) {
                        // Going to inactive
                        this.style.backgroundColor = '#e9ecef';
                        this.style.color = '#6c757d';
                        this.style.textDecoration = 'line-through';
                        this.classList.remove('active');
                        this.classList.add('inactive');
                    } else {
                        // Going to active
                        if (category === 'TOOCCODE') {
                            this.style.backgroundColor = value === 'ARC' ? '#36b9cc' : 
                                                    value === 'P2A' ? '#f6c23e' : 
                                                    value === 'DME' ? '#6f42c1' : '#4a6cf7';
                        } else if (category === 'SCANNERUSERCODE') {
                            this.style.backgroundColor = '#ff9800';
                        } else if (tabId === 'gwscanner-duplicate') {
                            // Special color scheme for gwscanner-duplicate
                            if (category === 'TOOcode') {
                                this.style.backgroundColor = '#28a745'; // Green
                            } else if (category === 'Fromcode') {
                                this.style.backgroundColor = '#dc3545'; // Red
                            } else if (category === 'FieldNo') {
                                this.style.backgroundColor = '#17a2b8'; // Teal
                            } else if (category === 'Jobcde') {
                                this.style.backgroundColor = '#6610f2'; // Purple
                            } else {
                                this.style.backgroundColor = '#007bff'; // Blue (default)
                            }
                        }
                        this.style.color = 'white';
                        this.style.textDecoration = 'none';
                        this.classList.remove('inactive');
                        this.classList.add('active');
                    }
                    
                    // Now toggle the actual filter value
                    toggleFilter(tabId, category, value);
                    
                    // Update filter counter
                    updateFilterCounter(tabId, containerId);
                    
                    // For GWScanner duplicate, don't apply filter immediately due to large data
                    if (tabId !== 'gwscanner-duplicate') {
                        // Apply filter with a small delay to ensure immediate visual feedback
                        window.requestAnimationFrame(() => {
                            applyFilter(tabId);
                        });
                    }
                    
                    // Log for debugging
                    console.log(`Filter clicked on tab ${tabId}: ${category} - ${value}, new state: ${tabFilters[tabId][category][value]}`);
                });
                
                valuesContainer.appendChild(bubble);
            });
            
            categoryContainer.appendChild(valuesContainer);
            container.appendChild(categoryContainer);
        });
        
        // Filter counter
        const filterCounter = document.createElement('div');
        filterCounter.className = 'filter-counter';
        filterCounter.id = `${tabId}-filter-counter`;
        if (inactiveFilterCount > 0) {
            filterCounter.innerHTML = `<span class="badge bg-primary">${inactiveFilterCount} filter aktif</span>`;
        }
        container.appendChild(filterCounter);
        
        // Container for buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'filter-buttons mt-2 d-flex gap-2';
        
        // For GWScanner duplicate, add apply button
        if (tabId === 'gwscanner-duplicate') {
            // Tambahkan tombol apply
            const applyButton = document.createElement('button');
            applyButton.className = 'btn btn-sm btn-primary apply-filter-btn';
            applyButton.innerHTML = '<i class="fas fa-check me-1"></i>Terapkan Filter';
            applyButton.addEventListener('click', function(event) {
                // Prevent default and stop propagation
                event.preventDefault();
                event.stopPropagation();
                
                // Show loading indicator
                showLoadingIndicator(tabId);
                
                // Apply filter from database
                applyFilterFromDatabase(tabId);
            });
            
            buttonContainer.appendChild(applyButton);
        }
        
        // Tambahkan tombol reset
        const resetButton = document.createElement('button');
        resetButton.className = 'btn btn-sm btn-outline-secondary reset-filter-btn';
        resetButton.innerHTML = '<i class="fas fa-sync-alt me-1"></i>Reset Filter';
        resetButton.addEventListener('click', function(event) {
            // Prevent default and stop propagation
            event.preventDefault();
            event.stopPropagation();
            
            resetFilters(tabId);
            renderFilterBubbles(tabId, containerId);
            
            // For GWScanner duplicate, reload all data
            if (tabId === 'gwscanner-duplicate') {
                showLoadingIndicator(tabId);
                applyFilterFromDatabase(tabId);
            } else {
                applyFilter(tabId);
            }
        });
        
        buttonContainer.appendChild(resetButton);
        container.appendChild(buttonContainer);
        
        console.log(`Filter bubbles untuk tab ${tabId} berhasil dirender`);
    }
    
    /**
     * Update filter counter
     * @param {string} tabId - ID tab
     * @param {string} containerId - ID container
     */
    function updateFilterCounter(tabId, containerId) {
        const counterId = `${tabId}-filter-counter`;
        const counterEl = document.getElementById(counterId);
        if (!counterEl) return;
        
        // Count inactive filters
        let inactiveFilterCount = 0;
        const tabFilterData = tabFilters[tabId];
        
        if (tabFilterData) {
            Object.keys(tabFilterData).forEach(category => {
                Object.keys(tabFilterData[category]).forEach(value => {
                    if (!tabFilterData[category][value]) {
                        inactiveFilterCount++;
                    }
                });
            });
        }
        
        // Update counter display
        if (inactiveFilterCount > 0) {
            counterEl.innerHTML = `<span class="badge bg-primary">${inactiveFilterCount} filter aktif</span>`;
        } else {
            counterEl.innerHTML = '';
        }
    }
    
    /**
     * Toggle filter status
     * @param {string} tabId - ID tab
     * @param {string} category - Kategori filter
     * @param {string} value - Nilai filter
     */
    function toggleFilter(tabId, category, value) {
        // Cek apakah filter sudah diinisialisasi
        if (!tabFilters[tabId] || !tabFilters[tabId][category]) {
            console.error(`Filter ${category} for tab ${tabId} belum diinisialisasi`);
            return false;
        }
        
        // Toggle nilai (aktif <-> nonaktif)
        tabFilters[tabId][category][value] = !tabFilters[tabId][category][value];
        
        // Log for debugging
        console.log(`Toggle filter pada tab ${tabId}: ${category} - ${value} menjadi ${tabFilters[tabId][category][value]}`);
        
        // Store this filter time to prevent multiple rapid filtering
        lastFilterTime[tabId] = Date.now();
        
        // Return success
        return true;
    }
    
    /**
     * Reset semua filter untuk tab tertentu
     * @param {string} tabId - ID tab
     */
    function resetFilters(tabId) {
        if (!tabFilters[tabId]) return;
        
        Object.keys(tabFilters[tabId]).forEach(category => {
            Object.keys(tabFilters[tabId][category]).forEach(value => {
                tabFilters[tabId][category][value] = true;
            });
        });
        
        console.log(`Filter untuk tab ${tabId} direset`);
    }
    
    /**
     * Mendaftarkan DataTable untuk tab tertentu
     * @param {string} tabId - ID tab
     * @param {object} tableInstance - Instance DataTable
     */
    function registerDataTable(tabId, tableInstance) {
        if (!tableInstance) {
            console.warn(`DataTable instance untuk ${tabId} tidak valid`);
            return;
        }
        
        dataTablesInstances[tabId] = tableInstance;
        
        // Tambahkan custom filter function untuk DataTable
        setupCustomDataTableFilter(tabId, tableInstance);
        
        console.log(`DataTable untuk ${tabId} berhasil didaftarkan`, tableInstance);
    }
    
    /**
     * Menyiapkan custom filter function untuk DataTables
     * @param {string} tabId - ID tab
     * @param {object} tableInstance - Instance DataTable
     */
    function setupCustomDataTableFilter(tabId, tableInstance) {
        if (!tableInstance) return;
        
        // Hapus custom filter sebelumnya jika ada
        clearCustomDataTableFilter(tabId);
        
        // Buat custom filter function baru
        filterFunctions[tabId] = function(settings, data, dataIndex) {
            // Get the actual table node
            const tableNode = settings.nTable;
            const tableId = tableNode.id;
            
            // Log for debugging in GWScanner duplicate tab
            if (tabId.includes('gwscanner') || tableId.includes('gwscanner')) {
                console.log(`Filtering table ${tableId} for tab ${tabId}`, {
                    settings, 
                    dataIndex,
                    rowData: data
                });
            }
            
            // Skip jika ini bukan tabel yang kita cari (cek dengan berbagai cara)
            // 1. Exact ID matching
            const isTargetTable = tableId === tabId + '-table' || 
                                 tableId === tabId + 'Table' ||
                                 tableId === tabId + '_table';
                                 
            // 2. Check if table is within the target tab's panel
            const isInTabPanel = tableNode.closest(`.tab-pane#${tabId}-data`) !== null;
            
            // 3. Special case for GWScanner duplicate
            const isGWScannerDuplicate = tabId.includes('gwscanner') && tableId.includes('gwscanner');
            
            if (!isTargetTable && !isInTabPanel && !isGWScannerDuplicate) {
                return true; // Not our target table, don't filter
            }
            
            // Skip jika filter belum diinisialisasi
            if (!tabFilters[tabId]) {
                return true;
            }
            
            // Periksa setiap kategori filter
            let showRow = true;
            const tabFilterData = tabFilters[tabId];
            
            Object.keys(tabFilterData).forEach(category => {
                // Temukan indeks kolom untuk kategori ini
                const columnIndex = findDataTableColumnIndex(settings, category);
                if (columnIndex === -1) return; // Skip jika kolom tidak ditemukan
                
                const cellValue = data[columnIndex];
                // Check if there's a filter for this value
                if (cellValue && tabFilterData[category].hasOwnProperty(cellValue)) {
                    const isValueActive = tabFilterData[category][cellValue];
                    
                    // Jika nilai tidak aktif dalam filter, sembunyikan baris
                    if (isValueActive === false) {
                        showRow = false;
                    }
                }
            });
            
            return showRow;
        };
        
        // Daftarkan ke DataTables
        if ($.fn.dataTable && $.fn.dataTable.ext && $.fn.dataTable.ext.search) {
            $.fn.dataTable.ext.search.push(filterFunctions[tabId]);
            console.log(`Custom filter untuk DataTable ${tabId} berhasil didaftarkan`);
        } else {
            console.warn('DataTables API tidak tersedia untuk mendaftarkan custom filter');
        }
    }
    
    /**
     * Menghapus custom filter function untuk DataTables
     * @param {string} tabId - ID tab
     */
    function clearCustomDataTableFilter(tabId) {
        if (filterFunctions[tabId] && $.fn.dataTable && $.fn.dataTable.ext && $.fn.dataTable.ext.search) {
            // Hapus filter function dari DataTables
            const index = $.fn.dataTable.ext.search.indexOf(filterFunctions[tabId]);
            if (index !== -1) {
                $.fn.dataTable.ext.search.splice(index, 1);
            }
            
            console.log(`Custom filter untuk DataTable ${tabId} berhasil dihapus`);
        }
    }
    
    /**
     * Menerapkan filter pada tabel
     * @param {string} tabId - ID tab yang filternya akan diterapkan
     */
    function applyFilter(tabId) {
        // Anti-bounce mechanism - prevent rapid filtering
        const now = Date.now();
        if (lastFilterTime[tabId] && now - lastFilterTime[tabId] < 100) {
            console.log(`Skipping filter application - too soon since last filter (${now - lastFilterTime[tabId]}ms)`);
            return;
        }
        
        // Coba dapatkan DataTable instance
        const tableInstance = dataTablesInstances[tabId];
        
        // Cek apakah filter sudah diinisialisasi
        const tabFilterData = tabFilters[tabId];
        if (!tabFilterData) {
            console.error(`Filter untuk ${tabId} belum diinisialisasi`);
            return;
        }
        
        console.log(`Menerapkan filter untuk tab ${tabId}`);
        
        // Special handling for GWScanner duplicate tab
        if (tabId.includes('gwscanner')) {
            applyGWScannerFilter(tabId);
            return;
        }
        
        // Jika tableInstance adalah DataTable, gunakan custom filter
        if (tableInstance) {
            console.log(`Applying filter to DataTable instance for tab ${tabId}`);
            
            // Pastikan custom filter sudah setup
            setupCustomDataTableFilter(tabId, tableInstance);
            
            // Apply search dan redraw table
            tableInstance.draw();
            
            console.log(`DataTable untuk tab ${tabId} berhasil di-redraw dengan filter applied`);
        } else {
            // Jika bukan DataTable, coba cari tabel HTML biasa
            console.log(`Tidak menemukan DataTable instance untuk tab ${tabId}, mencoba filter HTML standar`);
            applyFilterToHtmlTable(tabId);
        }
        
        // Update indicator jika ada
        updateFilterIndicator(tabId);
        
        // Record last filter time
        lastFilterTime[tabId] = now;
    }
    
    /**
     * Menerapkan filter khusus untuk GWScanner duplicate tab
     * @param {string} tabId - ID tab
     */
    function applyGWScannerFilter(tabId) {
        // Try to find any tables in the GWScanner tab
        const gwscannerTables = document.querySelectorAll('.tab-pane[id*="gwscanner"] table, #gwscanner-container table, [id*="gwscanner"] table');
        
        if (gwscannerTables.length === 0) {
            console.log('No GWScanner tables found');
            return;
        }
        
        console.log(`Found ${gwscannerTables.length} GWScanner tables`);
        
        // Loop through all found tables
        gwscannerTables.forEach((tableEl, index) => {
            console.log(`Processing GWScanner table ${index + 1}`, tableEl);
            
            // Check if this table is a DataTable
            let dataTable;
            try {
                dataTable = $(tableEl).DataTable({retrieve: true});
                if (dataTable) {
                    console.log(`Table ${index + 1} is a DataTable, forcing redraw`);
                    
                    // Force a more aggressive redraw for GWScanner duplicate
                    if (tabId === 'gwscanner-duplicate') {
                        // Clear any existing search and then redraw
                        dataTable.search('').columns().search('').draw();
                        
                        // Special handling for duplicate tab - set custom filtering function 
                        setupGWScannerDuplicateFilter(tabId, dataTable);
                        
                        // Then force draw again
                        dataTable.draw();
                    } else {
                        dataTable.draw();
                    }
                }
            } catch (e) {
                console.log(`Table ${index + 1} is not a DataTable, applying HTML filtering`);
                
                // Apply HTML filtering
                const tabFilterData = tabFilters[tabId];
                const rows = tableEl.querySelectorAll('tbody tr');
                
                // Find column indices for filter categories
                const columnIndices = {};
                const headerCells = tableEl.querySelectorAll('thead th');
                
                Object.keys(tabFilterData).forEach(category => {
                    for (let i = 0; i < headerCells.length; i++) {
                        const headerText = headerCells[i].textContent.trim();
                        // Handle both naming conventions: FROMOCCODE and Fromcode
                        if (headerText === category || 
                            (category === 'FROMOCCODE' && headerText === 'Fromcode') ||
                            (category === 'Fromcode' && headerText === 'FROMOCCODE')) {
                            columnIndices[category] = i;
                            break;
                        }
                    }
                });
                
                // Apply filtering to each row
                let visibleRows = 0;
                const totalRows = rows.length;
                
                rows.forEach(row => {
                    let showRow = true;
                    
                    Object.keys(tabFilterData).forEach(category => {
                        const columnIndex = columnIndices[category];
                        if (columnIndex === undefined) return;
                        
                        const cell = row.cells[columnIndex];
                        if (!cell) return;
                        
                        const cellValue = cell.textContent.trim();
                        if (cellValue && tabFilterData[category].hasOwnProperty(cellValue)) {
                            const isValueActive = tabFilterData[category][cellValue];
                            
                            if (isValueActive === false) {
                                showRow = false;
                            }
                        }
                    });
                    
                    row.style.display = showRow ? '' : 'none';
                    if (showRow) visibleRows++;
                });
                
                console.log(`Filtered ${totalRows} rows, showing ${visibleRows} rows`);
            }
        });
    }
    
    /**
     * Set up special filter for GWScanner duplicate
     * @param {string} tabId - Tab ID
     * @param {object} tableInstance - DataTable instance
     */
    function setupGWScannerDuplicateFilter(tabId, tableInstance) {
        if (!tableInstance || !tabFilters[tabId]) return;
        
        console.log(`Setting up GWScanner duplicate filter for tab ${tabId}`, tableInstance);
        
        // Clear existing search on all columns first
        tableInstance.columns().search('').draw(false);
        
        // Get the filter data
        const tabFilterData = tabFilters[tabId];
        
        // For each category that has inactive filters
        Object.keys(tabFilterData).forEach(category => {
            // Find all values that are inactive
            const inactiveValues = [];
            Object.keys(tabFilterData[category]).forEach(value => {
                if (!tabFilterData[category][value]) {
                    inactiveValues.push(value);
                }
            });
            
            // If there are inactive values, build search string
            if (inactiveValues.length > 0) {
                // Try to find column index using all possible name variations
                let columnIndex = -1;
                const possibleNames = getAllPossibleColumnNames(category);
                
                // Try each possible column name
                for (const name of possibleNames) {
                    const tempIndex = findDataTableColumnByName(tableInstance, name);
                    if (tempIndex !== -1) {
                        columnIndex = tempIndex;
                        console.log(`Found column ${name} at index ${columnIndex} for filter ${category}`);
                        break;
                    }
                }
                
                if (columnIndex !== -1) {
                    console.log(`Applying filter to column ${category} (${columnIndex}) to exclude values:`, inactiveValues);
                    
                    try {
                        // Apply search, but only draw once at the end
                        applyRegexFilterToColumn(tableInstance, columnIndex, inactiveValues, false);
                    } catch (error) {
                        console.error(`Error applying filter to column ${category}:`, error);
                        
                        // Fallback to direct filtering
                        const regexPattern = `^(?!(${inactiveValues.join('|')})$).*$`;
                        tableInstance.column(columnIndex).search(regexPattern, true, false);
                    }
                } else {
                    console.warn(`Column ${category} not found in the table. Tried variations: ${possibleNames.join(', ')}`);
                }
            }
        });
        
        // Final draw after all filters are set
        try {
            console.log('Drawing table with all filters applied');
            tableInstance.draw();
            
            // Log visible rows for debugging
            const visibleRows = tableInstance.rows({search:'applied'}).nodes().length;
            const totalRows = tableInstance.rows().nodes().length;
            console.log(`Filter applied: ${visibleRows} rows visible out of ${totalRows} total rows`);
        } catch (error) {
            console.error('Error drawing table:', error);
        }
        
        console.log('Applied all filters to GWScanner duplicate table');
    }
    
    /**
     * Find DataTable column index by column name
     * @param {object} tableInstance - DataTable instance
     * @param {string} columnName - Name of column to find
     * @returns {number} Column index or -1 if not found
     */
    function findDataTableColumnByName(tableInstance, columnName) {
        const columns = tableInstance.columns().header().toArray();
        
        for (let i = 0; i < columns.length; i++) {
            if (columns[i].textContent.trim() === columnName) {
                return i;
            }
        }
        
        return -1;
    }
    
    /**
     * Apply regex filter to column to exclude values
     * @param {object} tableInstance - DataTable instance
     * @param {number} columnIndex - Index of column to filter
     * @param {array} valuesToExclude - Values to exclude
     * @param {boolean} doDraw - Whether to draw table after filtering
     */
    function applyRegexFilterToColumn(tableInstance, columnIndex, valuesToExclude, doDraw = true) {
        if (!tableInstance || valuesToExclude.length === 0) return;
        
        // Build negative lookahead regex to exclude specific values
        // Format: ^(?!value1$|value2$|value3$).*$
        const regexPattern = `^(?!(${valuesToExclude.join('|')})$).*$`;
        
        // Apply regex search to column
        tableInstance.column(columnIndex).search(regexPattern, true, false);
        
        // Only draw if specified
        if (doDraw) {
            tableInstance.draw();
        }
    }
    
    /**
     * Menambahkan indikator filter yang sedang aktif
     * @param {string} tabId - ID tab
     */
    function updateFilterIndicator(tabId) {
        const tabFilterData = tabFilters[tabId];
        if (!tabFilterData) return;
        
        // Cek apakah ada filter yang tidak aktif
        let hasInactiveFilter = false;
        let inactiveFilters = [];
        
        Object.keys(tabFilterData).forEach(category => {
            Object.keys(tabFilterData[category]).forEach(value => {
                if (!tabFilterData[category][value]) {
                    hasInactiveFilter = true;
                    inactiveFilters.push({ category, value });
                }
            });
        });
        
        // Tampilkan toast atau notifikasi jika ada filter yang tidak aktif
        if (hasInactiveFilter && typeof $ !== 'undefined') {
            // Hapus toast sebelumnya jika ada
            $('.filter-toast').remove();
            
            // Buat toast untuk filter yang aktif
            const toast = $(`
                <div class="position-fixed bottom-0 end-0 p-3" style="z-index: 5">
                    <div class="toast show filter-toast" role="alert" aria-live="assertive" aria-atomic="true">
                        <div class="toast-header bg-primary text-white">
                            <strong class="me-auto">Filter Aktif</strong>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
                        </div>
                        <div class="toast-body">
                            <p class="mb-1">Filter sedang diterapkan:</p>
                            <ul class="mb-0 ps-3">
                                ${inactiveFilters.map(f => `<li>${f.category}: <strong>${f.value}</strong> tidak ditampilkan</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
            `);
            
            // Tambahkan ke body
            $('body').append(toast);
            
            // Otomatis hilangkan setelah 5 detik
            setTimeout(() => {
                $('.filter-toast').fadeOut(500, function() {
                    $(this).remove();
                });
            }, 5000);
        }
    }
    
    /**
     * Menerapkan filter ke tabel HTML biasa (non-DataTables)
     * @param {string} tabId - ID tab
     */
    function applyFilterToHtmlTable(tabId) {
        // Cari tabel berdasarkan beberapa kemungkinan ID
        let tableEl = document.getElementById(tabId + '-table');
        
        // Coba cari tabel berdasarkan container jika ID tidak ditemukan
        if (!tableEl) {
            const container = document.getElementById(tabId + '-container');
            if (container) {
                tableEl = container.querySelector('table');
            }
        }
        
        // Coba cari dengan selector yang lebih umum
        if (!tableEl) {
            tableEl = document.querySelector(`.tab-pane#${tabId}-data table`);
        }
        
        // Try more aggressive selectors
        if (!tableEl) {
            tableEl = document.querySelector(`[id*="${tabId}"] table`);
        }
        
        if (!tableEl) {
            console.error(`Tabel untuk tab ${tabId} tidak ditemukan`);
            return;
        }
        
        const tabFilterData = tabFilters[tabId];
        const rows = tableEl.querySelectorAll('tbody tr');
        
        // Debug informasi
        console.log(`Menerapkan filter ke ${rows.length} baris tabel HTML untuk tab ${tabId}`);
        
        // Cari indeks kolom untuk setiap kategori filter
        const columnIndices = {};
        const headerCells = tableEl.querySelectorAll('thead th');
        
        // Map header text to column index
        for (let i = 0; i < headerCells.length; i++) {
            const headerText = headerCells[i].textContent.trim();
            columnIndices[headerText] = i;
        }
        
        console.log('Column indices:', columnIndices);
        
        // Filter baris tabel
        let visibleRows = 0;
        const totalRows = rows.length;
        
        rows.forEach(row => {
            const showRow = shouldShowRow(row, tabFilterData, columnIndices);
            
            // Update row visibility
            row.style.display = showRow ? '' : 'none';
            if (showRow) visibleRows++;
        });
        
        console.log(`Filtered ${totalRows} rows, showing ${visibleRows} rows (${Math.round(visibleRows/totalRows*100)}%)`);
    }
    
    /**
     * Apply filtering to each row
     * @param {HTMLElement} row - Table row element
     * @param {object} tabFilterData - Filter data for current tab
     * @param {object} columnIndices - Map of column names to indices
     * @returns {boolean} Whether row should be shown
     */
    function shouldShowRow(row, tabFilterData, columnIndices) {
        let showRow = true;
        
        Object.keys(tabFilterData).forEach(category => {
            // Try to find column index, handling name variations
            let columnIndex = columnIndices[category];
            
            // If column index not found directly, try alternate names
            if (columnIndex === undefined) {
                const possibleNames = getAllPossibleColumnNames(category);
                
                // Try each possible name
                for (const altName of possibleNames) {
                    if (columnIndices[altName] !== undefined) {
                        columnIndex = columnIndices[altName];
                        console.log(`Found alternate column name ${altName} for ${category}`);
                        break;
                    }
                }
            }
            
            if (columnIndex === undefined) return; // Skip if column still not found
            
            const cell = row.cells[columnIndex];
            if (!cell) return;
            
            const cellValue = cell.textContent.trim();
            if (cellValue && tabFilterData[category].hasOwnProperty(cellValue)) {
                const isValueActive = tabFilterData[category][cellValue];
                
                if (isValueActive === false) {
                    showRow = false;
                }
            }
        });
        
        return showRow;
    }
    
    /**
     * Mengekstrak nilai unik dari kolom tabel
     * @param {string} tabId - ID tab
     * @param {string} columnName - Nama kolom
     * @returns {array} Array nilai unik
     */
    function extractUniqueValues(tabId, columnName) {
        // Cari tabel dengan berbagai kemungkinan ID
        let tableEl = document.getElementById(tabId + '-table');
        
        if (!tableEl) {
            const container = document.getElementById(tabId + '-container');
            if (container) {
                tableEl = container.querySelector('table');
            }
        }
        
        if (!tableEl) {
            tableEl = document.querySelector(`.tab-pane#${tabId}-data table`);
        }
        
        if (!tableEl) {
            tableEl = document.querySelector(`[id*="${tabId}"] table`);
        }
        
        if (!tableEl) {
            console.error(`Tabel untuk tab ${tabId} tidak ditemukan`);
            return [];
        }
        
        // Temukan indeks kolom
        const headerCells = tableEl.querySelectorAll('thead th');
        let columnIndex = -1;
        
        for (let i = 0; i < headerCells.length; i++) {
            if (headerCells[i].textContent.trim() === columnName) {
                columnIndex = i;
                break;
            }
        }
        
        if (columnIndex === -1) {
            console.warn(`Kolom ${columnName} tidak ditemukan dalam tabel ${tabId}`);
            return [];
        }
        
        // Ekstrak nilai unik
        const uniqueValues = new Set();
        const rows = tableEl.querySelectorAll('tbody tr');
        
        rows.forEach(row => {
            if (columnIndex < row.cells.length) {
                const cell = row.cells[columnIndex];
                if (cell) {
                    const value = cell.textContent.trim();
                    if (value) {
                        uniqueValues.add(value);
                    }
                }
            }
        });
        
        return Array.from(uniqueValues);
    }
    
    /**
     * Mendeteksi filter berdasarkan data yang ada di tabel
     * @param {string} tabId - ID tab
     * @param {array} columns - Array nama kolom yang akan dijadikan filter
     */
    function detectAndInitializeFilters(tabId, columns) {
        const filterConfig = [];
        
        columns.forEach(column => {
            const uniqueValues = extractUniqueValues(tabId, column);
            
            if (uniqueValues.length > 0) {
                filterConfig.push({
                    field: column,
                    values: uniqueValues
                });
            }
        });
        
        if (filterConfig.length > 0) {
            initializeTabFilter(tabId, filterConfig);
            console.log(`Filter otomatis untuk tab ${tabId} berhasil dideteksi:`, filterConfig);
        }
        
        return filterConfig;
    }
    
    /**
     * Mendapatkan nilai default untuk filter jika tidak ada data
     * @returns {array} Konfigurasi filter default
     */
    function getDefaultFilterConfig() {
        return [
            {
                field: 'TOOCCODE',
                values: ['P2A', 'ARC', 'DME']
            },
            {
                field: 'SCANNERUSERCODE',
                values: ['C0485', 'J0474', 'J0180']
            }
        ];
    }
    
    /**
     * Mendapatkan nilai default untuk GWScanner duplicate jika tidak ada data
     * @returns {array} Konfigurasi filter default untuk GWScanner duplicate
     */
    function getGWScannerDuplicateFilterConfig() {
        return [
            {
                field: 'TOOcode',
                values: ['201', '202', '203', '204', '205']
            },
            {
                field: 'Fromcode',
                values: ['DUPLICATE', 'MANUAL', 'AUTO']
            },
            {
                field: 'FieldNo',
                values: ['1', '2', '3', '4', '5']
            },
            {
                field: 'Jobcde',
                values: ['C0485', 'J0474', 'J0180']
            }
        ];
    }
    
    // Public API
    return {
        init: function(tabId, filterContainerId, filterConfig) {
            console.log(`Inisialisasi filter toggle untuk tab ${tabId}`);
            currentTab = tabId;
            
            if (filterConfig) {
                // Gunakan konfigurasi filter yang disediakan
                initializeTabFilter(tabId, filterConfig);
            } else if (tabId === 'gwscanner-duplicate') {
                // Khusus untuk GWScanner duplicate, gunakan auto-detect atau config khusus
                const duplicateColumns = ['TOOcode', 'Fromcode', 'FieldNo', 'Jobcde'];
                const autoFilterConfig = detectAndInitializeFilters(tabId, duplicateColumns);
                
                // Jika tidak ada filter yang terdeteksi, gunakan nilai default khusus
                if (autoFilterConfig.length === 0) {
                    console.log("Tidak ada filter duplicate terdeteksi, menggunakan nilai default untuk GWScanner duplicate");
                    initializeTabFilter(tabId, getGWScannerDuplicateFilterConfig());
                }
            } else {
                // Deteksi filter otomatis berdasarkan kolom TOOCCODE dan SCANNERUSERCODE
                const autoFilterConfig = detectAndInitializeFilters(tabId, ['TOOCCODE', 'SCANNERUSERCODE']);
                
                // Jika tidak ada filter yang terdeteksi, gunakan nilai default
                if (autoFilterConfig.length === 0) {
                    console.log("Tidak ada filter otomatis terdeteksi, menggunakan nilai default");
                    initializeTabFilter(tabId, getDefaultFilterConfig());
                }
            }
            
            // Render filter bubbles
            renderFilterBubbles(tabId, filterContainerId);
            
            // Special treatment for GWScanner tabs
            if (tabId.includes('gwscanner')) {
                // Try to find and register any DataTables in this tab
                setTimeout(() => {
                    findAndRegisterGWScannerTables(tabId);
                }, 500);
            }
            
            // Terapkan filter awal setelah sedikit delay
            setTimeout(() => {
                applyFilter(tabId);
            }, 500);
        },
        
        registerTable: function(tabId, tableInstance) {
            registerDataTable(tabId, tableInstance);
            
            // Terapkan filter setelah mendaftarkan tabel
            setTimeout(() => {
                applyFilter(tabId);
            }, 100);
        },
        
        toggleFilter: function(tabId, category, value) {
            const success = toggleFilter(tabId, category, value);
            if (success) {
                applyFilter(tabId);
            }
        },
        
        reset: function(tabId) {
            resetFilters(tabId);
            applyFilter(tabId);
        },
        
        getActiveFilters: function(tabId) {
            return tabFilters[tabId] || {};
        },
        
        getFilterConfig: function(tabId) {
            const config = [];
            const tabFilterData = tabFilters[tabId];
            
            if (tabFilterData) {
                Object.keys(tabFilterData).forEach(category => {
                    config.push({
                        field: category,
                        values: Object.keys(tabFilterData[category])
                    });
                });
            }
            
            return config;
        },
        
        refreshFilters: function(tabId, containerId) {
            // Re-render filter bubbles
            renderFilterBubbles(tabId, containerId);
            
            // Terapkan filter
            applyFilter(tabId);
        },
        
        // Special helper function for GWScanner tabs
        findAndRegisterGWScannerTables: findAndRegisterGWScannerTables
    };
    
    /**
     * Try to find and register any DataTables in GWScanner tabs
     * @param {string} tabId - Tab ID
     */
    function findAndRegisterGWScannerTables(tabId) {
        // Find all tables in GWScanner tabs
        const gwscannerTables = document.querySelectorAll('.tab-pane[id*="gwscanner"] table, #gwscanner-container table, [id*="gwscanner"] table');
        
        console.log(`Found ${gwscannerTables.length} potential GWScanner tables`);
        
        // Try to register each table as a DataTable
        gwscannerTables.forEach((tableEl, index) => {
            try {
                const dataTable = $(tableEl).DataTable({retrieve: true});
                if (dataTable) {
                    console.log(`Registering GWScanner table ${index + 1}`);
                    registerDataTable(tabId, dataTable);
                    
                    // Add special event listener for GWScanner duplicate
                    if (tabId === 'gwscanner-duplicate') {
                        // Add event listener for when DataTable is drawn
                        dataTable.on('draw.dt', function() {
                            console.log('GWScanner duplicate table was redrawn');
                            
                            // Apply any active filters
                            const activeFilters = getActiveInactiveFilters(tabId);
                            if (activeFilters.length > 0) {
                                console.log('Re-applying filters after draw:', activeFilters);
                                setupGWScannerDuplicateFilter(tabId, dataTable);
                            }
                        });
                    }
                }
            } catch (e) {
                console.log(`Table ${index + 1} is not a DataTable:`, e.message);
            }
        });
    }
    
    /**
     * Get list of filters that are inactive for a tab
     * @param {string} tabId - Tab ID
     * @returns {array} List of inactive filters
     */
    function getActiveInactiveFilters(tabId) {
        const result = [];
        const tabFilterData = tabFilters[tabId];
        
        if (!tabFilterData) return result;
        
        Object.keys(tabFilterData).forEach(category => {
            Object.keys(tabFilterData[category]).forEach(value => {
                if (!tabFilterData[category][value]) {
                    result.push({
                        category,
                        value
                    });
                }
            });
        });
        
        return result;
    }

    /**
     * Show loading indicator while filtering large data
     * @param {string} tabId - Tab ID 
     */
    function showLoadingIndicator(tabId) {
        // Find the table container
        const tableContainer = document.querySelector(`[id*="${tabId}"] .dataTables_wrapper`);
        if (!tableContainer) return;
        
        // Add overlay
        const overlay = document.createElement('div');
        overlay.className = 'filter-loading-overlay';
        overlay.innerHTML = `
            <div class="d-flex flex-column align-items-center">
                <div class="spinner-border text-primary mb-2" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <div>Menerapkan filter...</div>
            </div>
        `;
        
        // Add styles for overlay
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.zIndex = '1000';
        
        // Make sure parent is positioned to contain overlay
        tableContainer.style.position = 'relative';
        
        // Remove any existing overlay
        const existingOverlay = tableContainer.querySelector('.filter-loading-overlay');
        if (existingOverlay) {
            tableContainer.removeChild(existingOverlay);
        }
        
        // Add overlay to container
        tableContainer.appendChild(overlay);
    }

    /**
     * Hide loading indicator
     * @param {string} tabId - Tab ID
     */
    function hideLoadingIndicator(tabId) {
        // Find the table container
        const tableContainer = document.querySelector(`[id*="${tabId}"] .dataTables_wrapper`);
        if (!tableContainer) return;
        
        // Remove overlay
        const overlay = tableContainer.querySelector('.filter-loading-overlay');
        if (overlay) {
            setTimeout(() => {
                overlay.remove();
            }, 500); // Slight delay for better UX
        }
    }

    /**
     * Apply filter by loading data from database
     * @param {string} tabId - Tab ID
     */
    function applyFilterFromDatabase(tabId) {
        console.log(`Applying filter from database for ${tabId}`);
        
        // Get active filters
        const activeFilters = {};
        const tabFilterData = tabFilters[tabId];
        
        if (tabFilterData) {
            Object.keys(tabFilterData).forEach(category => {
                activeFilters[category] = [];
                
                Object.keys(tabFilterData[category]).forEach(value => {
                    // Only include active filters
                    if (tabFilterData[category][value]) {
                        activeFilters[category].push(value);
                    }
                });
            });
        }
        
        // Find table
        let table;
        try {
            const tableEl = document.querySelector(`[id*="${tabId}"] table`);
            if (tableEl) {
                try {
                    table = $(tableEl).DataTable({retrieve: true});
                    console.log('Successfully retrieved DataTable instance');
                } catch (e) {
                    console.warn('Error getting DataTable instance:', e);
                }
            }
        } catch (e) {
            console.error('Error finding table element:', e);
        }
        
        // If we have a DataTable instance
        if (table) {
            console.log('Using DataTable API for filtering');
            
            // Check if mockjax is available for testing
            if (typeof $.mockjax === 'function' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
                console.log('Using mockjax for local testing');
                
                // Show loading indicator
                showLoadingIndicator(tabId);
                
                // Clear table data
                table.clear().draw();
                
                // Simulate server-side filtering with mockjax
                simulateDataLoad(table, tabId);
            } else {
                // Prepare to fetch data
                const ajaxUrl = '/api/gwscanner-duplicate/data';
                
                // Create filter parameters for API
                const filterParams = {};
                Object.keys(activeFilters).forEach(category => {
                    if (activeFilters[category].length > 0) {
                        filterParams[category] = activeFilters[category].join(',');
                    }
                });
                
                // Disable existing AJAX call if ongoing
                if (window.gwscannerDuplicateXhr && window.gwscannerDuplicateXhr.readyState !== 4) {
                    window.gwscannerDuplicateXhr.abort();
                }
                
                // Clear table data
                table.clear().draw();
                
                try {
                    // Make AJAX call to get filtered data
                    window.gwscannerDuplicateXhr = $.ajax({
                        url: ajaxUrl,
                        type: 'GET',
                        data: filterParams,
                        dataType: 'json',
                        success: function(response) {
                            if (response && response.data) {
                                // Add new data to table
                                table.rows.add(response.data).draw();
                                
                                // Show success message
                                showFilterAppliedNotification(tabId, response.data.length);
                            } else {
                                console.error('No data returned from API');
                                
                                // Show error notification
                                showFilterErrorNotification(tabId, 'Tidak ada data yang dikembalikan dari API');
                                
                                // Try manual filtering as fallback
                                manuallyFilterGWScannerDuplicateTable(tabId);
                            }
                            
                            // Hide loading indicator
                            hideLoadingIndicator(tabId);
                        },
                        error: function(xhr, status, error) {
                            console.error('Error fetching filtered data:', error);
                            
                            // For development/testing or if the API fails, simulate data or use manual filtering
                            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                                console.log('Using simulated data for local development');
                                simulateDataLoad(table, tabId);
                            } else {
                                console.log('Using manual filtering as fallback');
                                manuallyFilterGWScannerDuplicateTable(tabId);
                                
                                // Show notification
                                showFilterAppliedNotification(tabId, "filter diterapkan");
                            }
                            
                            // Hide loading indicator
                            hideLoadingIndicator(tabId);
                        }
                    });
                    
                    console.log('Sent filter request to server with params:', filterParams);
                } catch (ajaxError) {
                    console.error('AJAX call failed:', ajaxError);
                    
                    // Fallback to manual filtering
                    manuallyFilterGWScannerDuplicateTable(tabId);
                    
                    // Hide loading indicator
                    hideLoadingIndicator(tabId);
                    
                    // Show notification
                    showFilterAppliedNotification(tabId, "filter diterapkan (mode manual)");
                }
            }
        } else {
            console.warn('No DataTable found, using manual filtering');
            
            // Fallback to manual filtering
            manuallyFilterGWScannerDuplicateTable(tabId);
            
            // Hide loading indicator if it was shown
            hideLoadingIndicator(tabId);
            
            // Show notification
            showFilterAppliedNotification(tabId, "filter diterapkan (mode manual)");
        }
    }

    /**
     * Show notification when filter is applied
     * @param {string} tabId - Tab ID
     * @param {number} rowCount - Number of rows returned
     */
    function showFilterAppliedNotification(tabId, rowCount) {
        if (typeof $ === 'undefined') return;
        
        // Remove existing toast
        $('.filter-applied-toast').remove();
        
        // Create toast
        const toast = $(`
            <div class="position-fixed bottom-0 end-0 p-3" style="z-index: 5">
                <div class="toast show filter-applied-toast" role="alert" aria-live="assertive" aria-atomic="true">
                    <div class="toast-header bg-success text-white">
                        <strong class="me-auto">Filter Diterapkan</strong>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
                    </div>
                    <div class="toast-body">
                        <p class="mb-0">Filter berhasil diterapkan. Menampilkan ${rowCount} data.</p>
                    </div>
                </div>
            </div>
        `);
        
        // Add to body
        $('body').append(toast);
        
        // Auto hide after 5 seconds
        setTimeout(() => {
            $('.filter-applied-toast').fadeOut(500, function() {
                $(this).remove();
            });
        }, 5000);
    }

    /**
     * Show error notification when filter fails
     * @param {string} tabId - Tab ID
     * @param {string} errorMessage - Error message
     */
    function showFilterErrorNotification(tabId, errorMessage) {
        if (typeof $ === 'undefined') return;
        
        // Remove existing toast
        $('.filter-error-toast').remove();
        
        // Create toast
        const toast = $(`
            <div class="position-fixed bottom-0 end-0 p-3" style="z-index: 5">
                <div class="toast show filter-error-toast" role="alert" aria-live="assertive" aria-atomic="true">
                    <div class="toast-header bg-danger text-white">
                        <strong class="me-auto">Error Filter</strong>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
                    </div>
                    <div class="toast-body">
                        <p class="mb-0">${errorMessage}</p>
                    </div>
                </div>
            </div>
        `);
        
        // Add to body
        $('body').append(toast);
        
        // Auto hide after 5 seconds
        setTimeout(() => {
            $('.filter-error-toast').fadeOut(500, function() {
                $(this).remove();
            });
        }, 5000);
    }

    /**
     * Simulate data load for testing/development
     * @param {object} table - DataTable instance
     * @param {string} tabId - Tab ID
     */
    function simulateDataLoad(table, tabId) {
        console.log('Simulating data load for development/testing');
        
        // Get active filters
        const activeFilters = {};
        const tabFilterData = tabFilters[tabId];
        
        if (tabFilterData) {
            Object.keys(tabFilterData).forEach(category => {
                activeFilters[category] = [];
                
                Object.keys(tabFilterData[category]).forEach(value => {
                    // Only include active filters
                    if (tabFilterData[category][value]) {
                        activeFilters[category].push(value);
                    }
                });
            });
        }
        
        // Create random data based on active filters
        const sampleData = [];
        const rowCount = Math.floor(Math.random() * 50) + 10; // 10-60 rows
        
        // Get column names from table
        const columnNames = [];
        table.columns().header().each(function(header) {
            columnNames.push($(header).text().trim());
        });
        
        // Generate sample data
        for (let i = 0; i < rowCount; i++) {
            const row = [];
            
            columnNames.forEach(columnName => {
                let value = '';
                
                // Use active filter values for filter columns
                if (activeFilters[columnName] && activeFilters[columnName].length > 0) {
                    // Pick a random value from active filters
                    const randomIndex = Math.floor(Math.random() * activeFilters[columnName].length);
                    value = activeFilters[columnName][randomIndex];
                } else {
                    // Generate random value for other columns
                    switch(columnName) {
                        case 'TOOcode':
                            value = ['201', '202', '203', '204', '205'][Math.floor(Math.random() * 5)];
                            break;
                        case 'Fromcode':
                            value = ['DUPLICATE', 'MANUAL', 'AUTO'][Math.floor(Math.random() * 3)];
                            break;
                        case 'FieldNo':
                            value = (Math.floor(Math.random() * 5) + 1).toString();
                            break;
                        case 'Jobcde':
                            value = ['C0485', 'J0474', 'J0180'][Math.floor(Math.random() * 3)];
                            break;
                        case 'Date':
                            value = new Date().toISOString().split('T')[0];
                            break;
                        case 'Time':
                            value = new Date().toTimeString().split(' ')[0];
                            break;
                        default:
                            value = 'Value_' + (Math.floor(Math.random() * 1000) + 1);
                    }
                }
                
                row.push(value);
            });
            
            sampleData.push(row);
        }
        
        // Add data to table
        setTimeout(() => {
            table.rows.add(sampleData).draw();
            
            // Show success message
            showFilterAppliedNotification(tabId, sampleData.length);
            
            // Hide loading indicator
            hideLoadingIndicator(tabId);
        }, 1500); // Simulate server delay
    }

    // Add a new function for manual filtering of GWScanner duplicate data
    function manuallyFilterGWScannerDuplicateTable(tabId) {
        console.log(`Manually filtering GWScanner duplicate table for tab ${tabId}`);
        
        // Find all tables that might be relevant to GWScanner duplicate
        const tables = document.querySelectorAll('.tab-pane[id*="gwscanner"] table, #gwscanner-container table, [id*="gwscanner"] table');
        
        if (tables.length === 0) {
            console.warn('No GWScanner tables found');
            return;
        }
        
        console.log(`Found ${tables.length} potential GWScanner tables for manual filtering`);
        
        // Get the filter data
        const tabFilterData = tabFilters[tabId];
        if (!tabFilterData) {
            console.warn(`No filter data for tab ${tabId}`);
            return;
        }
        
        // Process each table
        tables.forEach((table, index) => {
            console.log(`Processing table ${index + 1} for manual filtering`);
            
            // Check if the table has a thead
            const thead = table.querySelector('thead');
            if (!thead) {
                console.warn(`Table ${index + 1} has no thead, skipping`);
                return;
            }
            
            // Find column indices for each filter category
            const columnIndices = {};
            const headerCells = thead.querySelectorAll('th');
            
            Object.keys(tabFilterData).forEach(category => {
                for (let i = 0; i < headerCells.length; i++) {
                    if (headerCells[i].textContent.trim() === category) {
                        columnIndices[category] = i;
                        break;
                    }
                }
                
                if (columnIndices[category] === undefined) {
                    console.warn(`Column ${category} not found in table ${index + 1}`);
                }
            });
            
            // Get all rows
            const rows = table.querySelectorAll('tbody tr');
            console.log(`Found ${rows.length} rows in table ${index + 1}`);
            
            // Filter each row
            let visibleRowCount = 0;
            rows.forEach(row => {
                let showRow = true;
                
                // Check each filter category
                Object.keys(tabFilterData).forEach(category => {
                    const columnIndex = columnIndices[category];
                    if (columnIndex === undefined) return;
                    
                    const cell = row.cells[columnIndex];
                    if (!cell) return;
                    
                    const cellValue = cell.textContent.trim();
                    
                    // Check if this value has a filter and if the filter is inactive
                    if (cellValue && tabFilterData[category].hasOwnProperty(cellValue) && !tabFilterData[category][cellValue]) {
                        showRow = false;
                    }
                });
                
                // Update row visibility
                if (showRow) {
                    row.style.display = '';
                    visibleRowCount++;
                } else {
                    row.style.display = 'none';
                }
            });
            
            console.log(`Manual filtering complete: ${visibleRowCount} rows visible out of ${rows.length} total rows`);
        });
    }

    /**
     * Find column index in DataTable settings, handling name variations
     * @param {object} settings - DataTable settings
     * @param {string} columnName - Name of column to find
     * @returns {number} Column index or -1 if not found
     */
    function findDataTableColumnIndex(settings, columnName) {
        if (!settings || !settings.aoColumns) return -1;
        
        // Get all possible column names
        const possibleNames = getAllPossibleColumnNames(columnName);
        
        // Try each column name
        for (let i = 0; i < settings.aoColumns.length; i++) {
            const column = settings.aoColumns[i];
            const title = column.sTitle || '';
            
            // Check if current column title matches any of the possible names
            if (possibleNames.some(name => title.trim() === name)) {
                console.log(`Found column ${columnName} at index ${i} (header: ${title})`);
                return i;
            }
        }
        
        console.warn(`Column ${columnName} not found. Tried these variations: ${possibleNames.join(', ')}`);
        return -1;
    }
})();

// Export module
window.FilterToggleModule = FilterToggleModule;

// Add a helper method to initialize DataTables for GWScanner
if (window.$ && window.$.fn && window.$.fn.DataTable) {
    // Run after a short delay to make sure the page has loaded
    setTimeout(() => {
        console.log("Looking for GWScanner tables to initialize filter...");
        const gwscannerTabs = ['gwscanner', 'gwscanner-duplicate'];
        
        gwscannerTabs.forEach(tabId => {
            const containerId = `${tabId}-filter-container`;
            const container = document.getElementById(containerId);
            
            if (container) {
                console.log(`Found filter container for ${tabId}, initializing...`);
                FilterToggleModule.init(tabId, containerId);
                FilterToggleModule.findAndRegisterGWScannerTables(tabId);
            } else {
                console.log(`No filter container found for ${tabId}`);
                
                // Create the filter container if it doesn't exist
                const tabPanel = document.querySelector(`.tab-pane[id*="${tabId}"]`);
                if (tabPanel) {
                    console.log(`Creating filter container for ${tabId}`);
                    const newContainer = document.createElement('div');
                    newContainer.id = containerId;
                    newContainer.className = 'filter-container mb-3';
                    
                    // Insert at beginning of tab panel
                    if (tabPanel.firstChild) {
                        tabPanel.insertBefore(newContainer, tabPanel.firstChild);
                    } else {
                        tabPanel.appendChild(newContainer);
                    }
                    
                    // Initialize filter
                    FilterToggleModule.init(tabId, containerId);
                    FilterToggleModule.findAndRegisterGWScannerTables(tabId);
                }
            }
        });
    }, 1000);
}

// Initialize FilterToggleModule on page load
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing FilterToggleModule with improved column name handling');
    
    // Find all tables that might need filters
    const tables = document.querySelectorAll('table');
    console.log(`Found ${tables.length} tables to check for filter initialization`);
    
    // Detect tables that have filterable columns
    tables.forEach((table, index) => {
        const tableId = table.id || `table-${index}`;
        console.log(`Checking table ${tableId} for filterable columns`);
        
        // Get header rows
        const headerCells = table.querySelectorAll('thead th');
        if (headerCells.length === 0) return;
        
        // Extract column names
        const columnNames = Array.from(headerCells).map(th => th.textContent.trim());
        console.log(`Table ${tableId} columns:`, columnNames);
        
        // Detect filterable columns using our mappings
        const filterableColumns = [];
        
        // Check each column to see if it matches any of our known filterable columns
        columnNames.forEach(columnName => {
            // Common columns to filter by
            const commonFilterColumns = [
                'FROMOCCODE', 'Fromcode', 'FROMCODE',
                'TOOCCODE', 'TOOcode', 
                'SCANNERUSERCODE', 'FIELDNO', 'JOBCODE'
            ];
            
            // Check if this column matches any of our common filter columns (including variations)
            for (const filterCol of commonFilterColumns) {
                const variations = getAllPossibleColumnNames(filterCol);
                if (variations.includes(columnName)) {
                    filterableColumns.push(columnName);
                    break;
                }
            }
        });
        
        // If we found filterable columns, initialize filter for this table
        if (filterableColumns.length > 0) {
            console.log(`Found ${filterableColumns.length} filterable columns in table ${tableId}:`, filterableColumns);
            
            // Create a unique tab ID for this table
            const tabId = `filter-${tableId}`;
            
            // Find or create filter container
            let containerId = `${tabId}-container`;
            let filterContainer = document.getElementById(containerId);
            
            if (!filterContainer) {
                // Create a container before the table
                filterContainer = document.createElement('div');
                filterContainer.id = containerId;
                filterContainer.className = 'filter-container mb-3';
                
                // Add before table
                table.parentNode.insertBefore(filterContainer, table);
            }
            
            // Extract unique values for each filterable column
            const filterConfig = [];
            
            filterableColumns.forEach(columnName => {
                const uniqueValues = new Set();
                
                // Get all rows in the table body
                const rows = table.querySelectorAll('tbody tr');
                
                // Find the column index
                const columnIndex = Array.from(headerCells).findIndex(th => th.textContent.trim() === columnName);
                
                if (columnIndex !== -1) {
                    // Extract unique values from this column
                    rows.forEach(row => {
                        const cell = row.cells[columnIndex];
                        if (cell) {
                            const value = cell.textContent.trim();
                            if (value) uniqueValues.add(value);
                        }
                    });
                    
                    // Add to filter config
                    if (uniqueValues.size > 0) {
                        filterConfig.push({
                            field: columnName,
                            values: Array.from(uniqueValues)
                        });
                    }
                }
            });
            
            // Initialize filter
            if (filterConfig.length > 0) {
                console.log(`Initializing filter for table ${tableId} with config:`, filterConfig);
                
                // Initialize with our module
                if (typeof window.FilterToggleModule !== 'undefined') {
                    window.FilterToggleModule.init(tabId, containerId, filterConfig);
                    
                    // Try to register as DataTable if available
                    try {
                        if ($.fn.DataTable) {
                            const dataTable = $(table).DataTable({retrieve: true});
                            if (dataTable) {
                                window.FilterToggleModule.registerTable(tabId, dataTable);
                            }
                        }
                    } catch (e) {
                        console.log(`Table ${tableId} is not a DataTable:`, e.message);
                    }
                }
            }
        }
    });
}); 