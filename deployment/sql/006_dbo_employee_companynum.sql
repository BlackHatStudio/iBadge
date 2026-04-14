-- Run against the database that hosts dbo.Employee for the iBadge SQL-backed refresh API.

IF COL_LENGTH(N'dbo.Employee', N'CompanyNum') IS NULL
BEGIN
  ALTER TABLE dbo.Employee ADD CompanyNum nvarchar(100) NULL;
END;
