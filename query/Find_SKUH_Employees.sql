SELECT 
    e.EmpCode,
    e.PosCode,
    e.SalGradeCode,
    e.AppJoinDate,
    e.AppJoinGrpDate,
    e.LastCPDateFrom,
    e.LastCPDateTo,
    e.TerminateDate,
    CASE 
        WHEN e.TerminateDate IS NULL THEN 'Aktif'
        ELSE 'Tidak Aktif'
    END AS StatusKaryawan,
    e.CompCode,
    e.LocCode,
    e.DeptCode,
    e.LevelCode,
    e.RptTo,
    e.MechInd,
    e.SalSchemeCode,
    e.BlackListDate,
    e.Probation,
    e.ConfirmDate,
    e.HolSchedule,
    e.AnnualLeave,
    e.SickLeave,
    e.BFLeave,
    e.InsuranceInd,
    e.InsuranceNo,
    e.OffDay,
    e.Remark,
    e.ShiftCode,
    e.IsGangLeader,
    e.ProrateAttdIncInd,
    e.FirstMthWorkDay,
    e.OldEmpCode,
    e.LeaveSchemeCode,
    e.VLPStatus
FROM 
    [db_ptrj].[dbo].[HR_EMPLOYMENT] e
WHERE 
    e.SalGradeCode = 'SKUH'
ORDER BY 
    e.EmpCode
