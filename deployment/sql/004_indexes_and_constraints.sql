USE [$(DatabaseName)];
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Employee_BadgeNumberNormalized' AND object_id = OBJECT_ID(N'kiosk.Employee'))
BEGIN
    CREATE UNIQUE INDEX UX_Employee_BadgeNumberNormalized ON kiosk.Employee (BadgeNumberNormalized);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Device_DeviceGuid' AND object_id = OBJECT_ID(N'kiosk.Device'))
BEGIN
    CREATE UNIQUE INDEX UX_Device_DeviceGuid ON kiosk.Device (DeviceGuid) WHERE DeviceGuid IS NOT NULL;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Event_EventName' AND object_id = OBJECT_ID(N'kiosk.Event'))
BEGIN
    CREATE UNIQUE INDEX UX_Event_EventName ON kiosk.Event (EventName);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_SyncBatch_BatchGuid' AND object_id = OBJECT_ID(N'kiosk.SyncBatch'))
BEGIN
    CREATE UNIQUE INDEX UX_SyncBatch_BatchGuid ON kiosk.SyncBatch (BatchGuid);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_BadgeScan_DeviceScanGuid' AND object_id = OBJECT_ID(N'kiosk.BadgeScan'))
BEGIN
    CREATE UNIQUE INDEX UX_BadgeScan_DeviceScanGuid ON kiosk.BadgeScan (DeviceScanGuid);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_BadgeScan_DuplicateLookup' AND object_id = OBJECT_ID(N'kiosk.BadgeScan'))
BEGIN
    CREATE INDEX IX_BadgeScan_DuplicateLookup ON kiosk.BadgeScan (BadgeNumberNormalized, DeviceId, EventId, ScanUtc DESC);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_BadgeScan_ReviewFilter' AND object_id = OBJECT_ID(N'kiosk.BadgeScan'))
BEGIN
    CREATE INDEX IX_BadgeScan_ReviewFilter ON kiosk.BadgeScan (ScanUtc DESC, EventId, DeviceId, ScanStatus, SyncStatus) INCLUDE (BadgeNumberNormalized, EmpId, EmployeeNameSnapshot, DeviceDisplayName);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_DeviceAssignment_Current' AND object_id = OBJECT_ID(N'kiosk.DeviceAssignment'))
BEGIN
    CREATE INDEX IX_DeviceAssignment_Current ON kiosk.DeviceAssignment (DeviceId, EffectiveToUtc, EffectiveFromUtc DESC);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_BadgeScan_ScanStatus')
BEGIN
    ALTER TABLE kiosk.BadgeScan ADD CONSTRAINT CK_BadgeScan_ScanStatus CHECK (ScanStatus IN (N'MATCHED', N'UNKNOWN', N'INACTIVE'));
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_BadgeScan_SyncStatus')
BEGIN
    ALTER TABLE kiosk.BadgeScan ADD CONSTRAINT CK_BadgeScan_SyncStatus CHECK (SyncStatus IN (N'PENDING', N'SYNCED', N'FAILED', N'SUPPRESSED'));
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_ImportRun_Status')
BEGIN
    ALTER TABLE kiosk.ImportRun ADD CONSTRAINT CK_ImportRun_Status CHECK (Status IN (N'STARTED', N'SUCCEEDED', N'FAILED', N'PARTIAL'));
END;
GO
