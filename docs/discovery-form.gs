/**
 * Builds the "GymJourno Phase 2 – Interview notes" Google Form.
 *
 * How to use: open https://script.google.com, start a new project, paste this file in, and run
 * createDiscoveryForm. Google asks you to allow the script to create forms in your account the
 * first time. The form's editor and live links appear in the execution log.
 *
 * One response per chat. It mirrors docs/user-interviews-r1.md (the questions) and
 * docs/product-strategy.md (hypotheses H1–H20). Each segment gets its own section; answers land in
 
 * a linked Google Sheet you can copy into the discovery workbook.
 */
function createDiscoveryForm() {
  var form = FormApp.create('GymJourno Phase 2 – Interview notes');
  form.setDescription(
    'One response per user chat, filled in straight after it. Record what people actually said or did ' +
    '(their words, real examples, time or money spent), not opinions. Compliments are not evidence.'
  );
  form.setProgressBar(true);

  var DECISIONS = ['Supported', 'Rejected', 'Changed', 'Not enough yet'];

  // ---- Section 1: about the chat (everyone) ----
  form.addListItem().setTitle('Participant ID').setRequired(true)
    .setChoiceValues(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'Extra']);
  form.addTextItem().setTitle('First name or alias').setRequired(true);
  form.addDateItem().setTitle('Date of the chat').setRequired(true);
  form.addTextItem().setTitle('Length (minutes)')
    .setValidation(FormApp.createTextValidation().requireNumber().build());
  var segment = form.addMultipleChoiceItem().setTitle('Which segment?').setRequired(true);

  // ---- Individuals ----
  var individuals = form.addPageBreakItem().setTitle('Individuals')
    .setHelpText('Class-goer, lifter, beginner or busy person. Tests H1–H4, H8–H11, H20.');
  form.addListItem().setTitle('Which kind of individual?').setRequired(true)
    .setChoiceValues(['Class-goer', 'Lifter', 'Beginner', 'Busy person']);
  [
    'Their last week of exercise: what, when and where',
    'What they track today, and how (app, notebook, watch, nothing)',
    'Their last class or workout: did they record anything afterwards? If not, what stopped them?',
    'What they would want to look back on after a few months (and why)',
    'Goals: what, and how they know they are getting closer',
    'The last time they stopped exercising for a while: what happened, and what got them back (or did not)',
    'Fitness apps they tried and stopped using, and why',
    'Trainers they have had, and how the trainer kept track of them',
    'Money they have spent on fitness apps, programmes or subscriptions: what and why (H20)'
  ].forEach(function (q) { form.addParagraphTextItem().setTitle(q); });
  addTryIt(form);
  form.addParagraphTextItem().setTitle('Show and ask: reaction to the Zumba logging mock-up, and what was missing');
  addCommitment(form);
  form.addGridItem().setTitle('Hypotheses: your decision from this chat')
    .setHelpText('H1/H8 class-goers · H2/H9 lifters · H3/H10 beginners · H4/H11 busy people · H20 everyone. Leave rows that this chat did not touch blank.')
    .setRows(['H1 Class-goers want effortless proof of consistency', 'H2 Lifters want to know what to lift next and see strength', 'H3 Beginners need a simple start and help with the habit', 'H4 Busy people\'s plans fall apart after a missed week', 'H8 Logging a class in seconds is worth switching for', 'H9 Lifting tools plus their trainer in one place is worth switching for', 'H10 A simple plan and an optional trainer beats videos', 'H11 Short sessions and breaks without penalty keep them going', 'H20 They have paid for advanced programs or analytics before'])
    .setColumns(DECISIONS);
  addEvidence(form);

  // ---- Independent trainers ----
  var trainers = form.addPageBreakItem().setTitle('Independent trainers')
    .setHelpText('Tests H5, H12, H15, H16, H17.');
  [
    'How many clients, and where (gym, homes, online)',
    'How they plan a client\'s week, and where the plan lives',
    'How they know whether a client trained, and what they do when they did not',
    'The last time they followed up with a client who missed a planned workout: what they did and how long it took',
    'Time per week spent on messages, reminders and chasing',
    'How they track who has paid',
    'Apps or software they use for clients now: what they pay, why they chose it or stopped',
    'Would their clients use an app? What would stop them?',
    'Price: too cheap to trust / getting expensive but worth it / too expensive (per month, in ₹)',
  ].forEach(function (q) { form.addParagraphTextItem().setTitle(q); });
  form.addMultipleChoiceItem().setTitle('Flat monthly fee or by number of clients?')
    .setChoiceValues(['Flat fee', 'By number of clients', 'No preference', 'Did not ask']);
  addTryIt(form);
  form.addParagraphTextItem().setTitle('Show and ask: reaction to gymjourno.fit/trainers, what they would use, what is missing');
  addCommitment(form);
  form.addGridItem().setTitle('Hypotheses: your decision from this chat')
    .setRows(['H5 Chasing clients costs real time; everything is scattered', 'H12 GymJourno beats WhatsApp and spreadsheets', 'H15 They would pay a monthly subscription', 'H16 They prefer pricing by number of clients', 'H17 Clients would join because it is free for them'])
    .setColumns(DECISIONS);
  addEvidence(form);

  // ---- Creator-trainers ----
  var creators = form.addPageBreakItem().setTitle('Creator-trainers')
    .setHelpText('Coaches some of their Instagram followers. Tests H6, H13, H18.');
  [
    'How followers become clients today (walk through the last one)',
    'How many they coach now, and how many more they could handle',
    'Where the coaching happens (DMs, WhatsApp, forms, an app), and what breaks as it grows',
    'One link in their Instagram bio for followers who want coaching: what should followers see when they tap it? Would they coach in an app outside Instagram?',
    'What they charge clients, and what they spend on tools',
    'What would put them off sending followers to an app'
  ].forEach(function (q) { form.addParagraphTextItem().setTitle(q); });
  addTryIt(form);
  form.addParagraphTextItem().setTitle('Show and ask: reaction to gymjourno.fit/trainers, what they would use, what is missing');
  addCommitment(form);
  form.addGridItem().setTitle('Hypotheses: your decision from this chat')
    .setRows(['H6 DM coaching does not scale past a handful of clients', 'H13 A bio link straight into coaching is worth using', 'H18 They would pay more than independent trainers'])
    .setColumns(DECISIONS);
  addEvidence(form);

  // ---- Gym owners ----
  var gyms = form.addPageBreakItem().setTitle('Gym owners')
    .setHelpText('Tests H7, H14, H19.');
  [
    'Members and trainers: how many, and how members join',
    'How they know a member has stopped coming, and what they do about it',
    'How they track fees and payments today',
    'Gym software they use: what they pay and what they wish it did',
    'Would trainers or members use a workout app? What would stop them?',
    'Comfort with members owning their own workout data, the gym seeing activity counts only'
  ].forEach(function (q) { form.addParagraphTextItem().setTitle(q); });
  addTryIt(form);
  form.addParagraphTextItem().setTitle('Show and ask: reaction to gymjourno.fit/gyms, what they would use, what is missing');
  addCommitment(form);
  form.addGridItem().setTitle('Hypotheses: your decision from this chat')
    .setRows(['H7 Members quietly stop coming; fees tracked by hand', 'H14 Retention, early warning and fees, with members owning data, is worth it', 'H19 They would pay once members already use GymJourno'])
    .setColumns(DECISIONS);
  addEvidence(form);

  // ---- Wrap-up (everyone) ----
  var wrap = form.addPageBreakItem().setTitle('Wrap-up');
  form.addParagraphTextItem().setTitle('Surprises: anything we had not thought of');
  form.addParagraphTextItem().setTitle('Anything else');

  // Route each segment to its own section; every segment section then jumps to the wrap-up.
  segment.setChoices([
    segment.createChoice('Individual (class-goer, lifter, beginner or busy person)', individuals),
    segment.createChoice('Independent trainer', trainers),
    segment.createChoice('Creator-trainer', creators),
    segment.createChoice('Gym owner', gyms)
  ]);
  // A page break's own navigation decides where the *previous* section goes, so send the end of
  // each segment section to the wrap-up.
  trainers.setGoToPage(wrap);   // after Individuals
  creators.setGoToPage(wrap);   // after Independent trainers
  gyms.setGoToPage(wrap);       // after Creator-trainers
  // After Gym owners the next section is the wrap-up anyway.

  var sheet = SpreadsheetApp.create('GymJourno Phase 2 – Interview notes (responses)');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());

  Logger.log('Edit the form: ' + form.getEditUrl());
  Logger.log('Fill it in:   ' + form.getPublishedUrl());
  Logger.log('Responses:    ' + sheet.getUrl());
}

function addTryIt(form) {
  form.addMultipleChoiceItem().setTitle('Did they try the live app?').setChoiceValues(['Yes', 'No']);
  form.addParagraphTextItem().setTitle('Try it: the task, where they hesitated, what they misunderstood or expected');
}

function addCommitment(form) {
  form.addMultipleChoiceItem().setTitle('Did they agree to try something specific, with a date?')
    .setChoiceValues(['Yes', 'No']);
  form.addParagraphTextItem().setTitle('If yes: what, and when');
}

function addEvidence(form) {
  form.addParagraphTextItem().setTitle('Strongest evidence from this chat (their words or what they did)')
    .setHelpText('Strong = already tracks it, tried and stopped, real recent example, time or money spent, agreed to try with a date. Weak = opinions, "I would…".');
  form.addParagraphTextItem().setTitle('Your interpretation: what it suggests');
}
