USE [$(DatabaseName)];
GO

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = N'kiosk')
BEGIN
    EXEC('CREATE SCHEMA kiosk AUTHORIZATION dbo');
END;
GO

IF OBJECT_ID(N'kiosk.Employee', N'U') IS NULL
BEGIN
    CREATE TABLE kiosk.Employee (
        EmployeeId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Employee PRIMARY KEY,
        EmpId nvarchar(50) NULL,
        SourceEmployeeKey nvarchar(100) NULL,
        BadgeNumberRaw nvarchar(100) NOT NULL,
        BadgeNumberNormalized nvarchar(100) NOT NULL,
        EmployeeName nvarchar(200) NOT NULL,
        IsActive bit NOT NULL CONSTRAINT DF_Employee_IsActive DEFAULT (1),
        LastImportedUtc datetime2(0) NULL,
        CreatedUtc datetime2(0) NOT NULL CONSTRAINT DF_Employee_CreatedUtc DEFAULT (SYSUTCDATETIME()),
        UpdatedUtc datetime2(0) NOT NULL CONSTRAINT DF_Employee_UpdatedUtc DEFAULT (SYSUTCDATETIME())
    );
END;
GO

IF OBJECT_ID(N'kiosk.Device', N'U') IS NULL
BEGIN
    CREATE TABLE kiosk.Device (
        DeviceId nvarchar(100) NOT NULL CONSTRAINT PK_Device PRIMARY KEY,
        DeviceGuid uniqueidentifier NULL,
        DeviceName nvarchar(200) NOT NULL,
        IsActive bit NOT NULL CONSTRAINT DF_Device_IsActive DEFAULT (1),
        RegisteredUtc datetime2(0) NOT NULL CONSTRAINT DF_Device_RegisteredUtc DEFAULT (SYSUTCDATETIME()),
        UpdatedUtc datetime2(0) NOT NULL CONSTRAINT DF_Device_UpdatedUtc DEFAULT (SYSUTCDATETIME())
    );
END;
GO

IF OBJECT_ID(N'kiosk.Event', N'U') IS NULL
BEGIN
    CREATE TABLE kiosk.Event (
        EventId uniqueidentifier NOT NULL CONSTRAINT PK_Event PRIMARY KEY,
        EventName nvarchar(200) NOT NULL,
        IsActive bit NOT NULL CONSTRAINT DF_Event_IsActive DEFAULT (1),
        CreatedUtc datetime2(0) NOT NULL CONSTRAINT DF_Event_CreatedUtc DEFAULT (SYSUTCDATETIME()),
        UpdatedUtc datetime2(0) NOT NULL CONSTRAINT DF_Event_UpdatedUtc DEFAULT (SYSUTCDATETIME())
    );
END;
GO

IF OBJECT_ID(N'kiosk.DeviceAssignment', N'U') IS NULL
BEGIN
    CREATE TABLE kiosk.DeviceAssignment (
        DeviceAssignmentId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_DeviceAssignment PRIMARY KEY,
        DeviceId nvarchar(100) NOT NULL,
        EventId uniqueidentifier NULL,
        EffectiveFromUtc datetime2(0) NOT NULL CONSTRAINT DF_DeviceAssignment_EffectiveFromUtc DEFAULT (SYSUTCDATETIME()),
        EffectiveToUtc datetime2(0) NULL,
        AssignedBy nvarchar(100) NULL,
        CreatedUtc datetime2(0) NOT NULL CONSTRAINT DF_DeviceAssignment_CreatedUtc DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_DeviceAssignment_Device FOREIGN KEY (DeviceId) REFERENCES kiosk.Device(DeviceId),
        CONSTRAINT FK_DeviceAssignment_Event FOREIGN KEY (EventId) REFERENCES kiosk.Event(EventId)
    );
END;
GO

IF OBJECT_ID(N'kiosk.SyncBatch', N'U') IS NULL
BEGIN
    CREATE TABLE kiosk.SyncBatch (
        SyncBatchId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_SyncBatch PRIMARY KEY,
        BatchGuid uniqueidentifier NOT NULL,
        DeviceId nvarchar(100) NOT NULL,
        SubmittedUtc datetime2(0) NOT NULL,
        ReceivedUtc datetime2(0) NOT NULL CONSTRAINT DF_SyncBatch_ReceivedUtc DEFAULT (SYSUTCDATETIME()),
        TotalScanCount int NOT NULL CONSTRAINT DF_SyncBatch_TotalScanCount DEFAULT (0),
        SucceededCount int NOT NULL CONSTRAINT DF_SyncBatch_SucceededCount DEFAULT (0),
        FailedCount int NOT NULL CONSTRAINT DF_SyncBatch_FailedCount DEFAULT (0),
        Status nvarchar(30) NOT NULL CONSTRAINT DF_SyncBatch_Status DEFAULT (N'RECEIVED'),
        ErrorMessage nvarchar(max) NULL,
        CONSTRAINT FK_SyncBatch_Device FOREIGN KEY (DeviceId) REFERENCES kiosk.Device(DeviceId)
    );
END;
GO

IF OBJECT_ID(N'kiosk.BadgeScan', N'U') IS NULL
BEGIN
    CREATE TABLE kiosk.BadgeScan (
        BadgeScanId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_BadgeScan PRIMARY KEY,
        DeviceScanGuid uniqueidentifier NOT NULL,
        SyncBatchId bigint NULL,
        DeviceId nvarchar(100) NOT NULL,
        DeviceGuid uniqueidentifier NULL,
        EventId uniqueidentifier NULL,
        EventNameSnapshot nvarchar(200) NULL,
        EmployeeId int NULL,
        EmpId nvarchar(50) NULL,
        BadgeNumberRaw nvarchar(100) NOT NULL,
        BadgeNumberNormalized nvarchar(100) NOT NULL,
        EmployeeNameSnapshot nvarchar(200) NULL,
        ScanStatus nvarchar(30) NOT NULL,
        SyncStatus nvarchar(30) NOT NULL,
        ScanUtc datetime2(0) NOT NULL,
        DeviceLocalUtc datetime2(0) NOT NULL,
        IsOfflineCaptured bit NOT NULL CONSTRAINT DF_BadgeScan_IsOfflineCaptured DEFAULT (0),
        SyncAttemptCount int NOT NULL CONSTRAINT DF_BadgeScan_SyncAttemptCount DEFAULT (0),
        LastSyncAttemptUtc datetime2(0) NULL,
        SyncErrorMessage nvarchar(1000) NULL,
        DeviceDisplayName nvarchar(200) NULL,
        SuppressedReason nvarchar(100) NULL,
        DuplicateOfBadgeScanId bigint NULL,
        CreatedUtc datetime2(0) NOT NULL CONSTRAINT DF_BadgeScan_CreatedUtc DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_BadgeScan_SyncBatch FOREIGN KEY (SyncBatchId) REFERENCES kiosk.SyncBatch(SyncBatchId),
        CONSTRAINT FK_BadgeScan_Device FOREIGN KEY (DeviceId) REFERENCES kiosk.Device(DeviceId),
        CONSTRAINT FK_BadgeScan_Event FOREIGN KEY (EventId) REFERENCES kiosk.Event(EventId),
        CONSTRAINT FK_BadgeScan_Employee FOREIGN KEY (EmployeeId) REFERENCES kiosk.Employee(EmployeeId),
        CONSTRAINT FK_BadgeScan_DuplicateOf FOREIGN KEY (DuplicateOfBadgeScanId) REFERENCES kiosk.BadgeScan(BadgeScanId)
    );
END;
GO

IF OBJECT_ID(N'kiosk.AdminConfig', N'U') IS NULL
BEGIN
    CREATE TABLE kiosk.AdminConfig (
        AdminConfigId int IDENTITY(1,1) NOT NULL CONSTRAINT PK_AdminConfig PRIMARY KEY,
        AdminPinHash nvarchar(255) NOT NULL,
        JwtSecret nvarchar(255) NOT NULL,
        CurrentVersion nvarchar(50) NULL,
        DuplicateWindowSeconds int NOT NULL CONSTRAINT DF_AdminConfig_DuplicateWindowSeconds DEFAULT (30),
        LastUpdatedUtc datetime2(0) NOT NULL CONSTRAINT DF_AdminConfig_LastUpdatedUtc DEFAULT (SYSUTCDATETIME())
    );
END;
GO

IF OBJECT_ID(N'kiosk.ImportRun', N'U') IS NULL
BEGIN
    CREATE TABLE kiosk.ImportRun (
        ImportRunId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ImportRun PRIMARY KEY,
        StartedUtc datetime2(0) NOT NULL CONSTRAINT DF_ImportRun_StartedUtc DEFAULT (SYSUTCDATETIME()),
        EndedUtc datetime2(0) NULL,
        Status nvarchar(30) NOT NULL,
        SourceSystem nvarchar(100) NOT NULL CONSTRAINT DF_ImportRun_SourceSystem DEFAULT (N'AccessControl'),
        TriggeredBy nvarchar(50) NOT NULL CONSTRAINT DF_ImportRun_TriggeredBy DEFAULT (N'Scheduler'),
        InsertedCount int NOT NULL CONSTRAINT DF_ImportRun_InsertedCount DEFAULT (0),
        UpdatedCount int NOT NULL CONSTRAINT DF_ImportRun_UpdatedCount DEFAULT (0),
        InactivatedCount int NOT NULL CONSTRAINT DF_ImportRun_InactivatedCount DEFAULT (0),
        ErrorCount int NOT NULL CONSTRAINT DF_ImportRun_ErrorCount DEFAULT (0),
        Message nvarchar(max) NULL
    );
END;
GO
