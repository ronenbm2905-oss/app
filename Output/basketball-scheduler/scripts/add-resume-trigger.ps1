# A fourth trigger for "Basketball nightly sync": run when the machine WAKES.
#
# WHY THE THREE FROM 21.9 WERE NOT ENOUGH, measured on 23.9.2026.
#
# The fix on 21.9 set WakeToRun, StartWhenAvailable and a logon trigger. All three are still
# set — verified — and the sync still did not run on the night of 22-23.9. What the Windows
# event log shows:
#
#   23.9 02:39:10  The system is entering sleep
#   23.9 02:39:11  The system has resumed from sleep     (Modern Standby, S0)
#   23.9 08:38:46  The system time has changed to 2026-09-23T05:38:46Z
#                  from 2026-09-22T23:39:11Z
#   23.9 08:38:50  The system has returned from a low power state
#
# Read the third line again: the system clock went from 02:39 local straight to 08:38 local.
# **03:00 never happened.** The daily trigger did not fire late — its moment did not occur,
# so there was nothing for StartWhenAvailable to catch up on either. Task Scheduler recorded
# NumberOfMissedRuns=1 and moved NextRunTime to 24.9.
#
# And the net did not catch it: a resume from Modern Standby is NOT a logon. Nobody signs in
# when a laptop lid opens, so the logon trigger — which is what saved the 21.9 case, where
# the machine had been fully off — is silent on the ordinary overnight pattern of this
# machine.
#
# WakeToRun is the setting that should have prevented all of it, and it is set. On Modern
# Standby (S0) systems it depends on "Allow wake timers" in the power plan, which is off by
# default on battery on most laptops. That is a power setting on Ronen's own machine and is
# his call, not a script's — see the note this prints at the end.
#
# So: a trigger on the wake itself. Power-Troubleshooter event 1 is the line above, the one
# Windows writes every time the machine comes back, and it is the earliest moment anything
# can run.
#
# RUNNING IT MORE THAN ONCE A DAY IS THE POINT, NOT A COST. An unchanged federation file
# exits 10 and files nothing — that is what most days look like anyway — and the run is a
# download and a hash comparison. A machine that wakes four times a day checks four times
# and files at most one proposal, which is strictly better than a machine that checks never.

$ErrorActionPreference = "Stop"
$name = "Basketball nightly sync"

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
  Write-Host "  לא נמצאה משימה בשם `"$name`"." -ForegroundColor Red
  Write-Host ""
  exit 1
}

# The XPath Windows itself uses for "the machine came back". Kept as one string rather than
# built up, because a subscription that does not match anything fails silently — the trigger
# is accepted, sits there, and never fires.
$subscription = @'
<QueryList><Query Id="0" Path="System"><Select Path="System">*[System[Provider[@Name='Microsoft-Windows-Power-Troubleshooter'] and EventID=1]]</Select></Query></QueryList>
'@

$already = @($task.Triggers | Where-Object { $_.CimClass.CimClassName -eq "MSFT_TaskEventTrigger" })
if ($already.Count -gt 0) {
  Write-Host ""
  Write-Host "  טריגר יקיצה כבר קיים — לא שיניתי דבר." -ForegroundColor Yellow
  Write-Host ""
  exit 0
}

$class = Get-CimClass -Namespace ROOT\Microsoft\Windows\TaskScheduler -ClassName MSFT_TaskEventTrigger
$wake = New-CimInstance -CimClass $class -ClientOnly
$wake.Subscription = $subscription
$wake.Enabled = $true
# Three minutes, so the network adapter is up before the download starts. A resume with no
# Wi-Fi yet is a failed fetch written to the log, which is noise that looks like a fault.
$wake.Delay = "PT3M"

Set-ScheduledTask -TaskName $name -Trigger (@($task.Triggers) + $wake) | Out-Null

$after = Get-ScheduledTask -TaskName $name
Write-Host ""
Write-Host "  נוסף טריגר: הרצה 3 דקות אחרי שהמחשב מתעורר." -ForegroundColor Green
Write-Host "  טריגרים כעת:" -ForegroundColor Green
foreach ($t in $after.Triggers) {
  $kind = switch ($t.CimClass.CimClassName) {
    "MSFT_TaskDailyTrigger" { "יומי ב-03:00" }
    "MSFT_TaskLogonTrigger" { "בכניסה למשתמש (+5 דק')" }
    "MSFT_TaskEventTrigger" { "ביקיצה מהמחשב (+3 דק')" }
    default { $t.CimClass.CimClassName }
  }
  Write-Host "    - $kind"
}
Write-Host ""
Write-Host "  שים לב: זו רשת ביטחון, לא תחליף." -ForegroundColor Cyan
Write-Host "  אם תרצה שהמחשב יתעורר לבד ב-03:00, צריך להדליק Allow wake timers" -ForegroundColor Cyan
Write-Host "  בתוכנית החשמל. זו הגדרה על המחשב שלך ולכן היא ההחלטה שלך, לא של סקריפט." -ForegroundColor Cyan
Write-Host ""
