@echo off
setlocal
rem Nightly federation sync - the single entry point for Windows Task Scheduler.
rem
rem Two independent jobs against the same federation, and they are deliberately not chained:
rem
rem   1. scan-cups      - cup and friendly fixtures, published page-per-age-group on the site
rem   2. fetch+prepare  - the weekly league xlsx, downloaded and diffed
rem
rem THE CUP SCAN RUNS FIRST, AND ALWAYS. The league flow stops at :unchanged whenever the
rem weekly file is identical to yesterday's, which is most nights - so anything placed after
rem it would almost never run. A cup fixture can appear on a night the league file has not
rem moved at all; that is the ordinary case, not the exception.
rem
rem A failure in one must not take the other down. The cup scan failing is logged and the
rem league sync carries on, and the reverse.
rem
rem Both append to federation-inbox\log.txt, so one file tells the whole story of every night.
rem
rem Exit: 0 there is a proposal to look at  -  10 nothing to do  -  1 something failed

cd /d "%~dp0.."

rem Task Scheduler running "whether the user is logged on or not" does not load the user's
rem environment, so the credential path is named here rather than assumed to be inherited.
rem The dedicated sync account rather than the project-wide Admin SDK key: it carries
rem roles/datastore.user only, so it cannot reach Authentication or Storage at all.
if "%GOOGLE_APPLICATION_CREDENTIALS%"=="" set "GOOGLE_APPLICATION_CREDENTIALS=%USERPROFILE%\.basketball\nightly-sync.json"

rem The cup scan now runs before anything has created this, so it cannot be assumed.
if not exist "federation-inbox" mkdir "federation-inbox"

where node >nul 2>&1
if errorlevel 1 (
  echo [%date% %time%] node is not on PATH for this task >> federation-inbox\log.txt
  exit /b 1
)

rem ---- 1. cup fixtures -------------------------------------------------------------
set "CUPSTATE=failed"
echo [%date% %time%] --- cup scan --- >> federation-inbox\log.txt
node scripts\scan-cups.mjs >> federation-inbox\log.txt 2>&1
rem `if errorlevel N` means "N or above", so the highest code is tested first.
if errorlevel 10 goto :cups_none
if errorlevel 1 goto :cups_failed
set "CUPSTATE=ok"
goto :league

:cups_failed
set "CUPSTATE=failed"
echo [%date% %time%] the cup scan failed - continuing with the league sync >> federation-inbox\log.txt
goto :league

:cups_none
rem Nothing new in any competition. Normal, and not worth a line of its own every night.
set "CUPSTATE=none"

:league
rem ---- 2. the weekly league file ---------------------------------------------------
node scripts\fetch-federation.mjs
if errorlevel 10 goto :unchanged
if errorlevel 1 goto :failed

node scripts\prepare-import.mjs
if errorlevel 10 goto :nochange
if errorlevel 1 goto :failed
set "LEAGUESTATE=ok"
set "CODE=0"
goto :record

:unchanged
echo [%date% %time%] the federation file is unchanged - stopping here >> federation-inbox\log.txt
set "LEAGUESTATE=unchanged"
goto :quiet

:nochange
set "LEAGUESTATE=none"
goto :quiet

:quiet
rem Nothing to look at from the league file. Still a success if the cup scan filed something.
set "CODE=10"
if "%CUPSTATE%"=="ok" set "CODE=0"
goto :record

:failed
rem The league sync failed. A cup proposal filed a moment ago is still worth looking at, but
rem the run as a whole did not succeed and says so - a task that reports success while half
rem of it broke is how a broken sync goes unnoticed for a month.
set "LEAGUESTATE=failed"
set "CODE=1"
goto :record

:record
rem ---- 3. say that the run happened -------------------------------------------------
rem
rem EVERY path above arrives here, and that is the entire point of the label.
rem
rem Until 21.9.2026 the only trace a run left in the database was a PROPOSAL - filed only
rem when something actually changed, which is the minority of nights. So a job that had been
rem dead for three days and three quiet nights produced the same screen, and the difference
rem was noticed only because someone went to the federation's site and looked.
rem
rem This writes one heartbeat per run: the runs that found nothing, and the ones that broke.
rem Its own failure is swallowed on purpose - the real work is already done by the time it
rem runs, and a missing heartbeat must not turn a good night into a failed one.
node scripts\record-sync.mjs --cups %CUPSTATE% --league %LEAGUESTATE% >> federation-inbox\log.txt 2>&1
exit /b %CODE%
