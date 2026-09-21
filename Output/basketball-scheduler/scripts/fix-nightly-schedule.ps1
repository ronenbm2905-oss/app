# Three changes to the "Basketball nightly sync" scheduled task.
#
# WHY THIS FILE EXISTS RATHER THAN THE CHANGE HAVING BEEN MADE: the task lives in Task
# Scheduler's ROOT folder, whose ACL requires administrator to write. Reading it needs
# nothing; changing it needs elevation, so it is a script you run once rather than a
# command that silently failed.
#
# WHAT WENT WRONG, 18-21.9.2026. The machine slept from the evening of Friday 18.9 until
# Monday evening. The trigger fired at 03:00 into a sleeping machine three nights running,
# and Windows recorded NumberOfMissedRuns=3 and said nothing. The federation published
# fixtures on the 20th; nothing downloaded them. The last run had exited 0 — a healthy
# task and a dead sync look identical from outside.
#
#   1. WakeToRun                  - wake the machine for it. Fixes exactly this case.
#   2. a logon trigger, +5 min    - the net under it. Waking does nothing if the machine was
#                                   fully off, and then the next login is the earliest
#                                   moment anything CAN run.
#   3. StopIfGoingOnBatteries off - it was killing a job that takes seconds.
#
# Running the sync more than once in a day is harmless: an unchanged federation file exits
# 10 and files nothing, which is what most days look like anyway.

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

$task = Get-ScheduledTask -TaskName $name

# Keep a copy of what it looked like, beside this script, before touching anything.
$backup = Join-Path $PSScriptRoot "nightly-task-before-fix.xml"
Export-ScheduledTask -TaskName $name | Out-File -FilePath $backup -Encoding utf8
Write-Host "גיבוי נשמר: $backup"

$settings = $task.Settings
$settings.WakeToRun = $true
$settings.StopIfGoingOnBatteries = $false
$settings.StartWhenAvailable = $true   # already on; named here so it is not lost on a rewrite

$daily = New-ScheduledTaskTrigger -Daily -At "03:00"
$logon = New-ScheduledTaskTrigger -AtLogOn -User ([Security.Principal.WindowsIdentity]::GetCurrent().Name)
# Five minutes, so it is not competing with everything else a fresh login starts.
try { $logon.Delay = "PT5M" } catch { Write-Host "לא ניתן היה לקבוע השהיה לטריגר הכניסה — ימשיך בלעדיה." }

Set-ScheduledTask -TaskName $name -Trigger @($daily, $logon) -Settings $settings | Out-Null

$after = Get-ScheduledTask -TaskName $name
$info = $after | Get-ScheduledTaskInfo
Write-Host ""
Write-Host "בוצע:" -ForegroundColor Green
Write-Host ("  מעיר את המחשב        : " + $after.Settings.WakeToRun)
Write-Host ("  נעצר על סוללה        : " + $after.Settings.StopIfGoingOnBatteries)
Write-Host ("  משלים ריצה שהוחמצה   : " + $after.Settings.StartWhenAvailable)
Write-Host ("  טריגרים              : " + (($after.Triggers | ForEach-Object { $_.CimClass.CimClassName }) -join ", "))
Write-Host ("  הריצה הבאה           : " + $info.NextRunTime)
Write-Host ""
Write-Host "לשחזור, אם יידרש:" -ForegroundColor DarkGray
Write-Host ("  schtasks /create /tn `"$name`" /xml `"$backup`" /f") -ForegroundColor DarkGray
