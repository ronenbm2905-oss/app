# Turn OFF the Windows scheduled task. The sync runs in the cloud now.
#
# WHY THIS IS A SCRIPT AND NOT A SENTENCE IN A DOCUMENT.
#
# The privacy policy (§6) says, as of 27.9.2026, that both federation sync processes run in
# the cloud and that the service-account key left on this machine "does not run by itself on
# a schedule". That sentence is FALSE while this task is enabled — and gate #23 blocked the
# release on exactly that, because a living document describing a state that does not exist
# is the failure this project has hit eight times.
#
# So the order is: disable, verify against Windows, and only then publish the text.
#
# THE SECOND REASON, WHICH IS OPERATIONAL RATHER THAN LEGAL. Both the cloud and this machine
# file their proposal at `pendingImports/<date>` and `cupScans/<date>`. A manager who deals
# with a proposal at 09:00 writes `status`/`resolvedBy`/`resolvedAt` onto that document. A
# second writer later the same day used to replace it whole — the banner comes back and the
# record of who decided is gone. Guards were added on both sides (mayOverwriteProposal,
# mayOverwriteScan), but the guards are the second line. Not running twice is the first.
#
# The scripts themselves stay, and stay runnable by hand:
#     node scripts\scan-cups.mjs
#     scripts\run-nightly.cmd

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
  Write-Host "  לא נמצאה משימה בשם $name — כנראה כבר הוסרה. אין מה לעשות." -ForegroundColor Yellow
  Write-Host ""
  exit 0
}

if ($task.State -eq "Disabled") {
  Write-Host ""
  Write-Host "  המשימה כבר מבוטלת. לא שיניתי דבר." -ForegroundColor Yellow
  Write-Host ""
  exit 0
}

Write-Host ""
Write-Host "  לפני:" -ForegroundColor Cyan
Write-Host "    מצב: $($task.State) · טריגרים: $($task.Triggers.Count)"

# Disabled and not Unregister-ScheduledTask: the manual fallback is worth keeping one click
# away, and an entry that exists and is off is easier to understand a year from now than an
# entry that vanished.
Disable-ScheduledTask -TaskName $name -TaskPath $task.TaskPath | Out-Null

# Verified against Windows, not against what was sent. That distinction is the lesson from
# add-morning-trigger.ps1 on 25.9 — and here it decides whether a sentence in a published
# privacy policy is true.
$after = Get-ScheduledTask -TaskName $name
Write-Host ""
if ($after.State -ne "Disabled") {
  Write-Host "  ✗ המשימה עדיין במצב $($after.State) — הביטול לא נתפס." -ForegroundColor Red
  Write-Host "    אל תפרסם את מדיניות הפרטיות המעודכנת עד שזה ייפתר." -ForegroundColor Red
  Write-Host ""
  exit 1
}

Write-Host "  ✓ המשימה מבוטלת. הסנכרון רץ מעכשיו בענן בלבד." -ForegroundColor Green
Write-Host "    03:00 גביעים · 03:10 קובץ הליגה — שתיהן ב-europe-west1." -ForegroundColor Green
Write-Host ""
Write-Host "  הסקריפטים נשארו להרצה ידנית:" -ForegroundColor Cyan
Write-Host "    node scripts\scan-cups.mjs"
Write-Host "    scripts\run-nightly.cmd"
Write-Host ""
Write-Host "  להחזיר את התזמון, אם אי פעם יידרש:" -ForegroundColor Cyan
Write-Host "    Enable-ScheduledTask -TaskName `"$name`""
Write-Host ""
