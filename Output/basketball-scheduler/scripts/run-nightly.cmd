@echo off
setlocal
rem Nightly federation sync - the single entry point for Windows Task Scheduler.
rem
rem Download first, and only work out a proposal if the file actually changed. Both steps
rem append to federation-inbox\log.txt, so one file tells the whole story of every night.
rem
rem Exit: 0 a proposal was filed  -  10 nothing to do  -  1 something failed

cd /d "%~dp0.."

rem Task Scheduler running "whether the user is logged on or not" does not load the user's
rem environment, so the credential path is named here rather than assumed to be inherited.
rem The dedicated sync account rather than the project-wide Admin SDK key: it carries
rem roles/datastore.user only, so it cannot reach Authentication or Storage at all.
if "%GOOGLE_APPLICATION_CREDENTIALS%"=="" set "GOOGLE_APPLICATION_CREDENTIALS=%USERPROFILE%\.basketball\nightly-sync.json"

where node >nul 2>&1
if errorlevel 1 (
  echo [%date% %time%] node is not on PATH for this task >> federation-inbox\log.txt
  exit /b 1
)

node scripts\fetch-federation.mjs
rem Order matters: `if errorlevel N` means "N or above", so the highest code is tested first.
if errorlevel 10 goto :unchanged
if errorlevel 1 goto :failed

node scripts\prepare-import.mjs
if errorlevel 10 goto :nochange
if errorlevel 1 goto :failed
exit /b 0

:unchanged
echo [%date% %time%] the federation file is unchanged - stopping here >> federation-inbox\log.txt
exit /b 10

:nochange
exit /b 10

:failed
exit /b 1
