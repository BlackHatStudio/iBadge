-- Adds work email for kiosk employee reference data (used by sync refresh and admin employee list).
-- Run against the database that hosts dbo.Employee for the iBadge SQL-backed refresh API.

IF COL_LENGTH(N'dbo.Employee', N'Email') IS NULL
BEGIN
  ALTER TABLE dbo.Employee ADD Email nvarchar(320) NULL;
END
GO
