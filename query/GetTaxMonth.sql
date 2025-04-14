-- Deklarasi variabel global untuk informasi proses
DECLARE @ProcessDate DATETIME;
DECLARE @ProcessMonthNumber INT;
DECLARE @ProcessMonthName NVARCHAR(20);
DECLARE @ProcessYear INT;
DECLARE @LastProcessDate DATETIME;

-- Mendapatkan data dari SH_MTHEND dengan ModuleCode = 8
SELECT TOP 1
    @ProcessMonthNumber = NextAccMonth,
    @ProcessYear = CurrAccYear,
    @LastProcessDate = LastProcessDate
FROM 
    [db_ptrj].[dbo].[SH_MTHEND]
WHERE 
    ModuleCode = 8
ORDER BY 
    UpdateDate DESC;

-- Konversi NextAccMonth (1-12) ke bulan kalender (4-3)
DECLARE @CalendarMonth INT = CASE
    WHEN @ProcessMonthNumber = 1 THEN 4  -- April
    WHEN @ProcessMonthNumber = 2 THEN 5  -- Mei
    WHEN @ProcessMonthNumber = 3 THEN 6  -- Juni
    WHEN @ProcessMonthNumber = 4 THEN 7  -- Juli
    WHEN @ProcessMonthNumber = 5 THEN 8  -- Agustus
    WHEN @ProcessMonthNumber = 6 THEN 9  -- September
    WHEN @ProcessMonthNumber = 7 THEN 10 -- Oktober
    WHEN @ProcessMonthNumber = 8 THEN 11 -- November
    WHEN @ProcessMonthNumber = 9 THEN 12 -- Desember
    WHEN @ProcessMonthNumber = 10 THEN 1 -- Januari
    WHEN @ProcessMonthNumber = 11 THEN 2 -- Februari
    WHEN @ProcessMonthNumber = 12 THEN 3 -- Maret
END;

-- Menyesuaikan tahun jika bulan adalah Januari-Maret
IF @CalendarMonth < 4
BEGIN
    SET @ProcessYear = @ProcessYear + 1;
END

-- Membuat tanggal proses (menggunakan hari pertama bulan)
SET @ProcessDate = DATEFROMPARTS(@ProcessYear, @CalendarMonth, 1);

-- Mendapatkan nama bulan
SET @ProcessMonthName = DATENAME(MONTH, @ProcessDate);

-- Menampilkan hasil
SELECT 
    @ProcessMonthNumber AS NextAccMonth,
    @CalendarMonth AS CalendarMonth,
    @ProcessMonthName AS ProcessMonthName,
    @ProcessYear AS ProcessYear,
    @ProcessDate AS ProcessDate,
    @LastProcessDate AS LastProcessDate;
