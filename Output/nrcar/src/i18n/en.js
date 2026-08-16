// ============================================================================
// en.js — the English dictionary. Full parity with he.js (enforced in smoke).
//
// Shira wrote Hebrew only, as agreed; the English here mirrors her register:
// plain, human, never "the system". Two Hebrew-specific rules carry over as
// structure rather than grammar:
//   · `.two` variants exist for key parity even though "in 2 days" is fine in
//     English — the engine picks them by day count, not by language.
//   · `{vehicle}` and `{title}` are user-authored values, so no possessive or
//     article is ever glued to them.
// ============================================================================

export default {
  "app.name": "NRCAR",
  "app.title": "NRCAR — My car",
  "app.tagline": "Everything you need to remember about your car, in one place",

  // -- 1. The five statuses --
  "task.status.open": "Open",
  "task.status.open.hint": "Not due yet. We'll remind you when it gets closer.",
  "task.status.upcoming": "Coming up",
  "task.status.upcoming.hint": "The date is getting close — a good time to take care of it.",
  "task.status.inProgress": "In progress",
  "task.status.inProgress.hint": "You booked an appointment, or it's already on its way.",
  "task.status.overdue": "Overdue",
  "task.status.overdue.hint": "The date has passed and this hasn't been marked as done.",
  "task.status.overdue.hintFromInProgress": "You booked an appointment, but the date has passed.",
  "task.status.done": "Done",
  "task.status.done.hint": "You marked it done. The next reminder is already open.",

  "task.important.on": "Important",
  "task.important.off": "Normal",
  "task.important.toggle": "Mark as important",
  "task.important.untoggle": "Remove the mark",
  "task.due": "Due date: {date}",
  "task.dueIn": "in {days} days",
  "task.dueIn.two": "in 2 days",
  "task.dueIn.tomorrow": "tomorrow",
  "task.dueIn.today": "today",
  "task.overdueBy": "{days} days overdue",
  "task.overdueBy.one": "1 day overdue",
  "task.overdueBy.two": "2 days overdue",

  // -- 2.1 Engine — annual test --
  "engine.test.d30.title": "The annual test for {vehicle} is in {days} days",
  "engine.test.d30.sub": "There's still time. Worth booking a garage you like.",
  "engine.test.d14.title": "The annual test for {vehicle} is in {days} days",
  "engine.test.d14.sub": "A good moment to book — no rush yet.",
  "engine.test.d7.title": "{days} days left for the annual test for {vehicle}",
  "engine.test.d7.sub": "If you haven't booked yet, this week is the time.",
  "engine.test.d3.title": "In {days} days the annual test for {vehicle} expires",
  "engine.test.d3.title.two": "In 2 days the annual test for {vehicle} expires",
  "engine.test.d3.sub": "Worth closing this in the next few days.",
  "engine.test.d1.title": "Tomorrow the annual test for {vehicle} expires",
  "engine.test.d1.sub": "Already done it? Mark it done and we'll jump to next year.",
  "engine.test.d0.title": "Today is the last day of the annual test for {vehicle}",
  "engine.test.d0.sub": "From tomorrow the car has no valid test. If you've done it — mark it done.",
  "engine.test.overdue.title": "The annual test for {vehicle} expired {days} days ago",
  "engine.test.overdue.title.one": "The annual test for {vehicle} expired yesterday",
  "engine.test.overdue.title.two": "The annual test for {vehicle} expired 2 days ago",
  // Approved wording (Adi, 2026-08-13): attribute the *rule* to the law, keep
  // the *fact* as ours. A hedged phrasing invites the user to invent exceptions.
  "engine.test.overdue.sub":
    "By law, a vehicle must have a valid registration (test) to be driven",

  // -- 2.2 Engine — insurance --
  "insurance.coverage.compulsory": "the compulsory insurance",
  "insurance.coverage.comprehensive": "the comprehensive insurance",
  "insurance.coverage.generic": "the insurance",

  "engine.insurance.d30.title": "{coverage} for {vehicle} ends in {days} days",
  "engine.insurance.d30.sub": "Time to compare quotes before you renew.",
  "engine.insurance.d14.title": "{coverage} for {vehicle} ends in {days} days",
  "engine.insurance.d14.sub": "Two weeks is exactly the time to talk to your agent.",
  "engine.insurance.d7.title": "{days} days left until {coverage} for {vehicle} ends",
  "engine.insurance.d7.sub": "Worth closing the renewal this week.",
  "engine.insurance.d3.title": "In {days} days {coverage} for {vehicle} ends",
  "engine.insurance.d3.title.two": "In 2 days {coverage} for {vehicle} ends",
  "engine.insurance.d3.sub": "Coverage doesn't renew by itself — the renewal needs approval.",
  "engine.insurance.d1.title": "Tomorrow {coverage} for {vehicle} ends",
  "engine.insurance.d1.sub": "Already renewed? Mark it done and we'll update the date.",
  "engine.insurance.d0.title": "Today is the last day of {coverage} for {vehicle}",
  "engine.insurance.d0.sub":
    "From tomorrow the car has no coverage. If you've renewed — mark it done.",
  "engine.insurance.overdue.title": "{coverage} for {vehicle} ended {days} days ago",
  "engine.insurance.overdue.title.one": "{coverage} for {vehicle} ended yesterday",
  "engine.insurance.overdue.title.two": "{coverage} for {vehicle} ended 2 days ago",
  // Two different support lines by coverage type. This is precision, not
  // duplication, and it is locked: driving without comprehensive cover is
  // perfectly legal. Enforced in smoke — no *.comprehensive.* key may contain
  // "law" or "prohibited".
  "engine.insurance.overdue.sub.compulsory":
    "By law, driving without valid compulsory insurance is prohibited",
  "engine.insurance.overdue.sub.comprehensive":
    "The car currently has no comprehensive coverage. Worth renewing soon.",

  // Fact attribution on the overdue card — not a disclaimer. It separates the
  // *rule* (the law's) from the *fact* (ours, and checkable). It also covers
  // the freshness gap: the ministry database is a periodic snapshot.
  "engine.attribution.insurance":
    "Based on what you entered in the app. Worth confirming with your insurer.",
  "engine.attribution.test": "Based on Ministry of Transport data from {date}. Worth confirming.",
  "engine.attribution.manual": "Based on what you entered in the app. Worth confirming.",

  // -- 2.3 Engine — service --
  "engine.service.d30.title": "The service for {vehicle} is in {days} days",
  "engine.service.d30.sub": "The next service is getting close. Worth booking now.",
  "engine.service.d14.title": "The service for {vehicle} is in {days} days",
  "engine.service.d14.sub": "Worth booking before the garage calendar fills up.",
  "engine.service.d7.title": "{days} days left for the service for {vehicle}",
  "engine.service.d7.sub":
    "If it's convenient, update the current mileage too — it sharpens our estimate.",
  "engine.service.d3.title": "In {days} days the service for {vehicle} is due",
  "engine.service.d3.title.two": "In 2 days the service for {vehicle} is due",
  "engine.service.d3.sub": "Better not to postpone — a service on time protects the car.",
  "engine.service.d1.title": "Tomorrow the service for {vehicle} is due",
  "engine.service.d1.sub": "Already been to the garage? Mark it done.",
  "engine.service.d0.title": "Today the service for {vehicle} is due",
  "engine.service.d0.sub":
    "Already been to the garage? Mark it done and we'll work out the next one.",
  "engine.service.overdue.title": "The service for {vehicle} was due {days} days ago",
  "engine.service.overdue.title.one": "The service for {vehicle} was due yesterday",
  "engine.service.overdue.title.two": "The service for {vehicle} was due 2 days ago",
  "engine.service.overdue.sub": "Already done it? Mark it done. If not, worth booking.",

  "engine.service.km.estimate": "At your pace, the next service is around {km} km.",
  "engine.service.km.reached": "You've passed {km} km — the service is due.",
  "engine.service.km.noData": "To calculate by mileage too, update the odometer now and then.",
  "engine.service.km.update": "Update mileage",

  // -- 2.4 Engine — repair --
  "engine.repair.d30.title": "{title} for {vehicle} is in {days} days",
  "engine.repair.d30.sub": "You noted this yourself. We'll remind you again when it's closer.",
  "engine.repair.d14.title": "{title} for {vehicle} is in {days} days",
  "engine.repair.d14.sub": "Not urgent yet, but good that it's written down.",
  "engine.repair.d7.title": "{days} days left — {title} for {vehicle}",
  "engine.repair.d7.sub": "If it's already handled, you can mark it done.",
  "engine.repair.d3.title": "In {days} days — {title} for {vehicle}",
  "engine.repair.d3.title.two": "In 2 days — {title} for {vehicle}",
  "engine.repair.d3.sub": "Worth closing this in the next few days.",
  "engine.repair.d1.title": "Tomorrow — {title} for {vehicle}",
  "engine.repair.d1.sub": "If it's behind you, mark it done.",
  "engine.repair.d0.title": "Today — {title} for {vehicle}",
  "engine.repair.d0.sub": "If it's behind you, mark it done.",
  "engine.repair.overdue.title": "{title} for {vehicle} — the date passed {days} days ago",
  "engine.repair.overdue.title.one": "{title} for {vehicle} — the date passed yesterday",
  "engine.repair.overdue.title.two": "{title} for {vehicle} — the date passed 2 days ago",
  "engine.repair.overdue.sub": "You can set a new date, or mark it done.",

  // -- 2.5 Engine — other --
  "engine.other.d30.title": "{title} for {vehicle} is in {days} days",
  "engine.other.d30.sub": "We'll remind you again when it's closer.",
  "engine.other.d14.title": "{title} for {vehicle} is in {days} days",
  "engine.other.d14.sub": "There's still time.",
  "engine.other.d7.title": "{days} days left — {title} for {vehicle}",
  "engine.other.d7.sub": "Worth starting to take care of it.",
  "engine.other.d3.title": "In {days} days — {title} for {vehicle}",
  "engine.other.d3.title.two": "In 2 days — {title} for {vehicle}",
  "engine.other.d3.sub": "Worth closing this in the next few days.",
  "engine.other.d1.title": "Tomorrow — {title} for {vehicle}",
  "engine.other.d1.sub": "If it's behind you, mark it done.",
  "engine.other.d0.title": "Today — {title} for {vehicle}",
  "engine.other.d0.sub": "If it's behind you, mark it done.",
  "engine.other.overdue.title": "{title} for {vehicle} — the date passed {days} days ago",
  "engine.other.overdue.title.one": "{title} for {vehicle} — the date passed yesterday",
  "engine.other.overdue.title.two": "{title} for {vehicle} — the date passed 2 days ago",
  "engine.other.overdue.sub": "You can set a new date, or mark it done.",

  // -- 2.6 Dashboard --
  "dashboard.hero.label": "Most urgent right now",
  "dashboard.hero.cta.done": "I've done it",
  "dashboard.hero.cta.open": "Details",
  "dashboard.hero.cta.snooze": "Remind me later",
  "dashboard.allClear.title": "All sorted 👍",
  "dashboard.allClear.sub": "Nothing needs attention right now. We'll let you know in time.",
  "dashboard.vehicles.title": "My cars",
  "dashboard.vehicleCard.next": "Coming up: {title}",
  "dashboard.vehicleCard.nothing": "Nothing to handle right now",
  "dashboard.vehicleCard.archived": "Archived",
  "dashboard.addVehicle": "Add a car",
  "snooze.title": "When should we remind you?",
  "snooze.option.tomorrow": "Tomorrow",
  "snooze.option.week": "In a week",
  "snooze.option.custom": "Another date",
  "snooze.done": "We'll remind you again on {date}.",

  // -- 3. Adding a car --
  "vehicle.add.title": "Let's add a car",
  "vehicle.add.sub": "The plate number is enough — we'll fetch the rest for you.",
  "vehicle.add.plate.label": "Plate number",
  "vehicle.add.plate.hint": "With or without dashes. For example: 12-345-67",
  "vehicle.add.plate.placeholder": "12-345-67",
  "vehicle.add.submit": "Find the car",
  "vehicle.add.manualLink": "I'd rather enter the details myself",
  "vehicle.add.plate.error.empty": "A plate number is needed to continue.",
  // Deliberately does not state a digit count: the validator accepts 5-8 so it
  // won't block an older car or a motorcycle.
  "vehicle.add.plate.error.invalid":
    "That doesn't look like a plate number. You'll find it on the vehicle licence.",

  "vehicle.add.loading": "One moment, fetching the car details…",
  "vehicle.add.loading.slow": "Almost there — the Ministry of Transport database is slow today.",
  "vehicle.add.loading.cancel": "Cancel and enter manually",

  "vehicle.add.found.title": "We found the car — is this it?",
  "vehicle.add.found.sub":
    "The details came from the Ministry of Transport database. Any field can be corrected.",
  "vehicle.add.found.plate": "Plate number",
  "vehicle.add.found.model": "Make and model",
  "vehicle.add.found.year": "Year",
  "vehicle.add.found.color": "Colour",
  "vehicle.add.found.fuel": "Fuel type",
  "vehicle.add.found.testValid": "Test valid until",
  "vehicle.add.found.testValid.none": "We couldn't find a test date — you can fill it in manually.",
  "vehicle.add.found.taskNotice":
    "We've opened a test reminder for {date}, and we'll remind you a month ahead.",
  "vehicle.add.found.confirm": "Yes, that's my car",
  "vehicle.add.found.reject": "No, that's not it",
  "vehicle.add.found.rejectHint": "You can fix the plate number and search again.",
  "vehicle.add.found.disclaimer":
    "The details come from a public Ministry of Transport database and are updated periodically. If something is off — you can correct it.",

  "vehicle.add.deregistered.title": "This car is no longer registered as active",
  "vehicle.add.deregistered.body":
    "According to the Ministry of Transport, the registration of {plate} was cancelled on {date}. Did you sell it, or has it come off the road?",
  "vehicle.add.deregistered.body.noDate":
    "According to the Ministry of Transport, the registration of {plate} is no longer active. Did you sell it, or has it come off the road?",
  "vehicle.add.deregistered.hint":
    "If it is still your car, you can add it manually — the documents and history will be kept.",
  "vehicle.add.deregistered.cta.manual": "Add it manually",
  "vehicle.add.deregistered.cta.back": "Fix the plate number",

  "vehicle.add.notFound.title": "We couldn't find a car with that number",
  "vehicle.add.notFound.body":
    "Maybe a digit slipped. You can try again, or enter the details manually — it takes a minute.",
  "vehicle.add.notFound.cta.retry": "Try another number",
  "vehicle.add.notFound.cta.manual": "Enter manually",

  "vehicle.add.network.title": "We couldn't reach the database",
  "vehicle.add.network.body":
    "Probably a temporary glitch. You can try again in a moment, or enter the details manually — it takes a minute.",
  "vehicle.add.network.cta.retry": "Try again",
  "vehicle.add.network.cta.manual": "Enter manually",
  "vehicle.add.offline.title": "No internet connection right now",
  "vehicle.add.offline.body":
    "Without a connection we can't fetch the details from the Ministry of Transport. You can enter them manually now, or come back when you're online.",
  "vehicle.add.offline.cta.manual": "Enter manually",

  "vehicle.manual.title": "Car details",
  "vehicle.manual.sub": "Only what you know. The rest can wait.",
  "vehicle.field.nickname": "Nickname",
  "vehicle.field.nickname.hint": "So it's easy to recognise. For example: Mum's car",
  "vehicle.field.manufacturer": "Make",
  "vehicle.field.model": "Model",
  "vehicle.field.year": "Year",
  "vehicle.field.color": "Colour",
  "vehicle.field.fuel": "Fuel type",
  "vehicle.field.testValidUntil": "Test valid until",
  "vehicle.field.testValidUntil.hint":
    'It appears on the vehicle licence, in the "licence validity" line.',
  "vehicle.field.compulsoryUntil": "Compulsory insurance valid until",
  "vehicle.field.comprehensiveUntil": "Comprehensive insurance valid until",
  "vehicle.field.insurer": "Insurance company",
  "vehicle.field.policyNumber": "Policy number",
  "vehicle.field.insurerPhone": "Insurer emergency phone",
  "vehicle.field.insurerPhone.hint":
    "It appears on the policy. It will show here as a call button on the emergency screen.",
  "vehicle.field.agentName": "Insurance agent",
  "vehicle.field.agentPhone": "Agent phone",
  "vehicle.field.garageName": "My garage",
  "vehicle.field.garagePhone": "Garage phone",
  "vehicle.field.lastService": "Last service date",
  "vehicle.field.currentKm": "Current mileage",
  "vehicle.field.currentKm.hint":
    "The number on the dashboard. It helps us work out when the next service is due.",
  "vehicle.field.photo": "Photo of the car",
  "vehicle.field.photo.hint": "A real photo helps you recognise the car at a glance.",
  "vehicle.field.photo.cta": "Take or choose a photo",
  "vehicle.save": "Save the car",
  "vehicle.saved.toast": "The car is saved. From here on, we remember for you.",
  "vehicle.saved.withTask": "The car is saved, and we've opened a test reminder for {date}.",

  "vehicle.mot.refresh.cta": "Check for an update at the Ministry of Transport",
  "vehicle.mot.conflict.title": "We found a different date in the database",
  "vehicle.mot.conflict.body":
    "The Ministry of Transport has the test valid until {motDate}, while you have {userDate}. Which should we keep?",
  "vehicle.mot.conflict.keepMine": "Keep my date",
  "vehicle.mot.conflict.useMot": "Update from the database",
  "vehicle.mot.noChange": "No change — your date is up to date.",
  "vehicle.mot.filled": "We filled in {n} empty fields from the database.",

  // -- 4. Marking done + automatic renewal --
  // One-tap correction, visible on the overdue card itself. When the app speaks
  // in the name of the law and is wrong, the user needs an immediate way out.
  "task.fix.insurance": "Already renewed",
  "task.fix.test": "Test is done",
  "task.fix.generic": "Already handled",

  "task.complete.cta": "I've done it",
  "task.complete.title": "Great. Just two quick things",
  "task.complete.date.label": "When did you do it?",
  "task.complete.date.today": "Today",
  "task.complete.date.other": "Another date",
  "task.complete.km.label": "What's the mileage now?",
  "task.complete.km.hint": "You can skip — we'll update next time.",
  "task.complete.km.skip": "Skip",
  "task.complete.confirm": "Confirm and save",
  "task.complete.cancel": "Back",

  "task.next.heading": "What happens next",
  "task.next.test":
    "We'll open a new test reminder for {vehicle} on {date} — a year from the day you did it.",
  "task.next.insurance":
    "We'll open a renewal reminder for {coverage} for {vehicle} on {date} — a year from the previous date, not from today.",
  "task.next.service":
    "We'll open a reminder for the next service for {vehicle}: {date}, or around {km} km — whichever comes first.",
  "task.next.service.noKm":
    "We'll open a reminder for the next service for {vehicle} on {date}. Once you update the mileage, we'll sharpen the date.",
  "task.next.repair": "This is a one-off task — we won't create a follow-up.",
  "task.next.other": "This is a one-off task — we won't create a follow-up.",
  "task.next.editHint": "Date doesn't suit? You can change it here.",
  "task.next.edit": "Change the date",
  "task.next.remindLead": "We'll remind you a month ahead, and again when it's close.",

  "task.complete.test.motCheck": "Check the new date at the Ministry of Transport",
  "task.complete.test.motLoading": "One moment, checking with the Ministry of Transport…",
  "task.complete.test.motFound":
    "The database has the test valid until {date}. Use that date?",
  "task.complete.test.motUse": "Yes, use the database",
  "task.complete.test.motKeep": "No, keep {date}",
  "task.complete.test.motMissing":
    "The database isn't updated yet — it sometimes takes a few days. We'll use the date we calculated, and you can correct it any time.",

  "task.completed.toast": "Excellent. Marked done, and the next reminder is set for {date}.",
  "task.completed.toast.noNext": "Excellent. Marked done.",
  "task.completed.undo": "Undo",
  "task.completed.undone": "Undone. The task is back on the list.",

  // -- 5. Emergency screen --
  "emergency.title": "Emergency",
  "emergency.calm": "It's all here. Take a moment.",
  "emergency.vehiclePicker": "Which car?",
  "emergency.loading": "One moment, loading…",

  "emergency.field.plate": "Plate number",
  "emergency.field.vehicle": "Car",
  "emergency.field.year": "Year",
  "emergency.field.color": "Colour",
  "emergency.field.insurer": "Insurance company",
  "emergency.field.policy": "Policy number",
  "emergency.field.owner": "Car owner",
  "emergency.field.ownerPhone": "Phone",
  "emergency.field.driver": "Driver",
  "emergency.field.missing": "Not set",

  "emergency.doc.vehicleLicence": "Vehicle licence",
  "emergency.doc.compulsory": "Compulsory insurance",
  "emergency.doc.drivingLicence": "My driving licence",
  "emergency.doc.open": "Show",
  "emergency.doc.missing": "Not uploaded",
  "emergency.doc.add": "Upload now",

  "emergency.call.insurer": "Call the insurance company",
  "emergency.call.insurer.missing": "No insurer phone number set",
  "emergency.call.insurer.add": "Add a phone number",
  "emergency.call.police": "Police 100",
  "emergency.call.mda": "Ambulance 101",

  "emergency.offline.promise":
    "The documents will be saved on your device so they're available without internet.",
  "emergency.offline.now": "No internet right now. This is what's saved on your device.",
  "emergency.offline.saved": "Saved on your device on {date}.",
  "emergency.offline.docsUnavailable":
    "The document files aren't available offline. The details above are.",

  "emergency.empty.title": "You haven't added documents yet",
  "emergency.empty.body":
    "Once you upload the vehicle licence and compulsory insurance, they'll appear here — even without internet.",
  "emergency.empty.cta": "Upload documents",
  "emergency.empty.noVehicle.title": "No car here yet",
  "emergency.empty.noVehicle.body": "As soon as you add a car, this screen will be ready.",
  "emergency.empty.noVehicle.cta": "Add a car",

  // -- 6. Empty / loading / error --
  "empty.vehicles.title": "Let's add your first car 🚗",
  "empty.vehicles.body": "The plate number is enough — we'll fetch the rest for you.",
  "empty.vehicles.cta": "Add a car",
  "empty.tasks.title": "No open tasks for this car",
  "empty.tasks.body": "Once we know about a test or insurance, we'll open a reminder ourselves.",
  "empty.tasks.cta": "Add a task",
  "empty.tasksAll.title": "Nothing to handle right now",
  "empty.tasksAll.body": "All tasks are closed. We'll let you know when something comes up.",
  "empty.docs.title": "No documents here yet",
  "empty.docs.body":
    "The vehicle licence and compulsory insurance are the place to start — they're also what shows on the emergency screen.",
  "empty.docs.cta": "Upload a document",
  "empty.docsFilter": "No documents in this category.",
  "empty.docsFilter.cta": "Show all",
  "empty.personalDocs.title": "Your driving licence isn't here yet",
  "empty.personalDocs.body": "It's stored for you alone, and shows on the emergency screen.",
  "empty.personalDocs.cta": "Upload a driving licence",
  "empty.archive.title": "No cars in the archive",
  "empty.archive.body": "A car you archive will appear here, with all of its documents.",
  "empty.search": 'We found nothing for "{query}".',
  "empty.search.hint": "Try a plate number, a car nickname or a document name.",

  "loading.generic": "One moment…",
  "loading.dashboard": "One moment, gathering everything…",
  "loading.vehicles": "One moment, loading your cars…",
  "loading.vehicle": "One moment, loading the car…",
  "loading.tasks": "One moment, loading tasks…",
  "loading.docs": "One moment, loading documents…",
  "loading.mot": "One moment, fetching the car details…",
  "loading.emergency": "One moment, loading…",
  "loading.saving": "Saving…",
  "loading.upload": "Uploading the file…",
  "loading.upload.progress": "Uploading… {n}%",
  "loading.deleting": "Deleting…",
  "loading.signIn": "One moment, signing in…",

  "error.generic.title": "Something didn't work out",
  "error.generic.body": "Probably a temporary glitch. You can try again.",
  "error.generic.cta": "Try again",
  "error.offline.title": "No internet connection right now",
  "error.offline.body":
    "What's already saved for you is shown here. We'll sync as soon as you're back online.",
  "error.offline.cta": "Check again",
  "error.load.title": "We couldn't load the information",
  "error.load.body": "You can try again, or go back to the home screen.",
  "error.load.cta.retry": "Try again",
  "error.load.cta.home": "Back home",
  "error.save.title": "We couldn't save",
  "error.save.body": "What you entered is still here, nothing is lost. You can try saving again.",
  "error.save.cta": "Save again",
  "error.upload.title": "The file didn't upload",
  "error.upload.body": "You can try again, or choose another file.",
  "error.upload.cta.retry": "Try again",
  "error.upload.cta.other": "Choose another file",
  "error.upload.tooLarge": "The file is too big (up to {max}). You can retake it at normal quality.",
  "error.upload.type": "You can upload an image or a PDF file.",
  "error.form.required": "This field needs to be filled in.",
  "error.form.date": "That date doesn't look right. The format is day.month.year.",
  "error.form.datePast": "That date has already passed. Is that right?",
  "error.form.number": "A number is needed here.",
  "error.form.phone": "That phone number doesn't look right.",
  "error.form.summary": "{n} fields need fixing. We've marked them.",
  "error.permission.title": "You don't have permission for this",
  "error.permission.body": "Only the account owner can change this.",
  "error.permission.cta": "Back",
  "error.notFound.title": "We couldn't find what you were looking for",
  "error.notFound.body": "It may have been deleted, or the car may have been archived.",
  "error.notFound.cta": "Back home",
  "error.session.title": "Your session has expired",
  "error.session.body": "You'll need to sign in again to continue. Nothing is lost.",
  "error.session.cta": "Sign in again",
  "error.delete.title": "We couldn't delete",
  "error.delete.body": "You can try again in a moment.",
  "error.localMode.docs": "To store personal documents you need to sign in to an account.",

  // -- 7. Onboarding + sign-in --
  "onboarding.title": "From now on, we remember for you",
  "onboarding.sub":
    "Test, insurance and services — we'll remind you in time, and won't let it slip.",
  "onboarding.why":
    "All it takes is the plate number. One minute now, and you can stop worrying.",
  "onboarding.emergency": "And if there's an accident — every document is here, one button away.",
  "onboarding.cta": "Let's start",
  "onboarding.privacyNote":
    "Your documents are stored in your account, and only people you've given access can see them.",
  "onboarding.privacyLink": "Privacy policy",

  // "Emergency drill" — Adi's wording, section 6.3. Not a legal appendix: it
  // shows the emergency screen calmly, before it's needed, and tells the truth
  // about how strong the protection actually is — in the place that gets read.
  "onboarding.drill.title": "This is what it looks like in an accident",
  "onboarding.drill.body":
    "One tap, and everything you need is on the screen: the plate number, the insurance details, and the insurer's emergency phone.",
  "onboarding.drill.noticeTitle": "Worth knowing:",
  "onboarding.drill.notice1":
    "This screen opens immediately, with no password — so it's there when you need it.",
  "onboarding.drill.notice2":
    "Anyone holding your unlocked phone can see it. That's why a screen lock on your device matters.",
  "onboarding.drill.notice3": "You can sign out of the app at any time from Settings.",
  "onboarding.drill.cta": "Got it, continue",

  "auth.title": "Sign in",
  "auth.sub": "No password to remember.",
  "auth.google": "Sign in with Google",
  "auth.error": "Sign-in didn't work. You can try again.",
  "auth.error.cta": "Try again",
  "auth.localMode": "Local demo mode",
  "auth.localMode.note":
    "Data is stored in this browser only, and personal documents are not stored.",

  // -- 8. Settings + legal --
  "settings.title": "Settings",
  "settings.section.profile": "My details",
  "settings.profile.name": "Name",
  "settings.profile.phone": "Phone",
  "settings.profile.email": "Email",
  "settings.section.reminders": "Reminders",
  "settings.reminders.lead": "How far ahead should we remind you?",
  "settings.reminders.lead.hint":
    "Default: a month ahead for test and insurance. You can also change it per task.",
  "settings.reminders.lead.month": "A month ahead",
  "settings.reminders.lead.twoWeeks": "Two weeks ahead",
  "settings.reminders.lead.week": "A week ahead",
  "settings.reminders.channels": "How to remind me",
  "settings.reminders.push": "Phone notification",
  "settings.reminders.sms": "SMS message",
  "settings.reminders.email": "Email",
  "settings.reminders.soon": "Coming soon",
  "settings.section.emergency": "Emergency screen",
  "settings.emergency.offline": "Keep the emergency details on this device",
  "settings.emergency.offline.hint":
    "The documents will be saved on your device so they're available without internet.",
  "settings.emergency.offline.docs": "Keep the document files too",
  "settings.emergency.offline.docs.hint":
    "Takes more space on the device, but the documents will be available with no signal.",
  // Adi's wording, section 6.4. "textAndDocs" is a material change, not an
  // extension: it copies identity-document scans that lived only behind
  // storage.rules onto a device no rule governs.
  // ⚠️ The last sentence must be true — that is N1.
  "settings.emergency.offline.docs.confirm.title": "Keep the documents on the phone too?",
  "settings.emergency.offline.docs.confirm.body":
    "That way they're available with no internet — on an intercity road, for example.",
  "settings.emergency.offline.docs.confirm.meaning":
    "What this means: a copy of the documents will be stored on the device itself. It is deleted when you sign out of the app.",
  "settings.emergency.offline.docs.confirm.cta": "Yes, keep documents too",
  "settings.emergency.offline.docs.confirm.cancel": "No, details only",

  "settings.emergency.auth": "Ask for authentication before opening the emergency screen",
  "settings.emergency.auth.session": "An existing session is enough",
  "settings.emergency.auth.always": "Authenticate every time",
  "settings.emergency.auth.soon": "Coming soon",
  "settings.section.display": "Display",
  "settings.display.language": "Language",
  "settings.display.textSize": "Text size",
  "settings.section.drivers": "Drivers",
  "settings.drivers.soon":
    "Coming soon — you'll be able to add family members and see who drives what.",
  "settings.section.legal": "Information and documents",
  "settings.legal.privacy": "Privacy policy",
  "settings.legal.terms": "Terms of use",
  "settings.legal.accessibility": "Accessibility statement",
  "settings.legal.about": "About the app",
  "settings.section.account": "Account",
  "settings.account.signOut": "Sign out",
  "settings.account.signOut.confirm": "Sign out? Your data stays saved.",
  "settings.account.delete": "Delete account and data",
  "settings.account.delete.confirm.title": "Delete the account?",
  "settings.account.delete.confirm.body":
    "All cars, tasks and documents will be deleted permanently. This cannot be undone.",
  "settings.account.delete.confirm.cta": "Yes, delete everything",
  "settings.account.delete.cancel": "No, go back",
  "settings.account.delete.done": "Your data has been deleted.",
  "settings.account.export": "Export my data",
  "settings.account.export.hint":
    "One file with every car, task and document on record for you.",
  "settings.account.export.cta": "Download the file",
  "settings.account.export.done": "The file has been downloaded.",
  "settings.version": "Version {n}",

  "legal.notice.title": "Before we start",
  "legal.notice.body":
    "Here's what information is stored, where it's stored, and who can see it. Worth a minute.",
  "legal.notice.privacy": "Privacy policy",
  "legal.notice.terms": "Terms of use",
  "legal.notice.cta": "I've read this",
  "legal.notice.hint":
    "This button confirms you've seen the documents. You can return to them any time from Settings.",
  "legal.notice.reopen": "Read again",
  "legal.notice.updated": "We've updated the documents. Worth a look.",

  "legal.disclaimer.mot":
    "Car details come from a public Ministry of Transport database. NRCAR does not verify ownership and does not replace an official document.",
  "legal.disclaimer.reminders":
    "Reminders are an aid only. Responsibility for meeting the dates stays with the car owner.",
  "legal.disclaimer.docs":
    "Your documents are stored in your account and accessible only to people you've given access.",
  "legal.disclaimer.personalDocs":
    "Your driving licence is stored for you alone. Even the account owner cannot see it.",
  "legal.disclaimer.emergency":
    "This screen shows what you saved. It does not replace an original document and does not call the emergency services itself.",
  "legal.retention.pending": "The retention period has not been set yet.",

  // -- 9. Bottom navigation --
  "nav.home": "Home",
  "nav.vehicles": "Cars",
  "nav.docs": "Documents",
  "nav.emergency": "Emergency",
  "nav.settings": "Settings",
  "nav.home.aria": "Home screen",
  "nav.vehicles.aria": "My cars",
  "nav.docs.aria": "My documents",
  "nav.emergency.aria": "Emergency screen — the documents for an accident scene",
  "nav.settings.aria": "Settings",
  "nav.main.aria": "Main navigation",
  "nav.back": "Back",
  "nav.add": "Add",
  "nav.add.vehicle": "New car",
  "nav.add.task": "New task",
  "nav.add.doc": "New document",
  "nav.add.close": "Close",

  // -- 10. Closed lists --
  "task.type.test": "Annual test",
  "task.type.insurance": "Insurance renewal",
  "task.type.insurance.short": "Insurance",
  "task.type.service": "Service",
  "task.type.repair": "Repair",
  "task.type.other": "Other",
  "task.type.select": "What needs doing?",
  "task.title.label": "What is it about?",
  "task.title.hint": "For example: changing tyres",

  "tag.insurance": "Insurance",
  "tag.maintenance": "Maintenance",
  "tag.authorities": "Authorities",
  "tag.money": "Money",
  "tag.other": "Other",
  "tag.select": "Tag",
  "tag.none": "No tag",

  "doc.type.vehicleLicence": "Vehicle licence",
  "doc.type.compulsory": "Compulsory insurance",
  "doc.type.comprehensive": "Comprehensive insurance",
  "doc.type.testCertificate": "Test certificate",
  "doc.type.serviceReport": "Service report",
  "doc.type.receipt": "Receipt",
  "doc.type.drivingLicence": "Driving licence",
  "doc.type.other": "Other",
  "doc.type.select": "Which document is this?",

  "doc.filter.all": "All",
  "doc.filter.licences": "Licences",
  "doc.filter.insurance": "Insurance",
  "doc.filter.service": "Services",
  "doc.filter.receipts": "Receipts",

  "doc.visibility.shared": "Also available to drivers of this car",
  "doc.visibility.owner": "Only I can see this",
  "doc.visibility.personal": "Personal — only you can see this",
  "doc.validUntil": "Valid until {date}",
  "doc.badge.expired": "Expired",
  "doc.badge.expiring": "Expiring soon",
  "doc.expired.body": "{document} expired on {date}. We've opened a renewal task for you.",
  "doc.expiring.body": "{document} expires on {date}.",
  "doc.upload.cta": "Upload a document",
  "doc.upload.camera": "Photograph a document",
  "doc.upload.file": "Choose a file",
  "doc.uploaded.toast": "The document is saved.",
  "doc.delete.confirm": "Delete {document}? This cannot be undone.",

  "vehicle.status.active": "Active",
  "vehicle.status.archived": "Archived",
  "vehicle.archive.cta": "I no longer have this car",
  "vehicle.archive.confirm.title": "Move {vehicle} to the archive?",
  "vehicle.archive.confirm.body":
    "Reminders will stop, but the documents and history will be kept. You can bring it back any time.",
  "vehicle.archive.confirm.cta": "Yes, archive it",
  "vehicle.archived.toast": "{vehicle} moved to the archive.",
  "vehicle.restore.cta": "Bring back to my cars",
  "vehicle.restored.toast": "{vehicle} is back in your cars.",
  "vehicle.delete.cta": "Delete permanently",
  "vehicle.delete.confirm.title": "Delete {vehicle} completely?",
  "vehicle.delete.confirm.body":
    "All tasks and documents for this car will be deleted and cannot be restored. If you only sold it — the archive is better.",
  "vehicle.delete.confirm.cta": "Yes, delete everything",

  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.back": "Back",
  "common.close": "Close",
  "common.edit": "Edit",
  "common.delete": "Delete",
  "common.add": "Add",
  "common.done": "Done",
  "common.next": "Next",
  "common.yes": "Yes",
  "common.no": "No",
  "common.retry": "Try again",
  "common.skip": "Skip",
  "common.optional": "Optional",
  "common.notSet": "Not set",
  "common.today": "Today",
  "common.tomorrow": "Tomorrow",
  "common.km": "km",
  "common.more": "More",
  "common.language": "עברית",

  // -- 11. Structural additions needed by the screens --
  // Here role="tab" IS correct: content swapping within one page, unlike the
  // bottom navigation which moves between screens.
  "vehicle.tab.tasks": "Tasks",
  "vehicle.tab.docs": "Documents",
  "vehicle.tab.details": "Details",
  "vehicle.tabs.aria": "Car content",
  "vehicle.details.mot": "Source of the details",
  "vehicle.details.mot.fetched": "Fetched from the Ministry of Transport on {date}",
  "vehicle.details.mot.manual": "Entered manually",
  "vehicle.addTask": "Add a task",
  "vehicle.addDoc": "Upload a document",
  "vehicles.archived.title": "Archived cars",
  "vehicles.archived.show": "Show the archive",
  "vehicles.archived.hide": "Hide the archive",

  "task.field.vehicle": "Which car?",
  "task.field.dueDate": "Due date",
  "task.field.coverage": "Which insurance?",
  "task.field.leadDays": "How far ahead should we remind you?",
  "task.form.title.new": "New task",
  "task.form.title.edit": "Edit task",
  "task.markInProgress": "I booked an appointment",
  "task.unmarkInProgress": "Remove the mark",
  "task.mute": "Don't remind me about this",
  "task.unmute": "Bring reminders back",

  "doc.field.vehicle": "Which car?",
  "doc.field.validUntil": "Valid until",
  "doc.field.title": "Document name",
  "doc.viewer.title": "Document view",
  "doc.viewer.hint": "You can pinch to zoom.",
  "doc.viewer.failed": "We couldn't open the document.",
  "doc.personal.title": "My driving licence",
  "doc.personal.hint": "Stored for you alone. Even the account owner cannot see it.",

  // Accessibility statement — frame only. The binding wording is Adi's (L1),
  // and it is published only after the fixes are actually in place.
  "accessibility.title": "Accessibility statement",
  "accessibility.standard": "This app was built to IS 5568 level AA.",
  "accessibility.knownLimits.title": "Known limitations",
  "accessibility.knownLimits.docs":
    "Scanned documents you upload are not accessible to a screen reader. The key fields — plate number, insurer, policy number and dates — are always available as text as well.",
  "accessibility.contact.title": "Accessibility enquiries",
  "accessibility.pending.title": "The full wording is being prepared",
  "accessibility.pending.body":
    "The accessibility coordinator's details and the full legal wording will be published here before the app goes live.",

  "emergency.quickCall": "Quick call",
  "emergency.drill.cta": "See what the emergency screen looks like",
  "emergency.attribution": "This screen shows what you saved in the app.",

};
