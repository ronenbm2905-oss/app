@echo off
setlocal
rem Nightly federation sync - the single entry point for Windows Task Scheduler.
rem
rem ONE job now, not two. As of 27.9.2026 this script runs only:
rem
rem   fetch+prepare  - the weekly league xlsx, downloaded and diffed
rem
rem The cup scan that used to run first has moved to a Cloud Function - see the block below,
rem which explains why running it in both places would destroy a manager's decision rather
rem than merely duplicate work. The league half stays here because it needs `xlsx`.
rem
rem It appends to federation-inbox\log.txt, so one file still tells the story of every night
rem THIS MACHINE runs. The cup scan's own story is in Cloud Logging and in
rem clubs/<id>/sync/cups.
rem
rem Exit: 0 there is a proposal to look at  -  10 nothing to do  -  1 something failed

cd /d "%~dp0.."

rem A Task Scheduler process does not inherit the interactive shell's environment, so the
rem credential path is named here rather than assumed. (This line used to claim the task runs
rem "whether the user is logged on or not". It does NOT - the principal is InteractiveToken,
rem verified 25.9.2026, so every trigger below only fires while Ronen is signed in. A comment
rem that describes a different task than the one running is how a missed night gets
rem misdiagnosed.)
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
rem
rem MOVED TO THE CLOUD ON 27.9.2026, and this line is deliberately not here any more.
rem
rem `nightlyCupScan` in functions/index.js now runs the scan at 03:00 on Google's machines,
rem because this one missed four nights out of four while asleep - including one on mains
rem power with wake timers enabled, where the System log held zero events across 03:00.
rem
rem RUNNING BOTH WOULD DESTROY A DECISION, which is why the line was removed rather than left
rem as a harmless second opinion. Both writers file `cupScans/<date>` with a full .set() and
rem `resolved: false`. A manager who dismisses a fixture at 09:00 writes resolved/resolvedBy/
rem resolvedAt onto that document; a scan at 10:00 would write the document whole again, erase
rem all three, and put the dismissed fixture back on the banner. (The league half is NOT like
rem this - a pendingImport carries no human decision - which is why it still runs below.)
rem
rem To scan by hand: node scripts\scan-cups.mjs
rem `skipped` is one of the statuses record-sync.mjs accepts, and it is the honest one: this
rem run did not scan the cups and is not claiming to. The cloud function writes its own
rem heartbeat at clubs/<id>/sync/cups.
set "CUPSTATE=skipped"

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
rem Nothing to look at from the league file, and the cup scan is no longer this script's to
rem report - so there is nothing that could make this run anything but quiet.
set "CODE=10"
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
