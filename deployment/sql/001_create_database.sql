IF DB_ID(N'$(DatabaseName)') IS NULL
BEGIN
    DECLARE @sql nvarchar(max) = N'CREATE DATABASE [' + REPLACE(N'$(DatabaseName)', N']', N']]') + N']';
    EXEC (@sql);
END;
GO
