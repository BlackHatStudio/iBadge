# Deployment

iBadge is packaged for Windows Server/IIS with SQL Server migrations, runtime config templates, service templates, and Inno Setup installers.

## Key Locations

- `deployment/scripts` - build, stage, install, IIS, SQL, service, and scheduled task scripts.
- `deployment/config` - config templates rendered during staging/install.
- `deployment/sql` - SQL Server migrations.
- `deployment/installer` - Inno Setup installer definitions.
- `deployment/output` - generated packages and installers.
- `docs/windows-server-2022-deployment-package-plan.md` - detailed packaging plan.

## Deployment Shape

- IIS hosts the web application.
- Runtime config is rendered into deployable config files instead of hard-coded in source.
- Backend/service configuration comes from rendered environment or appsettings templates.
- SQL scripts provision and update the target database.
- Installers should support custom install locations and future upgrades.

## Build and Package Commands

Use the scripts under `deployment/scripts` for release work. Common entry points include:

```powershell
deployment\scripts\publish-all.ps1
deployment\scripts\stage-webapp-package.ps1
deployment\scripts\build-webapp-installer.ps1
deployment\scripts\install-web-package.ps1
```

Review script parameters before running them against a real server.

## Runtime Configuration

Frontend runtime values are represented by `runtime-config.template.js` and `public/runtime-config.js`.

Important runtime values:

- API base URL.
- Reference refresh interval.
- Queue retry interval.
- Duplicate scan window.

Server and SQL connection values should come from deployment settings, rendered env files, or secure server configuration. Do not commit production credentials.

## SQL Deployment

- SQL migrations live in `deployment/sql`.
- Run migrations in numeric order.
- Back up production data before applying schema changes.
- Attendee list and QR check-in objects are introduced by `007_attendee_lists_qr_checkin.sql`.

## Installer Notes

- Inno Setup definitions live in `deployment/installer`.
- Installer templates should preserve upgrade behavior and install-location prompts.
- Generated `.exe` and package `.zip` files belong in deployment output, not source docs.
