# A SECOND DAILY RUN, at 10:00, for "Basketball nightly sync".
#
# WHY 03:00 ALONE KEEPS FAILING, measured on 25.9.2026.
#
# The Windows event log for the night of 24-25.9:
#
#   24.9 15:23  Sleep Time  (Modern Standby, S0)
#   25.9 17:49  Wake Time
#
# Twenty-six and a half hours asleep, with 03:00 in the middle of it. Task Scheduler recorded
# NumberOfMissedRuns=1 and moved NextRunTime to 26.9. The log's last line was from 24.9.
#
# This is the SECOND time WakeToRun has failed on this machine, and the two failures had
# different causes:
#
#   23.9  the system clock jumped 02:39 -> 08:38, so 03:00 never occurred at all
#   25.9  the machine simply stayed in S0 across the whole window
#
# WakeToRun is set in both cases. On Modern Standby it depends on "Allow wake timers" in the
# power plan, which is off by default on battery. That is a setting on Ronen's own machine.
# Two failures out of two is enough to stop treating 03:00 as the run that matters.
#
# WHY 10:00 AND NOT A THIRD SAFETY NET.
#
# The resume trigger added on 23.9 DID work here — it fired at 17:52:12, three minutes after
# the wake, and completed. So the nets are fine. What is missing is a scheduled moment when
# the machine is ordinarily already awake, so the sync is not hostage to when a lid opens.
# 10:00 is that moment, and it is early enough that a fixture moved overnight is on the board
# before the day's calls are made.
#
# WHAT THIS DOES NOT FIX, and it should be said plainly: the task runs as InteractiveToken,
# which means it runs only while Ronen is SIGNED IN. A machine that is off, asleep, or sitting
# at the lock screen at 10:00 will not run it either — the resume trigger remains the thing
# that catches those. Two daily triggers do not make the schedule reliable; they make the
# common case covered twice.
#
# RUNNING TWICE A DAY COSTS NOTHING. An unchanged federation file exits 10 and files nothing,
# which is what most days look like. The run is a download and a hash comparison, and
# MultipleInstancesPolicy is IgnoreNew, so a 10:00 run cannot collide with anything.

$ErrorActionPreference = "Stop"
$name = "Basketball nightly sync"
$hour = 10

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host ""
  Write-Host "  צריך להריץ את זה כמנהל (Run as administrator)." -ForegroundColor Yellow
  Write-Host "  המשימה יושבת בתיקיית השורש של מתזמן המשימות, ושינוי שלה דורש הרשאה." -ForegroundColor Yellow
  Write-Host ""
  exit 1
}

$task = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
if (-not $task) {
  Write-Host ""
  Write-Host "  לא נמצאה משימה בשם $name." -ForegroundColor Red
  Write-Host ""
  exit 1
}

# Idempotent, because this will be run again by someone who does not remember whether it was
# run before. Two identical daily triggers would not break anything, but a task whose trigger
# list nobody can read is how the 21.9 mess started.
$daily = @($task.Triggers | Where-Object { $_.CimClass.CimClassName -eq "MSFT_TaskDailyTrigger" })
foreach ($t in $daily) {
  $at = [datetime]::Parse($t.StartBoundary)
  if ($at.Hour -eq $hour -and $at.Minute -eq 0) {
    Write-Host ""
    Write-Host "  טריגר יומי ב-$($hour):00 כבר קיים — לא שיניתי דבר." -ForegroundColor Yellow
    Write-Host ""
    exit 0
  }
}

$morning = New-ScheduledTaskTrigger -Daily -At "$($hour):00"

Set-ScheduledTask -TaskName $name -Trigger (@($task.Triggers) + $morning) | Out-Null

# Verify against the task as Windows now holds it, not against what was just sent. A
# Set-ScheduledTask that silently drops the event trigger would otherwise look like a success.
$after = Get-ScheduledTask -TaskName $name
$kinds = @($after.Triggers | ForEach-Object { $_.CimClass.CimClassName })
Write-Host ""
if ($kinds -notcontains "MSFT_TaskEventTrigger" -or $kinds -notcontains "MSFT_TaskLogonTrigger") {
  Write-Host "  אזהרה: טריגר קיים נעלם בעדכון. הרץ שוב add-resume-trigger.ps1." -ForegroundColor Red
  Write-Host ""
}
Write-Host "  טריגרים כעת:" -ForegroundColor Green
foreach ($t in $after.Triggers) {
  $kind = switch ($t.CimClass.CimClassName) {
    "MSFT_TaskDailyTrigger" { "יומי ב-" + ([datetime]::Parse($t.StartBoundary)).ToString("HH:mm") }
    "MSFT_TaskLogonTrigger" { "בכניסה למשתמש (+5 דק')" }
    "MSFT_TaskEventTrigger" { "ביקיצה מהמחשב (+3 דק')" }
    default { $t.CimClass.CimClassName }
  }
  Write-Host "    - $kind"
}
$info = Get-ScheduledTaskInfo -TaskName $name
Write-Host ""
Write-Host "  הריצה הבאה: $($info.NextRunTime)" -ForegroundColor Green
Write-Host ""
Write-Host "  שים לב: המשימה רצה רק כשאתה מחובר למחשב." -ForegroundColor Cyan
Write-Host "  מחשב כבוי או נעול ב-10:00 עדיין נשען על הטריגר של היקיצה." -ForegroundColor Cyan
Write-Host ""
