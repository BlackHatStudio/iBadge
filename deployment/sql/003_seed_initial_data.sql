USE [$(DatabaseName)];
GO

IF NOT EXISTS (SELECT 1 FROM kiosk.AdminConfig)
BEGIN
    INSERT INTO kiosk.AdminConfig (AdminPinHash, JwtSecret, CurrentVersion, DuplicateWindowSeconds)
    VALUES (N'__SET_ADMIN_PIN_HASH__', N'__SET_JWT_SECRET__', N'1.0.0', 30);
END;
GO

IF NOT EXISTS (SELECT 1 FROM kiosk.Event)
BEGIN
    INSERT INTO kiosk.Event (EventId, EventName, IsActive)
    VALUES (NEWID(), N'Default Event', 1);
END;
GO
