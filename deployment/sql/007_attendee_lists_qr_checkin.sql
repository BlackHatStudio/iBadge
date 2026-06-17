USE [$(DatabaseName)];
GO

IF OBJECT_ID(N'dbo.AttendeeList', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AttendeeList (
        AttendeeListID int IDENTITY(1,1) NOT NULL CONSTRAINT PK_AttendeeList PRIMARY KEY,
        ListName nvarchar(150) NOT NULL,
        Description nvarchar(500) NULL,
        IsActive bit NOT NULL CONSTRAINT DF_AttendeeList_IsActive DEFAULT (1),
        CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_AttendeeList_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CreatedBy nvarchar(150) NULL,
        UpdatedAt datetime2(0) NULL,
        UpdatedBy nvarchar(150) NULL
    );
END;
GO

IF OBJECT_ID(N'dbo.Attendee', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Attendee (
        AttendeeID int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Attendee PRIMARY KEY,
        AttendeeListID int NOT NULL,
        BadgeNumber nvarchar(50) NULL,
        FirstName nvarchar(100) NOT NULL,
        LastName nvarchar(100) NOT NULL,
        Email nvarchar(254) NOT NULL,
        PhoneNumber nvarchar(50) NULL,
        Company nvarchar(150) NULL,
        CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_Attendee_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CreatedBy nvarchar(150) NULL,
        UpdatedAt datetime2(0) NULL,
        UpdatedBy nvarchar(150) NULL,
        DeletedAt datetime2(0) NULL,
        DeletedBy nvarchar(150) NULL,
        CONSTRAINT FK_Attendee_AttendeeList FOREIGN KEY (AttendeeListID) REFERENCES dbo.AttendeeList(AttendeeListID)
    );
END;
GO

IF OBJECT_ID(N'dbo.AttendeeQrToken', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AttendeeQrToken (
        QrTokenID int IDENTITY(1,1) NOT NULL CONSTRAINT PK_AttendeeQrToken PRIMARY KEY,
        AttendeeID int NOT NULL,
        TokenHash varbinary(64) NOT NULL,
        ExpiresAtUtc datetime2(0) NULL,
        SentAtUtc datetime2(0) NULL,
        LastSentAtUtc datetime2(0) NULL,
        SendCount int NOT NULL CONSTRAINT DF_AttendeeQrToken_SendCount DEFAULT (0),
        LastSendStatus nvarchar(50) NULL,
        LastSendError nvarchar(1000) NULL,
        RevokedAtUtc datetime2(0) NULL,
        RevokedBy nvarchar(150) NULL,
        CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_AttendeeQrToken_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CreatedBy nvarchar(150) NULL,
        UpdatedAt datetime2(0) NULL,
        UpdatedBy nvarchar(150) NULL,
        CONSTRAINT FK_AttendeeQrToken_Attendee FOREIGN KEY (AttendeeID) REFERENCES dbo.Attendee(AttendeeID)
    );
END;
GO

IF OBJECT_ID(N'dbo.AttendeeListUploadBatch', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AttendeeListUploadBatch (
        UploadBatchID int IDENTITY(1,1) NOT NULL CONSTRAINT PK_AttendeeListUploadBatch PRIMARY KEY,
        AttendeeListID int NOT NULL,
        OriginalFileName nvarchar(255) NOT NULL,
        UploadedBy nvarchar(150) NULL,
        UploadedAt datetime2(0) NOT NULL CONSTRAINT DF_AttendeeListUploadBatch_UploadedAt DEFAULT (SYSUTCDATETIME()),
        TotalRows int NOT NULL CONSTRAINT DF_AttendeeListUploadBatch_TotalRows DEFAULT (0),
        ValidRows int NOT NULL CONSTRAINT DF_AttendeeListUploadBatch_ValidRows DEFAULT (0),
        InvalidRows int NOT NULL CONSTRAINT DF_AttendeeListUploadBatch_InvalidRows DEFAULT (0),
        ImportStatus nvarchar(50) NOT NULL,
        ValidationSummary nvarchar(max) NULL,
        CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_AttendeeListUploadBatch_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CreatedBy nvarchar(150) NULL,
        CONSTRAINT FK_AttendeeListUploadBatch_AttendeeList FOREIGN KEY (AttendeeListID) REFERENCES dbo.AttendeeList(AttendeeListID)
    );
END;
GO

IF OBJECT_ID(N'dbo.AttendeeListAuditLog', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AttendeeListAuditLog (
        AuditLogID bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_AttendeeListAuditLog PRIMARY KEY,
        AttendeeListID int NULL,
        AttendeeID int NULL,
        ActionType nvarchar(100) NOT NULL,
        ActionDescription nvarchar(1000) NULL,
        OldValue nvarchar(max) NULL,
        NewValue nvarchar(max) NULL,
        PerformedBy nvarchar(150) NULL,
        PerformedAt datetime2(0) NOT NULL CONSTRAINT DF_AttendeeListAuditLog_PerformedAt DEFAULT (SYSUTCDATETIME()),
        SourceIPAddress nvarchar(64) NULL,
        UserAgent nvarchar(500) NULL,
        CONSTRAINT FK_AttendeeListAuditLog_AttendeeList FOREIGN KEY (AttendeeListID) REFERENCES dbo.AttendeeList(AttendeeListID),
        CONSTRAINT FK_AttendeeListAuditLog_Attendee FOREIGN KEY (AttendeeID) REFERENCES dbo.Attendee(AttendeeID)
    );
END;
GO

IF OBJECT_ID(N'dbo.EventAttendeeList', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.EventAttendeeList (
        EventAttendeeListID int IDENTITY(1,1) NOT NULL CONSTRAINT PK_EventAttendeeList PRIMARY KEY,
        EventID int NOT NULL,
        AttendeeListID int NOT NULL,
        CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_EventAttendeeList_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CreatedBy nvarchar(150) NULL,
        CONSTRAINT FK_EventAttendeeList_Event FOREIGN KEY (EventID) REFERENCES dbo.Event(EventID),
        CONSTRAINT FK_EventAttendeeList_AttendeeList FOREIGN KEY (AttendeeListID) REFERENCES dbo.AttendeeList(AttendeeListID)
    );
END;
GO

IF OBJECT_ID(N'dbo.EventAttendanceSetting', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.EventAttendanceSetting (
        EventID int NOT NULL CONSTRAINT PK_EventAttendanceSetting PRIMARY KEY,
        AttendanceSourceMode nvarchar(50) NOT NULL CONSTRAINT DF_EventAttendanceSetting_SourceMode DEFAULT (N'COMBINED'),
        PrimaryCredentialMode nvarchar(50) NOT NULL CONSTRAINT DF_EventAttendanceSetting_CredentialMode DEFAULT (N'BADGE'),
        EnableEmailFallback bit NOT NULL CONSTRAINT DF_EventAttendanceSetting_EmailFallback DEFAULT (1),
        EnableBadgeFallback bit NOT NULL CONSTRAINT DF_EventAttendanceSetting_BadgeFallback DEFAULT (1),
        EnableQrFallback bit NOT NULL CONSTRAINT DF_EventAttendanceSetting_QrFallback DEFAULT (1),
        DuplicateScanWindowSeconds int NOT NULL CONSTRAINT DF_EventAttendanceSetting_DuplicateWindow DEFAULT (60),
        UpdatedAt datetime2(0) NULL,
        UpdatedBy nvarchar(150) NULL,
        CONSTRAINT FK_EventAttendanceSetting_Event FOREIGN KEY (EventID) REFERENCES dbo.Event(EventID)
    );
END;
GO

IF OBJECT_ID(N'dbo.AttendanceCheckIn', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AttendanceCheckIn (
        CheckInID bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_AttendanceCheckIn PRIMARY KEY,
        EventID int NULL,
        AttendeeID int NULL,
        BadgeNumber nvarchar(50) NULL,
        SourceType nvarchar(50) NOT NULL,
        CheckInMethod nvarchar(50) NOT NULL,
        CheckInStatus nvarchar(50) NOT NULL,
        CheckInTimeUtc datetime2(0) NOT NULL CONSTRAINT DF_AttendanceCheckIn_CheckInTimeUtc DEFAULT (SYSUTCDATETIME()),
        KioskID nvarchar(100) NULL,
        DeviceName nvarchar(200) NULL,
        MatchedBy nvarchar(100) NULL,
        RawInputReference nvarchar(200) NULL,
        CreatedAt datetime2(0) NOT NULL CONSTRAINT DF_AttendanceCheckIn_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CreatedBy nvarchar(150) NULL,
        Notes nvarchar(1000) NULL,
        CONSTRAINT FK_AttendanceCheckIn_Event FOREIGN KEY (EventID) REFERENCES dbo.Event(EventID),
        CONSTRAINT FK_AttendanceCheckIn_Attendee FOREIGN KEY (AttendeeID) REFERENCES dbo.Attendee(AttendeeID)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_AttendeeList_ListName' AND object_id = OBJECT_ID(N'dbo.AttendeeList'))
BEGIN
    CREATE UNIQUE INDEX UX_AttendeeList_ListName ON dbo.AttendeeList(ListName);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Attendee_ActiveEmailInList' AND object_id = OBJECT_ID(N'dbo.Attendee'))
BEGIN
    CREATE UNIQUE INDEX UX_Attendee_ActiveEmailInList ON dbo.Attendee(AttendeeListID, Email) WHERE DeletedAt IS NULL;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Attendee_ActiveBadgeInList' AND object_id = OBJECT_ID(N'dbo.Attendee'))
BEGIN
    CREATE UNIQUE INDEX UX_Attendee_ActiveBadgeInList ON dbo.Attendee(AttendeeListID, BadgeNumber) WHERE DeletedAt IS NULL AND BadgeNumber IS NOT NULL;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_AttendeeQrToken_TokenHash' AND object_id = OBJECT_ID(N'dbo.AttendeeQrToken'))
BEGIN
    CREATE UNIQUE INDEX UX_AttendeeQrToken_TokenHash ON dbo.AttendeeQrToken(TokenHash);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_AttendeeQrToken_ActiveAttendee' AND object_id = OBJECT_ID(N'dbo.AttendeeQrToken'))
BEGIN
    CREATE UNIQUE INDEX UX_AttendeeQrToken_ActiveAttendee ON dbo.AttendeeQrToken(AttendeeID) WHERE RevokedAtUtc IS NULL;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_EventAttendeeList_Event_List' AND object_id = OBJECT_ID(N'dbo.EventAttendeeList'))
BEGIN
    CREATE UNIQUE INDEX UX_EventAttendeeList_Event_List ON dbo.EventAttendeeList(EventID, AttendeeListID);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_AttendanceCheckIn_DuplicateWindow' AND object_id = OBJECT_ID(N'dbo.AttendanceCheckIn'))
BEGIN
    CREATE INDEX IX_AttendanceCheckIn_DuplicateWindow ON dbo.AttendanceCheckIn(EventID, AttendeeID, CheckInStatus, CheckInTimeUtc DESC);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_AttendeeListUploadBatch_ImportStatus')
BEGIN
    ALTER TABLE dbo.AttendeeListUploadBatch ADD CONSTRAINT CK_AttendeeListUploadBatch_ImportStatus
    CHECK (ImportStatus IN (N'PENDING', N'VALIDATED', N'IMPORTED', N'REJECTED', N'FAILED'));
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_EventAttendanceSetting_SourceMode')
BEGIN
    ALTER TABLE dbo.EventAttendanceSetting ADD CONSTRAINT CK_EventAttendanceSetting_SourceMode
    CHECK (AttendanceSourceMode IN (N'ACCESS_CONTROL_ONLY', N'ATTENDEE_LIST_ONLY', N'COMBINED'));
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_EventAttendanceSetting_PrimaryCredential')
BEGIN
    ALTER TABLE dbo.EventAttendanceSetting ADD CONSTRAINT CK_EventAttendanceSetting_PrimaryCredential
    CHECK (PrimaryCredentialMode IN (N'BADGE', N'QR_CODE'));
END;
GO
